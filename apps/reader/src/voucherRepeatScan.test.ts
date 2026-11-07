import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  checkVoucherRepeatScan,
  verifyVoucherSignatureAgainstRegistry,
} from "./lib/voucherVerifier";
import {
  clearAllStoredVouchers,
  recordAcceptedVoucher,
  isVoucherAlreadyAccepted,
} from "./lib/storage";
import { DecodedVoucherView } from "./components/DecodedVoucherView";
import { encodeVoucher, type OfflineVoucher, type RegistrySnapshot } from "@kerfvault/sdk";

describe("Repeat Scan Prevention & Voucher Memory", () => {
  const dummyVoucher: OfflineVoucher = {
    version: 1,
    contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
    bookId: 77n,
    noteIndex: 1,
    amount: 20_000_000n, // 2 XLM
    cap: 50_000_000n, // 5 XLM
    acceptUntil: 1890000000n,
    merchant: "GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK",
    signature: "00".repeat(64),
  };

  const snapshot: RegistrySnapshot = {
    version: 1,
    contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
    ledgerSequence: 1000,
    snapshotTimestamp: 1700000000,
    books: {
      "77": {
        bookId: "77",
        owner: "GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK",
        token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        voucherKey: "00".repeat(32),
        redeemDeadline: "1999999999",
        freeBalance: "100000000",
        notes: [
          { index: 0, denomination: "10000000", status: "Open" },
          { index: 1, denomination: "20000000", status: "Open" },
        ],
      },
    },
  };

  beforeEach(async () => {
    await clearAllStoredVouchers();
  });

  describe("checkVoucherRepeatScan helper", () => {
    it("returns false when no records or IDs are provided", () => {
      expect(checkVoucherRepeatScan(77n, 1)).toEqual({ isRepeat: false });
      expect(checkVoucherRepeatScan(77n, 1, [])).toEqual({ isRepeat: false });
    });

    it("detects repeat scan from a Set of voucher IDs", () => {
      const set = new Set(["77:1", "77:2"]);
      const res = checkVoucherRepeatScan(77n, 1, set);
      expect(res.isRepeat).toBe(true);
      expect(res.error).toContain("Repeat scan refused");

      const res2 = checkVoucherRepeatScan(77n, 0, set);
      expect(res2.isRepeat).toBe(false);
    });

    it("detects repeat scan from an array of string IDs", () => {
      const ids = ["12:0", "77:1"];
      const res = checkVoucherRepeatScan(77n, 1, ids);
      expect(res.isRepeat).toBe(true);
      expect(res.error).toContain("Book #77, Note #1");
    });

    it("detects repeat scan from an array of stored voucher records", () => {
      const records = [
        { id: "77:1", status: "AcceptedOffline" },
        { id: "99:0", status: "PendingRelay" },
      ];
      const res = checkVoucherRepeatScan(77n, 1, records);
      expect(res.isRepeat).toBe(true);
      expect(res.existingStatus).toBe("AcceptedOffline");
      expect(res.error).toContain("AcceptedOffline");
    });

    it("ignores records with Rejected status", () => {
      const records = [{ id: "77:1", status: "Rejected" }];
      const res = checkVoucherRepeatScan(77n, 1, records);
      expect(res.isRepeat).toBe(false);
    });
  });

  describe("verifyVoucherSignatureAgainstRegistry repeat gating", () => {
    it("rejects immediately if isAlreadyAccepted is true", async () => {
      const res = await verifyVoucherSignatureAgainstRegistry(dummyVoucher, snapshot, {
        merchantAddress: dummyVoucher.merchant,
        isAlreadyAccepted: true,
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toBe("RepeatScan");
      expect(res.isRepeatScan).toBe(true);
      expect(res.error).toContain("Repeat scan refused");
    });

    it("rejects if voucher ID is in acceptedRecordsOrIds", async () => {
      const res = await verifyVoucherSignatureAgainstRegistry(dummyVoucher, snapshot, {
        merchantAddress: dummyVoucher.merchant,
        acceptedRecordsOrIds: ["77:1"],
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toBe("RepeatScan");
      expect(res.isRepeatScan).toBe(true);
    });

    it("remembers accepted voucher in storage and refuses repeat scan on second attempt", async () => {
      // 1. First scan: voucher is not yet accepted
      expect(await isVoucherAlreadyAccepted(dummyVoucher.bookId, dummyVoucher.noteIndex)).toBe(false);

      // 2. Accept voucher
      await recordAcceptedVoucher(dummyVoucher, "base64_payload");
      expect(await isVoucherAlreadyAccepted(dummyVoucher.bookId, dummyVoucher.noteIndex)).toBe(true);

      // 3. Second scan attempt: check against storage
      const alreadyAccepted = await isVoucherAlreadyAccepted(
        dummyVoucher.bookId,
        dummyVoucher.noteIndex
      );
      const res = await verifyVoucherSignatureAgainstRegistry(dummyVoucher, snapshot, {
        merchantAddress: dummyVoucher.merchant,
        isAlreadyAccepted: alreadyAccepted,
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toBe("RepeatScan");
      expect(res.isRepeatScan).toBe(true);
    });
  });

  describe("UI Result Presentation for Repeat Scans and Acceptance", () => {
    const validVoucherResult = {
      valid: true,
      voucher: dummyVoucher,
      rawPayload: encodeVoucher(dummyVoucher),
    };

    it("renders repeat scan warning banner when verification reason is RepeatScan", () => {
      const html = renderToString(
        React.createElement(DecodedVoucherView, {
          result: validVoucherResult,
          sigVerification: {
            valid: false,
            reason: "RepeatScan",
            isRepeatScan: true,
            error: "Repeat scan refused: Voucher has already been accepted on this terminal.",
          },
          onReset: () => {},
        })
      );

      expect(html).toContain("Repeat Scan Refused");
      expect(html).toContain("REPEAT_SCAN_REFUSED");
      expect(html).toContain("already been accepted on this terminal");
    });

    it("renders Accept & Queue Voucher button when valid and not yet accepted", () => {
      const html = renderToString(
        React.createElement(DecodedVoucherView, {
          result: validVoucherResult,
          sigVerification: {
            valid: true,
            voucherKey: "dummy_key",
          },
          onReset: () => {},
          onAccept: () => {},
          isAccepted: false,
        })
      );

      expect(html).toContain("Accept &amp; Queue Voucher");
      expect(html).toContain("Signature Verified");
    });

    it("renders accepted banner when isAccepted is true", () => {
      const html = renderToString(
        React.createElement(DecodedVoucherView, {
          result: validVoucherResult,
          sigVerification: {
            valid: true,
            voucherKey: "dummy_key",
          },
          onReset: () => {},
          onAccept: () => {},
          isAccepted: true,
        })
      );

      expect(html).toContain("Voucher Accepted");
      expect(html).toContain("ACCEPTED_OFFLINE");
      expect(html).toContain("Scan Next Voucher");
    });
  });
});
