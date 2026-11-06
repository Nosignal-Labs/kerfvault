# Service Worker Strategy and Next.js 15 Compatibility Analysis

## Background & Objective
In Kerfvault, the shopper payment flow (`/pay`) must function reliably with the mobile device placed in **airplane mode** (100% offline) after the app has been visited once online.

To achieve this, the application must:
1. Cache the App Shell (HTML, styles, scripts, Next.js static asset chunks) and the `/pay` route.
2. Serve cached assets on navigation even when network connectivity is completely severed.
3. Keep voucher signing data (unspent notes, encrypted/decrypted keys, book parameters) persistently in browser storage (`localStorage` / WebCrypto).

## Evaluated Service Worker Approaches

### Option 1: Legacy `next-pwa`
- **Status:** Unmaintained since Next.js 12/13.
- **Drawbacks:** Incompatible with Next.js 14/15 App Router and React Server Components (RSC). Hard-crashes during build due to deprecated webpack hook references.
- **Verdict:** **Rejected**.

### Option 2: `@ducanh2912/next-pwa` / `@serwist/next`
- **Status:** Maintained forks that integrate into `next.config.js`.
- **Drawbacks:** Adds external webpack compilation plugins and significant dependencies. Fragile across Next.js minor releases (e.g., Next 15 Turbopack vs Webpack bundling differences), potentially breaking CI build steps when upstream internals change.
- **Verdict:** **Rejected in favor of standard web APIs**.

### Option 3: Dedicated Native Service Worker (`public/sw.js`) + App Shell Cache Strategy
- **Status:** Uses standard W3C Service Worker and Cache Storage APIs supported in all modern mobile and desktop browsers.
- **Advantages:**
  1. **Zero build dependencies:** Does not conflict with Next.js 15 App Router, React 19, or Turbopack.
  2. **Precise caching control:**
     - **Navigation Requests (`mode: 'navigate'`):** Network-first with immediate cache fallback to `/pay` and `/` when offline or in airplane mode.
     - **Static Assets (`/_next/static/*`):** Stale-While-Revalidate caching ensuring fast page loads and offline availability.
     - **External API / RPC Requests:** Network-only (no caching of Soroban RPC, Horizon, or Faucet).
  3. **Offline Status Awareness:** Registered cleanly via client component (`ServiceWorkerRegister.tsx`) with real-time `online`/`offline` listener notifying shoppers when airplane mode is detected.
- **Verdict:** **Selected as the optimal, resilient architecture**.

## Storage & Cryptographic Isolation
All cryptographic materials and offline signing state are maintained in local storage:
- `kerfvault_shopper_books`: Cached snapshot of opened books and notes.
- `kerfvault_offline_spent`: Tracks notes marked `spent_offline` to prevent double-spending in airplane mode.
- `kerfvault_shopper_voucher_key`: WebCrypto AES-GCM encrypted Ed25519 signing key.
Vouchers are signed deterministically using raw WebCrypto / Stellar Ed25519 primitives without requiring any network call.

