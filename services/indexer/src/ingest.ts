import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import type { Queryable } from "./db/migrate.js";
import { upsertBook, upsertNote, markNoteRedeemed } from "./store.js";

export const DEFAULT_SYNC_KEY = "kerfvault_events";

export interface IngestConfig {
  rpcUrl: string;
  contractId: string;
  startLedger?: number;
  pollIntervalMs?: number;
  limit?: number;
}

export interface SyncState {
  key: string;
  lastLedger: number;
  cursor?: string;
  updatedAt: Date;
}

export interface ContractEventRecord {
  contractId: string;
  topic: string;
  ledger: number;
  txHash?: string;
  cursor?: string;
  data?: any;
}

export interface SorobanEventItem {
  id: string;
  pagingToken: string;
  ledger: number;
  ledgerClosedAt?: string;
  contractId: string;
  topic: any[];
  value: any;
  inSuccessfulContractCall?: boolean;
  txHash?: string;
}

export interface SorobanEventsResponse {
  events: SorobanEventItem[];
  latestLedger: number;
  cursor?: string;
}

export interface RpcEventsClient {
  getEvents: (request: any) => Promise<SorobanEventsResponse>;
}

export interface ContractReader {
  getBook(bookId: bigint): Promise<{
    bookId: bigint;
    owner: string;
    token: string;
    voucherKey: string;
    redeemDeadline: bigint;
    freeBalance: bigint;
    noteCount: number;
  }>;
  getNote(bookId: bigint, noteIndex: number): Promise<{
    denomination: bigint;
    state: number;
  }>;
}

/**
 * Loads the current synchronization cursor and last processed ledger.
 */
