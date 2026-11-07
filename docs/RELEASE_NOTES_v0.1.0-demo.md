# KerfVault v0.1.0-demo Release Notes

> **The First Complete Offline-First Payment Voucher Protocol Prototype on Stellar & Soroban**  
> Release Tag: `v0.1.0-demo` | Milestone: Phases S1–S7 Complete | Network: Stellar Testnet

---

## 1. Release Overview

We are excited to announce the release of **KerfVault v0.1.0-demo**, delivering the full 50% vertical prototype slice outlined in the project roadmap. KerfVault enables digital asset payments (such as XLM and USDC) between shoppers and merchants when **neither party has an active internet connection** at the time of sale.

This release represents the culmination of Phases S1 through S7, encompassing smart contract escrow on Soroban, client cryptography, progressive web applications, indexer and relay backend services, and automated browser end-to-end test suites.

---

## 2. Key Capabilities & Deliverables

### A. Core Protocol & Cryptography (Phase S1)
- **Canonical Wire Format (v1)**: Frozen 245-byte compact base64url payload with strict byte packing and domain separation tags.
- **Pure Offline Verification**: Sub-15ms cryptographic verification in browser memory with zero network calls.
- **Shared Test Vectors**: 100% test coverage across Rust smart contracts and TypeScript SDK.

### B. Soroban Smart Contracts (Phase S2)
- **Deployed Testnet Contract**: `CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE`
- **Escrow Locking (`open_book`)**: Custodies SEP-41 tokens and mints commitments to individual voucher notes.
- **Atomic Settlement (`redeem`)**: On-chain Ed25519 signature checks, replay prevention, and instant token payouts to merchants.
- **State Archival Defense**: Automatic ledger TTL extensions on all state transitions.

### C. TypeScript SDK & Developer CLI (Phase S3)
- **`@kerfvault/sdk`**: Typed clients for contract interaction, registry checking, error translation, and offline cryptographic routines.
- **`@kerfvault/cli`**: Terminal commands (`setup`, `open-book`, `sign-voucher`, `verify`, `redeem`) for automated head-to-head testing.

### D. Backend Services (Phase S4)
- **Indexer Service (`services/indexer`)**: Event ingestion pipeline reading Soroban contract events into persistent PostgreSQL and serving compact `/registry` snapshots.
- **Fee-Paying Relay (`services/relay`)**: Sponsors network transaction fees on testnet so merchants can settle vouchers without holding gas tokens.

### E. Shopper Progressive Web App (Phase S5)
- **In-App Wallet**: Throwaway testnet account generator and encrypted browser voucher key storage.
- **Offline Note Management**: Full offline caching allowing shoppers to sign vouchers and display QR codes in Airplane Mode.

### F. Merchant Reader Progressive Web App (Phase S6)
- **Camera QR Scanner**: High-framerate browser barcode scanner with `Permissions-Policy: camera=(self)`.
- **Local Registry Cache**: IndexedDB persistence of active contract roots for instant offline validation.
- **Risk Mitigation**: Merchant-configured spend caps and local repeat scan refusal.
- **Batch Settlement**: Queues offline vouchers and redeems them on-chain in one click upon reconnection.

### G. Live Demo, Runbook & E2E Test Suite (Phase S7)
- **Automated State Reset**: `pnpm reset-demo` generates fresh identities, resets local state, and funds accounts via Friendbot.
- **End-to-End Browser Tests (`@kerfvault/e2e`)**:
  - Test 1: Happy path from escrow book opening to offline QR scan and relay payout.
  - Test 2: Offline detection and rejection of tampered amounts, recipient mismatches, and corrupted signatures.
  - Test 3: Instant offline refusal of repeated voucher scans.
- **Demo Runbook**: Five-minute demonstration script with pre-flight checklist and incident response procedures in [docs/DEMO_RUNBOOK.md](DEMO_RUNBOOK.md).

---

## 3. Important Notices & Scope Boundaries

> [!CAUTION]
> **Experimental Testnet Prototype:** This release is strictly an architectural proof-of-concept deployed to Stellar Testnet. It has NOT undergone external security audits. Do NOT deposit real monetary value or use on Stellar Mainnet.

| Built in v0.1.0-demo | Deferred to Second-Half Roadmap (Waves 8–13) |
|---|---|
| Single fixed-denomination notes per book | Dynamic note fragmentation and offline change splits |
| Local merchant acceptance caps & local replay cache | Cross-merchant fraud challenge proofs & collateral slashing |
| Escrow locking and redemption settlement | Unspent note reclaim after expiry (`reclaim`) |
| Centralized demo relay for gas sponsorship | Decentralized P2P relayer network with dynamic fee estimation |
| Browser IndexedDB / LocalStorage key persistence | Hardware Security Enclave (WebAuthn/TouchID) integration |

---

## 4. Getting Started

```bash
# Clone and install dependencies
git clone https://github.com/Nosignal-Labs/kerfvault.git
cd kerfvault
pnpm install

# Reset demo state and fund accounts
pnpm reset-demo

# Run all test suites across the monorepo
pnpm -r test
```
