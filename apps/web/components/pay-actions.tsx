"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  isSimulatedAvalancheAnchorEvidence,
  isSimulatedStellarPaymentEvidence,
  isVerifiedAvalancheAnchorEvidence,
  isVerifiedStellarPaymentEvidence,
  type ProofDropView,
  type ProofView,
} from "@proofdrop/shared";

import { Icon } from "./icons";
import { PollarPayment } from "./pollar-payment";
import { mutationFetch } from "@/lib/api";

function hasVerifiedPayment(drop: ProofDropView): boolean {
  return isVerifiedStellarPaymentEvidence(drop.payment.evidence, {
    transactionHash: drop.payment.transactionHash ?? undefined,
    recipient: drop.request.recipient,
    amount: drop.request.amount,
    memo: drop.request.memo,
    asset: drop.request.asset,
  });
}

function hasSimulatedPayment(drop: ProofDropView): boolean {
  return isSimulatedStellarPaymentEvidence(drop.payment.evidence, {
    recipient: drop.request.recipient,
    amount: drop.request.amount,
    memo: drop.request.memo,
    asset: drop.request.asset,
  });
}

function hasVerifiedAnchor(drop: ProofDropView): boolean {
  return Boolean(
    drop.proof &&
      isVerifiedAvalancheAnchorEvidence(drop.proof.anchor, {
        manifestHash: drop.proof.manifestHash,
        stellarTransactionHash: drop.proof.manifest.payment.transactionHash,
      }),
  );
}

function hasSimulatedAnchor(drop: ProofDropView): boolean {
  return Boolean(
    drop.proof &&
      isSimulatedAvalancheAnchorEvidence(drop.proof.anchor, {
        manifestHash: drop.proof.manifestHash,
        stellarTransactionHash: drop.proof.manifest.payment.transactionHash,
      }),
  );
}

