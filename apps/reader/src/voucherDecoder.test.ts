import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { signVoucher, encodeVoucher, urlSafeBase64ToBytes, bytesToUrlSafeBase64 } from "@kerfvault/sdk";
import { parseAndGateVoucher, stroopsToXlm } from "./lib/voucherDecoder";
import { DecodedVoucherView } from "./components/DecodedVoucherView";

describe("Voucher Decoder & Version Byte Gating", () => {
  const dummySecret = new Uint8Array(32).fill(7);
  const testContractId = "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE";
  const testMerchant = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVWAC";

  async function createTestVoucherWire(amountStroops = 20_000_000n, capStroops = 50_000_000n): Promise<string> {
    const voucher = await signVoucher({
      contractId: testContractId,
      bookId: 42n,
      noteIndex: 2,
      merchant: testMerchant,
      amount: amountStroops,
      cap: capStroops,
      acceptUntil: 1800000000n,
      voucherSecretKey: dummySecret,
    });
    return encodeVoucher(voucher);
  }

  describe("stroopsToXlm", () => {
    it("converts stroops to decimal XLM", () => {
      expect(stroopsToXlm(10_000_000n)).toBe(1);
      expect(stroopsToXlm(25_000_000n)).toBe(2.5);
      expect(stroopsToXlm(0n)).toBe(0);
    });
  });

  describe("parseAndGateVoucher", () => {
    it("rejects empty or whitespace strings", () => {
      const res1 = parseAndGateVoucher("");
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain("cannot be empty");

      const res2 = parseAndGateVoucher("   \n ");
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain("is empty");
    });

    it("decodes a valid version 1 voucher successfully", async () => {
      const wire = await createTestVoucherWire(30_000_000n, 100_000_000n);
      const res = parseAndGateVoucher(wire);

      expect(res.valid).toBe(true);
      expect(res.voucher).toBeDefined();
      expect(res.voucher?.version).toBe(1);
      expect(res.voucher?.contractId).toBe(testContractId);
      expect(res.voucher?.bookId).toBe(42n);
      expect(res.voucher?.noteIndex).toBe(2);
      expect(res.voucher?.merchant).toBe(testMerchant);
      expect(res.voucher?.amount).toBe(30_000_000n);
      expect(res.voucher?.cap).toBe(100_000_000n);
      expect(res.voucher?.acceptUntil).toBe(1800000000n);
      expect(res.voucher?.signature).toBeDefined();
    });

    it("gates on the version byte: rejects vouchers where version !== 1", async () => {
      const wire = await createTestVoucherWire();
      const rawBytes = urlSafeBase64ToBytes(wire);

      // Mutate version byte (offset 16) to version 2
      expect(rawBytes[16]).toBe(1);
      rawBytes[16] = 2;

      const tamperedWire = bytesToUrlSafeBase64(rawBytes);
      const res = parseAndGateVoucher(tamperedWire);

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/version/i);
    });

    it("rejects truncated or malformed payloads", () => {
      const truncated = "AQEBAQEBAQ==";
      const res = parseAndGateVoucher(truncated);

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/TruncatedPayload|Failed to decode/i);
    });
  });

  describe("DecodedVoucherView Component", () => {
    it("renders decoded voucher details on success", async () => {
      const wire = await createTestVoucherWire(20_000_000n, 50_000_000n);
      const res = parseAndGateVoucher(wire);

      const html = renderToString(
        React.createElement(DecodedVoucherView, {
          result: res,
          onReset: vi.fn(),
        })
      );

      expect(html).toContain("Voucher Decoded");
      expect(html).toContain("VERSION");
      expect(html).toContain("42"); // Book ID
      expect(html).toContain("2"); // 20_000_000 stroops = 2 XLM
      expect(html).toContain("5"); // 50_000_000 stroops = 5 XLM
      expect(html).toContain(testMerchant);
    });

    it("renders error state when result is invalid", () => {
      const html = renderToString(
        React.createElement(DecodedVoucherView, {
          result: {
            valid: false,
            rawPayload: "BAD_DATA",
            error: "Unsupported voucher version: 99",
          },
          onReset: vi.fn(),
        })
      );

      expect(html).toContain("Invalid or Unsupported Voucher");
      expect(html).toContain("Unsupported voucher version: 99");
      expect(html).toContain("BAD_DATA");
    });
  });
});
