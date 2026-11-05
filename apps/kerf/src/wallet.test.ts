import { describe, it, expect, beforeEach } from "vitest";
import {
  hasStoredWallet,
  getStoredWallet,
  createAndStoreWallet,
  unlockStoredWallet,
  clearStoredWallet,
  WALLET_STORAGE_KEY,
} from "./lib/wallet";

// In-memory mock storage implementing the standard Web Storage API
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

describe("Shopper Wallet Storage and Lifecycle", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("reports no wallet stored initially", () => {
    expect(hasStoredWallet(storage)).toBe(false);
    expect(getStoredWallet(storage)).toBeNull();
  });

  it("enforces minimum passcode length", async () => {
    await expect(createAndStoreWallet("12345", storage)).rejects.toThrow(
      /at least 6 characters/i
    );
  });

  it("creates and encrypts a wallet into storage", async () => {
    const passcode = "secure_demo_passcode_123";
    const { session, encrypted } = await createAndStoreWallet(passcode, storage);

    expect(session.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
    expect(session.secret).toMatch(/^S[A-Z0-9]{55}$/);

    expect(hasStoredWallet(storage)).toBe(true);
    const stored = getStoredWallet(storage);
    expect(stored).not.toBeNull();
    expect(stored?.publicKey).toBe(session.publicKey);
    expect(stored?.ciphertext).toBe(encrypted.ciphertext);
    expect(stored?.salt).toBe(encrypted.salt);
    expect(stored?.iv).toBe(encrypted.iv);
  });

  it("unlocks stored wallet with the correct passcode", async () => {
    const passcode = "correct-passcode-99";
    const { session: originalSession } = await createAndStoreWallet(passcode, storage);

    const unlocked = await unlockStoredWallet(passcode, storage);
    expect(unlocked.publicKey).toBe(originalSession.publicKey);
    expect(unlocked.secret).toBe(originalSession.secret);
  });

  it("rejects unlocking with an incorrect passcode", async () => {
    const passcode = "correct-passcode-99";
    await createAndStoreWallet(passcode, storage);

    await expect(unlockStoredWallet("wrong-passcode-00", storage)).rejects.toThrow(
      /Incorrect passcode/i
    );
  });

  it("throws when unlocking without a stored wallet", async () => {
    await expect(unlockStoredWallet("any-passcode", storage)).rejects.toThrow(
      /No wallet found/i
    );
  });

  it("clears stored wallet from storage", async () => {
    await createAndStoreWallet("valid_passcode", storage);
    expect(hasStoredWallet(storage)).toBe(true);

    clearStoredWallet(storage);
    expect(hasStoredWallet(storage)).toBe(false);
    expect(storage.getItem(WALLET_STORAGE_KEY)).toBeNull();
  });
});
