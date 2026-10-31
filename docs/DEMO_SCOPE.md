# Kerfvault Demo Slice Scope: Built vs Deferred

This document explicitly defines the boundaries for the Kerfvault live demo slice (~50% scope), detailing what is actively built versus what is intentionally deferred to the hardening and production phases.

---

## 1. Built vs Deferred Matrix

| Subsystem / Area | Built in Demo Slice | Deferred to Second Half |
|---|---|---|
| **Voucher Spec & Vectors** | • Frozen v1 canonical wire format<br>• Fixed-width binary field packing<br>• Contract domain-separation tag<br>• Deterministic cross-language test vectors (valid & negative edge cases) | • Spec versioning negotiation (v2+)<br>• Migration policies for deprecated formats<br>• Multi-currency envelope routing |
| **Smart Contract (`kerfvault`)** | • `open_book` with SEP-41 token pull<br>• `redeem` with Ed25519 signature check<br>• Automatic TTL extensions during state changes<br>• Note & Book data storage model<br>• Read-only getters (`get_book`, `get_note`)<br>• Core lifecycle events (`opened`, `redeemed`) | • `reclaim` logic & grace-period refunds<br>• Standalone manual `extend_ttl`<br>• Contract upgrade mechanisms<br>• Formal verification & invariant fuzzing |
| **TypeScript SDK (`@kerfvault/sdk`)** | • Voucher encode, decode, sign, verify (pure offline)<br>• Typed contract client for `openBook`, `redeem`, `getBook`, `getNote`<br>• Network config loader from `deployments/testnet.json`<br>• Error translation (contract error codes $\to$ readable errors) | • Reclaim client helpers<br>• Automatic RPC retry & backoff strategies<br>• Dedicated documentation site |
| **Indexer Service (`@kerfvault/indexer`)** | • Soroban RPC event polling from persistent cursor<br>• PostgreSQL storage for books and notes<br>• Idempotent row upserts on restart<br>• `GET /registry` compact snapshot endpoint<br>• `GET /health` with ledger sequence and lag | • Incremental delta sync snapshots<br>• Ledger reorg detection and recovery<br>• Historical event backfill workers<br>• Prometheus metrics and alerting |
| **Relay Service (`@kerfvault/relay`)** | • `POST /redeem` endpoint accepting structured voucher payloads<br>• Payload size and Zod validation<br>• Relay builds, simulates, signs (fee account), and submits tx<br>• `GET /redeem/:hash` status query<br>• In-memory per-IP rate limiter<br>• `DEMO_MODE` testnet faucet endpoint<br>• Configurable CORS origin restriction | • Advanced Sybil & abuse mitigation<br>• Dynamic gas/fee estimation & fee budgeting<br>• PagerDuty / Sentry alerting<br>• Multi-relayer decentralized failover |
| **Shopper App (`apps/kerf`)** | • In-app demo testnet wallet generation<br>• Local encrypted voucher key storage<br>• Lock tokens into book via `open_book`<br>• Offline voucher QR code generator<br>• Active book and note detail view<br>• Offline PWA service worker shell caching | • Freighter / hardware wallet integration<br>• Reclaim funds UI flow<br>• Camera scan-to-pay merchant addresses<br>• Multi-book management |
| **Merchant Reader (`apps/reader`)** | • Display merchant address as QR & text<br>• Sync and cache registry snapshot in IndexedDB<br>• Offline QR code camera scanner & manual payload paste<br>• Offline Ed25519 signature & rule verification<br>• Merchant-side spend cap & duplicate rejection<br>• Local offline redemption queue<br>• Manual "Redeem Now" relay submission | • Background sync worker<br>• Automatic submission retry loop<br>• Merchant transaction analytics and CSV export<br>• Multi-lane POS terminal synchronization |
| **Quality & Operations** | • Comprehensive unit tests across packages<br>• 3 end-to-end browser tests (happy path, tampered voucher, duplicate scan)<br>• Live Stellar Testnet deployment script (`scripts/deploy-testnet.sh`)<br>• Step-by-step demo runbook (`docs/DEMO_RUNBOOK.md`) | • Security audit by external firm<br>• Public bug bounty program<br>• Accessibility (a11y) audit<br>• Internationalization (i18n) |

---

## 2. Phase Status Checklist

- [ ] **Phase S1:** Foundation, spec freeze, vectors, crypto
- [ ] **Phase S2:** Contract core
- [ ] **Phase S3:** SDK client and CLI demo
- [ ] **Phase S4:** Indexer, relay and backend deploy prep
- [ ] **Phase S5:** Shopper app
- [ ] **Phase S6:** Merchant reader
- [ ] **Phase S7:** Integration, live demo and runbook
