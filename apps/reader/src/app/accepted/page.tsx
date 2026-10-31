export default function AcceptedVouchersPage() {
  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Accepted Vouchers</h1>
            <p className="text-zinc-400 mt-1 text-sm">
              Offline vouchers queued for on-chain settlement when online.
            </p>
          </div>
          <button
            type="button"
            disabled
            className="px-3 py-1.5 bg-emerald-600/50 text-white/50 rounded text-xs font-semibold cursor-not-allowed"
          >
            Redeem All (Online)
          </button>
        </div>

        <div className="mt-6 border border-zinc-800 rounded overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-800/80 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="p-3">Book ID</th>
                <th className="p-3">Note</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
              <tr>
                <td className="p-3 font-mono">#101</td>
                <td className="p-3">0</td>
                <td className="p-3">10.00 USDC</td>
                <td className="p-3 text-amber-400 font-medium">Accepted Offline</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">STUB: </span>
        {/* TODO: Query IndexedDB stored vouchers via IReaderStorage and trigger batch submission to fee-paying relay */}
        Local IndexedDB voucher list and background synchronization to redemption relay.
      </div>
    </div>
  );
}

