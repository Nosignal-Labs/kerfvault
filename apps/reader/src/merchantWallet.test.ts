import { describe, it, expect, beforeEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  createAndStoreMerchantWallet,
  importAndStoreMerchantWallet,
  unlockStoredMerchantWallet,
  hasStoredMerchantWallet,
  getStoredMerchantWallet,
  clearStoredMerchantWallet,
} from "./lib/merchantWallet";

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

describe("Merchant Terminal Wallet Storage & Lifecycle", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("creates and encrypts a new merchant wallet into storage", async () => {
    expect(hasStoredMerchantWallet(storage)).toBe(false);

    const { session, encrypted } = await createAndStoreMerchantWallet(
      "MerchantSecure#123",
      storage
    );

    expect(session.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
    expect(session.secret).toMatch(/^S[A-Z0-9]{55}$/);
    expect(encrypted.publicKey).toBe(session.publicKey);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.salt).toBeDefined();
    expect(encrypted.iv).toBeDefined();

    expect(hasStoredMerchantWallet(storage)).toBe(true);
    const stored = getStoredMerchantWallet(storage);
    expect(stored?.publicKey).toBe(session.publicKey);
  });

  it("unlocks stored merchant wallet with the correct passcode", async () => {
    const passcode = "CorrectPasscode#789";
    const { session: original } = await createAndStoreMerchantWallet(passcode, storage);

    const unlocked = await unlockStoredMerchantWallet(passcode, storage);
    expect(unlocked.publicKey).toBe(original.publicKey);
    expect(unlocked.secret).toBe(original.secret);
  });

  it("rejects unlocking with an incorrect passcode", async () => {
    await createAndStoreMerchantWallet("RightPasscode123", storage);

    await expect(
      unlockStoredMerchantWallet("WrongPasscode456", storage)
    ).rejects.toThrow(/Incorrect passcode/i);
  });

  it("imports an existing Stellar secret key and encrypts it", async () => {
    const kp = Keypair.random();
    const passcode = "ImportSecret#123";

    const { session, encrypted } = await importAndStoreMerchantWallet(
      kp.secret(),
      passcode,
      storage
    );

    expect(session.publicKey).toBe(kp.publicKey());
    expect(session.secret).toBe(kp.secret());
    expect(encrypted.publicKey).toBe(kp.publicKey());

    // Verify it unlocks cleanly
    const unlocked = await unlockStoredMerchantWallet(passcode, storage);
    expect(unlocked.publicKey).toBe(kp.publicKey());
    expect(unlocked.secret).toBe(kp.secret());
  });

  it("rejects importing invalid secret keys", async () => {
    await expect(
      importAndStoreMerchantWallet("invalid_key", "passcode123", storage)
    ).rejects.toThrow(/Invalid Stellar secret key/i);
  });

  it("rejects passcodes shorter than 6 characters", async () => {
    await expect(
      createAndStoreMerchantWallet("12345", storage)
    ).rejects.toThrow(/at least 6 characters/i);
  });

  it("clears stored merchant wallet", async () => {
    await createAndStoreMerchantWallet("PasscodeToClear#", storage);
    expect(hasStoredMerchantWallet(storage)).toBe(true);

    clearStoredMerchantWallet(storage);
    expect(hasStoredMerchantWallet(storage)).toBe(false);
    expect(getStoredMerchantWallet(storage)).toBeNull();
  });
});

