import type { Queryable } from "./db/migrate.js";

export interface BookRecord {
  bookId: bigint;
  contractId: string;
  owner: string;
  token: string;
  voucherKey: string;
  redeemDeadline: bigint;
  freeBalance?: bigint;
  createdLedger: bigint;
}

export interface NoteRecord {
  bookId: bigint;
  noteIndex: number;
  denomination: bigint;
  state?: "Open" | "Redeemed";
  redeemedMerchant?: string;
  redeemedAmount?: bigint;
  redeemedLedger?: bigint;
  redeemedAt?: Date;
}

/**
 * Idempotently inserts or updates a book row.
 */
export async function upsertBook(client: Queryable, book: BookRecord): Promise<void> {
  const freeBalance = book.freeBalance ?? 0n;
  await client.query(
    `
    INSERT INTO books (
      book_id, contract_id, owner, token, voucher_key,
      redeem_deadline, free_balance, created_ledger, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    ON CONFLICT (book_id) DO UPDATE SET
      free_balance = EXCLUDED.free_balance;
    `,
    [
      book.bookId.toString(),
      book.contractId,
      book.owner,
      book.token,
      book.voucherKey,
      book.redeemDeadline.toString(),
      freeBalance.toString(),
      book.createdLedger.toString(),
    ]
  );
}

/**
 * Idempotently inserts or updates a note row.
 */
export async function upsertNote(client: Queryable, note: NoteRecord): Promise<void> {
  const state = note.state ?? "Open";
  await client.query(
    `
    INSERT INTO notes (
      book_id, note_index, denomination, state,
      redeemed_merchant, redeemed_amount, redeemed_ledger, redeemed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (book_id, note_index) DO UPDATE SET
      state = EXCLUDED.state,
      redeemed_merchant = COALESCE(EXCLUDED.redeemed_merchant, notes.redeemed_merchant),
      redeemed_amount = COALESCE(EXCLUDED.redeemed_amount, notes.redeemed_amount),
      redeemed_ledger = COALESCE(EXCLUDED.redeemed_ledger, notes.redeemed_ledger),
      redeemed_at = COALESCE(EXCLUDED.redeemed_at, notes.redeemed_at);
    `,
    [
      note.bookId.toString(),
      note.noteIndex,
      note.denomination.toString(),
      state,
      note.redeemedMerchant ?? null,
      note.redeemedAmount ? note.redeemedAmount.toString() : null,
      note.redeemedLedger ? note.redeemedLedger.toString() : null,
      note.redeemedAt ?? null,
    ]
  );
}

/**
 * Marks a note as redeemed and credits any remainder to the book's free balance.
 * Safe to call repeatedly without duplicating deductions or rows.
 */
export async function markNoteRedeemed(
  client: Queryable,
  params: {
    bookId: bigint;
    noteIndex: number;
    merchant: string;
    amount: bigint;
    ledger: bigint;
    redeemedAt?: Date;
  }
): Promise<void> {
  const redeemedAt = params.redeemedAt ?? new Date();

  // Fetch the note denomination to calculate remainder credit
  const existingNote = await client.query<{
    denomination: string;
    state: string;
  }>(
    "SELECT denomination, state FROM notes WHERE book_id = $1 AND note_index = $2;",
    [params.bookId.toString(), params.noteIndex]
  );

  const denomStr = existingNote.rows[0]?.denomination;
  const wasAlreadyRedeemed = existingNote.rows[0]?.state === "Redeemed";

  await client.query(
    `
    UPDATE notes SET
      state = 'Redeemed',
      redeemed_merchant = $1,
      redeemed_amount = $2,
      redeemed_ledger = $3,
      redeemed_at = $4
    WHERE book_id = $5 AND note_index = $6;
    `,
    [
      params.merchant,
      params.amount.toString(),
      params.ledger.toString(),
      redeemedAt,
      params.bookId.toString(),
      params.noteIndex,
    ]
  );

  // If this transition wasn't already recorded, credit note remainder to book free_balance
  if (denomStr && !wasAlreadyRedeemed) {
    const denomination = BigInt(denomStr);
    const refund = denomination > params.amount ? denomination - params.amount : 0n;
    if (refund > 0n) {
      await client.query(
        `
        UPDATE books SET
          free_balance = free_balance + $1
        WHERE book_id = $2;
        `,
        [refund.toString(), params.bookId.toString()]
      );
    }
  }
}

/**
 * Retrieves a single book by ID.
 */
export async function getBook(
  client: Queryable,
  bookId: bigint
): Promise<BookRecord | null> {
  const result = await client.query<{
    book_id: string;
    contract_id: string;
    owner: string;
    token: string;
    voucher_key: string;
    redeem_deadline: string;
    free_balance: string;
    created_ledger: string;
  }>("SELECT * FROM books WHERE book_id = $1;", [bookId.toString()]);

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    bookId: BigInt(row.book_id),
    contractId: row.contract_id,
    owner: row.owner,
    token: row.token,
    voucherKey: row.voucher_key,
    redeemDeadline: BigInt(row.redeem_deadline),
    freeBalance: BigInt(row.free_balance),
    createdLedger: BigInt(row.created_ledger),
  };
}

/**
 * Retrieves all notes for a specific book.
 */
export async function getNotesForBook(
  client: Queryable,
  bookId: bigint
): Promise<NoteRecord[]> {
  const result = await client.query<{
    book_id: string;
    note_index: number;
    denomination: string;
    state: "Open" | "Redeemed";
    redeemed_merchant: string | null;
    redeemed_amount: string | null;
    redeemed_ledger: string | null;
    redeemed_at: Date | null;
  }>("SELECT * FROM notes WHERE book_id = $1 ORDER BY note_index ASC;", [bookId.toString()]);

  return result.rows.map((row) => ({
    bookId: BigInt(row.book_id),
    noteIndex: row.note_index,
    denomination: BigInt(row.denomination),
    state: row.state,
    redeemedMerchant: row.redeemed_merchant ?? undefined,
    redeemedAmount: row.redeemed_amount ? BigInt(row.redeemed_amount) : undefined,
    redeemedLedger: row.redeemed_ledger ? BigInt(row.redeemed_ledger) : undefined,
    redeemedAt: row.redeemed_at ? new Date(row.redeemed_at) : undefined,
  }));
}
