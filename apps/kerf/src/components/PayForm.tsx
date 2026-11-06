"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  DEMO_MERCHANT_ADDRESS,
  EXPIRY_OPTIONS,
  validateVoucherParams,
  type VoucherInputParams,
} from "../lib/voucherParams";
import {
  getOfflineBooks,
  type OfflineBook,
  type OfflineNote,
} from "../lib/offlineSigningStore";
import { getStoredBooks } from "../lib/booksStore";

interface PayFormProps {
  initialBookId?: string;
  initialNoteIndex?: number;
  onProceed?: (params: VoucherInputParams, book: OfflineBook) => void;
}

export function PayForm({
  initialBookId,
  initialNoteIndex,
  onProceed,
}: PayFormProps) {
  const [offlineBooks, setOfflineBooks] = useState<OfflineBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>(initialBookId || "");
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number>(
    initialNoteIndex !== undefined ? initialNoteIndex : -1
  );
  const [merchant, setMerchant] = useState(DEMO_MERCHANT_ADDRESS);
  const [capXlm, setCapXlm] = useState<number>(0);
  const [expiryOptionId, setExpiryOptionId] = useState<string>("24h");
  const [customAcceptUntil, setCustomAcceptUntil] = useState<number>(0);

  // Load available books on mount
  useEffect(() => {
    let books = getOfflineBooks();
    if (books.length === 0) {
      // Fallback: build from stored books if offline cache not populated yet
      const stored = getStoredBooks();
      books = stored.map((s) => ({
        bookId: s.id,
        contractId: process.env.NEXT_PUBLIC_CONTRACT_ID || "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
        voucherPublicKey: s.voucherPublicKey,
        tokenAddress: s.tokenAddress,
        redeemDeadline: s.redeemDeadline,
        notes: s.denominations.map((d, i) => ({
          index: i,
          denominationXlm: d,
          denominationStroops: s.denominationsStroops[i] || (BigInt(d) * 10_000_000n).toString(),
          status: "available",
        })),
        updatedAt: s.createdAt,
      }));
    }
    setOfflineBooks(books);

    // Default book selection if not provided
    if (!initialBookId && books.length > 0) {
      setSelectedBookId(books[0].bookId);
    }
  }, [initialBookId]);

  const selectedBook = useMemo(() => {
    return offlineBooks.find((b) => b.bookId === selectedBookId) || null;
  }, [offlineBooks, selectedBookId]);

  const availableNotes = useMemo(() => {
    if (!selectedBook) return [];
    return selectedBook.notes.filter((n) => n.status === "available");
  }, [selectedBook]);

  // When book changes, auto-select first available note
  useEffect(() => {
    if (availableNotes.length > 0) {
      if (selectedNoteIndex < 0 || !availableNotes.some((n) => n.index === selectedNoteIndex)) {
        setSelectedNoteIndex(availableNotes[0].index);
      }
    } else {
      setSelectedNoteIndex(-1);
    }
  }, [selectedBookId, availableNotes, selectedNoteIndex]);

  const selectedNote = useMemo(() => {
    return selectedBook?.notes.find((n) => n.index === selectedNoteIndex) || null;
  }, [selectedBook, selectedNoteIndex]);

  // Sync cap with note denomination when note changes
  useEffect(() => {
    if (selectedNote) {
      setCapXlm(selectedNote.denominationXlm);
    }
  }, [selectedNote]);

  // Compute acceptUntil based on selected expiry preset
  const acceptUntil = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const option = EXPIRY_OPTIONS.find((o) => o.id === expiryOptionId);
    if (!option) return now + 86400;

    let seconds = option.secondsFromNow(selectedBook?.redeemDeadline);
    let target = now + seconds;

    if (selectedBook && target > selectedBook.redeemDeadline) {
      target = selectedBook.redeemDeadline;
    }
    return target;
  }, [expiryOptionId, selectedBook]);

  const amountXlm = selectedNote ? selectedNote.denominationXlm : 0;

  const validation = useMemo(() => {
    if (!selectedBook || !selectedNote) {
      return { valid: false, errors: ["Please select an available note to spend."] };
    }
    return validateVoucherParams(
      {
        bookId: selectedBookId,
        noteIndex: selectedNoteIndex,
        merchant,
        amountXlm,
        capXlm,
        acceptUntil,
      },
      selectedBook.redeemDeadline
    );
  }, [selectedBook, selectedNote, selectedBookId, selectedNoteIndex, merchant, amountXlm, capXlm, acceptUntil]);

  const handlePasteMerchant = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setMerchant(text.trim());
      }
    } catch {
      // Clipboard permissions denied
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid || !selectedBook || !selectedNote) return;

    const params: VoucherInputParams = {
      bookId: selectedBookId,
      noteIndex: selectedNoteIndex,
      merchant: merchant.trim(),
      amountXlm,
      capXlm,
      acceptUntil,
    };

    onProceed?.(params, selectedBook);
  };

  if (offlineBooks.length === 0) {
    return (
      <div className="p-8 border border-dashed border-zinc-800 rounded-lg text-center space-y-3 bg-zinc-950/60">
        <div className="text-zinc-300 font-medium">No Voucher Books Found</div>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          You need an open voucher book before you can sign and present offline vouchers to merchants.
        </p>
        <Link
          href="/books/new"
          className="inline-block px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded text-xs font-medium transition"
        >
          Open a Book on Testnet →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Step 1: Book & Note Selection */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
          1. Select Note to Spend
        </label>

        {/* Book Selector Tabs */}
        {offlineBooks.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {offlineBooks.map((b) => (
              <button
                key={b.bookId}
                type="button"
                onClick={() => setSelectedBookId(b.bookId)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition ${
                  b.bookId === selectedBookId
                    ? "bg-sky-600/20 border-sky-500 text-sky-200"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                Book #{b.bookId}
              </button>
            ))}
          </div>
        )}

        {/* Available Notes in Selected Book */}
        {availableNotes.length === 0 ? (
          <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-lg text-xs text-zinc-400 italic">
            All notes in Book #{selectedBookId} are already spent or redeemed.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {availableNotes.map((note) => {
              const isSelected = note.index === selectedNoteIndex;
              return (
                <button
                  key={note.index}
                  type="button"
                  onClick={() => setSelectedNoteIndex(note.index)}
                  className={`p-3 rounded-lg border text-left transition ${
                    isSelected
                      ? "bg-sky-950/80 border-sky-500 ring-1 ring-sky-500"
                      : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                    <span>Note #{note.index}</span>
                    <span className="text-emerald-400 font-semibold">AVAILABLE</span>
                  </div>
                  <div className="text-base font-bold text-zinc-100 mt-1">
                    {note.denominationXlm} XLM
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2: Payee (Merchant Address) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            2. Payee (Merchant Address)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePasteMerchant}
              className="text-[11px] text-sky-400 hover:text-sky-300"
            >
              Paste
            </button>
            <span className="text-zinc-600">|</span>
            <button
              type="button"
              onClick={() => setMerchant(DEMO_MERCHANT_ADDRESS)}
              className="text-[11px] text-zinc-400 hover:text-zinc-200"
            >
              Use Demo Merchant
            </button>
          </div>
        </div>

        <input
          type="text"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="G..."
          className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-sky-500"
        />
        <p className="text-[11px] text-zinc-500">
          The merchant will verify that their reader address matches this payee before accepting the voucher.
        </p>
      </div>

      {/* Step 3: Cap & Amount */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1">
            3. Voucher Amount
          </label>
          <input
            type="text"
            readOnly
            value={`${amountXlm} XLM`}
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-400 cursor-not-allowed"
          />
          <span className="text-[10px] text-zinc-500 mt-0.5 block">
            Locked to backing note denomination
          </span>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1">
            4. Max Spending Cap
          </label>
          <input
            type="number"
            min={amountXlm}
            step="any"
            value={capXlm}
            onChange={(e) => setCapXlm(parseFloat(e.target.value) || 0)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-sky-500"
          />
          <span className="text-[10px] text-zinc-500 mt-0.5 block">
            Must be &ge; voucher amount ({amountXlm} XLM)
          </span>
        </div>
      </div>

      {/* Step 4: Expiry (accept_until) */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
          5. Voucher Expiry (accept_until)
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {EXPIRY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setExpiryOptionId(opt.id)}
              className={`py-2 px-3 rounded text-xs font-medium border text-center transition ${
                expiryOptionId === opt.id
                  ? "bg-sky-600/20 border-sky-500 text-sky-200"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs space-y-1">
          <div className="flex justify-between text-zinc-400">
            <span>Accept Until (UTC):</span>
            <span className="font-mono text-zinc-200">
              {new Date(acceptUntil * 1000).toUTCString()}
            </span>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>UNIX Timestamp:</span>
            <span className="font-mono text-zinc-400">{acceptUntil}</span>
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {!validation.valid && (
        <div className="bg-red-950/30 border border-red-900/50 p-3 rounded-lg space-y-1">
          {validation.errors.map((err, i) => (
            <div key={i} className="text-xs text-red-400 flex items-center gap-1.5">
              <span>⚠</span>
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!validation.valid}
        className="w-full py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white rounded font-medium text-sm transition"
      >
        Sign & Generate Voucher ({amountXlm} XLM)
      </button>
    </form>
  );
}

