import React from "react";

export const READER_LIMITATION_ITEMS = [
  {
    title: "Testnet Prototype Only",
    badge: "CRITICAL",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    description:
      "This merchant terminal runs strictly on Stellar Testnet. It is not hardened for production or commercial use, and real monetary value must never be processed.",
  },
  {
    title: "Unaudited Contracts & Protocols",
    badge: "SECURITY",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    description:
      "The Soroban smart contract, Ed25519 offline verification algorithms, and Merkle tree roots are pre-audit and intended solely for architectural validation.",
  },
  {
    title: "Merchant Acceptance Caps",
    badge: "RISK BOUNDARY",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    description:
      "Merchants must set an acceptance cap to bound offline risk before settlement. Vouchers exceeding the merchant cap are rejected offline.",
  },
  {
    title: "Local Replay Protection",
    badge: "SCOPE",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    description:
      "Repeat scan prevention is enforced locally per reader terminal. Multi-device mesh synchronization and on-chain double-spend slashing are deferred to Phase 2.",
  },
  {
    title: "Relay Settlement Dependency",
    badge: "INFRASTRUCTURE",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    description:
      "Batch redemption depends on an available KerfVault relay to sponsor Soroban gas and submit settlement transactions to Stellar testnet.",
  },
  {
    title: "Browser Storage Persistence",
    badge: "STORAGE",
    badgeColor: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
    description:
      "Merchant keys, settings, and queued vouchers live in browser local storage. Hardware security module (HSM/POS terminal) integration is part of the future roadmap.",
  },
];

export function KnownLimitations() {
  return (
    <div className="space-y-4">
      <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-950/20 flex items-start gap-3">
        <span className="text-amber-400 text-lg font-bold">⚠</span>
        <div>
          <h3 className="text-sm font-semibold text-amber-200">Terminal Prototype Notice</h3>
          <p className="text-xs text-amber-300/80 mt-1">
            KerfVault Reader demonstrates offline merchant verification on Stellar/Soroban.
            The limitations below are documented as intentional boundaries of the Phase S1–S7 demo slice.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {READER_LIMITATION_ITEMS.map((item) => (
          <div
            key={item.title}
            className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-zinc-200">{item.title}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border ${item.badgeColor}`}
              >
                {item.badge}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

