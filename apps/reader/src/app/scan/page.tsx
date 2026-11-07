"use client";

import React, { useState, useEffect } from "react";
import { getLatestRegistrySnapshot } from "../../lib/storage";
import { StaleRegistryBanner } from "../../components/StaleRegistryBanner";
import { fetchRegistrySnapshot } from "../../lib/registryClient";
import { saveRegistrySnapshot } from "../../lib/storage";
import { CameraQRScanner } from "../../components/CameraQRScanner";
import { PastePayloadInput } from "../../components/PastePayloadInput";
import { parseAndGateVoucher, DecodedVoucherResult } from "../../lib/voucherDecoder";
import { DecodedVoucherView } from "../../components/DecodedVoucherView";

export default function ScanPage() {
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [scanResult, setScanResult] = useState<DecodedVoucherResult | null>(null);
  const [scanMode, setScanMode] = useState<"camera" | "paste">("camera");

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
    const result = parseAndGateVoucher(payload);
    setScanResult(result);
  };

  const handleResetScan = () => {
    setScanResult(null);
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
          Capture or paste the shopper&apos;s QR voucher payload to verify authenticity offline.
        </p>

        {scanResult ? (
          <DecodedVoucherView result={scanResult} onReset={handleResetScan} />
        ) : (
          <div className="space-y-6">
            <div className="flex border-b border-zinc-800">
              <button
                type="button"
                onClick={() => setScanMode("camera")}
                className={`pb-3 px-4 text-xs font-medium border-b-2 transition ${
                  scanMode === "camera"
                    ? "border-emerald-500 text-emerald-400 font-semibold"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                📷 Camera Scanner
              </button>
              <button
                type="button"
                onClick={() => setScanMode("paste")}
                className={`pb-3 px-4 text-xs font-medium border-b-2 transition ${
                  scanMode === "paste"
                    ? "border-emerald-500 text-emerald-400 font-semibold"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                📋 Paste Payload (Desktop Demo)
              </button>
            </div>

            {scanMode === "camera" ? (
              <CameraQRScanner onScan={handleScanSuccess} />
            ) : (
              <PastePayloadInput onSubmit={handleScanSuccess} />
            )}
          </div>
        )}
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">Offline Verification: </span>
        Voucher QR scanning and verification pipeline executes 100% in-browser without sending camera streams or payloads to external servers.
      </div>
    </div>
  );
}
