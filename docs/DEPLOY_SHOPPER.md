# Deploying Kerfvault Shopper App to Vercel

This document outlines the step-by-step procedure for deploying the Kerfvault Shopper Progressive Web Application (`apps/kerf`) to Vercel and verifying its offline airplane-mode capabilities on mobile devices.

---

## 1. Vercel Project Setup

1. **Import Repository**:
   - Go to the [Vercel Dashboard](https://vercel.com) and click **Add New... > Project**.
   - Select the `Nosignal-Labs/kerfvault` GitHub repository.

2. **Configure Project Settings**:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `apps/kerf`
     *(Ensure "Include files outside the root directory in the Build Step" is enabled to allow resolving workspace packages `@kerfvault/sdk` and `@kerfvault/web-wallet`)*.

3. **Build & Development Commands**:
   - **Build Command**: `pnpm --filter kerf build` (or leave default `next build` if building from root).
   - **Install Command**: `pnpm install`
   - **Output Directory**: `.next`

---

## 2. Environment Variables Configuration

Add the following environment variables in **Project Settings > Environment Variables** on Vercel:

| Variable Name | Value | Purpose |
|---------------|-------|---------|
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` | Enforces testnet-only operation (mainnet blocked) |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Testnet consensus passphrase |
| `NEXT_PUBLIC_HORIZON_URL` | `https://horizon-testnet.stellar.org` | Stellar Horizon balance queries |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint for contract calls |
| `NEXT_PUBLIC_CONTRACT_ID` | `CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE` | Deployed Kerfvault Soroban contract ID |
| `NEXT_PUBLIC_TOKEN_ADDRESS` | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | Testnet Native SAC (XLM) |
| `NEXT_PUBLIC_RELAY_URL` | `https://relay.kerfvault.com` (or local relay) | Optional demo faucet and relay |
| `NEXT_PUBLIC_INDEXER_URL` | `https://indexer.kerfvault.com` | Optional registry indexer |

---

## 3. Custom Headers & Service Worker (`vercel.json`)

`apps/kerf/vercel.json` configures proper caching and service worker scope headers:
- `Service-Worker-Allowed: /` allows the service worker at `/sw.js` to control the entire origin scope.
- `Cache-Control: public, max-age=0, must-revalidate` for `/sw.js` prevents stale service worker scripts from being served.
- `Cache-Control: public, max-age=3600` for `/manifest.json`.
- Standard security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.

---

## 4. Pre-Flight Verification on Mobile (Airplane Mode Checklist)

To verify the deployment for live offline demos:

1. **Connect & Pre-Cache (Online Step)**:
   - Open the production HTTPS URL on a smartphone (Safari on iOS or Chrome on Android).
   - Verify the `TESTNET ONLY` badge is visible in the header.
   - Onboard or unlock a shopper wallet with a passcode.
   - Open a voucher book with preset denominations (e.g. 5, 10, 20 XLM) using testnet XLM.
   - Navigate to `/pay` and verify the opened book and notes are visible.
   - Allow 3 seconds for the native Service Worker (`/sw.js`) to complete precaching the App Shell.

2. **Simulate Airplane Mode (Offline Step)**:
   - Turn **ON Airplane Mode** on the phone. Disable Wi-Fi and Cellular data completely.
   - Observe the **✈ Airplane Mode Active** banner appear at the top of the screen.
   - Hard refresh the `/pay` page: confirm the page loads instantly from the service worker cache without network errors.
   - Pick Note #0 (5 XLM), set the merchant payee address and spending cap.
   - Tap **Sign Voucher & Show QR Code**: confirm the voucher is cryptographically signed using WebCrypto and the QR code renders cleanly.
   - Note is immediately marked `spent_offline` in local storage, preventing accidental double-presentation.

