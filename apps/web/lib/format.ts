import {
  isVerifiedAvalancheAnchorEvidence,
  isVerifiedStellarPaymentEvidence,
  type AggregateState,
  type ProofView,
} from "@proofdrop/shared";

export const stateLabels: Record<AggregateState, string> = {
  pending: "Pendiente",
  payment_submitted: "Pago enviado",
  payment_verified: "Pago verificado",
  anchor_pending: "Anclaje pendiente",
  anchored: "Anclado",
  verified: "Verificado",
  failed: "Fallido",
  simulated: "Simulado",
};

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatAmount(value: string): string {
  return `${value} USDC`;
}

export function shortId(value: string, visible = 10): string {
  if (value.length <= visible * 2 + 3) return value;
  return `${value.slice(0, visible)}…${value.slice(-visible)}`;
}

type EvidenceRecord = Pick<ProofView, "state" | "request" | "payment"> & {
  proof: ProofView["proof"] | null;
};

export function isVerifiedRecord(record: EvidenceRecord): boolean {
  if (record.state !== "verified" || !record.proof) return false;
  const stellar = isVerifiedStellarPaymentEvidence(record.payment.evidence, {
    transactionHash: record.proof.manifest.payment.transactionHash,
    recipient: record.request.recipient,
    amount: record.request.amount,
    memo: record.request.memo,
    asset: record.request.asset,
  });
  const avalanche = isVerifiedAvalancheAnchorEvidence(record.proof.anchor, {
    manifestHash: record.proof.manifestHash,
    stellarTransactionHash: record.proof.manifest.payment.transactionHash,
  });
  return stellar && avalanche;
}
