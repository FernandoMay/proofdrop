import type { Metadata } from "next";

import { CreateForm } from "@/components/create-form";

export const metadata: Metadata = { title: "Crear solicitud" };

export default function CreatePage() {
  return (
    <section className="page-section section-glow-soft">
      <div className="container form-layout">
        <div className="form-intro">
          <span className="mono-label blue">NUEVA SOLICITUD</span>
          <h1>Describe el pago que quieres demostrar.</h1>
          <p>ProofDrop mantiene separados el pago, el manifiesto y el anclaje. La primera versión funciona sin configuración externa.</p>
          <div className="mini-flow">
            <div><span>1</span><strong>Solicitud</strong><small>Datos firmados por el manifiesto</small></div>
            <div><span>2</span><strong>Pago</strong><small>Verificación exacta en Stellar</small></div>
            <div><span>3</span><strong>Evidencia</strong><small>Hash público y anclaje opcional</small></div>
          </div>
        </div>
        <CreateForm />
      </div>
    </section>
  );
}
