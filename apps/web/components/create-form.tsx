"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ProofDropView } from "@proofdrop/shared";

import { Icon } from "./icons";
import { apiFetch } from "@/lib/api";

export function CreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("1.00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const drop = await apiFetch<ProofDropView>("/api/v1/proof-drops", {
        method: "POST",
        body: JSON.stringify({ title, description, amount }),
      });
      router.push(`/pay/${drop.request.publicId}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo crear la solicitud.");
      setSubmitting(false);
    }
  }

  return (
    <form className="form-card" onSubmit={(event) => void submit(event)}>
      <div className="form-heading">
        <div className="form-icon"><Icon name="document" size={22} /></div>
        <div><h2>Detalles del pago</h2><p>El backend fijará asset, emisor, destinatario y memo.</p></div>
      </div>

      <label className="field">
        <span>Concepto</span>
        <input maxLength={120} minLength={3} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Revisión de diseño" required value={title} />
      </label>

      <label className="field">
        <span>Descripción <small>opcional</small></span>
        <textarea maxLength={1000} onChange={(event) => setDescription(event.target.value)} placeholder="Agrega el contexto que necesitará quien verificará el pago." rows={4} value={description} />
      </label>

      <label className="field">
        <span>Monto</span>
        <div className="amount-input">
          <input inputMode="decimal" onChange={(event) => setAmount(event.target.value)} pattern="^(0|[1-9][0-9]*)(\.[0-9]{1,7})?$" placeholder="1.00" required value={amount} />
          <span>USDC</span>
        </div>
        <small>Se normaliza a siete decimales. El modo demo no mueve fondos.</small>
      </label>

      <div className="network-summary">
        <div><span className="network-dot stellar" /><strong>Stellar Testnet · modo real</strong></div>
        <span>USDC clásico · SIMULATED en demo</span>
        <div><span className="network-dot avalanche" /><strong>Avalanche Fuji · modo real</strong></div>
        <span>Anclaje opcional · no enviado en demo</span>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button className="button button-primary button-full button-large" disabled={submitting} type="submit">
        {submitting ? "Creando solicitud…" : "Crear solicitud"}
        {!submitting && <Icon name="arrow" size={18} />}
      </button>
      <p className="form-footnote"><Icon name="shield" size={15} /> El importe y el concepto quedan ligados al manifiesto canónico.</p>
    </form>
  );
}
