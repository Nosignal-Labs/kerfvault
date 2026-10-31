export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <h1 className="text-xl font-bold text-zinc-100">Wallet Settings</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Manage offline voucher keys, local device encryption, and passcodes.
        </p>

        <div className="mt-6 space-y-4">
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
              Passcode protects offline signing key in IndexedDB.
            </div>
          </div>
        </div>
      </div>

      <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-300">
        <span className="font-semibold">STUB: </span>
        {/* TODO: Implement device keypair generation, export/import, and WebCrypto passcode wrapping */}
        Hardware keystore or WebCrypto key derivation for encrypted local storage.
      </div>
    </div>
  );
}

