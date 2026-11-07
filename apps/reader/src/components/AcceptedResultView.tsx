"use client";

import React from "react";
import Link from "next/link";
import type { OfflineVoucher } from "@kerfvault/sdk";
import { stroopsToXlm } from "../lib/voucherDecoder";
import type { StoredVoucherStatus } from "../lib/storage";

export interface AcceptedResultViewProps {
  voucher: OfflineVoucher;
  rawPayload?: string;
  receivedAt?: number;
  status?: StoredVoucherStatus;
  onScanNext: () => void;
  onViewQueue?: () => void;
}

export function AcceptedResultView({
  voucher,
  rawPayload,
  receivedAt = Date.now(),
  status = "AcceptedOffline",
  onScanNext,
  onViewQueue,
}: AcceptedResultViewProps) {
  const amountXlm = stroopsToXlm(voucher.amount);
  const capXlm = stroopsToXlm(voucher.cap);
  const expiryDate = new Date(Number(voucher.acceptUntil) * 1000).toLocaleString();
  const acceptedTime = new Date(receivedAt).toLocaleTimeString();

  return (
    <div
      data-testid="accepted-result-screen"
      className="space-y-6 border border-emerald-800/80 bg-gradient-to-b from-emerald-950/60 to-zinc-950/80 rounded-2xl p-6 sm:p-8 text-zinc-100 shadow-2xl"
    >
      {/* Header Banner */}
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 text-3xl font-black shadow-lg shadow-emerald-900/40 animate-pulse">
          ✓
        </div>
        <div>
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-mono font-semibold tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 uppercase mb-2">
            {status === "AcceptedOffline" ? "ACCEPTED_OFFLINE" : status}
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Voucher Accepted &amp; Queued
          </h2>
          <p className="text-sm text-emerald-300/80 mt-1 max-w-md">
            Cryptographic Ed25519 signature verified against registry. Stored offline in local terminal queue.
          </p>
        </div>
      </div>

      {/* Hero Amount Card */}
      <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-6 text-center space-y-1">
        <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">
          Payment Amount
        </span>
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-4xl sm:text-5xl font-black text-emerald-200">
            {amountXlm}
          </span>
          <span className="text-xl font-bold text-emerald-400">XLM</span>
        </div>
        <p className="text-xs font-mono text-emerald-500/70">
          {voucher.amount.toString()} stroops
        </p>
      </div>

      {/* Key Voucher Details Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block">
            Book ID
          </span>
          <span className="font-mono text-sm font-semibold text-zinc-100">
            #{voucher.bookId.toString()}
          </span>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block">
            Note Index
          </span>
          <span className="font-mono text-sm font-semibold text-zinc-100">
            Note #{voucher.noteIndex}
          </span>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block">
            Offline Cap
          </span>
          <span className="font-mono text-xs font-semibold text-zinc-200">
            {capXlm} XLM
          </span>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block">
            Accepted At
          </span>
          <span className="font-mono text-xs font-semibold text-zinc-200">
            {acceptedTime}
          </span>
        </div>
      </div>

      {/* Payee & Expiry Info */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 text-xs space-y-2">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block mb-0.5">
            Confirmed Payee Address
          </span>
          <span className="font-mono text-[11px] text-emerald-300 break-all select-all block">
            {voucher.merchant}
          </span>
        </div>
        <div className="border-t border-zinc-800/80 pt-2 flex items-center justify-between text-zinc-400">
          <span>Accept Until:</span>
          <span className="font-mono text-zinc-300">{expiryDate}</span>
        </div>
      </div>

      {/* Queue Notice Banner */}
      <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs text-zinc-300 flex items-start gap-2.5">
        <span className="text-emerald-400 text-sm">ℹ</span>
        <div className="space-y-0.5">
          <span className="font-semibold text-zinc-200">Offline Queue Ready:</span>
          <p className="text-zinc-400 text-[11px]">
            This voucher will be held in IndexedDB storage until you connect online and click &quot;Redeem now&quot; on the Accepted Queue screen.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={onScanNext}
          className="flex-1 py-3 px-5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2"
        >
          <span>📷</span>
          <span>Scan Next Voucher</span>
        </button>

        {onViewQueue ? (
          <button
            type="button"
            onClick={onViewQueue}
            className="sm:w-1/3 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl text-xs transition border border-zinc-700 flex items-center justify-center gap-1.5"
          >
            <span>📋</span>
            <span>View Queue</span>
          </button>
        ) : (
          <Link
            href="/accepted"
            className="sm:w-1/3 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl text-xs transition border border-zinc-700 flex items-center justify-center gap-1.5"
          >
            <span>📋</span>
            <span>View Queue</span>
          </Link>
        )}
      </div>

      {rawPayload && (
        <details className="text-[11px] text-zinc-500 pt-1">
          <summary className="cursor-pointer hover:text-zinc-400 transition font-mono">
            Show Wire Payload Details ({rawPayload.length} bytes)
          </summary>
          <div className="mt-2 p-3 bg-zinc-950 border border-zinc-800 rounded font-mono text-[10px] break-all select-all text-zinc-400">
            {rawPayload}
          </div>
        </details>
      )}
    </div>
  );
}
