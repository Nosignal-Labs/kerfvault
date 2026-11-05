import { describe, it, expect } from "vitest";
import {
  STELLAR_TESTNET_PASSPHRASE,
  STELLAR_MAINNET_PASSPHRASE,
  STELLAR_TESTNET_RPC_URL,
  STELLAR_TESTNET_HORIZON_URL,
  isTestnet,
  assertTestnet,
  isTestnetRpcUrl,
  assertTestnetRpcUrl,
  guardNetwork,
} from "../src/network.js";

describe("Network Guard", () => {
  describe("isTestnet", () => {
    it("returns true for the official Stellar testnet passphrase", () => {
      expect(isTestnet(STELLAR_TESTNET_PASSPHRASE)).toBe(true);
      expect(isTestnet("  Test SDF Network ; September 2015  ")).toBe(true);
    });

    it("returns false for Stellar mainnet passphrase", () => {
      expect(isTestnet(STELLAR_MAINNET_PASSPHRASE)).toBe(false);
    });

    it("returns false for arbitrary networks", () => {
      expect(isTestnet("Standalone Network ; February 2017")).toBe(false);
      expect(isTestnet("Some Random Network")).toBe(false);
      expect(isTestnet("")).toBe(false);
    });
  });

  describe("assertTestnet", () => {
    it("does not throw for testnet passphrase", () => {
      expect(() => assertTestnet(STELLAR_TESTNET_PASSPHRASE)).not.toThrow();
    });

    it("throws a specific error when mainnet is attempted", () => {
      expect(() => assertTestnet(STELLAR_MAINNET_PASSPHRASE)).toThrow(
        /Mainnet rejected/i
      );
    });

    it("throws an error for non-testnet passphrases", () => {
      expect(() => assertTestnet("Standalone Network ; February 2017")).toThrow(
        /Unsupported network/i
      );
    });
  });

  describe("isTestnetRpcUrl and assertTestnetRpcUrl", () => {
    it("accepts official testnet URLs", () => {
      expect(isTestnetRpcUrl(STELLAR_TESTNET_RPC_URL)).toBe(true);
      expect(isTestnetRpcUrl(STELLAR_TESTNET_HORIZON_URL)).toBe(true);
      expect(() => assertTestnetRpcUrl(STELLAR_TESTNET_RPC_URL)).not.toThrow();
    });

    it("accepts local dev sandboxes", () => {
      expect(isTestnetRpcUrl("http://localhost:8000/soroban/rpc")).toBe(true);
      expect(isTestnetRpcUrl("http://127.0.0.1:8000/rpc")).toBe(true);
      expect(() => assertTestnetRpcUrl("http://localhost:8000")).not.toThrow();
    });

    it("rejects mainnet URLs", () => {
      expect(isTestnetRpcUrl("https://soroban-rpc.mainnet.stellar.org")).toBe(false);
      expect(isTestnetRpcUrl("https://horizon.stellar.org")).toBe(false);
      expect(() =>
        assertTestnetRpcUrl("https://soroban-rpc.mainnet.stellar.org")
      ).toThrow(/disallowed RPC URL/i);
    });

    it("rejects malformed URLs", () => {
      expect(isTestnetRpcUrl("not-a-valid-url")).toBe(false);
      expect(() => assertTestnetRpcUrl("not-a-valid-url")).toThrow(
        /disallowed RPC URL/i
      );
    });
  });

  describe("guardNetwork", () => {
    it("passes with valid testnet passphrase and testnet rpc url", () => {
      expect(() =>
        guardNetwork(STELLAR_TESTNET_PASSPHRASE, STELLAR_TESTNET_RPC_URL)
      ).not.toThrow();
    });

    it("passes with valid testnet passphrase and no rpc url", () => {
      expect(() => guardNetwork(STELLAR_TESTNET_PASSPHRASE)).not.toThrow();
    });

    it("fails if passphrase is valid testnet but rpc url is mainnet", () => {
      expect(() =>
        guardNetwork(
          STELLAR_TESTNET_PASSPHRASE,
          "https://soroban-rpc.mainnet.stellar.org"
        )
      ).toThrow(/disallowed RPC URL/i);
    });

    it("fails if rpc url is valid testnet but passphrase is mainnet", () => {
      expect(() =>
        guardNetwork(STELLAR_MAINNET_PASSPHRASE, STELLAR_TESTNET_RPC_URL)
      ).toThrow(/Mainnet rejected/i);
    });
  });
});

