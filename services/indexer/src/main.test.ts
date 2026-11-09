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
  const originalEnvStartLedger = process.env.START_LEDGER;

  beforeEach(() => {
    setDbClient(null);
    setRpcClient(null);
    delete process.env.START_LEDGER;
  });

  afterEach(() => {
    setDbClient(null);
    setRpcClient(null);
    if (originalEnvStartLedger !== undefined) {
      process.env.START_LEDGER = originalEnvStartLedger;
    } else {
      delete process.env.START_LEDGER;
    }
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

  it("case 1: passes configured START_LEDGER to ingest config when there is no saved sync state", async () => {
    const logSpy = vi.spyOn(console, "log");

    const mockClient = {
      query: vi.fn(async () => ({ rows: [] })),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn(async () => mockClient),
      query: vi.fn(async <R = any>(text: string) => {
        // No saved sync state
        if (text.includes("SELECT key, last_ledger, cursor, updated_at FROM sync_state")) {
          return { rows: [] as R[] };
        }
        if (text.includes("SELECT last_ledger, cursor FROM sync_state")) {
          return { rows: [] as R[] };
        }
        return { rows: [] as R[] };
      }),
      end: vi.fn(async () => {}),
    } as unknown as pg.Pool;

    const mockRpcClient = {
      getEvents: vi.fn(async () => ({ events: [], latestLedger: 6000 })),
      getLatestLedger: vi.fn(async () => ({ sequence: 6000 })),
    };

    process.env.START_LEDGER = "5000";

    const instance = await start({
      pool: mockPool,
      rpcClient: mockRpcClient as any,
      skipListen: true,
      pollIntervalMs: 5000,
    });

    try {
      expect(instance.startingLedger).toBe(5000);

      // Wait a tick for initial pollEventsOnce
      await new Promise((r) => setTimeout(r, 50));

      expect(mockRpcClient.getEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          startLedger: 5000,
        })
      );

      const loggedStartingLedger = logSpy.mock.calls.some((args) =>
        args.join(" ").includes("START_LEDGER: 5000")
      );
      expect(loggedStartingLedger).toBe(true);
    } finally {
      await instance.stop();
      logSpy.mockRestore();
    }
  });

  it("case 2: starts from RPC latest ledger when there is no saved sync state and no START_LEDGER", async () => {
    const logSpy = vi.spyOn(console, "log");

    const mockClient = {
      query: vi.fn(async () => ({ rows: [] })),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn(async () => mockClient),
      query: vi.fn(async <R = any>(text: string) => {
        // No saved sync state
        if (text.includes("SELECT key, last_ledger, cursor, updated_at FROM sync_state")) {
          return { rows: [] as R[] };
        }
        if (text.includes("SELECT last_ledger, cursor FROM sync_state")) {
          return { rows: [] as R[] };
        }
        return { rows: [] as R[] };
      }),
      end: vi.fn(async () => {}),
    } as unknown as pg.Pool;

    const mockRpcClient = {
      getEvents: vi.fn(async () => ({ events: [], latestLedger: 998877 })),
      getLatestLedger: vi.fn(async () => ({ sequence: 998877 })),
    };

    delete process.env.START_LEDGER;

    const instance = await start({
      pool: mockPool,
      rpcClient: mockRpcClient as any,
      skipListen: true,
      pollIntervalMs: 5000,
    });

    try {
      expect(mockRpcClient.getLatestLedger).toHaveBeenCalled();
      expect(instance.startingLedger).toBe(998877);

      // Wait a tick for initial pollEventsOnce
      await new Promise((r) => setTimeout(r, 50));

      expect(mockRpcClient.getEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          startLedger: 998877,
        })
      );

      const loggedRpcLedger = logSpy.mock.calls.some((args) =>
        args.join(" ").includes("RPC latest ledger: 998877")
      );
      expect(loggedRpcLedger).toBe(true);
    } finally {
      await instance.stop();
      logSpy.mockRestore();
    }
  });

  it("logs ingest errors at startup when RPC fails to provide latest ledger", async () => {
    const errorSpy = vi.spyOn(console, "error");

    const mockClient = {
      query: vi.fn(async () => ({ rows: [] })),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn(async () => mockClient),
      query: vi.fn(async <R = any>() => ({ rows: [] as R[] })),
      end: vi.fn(async () => {}),
    } as unknown as pg.Pool;

    const mockRpcClient = {
      getEvents: vi.fn(async () => ({ events: [], latestLedger: 0 })),
      getLatestLedger: vi.fn(async () => {
        throw new Error("RPC Network Timeout");
      }),
    };

    delete process.env.START_LEDGER;

    const instance = await start({
      pool: mockPool,
      rpcClient: mockRpcClient as any,
      skipListen: true,
      pollIntervalMs: 5000,
    });

    try {
      expect(mockRpcClient.getLatestLedger).toHaveBeenCalled();

      const loggedError = errorSpy.mock.calls.some((args) =>
        args.join(" ").includes("failed to fetch latest ledger from RPC")
      );
      expect(loggedError).toBe(true);
    } finally {
      await instance.stop();
      errorSpy.mockRestore();
    }
  });

  it("instantiates KerfvaultClient contractReader by default when database is enabled", async () => {
    const mockClient = {
      query: vi.fn(async () => ({ rows: [] })),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn(async () => mockClient),
      query: vi.fn(async <R = any>() => ({ rows: [] as R[] })),
      end: vi.fn(async () => {}),
    } as unknown as pg.Pool;

    const mockRpcClient = {
      getEvents: vi.fn(async () => ({ events: [], latestLedger: 50000 })),
      getLatestLedger: vi.fn(async () => ({ sequence: 50000 })),
    };

    const instance = await start({
      pool: mockPool,
      rpcClient: mockRpcClient as any,
      skipListen: true,
      pollIntervalMs: 10000,
    });

    try {
      expect(instance.contractReader).toBeDefined();
      expect(typeof instance.contractReader?.getBook).toBe("function");
      expect(typeof instance.contractReader?.getNote).toBe("function");
    } finally {
      await instance.stop();
    }
  });

  it("accepts custom contractReader option", async () => {
    const mockClient = {
      query: vi.fn(async () => ({ rows: [] })),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn(async () => mockClient),
      query: vi.fn(async <R = any>() => ({ rows: [] as R[] })),
      end: vi.fn(async () => {}),
    } as unknown as pg.Pool;

    const mockRpcClient = {
      getEvents: vi.fn(async () => ({ events: [], latestLedger: 50000 })),
      getLatestLedger: vi.fn(async () => ({ sequence: 50000 })),
    };

    const customReader = {
      getBook: vi.fn(async () => ({
        bookId: 1n,
        owner: "GA...",
        token: "CD...",
        voucherKey: "00".repeat(32),
        redeemDeadline: 0n,
        freeBalance: 0n,
        noteCount: 0,
      })),
      getNote: vi.fn(async () => ({
        denomination: 100n,
        state: 0,
      })),
    };

    const instance = await start({
      pool: mockPool,
      rpcClient: mockRpcClient as any,
      contractReader: customReader,
      skipListen: true,
      pollIntervalMs: 10000,
    });

    try {
      expect(instance.contractReader).toBe(customReader);
    } finally {
      await instance.stop();
    }
  });
});
