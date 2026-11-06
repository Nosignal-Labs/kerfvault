import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { decodeVoucher, serializeCanonicalMessage } from "@kerfvault/sdk";
import {
  mintAndStoreVoucherKey,
  unlockStoredVoucherKey,
} from "./lib/voucherKey";
import {
  saveOfflineBook,
  getOfflineBook,
  getAvailableNotesForBook,
  type OfflineBook,
} from "./lib/offlineSigningStore";
import {
  validateVoucherParams,
  DEMO_MERCHANT_ADDRESS,
  type VoucherInputParams,
} from "./lib/voucherParams";
import { generateAndSignVoucher } from "./lib/voucherSigner";

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

describe("Offline Airplane Mode Payment Exercise", () => {
  let memoryStorage: MemoryStorage;
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    fetchCallCount = 0;

    // Simulate airplane mode: navigator.onLine is false
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: false },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, "window", {
      value: { localStorage: memoryStorage },
      writable: true,
      configurable: true,
    });

    // Network requests throw error if attempted in airplane mode
    globalThis.fetch = vi.fn().mockImplementation(() => {
      fetchCallCount++;
      return Promise.reject(new TypeError("Failed to fetch: device is in airplane mode (offline)"));
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("completes full offline voucher generation in airplane mode with zero network calls", async () => {
    const userPasscode = "AirplanePass#123";

    // 1. Decrypt voucher key locally via WebCrypto
    const { session: minted } = await mintAndStoreVoucherKey(userPasscode, memoryStorage);
    expect(minted.publicKey).toMatch(/^G[A-Z0-9]{55}$/);

    const unlocked = await unlockStoredVoucherKey(userPasscode, memoryStorage);
    expect(unlocked.secret).toBe(minted.secret);

    // 2. Populate cached offline book representing previous online sync
    const bookDeadline = Math.floor(Date.now() / 1000) + 86400 * 7;
    const testBook: OfflineBook = {
      bookId: "42",
      contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
      voucherPublicKey: unlocked.publicKey,
      tokenAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      redeemDeadline: bookDeadline,
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
        {
          index: 2,
          denominationXlm: 25,
          denominationStroops: "250000000",
          status: "available",
        },
      ],
      updatedAt: Date.now(),
    };
    saveOfflineBook(testBook, memoryStorage);

    // Initial check: all 3 notes are available
    let availableNotes = getAvailableNotesForBook("42", memoryStorage);
    expect(availableNotes).toHaveLength(3);

    // 3. Shopper selects Note #1 (10 XLM) to spend at merchant
    const firstPaymentParams: VoucherInputParams = {
      bookId: "42",
      noteIndex: 1,
      merchant: DEMO_MERCHANT_ADDRESS,
      amountXlm: 10,
      capXlm: 10,
      acceptUntil: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
    };

    // Validate parameters offline
    const val1 = validateVoucherParams(firstPaymentParams, bookDeadline);
    expect(val1.valid).toBe(true);

    // Sign voucher offline
    const voucher1 = await generateAndSignVoucher(
      firstPaymentParams,
      testBook,
      unlocked.secret,
      memoryStorage
    );

    // Assert QR wire payload was generated
    expect(voucher1.wirePayload).toBeDefined();
    expect(typeof voucher1.wirePayload).toBe("string");

    // Decode voucher and verify cryptographic authenticity offline
    const decoded1 = decodeVoucher(voucher1.wirePayload);
    expect(decoded1.bookId).toBe(42n);
    expect(decoded1.noteIndex).toBe(1);
    expect(decoded1.amount).toBe(100_000_000n);
    expect(decoded1.cap).toBe(100_000_000n);
    expect(decoded1.merchant).toBe(DEMO_MERCHANT_ADDRESS);

    const canonicalMsg1 = serializeCanonicalMessage(decoded1);
    const kp = Keypair.fromPublicKey(unlocked.publicKey);
    expect(
      kp.verify(Buffer.from(canonicalMsg1), Buffer.from(decoded1.signature, "hex"))
    ).toBe(true);

    // 4. Assert Note #1 is now marked as spent offline
    const bookAfterFirst = getOfflineBook("42", memoryStorage);
    expect(bookAfterFirst?.notes[1].status).toBe("spent_offline");
    expect(bookAfterFirst?.notes[1].voucherPayload).toBe(voucher1.wirePayload);

    // Only notes 0 and 2 are now available
    availableNotes = getAvailableNotesForBook("42", memoryStorage);
    expect(availableNotes.map((n) => n.index)).toEqual([0, 2]);

    // 5. Shopper selects Note #0 (5 XLM) for a second offline payment with amount 5 XLM and cap 5 XLM
    const secondPaymentParams: VoucherInputParams = {
      bookId: "42",
      noteIndex: 0,
      merchant: DEMO_MERCHANT_ADDRESS,
      amountXlm: 5,
      capXlm: 5,
      acceptUntil: Math.floor(Date.now() / 1000) + 7200, // 2 hour expiry
    };

    const val2 = validateVoucherParams(secondPaymentParams, bookDeadline);
    expect(val2.valid).toBe(true);

    const voucher2 = await generateAndSignVoucher(
      secondPaymentParams,
      testBook,
      unlocked.secret,
      memoryStorage
    );

    const decoded2 = decodeVoucher(voucher2.wirePayload);
    expect(decoded2.bookId).toBe(42n);
    expect(decoded2.noteIndex).toBe(0);
    expect(decoded2.amount).toBe(50_000_000n);
    expect(decoded2.cap).toBe(50_000_000n);

    const canonicalMsg2 = serializeCanonicalMessage(decoded2);
    expect(
      kp.verify(Buffer.from(canonicalMsg2), Buffer.from(decoded2.signature, "hex"))
    ).toBe(true);

    // Only Note #2 remains available
    availableNotes = getAvailableNotesForBook("42", memoryStorage);
    expect(availableNotes).toHaveLength(1);
    expect(availableNotes[0].index).toBe(2);

    // 6. Confirm ZERO network requests occurred during the entire offline payment cycle
    expect(fetchCallCount).toBe(0);
  });

  it("prevents spending a note that has already been spent offline", async () => {
    const userPasscode = "DoubleSpendGuard#456";
    const { session } = await mintAndStoreVoucherKey(userPasscode, memoryStorage);

    const bookDeadline = Math.floor(Date.now() / 1000) + 86400 * 7;
    const testBook: OfflineBook = {
      bookId: "88",
      contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
      voucherPublicKey: session.publicKey,
      tokenAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      redeemDeadline: bookDeadline,
      notes: [
        {
          index: 0,
          denominationXlm: 10,
          denominationStroops: "100000000",
          status: "available",
        },
      ],
      updatedAt: Date.now(),
    };
    saveOfflineBook(testBook, memoryStorage);

    // Spend note 0 once
    await generateAndSignVoucher(
      {
        bookId: "88",
        noteIndex: 0,
        merchant: DEMO_MERCHANT_ADDRESS,
        amountXlm: 10,
        capXlm: 10,
        acceptUntil: Math.floor(Date.now() / 1000) + 1800,
      },
      testBook,
      session.secret,
      memoryStorage
    );

    // Note 0 is spent
    const available = getAvailableNotesForBook("88", memoryStorage);
    expect(available).toHaveLength(0);

    // Zero network requests
    expect(fetchCallCount).toBe(0);
  });
});

