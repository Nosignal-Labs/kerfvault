"use client";

import React, { useState, useEffect } from "react";
import { getLatestRegistrySnapshot } from "../../lib/storage";
import { StaleRegistryBanner } from "../../components/StaleRegistryBanner";
import { fetchRegistrySnapshot } from "../../lib/registryClient";
import { saveRegistrySnapshot } from "../../lib/storage";
import { CameraQRScanner } from "../../components/CameraQRScanner";

export default function ScanPage() {
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);

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

  const handleScanSuccess = (payload: string) => {
    setScannedPayload(payload.trim());
  };

  const handleResetScan = () => {
    setScannedPayload(null);
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
        <p className="text-zinc-400 mt-1 text-sm mb-6">
          Point camera at the shopper&apos;s QR voucher code to verify authenticity offline.
        </p>

        {scannedPayload ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-950/30 border border-emerald-800/60 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  ✓ Voucher QR Captured
                </span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {scannedPayload.length} BYTES
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-mono block">RAW WIRE PAYLOAD</span>
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded font-mono text-xs text-zinc-300 break-all select-all">
                  {scannedPayload}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleResetScan}
                className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium transition"
              >
                Scan Another Voucher
              </button>
            </div>
          </div>
        ) : (
          <CameraQRScanner onScan={handleScanSuccess} />
        )}
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">Offline Verification: </span>
        Camera QR scanning and verification pipeline executes 100% in-browser without sending camera streams or payloads to external servers.
      </div>
    </div>
  );
}
