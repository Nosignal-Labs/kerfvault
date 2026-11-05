import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { RegistrySnapshot } from "@kerfvault/sdk";
import { buildRegistrySnapshot } from "./snapshot.js";
import { getHealthStatus, type LatestLedgerProvider } from "./health.js";
import type { Queryable } from "./db/migrate.js";
import { handleCors, type CorsOptions } from "./cors.js";

export * from "./ingest.js";
export * from "./store.js";
export * from "./snapshot.js";
export * from "./health.js";
export * from "./db/index.js";
export * from "./cors.js";

export interface IndexerServerConfig extends CorsOptions {
  dbClient?: Queryable;
  rpcClient?: LatestLedgerProvider;
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4001;

let currentDbClient: Queryable | null = null;
let currentRpcClient: LatestLedgerProvider | null = null;

export function setDbClient(client: Queryable | null): void {
  currentDbClient = client;
}

export function setRpcClient(client: LatestLedgerProvider | null): void {
  currentRpcClient = client;
}

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  dbClient?: Queryable,
  rpcClient?: LatestLedgerProvider,
  config?: IndexerServerConfig
): Promise<void> {
  if (handleCors(req, res, { allowedOrigins: config?.allowedOrigins })) {
    return;
  }

  const url = req.url ?? "/";
  const method = req.method ?? "GET";
  const client = dbClient ?? currentDbClient;
  const ledgerProvider = rpcClient ?? currentRpcClient;

  if (method === "GET" && url === "/health") {
    const health = await getHealthStatus(client, ledgerProvider);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(health, null, 2));
    return;
  }

  if (method === "GET" && url === "/registry") {
    if (client) {
      try {
        const snapshot = await buildRegistrySnapshot(client);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(snapshot, null, 2));
        return;
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Failed to build registry snapshot",
            details: (err as Error).message,
          })
        );
        return;
      }
    }

    const fallbackSnapshot: RegistrySnapshot = {
      version: 1,
      contractId:
        process.env.KERFVAULT_CONTRACT_ID ??
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      ledgerSequence: 0,
      snapshotTimestamp: Math.floor(Date.now() / 1000),
      books: {},
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(fallbackSnapshot, null, 2));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
}

export const server = createServer((req, res) => {
  void handleRequest(req, res);
});

if (process.env.NODE_ENV !== "test" && process.argv[1]?.endsWith("index.js")) {
  server.listen(PORT, () => {
    console.log(`[indexer] Registry service listening on port ${PORT}`);
  });
}
