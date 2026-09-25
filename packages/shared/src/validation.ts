import { StrKey } from "@stellar/stellar-sdk";
import { z } from "zod";

import { decimalAmountsEqual, normalizeDecimalAmount } from "./amount.js";
import type {
  AvalancheAnchorEvidence,
  ExecutionMode,
  StellarAsset,
  StellarPaymentEvidence,
} from "./types.js";

export const createProofDropSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(1000).default(""),
    amount: z
      .string()
      .trim()
      .transform(normalizeDecimalAmount)
      .refine((amount) => amount !== "0.0000000", "Amount must be greater than zero."),
  })
  .strict();

export const verifyPaymentSchema = z
  .object({
    transactionHash: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

export const publicIdSchema = z.string().trim().min(5).max(128);

export function isStellarAccountId(value: string): boolean {
  return StrKey.isValidEd25519PublicKey(value);
}

export function isStellarTransactionHash(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isValidStellarSender(value: unknown): value is string {
  return typeof value === "string" && isStellarAccountId(value);
}

function isValidEvmAddressValue(value: unknown): value is string {
  return typeof value === "string" && isEvmAddress(value) && !/^0x0{40}$/i.test(value);
}

function isValidEvmTransactionHash(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

export function endpointOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function isSafePublicEndpoint(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.search === "" &&
      parsed.hash === ""
    );
  } catch {
    return false;
  }
}

export interface StellarEvidenceExpectation {
  transactionHash?: string | undefined;
  recipient?: string;
  amount?: string;
  memo?: string;
  asset?: StellarAsset;
}

export function isVerifiedStellarPaymentEvidence(
  value: unknown,
  expected: StellarEvidenceExpectation = {},
): value is StellarPaymentEvidence {
  if (!isRecord(value)) return false;
  if (
    value.verification !== "verified" ||
    value.successful !== true ||
    typeof value.transactionHash !== "string" ||
    !isStellarTransactionHash(value.transactionHash) ||
    typeof value.ledger !== "number" ||
    !Number.isInteger(value.ledger) ||
    value.ledger <= 0 ||
    typeof value.operationIndex !== "number" ||
    !Number.isInteger(value.operationIndex) ||
    value.operationIndex < 0 ||
    !isValidStellarSender(value.sender) ||
    !isValidStellarSender(value.recipient) ||
    typeof value.amount !== "string" ||
    typeof value.memo !== "string" ||
    value.memo.length === 0 ||
    !isValidTimestamp(value.verifiedAt)
  ) {
    return false;
  }

  if (!isSafePublicEndpoint(value.horizonUrl as string)) return false;

  const asset = value.asset;
  if (
    !isRecord(asset) ||
    asset.network !== "Stellar Testnet" ||
    asset.type !== "classic" ||
    typeof asset.code !== "string" ||
    !/^[A-Z0-9]{1,12}$/.test(asset.code) ||
    !isStellarAccountId(asset.issuer as string)
  ) {
    return false;
  }

  if (expected.transactionHash !== undefined && value.transactionHash !== expected.transactionHash) return false;
  if (expected.recipient !== undefined && value.recipient !== expected.recipient) return false;
  if (expected.amount !== undefined && !decimalAmountsEqual(value.amount, expected.amount)) return false;
  if (expected.memo !== undefined && value.memo !== expected.memo) return false;
  if (
    expected.asset !== undefined &&
    (asset.network !== expected.asset.network ||
      asset.type !== expected.asset.type ||
      asset.code !== expected.asset.code ||
      asset.issuer !== expected.asset.issuer)
  ) {
    return false;
  }

  return true;
}

export function isSimulatedStellarPaymentEvidence(
  value: unknown,
  expected: StellarEvidenceExpectation = {},
): value is StellarPaymentEvidence {
  if (!isRecord(value)) return false;
  if (
    value.verification !== "simulated" ||
    value.successful !== null ||
    value.ledger !== null ||
    typeof value.transactionHash !== "string" ||
    !value.transactionHash.startsWith("SIMULATED-") ||
    isStellarTransactionHash(value.transactionHash) ||
    typeof value.sender !== "string" ||
    !value.sender.startsWith("SIMULATED-") ||
    typeof value.recipient !== "string" ||
    typeof value.amount !== "string" ||
    typeof value.memo !== "string" ||
    value.memo.length === 0 ||
    !isValidTimestamp(value.verifiedAt)
  ) {
    return false;
  }

  const asset = value.asset;
  if (!isRecord(asset) || asset.network !== "SIMULATED" || asset.type !== "classic") return false;
  if (expected.recipient !== undefined && value.recipient !== expected.recipient) return false;
  if (expected.amount !== undefined && !decimalAmountsEqual(value.amount, expected.amount)) return false;
  if (expected.memo !== undefined && value.memo !== expected.memo) return false;
  if (
    expected.asset !== undefined &&
    (asset.network !== expected.asset.network ||
      asset.type !== expected.asset.type ||
      asset.code !== expected.asset.code ||
      asset.issuer !== expected.asset.issuer)
  ) {
    return false;
  }

  return true;
}

export interface AvalancheEvidenceExpectation {
  manifestHash?: string;
  stellarTransactionHash?: string;
  contractAddress?: string | `0x${string}` | undefined;
}

export function isVerifiedAvalancheAnchorEvidence(
  value: unknown,
  expected: AvalancheEvidenceExpectation = {},
): value is AvalancheAnchorEvidence {
  if (!isRecord(value)) return false;
  if (
    value.verification !== "verified" ||
    value.network !== "Avalanche Fuji" ||
    !isValidEvmAddressValue(value.contractAddress) ||
    !isValidEvmTransactionHash(value.transactionHash) ||
    typeof value.blockNumber !== "string" ||
    !/^[0-9]+$/.test(value.blockNumber) ||
    BigInt(value.blockNumber) <= 0n ||
    !isValidEvmAddressValue(value.logAddress) ||
    typeof value.manifestHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.manifestHash) ||
    typeof value.stellarTransactionHash !== "string" ||
    !isStellarTransactionHash(value.stellarTransactionHash) ||
    !isValidEvmAddressValue(value.anchorer) ||
    !isValidTimestamp(value.anchoredAt) ||
    typeof value.message !== "string" ||
    value.message.length === 0
  ) {
    return false;
  }

  if (typeof value.contractAddress !== "string" || typeof value.logAddress !== "string") return false;
  if (value.logAddress.toLowerCase() !== value.contractAddress.toLowerCase()) return false;
  if (expected.manifestHash !== undefined && value.manifestHash !== expected.manifestHash) return false;
  if (
    expected.stellarTransactionHash !== undefined &&
    value.stellarTransactionHash !== expected.stellarTransactionHash
  ) {
    return false;
  }
  if (
    expected.contractAddress !== undefined &&
    value.contractAddress.toLowerCase() !== expected.contractAddress.toLowerCase()
  ) {
    return false;
  }
  return true;
}

export function isSimulatedAvalancheAnchorEvidence(
  value: unknown,
  expected: AvalancheEvidenceExpectation = {},
): value is AvalancheAnchorEvidence {
  if (!isRecord(value)) return false;
  if (
    value.verification !== "simulated" ||
    value.network !== "SIMULATED" ||
    value.contractAddress !== null ||
    value.transactionHash !== null ||
    value.blockNumber !== null ||
    value.logAddress !== null ||
    value.anchorer !== null ||
    value.anchoredAt !== null ||
    typeof value.manifestHash !== "string" ||
    typeof value.stellarTransactionHash !== "string" ||
    typeof value.message !== "string" ||
    !value.message.includes("SIMULATED")
  ) {
    return false;
  }
  if (expected.manifestHash !== undefined && value.manifestHash !== expected.manifestHash) return false;
  if (
    expected.stellarTransactionHash !== undefined &&
    value.stellarTransactionHash !== expected.stellarTransactionHash
  ) {
    return false;
  }
  return true;
}

export function assertPublicIdForMode(value: string, mode: ExecutionMode): void {
  const pattern = mode === "demo" ? /^demo-[a-z0-9-]{6,80}$/ : /^PD-[A-F0-9]{8}$/;
  if (!pattern.test(value)) {
    throw new Error(`Public ID is not valid for ${mode} mode.`);
  }
}

export function assertDemoTransactionLabel(value: string): void {
  if (!value.startsWith("SIMULATED-") || isStellarTransactionHash(value)) {
    throw new Error("Demo transaction labels must be visibly simulated and must not resemble a transaction hash.");
  }
}
