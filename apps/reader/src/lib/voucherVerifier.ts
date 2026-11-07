import {
  type OfflineVoucher,
  type RegistrySnapshot,
  verifyVoucher,
} from "@kerfvault/sdk";

export interface VoucherSignatureVerificationResult {
  valid: boolean;
  voucherKey?: string;
  bookId?: string;
  payeeMatched?: boolean;
  reason?: string;
  error?: string;
}

export interface VerifySignatureOptions {
  currentTimestamp?: bigint;
  merchantAddress?: string;
}

/**
 * Validates whether the voucher's named payee matches this merchant's terminal address.
 */
export function confirmMerchantPayee(
  voucherMerchant: string,
  currentMerchantAddress: string | null
): { matches: boolean; error?: string } {
  if (!currentMerchantAddress) {
    return {
      matches: false,
      error: "Merchant terminal wallet is not configured or unlocked. Please check wallet in Settings.",
    };
  }

  if (voucherMerchant !== currentMerchantAddress) {
    return {
      matches: false,
      error: `Merchant payee mismatch: Voucher is addressed to ${voucherMerchant}, but this terminal's address is ${currentMerchantAddress}.`,
    };
  }

  return { matches: true };
}

/**
 * Matches a scanned voucher's cryptographic signature against the book's
 * registered voucherKey in the locally cached registry snapshot, and confirms
 * that this merchant terminal is the named payee.
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

  // Confirm named merchant payee if merchant address is provided
  if (options?.merchantAddress) {
    const payeeCheck = confirmMerchantPayee(voucher.merchant, options.merchantAddress);
    if (!payeeCheck.matches) {
      return {
        valid: false,
        reason: "MerchantMismatch",
        voucherKey: book.voucherKey,
        bookId: bookIdStr,
        payeeMatched: false,
        error: payeeCheck.error,
      };
    }
  }

  // Cryptographically verify the voucher signature using the book's registered voucherKey
  const verifyRes = await verifyVoucher(voucher, {
    voucherKey: book.voucherKey,
    expectedContractId: snapshot.contractId || voucher.contractId,
    merchantAddress: options?.merchantAddress,
    currentTimestamp: options?.currentTimestamp,
  });

  if (!verifyRes.valid) {
    let friendlyError = `Voucher signature does not match registry voucher key.`;
    if (verifyRes.reason === "InvalidSignature") {
      friendlyError = `Cryptographic signature mismatch: Signature was not produced by registry voucher key ${book.voucherKey}.`;
    } else if (verifyRes.reason === "MerchantMismatch") {
      friendlyError = `Merchant payee mismatch: Voucher payee (${voucher.merchant}) does not match this terminal (${options?.merchantAddress}).`;
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
      payeeMatched: verifyRes.reason !== "MerchantMismatch",
      error: friendlyError,
    };
  }

  return {
    valid: true,
    voucherKey: book.voucherKey,
    bookId: bookIdStr,
    payeeMatched: Boolean(options?.merchantAddress && voucher.merchant === options.merchantAddress),
  };
}
