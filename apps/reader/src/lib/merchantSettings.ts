export const MERCHANT_SETTINGS_STORAGE_KEY = "kerfvault_merchant_settings";

export const STROOPS_PER_UNIT = 10_000_000n;

export interface MerchantSettings {
  maxOfflineVoucherAmountXlm: number;
  maxTotalOfflineExposureXlm: number;
  requirePayeeMatch: boolean;
}

export const DEFAULT_MERCHANT_SETTINGS: MerchantSettings = {
  maxOfflineVoucherAmountXlm: 50,
  maxTotalOfflineExposureXlm: 500,
  requirePayeeMatch: true,
};

export function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function validateMerchantSettings(
  input: Partial<MerchantSettings>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (input.maxOfflineVoucherAmountXlm !== undefined) {
    if (
      typeof input.maxOfflineVoucherAmountXlm !== "number" ||
      !Number.isFinite(input.maxOfflineVoucherAmountXlm) ||
      input.maxOfflineVoucherAmountXlm <= 0
    ) {
      errors.push("Maximum offline voucher amount must be a positive number.");
    }
  }

  if (input.maxTotalOfflineExposureXlm !== undefined) {
    if (
      typeof input.maxTotalOfflineExposureXlm !== "number" ||
      !Number.isFinite(input.maxTotalOfflineExposureXlm) ||
      input.maxTotalOfflineExposureXlm <= 0
    ) {
      errors.push("Maximum total offline exposure must be a positive number.");
    }
  }

  const voucherAmount =
    input.maxOfflineVoucherAmountXlm ?? DEFAULT_MERCHANT_SETTINGS.maxOfflineVoucherAmountXlm;
  const totalExposure =
    input.maxTotalOfflineExposureXlm ?? DEFAULT_MERCHANT_SETTINGS.maxTotalOfflineExposureXlm;

  if (totalExposure < voucherAmount) {
    errors.push(
      `Maximum total exposure (${totalExposure}) cannot be less than single voucher cap (${voucherAmount}).`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Retrieves merchant risk and offline voucher settings from storage.
 */
export function getMerchantSettings(
  storage: Storage | null = getStorage()
): MerchantSettings {
  if (!storage) return { ...DEFAULT_MERCHANT_SETTINGS };
  const raw = storage.getItem(MERCHANT_SETTINGS_STORAGE_KEY);
  if (!raw) return { ...DEFAULT_MERCHANT_SETTINGS };

  try {
    const parsed = JSON.parse(raw);
    return {
      maxOfflineVoucherAmountXlm:
        typeof parsed.maxOfflineVoucherAmountXlm === "number" &&
        parsed.maxOfflineVoucherAmountXlm > 0
          ? parsed.maxOfflineVoucherAmountXlm
          : DEFAULT_MERCHANT_SETTINGS.maxOfflineVoucherAmountXlm,
      maxTotalOfflineExposureXlm:
        typeof parsed.maxTotalOfflineExposureXlm === "number" &&
        parsed.maxTotalOfflineExposureXlm > 0
          ? parsed.maxTotalOfflineExposureXlm
          : DEFAULT_MERCHANT_SETTINGS.maxTotalOfflineExposureXlm,
      requirePayeeMatch:
        typeof parsed.requirePayeeMatch === "boolean"
          ? parsed.requirePayeeMatch
          : DEFAULT_MERCHANT_SETTINGS.requirePayeeMatch,
    };
  } catch {
    return { ...DEFAULT_MERCHANT_SETTINGS };
  }
}

/**
 * Saves updated merchant settings to storage after validation.
 */
export function saveMerchantSettings(
  updates: Partial<MerchantSettings>,
  storage: Storage | null = getStorage()
): MerchantSettings {
  const validation = validateMerchantSettings(updates);
  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const current = getMerchantSettings(storage);
  const updated: MerchantSettings = {
    ...current,
    ...updates,
  };

  if (storage) {
    storage.setItem(MERCHANT_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
  }

  return updated;
}

/**
 * Resets merchant settings to factory defaults.
 */
export function resetMerchantSettings(
  storage: Storage | null = getStorage()
): MerchantSettings {
  if (storage) {
    storage.removeItem(MERCHANT_SETTINGS_STORAGE_KEY);
  }
  return { ...DEFAULT_MERCHANT_SETTINGS };
}

/**
 * Converts maximum offline voucher amount to stroops (bigint) for validation against on-chain vouchers.
 */
export function getMaxOfflineVoucherStroops(settings: MerchantSettings): bigint {
  return BigInt(Math.round(settings.maxOfflineVoucherAmountXlm * 10_000_000));
}

/**
 * Converts maximum total offline exposure to stroops (bigint).
 */
export function getMaxTotalOfflineExposureStroops(settings: MerchantSettings): bigint {
  return BigInt(Math.round(settings.maxTotalOfflineExposureXlm * 10_000_000));
}

