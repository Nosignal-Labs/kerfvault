export interface OfflineVoucher {
  version: number;
  contractId: string;
  bookId: bigint;
  noteIndex: number;
  merchant: string;
  amount: bigint;
  cap: bigint;
  acceptUntil: bigint;
  voucherKey?: string;
  signature: string;
}

export const DOMAIN_TAG_BYTES = new Uint8Array([
  0x4b, 0x45, 0x52, 0x46, 0x56, 0x41, 0x55, 0x4c, 0x54, 0x5f, 0x56, 0x31, 0x00, 0x00, 0x00, 0x00,
]); // "KERFVAULT_V1\0\0\0\0" (16 bytes)

export const CANONICAL_MSG_LENGTH = 181;
export const SIGNATURE_LENGTH = 64;
export const WIRE_PAYLOAD_LENGTH = CANONICAL_MSG_LENGTH + SIGNATURE_LENGTH; // 245 bytes

/**
 * Encodes binary buffer to URL-safe Base64 without padding (RFC 4648 §5).
 */
export function bytesToUrlSafeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis
    .btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Decodes URL-safe Base64 string to Uint8Array.
 */
export function urlSafeBase64ToBytes(base64: string): Uint8Array {
  let unescaped = base64.replace(/-/g, "+").replace(/_/g, "/");
  while (unescaped.length % 4 !== 0) {
    unescaped += "=";
  }
  const binary = globalThis.atob(unescaped);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Helper to convert hex string to Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Helper to convert Uint8Array to hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Constructs the canonical 181-byte message for an offline voucher.
 * Reference: docs/VOUCHER_SPEC.md
 */
export function serializeCanonicalMessage(voucher: {
  version?: number;
  contractId: string;
  bookId: bigint;
  noteIndex: number;
  merchant: string;
  amount: bigint;
  cap: bigint;
  acceptUntil: bigint;
}): Uint8Array {
  const buf = new Uint8Array(CANONICAL_MSG_LENGTH);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // 1. Domain tag: 16 bytes
  buf.set(DOMAIN_TAG_BYTES, 0);

  // 2. Version: 1 byte uint8
  buf[16] = voucher.version ?? 1;

  // 3. Contract ID: 56 bytes ASCII
  const enc = new TextEncoder();
  const cidBytes = enc.encode(voucher.contractId);
  buf.set(cidBytes.subarray(0, 56), 17);

  // 4. Book ID: 8 bytes big-endian uint64
  view.setBigUint64(73, BigInt(voucher.bookId), false);

  // 5. Note index: 4 bytes big-endian uint32
  view.setUint32(81, voucher.noteIndex, false);

  // 6. Merchant address: 56 bytes ASCII
  const merchBytes = enc.encode(voucher.merchant);
  buf.set(merchBytes.subarray(0, 56), 85);

  // 7. Amount: 16 bytes big-endian int128
  let amt = BigInt(voucher.amount);
  if (amt < 0n) {
    amt = (1n << 128n) + amt;
  }
  view.setBigUint64(141, amt >> 64n, false);
  view.setBigUint64(149, amt & 0xffffffffffffffffn, false);

  // 8. Cap: 16 bytes big-endian int128
  let cap = BigInt(voucher.cap);
  if (cap < 0n) {
    cap = (1n << 128n) + cap;
  }
  view.setBigUint64(157, cap >> 64n, false);
  view.setBigUint64(165, cap & 0xffffffffffffffffn, false);

  // 9. Accept until: 8 bytes big-endian uint64
  view.setBigUint64(173, BigInt(voucher.acceptUntil), false);

  return buf;
}

/**
 * Encodes an offline voucher object into its QR-friendly wire string representation.
 * Reference: docs/VOUCHER_SPEC.md
 */
export function encodeVoucher(voucher: OfflineVoucher): string {
  const msgBytes = serializeCanonicalMessage(voucher);
  const sigBytes = hexToBytes(voucher.signature);
  if (sigBytes.length !== SIGNATURE_LENGTH) {
    throw new Error(`Signature must be ${SIGNATURE_LENGTH} bytes, got ${sigBytes.length}`);
  }

  const wireBytes = new Uint8Array(WIRE_PAYLOAD_LENGTH);
  wireBytes.set(msgBytes, 0);
  wireBytes.set(sigBytes, CANONICAL_MSG_LENGTH);

  return bytesToUrlSafeBase64(wireBytes);
}

/**
 * Decodes a raw wire string (e.g. from QR scan) into a structured OfflineVoucher.
 * Reference: docs/VOUCHER_SPEC.md
 */
export function decodeVoucher(raw: string): OfflineVoucher {
  const bytes = urlSafeBase64ToBytes(raw.trim());
  if (bytes.length !== WIRE_PAYLOAD_LENGTH) {
    throw new Error(
      `TruncatedPayload: payload must be exactly ${WIRE_PAYLOAD_LENGTH} bytes, got ${bytes.length}`
    );
  }

  const dec = new TextDecoder();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Verify domain tag prefix "KERFVAULT_V1"
  for (let i = 0; i < 12; i++) {
    if (bytes[i] !== DOMAIN_TAG_BYTES[i]) {
      throw new Error("InvalidDomainTag: unrecognized voucher domain tag");
    }
  }

  const version = bytes[16];
  if (version !== 1) {
    throw new Error(`InvalidVersion: expected version 1, got ${version}`);
  }

  const contractId = dec.decode(bytes.subarray(17, 73)).trim();
  const bookId = view.getBigUint64(73, false);
  const noteIndex = view.getUint32(81, false);
  const merchant = dec.decode(bytes.subarray(85, 141)).trim();

  // Read 128-bit amount (signed)
  const amtHigh = view.getBigUint64(141, false);
  const amtLow = view.getBigUint64(149, false);
  let amount = (amtHigh << 64n) | amtLow;
  if (amtHigh & 0x8000000000000000n) {
    amount = amount - (1n << 128n);
  }

  // Read 128-bit cap (signed)
  const capHigh = view.getBigUint64(157, false);
  const capLow = view.getBigUint64(165, false);
  let cap = (capHigh << 64n) | capLow;
  if (capHigh & 0x8000000000000000n) {
    cap = cap - (1n << 128n);
  }

  const acceptUntil = view.getBigUint64(173, false);
  const signature = bytesToHex(bytes.subarray(181, 245));

  return {
    version,
    contractId,
    bookId,
    noteIndex,
    merchant,
    amount,
    cap,
    acceptUntil,
    signature,
  };
}
