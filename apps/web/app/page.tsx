import Link from "next/link";

import { Icon } from "@/components/icons";

const steps = [
  {
    number: "01",
    title: "Crea la solicitud",
    text: "Define el concepto y un monto USDC exacto. El servicio asigna el memo único.",
  },
  {
    number: "02",
    title: "Verifica en Stellar",
    text: "En modo real, el backend consulta Horizon Testnet y exige una operación Payment clásica exacta.",
  },
  {
    number: "03",
    title: "Publica el hash",
    text: "El manifiesto canónico se resume con SHA-256 y queda disponible para recomputación.",
  },
  {
    number: "04",
    title: "Ancla si corresponde",
    text: "En modo real, un contrato de Fuji registra el hash. Stellar y Avalanche permanecen secuenciales.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="hero section-glow">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><span className="pulse-dot" /> Modo real · Stellar Testnet + Avalanche Fuji</div>
            <h1>Un micropago. Una evidencia que puedes revisar.</h1>
            <p className="lead">
              ProofDrop convierte un pago USDC verificable en un manifiesto canónico y una URL pública,
              sin ocultar en qué red ocurrió cada paso.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/create">
                Crear solicitud <Icon name="arrow" size={18} />
              </Link>
              <Link className="button button-secondary" href="/dashboard">Ver actividad</Link>
            </div>
            <div className="trust-line">
              <Icon name="shield" size={18} />
              <span>Sin custodio, escrow ni afirmaciones de auditabilidad.</span>
            </div>
          </div>

          <div className="hero-card-wrap" aria-label="Resumen del flujo de evidencia">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="proof-preview">
              <div className="preview-header">
                <span className="mono-label">PROOF PREVIEW</span>
                <span className="network-pill"><span /> MODO REAL</span>
              </div>
              <div className="preview-title">
                <div className="preview-icon"><Icon name="document" size={22} /></div>
                <div><strong>Canonical manifest</strong><span>proofdrop.manifest.v1</span></div>
              </div>
              <div className="hash-field">
                <span className="mono-label">SHA-256 · PENDIENTE</span>
                <code>Se genera después de verificar el pago</code>
              </div>
              <div className="preview-layers">
                <div><span className="layer-dot stellar" /><strong>Stellar Testnet</strong><small>Pago clásico USDC · modo real</small></div>
                <div className="layer-line" />
                <div><span className="layer-dot avalanche" /><strong>Avalanche Fuji</strong><small>Anclaje opcional · modo real</small></div>
              </div>
              <div className="preview-note">
                <Icon name="network" size={17} />
                Dos redes, dos pasos secuenciales. Nunca atómicos.
              </div>
            </div>
          </div>
        </div>

        <div className="container hero-brand">
          <img
            alt="Marca ProofDrop: escudo con la inicial P y una flecha ascendente, junto al lema Modern Secure Data Attestation."
            className="hero-brand-image"
            decoding="async"
            height={670}
            src="/brand/cover.jpg"
            width={1200}
          />
        </div>
      </section>

      <section className="section section-white" id="como-funciona">
        <div className="container">
          <div className="section-heading">
            <span className="mono-label blue">FLUJO EXPLICITO</span>
            <h2>Cada evidencia tiene un origen verificable.</h2>
            <p>La interfaz separa el pago, el hash y el anclaje para evitar confundir una simulación con evidencia real.</p>
          </div>
          <div className="steps-grid">
            {steps.map((step) => (
              <article className="step-card" key={step.number}>
                <span className="step-number mono-label">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section architecture-section">
        <div className="container architecture-grid">
          <div className="section-heading align-left">
            <span className="mono-label">ARQUITECTURA</span>
            <h2>Una saga de dos redes, con límites visibles.</h2>
            <p>El backend conserva el manifiesto y verifica los datos antes de avanzar. La interfaz solo muestra evidencia real cuando existe.</p>
            <ul className="check-list">
              <li><Icon name="check" size={16} /> Verificación exacta de USDC, monto, destino y memo.</li>
              <li><Icon name="check" size={16} /> Hash SHA-256 sobre JSON canónico.</li>
              <li><Icon name="check" size={16} /> Recibo, evento y getter verificados en Fuji.</li>
            </ul>
          </div>
          <div className="architecture-map">
            <div className="architecture-node node-primary">
              <span className="mono-label">01 · STELLAR TESTNET</span>
              <strong>Solicitud + pago clásico USDC</strong>
              <small>Horizon consulta el transaction hash aportado.</small>
            </div>
            <div className="architecture-arrow"><span /><Icon name="arrow" size={18} /></div>
            <div className="architecture-node node-blue">
              <span className="mono-label">02 · OFF-CHAIN</span>
              <strong>Manifiesto + SHA-256</strong>
              <small>Una URL pública para recomputar el mismo contenido.</small>
            </div>
            <div className="architecture-arrow"><span /><Icon name="arrow" size={18} /></div>
            <div className="architecture-node node-purple">
              <span className="mono-label">03 · AVALANCHE FUJI</span>
              <strong>Anclaje opcional</strong>
              <small>Solo después de crear la evidencia Stellar.</small>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-white">
        <div className="container cta-card">
          <div>
            <span className="mono-label">PRUEBA EL FLUJO</span>
            <h2>Empieza en modo demo. Sin secretos y sin mover fondos.</h2>
            <p>La experiencia visible marca cada resultado como SIMULATED.</p>
          </div>
          <Link className="button button-primary button-large" href="/create">
            Crear primera solicitud <Icon name="arrow" size={19} />
          </Link>
        </div>
      </section>
    </>
  );
}
