# Kerfvault

> **Offline-first payment voucher protocol on Stellar and Soroban.**

[![Contract CI](https://github.com/kerfvault/kerfvault/actions/workflows/contract.yml/badge.svg)](https://github.com/kerfvault/kerfvault/actions/workflows/contract.yml)
[![JS CI](https://github.com/kerfvault/kerfvault/actions/workflows/js.yml/badge.svg)](https://github.com/kerfvault/kerfvault/actions/workflows/js.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

---

## ⚠️ Security Notice

> [!CAUTION]
> **Kerfvault smart contracts and software are experimental, unaudited, and under active development.**
> Do NOT use with mainnet funds or in production environments. Testnet only.
> To report security vulnerabilities, please refer to [SECURITY.md](SECURITY.md).

---

## The Problem

Blockchains require global consensus to process transactions, making them inherently reliant on an active internet connection. In situations such as flights, rural markets, music festivals, natural disasters, or network blackouts, neither shoppers nor merchants have reliable connectivity. Traditional crypto payments fail completely in these environments.

## How Kerfvault Works (in Plain Words)

Kerfvault enables shoppers to pay merchants without either party having an active internet connection at the time of sale:

1. **Lock funds into notes (Online)**: While online, the shopper deposits funds into a Soroban smart contract. The funds are locked as a "book" of fixed-denomination notes (e.g. 5, 10, 20 USDC).
2. **Present a signed voucher (Offline)**: At a store without internet, the shopper chooses an unspent note. Their phone signs an authorization message using a dedicated offline key and shows it as a QR code.
3. **Verify and accept (Offline)**: The merchant's phone scans the QR code. It verifies the signature and checks the note against a locally cached registry snapshot. If valid, the merchant provides goods immediately and queues the voucher.
4. **Redeem on-chain (Online)**: When the merchant is back online (or through a fee-paying relay), the voucher is submitted to Stellar. The contract pays the merchant directly, marks the note redeemed, and returns any leftover change to the shopper.

---

## Repository Map

```
kerfvault/
├─ contracts/
│  └─ kerfvault/                 # Soroban contract (Rust, #![no_std])
├─ packages/
│  └─ sdk/                       # TypeScript SDK (voucher format, signing, verify, client)
├─ apps/
│  ├─ kerf/                      # Shopper PWA (Next.js 15)
│  └─ reader/                    # Merchant Reader PWA (Next.js 15)
├─ services/
│  ├─ indexer/                   # Event indexer + registry snapshot API (Node.js)
│  └─ relay/                     # Fee-paying redemption relay (Node.js)
├─ test-vectors/                 # Shared JSON vectors for Rust and TypeScript
├─ docs/                         # Architecture, Voucher Spec, Threat Model, Tooling, Roadmap
└─ .github/                      # CI workflows and issue templates
```

---

## Quick Start

### Prerequisites
- [Rust](https://rustup.rs/) (v1.84+ with target `wasm32v1-none`)
- [Stellar CLI](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup#install-the-stellar-cli) (`v28.1.0`)
- [Node.js](https://nodejs.org/) (`v20+` or `v24+`)
- [pnpm](https://pnpm.io/) (`v12+` or `v9+`)

For full setup instructions, see [docs/TOOLING.md](docs/TOOLING.md).

### 1. Build & Test Smart Contracts

```bash
# Run contract tests
cargo test

# Check code formatting & clippy warnings
cargo fmt --check
cargo clippy -- -D warnings

# Build contract to WebAssembly (WASM)
stellar contract build
```

### 2. Build & Test JavaScript / TypeScript Monorepo

```bash
# Install dependencies across all workspaces
pnpm install

# Lint all packages
pnpm -r lint

# Typecheck all packages
pnpm -r typecheck

# Run unit and smoke tests
pnpm -r test

# Build all packages and apps
pnpm -r build
```

---

## Run the Demo from the Command Line

You can run the complete offline voucher payment lifecycle from your terminal against Stellar Testnet using `@kerfvault/cli`. No browser UI is required.

### 0. Build the CLI

```bash
pnpm --filter @kerfvault/sdk build
pnpm --filter @kerfvault/cli build
```

### 1. Setup Demo Accounts & Funding

Generates demo keypairs (`Owner`, `Merchant`, and a dedicated `Voucher` signing key) and funds them via Stellar Friendbot. Only public keys are printed to stdout; secret keys are saved to the gitignored `.demo-keys.json`:

```bash
$ node packages/cli/bin/kerfvault.js setup --skip-trustline
==> Generating demo keypairs...
Owner public address:    GD3QC7FB6RAMQCKEJQR74L6LR5DTS3QKI46M6NNABSE27M2HV5DEZYZU
Merchant public address: GDEM3FKPSCGGBW5XCPW3ROO6W6W3YMYRFDVTNUW4BJMH4EX2BYCHMJ4U
Voucher signing key:     GARMWJZUGRDIXW6GSWWOGDXVLI4Z752MULQCEBGQOVZPKXF4VM34HVRU
==> Funding accounts via Friendbot on testnet...
Accounts funded successfully.
==> Demo keys securely saved to .demo-keys.json (gitignored).
==> Setup complete.
```

### 2. Lock Escrow Funds and Open a Book On-Chain

Locks funds into a book with two notes (1 XLM and 2 XLM denominations) on Soroban:

```bash
$ node packages/cli/bin/kerfvault.js open-book
==> Opening voucher book on-chain...
Owner:            GD3QC7FB6RAMQCKEJQR74L6LR5DTS3QKI46M6NNABSE27M2HV5DEZYZU
Token:            CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
Voucher key:      GARMWJZUGRDIXW6GSWWOGDXVLI4Z752MULQCEBGQOVZPKXF4VM34HVRU
Denominations:    10000000, 20000000 stroops (2 notes)
Redeem deadline:  1796380355
==> Book opened successfully!
Book ID:          2
Saved book context to .demo-state.json (gitignored).
```

### 3. Inspect the On-Chain Book & Notes

Queries Soroban persistent storage for Book `#2` and its initial notes:

```bash
$ node packages/cli/bin/kerfvault.js show-book --book 2
==> Querying book #2 from contract storage...
Book ID:          2
Owner:            GD3QC7FB6RAMQCKEJQR74L6LR5DTS3QKI46M6NNABSE27M2HV5DEZYZU
Token:            CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
Voucher key:      22cb273434468bdbc695ace30ef55a399ff74ca2e02204d07572f55cbcab37c3
Redeem deadline:  1796380355
Free balance:     0 stroops
Note count:       2
--- Notes ---
Note #0: denomination = 10000000 stroops, state = OPEN
Note #1: denomination = 20000000 stroops, state = OPEN
```

### 4. Create and Sign a Payment Voucher (Offline)

Shopper specifies 0.7 XLM (7,000,000 stroops) from Note `#0` (10,000,000 stroops cap) and cryptographically signs it offline:

```bash
$ node packages/cli/bin/kerfvault.js sign-voucher --book 2 --note 0 --amount 7000000 --cap 10000000
==> Creating and signing offline voucher...
Contract ID:   CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE
Book ID:       2
Note Index:    0
Merchant:      GDELSDATL7W2JEDSUGSQUFP3YP36VPWM4V4C5TJLIY4LZMIMKGCSRNFG
Amount:        7000000 stroops
Cap:           10000000 stroops
Accept Until:  1796380424
==> Voucher signed successfully!
Encoded voucher payload (Base64 URL-safe):
S0VSRlZBVUxUX1YxAAAAAAFDQkdBNTVKT1RUWktXNDRaNlk2N1JNSk5UM1pLTjQyQ0dWWEJBMzVLUVJHTDZSM0FJWk9LWEdGRQAAAAAAAAACAAAAAEdERUxTREFUTDdXMkpFRFNVR1NRVUZQM1lQMzZWUFdNNFY0QzVUSkxJWTRMWk1JTUtHQ1NSTkZHAAAAAAAAAAAAAAAAAGrPwAAAAAAAAAAAAAAAAACYloAAAAAAaxKXCMXOAJ0jiC6wT7WDXUad8eHOvsUGH9BX7kKQajntiMSlOvQKpejqv-WgqdzgSqQRYe6YfibLEprYYu8pb-fQgA8
Saved voucher to .demo-state.json (gitignored).
```

### 5. Verify the Voucher (Pure Offline, Zero Network Calls)

Merchant verifies the voucher signature, bounds, and contract binding with zero network access:

```bash
$ node packages/cli/bin/kerfvault.js verify
==> Decoding voucher payload...
==> Verifying voucher cryptographically offline (zero network calls)...
==> Offline voucher verification: VALID
Contract:    CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE
Book ID:     2
Note Index:  0
Merchant:    GDELSDATL7W2JEDSUGSQUFP3YP36VPWM4V4C5TJLIY4LZMIMKGCSRNFG
Amount:      7000000 stroops
Cap:         10000000 stroops
Expires:     1796380424
Signature:   c5ce009d23882eb04fb5835d469df1e1cebec5061fd057ee42906a39ed88c4a53af40aa5e8eabfe5a0a9dce04aa41161ee987e26cb129ad862ef296fe7d0800f
Verification verified completely offline with zero network calls.
```

### 6. Submit for On-Chain Redemption

Merchant or fee-paying relay submits the voucher to the contract on Soroban:

```bash
$ node packages/cli/bin/kerfvault.js redeem
==> Submitting voucher for on-chain contract redemption...
Submitter:       GDEM3FKPSCGGBW5XCPW3ROO6W6W3YMYRFDVTNUW4BJMH4EX2BYCHMJ4U
Contract ID:     CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE
Book ID:         2
Note Index:      0
Merchant:        GDELSDATL7W2JEDSUGSQUFP3YP36VPWM4V4C5TJLIY4LZMIMKGCSRNFG
Amount:          7000000 stroops
Cap:             10000000 stroops
Accept Until:    1796380424
==> Redemption confirmed on-chain!
Transaction Hash: e3d44259df0800f1b9c8d3406260ec293998ec3c1763c7e5b5dfb5babcda4a5c
Saved transaction hash to .demo-state.json (gitignored).
```

### 7. Confirm Final State & Refunded Change

Re-queries contract storage to verify Note `#0` is marked `REDEEMED` and the unspent 0.3 XLM (3,000,000 stroops) remainder was credited to the book's `free_balance`:

```bash
$ node packages/cli/bin/kerfvault.js show-book --book 2
==> Querying book #2 from contract storage...
Book ID:          2
Owner:            GD3QC7FB6RAMQCKEJQR74L6LR5DTS3QKI46M6NNABSE27M2HV5DEZYZU
Token:            CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
Voucher key:      22cb273434468bdbc695ace30ef55a399ff74ca2e02204d07572f55cbcab37c3
Redeem deadline:  1796380355
Free balance:     3000000 stroops
Note count:       2
--- Notes ---
Note #0: denomination = 10000000 stroops, state = REDEEMED
Note #1: denomination = 20000000 stroops, state = OPEN
```

---

## Documentation

- [Architecture & Design Decisions](docs/ARCHITECTURE.md)
- [Voucher Specification (DRAFT)](docs/VOUCHER_SPEC.md)
- [Threat Model & Security Limitations](docs/THREAT_MODEL.md)
- [Merchant Reader PWA Deployment & Settings](docs/DEPLOY_READER.md)
- [Shopper PWA Deployment (Vercel)](docs/DEPLOY_SHOPPER.md)
- [Backend Infrastructure Checklist](docs/DEPLOY_BACKEND.md)
- [Tooling & Pinned Versions](docs/TOOLING.md)
- [Development Roadmap](docs/ROADMAP.md)

---

## Contributing

We welcome community contributions! Please review:
- [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, commit conventions, and definition of done.
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community guidelines.
- [SECURITY.md](SECURITY.md) for responsible disclosure.

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
Copyright 2026 Kerfvault.

