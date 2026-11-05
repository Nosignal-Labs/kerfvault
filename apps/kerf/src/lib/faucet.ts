import { STELLAR_TESTNET_HORIZON_URL } from "@kerfvault/web-wallet";

export interface FaucetResponse {
  success: boolean;
  address: string;
  message: string;
}

export function getDefaultRelayUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_RELAY_URL) {
    return process.env.NEXT_PUBLIC_RELAY_URL.replace(/\/+$/, "");
  }
  return "http://localhost:3002";
}

/**
 * Requests demo testnet funding for a given Stellar public address.
 * Primary method: Calls KerfVault Relay's `POST /demo/faucet`.
 * Fallback: If relay is unreachable, calls Stellar Friendbot directly.
 */
export async function requestFaucetFunding(
  address: string,
  options?: {
    relayUrl?: string;
    fetchFn?: typeof fetch;
  }
): Promise<FaucetResponse> {
  const fetchFn = options?.fetchFn || globalThis.fetch;
  const relayBase = options?.relayUrl || getDefaultRelayUrl();
  const endpoint = `${relayBase}/demo/faucet`;

  try {
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });

    if (res.ok) {
      const data = (await res.json()) as FaucetResponse;
      return data;
    }

    // If relay returned a 4xx or 5xx error, check if it's disabled or unreachable
    const errorBody = await res.text();
    // If relay is running but faucet disabled, fall back to Friendbot for developer demo convenience
    if (res.status === 404 || errorBody.includes("disabled")) {
      return await fallbackFriendbot(address, fetchFn);
    }

    throw new Error(`Relay faucet returned ${res.status}: ${errorBody}`);
  } catch (err: unknown) {
    // Network error connecting to relay — try Friendbot directly
    try {
      return await fallbackFriendbot(address, fetchFn);
    } catch {
      const message = err instanceof Error ? err.message : "Faucet request failed";
      throw new Error(`Failed to fund wallet: ${message}`);
    }
  }
}

/**
 * Fallback to standard Stellar Testnet Friendbot.
 */
async function fallbackFriendbot(
  address: string,
  fetchFn: typeof fetch
): Promise<FaucetResponse> {
  const url = `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`;
  const res = await fetchFn(url);

  if (!res.ok) {
    const text = await res.text();
    if (text.includes("already funded") || text.includes("already exists")) {
      return {
        success: true,
        address,
        message: "Account already funded on testnet",
      };
    }
    throw new Error(`Friendbot failed with status ${res.status}: ${text}`);
  }

  return {
    success: true,
    address,
    message: "Funded via testnet Friendbot",
  };
}

/**
 * Fetches the native XLM balance for a testnet account from Horizon.
 * Returns formatted XLM string (e.g. "10000.0000000") or null if account is unfunded.
 */
export async function fetchAccountBalance(
  address: string,
  options?: {
    horizonUrl?: string;
    fetchFn?: typeof fetch;
  }
): Promise<string | null> {
  const fetchFn = options?.fetchFn || globalThis.fetch;
  const horizonBase = options?.horizonUrl || STELLAR_TESTNET_HORIZON_URL;
  const url = `${horizonBase.replace(/\/+$/, "")}/accounts/${encodeURIComponent(address)}`;

  try {
    const res = await fetchFn(url);
    if (res.status === 404) {
      return null; // Not yet funded
    }
    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as {
      balances?: Array<{ asset_type: string; balance: string }>;
    };

    const native = data.balances?.find((b) => b.asset_type === "native");
    return native ? native.balance : "0";
  } catch {
    return null;
  }
}

