"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { MerchantWalletOnboarding } from "../components/MerchantWalletOnboarding";
import { TrustlineChecker } from "../components/TrustlineChecker";
import {
  getMerchantSettings,
  DEFAULT_MERCHANT_SETTINGS,
  type MerchantSettings,
} from "../lib/merchantSettings";

export default function ReaderHomePage() {
  const [settings, setSettings] = useState<MerchantSettings>(DEFAULT_MERCHANT_SETTINGS);

  useEffect(() => {
    setSettings(getMerchantSettings());
  }, []);

  return (
    <div className="space-y-6">
      <MerchantWalletOnboarding />
      <TrustlineChecker />

      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <h1 className="text-2xl font-bold text-zinc-100">Merchant Terminal</h1>
        <p className="text-zinc-400 mt-2">
          Verify shopper payment vouchers offline against a synced registry snapshot.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div className="bg-zinc-800/50 p-4 rounded-lg">
            <span className="text-zinc-500 text-xs block uppercase tracking-wider">Sync State</span>
            <span className="text-emerald-400 font-semibold text-base mt-1 block">Registry Synced</span>
            <span className="text-zinc-500 text-xs mt-1 block">Ledger #14209 (2 hrs ago)</span>
          </div>
          <div className="bg-zinc-800/50 p-4 rounded-lg">
            <span className="text-zinc-500 text-xs block uppercase tracking-wider">Offline Limit</span>
            <span className="text-zinc-200 font-semibold text-base mt-1 block font-mono">
              {settings.maxOfflineVoucherAmountXlm.toFixed(2)} USDC / tx
            </span>
            <span className="text-zinc-400 text-xs mt-1 block font-mono">
              Max Exposure: {settings.maxTotalOfflineExposureXlm.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            href="/scan"
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-medium text-sm"
          >
            Scan Voucher QR
          </Link>
          <Link
            href="/accepted"
            className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 rounded font-medium text-sm text-zinc-200"
          >
            View Queue
          </Link>
        </div>
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">Offline Guarantee: </span>
        Merchant terminal verifies shopper signatures locally against cached registry public keys without needing network access.
      </div>
    </div>
  );
}
