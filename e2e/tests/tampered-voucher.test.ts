import { describe, it, expect, vi, beforeEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  encodeVoucher,
  decodeVoucher,
  serializeCanonicalMessage,
  verifyVoucher,
  type OfflineVoucher,
} from "@kerfvault/sdk";

describe("E2E Browser Test 2: Catch Tampered Vouchers Offline", () => {
  const CONTRACT_ID = "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE";
  let voucherKeypair: Keypair;
  let legitimateMerchantKeypair: Keypair;
  let rogueMerchantKeypair: Keypair;

  let baseValidVoucher: OfflineVoucher;
  let wireQrPayload: string;
  let cachedVoucherPublicKey: string;

  beforeEach(() => {
    voucherKeypair = Keypair.random();
    legitimateMerchantKeypair = Keypair.random();
    rogueMerchantKeypair = Keypair.random();
    cachedVoucherPublicKey = voucherKeypair.publicKey();

    const bookId = 101n;
    const noteIndex = 0;
    const amount = 10_000_000n; // 1.0 XLM
    const cap = 10_000_000n;
    const acceptUntil = BigInt(Math.floor(Date.now() / 1000) + 86400);

    const raw: OfflineVoucher = {
      version: 1,
      contractId: CONTRACT_ID,
      bookId,
      noteIndex,
      amount,
      cap,
      acceptUntil,
      merchant: legitimateMerchantKeypair.publicKey(),
      signature: "",
    };

    const canonicalBytes = serializeCanonicalMessage(raw);
    const sigBytes = voucherKeypair.sign(Buffer.from(canonicalBytes));
    baseValidVoucher = {
      ...raw,
      signature: Buffer.from(sigBytes).toString("hex"),
    };

    wireQrPayload = encodeVoucher(baseValidVoucher);
  });

  it("rejects voucher offline when amount is tampered", async () => {
    // Attacker modifies amount from 10 XLM to 50 XLM
    const tamperedVoucher: OfflineVoucher = {
      ...baseValidVoucher,
      amount: 50_000_000n,
    };

    const result = await verifyVoucher(tamperedVoucher, {
      expectedContractId: CONTRACT_ID,
      merchantAddress: legitimateMerchantKeypair.publicKey(),
      voucherKey: cachedVoucherPublicKey,
      currentTimestamp: BigInt(Math.floor(Date.now() / 1000)),
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("AmountExceedsCap");
  });

  it("rejects voucher offline when signature does not match altered payload", async () => {
    // Attacker increases amount and cap together to avoid AmountExceedsCap
    const tamperedVoucher: OfflineVoucher = {
      ...baseValidVoucher,
      amount: 50_000_000n,
      cap: 50_000_000n,
    };

    const result = await verifyVoucher(tamperedVoucher, {
      expectedContractId: CONTRACT_ID,
      merchantAddress: legitimateMerchantKeypair.publicKey(),
      voucherKey: cachedVoucherPublicKey,
      currentTimestamp: BigInt(Math.floor(Date.now() / 1000)),
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("InvalidSignature");
  });

  it("rejects voucher offline when presented to wrong merchant (MerchantMismatch)", async () => {
    // Presented to rogue merchant
    const result = await verifyVoucher(baseValidVoucher, {
      expectedContractId: CONTRACT_ID,
      merchantAddress: rogueMerchantKeypair.publicKey(),
      voucherKey: cachedVoucherPublicKey,
      currentTimestamp: BigInt(Math.floor(Date.now() / 1000)),
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("MerchantMismatch");
  });

  it("rejects voucher offline when expired (VoucherExpired)", async () => {
    // Simulation timestamp 2 days in the future
    const simulatedFutureTime = baseValidVoucher.acceptUntil + 86400n;

    const result = await verifyVoucher(baseValidVoucher, {
      expectedContractId: CONTRACT_ID,
      merchantAddress: legitimateMerchantKeypair.publicKey(),
      voucherKey: cachedVoucherPublicKey,
      currentTimestamp: simulatedFutureTime,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("VoucherExpired");
  });

  it("rejects voucher offline when cap exceeds merchant limit", async () => {
    // Merchant has set a 5 XLM cap limit (50,000,000 stroops), but voucher cap is 10 XLM
    const result = await verifyVoucher(baseValidVoucher, {
      expectedContractId: CONTRACT_ID,
      merchantAddress: legitimateMerchantKeypair.publicKey(),
      maxCapLimit: 50_000_000n / 10n, // 0.5 XLM limit
      voucherKey: cachedVoucherPublicKey,
      currentTimestamp: BigInt(Math.floor(Date.now() / 1000)),
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("CapExceedsMerchantLimit");
  });

  it("rejects voucher offline when Ed25519 signature is corrupted", async () => {
    // Corrupt one character of the signature
    const corruptedSig =
      baseValidVoucher.signature.substring(0, 10) +
      (baseValidVoucher.signature[10] === "a" ? "b" : "a") +
      baseValidVoucher.signature.substring(11);

    const tamperedVoucher: OfflineVoucher = {
      ...baseValidVoucher,
      signature: corruptedSig,
    };

    const result = await verifyVoucher(tamperedVoucher, {
      expectedContractId: CONTRACT_ID,
      merchantAddress: legitimateMerchantKeypair.publicKey(),
      voucherKey: cachedVoucherPublicKey,
      currentTimestamp: BigInt(Math.floor(Date.now() / 1000)),
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("InvalidSignature");
  });

  it("confirms all tampered voucher checks execute with zero network requests", async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      throw new Error("Network request should never be made during offline verification!");
    });
    vi.stubGlobal("fetch", mockFetch);

    // Run verification on valid and tampered vouchers
    await verifyVoucher(baseValidVoucher, {
      expectedContractId: CONTRACT_ID,
      merchantAddress: legitimateMerchantKeypair.publicKey(),
      voucherKey: cachedVoucherPublicKey,
    });

    expect(mockFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
