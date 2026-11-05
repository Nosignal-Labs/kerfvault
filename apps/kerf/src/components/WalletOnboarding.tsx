"use client";

import React, { useState } from "react";
import { useWallet } from "../lib/WalletContext";

export function WalletOnboarding() {
  const {
    isLoaded,
    hasWallet,
    isUnlocked,
    publicKey,
    error,
    createWallet,
    unlockWallet,
    lockWallet,
    resetWallet,
    clearError,
  } = useWallet();

  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  if (!isLoaded) {
    return (
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/40 animate-pulse text-zinc-400 text-sm">
        Loading wallet state...
      </div>
    );
  }

  const handleCopy = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (passcode.length < 6) {
      setLocalError("Passcode must be at least 6 characters.");
      return;
    }
    if (passcode !== confirmPasscode) {
      setLocalError("Passcodes do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      await createWallet(passcode);
      setPasscode("");
      setConfirmPasscode("");
    } catch {
      // Handled by context error state
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!passcode) {
      setLocalError("Please enter your passcode.");
      return;
    }

    try {
      setIsSubmitting(true);
      await unlockWallet(passcode);
      setPasscode("");
    } catch {
      // Handled by context error state
    } finally {
      setIsSubmitting(false);
    }
  };

  // State 1: Active & Unlocked
  if (hasWallet && isUnlocked && publicKey) {
    return (
      <div className="border border-emerald-800/60 bg-emerald-950/20 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-lg font-semibold text-zinc-100">Testnet Wallet Unlocked</h2>
          </div>
          <button
            type="button"
            onClick={lockWallet}
            className="text-xs px-3 py-1 border border-zinc-700 hover:border-zinc-500 rounded text-zinc-300 hover:text-white transition"
          >
            Lock
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-400 font-mono">PUBLIC ADDRESS (TESTNET)</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={publicKey}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium rounded text-zinc-200 shrink-0 transition"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
          <span className="text-xs text-zinc-500">In-browser demo keys only</span>
          {!showResetConfirm ? (
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="text-xs text-red-400 hover:text-red-300 transition"
            >
              Reset wallet
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">Wipe key?</span>
              <button
                type="button"
                onClick={() => {
                  resetWallet();
                  setShowResetConfirm(false);
                }}
                className="text-xs px-2 py-0.5 bg-red-800 hover:bg-red-700 text-white rounded"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="text-xs px-2 py-0.5 border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // State 2: Existing wallet, Locked
  if (hasWallet && !isUnlocked) {
    return (
      <div className="border border-zinc-800 bg-zinc-900/60 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Unlock Testnet Wallet</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Enter your passcode to unlock your Stellar testnet keys for this session.
          </p>
        </div>

        {publicKey && (
          <div className="text-xs text-zinc-400 font-mono bg-zinc-950/60 p-2.5 rounded border border-zinc-800 break-all">
            <span className="text-zinc-500 block text-[10px]">ADDRESS</span>
            {publicKey}
          </div>
        )}

        {(localError || error) && (
          <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 p-2.5 rounded">
            {localError || error}
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Passcode</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter your wallet passcode"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-sky-500"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !passcode}
            className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded font-medium text-sm transition"
          >
            {isSubmitting ? "Decrypting..." : "Unlock Wallet"}
          </button>
        </form>

        <div className="pt-2 border-t border-zinc-800/80 text-right">
          {!showResetConfirm ? (
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="text-xs text-zinc-500 hover:text-red-400 transition"
            >
              Forgot passcode? Reset wallet
            </button>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-red-400">Discard stored key?</span>
              <button
                type="button"
                onClick={() => {
                  resetWallet();
                  setShowResetConfirm(false);
                }}
                className="text-xs px-2 py-0.5 bg-red-800 hover:bg-red-700 text-white rounded"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="text-xs px-2 py-0.5 border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // State 3: No wallet yet (Create Wallet flow)
  return (
    <div className="border border-zinc-800 bg-zinc-900/60 rounded-lg p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-zinc-100">Create Testnet Wallet</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Kerf uses an in-browser demo wallet encrypted using WebCrypto PBKDF2/AES-GCM.
          Choose a passcode to secure your keys on this device.
        </p>
      </div>

      {(localError || error) && (
        <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 p-2.5 rounded">
          {localError || error}
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="text-xs text-zinc-400 block mb-1">Passcode (min 6 characters)</label>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Choose a passcode"
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-sky-500"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="text-xs text-zinc-400 block mb-1">Confirm Passcode</label>
          <input
            type="password"
            value={confirmPasscode}
            onChange={(e) => setConfirmPasscode(e.target.value)}
            placeholder="Re-enter passcode"
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-sky-500"
            disabled={isSubmitting}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !passcode || !confirmPasscode}
          className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded font-medium text-sm transition"
        >
          {isSubmitting ? "Generating & Encrypting..." : "Create Testnet Wallet"}
        </button>
      </form>
    </div>
  );
}

