import { z } from "zod";

/**
 * Regex for standard 56-character Stellar public address starting with 'G'.
 */
export const STELLAR_ACCOUNT_REGEX = /^G[A-Z2-7]{55}$/;

/**
 * Schema for incoming demo faucet funding requests.
 */
export const FaucetRequestSchema = z
  .object({
    address: z
      .string()
      .regex(STELLAR_ACCOUNT_REGEX, "address must be a valid 56-character Stellar G-address"),
  })
  .strict();

export type FaucetRequestBody = z.infer<typeof FaucetRequestSchema>;

export interface FaucetConfig {
  demoMode?: boolean;
  friendbotUrl?: string;
  fetchFn?: typeof fetch;
}

export interface FaucetResult {
  success: boolean;
  address: string;
  message: string;
}

/**
 * Funds an account on Stellar testnet using Friendbot when DEMO_MODE is enabled.
 */
export async function requestDemoFaucet(
  body: FaucetRequestBody,
  config?: FaucetConfig
): Promise<FaucetResult> {
  const friendbotUrl =
    config?.friendbotUrl ||
    process.env.FRIENDBOT_URL ||
    "https://friendbot.stellar.org";
  const fetchFn = config?.fetchFn || globalThis.fetch;

  const url = `${friendbotUrl}?addr=${encodeURIComponent(body.address)}`;

  const response = await fetchFn(url);
  if (!response.ok) {
    const text = await response.text();
    if (text.includes("already funded") || text.includes("already exists")) {
      return {
        success: true,
        address: body.address,
        message: "Account already exists and is funded",
      };
    }
    throw new Error(`Friendbot funding failed (${response.status}): ${text}`);
  }

  return {
    success: true,
    address: body.address,
    message: "Funded successfully via Friendbot",
  };
}
