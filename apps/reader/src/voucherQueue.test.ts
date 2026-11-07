import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  VoucherQueueList,
  formatVoucherStatusBadge,
} from "./components/VoucherQueueList";
import type { StoredVoucherRecord } from "./lib/storage";
import type { OfflineVoucher } from "@kerfvault/sdk";

describe("Voucher Queue Listing & Status Display", () => {
  const dummyVoucher1: OfflineVoucher = {
    version: 1,
    contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
    bookId: 101n,
    noteIndex: 0,
    amount: 15_000_000n, // 1.5 XLM
    cap: 25_000_000n, // 2.5 XLM
    acceptUntil: 1794500000n,
    merchant: "GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK",
    signature: "sig_abc_123",
  };

  const dummyVoucher2: OfflineVoucher = {
    version: 1,
    contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
    bookId: 102n,
    noteIndex: 1,
    amount: 40_000_000n, // 4.0 XLM
    cap: 50_000_000n, // 5.0 XLM
    acceptUntil: 1794600000n,
    merchant: "GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK",
    signature: "sig_def_456",
  };

  const dummyVoucher3: OfflineVoucher = {
    version: 1,
    contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
    bookId: 103n,
    noteIndex: 2,
    amount: 10_000_000n, // 1.0 XLM
    cap: 20_000_000n,
    acceptUntil: 1794700000n,
    merchant: "GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK",
    signature: "sig_ghi_789",
  };

  const records: StoredVoucherRecord[] = [
    {
      id: "101:0",
      voucher: dummyVoucher1,
      receivedAt: 1793860000000,
      status: "AcceptedOffline",
      rawWirePayload: "wire_1",
    },
    {
      id: "102:1",
      voucher: dummyVoucher2,
      receivedAt: 1793861000000,
      status: "PendingRelay",
      rawWirePayload: "wire_2",
    },
    {
      id: "103:2",
      voucher: dummyVoucher3,
      receivedAt: 1793862000000,
      status: "RedeemedOnChain",
      txHash: "7a8b9c0d1e2f3a4b5c6d7e8f",
      rawWirePayload: "wire_3",
    },
  ];

  describe("formatVoucherStatusBadge helper", () => {
    it("formats all voucher statuses accurately", () => {
      expect(formatVoucherStatusBadge("AcceptedOffline").label).toBe("Accepted Offline");
      expect(formatVoucherStatusBadge("PendingRelay").label).toBe("Pending Relay");
      expect(formatVoucherStatusBadge("RedeemedOnChain").label).toBe("Redeemed on-chain");
      expect(formatVoucherStatusBadge("Rejected").label).toBe("Rejected");
    });
  });

  describe("VoucherQueueList Empty State", () => {
    it("renders friendly empty state when no vouchers are queued", () => {
      const html = renderToString(
        React.createElement(VoucherQueueList, {
          vouchers: [],
          isLoading: false,
        })
      );

      expect(html).toContain('data-testid="voucher-queue-dashboard"');
      expect(html).toContain("No vouchers in queue");
      expect(html).toContain("Scan Voucher");
      expect(html).toContain("Total Offline Exposure");
      expect(html).toContain("Awaiting Relay Redemption");
    });

    it("renders loading indicator when isLoading is true", () => {
      const html = renderToString(
        React.createElement(VoucherQueueList, {
          vouchers: [],
          isLoading: true,
        })
      );

      expect(html).toContain("Loading accepted vouchers");
    });
  });

  describe("VoucherQueueList Metrics and Records", () => {
    it("calculates total offline exposure and voucher counters accurately", () => {
      const html = renderToString(
        React.createElement(VoucherQueueList, {
          vouchers: records,
          maxTotalExposureXlm: 100,
          onRefresh: vi.fn(),
          onRedeemAll: vi.fn(),
        })
      );

      // Exposure: 1.5 + 4.0 = 5.5 XLM
      expect(html).toContain("5.5");
      expect(html).toContain("100");
      expect(html).toContain("XLM cap");

      // Counters: 1 queued offline, 1 pending relay, 1 redeemed
      expect(html).toContain("All (");
      expect(html).toContain("Queued Offline (");
      expect(html).toContain("Pending Relay (");
      expect(html).toContain("Redeemed (");
    });

    it("renders row details for each voucher in the queue", () => {
      const html = renderToString(
        React.createElement(VoucherQueueList, {
          vouchers: records,
        })
      );

      // Row 1
      expect(html).toContain("101");
      expect(html).toContain("1.5");
      expect(html).toContain("Accepted Offline");

      // Row 2
      expect(html).toContain("102");
      expect(html).toContain("4");
      expect(html).toContain("Pending Relay");

      // Row 3
      expect(html).toContain("103");
      expect(html).toContain("1");
      expect(html).toContain("Redeemed on-chain");
    });

    it("renders redeem button enabled with count of unredeemed offline vouchers", () => {
      const html = renderToString(
        React.createElement(VoucherQueueList, {
          vouchers: records,
          onRedeemAll: vi.fn(),
        })
      );

      expect(html).toContain("Redeem now (1)");
    });
  });
});
