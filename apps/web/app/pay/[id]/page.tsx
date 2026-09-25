import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/icons";
import { RecordModeBanner } from "@/components/mode-banner";
import { PayActions } from "@/components/pay-actions";
import { StateBadge, StatusTimeline } from "@/components/status-timeline";
import { ApiRequestError, getProofDrop } from "@/lib/api";
import { formatAmount, formatDate, isVerifiedRecord } from "@/lib/format";

export const metadata: Metadata = { title: "Pagar solicitud" };
export const dynamic = "force-dynamic";

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let drop;
  try {
    drop = await getProofDrop(id);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  return (
    <section className="page-section section-glow-soft">
      <div className="container page-stack">
        <RecordModeBanner mode={drop.mode} />
        <div className="page-heading-row">
          <div>
            <Link className="back-link" href="/dashboard">← Volver a actividad</Link>
            <span className="mono-label blue">SOLICITUD {drop.request.publicId}</span>
            <h1>{drop.request.title}</h1>
            <p>{drop.request.description || "Sin descripción adicional."}</p>
          </div>
          <StateBadge state={drop.state} verifiedEvidence={isVerifiedRecord(drop)} />
        </div>

        <div className="payment-grid">
          <div className="detail-stack">
            <div className="detail-card">
              <div className="card-title-row"><div><span className="mono-label">DETALLE DEL PAGO</span><h2>{formatAmount(drop.request.amount)}</h2></div><div className="asset-mark">$</div></div>
              <dl className="detail-list">
                <div><dt>Red</dt><dd><span className={`network-dot ${drop.mode === "demo" ? "simulated" : "stellar"}`} /> {drop.mode === "demo" ? "SIMULATED · sin red externa" : "Stellar Testnet · modo real"}</dd></div>
                <div><dt>Activo</dt><dd>USDC clásico</dd></div>
                <div><dt>Emisor</dt><dd className="mono-value">{drop.request.asset.issuer}</dd></div>
                <div><dt>Destinatario</dt><dd className="mono-value">{drop.request.recipient}</dd></div>
                <div><dt>Memo exacto</dt><dd className="mono-value">{drop.request.memo}</dd></div>
                <div><dt>Creada</dt><dd>{formatDate(drop.request.createdAt)}</dd></div>
              </dl>
            </div>

            <div className="detail-card">
              <span className="mono-label">SECUENCIA DE EVIDENCIA</span>
              <h2>No es un flujo atómico</h2>
              <StatusTimeline
                failedStage={drop.proof?.state === "failed" ? "anchor" : drop.payment.verification === "failed" ? "payment" : undefined}
                mode={drop.mode}
                state={drop.state}
                verifiedEvidence={isVerifiedRecord(drop)}
              />
              <p className="muted-note"><Icon name="network" size={16} /> Stellar se verifica primero. El anclaje en Avalanche es un paso posterior.</p>
            </div>
          </div>

          <PayActions drop={drop} />
        </div>
      </div>
    </section>
  );
}
