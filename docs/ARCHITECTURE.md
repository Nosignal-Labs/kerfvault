# Kerfvault Architecture

Kerfvault is an offline-first payment voucher system built on Stellar and Soroban. It bridges the gap between trust-minimized blockchain settlement and real-world offline retail environments (such as flights, rural markets, music festivals, or network blackouts) where shoppers and merchants lack active internet connectivity.

---

## 1. System Overview

```mermaid
flowchart TD
    subgraph OnlinePreparation["Phase 1: Online Funding (Shopper)"]
        S[Shopper Phone] -->|open_book / lock funds| SC[Soroban Contract]
        S -->|Generates keypair| VK[Offline Ed25519 Voucher Key]
        SC -->|Emits book_opened| IX[Kerfvault Indexer]
    end

    subgraph OfflineTransaction["Phase 2: Offline Presentation & Verification"]
        S2[Shopper Phone (Offline)] -->|Signs voucher| QR[Voucher QR Code]
        QR -->|Camera Scan| M[Merchant Reader (Offline)]
        M -->|Validates signature & cap against| RS[(Local Registry Snapshot)]
        M -->|Stores verified voucher| IDB[(Merchant IndexedDB Queue)]
    end

    subgraph OnlineSettlement["Phase 3: Online Redemption (Merchant or Relay)"]
        M2[Merchant Phone (Online)] -->|Batch submit vouchers| RL[Fee-Paying Relay]
        RL -->|redeem tx / pays fee| SC2[Soroban Contract]
        SC2 -->|SEP-41 Transfer| MA[Merchant Stellar Account]
        SC2 -->|Leftover note change| FB[Shopper Book Free Balance]
    end
```

---

## 2. Core Components

1. **Soroban Contract (`contracts/kerfvault`)**:
   The immutable on-chain custody and settlement engine. Holds the shopper's locked tokens in escrow, enforces note state transitions (`Open` to `Redeemed`), verifies offline signatures, distributes token payouts to merchants via SEP-41, and allows post-deadline reclaims.

2. **TypeScript SDK (`packages/sdk`)**:
   Isomorphic client library handling binary/compact voucher encoding, Ed25519 signing, offline validation, registry snapshot checks, and contract interactions.

3. **Shopper PWA (`apps/kerf`)**:
   Mobile-friendly web application used by the customer. Allows opening books while online, holding the dedicated offline voucher signing key in local storage, and generating QR codes offline.

4. **Merchant Reader PWA (`apps/reader`)**:
   Point-of-sale progressive web app for retail merchants. Pre-downloads registry snapshots, scans QR codes via device cameras, executes cryptographic checks entirely offline, and queues accepted vouchers.

5. **Event Indexer (`services/indexer`)**:
   Daemon that ingests on-chain events from Soroban RPC, tracks all active books and note states in PostgreSQL, and serves compact point-in-time snapshots to merchant terminals.

6. **Redemption Relay (`services/relay`)**:
   Gas-subsidized submission gateway that aggregates offline vouchers from merchants and submits `redeem` transactions to Stellar, paying transaction fees so merchants do not need XLM gas balances.

---

## 3. Key Architectural Decisions

The following six design decisions govern the Kerfvault protocol:

### Decision 1: Fixed-Denomination Note Books
* **Decision**: Shoppers reserve funds in discrete, fixed-denomination notes (e.g. 5, 10, 20, 50 USDC) within a single "book" rather than a continuous floating balance.
* **Rationale**: Offline environments cannot perform distributed concurrency control. If an account had an open-ended balance, an offline user could sign multiple conflicting vouchers totaling far more than their balance. Binding each voucher to a specific, unique note index ensures that collateral is mathematically earmarked on-chain.

### Decision 2: Segregated Offline Voucher Keypair
* **Decision**: A distinct, ephemeral Ed25519 keypair (`voucher_key`) is registered in `open_book`. The shopper's primary Stellar master wallet key is never loaded onto the offline signing device.
* **Rationale**: Offline mobile devices are exposed to theft, physical tampering, or local malware. If an offline voucher key is compromised, only the specific book's escrowed notes are at risk; the user's primary account, identity, and main wallet balances remain untouched.

