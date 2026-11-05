import { describe, it, expect, vi } from "vitest";
import type { KerfvaultClient } from "@kerfvault/sdk";
import { NoteState } from "@kerfvault/sdk";
import {
  loadBookDetails,
  stroopsToXlm,
} from "./lib/bookDetails";
import { saveStoredBook, type StoredBook } from "./lib/booksStore";

// In-memory mock storage
class MemoryStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("Shopper Book Details Loader", () => {
  it("converts stroops to XLM", () => {
    expect(stroopsToXlm(10_000_000n)).toBe(1);
    expect(stroopsToXlm(50_000_000n)).toBe(5);
    expect(stroopsToXlm(250_000_000n)).toBe(25);
  });

  it("loads on-chain book and notes through SDK client", async () => {
    const mockClient = {
      getBook: vi.fn().mockResolvedValue({
        bookId: 5n,
        owner: "GBABC111111111111111111111111111111111111111111111111111111",
        token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        voucherKey: "abcdef0123456789",
        redeemDeadline: BigInt(Math.floor(Date.now() / 1000) + 86400 * 5),
        freeBalance: 0n,
        noteCount: 3,
      }),
      getNote: vi.fn().mockImplementation(async (_bookId: bigint, index: number) => {
        if (index === 0) {
          return { denomination: 100_000_000n, state: NoteState.Open }; // 10 XLM
        }
        if (index === 1) {
          return { denomination: 200_000_000n, state: NoteState.Redeemed }; // 20 XLM (spent)
        }
        return { denomination: 50_000_000n, state: NoteState.Open }; // 5 XLM
      }),
    } as unknown as KerfvaultClient;

    const details = await loadBookDetails("5", {
      client: mockClient,
    });

    expect(details.id).toBe("5");
    expect(details.source).toBe("chain");
    expect(details.noteCount).toBe(3);
    expect(details.notes).toHaveLength(3);

    expect(details.totalLockedXlm).toBe(35); // 10 + 20 + 5
    expect(details.unspentXlm).toBe(15); // 10 + 5
    expect(details.redeemedXlm).toBe(20); // 20
    expect(details.openNoteCount).toBe(2);
    expect(details.redeemedNoteCount).toBe(1);
    expect(details.isExpired).toBe(false);
  });

  it("transparently falls back to local cached book when offline", async () => {
    const storage = new MemoryStorage();
    const futureDeadline = Math.floor(Date.now() / 1000) + 86400 * 7;

    const cachedBook: StoredBook = {
      id: "99",
      ownerAddress: "GBABC99999999999999999999999999999999999999999999999999999",
      tokenAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      voucherPublicKey: "GBVOUCHER999999999999999999999999999999999999999999999999",
      denominations: [5, 15],
      denominationsStroops: ["50000000", "150000000"],
      totalAmountXlm: 20,
      redeemDeadline: futureDeadline,
      createdAt: Math.floor(Date.now() / 1000) - 100,
      status: "active",
    };

    saveStoredBook(cachedBook, storage);

    // Client throws network error (offline simulation)
    const mockClient = {
      getBook: vi.fn().mockRejectedValue(new Error("Network connection offline: ENOTFOUND")),
    } as unknown as KerfvaultClient;

    const details = await loadBookDetails("99", {
      client: mockClient,
      storage,
    });

    expect(details.id).toBe("99");
    expect(details.source).toBe("cache");
    expect(details.totalLockedXlm).toBe(20);
    expect(details.unspentXlm).toBe(20);
    expect(details.notes).toHaveLength(2);
    expect(details.notes[0].denominationXlm).toBe(5);
    expect(details.notes[1].denominationXlm).toBe(15);
  });

  it("throws when book is neither on-chain nor in cache", async () => {
    const storage = new MemoryStorage();
    const mockClient = {
      getBook: vi.fn().mockRejectedValue(new Error("RPC error: NotFound")),
    } as unknown as KerfvaultClient;

    await expect(
      loadBookDetails("999", {
        client: mockClient,
        storage,
      })
    ).rejects.toThrow(/Could not load Book #999/);
  });
});

