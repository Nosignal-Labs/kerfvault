# Deploying Kerfvault Merchant Reader PWA

This document outlines deployment procedures, configuration parameters, and terminal settings for the Kerfvault Merchant Reader Progressive Web Application (`apps/reader`), including its offline verification pipeline and redemption relay integration.

---

## 1. Hosting & Deployment Setup (Vercel)

The Merchant Reader is built with Next.js 15 and deployed as a client-side progressive web app.

1. **Import Repository**:
   - Go to [Vercel Dashboard](https://vercel.com) > **Add New... > Project**.
   - Select the `Nosignal-Labs/kerfvault` GitHub repository.

2. **Project Build Settings**:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `apps/reader`
   - **Build Command**: `pnpm --filter @kerfvault/reader build` (or `next build` within `apps/reader`)
   - **Install Command**: `pnpm install`
   - **Output Directory**: `.next`
   *(Ensure "Include files outside the root directory in the Build Step" is enabled to resolve `@kerfvault/sdk` and `@kerfvault/web-wallet`)*.

---

## 2. Environment Variables Configuration

Configure the following environment variables in **Project Settings > Environment Variables**:

| Variable Name | Value | Purpose |
|---------------|-------|---------|
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` | Enforces testnet-only operation (blocks mainnet) |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Testnet consensus passphrase |
| `NEXT_PUBLIC_HORIZON_URL` | `https://horizon-testnet.stellar.org` | Stellar Horizon balance queries & trustline checks |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint for contract interaction |
| `NEXT_PUBLIC_CONTRACT_ID` | `CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE` | Deployed Kerfvault contract address on testnet |
| `NEXT_PUBLIC_TOKEN_ADDRESS` | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | Native SAC (XLM) contract address |
| `NEXT_PUBLIC_INDEXER_URL` | `http://localhost:4001` (or deployed indexer) | REST endpoint for latest registry snapshot cache |
| `NEXT_PUBLIC_RELAY_URL` | `http://localhost:4002` (or deployed relay) | Fee-paying relay endpoint for on-chain redemptions |

---

## 3. Reader Terminal Settings & Storage Model

The reader app maintains local risk parameters in browser `localStorage` and offline records in `IndexedDB`:

### 3.1 Merchant Settings (`localStorage`)

Stored under key `kerfvault_merchant_settings`:

| Setting | Default | Range / Type | Purpose |
|---------|---------|--------------|---------|
| `maxOfflineVoucherAmountXlm` | `50` | Positive number | Maximum amount accepted for any single offline voucher. Scans exceeding this are rejected (`CapExceedsMerchantLimit`). |
| `maxTotalOfflineExposureXlm` | `500` | $\ge$ voucher amount | Maximum aggregate amount of unredeemed offline vouchers allowed in the queue. |
| `requirePayeeMatch` | `true` | Boolean | Enforces that voucher merchant payee matches this terminal's active wallet address (`MerchantMismatch`). |

### 3.2 Offline Databases (`IndexedDB: kerfvault_reader_db`)

- **`snapshots` Object Store**:
  - Key: `"latest"`
  - Record: `{ id: "latest", snapshot: RegistrySnapshot, lastSyncedAt: number }`
  - Synced from the indexer (`GET /registry/snapshot`) before going offline.
  - Warns merchant if snapshot is older than 24 hours (`StaleRegistryBanner`).

- **`vouchers` Object Store**:
  - Key: `id` (`${bookId}:${noteIndex}`)
  - Record: `{ id, voucher, rawWirePayload, receivedAt, status, txHash?, rejectionReason? }`
  - Index: `status` (`AcceptedOffline`, `PendingRelay`, `RedeemedOnChain`, `Rejected`)
  - Index: `receivedAt` (epoch timestamp)
  - Memory prevents duplicate scans of already accepted vouchers (`RepeatScan`).

---

## 4. Camera Permissions & Security Headers (`vercel.json`)

Live camera scanning requires camera permission and a secure HTTPS context. `apps/reader/vercel.json` applies:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Permissions-Policy", "value": "camera=(self)" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}
```

> [!NOTE]
> Modern browsers (Chrome, Safari, Edge) require a secure origin (`https://` or `localhost`) to access `navigator.mediaDevices.getUserMedia`. Desktop demos can also use the manual payload paste tab on `/scan`.

---

## 5. Live Demo Runbook & Verification Steps

Follow this end-to-end runbook for live demonstrations:

### Step 1: Online Pre-Flight (Terminal Preparation)
1. Open the merchant reader URL on a tablet, phone, or laptop.
2. In **Settings** (`/settings`):
   - Set up or unlock the merchant wallet.
   - Verify that the terminal public key is displayed and the SAC trustline is active.
   - Adjust `maxOfflineVoucherAmountXlm` and `maxTotalOfflineExposureXlm` as needed.
3. In **Scan** (`/scan`):
   - Click **Sync Registry** to fetch the latest registry snapshot from the indexer into IndexedDB.
   - Ensure the stale registry warning banner is dismissed.

### Step 2: Go Offline (Airplane Mode)
1. Turn **ON Airplane Mode** (or disconnect Wi-Fi / Ethernet).
2. The merchant reader terminal is now completely severed from the network.

### Step 3: Scan & Verify Shopper Voucher (Offline)
1. Open `/scan`.
2. Scan the shopper's QR code with the camera (or paste the wire base64 string on desktop).
3. The terminal verifies 100% offline:
   - Version byte (`1`).
   - Voucher accept deadline (`acceptUntil`).
   - Book redeem deadline (`redeemDeadline`).
   - Target note is open (`Open` status in local registry snapshot).
   - Merchant payee address matches terminal wallet (`requirePayeeMatch`).
   - Amount and cap are within merchant limits (`maxOfflineVoucherAmountXlm`).
   - Ed25519 signature cryptographically matches the book's registered `voucherKey`.
   - Voucher identity (`${bookId}:${noteIndex}`) has not been scanned previously.
4. On success, click **Accept & Queue Voucher**.
5. Observe the distinct **Accepted Result Screen** (`AcceptedResultView`) showing payment amount, status badge `ACCEPTED_OFFLINE`, and queue confirmation.

### Step 4: Refuse Repeat Scans (Double-Spend Protection)
1. Attempt to scan the exact same shopper voucher a second time.
2. The terminal immediately refuses the scan with the distinct **Rejected Result Screen** (`RejectedResultView`), displaying the badge `REPEAT_SCAN_REFUSED` and guidance.

### Step 5: Online Settlement via Relay
1. Reconnect the terminal online (disable Airplane Mode).
2. Navigate to **Accepted Queue** (`/accepted`).
3. Click **Redeem now**.
4. The reader submits the queued offline voucher(s) to the fee-paying relay (`POST /relay/redeem`).
5. The relay pays Soroban transaction gas and submits the settlement transaction to Stellar testnet.
6. The terminal updates the voucher status to `Redeemed on-chain` and logs the transaction hash.
