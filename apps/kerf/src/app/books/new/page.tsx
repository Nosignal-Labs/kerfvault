"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BookConfigForm } from "../../../components/BookConfigForm";
import type { BookConfiguration } from "../../../lib/bookConfig";

export default function NewBookPage() {
  const [selectedConfig, setSelectedConfig] = useState<BookConfiguration | null>(null);

  const handleConfigSubmit = (config: BookConfiguration) => {
    setSelectedConfig(config);
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

        <BookConfigForm onSubmit={handleConfigSubmit} />

        {selectedConfig && (
          <div className="mt-6 p-4 rounded-lg bg-sky-950/30 border border-sky-800/60 text-xs text-sky-200 space-y-2">
            <div className="font-semibold text-sky-100">
              Book Configuration Configured ({selectedConfig.totalXlm} XLM):
            </div>
            <div className="font-mono text-[11px] text-zinc-400 break-all">
              Notes: [{selectedConfig.denominations.join(", ")}] XLM | Deadline: {selectedConfig.deadlineDays} days ({new Date(selectedConfig.deadlineTimestamp * 1000).toISOString()})
            </div>
          </div>
        )}
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">Notice: </span>
        All lock transactions are submitted to Stellar Testnet contract instances.
      </div>
    </div>
  );
}
