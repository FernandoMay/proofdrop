import Link from "next/link";

import { Icon } from "./icons";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link aria-label="ProofDrop, inicio" className="brand" href="/">
          <span className="brand-mark">
            <Icon name="shield" size={21} />
          </span>
          <span>ProofDrop</span>
        </Link>
        <nav aria-label="Navegación principal" className="main-nav">
          <Link href="/create">Crear solicitud</Link>
          <Link href="/dashboard">Actividad</Link>
          <span className="nav-network"><Icon name="network" size={16} /> Modo real · Testnet</span>
        </nav>
      </div>
    </header>
  );
}
