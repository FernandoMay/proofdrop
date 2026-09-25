import { EvidenceVerificationError, type ProofDropRequest, type StellarAsset } from "@proofdrop/shared";
import { describe, expect, it } from "vitest";

import { HorizonStellarPaymentAdapter } from "../src/adapters/stellar.js";
import type { AppConfig } from "../src/config.js";

const issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const syntheticTransactionHash = "a".repeat(64);
const asset: StellarAsset = { network: "Stellar Testnet", type: "classic", code: "USDC", issuer };
const request: ProofDropRequest = {
  publicId: "PD-00000001",
  mode: "real",
  title: "Adapter test",
  description: "",
  amount: "1.2500000",
  recipient: issuer,
  memo: "PD-00000001",
  asset,
  createdAt: "2026-01-02T03:04:05.000Z",
  updatedAt: "2026-01-02T03:04:05.000Z",
};
const config: AppConfig = {
  mode: "real",
  api: { host: "127.0.0.1", port: 4000, webOrigin: "http://localhost:3000", mutationSecret: null },
  stellar: {
    network: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    recipientPublicKey: issuer,
    asset,
  },
  avalanche: {
    network: "fuji",
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    privateKey: null,
    registryAddress: null,
  },
  pollar: { adapterEnabled: false },
};

type OperationsResponseShape = "embedded" | "top-level";

