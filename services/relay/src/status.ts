import { rpc } from "@stellar/stellar-sdk";
import { parseContractError } from "@kerfvault/sdk";

export interface RelayStatusConfig {
  rpcUrl?: string;
  server?: rpc.Server;
}

export type RedemptionStatus =
  | {
      status: "pending";
      hash: string;
      message: string;
    }
  | {
      status: "success";
      hash: string;
      ledger?: number;
      createdAt?: number;
    }
  | {
      status: "failed";
      hash: string;
      error: string;
      details?: string;
      code?: number;
    };

/**
 * Strict regex for 64-character hexadecimal Stellar transaction hash.
 */
export const TX_HASH_REGEX = /^[0-9a-fA-F]{64}$/;

/**
 * Queries Soroban RPC for redemption status by transaction hash.
 * Returns pending, success (with ledger/timestamp), or failed (with parsed error details).
 */
export async function getRedemptionStatus(
  hash: string,
  config?: RelayStatusConfig
): Promise<RedemptionStatus> {
  if (!TX_HASH_REGEX.test(hash)) {
    throw new Error(
      `Invalid transaction hash: "${hash}" is not a valid 64-character hex string`
    );
  }

  const rpcUrl =
    config?.rpcUrl ??
    process.env.RPC_URL ??
    "https://soroban-testnet.stellar.org";
  const server = config?.server ?? new rpc.Server(rpcUrl);

  const res = await server.getTransaction(hash);

  if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    return {
      status: "success",
      hash,
      ledger: res.latestLedger,
      createdAt: res.createdAt,
    };
  }

  if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
    const rawError = res.resultXdr
      ? res.resultXdr.toXDR("base64")
      : "Unknown transaction failure";
    const parsed = parseContractError(rawError);
    return {
      status: "failed",
      hash,
      error: parsed ? parsed.message : "Transaction failed on-chain",
      details: rawError,
      code: parsed?.code,
    };
  }

  return {
    status: "pending",
    hash,
    message: "Transaction is pending or not yet indexed by the network",
  };
}
