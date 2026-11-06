"use client";

import React, { useState, useEffect } from "react";
import { getLatestRegistrySnapshot } from "../../lib/storage";
import { StaleRegistryBanner } from "../../components/StaleRegistryBanner";
import { fetchRegistrySnapshot } from "../../lib/registryClient";
import { saveRegistrySnapshot } from "../../lib/storage";

export default function ScanPage() {
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    getLatestRegistrySnapshot()
      .then((record) => {
        if (record) {
          setLastSyncedAt(record.lastSyncedAt);
        }
      })
      .catch(() => {});
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const snap = await fetchRegistrySnapshot();
      const saved = await saveRegistrySnapshot(snap, Date.now());
      setLastSyncedAt(saved.lastSyncedAt);
    } catch {
      // noop
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <StaleRegistryBanner
        lastSyncedAt={lastSyncedAt}
        onSync={handleSync}
        isSyncing={isSyncing}
      />

      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <h1 className="text-xl font-bold text-zinc-100">Scan Shopper Voucher</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Point camera at the shopper&apos;s QR voucher code to verify authenticity offline.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center p-12 border-2 border-dashed border-zinc-700 rounded-lg bg-zinc-950">
          <div className="w-64 h-64 border-2 border-emerald-500/50 rounded-lg flex items-center justify-center text-zinc-500 text-xs text-center p-4">
            [Camera Viewfinder Placeholder]
          </div>
          <span className="text-xs text-zinc-400 mt-4">
            Camera permissions will be requested on scan activation
          </span>
        </div>
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">STUB: </span>
        {/* TODO: Integrate BarcodeDetector or html5-qrcode camera capture, decode wire string, and invoke verifyVoucher from @kerfvault/sdk */}
        Camera scanner capture, QR decoding, and offline signature + registry verification pipeline.
      </div>
    </div>
  );
}
