import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/icons";
import { RecordModeBanner } from "@/components/mode-banner";
import { ProofEvidence } from "@/components/proof-evidence";
import { ShareButton } from "@/components/copy-button";
import { StateBadge, StatusTimeline } from "@/components/status-timeline";
import { ApiRequestError, getProof } from "@/lib/api";
import { formatDate, isVerifiedRecord } from "@/lib/format";

export const metadata: Metadata = { title: "Prueba pública" };
export const dynamic = "force-dynamic";

export default async function ProofPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let view;
  try {
    view = await getProof(id);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/proof/${view.proof.publicId}`;
  return (
    <section className="page-section proof-page">
      <div className="container page-stack">
        <RecordModeBanner mode={view.mode} />
        <div className="page-heading-row proof-heading">
          <div>
            <Link className="back-link" href={`/pay/${view.request.publicId}`}>← Volver a la solicitud</Link>
            <span className="mono-label blue">PRUEBA PÚBLICA · {view.proof.publicId}</span>
            <h1>{view.request.title}</h1>
            <p>Creada el {formatDate(view.request.createdAt)} · Manifiesto generado el {formatDate(view.proof.createdAt)}</p>
          </div>
          <div className="heading-actions"><StateBadge state={view.state} verifiedEvidence={isVerifiedRecord(view)} /><ShareButton title={view.request.title} text={`Prueba ProofDrop: ${shareUrl}`} /></div>
        </div>

        <div className="proof-status-strip">
          <StatusTimeline
            failedStage={view.proof.state === "failed" ? "anchor" : view.payment.verification === "failed" ? "payment" : undefined}
            mode={view.mode}
            state={view.state}
            verifiedEvidence={isVerifiedRecord(view)}
          />
        </div>
        <ProofEvidence view={view} />

        <div className="trust-boundary-card">
          <Icon name="shield" size={22} />
          <div><strong>Límite de confianza</strong><p>Una URL pública y un hash permiten recomputar el manifiesto. No prueban por sí solos que el pago exista; eso requiere la evidencia real de Stellar. El anclaje en Avalanche es posterior y secuencial.</p></div>
        </div>
      </div>
    </section>
  );
}
