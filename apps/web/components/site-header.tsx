import Link from "next/link";

import { Icon } from "./icons";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link aria-label="ProofDrop, inicio" className="brand" href="/">
          {/* The wordmark beside it already names the product, so the logo image is decorative. */}
          <img
            alt=""
            className="brand-logo"
            decoding="async"
            height={192}
            src="/brand/logo-192.png"
            width={192}
          />
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
