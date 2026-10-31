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

## Documentation

- [Architecture & Design Decisions](docs/ARCHITECTURE.md)
- [Voucher Specification (DRAFT)](docs/VOUCHER_SPEC.md)
- [Threat Model & Security Limitations](docs/THREAT_MODEL.md)
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

