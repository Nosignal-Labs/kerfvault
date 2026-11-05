import { Keypair, StrKey } from "@stellar/stellar-sdk";
import type { WalletAccount } from "./types.js";

/**
 * Generates a fresh random Stellar keypair for testnet demo use.
 */
export function generateWallet(): WalletAccount {
  const kp = Keypair.random();
  return {
    publicKey: kp.publicKey(),
    secret: kp.secret(),
  };
}

/**
 * Validates whether a given string is a valid 56-character Stellar Ed25519 public address (G...).
 */
export function isValidAddress(address: string): boolean {
  if (!address || typeof address !== "string" || !address.startsWith("G") || address.length !== 56) {
    return false;
  }
  return StrKey.isValidEd25519PublicKey(address);
}

/**
 * Signs a payload with the wallet's secret key.
 */
export function signWithWallet(
  payload: Uint8Array | Buffer,
  account: WalletAccount
): Uint8Array {
  const kp = Keypair.fromSecret(account.secret);
  return new Uint8Array(kp.sign(Buffer.from(payload)));
}

/**
 * Verifies a signature produced by a wallet address.
 */
export function verifyWalletSignature(
  payload: Uint8Array | Buffer,
  signature: Uint8Array | Buffer,
  publicKey: string
): boolean {
  if (!isValidAddress(publicKey)) {
    return false;
  }
  const kp = Keypair.fromPublicKey(publicKey);
  return kp.verify(Buffer.from(payload), Buffer.from(signature));
}
