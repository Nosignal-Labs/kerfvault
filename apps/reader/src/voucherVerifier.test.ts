import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Keypair } from "@stellar/stellar-sdk";
import { signVoucher, type RegistrySnapshot } from "@kerfvault/sdk";
import { parseAndGateVoucher } from "./lib/voucherDecoder";
import {
  verifyVoucherSignatureAgainstRegistry,
  confirmMerchantPayee,
  checkVoucherExpiry,
  checkNoteOpenStatus,
  checkMerchantCapLimit,
} from "./lib/voucherVerifier";
import { DecodedVoucherView } from "./components/DecodedVoucherView";

describe("Voucher Signature Verification Against Registry Voucher Key", () => {
  const contractId = "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE";
  const merchantAddress = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVWAC";

  // Generate a realistic Ed25519 voucher signing keypair
  const signerKeypair = Keypair.random();
  const voucherSecretBytes = new Uint8Array(signerKeypair.rawSecretKey());
  const voucherPublicKey = signerKeypair.publicKey();

  const mockSnapshot: RegistrySnapshot = {
    version: 1,
    contractId,
    ledgerSequence: 123456,
    snapshotTimestamp: Math.floor(Date.now() / 1000),
    books: {
      "100": {
        bookId: "100",
        owner: "GBTESTOWNER...",
        token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        voucherKey: voucherPublicKey,
        redeemDeadline: "1893456000",
        freeBalance: "0",
        notes: [
          { index: 0, denomination: "10000000", status: "Open" },
          { index: 1, denomination: "20000000", status: "Open" },
        ],
      },
    },
  };

  it("fails verification if registry snapshot is null", async () => {
    const voucher = await signVoucher({
      contractId,
      bookId: 100n,
      noteIndex: 1,
      merchant: merchantAddress,
      amount: 20_000_000n,
      cap: 50_000_000n,
      acceptUntil: 1800000000n,
      voucherSecretKey: voucherSecretBytes,
    });

    const res = await verifyVoucherSignatureAgainstRegistry(voucher, null);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("NoSnapshot");
    expect(res.error).toContain("missing");
  });

  it("fails verification if book does not exist in registry snapshot", async () => {
    const voucher = await signVoucher({
      contractId,
      bookId: 999n, // Non-existent book
      noteIndex: 0,
      merchant: merchantAddress,
      amount: 10_000_000n,
      cap: 20_000_000n,
      acceptUntil: 1800000000n,
      voucherSecretKey: voucherSecretBytes,
    });

    const res = await verifyVoucherSignatureAgainstRegistry(voucher, mockSnapshot);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("BookNotFound");
    expect(res.bookId).toBe("999");
    expect(res.error).toContain("not registered");
  });

  it("fails verification if book has missing voucherKey in registry snapshot", async () => {
    const brokenSnapshot: RegistrySnapshot = {
      ...mockSnapshot,
      books: {
        "100": {
          ...mockSnapshot.books["100"],
          voucherKey: "",
        },
      },
    };

    const voucher = await signVoucher({
      contractId,
      bookId: 100n,
      noteIndex: 1,
      merchant: merchantAddress,
      amount: 20_000_000n,
      cap: 50_000_000n,
      acceptUntil: 1800000000n,
      voucherSecretKey: voucherSecretBytes,
    });

    const res = await verifyVoucherSignatureAgainstRegistry(voucher, brokenSnapshot);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("MissingVoucherKey");
  });

  it("successfully verifies voucher signed with registry's registered voucherKey", async () => {
    const voucher = await signVoucher({
      contractId,
      bookId: 100n,
      noteIndex: 1,
      merchant: merchantAddress,
      amount: 20_000_000n,
      cap: 50_000_000n,
      acceptUntil: 1800000000n,
      voucherSecretKey: voucherSecretBytes,
    });

    const res = await verifyVoucherSignatureAgainstRegistry(voucher, mockSnapshot);
    expect(res.valid).toBe(true);
    expect(res.voucherKey).toBe(voucherPublicKey);
    expect(res.bookId).toBe("100");
  });

  it("fails verification when signed with a different key than registry voucherKey", async () => {
    // Generate an attacker keypair not registered in the book
    const attackerKeypair = Keypair.random();
    const attackerSecretBytes = new Uint8Array(attackerKeypair.rawSecretKey());

    const forgedVoucher = await signVoucher({
      contractId,
      bookId: 100n,
      noteIndex: 1,
      merchant: merchantAddress,
      amount: 20_000_000n,
      cap: 50_000_000n,
      acceptUntil: 1800000000n,
      voucherSecretKey: attackerSecretBytes,
    });

    const res = await verifyVoucherSignatureAgainstRegistry(forgedVoucher, mockSnapshot);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("InvalidSignature");
    expect(res.error).toContain("Cryptographic signature mismatch");
  });

  it("fails verification if the signature bytes are tampered", async () => {
    const voucher = await signVoucher({
      contractId,
      bookId: 100n,
      noteIndex: 1,
      merchant: merchantAddress,
      amount: 20_000_000n,
      cap: 50_000_000n,
      acceptUntil: 1800000000n,
      voucherSecretKey: voucherSecretBytes,
    });

    // Flip signature hex characters
    const tamperedSig = voucher.signature.replace(/^../, "ff");
    const tamperedVoucher = { ...voucher, signature: tamperedSig };

    const res = await verifyVoucherSignatureAgainstRegistry(tamperedVoucher, mockSnapshot);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("InvalidSignature");
  });

  describe("confirmMerchantPayee", () => {
    it("rejects when terminal merchant address is null", () => {
      const res = confirmMerchantPayee(merchantAddress, null);
      expect(res.matches).toBe(false);
      expect(res.error).toContain("not configured");
    });

    it("rejects when voucher payee does not match terminal merchant address", () => {
      const otherMerchant = "GBEXAMPLEOTHERMERCHANT1234567890...";
      const res = confirmMerchantPayee(otherMerchant, merchantAddress);
      expect(res.matches).toBe(false);
      expect(res.error).toContain("Merchant payee mismatch");
    });

    it("confirms when voucher payee exactly matches terminal merchant address", () => {
      const res = confirmMerchantPayee(merchantAddress, merchantAddress);
      expect(res.matches).toBe(true);
      expect(res.error).toBeUndefined();
    });
  });

  describe("Payee Confirmation in verifyVoucherSignatureAgainstRegistry", () => {
    it("confirms payee and returns payeeMatched: true when address matches", async () => {
      const voucher = await signVoucher({
        contractId,
        bookId: 100n,
        noteIndex: 1,
        merchant: merchantAddress,
        amount: 20_000_000n,
        cap: 50_000_000n,
        acceptUntil: 1800000000n,
        voucherSecretKey: voucherSecretBytes,
      });

      const res = await verifyVoucherSignatureAgainstRegistry(voucher, mockSnapshot, {
        merchantAddress,
      });
      expect(res.valid).toBe(true);
      expect(res.payeeMatched).toBe(true);
    });

    it("rejects voucher with MerchantMismatch when terminal address differs from voucher payee", async () => {
      const otherMerchant = "GBDIFFERENTMERCHANTADDR777777777...";
      const voucher = await signVoucher({
        contractId,
        bookId: 100n,
        noteIndex: 1,
        merchant: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVWAC",
        amount: 20_000_000n,
        cap: 50_000_000n,
        acceptUntil: 1800000000n,
        voucherSecretKey: voucherSecretBytes,
      });

      const res = await verifyVoucherSignatureAgainstRegistry(voucher, mockSnapshot, {
        merchantAddress: otherMerchant,
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toBe("MerchantMismatch");
      expect(res.error).toContain("Merchant payee mismatch");
    });
  });

  describe("checkVoucherExpiry", () => {
    it("returns expired: false when current time is before acceptUntil", () => {
      const res = checkVoucherExpiry(1800000000n, 1700000000n);
      expect(res.expired).toBe(false);
      expect(res.error).toBeUndefined();
    });

    it("returns expired: true when current time is after acceptUntil", () => {
      const res = checkVoucherExpiry(1700000000n, 1800000000n);
      expect(res.expired).toBe(true);
      expect(res.error).toContain("expired");
    });
  });

  describe("checkNoteOpenStatus", () => {
    const sampleNotes = [
      { index: 0, denomination: "10000000", status: "Open" as const },
      { index: 1, denomination: "20000000", status: "Redeemed" as const },
    ];

    it("returns open: false when notes list is missing", () => {
      const res = checkNoteOpenStatus(undefined, 0);
      expect(res.open).toBe(false);
      expect(res.error).toContain("No notes registered");
    });

    it("returns open: false when note index is not found in book", () => {
      const res = checkNoteOpenStatus(sampleNotes, 99);
      expect(res.open).toBe(false);
      expect(res.error).toContain("does not exist");
    });

    it("returns open: false and status 'Redeemed' when note is already redeemed", () => {
      const res = checkNoteOpenStatus(sampleNotes, 1);
      expect(res.open).toBe(false);
      expect(res.status).toBe("Redeemed");
      expect(res.error).toContain("no longer open");
      expect(res.error).toContain("redeemed");
    });

    it("returns open: true when note is Open", () => {
      const res = checkNoteOpenStatus(sampleNotes, 0);
      expect(res.open).toBe(true);
      expect(res.status).toBe("Open");
    });
  });

  describe("Reject expired vouchers and notes that are no longer open", () => {
    it("rejects an expired voucher with VoucherExpired reason", async () => {
      const voucher = await signVoucher({
        contractId,
        bookId: 100n,
        noteIndex: 0,
        merchant: merchantAddress,
        amount: 10_000_000n,
        cap: 20_000_000n,
        acceptUntil: 1600000000n, // Expired timestamp
        voucherSecretKey: voucherSecretBytes,
      });

      const res = await verifyVoucherSignatureAgainstRegistry(voucher, mockSnapshot, {
        currentTimestamp: 1700000000n,
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toBe("VoucherExpired");
      expect(res.error).toContain("expired");
    });

    it("rejects a voucher for a book whose redeemDeadline has passed", async () => {
      const expiredBookSnapshot: RegistrySnapshot = {
        ...mockSnapshot,
        books: {
          "100": {
            ...mockSnapshot.books["100"],
            redeemDeadline: "1500000000", // Expired book deadline
          },
        },
      };

      const voucher = await signVoucher({
        contractId,
        bookId: 100n,
        noteIndex: 0,
        merchant: merchantAddress,
        amount: 10_000_000n,
        cap: 20_000_000n,
        acceptUntil: 1800000000n,
        voucherSecretKey: voucherSecretBytes,
      });

      const res = await verifyVoucherSignatureAgainstRegistry(voucher, expiredBookSnapshot, {
        currentTimestamp: 1600000000n,
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toBe("BookExpired");
      expect(res.error).toContain("expired");
    });

    it("rejects a voucher referencing a note that has already been Redeemed", async () => {
      const redeemedNoteSnapshot: RegistrySnapshot = {
        ...mockSnapshot,
        books: {
          "100": {
            ...mockSnapshot.books["100"],
            notes: [
              { index: 0, denomination: "10000000", status: "Open" },
              { index: 1, denomination: "20000000", status: "Redeemed" },
            ],
          },
        },
      };

      const voucher = await signVoucher({
        contractId,
        bookId: 100n,
        noteIndex: 1, // Note 1 is Redeemed!
        merchant: merchantAddress,
        amount: 20_000_000n,
        cap: 50_000_000n,
        acceptUntil: 1800000000n,
        voucherSecretKey: voucherSecretBytes,
      });

      const res = await verifyVoucherSignatureAgainstRegistry(voucher, redeemedNoteSnapshot, {
        merchantAddress,
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toBe("NoteNotOpen");
      expect(res.noteStatus).toBe("Redeemed");
      expect(res.noteIsOpen).toBe(false);
      expect(res.error).toContain("already been redeemed");
    });

    it("accepts a voucher referencing an Open note within expiry", async () => {
      const voucher = await signVoucher({
        contractId,
        bookId: 100n,
        noteIndex: 0, // Note 0 is Open!
        merchant: merchantAddress,
        amount: 10_000_000n,
        cap: 20_000_000n,
        acceptUntil: 1800000000n,
        voucherSecretKey: voucherSecretBytes,
      });

      const res = await verifyVoucherSignatureAgainstRegistry(voucher, mockSnapshot, {
        merchantAddress,
        currentTimestamp: 1700000000n,
      });
      expect(res.valid).toBe(true);
      expect(res.noteStatus).toBe("Open");
      expect(res.noteIsOpen).toBe(true);
      expect(res.payeeMatched).toBe(true);
    });
  });

  describe("checkMerchantCapLimit", () => {
    it("returns withinCap: true when amount <= cap and cap <= maxCapLimit", () => {
      const res = checkMerchantCapLimit(10_000_000n, 20_000_000n, 50_000_000n);
      expect(res.withinCap).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("returns withinCap: false when voucher amount exceeds its own cap", () => {
      const res = checkMerchantCapLimit(60_000_000n, 50_000_000n, 100_000_000n);
      expect(res.withinCap).toBe(false);
      expect(res.error).toContain("cannot exceed its cap");
    });

    it("returns withinCap: false when voucher amount is zero or negative", () => {
      const res = checkMerchantCapLimit(0n, 50_000_000n, 100_000_000n);
      expect(res.withinCap).toBe(false);
      expect(res.error).toContain("greater than zero");
    });

    it("returns withinCap: false when voucher cap exceeds merchant limit", () => {
      const res = checkMerchantCapLimit(20_000_000n, 100_000_000n, 50_000_000n);
      expect(res.withinCap).toBe(false);
      expect(res.error).toContain("exceeds merchant terminal limit");
    });
  });

  describe("Hold every voucher to the merchant's own cap", () => {
    it("rejects voucher when its cap exceeds the merchant terminal's configured cap limit", async () => {
      const voucher = await signVoucher({
        contractId,
        bookId: 100n,
        noteIndex: 0,
        merchant: merchantAddress,
        amount: 20_000_000n, // 2 XLM
        cap: 100_000_000n, // 10 XLM cap
        acceptUntil: 1800000000n,
        voucherSecretKey: voucherSecretBytes,
      });

      // Merchant configured limit of 5 XLM (50_000_000 stroops)
      const res = await verifyVoucherSignatureAgainstRegistry(voucher, mockSnapshot, {
        merchantAddress,
        maxCapLimit: 50_000_000n,
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toBe("CapExceedsMerchantLimit");
      expect(res.withinMerchantCap).toBe(false);
      expect(res.error).toContain("exceeds merchant terminal");
    });

    it("accepts voucher when its cap and amount are within merchant limit", async () => {
      const voucher = await signVoucher({
        contractId,
        bookId: 100n,
        noteIndex: 0,
        merchant: merchantAddress,
        amount: 20_000_000n, // 2 XLM
        cap: 40_000_000n, // 4 XLM cap
        acceptUntil: 1800000000n,
        voucherSecretKey: voucherSecretBytes,
      });

      // Merchant configured limit of 5 XLM (50_000_000 stroops)
      const res = await verifyVoucherSignatureAgainstRegistry(voucher, mockSnapshot, {
        merchantAddress,
        maxCapLimit: 50_000_000n,
      });

      expect(res.valid).toBe(true);
      expect(res.withinMerchantCap).toBe(true);
      expect(res.maxCapLimitXlm).toBe(5);
    });
  });

  describe("DecodedVoucherView with Signature Verification Display", () => {
    it("renders green verified banner when signature matches registry", async () => {
      const voucher = await signVoucher({
        contractId,
        bookId: 100n,
        noteIndex: 1,
        merchant: merchantAddress,
        amount: 20_000_000n,
        cap: 50_000_000n,
        acceptUntil: 1800000000n,
        voucherSecretKey: voucherSecretBytes,
      });

      const decodeRes = {
        valid: true,
        voucher,
        rawPayload: "dummy_wire_payload",
      };

      const sigRes = {
        valid: true,
        voucherKey: voucherPublicKey,
        bookId: "100",
      };

      const html = renderToString(
        React.createElement(DecodedVoucherView, {
          result: decodeRes,
          sigVerification: sigRes,
          onReset: vi.fn(),
        })
      );

      expect(html).toContain("Signature Verified");
      expect(html).toContain("SIGNATURE MATCH");
      expect(html).toContain(voucherPublicKey);
    });

    it("renders Payee Confirmed badge when payeeMatched: true", async () => {
      const voucher = await signVoucher({
        contractId,
        bookId: 100n,
        noteIndex: 1,
        merchant: merchantAddress,
        amount: 20_000_000n,
        cap: 50_000_000n,
        acceptUntil: 1800000000n,
        voucherSecretKey: voucherSecretBytes,
      });

      const decodeRes = {
        valid: true,
        voucher,
        rawPayload: "dummy_wire_payload",
      };

      const sigRes = {
        valid: true,
        voucherKey: voucherPublicKey,
        bookId: "100",
        payeeMatched: true,
      };

      const html = renderToString(
        React.createElement(DecodedVoucherView, {
          result: decodeRes,
          sigVerification: sigRes,
          onReset: vi.fn(),
        })
      );

      expect(html).toContain("Payee Confirmed");
    });

    it("renders Within Cap badge when withinMerchantCap: true", async () => {
      const voucher = await signVoucher({
        contractId,
        bookId: 100n,
        noteIndex: 1,
        merchant: merchantAddress,
        amount: 20_000_000n,
        cap: 50_000_000n,
        acceptUntil: 1800000000n,
        voucherSecretKey: voucherSecretBytes,
      });

      const decodeRes = {
        valid: true,
        voucher,
        rawPayload: "dummy_wire_payload",
      };

      const sigRes = {
        valid: true,
        voucherKey: voucherPublicKey,
        bookId: "100",
        withinMerchantCap: true,
      };

      const html = renderToString(
        React.createElement(DecodedVoucherView, {
          result: decodeRes,
          sigVerification: sigRes,
          onReset: vi.fn(),
        })
      );

      expect(html).toContain("Within Cap");
    });

    it("renders red failure banner when signature verification fails", async () => {
      const voucher = await signVoucher({
        contractId,
        bookId: 100n,
        noteIndex: 1,
        merchant: merchantAddress,
        amount: 20_000_000n,
        cap: 50_000_000n,
        acceptUntil: 1800000000n,
        voucherSecretKey: voucherSecretBytes,
      });

      const decodeRes = {
        valid: true,
        voucher,
        rawPayload: "dummy_wire_payload",
      };

      const sigRes = {
        valid: false,
        reason: "InvalidSignature",
        error: "Cryptographic signature mismatch: Signature was not produced by registry voucher key",
      };

      const html = renderToString(
        React.createElement(DecodedVoucherView, {
          result: decodeRes,
          sigVerification: sigRes,
          onReset: vi.fn(),
        })
      );

      expect(html).toContain("Signature Verification Failed");
      expect(html).toContain("InvalidSignature");
      expect(html).toContain("Cryptographic signature mismatch");
    });
  });
});
