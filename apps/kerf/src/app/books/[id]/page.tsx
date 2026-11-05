export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-100">Book #{id} Details</h1>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
            TESTNET ONLY
          </span>
        </div>
        <p className="text-zinc-400 mt-1 text-sm">
          Overview of notes, spent vouchers, and deadline on Stellar Testnet.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div className="bg-zinc-800/50 p-3 rounded">
            <span className="text-zinc-500 text-xs block">Status</span>
            <span className="text-emerald-400 font-semibold">Active</span>
          </div>
          <div className="bg-zinc-800/50 p-3 rounded">
            <span className="text-zinc-500 text-xs block">Unspent Notes</span>
            <span className="text-zinc-200 font-semibold">3 / 5</span>
          </div>
        </div>
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">Notice: </span>
        All book note balances and redemption locks exist exclusively on Stellar Testnet.
      </div>
    </div>
  );
}
