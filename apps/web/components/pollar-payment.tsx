"use client";

import dynamic from "next/dynamic";
import type { ProofDropView } from "@proofdrop/shared";

import { usePollarBoundaryState } from "./pollar-provider-boundary";

const PollarPaymentClient = dynamic(
  () => import("./pollar-payment-client").then((module) => module.PollarPaymentClient),
  {
    ssr: false,
    loading: () => (
      <div className="pollar-loading" role="status">
        Cargando la opción de Pollar…
      </div>
    ),
  },
);

interface PollarPaymentProps {
  drop: ProofDropView;
  disabled: boolean;
  onTransactionHash: (hash: string) => void;
  onWorkingChange: (working: boolean) => void;
}

export function PollarPayment({
  drop,
  disabled,
  onTransactionHash,
  onWorkingChange,
}: PollarPaymentProps) {
  const { configured, ready } = usePollarBoundaryState();

  if (!configured) return null;

  return (
    <section className="pollar-panel" aria-labelledby="pollar-payment-title">
      <div className="pollar-panel-heading">
        <div>
          <span className="mono-label blue">OPCIÓN POLLAR</span>
          <h3 id="pollar-payment-title">Pagar con Pollar</h3>
        </div>
        <span className="optional-badge">Opcional</span>
      </div>

      {ready ? (
        <PollarPaymentClient
          disabled={disabled}
          drop={drop}
          onTransactionHash={onTransactionHash}
          onWorkingChange={onWorkingChange}
        />
      ) : (
        <div className="pollar-loading" role="status">
          Preparando el acceso opcional de Pollar…
        </div>
      )}

      <p className="pollar-boundary-note">
        Pollar puede enviar la operación de Stellar. Horizon verifica el pago exacto; Pollar no
        verifica Avalanche ni la prueba canónica.
      </p>
    </section>
  );
}
