import { describe, it, expect } from "vitest";
import {
  encryptKey,
  decryptKey,
  generateWallet,
  type EncryptedPayload,
} from "../src/index.js";

describe("WebCrypto Key Encryption & Decryption", () => {
  const secretKey = "SB3O6XW3J567ABCXYZMNO456PQR789STU123VWX456YZA789BCD123EF";
  const passcode = "CorrectHorseBatteryStaple!2026";

  it("encrypts and decrypts a Stellar secret key with the correct passcode", async () => {
    const encrypted = await encryptKey(secretKey, passcode);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.salt).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(encrypted.iv).toHaveLength(24);   // 12 bytes = 24 hex chars

    const decrypted = await decryptKey(encrypted, passcode);
    expect(decrypted).toBe(secretKey);
  });

  it("fails decryption when an incorrect passcode is supplied", async () => {
    const encrypted = await encryptKey(secretKey, passcode);

    await expect(decryptKey(encrypted, "WrongPassword123")).rejects.toThrow(
      "Decryption failed: invalid passcode or corrupted payload"
    );
  });

  it("fails decryption when ciphertext is tampered with", async () => {
    const encrypted = await encryptKey(secretKey, passcode);

    // Tamper with first byte of ciphertext
    const tamperedHex =
      (encrypted.ciphertext.startsWith("aa") ? "bb" : "aa") +
      encrypted.ciphertext.slice(2);

    const tamperedPayload: EncryptedPayload = {
      ...encrypted,
      ciphertext: tamperedHex,
    };

    await expect(decryptKey(tamperedPayload, passcode)).rejects.toThrow(
      "Decryption failed"
    );
  });

  it("generates unique salt and IV for separate encryptions of the same secret", async () => {
    const enc1 = await encryptKey(secretKey, passcode);
    const enc2 = await encryptKey(secretKey, passcode);

    expect(enc1.salt).not.toBe(enc2.salt);
    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);

    // Both decrypt back to original secret
    expect(await decryptKey(enc1, passcode)).toBe(secretKey);
    expect(await decryptKey(enc2, passcode)).toBe(secretKey);
  });

  it("rejects empty passcode or empty secret", async () => {
    await expect(encryptKey("", passcode)).rejects.toThrow("Secret to encrypt cannot be empty");
    await expect(encryptKey(secretKey, "")).rejects.toThrow("Passcode cannot be empty");
  });

  it("integrates seamlessly with generateWallet", async () => {
    const wallet = generateWallet();
    const encrypted = await encryptKey(wallet.secret, "DemoPasscode#1");
    const restoredSecret = await decryptKey(encrypted, "DemoPasscode#1");
    expect(restoredSecret).toBe(wallet.secret);
  });
});
