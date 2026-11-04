import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  Account,
  Keypair,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk";
import { runSetup, runCli } from "../src/index.js";

describe("CLI setup command", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kerfvault-cli-test-"));
  const tempKeysFile = path.join(tempDir, "test-keys.json");

  afterEach(() => {
    if (fs.existsSync(tempKeysFile)) {
      fs.unlinkSync(tempKeysFile);
    }
  });

  it("generates keypairs, calls funder, and writes keys to file", async () => {
    const fundedAddresses: string[] = [];
    const mockFunder = vi.fn().mockImplementation(async (addr: string) => {
      fundedAddresses.push(addr);
    });

    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);

    const keys = await runSetup(
      {
        keysFile: tempKeysFile,
        skipTrustline: true,
      },
      logger,
      { funder: mockFunder }
    );

    // Verify keypairs exist
    expect(keys.ownerPublicKey).toMatch(/^G[A-Z0-9]{55}$/);
    expect(keys.merchantPublicKey).toMatch(/^G[A-Z0-9]{55}$/);
    expect(keys.voucherPublicKey).toMatch(/^G[A-Z0-9]{55}$/);

    // Verify funder called for owner and merchant
    expect(mockFunder).toHaveBeenCalledTimes(2);
    expect(fundedAddresses).toContain(keys.ownerPublicKey);
    expect(fundedAddresses).toContain(keys.merchantPublicKey);

    // Verify secret keys are NEVER printed to stdout
    const fullLog = logs.join("\n");
    expect(fullLog).not.toContain(keys.ownerSecret);
    expect(fullLog).not.toContain(keys.merchantSecret);
    expect(fullLog).not.toContain(keys.voucherSecret);
    expect(fullLog).toContain(keys.ownerPublicKey);
    expect(fullLog).toContain(keys.merchantPublicKey);

    // Verify file written
    expect(fs.existsSync(tempKeysFile)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(tempKeysFile, "utf8"));
    expect(saved.ownerPublicKey).toBe(keys.ownerPublicKey);
    expect(saved.ownerSecret).toBe(keys.ownerSecret);
  });

  it("establishes trustlines for test asset when configured", async () => {
    const mockFunder = vi.fn().mockResolvedValue(undefined);
    const testDeployer = Keypair.random();
    const mockAccount = new Account(testDeployer.publicKey(), "100");

    const mockServer = {
      getAccount: vi.fn().mockResolvedValue(mockAccount),
      prepareTransaction: vi.fn().mockImplementation((tx) => tx),
      sendTransaction: vi.fn().mockResolvedValue({
        status: "PENDING",
        hash: "trustline-tx-hash",
      }),
    } as unknown as rpc.Server;

    const tempDeploymentFile = path.join(tempDir, "testnet.json");
    fs.writeFileSync(
      tempDeploymentFile,
      JSON.stringify({
        asset: {
          code: "KVUSD",
          issuer: "GCOQSUSRFKOLBTEMY5THMHIMLOLILMI6WI4R6XGT3LJ2YGHXFTADSTLD",
        },
      })
    );

    const logs: string[] = [];
    await runSetup(
      {
        keysFile: tempKeysFile,
        deploymentFile: tempDeploymentFile,
        skipTrustline: false,
      },
      (msg) => logs.push(msg),
      { funder: mockFunder, server: mockServer }
    );

    expect(mockServer.sendTransaction).toHaveBeenCalledTimes(2);
    const fullLog = logs.join("\n");
    expect(fullLog).toContain("Trustlines established for Owner and Merchant.");
  });

  it("runs end-to-end through runCli dispatcher", async () => {
    // Mock global fetch for friendbot
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => "ok",
    } as Response);

    const logs: string[] = [];
    const code = await runCli(
      ["setup", "--keys", tempKeysFile, "--skip-trustline"],
      (msg) => logs.push(msg)
    );

    expect(code).toBe(0);
    expect(fs.existsSync(tempKeysFile)).toBe(true);
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

