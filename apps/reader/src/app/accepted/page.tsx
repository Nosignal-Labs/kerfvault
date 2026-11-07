"use client";

import React, { useState, useEffect, useCallback } from "react";
import { VoucherQueueList } from "../../components/VoucherQueueList";
import { getAllStoredVouchers, type StoredVoucherRecord } from "../../lib/storage";
import { getMerchantSettings } from "../../lib/merchantSettings";
import {
  redeemQueuedVoucher,
  redeemAllQueuedVouchers,
  type BatchRedeemResult,
} from "../../lib/relayClient";

export default function AcceptedVouchersPage() {
  const [vouchers, setVouchers] = useState<StoredVoucherRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [maxExposure, setMaxExposure] = useState<number>(500);
  const [actionNotice, setActionNotice] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const loadVouchers = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await getAllStoredVouchers();
      // Sort newest first
      records.sort((a, b) => b.receivedAt - a.receivedAt);
      setVouchers(records);

      const settings = getMerchantSettings();
      setMaxExposure(settings.maxTotalOfflineExposureXlm);
    } catch (err) {
      console.error("Failed to load vouchers from IndexedDB:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  const handleRedeemAll = async () => {
    const queued = vouchers.filter(
      (v) => v.status === "AcceptedOffline" || v.status === "PendingRelay"
    );
    if (queued.length === 0) return;

    setIsRedeeming(true);
    setActionNotice({
      type: "info",
      message: `Submitting ${queued.length} offline voucher(s) to KerfVault relay...`,
    });

    try {
      const batchResult: BatchRedeemResult = await redeemAllQueuedVouchers(queued);
      await loadVouchers();

      if (batchResult.failed === 0) {
        setActionNotice({
          type: "success",
          message: `Successfully redeemed all ${batchResult.succeeded} voucher(s) on-chain!`,
        });
      } else {
        setActionNotice({
          type: "error",
          message: `Redeemed ${batchResult.succeeded} voucher(s); ${batchResult.failed} failed. See row details for failure reasons.`,
        });
      }
    } catch (err) {
      setActionNotice({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
      await loadVouchers();
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleRedeemSingle = async (record: StoredVoucherRecord) => {
    setIsRedeeming(true);
    setActionNotice({
      type: "info",
      message: `Submitting voucher #${record.voucher.bookId.toString()} Note #${record.voucher.noteIndex} to relay...`,
    });

    try {
      const res = await redeemQueuedVoucher(record);
      await loadVouchers();

      if (res.success) {
        setActionNotice({
          type: "success",
          message: `Voucher #${record.voucher.bookId.toString()} Note #${record.voucher.noteIndex} redeemed on-chain! Tx: ${res.txHash?.slice(0, 16)}...`,
        });
      } else {
        setActionNotice({
          type: "error",
          message: `Failed to redeem voucher #${record.voucher.bookId.toString()}: ${res.error}`,
        });
      }
    } catch (err) {
      setActionNotice({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
      await loadVouchers();
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="space-y-6">
      {actionNotice && (
        <div
          data-testid="relay-action-notice"
          className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
            actionNotice.type === "success"
              ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-200"
              : actionNotice.type === "error"
              ? "bg-rose-950/40 border-rose-700/60 text-rose-200"
              : "bg-blue-950/40 border-blue-700/60 text-blue-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>
              {actionNotice.type === "success"
                ? "✓"
                : actionNotice.type === "error"
                ? "✕"
                : "ℹ"}
            </span>
            <span className="font-medium">{actionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-zinc-400 hover:text-zinc-200 font-mono text-[11px] px-1.5"
          >
            ✕
          </button>
        </div>
      )}

      <VoucherQueueList
        vouchers={vouchers}
        isLoading={isLoading}
        isRedeeming={isRedeeming}
        onRefresh={loadVouchers}
        onRedeemAll={handleRedeemAll}
        onRedeemSingle={handleRedeemSingle}
        maxTotalExposureXlm={maxExposure}
      />
    </div>
  );
}
