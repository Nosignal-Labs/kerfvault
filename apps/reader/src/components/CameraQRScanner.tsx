"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface CameraQRScannerProps {
  onScan: (decodedText: string) => void;
  fps?: number;
  qrbox?: number;
}

export function CameraQRScanner({
  onScan,
  fps = 10,
  qrbox = 250,
}: CameraQRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "kerfvault-camera-viewfinder";

  // Check if camera devices exist on mount
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoDevices = devices.filter((d) => d.kind === "videoinput");
          setHasCamera(videoDevices.length > 0);
        })
        .catch(() => {
          setHasCamera(false);
        });
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn("[Scanner] Stop cleanup warning:", err);
      } finally {
        html5QrCodeRef.current = null;
        setIsScanning(false);
      }
    }
  }, []);

  const startScanner = useCallback(async () => {
    setCameraError(null);
    try {
      if (html5QrCodeRef.current?.isScanning) {
        await stopScanner();
      }

      const scanner = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps,
          qrbox: { width: qrbox, height: qrbox },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Success callback
          stopScanner();
          onScan(decodedText);
        },
        () => {
          // Periodic frame error callback (normal while waiting for QR in frame)
        }
      );

      setIsScanning(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to access camera.";
      setCameraError(
        msg.includes("Permission") || msg.includes("NotAllowedError")
          ? "Camera permission was denied. Please allow camera access in browser settings to scan QR codes."
          : `Camera initialization error: ${msg}`
      );
      setIsScanning(false);
    }
  }, [fps, qrbox, onScan, stopScanner]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(() => {});
          }
          html5QrCodeRef.current.clear();
        } catch {
          // ignore cleanup errors during unmount
        }
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Viewfinder Canvas Area */}
      <div className="relative overflow-hidden rounded-xl bg-zinc-950 border border-zinc-800 shadow-inner min-h-[300px] flex flex-col items-center justify-center p-4">
        <div
          id={scannerContainerId}
          className={`w-full max-w-sm rounded-lg overflow-hidden ${
            isScanning ? "block" : "hidden"
          }`}
        />

        {!isScanning && (
          <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-3xl text-emerald-400 shadow-md">
              📷
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-zinc-200">
                Camera Scanner Ready
              </h3>
              <p className="text-xs text-zinc-400 max-w-xs">
                Scan shopper payment voucher QR codes directly using your device&apos;s camera.
              </p>
            </div>

            {hasCamera === false && (
              <span className="text-[11px] text-amber-400 bg-amber-950/40 px-2.5 py-1 rounded border border-amber-800/60">
                No active video camera detected on this system.
              </span>
            )}

            <button
              type="button"
              onClick={startScanner}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-xs transition shadow-lg flex items-center gap-2"
            >
              <span>▶</span> Start Camera Scanner
            </button>
          </div>
        )}

        {isScanning && (
          <div className="mt-4 flex items-center justify-between w-full max-w-sm px-2">
            <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Scanning for QR code...
            </span>
            <button
              type="button"
              onClick={stopScanner}
              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs font-medium transition"
            >
              Stop Camera
            </button>
          </div>
        )}
      </div>

      {cameraError && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-xs text-rose-300 flex items-start justify-between gap-3">
          <p>{cameraError}</p>
          <button
            onClick={() => setCameraError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

