# Kerfvault Threat Model & Security Analysis

> [!CAUTION]
> The contract and SDK are currently **experimental and unaudited**. This document describes the theoretical security bounds and operational threat model.

---

## 1. What Offline Systems Cannot Guarantee

Before analyzing specific threats, we state plainly what an offline-first system **cannot mathematically guarantee**:

> **Fundamental Offline Limitation**:
> In the absence of real-time network consensus or tamper-proof secure enclave hardware, **no software-only offline system can completely prevent double-presentation (double-spending) across two isolated merchant terminals**.
>
> If a malicious shopper signs two valid vouchers for the same note to two unconnected merchants, both merchants' offline devices will verify the signatures as authentic against their local snapshots. When both merchants later go online to redeem, the blockchain executes first-come, first-served settlement. The first transaction succeeds; the second transaction fails with `NoteAlreadyRedeemed`.

### Protocol Stance on Double Spending
Rather than asserting impossibility, Kerfvault:
1. **Caps the loss** to the note's fixed denomination (typically small, e.g. 5–50 USDC).
2. **Bounds total exposure** via merchant-configured offline transaction limits.
3. **Creates cryptographic proof of fraud**: the two conflicting vouchers carry valid signatures from the same registered `voucher_key`, giving the victimized merchant non-repudiable evidence for dispute resolution, blacklisting, or legal remedies.

---

## 2. Threat Analysis Matrix

| Threat | Attack Vector | Severity | Protocol Defence & Mitigation |
|---|---|---|---|
| **Double Presentation (Offline)** | Malicious shopper signs the same note index to Merchant A and Merchant B while both are offline. | **Medium** | - Notes have small, fixed denominations.<br>- Contract enforces atomic single-redemption (`NoteAlreadyRedeemed`).<br>- Merchants configure local exposure caps.<br>- Both vouchers produce non-repudiable proof of double-signing by `voucher_key`. |
| **Forged Vouchers** | Attacker fabricates a voucher with arbitrary amount and fake signature. | **High** | - Contract and Reader verify Ed25519 signature against `Book.voucher_key`.<br>- Unfunded books are rejected by the reader against the synced registry snapshot. |
| **Early Reclaim / Front-Running** | Shopper reclaims locked escrow funds before an offline merchant can settle. | **High** | - Contract enforces a mandatory `GRACE_PERIOD` after `redeem_deadline` before `reclaim` is permitted.<br>- Merchants offline enforce `accept_until < redeem_deadline`, ensuring a guaranteed settlement window. |
| **Voucher Replay** | Attacker or merchant attempts to submit the same voucher multiple times on-chain. | **High** | - Contract atomically transitions note state from `Open` to `Redeemed`.<br>- Second submission fails immediately with error code `NoteAlreadyRedeemed`. |
| **Payment Redirection** | Intermediary or relay intercepts voucher and alters payout address to their own. | **Critical** | - Merchant public address (`merchant`) is embedded directly in the canonical signed message payload.<br>- Contract transfers tokens strictly to `voucher.merchant`. Tampering invalidates the Ed25519 signature. |
| **Stolen Shopper Phone** | Thief gains physical access to the shopper's device and attempts to spend notes. | **Medium** | - Shopper PWA keys are protected by local device passcodes and WebCrypto encryption.<br>- Primary wallet keys are never on the offline device.<br>- Maximum loss is limited to unspent notes in that specific book. |
| **Stale Registry Snapshot** | Merchant uses an outdated snapshot where a note was already redeemed on-chain. | **Medium** | - Reader displays snapshot freshness and warns on stale snapshots (>24h).<br>- Merchants can establish sync policies requiring daily snapshot updates before accepting offline notes. |
| **Amount Tampering / Inflation** | Dishonest merchant modifies payment amount above what shopper authorized. | **High** | - `amount` and `cap` are bound within the signed payload.<br>- Contract enforces `amount <= cap` and `amount <= note.denomination`. |

---

## 3. Open Questions

1. **Reputation Registry**: Should the indexer maintain an on-chain/off-chain blacklist of `voucher_key`s that have engaged in double-signing?
2. **Dispute Bond**: Should `open_book` require an optional dispute deposit slashed if cryptographic proof of double-presentation is published?

