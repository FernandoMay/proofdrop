import { randomBytes } from "node:crypto";

import {
  AdapterUnconfiguredError,
  buildProofManifest,
  ConflictError,
  EvidenceVerificationError,
  ExternalServiceError,
  hashProofManifest,
  isStellarTransactionHash,
  isSimulatedAvalancheAnchorEvidence,
  isSimulatedStellarPaymentEvidence,
  isVerifiedAvalancheAnchorEvidence,
  isVerifiedStellarPaymentEvidence,
  NotFoundError,
  type AdapterResult,
  type AggregateState,
  type AvalancheAnchorEvidence,
  type CreateProofDropInput,
  type ExecutionMode,
  type ProofDropRecord,
  type ProofDropView,
  type ProofView,
  type StellarPaymentEvidence,
} from "@proofdrop/shared";

import type { AvalancheAnchorAdapter } from "../adapters/avalanche.js";
import type { StellarPaymentAdapter } from "../adapters/stellar.js";
import type { AppConfig } from "../config.js";
import type { ProofDropRepository } from "../repository/proof-drop-repository.js";

const ALLOWED_TRANSITIONS: Record<AggregateState, readonly AggregateState[]> = {
  pending: ["payment_submitted", "failed"],
  payment_submitted: ["payment_verified", "failed"],
  payment_verified: ["anchor_pending", "failed"],
  anchor_pending: ["anchored", "simulated", "failed"],
  anchored: ["verified", "failed"],
  verified: [],
  failed: [],
  simulated: [],
};

export type IdGenerator = (kind: "request" | "proof", mode: ExecutionMode) => string;
export type Clock = () => Date;

const repositoryProofLocks = new WeakMap<ProofDropRepository, Map<string, Promise<void>>>();

function proofLocksFor(repository: ProofDropRepository): Map<string, Promise<void>> {
  const existing = repositoryProofLocks.get(repository);
  if (existing) return existing;
  const created = new Map<string, Promise<void>>();
  repositoryProofLocks.set(repository, created);
  return created;
}

function defaultIdGenerator(kind: "request" | "proof", mode: ExecutionMode): string {
  const suffix = randomBytes(4).toString("hex");
  return mode === "demo" ? `demo-${kind === "proof" ? "proof-" : ""}${suffix}` : `PD-${suffix.toUpperCase()}`;
}

export interface ProofDropServiceDependencies {
  config: AppConfig;
  repository: ProofDropRepository;
  stellarAdapter: StellarPaymentAdapter;
  avalancheAdapter: AvalancheAnchorAdapter;
  clock?: Clock;
  generateId?: IdGenerator;
}

export class ProofDropService {
  readonly #config: AppConfig;
  readonly #repository: ProofDropRepository;
  readonly #stellarAdapter: StellarPaymentAdapter;
  readonly #avalancheAdapter: AvalancheAnchorAdapter;
  readonly #clock: Clock;
  readonly #generateId: IdGenerator;
  readonly #proofLocks: Map<string, Promise<void>>;

  constructor(dependencies: ProofDropServiceDependencies) {
    this.#config = dependencies.config;
    this.#repository = dependencies.repository;
    this.#stellarAdapter = dependencies.stellarAdapter;
    this.#avalancheAdapter = dependencies.avalancheAdapter;
    this.#clock = dependencies.clock ?? (() => new Date());
    this.#generateId = dependencies.generateId ?? defaultIdGenerator;
    this.#proofLocks = proofLocksFor(dependencies.repository);
  }

