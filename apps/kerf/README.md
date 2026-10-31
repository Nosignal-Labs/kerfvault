# Kerfvault Shopper PWA (`@kerfvault/kerf`)

Progressive Web App for shoppers to manage voucher books, sign offline payment notes, and present dynamic QR codes to merchants.

## Routes

- `/`: Wallet home, book status, balance summary.
- `/books/new`: Form to open a new book of fixed-denomination notes.
- `/books/[id]`: Book status, note allocation, and reclaim interface.
- `/pay`: Note selector and QR voucher display.
- `/settings`: Voucher signing keypair and passcode lock.

## Offline Architecture Note

> [!NOTE]
> Offline caching logic via Service Worker (`sw.js`) and IndexedDB caching is currently stubbed with `TODO` markers. Full Workbox/Service Worker cache strategies will be added in Wave 3.

