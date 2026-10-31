export interface OfflineVoucher {
  version: number;
  contractId: string;
  bookId: bigint;
  noteIndex: number;
  merchant: string;
  amount: bigint;
  cap: bigint;
  acceptUntil: bigint;
  voucherKey: string;
  signature: string;
}

/**
 * Encodes an offline voucher object into its QR-friendly wire string representation.
 * Reference: docs/VOUCHER_SPEC.md
 */
export function encodeVoucher(_voucher: OfflineVoucher): string {
  // TODO: Implement compact binary or CBOR/base45 encoding per docs/VOUCHER_SPEC.md
  throw new Error("TODO: encodeVoucher serialization not yet implemented");
}

/**
 * Decodes a raw wire string (e.g. from QR scan) into a structured OfflineVoucher.
 * Reference: docs/VOUCHER_SPEC.md
 */
export function decodeVoucher(_raw: string): OfflineVoucher {
  // TODO: Implement decoding and wire-format validation per docs/VOUCHER_SPEC.md
  throw new Error("TODO: decodeVoucher parsing not yet implemented");
}

