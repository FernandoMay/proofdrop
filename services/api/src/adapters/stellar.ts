import {
  assertDemoTransactionLabel,
  decimalAmountsEqual,
  EvidenceVerificationError,
  ExternalServiceError,
  endpointOrigin,
  isStellarTransactionHash,
  isVerifiedStellarPaymentEvidence,
  type AdapterResult,
  type ProofDropRequest,
  type StellarAsset,
  type StellarPaymentEvidence,
} from "@proofdrop/shared";

import type { AppConfig } from "../config.js";

export interface VerifyStellarPaymentInput {
  transactionHash: string | null;
  request: ProofDropRequest;
  asset: StellarAsset;
  now: string;
}

export interface StellarPaymentAdapter {
  verifyPayment(input: VerifyStellarPaymentInput): Promise<AdapterResult<StellarPaymentEvidence>>;
}

function asRecord(value: unknown, message = "Horizon returned an invalid JSON document."): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EvidenceVerificationError(message);
  }
  return value as Record<string, unknown>;
}

function endpoint(baseUrl: string, path: string): URL {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path, normalizedBase);
}

function supportedStellarTestnet(config: AppConfig): boolean {
  if (config.stellar.network !== "testnet" || config.stellar.asset.network !== "Stellar Testnet") return false;
  try {
    const url = new URL(config.stellar.horizonUrl);
    return (
      url.protocol === "https:" &&
      url.hostname === "horizon-testnet.stellar.org" &&
      (url.port === "" || url.port === "443")
    );
  } catch {
    return false;
  }
}

function exactTextMemo(
  transaction: Record<string, unknown>,
  operation: Record<string, unknown>,
  expected: string,
): boolean {
  if (transaction.memo_type !== "text" || transaction.memo !== expected) return false;
  if (operation.memos === undefined) return true;
  if (!Array.isArray(operation.memos) || operation.memos.length !== 1) return false;
  const memo = asRecord(operation.memos[0], "Horizon returned an invalid operation memo.");
  return memo.type === "text" && memo.value === expected;
}

async function fetchJson(
  fetchImplementation: typeof fetch,
  url: URL,
  resourceName: string,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetchImplementation(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new ExternalServiceError(`${resourceName} could not be reached.`);
  }

  if (response.status === 404) {
    throw new EvidenceVerificationError(`${resourceName} did not find the requested document.`);
  }
  if (!response.ok) {
    throw new ExternalServiceError(`${resourceName} returned HTTP ${response.status}.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ExternalServiceError(`${resourceName} returned invalid JSON.`);
  }
  return asRecord(payload, `${resourceName} returned an invalid document.`);
}

export class HorizonStellarPaymentAdapter implements StellarPaymentAdapter {
  readonly #config: AppConfig;
  readonly #fetch: typeof fetch;

  constructor(config: AppConfig, fetchImplementation: typeof fetch = fetch) {
    this.#config = config;
    this.#fetch = fetchImplementation;
  }

  async verifyPayment(input: VerifyStellarPaymentInput): Promise<AdapterResult<StellarPaymentEvidence>> {
    if (this.#config.mode === "demo") {
      const transactionHash = `SIMULATED-STELLAR-${input.request.publicId}`;
      assertDemoTransactionLabel(transactionHash);
      return {
        status: "simulated",
        message: "SIMULATED: no Stellar transaction was submitted or queried.",
        evidence: {
          verification: "simulated",
          transactionHash,
          ledger: null,
          successful: null,
          sender: "SIMULATED-STELLAR-SENDER",
          recipient: input.request.recipient,
          operationIndex: 0,
          amount: input.request.amount,
          asset: input.asset,
          memo: input.request.memo,
          horizonUrl: null,
          verifiedAt: input.now,
        },
      };
    }

    if (!supportedStellarTestnet(this.#config)) {
      return {
        status: "unconfigured",
        evidence: null,
        message: "The configured Stellar endpoint does not identify the supported Stellar Testnet network.",
      };
    }

    if (!input.transactionHash || !isStellarTransactionHash(input.transactionHash)) {
      return {
        status: "unconfigured",
        evidence: null,
        message: "A lowercase 64-character Stellar transaction hash is required in real mode.",
      };
    }

    const transaction = await fetchJson(
      this.#fetch,
      endpoint(this.#config.stellar.horizonUrl, `transactions/${encodeURIComponent(input.transactionHash)}`),
      "Stellar Horizon",
    );
    if (transaction.hash !== input.transactionHash) {
      throw new EvidenceVerificationError("Horizon returned a different transaction hash.");
    }
    if (transaction.successful !== true) {
      throw new EvidenceVerificationError("The Stellar transaction was not successful.");
    }

    const operationsDocument = await fetchJson(
      this.#fetch,
      endpoint(
        this.#config.stellar.horizonUrl,
        `transactions/${encodeURIComponent(input.transactionHash)}/operations`,
      ),
      "Stellar Horizon operations",
    );
    if (!Array.isArray(operationsDocument.records)) {
      throw new EvidenceVerificationError("Horizon operations response did not contain a records collection.");
    }

    const matches: Array<{ index: number; operation: Record<string, unknown> }> = [];
    for (const [index, candidate] of operationsDocument.records.entries()) {
      const operation = asRecord(candidate, "Horizon returned an invalid operation document.");
      if (operation.type !== "payment") continue;

      if (
        operation.transaction_hash === input.transactionHash &&
        operation.transaction_successful === true &&
        operation.asset_type === "credit_alphanum4" &&
        operation.asset_code === input.asset.code &&
        operation.asset_issuer === input.asset.issuer &&
        operation.to === input.request.recipient &&
        typeof operation.amount === "string" &&
        decimalAmountsEqual(operation.amount, input.request.amount) &&
        typeof operation.from === "string" &&
        exactTextMemo(transaction, operation, input.request.memo)
      ) {
        matches.push({ index, operation });
      }
    }

    if (matches.length !== 1) {
      throw new EvidenceVerificationError(
        "The transaction must contain exactly one matching successful classic USDC Payment operation with the expected recipient, amount, asset, and text memo.",
      );
    }

    const ledger = transaction.ledger;
    if (typeof ledger !== "number" || !Number.isInteger(ledger) || ledger <= 0) {
      throw new EvidenceVerificationError("Horizon did not return a valid ledger number.");
    }

    const match = matches[0]!;
    const publicHorizonUrl = endpointOrigin(this.#config.stellar.horizonUrl);
    if (publicHorizonUrl === null) {
      throw new ExternalServiceError("Stellar Horizon endpoint could not be represented safely.");
    }
    const evidence: StellarPaymentEvidence = {
      verification: "verified",
      transactionHash: input.transactionHash,
      ledger,
      successful: true,
      sender: match.operation.from as string,
      recipient: input.request.recipient,
      operationIndex: match.index,
      amount: input.request.amount,
      asset: input.asset,
      memo: input.request.memo,
      horizonUrl: publicHorizonUrl,
      verifiedAt: input.now,
    };
    if (
      !isVerifiedStellarPaymentEvidence(evidence, {
        transactionHash: input.transactionHash,
        recipient: input.request.recipient,
        amount: input.request.amount,
        memo: input.request.memo,
        asset: input.asset,
      })
    ) {
      throw new ExternalServiceError("Stellar adapter produced incomplete verified evidence.");
    }

    return {
      status: "verified",
      message: "Verified against the configured Stellar Testnet Horizon endpoint.",
      evidence,
    };
  }
}
