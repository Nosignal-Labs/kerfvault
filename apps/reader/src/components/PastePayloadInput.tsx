"use client";

import React, { useState } from "react";

export interface PastePayloadInputProps {
  onSubmit: (payload: string) => void;
  isLoading?: boolean;
}

/**
 * Validates and sanitizes a pasted wire payload string.
 */
export function sanitizePastedPayload(raw: string): {
  valid: boolean;
  payload?: string;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: "Voucher payload cannot be empty. Please paste a valid payload string.",
    };
  }

  // Basic sanity check: ensure no whitespace within the payload
  const withoutNewlines = trimmed.replace(/[\r\n\t ]+/g, "");
  if (!withoutNewlines) {
    return {
      valid: false,
      error: "Voucher payload contains only whitespace.",
    };
  }

  return {
    valid: true,
    payload: withoutNewlines,
  };
}

export function PastePayloadInput({ onSubmit, isLoading = false }: PastePayloadInputProps) {
  const [inputVal, setInputVal] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = sanitizePastedPayload(inputVal);
    if (!result.valid || !result.payload) {
      setError(result.error ?? "Invalid voucher payload");
      return;
    }

    onSubmit(result.payload);
  };

  const handleClear = () => {
    setInputVal("");
    setError(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="voucher-payload-input" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Pasted Voucher Payload
          </label>
          <span className="text-[10px] text-zinc-500 font-mono">
            Desktop / Manual Entry
          </span>
        </div>

        <p className="text-xs text-zinc-400">
          Paste the Base64 wire payload copied from the shopper QR code or test fixtures to verify vouchers without a webcam.
        </p>

        <textarea
          id="voucher-payload-input"
          value={inputVal}
          onChange={(e) => {
            setInputVal(e.target.value);
            if (error) setError(null);
          }}
          disabled={isLoading}
          rows={4}
          placeholder="Paste Base64 voucher payload here (e.g. AQEAAAAAAAAAAA...)..."
          className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-lg font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y"
        />

        {error && (
          <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-lg flex items-center gap-2">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isLoading || !inputVal.trim()}
          className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-lg text-xs font-medium transition shadow-sm"
        >
          {isLoading ? "Processing..." : "Submit Voucher Payload"}
        </button>

        <button
          type="button"
          onClick={handleClear}
          disabled={isLoading || !inputVal}
          className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600 text-zinc-300 rounded-lg text-xs font-medium transition"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
