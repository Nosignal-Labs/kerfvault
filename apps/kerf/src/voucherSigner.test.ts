import { describe, it, expect, beforeEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { decodeVoucher, serializeCanonicalMessage } from "@kerfvault/sdk";
import { generateAndSignVoucher } from "./lib/voucherSigner";
import {
  saveOfflineBook,
  getOfflineBook,
  type OfflineBook,
} from "./lib/offlineSigningStore";
import type { VoucherInputParams } from "./lib/voucherParams";

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

describe("Offline Voucher Signing and QR Generation", () => {
  let memoryStorage: MemoryStorage;
  let testVoucherKeypair: Keypair;
  let testBook: OfflineBook;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    Object.defineProperty(globalThis, "window", {
      value: { localStorage: memoryStorage },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: memoryStorage,
      writable: true,
      configurable: true,
    });

    testVoucherKeypair = Keypair.random();

    testBook = {
      bookId: "101",
      contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
      voucherPublicKey: testVoucherKeypair.publicKey(),
      tokenAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      redeemDeadline: Math.floor(Date.now() / 1000) + 86400 * 7,
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
      updatedAt: Date.now(),
    };

    saveOfflineBook(testBook, memoryStorage);
  });

  it("signs a voucher and generates a decodable QR wire payload", async () => {
    const params: VoucherInputParams = {
      bookId: "101",
      noteIndex: 1,
      merchant: "GBZXN7PIRZGNMHGA72W2M2UMQLFNEJITVMHR27W2522DYNO7ZTVURW2X",
      amountXlm: 10,
      capXlm: 10,
      acceptUntil: Math.floor(Date.now() / 1000) + 3600,
    };

    const result = await generateAndSignVoucher(
      params,
      testBook,
      testVoucherKeypair.secret(),
      memoryStorage
    );

    expect(result.wirePayload).toBeDefined();
    expect(typeof result.wirePayload).toBe("string");
    expect(result.wirePayload.length).toBeGreaterThan(50);

    // Decode and verify the wire payload
    const decoded = decodeVoucher(result.wirePayload);
    expect(decoded.bookId).toBe(101n);
    expect(decoded.noteIndex).toBe(1);
    expect(decoded.merchant).toBe(params.merchant);
    expect(decoded.amount).toBe(100_000_000n);
    expect(decoded.cap).toBe(100_000_000n);
    expect(decoded.acceptUntil).toBe(BigInt(params.acceptUntil));

    // Verify cryptographic signature matches the voucher public key
    const canonicalMsg = serializeCanonicalMessage(decoded);
    const isValidSig = testVoucherKeypair.verify(
      Buffer.from(canonicalMsg),
      Buffer.from(decoded.signature, "hex")
    );
    expect(isValidSig).toBe(true);

    // Verify note is marked spent_offline in offline storage
    const updatedBook = getOfflineBook("101", memoryStorage);
    expect(updatedBook?.notes[1].status).toBe("spent_offline");
    expect(updatedBook?.notes[0].status).toBe("available");
  });

  it("fails when voucher secret is missing", async () => {
    const params: VoucherInputParams = {
      bookId: "101",
      noteIndex: 0,
      merchant: "GBZXN7PIRZGNMHGA72W2M2UMQLFNEJITVMHR27W2522DYNO7ZTVURW2X",
      amountXlm: 5,
      capXlm: 5,
      acceptUntil: Math.floor(Date.now() / 1000) + 3600,
    };

    await expect(
      generateAndSignVoucher(params, testBook, "")
    ).rejects.toThrow("Voucher signing secret is required");
  });
});

