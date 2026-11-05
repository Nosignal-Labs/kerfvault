"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  loadBookDetails,
  type BookDetailView,
} from "../../../lib/bookDetails";

export default function BookDetailPage() {
  const params = useParams();
  const bookId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [book, setBook] = useState<BookDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBook = useCallback(async () => {
    if (!bookId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await loadBookDetails(bookId);
      setBook(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load book.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    fetchBook();
  }, [fetchBook]);

  if (loading) {
    return (
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/40 animate-pulse space-y-4">
        <div className="h-6 w-36 bg-zinc-800 rounded" />
        <div className="h-4 w-64 bg-zinc-800/60 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="h-16 bg-zinc-800/40 rounded" />
          <div className="h-16 bg-zinc-800/40 rounded" />
          <div className="h-16 bg-zinc-800/40 rounded" />
          <div className="h-16 bg-zinc-800/40 rounded" />
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="border border-red-900/50 bg-red-950/20 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-100">Book #{bookId}</h1>
          <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200">
            ← Home
          </Link>
        </div>
        <div className="text-xs text-red-400 font-mono bg-red-950/40 p-3 rounded border border-red-900/60">
          {error || "Book not found."}
        </div>
        <button
          type="button"
          onClick={fetchBook}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs text-white rounded font-medium transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const deadlineDate = new Date(book.redeemDeadline * 1000);
  const isExpired = book.isExpired;

  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              ← Books
            </Link>
            <h1 className="text-xl font-bold text-zinc-100">Book #{book.id}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                isExpired
                  ? "bg-red-950/60 text-red-300 border-red-800"
                  : "bg-emerald-950/60 text-emerald-300 border-emerald-800"
              }`}
            >
              {isExpired ? "EXPIRED" : "ACTIVE"}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              {book.source === "chain" ? "CHAIN LIVE" : "CACHED"}
            </span>
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-zinc-950/70 border border-zinc-800/80 p-3 rounded-lg">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wide block">
              Total Locked
            </span>
            <span className="text-base font-bold text-zinc-100 mt-0.5 block">
              {book.totalLockedXlm.toLocaleString()} XLM
            </span>
          </div>

          <div className="bg-zinc-950/70 border border-zinc-800/80 p-3 rounded-lg">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wide block">
              Unspent
            </span>
            <span className="text-base font-bold text-emerald-400 mt-0.5 block">
              {book.unspentXlm.toLocaleString()} XLM
            </span>
          </div>

          <div className="bg-zinc-950/70 border border-zinc-800/80 p-3 rounded-lg">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wide block">
              Open Notes
            </span>
            <span className="text-base font-bold text-zinc-200 mt-0.5 block">
              {book.openNoteCount} / {book.noteCount}
            </span>
          </div>

          <div className="bg-zinc-950/70 border border-zinc-800/80 p-3 rounded-lg">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wide block">
              Redeem Deadline
            </span>
            <span className="text-xs font-mono text-zinc-300 mt-1 block truncate">
              {deadlineDate.toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-zinc-800/60">
          <Link
            href={`/pay?bookId=${book.id}`}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded font-medium text-xs transition"
          >
            Pay Merchant from this Book (QR)
          </Link>
          <button
            type="button"
            onClick={fetchBook}
            className="px-3 py-1.5 border border-zinc-700 hover:border-zinc-500 rounded text-xs text-zinc-300 hover:text-white transition"
          >
            ↻ Refresh Chain State
          </button>
        </div>

        {/* Notes Breakdown List */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Notes in this Book ({book.notes.length})
            </h2>
            <span className="text-[11px] text-zinc-500">
              Spendable offline via Ed25519 vouchers
            </span>
          </div>

          <div className="divide-y divide-zinc-800/80 border border-zinc-800 rounded-lg bg-zinc-950/50 overflow-hidden">
            {book.notes.map((note) => {
              const isOpen = note.state === "open";
              return (
                <div
                  key={note.index}
                  className="p-3.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-zinc-500 w-12">
                      #{note.index}
                    </span>
                    <span className="font-semibold text-zinc-200 text-sm">
                      {note.denominationXlm.toLocaleString()} XLM
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border uppercase ${
                        isOpen
                          ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/80"
                          : "bg-zinc-900 text-zinc-500 border-zinc-800"
                      }`}
                    >
                      {isOpen ? "OPEN" : "REDEEMED"}
                    </span>

                    {isOpen && !isExpired && (
                      <Link
                        href={`/pay?bookId=${book.id}&noteIndex=${note.index}`}
                        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded text-xs transition"
                      >
                        Present
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
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
