import React from "react";
import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
            DEMO GUIDE
          </span>
          <span className="text-xs text-zinc-400">Plain-language walkthrough</span>
        </div>
        <h1 className="text-2xl font-bold text-zinc-100 mt-2">How KerfVault Shopper Works</h1>
        <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
          KerfVault allows you to spend digital currency (like XLM) without an internet connection.
          You prepare your offline vouchers while online, and spend them anywhere—even in remote areas or during power outages.
        </p>
      </div>

      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50 space-y-6">
        <h2 className="text-lg font-semibold text-zinc-100">Step-by-Step Flow</h2>

        <div className="space-y-4">
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm shrink-0 border border-sky-500/30">
              1
            </div>
            <div>
              <h3 className="font-semibold text-zinc-200">Open a Voucher Book (Online)</h3>
              <p className="text-zinc-400 text-sm mt-1">
                While connected to the internet, open a voucher book on the Stellar Soroban smart contract.
                You lock your funds (e.g. 50 XLM) and define note denominations (e.g. 5 notes of 10 XLM).
                The contract records a cryptographic commitment (Merkle root).
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm shrink-0 border border-sky-500/30">
              2
            </div>
            <div>
              <h3 className="font-semibold text-zinc-200">Disconnect &amp; Go Offline</h3>
              <p className="text-zinc-400 text-sm mt-1">
                You can now turn off Wi-Fi and mobile data. Your voucher book secrets and signing keys
                are stored securely inside your browser&apos;s local storage.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm shrink-0 border border-sky-500/30">
              3
            </div>
            <div>
              <h3 className="font-semibold text-zinc-200">Create an Offline Voucher</h3>
              <p className="text-zinc-400 text-sm mt-1">
                When purchasing goods, enter or scan the merchant&apos;s Stellar address.
                The app generates a compact 245-byte voucher payload and signs it locally using your Ed25519 voucher key.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm shrink-0 border border-sky-500/30">
              4
            </div>
            <div>
              <h3 className="font-semibold text-zinc-200">Merchant Scans the QR Code</h3>
              <p className="text-zinc-400 text-sm mt-1">
                Present the generated QR code on your phone screen. The merchant&apos;s reader terminal scans it and
                cryptographically validates the signature and commitment instantly—without any internet access.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3">
            <Link
              href="/books/new"
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded font-medium text-sm transition"
            >
              Open a Demo Book
            </Link>
            <Link
              href="/pay"
              className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 rounded font-medium text-sm text-zinc-200 transition"
            >
              Create Voucher
            </Link>
          </div>
          <Link
            href="/limitations"
            className="text-xs text-amber-400 hover:text-amber-300 underline font-medium"
          >
            View Known Limitations →
          </Link>
        </div>
      </div>
    </div>
  );
}

