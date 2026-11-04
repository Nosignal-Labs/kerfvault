# Kerfvault Event Indexer (`@kerfvault/indexer`)

A persistent ingestion daemon and HTTP registry snapshot provider for Kerfvault offline payment vouchers.

## Why a Dedicated Indexer is Required

> [!IMPORTANT]
> Public Stellar Soroban RPC providers maintain only a strictly bounded historical event window (typically retaining events for only the last 24 to 72 hours, or ~50,000 ledgers).
>
> Because voucher books can have validity periods spanning multiple days or weeks, a merchant device cannot rely on public RPC to query the full lifecycle of a book. The Kerfvault indexer runs continuously, ingesting contract events (`opened`, `redeemed`), updating a local PostgreSQL datastore, and serving immutable point-in-time registry snapshots via `GET /registry`.

See [Indexer Architecture & Operational Specifications](../../docs/INDEXER_ARCHITECTURE.md) for full details on RPC window retention, health monitoring, and deferred items.

## HTTP Endpoints

- `GET /health`: Healthcheck endpoint reporting processed sequence, RPC sequence, and lag count.
- `GET /registry`: Emits the current registry snapshot used by merchants for offline verification.