export async function getSyncState(
  client: Queryable,
  key = DEFAULT_SYNC_KEY
): Promise<SyncState | null> {
  const result = await client.query<{
    key: string;
    last_ledger: string | number;
    cursor: string | null;
    updated_at: Date;
  }>("SELECT key, last_ledger, cursor, updated_at FROM sync_state WHERE key = $1;", [key]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    key: row.key,
    lastLedger: Number(row.last_ledger),
    cursor: row.cursor ?? undefined,
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Persists the latest synchronization cursor and ledger sequence to the database.
 */
export async function saveSyncState(
  client: Queryable,
  state: { key?: string; lastLedger: number; cursor?: string }
): Promise<void> {
  const key = state.key ?? DEFAULT_SYNC_KEY;
  await client.query(
    `
    INSERT INTO sync_state (key, last_ledger, cursor, updated_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET
      last_ledger = EXCLUDED.last_ledger,
      cursor = EXCLUDED.cursor,
      updated_at = CURRENT_TIMESTAMP;
    `,
    [key, state.lastLedger, state.cursor ?? null]
  );
}

/**
 * Inserts a raw contract event into the contract_events audit table.
 */
export async function recordContractEvent(
  client: Queryable,
  event: ContractEventRecord
): Promise<void> {
  await client.query(
    `
    INSERT INTO contract_events (contract_id, topic, ledger, tx_hash, cursor, data, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP);
    `,
    [
      event.contractId,
      event.topic,
      event.ledger,
      event.txHash ?? null,
      event.cursor ?? null,
      event.data ? JSON.stringify(event.data) : null,
    ]
  );
}

/**
 * Safely parses Soroban event topic and value fields into JavaScript primitives/objects.
 */
export function parseEventData(rawVal: any): any {
  if (rawVal == null) return null;
  try {
    if (typeof rawVal === "string") {
      try {
        const valXdr = xdr.ScVal.fromXDR(rawVal, "base64");
        return scValToNative(valXdr);
      } catch {
        return rawVal;
      }
    }
    if (typeof rawVal === "object" && typeof rawVal.toXDR === "function") {
      return scValToNative(rawVal);
    }
    return rawVal;
  } catch {
    return String(rawVal);
  }
}

/**
 * Extracts topic string identifier from event topics.
 */
export function extractTopicName(topics: any[]): string {
  if (!topics || topics.length === 0) return "unknown";
  const first = parseEventData(topics[0]);
  if (typeof first === "string") return first;
  if (typeof first === "symbol") return (first as symbol).description ?? "unknown";
  return String(first);
}

/**
 * Idempotently processes a contract lifecycle event (opened or redeemed) into structured database tables.
 */
export async function processContractEvent(
  client: Queryable,
  item: SorobanEventItem,
  contractReader?: ContractReader
): Promise<void> {
  const topic = extractTopicName(item.topic);
  const parsedData = parseEventData(item.value);

  let bookId: bigint | undefined;
  if (item.topic && item.topic.length > 1) {
    const rawBookId = parseEventData(item.topic[1]);
    if (rawBookId != null) {
      bookId = BigInt(rawBookId.toString());
    }
  }

  if (topic === "opened" && bookId != null) {
    if (contractReader) {
      const bookView = await contractReader.getBook(bookId);
      await upsertBook(client, {
        bookId,
        contractId: item.contractId,
        owner: bookView.owner,
        token: bookView.token,
        voucherKey: bookView.voucherKey,
        redeemDeadline: bookView.redeemDeadline,
        freeBalance: bookView.freeBalance,
        createdLedger: BigInt(item.ledger),
      });

      for (let i = 0; i < bookView.noteCount; i++) {
        const noteView = await contractReader.getNote(bookId, i);
        await upsertNote(client, {
          bookId,
          noteIndex: i,
          denomination: noteView.denomination,
          state: noteView.state === 1 ? "Redeemed" : "Open",
        });
      }
    } else if (parsedData && typeof parsedData === "object") {
      const owner = parsedData.owner ?? (Array.isArray(parsedData) ? parsedData[0] : "unknown");
      const token = parsedData.token ?? (Array.isArray(parsedData) ? parsedData[1] : "unknown");
      const voucherKey = parsedData.voucherKey ?? "00".repeat(32);
      const redeemDeadline = BigInt(parsedData.redeemDeadline ?? 0);
      const freeBalance = BigInt(parsedData.freeBalance ?? 0);

      await upsertBook(client, {
        bookId,
        contractId: item.contractId,
        owner: String(owner),
        token: String(token),
        voucherKey: String(voucherKey),
        redeemDeadline,
        freeBalance,
        createdLedger: BigInt(item.ledger),
      });

      if (Array.isArray(parsedData.notes)) {
        for (const n of parsedData.notes) {
          await upsertNote(client, {
            bookId,
            noteIndex: n.index ?? 0,
            denomination: BigInt(n.denomination ?? 0),
            state: n.state ?? "Open",
          });
        }
      }
    }
  } else if (topic === "redeemed" && bookId != null) {
    let noteIndex = 0;
    let merchant = "";
    let amount = 0n;

    if (Array.isArray(parsedData)) {
      noteIndex = Number(parsedData[0]);
      merchant = String(parsedData[1]);
      amount = BigInt(parsedData[2]);
    } else if (parsedData && typeof parsedData === "object") {
      noteIndex = Number(parsedData.noteIndex ?? 0);
      merchant = String(parsedData.merchant ?? "");
      amount = BigInt(parsedData.amount ?? 0);
    }

    if (merchant && amount > 0n) {
      await markNoteRedeemed(client, {
        bookId,
        noteIndex,
        merchant,
        amount,
        ledger: BigInt(item.ledger),
      });
    }
  }
}

/**
 * Polls Soroban RPC getEvents once using stored or provided cursor, records raw events,
 * idempotently updates books/notes tables, and advances sync_state.
 */
export async function pollEventsOnce(
  client: Queryable,
  rpcClient: RpcEventsClient,
  config: IngestConfig,
  contractReader?: ContractReader
): Promise<{
  eventsProcessed: number;
  lastLedger: number;
  cursor?: string;
}> {
  const currentState = await getSyncState(client, DEFAULT_SYNC_KEY);

  let requestCursor: string | undefined = currentState?.cursor;
  let requestStartLedger: number | undefined;

  if (!requestCursor) {
    if (currentState?.lastLedger) {
      requestStartLedger = currentState.lastLedger;
    } else if (config.startLedger) {
      requestStartLedger = config.startLedger;
    }
  }

  const filters = [
    {
      type: "contract" as const,
      contractIds: [config.contractId],
    },
  ];

  let request: any;
  if (requestCursor) {
    request = {
      filters,
      cursor: requestCursor,
      limit: config.limit ?? 100,
    };
  } else if (requestStartLedger) {
    request = {
      filters,
      startLedger: requestStartLedger,
      limit: config.limit ?? 100,
    };
  } else {
    request = {
      filters,
      limit: config.limit ?? 100,
    };
  }

  const response = await rpcClient.getEvents(request);

  let maxLedger = currentState?.lastLedger ?? (response.latestLedger || 0);
  let nextCursor = response.cursor ?? requestCursor;

  for (const item of response.events) {
    const topic = extractTopicName(item.topic);
    const parsedData = parseEventData(item.value);

    await recordContractEvent(client, {
      contractId: item.contractId,
      topic,
      ledger: item.ledger,
      txHash: item.txHash,
      cursor: item.pagingToken,
      data: parsedData,
    });

    await processContractEvent(client, item, contractReader);

    if (item.ledger > maxLedger) {
      maxLedger = item.ledger;
    }
    nextCursor = item.pagingToken;
  }

  if (response.latestLedger > maxLedger && response.events.length === 0) {
    maxLedger = response.latestLedger;
  }

  await saveSyncState(client, {
    key: DEFAULT_SYNC_KEY,
    lastLedger: maxLedger,
    cursor: nextCursor,
  });

  return {
    eventsProcessed: response.events.length,
    lastLedger: maxLedger,
    cursor: nextCursor,
  };
}

/**
 * Continuously polls Soroban RPC for contract events with a configurable interval.
 */
export async function startEventIngestion(
  client: Queryable,
  config: IngestConfig,
  customRpcClient?: RpcEventsClient,
  options?: { signal?: AbortSignal; once?: boolean; contractReader?: ContractReader }
): Promise<void> {
  const rpcClient: RpcEventsClient =
    customRpcClient ??
    (new rpc.Server(config.rpcUrl, {
      allowHttp: config.rpcUrl.startsWith("http://"),
    }) as unknown as RpcEventsClient);

  const intervalMs = config.pollIntervalMs ?? 5000;

  do {
    if (options?.signal?.aborted) {
      break;
    }

    try {
      await pollEventsOnce(client, rpcClient, config, options?.contractReader);
    } catch (err) {
      console.error("[indexer:ingest] Error during event poll cycle:", err);
    }

    if (options?.once || options?.signal?.aborted) {
      break;
    }

    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, intervalMs);
      if (options?.signal) {
        options.signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timeout);
            resolve(undefined);
          },
          { once: true }
        );
      }
    });
  } while (!options?.signal?.aborted);
}
