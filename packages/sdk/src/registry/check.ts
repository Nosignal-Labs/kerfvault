import type { OfflineVoucher } from "../voucher/encode.js";
import type { RegistrySnapshot } from "./types.js";

export interface RegistryCheckResult {
  valid: boolean;
  reason?: string;
}

/**
 * Checks an offline voucher against the locally synced registry snapshot:
 * 1. Checks that the book exists and is funded
 * 2. Matches voucherKey registered on-chain
 * 3. Verifies note state is Open and has not been redeemed on-chain
 */
export function checkAgainstRegistry(
  _voucher: OfflineVoucher,
  _snapshot: RegistrySnapshot
): RegistryCheckResult {
  // TODO: Check voucher book exists in snapshot, verify voucherKey matches, verify note is Open and amount <= denomination
  throw new Error("TODO: checkAgainstRegistry logic not yet implemented");
}

