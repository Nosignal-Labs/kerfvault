export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <h1 className="text-xl font-bold text-zinc-100">Book #{id} Details</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Overview of notes, spent vouchers, and deadline.
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
        <span className="font-semibold">STUB: </span>
        {/* TODO: Query on-chain book status via @kerfvault/sdk and render note breakdown and reclaim button */}
        Detailed note breakdown, spend timestamps, and post-deadline reclaim flow.
      </div>
    </div>
  );
}

