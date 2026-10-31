# Kerfvault Redemption Relay (`@kerfvault/relay`)

An untrusted, gas-subsidized submission relay service for Kerfvault offline payment vouchers.

## Trustless Architecture: Funds Redirect Protection

> [!IMPORTANT]
> The relay is completely untrusted and non-custodial:
>
> 1. When a shopper signs an offline payment voucher, the **merchant's public address (`merchant`) is embedded directly in the canonical payload** signed by the shopper's offline Ed25519 key.
> 2. The on-chain Soroban contract (`KerfvaultContract::redeem`) verifies this signature and transfers tokens via SEP-41 **strictly to the embedded merchant address**.
> 3. Consequently, the relay—or any arbitrary intermediary—cannot alter the recipient address, redirect funds, or increase the payout amount beyond the signed cap. The submitter merely sponsors the Stellar network transaction fee.

## HTTP Endpoints

- `GET /health`: Health check (`{ status: "ok" }`).
- `POST /redeem`: Validates the signed voucher payload schema and queues the transaction for on-chain submission via Soroban RPC (currently returns `501 Not Implemented`).

