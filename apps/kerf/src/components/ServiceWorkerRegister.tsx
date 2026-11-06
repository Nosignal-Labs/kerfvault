"use client";

import React, { useEffect, useState } from "react";

export function ServiceWorkerRegister() {
  const [isOffline, setIsOffline] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);

  useEffect(() => {
    // Sync initial online/offline status
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);

      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // Register the service worker
      if ("serviceWorker" in navigator && process.env.NODE_ENV !== "test") {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            setSwRegistered(true);
            // Check for updates periodically
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === "installed") {
                    if (navigator.serviceWorker.controller) {
                      console.log("[Kerfvault] New app shell available; cached for offline use.");
                    }
                  }
                };
              }
            };
          })
          .catch((error) => {
            console.warn("[Kerfvault] ServiceWorker registration failed:", error);
          });
      }

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-sky-950/90 border-b border-sky-800 text-sky-200 px-4 py-1.5 text-xs flex items-center justify-between"
    >
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold">✈ Airplane Mode Active</span>
        <span className="text-sky-300/80 hidden sm:inline">
          — App shell cached. Offline voucher signing is fully functional.
        </span>
      </div>
      <span className="text-[10px] font-mono uppercase bg-sky-900/60 px-1.5 py-0.5 rounded border border-sky-700">
        OFFLINE READY
      </span>
    </div>
  );
}

