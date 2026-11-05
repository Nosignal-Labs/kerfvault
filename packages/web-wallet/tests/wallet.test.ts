import { describe, it, expect } from "vitest";
import {
  generateWallet,
  isValidAddress,
  signWithWallet,
  verifyWalletSignature,
} from "../src/index.js";

describe("Web Wallet Core Functions", () => {
  it("generates a valid Stellar keypair with G-address and S-secret", () => {
    const wallet = generateWallet();
    expect(wallet.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    expect(wallet.secret).toMatch(/^S[A-Z2-7]{55}$/);
    expect(isValidAddress(wallet.publicKey)).toBe(true);
  });

  it("validates valid and invalid Stellar public addresses", () => {
    expect(isValidAddress("GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK")).toBe(true);
    expect(isValidAddress("invalid-address")).toBe(false);
    expect(isValidAddress("SBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK")).toBe(false);
    expect(isValidAddress("")).toBe(false);
  });

  it("signs and verifies arbitrary payload with wallet account", () => {
    const wallet = generateWallet();
    const message = Buffer.from("KerfVault testnet message signing");

    const signature = signWithWallet(message, wallet);
    expect(signature.length).toBe(64);

    const isValid = verifyWalletSignature(message, signature, wallet.publicKey);
    expect(isValid).toBe(true);

    const isInvalid = verifyWalletSignature(
      Buffer.from("tampered message"),
      signature,
      wallet.publicKey
    );
    expect(isInvalid).toBe(false);
  });
});
