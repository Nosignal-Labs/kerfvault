export default function ReaderSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <h1 className="text-xl font-bold text-zinc-100">Merchant Terminal Settings</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Configure offline risk limits and settlement accounts.
        </p>

        <form className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Merchant Payout Address
            </label>
            <input
              type="text"
              value="GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ"
              readOnly
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-xs font-mono text-zinc-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Maximum Offline Voucher Amount (USDC)
            </label>
            <input
              type="number"
              defaultValue="50"
              disabled
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-400"
            />
            <span className="text-xs text-zinc-500 mt-1 block">
              Vouchers with amounts exceeding this cap will be rejected offline.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Maximum Total Offline Exposure (USDC)
            </label>
            <input
              type="number"
              defaultValue="500"
              disabled
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-400"
            />
          </div>
        </form>
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">STUB: </span>
        {/* TODO: Persist merchant risk limits in IndexedDB via IReaderStorage and enforce caps during QR validation */}
        Configurable risk controls and offline exposure safety caps.
      </div>
    </div>
  );
}

