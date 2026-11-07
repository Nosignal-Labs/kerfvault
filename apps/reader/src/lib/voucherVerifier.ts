import {
  type OfflineVoucher,
  type RegistrySnapshot,
  type RegistryNote,
  type RegistryNoteStatus,
  verifyVoucher,
} from "@kerfvault/sdk";
import { stroopsToXlm } from "./voucherDecoder";

export interface VoucherSignatureVerificationResult {
  valid: boolean;
  voucherKey?: string;
  bookId?: string;
  payeeMatched?: boolean;
  noteStatus?: RegistryNoteStatus;
  noteIsOpen?: boolean;
  withinMerchantCap?: boolean;
  maxCapLimitXlm?: number;
  reason?: string;
  error?: string;
}

export interface VerifySignatureOptions {
  currentTimestamp?: bigint;
  merchantAddress?: string;
  maxCapLimit?: bigint;
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
 * Checks if a voucher has exceeded its expiration deadline.
 */
export function checkVoucherExpiry(
  acceptUntil: bigint,
  currentTimestamp?: bigint
): { expired: boolean; error?: string } {
  const now = currentTimestamp ?? BigInt(Math.floor(Date.now() / 1000));
  if (now > acceptUntil) {
    const expiryStr = new Date(Number(acceptUntil) * 1000).toLocaleString();
    return {
      expired: true,
      error: `Voucher expired: Accept deadline (${expiryStr}) has passed.`,
    };
  }
  return { expired: false };
}

/**
 * Checks if the specific note within the book exists and is in "Open" status.
 */
export function checkNoteOpenStatus(
  bookNotes: RegistryNote[] | undefined,
  noteIndex: number
): { open: boolean; status?: RegistryNoteStatus; error?: string } {
  if (!bookNotes) {
    return {
      open: false,
      error: `No notes registered for this book.`,
    };
  }

  const note = bookNotes.find((n) => n.index === noteIndex);
  if (!note) {
    return {
      open: false,
      error: `Note #${noteIndex} does not exist in the book's note registry.`,
    };
  }

  if (note.status !== "Open") {
    return {
      open: false,
      status: note.status,
      error: `Note #${noteIndex} is no longer open (current status: ${note.status}). It has already been redeemed.`,
    };
  }

  return { open: true, status: "Open" };
}

/**
 * Validates voucher cap and amount bounds against the merchant's configured offline limit.
 */
export function checkMerchantCapLimit(
  voucherAmount: bigint,
  voucherCap: bigint,
  maxCapLimit?: bigint
): { withinCap: boolean; error?: string } {
  if (voucherAmount > voucherCap) {
    return {
      withinCap: false,
      error: `Amount exceeds cap: Voucher amount (${stroopsToXlm(voucherAmount)} XLM) cannot exceed its cap (${stroopsToXlm(voucherCap)} XLM).`,
    };
  }

  if (voucherAmount <= 0n) {
    return {
      withinCap: false,
      error: `Invalid amount: Voucher amount must be greater than zero.`,
    };
  }

  if (maxCapLimit !== undefined) {
    if (voucherCap > maxCapLimit) {
      return {
        withinCap: false,
        error: `Cap exceeds merchant limit: Voucher cap (${stroopsToXlm(voucherCap)} XLM) exceeds merchant terminal limit (${stroopsToXlm(maxCapLimit)} XLM).`,
      };
    }
    if (voucherAmount > maxCapLimit) {
      return {
        withinCap: false,
        error: `Amount exceeds merchant limit: Voucher amount (${stroopsToXlm(voucherAmount)} XLM) exceeds merchant terminal limit (${stroopsToXlm(maxCapLimit)} XLM).`,
      };
    }
  }

  return { withinCap: true };
}

/**
 * Verifies a scanned voucher against the local registry snapshot and merchant limits:
 * 1. Checks voucher expiry (acceptUntil) and book expiry (redeemDeadline).
 * 2. Confirms that the target note in the book is currently "Open" (rejects redeemed notes).
 * 3. Confirms that this merchant terminal is the named payee.
 * 4. Holds every voucher to the merchant terminal's own offline cap limit.
 * 5. Cryptographically matches the Ed25519 signature to the book's registered voucherKey.
 *
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

  // 1. Expiry check: reject expired vouchers
  const expiryCheck = checkVoucherExpiry(voucher.acceptUntil, options?.currentTimestamp);
  if (expiryCheck.expired) {
    return {
      valid: false,
      reason: "VoucherExpired",
      voucherKey: book.voucherKey,
      bookId: bookIdStr,
      error: expiryCheck.error,
    };
  }

  // Check book redeem deadline
  const now = options?.currentTimestamp ?? BigInt(Math.floor(Date.now() / 1000));
  if (book.redeemDeadline && BigInt(book.redeemDeadline) < now) {
    return {
      valid: false,
      reason: "BookExpired",
      voucherKey: book.voucherKey,
      bookId: bookIdStr,
      error: `Book #${bookIdStr} expired: Redeem deadline has passed.`,
    };
  }

  // 2. Note status check: reject notes that are no longer open
  const noteCheck = checkNoteOpenStatus(book.notes, voucher.noteIndex);
  if (!noteCheck.open) {
    return {
      valid: false,
      reason: noteCheck.status ? "NoteNotOpen" : "NoteNotFound",
      voucherKey: book.voucherKey,
      bookId: bookIdStr,
      noteStatus: noteCheck.status,
      noteIsOpen: false,
      error: noteCheck.error,
    };
  }

  // 3. Payee check: confirm named merchant payee if merchant address is provided
  if (options?.merchantAddress) {
    const payeeCheck = confirmMerchantPayee(voucher.merchant, options.merchantAddress);
    if (!payeeCheck.matches) {
      return {
        valid: false,
        reason: "MerchantMismatch",
        voucherKey: book.voucherKey,
        bookId: bookIdStr,
        payeeMatched: false,
        noteStatus: noteCheck.status,
        noteIsOpen: true,
        error: payeeCheck.error,
      };
    }
  }

  // 4. Merchant offline cap limit check
  const capCheck = checkMerchantCapLimit(voucher.amount, voucher.cap, options?.maxCapLimit);
  if (!capCheck.withinCap) {
    const isCapViolation = options?.maxCapLimit !== undefined && voucher.cap > options.maxCapLimit;
    return {
      valid: false,
      reason: isCapViolation ? "CapExceedsMerchantLimit" : "AmountExceedsCap",
      voucherKey: book.voucherKey,
      bookId: bookIdStr,
      withinMerchantCap: false,
      maxCapLimitXlm: options?.maxCapLimit ? stroopsToXlm(options.maxCapLimit) : undefined,
      noteStatus: noteCheck.status,
      noteIsOpen: true,
      payeeMatched: !options?.merchantAddress || voucher.merchant === options.merchantAddress,
      error: capCheck.error,
    };
  }

  // 5. Cryptographically verify the voucher signature using the book's registered voucherKey
  const verifyRes = await verifyVoucher(voucher, {
    voucherKey: book.voucherKey,
    expectedContractId: snapshot.contractId || voucher.contractId,
    merchantAddress: options?.merchantAddress,
    maxCapLimit: options?.maxCapLimit,
    currentTimestamp: options?.currentTimestamp,
  });

  if (!verifyRes.valid) {
    let friendlyError = `Voucher signature does not match registry voucher key.`;
    if (verifyRes.reason === "InvalidSignature") {
      friendlyError = `Cryptographic signature mismatch: Signature was not produced by registry voucher key ${book.voucherKey}.`;
    } else if (verifyRes.reason === "MerchantMismatch") {
      friendlyError = `Merchant payee mismatch: Voucher payee (${voucher.merchant}) does not match this terminal (${options?.merchantAddress}).`;
    } else if (verifyRes.reason === "VoucherExpired") {
      friendlyError = `Voucher expired: Accept deadline has passed.`;
    } else if (verifyRes.reason === "CapExceedsMerchantLimit") {
      friendlyError = `Cap exceeds merchant limit: Voucher cap exceeds merchant terminal offline cap limit.`;
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
      withinMerchantCap: verifyRes.reason !== "CapExceedsMerchantLimit",
      noteStatus: noteCheck.status,
      noteIsOpen: true,
      error: friendlyError,
    };
  }

  return {
    valid: true,
    voucherKey: book.voucherKey,
    bookId: bookIdStr,
    noteStatus: noteCheck.status,
    noteIsOpen: true,
    withinMerchantCap: true,
    maxCapLimitXlm: options?.maxCapLimit ? stroopsToXlm(options.maxCapLimit) : undefined,
    payeeMatched: Boolean(options?.merchantAddress && voucher.merchant === options.merchantAddress),
  };
}
