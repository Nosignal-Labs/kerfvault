import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, '../test-vectors/voucher.v1.json');

// Fixed throwaway seed labelled TEST ONLY
const SEED_LABEL = 'TEST ONLY: KERFVAULT DEMO SEED 1';
const seed = crypto.createHash('sha256').update(SEED_LABEL).digest();

// Derive Ed25519 keypair from 32-byte seed using RFC 8410 PKCS#8 prefix
const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
const privKeyDer = Buffer.concat([pkcs8Prefix, seed]);
const privKey = crypto.createPrivateKey({ key: privKeyDer, format: 'der', type: 'pkcs8' });
const pubKey = crypto.createPublicKey(privKey);
const pubDer = pubKey.export({ format: 'der', type: 'spki' });
const rawPubKey = pubDer.subarray(pubDer.length - 32);
const voucherKeyHex = rawPubKey.toString('hex');

// Standard test fixtures with valid Stellar StrKey checksums
const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
const CONTRACT_ID_B = 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526';
const BOOK_ID = 101n;
const NOTE_INDEX = 0;
const MERCHANT_ID = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';
const MERCHANT_ID_B = 'GABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEJXA';
const AMOUNT = 10_000_000n; // 1 XLM in stroops
const CAP = 10_000_000n;
const ACCEPT_UNTIL = 1793404800n; // Future timestamp

/**
 * Builds the canonical 181-byte message buffer per docs/VOUCHER_SPEC.md
 */
export function buildCanonicalMessage({
  domainTag = 'KERFVAULT_V1\0\0\0\0',
  version = 1,
  contractId = CONTRACT_ID,
  bookId = BOOK_ID,
  noteIndex = NOTE_INDEX,
  merchant = MERCHANT_ID,
  amount = AMOUNT,
  cap = CAP,
  acceptUntil = ACCEPT_UNTIL,
}) {
  const buf = Buffer.alloc(181);
  let offset = 0;

  // 1. Domain tag: 16 bytes ASCII
  buf.write(domainTag, offset, 16, 'ascii');
  offset += 16;

  // 2. Version: 1 byte uint8
  buf.writeUInt8(version, offset);
  offset += 1;

  // 3. Contract ID: 56 bytes ASCII
  buf.write(contractId.padEnd(56, ' '), offset, 56, 'ascii');
  offset += 56;

  // 4. Book ID: 8 bytes uint64 big-endian
  buf.writeBigUInt64BE(BigInt(bookId), offset);
  offset += 8;

  // 5. Note index: 4 bytes uint32 big-endian
  buf.writeUInt32BE(Number(noteIndex), offset);
  offset += 4;

  // 6. Merchant: 56 bytes ASCII
  buf.write(merchant.padEnd(56, ' '), offset, 56, 'ascii');
  offset += 56;

  // 7. Amount: 16 bytes int128 big-endian (signed)
  const amtBuf = Buffer.alloc(16);
  let amtBig = BigInt(amount);
  if (amtBig < 0n) {
    amtBig = (1n << 128n) + amtBig;
  }
  amtBuf.writeBigUInt64BE(amtBig >> 64n, 0);
  amtBuf.writeBigUInt64BE(amtBig & 0xffffffffffffffffn, 8);
  amtBuf.copy(buf, offset);
  offset += 16;

  // 8. Cap: 16 bytes int128 big-endian (signed)
  const capBuf = Buffer.alloc(16);
  let capBig = BigInt(cap);
  if (capBig < 0n) {
    capBig = (1n << 128n) + capBig;
  }
  capBuf.writeBigUInt64BE(capBig >> 64n, 0);
  capBuf.writeBigUInt64BE(capBig & 0xffffffffffffffffn, 8);
  capBuf.copy(buf, offset);
  offset += 16;

  // 9. Accept until: 8 bytes uint64 big-endian
  buf.writeBigUInt64BE(BigInt(acceptUntil), offset);
  offset += 8;

  if (offset !== 181) {
    throw new Error(`Unexpected message length: ${offset}`);
  }
  return buf;
}

/**
 * Encodes 245-byte payload to URL-safe Base64 without padding.
 */
