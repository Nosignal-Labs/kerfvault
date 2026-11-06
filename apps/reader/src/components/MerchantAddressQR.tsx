"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface MerchantAddressQRProps {
  address: string;
  size?: number;
}

export function MerchantAddressQR({
  address,
  size = 200,
}: MerchantAddressQRProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = address;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center p-5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-4 shadow-lg">
      <div className="flex items-center justify-between w-full border-b border-zinc-800/80 pb-2">
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Merchant Payee QR
        </span>
        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
          RECEIVE PAYMENTS
        </span>
      </div>

      <div className="p-3 bg-white rounded-lg shadow-md inline-block">
        <QRCodeSVG
          value={address}
          size={size}
          level="M"
          includeMargin={false}
          className="w-full h-auto max-w-[200px] aspect-square block"
        />
      </div>

      <p className="text-[11px] text-zinc-400 text-center max-w-xs">
        Shoppers scan this QR code to designate your terminal as the authorized merchant payee.
      </p>

      <div className="w-full space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>STELLAR ADDRESS</span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-emerald-400 hover:text-emerald-300 font-medium"
          >
            {copied ? "Copied!" : "Copy Address"}
          </button>
        </div>
        <div className="p-2 bg-zinc-900 border border-zinc-800 rounded font-mono text-[11px] text-zinc-300 break-all select-all">
          {address}
        </div>
      </div>
    </div>
  );
}

