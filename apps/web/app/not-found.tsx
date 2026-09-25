import Link from "next/link";

import { Icon } from "@/components/icons";

export default function NotFound() {
  return (
    <section className="container narrow-page center-page">
      <div className="empty-icon"><Icon name="document" size={30} /></div>
      <span className="mono-label">404 · NO ENCONTRADO</span>
      <h1>Esta prueba no existe.</h1>
      <p>El identificador no corresponde a un registro disponible en el repositorio actual.</p>
      <Link className="button button-primary" href="/dashboard">Volver a actividad</Link>
    </section>
  );
}