export function PayActions({ drop }: { drop: ProofDropView }) {
  const router = useRouter();
  const [transactionHash, setTransactionHash] = useState("");
  const [working, setWorking] = useState(false);
  const [pollarWorking, setPollarWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post<T>(path: string, payload?: object): Promise<T> {
    return mutationFetch<T>(path, {
      body: JSON.stringify(payload ?? {}),
    });
  }

  async function verifyPayment(): Promise<void> {
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const result = await post<{ status: string; drop: ProofDropView }>(
        `/api/v1/proof-drops/${encodeURIComponent(drop.request.publicId)}/verify-payment`,
        drop.mode === "real" ? { transactionHash } : {},
      );
      if (result.status === "verified" && result.drop.payment.verification === "verified" && hasVerifiedPayment(result.drop)) {
        setMessage("Pago verificado en Stellar Testnet.");
      } else if (result.status === "simulated" && result.drop.payment.verification === "simulated" && hasSimulatedPayment(result.drop)) {
        setMessage("Pago SIMULATED. No se consultó Horizon.");
      } else if (result.status === "unconfigured") {
        setMessage("Pago real no configurado. No se mostró evidencia como verificada.");
      } else {
        throw new Error("La API no devolvió evidencia verificable para este pago.");
      }
      router.refresh();
    } catch (requestError) {
      router.refresh();
      setError(requestError instanceof Error ? requestError.message : "No se pudo verificar el pago.");
    } finally {
      setWorking(false);
    }
  }

  async function createProof(): Promise<void> {
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const result = await post<ProofView>(`/api/v1/proof-drops/${encodeURIComponent(drop.request.publicId)}/proof`);
      if (!result.proof.manifestHash) throw new Error("La API no devolvió un manifiesto verificable.");
      setMessage("Manifiesto canónico creado. El hash ahora es recomputable.");
      router.refresh();
    } catch (requestError) {
      router.refresh();
      setError(requestError instanceof Error ? requestError.message : "No se pudo crear el manifiesto.");
    } finally {
      setWorking(false);
    }
  }

  async function anchorProof(): Promise<void> {
    if (!drop.proof) return;
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const result = await post<{ status: string; proof: ProofView }>(
        `/api/v1/proofs/${encodeURIComponent(drop.proof.publicId)}/anchor`,
      );
      if (
        result.status === "verified" &&
        isVerifiedAvalancheAnchorEvidence(result.proof.proof.anchor, {
          manifestHash: result.proof.proof.manifestHash,
          stellarTransactionHash: result.proof.proof.manifest.payment.transactionHash,
        })
      ) {
        setMessage("Recibo, evento y getter verificados en Avalanche Fuji.");
      } else if (
        result.status === "simulated" &&
        isSimulatedAvalancheAnchorEvidence(result.proof.proof.anchor, {
          manifestHash: result.proof.proof.manifestHash,
          stellarTransactionHash: result.proof.proof.manifest.payment.transactionHash,
        })
      ) {
        setMessage("Anclaje SIMULATED completado. No existe una transacción en Avalanche.");
      } else if (result.status === "unconfigured") {
        setMessage("Anclaje no configurado. El manifiesto permanece pendiente.");
      } else {
        throw new Error("La API no devolvió evidencia de Avalanche verificable.");
      }
      router.refresh();
    } catch (requestError) {
      router.refresh();
      setError(requestError instanceof Error ? requestError.message : "No se pudo anclar el manifiesto.");
    } finally {
      setWorking(false);
    }
  }

  async function runDemoFlow(): Promise<void> {
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const payment = await post<{ status: string; drop: ProofDropView }>(
        `/api/v1/proof-drops/${encodeURIComponent(drop.request.publicId)}/verify-payment`,
        {},
      );
      if (payment.status !== "simulated" || !hasSimulatedPayment(payment.drop)) {
        throw new Error("La simulación no devolvió un pago SIMULATED válido.");
      }
      const proof = await post<ProofView>(`/api/v1/proof-drops/${encodeURIComponent(drop.request.publicId)}/proof`);
      const anchor = await post<{ status: string; proof: ProofView }>(
        `/api/v1/proofs/${encodeURIComponent(proof.proof.publicId)}/anchor`,
      );
      if (anchor.status !== "simulated" || !hasSimulatedAnchor({ ...drop, proof: anchor.proof.proof })) {
        throw new Error("La simulación no devolvió un anclaje SIMULATED válido.");
      }
      setMessage("Flujo SIMULATED completado. Ninguna transacción on-chain fue enviada.");
      router.refresh();
    } catch (requestError) {
      router.refresh();
      setError(requestError instanceof Error ? requestError.message : "No se pudo completar el flujo demo.");
    } finally {
      setWorking(false);
    }
  }

  const proofUrl = drop.proof ? `/proof/${drop.proof.publicId}` : null;
  const failed = drop.state === "failed" || drop.payment.verification === "failed" || drop.proof?.state === "failed";
  const paymentVerified = hasVerifiedPayment(drop);
  const paymentSimulated = hasSimulatedPayment(drop);
  const anchorVerified = hasVerifiedAnchor(drop);
  const anchorSimulated = hasSimulatedAnchor(drop);

  return (
    <div className="action-card">
      {failed ? (
        <div className="complete-panel failure-panel">
          <div className="success-mark failure-mark"><Icon name="shield" size={24} /></div>
          <h2>El flujo falló</h2>
          <p>{drop.lastError ?? drop.payment.lastError ?? drop.proof?.lastError ?? "La evidencia no pasó la validación."}</p>
          <p className="muted-note">No se muestra como verificado ni se conserva un hash de transacción externo como aceptación.</p>
          {proofUrl && <Link className="button button-primary button-full" href={proofUrl}>Abrir estado público <Icon name="external" size={17} /></Link>}
        </div>
      ) : drop.mode === "demo" && drop.state === "pending" ? (
        <>
          <div className="action-heading"><Icon name="spark" size={21} /><div><h2>Ejecutar flujo de demostración</h2><p>No requiere wallet, secretos ni red externa.</p></div></div>
          <div className="demo-callout"><strong>SIMULATED</strong><span>La API devolverá una etiqueta de pago no-hex y ningún hash de Avalanche.</span></div>
          <button className="button button-primary button-full button-large" disabled={working} onClick={() => void runDemoFlow()} type="button">
            {working ? "Ejecutando…" : "Ejecutar flujo completo"}<Icon name="arrow" size={18} />
          </button>
        </>
      ) : drop.mode === "real" && drop.state === "pending" ? (
        <>
          <div className="action-heading"><Icon name="wallet" size={21} /><div><h2>Pagar en Stellar</h2><p>Usa Pollar si está configurado o continúa con una wallet externa.</p></div></div>
          <PollarPayment
            disabled={working}
            drop={drop}
            onTransactionHash={setTransactionHash}
            onWorkingChange={setPollarWorking}
          />
          <div className="manual-payment-heading">
            <h3>Wallet externa o hash manual</h3>
            <p>Pega el hash de la transacción que enviaste fuera de Pollar.</p>
          </div>
          <label className="field">
            <span>Hash de transacción Stellar</span>
            <input autoComplete="off" className="mono-input" maxLength={64} onChange={(event) => setTransactionHash(event.target.value)} placeholder="64 caracteres hexadecimales" spellCheck={false} value={transactionHash} />
          </label>
          <button className="button button-primary button-full" disabled={working || pollarWorking || transactionHash.length !== 64} onClick={() => void verifyPayment()} type="button">
            {working ? "Consultando Horizon…" : "Verificar pago exacto"}
          </button>
          <p className="form-footnote"><Icon name="shield" size={15} /> La billetera permanece fuera de ProofDrop. El backend solo verifica la evidencia.</p>
          <p className="form-footnote"><Icon name="shield" size={15} /> Las mutaciones reales requieren autorización del servidor; ningún secreto se incluye en el navegador.</p>
        </>
      ) : drop.state === "payment_verified" && !drop.proof && (paymentVerified || paymentSimulated) ? (
        <>
          <div className="action-heading"><Icon name="document" size={21} /><div><h2>Pago aceptado</h2><p>Genera el manifiesto determinista y su hash SHA-256.</p></div></div>
          <button className="button button-primary button-full" disabled={working} onClick={() => void createProof()} type="button">
            {working ? "Creando manifiesto…" : "Generar manifiesto"}
          </button>
        </>
      ) : drop.proof?.state === "anchor_pending" ? (
        <>
          <div className="action-heading"><Icon name="network" size={21} /><div><h2>Anclaje opcional</h2><p>El hash ya existe. Anclar en Avalanche no modifica la verificación Stellar.</p></div></div>
          <button className="button button-blue button-full" disabled={working} onClick={() => void anchorProof()} type="button">
            {working ? "Procesando…" : drop.mode === "demo" ? "Completar anclaje SIMULATED" : "Anclar mediante RPC configurado"}
          </button>
        </>
      ) : drop.state === "payment_submitted" ? (
        <div className="complete-panel"><div className="success-mark"><Icon name="shield" size={24} /></div><h2>Pago en procesamiento</h2><p>La verificación todavía no ha aceptado una evidencia válida.</p></div>
      ) : drop.state === "simulated" && paymentSimulated && anchorSimulated ? (
        <div className="complete-panel">
          <div className="success-mark simulated-mark"><Icon name="spark" size={24} /></div>
          <h2>Flujo SIMULATED completado</h2>
          <p>Los datos están visibles, pero no representan evidencia on-chain.</p>
          {proofUrl && <Link className="button button-primary button-full" href={proofUrl}>Abrir prueba pública <Icon name="external" size={17} /></Link>}
        </div>
      ) : drop.state === "verified" && paymentVerified && anchorVerified ? (
        <div className="complete-panel">
          <div className="success-mark"><Icon name="check" size={24} /></div>
          <h2>Evidencia verificada</h2>
          <p>Los pasos disponibles fueron verificados con sus fuentes configuradas.</p>
          {proofUrl && <Link className="button button-primary button-full" href={proofUrl}>Abrir prueba pública <Icon name="external" size={17} /></Link>}
        </div>
      ) : (
        <div className="complete-panel">
          <div className="success-mark pending-mark"><Icon name="shield" size={24} /></div>
          <h2>Evidencia pendiente</h2>
          <p>No se muestra un estado verificado hasta que la configuración y la evidencia sean válidas.</p>
          {proofUrl && <Link className="button button-primary button-full" href={proofUrl}>Abrir estado público <Icon name="external" size={17} /></Link>}
        </div>
      )}

      {message && <div className="alert alert-info" role="status">{message}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
    </div>
  );
}
