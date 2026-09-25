"use client";

import { useEffect, useState } from "react";

import { getHealth } from "@/lib/api";

type BannerState = "loading" | "demo" | "real" | "unavailable";

export function ModeBanner() {
  const [state, setState] = useState<BannerState>("loading");
  const [message, setMessage] = useState("Comprobando el modo de ProofDrop…");

  useEffect(() => {
    let active = true;
    getHealth()
      .then((health) => {
        if (!active) return;
        if (health.mode === "demo") {
          setState("demo");
          setMessage("MODO DEMO · Flujo SIMULATED: no se envían pagos ni transacciones on-chain.");
        } else {
          setState("real");
          setMessage("MODO REAL · La identidad de red se verifica antes de aceptar evidencia.");
        }
      })
      .catch(() => {
        if (!active) return;
        setState("unavailable");
        setMessage("API NO DISPONIBLE · Inicia el servidor con npm run dev:demo.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div aria-live="polite" className={`mode-banner mode-banner-${state}`}>
      <div className="container">{message}</div>
    </div>
  );
}

export function RecordModeBanner({ mode }: { mode: "demo" | "real" }) {
  return (
    <div className={`record-banner ${mode === "demo" ? "record-banner-demo" : "record-banner-real"}`}>
      <strong>{mode === "demo" ? "SIMULATED" : "MODO REAL · EVIDENCIA CONDICIONAL"}</strong>
      <span>
        {mode === "demo"
          ? "Demostración visible. No existen transacciones Stellar ni Avalanche."
          : "La evidencia de red solo se muestra después de verificar su identidad y sus fuentes configuradas."}
      </span>
    </div>
  );
}
