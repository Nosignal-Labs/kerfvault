import React from "react";
import Link from "next/link";
import { KnownLimitations } from "../../components/KnownLimitations";

export default function LimitationsPage() {
  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            TRANSPARENCY
          </span>
          <span className="text-xs text-zinc-400">Terminal Scope &amp; Boundaries</span>
        </div>
        <h1 className="text-2xl font-bold text-zinc-100 mt-2">Known Limitations</h1>
        <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
          KerfVault Reader explicitly discloses the current security and operational boundaries of the merchant terminal prototype.
        </p>
      </div>

      <KnownLimitations />

      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50 flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-sm text-zinc-200">Want to see the terminal lifecycle?</h3>
          <p className="text-xs text-zinc-400 mt-1">Read the merchant verification walkthrough.</p>
        </div>
        <Link
          href="/how-it-works"
          className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 rounded font-medium text-sm text-zinc-200 transition"
        >
          How It Works →
        </Link>
      </div>
    </div>
  );
}

