import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";
import { decodeVoucher, encodeVoucher } from "../src/voucher/encode.js";
import { signVoucher } from "../src/voucher/sign.js";
import { verifyVoucher } from "../src/voucher/verify.js";

describe("SDK Smoke Test", () => {
  it("loads and parses test-vectors/voucher.v1.json", () => {
    const vectorPath = resolve(__dirname, "../../../test-vectors/voucher.v1.json");
    const raw = readFileSync(vectorPath, "utf-8");
    const json = JSON.parse(raw);

    expect(json).toBeDefined();
    expect(json.version).toBe(1);
    expect(Array.isArray(json.vectors)).toBe(true);
    expect(json.vectors.length).toBeGreaterThanOrEqual(10);

    const firstVector = json.vectors[0];
    expect(firstVector.id).toBe("vector-01-valid");
    expect(firstVector.contractId).toBe("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4");
    expect(firstVector.bookId).toBe(101);
    expect(firstVector.noteIndex).toBe(0);
    expect(firstVector.amount).toBe("10000000");
  });

  it("encodes a voucher into wire string matching test vector", () => {
    const vectorPath = resolve(__dirname, "../../../test-vectors/voucher.v1.json");
    const raw = readFileSync(vectorPath, "utf-8");
    const json = JSON.parse(raw);
    const validVector = json.vectors[0];

    const encoded = encodeVoucher({
      version: 1,
      contractId: validVector.contractId,
      bookId: BigInt(validVector.bookId),
      noteIndex: validVector.noteIndex,
      merchant: validVector.merchant,
      amount: BigInt(validVector.amount),
      cap: BigInt(validVector.cap),
      acceptUntil: BigInt(validVector.acceptUntil),
      signature: validVector.signatureHex,
    });

    expect(encoded).toBe(validVector.wirePayload);
  });

  it("decodes a wire string into OfflineVoucher object", () => {
    const vectorPath = resolve(__dirname, "../../../test-vectors/voucher.v1.json");
    const raw = readFileSync(vectorPath, "utf-8");
    const json = JSON.parse(raw);
    const validVector = json.vectors[0];

    const decoded = decodeVoucher(validVector.wirePayload);
    expect(decoded.version).toBe(1);
    expect(decoded.contractId).toBe(validVector.contractId);
    expect(decoded.bookId).toBe(BigInt(validVector.bookId));
    expect(decoded.noteIndex).toBe(validVector.noteIndex);
    expect(decoded.merchant).toBe(validVector.merchant);
    expect(decoded.amount).toBe(BigInt(validVector.amount));
    expect(decoded.cap).toBe(BigInt(validVector.cap));
    expect(decoded.acceptUntil).toBe(BigInt(validVector.acceptUntil));
    expect(decoded.signature).toBe(validVector.signatureHex);
  });

  it("signs a voucher with dedicated voucher key matching test vector", async () => {
    const vectorPath = resolve(__dirname, "../../../test-vectors/voucher.v1.json");
    const raw = readFileSync(vectorPath, "utf-8");
    const json = JSON.parse(raw);
    const validVector = json.vectors[0];

    const seed = crypto.createHash("sha256").update(validVector.seedLabel).digest();
    const signed = await signVoucher({
      version: 1,
      contractId: validVector.contractId,
      bookId: BigInt(validVector.bookId),
      noteIndex: validVector.noteIndex,
      merchant: validVector.merchant,
      amount: BigInt(validVector.amount),
      cap: BigInt(validVector.cap),
      acceptUntil: BigInt(validVector.acceptUntil),
      voucherSecretKey: seed,
    });

    expect(signed.signature).toBe(validVector.signatureHex);
    expect(signed.voucherKey).toBe(validVector.voucherKeyHex);
  });

  it("verifies Ed25519 signature over canonical voucher message across test vectors", async () => {
    const vectorPath = resolve(__dirname, "../../../test-vectors/voucher.v1.json");
    const raw = readFileSync(vectorPath, "utf-8");
    const json = JSON.parse(raw);

    for (const vec of json.vectors) {
      if (vec.id === "vector-09-truncated-payload") {
        expect(() => decodeVoucher(vec.wirePayload)).toThrow(/TruncatedPayload/);
        continue;
      }
      if (vec.id === "vector-10-wrong-version") {
        expect(() => decodeVoucher(vec.wirePayload)).toThrow(/InvalidVersion/);
        continue;
      }

      const voucher = decodeVoucher(vec.wirePayload);
      const res = await verifyVoucher(voucher, {
        voucherKey: vec.voucherKeyHex,
        currentTimestamp: vec.id === "vector-02-expired" ? 1700000000n : 1600000000n,
      });

      if (vec.expectedValid) {
        expect(res.valid).toBe(true);
      } else {
        expect(res.valid).toBe(false);
        expect(res.reason).toBe(vec.expectedError);
      }
    }
  });

  it.todo("verifies voucher against a registry snapshot");
});

