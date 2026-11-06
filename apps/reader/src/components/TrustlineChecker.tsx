"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useMerchantWallet } from "../lib/MerchantWalletContext";
import {
  checkTrustlineStatus,
  addMerchantTrustline,
  fundMerchantViaFriendbot,
  type TrustlineStatus,
} from "../lib/trustline";

export function TrustlineChecker() {
  const { merchantAddress, secret, isUnlocked, unlockWallet } = useMerchantWallet();

  const [status, setStatus] = useState<TrustlineStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stepMessage, setStepMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [showPasscodePrompt, setShowPasscodePrompt] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!merchantAddress) {
      setStatus(null);
      return;
    }
    setLoading(true);
    setActionError(null);
    try {
      const res = await checkTrustlineStatus(merchantAddress);
      setStatus(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error checking trustline";
      setActionError(msg);
    } finally {
      setLoading(false);
    }
  }, [merchantAddress]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleAddTrustline = useCallback(async (secretToUse: string) => {
    setSubmitting(true);
    setActionError(null);
    try {
      if (!status?.accountExists && merchantAddress) {
        setStepMessage("Funding merchant account via Friendbot...");
        await fundMerchantViaFriendbot(merchantAddress);
        // Give Horizon a moment to register ledger state
        await new Promise((r) => setTimeout(r, 2000));
      }

      setStepMessage("Submitting ChangeTrust transaction to Stellar Testnet...");
      await addMerchantTrustline(secretToUse);

      setStepMessage(null);
      setShowPasscodePrompt(false);
      setPasscode("");
      await checkStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to establish trustline.";
      setActionError(msg);
      setStepMessage(null);
    } finally {
      setSubmitting(false);
    }
  }, [checkStatus, merchantAddress, status?.accountExists]);

  const handleInitiate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!merchantAddress) return;

    if (secret) {
      await handleAddTrustline(secret);
    } else {
      if (!passcode) {
        setShowPasscodePrompt(true);
        return;
      }
      try {
        await unlockWallet(passcode);
        // unlockWallet sets context secret; we will call addTrustline after unlock
      } catch {
        setActionError("Incorrect passcode.");
        return;
      }
    }
  };

  // If secret became available via passcode unlock
  useEffect(() => {
    if (showPasscodePrompt && secret && submitting) {
      handleAddTrustline(secret);
    }
  }, [handleAddTrustline, secret, showPasscodePrompt, submitting]);

  if (!merchantAddress) {
    return null;
  }

  if (loading && !status) {
    return (
      <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 flex items-center gap-2">
        <span className="animate-spin inline-block w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full" />
        Checking KVUSD trustline status on Stellar Testnet...
      </div>
    );
  }

  // Trustline already active
  if (status?.hasTrustline) {
    return (
      <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-lg text-xs text-emerald-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold">✓</span>
          <span>
            <strong>{status.assetCode}</strong> Trustline Established
          </span>
          <span className="text-emerald-400/80 font-mono text-[11px]">
            (Balance: {status.balance} {status.assetCode})
          </span>
        </div>
        <button
          onClick={checkStatus}
          disabled={loading}
          className="text-[10px] text-zinc-400 hover:text-zinc-200 underline"
        >
          {loading ? "Checking..." : "Refresh"}
        </button>
      </div>
    );
  }

  // Trustline missing: display actionable alert
  return (
    <div className="p-4 bg-amber-950/30 border border-amber-800/60 rounded-lg space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
            Missing Token Trustline: {status?.assetCode || "KVUSD"}
          </span>
          <p className="text-xs text-amber-200/90 mt-1 max-w-lg">
            Your merchant terminal needs a trustline to the KVUSD issuer before token payouts from voucher redemptions can be received on-chain.
          </p>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
          ACTION REQUIRED
        </span>
      </div>

      {actionError && (
        <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded text-xs text-rose-300">
          {actionError}
        </div>
      )}

      {stepMessage && (
        <div className="p-2.5 bg-sky-950/50 border border-sky-800 rounded text-xs text-sky-300 flex items-center gap-2">
          <span className="animate-spin inline-block w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full" />
          {stepMessage}
        </div>
      )}

      {showPasscodePrompt && !secret ? (
        <form onSubmit={handleInitiate} className="space-y-2 pt-1">
          <label className="block text-xs text-zinc-300 font-medium">
            Enter Passcode to Sign ChangeTrust Transaction
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Merchant Passcode"
              className="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              required
            />
            <button
              type="submit"
              disabled={submitting || !passcode}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-medium transition"
            >
              {submitting ? "Submitting..." : "Confirm & Add"}
            </button>
            <button
              type="button"
              onClick={() => setShowPasscodePrompt(false)}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => handleInitiate()}
            disabled={submitting || loading}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-medium text-xs transition shadow flex items-center gap-2"
          >
            {submitting ? (
              <>
                <span className="animate-spin inline-block w-3 h-3 border-2 border-white/20 border-t-white rounded-full" />
                Setting up Trustline...
              </>
            ) : (
              "Add KVUSD Trustline Now →"
            )}
          </button>

          <button
            type="button"
            onClick={checkStatus}
            disabled={loading || submitting}
            className="text-xs text-zinc-400 hover:text-zinc-200 underline"
          >
            Recheck
          </button>
        </div>
      )}
    </div>
  );
}

