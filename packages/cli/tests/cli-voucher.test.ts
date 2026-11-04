import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Keypair } from "@stellar/stellar-sdk";
import { runSignVoucher, runVerifyVoucher, runCli } from "../src/index.js";

describe("CLI sign-voucher and verify commands", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kerfvault-cli-voucher-test-"));
  const tempKeysFile = path.join(tempDir, "keys.json");
  const tempDeploymentFile = path.join(tempDir, "testnet.json");

  const contractId = "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE";
  const testMerchant = Keypair.random();
  const testVoucher = Keypair.random();

  afterEach(() => {
    if (fs.existsSync(tempKeysFile)) fs.unlinkSync(tempKeysFile);
    if (fs.existsSync(tempDeploymentFile)) fs.unlinkSync(tempDeploymentFile);
  });

  it("signs a voucher offline using CLI options and saves to state", async () => {
    fs.writeFileSync(
      tempKeysFile,
      JSON.stringify({
        voucherSecret: testVoucher.secret(),
        voucherPublicKey: testVoucher.publicKey(),
        merchantPublicKey: testMerchant.publicKey(),
      })
    );

    fs.writeFileSync(
      tempDeploymentFile,
      JSON.stringify({
        contracts: {
          kerfvault: contractId,
        },
      })
    );

    const logs: string[] = [];
    const { voucher, encoded } = await runSignVoucher(
      {
        bookId: 1n,
        noteIndex: 0,
        amount: 7_000_000n,
        cap: 10_000_000n,
        keysFile: tempKeysFile,
        deploymentFile: tempDeploymentFile,
      },
      (msg) => logs.push(msg)
    );

    expect(voucher.contractId).toBe(contractId);
    expect(voucher.bookId).toBe(1n);
    expect(voucher.noteIndex).toBe(0);
    expect(voucher.amount).toBe(7_000_000n);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/); // URL-safe base64 string
    const fullLog = logs.join("\n");
    expect(fullLog).toContain("Voucher signed successfully!");
    expect(fullLog).toContain(encoded);
  });

  it("verifies a signed voucher completely offline with network calls disabled", async () => {
    // Strict proof: disable network access entirely
    const networkSpy = vi.fn().mockImplementation(() => {
      throw new Error("Network access forbidden in offline verification");
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = networkSpy;

    try {
      const { encoded } = await runSignVoucher(
        {
          contractId,
          bookId: 42n,
          noteIndex: 1,
          merchant: testMerchant.publicKey(),
          amount: 5_000_000n,
          cap: 10_000_000n,
          voucherSecret: testVoucher.secret(),
          keysFile: tempKeysFile,
          deploymentFile: tempDeploymentFile,
        },
        () => {}
      );

      const logs: string[] = [];
      const ok = await runVerifyVoucher(
        {
          voucher: encoded,
          voucherKey: testVoucher.publicKey(),
          expectedContractId: contractId,
          merchantAddress: testMerchant.publicKey(),
          deploymentFile: tempDeploymentFile,
        },
        (msg) => logs.push(msg)
      );

      expect(ok).toBe(true);
      expect(networkSpy).not.toHaveBeenCalled(); // ZERO network calls proof

      const fullLog = logs.join("\n");
      expect(fullLog).toContain("Offline voucher verification: VALID");
      expect(fullLog).toContain("Verification verified completely offline with zero network calls.");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects tampered or invalid voucher offline", async () => {
    const { encoded } = await runSignVoucher(
      {
        contractId,
        bookId: 42n,
        noteIndex: 1,
        merchant: testMerchant.publicKey(),
        amount: 5_000_000n,
        cap: 10_000_000n,
        voucherSecret: testVoucher.secret(),
        keysFile: tempKeysFile,
        deploymentFile: tempDeploymentFile,
      },
      () => {}
    );

    // Verify against wrong voucher key
    const wrongVoucherKey = Keypair.random().publicKey();
    const logs: string[] = [];
    const ok = await runVerifyVoucher(
      {
        voucher: encoded,
        voucherKey: wrongVoucherKey,
        expectedContractId: contractId,
        deploymentFile: tempDeploymentFile,
      },
      (msg) => logs.push(msg)
    );

    expect(ok).toBe(false);
    expect(logs.join("\n")).toContain("Offline voucher verification: INVALID");
  });
});

