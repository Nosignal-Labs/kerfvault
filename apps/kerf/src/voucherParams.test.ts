import { describe, it, expect } from "vitest";
import {
  DEMO_MERCHANT_ADDRESS,
  EXPIRY_OPTIONS,
  validateVoucherParams,
  type VoucherInputParams,
} from "./lib/voucherParams";

describe("Voucher Parameter Validation and Options", () => {
  const futureDeadline = Math.floor(Date.now() / 1000) + 86400 * 7;
  const validAcceptUntil = Math.floor(Date.now() / 1000) + 3600;

  const validParams: VoucherInputParams = {
    bookId: "1",
    noteIndex: 0,
    merchant: DEMO_MERCHANT_ADDRESS,
    amountXlm: 10,
    capXlm: 10,
    acceptUntil: validAcceptUntil,
  };

  it("passes for valid voucher parameters", () => {
    const res = validateVoucherParams(validParams, futureDeadline);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it("fails if bookId is missing", () => {
    const res = validateVoucherParams({ ...validParams, bookId: "" }, futureDeadline);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("Book selection"))).toBe(true);
  });

  it("fails if noteIndex is negative", () => {
    const res = validateVoucherParams({ ...validParams, noteIndex: -1 }, futureDeadline);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("Valid note index"))).toBe(true);
  });

  it("fails if merchant address is invalid", () => {
    const res = validateVoucherParams(
      { ...validParams, merchant: "NOT_A_VALID_STELLAR_G_ADDRESS" },
      futureDeadline
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("56-character Stellar G-address"))).toBe(true);
  });

  it("fails if amount is zero or negative", () => {
    const res = validateVoucherParams({ ...validParams, amountXlm: 0 }, futureDeadline);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("positive number"))).toBe(true);
  });

  it("fails if cap is strictly less than amount", () => {
    const res = validateVoucherParams(
      { ...validParams, amountXlm: 20, capXlm: 15 },
      futureDeadline
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("cannot be less than voucher amount"))).toBe(true);
  });

  it("fails if acceptUntil is in the past", () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 100;
    const res = validateVoucherParams(
      { ...validParams, acceptUntil: pastTimestamp },
      futureDeadline
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("in the future"))).toBe(true);
  });

  it("fails if acceptUntil exceeds book deadline", () => {
    const tooFarFuture = futureDeadline + 1000;
    const res = validateVoucherParams(
      { ...validParams, acceptUntil: tooFarFuture },
      futureDeadline
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("cannot exceed book redeem deadline"))).toBe(true);
  });

  describe("EXPIRY_OPTIONS", () => {
    it("provides standard expiry durations", () => {
      expect(EXPIRY_OPTIONS).toHaveLength(4);
      const option1h = EXPIRY_OPTIONS.find((o) => o.id === "1h");
      expect(option1h?.secondsFromNow()).toBe(3600);

      const option24h = EXPIRY_OPTIONS.find((o) => o.id === "24h");
      expect(option24h?.secondsFromNow()).toBe(86400);

      const optionMax = EXPIRY_OPTIONS.find((o) => o.id === "max");
      const bookDeadline = Math.floor(Date.now() / 1000) + 12345;
      expect(optionMax?.secondsFromNow(bookDeadline)).toBe(12345);
    });
  });
});

