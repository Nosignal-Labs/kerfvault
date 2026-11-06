import { KerfvaultClient, NoteState } from "@kerfvault/sdk";
import {
  STELLAR_TESTNET_PASSPHRASE,
  STELLAR_TESTNET_RPC_URL,
} from "@kerfvault/web-wallet";
import { getStoredBookById } from "./booksStore";
import { getStorage } from "./wallet";
import { DEFAULT_CONTRACT_ID } from "./openBookWorkflow";
import { syncOfflineBook } from "./offlineSigningStore";

export interface NoteDetail {
  index: number;
  denominationStroops: string;
  denominationXlm: number;
  state: "open" | "redeemed";
}

export interface BookDetailView {
  id: string;
  owner: string;
  token: string;
  voucherKey: string;
  redeemDeadline: number;
  isExpired: boolean;
  noteCount: number;
  notes: NoteDetail[];
  totalLockedXlm: number;
  unspentXlm: number;
  redeemedXlm: number;
  openNoteCount: number;
  redeemedNoteCount: number;
  source: "chain" | "cache";
}

export function stroopsToXlm(stroops: bigint): number {
  return Number(stroops) / 10_000_000;
}

/**
 * Loads detailed on-chain book and note states.
 * If offline or Soroban RPC fails, transparently falls back to local cached book data.
 * Also synchronizes the local offline signing store.
 */
export async function loadBookDetails(
  bookId: string,
  options?: {
    client?: KerfvaultClient;
    contractId?: string;
    rpcUrl?: string;
    storage?: Storage | null;
  }
): Promise<BookDetailView> {
  const targetStorage = options?.storage || getStorage();
  const cachedBook = getStoredBookById(bookId, targetStorage);

  const contractId =
    options?.contractId ||
    process.env.NEXT_PUBLIC_CONTRACT_ID ||
    DEFAULT_CONTRACT_ID;
  const rpcUrl =
    options?.rpcUrl ||
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
    STELLAR_TESTNET_RPC_URL;

  const client =
    options?.client ||
    new KerfvaultClient({
      contractId,
      rpcUrl,
      networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
    });

  try {
    const onChainBook = await client.getBook(BigInt(bookId));
    const notePromises: Promise<NoteDetail>[] = [];

    for (let idx = 0; idx < onChainBook.noteCount; idx++) {
      notePromises.push(
        client.getNote(BigInt(bookId), idx).then((note) => ({
          index: idx,
          denominationStroops: note.denomination.toString(),
          denominationXlm: stroopsToXlm(note.denomination),
          state: note.state === NoteState.Open ? "open" : "redeemed",
        }))
      );
    }

    const notes = await Promise.all(notePromises);
    const deadlineNum = Number(onChainBook.redeemDeadline);
    const nowSeconds = Math.floor(Date.now() / 1000);

    const openNotes = notes.filter((n) => n.state === "open");
    const redeemedNotes = notes.filter((n) => n.state === "redeemed");

    const totalLockedXlm = notes.reduce((sum, n) => sum + n.denominationXlm, 0);
    const unspentXlm = openNotes.reduce((sum, n) => sum + n.denominationXlm, 0);
    const redeemedXlm = redeemedNotes.reduce((sum, n) => sum + n.denominationXlm, 0);

    const view: BookDetailView = {
      id: bookId,
      owner: onChainBook.owner,
      token: onChainBook.token,
      voucherKey: onChainBook.voucherKey,
      redeemDeadline: deadlineNum,
      isExpired: nowSeconds > deadlineNum,
      noteCount: onChainBook.noteCount,
      notes,
      totalLockedXlm,
      unspentXlm,
      redeemedXlm,
      openNoteCount: openNotes.length,
      redeemedNoteCount: redeemedNotes.length,
      source: "chain",
    };

    // Keep offline signing store updated with latest note states
    syncOfflineBook(view, { storage: targetStorage, contractId });

    return view;
  } catch (err: unknown) {
    // If on-chain read fails or offline, fall back to cached book if available
    if (cachedBook) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const notes: NoteDetail[] = cachedBook.denominations.map((d, idx) => ({
        index: idx,
        denominationStroops: cachedBook.denominationsStroops[idx] || (BigInt(d) * 10_000_000n).toString(),
        denominationXlm: d,
        state: "open", // Cached default
      }));

      const cachedView: BookDetailView = {
        id: cachedBook.id,
        owner: cachedBook.ownerAddress,
        token: cachedBook.tokenAddress,
        voucherKey: cachedBook.voucherPublicKey,
        redeemDeadline: cachedBook.redeemDeadline,
        isExpired: nowSeconds > cachedBook.redeemDeadline,
        noteCount: notes.length,
        notes,
        totalLockedXlm: cachedBook.totalAmountXlm,
        unspentXlm: cachedBook.totalAmountXlm,
        redeemedXlm: 0,
        openNoteCount: notes.length,
        redeemedNoteCount: 0,
        source: "cache",
      };

      syncOfflineBook(cachedView, { storage: targetStorage, contractId });
      return cachedView;
    }

    const message = err instanceof Error ? err.message : "Failed to load book";
    throw new Error(`Could not load Book #${bookId}: ${message}`);
  }
}
