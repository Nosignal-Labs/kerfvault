"use client";

import React, { useState } from "react";
import { useMerchantWallet } from "../lib/MerchantWalletContext";

export function MerchantWalletOnboarding() {
  const {
    isLoaded,
    hasWallet,
    isUnlocked,
    merchantAddress,
    createWallet,
    importWallet,
    unlockWallet,
    lockWallet,
    resetWallet,
    error,
    clearError,
  } = useMerchantWallet();

  const [mode, setMode] = useState<"unlock" | "create" | "import">("create");
  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isLoaded) {
    return (
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-lg animate-pulse text-zinc-400 text-sm">
        Loading merchant terminal wallet...
      </div>
    );
  }

  const handleCopy = () => {
    if (merchantAddress) {
      navigator.clipboard.writeText(merchantAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (passcode.length < 6) {
      alert("Passcode must be at least 6 characters.");
      return;
    }
    if (passcode !== confirmPasscode) {
      alert("Passcodes do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createWallet(passcode);
      setPasscode("");
      setConfirmPasscode("");
    } catch {
      // handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!secretKey.trim().startsWith("S")) {
      alert("Stellar secret keys begin with 'S'.");
      return;
    }
    if (passcode.length < 6) {
      alert("Passcode must be at least 6 characters.");
      return;
    }
    setIsSubmitting(true);
    try {
      await importWallet(secretKey.trim(), passcode);
      setPasscode("");
      setSecretKey("");
    } catch {
      // handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);
    try {
      await unlockWallet(passcode);
      setPasscode("");
    } catch {
      // handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  // If wallet exists and is unlocked
  if (hasWallet && isUnlocked && merchantAddress) {
    return (
      <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Merchant Wallet Unlocked
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={lockWallet}
              className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded bg-zinc-800 transition"
            >
              Lock
            </button>
            <button
              onClick={() => {
                if (confirm("Reset merchant wallet? This deletes the encrypted key from this browser.")) {
                  resetWallet();
                }
              }}
              className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded bg-rose-950/40 border border-rose-900/50 transition"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-zinc-500 font-mono block">MERCHANT ADDRESS (PAYEE)</span>
          <div className="flex items-center justify-between bg-zinc-950 px-3 py-2 rounded border border-zinc-800 text-xs font-mono">
            <span className="text-zinc-300 truncate mr-2">{merchantAddress}</span>
            <button
              onClick={handleCopy}
              className="text-emerald-400 hover:text-emerald-300 shrink-0 font-medium text-[11px]"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If wallet exists but is locked
  if (hasWallet && !isUnlocked) {
    return (
      <div className="p-5 bg-zinc-900/80 border border-zinc-800 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Unlock Merchant Terminal</h3>
          </div>
          <button
            onClick={() => {
              if (confirm("Reset merchant wallet? This deletes the encrypted key from this browser.")) {
                resetWallet();
              }
            }}
            className="text-[11px] text-zinc-500 hover:text-rose-400"
          >
            Reset
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-950/40 border border-rose-800 rounded text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Passcode</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !passcode}
            className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-medium text-xs transition"
          >
            {isSubmitting ? "Decrypting Key..." : "Unlock Merchant Terminal"}
          </button>
        </form>
      </div>
    );
  }

  // Wallet does not exist: offer Create or Import
  return (
    <div className="p-5 bg-zinc-900/80 border border-zinc-800 rounded-lg space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Merchant Terminal Setup</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configure your merchant Stellar keypair to receive offline voucher redemptions.
          </p>
        </div>
        <div className="flex gap-1 bg-zinc-950 p-1 rounded border border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setMode("create");
              clearError();
            }}
            className={`px-2.5 py-1 text-xs rounded transition ${
              mode === "create"
                ? "bg-emerald-600 text-white font-medium"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            New
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("import");
              clearError();
            }}
            className={`px-2.5 py-1 text-xs rounded transition ${
              mode === "import"
                ? "bg-emerald-600 text-white font-medium"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Import
          </button>
        </div>
      </div>

      {error && (
        <div className="p-2.5 bg-rose-950/40 border border-rose-800 rounded text-xs text-rose-300">
          {error}
        </div>
      )}

      {mode === "create" ? (
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Set Passcode (min 6 characters)</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Passcode"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Confirm Passcode</label>
            <input
              type="password"
              value={confirmPasscode}
              onChange={(e) => setConfirmPasscode(e.target.value)}
              placeholder="Confirm passcode"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || passcode.length < 6 || passcode !== confirmPasscode}
            className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-medium text-xs transition"
          >
            {isSubmitting ? "Generating..." : "Generate Encrypted Merchant Wallet"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleImport} className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Stellar Secret Key (S...)</label>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="S..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Protect with Passcode</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Passcode"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !secretKey || passcode.length < 6}
            className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-medium text-xs transition"
          >
            {isSubmitting ? "Importing..." : "Import & Encrypt Merchant Wallet"}
          </button>
        </form>
      )}
    </div>
  );
}

