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
  type RedeemParams,
} from "../src/index.js";

describe("KerfvaultClient redeem dispatch", () => {
  const config: ClientConfig = {
    contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  };

  const testSubmitter = Keypair.random();
  const testMerchant = Keypair.random();
  const sampleParams: RedeemParams = {
    submitterSecret: testSubmitter.secret(),
    bookId: 1n,
    noteIndex: 0,
    merchant: testMerchant.publicKey(),
    amount: 7_000_000n,
    cap: 10_000_000n,
    acceptUntil: 1793404800n,
    signature: "ab".repeat(64),
  };

  it("builds, prepares, signs, and dispatches redeem transaction successfully", async () => {
    const mockAccount = new Account(testSubmitter.publicKey(), "100");
    const mockTxHash = "33445566778899aabbccddeeff00112233445566778899aabbccddeeff001122";

    const mockServer = {
      getAccount: vi.fn().mockResolvedValue(mockAccount),
      prepareTransaction: vi.fn().mockImplementation((tx) => tx),
      sendTransaction: vi.fn().mockResolvedValue({
        status: "PENDING",
        hash: mockTxHash,
      }),
      getTransaction: vi.fn().mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
        returnValue: nativeToScVal(null),
      }),
    } as unknown as rpc.Server;

    const client = new KerfvaultClient(config, mockServer);
    const txHash = await client.redeem(sampleParams);

    expect(txHash).toBe(mockTxHash);
    expect(mockServer.getAccount).toHaveBeenCalledWith(testSubmitter.publicKey());
    expect(mockServer.sendTransaction).toHaveBeenCalled();
    expect(mockServer.getTransaction).toHaveBeenCalledWith(mockTxHash);
  });

  it("accepts Uint8Array signature as well as hex string", async () => {
    const mockAccount = new Account(testSubmitter.publicKey(), "100");
    const mockTxHash = "aabbccddee";

    const mockServer = {
      getAccount: vi.fn().mockResolvedValue(mockAccount),
      prepareTransaction: vi.fn().mockImplementation((tx) => tx),
      sendTransaction: vi.fn().mockResolvedValue({
        status: "PENDING",
        hash: mockTxHash,
      }),
      getTransaction: vi.fn().mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
        returnValue: nativeToScVal(null),
      }),
    } as unknown as rpc.Server;

    const client = new KerfvaultClient(config, mockServer);
    const paramsWithBytes: RedeemParams = {
      ...sampleParams,
      signature: new Uint8Array(64).fill(0xcd),
    };
    const txHash = await client.redeem(paramsWithBytes);

    expect(txHash).toBe(mockTxHash);
  });

  it("throws error when submitterSecret is missing", async () => {
    const client = new KerfvaultClient(config, {} as rpc.Server);
    const invalidParams = { ...sampleParams, submitterSecret: undefined };

    await expect(client.redeem(invalidParams)).rejects.toThrow(
      "submitterSecret is required"
    );
  });

  it("throws error when signature length is invalid", async () => {
    const client = new KerfvaultClient(config, {} as rpc.Server);
    const invalidParams = { ...sampleParams, signature: "abcd" };

    await expect(client.redeem(invalidParams)).rejects.toThrow(
      "Invalid signature length"
    );
  });

  it("throws error when sendTransaction returns ERROR status", async () => {
    const mockAccount = new Account(testSubmitter.publicKey(), "100");

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
    await expect(client.redeem(sampleParams)).rejects.toThrow(
      "Failed to submit redeem transaction"
    );
  });

  it("throws error when transaction polling fails", async () => {
    const mockAccount = new Account(testSubmitter.publicKey(), "100");
    const mockTxHash = "deadbeef";

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
    await expect(client.redeem(sampleParams)).rejects.toThrow(
      "Transaction deadbeef failed"
    );
  });
});

