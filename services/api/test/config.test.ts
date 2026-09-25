import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

const issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

describe("API network configuration", () => {
  it("keeps demo asset identity explicitly simulated", () => {
    const config = loadConfig({ DEMO_MODE: "true" });

    expect(config.stellar.network).toBe("testnet");
    expect(config.stellar.asset.network).toBe("SIMULATED");
    expect(config.api.mutationSecret).toBeNull();
  });

  it("accepts only the supported real network identities and keeps the mutation secret server-side", () => {
    const config = loadConfig({
      DEMO_MODE: "false",
      API_MUTATION_SECRET: "server-only",
      STELLAR_NETWORK: "testnet",
      STELLAR_RECIPIENT_PUBLIC_KEY: issuer,
      AVALANCHE_NETWORK: "fuji",
    });

    expect(config.stellar.network).toBe("testnet");
    expect(config.stellar.asset.network).toBe("Stellar Testnet");
    expect(config.avalanche.network).toBe("fuji");
    expect(config.api.mutationSecret).toBe("server-only");
  });

  it("rejects an arbitrary real Stellar endpoint or unsupported network label", () => {
    expect(() =>
      loadConfig({
        DEMO_MODE: "false",
        STELLAR_RECIPIENT_PUBLIC_KEY: issuer,
        STELLAR_HORIZON_URL: "https://horizon.example.invalid",
      }),
    ).toThrow(/supported Stellar Testnet/i);
    expect(() =>
      loadConfig({
        DEMO_MODE: "false",
        STELLAR_NETWORK: "public",
        STELLAR_RECIPIENT_PUBLIC_KEY: issuer,
      }),
    ).toThrow(/STELLAR_NETWORK/);
    expect(() =>
      loadConfig({
        DEMO_MODE: "false",
        AVALANCHE_NETWORK: "mainnet",
        STELLAR_RECIPIENT_PUBLIC_KEY: issuer,
      }),
    ).toThrow(/AVALANCHE_NETWORK/);
  });
});
