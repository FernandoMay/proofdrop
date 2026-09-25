import { describe, expect, it } from "vitest";

import { decimalAmountsEqual, normalizeDecimalAmount } from "../src/amount.js";
import {
  endpointOrigin,
  isEvmAddress,
  isSafePublicEndpoint,
  isStellarAccountId,
  isStellarTransactionHash,
} from "../src/validation.js";

const PUBLIC_STELLAR_ACCOUNT = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const PUBLIC_EVM_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("amount validation", () => {
  it("normalizes decimal amounts to fixed seven-place strings", () => {
    expect(normalizeDecimalAmount("1.2")).toBe("1.2000000");
    expect(normalizeDecimalAmount("12.34")).toBe("12.3400000");
    expect(normalizeDecimalAmount("1.2500000")).toBe("1.2500000");
    expect(normalizeDecimalAmount("0.0000001")).toBe("0.0000001");
    expect(decimalAmountsEqual("1.2500000", "1.25")).toBe(true);
  });

  it("rejects excess precision, non-decimal input, leading zeros, and zero", () => {
    expect(() => normalizeDecimalAmount("1.00000001")).toThrow();
    expect(() => normalizeDecimalAmount("1e6")).toThrow();
    expect(() => normalizeDecimalAmount("00012.34")).toThrow();
    expect(() => normalizeDecimalAmount("0.0000000")).toThrow();
  });

  it("redacts endpoint credentials while retaining a safe public origin", () => {
    const value = "https://user:password@horizon-testnet.stellar.org/path?access_token=secret#fragment";
    expect(endpointOrigin(value)).toBe("https://horizon-testnet.stellar.org");
    expect(isSafePublicEndpoint(endpointOrigin(value)!)).toBe(true);
    expect(isSafePublicEndpoint(value)).toBe(false);
  });
});

describe("address and transaction validation", () => {
  it("validates Stellar public account syntax and checksum", () => {
    expect(isStellarAccountId(PUBLIC_STELLAR_ACCOUNT)).toBe(true);
    expect(isStellarAccountId("G-invalid")).toBe(false);
  });

  it("distinguishes real transaction hashes from visible demo labels", () => {
    expect(isStellarTransactionHash("not-a-transaction-hash")).toBe(false);
    expect(isEvmAddress(PUBLIC_EVM_ADDRESS)).toBe(true);
    expect(isEvmAddress("0x1234")).toBe(false);
  });
});
