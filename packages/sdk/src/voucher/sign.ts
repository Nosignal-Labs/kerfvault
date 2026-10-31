import { Keypair } from "@stellar/stellar-sdk";
import {
  type OfflineVoucher,
  bytesToHex,
  hexToBytes,
  serializeCanonicalMessage,
} from "./encode.js";

export interface SignVoucherParams {
  version?: number;
  contractId: string;
  bookId: bigint;
  noteIndex: number;
  merchant: string;
  amount: bigint;
  cap: bigint;
  acceptUntil: bigint;
  voucherSecretKey: Uint8Array | string;
}

/**
 * Signs canonical voucher message bytes using the shopper's offline Ed25519 voucher key.
 * Reference: docs/VOUCHER_SPEC.md
 */
export async function signVoucher(params: SignVoucherParams): Promise<OfflineVoucher> {
  let seedBytes: Uint8Array;
  if (typeof params.voucherSecretKey === "string") {
    seedBytes = hexToBytes(params.voucherSecretKey);
  } else {
    seedBytes = params.voucherSecretKey;
  }

  if (seedBytes.length !== 32) {
    throw new Error(`Ed25519 seed must be exactly 32 bytes, got ${seedBytes.length}`);
  }

  // Use Keypair from stellar-sdk for deterministic Ed25519 signing
  const keypair = Keypair.fromRawEd25519Seed(Buffer.from(seedBytes));
  const msgBytes = serializeCanonicalMessage(params);
  const signatureBuffer = keypair.sign(Buffer.from(msgBytes));
  const signature = bytesToHex(new Uint8Array(signatureBuffer));
  const voucherKey = bytesToHex(new Uint8Array(keypair.rawPublicKey()));

  return {
    version: params.version ?? 1,
    contractId: params.contractId,
    bookId: params.bookId,
    noteIndex: params.noteIndex,
    merchant: params.merchant,
    amount: params.amount,
    cap: params.cap,
    acceptUntil: params.acceptUntil,
    voucherKey,
    signature,
  };
}
