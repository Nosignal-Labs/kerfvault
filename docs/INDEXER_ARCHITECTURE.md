# Kerfvault Indexer Architecture & Operational Specifications

This document outlines the architectural role, operational constraints, and technical limitations of the Kerfvault Event Indexer service (`@kerfvault/indexer`).

---

## 1. The Soroban RPC Event Retention Window

### 1.1 The Ephemeral Window Constraint
Public Stellar Soroban RPC providers (including `https://soroban-testnet.stellar.org` and production Tier-1 node providers) maintain only a strictly bounded historical event window:
- **Typical retention window**: 24 to 72 hours (approximately 17,280 to 51,840 ledgers at ~5 seconds per ledger).
- **Purge behavior**: Ledgers older than the retention horizon are continuously pruned from the RPC node's in-memory event index. Requests to `getEvents` with a `startLedger` or `cursor` older than the retention boundary will fail or omit pruned events.

### 1.2 Continuous Ingestion Requirement
Because Kerfvault payment voucher books are intended for offline retail and travel environments, a book's `redeem_deadline` frequently spans weeks or months. 

If a merchant device depended directly on public Soroban RPC to verify whether a voucher note was open or redeemed, old notes would be invisible. The Kerfvault indexer resolves this by running as a **continuous ingestion daemon**:
1. It polls `getEvents` for contract ID `CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE`.
2. It persists each pagination token in PostgreSQL table `sync_state` (`key = 'kerfvault_events'`).
3. On daemon restart, it resumes immediately from `sync_state.cursor` without missing events or re-requesting pruned ledgers.
4. It exposes `GET /registry` to serve complete point-in-time snapshots to offline merchant readers.

---

## 2. Ledger Lag and Health Monitoring

The indexer exposes real-time sync metrics on `GET /health`:
```json
{
  "status": "ok",
  "timestamp": "2026-11-04T12:00:00.000Z",
  "latestLedgerProcessed": 5510200,
  "latestRpcLedger": 5510202,
  "lag": 2,
  "cursor": "0000000005510200-0000000001"
}
```
- **`lag`**: Calculated as $\max(0, \text{latestRpcLedger} - \text{latestLedgerProcessed})$.
- **Health status**: If lag exceeds 500 ledgers (~40 minutes), status transitions to `"degraded"`, alerting operators that the indexer is falling behind chain tip.

---

## 3. Deferred Capabilities & Roadmap Scope

To deliver the high-confidence 50% demo slice, the following advanced capabilities are deliberately deferred to Phase 5 hardening (see `docs/ROADMAP.md`):

### 3.1 Deep Archive Backfill (Deferred)
- **Status**: Deferred.
- **Limitation**: If the indexer database is dropped or started weeks after contract deployment without a prior snapshot, `getEvents` cannot retrieve pruned historical events.
- **Future Solution**: Implement a cold-start backfill worker that ingests historical ledger close meta files directly from public Google Cloud / AWS Stellar Core history archives (`history.stellar.org`).
- **Code Marker**: `TODO: Implement historical ledger backfill via Stellar archive ingestion when startLedger is beyond RPC retention window` in `services/indexer/src/ingest.ts`.

### 3.2 Consensus Reorganization Handling (Deferred)
- **Status**: Deferred.
- **Limitation**: Soroban transactions are finalized under the Stellar Consensus Protocol (SCP) with immediate deterministic finality (single-slot consensus). While true reorgs do not occur under normal SCP operation, network partitions or validator splits could theoretically fork state. The indexer currently assumes forward-only linear history.
- **Future Solution**: Implement block hash parent tracking and undo logs for database state rollbacks.
- **Code Marker**: `TODO: Implement reorg detection and rollback logic` in `services/indexer/src/ingest.ts`.

### 3.3 Incremental Delta Snapshots (Deferred)
- **Status**: Deferred.
- **Limitation**: `GET /registry` serves the full JSON registry snapshot. As book count scales past 10,000 books, full snapshots consume megabytes of mobile data.
- **Future Solution**: Support RFC 7396 JSON Merge Patch or delta-since-sequence parameters (`GET /registry?sinceLedger=12345`) with Brotli compression.
- **Code Marker**: `TODO: Support incremental delta snapshots (RFC 7396 / JSON Patch) for low-bandwidth mobile merchant clients` in `services/indexer/src/snapshot.ts`.

### 3.4 Cryptographic Snapshot Attestation (Deferred)
- **Status**: Deferred.
- **Limitation**: The registry snapshot is delivered over TLS HTTP without a separate application-level signature.
- **Future Solution**: Indexer signs snapshot root hashes with a known operational keypair; merchant apps verify the Ed25519 signature before accepting the snapshot into IndexedDB.
