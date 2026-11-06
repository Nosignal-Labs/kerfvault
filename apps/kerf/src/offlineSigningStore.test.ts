import { describe, it, expect, beforeEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  getVoucherSeed,
  getOfflineBooks,
  getOfflineBook,
  saveOfflineBook,
  syncOfflineBook,
  getAvailableNotesForBook,
  markNoteAsSpentOffline,
  clearOfflineBooks,
  type OfflineBook,
} from "./lib/offlineSigningStore";
import type { StoredBook } from "./lib/booksStore";
import type { BookDetailView } from "./lib/bookDetails";
import { DEFAULT_TESTNET_TOKEN } from "./lib/bookConfig";

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

describe("Offline Signing Storage & Cache", () => {
  let storage: Storage;
  const voucherKp = Keypair.random();

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  describe("getVoucherSeed", () => {
    it("extracts 32-byte Ed25519 seed from Stellar S-key", () => {
      const seed = getVoucherSeed(voucherKp.secret());
      expect(seed).toBeInstanceOf(Uint8Array);
      expect(seed.length).toBe(32);
    });
  });

  describe("OfflineBook persistence", () => {
    it("reports empty initially", () => {
      expect(getOfflineBooks(storage)).toEqual([]);
      expect(getOfflineBook("1", storage)).toBeNull();
    });

    it("saves and retrieves an offline book record", () => {
      const book: OfflineBook = {
        bookId: "1",
        contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
        voucherPublicKey: voucherKp.publicKey(),
        tokenAddress: DEFAULT_TESTNET_TOKEN,
        redeemDeadline: 1793860000,
        notes: [
          {
            index: 0,
            denominationXlm: 5,
            denominationStroops: "50000000",
            status: "available",
          },
          {
            index: 1,
            denominationXlm: 10,
            denominationStroops: "100000000",
            status: "available",
          },
        ],
        updatedAt: Math.floor(Date.now() / 1000),
      };

      saveOfflineBook(book, storage);

      const retrieved = getOfflineBook("1", storage);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.bookId).toBe("1");
      expect(retrieved?.notes).toHaveLength(2);
    });

    it("syncs from StoredBook", () => {
      const storedBook: StoredBook = {
        id: "7",
        ownerAddress: "GBOWNER1234567890",
        tokenAddress: DEFAULT_TESTNET_TOKEN,
        voucherPublicKey: voucherKp.publicKey(),
        denominations: [10, 20],
        denominationsStroops: ["100000000", "200000000"],
        totalAmountXlm: 30,
        redeemDeadline: 1793860000,
        createdAt: 1793400000,
        status: "active",
      };

      const offline = syncOfflineBook(storedBook, { storage });
      expect(offline.bookId).toBe("7");
      expect(offline.notes).toHaveLength(2);
      expect(offline.notes[0].status).toBe("available");
      expect(offline.notes[1].status).toBe("available");
    });

    it("syncs from BookDetailView and preserves locally spent notes", () => {
      // First save book and mark note #0 as spent offline
      const storedBook: StoredBook = {
        id: "12",
        ownerAddress: "GBOWNER1234567890",
        tokenAddress: DEFAULT_TESTNET_TOKEN,
        voucherPublicKey: voucherKp.publicKey(),
        denominations: [5, 10, 20],
        denominationsStroops: ["50000000", "100000000", "200000000"],
        totalAmountXlm: 35,
        redeemDeadline: 1793860000,
        createdAt: 1793400000,
        status: "active",
      };

      syncOfflineBook(storedBook, { storage });
      markNoteAsSpentOffline("12", 0, "mock_voucher_payload_base64", storage);

      // Now sync from an on-chain view where note #0 is still 'open' on-chain (not yet submitted by merchant)
      const chainView: BookDetailView = {
        id: "12",
        owner: "GBOWNER1234567890",
        token: DEFAULT_TESTNET_TOKEN,
        voucherKey: voucherKp.publicKey(),
        redeemDeadline: 1793860000,
        isExpired: false,
        noteCount: 3,
        notes: [
          { index: 0, denominationStroops: "50000000", denominationXlm: 5, state: "open" },
          { index: 1, denominationStroops: "100000000", denominationXlm: 10, state: "open" },
          { index: 2, denominationStroops: "200000000", denominationXlm: 20, state: "open" },
        ],
        totalLockedXlm: 35,
        unspentXlm: 35,
        redeemedXlm: 0,
        openNoteCount: 3,
        redeemedNoteCount: 0,
        source: "chain",
      };

      const updated = syncOfflineBook(chainView, { storage });
      // Note #0 should retain 'spent_offline' so it cannot be double-presented
      expect(updated.notes[0].status).toBe("spent_offline");
      expect(updated.notes[1].status).toBe("available");
      expect(updated.notes[2].status).toBe("available");

      // Verify getAvailableNotesForBook only returns unspent notes #1 and #2
      const available = getAvailableNotesForBook("12", storage);
      expect(available).toHaveLength(2);
      expect(available.map((n) => n.index)).toEqual([1, 2]);
    });

    it("clears offline store", () => {
      const book: OfflineBook = {
        bookId: "99",
        contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
        voucherPublicKey: voucherKp.publicKey(),
        tokenAddress: DEFAULT_TESTNET_TOKEN,
        redeemDeadline: 1793860000,
        notes: [],
        updatedAt: 123456,
      };

      saveOfflineBook(book, storage);
      expect(getOfflineBooks(storage)).toHaveLength(1);

      clearOfflineBooks(storage);
      expect(getOfflineBooks(storage)).toHaveLength(0);
    });
  });
});

