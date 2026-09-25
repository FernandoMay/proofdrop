import {
  canonicalizeManifest,
  EvidenceVerificationError,
  hashProofManifest,
  type ExecutionMode,
  type ProofDropView,
  type ProofView,
} from "@proofdrop/shared";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import type { AppConfig as ProofDropConfig } from "../src/config.js";

const config: ProofDropConfig = {
  mode: "demo",
  api: { host: "127.0.0.1", port: 4000, webOrigin: "http://localhost:3000", mutationSecret: null },
  stellar: {
    network: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    recipientPublicKey: "SIMULATED-STELLAR-RECIPIENT",
    asset: {
      network: "SIMULATED",
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

let ids = 0;
const openApps: Array<ReturnType<typeof buildApp>> = [];

function demoId(): string {
  ids += 1;
  return `PD-${ids.toString(16).padStart(8, "0").toUpperCase()}`;
}

function createTestApp(mode: ExecutionMode = "demo") {
  const app = buildApp({
    config: mode === "demo" ? config : { ...config, mode, stellar: { ...config.stellar, recipientPublicKey: null } },
    generateId: (_kind, selectedMode) =>
      selectedMode === "demo" ? `demo-${(ids += 1).toString(16).padStart(8, "0")}` : demoId(),
  });
  openApps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

describe("ProofDrop demo API", () => {
  it("runs the full sequential flow with visible simulation boundaries", async () => {
    const app = createTestApp();

    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json().data.adapters).toEqual({ stellar: "simulated", avalanche: "simulated", pollar: "unconfigured" });

    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/v1/proof-drops",
      payload: { title: "Invoice review", description: "Demo only", amount: "1.2" },
    });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json().data as ProofDropView;
    expect(created.state).toBe("pending");
    expect(created.request.publicId).toMatch(/^demo-/);
    expect(created.request.amount).toBe("1.2000000");

    const paymentResponse = await app.inject({
      method: "POST",
      url: `/api/v1/proof-drops/${created.request.publicId}/verify-payment`,
      payload: {},
    });
    expect(paymentResponse.statusCode).toBe(200);
    const paid = paymentResponse.json().data.drop as ProofDropView;
    expect(paid.state).toBe("payment_verified");
    expect(paid.payment.verification).toBe("simulated");
    expect(paid.payment.transactionHash).toMatch(/^SIMULATED-/);
    expect(paid.payment.transactionHash).not.toMatch(/^[a-f0-9]{64}$/);

    const proofResponse = await app.inject({
      method: "POST",
      url: `/api/v1/proof-drops/${created.request.publicId}/proof`,
    });
    expect(proofResponse.statusCode).toBe(200);
    const proofView = proofResponse.json().data as ProofView;
    expect(proofView.state).toBe("anchor_pending");
    expect(proofView.proof.manifestHash).toBe(hashProofManifest(proofView.proof.manifest));
    expect(canonicalizeManifest(proofView.proof.manifest)).toBe(canonicalizeManifest(proofView.proof.manifest));

    const repeatedProof = await app.inject({
      method: "POST",
      url: `/api/v1/proof-drops/${created.request.publicId}/proof`,
    });
    expect(repeatedProof.json().data.proof.publicId).toBe(proofView.proof.publicId);

    const repeatedPayment = await app.inject({
      method: "POST",
      url: `/api/v1/proof-drops/${created.request.publicId}/verify-payment`,
      payload: {},
    });
    expect(repeatedPayment.statusCode).toBe(200);
    expect(repeatedPayment.json().data.status).toBe("simulated");
    expect(repeatedPayment.json().data.drop.payment.transactionHash).toBe(
      proofView.proof.manifest.payment.transactionHash,
    );

    const anchoredResponse = await app.inject({
      method: "POST",
      url: `/api/v1/proofs/${proofView.proof.publicId}/anchor`,
    });
    expect(anchoredResponse.statusCode).toBe(200);
    const operation = anchoredResponse.json().data;
    expect(operation.status).toBe("simulated");
    expect(operation.proof.state).toBe("simulated");
    expect(operation.proof.proof.anchor.transactionHash).toBeNull();
    expect(operation.proof.proof.anchor.contractAddress).toBeNull();

    const repeatedAnchor = await app.inject({
      method: "POST",
      url: `/api/v1/proofs/${proofView.proof.publicId}/anchor`,
    });
    expect(repeatedAnchor.json().data.proof.state).toBe("simulated");

    const publicProof = await app.inject({ method: "GET", url: `/api/v1/proofs/${proofView.proof.publicId}` });
    expect(publicProof.statusCode).toBe(200);
    expect(publicProof.json().data.proof.manifest.payment.verification).toBe("simulated");
  });

  it("returns one proof for concurrent create-proof requests", async () => {
    const app = createTestApp();
    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/v1/proof-drops",
      payload: { title: "Concurrent proof", description: "", amount: "1.25" },
    });
    const created = createdResponse.json().data as ProofDropView;
    await app.inject({
      method: "POST",
      url: `/api/v1/proof-drops/${created.request.publicId}/verify-payment`,
      payload: {},
    });

    const responses = await Promise.all([
      app.inject({ method: "POST", url: `/api/v1/proof-drops/${created.request.publicId}/proof` }),
      app.inject({ method: "POST", url: `/api/v1/proof-drops/${created.request.publicId}/proof` }),
    ]);
    const proofIds = responses.map((response) => (response.json().data as ProofView).proof.publicId);

    expect(responses.every((response) => response.statusCode === 200)).toBe(true);
    expect(new Set(proofIds).size).toBe(1);
    const records = await app.inject({ method: "GET", url: "/api/v1/proof-drops" });
    expect(records.json().data).toHaveLength(1);
  });

  it("refuses real evidence mutations when the server secret is not configured", async () => {
    const app = createTestApp("real");
    const requests = [
      app.inject({ method: "POST", url: "/api/v1/proof-drops/PD-00000001/verify-payment", payload: {} }),
      app.inject({ method: "POST", url: "/api/v1/proof-drops/PD-00000001/proof" }),
      app.inject({ method: "POST", url: "/api/v1/proofs/PD-00000001/anchor" }),
    ];
    const responses = await Promise.all(requests);

    expect(responses.map((response) => response.statusCode)).toEqual([503, 503, 503]);
    for (const response of responses) {
      expect(response.json().error.code).toBe("MUTATION_AUTH_UNCONFIGURED");
    }
  });

  it("requires the configured server secret in real mode", async () => {
    const secret = "server-only-mutation-secret";
    const realConfig: ProofDropConfig = {
      ...config,
      mode: "real",
      api: { ...config.api, mutationSecret: secret },
      stellar: { ...config.stellar, recipientPublicKey: null },
    };
    const app = buildApp({ config: realConfig, generateId: demoId });
    openApps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/proof-drops/PD-00000001/verify-payment",
      payload: {},
      headers: { "x-proofdrop-mutation-secret": "wrong-secret" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("MUTATION_AUTH_REQUIRED");
  });

  it("persists a failed real payment instead of exposing verified state", async () => {
    const realConfig: ProofDropConfig = {
      ...config,
      mode: "real",
      api: { ...config.api, mutationSecret: "server-only-mutation-secret" },
      stellar: { ...config.stellar, recipientPublicKey: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" },
    };
    const app = buildApp({
      config: realConfig,
      generateId: demoId,
      stellarAdapter: {
        verifyPayment: async () => {
          throw new EvidenceVerificationError("The Stellar payment did not match the request.");
        },
      },
    });
    openApps.push(app);

    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/v1/proof-drops",
      payload: { title: "Failed real payment", description: "", amount: "1.25" },
    });
    const created = createdResponse.json().data as ProofDropView;
    const verifyResponse = await app.inject({
      method: "POST",
      url: `/api/v1/proof-drops/${created.request.publicId}/verify-payment`,
      payload: { transactionHash: "a".repeat(64) },
      headers: { "x-proofdrop-mutation-secret": "server-only-mutation-secret" },
    });

    expect(verifyResponse.statusCode).toBe(422);
    const failed = await app.inject({ method: "GET", url: `/api/v1/proof-drops/${created.request.publicId}` });
    const failedDrop = failed.json().data as ProofDropView;
    expect(failedDrop.state).toBe("failed");
    expect(failedDrop.payment.verification).toBe("failed");
    expect(failedDrop.payment.evidence).toBeNull();
  });

  it("rejects adapter evidence that does not match the requested amount", async () => {
    const issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
    const realConfig: ProofDropConfig = {
      ...config,
      mode: "real",
      api: { ...config.api, mutationSecret: "server-only-mutation-secret" },
      stellar: { ...config.stellar, recipientPublicKey: issuer },
    };
    const app = buildApp({
      config: realConfig,
      generateId: demoId,
      stellarAdapter: {
        verifyPayment: async ({ request, asset, now }) => ({
          status: "verified",
          message: "malicious test evidence",
          evidence: {
            verification: "verified",
            transactionHash: "a".repeat(64),
            ledger: 1,
            successful: true,
            sender: issuer,
            recipient: request.recipient,
            operationIndex: 0,
            amount: "9.0000000",
            asset,
            memo: request.memo,
            horizonUrl: "https://horizon-testnet.stellar.org",
            verifiedAt: now,
          },
        }),
      },
    });
    openApps.push(app);

    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/v1/proof-drops",
      payload: { title: "Invariant check", description: "", amount: "1.25" },
    });
    const created = createdResponse.json().data as ProofDropView;
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/proof-drops/${created.request.publicId}/verify-payment`,
      payload: { transactionHash: "a".repeat(64) },
      headers: { "x-proofdrop-mutation-secret": "server-only-mutation-secret" },
    });

    expect(response.statusCode).toBe(502);
    const current = await app.inject({ method: "GET", url: `/api/v1/proof-drops/${created.request.publicId}` });
    expect((current.json().data as ProofDropView).payment.verification).not.toBe("verified");
  });

  it("returns a safe 415 envelope for unsupported media types", async () => {
    const app = createTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/proof-drops",
      headers: { "content-type": "application/xml" },
      payload: "<request />",
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({
      error: {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: expect.stringContaining("application/json"),
        details: {
          frameworkCode: "FST_ERR_CTP_INVALID_MEDIA_TYPE",
          contentType: "application/xml",
          supportedContentType: "application/json",
        },
      },
    });
    expect(response.body).not.toContain("stack");
    expect(response.body).not.toContain("server-only-mutation-secret");
  });

  it("returns a consistent validation error envelope", async () => {
    const app = createTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/proof-drops",
      payload: { title: "x", amount: "0" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR", message: "The request body is invalid." },
    });
    expect(response.json().error.details.length).toBeGreaterThan(0);
  });

  it("does not create real records without a configured recipient", async () => {
    const app = createTestApp("real");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/proof-drops",
      payload: { title: "Real request", description: "", amount: "2.000000" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("ADAPTER_UNCONFIGURED");
  });
});
