import {
  type OfflineVoucher,
  type RegistrySnapshot,
  verifyVoucher,
} from "@kerfvault/sdk";

export interface VoucherSignatureVerificationResult {
  valid: boolean;
  voucherKey?: string;
  bookId?: string;
  reason?: string;
  error?: string;
}

export interface VerifySignatureOptions {
  currentTimestamp?: bigint;
}

/**
 * Matches a scanned voucher's cryptographic signature against the book's
 * registered voucherKey in the locally cached registry snapshot.
 *
 * Performs Ed25519 public key signature verification offline.
 * Guaranteed 100% offline with zero network calls.
 * Reference: docs/VOUCHER_SPEC.md & docs/THREAT_MODEL.md
 */
export async function verifyVoucherSignatureAgainstRegistry(
  voucher: OfflineVoucher,
  snapshot: RegistrySnapshot | null,
  options?: VerifySignatureOptions
): Promise<VoucherSignatureVerificationResult> {
  if (!snapshot) {
    return {
      valid: false,
      reason: "NoSnapshot",
      error: "Registry snapshot is missing. Please sync registry with indexer before verifying vouchers.",
    };
  }

  const bookIdStr = voucher.bookId.toString();
  const book = snapshot.books?.[bookIdStr];

  if (!book) {
    return {
      valid: false,
      reason: "BookNotFound",
      bookId: bookIdStr,
      error: `Book ID ${bookIdStr} is not registered in the local registry snapshot.`,
    };
  }

  if (!book.voucherKey) {
    return {
      valid: false,
      reason: "MissingVoucherKey",
      bookId: bookIdStr,
      error: `Book ID ${bookIdStr} does not have a registered voucher signing key.`,
    };
  }

  // Cryptographically verify the voucher signature using the book's registered voucherKey
  const verifyRes = await verifyVoucher(voucher, {
    voucherKey: book.voucherKey,
    expectedContractId: snapshot.contractId || voucher.contractId,
    currentTimestamp: options?.currentTimestamp,
  });

  if (!verifyRes.valid) {
    let friendlyError = `Voucher signature does not match registry voucher key.`;
    if (verifyRes.reason === "InvalidSignature") {
      friendlyError = `Cryptographic signature mismatch: Signature was not produced by registry voucher key ${book.voucherKey}.`;
    } else if (verifyRes.reason === "ContractMismatch") {
      friendlyError = `Contract ID mismatch: Voucher contract (${voucher.contractId}) does not match registry contract (${snapshot.contractId}).`;
    } else if (verifyRes.reason) {
      friendlyError = `Signature verification failed: ${verifyRes.reason}`;
    }

    return {
      valid: false,
      reason: verifyRes.reason || "InvalidSignature",
      voucherKey: book.voucherKey,
      bookId: bookIdStr,
      error: friendlyError,
    };
  }

  return {
    valid: true,
    voucherKey: book.voucherKey,
    bookId: bookIdStr,
  };
}
