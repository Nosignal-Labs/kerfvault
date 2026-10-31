export default function NewBookPage() {
  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <h1 className="text-xl font-bold text-zinc-100">Open a Voucher Book</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Lock funds into a set of fixed-denomination notes to spend offline.
        </p>

        <form className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Token Address
            </label>
            <input
              type="text"
              placeholder="e.g. CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
              disabled
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Denominations (comma separated)
            </label>
            <input
              type="text"
              placeholder="e.g. 5, 10, 20, 50"
              disabled
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Redeem Deadline (Days)
            </label>
            <input
              type="number"
              placeholder="e.g. 7"
              disabled
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-400"
            />
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled
              className="w-full bg-sky-600/50 text-white/50 rounded py-2 font-medium text-sm cursor-not-allowed"
            >
              Confirm and Lock Funds (TODO)
            </button>
          </div>
        </form>
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">STUB: </span>
        {/* TODO: Implement open_book transaction building, Soroban auth, and keypair generation via @kerfvault/sdk */}
        Requires connecting Stellar wallet, funding contract via SEP-41, and generating offline ed25519 voucher key.
      </div>
    </div>
  );
}

