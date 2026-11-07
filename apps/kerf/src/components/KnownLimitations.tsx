import React from "react";

export const LIMITATION_ITEMS = [
  {
    title: "Testnet Prototype Only",
    badge: "CRITICAL",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    description:
      "This system runs exclusively on Stellar Testnet. It is not hardened for production or mainnet use, and real value funds must never be deposited.",
  },
  {
    title: "Unaudited Contracts & Protocols",
    badge: "SECURITY",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    description:
      "The Soroban smart contracts, Ed25519 signing scheme, and Merkle tree roots are pre-audit and designed solely for architectural demonstration.",
  },
  {
    title: "Fixed Denominations Per Book",
    badge: "DEMO SCOPE",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    description:
      "Each book holds notes of a uniform denomination. Arbitrary split change and dynamic note fragmentation are deferred to Phase 2.",
  },
  {
    title: "Reclaim & Clawback Deferred",
    badge: "ROADMAP",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    description:
      "Reclaiming unspent funds from expired books and on-chain fraud arbitration challenges are part of the second-half roadmap.",
  },
  {
    title: "Local Browser Storage",
    badge: "STORAGE",
    badgeColor: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
    description:
      "Voucher keys and book data are held in browser storage (IndexedDB/LocalStorage). Hardware Enclave/HSM integration is planned for future releases.",
  },
  {
    title: "Gas Sponsored via Relay",
    badge: "INFRASTRUCTURE",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    description:
      "Redemptions rely on the demo relay to pay Soroban transaction fees on testnet. Direct shopper-funded redemptions will be optional in Phase 2.",
  },
];

export function KnownLimitations() {
  return (
    <div className="space-y-4">
      <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-950/20 flex items-start gap-3">
        <span className="text-amber-400 text-lg font-bold">⚠</span>
        <div>
          <h3 className="text-sm font-semibold text-amber-200">Prototype Demo Notice</h3>
          <p className="text-xs text-amber-300/80 mt-1">
            KerfVault is an experimental prototype demonstrating offline-first digital cash vouchers on Stellar/Soroban.
            The limitations below are documented as intentional boundaries of the Phase S1–S7 demo slice.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {LIMITATION_ITEMS.map((item) => (
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

