"use client";

import dynamic from "next/dynamic";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const TESTNET_PUBLISHABLE_PREFIX = "pub_testnet_";
const configuredKey = process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY?.trim();
const publishableKey =
  configuredKey?.startsWith(TESTNET_PUBLISHABLE_PREFIX) &&
  configuredKey.length > TESTNET_PUBLISHABLE_PREFIX.length
    ? configuredKey
    : "";

const PollarProvider = dynamic(
  () => import("@pollar/react").then((module) => module.PollarProvider),
  { ssr: false },
);

interface PollarBoundaryState {
  configured: boolean;
  ready: boolean;
}

const PollarBoundaryContext = createContext<PollarBoundaryState>({
  configured: false,
  ready: false,
});

export function PollarProviderBoundary({ children }: { children: ReactNode }) {
  const [clientMounted, setClientMounted] = useState(false);

  useEffect(() => {
    setClientMounted(true);
  }, []);

  const configured = publishableKey.length > 0;
  const ready = configured && clientMounted;
  const state = useMemo(() => ({ configured, ready }), [configured, ready]);

  const content =
    configured && clientMounted ? (
      <PollarProvider client={{ apiKey: publishableKey, stellarNetwork: "testnet" }}>
        {children}
      </PollarProvider>
    ) : (
      children
    );

  return <PollarBoundaryContext.Provider value={state}>{content}</PollarBoundaryContext.Provider>;
}

export function usePollarBoundaryState(): PollarBoundaryState {
  return useContext(PollarBoundaryContext);
}
