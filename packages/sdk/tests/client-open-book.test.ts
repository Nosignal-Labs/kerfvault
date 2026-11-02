import { describe, it, expect, vi } from "vitest";
import {
  Account,
  Keypair,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk";
import {
  KerfvaultClient,
  type ClientConfig,
  type OpenBookParams,
} from "../src/index.js";

describe("KerfvaultClient openBook dispatch", () => {
  const config: ClientConfig = {
    contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  };

  const testOwner = Keypair.random();
  const sampleParams: OpenBookParams = {
    ownerSecret: testOwner.secret(),
    tokenAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    voucherKey: "ab".repeat(32),
    denominations: [10_000_000n, 20_000_000n],
    redeemDeadline: 1793404800n,
  };

  it("builds, prepares, signs, and dispatches openBook transaction successfully", async () => {
    const mockAccount = new Account(testOwner.publicKey(), "100");
    const mockTxHash = "112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00";

    const mockServer = {
      getAccount: vi.fn().mockResolvedValue(mockAccount),
      prepareTransaction: vi.fn().mockImplementation((tx) => tx),
      sendTransaction: vi.fn().mockResolvedValue({
        status: "PENDING",
        hash: mockTxHash,
      }),
      getTransaction: vi.fn().mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
        returnValue: nativeToScVal(42n, { type: "u64" }),
      }),
    } as unknown as rpc.Server;

    const client = new KerfvaultClient(config, mockServer);
    const bookId = await client.openBook(sampleParams);

    expect(bookId).toBe(42n);
    expect(mockServer.getAccount).toHaveBeenCalledWith(testOwner.publicKey());
    expect(mockServer.sendTransaction).toHaveBeenCalled();
    expect(mockServer.getTransaction).toHaveBeenCalledWith(mockTxHash);
  });

  it("throws error when sendTransaction returns ERROR status", async () => {
    const mockAccount = new Account(testOwner.publicKey(), "100");

    const mockServer = {
      getAccount: vi.fn().mockResolvedValue(mockAccount),
      prepareTransaction: vi.fn().mockImplementation((tx) => tx),
      sendTransaction: vi.fn().mockResolvedValue({
        status: "ERROR",
        errorResult: {
          toXDR: () => "mock-error-xdr",
        },
      }),
    } as unknown as rpc.Server;

    const client = new KerfvaultClient(config, mockServer);
    await expect(client.openBook(sampleParams)).rejects.toThrow(
      "Failed to submit open_book transaction"
    );
  });

  it("throws error when transaction polling fails", async () => {
    const mockAccount = new Account(testOwner.publicKey(), "100");
    const mockTxHash = "aabbcc";

    const mockServer = {
      getAccount: vi.fn().mockResolvedValue(mockAccount),
      prepareTransaction: vi.fn().mockImplementation((tx) => tx),
      sendTransaction: vi.fn().mockResolvedValue({
        status: "PENDING",
        hash: mockTxHash,
      }),
      getTransaction: vi.fn().mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.FAILED,
        resultXdr: {
          toXDR: () => "tx-failed-xdr",
        },
      }),
    } as unknown as rpc.Server;

    const client = new KerfvaultClient(config, mockServer);
    await expect(client.openBook(sampleParams)).rejects.toThrow(
      "Transaction aabbcc failed"
    );
  });
});

