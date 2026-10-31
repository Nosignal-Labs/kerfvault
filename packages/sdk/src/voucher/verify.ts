import { Keypair, StrKey } from "@stellar/stellar-sdk";
import {
  type OfflineVoucher,
  hexToBytes,
  serializeCanonicalMessage,
} from "./encode.js";

export interface VoucherVerifyOptions {
  currentTimestamp?: bigint;
  expectedContractId?: string;
  merchantAddress?: string;
  maxCapLimit?: bigint;
  voucherKey?: string;
}

export interface VoucherVerifyResult {
  valid: boolean;
  reason?: string;
}

/**
 * Pure offline function to verify a payment voucher:
 * 1. Checks bounds and protocol rules (version, amount <= cap, cap <= maxCapLimit)
 * 2. Checks expiry against currentTimestamp <= acceptUntil
 * 3. Checks merchant and contract ID binding
 * 4. Cryptographic Ed25519 signature verification against voucherKey
 *
 * Guaranteed to make ZERO network calls.
 * Reference: docs/VOUCHER_SPEC.md & docs/THREAT_MODEL.md
 */
export async function verifyVoucher(
  voucher: OfflineVoucher,
  options?: VoucherVerifyOptions
): Promise<VoucherVerifyResult> {
  // 1. Version check
  if (voucher.version !== 1) {
    return { valid: false, reason: "InvalidVersion" };
  }

  // 2. Amount and cap bounds checks
  if (voucher.amount > voucher.cap) {
    return { valid: false, reason: "AmountExceedsCap" };
  }

  if (voucher.amount <= 0n) {
    return { valid: false, reason: "InvalidAmount" };
  }

  if (options?.maxCapLimit !== undefined && voucher.cap > options.maxCapLimit) {
    return { valid: false, reason: "CapExceedsMerchantLimit" };
  }

  // 3. Expiry check against currentTimestamp
  const now = options?.currentTimestamp ?? BigInt(Math.floor(Date.now() / 1000));
  if (now > voucher.acceptUntil) {
    return { valid: false, reason: "VoucherExpired" };
  }

  // 4. Contract ID binding
  if (
    options?.expectedContractId &&
    voucher.contractId !== options.expectedContractId
  ) {
    return { valid: false, reason: "ContractMismatch" };
  }

  // 5. Merchant address redirect protection
  if (
    options?.merchantAddress &&
    voucher.merchant !== options.merchantAddress
  ) {
    return { valid: false, reason: "MerchantMismatch" };
  }

  // 6. Signature verification
  const keyHex = options?.voucherKey ?? voucher.voucherKey;
  if (!keyHex) {
    return { valid: false, reason: "MissingVoucherKey" };
  }

  try {
    let strKey: string;
    if (keyHex.startsWith("G") && keyHex.length === 56) {
      strKey = keyHex;
    } else {
      const rawPub = hexToBytes(keyHex);
      if (rawPub.length !== 32) {
        return { valid: false, reason: "InvalidKeyLength" };
      }
      strKey = StrKey.encodeEd25519PublicKey(Buffer.from(rawPub));
    }

    const keypair = Keypair.fromPublicKey(strKey);
    const msgBytes = serializeCanonicalMessage(voucher);
    const sigBytes = hexToBytes(voucher.signature);
    if (sigBytes.length !== 64) {
      return { valid: false, reason: "InvalidSignatureLength" };
    }

    const isValid = keypair.verify(Buffer.from(msgBytes), Buffer.from(sigBytes));
    if (!isValid) {
      return { valid: false, reason: "InvalidSignature" };
    }

    return { valid: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { valid: false, reason: `VerificationError: ${errorMsg}` };
  }
}
