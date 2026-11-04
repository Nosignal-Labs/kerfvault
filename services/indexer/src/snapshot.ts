import type { RegistrySnapshot, RegistryBook, RegistryNote } from "@kerfvault/sdk";
import type { Queryable } from "./db/migrate.js";
import { DEFAULT_SYNC_KEY } from "./ingest.js";

/**
 * Builds a compact point-in-time RegistrySnapshot directly from PostgreSQL database state.
 */
export async function buildRegistrySnapshot(
  client: Queryable,
  contractId?: string
): Promise<RegistrySnapshot> {
  const syncRow = await client.query<{ last_ledger: string | number }>(
    "SELECT last_ledger FROM sync_state WHERE key = $1;",
    [DEFAULT_SYNC_KEY]
  );
  const ledgerSequence = syncRow.rows[0]?.last_ledger
    ? Number(syncRow.rows[0].last_ledger)
    : 0;

  const booksResult = await client.query<{
    book_id: string;
    contract_id: string;
    owner: string;
    token: string;
    voucher_key: string;
    redeem_deadline: string;
    free_balance: string;
  }>("SELECT book_id, contract_id, owner, token, voucher_key, redeem_deadline, free_balance FROM books ORDER BY book_id ASC;");

  const notesResult = await client.query<{
    book_id: string;
    note_index: number;
    denomination: string;
    state: "Open" | "Redeemed";
  }>("SELECT book_id, note_index, denomination, state FROM notes ORDER BY book_id ASC, note_index ASC;");

  const notesByBook = new Map<string, RegistryNote[]>();
  for (const n of notesResult.rows) {
    let list = notesByBook.get(n.book_id);
    if (!list) {
      list = [];
      notesByBook.set(n.book_id, list);
    }
    list.push({
      index: n.note_index,
      denomination: n.denomination,
      status: n.state,
    });
  }

  const resolvedContractId =
    contractId ??
    booksResult.rows[0]?.contract_id ??
    process.env.KERFVAULT_CONTRACT_ID ??
    "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

  const books: Record<string, RegistryBook> = {};
  for (const b of booksResult.rows) {
    books[b.book_id] = {
      bookId: b.book_id,
      owner: b.owner,
      token: b.token,
      voucherKey: b.voucher_key,
      redeemDeadline: b.redeem_deadline,
      freeBalance: b.free_balance,
      notes: notesByBook.get(b.book_id) ?? [],
    };
  }

  return {
    version: 1,
    contractId: resolvedContractId,
    ledgerSequence,
    snapshotTimestamp: Math.floor(Date.now() / 1000),
    books,
  };
}
