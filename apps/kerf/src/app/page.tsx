import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <h1 className="text-2xl font-bold text-zinc-100">Shopper Wallet</h1>
        <p className="text-zinc-400 mt-2">
          Reserve funds into note books while online, then sign and present vouchers offline.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/books/new"
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded font-medium text-sm"
          >
            Open New Book
          </Link>
          <Link
            href="/pay"
            className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 rounded font-medium text-sm text-zinc-200"
          >
            Pay Merchant (QR)
          </Link>
        </div>
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">STUB: </span>
        {/* TODO: Connect to local IndexedDB to display list of active voucher books and remaining unspent notes */}
        Active books list and wallet balance placeholder.
      </div>
    </div>
  );
}