function horizonFetch(
  amount: string,
  memo: string | undefined = request.memo,
  memoType: string | undefined = "text",
  operationsResponseShape: OperationsResponseShape = "embedded",
): { fetch: typeof fetch; urls: string[] } {
  const urls: string[] = [];
  const implementation = (async (input: RequestInfo | URL) => {
    const url = new URL(input);
    urls.push(url.toString());
    if (url.pathname.endsWith("/operations")) {
      const operations = [
        {
          _links: {
            self: { href: "https://horizon-testnet.stellar.org/operations/1" },
            transaction: { href: url.toString().replace(/\/operations$/, "") },
          },
          id: "1",
          paging_token: "1",
          transaction_successful: true,
          source_account: issuer,
          type: "payment",
          type_i: 1,
          created_at: "2026-01-02T03:04:05.000Z",
          transaction_hash: syntheticTransactionHash,
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          asset_issuer: issuer,
          from: issuer,
          to: issuer,
          amount,
          ...(memo ? { memos: [{ type: "text", value: memo }] } : {}),
        },
      ];
      const operationsDocument =
        operationsResponseShape === "embedded"
          ? {
              _links: { self: { href: url.toString() } },
              _embedded: { records: operations },
            }
          : { records: operations };
      return new Response(JSON.stringify(operationsDocument), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        hash: syntheticTransactionHash,
        successful: true,
        ledger: 123456,
        ...(memoType === undefined ? {} : { memo_type: memoType }),
        ...(memo ? { memo } : {}),
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  return { fetch: implementation, urls };
}

describe("HorizonStellarPaymentAdapter", () => {
  it("reads the transaction and real HAL operations collection, accepting an exact seven-place amount", async () => {
    const horizon = horizonFetch("1.2500000");
    const adapter = new HorizonStellarPaymentAdapter(config, horizon.fetch);
    const result = await adapter.verifyPayment({
      transactionHash: syntheticTransactionHash,
      request,
      asset,
      now: "2026-01-02T03:05:00.000Z",
    });

    expect(result.status).toBe("verified");
    expect(result.evidence?.verification).toBe("verified");
    expect(result.evidence?.amount).toBe("1.2500000");
    expect(result.evidence?.operationIndex).toBe(0);
    expect(result.evidence?.memo).toBe(request.memo);
    expect(horizon.urls).toEqual([
      `https://horizon-testnet.stellar.org/transactions/${syntheticTransactionHash}`,
      `https://horizon-testnet.stellar.org/transactions/${syntheticTransactionHash}/operations`,
    ]);
  });

  it("retains support for top-level records fixtures", async () => {
    const adapter = new HorizonStellarPaymentAdapter(
      config,
      horizonFetch("1.2500000", request.memo, "text", "top-level").fetch,
    );
    const result = await adapter.verifyPayment({
      transactionHash: syntheticTransactionHash,
      request,
      asset,
      now: "2026-01-02T03:05:00.000Z",
    });

    expect(result.status).toBe("verified");
  });

  it("rejects an operation record that belongs to another transaction", async () => {
    const horizon = horizonFetch("1.25");
    const originalFetch = horizon.fetch;
    const adapter = new HorizonStellarPaymentAdapter(config, (async (input: RequestInfo | URL) => {
      if (new URL(input).pathname.endsWith("/operations")) {
        return new Response(
          JSON.stringify({
            records: [
              {
                type: "payment",
                transaction_hash: "b".repeat(64),
                transaction_successful: true,
                asset_type: "credit_alphanum4",
                asset_code: "USDC",
                asset_issuer: issuer,
                from: issuer,
                to: issuer,
                amount: "1.25",
                memos: [{ type: "text", value: request.memo }],
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return originalFetch(input);
    }) as typeof fetch);

    await expect(
      adapter.verifyPayment({
        transactionHash: syntheticTransactionHash,
        request,
        asset,
        now: "2026-01-02T03:05:00.000Z",
      }),
    ).rejects.toBeInstanceOf(EvidenceVerificationError);
  });

  it("rejects a transaction with a different amount", async () => {
    const adapter = new HorizonStellarPaymentAdapter(config, horizonFetch("1.2500001").fetch);
    await expect(
      adapter.verifyPayment({
        transactionHash: syntheticTransactionHash,
        request,
        asset,
        now: "2026-01-02T03:05:00.000Z",
      }),
    ).rejects.toBeInstanceOf(EvidenceVerificationError);
  });

  it("rejects a transaction whose memo is not exactly text", async () => {
    const adapter = new HorizonStellarPaymentAdapter(config, horizonFetch("1.25", request.memo, "none").fetch);
    await expect(
      adapter.verifyPayment({
        transactionHash: syntheticTransactionHash,
        request,
        asset,
        now: "2026-01-02T03:05:00.000Z",
      }),
    ).rejects.toBeInstanceOf(EvidenceVerificationError);
  });

  it("rejects a missing or different text memo", async () => {
    const adapter = new HorizonStellarPaymentAdapter(config, horizonFetch("1.25", "different-memo").fetch);
    await expect(
      adapter.verifyPayment({
        transactionHash: syntheticTransactionHash,
        request,
        asset,
        now: "2026-01-02T03:05:00.000Z",
      }),
    ).rejects.toBeInstanceOf(EvidenceVerificationError);
  });

  it("returns only a sanitized public Horizon origin", async () => {
    const privateUrlConfig: AppConfig = {
      ...config,
      stellar: {
        ...config.stellar,
        horizonUrl: "https://user:password@horizon-testnet.stellar.org?access_token=secret#fragment",
      },
    };
    const adapter = new HorizonStellarPaymentAdapter(privateUrlConfig, horizonFetch("1.25").fetch);
    const result = await adapter.verifyPayment({
      transactionHash: syntheticTransactionHash,
      request,
      asset,
      now: "2026-01-02T03:05:00.000Z",
    });

    expect(result.evidence?.horizonUrl).toBe("https://horizon-testnet.stellar.org");
    expect(result.evidence?.horizonUrl).not.toContain("password");
    expect(result.evidence?.horizonUrl).not.toContain("secret");
  });

  it("does not query an endpoint that cannot identify Stellar Testnet", async () => {
    let called = false;
    const adapter = new HorizonStellarPaymentAdapter(
      { ...config, stellar: { ...config.stellar, horizonUrl: "https://not-stellar.example" } },
      (async () => {
        called = true;
        return new Response("{}", { status: 200 });
      }) as typeof fetch,
    );
    const result = await adapter.verifyPayment({
      transactionHash: syntheticTransactionHash,
      request,
      asset,
      now: "2026-01-02T03:05:00.000Z",
    });

    expect(result.status).toBe("unconfigured");
    expect(result.evidence).toBeNull();
    expect(called).toBe(false);
  });
});
