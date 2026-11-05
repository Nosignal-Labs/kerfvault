"use client";

import React, { useState, useMemo } from "react";
import {
  DEFAULT_TESTNET_TOKEN,
  DENOMINATION_PRESETS,
  DEADLINE_PRESETS,
  calculateDeadlineTimestamp,
  validateBookConfig,
  xlmToStroops,
  type BookConfiguration,
} from "../lib/bookConfig";
import { useWallet } from "../lib/WalletContext";

interface BookConfigFormProps {
  onSubmit?: (config: BookConfiguration) => void;
  isSubmitting?: boolean;
}

export function BookConfigForm({ onSubmit, isSubmitting = false }: BookConfigFormProps) {
  const { isUnlocked, balance, requestFunds, isFunding } = useWallet();

  const [tokenAddress, setTokenAddress] = useState(DEFAULT_TESTNET_TOKEN);
  const [denominations, setDenominations] = useState<number[]>([5, 10, 20, 50]);
  const [customNote, setCustomNote] = useState("");
  const [deadlineDays, setDeadlineDays] = useState(7);

  // Computed summary
  const totalXlm = useMemo(
    () => denominations.reduce((sum, d) => sum + (d > 0 ? d : 0), 0),
    [denominations]
  );

  const deadlineTimestamp = useMemo(
    () => calculateDeadlineTimestamp(deadlineDays),
    [deadlineDays]
  );

  const deadlineDateStr = useMemo(() => {
    return new Date(deadlineTimestamp * 1000).toUTCString();
  }, [deadlineTimestamp]);

  const validation = useMemo(() => {
    return validateBookConfig({
      tokenAddress,
      denominations,
      deadlineDays,
      walletBalance: balance,
    });
  }, [tokenAddress, denominations, deadlineDays, balance]);

  const handleApplyPreset = (presetDenominations: number[]) => {
    setDenominations([...presetDenominations]);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(customNote);
    if (!Number.isNaN(parsed) && parsed > 0) {
      if (denominations.length >= 50) return;
      setDenominations([...denominations, parsed]);
      setCustomNote("");
    }
  };

  const handleRemoveNote = (indexToRemove: number) => {
    setDenominations(denominations.filter((_, idx) => idx !== indexToRemove));
  };

  const handleClearAllNotes = () => {
    setDenominations([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid || isSubmitting) return;

    try {
      const denominationsInStroops = denominations.map((d) => xlmToStroops(d));
      const totalStroops = denominationsInStroops.reduce((sum, s) => sum + s, 0n);

      const config: BookConfiguration = {
        tokenAddress,
        denominations,
        deadlineDays,
        deadlineTimestamp,
        totalXlm,
        totalStroops,
        denominationsInStroops,
      };

      onSubmit?.(config);
    } catch (err: unknown) {
      console.error("Failed to build book configuration:", err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Wallet Balance Status Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-lg text-xs">
        <div>
          <span className="text-zinc-400">Available Wallet Balance: </span>
          <span className="font-semibold text-zinc-100">
            {balance !== null ? `${Number(balance).toLocaleString()} XLM` : "0.00 XLM (Unfunded)"}
          </span>
        </div>
        {(!balance || parseFloat(balance) < totalXlm) && (
          <button
            type="button"
            onClick={requestFunds}
            disabled={isFunding}
            className="px-3 py-1 bg-emerald-600/80 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-medium transition text-xs"
          >
            {isFunding ? "Funding..." : "Top Up via Faucet"}
          </button>
        )}
      </div>

      {/* Token Address Input */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Token Address (SAC)
          </label>
          <span className="text-[10px] text-zinc-500 font-mono">NATIVE TESTNET XLM</span>
        </div>
        <input
          type="text"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-sky-500"
          placeholder="C..."
        />
      </div>

      {/* Denominations Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Note Denominations
          </label>
          <span className="text-xs text-zinc-400 font-mono">
            {denominations.length} {denominations.length === 1 ? "note" : "notes"} | Total:{" "}
            <strong className="text-zinc-100">{totalXlm.toLocaleString()} XLM</strong>
          </span>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-zinc-500 self-center">Presets:</span>
          {DENOMINATION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset.denominations)}
              className="text-xs px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded text-zinc-300 hover:text-white transition"
            >
              {preset.name} ({preset.denominations.join(", ")})
            </button>
          ))}
          {denominations.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllNotes}
              className="text-xs px-2 py-1 text-zinc-500 hover:text-red-400 transition ml-auto"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Current Notes Chips */}
        <div className="min-h-16 p-3 bg-zinc-950/60 border border-zinc-800 rounded-lg flex flex-wrap gap-2 items-center">
          {denominations.length === 0 ? (
            <span className="text-xs text-zinc-500 italic">
              No notes selected. Choose a preset above or add custom denominations below.
            </span>
          ) : (
            denominations.map((denom, idx) => (
              <span
                key={`${denom}-${idx}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-950/60 border border-sky-800/80 text-sky-200 rounded text-xs font-mono"
              >
                <span>{denom} XLM</span>
                <button
                  type="button"
                  onClick={() => handleRemoveNote(idx)}
                  className="text-sky-400 hover:text-red-300 transition text-sm leading-none ml-1"
                  title="Remove note"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>

        {/* Add Custom Note Input */}
        <div className="flex gap-2">
          <input
            type="number"
            min="0.1"
            step="any"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="Add note amount (e.g. 15)"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-sky-500"
          />
          <button
            type="button"
            onClick={handleAddNote}
            disabled={!customNote || parseFloat(customNote) <= 0}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded text-xs font-medium transition"
          >
            + Add Note
          </button>
        </div>
      </div>

      {/* Redeem Deadline Section */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
          Redeem Deadline
        </label>

        {/* Deadline Preset Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DEADLINE_PRESETS.map((p) => {
            const isSelected = deadlineDays === p.days;
            return (
              <button
                key={p.days}
                type="button"
                onClick={() => setDeadlineDays(p.days)}
                className={`py-2 px-3 rounded text-xs font-medium border text-center transition ${
                  isSelected
                    ? "bg-sky-600/20 border-sky-500 text-sky-200"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Expiration Details Card */}
        <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-lg text-xs space-y-1">
          <div className="text-zinc-500 flex justify-between">
            <span>Calculated Expiry (UTC):</span>
            <span className="font-mono text-zinc-300">{deadlineDateStr}</span>
          </div>
          <div className="text-zinc-500 flex justify-between">
            <span>UNIX Timestamp:</span>
            <span className="font-mono text-zinc-400">{deadlineTimestamp}</span>
          </div>
          <p className="text-[11px] text-zinc-500 pt-1">
            After this deadline expires on-chain, merchants cannot redeem offline vouchers, and any unspent notes can be reclaimed by you.
          </p>
        </div>
      </div>

      {/* Validation Errors Display */}
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

      {/* Submit / Proceed Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={!validation.valid || isSubmitting || !isUnlocked}
          className="w-full py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white rounded font-medium text-sm transition"
        >
          {isSubmitting
            ? "Submitting Book..."
            : !isUnlocked
            ? "Unlock Wallet to Open Book"
            : `Lock ${totalXlm.toLocaleString()} XLM (${denominations.length} Notes)`}
        </button>
      </div>
    </form>
  );
}

