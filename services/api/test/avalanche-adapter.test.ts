import { describe, expect, it } from "vitest";

import { FujiAvalancheAnchorAdapter } from "../src/adapters/avalanche.js";
import type { AppConfig } from "../src/config.js";

const config: AppConfig = {
  mode: "real",
  api: { host: "127.0.0.1", port: 4000, webOrigin: "http://localhost:3000", mutationSecret: null },
  stellar: {
    network: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    recipientPublicKey: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    asset: {
      network: "Stellar Testnet",
      type: "classic",
      code: "USDC",
      issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    },
  },
  avalanche: {
    network: "fuji",
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    privateKey: null,
    registryAddress: null,
  },
  pollar: { adapterEnabled: false },
};

const configuredConfig: AppConfig = {
  ...config,
  avalanche: {
    ...config.avalanche,
    privateKey: `0x${"1".repeat(64)}`,
    registryAddress: "0x0000000000000000000000000000000000000001",
  },
};

describe("FujiAvalancheAnchorAdapter", () => {
  it("returns unconfigured when private key and registry address are missing", async () => {
    const adapter = new FujiAvalancheAnchorAdapter(config);
    const result = await adapter.anchorManifest({
      manifestHash: "b".repeat(64),
      stellarTransactionHash: "c".repeat(64),
      proofId: "PD-00000002",
      now: "2026-01-02T03:04:05.000Z",
    });

    expect(result.status).toBe("unconfigured");
    expect(result.evidence).toBeNull();
    expect(result.message).toContain("unconfigured");
  });

  it("does not accept an endpoint unless it proves chain ID 43113", async () => {
    let called = 0;
    const adapter = new FujiAvalancheAnchorAdapter(configuredConfig, (async () => {
      called += 1;
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch);

    const result = await adapter.anchorManifest({
      manifestHash: "b".repeat(64),
      stellarTransactionHash: "c".repeat(64),
      proofId: "PD-00000002",
      now: "2026-01-02T03:04:05.000Z",
    });

    expect(result.status).toBe("unconfigured");
    expect(result.evidence).toBeNull();
    expect(result.message).toContain("43113");
    expect(called).toBe(1);
  });
});
