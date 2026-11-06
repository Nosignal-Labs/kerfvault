"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PayForm } from "../../components/PayForm";
import type { VoucherInputParams } from "../../lib/voucherParams";
import type { OfflineBook } from "../../lib/offlineSigningStore";

function PayPageContent() {
  const searchParams = useSearchParams();
  const initialBookId = searchParams.get("bookId") || undefined;
  const noteIndexParam = searchParams.get("noteIndex");
  const initialNoteIndex = noteIndexParam !== null ? parseInt(noteIndexParam, 10) : undefined;

  const [preparedParams, setPreparedParams] = useState<{
    params: VoucherInputParams;
    book: OfflineBook;
  } | null>(null);

  const handleProceed = (params: VoucherInputParams, book: OfflineBook) => {
    setPreparedParams({ params, book });
  };

  const handleReset = () => {
    setPreparedParams(null);
  };

  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              ← Back
            </Link>
            <h1 className="text-xl font-bold text-zinc-100">Present Payment Voucher</h1>
          </div>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
            TESTNET ONLY
          </span>
        </div>
        <p className="text-zinc-400 mt-1 text-sm mb-6">
          Pick an available note from your local books, set merchant payee, spending cap, and expiry to present an offline voucher.
        </p>

        {preparedParams ? (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-950 border border-sky-800/80 rounded-lg space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-sky-400 uppercase tracking-wider">
                <span>Voucher Parameters Configured</span>
                <span className="text-zinc-400 font-mono">Book #{preparedParams.params.bookId}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">NOTE INDEX</span>
                  <span className="font-mono text-zinc-200 font-semibold">
                    Note #{preparedParams.params.noteIndex}
                  </span>
                </div>

                <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">AMOUNT</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {preparedParams.params.amountXlm} XLM
                  </span>
                </div>

                <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">SPENDING CAP</span>
                  <span className="font-mono text-zinc-200">
                    {preparedParams.params.capXlm} XLM
                  </span>
                </div>

                <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">EXPIRES (ACCEPT UNTIL)</span>
                  <span className="font-mono text-zinc-200">
                    {new Date(preparedParams.params.acceptUntil * 1000).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800 text-xs">
                <span className="text-zinc-500 block text-[10px]">MERCHANT PAYEE</span>
                <span className="font-mono text-zinc-200 break-all text-[11px]">
                  {preparedParams.params.merchant}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs text-white rounded font-medium transition"
              >
                ← Edit Parameters
              </button>
            </div>
          </div>
        ) : (
          <PayForm
            initialBookId={initialBookId}
            initialNoteIndex={initialNoteIndex}
            onProceed={handleProceed}
          />
        )}
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">Offline Guarantee: </span>
        Vouchers are signed locally using your browser-stored Ed25519 voucher key without requiring internet or Soroban RPC access.
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/40 animate-pulse text-zinc-400 text-sm">
          Loading payment screen...
        </div>
      }
    >
      <PayPageContent />
    </Suspense>
  );
}
