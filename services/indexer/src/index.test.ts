import { describe, expect, it, vi } from "vitest";
import { handleRequest, setDbClient } from "./index.js";
import { buildRegistrySnapshot } from "./snapshot.js";
import { getHealthStatus, type LatestLedgerProvider } from "./health.js";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Queryable } from "./db/migrate.js";

function createMockHttp(
  url: string,
  method = "GET",
  reqHeaders: Record<string, string> = {}
): {
  req: IncomingMessage;
  res: ServerResponse;
  getResponse: () => { statusCode: number; headers: Record<string, string>; body: string };
} {
  const req = Object.assign(new EventEmitter(), {
    url,
    method,
    headers: reqHeaders,
  }) as unknown as IncomingMessage;

  let statusCode = 0;
  let headers: Record<string, string> = {};
  let body = "";

  const res = {
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    writeHead(code: number, h?: Record<string, string>) {
      statusCode = code;
      if (h) {
        for (const [k, v] of Object.entries(h)) {
          headers[k.toLowerCase()] = v;
        }
      }
    },
    end(chunk: string) {
      body = chunk;
    },
  } as unknown as ServerResponse;

  return { req, res, getResponse: () => ({ statusCode, headers, body }) };
}

describe("Indexer HTTP Service & Health Endpoint", () => {
  it("responds 200 ok to GET /health with ledger sequence and lag metrics", async () => {
    const mockDb: Queryable = {
      query: vi.fn(async <R = any>(text: string) => {
        if (text.includes("SELECT last_ledger, cursor FROM sync_state")) {
          return {
            rows: [{ last_ledger: "1000", cursor: "cursor_health" }] as unknown as R[],
          };
        }
        return { rows: [] as R[] };
      }),
    };

    const mockRpc: LatestLedgerProvider = {
      getLatestLedger: vi.fn(async () => ({ sequence: 1005 })),
    };

    const { req, res, getResponse } = createMockHttp("/health");
    await handleRequest(req, res, mockDb, mockRpc);

    const { statusCode, headers, body } = getResponse();
    expect(statusCode).toBe(200);
    expect(headers["content-type"]).toBe("application/json");

    const json = JSON.parse(body);
    expect(json.status).toBe("ok");
    expect(json.latestLedgerProcessed).toBe(1000);
    expect(json.latestRpcLedger).toBe(1005);
    expect(json.lag).toBe(5);
    expect(json.cursor).toBe("cursor_health");
  });

  it("calculates degraded health status when lag exceeds threshold", async () => {
    const mockDb: Queryable = {
      query: vi.fn(async <R = any>() => ({
        rows: [{ last_ledger: "1000", cursor: "c" }] as unknown as R[],
      })),
    };

    const laggingRpc: LatestLedgerProvider = {
      getLatestLedger: vi.fn(async () => ({ sequence: 2000 })), // 1000 ledgers behind
    };

    const health = await getHealthStatus(mockDb, laggingRpc);
    expect(health.status).toBe("degraded");
    expect(health.lag).toBe(1000);
  });

  it("responds with fallback snapshot when no db connected", async () => {
    setDbClient(null);
    const { req, res, getResponse } = createMockHttp("/registry");
    await handleRequest(req, res);

    const { statusCode, body } = getResponse();
    expect(statusCode).toBe(200);
    const snapshot = JSON.parse(body);
    expect(snapshot.version).toBe(1);
    expect(snapshot.books).toEqual({});
  });

  it("builds and serves live registry snapshot from database", async () => {
    const mockDb: Queryable = {
      query: vi.fn(async <R = any>(text: string) => {
        if (text.includes("SELECT last_ledger FROM sync_state")) {
          return { rows: [{ last_ledger: "12345" }] as unknown as R[] };
        }
        if (text.includes("SELECT book_id, contract_id, owner, token")) {
          return {
            rows: [
              {
                book_id: "1",
                contract_id: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
                owner: "GA111111111111111111111111111111111111111111111111111111",
                token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
                voucher_key: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
                redeem_deadline: "1793400000",
                free_balance: "3000000",
              },
            ] as unknown as R[],
          };
        }
        if (text.includes("SELECT book_id, note_index, denomination, state")) {
          return {
            rows: [
              { book_id: "1", note_index: 0, denomination: "10000000", state: "Redeemed" },
              { book_id: "1", note_index: 1, denomination: "20000000", state: "Open" },
            ] as unknown as R[],
          };
        }
        return { rows: [] as R[] };
      }),
    };

    const snapshot = await buildRegistrySnapshot(mockDb);
    expect(snapshot.ledgerSequence).toBe(12345);
    expect(snapshot.contractId).toBe("CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE");
    expect(snapshot.books["1"]).toBeDefined();
    expect(snapshot.books["1"].freeBalance).toBe("3000000");
    expect(snapshot.books["1"].notes).toHaveLength(2);
    expect(snapshot.books["1"].notes[0]).toEqual({
      index: 0,
      denomination: "10000000",
      status: "Redeemed",
    });
    expect(snapshot.books["1"].notes[1]).toEqual({
      index: 1,
      denomination: "20000000",
      status: "Open",
    });

    const { req, res, getResponse } = createMockHttp("/registry");
    await handleRequest(req, res, mockDb);

    const { statusCode, body } = getResponse();
    expect(statusCode).toBe(200);
    const servedSnapshot = JSON.parse(body);
    expect(servedSnapshot.ledgerSequence).toBe(12345);
    expect(servedSnapshot.books["1"].notes[0].status).toBe("Redeemed");
  });

  it("handles CORS allowed origins on GET /health", async () => {
    const { req, res, getResponse } = createMockHttp(
      "/health",
      "GET",
      { origin: "http://localhost:3000" }
    );
    await handleRequest(req, res);

    const { statusCode, headers } = getResponse();
    expect(statusCode).toBe(200);
    expect(headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("handles CORS preflight OPTIONS request with 204", async () => {
    const { req, res, getResponse } = createMockHttp(
      "/registry",
      "OPTIONS",
      { origin: "http://localhost:3001" }
    );
    await handleRequest(req, res);

    const { statusCode, headers } = getResponse();
    expect(statusCode).toBe(204);
    expect(headers["access-control-allow-origin"]).toBe("http://localhost:3001");
  });

  it("rejects unauthorized CORS origins with 403 Forbidden", async () => {
    const { req, res, getResponse } = createMockHttp(
      "/health",
      "GET",
      { origin: "https://unauthorized-origin.com" }
    );
    await handleRequest(req, res);

    const { statusCode, headers, body } = getResponse();
    expect(statusCode).toBe(403);
    expect(headers["access-control-allow-origin"]).toBeUndefined();
    expect(body).toContain("Forbidden");
  });

  it("returns 404 for unknown endpoints", async () => {
    const { req, res, getResponse } = createMockHttp("/unknown-route");
    await handleRequest(req, res);

    const { statusCode } = getResponse();
    expect(statusCode).toBe(404);
  });
});
