export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-100">Wallet Settings</h1>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
            TESTNET ONLY
          </span>
        </div>
        <p className="text-zinc-400 mt-1 text-sm">
          Manage offline voucher keys, local device encryption, and network configuration.
        </p>

        <div className="mt-6 space-y-4">
          <div className="border border-zinc-800 bg-zinc-950 p-3 rounded">
            <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Connected Network
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-mono text-zinc-200">
                Stellar Testnet (Test SDF Network ; September 2015)
              </span>
            </div>
            <div className="text-[11px] text-amber-400/90 mt-1">
              Mainnet connectivity is strictly refused in this demo application.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Offline Voucher Public Key
            </label>
            <input
              type="text"
              value="GPLACEHOLDERVOUCHERKEY00000000000000000000000000000000000"
              readOnly
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-xs font-mono text-zinc-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              App Passcode Protection
            </label>
            <div className="mt-2 text-xs text-zinc-500">
              WebCrypto PBKDF2/AES-GCM protects offline signing keys in local storage.
            </div>
          </div>
        </div>
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">Security Notice: </span>
        Demo keys are stored in browser memory/storage for testnet use only.
      </div>
    </div>
  );
}
