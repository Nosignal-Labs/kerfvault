import {
  generateWallet,
  encryptKey,
  decryptKey,
  type EncryptedPayload,
} from "@kerfvault/web-wallet";

export const WALLET_STORAGE_KEY = "kerfvault_shopper_wallet";

export interface StoredWalletData extends EncryptedPayload {
  publicKey: string;
}

export interface WalletSession {
  publicKey: string;
  secret: string;
}

export function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Checks whether an encrypted wallet is stored in local storage.
 */
export function hasStoredWallet(storage: Storage | null = getStorage()): boolean {
  if (!storage) return false;
  return storage.getItem(WALLET_STORAGE_KEY) !== null;
}

/**
 * Loads the encrypted wallet payload from storage.
 */
export function getStoredWallet(
  storage: Storage | null = getStorage()
): StoredWalletData | null {
  if (!storage) return null;
  const raw = storage.getItem(WALLET_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredWalletData;
  } catch {
    return null;
  }
}

/**
 * Saves an encrypted wallet payload to local storage.
 */
export function saveStoredWallet(
  payload: StoredWalletData,
  storage: Storage | null = getStorage()
): void {
  if (!storage) return;
  storage.setItem(WALLET_STORAGE_KEY, JSON.stringify(payload));
}

/**
 * Removes the stored wallet from local storage.
 */
export function clearStoredWallet(storage: Storage | null = getStorage()): void {
  if (!storage) return;
  storage.removeItem(WALLET_STORAGE_KEY);
}

/**
 * Generates a new Stellar keypair, encrypts the secret key with the provided
 * passcode using WebCrypto PBKDF2/AES-GCM, and saves the ciphertext to storage.
 */
export async function createAndStoreWallet(
  passcode: string,
  storage: Storage | null = getStorage()
): Promise<{ session: WalletSession; encrypted: StoredWalletData }> {
  if (!passcode || passcode.length < 6) {
    throw new Error("Passcode must be at least 6 characters long.");
  }

  const wallet = generateWallet();
  const encryptedPayload = await encryptKey(wallet.secret, passcode);
  const storedData: StoredWalletData = {
    ...encryptedPayload,
    publicKey: wallet.publicKey,
  };
  saveStoredWallet(storedData, storage);

  return {
    session: {
      publicKey: wallet.publicKey,
      secret: wallet.secret,
    },
    encrypted: storedData,
  };
}

/**
 * Decrypts the stored wallet using the user-provided passcode.
 * Throws an explicit error if the passcode is incorrect or the ciphertext is tampered.
 */
export async function unlockStoredWallet(
  passcode: string,
  storage: Storage | null = getStorage()
): Promise<WalletSession> {
  const stored = getStoredWallet(storage);
  if (!stored) {
    throw new Error("No wallet found. Please create a wallet first.");
  }

  try {
    const secret = await decryptKey(
      {
        ciphertext: stored.ciphertext,
        salt: stored.salt,
        iv: stored.iv,
      },
      passcode
    );
    return {
      publicKey: stored.publicKey,
      secret,
    };
  } catch {
    throw new Error("Incorrect passcode or corrupted wallet data.");
  }
}
