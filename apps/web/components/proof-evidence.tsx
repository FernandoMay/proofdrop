import {
  canonicalizeManifest,
  isVerifiedAvalancheAnchorEvidence,
  isVerifiedStellarPaymentEvidence,
  type ProofView,
} from "@proofdrop/shared";

import { CopyButton } from "./copy-button";
import { Icon } from "./icons";
import { formatAmount, formatDate, shortId } from "@/lib/format";

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd className="mono-value">{value}</dd></div>;
}

export function ProofEvidence({ view }: { view: ProofView }) {
  const { proof, payment } = view;
  const realStellar = view.state !== "failed" && isVerifiedStellarPaymentEvidence(payment.evidence, {
    transactionHash: proof.manifest.payment.transactionHash,
    recipient: view.request.recipient,
    amount: view.request.amount,
    memo: view.request.memo,
    asset: view.request.asset,
  })
    ? payment.evidence
    : null;
  const realAvalanche = realStellar && view.state !== "failed" && isVerifiedAvalancheAnchorEvidence(proof.anchor, {
    manifestHash: proof.manifestHash,
    stellarTransactionHash: proof.manifest.payment.transactionHash,
  })
    ? proof.anchor
    : null;

  const stellarBoundaryTitle =
    view.mode === "demo"
      ? "No hay tarjetas de red en modo SIMULATED"
      : payment.verification === "failed" || view.state === "failed"
        ? "El pago no fue aceptado"
        : payment.verification === "unconfigured"
          ? "El pago real no está configurado"
          : payment.evidence?.verification === "verified"
            ? "La evidencia Stellar no pasó la validación local"
            : "Aún no existe evidencia Stellar verificada";
  const avalancheBoundaryTitle =
    view.mode === "demo"
      ? "No hay tarjetas de red en modo SIMULATED"
      : proof.anchorVerification === "failed"
        ? "El anclaje no fue aceptado"
        : proof.anchorVerification === "unconfigured"
          ? "El anclaje real no está configurado"
          : proof.anchor?.verification === "verified"
            ? "La evidencia Avalanche no pasó la validación local"
            : "Aún no existe evidencia Avalanche verificada";

  return (
    <>
      <div className="hash-hero-card">
        <div className="hash-hero-icon"><Icon name="shield" size={25} /></div>
        <div className="hash-hero-copy">
          <span className="mono-label">HASH CANÓNICO · SHA-256</span>
          <code>{proof.manifestHash}</code>
          <p>Recomputable a partir de los bytes UTF-8 del manifiesto. No es una prueba ZK.</p>
        </div>
        <CopyButton label="Copiar hash" value={proof.manifestHash} />
      </div>

      <div className="proof-summary-grid">
        <div className="summary-card"><span>Concepto</span><strong>{view.request.title}</strong><small>{view.request.description || "Sin descripción"}</small></div>
        <div className="summary-card"><span>Importe</span><strong>{formatAmount(view.request.amount)}</strong><small>Memo: {view.request.memo}</small></div>
        <div className="summary-card"><span>Creada</span><strong>{formatDate(view.request.createdAt)}</strong><small>Manifiesto: {formatDate(proof.createdAt)}</small></div>
      </div>

      <div className="section-heading compact-heading">
        <span className="mono-label">EVIDENCIA POR CAPA</span>
        <h2>La interfaz oculta lo que no existe.</h2>
        <p>Las tarjetas de red solo aparecen después de una verificación real y validada.</p>
      </div>

      <div className="evidence-grid">
        {realStellar && (
          <article className="evidence-card stellar-evidence">
            <div className="evidence-header"><span className="evidence-icon"><Icon name="network" size={21} /></span><div><span className="mono-label">RED 01</span><h3>{realStellar.asset.network}</h3></div><span className="verified-label"><Icon name="check" size={14} /> VERIFICADO</span></div>
            <dl>
              <EvidenceRow label="Transaction hash" value={realStellar.transactionHash} />
              <EvidenceRow label="Ledger" value={String(realStellar.ledger)} />
              <EvidenceRow label="Operación" value={`Payment #${realStellar.operationIndex}`} />
              <EvidenceRow label="Sender" value={realStellar.sender} />
              <EvidenceRow label="Destinatario" value={realStellar.recipient} />
              <EvidenceRow label="Activo" value={`${realStellar.asset.code} · ${realStellar.asset.issuer}`} />
              <EvidenceRow label="Importe" value={realStellar.amount} />
              <EvidenceRow label="Memo" value={realStellar.memo} />
              <EvidenceRow label="Fuente" value={realStellar.horizonUrl ?? "Endpoint seguro no disponible"} />
            </dl>
          </article>
        )}

        {realAvalanche && (
          <article className="evidence-card avalanche-evidence">
            <div className="evidence-header"><span className="evidence-icon"><Icon name="network" size={21} /></span><div><span className="mono-label">RED 02</span><h3>{realAvalanche.network}</h3></div><span className="verified-label"><Icon name="check" size={14} /> VERIFICADO</span></div>
            <dl>
              <EvidenceRow label="Registry" value={realAvalanche.contractAddress ?? "Sin dirección"} />
              <EvidenceRow label="Transaction hash" value={realAvalanche.transactionHash ?? "Sin hash"} />
              <EvidenceRow label="Bloque" value={realAvalanche.blockNumber ?? "Sin bloque"} />
              <EvidenceRow label="Anchorer" value={realAvalanche.anchorer ?? "Sin dirección"} />
              <EvidenceRow label="Manifest hash" value={realAvalanche.manifestHash} />
              <EvidenceRow label="Stellar tx" value={realAvalanche.stellarTransactionHash} />
              <EvidenceRow label="Anclado" value={realAvalanche.anchoredAt ? formatDate(realAvalanche.anchoredAt) : "Sin fecha"} />
            </dl>
          </article>
        )}

        {(!realStellar || !realAvalanche) && (
          <div className="evidence-boundary">
            <Icon name="shield" size={25} />
            <div>
              <span className="mono-label">LÍMITE DE EVIDENCIA</span>
              <h3>{!realStellar ? stellarBoundaryTitle : avalancheBoundaryTitle}</h3>
              <p>
                {view.mode === "demo"
                  ? "No se consultó Horizon ni se envió una transacción a Avalanche. El manifiesto y su hash se muestran, pero las tarjetas de evidencia on-chain permanecen ocultas."
                  : !realStellar
                    ? payment.lastError ?? "No se muestra una tarjeta hasta que la evidencia pase la validación exacta."
                    : proof.lastError ?? "La capa Avalanche solo muestra una tarjeta después de verificar chain ID 43113, recibo, evento y getter."}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="manifest-card">
        <div className="card-title-row">
          <div><span className="mono-label">MANIFIESTO v1</span><h2>Contenido canónico</h2><p>Orden de claves estable, sin espacios y montos normalizados.</p></div>
          <CopyButton label="Copiar JSON" value={canonicalizeManifest(proof.manifest)} />
        </div>
        <pre className="manifest-code">{JSON.stringify(proof.manifest, null, 2)}</pre>
        <details className="canonical-details">
          <summary>Ver bytes canónicos exactos</summary>
          <code>{canonicalizeManifest(proof.manifest)}</code>
        </details>
        <div className="manifest-footer"><span>Proof ID</span><code>{proof.publicId}</code><span>Hash</span><code>{shortId(proof.manifestHash, 14)}</code></div>
      </div>
    </>
  );
}
