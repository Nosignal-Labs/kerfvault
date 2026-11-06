"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { OfflineVoucher } from "@kerfvault/sdk";
import type { OfflineBook } from "../lib/offlineSigningStore";
import type { VoucherInputParams } from "../lib/voucherParams";

interface VoucherQRDisplayProps {
  voucher: OfflineVoucher;
  wirePayload: string;
  book: OfflineBook;
  params: VoucherInputParams;
  onDone?: () => void;
}

export function VoucherQRDisplay({
  voucher,
  wirePayload,
  book,
  params,
  onDone,
}: VoucherQRDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [copiedSig, setCopiedSig] = useState(false);

  const handleCopyPayload = async () => {
    try {
      await navigator.clipboard.writeText(wirePayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback if clipboard API not available
      const textarea = document.createElement("textarea");
      textarea.value = wirePayload;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopySig = async () => {
    try {
      await navigator.clipboard.writeText(voucher.signature);
      setCopiedSig(true);
      setTimeout(() => setCopiedSig(false), 2500);
    } catch {
      // noop
    }
  };

  const expiryDate = new Date(Number(voucher.acceptUntil) * 1000);
  const isExpired = Date.now() > Number(voucher.acceptUntil) * 1000;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
            Offline Voucher Generated
          </span>
          <span className="text-sm font-medium text-zinc-200">
            Present this QR Code to the Merchant
          </span>
        </div>
        <span className="px-2 py-0.5 text-[11px] font-mono font-medium rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
          SIGNED OFFLINE
        </span>
      </div>

      {/* QR Code Container */}
      <div className="flex flex-col items-center justify-center p-6 bg-zinc-950 rounded-xl border border-zinc-800 shadow-2xl">
        <div className="p-4 bg-white rounded-xl shadow-lg inline-block">
          <QRCodeSVG
            value={wirePayload}
            size={260}
            level="M"
            includeMargin={false}
            className="w-full h-auto max-w-[260px] aspect-square block"
          />
        </div>
        <p className="text-xs text-zinc-400 mt-4 text-center">
          Point merchant reader camera at this QR code. No internet required.
        </p>
      </div>

      {/* Voucher Details */}
      <div className="p-4 bg-zinc-950/70 border border-zinc-800 rounded-lg space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          <span>Voucher Summary</span>
          <span className="text-zinc-500 font-mono">Wire Length: {wirePayload.length} B</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
            <span className="text-zinc-500 block text-[10px]">BOOK & NOTE</span>
            <span className="font-mono text-zinc-200 font-semibold">
              Book #{book.bookId} • Note #{params.noteIndex}
            </span>
          </div>

          <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
            <span className="text-zinc-500 block text-[10px]">AMOUNT</span>
            <span className="font-mono text-emerald-400 font-semibold">
              {params.amountXlm} XLM
            </span>
          </div>

          <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
            <span className="text-zinc-500 block text-[10px]">SPENDING CAP</span>
            <span className="font-mono text-zinc-200">
              {params.capXlm} XLM
            </span>
          </div>

          <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
            <span className="text-zinc-500 block text-[10px]">ACCEPT UNTIL</span>
            <span
              className={`font-mono ${
                isExpired ? "text-rose-400 font-semibold" : "text-zinc-200"
              }`}
            >
              {expiryDate.toLocaleTimeString()} ({expiryDate.toLocaleDateString()})
            </span>
          </div>
        </div>

        {/* Merchant address */}
        <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800 text-xs">
          <span className="text-zinc-500 block text-[10px]">MERCHANT PAYEE</span>
          <span className="font-mono text-zinc-200 break-all text-[11px]">
            {voucher.merchant}
          </span>
        </div>

        {/* Signature info */}
        <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-[10px]">ED25519 SIGNATURE</span>
            <button
              type="button"
              onClick={handleCopySig}
              className="text-[10px] text-sky-400 hover:text-sky-300 font-mono"
            >
              {copiedSig ? "Copied!" : "Copy Sig"}
            </button>
          </div>
          <span className="font-mono text-zinc-400 break-all text-[10px]">
            {voucher.signature}
          </span>
        </div>
      </div>

      {/* Raw Payload for Manual Entry / Copy */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400 font-medium">Wire Payload (Base64)</span>
          <button
            type="button"
            onClick={handleCopyPayload}
            className="px-2.5 py-1 text-xs rounded bg-sky-500 hover:bg-sky-600 text-white font-medium transition"
          >
            {copied ? "Copied to Clipboard!" : "Copy Payload"}
          </button>
        </div>
        <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded font-mono text-[11px] text-zinc-400 break-all select-all">
          {wirePayload}
        </div>
      </div>

      {/* Offline Safety Note */}
      <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg text-xs text-amber-300 space-y-1">
        <div className="font-semibold flex items-center gap-1.5">
          <span>✓</span> Note #{params.noteIndex} marked as spent offline
        </div>
        <p className="text-amber-200/80">
          This note cannot be spent again from this device until the book state is refreshed or replaced.
        </p>
      </div>

      {/* Done Button */}
      {onDone && (
        <button
          type="button"
          onClick={onDone}
          className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium transition"
        >
          Done / Sign Another Voucher
        </button>
      )}
    </div>
  );
}

