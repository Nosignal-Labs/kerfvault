import { Keypair } from "@stellar/stellar-sdk";
import {
  signVoucher,
  encodeVoucher,
  type OfflineVoucher,
} from "@kerfvault/sdk";
import type { VoucherInputParams } from "./voucherParams";
import type { OfflineBook } from "./offlineSigningStore";
import { markNoteAsSpentOffline } from "./offlineSigningStore";
import { xlmToStroops } from "./bookConfig";
import { getStorage } from "./wallet";

export interface GenerateVoucherResult {
  voucher: OfflineVoucher;
  wirePayload: string;
}

/**
 * Signs an offline Kerfvault voucher using the shopper's dedicated voucher secret key,
 * encodes it to the canonical QR wire format, and records the note as spent offline.
 */
export async function generateAndSignVoucher(
  params: VoucherInputParams,
  book: OfflineBook,
  voucherSecret: string,
  storage: Storage | null = getStorage()
): Promise<GenerateVoucherResult> {
  if (!voucherSecret) {
    throw new Error("Voucher signing secret is required to sign offline vouchers.");
  }

  // Derive raw 32-byte Ed25519 seed from Stellar secret key (S...)
  const keypair = Keypair.fromSecret(voucherSecret);
  const seedBytes = new Uint8Array(keypair.rawSecretKey());

  const amountStroops = xlmToStroops(params.amountXlm);
  const capStroops = xlmToStroops(params.capXlm);

  const voucher = await signVoucher({
    contractId: book.contractId,
    bookId: BigInt(params.bookId),
    noteIndex: params.noteIndex,
    merchant: params.merchant,
    amount: amountStroops,
    cap: capStroops,
    acceptUntil: BigInt(params.acceptUntil),
    voucherSecretKey: seedBytes,
  });

  const wirePayload = encodeVoucher(voucher);

  // Mark the note as spent locally in the offline store to avoid accidental reuse
  markNoteAsSpentOffline(params.bookId, params.noteIndex, wirePayload, storage);

  return {
    voucher,
    wirePayload,
  };
}

