# Kerfvault Merchant Reader (`@kerfvault/reader`)

Progressive Web App for merchants to scan, cryptographically verify, and queue payment vouchers offline, and redeem them on-chain when connectivity is restored.

## Routes

- `/`: Terminal home, sync health, registry state.
- `/scan`: Camera viewfinder for scanning shopper QR vouchers.
- `/accepted`: Offline queue of verified vouchers awaiting settlement.
- `/settings`: Payout address, maximum offline voucher cap, and total exposure controls.

## Offline Architecture Note

> [!NOTE]
> Camera video stream scanning and IndexedDB voucher storage in `src/lib/storage.ts` are currently provided as typed interfaces and UI stubs. Full Service Worker caching and live verification will be hooked up in Wave 3.

