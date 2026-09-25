import type { AggregateState, ExecutionMode } from "@proofdrop/shared";

import { Icon } from "./icons";
import { stateLabels } from "@/lib/format";

const stateOrder: AggregateState[] = ["pending", "payment_verified", "anchor_pending", "verified"];

export function StatusTimeline({
  state,
  mode,
  failedStage,
  verifiedEvidence,
}: {
  state: AggregateState;
  mode: ExecutionMode;
  failedStage?: "payment" | "anchor" | undefined;
  verifiedEvidence?: boolean | undefined;
}) {
  const terminal =
    state === "simulated"
      ? "verified"
      : state === "verified" && verifiedEvidence !== true
        ? "anchor_pending"
        : state;
  const activeIndex = stateOrder.indexOf(terminal);
  const failedIndex = state === "failed" ? (failedStage === "anchor" ? 3 : 1) : -1;
  const labels = mode === "demo"
    ? ["Solicitud creada", "Pago simulado", "Manifiesto creado", "Anclaje simulado"]
    : ["Solicitud creada", "Pago verificado", "Manifiesto creado", "Anclaje verificado"];

  return (
    <ol aria-label="Estado de la verificación" className="timeline">
      {labels.map((label, index) => {
        const failed = state === "failed" && index === failedIndex;
        const complete = state === "failed" ? index < failedIndex : activeIndex > index;
        const active = state !== "failed" && activeIndex === index;
        return (
          <li className={`timeline-step ${complete ? "complete" : ""} ${active ? "active" : ""} ${failed ? "failed" : ""}`} key={label}>
            <span className="timeline-dot">{complete ? <Icon name="check" size={15} /> : failed ? "!" : index + 1}</span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function StateBadge({ state, verifiedEvidence = false }: { state: AggregateState; verifiedEvidence?: boolean | undefined }) {
  const safeState = state === "verified" && !verifiedEvidence ? "pending" : state;
  const label = state === "verified" && !verifiedEvidence ? "Evidencia pendiente" : stateLabels[safeState];
  return <span className={`state-badge state-${safeState}`}>{label}</span>;
}
