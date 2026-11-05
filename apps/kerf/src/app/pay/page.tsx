export default function PayPage() {
  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-100">Present Payment Voucher</h1>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
            TESTNET ONLY
          </span>
        </div>
        <p className="text-zinc-400 mt-1 text-sm">
          Select an available note and enter merchant details to generate an offline QR voucher for Stellar Testnet.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center p-8 border-2 border-dashed border-zinc-700 rounded-lg bg-zinc-950">
          <div className="w-48 h-48 bg-zinc-800 rounded flex items-center justify-center text-zinc-500 text-xs text-center p-4">
            [QR Code Display Placeholder]
          </div>
          <span className="text-xs text-zinc-400 mt-4">
            Merchant scans this offline with Kerfvault Reader
          </span>
        </div>
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">Testnet Notice: </span>
        Offline vouchers generated here are valid only for Stellar Testnet books and reader apps.
      </div>
    </div>
  );
}
