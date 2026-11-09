import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { start } from "./main.js";
import { handleRequest, setDbClient, setRpcClient } from "./index.js";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import type pg from "pg";

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

describe("Indexer Main Startup Sequence", () => {
  beforeEach(() => {
    setDbClient(null);
    setRpcClient(null);
  });

  afterEach(() => {
    setDbClient(null);
    setRpcClient(null);
  });

  it("runs startup sequence with configured pool, runs migrations, starts ingest, and serves live registry", async () => {
    const mockClient = {
      query: vi.fn(async (text: string) => {
        if (text.includes("SELECT name FROM schema_migrations")) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };

    const mockPoolQuery = vi.fn(async <R = any>(text: string) => {
      if (text.includes("SELECT last_ledger FROM sync_state")) {
        return { rows: [{ last_ledger: "77777" }] as unknown as R[] };
      }
      if (text.includes("SELECT book_id, contract_id, owner, token")) {
        return {
          rows: [
            {
              book_id: "200",
              contract_id: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
              owner: "GBE3Y2CWRVNIL3W6TQE6PD2D5JUGF665GRD2RLEI4YWE7YEZ2TYUWPEK",
              token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
              voucher_key: "67980208cb1bf0a5cf571efc5cf8c4ccf7547eb2ea61ffdc59868e42dbd8ad64",
              redeem_deadline: "1794000000",
              free_balance: "25000000",
            },
          ] as unknown as R[],
        };
      }
      if (text.includes("SELECT book_id, note_index, denomination, state")) {
        return {
          rows: [
            {
              book_id: "200",
              note_index: 0,
              denomination: "25000000",
              state: "Open",
            },
          ] as unknown as R[],
        };
      }
      return { rows: [] as R[] };
    });

    const mockPool = {
      connect: vi.fn(async () => mockClient),
      query: mockPoolQuery,
      end: vi.fn(async () => {}),
    } as unknown as pg.Pool;

    const mockRpcClient = {
      getEvents: vi.fn(async () => ({ events: [], latestLedger: 77777 })),
      getLatestLedger: vi.fn(async () => ({ sequence: 77777 })),
    };

    const instance = await start({
      pool: mockPool,
      rpcClient: mockRpcClient as any,
      skipListen: true,
      pollIntervalMs: 10000,
    });

    try {
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();

      // Test that /registry returns live DB snapshot and NOT the fallback placeholder
      const { req, res, getResponse } = createMockHttp("/registry");
      await handleRequest(req, res);

      const { statusCode, body } = getResponse();
      expect(statusCode).toBe(200);

      const snapshot = JSON.parse(body);
      expect(snapshot.ledgerSequence).toBe(77777);
      expect(snapshot.books["200"]).toBeDefined();
      expect(snapshot.books["200"].freeBalance).toBe("25000000");

      // Verify it is not the empty placeholder
      expect(snapshot.ledgerSequence).not.toBe(0);
      expect(Object.keys(snapshot.books).length).toBeGreaterThan(0);
    } finally {
      await instance.stop();
    }
  });

  it("fails if /registry returns placeholder when database is started", async () => {
    const mockClient = {
      query: vi.fn(async () => ({ rows: [] })),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn(async () => mockClient),
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
              { book_id: "1", note_index: 0, denomination: "10000000", state: "Open" },
            ] as unknown as R[],
          };
        }
        return { rows: [] as R[] };
      }),
      end: vi.fn(async () => {}),
    } as unknown as pg.Pool;

    const mockRpcClient = {
      getEvents: vi.fn(async () => ({ events: [], latestLedger: 12345 })),
      getLatestLedger: vi.fn(async () => ({ sequence: 12345 })),
    };

    const instance = await start({
      pool: mockPool,
      rpcClient: mockRpcClient as any,
      skipListen: true,
    });

    try {
      const { req, res, getResponse } = createMockHttp("/registry");
      await handleRequest(req, res);

      const { statusCode, body } = getResponse();
      expect(statusCode).toBe(200);

      const snapshot = JSON.parse(body);

      // Must NOT be the fallback placeholder
      expect(snapshot.ledgerSequence).not.toBe(0);
      expect(snapshot.books).not.toEqual({});
      expect(snapshot.books["1"]).toBeDefined();
    } finally {
      await instance.stop();
    }
  });
});

