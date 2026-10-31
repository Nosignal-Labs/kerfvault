import type { OfflineVoucher } from "./encode.js";

export interface VoucherVerifyOptions {
  currentTimestamp?: bigint;
  merchantAddress?: string;
  maxCapLimit?: bigint;
}

export interface VoucherVerifyResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verifies an offline payment voucher:
 * 1. Cryptographic Ed25519 signature verification against voucherKey
 * 2. Expiration check against acceptUntil timestamp
 * 3. Amount and cap bounds checks
 * Reference: docs/VOUCHER_SPEC.md & docs/THREAT_MODEL.md
 */
export async function verifyVoucher(
  _voucher: OfflineVoucher,
  _options?: VoucherVerifyOptions
): Promise<VoucherVerifyResult> {
  // TODO: Validate ed25519 signature over canonical message, check acceptUntil > now, and check amount <= cap
  throw new Error("TODO: verifyVoucher verification logic not yet implemented");
}

