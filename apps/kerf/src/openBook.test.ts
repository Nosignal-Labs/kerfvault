import { describe, it, expect, vi, beforeEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import type { KerfvaultClient } from "@kerfvault/sdk";
import {
  openBookWorkflow,
  type OpenBookProgress,
} from "./lib/openBookWorkflow";
import {
  getStoredBooks,
  getStoredBookById,
  saveStoredBook,
  clearStoredBooks,
  type StoredBook,
} from "./lib/booksStore";
import {
  DEFAULT_TESTNET_TOKEN,
  xlmToStroops,
  calculateDeadlineTimestamp,
  type BookConfiguration,
} from "./lib/bookConfig";

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

describe("Open Book Browser Workflow and Storage", () => {
  let storage: Storage;
  const ownerKeypair = Keypair.random();
  const voucherKeypair = Keypair.random();

  const sampleConfig: BookConfiguration = {
    tokenAddress: DEFAULT_TESTNET_TOKEN,
    denominations: [5, 10, 20],
    deadlineDays: 7,
    deadlineTimestamp: calculateDeadlineTimestamp(7),
    totalXlm: 35,
    totalStroops: 350_000_000n,
    denominationsInStroops: [50_000_000n, 100_000_000n, 200_000_000n],
  };

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  describe("booksStore", () => {
    it("manages stored books in storage", () => {
      expect(getStoredBooks(storage)).toEqual([]);

      const sampleBook: StoredBook = {
        id: "42",
        ownerAddress: ownerKeypair.publicKey(),
        tokenAddress: DEFAULT_TESTNET_TOKEN,
        voucherPublicKey: voucherKeypair.publicKey(),
        denominations: [10, 20],
        denominationsStroops: ["100000000", "200000000"],
        totalAmountXlm: 30,
        redeemDeadline: 1793860000,
        createdAt: 1793400000,
        status: "active",
      };

      saveStoredBook(sampleBook, storage);

      const all = getStoredBooks(storage);
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe("42");

      const byId = getStoredBookById("42", storage);
      expect(byId).not.toBeNull();
      expect(byId?.ownerAddress).toBe(ownerKeypair.publicKey());

      clearStoredBooks(storage);
      expect(getStoredBooks(storage)).toEqual([]);
    });
  });

  describe("openBookWorkflow", () => {
    it("fails when ownerSecret is missing", async () => {
      await expect(
        openBookWorkflow({
          config: sampleConfig,
          ownerSecret: "",
          ownerAddress: ownerKeypair.publicKey(),
          voucherPublicKey: voucherKeypair.publicKey(),
          storage,
        })
      ).rejects.toThrow(/missing owner secret/i);
    });

    it("successfully runs workflow, calls client.openBook, and saves book", async () => {
      const mockClient = {
        openBook: vi.fn().mockResolvedValue(101n),
      } as unknown as KerfvaultClient;

      const progressHistory: OpenBookProgress[] = [];

      const result = await openBookWorkflow({
        config: sampleConfig,
        ownerSecret: ownerKeypair.secret(),
        ownerAddress: ownerKeypair.publicKey(),
        voucherPublicKey: voucherKeypair.publicKey(),
        client: mockClient,
        storage,
        onProgress: (p) => progressHistory.push(p),
      });

      expect(result.bookId).toBe("101");
      expect(result.storedBook.id).toBe("101");
      expect(result.storedBook.totalAmountXlm).toBe(35);

      // Verify client call arguments
      expect(mockClient.openBook).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerSecret: ownerKeypair.secret(),
          tokenAddress: DEFAULT_TESTNET_TOKEN,
          denominations: [50_000_000n, 100_000_000n, 200_000_000n],
          redeemDeadline: BigInt(sampleConfig.deadlineTimestamp),
        })
      );

      // Verify progress steps
      const steps = progressHistory.map((p) => p.step);
      expect(steps).toContain("VALIDATING");
      expect(steps).toContain("PREPARING");
      expect(steps).toContain("SUBMITTING");
      expect(steps).toContain("CONFIRMED");

      // Verify stored book in storage
      const stored = getStoredBookById("101", storage);
      expect(stored).not.toBeNull();
      expect(stored?.id).toBe("101");
    });

    it("reports ERROR step when client throws", async () => {
      const mockClient = {
        openBook: vi.fn().mockRejectedValue(new Error("Soroban simulation failed: InsufficientBalance")),
      } as unknown as KerfvaultClient;

      const progressHistory: OpenBookProgress[] = [];

      await expect(
        openBookWorkflow({
          config: sampleConfig,
          ownerSecret: ownerKeypair.secret(),
          ownerAddress: ownerKeypair.publicKey(),
          voucherPublicKey: voucherKeypair.publicKey(),
          client: mockClient,
          storage,
          onProgress: (p) => progressHistory.push(p),
        })
      ).rejects.toThrow(/InsufficientBalance/);

      const lastProgress = progressHistory[progressHistory.length - 1];
      expect(lastProgress.step).toBe("ERROR");
      expect(lastProgress.error).toContain("InsufficientBalance");
    });
  });
});