function toUrlSafeBase64(buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Generate valid canonical message and signature
const validMsg = buildCanonicalMessage({});
const validSig = crypto.sign(null, validMsg, privKey);
const validWire = toUrlSafeBase64(Buffer.concat([validMsg, validSig]));

// Vector definitions
const vectors = [
  {
    id: 'vector-01-valid',
    description: 'Valid voucher with authentic Ed25519 signature and unexpired timestamp',
    seedLabel: SEED_LABEL,
    voucherKeyHex,
    contractId: CONTRACT_ID,
    bookId: Number(BOOK_ID),
    noteIndex: NOTE_INDEX,
    merchant: MERCHANT_ID,
    amount: AMOUNT.toString(),
    cap: CAP.toString(),
    acceptUntil: Number(ACCEPT_UNTIL),
    canonicalMessageHex: validMsg.toString('hex'),
    signatureHex: validSig.toString('hex'),
    wirePayload: validWire,
    expectedValid: true,
    expectedError: null,
  },
  {
    id: 'vector-02-expired',
    description: 'Voucher with acceptUntil timestamp in the past',
    seedLabel: SEED_LABEL,
    voucherKeyHex,
    contractId: CONTRACT_ID,
    bookId: Number(BOOK_ID),
    noteIndex: NOTE_INDEX,
    merchant: MERCHANT_ID,
    amount: AMOUNT.toString(),
    cap: CAP.toString(),
    acceptUntil: 1500000000, // Past timestamp (July 2017)
    canonicalMessageHex: buildCanonicalMessage({ acceptUntil: 1500000000n }).toString('hex'),
    signatureHex: crypto.sign(null, buildCanonicalMessage({ acceptUntil: 1500000000n }), privKey).toString('hex'),
    wirePayload: toUrlSafeBase64(
      Buffer.concat([
        buildCanonicalMessage({ acceptUntil: 1500000000n }),
        crypto.sign(null, buildCanonicalMessage({ acceptUntil: 1500000000n }), privKey),
      ])
    ),
    expectedValid: false,
    expectedError: 'VoucherExpired',
  },
  {
    id: 'vector-03-tampered-cap',
    description: 'Voucher signed for cap 10 XLM but payload tampered to claim cap 50 XLM',
    seedLabel: SEED_LABEL,
    voucherKeyHex,
    contractId: CONTRACT_ID,
    bookId: Number(BOOK_ID),
    noteIndex: NOTE_INDEX,
    merchant: MERCHANT_ID,
    amount: AMOUNT.toString(),
    cap: '50000000', // Tampered cap
    acceptUntil: Number(ACCEPT_UNTIL),
    canonicalMessageHex: buildCanonicalMessage({ cap: 50_000_000n }).toString('hex'),
    signatureHex: validSig.toString('hex'), // Signature is for original cap
    wirePayload: toUrlSafeBase64(Buffer.concat([buildCanonicalMessage({ cap: 50_000_000n }), validSig])),
    expectedValid: false,
    expectedError: 'InvalidSignature',
  },
  {
    id: 'vector-04-tampered-merchant',
    description: 'Voucher signed for merchant A but payload tampered to claim merchant B',
    seedLabel: SEED_LABEL,
    voucherKeyHex,
    contractId: CONTRACT_ID,
    bookId: Number(BOOK_ID),
    noteIndex: NOTE_INDEX,
    merchant: MERCHANT_ID_B,
    amount: AMOUNT.toString(),
    cap: CAP.toString(),
    acceptUntil: Number(ACCEPT_UNTIL),
    canonicalMessageHex: buildCanonicalMessage({
      merchant: MERCHANT_ID_B,
    }).toString('hex'),
    signatureHex: validSig.toString('hex'),
    wirePayload: toUrlSafeBase64(
      Buffer.concat([
        buildCanonicalMessage({
          merchant: MERCHANT_ID_B,
        }),
        validSig,
      ])
    ),
    expectedValid: false,
    expectedError: 'InvalidSignature',
  },
  {
    id: 'vector-05-tampered-note-index',
    description: 'Voucher signed for note 0 but claimed for note 1',
    seedLabel: SEED_LABEL,
    voucherKeyHex,
    contractId: CONTRACT_ID,
    bookId: Number(BOOK_ID),
    noteIndex: 1, // Tampered note index
    merchant: MERCHANT_ID,
    amount: AMOUNT.toString(),
    cap: CAP.toString(),
    acceptUntil: Number(ACCEPT_UNTIL),
    canonicalMessageHex: buildCanonicalMessage({ noteIndex: 1 }).toString('hex'),
    signatureHex: validSig.toString('hex'),
    wirePayload: toUrlSafeBase64(Buffer.concat([buildCanonicalMessage({ noteIndex: 1 }), validSig])),
    expectedValid: false,
    expectedError: 'InvalidSignature',
  },
  {
    id: 'vector-06-wrong-contract-id',
    description: 'Voucher signed for contract A presented against contract B',
    seedLabel: SEED_LABEL,
    voucherKeyHex,
    contractId: CONTRACT_ID_B,
    bookId: Number(BOOK_ID),
    noteIndex: NOTE_INDEX,
    merchant: MERCHANT_ID,
    amount: AMOUNT.toString(),
    cap: CAP.toString(),
    acceptUntil: Number(ACCEPT_UNTIL),
    canonicalMessageHex: buildCanonicalMessage({
      contractId: CONTRACT_ID_B,
    }).toString('hex'),
    signatureHex: validSig.toString('hex'),
    wirePayload: toUrlSafeBase64(
      Buffer.concat([
        buildCanonicalMessage({
          contractId: CONTRACT_ID_B,
        }),
        validSig,
      ])
    ),
    expectedValid: false,
    expectedError: 'InvalidSignature',
  },
  {
    id: 'vector-07-wrong-book-id',
    description: 'Voucher signed for book 101 presented for book 999',
    seedLabel: SEED_LABEL,
    voucherKeyHex,
    contractId: CONTRACT_ID,
    bookId: 999,
    noteIndex: NOTE_INDEX,
    merchant: MERCHANT_ID,
    amount: AMOUNT.toString(),
    cap: CAP.toString(),
    acceptUntil: Number(ACCEPT_UNTIL),
    canonicalMessageHex: buildCanonicalMessage({ bookId: 999n }).toString('hex'),
    signatureHex: validSig.toString('hex'),
    wirePayload: toUrlSafeBase64(Buffer.concat([buildCanonicalMessage({ bookId: 999n }), validSig])),
    expectedValid: false,
    expectedError: 'InvalidSignature',
  },
  {
    id: 'vector-08-corrupted-signature',
    description: 'Authentic canonical message with inverted signature bytes',
    seedLabel: SEED_LABEL,
    voucherKeyHex,
    contractId: CONTRACT_ID,
    bookId: Number(BOOK_ID),
    noteIndex: NOTE_INDEX,
    merchant: MERCHANT_ID,
    amount: AMOUNT.toString(),
    cap: CAP.toString(),
    acceptUntil: Number(ACCEPT_UNTIL),
    canonicalMessageHex: validMsg.toString('hex'),
    signatureHex: Buffer.from(validSig.map((b) => b ^ 0xff)).toString('hex'),
    wirePayload: toUrlSafeBase64(
      Buffer.concat([validMsg, Buffer.from(validSig.map((b) => b ^ 0xff))])
    ),
    expectedValid: false,
    expectedError: 'InvalidSignature',
  },
  {
    id: 'vector-09-truncated-payload',
    description: 'Payload truncated to 150 bytes instead of 245 bytes',
    seedLabel: SEED_LABEL,
    voucherKeyHex,
    contractId: CONTRACT_ID,
    bookId: Number(BOOK_ID),
    noteIndex: NOTE_INDEX,
    merchant: MERCHANT_ID,
    amount: AMOUNT.toString(),
    cap: CAP.toString(),
    acceptUntil: Number(ACCEPT_UNTIL),
    canonicalMessageHex: validMsg.subarray(0, 100).toString('hex'),
    signatureHex: validSig.subarray(0, 50).toString('hex'),
    wirePayload: toUrlSafeBase64(Buffer.concat([validMsg, validSig]).subarray(0, 150)),
    expectedValid: false,
    expectedError: 'TruncatedPayload',
  },
  {
    id: 'vector-10-wrong-version',
    description: 'Payload with version byte set to 2 instead of 1',
    seedLabel: SEED_LABEL,
    voucherKeyHex,
    contractId: CONTRACT_ID,
    bookId: Number(BOOK_ID),
    noteIndex: NOTE_INDEX,
    merchant: MERCHANT_ID,
    amount: AMOUNT.toString(),
    cap: CAP.toString(),
    acceptUntil: Number(ACCEPT_UNTIL),
    canonicalMessageHex: buildCanonicalMessage({ version: 2 }).toString('hex'),
    signatureHex: crypto.sign(null, buildCanonicalMessage({ version: 2 }), privKey).toString('hex'),
    wirePayload: toUrlSafeBase64(
      Buffer.concat([
        buildCanonicalMessage({ version: 2 }),
        crypto.sign(null, buildCanonicalMessage({ version: 2 }), privKey),
      ])
    ),
    expectedValid: false,
    expectedError: 'InvalidVersion',
  },
];

const output = {
  $schema: './voucher.schema.json',
  version: 1,
  description: 'Deterministic offline voucher test vectors (v1) with throwaway labelled test seeds',
  generator: 'scripts/generate-vectors.mjs',
  vectors,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8');
console.log(`Generated ${vectors.length} test vectors to ${OUT_PATH}`);
