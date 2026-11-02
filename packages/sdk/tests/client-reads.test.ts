import { describe, it, expect, vi } from "vitest";
import { nativeToScVal, rpc } from "@stellar/stellar-sdk";
import {
  KerfvaultClient,
  NoteState,
  type ClientConfig,
} from "../src/index.js";

describe("KerfvaultClient typed contract reads", () => {
  const config: ClientConfig = {
    contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  };

  it("queries and decodes book metadata successfully", async () => {
    const rawVoucherKey = new Uint8Array(32).fill(0xab);
    const mockRetval = nativeToScVal({
      free_balance: 3_000_000n,
      note_count: 2,
      owner: "GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK",
      redeem_deadline: 1793404800n,
      token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      voucher_key: rawVoucherKey,
    });

    const mockServer = {
      simulateTransaction: vi.fn().mockResolvedValue({
        transactionData: {},
        result: {
          retval: mockRetval,
        },
      }),
    } as unknown as rpc.Server;

    const client = new KerfvaultClient(config, mockServer);
    const book = await client.getBook(1n);

    expect(book.bookId).toBe(1n);
    expect(book.owner).toBe("GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK");
    expect(book.freeBalance).toBe(3_000_000n);
    expect(book.noteCount).toBe(2);
    expect(book.redeemDeadline).toBe(1793404800n);
    expect(book.voucherKey).toBe("ab".repeat(32));
  });

  it("queries and decodes note metadata successfully", async () => {
    const mockRetval = nativeToScVal({
      denomination: 10_000_000n,
      state: 1, // NoteState.Redeemed
    });

    const mockServer = {
      simulateTransaction: vi.fn().mockResolvedValue({
        transactionData: {},
        result: {
          retval: mockRetval,
        },
      }),
    } as unknown as rpc.Server;

    const client = new KerfvaultClient(config, mockServer);
    const note = await client.getNote(1n, 0);

    expect(note.denomination).toBe(10_000_000n);
    expect(note.state).toBe(NoteState.Redeemed);
  });

  it("throws error when getBook simulation fails", async () => {
    const mockServer = {
      simulateTransaction: vi.fn().mockResolvedValue({
        error: "HostError: Error(Contract, #1)",
      }),
    } as unknown as rpc.Server;

    const client = new KerfvaultClient(config, mockServer);
    await expect(client.getBook(999n)).rejects.toThrow("Failed to simulate get_book");
  });

  it("throws error when getNote simulation fails", async () => {
    const mockServer = {
      simulateTransaction: vi.fn().mockResolvedValue({
        error: "HostError: Error(Contract, #2)",
      }),
    } as unknown as rpc.Server;

    const client = new KerfvaultClient(config, mockServer);
    await expect(client.getNote(1n, 99)).rejects.toThrow("Failed to simulate get_note");
  });
});
