import {
  generateWallet,
  encryptKey,
  decryptKey,
} from "@kerfvault/web-wallet";
import {
  getStorage,
  type StoredWalletData,
  type WalletSession,
} from "./wallet";

export const VOUCHER_KEY_STORAGE_KEY = "kerfvault_shopper_voucher_key";

/**
 * Checks whether an encrypted voucher signing key exists in local storage.
 */
export function hasStoredVoucherKey(
  storage: Storage | null = getStorage()
): boolean {
  if (!storage) return false;
  return storage.getItem(VOUCHER_KEY_STORAGE_KEY) !== null;
}

/**
 * Loads the encrypted voucher key data from storage.
 */
export function getStoredVoucherKey(
  storage: Storage | null = getStorage()
): StoredWalletData | null {
  if (!storage) return null;
  const raw = storage.getItem(VOUCHER_KEY_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredWalletData;
  } catch {
    return null;
  }
}

/**
 * Saves the encrypted voucher key data to local storage.
 */
export function saveStoredVoucherKey(
  payload: StoredWalletData,
  storage: Storage | null = getStorage()
): void {
  if (!storage) return;
  storage.setItem(VOUCHER_KEY_STORAGE_KEY, JSON.stringify(payload));
}

/**
 * Clears the stored voucher signing key from local storage.
 */
export function clearStoredVoucherKey(
  storage: Storage | null = getStorage()
): void {
  if (!storage) return;
  storage.removeItem(VOUCHER_KEY_STORAGE_KEY);
}

/**
 * Mints a brand new, separate Ed25519 voucher signing key, encrypts the secret
 * with the user passcode using WebCrypto AES-GCM, and stores it securely.
 */
export async function mintAndStoreVoucherKey(
  passcode: string,
  storage: Storage | null = getStorage()
): Promise<{ session: WalletSession; encrypted: StoredWalletData }> {
  if (!passcode || passcode.length < 6) {
    throw new Error("Passcode must be at least 6 characters long.");
  }

  // Generate an independent keypair specifically for signing vouchers
  const voucherWallet = generateWallet();
  const encryptedPayload = await encryptKey(voucherWallet.secret, passcode);

  const storedData: StoredWalletData = {
    ...encryptedPayload,
    publicKey: voucherWallet.publicKey,
  };

  saveStoredVoucherKey(storedData, storage);

  return {
    session: {
      publicKey: voucherWallet.publicKey,
      secret: voucherWallet.secret,
    },
    encrypted: storedData,
  };
}

/**
 * Decrypts the stored voucher signing key using the user passcode.
 */
export async function unlockStoredVoucherKey(
  passcode: string,
  storage: Storage | null = getStorage()
): Promise<WalletSession> {
  const stored = getStoredVoucherKey(storage);
  if (!stored) {
    throw new Error("No voucher signing key found. Please mint a voucher key first.");
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
    throw new Error("Incorrect passcode: could not decrypt voucher signing key.");
  }
}

