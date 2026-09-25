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

  describe("API listener configuration", () => {
    it("prefers API_PORT and API_HOST over Render PORT and HOST", () => {
      const config = loadConfig({
        API_PORT: "4321",
        PORT: "10000",
        API_HOST: "127.0.0.2",
        HOST: "0.0.0.0",
      });

      expect(config.api.host).toBe("127.0.0.2");
      expect(config.api.port).toBe(4321);
    });

    it("falls back to Render PORT and HOST when API variables are absent", () => {
      const config = loadConfig({ PORT: "10000", HOST: "0.0.0.0" });

      expect(config.api.host).toBe("0.0.0.0");
      expect(config.api.port).toBe(10000);
    });

    it("keeps the localhost defaults when listener variables are absent", () => {
      const config = loadConfig({});

      expect(config.api.host).toBe("127.0.0.1");
      expect(config.api.port).toBe(4000);
    });

    it("parses valid ports from the selected source", () => {
      expect(loadConfig({ API_PORT: " 1 " }).api.port).toBe(1);
      expect(loadConfig({ PORT: " 65535 " }).api.port).toBe(65535);
    });

    it("rejects invalid ports", () => {
      expect(() => loadConfig({ API_PORT: "0" })).toThrow(/API_PORT must be a valid TCP port/);
      expect(() => loadConfig({ PORT: "65536" })).toThrow(/PORT must be a valid TCP port/);
    });
  });
});
