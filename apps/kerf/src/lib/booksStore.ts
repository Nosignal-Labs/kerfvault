import { getStorage } from "./wallet";

export const BOOKS_STORAGE_KEY = "kerfvault_shopper_books";

export interface StoredBook {
  id: string; // On-chain Book ID (e.g. "1")
  ownerAddress: string;
  tokenAddress: string;
  voucherPublicKey: string;
  denominations: number[]; // e.g. [5, 10, 20, 50]
  denominationsStroops: string[]; // e.g. ["50000000", ...]
  totalAmountXlm: number;
  redeemDeadline: number; // UNIX seconds
  createdAt: number;
  status: "active" | "expired" | "reclaimed";
}

/**
 * Loads all locally cached books created by this wallet.
 */
export function getStoredBooks(storage: Storage | null = getStorage()): StoredBook[] {
  if (!storage) return [];
  const raw = storage.getItem(BOOKS_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredBook[];
  } catch {
    return [];
  }
}

/**
 * Retrieves a single stored book by its on-chain ID.
 */
export function getStoredBookById(
  id: string,
  storage: Storage | null = getStorage()
): StoredBook | null {
  const books = getStoredBooks(storage);
  return books.find((b) => b.id === id) ?? null;
}

/**
 * Saves or updates a book in local storage.
 */
export function saveStoredBook(
  book: StoredBook,
  storage: Storage | null = getStorage()
): void {
  if (!storage) return;
  const books = getStoredBooks(storage);
  const existingIdx = books.findIndex((b) => b.id === book.id);
  if (existingIdx >= 0) {
    books[existingIdx] = book;
  } else {
    books.unshift(book); // Add newest first
  }
  storage.setItem(BOOKS_STORAGE_KEY, JSON.stringify(books));
}

/**
 * Clears all cached books from storage.
 */
export function clearStoredBooks(storage: Storage | null = getStorage()): void {
  if (!storage) return;
  storage.removeItem(BOOKS_STORAGE_KEY);
}

