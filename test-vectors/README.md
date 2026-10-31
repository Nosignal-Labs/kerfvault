# Kerfvault Test Vectors

This directory contains canonical test vectors shared across all Kerfvault implementations (Soroban contract in Rust, TypeScript SDK, mobile PWAs, and backend services) to ensure wire format and cryptographic verification compatibility.

## Vector Files

- `voucher.v1.json`: Draft v1 offline payment voucher format.

## Schema: `voucher.v1.json`

Every vector record includes the following fields:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier for the test vector case. |
| `status` | `string` | Set to `"PLACEHOLDER"` during early scaffolding, or `"CANONICAL"` once cryptographically generated. |
| `contractId` | `string` | Deployed Soroban Kerfvault contract address (e.g. C... strkey). |
| `bookId` | `number` / `u64` | Identifier of the voucher book registered in the contract. |
| `noteIndex` | `number` / `u32` | Index of the specific fixed-denomination note within the book. |
| `merchant` | `string` | Stellar account address (G...) of the intended recipient (redirect protection). |
| `amount` | `string` / `i128` | Amount to transfer to merchant in stroops (base token units). |
| `cap` | `string` / `i128` | Maximum amount this voucher can claim from the note denomination. |
| `acceptUntil` | `number` / `u64` | POSIX timestamp after which merchant must reject the voucher offline. |
| `voucherKey` | `string` | Public key (Ed25519) of the dedicated offline voucher signing key. |
| `signature` | `string` | Ed25519 signature over the canonical voucher message bytes. |
| `expectedValid`| `boolean` | Whether verification should succeed (`true`) or fail (`false`). |

## Usage in Smoke Tests

- **Rust (`contracts/kerfvault/src/test.rs`)**: Uses `core::include_str!("../../../test-vectors/voucher.v1.json")` to assert that the vector file is present, non-empty, and loadable at compile/test time.
- **TypeScript (`packages/sdk/tests/smoke.test.ts`)**: Loads the file via `fs.readFileSync` or standard JSON import, validating that the fields match the SDK's TypeScript types.

