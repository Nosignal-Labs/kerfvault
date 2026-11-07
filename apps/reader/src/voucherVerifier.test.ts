import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Keypair } from "@stellar/stellar-sdk";
import { signVoucher, type RegistrySnapshot } from "@kerfvault/sdk";
import { parseAndGateVoucher } from "./lib/voucherDecoder";
import { verifyVoucherSignatureAgainstRegistry } from "./lib/voucherVerifier";
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
