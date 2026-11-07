"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { StoredVoucherRecord, StoredVoucherStatus } from "../lib/storage";
import { stroopsToXlm } from "../lib/voucherDecoder";

export interface VoucherQueueListProps {
  vouchers: StoredVoucherRecord[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onRedeemSingle?: (voucher: StoredVoucherRecord) => void;
  onRedeemAll?: () => void;
  isRedeeming?: boolean;
  maxTotalExposureXlm?: number;
}

export function formatVoucherStatusBadge(status: StoredVoucherStatus) {
  switch (status) {
    case "AcceptedOffline":
      return {
        label: "Accepted Offline",
        bg: "bg-amber-500/15 border-amber-500/30 text-amber-300",
        dot: "bg-amber-400",
      };
    case "PendingRelay":
      return {
        label: "Pending Relay",
        bg: "bg-blue-500/15 border-blue-500/30 text-blue-300",
        dot: "bg-blue-400",
      };
    case "RedeemedOnChain":
      return {
        label: "Redeemed on-chain",
        bg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
        dot: "bg-emerald-400",
      };
    case "Rejected":
      return {
        label: "Rejected",
        bg: "bg-rose-500/15 border-rose-500/30 text-rose-300",
        dot: "bg-rose-400",
      };
  }
}

export function VoucherQueueList({
  vouchers,
  isLoading = false,
  onRefresh,
  onRedeemSingle,
  onRedeemAll,
  isRedeeming = false,
  maxTotalExposureXlm = 500,
}: VoucherQueueListProps) {
  const [activeFilter, setActiveFilter] = useState<StoredVoucherStatus | "ALL">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Compute metrics
  const offlineQueuedCount = vouchers.filter((v) => v.status === "AcceptedOffline").length;
  const pendingRelayCount = vouchers.filter((v) => v.status === "PendingRelay").length;
  const redeemedCount = vouchers.filter((v) => v.status === "RedeemedOnChain").length;

  const totalOfflineStroops = vouchers
    .filter((v) => v.status === "AcceptedOffline" || v.status === "PendingRelay")
    .reduce((sum, v) => sum + v.voucher.amount, 0n);

  const totalOfflineXlm = stroopsToXlm(totalOfflineStroops);
  const exposurePercentage = Math.min(
    100,
    Math.round((totalOfflineXlm / (maxTotalExposureXlm || 1)) * 100)
  );

  // Filtered list
  const filteredVouchers =
    activeFilter === "ALL"
      ? vouchers
      : vouchers.filter((v) => v.status === activeFilter);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div data-testid="voucher-queue-dashboard" className="space-y-6">
      {/* Metric Exposure Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block font-medium">
            Total Offline Exposure
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-zinc-100">{totalOfflineXlm}</span>
            <span className="text-xs text-zinc-400">/ {maxTotalExposureXlm} XLM cap</span>
          </div>
          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full ${
                exposurePercentage > 85
                  ? "bg-rose-500"
                  : exposurePercentage > 60
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${exposurePercentage}%` }}
            />
          </div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block font-medium">
            Awaiting Relay Redemption
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">
              {offlineQueuedCount + pendingRelayCount}
            </span>
            <span className="text-xs text-zinc-400">vouchers</span>
          </div>
          <span className="text-[11px] text-zinc-500 block">
            {offlineQueuedCount} queued offline, {pendingRelayCount} pending
          </span>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block font-medium">
            Settled On-Chain
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">{redeemedCount}</span>
            <span className="text-xs text-zinc-400">redeemed</span>
          </div>
          <span className="text-[11px] text-zinc-500 block">
            Confirmed via KerfVault Relay
          </span>
        </div>
      </div>

      {/* Main Queue Card */}
      <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-900/50 space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Accepted Voucher Queue</h1>
            <p className="text-zinc-400 mt-1 text-xs">
              Every voucher accepted offline is securely retained here with settlement status.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition border border-zinc-700"
              >
                {isLoading ? "Refreshing..." : "↻ Refresh"}
              </button>
            )}

            <button
              type="button"
              onClick={onRedeemAll}
              disabled={isRedeeming || offlineQueuedCount === 0}
              className="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition shadow-md shadow-emerald-950/40"
            >
              {isRedeeming ? "Redeeming..." : `Redeem now (${offlineQueuedCount})`}
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-zinc-800 gap-2 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter("ALL")}
            className={`pb-2.5 px-3 font-medium border-b-2 transition ${
              activeFilter === "ALL"
                ? "border-emerald-500 text-emerald-400 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All ({vouchers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("AcceptedOffline")}
            className={`pb-2.5 px-3 font-medium border-b-2 transition ${
              activeFilter === "AcceptedOffline"
                ? "border-emerald-500 text-emerald-400 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Queued Offline ({offlineQueuedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("PendingRelay")}
            className={`pb-2.5 px-3 font-medium border-b-2 transition ${
              activeFilter === "PendingRelay"
                ? "border-emerald-500 text-emerald-400 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Pending Relay ({pendingRelayCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("RedeemedOnChain")}
            className={`pb-2.5 px-3 font-medium border-b-2 transition ${
              activeFilter === "RedeemedOnChain"
                ? "border-emerald-500 text-emerald-400 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Redeemed ({redeemedCount})
          </button>
        </div>

        {/* List Content */}
        {isLoading ? (
          <div className="py-12 text-center text-zinc-400 text-xs flex items-center justify-center gap-2">
            <span className="animate-spin">◌</span>
            <span>Loading accepted vouchers from IndexedDB...</span>
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xl mx-auto">
              📋
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-300">
                {activeFilter === "ALL"
                  ? "No vouchers in queue"
                  : `No vouchers with status '${activeFilter}'`}
              </p>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                Offline vouchers accepted through the scanner will be retained in this queue.
              </p>
            </div>
            <div>
              <Link
                href="/scan"
                className="inline-flex items-center gap-1.5 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
              >
                <span>📷</span>
                <span>Scan Voucher</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto border border-zinc-800 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-zinc-800/80 text-zinc-400 border-b border-zinc-800 font-mono text-[11px]">
                <tr>
                  <th className="p-3">Book &amp; Note</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Max Cap</th>
                  <th className="p-3">Accepted At</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {filteredVouchers.map((record) => {
                  const badge = formatVoucherStatusBadge(record.status);
                  const isExpanded = expandedId === record.id;
                  const acceptedTime = new Date(record.receivedAt).toLocaleString();
                  const amountXlm = stroopsToXlm(record.voucher.amount);
                  const capXlm = stroopsToXlm(record.voucher.cap);

                  return (
                    <React.Fragment key={record.id}>
                      <tr
                        data-testid={`voucher-row-${record.id}`}
                        className={`hover:bg-zinc-800/40 transition cursor-pointer ${
                          isExpanded ? "bg-zinc-800/20" : ""
                        }`}
                        onClick={() => toggleExpand(record.id)}
                      >
                        <td className="p-3 font-mono">
                          <span className="font-semibold text-zinc-100">
                            #{record.voucher.bookId.toString()}
                          </span>
                          <span className="text-zinc-500 ml-1.5">Note #{record.voucher.noteIndex}</span>
                        </td>
                        <td className="p-3 font-medium text-emerald-400 font-mono">
                          {amountXlm} XLM
                        </td>
                        <td className="p-3 font-mono text-zinc-400">
                          {capXlm} XLM
                        </td>
                        <td className="p-3 text-zinc-400">
                          {acceptedTime}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium border ${badge.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            <span>{badge.label}</span>
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(record.id);
                            }}
                            className="text-xs text-zinc-400 hover:text-zinc-200 transition font-mono"
                          >
                            {isExpanded ? "▲ Hide" : "▼ Details"}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-zinc-950/80 border-b border-zinc-800/80">
                          <td colSpan={6} className="p-4 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                              <div>
                                <span className="text-zinc-500 uppercase font-mono block">
                                  Merchant Payee:
                                </span>
                                <span className="font-mono text-zinc-300 break-all select-all">
                                  {record.voucher.merchant}
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-500 uppercase font-mono block">
                                  Contract ID:
                                </span>
                                <span className="font-mono text-zinc-300 break-all select-all">
                                  {record.voucher.contractId}
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-500 uppercase font-mono block">
                                  Accept Deadline (Expiry):
                                </span>
                                <span className="font-mono text-zinc-300">
                                  {new Date(Number(record.voucher.acceptUntil) * 1000).toLocaleString()}
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-500 uppercase font-mono block">
                                  Voucher Signature:
                                </span>
                                <span className="font-mono text-zinc-400 break-all text-[10px]">
                                  {record.voucher.signature}
                                </span>
                              </div>
                            </div>

                            {record.txHash && (
                              <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded text-xs text-emerald-300">
                                <span className="font-semibold">Redemption Transaction: </span>
                                <span className="font-mono break-all">{record.txHash}</span>
                              </div>
                            )}

                            {record.rejectionReason && (
                              <div className="p-2.5 bg-rose-950/30 border border-rose-800/40 rounded text-xs text-rose-300">
                                <span className="font-semibold">Rejection Reason: </span>
                                <span>{record.rejectionReason}</span>
                              </div>
                            )}

                            {onRedeemSingle && record.status === "AcceptedOffline" && (
                              <div className="pt-1 flex justify-end">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRedeemSingle(record);
                                  }}
                                  disabled={isRedeeming}
                                  className="py-1 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
                                >
                                  Redeem This Voucher
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
