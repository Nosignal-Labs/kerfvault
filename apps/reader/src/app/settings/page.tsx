"use client";

import React, { useState, useEffect } from "react";
import { useMerchantWallet } from "../../lib/MerchantWalletContext";
import { MerchantAddressQR } from "../../components/MerchantAddressQR";
import { TrustlineChecker } from "../../components/TrustlineChecker";
import {
  getMerchantSettings,
  saveMerchantSettings,
  resetMerchantSettings,
  DEFAULT_MERCHANT_SETTINGS,
  type MerchantSettings,
} from "../../lib/merchantSettings";

export default function ReaderSettingsPage() {
  const { merchantAddress } = useMerchantWallet();
  const [showQR, setShowQR] = useState(true);

  const [settings, setSettings] = useState<MerchantSettings>(DEFAULT_MERCHANT_SETTINGS);
  const [voucherAmountInput, setVoucherAmountInput] = useState<string>("50");
  const [totalExposureInput, setTotalExposureInput] = useState<string>("500");
  const [requirePayee, setRequirePayee] = useState<boolean>(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loaded = getMerchantSettings();
    setSettings(loaded);
    setVoucherAmountInput(loaded.maxOfflineVoucherAmountXlm.toString());
    setTotalExposureInput(loaded.maxTotalOfflineExposureXlm.toString());
    setRequirePayee(loaded.requirePayeeMatch);
  }, []);

  const displayAddress =
    merchantAddress || "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    setErrorMessage(null);

    const voucherAmount = parseFloat(voucherAmountInput);
    const totalExposure = parseFloat(totalExposureInput);

    if (isNaN(voucherAmount) || voucherAmount <= 0) {
      setErrorMessage("Maximum offline voucher amount must be a positive number.");
      return;
    }

    if (isNaN(totalExposure) || totalExposure <= 0) {
      setErrorMessage("Maximum total offline exposure must be a positive number.");
      return;
    }

    if (totalExposure < voucherAmount) {
      setErrorMessage(
        `Total offline exposure (${totalExposure}) cannot be less than single voucher limit (${voucherAmount}).`
      );
      return;
    }

    try {
      const updated = saveMerchantSettings({
        maxOfflineVoucherAmountXlm: voucherAmount,
        maxTotalOfflineExposureXlm: totalExposure,
        requirePayeeMatch: requirePayee,
      });
      setSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings.";
      setErrorMessage(msg);
    }
  };

  const handleReset = () => {
    if (confirm("Reset merchant limits to default values (50 / 500)?")) {
      const reset = resetMerchantSettings();
      setSettings(reset);
      setVoucherAmountInput(reset.maxOfflineVoucherAmountXlm.toString());
      setTotalExposureInput(reset.maxTotalOfflineExposureXlm.toString());
      setRequirePayee(reset.requirePayeeMatch);
      setSaveSuccess(true);
      setErrorMessage(null);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

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
          <form onSubmit={handleSave} className="space-y-5 border-t border-zinc-800 pt-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
                Offline Risk Limits
              </h2>
              <span className="text-[10px] font-mono text-zinc-500 uppercase bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                PERSISTED LOCALLY
              </span>
            </div>

            {errorMessage && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-800 rounded text-xs text-rose-300">
                {errorMessage}
              </div>
            )}

            {saveSuccess && (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-800 rounded text-xs text-emerald-300">
                ✓ Merchant limits successfully saved and active.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Maximum Offline Voucher Amount (USDC / XLM)
              </label>
              <input
                type="number"
                step="any"
                min="0.1"
                value={voucherAmountInput}
                onChange={(e) => setVoucherAmountInput(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
              <span className="text-xs text-zinc-400 mt-1 block">
                Any offline voucher presented with an amount higher than this limit will be rejected immediately.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Maximum Total Offline Exposure (USDC / XLM)
              </label>
              <input
                type="number"
                step="any"
                min="1"
                value={totalExposureInput}
                onChange={(e) => setTotalExposureInput(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
              <span className="text-xs text-zinc-400 mt-1 block">
                Ceiling on cumulative unredeemed vouchers stored in the offline queue.
              </span>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition shadow"
              >
                Save Settings
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs font-medium transition"
              >
                Reset to Defaults
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">Terminal Security: </span>
        Offline limit checks run entirely locally without requiring internet or registry lookups.
      </div>
    </div>
  );
}
