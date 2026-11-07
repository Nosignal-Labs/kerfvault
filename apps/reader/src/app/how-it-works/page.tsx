import React from "react";
import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            DEMO GUIDE
          </span>
          <span className="text-xs text-zinc-400">Merchant Terminal Walkthrough</span>
        </div>
        <h1 className="text-2xl font-bold text-zinc-100 mt-2">How KerfVault Reader Works</h1>
        <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
          KerfVault Reader allows merchants to securely accept offline digital payments without internet connectivity.
          Every voucher is verified mathematically in milliseconds using public key cryptography and cryptographic commitments.
        </p>
      </div>

      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50 space-y-6">
        <h2 className="text-lg font-semibold text-zinc-100">Merchant Verification &amp; Redemption Lifecycle</h2>

        <div className="space-y-4">
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/30">
              1
            </div>
            <div>
              <h3 className="font-semibold text-zinc-200">Sync On-Chain Registry (While Online)</h3>
              <p className="text-zinc-400 text-sm mt-1">
                Before operating in offline environments (e.g. at a market or festival), sync the on-chain registry.
                The terminal downloads and caches active book roots from the KerfVault smart contract.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/30">
              2
            </div>
            <div>
              <h3 className="font-semibold text-zinc-200">Scan Customer Vouchers Completely Offline</h3>
              <p className="text-zinc-400 text-sm mt-1">
                Use your device camera to scan the shopper&apos;s QR code (or paste the wire base64 string).
                Zero internet connection, cellular service, or Wi-Fi is required by the scanner.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/30">
              3
            </div>
            <div>
              <h3 className="font-semibold text-zinc-200">Instant Cryptographic Validation</h3>
              <p className="text-zinc-400 text-sm mt-1">
                The terminal evaluates all 5 offline checks in real time:
              </p>
              <ul className="list-disc list-inside text-xs text-zinc-400 mt-2 space-y-1">
                <li><strong className="text-zinc-300">Signature:</strong> Ed25519 cryptographic signature verifies shopper authorization.</li>
                <li><strong className="text-zinc-300">Registry Roots:</strong> Merkle proof matches cached on-chain book root.</li>
                <li><strong className="text-zinc-300">Recipient:</strong> Voucher specifically designates your merchant address.</li>
                <li><strong className="text-zinc-300">Risk Cap:</strong> Voucher value is within your configured maximum acceptance threshold.</li>
                <li><strong className="text-zinc-300">Repeat Prevention:</strong> Identical vouchers presented more than once are instantly refused.</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/30">
              4
            </div>
            <div>
              <h3 className="font-semibold text-zinc-200">On-Chain Batch Redemption (When Reconnected)</h3>
              <p className="text-zinc-400 text-sm mt-1">
                Accepted vouchers are safely queued in local storage. Once an internet connection is re-established,
                click &quot;Redeem now&quot;. The KerfVault relay submits the settlement transaction to Stellar testnet and pays the gas fees.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-800 flex flex-wrap gap-3">
          <Link
            href="/scan"
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold rounded text-sm transition"
          >
            Open Scanner
          </Link>
          <Link
            href="/accepted"
            className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 rounded font-medium text-sm text-zinc-200 transition"
          >
            View Voucher Queue
          </Link>
        </div>
      </div>
    </div>
  );
}

