import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { decodeVoucher } from "../src/voucher/encode.js";
import { verifyVoucher } from "../src/voucher/verify.js";

describe("Offline Voucher Verification (Strict No-Network Proof)", () => {
  let originalFetch: typeof globalThis.fetch;
  let originalHttpRequest: typeof http.request;
  let originalHttpsRequest: typeof https.request;
  let originalNetConnect: typeof net.connect;

  beforeEach(() => {
    // 1. Intercept and block global fetch
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      throw new Error("NETWORK_CALL_DETECTED: globalThis.fetch was called in offline verification");
    });

    // 2. Intercept and block node:http.request
    originalHttpRequest = http.request;
    http.request = vi.fn().mockImplementation(() => {
      throw new Error("NETWORK_CALL_DETECTED: http.request was called in offline verification");
    }) as unknown as typeof http.request;

    // 3. Intercept and block node:https.request
    originalHttpsRequest = https.request;
    https.request = vi.fn().mockImplementation(() => {
      throw new Error("NETWORK_CALL_DETECTED: https.request was called in offline verification");
    }) as unknown as typeof https.request;

    // 4. Intercept and block TCP / socket connections
    originalNetConnect = net.connect;
    net.connect = vi.fn().mockImplementation(() => {
      throw new Error("NETWORK_CALL_DETECTED: net.connect was called in offline verification");
    }) as unknown as typeof net.connect;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
    net.connect = originalNetConnect;
  });

  it("confirms the network trap actively blocks unauthorized network calls", async () => {
    expect(() => globalThis.fetch("https://horizon-testnet.stellar.org")).toThrow(
      /NETWORK_CALL_DETECTED/
    );
  });

  it("verifies vouchers purely offline with zero network calls", async () => {
    const vectorPath = resolve(__dirname, "../../../test-vectors/voucher.v1.json");
    const raw = readFileSync(vectorPath, "utf-8");
    const json = JSON.parse(raw);
    const validVector = json.vectors[0];

    const voucher = decodeVoucher(validVector.wirePayload);
    const result = await verifyVoucher(voucher, {
      voucherKey: validVector.voucherKeyHex,
      currentTimestamp: 1600000000n,
      expectedContractId: validVector.contractId,
      merchantAddress: validVector.merchant,
    });

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();

    // Verify network interceptors were never touched
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(http.request).not.toHaveBeenCalled();
    expect(https.request).not.toHaveBeenCalled();
    expect(net.connect).not.toHaveBeenCalled();
  });

  it("handles offline rejection of expired and tampered vouchers with zero network calls", async () => {
    const vectorPath = resolve(__dirname, "../../../test-vectors/voucher.v1.json");
    const raw = readFileSync(vectorPath, "utf-8");
    const json = JSON.parse(raw);

    for (const vec of json.vectors) {
      if (vec.id.includes("truncated") || vec.id.includes("wrong-version")) {
        continue;
      }
      const voucher = decodeVoucher(vec.wirePayload);
      const result = await verifyVoucher(voucher, {
        voucherKey: vec.voucherKeyHex,
        currentTimestamp: vec.id === "vector-02-expired" ? 1700000000n : 1600000000n,
      });

      if (vec.expectedValid) {
        expect(result.valid).toBe(true);
      } else {
        expect(result.valid).toBe(false);
      }
    }

    // Assert total zero network calls across all test vectors
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(http.request).not.toHaveBeenCalled();
    expect(https.request).not.toHaveBeenCalled();
    expect(net.connect).not.toHaveBeenCalled();
  });
});
