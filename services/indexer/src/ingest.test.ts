import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_SYNC_KEY,
  getSyncState,
  saveSyncState,
  recordContractEvent,
  pollEventsOnce,
  startEventIngestion,
  extractTopicName,
  parseEventData,
  type RpcEventsClient,
  type SorobanEventsResponse,
} from "./ingest.js";
import type { Queryable } from "./db/migrate.js";

function createMockDb(): {
  client: Queryable;
  queries: string[];
  tables: {
    sync_state: Map<string, { last_ledger: number; cursor?: string; updated_at: Date }>;
    contract_events: any[];
  };
} {
  const queries: string[] = [];
  const tables = {
    sync_state: new Map<string, { last_ledger: number; cursor?: string; updated_at: Date }>(),
    contract_events: [] as any[],
  };

  const client: Queryable = {
    query: vi.fn(async <R = any>(text: string, values?: unknown[]) => {
      queries.push(text);

      if (text.includes("SELECT key, last_ledger, cursor, updated_at FROM sync_state")) {
        const key = values?.[0] as string;
        const entry = tables.sync_state.get(key);
        if (!entry) return { rows: [] as R[] };
        return {
          rows: [{ key, last_ledger: entry.last_ledger, cursor: entry.cursor ?? null, updated_at: entry.updated_at }] as unknown as R[],
        };
      }

      if (text.includes("INSERT INTO sync_state")) {
        const key = values?.[0] as string;
        const last_ledger = Number(values?.[1]);
        const cursor = (values?.[2] as string) || undefined;
        tables.sync_state.set(key, { last_ledger, cursor, updated_at: new Date() });
        return { rows: [] as R[] };
      }

      if (text.includes("INSERT INTO contract_events")) {
        tables.contract_events.push({
          contractId: values?.[0],
          topic: values?.[1],
          ledger: values?.[2],
          txHash: values?.[3],
          cursor: values?.[4],
          data: values?.[5],
        });
        return { rows: [] as R[] };
      }

      return { rows: [] as R[] };
    }),
  };

  return { client, queries, tables };
}

describe("Event Ingestion & RPC Polling", () => {
  it("extracts topic names and parses event data correctly", () => {
    expect(extractTopicName(["opened"])).toBe("opened");
    expect(extractTopicName([])).toBe("unknown");
    expect(parseEventData(12345)).toBe(12345);
    expect(parseEventData(null)).toBeNull();
  });

  it("loads and saves sync_state with cursor", async () => {
    const { client, tables } = createMockDb();

    const initialState = await getSyncState(client);
    expect(initialState).toBeNull();

    await saveSyncState(client, { lastLedger: 500, cursor: "cursor_abc123" });
    const savedState = await getSyncState(client);

    expect(savedState).not.toBeNull();
    expect(savedState?.lastLedger).toBe(500);
    expect(savedState?.cursor).toBe("cursor_abc123");
    expect(tables.sync_state.get(DEFAULT_SYNC_KEY)?.cursor).toBe("cursor_abc123");
  });

  it("records contract events to audit table", async () => {
    const { client, tables } = createMockDb();

    await recordContractEvent(client, {
      contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
      topic: "opened",
      ledger: 10050,
      txHash: "tx_hash_1",
      cursor: "token_1",
      data: { bookId: 1, total: "1000000" },
    });

    expect(tables.contract_events.length).toBe(1);
    expect(tables.contract_events[0].topic).toBe("opened");
    expect(tables.contract_events[0].ledger).toBe(10050);
    expect(tables.contract_events[0].txHash).toBe("tx_hash_1");
  });

  it("polls Soroban RPC getEvents from saved cursor and updates state", async () => {
    const { client, tables } = createMockDb();
    tables.sync_state.set(DEFAULT_SYNC_KEY, {
      last_ledger: 100,
      cursor: "cursor_start",
      updated_at: new Date(),
    });

    const mockResponse: SorobanEventsResponse = {
      events: [
        {
          id: "event_1",
          pagingToken: "cursor_page_1",
          ledger: 105,
          contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
          topic: ["opened", 1],
          value: { owner: "GA...", total: "30000000" },
          txHash: "tx_1",
        },
      ],
      latestLedger: 110,
      cursor: "cursor_page_1",
    };

    const mockRpcClient: RpcEventsClient = {
      getEvents: vi.fn(async (req) => {
        expect(req.cursor).toBe("cursor_start");
        expect(req.contractIds).toBeUndefined(); // filters handles contractIds
        return mockResponse;
      }),
    };

    const result = await pollEventsOnce(client, mockRpcClient, {
      rpcUrl: "https://soroban-testnet.stellar.org",
      contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
    });

    expect(result.eventsProcessed).toBe(1);
    expect(result.lastLedger).toBe(105);
    expect(result.cursor).toBe("cursor_page_1");
    expect(tables.contract_events.length).toBe(1);
    expect(tables.sync_state.get(DEFAULT_SYNC_KEY)?.cursor).toBe("cursor_page_1");
  });

  it("uses startLedger when no saved cursor exists", async () => {
    const { client } = createMockDb();

    const mockRpcClient: RpcEventsClient = {
      getEvents: vi.fn(async (req) => {
        expect(req.cursor).toBeUndefined();
        expect(req.startLedger).toBe(200);
        return {
          events: [],
          latestLedger: 205,
          cursor: "new_cursor",
        };
      }),
    };

    const result = await pollEventsOnce(client, mockRpcClient, {
      rpcUrl: "https://soroban-testnet.stellar.org",
      contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
      startLedger: 200,
    });

    expect(result.eventsProcessed).toBe(0);
    expect(result.lastLedger).toBe(205);
    expect(result.cursor).toBe("new_cursor");
  });

  it("stops startEventIngestion immediately when once=true or abort signal fired", async () => {
    const { client } = createMockDb();
    const mockRpcClient: RpcEventsClient = {
      getEvents: vi.fn(async () => ({
        events: [],
        latestLedger: 300,
      })),
    };

    await startEventIngestion(
      client,
      {
        rpcUrl: "https://soroban-testnet.stellar.org",
        contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
      },
      mockRpcClient,
      { once: true }
    );

    expect(mockRpcClient.getEvents).toHaveBeenCalledTimes(1);
  });
});
