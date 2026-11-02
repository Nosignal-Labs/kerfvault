import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Keypair } from "@stellar/stellar-sdk";
import {
  KerfvaultClient,
  NoteState,
  type BookView,
  type NoteView,
} from "@kerfvault/sdk";
import { runOpenBook, runShowBook, runCli } from "../src/index.js";

describe("CLI open-book and show-book commands", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kerfvault-cli-book-test-"));
  const tempKeysFile = path.join(tempDir, "keys.json");
  const tempDeploymentFile = path.join(tempDir, "testnet.json");

  const testOwner = Keypair.random();
  const testVoucher = Keypair.random();
  const tokenAddress = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

  afterEach(() => {
    if (fs.existsSync(tempKeysFile)) fs.unlinkSync(tempKeysFile);
    if (fs.existsSync(tempDeploymentFile)) fs.unlinkSync(tempDeploymentFile);
  });

  it("opens a book successfully with provided or loaded credentials", async () => {
    fs.writeFileSync(
      tempKeysFile,
      JSON.stringify({
        ownerSecret: testOwner.secret(),
        voucherPublicKey: testVoucher.publicKey(),
      })
    );

    fs.writeFileSync(
      tempDeploymentFile,
      JSON.stringify({
        contracts: {
          nativeSac: tokenAddress,
        },
      })
    );

    const mockClient = {
      openBook: vi.fn().mockResolvedValue(101n),
    } as unknown as KerfvaultClient;

    const logs: string[] = [];
    const bookId = await runOpenBook(
      {
        keysFile: tempKeysFile,
        deploymentFile: tempDeploymentFile,
        denominations: "10000000,20000000",
      },
      (msg) => logs.push(msg),
      mockClient
    );

    expect(bookId).toBe(101n);
    expect(mockClient.openBook).toHaveBeenCalled();
    const fullLog = logs.join("\n");
    expect(fullLog).toContain("Book ID:          101");
    expect(fullLog).toContain(testOwner.publicKey());
    expect(fullLog).toContain(tokenAddress);
  });

  it("shows book and note details from contract storage", async () => {
    const mockBook: BookView = {
      bookId: 101n,
      owner: testOwner.publicKey(),
      token: tokenAddress,
      voucherKey: "abcdef",
      redeemDeadline: 1793404800n,
      freeBalance: 5_000_000n,
      noteCount: 2,
    };

    const mockNotes: NoteView[] = [
      { denomination: 10_000_000n, state: NoteState.Open },
      { denomination: 20_000_000n, state: NoteState.Redeemed },
    ];

    const mockClient = {
      getBook: vi.fn().mockResolvedValue(mockBook),
      getNote: vi.fn().mockImplementation(async (_id: bigint, idx: number) => mockNotes[idx]),
    } as unknown as KerfvaultClient;

    const logs: string[] = [];
    await runShowBook(
      {
        bookId: 101n,
        deploymentFile: tempDeploymentFile,
      },
      (msg) => logs.push(msg),
      mockClient
    );

    expect(mockClient.getBook).toHaveBeenCalledWith(101n);
    expect(mockClient.getNote).toHaveBeenCalledTimes(2);

    const fullLog = logs.join("\n");
    expect(fullLog).toContain("Book ID:          101");
    expect(fullLog).toContain("Note #0: denomination = 10000000 stroops, state = OPEN");
    expect(fullLog).toContain("Note #1: denomination = 20000000 stroops, state = REDEEMED");
  });

  it("throws clear error when owner credentials are missing", async () => {
    const mockClient = {
      openBook: vi.fn(),
    } as unknown as KerfvaultClient;

    await expect(
      runOpenBook(
        {
          keysFile: path.join(tempDir, "nonexistent.json"),
          deploymentFile: tempDeploymentFile,
        },
        () => {},
        mockClient
      )
    ).rejects.toThrow("Owner secret key is required");
  });
});

