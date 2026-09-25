export const AGGREGATE_STATES = [
  "pending",
  "payment_submitted",
  "payment_verified",
  "anchor_pending",
  "anchored",
  "verified",
  "failed",
  "simulated",
] as const;

export type AggregateState = (typeof AGGREGATE_STATES)[number];
export type ExecutionMode = "demo" | "real";
export type VerificationStatus = "not_checked" | "verified" | "simulated" | "unconfigured" | "failed";
export type AdapterResultStatus = "verified" | "simulated" | "unconfigured";

export type StellarNetwork = "Stellar Testnet" | "SIMULATED";
export type AvalancheNetwork = "Avalanche Fuji" | "SIMULATED";

export interface StellarAsset {
  network: StellarNetwork;
  type: "classic";
  code: string;
  issuer: string;
}

export interface StellarPaymentEvidence {
  verification: "verified" | "simulated";
  transactionHash: string;
  ledger: number | null;
  successful: boolean | null;
  sender: string;
  recipient: string;
  operationIndex: number;
  amount: string;
  asset: StellarAsset;
  memo: string;
  horizonUrl: string | null;
  verifiedAt: string;
}

export interface PaymentRecord {
  state: "pending" | "payment_submitted" | "payment_verified" | "failed";
  verification: VerificationStatus;
  transactionHash: string | null;
  evidence: StellarPaymentEvidence | null;
  lastError: string | null;
}

export interface AvalancheAnchorEvidence {
  verification: "verified" | "simulated";
  network: AvalancheNetwork;
  contractAddress: string | null;
  transactionHash: string | null;
  blockNumber: string | null;
  logAddress: string | null;
  manifestHash: string;
  stellarTransactionHash: string;
  anchorer: string | null;
  anchoredAt: string | null;
  message: string;
}

export interface ProofManifestRequest {
  publicId: string;
  title: string;
  description: string;
  amount: string;
  recipient: string;
  memo: string;
  createdAt: string;
}

export interface ProofManifest {
  schemaVersion: "proofdrop.manifest.v1";
  mode: ExecutionMode;
  proofId: string;
  generatedAt: string;
  request: ProofManifestRequest;
  asset: StellarAsset;
  payment: {
    network: StellarNetwork;
    transactionHash: string;
    ledger: number | null;
    operationIndex: number;
    status: "successful" | "simulated";
    sender: string;
    amount: string;
    memo: string;
    verification: "verified" | "simulated";
  };
}

export interface ProofRecord {
  publicId: string;
  state: "pending" | "anchor_pending" | "anchored" | "verified" | "failed" | "simulated";
  manifest: ProofManifest;
  manifestHash: string;
  anchorVerification: VerificationStatus;
  anchor: AvalancheAnchorEvidence | null;
  lastError: string | null;
  createdAt: string;
}

export interface ProofDropRequest {
  publicId: string;
  mode: ExecutionMode;
  title: string;
  description: string;
  amount: string;
  recipient: string;
  memo: string;
  asset: StellarAsset;
  createdAt: string;
  updatedAt: string;
}

export interface ProofDropRecord {
  state: AggregateState;
  request: ProofDropRequest;
  payment: PaymentRecord;
  proof: ProofRecord | null;
  lastError: string | null;
}

export interface ProofDropLinks {
  self: string;
  pay: string;
  proof: string | null;
}

export interface ProofDropView {
  state: AggregateState;
  mode: ExecutionMode;
  request: ProofDropRequest;
  payment: PaymentRecord;
  proof: ProofRecord | null;
  links: ProofDropLinks;
  lastError: string | null;
}

export interface ProofView {
  proof: ProofRecord;
  request: ProofDropRequest;
  payment: PaymentRecord;
  state: AggregateState;
  mode: ExecutionMode;
  links: ProofDropLinks;
}

export interface CreateProofDropInput {
  title: string;
  description: string;
  amount: string;
}

export interface AdapterResult<T> {
  status: AdapterResultStatus;
  evidence: T | null;
  message: string;
}
