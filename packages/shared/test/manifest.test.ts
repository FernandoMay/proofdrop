import { describe, expect, it } from "vitest";

import { canonicalJson } from "../src/canonical-json.js";
import { buildProofManifest, canonicalizeManifest, hashProofManifest, verifyProofManifestHash } from "../src/manifest.js";
import type { BuildManifestInput } from "../src/manifest.js";

const input: BuildManifestInput = {
  mode: "demo",
  proofId: "demo-proof-stable",
  generatedAt: "2026-01-02T03:04:05.000Z",
  request: {
    publicId: "demo-stable-request",
    title: "Stable manifest",
    description: "Canonical proof test",
    amount: "12.5000000",
    recipient: "SIMULATED-STELLAR-RECIPIENT",
    memo: "demo-stable-request",
    createdAt: "2026-01-02T03:04:00.000Z",
  },
  asset: {
    network: "SIMULATED",
    type: "classic",
    code: "USDC",
    issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  },
  payment: {
    network: "SIMULATED",
    transactionHash: "SIMULATED-STELLAR-demo-stable-request",
    ledger: null,
    operationIndex: 0,
    status: "simulated",
    sender: "SIMULATED-STELLAR-SENDER",
    amount: "12.5000000",
    memo: "demo-stable-request",
    verification: "simulated",
  },
};

describe("canonical proof manifest", () => {
  it("sorts object keys recursively without whitespace ambiguity", () => {
    const canonical = canonicalJson({ z: 1, a: { y: true, x: null } });
    expect(canonical).toBe('{"a":{"x":null,"y":true},"z":1}');
  });

  it("hashes identical manifests deterministically", () => {
    const reordered = {
      payment: input.payment,
      request: input.request,
      asset: input.asset,
      generatedAt: input.generatedAt,
      proofId: input.proofId,
      mode: input.mode,
    } satisfies BuildManifestInput;

    const first = buildProofManifest(input);
    const second = buildProofManifest(reordered);
    expect(first.payment.network).toBe("SIMULATED");
    expect(first.asset.network).toBe("SIMULATED");
    const firstHash = hashProofManifest(first);
    const secondHash = hashProofManifest(second);

    expect(canonicalizeManifest(first)).toBe(canonicalizeManifest(second));
    expect(firstHash).toBe(secondHash);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyProofManifestHash(second, firstHash)).toBe(true);
  });

  it("detects a changed manifest", () => {
    const manifest = buildProofManifest(input);
    const hash = hashProofManifest(manifest);
    const changed = { ...manifest, request: { ...manifest.request, amount: "12.500001" } };

    expect(verifyProofManifestHash(changed, hash)).toBe(false);
  });
});
