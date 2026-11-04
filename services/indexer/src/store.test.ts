import { describe, it, expect, vi } from "vitest";
import {
  upsertBook,
  upsertNote,
  markNoteRedeemed,
  getBook,
  getNotesForBook,
} from "./store.js";
import { processContractEvent, type ContractReader } from "./ingest.js";
import type { Queryable } from "./db/migrate.js";

function createMockDb(): {
  client: Queryable;
  queries: string[];
  tables: {
    books: Map<string, any>;
    notes: Map<string, any>;
  };
} {
  const queries: string[] = [];
  const tables = {
    books: new Map<string, any>(),
    notes: new Map<string, any>(),
  };

  const client: Queryable = {
    query: vi.fn(async <R = any>(text: string, values?: unknown[]) => {
      queries.push(text);

      if (text.includes("INSERT INTO books")) {
        const bookId = values?.[0] as string;
        const freeBalance = values?.[6] as string;
        const existing = tables.books.get(bookId);
        if (existing) {
          existing.free_balance = freeBalance;
        } else {
          tables.books.set(bookId, {
            book_id: bookId,
            contract_id: values?.[1],
            owner: values?.[2],
            token: values?.[3],
            voucher_key: values?.[4],
            redeem_deadline: values?.[5],
            free_balance: freeBalance,
            created_ledger: values?.[7],
          });
        }
        return { rows: [] as R[] };
      }

      if (text.includes("INSERT INTO notes")) {
        const bookId = values?.[0] as string;
        const noteIndex = Number(values?.[1]);
        const key = `${bookId}:${noteIndex}`;
        const existing = tables.notes.get(key);
        if (existing) {
          existing.state = values?.[3];
          if (values?.[4]) existing.redeemed_merchant = values?.[4];
          if (values?.[5]) existing.redeemed_amount = values?.[5];
          if (values?.[6]) existing.redeemed_ledger = values?.[6];
          if (values?.[7]) existing.redeemed_at = values?.[7];
        } else {
          tables.notes.set(key, {
            book_id: bookId,
            note_index: noteIndex,
            denomination: values?.[2],
            state: values?.[3],
            redeemed_merchant: values?.[4] ?? null,
            redeemed_amount: values?.[5] ?? null,
            redeemed_ledger: values?.[6] ?? null,
            redeemed_at: values?.[7] ?? null,
          });
        }
        return { rows: [] as R[] };
      }

      if (text.includes("SELECT denomination, state FROM notes WHERE book_id")) {
        const bookId = values?.[0] as string;
        const noteIndex = Number(values?.[1]);
        const key = `${bookId}:${noteIndex}`;
        const note = tables.notes.get(key);
        if (!note) return { rows: [] as R[] };
        return { rows: [{ denomination: note.denomination, state: note.state }] as unknown as R[] };
      }

      if (text.includes("UPDATE notes SET")) {
        const bookId = values?.[4] as string;
        const noteIndex = Number(values?.[5]);
        const key = `${bookId}:${noteIndex}`;
        const note = tables.notes.get(key);
        if (note) {
          note.state = "Redeemed";
          note.redeemed_merchant = values?.[0];
          note.redeemed_amount = values?.[1];
          note.redeemed_ledger = values?.[2];
          note.redeemed_at = values?.[3];
        }
        return { rows: [] as R[] };
      }

      if (text.includes("UPDATE books SET")) {
        const refund = BigInt(values?.[0] as string);
        const bookId = values?.[1] as string;
        const book = tables.books.get(bookId);
        if (book) {
          book.free_balance = (BigInt(book.free_balance) + refund).toString();
        }
        return { rows: [] as R[] };
      }

      if (text.includes("SELECT * FROM books WHERE book_id")) {
        const bookId = values?.[0] as string;
        const book = tables.books.get(bookId);
        if (!book) return { rows: [] as R[] };
        return { rows: [book] as unknown as R[] };
      }

      if (text.includes("SELECT * FROM notes WHERE book_id")) {
        const bookId = values?.[0] as string;
        const matching = Array.from(tables.notes.values()).filter((n) => n.book_id === bookId);
        return { rows: matching as unknown as R[] };
      }

      return { rows: [] as R[] };
    }),
  };

  return { client, queries, tables };
}

