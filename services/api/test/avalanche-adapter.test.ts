import { beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";

import { buildProofManifest, hashProofManifest } from "@proofdrop/shared";

import { FujiAvalancheAnchorAdapter } from "../src/adapters/avalanche.js";
import type { AppConfig } from "../src/config.js";

const viemBoundary = vi.hoisted(() => {
  const publicClient = {
    waitForTransactionReceipt: vi.fn(),
    getBlock: vi.fn(),
    readContract: vi.fn(),
  };
  const walletClient = { writeContract: vi.fn() };
  return {
    publicClient,
    walletClient,
    createPublicClient: vi.fn(() => publicClient),
    createWalletClient: vi.fn(() => walletClient),
    parseEventLogs: vi.fn(),
  };
});

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: viemBoundary.createPublicClient,
    createWalletClient: viemBoundary.createWalletClient,
    parseEventLogs: viemBoundary.parseEventLogs,
  };
});

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("normalizes the canonical manifest hash only at the viem boundary", async () => {
    const manifestHash = hashProofManifest(
      buildProofManifest({
        mode: "real",
        proofId: "PD-00000003",
        generatedAt: "2026-01-02T03:04:05.000Z",
        request: {
          publicId: "PD-00000003",
          title: "Avalanche boundary regression",
          description: "Canonical hash remains unprefixed",
          amount: "1.0000000",
          recipient: config.stellar.recipientPublicKey!,
          memo: "PD-00000003",
          createdAt: "2026-01-02T03:04:00.000Z",
        },
        asset: config.stellar.asset,
        payment: {
          network: "Stellar Testnet",
          transactionHash: "c".repeat(64),
          ledger: 1,
          operationIndex: 0,
          status: "verified",
          sender: config.stellar.recipientPublicKey!,
          amount: "1.0000000",
          memo: "PD-00000003",
          verification: "verified",
        },
      }),
    );
    expect(manifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifestHash).not.toMatch(/^0x/);
    const stellarTransactionHash = "c".repeat(64);
    const registryAddress = configuredConfig.avalanche.registryAddress!;
    const account = privateKeyToAccount(configuredConfig.avalanche.privateKey!);
    const transactionHash = `0x${"d".repeat(64)}`;
    const anchoredAt = 1_700_000_000n;

    viemBoundary.walletClient.writeContract.mockResolvedValue(transactionHash);
    viemBoundary.publicClient.waitForTransactionReceipt.mockResolvedValue({
      status: "success",
      to: registryAddress,
      from: account.address,
      contractAddress: null,
      transactionHash,
      blockNumber: 42n,
      logs: [{ address: registryAddress }],
    });
    viemBoundary.publicClient.getBlock.mockResolvedValue({ timestamp: anchoredAt });
    viemBoundary.parseEventLogs.mockReturnValue([
      {
        address: registryAddress,
        args: {
          manifestHash: `0x${manifestHash}`,
          stellarTxHash: stellarTransactionHash,
          anchorer: account.address,
          anchoredAt,
        },
      },
    ]);
    viemBoundary.publicClient.readContract.mockResolvedValue([
      account.address,
      stellarTransactionHash,
      anchoredAt,
    ]);

    const adapter = new FujiAvalancheAnchorAdapter(configuredConfig, (async () => {
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0xa869" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch);

    const result = await adapter.anchorManifest({
      manifestHash,
      stellarTransactionHash,
      proofId: "PD-00000003",
      now: "2026-01-02T03:04:05.000Z",
    });

    expect(result.status).toBe("verified");
    expect(result.evidence?.manifestHash).toBe(manifestHash);
    expect(viemBoundary.walletClient.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ args: [`0x${manifestHash}`, stellarTransactionHash] }),
    );
    expect(viemBoundary.publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ args: [`0x${manifestHash}`] }),
    );
    expect(viemBoundary.parseEventLogs).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "ManifestAnchored", strict: true }),
    );
  });
});
