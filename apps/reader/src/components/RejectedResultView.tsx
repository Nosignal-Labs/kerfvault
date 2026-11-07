"use client";

import React from "react";
import Link from "next/link";
import type { OfflineVoucher } from "@kerfvault/sdk";
import { stroopsToXlm } from "../lib/voucherDecoder";

export interface RejectedResultViewProps {
  voucher?: OfflineVoucher | null;
  reason?: string;
  error?: string;
  rawPayload?: string;
  onScanNext: () => void;
  onSyncRegistry?: () => void;
}

export function formatRejectionBadge(reason?: string): string {
  if (!reason) return "VERIFICATION_FAILED";
  switch (reason) {
    case "RepeatScan":
      return "REPEAT_SCAN_REFUSED";
    case "VoucherExpired":
      return "VOUCHER_EXPIRED";
    case "BookExpired":
      return "BOOK_EXPIRED";
    case "MerchantMismatch":
      return "PAYEE_MISMATCH";
    case "NoteNotOpen":
      return "NOTE_NOT_OPEN";
    case "NoteNotFound":
      return "NOTE_NOT_FOUND";
    case "AmountExceedsCap":
    case "CapExceedsMerchantLimit":
      return "CAP_EXCEEDED";
    case "InvalidSignature":
      return "SIGNATURE_MISMATCH";
    case "NoSnapshot":
      return "REGISTRY_MISSING";
    case "MissingVoucherKey":
      return "KEY_NOT_FOUND";
    case "DecodeFailed":
      return "DECODE_FAILED";
    default:
      return reason.toUpperCase().replace(/\s+/g, "_");
  }
}

export function getRejectionGuidance(reason?: string): string {
  switch (reason) {
    case "RepeatScan":
      return "This voucher was already accepted on this terminal. Do not fulfill again to avoid double spending.";
    case "VoucherExpired":
    case "BookExpired":
      return "The shopper's offline time window or book expiry deadline has passed. Ask the customer to generate a fresh voucher.";
    case "MerchantMismatch":
      return "This voucher is addressed to a different merchant address. Verify that the customer scanned your terminal's QR code.";
    case "NoteNotOpen":
    case "NoteNotFound":
      return "The referenced note is no longer open in the registry snapshot. It may have already been redeemed or canceled.";
    case "AmountExceedsCap":
    case "CapExceedsMerchantLimit":
      return "The voucher amount or cap exceeds your terminal's offline limit. You can adjust limits in Settings if intended.";
    case "InvalidSignature":
      return "The cryptographic Ed25519 signature does not match the registry voucher key. This voucher may be corrupted or tampered.";
    case "NoSnapshot":
      return "Your terminal does not have a cached registry snapshot. Please connect online and sync the registry.";
    default:
      return "Offline verification requirements were not met. Do not accept this voucher for payment.";
  }
}

export function RejectedResultView({
  voucher,
  reason = "VerificationFailed",
  error = "The voucher could not be verified against the local registry.",
  rawPayload,
  onScanNext,
  onSyncRegistry,
}: RejectedResultViewProps) {
  const badge = formatRejectionBadge(reason);
  const guidance = getRejectionGuidance(reason);

  return (
    <div
      data-testid="rejected-result-screen"
      className="space-y-6 border border-rose-800/80 bg-gradient-to-b from-rose-950/60 to-zinc-950/80 rounded-2xl p-6 sm:p-8 text-zinc-100 shadow-2xl"
    >
      {/* Header Banner */}
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-400 text-3xl font-black shadow-lg shadow-rose-900/40">
          ✕
        </div>
        <div>
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-mono font-semibold tracking-wider bg-rose-500/20 border border-rose-500/40 text-rose-300 uppercase mb-2">
            {badge}
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Voucher Rejected
          </h2>
          <p className="text-sm text-rose-300/80 mt-1 max-w-md">
            This voucher failed offline verification. Do NOT hand over goods or services.
          </p>
        </div>
      </div>

      {/* Primary Error Box */}
      <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 text-center space-y-2">
        <span className="text-xs uppercase tracking-wider font-semibold text-rose-400">
          Rejection Reason
        </span>
        <p className="text-sm font-medium text-rose-200">
          {error}
        </p>
        <p className="text-xs text-rose-300/80 border-t border-rose-800/40 pt-2 mt-2">
          {guidance}
        </p>
      </div>

      {/* Attempted Voucher Details if available */}
      {voucher && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-3 text-xs">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block font-semibold">
            Attempted Voucher Summary
          </span>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-400 block">Book ID</span>
              <span className="font-mono text-zinc-200 font-semibold">{`#${voucher.bookId.toString()}`}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-400 block">Note Index</span>
              <span className="font-mono text-zinc-200 font-semibold">{`Note #${voucher.noteIndex}`}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-400 block">Attempted Amount</span>
              <span className="font-mono text-zinc-200 font-semibold">{stroopsToXlm(voucher.amount)} XLM</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-400 block">Voucher Cap</span>
              <span className="font-mono text-zinc-200 font-semibold">{stroopsToXlm(voucher.cap)} XLM</span>
            </div>
          </div>
          <div className="border-t border-zinc-800 pt-2 space-y-1">
            <span className="text-[10px] text-zinc-400 block">Named Payee</span>
            <span className="font-mono text-[11px] text-zinc-400 break-all select-all block">
              {voucher.merchant}
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={onScanNext}
          className="flex-1 py-3 px-5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2"
        >
          <span>📷</span>
          <span>Scan Another Voucher</span>
        </button>

        {reason === "NoSnapshot" && onSyncRegistry && (
          <button
            type="button"
            onClick={onSyncRegistry}
            className="sm:w-1/3 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl text-xs transition border border-zinc-700 flex items-center justify-center gap-1.5"
          >
            <span>🔄</span>
            <span>Sync Registry</span>
          </button>
        )}

        {(reason === "CapExceedsMerchantLimit" || reason === "AmountExceedsCap") && (
          <Link
            href="/settings"
            className="sm:w-1/3 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl text-xs transition border border-zinc-700 flex items-center justify-center gap-1.5"
          >
            <span>⚙️</span>
            <span>Check Settings</span>
          </Link>
        )}
      </div>

      {rawPayload && (
        <details className="text-[11px] text-zinc-500 pt-1">
          <summary className="cursor-pointer hover:text-zinc-400 transition font-mono">
            Show Raw Wire Payload ({rawPayload.length} bytes)
          </summary>
          <div className="mt-2 p-3 bg-zinc-950 border border-zinc-800 rounded font-mono text-[10px] break-all select-all text-zinc-400">
            {rawPayload}
          </div>
        </details>
      )}
    </div>
  );
}
