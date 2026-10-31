# @kerfvault/sdk

TypeScript SDK for Kerfvault offline payment vouchers and Soroban smart contract interaction.

## Modules

- `voucher/encode.ts`: Encodes and decodes vouchers to and from QR-compact wire strings.
- `voucher/sign.ts`: Signs canonical voucher bytes using the shopper's offline Ed25519 voucher key.
- `voucher/verify.ts`: Verifies offline voucher signatures, expiry, and caps.
- `registry/types.ts`: TypeScript definitions for indexer registry snapshots.
- `registry/check.ts`: Validates offline vouchers against local registry snapshots.
- `contract/client.ts`: Typed RPC client for Kerfvault Soroban contracts.

## Development

```bash
# Build ESM and declaration files
pnpm run build

# Run unit and smoke tests
pnpm run test

# Typecheck
pnpm run typecheck
```

