# Kerfvault Development Roadmap

The development of Kerfvault is planned in five sequential waves. Each wave builds on verified artifacts and tests from the previous phase.

---

## Phase 1: Contract & Voucher Specification

- [x] Monorepo scaffolding and tooling setup.
- [x] Initial Soroban smart contract interface (`contracts/kerfvault`).
- [x] Canonical test vectors schema (`test-vectors/voucher.v1.json`).
- [ ] Finalize byte-level encoding for `voucher_message` (Base45 vs binary QR).
- [ ] Implement `open_book` logic with SEP-41 token custody and event emissions.
- [ ] Implement `redeem` logic with on-chain Ed25519 signature verification and note state transition.
- [ ] Implement `reclaim` with strict enforcement of `redeem_deadline + GRACE_PERIOD`.
- [ ] Full Soroban test suite covering replay prevention, signature forgery, and edge conditions.

---

## Phase 2: TypeScript SDK & CLI Demo

- [ ] Complete `@kerfvault/sdk` implementation:
  - Binary/CBOR encoder and decoder (`voucher/encode.ts`).
  - Ed25519 signing using `@noble/curves` or Stellar SDK (`voucher/sign.ts`).
  - Offline signature and cap validation (`voucher/verify.ts`).
  - Registry snapshot checker (`registry/check.ts`).
  - Soroban RPC contract client (`contract/client.ts`).
- [ ] Build interactive CLI demo demonstrating an end-to-end simulated offline payment:
  - Generate voucher key.
  - Sign offline voucher string.
  - Verify offline voucher against mock snapshot.
  - Submit mock redemption.

---

## Phase 3: Mobile Progressive Web Apps (PWAs)

- [ ] **Shopper App (`apps/kerf`)**:
  - Connect Stellar wallet (Freighter / WalletConnect).
  - Open book flow with custom note denomination configuration.
  - Encrypted local key storage via WebCrypto and device passcode.
  - Dynamic QR code generation with offline caching.
  - Workbox Service Worker setup for 100% offline launch.
- [ ] **Merchant Reader (`apps/reader`)**:
  - Web camera integration for high-speed QR barcode scanning.
  - Offline verification against cached snapshot in IndexedDB (`lib/storage.ts`).
  - Configurable offline exposure caps and auto-rejection.
  - Local voucher queue and auto-redemption worker upon online reconnect.

---

## Phase 4: Indexer & Fee-Paying Relay

- [ ] **Indexer Service (`services/indexer`)**:
  - Continuous Soroban RPC event polling loop (`src/ingest.ts`).
  - PostgreSQL schema migrations and persistence.
  - Efficient incremental snapshot generation and compression.
- [ ] **Relay Service (`services/relay`)**:
  - Sponsored transaction submission logic for merchant redemptions.
  - Production rate limiting and DDOS defences (`src/rateLimit.ts`).
  - Webhook notifications for merchants on settlement confirmation.

---

## Phase 5: Hardening & Security Audit

- [ ] Formal threat model validation and penetration testing.
- [ ] Professional third-party security audit of Soroban smart contract code.
- [ ] Fuzzing of voucher parser and message serialization across Rust and TypeScript.
- [ ] Testnet bug bounty wave.
- [ ] Mainnet deployment and public release.

