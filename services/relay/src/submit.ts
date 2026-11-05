import { Keypair, rpc, type Transaction } from "@stellar/stellar-sdk";
import { buildRedeemTransaction, verifyRestrictedTransaction } from "./tx.js";
import type { RedeemRequestBody } from "./index.js";

export interface SubmitRedeemConfig {
  rpcUrl?: string;
  networkPassphrase?: string;
  contractId?: string;
  relaySecret?: string;
  server?: rpc.Server;
}

export interface SubmitRedeemResult {
  status: "success";
  txHash: string;
}

/**
 * Validates and retrieves the relay fee keypair from config or environment.
 */
export function getRelayKeypair(secret?: string): Keypair {
  const sec = secret ?? process.env.RELAY_SECRET;
  if (!sec) {
    throw new Error(
      "Relay fee account secret is missing. Set RELAY_SECRET environment variable."
    );
  }
  try {
    return Keypair.fromSecret(sec);
  } catch (err) {
    throw new Error(`Invalid RELAY_SECRET keypair: ${(err as Error).message}`);
  }
}

/**
 * Simulates, signs with the relay fee account, and submits a validated redeem transaction.
 *
 * Steps:
 * 1. Fetch fee account state (sequence number) from Soroban RPC.
 * 2. Construct restricted redeem transaction from structured parameters.
 * 3. Simulate and prepare transaction (resolves footprint, resource fees, and TTL extension).
 * 4. Verify post-preparation invariants (restricted to 1 operation, designated contract, redeem function).
 * 5. Sign transaction using the relay fee account keypair.
 * 6. Submit signed transaction to Soroban RPC and return transaction hash.
 */
export async function submitRedeemTransaction(
  body: RedeemRequestBody,
  config?: SubmitRedeemConfig
): Promise<SubmitRedeemResult> {
  const rpcUrl =
    config?.rpcUrl ??
    process.env.RPC_URL ??
    "https://soroban-testnet.stellar.org";
  const networkPassphrase =
    config?.networkPassphrase ??
    process.env.STELLAR_NETWORK_PASSPHRASE ??
    "Test SDF Network ; September 2015";
  const contractId =
    config?.contractId ??
    process.env.KERFVAULT_CONTRACT_ID ??
    "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE";

  const feeKeypair = getRelayKeypair(config?.relaySecret);
  const server = config?.server ?? new rpc.Server(rpcUrl);

  // 1. Fetch fee account state
  const feeAccount = await server.getAccount(feeKeypair.publicKey());

  // 2. Build the restricted Soroban transaction
  const tx = buildRedeemTransaction(
    { contractId, networkPassphrase },
    feeAccount,
    body
  );

  // 3. Simulate and prepare transaction with RPC
  const preparedTx = await server.prepareTransaction(tx);

  // 4. Verify post-preparation invariants
  verifyRestrictedTransaction(preparedTx, contractId);

  // 5. Sign with the relay fee account
  preparedTx.sign(feeKeypair);

  // 6. Submit transaction to RPC
  const sendRes = await server.sendTransaction(preparedTx);
  if (sendRes.status === "ERROR") {
    const errorDetails =
      sendRes.errorResult?.toXDR("base64") ?? "Unknown RPC error";
    throw new Error(`RPC submission failed: ${errorDetails}`);
  }

  return {
    status: "success",
    txHash: sendRes.hash,
  };
}
