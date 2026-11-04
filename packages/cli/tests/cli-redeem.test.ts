import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Keypair } from "@stellar/stellar-sdk";
import {
  encodeVoucher,
  KerfvaultClient,
  type OfflineVoucher,
} from "@kerfvault/sdk";
import { runRedeemVoucher, runCli } from "../src/index.js";

describe("CLI redeem command", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kerfvault-cli-redeem-test-"));
  const tempKeysFile = path.join(tempDir, "keys.json");
  const tempDeploymentFile = path.join(tempDir, "testnet.json");
  const tempStateFile = path.join(tempDir, "state.json");

  const contractId = "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE";
  const testMerchant = Keypair.random();
  const testSubmitter = Keypair.random();
  const testVoucher: OfflineVoucher = {
    version: 1,
    contractId,
    bookId: 101n,
    noteIndex: 0,
    merchant: testMerchant.publicKey(),
    amount: 7_000_000n,
    cap: 10_000_000n,
    acceptUntil: 1793404800n,
    signature: "ab".repeat(64),
  };
  const encodedVoucher = encodeVoucher(testVoucher);

  afterEach(() => {
    if (fs.existsSync(tempKeysFile)) fs.unlinkSync(tempKeysFile);
    if (fs.existsSync(tempDeploymentFile)) fs.unlinkSync(tempDeploymentFile);
  });

  it("redeems a voucher and prints transaction hash to stdout", async () => {
    fs.writeFileSync(
      tempKeysFile,
      JSON.stringify({
        merchantSecret: testSubmitter.secret(),
        merchantPublicKey: testSubmitter.publicKey(),
      })
    );

    const mockTxHash = "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";
    const mockClient = {
      redeem: vi.fn().mockResolvedValue(mockTxHash),
    } as unknown as KerfvaultClient;

    const logs: string[] = [];
    const txHash = await runRedeemVoucher(
      {
        voucher: encodedVoucher,
        keysFile: tempKeysFile,
        deploymentFile: tempDeploymentFile,
        stateFile: tempStateFile,
      },
      (msg) => logs.push(msg),
      mockClient
    );

    expect(txHash).toBe(mockTxHash);
    expect(mockClient.redeem).toHaveBeenCalled();
    const fullLog = logs.join("\n");
    expect(fullLog).toContain("Redemption confirmed on-chain!");
    expect(fullLog).toContain(`Transaction Hash: ${mockTxHash}`);
    expect(fullLog).toContain(testMerchant.publicKey());
    expect(fullLog).toContain("7000000 stroops");
  });

  it("throws clear error when voucher is missing", async () => {
    const mockClient = {
      redeem: vi.fn(),
    } as unknown as KerfvaultClient;

    await expect(
      runRedeemVoucher(
        {
          keysFile: tempKeysFile,
          deploymentFile: tempDeploymentFile,
          stateFile: tempStateFile,
        },
        () => {},
        mockClient
      )
    ).rejects.toThrow("Voucher string is required");
  });

  it("throws clear error when submitter secret is missing", async () => {
    const mockClient = {
      redeem: vi.fn(),
    } as unknown as KerfvaultClient;

    await expect(
      runRedeemVoucher(
        {
          voucher: encodedVoucher,
          keysFile: path.join(tempDir, "empty-keys.json"),
          deploymentFile: tempDeploymentFile,
          stateFile: tempStateFile,
        },
        () => {},
        mockClient
      )
    ).rejects.toThrow("Submitter secret key is required");
  });
});
