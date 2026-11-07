"use client";

import React from "react";
import { DecodedVoucherResult, stroopsToXlm } from "../lib/voucherDecoder";
import { VoucherSignatureVerificationResult } from "../lib/voucherVerifier";

export interface DecodedVoucherViewProps {
  result: DecodedVoucherResult;
  sigVerification?: VoucherSignatureVerificationResult | null;
  onReset: () => void;
  onAccept?: () => Promise<void> | void;
  onDecline?: () => void;
  isAccepted?: boolean;
  isAccepting?: boolean;
}

export function DecodedVoucherView({
  result,
  sigVerification,
  onReset,
  onAccept,
  onDecline,
  isAccepted = false,
  isAccepting = false,
}: DecodedVoucherViewProps) {
  if (!result.valid || !result.voucher) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>✕</span> Invalid or Unsupported Voucher
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              DECODE FAILED
            </span>
          </div>

          <div className="text-sm text-rose-300 bg-rose-900/30 p-3 rounded-lg border border-rose-800/40">
            {result.error ?? "Failed to decode voucher payload."}
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-zinc-400 font-mono block">RAW WIRE PAYLOAD</span>
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded font-mono text-xs text-zinc-400 break-all select-all">
              {result.rawPayload}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium transition"
        >
          Scan / Enter Another Voucher
        </button>
      </div>
    );
  }

  const { voucher } = result;
  const expiryDate = new Date(Number(voucher.acceptUntil) * 1000).toLocaleString();

  return (
    <div className="space-y-4">
      {isAccepted && (
        <div className="p-4 rounded-xl border bg-emerald-950/40 border-emerald-600/70 text-emerald-200 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Voucher Accepted
            </span>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              ACCEPTED_OFFLINE
            </span>
          </div>
          <p className="text-xs text-emerald-300">
            This voucher has been accepted offline and safely stored in your local queue ready for relay redemption.
          </p>
        </div>
      )}

      {sigVerification && (
        <div
          className={`p-4 rounded-xl border ${
            sigVerification.valid
              ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-200"
              : sigVerification.reason === "RepeatScan"
              ? "bg-amber-950/40 border-amber-600/70 text-amber-200"
              : "bg-rose-950/40 border-rose-700/60 text-rose-200"
          } space-y-2`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
              {sigVerification.valid ? (
                <>
                  <span className="text-emerald-400">✓</span> Signature Verified
                </>
              ) : sigVerification.reason === "RepeatScan" ? (
                <>
                  <span className="text-amber-400">⚠</span> Repeat Scan Refused
                </>
              ) : (
                <>
                  <span className="text-rose-400">✕</span> Signature Verification Failed
                </>
              )}
            </span>
            <span
              className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${
                sigVerification.valid
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : sigVerification.reason === "RepeatScan"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : "bg-rose-500/20 text-rose-300 border-rose-500/30"
              }`}
            >
              {sigVerification.valid
                ? "SIGNATURE MATCH"
                : sigVerification.reason === "RepeatScan"
                ? "REPEAT_SCAN_REFUSED"
                : (sigVerification.reason ?? "VERIFY_FAILED")}
            </span>
          </div>

          {sigVerification.valid ? (
            <p className="text-xs text-emerald-300">
              Voucher Ed25519 signature verified against the registry voucher key:{" "}
              <span className="font-mono font-semibold text-emerald-200 break-all">{sigVerification.voucherKey}</span>
            </p>
          ) : (
            <p
              className={`text-xs ${
                sigVerification.reason === "RepeatScan" ? "text-amber-300 font-medium" : "text-rose-300"
              }`}
            >
              {sigVerification.error ?? "Voucher signature does not match registry key."}
            </p>
          )}
        </div>
      )}

      <div className="p-4 bg-emerald-950/30 border border-emerald-800/60 rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-emerald-800/40 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              ✓ Voucher Decoded
            </span>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {`VERSION ${voucher.version}`}
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400">
            {result.rawPayload.length} bytes wire
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">Book ID</span>
            <span className="font-mono text-zinc-200 font-semibold">{voucher.bookId.toString()}</span>
          </div>

          <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">Note Index</span>
              {sigVerification?.noteStatus && (
                <span
                  className={`text-[10px] font-mono font-medium ${
                    sigVerification.noteIsOpen ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {sigVerification.noteIsOpen ? "✓ Open" : sigVerification.noteStatus}
                </span>
              )}
            </div>
            <span className="font-mono text-zinc-200 font-semibold">#{voucher.noteIndex}</span>
          </div>

          <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">Voucher Amount</span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-emerald-400">{stroopsToXlm(voucher.amount)}</span>
              <span className="text-xs text-emerald-300">XLM</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">({voucher.amount.toString()} stroops)</span>
          </div>

          <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">Maximum Cap</span>
              {sigVerification?.withinMerchantCap !== undefined && (
                <span
                  className={`text-[10px] font-mono font-medium ${
                    sigVerification.withinMerchantCap ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {sigVerification.withinMerchantCap ? "✓ Within Cap" : "Exceeds Limit"}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-zinc-200">{stroopsToXlm(voucher.cap)}</span>
              <span className="text-xs text-zinc-400">XLM</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">({voucher.cap.toString()} stroops)</span>
          </div>
        </div>

        <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">Merchant Payee</span>
            {sigVerification?.payeeMatched && (
              <span className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                ✓ Payee Confirmed
              </span>
            )}
          </div>
          <span className="font-mono text-zinc-300 break-all select-all block">{voucher.merchant}</span>
        </div>

        <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg space-y-1 text-xs">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">Contract ID</span>
          <span className="font-mono text-zinc-400 break-all select-all block text-[11px]">{voucher.contractId}</span>
        </div>

        <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg space-y-1 text-xs">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">Accept Until (Expiry)</span>
          <span className="font-mono text-zinc-300">{expiryDate}</span>
          <span className="text-[10px] text-zinc-500 block font-mono">Unix: {voucher.acceptUntil.toString()}</span>
        </div>

        <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg space-y-1 text-xs">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">Signature</span>
          <span className="font-mono text-zinc-400 break-all block text-[11px]">{voucher.signature}</span>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-zinc-400 font-mono block">RAW WIRE PAYLOAD</span>
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded font-mono text-[11px] text-zinc-400 break-all select-all">
            {result.rawPayload}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        {sigVerification?.valid && !isAccepted && onAccept && (
          <>
            <button
              type="button"
              onClick={onAccept}
              disabled={isAccepting}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
            >
              {isAccepting ? (
                <>
                  <span className="animate-spin">◌</span>
                  <span>Accepting...</span>
                </>
              ) : (
                <>
                  <span>✓</span>
                  <span>Accept & Queue Voucher</span>
                </>
              )}
            </button>
            {onDecline && (
              <button
                type="button"
                onClick={onDecline}
                className="py-2.5 px-3 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 rounded-lg text-xs font-medium transition"
              >
                Decline
              </button>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onReset}
          className={`${
            sigVerification?.valid && !isAccepted && onAccept ? "w-1/4" : "w-full"
          } py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium transition`}
        >
          {isAccepted ? "Scan Next Voucher" : "Scan / Enter Another Voucher"}
        </button>
      </div>
    </div>
  );
}
