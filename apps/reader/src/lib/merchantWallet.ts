import {
  generateWallet,
  encryptKey,
  decryptKey,
} from "@kerfvault/web-wallet";
import { Keypair } from "@stellar/stellar-sdk";

export const MERCHANT_WALLET_STORAGE_KEY = "kerfvault_merchant_wallet";

export interface StoredWalletData {
  ciphertext: string;
  salt: string;
  iv: string;
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
 * Checks whether an encrypted merchant wallet exists in storage.
 */
export function hasStoredMerchantWallet(
  storage: Storage | null = getStorage()
): boolean {
  if (!storage) return false;
  return storage.getItem(MERCHANT_WALLET_STORAGE_KEY) !== null;
}

/**
 * Loads the encrypted merchant wallet metadata from storage.
 */
export function getStoredMerchantWallet(
  storage: Storage | null = getStorage()
): StoredWalletData | null {
  if (!storage) return null;
  const raw = storage.getItem(MERCHANT_WALLET_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredWalletData;
  } catch {
    return null;
  }
}

/**
 * Persists encrypted merchant wallet metadata into storage.
 */
export function saveStoredMerchantWallet(
  payload: StoredWalletData,
  storage: Storage | null = getStorage()
): void {
  if (!storage) return;
  storage.setItem(MERCHANT_WALLET_STORAGE_KEY, JSON.stringify(payload));
}

/**
 * Clears stored merchant wallet data from storage.
 */
export function clearStoredMerchantWallet(
  storage: Storage | null = getStorage()
): void {
  if (!storage) return;
  storage.removeItem(MERCHANT_WALLET_STORAGE_KEY);
}

/**
 * Creates a brand new merchant Stellar keypair, encrypts the secret using WebCrypto AES-GCM
 * with the merchant passcode, and stores it in localStorage.
 */
export async function createAndStoreMerchantWallet(
  passcode: string,
  storage: Storage | null = getStorage()
): Promise<{ session: WalletSession; encrypted: StoredWalletData }> {
  if (!passcode || passcode.length < 6) {
    throw new Error("Passcode must be at least 6 characters long.");
  }

  const generated = generateWallet();
  const encryptedPayload = await encryptKey(generated.secret, passcode);

  const storedData: StoredWalletData = {
    ...encryptedPayload,
    publicKey: generated.publicKey,
  };

  saveStoredMerchantWallet(storedData, storage);

  return {
    session: {
      publicKey: generated.publicKey,
      secret: generated.secret,
    },
    encrypted: storedData,
  };
}

/**
 * Imports an existing Stellar secret key (S...), encrypts it with the passcode,
 * and saves it as the merchant wallet.
 */
export async function importAndStoreMerchantWallet(
  secretKey: string,
  passcode: string,
  storage: Storage | null = getStorage()
): Promise<{ session: WalletSession; encrypted: StoredWalletData }> {
  if (!passcode || passcode.length < 6) {
    throw new Error("Passcode must be at least 6 characters long.");
  }

  let kp: Keypair;
  try {
    kp = Keypair.fromSecret(secretKey.trim());
  } catch {
    throw new Error("Invalid Stellar secret key. Must start with 'S' and be 56 characters.");
  }

  const publicKey = kp.publicKey();
  const encryptedPayload = await encryptKey(kp.secret(), passcode);

  const storedData: StoredWalletData = {
    ...encryptedPayload,
    publicKey,
  };

  saveStoredMerchantWallet(storedData, storage);

  return {
    session: {
      publicKey,
      secret: kp.secret(),
    },
    encrypted: storedData,
  };
}

/**
 * Decrypts the stored merchant wallet using the provided passcode.
 */
export async function unlockStoredMerchantWallet(
  passcode: string,
  storage: Storage | null = getStorage()
): Promise<WalletSession> {
  const stored = getStoredMerchantWallet(storage);
  if (!stored) {
    throw new Error("No merchant wallet found in storage. Please onboard or import a wallet first.");
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
    throw new Error("Incorrect passcode. Could not decrypt merchant wallet.");
  }
}

