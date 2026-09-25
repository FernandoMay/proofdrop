"use client";

import type { SubmitOutcome } from "@pollar/core";
import { WalletType } from "@pollar/core";
import { usePollar } from "@pollar/react";
import { useState } from "react";
import type { ProofDropView } from "@proofdrop/shared";

const STELLAR_HASH_PATTERN = /^[a-fA-F0-9]{64}$/;

type PollarPaymentError = Extract<SubmitOutcome, { status: "error" }>;

function getSdkError(outcome: PollarPaymentError): string {
  return (
    outcome.message?.trim() ||
    outcome.details?.trim() ||
    outcome.resultCode?.trim() ||
    outcome.code?.trim() ||
    "La operación no fue aceptada."
  );
}

interface PollarPaymentClientProps {
  drop: ProofDropView;
  disabled: boolean;
  onTransactionHash: (hash: string) => void;
  onWorkingChange: (working: boolean) => void;
}

export function PollarPaymentClient({
  drop,
  disabled,
  onTransactionHash,
  onWorkingChange,
}: PollarPaymentClientProps) {
  const {
    isAuthenticated,
    verified,
    wallet,
    login,
    logout,
    runTx,
    openTxHistoryModal,
  } = usePollar();
  const [working, setWorking] = useState(false);
  const [returnedHash, setReturnedHash] = useState<string | null>(null);
  const [outcomeStatus, setOutcomeStatus] = useState<"success" | "pending" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitPayment(): Promise<void> {
    setWorking(true);
    onWorkingChange(true);
    setReturnedHash(null);
    setOutcomeStatus(null);
    setError(null);

    try {
      const outcome = await runTx(
        "payment",
        {
          destination: drop.request.recipient,
          amount: drop.request.amount,
          asset: {
            type: "credit_alphanum4",
            code: drop.request.asset.code,
            issuer: drop.request.asset.issuer,
          },
        },
        { memo: { type: "text", value: drop.request.memo } },
      );

      if (outcome.status === "error") {
        setError(`Pollar informó un error: ${getSdkError(outcome)}`);
        return;
      }

      if (!STELLAR_HASH_PATTERN.test(outcome.hash)) {
        setError("Pollar no devolvió un hash Stellar válido. No se aceptó ninguna transacción.");
        return;
      }

      const hash = outcome.hash.toLowerCase();
      setReturnedHash(hash);
      setOutcomeStatus(outcome.status);
      onTransactionHash(hash);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? `Pollar informó un error: ${requestError.message}`
          : "Pollar informó un error y no devolvió un hash.",
      );
    } finally {
      setWorking(false);
      onWorkingChange(false);
    }
  }

  const actionDisabled = disabled || working;

  return (
    <div className="pollar-payment-content">
      {!isAuthenticated ? (
        <>
          <p className="pollar-auth-copy">
            Inicia sesión con Google o conecta Freighter. La disponibilidad depende de la
            configuración de Pollar y de las extensiones del navegador.
          </p>
          <div className="pollar-auth-actions">
            <button
              className="button button-secondary button-full"
              disabled={actionDisabled}
              onClick={() => login({ provider: "google" })}
              type="button"
            >
              Continuar con Google
            </button>
            <button
              className="button button-ghost button-full"
              disabled={actionDisabled}
              onClick={() => login({ provider: WalletType.FREIGHTER })}
              type="button"
            >
              Conectar Freighter
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="pollar-wallet-summary">
            <span>Dirección autenticada</span>
            <code>{wallet?.address ?? "Confirmando la sesión…"}</code>
          </div>
          <div className="pollar-wallet-actions">
            <button
              className="button button-ghost button-small"
              disabled={!wallet}
              onClick={openTxHistoryModal}
              type="button"
            >
              Abrir historial de Pollar
            </button>
            <button className="button button-ghost button-small" onClick={logout} type="button">
              Cerrar sesión
            </button>
          </div>
        </>
      )}

      <button
        className="button button-primary button-full"
        disabled={actionDisabled || !isAuthenticated || !verified || !wallet}
        onClick={() => void submitPayment()}
        type="button"
      >
        {working
          ? "Enviando con Pollar…"
          : `Pagar ${drop.request.amount} ${drop.request.asset.code} con Pollar`}
      </button>

      {!verified && isAuthenticated && (
        <p className="pollar-session-note">Pollar está confirmando la sesión antes de enviar.</p>
      )}

      {returnedHash && outcomeStatus && (
        <div className={`pollar-outcome ${outcomeStatus}`} role="status">
          <strong>
            {outcomeStatus === "pending" ? "Hash pendiente" : "Hash devuelto por Pollar"}
          </strong>
          <code>{returnedHash}</code>
          <p>
            {outcomeStatus === "pending"
              ? "El hash ya está en el campo de verificación. Usa la acción existente para consultar Horizon; el pago aún no está aceptado."
              : "El hash ya está en el campo de verificación. Horizon debe aceptarlo antes de que ProofDrop lo considere verificado."}
          </p>
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
