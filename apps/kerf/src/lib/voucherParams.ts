import { isValidAddress } from "@kerfvault/web-wallet";

export const DEMO_MERCHANT_ADDRESS =
  "GDELSDATL7W2JEDSUGSQUFP3YP36VPWM4V4C5TJLIY4LZMIMKGCSRNFG";

export interface VoucherInputParams {
  bookId: string;
  noteIndex: number;
  merchant: string;
  amountXlm: number;
  capXlm: number;
  acceptUntil: number; // UNIX seconds
}

export interface ExpiryOption {
  id: string;
  label: string;
  secondsFromNow: (bookDeadline?: number) => number;
}

export const EXPIRY_OPTIONS: ExpiryOption[] = [
  {
    id: "1h",
    label: "1 Hour",
    secondsFromNow: () => 3600,
  },
  {
    id: "24h",
    label: "24 Hours (1 Day)",
    secondsFromNow: () => 86400,
  },
  {
    id: "3d",
    label: "3 Days",
    secondsFromNow: () => 86400 * 3,
  },
  {
    id: "max",
    label: "Max (Book Expiry)",
    secondsFromNow: (bookDeadline?: number) => {
      const now = Math.floor(Date.now() / 1000);
      if (bookDeadline && bookDeadline > now) {
        return bookDeadline - now;
      }
      return 86400 * 7;
    },
  },
];

/**
 * Validates voucher presentation parameters before signing.
 */
export function validateVoucherParams(
  params: VoucherInputParams,
  bookDeadline?: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!params.bookId || params.bookId.trim() === "") {
    errors.push("Book selection is required.");
  }

  if (params.noteIndex < 0 || !Number.isInteger(params.noteIndex)) {
    errors.push("Valid note index is required.");
  }

  const merchantTrimmed = params.merchant.trim();
  if (!merchantTrimmed) {
    errors.push("Merchant address is required.");
  } else if (!isValidAddress(merchantTrimmed)) {
    errors.push("Merchant address must be a valid 56-character Stellar G-address.");
  }

  if (params.amountXlm <= 0 || !Number.isFinite(params.amountXlm)) {
    errors.push("Voucher amount must be a positive number.");
  }

  if (params.capXlm < params.amountXlm) {
    errors.push(
      `Voucher cap (${params.capXlm} XLM) cannot be less than voucher amount (${params.amountXlm} XLM).`
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (params.acceptUntil <= nowSeconds) {
    errors.push("Expiry timestamp (accept_until) must be set in the future.");
  }

  if (bookDeadline && params.acceptUntil > bookDeadline) {
    errors.push(
      `Expiry cannot exceed book redeem deadline (${new Date(bookDeadline * 1000).toUTCString()}).`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

