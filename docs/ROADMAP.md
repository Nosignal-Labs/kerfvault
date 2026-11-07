# Kerfvault Development Roadmap

The development of Kerfvault is structured in two major halves:
1. **First Half (Phases S1–S7)**: The 50% vertical prototype slice demonstrating offline-first payment vouchers on Stellar and Soroban. **[COMPLETE]**
2. **Second Half (Waves 8–13)**: Hardening, reclaim logic, multi-merchant dispute proofs, dynamic note fragmentation, relayer decentralization, security audits, and mainnet launch.

---

## First Half: Demo Slice Execution (Phases S1–S7) — COMPLETE

All 7 phases of the live prototype have been implemented, tested, and tagged:

- [x] **Phase S1: Foundation, Spec Freeze, Test Vectors & Crypto** (`tag: demo-s1`)
  - Canonical 245-byte compact voucher wire format frozen in [docs/VOUCHER_SPEC.md](docs/VOUCHER_SPEC.md).
  - Deterministic test vectors (`test-vectors/voucher.v1.json`) validated in both Rust and TypeScript.
  - Constant-time Ed25519 signature verification and domain separation tags.

- [x] **Phase S2: Soroban Smart Contract Core** (`tag: demo-s2`)
  - `open_book` with SEP-41 token custody and escrow note generation.
  - `redeem` entrypoint with on-chain Ed25519 signature checks and replay protection.
  - Automatic TTL extensions on state changes and read getters (`get_book`, `get_note`).
  - Unit and integration tests in `contracts/kerfvault`.

- [x] **Phase S3: TypeScript SDK & CLI Terminal Demo** (`tag: demo-s3`)
  - `@kerfvault/sdk`: pure offline encoder, decoder, signer, and verifier.
  - Typed Soroban RPC client with contract error translation.
  - `@kerfvault/cli`: interactive terminal commands for `setup`, `open-book`, `sign-voucher`, `verify`, and `redeem`.

- [x] **Phase S4: Backend Services & Deployment Infrastructure** (`tag: demo-s4`)
  - Indexer service (`services/indexer`): persistent Soroban RPC polling, event ingestion, and `/registry` endpoint.
  - Relay service (`services/relay`): fee-paying sponsored redemption gateway (`POST /relay/redeem`), rate limiting, and faucet.
  - Deployed contract ID: `CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE`.

- [x] **Phase S5: Shopper Progressive Web App** (`tag: demo-s5`)
  - In-browser throwaway testnet wallet creation and encrypted voucher key storage.
  - On-chain book escrow opening with fixed denominations.
  - 100% offline voucher generation and dynamic QR code display under Airplane Mode.
  - PWA service worker shell caching.

- [x] **Phase S6: Merchant Reader Progressive Web App** (`tag: demo-s6`)
  - High-speed camera QR code scanner with `Permissions-Policy: camera=(self)`.
  - Offline cryptographic signature verification against cached registry snapshot.
  - Merchant acceptance caps and repeat scan refusal.
  - Local offline voucher queue and batch redemption via relay.

- [x] **Phase S7: Integration, Live Demo & Runbook** (`tag: demo-s7`)
  - Demo state reset automation (`pnpm reset-demo`).
  - In-app plain-language guides (`/how-it-works`) and transparent limitations screens (`/limitations`).
  - End-to-end browser test suite (`@kerfvault/e2e`): happy path, tampered voucher rejection, repeat scan refusal.
  - Live demo documentation in [README.md](../README.md) and 5-minute runbook in [docs/DEMO_RUNBOOK.md](DEMO_RUNBOOK.md).

---

## Second Half: Production & Hardening Roadmap (Waves 8–13)

The remaining work transitions KerfVault from an experimental testnet prototype into a production-grade, mainnet-ready financial protocol.

### Wave 8: Smart Contract Hardening, Reclaim Flow & TTL Management
- **Unspent Note Reclaim**: Implement `reclaim` entrypoint in `contracts/kerfvault`. Depositors can reclaim locked escrow after `redeem_deadline + GRACE_PERIOD`.
- **Manual TTL Extensions**: Add standalone `extend_ttl` entrypoint for third-party rent payment without state modification.
- **Contract Upgradeability**: Design upgrade path using Soroban WASM hash migration patterns.
- **Invariant Fuzzing**: Implement property-based testing and fuzzing suites (`proptest` / `cargo-fuzz`) for contract edge conditions.

### Wave 9: Multi-Merchant Fraud Arbitration, Slashing & Dispute Proofs
- **Cross-Merchant Double-Spend Mitigation**: Cryptographic disincentive design for offline environments where merchants lack connectivity.
- **Fraud Challenge Protocol**: If an identical note is presented to multiple merchants, the second merchant can submit both signed vouchers as a cryptographic fraud proof on-chain.
- **Collateral Slashing & Merchant Protection**: Slashing depositor security bonds to reimburse defrauded merchants via an automated protocol insurance pool.

### Wave 10: Dynamic Note Fragmentation & Multi-Currency Routing Envelopes
- **Variable Note Denominations**: Support heterogeneous note values within a single book.
- **Offline Change Signing**: Cryptographically sign partial voucher amounts and generate authenticated offline change commitments.
- **Multi-Token Routing Envelopes**: Extend wire envelope to support arbitrary Stellar Asset Contracts (SAC) and path-payments through Stellar DEX / AMMs.

### Wave 11: Production Relayer Network & Indexer Scale
- **Decentralized Relay Network**: Peer-to-peer relayer gossip protocol with automated load balancing and failover.
- **Dynamic Fee Estimation**: Real-time Soroban gas fee estimation, surge pricing protection, and fee budgeting.
- **Incremental Indexer Delta Sync**: Delta-compressed snapshot distribution to minimize reader bandwidth during registry synchronization.
- **Reorg Resilience**: Automated ledger reorganization detection and self-healing historical event backfills.
- **Observability**: Prometheus metrics, Grafana dashboards, and PagerDuty alert integrations.

### Wave 12: Hardware Security Enclave, Biometrics & POS Mesh Network
- **Secure Enclave / WebAuthn**: Hardware-isolated voucher key signing using device biometrics (TouchID, FaceID, Windows Hello).
- **Physical POS Terminal Integration**: Support for dedicated handheld Android POS hardware and NFC contactless card taps.
- **Local POS Mesh Synchronization**: Peer-to-peer Bluetooth Low Energy (BLE) and Wi-Fi Direct synchronization between multiple merchant checkout lanes at the same offline venue.
- **Background Auto-Redemption Worker**: Service Worker Background Sync API to automatically flush queued vouchers when internet is detected.

### Wave 13: External Audits, Formal Verification & Mainnet Launch
- **Third-Party Security Audits**: Comprehensive external security audit of Soroban contracts, cryptographic protocols, and relayer services by recognized blockchain security firms.
- **Formal Verification**: Mathematical proof of Merkle commitment validation and wire deserialization correctness.
- **Public Bug Bounty**: Community vulnerability disclosure program with tiered bounties on Immunefi.
- **Accessibility & Internationalization**: Full WCAG 2.1 AA compliance and multi-language support (i18n) across both web applications.
- **Mainnet Deployment**: Production deployment, multi-signature contract administration handover, and public release.
