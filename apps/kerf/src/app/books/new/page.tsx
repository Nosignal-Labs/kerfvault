"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BookConfigForm } from "../../../components/BookConfigForm";
import type { BookConfiguration } from "../../../lib/bookConfig";
import {
  openBookWorkflow,
  type OpenBookProgress,
} from "../../../lib/openBookWorkflow";
import { useWallet } from "../../../lib/WalletContext";

export default function NewBookPage() {
  const { secret, publicKey, voucherPublicKey, isUnlocked, refreshBalance } = useWallet();

  const [progress, setProgress] = useState<OpenBookProgress | null>(null);
  const [createdBookId, setCreatedBookId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfigSubmit = async (config: BookConfiguration) => {
    if (!isUnlocked || !secret || !publicKey || !voucherPublicKey) {
      alert("Please unlock your wallet first.");
      return;
    }

    try {
      setIsSubmitting(true);
      setProgress({ step: "VALIDATING", message: "Starting book creation..." });

      const result = await openBookWorkflow({
        config,
        ownerSecret: secret,
        ownerAddress: publicKey,
        voucherPublicKey,
        onProgress: (p) => setProgress(p),
      });

      setCreatedBookId(result.bookId);
      // Refresh wallet balance after locking funds
      refreshBalance();
    } catch {
      // Progress error state handled in onProgress callback
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setProgress(null);
    setCreatedBookId(null);
    setIsSubmitting(false);
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
            <h1 className="text-xl font-bold text-zinc-100">Open a Voucher Book</h1>
          </div>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
            TESTNET ONLY
          </span>
        </div>
        <p className="text-zinc-400 text-sm mb-6">
          Choose note denominations and a redemption deadline to lock funds into fixed-value offline vouchers.
        </p>

        {/* Live Progress Card when submitting or confirmed */}
        {progress && (
          <div className="mb-6 border rounded-lg p-5 bg-zinc-950/80 transition-all space-y-3">
            {progress.step === "CONFIRMED" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-base">
                  <span className="text-xl">✓</span>
                  <span>{progress.message}</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Your funds are now locked into Book #{createdBookId} on Stellar Testnet. You can present offline payment vouchers from these notes.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link
                    href={`/books/${createdBookId}`}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs transition"
                  >
                    View Book #{createdBookId}
                  </Link>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 rounded text-xs font-medium text-zinc-300 transition"
                  >
                    Open Another Book
                  </button>
                </div>
              </div>
            ) : progress.step === "ERROR" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
                  <span>✕</span>
                  <span>Book Creation Failed</span>
                </div>
                <div className="text-xs text-red-300/90 font-mono bg-red-950/30 p-2.5 rounded border border-red-900/40 break-all">
                  {progress.error || progress.message}
                </div>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium rounded text-zinc-200 transition"
                  >
                    Dismiss & Edit
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-sky-400 font-medium text-sm">
                    <span className="inline-block h-3.5 w-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                    <span>Processing on Stellar Testnet...</span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500">{progress.step}</span>
                </div>
                <div className="text-xs text-zinc-300 font-mono bg-zinc-900/90 p-2.5 rounded border border-zinc-800">
                  {progress.message}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Configuration Form */}
        {(!progress || progress.step === "ERROR") && (
          <BookConfigForm
            onSubmit={handleConfigSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">Notice: </span>
        All lock transactions are submitted to Stellar Testnet contract instances.
      </div>
    </div>
  );
}
