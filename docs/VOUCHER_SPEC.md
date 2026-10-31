# Kerfvault Voucher Specification (v1)

> [!IMPORTANT]
> **STATUS: v1 FROZEN**
> This specification defines the frozen canonical wire format and binary message format for Kerfvault offline vouchers. All implementations (Soroban smart contracts, TypeScript SDK, merchant readers, and shopper wallets) must adhere strictly to these byte-level definitions.

---

## 1. Overview & Objectives

An offline payment voucher is a cryptographically signed authorization produced by a shopper's device without requiring network connectivity. It authorizes the Kerfvault smart contract to transfer a specified token amount from the shopper's locked escrow note to a designated merchant upon submission to the Stellar/Soroban network.

Key security requirements:
- **Replay Protection**: A voucher note index is marked `Redeemed` on-chain upon initial submission; subsequent attempts to redeem the same note fail.
- **Redirect Protection**: An untrusted submitter or relay cannot alter the recipient merchant address because the merchant address is bound inside the signed message.
- **Inflation Protection**: The voucher amount is constrained by the contract to $\le \text{cap}$ and $\le \text{denomination}$.
- **Temporal Boundedness**: The merchant reader rejects vouchers offline past `accept_until`.
- **Domain & Contract Binding**: The voucher binds both a protocol domain tag and the specific target contract address to prevent cross-contract and cross-network replaying.

---

## 2. Canonical Message Fields

The canonical byte sequence signed by the shopper's offline Ed25519 voucher key contains exactly 9 fields in strict concatenation order with fixed widths and network byte order (big-endian):

| Offset | Field Index | Field Name | Type / Width | Value / Encoding | Purpose & Security Justification |
|---|---|---|---|---|---|
| 0 | 0 | `domain_tag` | `bytes16` (16 bytes) | ASCII `b"KERFVAULT_V1\0\0\0\0"` | Domain-separation tag preventing cross-protocol and cross-version signature reuse. |
| 16 | 1 | `version` | `uint8` (1 byte) | `0x01` | Protocol version identifier. |
| 17 | 2 | `contract_id` | `ascii56` (56 bytes) | ASCII StrKey (`C...`) | Target Soroban contract address. Prevents replaying vouchers across contracts or environments. |
| 73 | 3 | `book_id` | `uint64` (8 bytes) | Big-endian unsigned int | ID of the escrow book opened by the shopper. |
| 81 | 4 | `note_index` | `uint32` (4 bytes) | Big-endian unsigned int | Zero-indexed position of the note in the book (`DataKey::Note(book_id, note_index)`). |
| 85 | 5 | `merchant` | `ascii56` (56 bytes) | ASCII StrKey (`G...`) | Payee merchant account address. Guarantees funds cannot be redirected by relays. |
| 141 | 6 | `amount` | `int128` (16 bytes) | Big-endian signed int | Actual payment amount in base units (stroops). Must be $\le \text{cap}$ and $\le \text{note denomination}$. |
| 157 | 7 | `cap` | `int128` (16 bytes) | Big-endian signed int | Maximum allowable spend authorized by the shopper for this note. |
| 173 | 8 | `accept_until` | `uint64` (8 bytes) | Big-endian unsigned int | POSIX timestamp deadline after which merchant readers must reject the voucher offline. |

**Total Canonical Message Length:** **181 bytes**.

---

## 3. Cryptographic Signature

- **Algorithm**: Ed25519 (Edwards-curve Digital Signature Algorithm over Curve25519 with SHA-512, RFC 8032).
- **Signing Key**: The private key corresponding to `Book.voucher_key` (registered on-chain during `open_book`).
- **Signature Length**: 64 bytes (`bytes64`).
- **Signature Verification**: Verified against the 181-byte canonical message using `voucher_key`.

---

## 4. QR Wire Format Encoding

For optical transmission (QR code scanning) and relay submission, the wire format concatenates the 181-byte canonical message and the 64-byte signature:

$$\text{WireVoucherBinary} = \text{CanonicalMessage (181 bytes)} \mathbin{\Vert} \text{Signature (64 bytes)}$$

**Total Binary Payload:** **245 bytes**.

### Wire Text Encoding
For presentation in QR codes and HTTP payloads:
- The 245 raw bytes are encoded as **URL-safe Base64 without padding** (RFC 4648 §5).
- Resulting string length: **327 characters**.
- Readily fits in standard QR Code Version 10 (with Error Correction Level M) and decodes with high speed and reliability on low-cost smartphone cameras.

---

## 5. Architectural Decisions & Rationale

### Decision 1: 56-Byte StrKey Encoding for Addresses
- **Options Considered**: Raw 32-byte Ed25519 public key / contract hash vs 56-byte ASCII StrKey string (`C...` / `G...`).
- **Resolution**: Use 56-byte ASCII StrKey.
- **Rationale**: In the Soroban `no_std` runtime, `Address::to_string()` produces the 56-byte StrKey string natively without allocations or external dependencies. Using raw 32-byte public keys would require pulling in an external base32 decoding crate or hand-rolling decoders in smart contracts, introducing significant attack surface. In TypeScript, addresses are already managed as StrKey strings.

### Decision 2: Big-Endian Byte Order
- **Options Considered**: Little-endian vs Big-endian.
- **Resolution**: Network byte order (big-endian) for all multi-byte integers (`uint64`, `uint32`, `int128`).
- **Rationale**: Follows standard Internet protocols, RFC 8032 norms, and Soroban XDR integer conventions.

### Decision 3: Fixed-Width Concatenation vs CBOR / JSON
- **Options Considered**: Compact CBOR (RFC 8949) vs fixed-width binary concatenation.
- **Resolution**: Fixed-width binary concatenation (181 bytes).
- **Rationale**: Eliminates parser ambiguity, canonization quirks, and CPU overhead in the smart contract. Both Rust (`no_std`) and TypeScript can slice and unpack bytes deterministically at fixed offsets with zero memory allocation.

### Decision 4: Contract Domain Separation
- **Options Considered**: Implicit binding vs explicit domain tag prefix.
- **Resolution**: Dedicated 16-byte domain tag prefix `b"KERFVAULT_V1\0\0\0\0"`.
- **Rationale**: Ensures signatures produced for Kerfvault vouchers can never be valid or re-interpreted under any other cryptographic protocol or subsequent contract versions.
