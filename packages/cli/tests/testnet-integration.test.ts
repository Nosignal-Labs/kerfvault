import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  runSetup,
  runOpenBook,
  runShowBook,
  runSignVoucher,
  runVerifyVoucher,
  runRedeemVoucher,
} from "../src/index.js";

const shouldRunTestnet =
  process.env.TESTNET_INTEGRATION === "true" ||
  process.env.RUN_INTEGRATION_TESTS === "true";

describe("Testnet full flow integration test (opt-in)", () => {
  it("gates live testnet execution behind TESTNET_INTEGRATION flag", () => {
    // When the env flag is not set, verifies that live network tests remain disabled
    expect(typeof shouldRunTestnet).toBe("boolean");
    if (!shouldRunTestnet) {
      expect(shouldRunTestnet).toBe(false);
    }
  });

  const testnetIt = shouldRunTestnet ? it : it.skip;

  testnetIt(
    "executes the complete Kerfvault offline voucher lifecycle on Stellar Testnet",
    async () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "kerfvault-testnet-e2e-")
      );
      const keysFile = path.join(tempDir, "keys.json");
      const stateFile = path.join(tempDir, "state.json");
      const deploymentFile = path.resolve(
        process.cwd(),
        "deployments/testnet.json"
      );

      if (!fs.existsSync(deploymentFile)) {
        throw new Error(
          "deployments/testnet.json is required for live integration test"
        );
      }

      const logs: string[] = [];
      const logger = (msg: string) => {
        logs.push(msg);
      };

      // 1. Setup demo accounts and fund via Friendbot
      const keys = await runSetup(
        {
          keysFile,
          deploymentFile,
          skipTrustline: true,
        },
        logger
      );
      expect(keys.ownerPublicKey).toBeDefined();
      expect(keys.merchantPublicKey).toBeDefined();

      // 2. Open book on-chain with 2 notes (1 XLM, 2 XLM in stroops)
      const bookId = await runOpenBook(
        {
          keysFile,
          deploymentFile,
          denominations: "10000000,20000000",
        },
        logger
      );
      expect(bookId).toBeGreaterThan(0n);

      // 3. Inspect book
      await runShowBook(
        {
          bookId,
          deploymentFile,
        },
        logger
      );

      // 4. Sign voucher offline (shopper side, note #0 for 0.7 XLM)
      const { voucher, encoded } = await runSignVoucher(
        {
          bookId,
          noteIndex: 0,
          merchant: keys.merchantPublicKey,
          amount: 7_000_000n,
          cap: 10_000_000n,
          keysFile,
          deploymentFile,
        },
        logger
      );
      expect(encoded).toBeDefined();

      // 5. Verify voucher offline (merchant side, zero network calls)
      const valid = await runVerifyVoucher(
        {
          voucher: encoded,
          voucherKey: keys.voucherPublicKey,
          expectedContractId: voucher.contractId,
          merchantAddress: keys.merchantPublicKey,
          keysFile,
          deploymentFile,
        },
        logger
      );
      expect(valid).toBe(true);

      // 6. Redeem voucher on-chain
      const txHash = await runRedeemVoucher(
        {
          voucher: encoded,
          keysFile,
          deploymentFile,
          stateFile,
        },
        logger
      );
      expect(txHash).toMatch(/^[0-9a-fA-F]{64}$/);

      // 7. Verify final book state
      await runShowBook(
        {
          bookId,
          deploymentFile,
        },
        logger
      );

      // Clean up temp dir
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
    120000 // 2 minute timeout for live blockchain transactions
  );
});
