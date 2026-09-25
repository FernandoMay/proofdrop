import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/icons";
import { StateBadge } from "@/components/status-timeline";
import { getRecentProofDrops } from "@/lib/api";
import { formatAmount, formatDate, isVerifiedRecord, shortId } from "@/lib/format";

export const metadata: Metadata = { title: "Actividad" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const drops = await getRecentProofDrops();

  return (
    <section className="page-section section-glow-soft">
      <div className="container page-stack">
        <div className="page-heading-row">
          <div><span className="mono-label blue">REPOSITORIO LOCAL</span><h1>Actividad reciente</h1><p>Solo solicitudes reales del repositorio en memoria. No hay actividad de muestra precargada.</p></div>
          <Link className="button button-primary" href="/create">Crear solicitud <Icon name="arrow" size={17} /></Link>
        </div>

        <div className="dashboard-summary">
          <div><span>Total visible</span><strong>{drops.length}</strong></div>
          <div><span>Simuladas</span><strong>{drops.filter((drop) => drop.mode === "demo").length}</strong></div>
          <div><span>Con manifiesto</span><strong>{drops.filter((drop) => drop.proof).length}</strong></div>
        </div>

        {drops.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><Icon name="document" size={28} /></div><h2>Todavía no hay solicitudes</h2><p>Crea una para recorrer el flujo demo completo.</p><Link className="button button-primary" href="/create">Crear la primera</Link></div>
        ) : (
          <div className="activity-list">
            {drops.map((drop) => (
              <article className="activity-row" key={drop.request.publicId}>
                <div className="activity-main">
                  <div className="activity-title"><strong>{drop.request.title}</strong><StateBadge state={drop.state} verifiedEvidence={isVerifiedRecord(drop)} /></div>
                  <span>{drop.request.publicId} · {formatDate(drop.request.createdAt)}</span>
                </div>
                <div className="activity-amount"><span>Importe</span><strong>{formatAmount(drop.request.amount)}</strong></div>
                <div className="activity-hash"><span>Manifiesto</span><code>{drop.proof ? shortId(drop.proof.manifestHash, 9) : "Pendiente"}</code></div>
                <div className="activity-actions">
                  <Link className="button button-ghost button-small" href={`/pay/${drop.request.publicId}`}>Abrir</Link>
                  {drop.proof && <Link aria-label={`Abrir prueba ${drop.request.title}`} className="button button-secondary button-small" href={`/proof/${drop.proof.publicId}`}><Icon name="external" size={15} /></Link>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
