"use client";

import React, { useState } from "react";
import { useMerchantWallet } from "../../lib/MerchantWalletContext";
import { MerchantAddressQR } from "../../components/MerchantAddressQR";
import { TrustlineChecker } from "../../components/TrustlineChecker";

export default function ReaderSettingsPage() {
  const { merchantAddress, isUnlocked } = useMerchantWallet();
  const [showQR, setShowQR] = useState(true);

  const displayAddress =
    merchantAddress || "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";

  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <h1 className="text-xl font-bold text-zinc-100">Merchant Terminal Settings</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Configure offline risk limits, payee identity, and payout QR presentation.
        </p>

        <div className="mt-6 space-y-6">
          {/* Merchant Address & QR presentation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Merchant Payee Address
              </label>
              <button
                type="button"
                onClick={() => setShowQR(!showQR)}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                {showQR ? "Hide Payee QR" : "Show Payee QR"}
              </button>
            </div>

            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded font-mono text-xs text-zinc-300 break-all select-all">
              {displayAddress}
            </div>

            {showQR && (
              <div className="pt-2">
                <MerchantAddressQR address={displayAddress} size={190} />
              </div>
            )}
          </div>

          <TrustlineChecker />

          {/* Limits section */}
          <div className="space-y-4 border-t border-zinc-800 pt-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Maximum Offline Voucher Amount (USDC / XLM)
              </label>
              <input
                type="number"
                defaultValue="50"
                disabled
                className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-400"
              />
              <span className="text-xs text-zinc-500 mt-1 block">
                Vouchers with amounts exceeding this cap will be rejected offline.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Maximum Total Offline Exposure
              </label>
              <input
                type="number"
                defaultValue="500"
                disabled
                className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-400"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">Terminal Identity: </span>
        Offline vouchers presented by shoppers must name this merchant address as payee.
      </div>
    </div>
  );
}
