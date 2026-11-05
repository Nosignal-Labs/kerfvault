/**
 * Public and private keys of an active, unlocked in-memory wallet.
 */
export interface WalletAccount {
  publicKey: string;
  secret: string;
}

/**
 * Storage representation of an in-app demo wallet.
 */
export interface StoredWallet {
  version: number;
  publicKey: string;
  network: "testnet";
  createdAt: number;
  encryptedKey?: string;
  salt?: string;
  iv?: string;
}

/**
 * State representing current status of the in-browser wallet.
 */
export interface WalletState {
  hasWallet: boolean;
  isUnlocked: boolean;
  publicKey: string | null;
}
