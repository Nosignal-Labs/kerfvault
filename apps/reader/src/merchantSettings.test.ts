import { describe, it, expect, beforeEach } from "vitest";
import {
  getMerchantSettings,
  saveMerchantSettings,
  resetMerchantSettings,
  validateMerchantSettings,
  getMaxOfflineVoucherStroops,
  getMaxTotalOfflineExposureStroops,
  DEFAULT_MERCHANT_SETTINGS,
} from "./lib/merchantSettings";

class MemoryStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("Merchant Terminal Risk Settings & Limits", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("returns default settings when storage is empty", () => {
    const settings = getMerchantSettings(storage);
    expect(settings).toEqual(DEFAULT_MERCHANT_SETTINGS);
    expect(settings.maxOfflineVoucherAmountXlm).toBe(50);
    expect(settings.maxTotalOfflineExposureXlm).toBe(500);
  });

  it("saves and retrieves updated merchant limits", () => {
    const updated = saveMerchantSettings(
      {
        maxOfflineVoucherAmountXlm: 25,
        maxTotalOfflineExposureXlm: 250,
      },
      storage
    );

    expect(updated.maxOfflineVoucherAmountXlm).toBe(25);
    expect(updated.maxTotalOfflineExposureXlm).toBe(250);

    const loaded = getMerchantSettings(storage);
    expect(loaded.maxOfflineVoucherAmountXlm).toBe(25);
    expect(loaded.maxTotalOfflineExposureXlm).toBe(250);
  });

  it("rejects non-positive limits", () => {
    expect(() =>
      saveMerchantSettings({ maxOfflineVoucherAmountXlm: 0 }, storage)
    ).toThrow(/positive number/i);

    expect(() =>
      saveMerchantSettings({ maxOfflineVoucherAmountXlm: -10 }, storage)
    ).toThrow(/positive number/i);
  });

  it("rejects total exposure less than voucher amount", () => {
    const validation = validateMerchantSettings({
      maxOfflineVoucherAmountXlm: 100,
      maxTotalOfflineExposureXlm: 50,
    });
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toMatch(/cannot be less/i);
  });

  it("resets merchant limits to factory defaults", () => {
    saveMerchantSettings(
      { maxOfflineVoucherAmountXlm: 75, maxTotalOfflineExposureXlm: 750 },
      storage
    );

    const reset = resetMerchantSettings(storage);
    expect(reset).toEqual(DEFAULT_MERCHANT_SETTINGS);

    const reloaded = getMerchantSettings(storage);
    expect(reloaded).toEqual(DEFAULT_MERCHANT_SETTINGS);
  });

  it("calculates exact stroop values for on-chain voucher validation", () => {
    const settings = {
      maxOfflineVoucherAmountXlm: 20,
      maxTotalOfflineExposureXlm: 200,
      requirePayeeMatch: true,
    };

    expect(getMaxOfflineVoucherStroops(settings)).toBe(200_000_000n);
    expect(getMaxTotalOfflineExposureStroops(settings)).toBe(2_000_000_000n);
  });
});

