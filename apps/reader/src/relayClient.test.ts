import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  getDefaultRelayUrl,
  submitVoucherToRelay,
  redeemQueuedVoucher,
  redeemAllQueuedVouchers,
} from "./lib/relayClient";
import {
  clearAllStoredVouchers,
  saveVoucherRecord,
  getVoucherRecord,
  type StoredVoucherRecord,
} from "./lib/storage";
import type { OfflineVoucher } from "@kerfvault/sdk";

describe("Relay Client & Voucher Redemption", () => {
  const dummyVoucher: OfflineVoucher = {
    version: 1,
    contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
    bookId: 55n,
    noteIndex: 2,
    amount: 25_000_000n, // 2.5 XLM
    cap: 50_000_000n, // 5.0 XLM
    acceptUntil: 1794500000n,
    merchant: "GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK",
    signature: "00".repeat(64),
  };

  const storedRecord: StoredVoucherRecord = {
    id: "55:2",
    voucher: dummyVoucher,
    receivedAt: 1793860000000,
    status: "AcceptedOffline",
    rawWirePayload: "raw_payload_base64",
  };

  beforeEach(async () => {
    await clearAllStoredVouchers();
  });

  describe("getDefaultRelayUrl", () => {
    it("returns default relay URL when env is not set", () => {
      const url = getDefaultRelayUrl();
      expect(url).toContain("http");
    });
  });

  describe("submitVoucherToRelay", () => {
    it("posts the formatted voucher payload to /redeem endpoint on success", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          txHash: "mock_tx_hash_0123456789abcdef",
          ledgerSequence: 54321,
        }),
      });

      const res = await submitVoucherToRelay(dummyVoucher, {
        relayUrl: "http://test-relay:4002",
        customFetch: mockFetch as unknown as typeof fetch,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("http://test-relay:4002/redeem");
      expect(init.method).toBe("POST");

      const body = JSON.parse(init.body);
      expect(body.bookId).toBe("55");
      expect(body.noteIndex).toBe(2);
      expect(body.amount).toBe("25000000");
      expect(body.cap).toBe("50000000");
      expect(body.merchant).toBe(dummyVoucher.merchant);
      expect(body.signature).toBe(dummyVoucher.signature);

      expect(res.success).toBe(true);
      expect(res.txHash).toBe("mock_tx_hash_0123456789abcdef");
      expect(res.ledgerSequence).toBe(54321);
    });

    it("returns failure when relay responds with HTTP error", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: "Redemption transaction failed",
          details: "Note #2 in Book #55 was already redeemed.",
        }),
      });

      const res = await submitVoucherToRelay(dummyVoucher, {
        relayUrl: "http://test-relay:4002",
        customFetch: mockFetch as unknown as typeof fetch,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("was already redeemed");
    });

    it("catches network failure cleanly", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network connection refused"));

      const res = await submitVoucherToRelay(dummyVoucher, {
        customFetch: mockFetch as unknown as typeof fetch,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Network connection refused");
    });
  });

  describe("redeemQueuedVoucher integration with storage", () => {
    it("transitions voucher status from AcceptedOffline to RedeemedOnChain with txHash", async () => {
      await saveVoucherRecord(storedRecord);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          txHash: "tx_hash_success_9999",
        }),
      });

      const res = await redeemQueuedVoucher(storedRecord, {
        customFetch: mockFetch as unknown as typeof fetch,
      });

      expect(res.success).toBe(true);
      expect(res.txHash).toBe("tx_hash_success_9999");

      const updated = await getVoucherRecord(storedRecord.id);
      expect(updated?.status).toBe("RedeemedOnChain");
      expect(updated?.txHash).toBe("tx_hash_success_9999");
    });

    it("records failure details and resets status when relay rejects", async () => {
      await saveVoucherRecord(storedRecord);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: "Contract execution trapped",
          details: "Expired deadline",
        }),
      });

      const res = await redeemQueuedVoucher(storedRecord, {
        customFetch: mockFetch as unknown as typeof fetch,
      });

      expect(res.success).toBe(false);

      const updated = await getVoucherRecord(storedRecord.id);
      expect(updated?.status).toBe("AcceptedOffline");
      expect(updated?.rejectionReason).toContain("Expired deadline");
    });
  });

  describe("redeemAllQueuedVouchers batch redemption", () => {
    it("submits multiple queued vouchers and skips already redeemed vouchers", async () => {
      const record1 = { ...storedRecord, id: "55:1", voucher: { ...dummyVoucher, noteIndex: 1 } };
      const record2 = { ...storedRecord, id: "55:2", voucher: { ...dummyVoucher, noteIndex: 2 } };
      const record3 = {
        ...storedRecord,
        id: "55:3",
        status: "RedeemedOnChain" as const,
        voucher: { ...dummyVoucher, noteIndex: 3 },
      };

      await saveVoucherRecord(record1);
      await saveVoucherRecord(record2);
      await saveVoucherRecord(record3);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          txHash: "batch_tx_hash",
        }),
      });

      const batchRes = await redeemAllQueuedVouchers([record1, record2, record3], {
        customFetch: mockFetch as unknown as typeof fetch,
      });

      // record3 is already redeemed, so only 2 were submitted
      expect(batchRes.total).toBe(2);
      expect(batchRes.succeeded).toBe(2);
      expect(batchRes.failed).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
