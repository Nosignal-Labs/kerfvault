import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  AcceptedResultView,
  AcceptedResultViewProps,
} from "./components/AcceptedResultView";
import {
  RejectedResultView,
  RejectedResultViewProps,
  formatRejectionBadge,
  getRejectionGuidance,
} from "./components/RejectedResultView";
import type { OfflineVoucher } from "@kerfvault/sdk";

describe("Distinct Result Screens for Accepted and Rejected Vouchers", () => {
  const dummyVoucher: OfflineVoucher = {
    version: 1,
    contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
    bookId: 88n,
    noteIndex: 3,
    amount: 35_000_000n, // 3.5 XLM
    cap: 50_000_000n, // 5 XLM
    acceptUntil: 1794500000n,
    merchant: "GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK",
    signature: "abcdef1234567890",
  };

  describe("AcceptedResultView Component", () => {
    it("renders the accepted offline result screen with all voucher attributes", () => {
      const html = renderToString(
        React.createElement(AcceptedResultView, {
          voucher: dummyVoucher,
          rawPayload: "raw_wire_base64_payload",
          receivedAt: 1793860000000,
          onScanNext: () => {},
        })
      );

      // Distinct accepted screen identity
      expect(html).toContain('data-testid="accepted-result-screen"');
      expect(html).toContain("Voucher Accepted &amp; Queued");
      expect(html).toContain("ACCEPTED_OFFLINE");

      // Amount and details
      expect(html).toContain("3.5");
      expect(html).toContain("35000000");
      expect(html).toContain("stroops");
      expect(html).toContain("88");
      expect(html).toContain("Note");
      expect(html).toContain("3");
      expect(html).toContain("5");
      expect(html).toContain("GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK");

      // Offline queue messaging
      expect(html).toContain("Offline Queue Ready");
      expect(html).toContain("Scan Next Voucher");
      expect(html).toContain("View Queue");
    });

    it("renders custom status badge when provided", () => {
      const html = renderToString(
        React.createElement(AcceptedResultView, {
          voucher: dummyVoucher,
          status: "PendingRelay",
          onScanNext: () => {},
        })
      );

      expect(html).toContain("PendingRelay");
    });
  });

  describe("RejectedResultView Component", () => {
    it("renders the rejected result screen with error and guidance", () => {
      const html = renderToString(
        React.createElement(RejectedResultView, {
          voucher: dummyVoucher,
          reason: "RepeatScan",
          error: "Repeat scan refused: Voucher has already been accepted on this terminal.",
          onScanNext: () => {},
        })
      );

      // Distinct rejected screen identity
      expect(html).toContain('data-testid="rejected-result-screen"');
      expect(html).toContain("Voucher Rejected");
      expect(html).toContain("REPEAT_SCAN_REFUSED");
      expect(html).toContain("Repeat scan refused");
      expect(html).toContain("Do not fulfill again to avoid double spending");

      // Attempted voucher info
      expect(html).toContain("88");
      expect(html).toContain("Note");
      expect(html).toContain("3");
      expect(html).toContain("Scan Another Voucher");
    });

    it("formats all rejection reason codes with clear badges", () => {
      expect(formatRejectionBadge("RepeatScan")).toBe("REPEAT_SCAN_REFUSED");
      expect(formatRejectionBadge("VoucherExpired")).toBe("VOUCHER_EXPIRED");
      expect(formatRejectionBadge("BookExpired")).toBe("BOOK_EXPIRED");
      expect(formatRejectionBadge("MerchantMismatch")).toBe("PAYEE_MISMATCH");
      expect(formatRejectionBadge("NoteNotOpen")).toBe("NOTE_NOT_OPEN");
      expect(formatRejectionBadge("NoteNotFound")).toBe("NOTE_NOT_FOUND");
      expect(formatRejectionBadge("AmountExceedsCap")).toBe("CAP_EXCEEDED");
      expect(formatRejectionBadge("CapExceedsMerchantLimit")).toBe("CAP_EXCEEDED");
      expect(formatRejectionBadge("InvalidSignature")).toBe("SIGNATURE_MISMATCH");
      expect(formatRejectionBadge("NoSnapshot")).toBe("REGISTRY_MISSING");
      expect(formatRejectionBadge("MissingVoucherKey")).toBe("KEY_NOT_FOUND");
      expect(formatRejectionBadge("DecodeFailed")).toBe("DECODE_FAILED");
    });

    it("provides specific plain-language guidance for each rejection reason", () => {
      expect(getRejectionGuidance("RepeatScan")).toContain("double spending");
      expect(getRejectionGuidance("VoucherExpired")).toContain("fresh voucher");
      expect(getRejectionGuidance("MerchantMismatch")).toContain("different merchant");
      expect(getRejectionGuidance("NoteNotOpen")).toContain("no longer open");
      expect(getRejectionGuidance("CapExceedsMerchantLimit")).toContain("adjust limits in Settings");
      expect(getRejectionGuidance("InvalidSignature")).toContain("tampered");
      expect(getRejectionGuidance("NoSnapshot")).toContain("sync the registry");
    });

    it("renders contextual action for NoSnapshot to sync registry", () => {
      const html = renderToString(
        React.createElement(RejectedResultView, {
          reason: "NoSnapshot",
          error: "Registry snapshot is missing.",
          onScanNext: () => {},
          onSyncRegistry: () => {},
        })
      );

      expect(html).toContain("Sync Registry");
      expect(html).toContain("REGISTRY_MISSING");
    });

    it("renders contextual link to settings when cap is exceeded", () => {
      const html = renderToString(
        React.createElement(RejectedResultView, {
          voucher: dummyVoucher,
          reason: "CapExceedsMerchantLimit",
          error: "Voucher cap exceeds merchant terminal offline limit.",
          onScanNext: () => {},
        })
      );

      expect(html).toContain("Check Settings");
      expect(html).toContain("CAP_EXCEEDED");
    });
  });
});