describe("Store - Idempotent Persistence", () => {
  it("upserts book idempotently without duplicating entries", async () => {
    const { client, tables } = createMockDb();

    await upsertBook(client, {
      bookId: 101n,
      contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
      owner: "GA111111111111111111111111111111111111111111111111111111",
      token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      voucherKey: "010203",
      redeemDeadline: 1793400000n,
      freeBalance: 0n,
      createdLedger: 100n,
    });

    expect(tables.books.size).toBe(1);

    // Call upsert again for same book with new freeBalance
    await upsertBook(client, {
      bookId: 101n,
      contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
      owner: "GA111111111111111111111111111111111111111111111111111111",
      token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      voucherKey: "010203",
      redeemDeadline: 1793400000n,
      freeBalance: 3000000n,
      createdLedger: 100n,
    });

    expect(tables.books.size).toBe(1);
    expect(tables.books.get("101").free_balance).toBe("3000000");

    const retrieved = await getBook(client, 101n);
    expect(retrieved?.bookId).toBe(101n);
    expect(retrieved?.freeBalance).toBe(3000000n);
  });

  it("upserts notes idempotently and tracks states", async () => {
    const { client, tables } = createMockDb();

    await upsertNote(client, {
      bookId: 101n,
      noteIndex: 0,
      denomination: 10000000n,
      state: "Open",
    });

    expect(tables.notes.size).toBe(1);

    // Re-run insert with same bookId & noteIndex
    await upsertNote(client, {
      bookId: 101n,
      noteIndex: 0,
      denomination: 10000000n,
      state: "Open",
    });

    expect(tables.notes.size).toBe(1);

    const notes = await getNotesForBook(client, 101n);
    expect(notes.length).toBe(1);
    expect(notes[0].denomination).toBe(10000000n);
    expect(notes[0].state).toBe("Open");
  });

  it("marks note redeemed and credits free balance idempotently", async () => {
    const { client, tables } = createMockDb();

    await upsertBook(client, {
      bookId: 101n,
      contractId: "CBGA",
      owner: "GA1",
      token: "CDLZ",
      voucherKey: "key1",
      redeemDeadline: 1000n,
      freeBalance: 0n,
      createdLedger: 10n,
    });

    await upsertNote(client, {
      bookId: 101n,
      noteIndex: 0,
      denomination: 10000000n,
      state: "Open",
    });

    // Redeem 7,000,000 stroops out of 10,000,000 stroops denomination
    await markNoteRedeemed(client, {
      bookId: 101n,
      noteIndex: 0,
      merchant: "GDEL",
      amount: 7000000n,
      ledger: 15n,
    });

    const note = tables.notes.get("101:0");
    expect(note.state).toBe("Redeemed");
    expect(note.redeemed_merchant).toBe("GDEL");
    expect(note.redeemed_amount).toBe("7000000");

    // Book free balance should be credited with remainder 3,000,000
    expect(tables.books.get("101").free_balance).toBe("3000000");

    // Repeated call should NOT double-credit free balance
    await markNoteRedeemed(client, {
      bookId: 101n,
      noteIndex: 0,
      merchant: "GDEL",
      amount: 7000000n,
      ledger: 15n,
    });

    expect(tables.books.get("101").free_balance).toBe("3000000");
  });

  it("processes lifecycle events via contractReader without duplicate rows", async () => {
    const { client, tables } = createMockDb();

    const mockReader: ContractReader = {
      getBook: vi.fn(async (id: bigint) => ({
        bookId: id,
        owner: "GA_OWNER",
        token: "CD_TOKEN",
        voucherKey: "v_key",
        redeemDeadline: 5000n,
        freeBalance: 0n,
        noteCount: 2,
      })),
      getNote: vi.fn(async (_id: bigint, idx: number) => ({
        denomination: BigInt((idx + 1) * 10000000),
        state: 0,
      })),
    };

    const openedEvent = {
      id: "ev1",
      pagingToken: "pt1",
      ledger: 100,
      contractId: "CBGA",
      topic: ["opened", 202],
      value: ["GA_OWNER", "CD_TOKEN", 30000000, 2],
    };

    // First delivery of opened event
    await processContractEvent(client, openedEvent, mockReader);
    expect(tables.books.size).toBe(1);
    expect(tables.notes.size).toBe(2);

    // Second delivery of same opened event (e.g. indexer restart from earlier ledger)
    await processContractEvent(client, openedEvent, mockReader);
    expect(tables.books.size).toBe(1);
    expect(tables.notes.size).toBe(2);

    // Delivery of redeemed event
    const redeemedEvent = {
      id: "ev2",
      pagingToken: "pt2",
      ledger: 105,
      contractId: "CBGA",
      topic: ["redeemed", 202],
      value: [0, "GD_MERCHANT", 6000000],
    };

    await processContractEvent(client, redeemedEvent, mockReader);
    expect(tables.notes.get("202:0").state).toBe("Redeemed");
    expect(tables.books.get("202").free_balance).toBe("4000000"); // 10,000,000 - 6,000,000 = 4,000,000
  });
});
