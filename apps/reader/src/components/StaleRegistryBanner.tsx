"use client";

import React from "react";
import { getRegistryStalenessInfo } from "../lib/registryStaleness";

interface StaleRegistryBannerProps {
  lastSyncedAt: number | null | undefined;
  onSync?: () => void;
  isSyncing?: boolean;
}

export function StaleRegistryBanner({
  lastSyncedAt,
  onSync,
  isSyncing = false,
}: StaleRegistryBannerProps) {
  const info = getRegistryStalenessInfo(lastSyncedAt);

  if (info.status === "fresh") {
    return null;
  }

  if (info.status === "unsynced") {
    return (
      <div
        role="alert"
        className="p-4 bg-rose-950/40 border border-rose-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-200"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-rose-400 uppercase tracking-wide">
              No Registry Snapshot Cached
            </span>
          </div>
          <p className="text-rose-300/90 text-xs">
            The merchant reader cannot verify offline vouchers until an initial snapshot is downloaded from the indexer service.
          </p>
        </div>
        {onSync && (
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded font-medium text-xs whitespace-nowrap self-start sm:self-auto transition"
          >
            {isSyncing ? "Syncing..." : "Sync Initial Registry"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="p-4 bg-amber-950/40 border border-amber-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold">⚠️ Warning: Stale Registry Snapshot</span>
          <span className="text-[10px] font-mono bg-amber-900/60 text-amber-300 px-1.5 py-0.5 rounded border border-amber-700">
            Last synced {info.formattedAge}
          </span>
        </div>
        <p className="text-amber-300/90 text-xs max-w-xl">
          Snapshot is older than {info.thresholdHours} hours. Offline verification risks accepting vouchers for notes that may have already been redeemed or refunded on-chain.
        </p>
      </div>

      {onSync && (
        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing}
          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded font-medium text-xs whitespace-nowrap self-start sm:self-auto transition"
        >
          {isSyncing ? "Syncing..." : "Sync Fresh Snapshot"}
        </button>
      )}
    </div>
  );
}

