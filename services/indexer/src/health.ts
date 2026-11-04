import type { Queryable } from "./db/migrate.js";
import { DEFAULT_SYNC_KEY } from "./ingest.js";

export interface IndexerHealth {
  status: "ok" | "degraded";
  timestamp: string;
  latestLedgerProcessed: number;
  latestRpcLedger: number;
  lag: number;
  cursor?: string;
}

export interface LatestLedgerProvider {
  getLatestLedger(): Promise<{ sequence: number }>;
}

/**
 * Calculates current indexer sync health, reporting latest processed ledger,
 * latest ledger sequence on RPC, and lag count.
 */
export async function getHealthStatus(
  dbClient?: Queryable | null,
  rpcClient?: LatestLedgerProvider | null
): Promise<IndexerHealth> {
  let latestLedgerProcessed = 0;
  let cursor: string | undefined;

  if (dbClient) {
    try {
      const res = await dbClient.query<{
        last_ledger: string | number;
        cursor: string | null;
      }>("SELECT last_ledger, cursor FROM sync_state WHERE key = $1;", [DEFAULT_SYNC_KEY]);

      if (res.rows.length > 0) {
        latestLedgerProcessed = Number(res.rows[0].last_ledger);
        cursor = res.rows[0].cursor ?? undefined;
      }
    } catch (err) {
      console.warn("[indexer:health] Failed to read sync_state from db:", err);
    }
  }

  let latestRpcLedger = latestLedgerProcessed;
  if (rpcClient) {
    try {
      const rpcStatus = await rpcClient.getLatestLedger();
      latestRpcLedger = rpcStatus.sequence;
    } catch (err) {
      console.warn("[indexer:health] Failed to query latest ledger from RPC:", err);
    }
  }

  const lag = Math.max(0, latestRpcLedger - latestLedgerProcessed);
  const isLaggingSignificantly = lag > 500;

  return {
    status: isLaggingSignificantly ? "degraded" : "ok",
    timestamp: new Date().toISOString(),
    latestLedgerProcessed,
    latestRpcLedger,
    lag,
    cursor,
  };
}
