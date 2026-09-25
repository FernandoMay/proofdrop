import { createHash } from "node:crypto";

import { canonicalJson, type JsonValue } from "./canonical-json.js";
import type {
  ExecutionMode,
  ProofManifest,
  ProofManifestRequest,
  StellarAsset,
} from "./types.js";

export interface BuildManifestInput {
  mode: ExecutionMode;
  proofId: string;
  generatedAt: string;
  request: ProofManifestRequest;
  asset: StellarAsset;
  payment: {
    network: "Stellar Testnet" | "SIMULATED";
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

export function buildProofManifest(input: BuildManifestInput): ProofManifest {
  return {
    schemaVersion: "proofdrop.manifest.v1",
    mode: input.mode,
    proofId: input.proofId,
    generatedAt: input.generatedAt,
    request: input.request,
    asset: input.asset,
    payment: input.payment,
  };
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashProofManifest(manifest: ProofManifest): string {
  return sha256Hex(canonicalizeManifest(manifest));
}

export function canonicalizeManifest(manifest: ProofManifest): string {
  return canonicalManifestJson(manifest);
}

export function verifyProofManifestHash(manifest: ProofManifest, expectedHash: string): boolean {
  return /^[a-f0-9]{64}$/.test(expectedHash) && hashProofManifest(manifest) === expectedHash;
}

function canonicalManifestJson(manifest: ProofManifest): string {
  return canonicalJson(manifest as unknown as JsonValue);
}
