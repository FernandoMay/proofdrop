"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="container narrow-page center-page">
      <span className="mono-label error-label">API NO DISPONIBLE</span>
      <h1>No pudimos cargar la evidencia.</h1>
      <p>Comprueba que el backend ProofDrop esté activo en el puerto 4000.</p>
      <div className="hero-actions centered-actions">
        <button className="button button-primary" onClick={reset} type="button">Reintentar</button>
        <Link className="button button-secondary" href="/">Ir al inicio</Link>
      </div>
    </section>
  );
}
