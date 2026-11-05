"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { WalletOnboarding } from "../components/WalletOnboarding";
import { useWallet } from "../lib/WalletContext";
import { getStoredBooks, type StoredBook } from "../lib/booksStore";

export default function HomePage() {
  const { isUnlocked } = useWallet();
  const [books, setBooks] = useState<StoredBook[]>([]);

  useEffect(() => {
    if (isUnlocked) {
      setBooks(getStoredBooks());
    } else {
      setBooks([]);
    }
  }, [isUnlocked]);

  return (
    <div className="space-y-6">
      <WalletOnboarding />

      {isUnlocked && (
        <>
          {/* Shopper Quick Actions */}
          <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
            <h1 className="text-xl font-bold text-zinc-100">Shopper Actions</h1>
            <p className="text-zinc-400 mt-1 text-sm">
              Reserve funds into note books while online, then sign and present vouchers offline.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/books/new"
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded font-medium text-sm transition"
              >
                + Open New Book
              </Link>
              <Link
                href="/pay"
                className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 rounded font-medium text-sm text-zinc-200 transition"
              >
                Pay Merchant (QR)
              </Link>
            </div>
          </div>

          {/* User's Note Books List */}
          <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-100">Your Voucher Books</h2>
              <span className="text-xs text-zinc-400 font-mono">
                {books.length} {books.length === 1 ? "book" : "books"}
              </span>
            </div>

            {books.length === 0 ? (
              <div className="p-6 border border-dashed border-zinc-800 rounded-lg text-center space-y-2 bg-zinc-950/40">
                <p className="text-sm text-zinc-400">
                  You haven&apos;t opened any voucher books yet.
                </p>
                <Link
                  href="/books/new"
                  className="inline-block text-xs font-semibold text-sky-400 hover:text-sky-300 transition"
                >
                  Open your first book →
                </Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {books.map((book) => {
                  const isExpired = Date.now() / 1000 > book.redeemDeadline;
                  return (
                    <div
                      key={book.id}
                      className="p-4 bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-100 text-sm">
                            Book #{book.id}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase ${
                              isExpired
                                ? "bg-red-950/50 text-red-300 border-red-800/60"
                                : "bg-emerald-950/50 text-emerald-300 border-emerald-800/60"
                            }`}
                          >
                            {isExpired ? "EXPIRED" : "ACTIVE"}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400">
                          {book.totalAmountXlm.toLocaleString()} XLM locked across{" "}
                          {book.denominations.length} notes: [{book.denominations.join(", ")} XLM]
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/books/${book.id}`}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium rounded text-zinc-200 hover:text-white transition"
                        >
                          View Notes
                        </Link>
                        {!isExpired && (
                          <Link
                            href={`/pay?bookId=${book.id}`}
                            className="px-3 py-1.5 bg-sky-600/80 hover:bg-sky-500 text-xs font-medium rounded text-white transition"
                          >
                            Pay (QR)
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
            <span className="font-semibold">Demo Notice: </span>
            Books and offline vouchers created in this browser only interact with Stellar Testnet.
          </div>
        </>
      )}
    </div>
  );
}
