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
import {
  fetchRegistrySnapshot,
  type RegistryClientError,
} from "../lib/registryClient";
import {
  getLatestRegistrySnapshot,
  saveRegistrySnapshot,
} from "../lib/storage";
import type { RegistrySnapshot } from "@kerfvault/sdk";

export default function ReaderHomePage() {
  const [settings, setSettings] = useState<MerchantSettings>(DEFAULT_MERCHANT_SETTINGS);
  const [snapshot, setSnapshot] = useState<RegistrySnapshot | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  useEffect(() => {
    setSettings(getMerchantSettings());

    // Load previously persisted snapshot from IndexedDB on startup
    getLatestRegistrySnapshot()
      .then((record) => {
        if (record) {
          setSnapshot(record.snapshot);
          setLastSyncTime(record.lastSyncedAt);
        }
      })
      .catch(() => {
        // IndexedDB may not be ready yet or empty
      });
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const snap = await fetchRegistrySnapshot();
      const saved = await saveRegistrySnapshot(snap, Date.now());
      setSnapshot(saved.snapshot);
      setLastSyncTime(saved.lastSyncedAt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sync registry.";
      setSyncError(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const bookCount = snapshot?.books ? Object.keys(snapshot.books).length : 0;

  return (
    <div className="space-y-6">
      <MerchantWalletOnboarding />
      <TrustlineChecker />

      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <h1 className="text-2xl font-bold text-zinc-100">Merchant Terminal</h1>
        <p className="text-zinc-400 mt-2">
          Verify shopper payment vouchers offline against a synced registry snapshot.
        </p>

        {syncError && (
          <div className="mt-4 p-3 bg-rose-950/40 border border-rose-800 rounded text-xs text-rose-300 flex items-center justify-between">
            <span>{syncError}</span>
            <button
              onClick={handleSync}
              className="text-xs text-rose-200 underline hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          {/* Sync State Card */}
          <div className="bg-zinc-800/50 p-4 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 text-xs uppercase tracking-wider">Sync State</span>
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium disabled:opacity-50"
                >
                  {isSyncing ? "Syncing..." : "Sync Now"}
                </button>
              </div>

              {snapshot ? (
                <>
                  <span className="text-emerald-400 font-semibold text-base mt-1 block">
                    Registry Synced
                  </span>
                  <span className="text-zinc-400 text-xs mt-1 block font-mono">
                    Ledger #{snapshot.ledgerSequence} • {bookCount} Book{bookCount === 1 ? "" : "s"}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-zinc-400 font-medium text-base mt-1 block">
                    Unsynced
                  </span>
                  <span className="text-zinc-500 text-xs mt-1 block">
                    Connect to indexer to download snapshot
                  </span>
                </>
              )}
            </div>

            {lastSyncTime && (
              <span className="text-[10px] text-zinc-500 mt-2 block font-mono">
                Updated {new Date(lastSyncTime).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Offline Limit Card */}
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
