# Kerfvault Voucher Specification (v1)

> [!WARNING]
> **STATUS: DRAFT**
> This specification outlines the draft wire format and canonical signed message format for Kerfvault offline vouchers. Field ordering and byte packings are subject to refinement before mainnet release.

---

## 1. Overview & Objectives

An offline payment voucher is a cryptographically signed instruction produced by a shopper's device without network access. It authorises a smart contract to transfer a specified quantity of locked escrow tokens to a designated merchant upon submission.

Key security requirements:
- **Replay Protection**: A voucher cannot be redeemed more than once on-chain.
- **Redirect Protection**: An untrusted submitter or malicious intermediary cannot divert funds away from the merchant.
- **Inflation Protection**: The voucher cannot extract more funds than the note's fixed collateral or the signed cap.
- **Temporal Boundedness**: The voucher cannot be redeemed past its validity deadline.

---

## 2. Canonical Message Fields

The canonical byte sequence signed by the shopper's offline Ed25519 key contains the following fields in strict concatenation order:

| Field Index | Field Name | Type / Size | Purpose & Security Justification |
|---|---|---|---|
| 0 | `version` | `uint8` (1 byte) | Protocol version identifier (currently `1`). Protects against format cross-version confusion. |
| 1 | `contract_id` | `bytes32` (32 bytes) | On-chain contract address (hash of Soroban Contract ID). Prevents replaying vouchers across different contracts or networks. |
| 2 | `book_id` | `uint64` (8 bytes, big-endian) | ID of the specific escrow book opened by the shopper. |
| 3 | `note_index` | `uint32` (4 bytes, big-endian) | Zero-indexed position of the note in the book. Ensures 1:1 mapping with on-chain note storage (`DataKey::Note(book_id, note_index)`). |
| 4 | `merchant` | `bytes32` (32 bytes) | Raw ed25519 public key / account ID of the merchant. **Redirect protection**: ensures that whoever submits the voucher to the network (relay, merchant, or third party), tokens are strictly paid to this address. |
| 5 | `amount` | `int128` (16 bytes, big-endian) | Actual amount (in base token stroops) to transfer to merchant. Must be $\le$ `cap` and $\le$ `denomination`. |
| 6 | `cap` | `int128` (16 bytes, big-endian) | Maximum allowable amount spendable by this voucher. Protects shopper from unauthorized merchant modification. |
| 7 | `accept_until` | `uint64` (8 bytes, big-endian) | POSIX timestamp after which the merchant reader must reject the voucher offline. Must be $\le$ book's on-chain `redeem_deadline`. |

Total canonical message payload length: **117 bytes**.

---

## 3. Cryptographic Signature

- **Algorithm**: Ed25519 (Edwards-curve Digital Signature Algorithm over Curve25519 with SHA-512).
- **Key**: Signed using the private key corresponding to `Book.voucher_key` (registered in `open_book`).
- **Signature Length**: 64 bytes (`bytes64`).

---

## 4. QR Wire Format Encoding

For optical transmission (QR code scanning), the payload is packaged with the signature:

$$\text{WireVoucher} = \text{CanonicalMessage (117 bytes)} \mathbin{\Vert} \text{Signature (64 bytes)}$$

Total binary length: **181 bytes**.

---

## 5. Open Questions

1. **Text Encoding for QR Codes**:
   - Should binary data be formatted using standard **Base45** (standard for European digital health certificates, optimized for alphanumeric QR mode) or raw binary 8-bit byte mode?
   - Alphanumeric QR codes provide higher density and faster optical detection on low-cost smartphone cameras.
2. **CBOR vs. Packed Raw Struct**:
   - Whether to use compact CBOR (RFC 8949) serialization for self-describing fields or fixed-width binary concatenation to minimize byte size.
3. **Multi-Currency Support**:
   - Whether the token contract address should also be bound inside the message payload or inherited implicitly from `Book.token`.

