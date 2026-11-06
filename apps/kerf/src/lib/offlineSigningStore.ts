import { Keypair } from "@stellar/stellar-sdk";
import { getStorage } from "./wallet";
import { DEFAULT_CONTRACT_ID } from "./openBookWorkflow";
import type { BookDetailView } from "./bookDetails";
import type { StoredBook } from "./booksStore";

export const OFFLINE_BOOKS_KEY = "kerfvault_offline_books_cache";

export type NoteOfflineStatus = "available" | "spent_offline" | "redeemed_onchain";

export interface OfflineNote {
  index: number;
  denominationXlm: number;
  denominationStroops: string;
  status: NoteOfflineStatus;
  spentAt?: number;
  voucherPayload?: string;
}

export interface OfflineBook {
  bookId: string;
  contractId: string;
  voucherPublicKey: string;
  tokenAddress: string;
  redeemDeadline: number;
  notes: OfflineNote[];
  updatedAt: number;
}

/**
 * Extracts 32-byte Ed25519 seed from Stellar secret key for offline signing.
 */
export function getVoucherSeed(secret: string): Uint8Array {
  const kp = Keypair.fromSecret(secret);
  return new Uint8Array(kp.rawSecretKey());
}

/**
 * Retrieves all offline book signing records from local storage.
 */
export function getOfflineBooks(storage: Storage | null = getStorage()): OfflineBook[] {
  if (!storage) return [];
  const raw = storage.getItem(OFFLINE_BOOKS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OfflineBook[];
  } catch {
    return [];
  }
}

/**
 * Retrieves a single offline book signing record by its ID.
 */
export function getOfflineBook(
  bookId: string,
  storage: Storage | null = getStorage()
): OfflineBook | null {
  const books = getOfflineBooks(storage);
  return books.find((b) => b.bookId === bookId) ?? null;
}

/**
 * Saves or updates an offline book record in local storage.
 */
export function saveOfflineBook(
  book: OfflineBook,
  storage: Storage | null = getStorage()
): void {
  if (!storage) return;
  const books = getOfflineBooks(storage);
  const idx = books.findIndex((b) => b.bookId === book.bookId);
  if (idx >= 0) {
    books[idx] = book;
  } else {
    books.unshift(book);
  }
  storage.setItem(OFFLINE_BOOKS_KEY, JSON.stringify(books));
}

/**
 * Returns only the available (unspent) notes for a given book.
 */
export function getAvailableNotesForBook(
  bookId: string,
  storage: Storage | null = getStorage()
): OfflineNote[] {
  const book = getOfflineBook(bookId, storage);
  if (!book) return [];
  return book.notes.filter((n) => n.status === "available");
}

/**
 * Marks a note as spent locally after an offline voucher has been signed and presented,
 * preventing accidental double presentation while in airplane mode.
 */
export function markNoteAsSpentOffline(
  bookId: string,
  noteIndex: number,
  voucherPayload?: string,
  storage: Storage | null = getStorage()
): void {
  const book = getOfflineBook(bookId, storage);
  if (!book) return;

  const note = book.notes.find((n) => n.index === noteIndex);
  if (note) {
    note.status = "spent_offline";
    note.spentAt = Math.floor(Date.now() / 1000);
    if (voucherPayload) {
      note.voucherPayload = voucherPayload;
    }
    book.updatedAt = Math.floor(Date.now() / 1000);
    saveOfflineBook(book, storage);
  }
}

/**
 * Synchronizes offline signing store from a StoredBook or BookDetailView.
 * Preserves locally spent offline flags unless on-chain confirmed as redeemed.
 */
export function syncOfflineBook(
  source: StoredBook | BookDetailView,
  options?: {
    contractId?: string;
    storage?: Storage | null;
  }
): OfflineBook {
  const storage = options?.storage || getStorage();
  const bookId = source.id;
  const contractId = options?.contractId || process.env.NEXT_PUBLIC_CONTRACT_ID || DEFAULT_CONTRACT_ID;
  const existing = getOfflineBook(bookId, storage);

  let notes: OfflineNote[] = [];

  if ("notes" in source && Array.isArray(source.notes)) {
    // source is BookDetailView
    notes = source.notes.map((n) => {
      const existingNote = existing?.notes.find((en) => en.index === n.index);
      let status: NoteOfflineStatus = "available";
      if (n.state === "redeemed") {
        status = "redeemed_onchain";
      } else if (existingNote?.status === "spent_offline") {
        status = "spent_offline"; // Keep locally spent flag
      }
      return {
        index: n.index,
        denominationXlm: n.denominationXlm,
        denominationStroops: n.denominationStroops,
        status,
        spentAt: existingNote?.spentAt,
        voucherPayload: existingNote?.voucherPayload,
      };
    });
  } else {
    // source is StoredBook
    const stored = source as StoredBook;
    notes = stored.denominations.map((denomXlm: number, idx: number) => {
      const existingNote = existing?.notes.find((en) => en.index === idx);
      const stroopsStr = stored.denominationsStroops[idx] || (BigInt(denomXlm) * 10_000_000n).toString();
      return {
        index: idx,
        denominationXlm: denomXlm,
        denominationStroops: stroopsStr,
        status: existingNote?.status || "available",
        spentAt: existingNote?.spentAt,
        voucherPayload: existingNote?.voucherPayload,
      };
    });
  }

  const voucherPublicKey = "voucherPublicKey" in source ? source.voucherPublicKey : source.voucherKey;
  const tokenAddress = "tokenAddress" in source ? source.tokenAddress : source.token;

  const offlineBook: OfflineBook = {
    bookId,
    contractId,
    voucherPublicKey,
    tokenAddress,
    redeemDeadline: source.redeemDeadline,
    notes,
    updatedAt: Math.floor(Date.now() / 1000),
  };

  saveOfflineBook(offlineBook, storage);
  return offlineBook;
}

/**
 * Clears offline books cache from local storage.
 */
export function clearOfflineBooks(storage: Storage | null = getStorage()): void {
  if (!storage) return;
  storage.removeItem(OFFLINE_BOOKS_KEY);
}
