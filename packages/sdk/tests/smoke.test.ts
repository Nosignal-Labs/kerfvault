import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("SDK Smoke Test", () => {
  it("loads and parses test-vectors/voucher.v1.json", () => {
    const vectorPath = resolve(__dirname, "../../../test-vectors/voucher.v1.json");
    const raw = readFileSync(vectorPath, "utf-8");
    const json = JSON.parse(raw);

    expect(json).toBeDefined();
    expect(json.version).toBe(1);
    expect(Array.isArray(json.vectors)).toBe(true);
    expect(json.vectors.length).toBeGreaterThan(0);

    const firstVector = json.vectors[0];
    expect(firstVector.status).toBe("PLACEHOLDER");
    expect(firstVector.contractId).toContain("PLACEHOLDER_CONTRACT_ID");
    expect(firstVector.bookId).toBe(101);
    expect(firstVector.noteIndex).toBe(0);
    expect(firstVector.amount).toBe("10000000");
  });

  it.todo("encodes a voucher into wire string matching test vector");
  it.todo("decodes a wire string into OfflineVoucher object");
  it.todo("verifies Ed25519 signature over canonical voucher message");
  it.todo("verifies voucher against a registry snapshot");
});

