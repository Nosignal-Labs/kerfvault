"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PayForm } from "../../components/PayForm";
import { VoucherQRDisplay } from "../../components/VoucherQRDisplay";
import { useWallet } from "../../lib/WalletContext";
import { unlockStoredVoucherKey } from "../../lib/voucherKey";
import {
  generateAndSignVoucher,
  type GenerateVoucherResult,
} from "../../lib/voucherSigner";
import type { VoucherInputParams } from "../../lib/voucherParams";
import type { OfflineBook } from "../../lib/offlineSigningStore";

function PayPageContent() {
  const searchParams = useSearchParams();
  const initialBookId = searchParams.get("bookId") || undefined;
  const noteIndexParam = searchParams.get("noteIndex");
  const initialNoteIndex = noteIndexParam !== null ? parseInt(noteIndexParam, 10) : undefined;

  const { voucherSecret, unlockWallet } = useWallet();

  const [preparedParams, setPreparedParams] = useState<{
    params: VoucherInputParams;
    book: OfflineBook;
  } | null>(null);

  const [signedResult, setSignedResult] = useState<GenerateVoucherResult | null>(null);
  const [passcode, setPasscode] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);

  const handleProceed = (params: VoucherInputParams, book: OfflineBook) => {
    setPreparedParams({ params, book });
    setSignedResult(null);
    setSigningError(null);
  };

  const handleReset = () => {
    setPreparedParams(null);
    setSignedResult(null);
    setSigningError(null);
    setPasscode("");
  };

  const handleSign = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!preparedParams) return;

    setIsSigning(true);
    setSigningError(null);

    try {
      let secretToUse = voucherSecret;

      // If voucher secret is not in memory, unlock it with user passcode
      if (!secretToUse) {
        if (!passcode) {
          throw new Error("Please enter your passcode to unlock and sign with your voucher key.");
        }
        try {
          const session = await unlockStoredVoucherKey(passcode);
          secretToUse = session.secret;
          // Also unlock the wallet context session if possible
          await unlockWallet(passcode).catch(() => {});
        } catch {
          throw new Error("Incorrect passcode. Could not decrypt voucher signing key.");
        }
      }

      if (!secretToUse) {
        throw new Error("Voucher signing key is unavailable.");
      }

      const result = await generateAndSignVoucher(
        preparedParams.params,
        preparedParams.book,
        secretToUse
      );

      setSignedResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign voucher.";
      setSigningError(msg);
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              ← Back
            </Link>
            <h1 className="text-xl font-bold text-zinc-100">Present Payment Voucher</h1>
          </div>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
            TESTNET ONLY
          </span>
        </div>
        <p className="text-zinc-400 mt-1 text-sm mb-6">
          Pick an available note from your local books, set merchant payee, spending cap, and expiry to present an offline voucher.
        </p>

        {signedResult && preparedParams ? (
          <VoucherQRDisplay
            voucher={signedResult.voucher}
            wirePayload={signedResult.wirePayload}
            book={preparedParams.book}
            params={preparedParams.params}
            onDone={handleReset}
          />
        ) : preparedParams ? (
          <div className="space-y-5">
            <div className="p-4 bg-zinc-950 border border-sky-800/80 rounded-lg space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-sky-400 uppercase tracking-wider">
                <span>Voucher Parameters Configured</span>
                <span className="text-zinc-400 font-mono">Book #{preparedParams.params.bookId}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">NOTE INDEX</span>
                  <span className="font-mono text-zinc-200 font-semibold">
                    Note #{preparedParams.params.noteIndex}
                  </span>
                </div>

                <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">AMOUNT</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {preparedParams.params.amountXlm} XLM
                  </span>
                </div>

                <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">SPENDING CAP</span>
                  <span className="font-mono text-zinc-200">
                    {preparedParams.params.capXlm} XLM
                  </span>
                </div>

                <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">EXPIRES (ACCEPT UNTIL)</span>
                  <span className="font-mono text-zinc-200">
                    {new Date(preparedParams.params.acceptUntil * 1000).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800 text-xs">
                <span className="text-zinc-500 block text-[10px]">MERCHANT PAYEE</span>
                <span className="font-mono text-zinc-200 break-all text-[11px]">
                  {preparedParams.params.merchant}
                </span>
              </div>
            </div>

            {signingError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded text-rose-300 text-xs">
                {signingError}
              </div>
            )}

            {!voucherSecret && (
              <div className="space-y-2 p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
                <label className="block text-xs font-medium text-zinc-300">
                  Enter Wallet Passcode to Sign Voucher
                </label>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter passcode"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500 font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSign();
                  }}
                />
                <span className="text-[11px] text-zinc-500 block">
                  Required to decrypt your offline Ed25519 signing key securely in WebCrypto.
                </span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-xs text-white rounded font-medium transition"
              >
                ← Edit Parameters
              </button>

              <button
                type="button"
                onClick={() => handleSign()}
                disabled={isSigning}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-medium text-xs transition shadow-lg flex items-center justify-center gap-2"
              >
                {isSigning ? (
                  <>
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full" />
                    Signing Voucher Offline...
                  </>
                ) : (
                  "Sign Voucher & Show QR Code →"
                )}
              </button>
            </div>
          </div>
        ) : (
          <PayForm
            initialBookId={initialBookId}
            initialNoteIndex={initialNoteIndex}
            onProceed={handleProceed}
          />
        )}
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">Offline Guarantee: </span>
        Vouchers are signed locally using your browser-stored Ed25519 voucher key without requiring internet or Soroban RPC access.
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/40 animate-pulse text-zinc-400 text-sm">
          Loading payment screen...
        </div>
      }
    >
      <PayPageContent />
    </Suspense>
  );
}
