/**
 * Kerfvault contract error codes matching contracts/kerfvault/src/lib.rs Error enum.
 */
export enum KerfvaultErrorCode {
  BookNotFound = 1,
  NoteNotFound = 2,
  NoteAlreadyRedeemed = 3,
  InvalidSignature = 4,
  VoucherExpired = 5,
  AmountExceedsCap = 6,
  AmountExceedsNote = 7,
  DeadlineNotReached = 8,
  NotOwner = 9,
  InvalidDenominations = 10,
  InvalidAmount = 11,
}

export const KERFVAULT_ERROR_MESSAGES: Record<KerfvaultErrorCode, string> = {
  [KerfvaultErrorCode.BookNotFound]: "Book not found",
  [KerfvaultErrorCode.NoteNotFound]: "Note not found",
  [KerfvaultErrorCode.NoteAlreadyRedeemed]: "Note has already been redeemed",
  [KerfvaultErrorCode.InvalidSignature]: "Invalid voucher signature",
  [KerfvaultErrorCode.VoucherExpired]: "Voucher has expired",
  [KerfvaultErrorCode.AmountExceedsCap]: "Redemption amount exceeds signed cap",
  [KerfvaultErrorCode.AmountExceedsNote]:
    "Redemption amount exceeds note denomination",
  [KerfvaultErrorCode.DeadlineNotReached]:
    "Redeem deadline has not been reached yet",
  [KerfvaultErrorCode.NotOwner]: "Caller is not the owner of the book",
  [KerfvaultErrorCode.InvalidDenominations]:
    "Invalid book denominations provided",
  [KerfvaultErrorCode.InvalidAmount]: "Invalid redemption amount provided",
};

export class KerfvaultContractError extends Error {
  public readonly code: KerfvaultErrorCode;
  public readonly rawError?: string;

  constructor(code: KerfvaultErrorCode, rawError?: string) {
    const defaultMsg =
      KERFVAULT_ERROR_MESSAGES[code] || `Unknown contract error #${code}`;
    super(rawError ? `${defaultMsg} (${rawError})` : defaultMsg);
    this.name = "KerfvaultContractError";
    this.code = code;
    this.rawError = rawError;
  }
}

/**
 * Extracts and translates contract errors from RPC simulation results or error strings.
 */
export function parseContractError(error: unknown): KerfvaultContractError | null {
  if (!error) return null;
  const str =
    typeof error === "string"
      ? error
      : error instanceof Error
      ? error.message
      : JSON.stringify(error);

  // Common Soroban RPC contract error patterns:
  // - "Error(Contract, #1)"
  // - "Error(Contract, 1)"
  // - "contract error #1"
  // - "HostError: Error(Contract, #3)"
  const match =
    str.match(/Error\(Contract,\s*#?(\d+)\)/) ||
    str.match(/contract\s+error\s+#?(\d+)/i) ||
    str.match(/sceContractError\((\d+)\)/);

  if (match) {
    const codeNum = parseInt(match[1], 10);
    if (codeNum in KERFVAULT_ERROR_MESSAGES) {
      return new KerfvaultContractError(codeNum as KerfvaultErrorCode, str);
    }
  }

  return null;
}

