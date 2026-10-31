# Kerfvault Soroban Smart Contract

The core on-chain escrow contract for the Kerfvault offline voucher protocol on Stellar/Soroban.

> [!WARNING]
> This contract is experimental, under active development, and **unaudited**. Do not use with mainnet funds.

## Responsibilities

1. **Book Opening (`open_book`)**: Locks funds from the shopper into discrete, fixed-denomination notes.
2. **Offline Voucher Redemption (`redeem`)**: Verifies the shopper's offline Ed25519 signature, prevents double redemption of the note, settles funds to the merchant via SEP-41 token transfer, and credits any leftover difference to the book's `free_balance`.
3. **Reclaim (`reclaim`)**: Allows the owner to recover unredeemed notes and free balances once the `redeem_deadline` plus security grace period has elapsed.
4. **Storage Maintenance (`extend_ttl`)**: Extends persistent storage lifetime for active books.

## Build and Test

```bash
# Run unit tests
cargo test

# Check formatting and clippy
cargo fmt --check
cargo clippy -- -D warnings

# Build optimized WASM artifact
stellar contract build
```
Output artifact is generated at:
`target/wasm32v1-none/release/kerfvault_contract.wasm`

