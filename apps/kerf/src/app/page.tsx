"use client";

import Link from "next/link";
import { WalletOnboarding } from "../components/WalletOnboarding";
import { useWallet } from "../lib/WalletContext";

export default function HomePage() {
  const { isUnlocked } = useWallet();

  return (
    <div className="space-y-6">
      <WalletOnboarding />

      {isUnlocked && (
        <>
          <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
            <h1 className="text-xl font-bold text-zinc-100">Shopper Actions</h1>
            <p className="text-zinc-400 mt-2 text-sm">
              Reserve funds into note books while online, then sign and present vouchers offline.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/books/new"
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded font-medium text-sm transition"
              >
                Open New Book
              </Link>
              <Link
                href="/pay"
                className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 rounded font-medium text-sm text-zinc-200 transition"
              >
                Pay Merchant (QR)
              </Link>
            </div>
          </div>

          <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
            <span className="font-semibold">Demo Notice: </span>
            Books and offline vouchers created in this browser only interact with Stellar Testnet.
          </div>
        </>
      )}
    </div>
  );
}