### Decision 3: Split Expiration Enforcement (`accept_until` vs. `redeem_deadline`)
* **Decision**: The smart contract enforces `redeem_deadline`; the merchant reader device offline enforces `accept_until`.
* **Rationale**: The merchant's phone needs an immediate offline cutoff timestamp (`accept_until`) before which the customer is allowed to present the voucher. To protect the merchant from delays in reaching an internet connection, the on-chain contract enforces a later `redeem_deadline` ($accept\_until \le redeem\_deadline$).

### Decision 4: Reclaim Grace Period
* **Decision**: Shoppers may only reclaim unredeemed notes and free balances after `redeem_deadline + GRACE_PERIOD`.
* **Rationale**: If a shopper could reclaim funds the exact second `redeem_deadline` expires, a race condition exists where an offline merchant traveling back to connectivity could have their legitimate redemption front-run. The grace period provides a mandatory settlement window for merchants.

### Decision 5: Merchant-Configurable Offline Exposure Limits
* **Decision**: Merchants set local caps on the maximum single voucher denomination accepted offline and their aggregate unredeemed exposure.
* **Rationale**: Because offline verification relies on cached state, merchants bear a bounded residual risk of double-presentation or counterparty insolvency. Configurable limits allow merchants to align risk with transaction size (e.g. coffee shop vs. luxury goods).

### Decision 6: Bounded-Loss Double Presentation Model
* **Decision**: The system explicitly acknowledges that pure offline transactions cannot achieve distributed global consensus; the protocol bounds and isolates loss rather than claiming impossibility.
* **Rationale**: If a dishonest shopper signs two different vouchers for the exact same note index to two different merchants while offline, only the first voucher submitted on-chain will settle. The second will fail on-chain (`NoteAlreadyRedeemed`). Because notes are small, fixed denominations and signed by an identified `voucher_key`, merchant losses are capped to that single note's denomination, and the fraud is provably attributable to the shopper's registered public key.

---

## 4. Open Questions

1. **Dynamic Change Mechanism**: Should unspent note difference (amount < denomination) be immediately credited to contract `free_balance` or split into child micro-notes for offline change?
2. **Snapshot Compression**: Best compression format (Brotli vs. zstd) for high-density delivery of 100,000+ active book states to low-bandwidth merchant devices.



---

## 5. Soroban Resource Benchmarks & Testnet Metrics

Live benchmarks executed and measured on Stellar Testnet (`soroban-testnet.stellar.org`):

### 5.1 On-Chain Operations

| Operation | Real Tx Hash | Ledger | CPU Instructions | Ledger Footprint | Fee Charged (Stroops) |
|---|---|---|---|---|---|
| **Contract Deploy** | `abab00067e04a5e215f3c55df9726be048efb262abe549c299f74c398618d9ba` | 5503099 | ~1.2M instrs | Contract instance & code storage | 14,868 (~0.00148 XLM) |
| **`open_book` (2 notes)** | `eb0d8a9f4ffddf84e37217e2e293ec2e1053178132de9451d148da54cf33ae4a` | 5503118 | ~3.1M instrs | 4 entries written (Book, 2 Notes, SAC escrow) | 430,107 (~0.04301 XLM) |
| **`redeem`** | `75a2dbc87f448c2fdafafe89a3e34454cc446d4c0779440b5c04f796b97058b6` | 5503120 | ~1.8M instrs | 4 entries touched (Ed25519 verify, Book, Note, Payee) | 10,242 (~0.00102 XLM) |

### 5.2 Account & Contract Configuration

- **Kerfvault Contract ID**: `CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE`
- **Native SAC (XLM)**: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- **Test Asset SAC (KVUSD)**: `CDE6VINFMZEDXBFM52ORE62FVN2NTHBFD27AVAF4TQO73IPJRZCL65XN`

> [!IMPORTANT]
> **Classic Asset Trustline Requirement**:
> When using classic Stellar assets wrapped under a Soroban Asset Contract (such as `KVUSD`), any recipient merchant address must establish a classic trustline to the asset issuer (`GCOQSUSRFKOLBTEMY5THMHIMLOLILMI6WI4R6XGT3LJ2YGHXFTADSTLD`) before Soroban cross-contract token transfers can credit their balance. Native XLM wrapped under the native SAC requires no trustline.
