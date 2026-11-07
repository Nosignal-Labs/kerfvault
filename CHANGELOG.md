# Changelog

All notable changes to the Kerfvault project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0-demo] - 2026-11-07

### Added
- **Core Protocol**: Frozen canonical 245-byte offline payment voucher format (`v1`) with deterministic test vectors.
- **Smart Contract**: Soroban escrow locking (`open_book`) and atomic settlement (`redeem`) deployed on Stellar Testnet (`CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE`).
- **SDK & CLI**: `@kerfvault/sdk` with offline signer/verifier and typed contract client; `@kerfvault/cli` terminal demo commands.
- **Backend Services**: Soroban event indexer (`services/indexer`) with `/registry` snapshots; fee-paying redemption relay (`services/relay`).
- **Shopper PWA**: Next.js wallet app (`apps/kerf`) supporting offline voucher generation under Airplane Mode.
- **Merchant Reader PWA**: Next.js reader app (`apps/reader`) with camera scanner (`camera=(self)`), local IndexedDB registry cache, and redemption queue.
- **E2E Browser Tests**: Playwright/Vitest browser integration suite (`@kerfvault/e2e`) covering happy path, tampered voucher rejection, and repeat scan refusal.
- **Demo Tooling & Docs**: Automated state reset script (`pnpm reset-demo`), 5-minute live demo runbook (`docs/DEMO_RUNBOOK.md`), and full release notes (`docs/RELEASE_NOTES_v0.1.0-demo.md`).
