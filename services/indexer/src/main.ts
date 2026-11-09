import pg from "pg";
const { Pool } = pg;
import { rpc } from "@stellar/stellar-sdk";
import { server, setDbClient, setRpcClient } from "./index.js";
import { runMigrations } from "./db/migrate.js";
import {
  startEventIngestion,
  getSyncState,
  DEFAULT_SYNC_KEY,
  type IngestConfig,
  type RpcEventsClient,
} from "./ingest.js";
import type { LatestLedgerProvider } from "./health.js";

export interface IndexerStartupOptions {
  databaseUrl?: string;
  rpcUrl?: string;
  contractId?: string;
  port?: number;
  pollIntervalMs?: number;
  startLedger?: number;
  pool?: pg.Pool;
  rpcClient?: rpc.Server;
  skipListen?: boolean;
}

export interface IndexerInstance {
  pool: pg.Pool | null;
  rpcClient: rpc.Server;
  server: typeof server;
  abortController: AbortController;
  startingLedger?: number;
  stop: () => Promise<void>;
}

export async function start(options: IndexerStartupOptions = {}): Promise<IndexerInstance> {
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  const rpcUrl = options.rpcUrl ?? process.env.RPC_URL ?? "https://soroban-testnet.stellar.org";
  const contractId =
    options.contractId ??
    process.env.KERFVAULT_CONTRACT_ID ??
    "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE";
  const port = options.port ?? (process.env.PORT ? parseInt(process.env.PORT, 10) : 4001);
  const pollIntervalMs =
    options.pollIntervalMs ??
    (process.env.POLL_INTERVAL_MS ? parseInt(process.env.POLL_INTERVAL_MS, 10) : 5000);

  const envStartLedger = process.env.START_LEDGER
    ? parseInt(process.env.START_LEDGER, 10)
    : undefined;
  const configuredStartLedger =
    options.startLedger ??
    (envStartLedger !== undefined && !Number.isNaN(envStartLedger)
      ? envStartLedger
      : undefined);

  let pool: pg.Pool | null = options.pool ?? null;

  if (!pool && databaseUrl) {
    try {
      pool = new Pool({ connectionString: databaseUrl });
    } catch (err) {
      console.error("[indexer] Failed to create database connection pool:", err);
      throw err;
    }
  }

  if (pool) {
    try {
      const client = await pool.connect();
      try {
        const applied = await runMigrations(client);
        if (applied.length > 0) {
          console.log(`[indexer] Applied ${applied.length} migration(s): ${applied.join(", ")}`);
        } else {
          console.log("[indexer] Database schema is up to date.");
        }
      } finally {
        client.release();
      }
      setDbClient(pool);
      console.log("[indexer] Database connected and migrations up to date.");
    } catch (err) {
      console.error("[indexer] Failed to run database migrations:", err);
      if (!options.pool && pool) {
        await pool.end().catch(() => {});
        pool = null;
        setDbClient(null);
      }
      throw err;
    }
  } else {
    console.warn("[indexer] No database configured. Running with fallback registry snapshot.");
    setDbClient(null);
  }

  const rpcClient =
    options.rpcClient ??
    new rpc.Server(rpcUrl, {
      allowHttp: rpcUrl.startsWith("http://"),
    });
  setRpcClient(rpcClient as unknown as LatestLedgerProvider);

  const abortController = new AbortController();
  let startingLedger: number | undefined = configuredStartLedger;

  if (pool) {
    try {
      const savedState = await getSyncState(pool, DEFAULT_SYNC_KEY);
      if (savedState && (savedState.lastLedger || savedState.cursor)) {
        console.log(
          `[indexer] Resuming ingestion from saved sync state (lastLedger: ${savedState.lastLedger}, cursor: ${savedState.cursor ?? "none"}).`
        );
      } else {
        // No saved sync state
        if (startingLedger !== undefined) {
          console.log(
            `[indexer] No saved sync state found. Starting ingestion from configured START_LEDGER: ${startingLedger}`
          );
        } else {
          try {
            const latestRpc = await rpcClient.getLatestLedger();
            startingLedger = latestRpc.sequence;
            console.log(
              `[indexer] No saved sync state and no START_LEDGER configured. Starting ingestion from RPC latest ledger: ${startingLedger}`
            );
          } catch (err) {
            console.error(
              "[indexer] Ingest startup error: failed to fetch latest ledger from RPC:",
              err
            );
          }
        }
      }
    } catch (err) {
      console.error("[indexer] Ingest startup error: failed to read sync state from database:", err);
    }

    const ingestConfig: IngestConfig = {
      rpcUrl,
      contractId,
      startLedger: startingLedger,
      pollIntervalMs,
    };

    void startEventIngestion(
      pool,
      ingestConfig,
      rpcClient as unknown as RpcEventsClient,
      { signal: abortController.signal }
    ).catch((err) => {
      console.error("[indexer] Ingest startup error in event ingestion loop:", err);
    });

    console.log(
      `[indexer] Ingest loop started for contract ${contractId} (starting ledger: ${startingLedger ?? "automatic"}, poll interval: ${pollIntervalMs}ms).`
    );
  }

  if (!options.skipListen) {
    server.on("error", (err) => {
      console.error("[indexer] HTTP server error:", err);
    });

    server.listen(port, () => {
      console.log(`[indexer] Registry service listening on port ${port}`);
    });
  }

  const stop = async () => {
    abortController.abort();
    if (!options.skipListen && server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
    if (pool) {
      await pool.end().catch(() => {});
    }
    setDbClient(null);
    setRpcClient(null);
  };

  return { pool, rpcClient, server, abortController, startingLedger, stop };
}

const isMainModule =
  process.env.NODE_ENV !== "test" &&
  Boolean(
    process.argv[1] &&
      (process.argv[1].endsWith("main.ts") ||
        process.argv[1].endsWith("main.js") ||
        process.argv[1].endsWith("main"))
  );

if (isMainModule) {
  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile();
    } catch {
      // .env file is optional
    }
  }

  process.on("uncaughtException", (err) => {
    console.error("[indexer] Uncaught exception:", err);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[indexer] Unhandled promise rejection:", reason);
  });

  start()
    .then((instance) => {
      const handleSignal = () => {
        console.log("[indexer] Received termination signal. Shutting down gracefully...");
        instance
          .stop()
          .then(() => process.exit(0))
          .catch((err) => {
            console.error("[indexer] Error during graceful shutdown:", err);
            process.exit(1);
          });
      };
      process.on("SIGINT", handleSignal);
      process.on("SIGTERM", handleSignal);
    })
    .catch((err) => {
      console.error("[indexer] Fatal error during startup:", err);
      process.exit(1);
    });
}
