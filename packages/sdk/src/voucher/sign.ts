import type { OfflineVoucher } from "./encode.js";

export interface SignVoucherParams {
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
export async function signVoucher(_params: SignVoucherParams): Promise<OfflineVoucher> {
  // TODO: Construct canonical voucher message bytes and sign with Ed25519 secret key
  throw new Error("TODO: signVoucher crypto signing not yet implemented");
}

