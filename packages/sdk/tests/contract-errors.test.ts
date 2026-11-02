import { describe, it, expect, vi } from "vitest";
import {
  Account,
  Keypair,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk";
import {
  KerfvaultClient,
  KerfvaultContractError,
  KerfvaultErrorCode,
  KERFVAULT_ERROR_MESSAGES,
  parseContractError,
  type ClientConfig,
} from "../src/index.js";

describe("Contract error translation", () => {
  const config: ClientConfig = {
    contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  };

  it("translates every contract error code (1-11) into a KerfvaultContractError", () => {
    const errorCodes = [
      { code: KerfvaultErrorCode.BookNotFound, num: 1, text: "Book not found" },
      { code: KerfvaultErrorCode.NoteNotFound, num: 2, text: "Note not found" },
      {
        code: KerfvaultErrorCode.NoteAlreadyRedeemed,
        num: 3,
        text: "Note has already been redeemed",
      },
      {
        code: KerfvaultErrorCode.InvalidSignature,
        num: 4,
        text: "Invalid voucher signature",
      },
      {
        code: KerfvaultErrorCode.VoucherExpired,
        num: 5,
        text: "Voucher has expired",
      },
      {
        code: KerfvaultErrorCode.AmountExceedsCap,
        num: 6,
        text: "Redemption amount exceeds signed cap",
      },
      {
        code: KerfvaultErrorCode.AmountExceedsNote,
        num: 7,
        text: "Redemption amount exceeds note denomination",
      },
      {
        code: KerfvaultErrorCode.DeadlineNotReached,
        num: 8,
        text: "Redeem deadline has not been reached yet",
      },
      {
        code: KerfvaultErrorCode.NotOwner,
        num: 9,
        text: "Caller is not the owner of the book",
      },
      {
        code: KerfvaultErrorCode.InvalidDenominations,
        num: 10,
        text: "Invalid book denominations provided",
      },
      {
        code: KerfvaultErrorCode.InvalidAmount,
        num: 11,
        text: "Invalid redemption amount provided",
      },
    ];

    for (const item of errorCodes) {
      expect(KERFVAULT_ERROR_MESSAGES[item.code]).toBe(item.text);

      const errWithHash = parseContractError(`HostError: Error(Contract, #${item.num})`);
      expect(errWithHash).toBeInstanceOf(KerfvaultContractError);
      expect(errWithHash?.code).toBe(item.code);
      expect(errWithHash?.message).toContain(item.text);

      const errWithoutHash = parseContractError(`Error(Contract, ${item.num})`);
      expect(errWithoutHash).toBeInstanceOf(KerfvaultContractError);
      expect(errWithoutHash?.code).toBe(item.code);
    }
  });

  it("returns null for non-contract errors or unknown error codes", () => {
    expect(parseContractError("Transaction expired")).toBeNull();
    expect(parseContractError("Error(Contract, #99)")).toBeNull();
    expect(parseContractError(null)).toBeNull();
  });

  it("KerfvaultClient.getBook throws translated KerfvaultContractError on simulation failure", async () => {
    const mockServer = {
      simulateTransaction: vi.fn().mockResolvedValue({
        error: "HostError: Error(Contract, #1)",
      }),
    } as unknown as rpc.Server;

    const client = new KerfvaultClient(config, mockServer);

    await expect(client.getBook(999n)).rejects.toThrow(KerfvaultContractError);
    await expect(client.getBook(999n)).rejects.toThrow("Book not found");
  });

  it("KerfvaultClient.redeem throws translated KerfvaultContractError on transaction failure", async () => {
    const testSubmitter = Keypair.random();
    const mockAccount = new Account(testSubmitter.publicKey(), "100");

    const mockServer = {
      getAccount: vi.fn().mockResolvedValue(mockAccount),
      prepareTransaction: vi.fn().mockImplementation((tx) => tx),
      sendTransaction: vi.fn().mockResolvedValue({
        status: "PENDING",
        hash: "tx-hash-error",
      }),
      getTransaction: vi.fn().mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.FAILED,
        resultXdr: {
          toXDR: () => "Transaction failed with HostError: Error(Contract, #3)",
        },
      }),
    } as unknown as rpc.Server;

    const client = new KerfvaultClient(config, mockServer);

    await expect(
      client.redeem({
        submitterSecret: testSubmitter.secret(),
        bookId: 1n,
        noteIndex: 0,
        merchant: Keypair.random().publicKey(),
        amount: 5_000_000n,
        cap: 10_000_000n,
        acceptUntil: 1793404800n,
        signature: "11".repeat(64),
      })
    ).rejects.toThrow("Note has already been redeemed");
  });
});

