import { describe, it, expect, beforeEach } from "vitest";
import {
  hasStoredVoucherKey,
  getStoredVoucherKey,
  mintAndStoreVoucherKey,
  unlockStoredVoucherKey,
  clearStoredVoucherKey,
  VOUCHER_KEY_STORAGE_KEY,
} from "./lib/voucherKey";
import { createAndStoreWallet } from "./lib/wallet";

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

describe("Separate Voucher Key Minting and Storage", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("reports no voucher key stored initially", () => {
    expect(hasStoredVoucherKey(storage)).toBe(false);
    expect(getStoredVoucherKey(storage)).toBeNull();
  });

  it("enforces minimum passcode length when minting", async () => {
    await expect(mintAndStoreVoucherKey("12345", storage)).rejects.toThrow(
      /at least 6 characters/i
    );
  });

  it("mints an encrypted voucher key separate from funding account", async () => {
    const passcode = "test_passcode_12345";

    // Create primary wallet
    const { session: walletSession } = await createAndStoreWallet(passcode, storage);

    // Mint separate voucher key
    const { session: voucherSession, encrypted } = await mintAndStoreVoucherKey(
      passcode,
      storage
    );

    // Must be distinct keys
    expect(voucherSession.publicKey).not.toBe(walletSession.publicKey);
    expect(voucherSession.secret).not.toBe(walletSession.secret);

    expect(voucherSession.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
    expect(voucherSession.secret).toMatch(/^S[A-Z0-9]{55}$/);

    expect(hasStoredVoucherKey(storage)).toBe(true);
    const stored = getStoredVoucherKey(storage);
    expect(stored?.publicKey).toBe(voucherSession.publicKey);
    expect(stored?.ciphertext).toBe(encrypted.ciphertext);
    expect(stored?.salt).toBe(encrypted.salt);
    expect(stored?.iv).toBe(encrypted.iv);
  });

  it("unlocks stored voucher key with correct passcode", async () => {
    const passcode = "correct-voucher-passcode-88";
    const { session: original } = await mintAndStoreVoucherKey(passcode, storage);

    const unlocked = await unlockStoredVoucherKey(passcode, storage);
    expect(unlocked.publicKey).toBe(original.publicKey);
    expect(unlocked.secret).toBe(original.secret);
  });

  it("rejects unlocking voucher key with incorrect passcode", async () => {
    const passcode = "correct-voucher-passcode-88";
    await mintAndStoreVoucherKey(passcode, storage);

    await expect(
      unlockStoredVoucherKey("wrong-passcode-99", storage)
    ).rejects.toThrow(/Incorrect passcode/i);
  });

  it("throws when unlocking without a stored voucher key", async () => {
    await expect(unlockStoredVoucherKey("any-passcode", storage)).rejects.toThrow(
      /No voucher signing key found/i
    );
  });

  it("clears stored voucher key", async () => {
    await mintAndStoreVoucherKey("passcode_12345", storage);
    expect(hasStoredVoucherKey(storage)).toBe(true);

    clearStoredVoucherKey(storage);
    expect(hasStoredVoucherKey(storage)).toBe(false);
    expect(storage.getItem(VOUCHER_KEY_STORAGE_KEY)).toBeNull();
  });
});

