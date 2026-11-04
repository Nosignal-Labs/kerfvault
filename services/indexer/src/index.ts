import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { RegistrySnapshot } from "@kerfvault/sdk";

export * from "./ingest.js";
export * from "./db/index.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4001;

export function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  if (method === "GET" && url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
    return;
  }

  if (method === "GET" && url === "/registry") {
    // Return stub snapshot conforming to RegistrySnapshot schema
    const stubSnapshot: RegistrySnapshot = {
      version: 1,
      contractId: process.env.KERFVAULT_CONTRACT_ID ?? "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      ledgerSequence: 1000000,
      snapshotTimestamp: Math.floor(Date.now() / 1000),
      books: {
        "101": {
          bookId: "101",
          owner: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
          token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
          voucherKey: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
          redeemDeadline: "1793404800",
          freeBalance: "0",
          notes: [
            { index: 0, denomination: "10000000", status: "Open" },
            { index: 1, denomination: "20000000", status: "Open" },
          ],
        },
      },
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(stubSnapshot, null, 2));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
}

export const server = createServer(handleRequest);

if (process.env.NODE_ENV !== "test" && process.argv[1]?.endsWith("index.js")) {
  server.listen(PORT, () => {
    console.log(`[indexer] Registry service listening on port ${PORT}`);
  });
}

