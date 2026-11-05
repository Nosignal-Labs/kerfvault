import { describe, it, expect } from "vitest";
import {
  DEFAULT_TESTNET_TOKEN,
  DENOMINATION_PRESETS,
  DEADLINE_PRESETS,
  xlmToStroops,
  calculateDeadlineTimestamp,
  validateBookConfig,
} from "./lib/bookConfig";

describe("Shopper Book Configuration & Denominations", () => {
  it("defines standard testnet default token and presets", () => {
    expect(DEFAULT_TESTNET_TOKEN).toMatch(/^C[A-Z0-9]{55}$/);
    expect(DENOMINATION_PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(DEADLINE_PRESETS.length).toBeGreaterThanOrEqual(4);
  });

  describe("xlmToStroops", () => {
    it("converts integer XLM to stroops (10^7)", () => {
      expect(xlmToStroops(1)).toBe(10_000_000n);
      expect(xlmToStroops(5)).toBe(50_000_000n);
      expect(xlmToStroops(100)).toBe(1_000_000_000n);
    });

    it("converts fractional XLM accurately without floating-point distortion", () => {
      expect(xlmToStroops(0.5)).toBe(5_000_000n);
      expect(xlmToStroops(10.25)).toBe(102_500_000n);
      expect(xlmToStroops(0.0000001)).toBe(1n);
    });

    it("throws for non-positive or invalid amounts", () => {
      expect(() => xlmToStroops(0)).toThrow(/Invalid XLM/i);
      expect(() => xlmToStroops(-5)).toThrow(/Invalid XLM/i);
      expect(() => xlmToStroops(NaN)).toThrow(/Invalid XLM/i);
    });
  });

  describe("calculateDeadlineTimestamp", () => {
    it("adds the correct number of seconds based on days", () => {
      const fixedBase = new Date("2026-11-05T00:00:00Z");
      const baseSecs = Math.floor(fixedBase.getTime() / 1000);

      const oneDay = calculateDeadlineTimestamp(1, fixedBase);
      expect(oneDay).toBe(baseSecs + 86400);

      const sevenDays = calculateDeadlineTimestamp(7, fixedBase);
      expect(sevenDays).toBe(baseSecs + 86400 * 7);
    });
  });

  describe("validateBookConfig", () => {
    const validConfig = {
      tokenAddress: DEFAULT_TESTNET_TOKEN,
      denominations: [5, 10, 20, 50],
      deadlineDays: 7,
      walletBalance: "100.0000000",
    };

    it("passes for valid configuration and sufficient balance", () => {
      const res = validateBookConfig(validConfig);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("fails when token address is invalid", () => {
      const res = validateBookConfig({
        ...validConfig,
        tokenAddress: "invalid-token",
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("C-address"))).toBe(true);
    });

    it("fails when denominations list is empty", () => {
      const res = validateBookConfig({
        ...validConfig,
        denominations: [],
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("At least one note"))).toBe(true);
    });

    it("fails when any denomination is zero or negative", () => {
      const res = validateBookConfig({
        ...validConfig,
        denominations: [10, -5, 20],
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("positive number"))).toBe(true);
    });

    it("fails when deadline days is less than 1 or exceeds 365", () => {
      const tooLow = validateBookConfig({
        ...validConfig,
        deadlineDays: 0,
      });
      expect(tooLow.valid).toBe(false);
      expect(tooLow.errors.some((e) => e.includes("at least 1 day"))).toBe(true);

      const tooHigh = validateBookConfig({
        ...validConfig,
        deadlineDays: 400,
      });
      expect(tooHigh.valid).toBe(false);
      expect(tooHigh.errors.some((e) => e.includes("cannot exceed 365 days"))).toBe(true);
    });

    it("fails when wallet balance is lower than total required XLM", () => {
      // Total required = 5 + 10 + 20 + 50 = 85 XLM
      const res = validateBookConfig({
        ...validConfig,
        walletBalance: "50.0000000",
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("Insufficient wallet balance"))).toBe(true);
    });
  });
});

