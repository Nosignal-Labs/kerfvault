/**
 * Network guard for KerfVault web wallet.
 *
 * Strictly enforces that transactions, connections, and signatures only run
 * against the Stellar Testnet. Mainnet and arbitrary unknown networks are
 * unconditionally rejected to prevent accidental fund loss in demo mode.
 */

export const STELLAR_TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const STELLAR_MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

export const STELLAR_TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
export const STELLAR_TESTNET_HORIZON_URL = "https://horizon-testnet.stellar.org";

/**
 * Checks if the provided network passphrase matches the Stellar Testnet passphrase.
 */
export function isTestnet(passphrase: string): boolean {
  return passphrase.trim() === STELLAR_TESTNET_PASSPHRASE;
}

/**
 * Asserts that the provided network passphrase is the Stellar Testnet passphrase.
 * Throws an explicit descriptive error if mainnet or another network is detected.
 */
export function assertTestnet(passphrase: string): void {
  const normalized = passphrase.trim();

  if (normalized === STELLAR_MAINNET_PASSPHRASE) {
    throw new Error(
      "Mainnet rejected: KerfVault demo application strictly refuses mainnet connections."
    );
  }

  if (normalized !== STELLAR_TESTNET_PASSPHRASE) {
    throw new Error(
      `Unsupported network: '${passphrase}'. Only Stellar Testnet ("${STELLAR_TESTNET_PASSPHRASE}") is permitted.`
    );
  }
}

/**
 * Checks if a given RPC URL is an approved testnet endpoint (or local dev environment).
 */
export function isTestnetRpcUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Allow local development sandboxes
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") {
      return true;
    }

    // Explicitly reject known mainnet endpoints
    if (
      hostname === "mainnet.stellar.org" ||
      hostname === "soroban-rpc.mainnet.stellar.org" ||
      hostname === "horizon.stellar.org"
    ) {
      return false;
    }

    // Must belong to testnet or futurenet or contain testnet in hostname
    return hostname.includes("testnet") || hostname.includes("futurenet");
  } catch {
    return false;
  }
}

/**
 * Asserts that the given RPC URL points to a testnet or local sandbox.
 * Throws if the URL is invalid or points to mainnet.
 */
export function assertTestnetRpcUrl(url: string): void {
  if (!isTestnetRpcUrl(url)) {
    throw new Error(
      `Unsupported or disallowed RPC URL: '${url}'. Only Stellar Testnet endpoints are permitted.`
    );
  }
}

/**
 * Combined guard to validate both network passphrase and optional RPC URL.
 */
export function guardNetwork(passphrase: string, rpcUrl?: string): void {
  assertTestnet(passphrase);
  if (rpcUrl) {
    assertTestnetRpcUrl(rpcUrl);
  }
}

