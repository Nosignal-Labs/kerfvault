import { decodeVoucher, type OfflineVoucher } from "@kerfvault/sdk";

export interface DecodedVoucherResult {
  valid: boolean;
  voucher?: OfflineVoucher;
  rawPayload: string;
  error?: string;
}

/**
 * Converts stroops (10^-7 XLM) to a human-readable decimal XLM number.
 */
export function stroopsToXlm(stroops: bigint): number {
  return Number(stroops) / 10_000_000;
}

/**
 * Decodes a raw base64 voucher wire string and gates on version byte === 1.
 * Returns a structured result with decoded fields or error information.
 */
export function parseAndGateVoucher(rawWirePayload: string): DecodedVoucherResult {
  if (!rawWirePayload || typeof rawWirePayload !== "string") {
    return {
      valid: false,
      rawPayload: rawWirePayload || "",
      error: "Voucher wire payload is required and cannot be empty.",
    };
  }

  const trimmed = rawWirePayload.trim();
  if (trimmed.length === 0) {
    return {
      valid: false,
      rawPayload: "",
      error: "Voucher wire payload is empty.",
    };
  }

  try {
    const voucher = decodeVoucher(trimmed);

    // Gate on version byte explicitly (VOUCHER_SPEC requires version === 1)
    if (voucher.version !== 1) {
      return {
        valid: false,
        rawPayload: trimmed,
        error: `Unsupported voucher version: ${voucher.version}. Only version 1 is supported.`,
      };
    }

    return {
      valid: true,
      voucher,
      rawPayload: trimmed,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      rawPayload: trimmed,
      error: `Failed to decode voucher payload: ${msg}`,
    };
  }
}
