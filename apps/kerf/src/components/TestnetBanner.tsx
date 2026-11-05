import React from "react";

/**
 * Permanent warning banner displayed across all screens indicating that
 * the application operates exclusively on Stellar Testnet with test funds.
 */
export function TestnetBanner() {
  return (
    <div
      role="alert"
      aria-label="Testnet warning banner"
      className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-2 text-xs font-medium text-center flex items-center justify-center gap-2"
    >
      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/25 border border-amber-500/40 text-amber-300">
        Testnet Only
      </span>
      <span>
        Testnet demo. Test funds only. Do not transfer or deposit real funds.
      </span>
    </div>
  );
}