  async createDrop(input: CreateProofDropInput): Promise<ProofDropView> {
    const recipient =
      this.#config.stellar.recipientPublicKey ??
      (this.#config.mode === "demo" ? "SIMULATED-STELLAR-RECIPIENT" : null);
    if (!recipient) {
      throw new AdapterUnconfiguredError("Real mode requires STELLAR_RECIPIENT_PUBLIC_KEY before creating a request.");
    }

    const now = this.#clock().toISOString();
    const publicId = await this.#uniqueId("request");
    const record: ProofDropRecord = {
      state: "pending",
      request: {
        publicId,
        mode: this.#config.mode,
        title: input.title,
        description: input.description,
        amount: input.amount,
        recipient,
        memo: publicId,
        asset: this.#config.stellar.asset,
        createdAt: now,
        updatedAt: now,
      },
      payment: {
        state: "pending",
        verification: "not_checked",
        transactionHash: null,
        evidence: null,
        lastError: null,
      },
      proof: null,
      lastError: null,
    };

    return this.#toView(await this.#repository.create(record));
  }

  async getDrop(publicId: string): Promise<ProofDropView> {
    return this.#toView(await this.#requireByRequestId(publicId));
  }

  async listDrops(limit = 20): Promise<ProofDropView[]> {
    const records = await this.#repository.listRecent(limit);
    return records.map((record) => this.#toView(record));
  }

  async verifyPayment(
    publicId: string,
    transactionHash: string | null,
  ): Promise<{ status: AdapterResult<StellarPaymentEvidence>["status"]; drop: ProofDropView }> {
    const record = await this.#requireByRequestId(publicId);
    if (record.payment.evidence && record.state !== "failed") {
      const expectedVerification = this.#config.mode === "demo" ? "simulated" : "verified";
      const evidenceIsValid =
        this.#config.mode === "demo"
          ? isSimulatedStellarPaymentEvidence(record.payment.evidence, {
              recipient: record.request.recipient,
              amount: record.request.amount,
              memo: record.request.memo,
              asset: record.request.asset,
            })
          : isVerifiedStellarPaymentEvidence(record.payment.evidence, {
              transactionHash: record.payment.transactionHash ?? undefined,
              recipient: record.request.recipient,
              amount: record.request.amount,
              memo: record.request.memo,
              asset: record.request.asset,
            });
      if (record.payment.verification === expectedVerification && evidenceIsValid) {
        return { status: record.payment.verification, drop: this.#toView(record) };
      }
      throw new ExternalServiceError("Stored Stellar evidence does not satisfy the configured request or mode.");
    }
    if (record.state !== "pending") {
      throw new ConflictError(`Payment cannot be verified while the proof drop is ${record.state}.`);
    }
    if (this.#config.mode === "real" && (!transactionHash || !isStellarTransactionHash(transactionHash))) {
      throw new EvidenceVerificationError("Real mode requires a lowercase 64-character Stellar transaction hash.");
    }

    try {
      const result = await this.#stellarAdapter.verifyPayment({
        transactionHash,
        request: structuredClone(record.request),
        asset: structuredClone(record.request.asset),
        now: this.#clock().toISOString(),
      });

      if (result.status === "unconfigured" || !result.evidence) {
        record.payment.verification = "unconfigured";
        record.payment.transactionHash = null;
        record.payment.evidence = null;
        record.payment.lastError = result.message;
        record.lastError = result.message;
        record.request.updatedAt = this.#clock().toISOString();
        await this.#repository.save(record);
        return { status: "unconfigured", drop: this.#toView(record) };
      }
      const expectedVerification = this.#config.mode === "demo" ? "simulated" : "verified";
      const evidenceIsValid =
        this.#config.mode === "demo"
          ? isSimulatedStellarPaymentEvidence(result.evidence, {
              recipient: record.request.recipient,
              amount: record.request.amount,
              memo: record.request.memo,
              asset: record.request.asset,
            })
          : isVerifiedStellarPaymentEvidence(result.evidence, {
              transactionHash: transactionHash ?? undefined,
              recipient: record.request.recipient,
              amount: record.request.amount,
              memo: record.request.memo,
              asset: record.request.asset,
            });
      if (
        result.status !== expectedVerification ||
        result.evidence.verification !== expectedVerification ||
        !evidenceIsValid
      ) {
        throw new ExternalServiceError("Stellar adapter returned evidence that conflicts with the configured request or mode.");
      }

      this.#transition(record, "payment_submitted");
      record.payment.state = "payment_submitted";
      record.payment.transactionHash = result.evidence.transactionHash;
      this.#transition(record, "payment_verified");
      record.payment = {
        state: "payment_verified",
        verification: result.evidence.verification,
        transactionHash: result.evidence.transactionHash,
        evidence: result.evidence,
        lastError: null,
      };
      record.lastError = null;
      record.request.updatedAt = this.#clock().toISOString();
      await this.#repository.save(record);
      return { status: result.status, drop: this.#toView(record) };
    } catch (error) {
      if (error instanceof EvidenceVerificationError) {
        this.#transition(record, "failed");
        record.payment.state = "failed";
        record.payment.verification = "failed";
        record.payment.transactionHash = null;
        record.payment.lastError = error.message;
        record.lastError = error.message;
        record.request.updatedAt = this.#clock().toISOString();
        await this.#repository.save(record);
      }
      throw error;
    }
  }

  async createProof(publicId: string): Promise<ProofView> {
    return this.#withProofLock(publicId, () => this.#createProofLocked(publicId));
  }

  async #createProofLocked(publicId: string): Promise<ProofView> {
    const record = await this.#requireByRequestId(publicId);
    if (record.proof) return this.#toProofView(record);

    if (record.state !== "payment_verified" || !record.payment.evidence) {
      throw new ConflictError("A proof manifest can only be created after a verified or explicitly simulated payment.");
    }
    const expectedPaymentVerification = this.#config.mode === "demo" ? "simulated" : "verified";
    const paymentEvidenceIsValid =
      this.#config.mode === "demo"
        ? isSimulatedStellarPaymentEvidence(record.payment.evidence, {
            recipient: record.request.recipient,
            amount: record.request.amount,
            memo: record.request.memo,
            asset: record.request.asset,
          })
        : isVerifiedStellarPaymentEvidence(record.payment.evidence, {
            transactionHash: record.payment.transactionHash ?? undefined,
            recipient: record.request.recipient,
            amount: record.request.amount,
            memo: record.request.memo,
            asset: record.request.asset,
          });
    if (record.payment.evidence.verification !== expectedPaymentVerification || !paymentEvidenceIsValid) {
      throw new ConflictError("Payment evidence conflicts with the configured ProofDrop request or mode.");
    }

    const now = this.#clock().toISOString();
    const proofId = await this.#uniqueId("proof");
    const evidence = record.payment.evidence;
    const manifest = buildProofManifest({
      mode: record.request.mode,
      proofId,
      generatedAt: now,
      request: {
        publicId: record.request.publicId,
        title: record.request.title,
        description: record.request.description,
        amount: record.request.amount,
        recipient: record.request.recipient,
        memo: record.request.memo,
        createdAt: record.request.createdAt,
      },
      asset: record.request.asset,
      payment: {
        network: record.request.asset.network,
        transactionHash: evidence.transactionHash,
        ledger: evidence.ledger,
        operationIndex: evidence.operationIndex,
        status: record.request.mode === "demo" ? "simulated" : "successful",
        sender: evidence.sender,
        amount: evidence.amount,
        memo: evidence.memo,
        verification: evidence.verification,
      },
    });

    record.proof = {
      publicId: proofId,
      state: "anchor_pending",
      manifest,
      manifestHash: hashProofManifest(manifest),
      anchorVerification: "not_checked",
      anchor: null,
      lastError: null,
      createdAt: now,
    };
    this.#transition(record, "anchor_pending");
    record.request.updatedAt = now;
    await this.#repository.save(record);
    return this.#toProofView(record);
  }

  async anchorProof(proofId: string): Promise<{
    status: AdapterResult<AvalancheAnchorEvidence>["status"];
    proof: ProofView;
  }> {
    const record = await this.#requireByProofId(proofId);
    const proof = record.proof!;
    const expectedPaymentVerification = this.#config.mode === "demo" ? "simulated" : "verified";
    const paymentEvidenceIsValid =
      this.#config.mode === "demo"
        ? isSimulatedStellarPaymentEvidence(record.payment.evidence, {
            recipient: record.request.recipient,
            amount: record.request.amount,
            memo: record.request.memo,
            asset: record.request.asset,
          })
        : isVerifiedStellarPaymentEvidence(record.payment.evidence, {
            transactionHash: record.payment.transactionHash ?? undefined,
            recipient: record.request.recipient,
            amount: record.request.amount,
            memo: record.request.memo,
            asset: record.request.asset,
          });
    if (
      record.payment.evidence?.verification !== expectedPaymentVerification ||
      !paymentEvidenceIsValid
    ) {
      throw new ConflictError("A manifest cannot be anchored without valid payment evidence.");
    }

    const expectedAnchorVerification = this.#config.mode === "demo" ? "simulated" : "verified";
    const existingAnchorIsValid = proof.anchor && proof.anchorVerification === proof.anchor.verification
      ? this.#config.mode === "demo"
        ? isSimulatedAvalancheAnchorEvidence(proof.anchor, {
            manifestHash: proof.manifestHash,
            stellarTransactionHash: proof.manifest.payment.transactionHash,
            contractAddress: this.#config.avalanche.registryAddress ?? undefined,
          })
        : isVerifiedAvalancheAnchorEvidence(proof.anchor, {
            manifestHash: proof.manifestHash,
            stellarTransactionHash: proof.manifest.payment.transactionHash,
            contractAddress: this.#config.avalanche.registryAddress ?? undefined,
          })
      : false;
    if ((proof.state === "verified" || proof.state === "simulated") && existingAnchorIsValid) {
      return { status: proof.anchor!.verification, proof: this.#toProofView(record) };
    }
    if (proof.state === "anchored" && existingAnchorIsValid) {
      proof.state = "verified";
      this.#transition(record, "verified");
      record.request.updatedAt = this.#clock().toISOString();
      await this.#repository.save(record);
      return { status: "verified", proof: this.#toProofView(record) };
    }
    if (proof.state !== "anchor_pending") {
      throw new ConflictError(`Manifest cannot be anchored while the proof is ${proof.state}.`);
    }

    let result: AdapterResult<AvalancheAnchorEvidence>;
    try {
      result = await this.#avalancheAdapter.anchorManifest({
        manifestHash: proof.manifestHash,
        stellarTransactionHash: proof.manifest.payment.transactionHash,
        proofId: proof.publicId,
        now: this.#clock().toISOString(),
      });
    } catch (error) {
      if (error instanceof EvidenceVerificationError) {
        proof.state = "failed";
        proof.anchorVerification = "failed";
        proof.lastError = error.message;
        record.lastError = error.message;
        this.#transition(record, "failed");
        record.request.updatedAt = this.#clock().toISOString();
        await this.#repository.save(record);
      }
      throw error;
    }

    if (result.status === "unconfigured" || !result.evidence) {
      proof.anchor = null;
      proof.anchorVerification = "unconfigured";
      proof.lastError = result.message;
      record.lastError = result.message;
      await this.#repository.save(record);
      return { status: "unconfigured", proof: this.#toProofView(record) };
    }

    const evidenceIsValid =
      this.#config.mode === "demo"
        ? isSimulatedAvalancheAnchorEvidence(result.evidence, {
            manifestHash: proof.manifestHash,
            stellarTransactionHash: proof.manifest.payment.transactionHash,
            contractAddress: this.#config.avalanche.registryAddress ?? undefined,
          })
        : isVerifiedAvalancheAnchorEvidence(result.evidence, {
            manifestHash: proof.manifestHash,
            stellarTransactionHash: proof.manifest.payment.transactionHash,
            contractAddress: this.#config.avalanche.registryAddress ?? undefined,
          });
    if (
      result.status !== expectedAnchorVerification ||
      result.evidence.verification !== expectedAnchorVerification ||
      !evidenceIsValid
    ) {
      throw new ExternalServiceError("Avalanche adapter returned evidence that conflicts with the configured request or mode.");
    }

    proof.anchor = result.evidence;
    proof.anchorVerification = result.evidence.verification;
    proof.lastError = null;
    record.lastError = null;
    if (result.evidence.verification === "simulated") {
      proof.state = "simulated";
      this.#transition(record, "simulated");
    } else {
      proof.state = "anchored";
      this.#transition(record, "anchored");
      await this.#repository.save(record);
      proof.state = "verified";
      this.#transition(record, "verified");
    }
    record.request.updatedAt = this.#clock().toISOString();
    await this.#repository.save(record);
    return { status: result.status, proof: this.#toProofView(record) };
  }

  async getProof(publicId: string): Promise<ProofView> {
    return this.#toProofView(await this.#requireByProofId(publicId));
  }

  async #withProofLock<T>(publicId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.#proofLocks.get(publicId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.#proofLocks.set(publicId, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.#proofLocks.get(publicId) === current) {
        this.#proofLocks.delete(publicId);
      }
    }
  }

  async #uniqueId(kind: "request" | "proof"): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const id = this.#generateId(kind, this.#config.mode);
      const existing = kind === "request" ? await this.#repository.getByRequestId(id) : await this.#repository.getByProofId(id);
      if (!existing) return id;
    }
    throw new Error(`Unable to generate a unique ${kind} ID.`);
  }

  async #requireByRequestId(publicId: string): Promise<ProofDropRecord> {
    const record = await this.#repository.getByRequestId(publicId);
    if (!record) throw new NotFoundError(`Proof drop ${publicId} was not found.`);
    return record;
  }

  async #requireByProofId(publicId: string): Promise<ProofDropRecord> {
    const record = await this.#repository.getByProofId(publicId);
    if (!record?.proof) throw new NotFoundError(`Proof ${publicId} was not found.`);
    return record;
  }

  #transition(record: ProofDropRecord, next: AggregateState): void {
    if (record.state === next) return;
    if (!ALLOWED_TRANSITIONS[record.state].includes(next)) {
      throw new ConflictError(`Invalid monotonic state transition: ${record.state} -> ${next}.`);
    }
    record.state = next;
  }

  #toView(record: ProofDropRecord): ProofDropView {
    return {
      state: record.state,
      mode: record.request.mode,
      request: structuredClone(record.request),
      payment: structuredClone(record.payment),
      proof: record.proof ? structuredClone(record.proof) : null,
      lastError: record.lastError,
      links: {
        self: `/api/v1/proof-drops/${record.request.publicId}`,
        pay: `/pay/${record.request.publicId}`,
        proof: record.proof ? `/api/v1/proofs/${record.proof.publicId}` : null,
      },
    };
  }

  #toProofView(record: ProofDropRecord): ProofView {
    if (!record.proof) throw new ConflictError("The proof manifest does not exist.");
    return {
      proof: structuredClone(record.proof),
      request: structuredClone(record.request),
      payment: structuredClone(record.payment),
      state: record.state,
      mode: record.request.mode,
      links: {
        self: `/api/v1/proofs/${record.proof.publicId}`,
        pay: `/pay/${record.request.publicId}`,
        proof: `/api/v1/proofs/${record.proof.publicId}`,
      },
    };
  }
}
