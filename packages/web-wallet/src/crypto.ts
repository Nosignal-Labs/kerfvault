/**
 * Cryptographic utilities using standard WebCrypto (PBKDF2 & AES-GCM)
 * to securely encrypt and decrypt secret keys with a user passcode.
 */

export interface EncryptedPayload {
  ciphertext: string; // hex-encoded
  salt: string;       // hex-encoded 16-byte salt
  iv: string;         // hex-encoded 12-byte IV
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error(`Invalid hex string length: ${hex.length}`);
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

const PBKDF2_ITERATIONS = 100_000;

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("WebCrypto (crypto.subtle) is not supported in this runtime environment");
  }
  return subtle;
}

/**
 * Derives an AES-GCM 256-bit encryption key from a user passcode using PBKDF2.
 */
async function deriveKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const passcodeKey = await subtle.importKey(
    "raw",
    encoder.encode(passcode),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passcodeKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a plaintext secret (such as a Stellar secret key S...) with a passcode.
 */
export async function encryptKey(
  secret: string,
  passcode: string
): Promise<EncryptedPayload> {
  if (!passcode || passcode.length === 0) {
    throw new Error("Passcode cannot be empty");
  }
  if (!secret || secret.length === 0) {
    throw new Error("Secret to encrypt cannot be empty");
  }

  const subtle = getSubtleCrypto();
  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(salt);
  globalThis.crypto.getRandomValues(iv);

  const key = await deriveKey(passcode, salt);
  const encodedPlaintext = new TextEncoder().encode(secret);

  const encryptedBuffer = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv.buffer as ArrayBuffer,
    },
    key,
    encodedPlaintext
  );

  return {
    ciphertext: bytesToHex(new Uint8Array(encryptedBuffer)),
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
  };
}

/**
 * Decrypts an encrypted payload with a passcode and returns the plaintext secret.
 * Throws an error if the passcode is incorrect or the ciphertext was tampered with.
 */
export async function decryptKey(
  payload: EncryptedPayload,
  passcode: string
): Promise<string> {
  if (!passcode || passcode.length === 0) {
    throw new Error("Passcode cannot be empty");
  }

  const subtle = getSubtleCrypto();
  const salt = hexToBytes(payload.salt);
  const iv = hexToBytes(payload.iv);
  const ciphertext = hexToBytes(payload.ciphertext);

  const key = await deriveKey(passcode, salt);

  try {
    const decryptedBuffer = await subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv.buffer as ArrayBuffer,
      },
      key,
      ciphertext.buffer as ArrayBuffer
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    throw new Error("Decryption failed: invalid passcode or corrupted payload");
  }
}
