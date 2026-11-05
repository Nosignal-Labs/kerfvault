"use client";

import React from "react";
import { useWallet } from "../../lib/WalletContext";

export default function SettingsPage() {
  const {
    isLoaded,
    publicKey,
    voucherPublicKey,
    hasVoucherKey,
    isUnlocked,
  } = useWallet();

  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-100">Wallet Settings</h1>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
            TESTNET ONLY
          </span>
        </div>
        <p className="text-zinc-400 mt-1 text-sm">
          Manage offline voucher keys, local device encryption, and network configuration.
        </p>

        <div className="mt-6 space-y-5">
          {/* Connected Network */}
          <div className="border border-zinc-800 bg-zinc-950 p-3.5 rounded-lg">
            <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Connected Network
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-mono text-zinc-200">
                Stellar Testnet (Test SDF Network ; September 2015)
              </span>
            </div>
            <div className="text-[11px] text-amber-400/90 mt-1">
              Mainnet connectivity is strictly refused in this demo application.
            </div>
          </div>

          {/* Shopper Account Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Shopper Funding Account (G-Address)
              </label>
              <span className="text-[11px] text-zinc-500 font-mono">LOCKED ON TESTNET</span>
            </div>
            <input
              type="text"
              value={isLoaded ? (publicKey || "No wallet created yet") : "Loading..."}
              readOnly
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none"
            />
            <p className="text-[11px] text-zinc-500">
              Used to open note books on-chain and receive reclaims.
            </p>
          </div>

          {/* Separate Voucher Signing Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Separate Voucher Signing Key (Ed25519)
              </label>
              {hasVoucherKey && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                  {isUnlocked ? "UNLOCKED & ENCRYPTED" : "STORED ENCRYPTED"}
                </span>
              )}
            </div>
            <input
              type="text"
              value={
                isLoaded
                  ? (voucherPublicKey || "Generated upon wallet creation")
                  : "Loading..."
              }
              readOnly
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none"
            />
            <p className="text-[11px] text-zinc-500">
              Vouchers presented to merchants are signed exclusively with this key, keeping your funding account isolated.
            </p>
          </div>

          {/* App Passcode Protection */}
          <div className="border border-zinc-800/80 bg-zinc-950/40 p-3.5 rounded-lg space-y-1">
            <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              WebCrypto Passcode Protection
            </div>
            <div className="text-xs text-zinc-400">
              All keys are encrypted in browser local storage via WebCrypto PBKDF2 (100,000 rounds of SHA-256) and AES-GCM 256-bit encryption.
            </div>
          </div>
        </div>
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">Security Model: </span>
        The separate voucher key ensures that compromising an offline terminal or QR presentation never grants access to your funding account.
      </div>
    </div>
  );
}
