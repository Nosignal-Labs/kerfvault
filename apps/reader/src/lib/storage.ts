import type { OfflineVoucher, RegistrySnapshot } from "@kerfvault/sdk";

export const DB_NAME = "kerfvault_reader_db";
export const DB_VERSION = 1;

export const STORE_SNAPSHOTS = "snapshots";
export const STORE_VOUCHERS = "vouchers";

export type StoredVoucherStatus =
  | "AcceptedOffline"
  | "PendingRelay"
  | "RedeemedOnChain"
  | "Rejected";

export interface StoredVoucherRecord {
  id: string;
  voucher: OfflineVoucher;
  rawWirePayload?: string;
  receivedAt: number;
  status: StoredVoucherStatus;
  txHash?: string;
  rejectionReason?: string;
}

export interface StoredSnapshotRecord {
  id: "latest";
  snapshot: RegistrySnapshot;
  lastSyncedAt: number; // Unix epoch milliseconds
}

export interface MerchantLimits {
  maxOfflineVoucherAmount: bigint;
  maxTotalOfflineExposure: bigint;
}

export interface IReaderStorage {
  // Snapshot cache operations
  saveSnapshot(snapshot: RegistrySnapshot, lastSyncedAt?: number): Promise<StoredSnapshotRecord>;
  getLatestSnapshot(): Promise<StoredSnapshotRecord | null>;
  clearSnapshot(): Promise<void>;

  // Voucher operations
  saveVoucher(record: StoredVoucherRecord): Promise<void>;
  getVoucher(id: string): Promise<StoredVoucherRecord | null>;
  getVouchersByStatus(status?: StoredVoucherStatus): Promise<StoredVoucherRecord[]>;
  updateVoucherStatus(
    id: string,
    status: StoredVoucherStatus,
    details?: { txHash?: string; reason?: string }
  ): Promise<void>;
}

function getIndexedDB(customFactory?: IDBFactory): IDBFactory | null {
  if (customFactory) return customFactory;
  if (typeof window !== "undefined" && window.indexedDB) {
    return window.indexedDB;
  }
  if (typeof globalThis !== "undefined" && (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB) {
    return (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB;
  }
  return null;
}

export function openReaderDatabase(customFactory?: IDBFactory): Promise<IDBDatabase> {
  const idb = getIndexedDB(customFactory);
  if (!idb) {
    return Promise.reject(new Error("IndexedDB is not supported or unavailable in this environment."));
  }

  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORE_VOUCHERS)) {
        const voucherStore = db.createObjectStore(STORE_VOUCHERS, { keyPath: "id" });
        voucherStore.createIndex("status", "status", { unique: false });
        voucherStore.createIndex("receivedAt", "receivedAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to open IndexedDB reader database."));
    };
  });
}

/**
 * Persists a registry snapshot into IndexedDB with an updated last-synced timestamp.
 */
export async function saveRegistrySnapshot(
  snapshot: RegistrySnapshot,
  lastSyncedAt = Date.now(),
  customFactory?: IDBFactory
): Promise<StoredSnapshotRecord> {
  const db = await openReaderDatabase(customFactory);

  const record: StoredSnapshotRecord = {
    id: "latest",
    snapshot,
    lastSyncedAt,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOTS, "readwrite");
    const store = tx.objectStore(STORE_SNAPSHOTS);
    const req = store.put(record);

    req.onsuccess = () => {
      db.close();
      resolve(record);
    };

    req.onerror = () => {
      db.close();
      reject(req.error || new Error("Failed to save snapshot to IndexedDB."));
    };
  });
}

/**
 * Retrieves the latest cached registry snapshot and last-synced timestamp from IndexedDB.
 */
export async function getLatestRegistrySnapshot(
  customFactory?: IDBFactory
): Promise<StoredSnapshotRecord | null> {
  const db = await openReaderDatabase(customFactory);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOTS, "readonly");
    const store = tx.objectStore(STORE_SNAPSHOTS);
    const req = store.get("latest");

    req.onsuccess = () => {
      db.close();
      resolve((req.result as StoredSnapshotRecord) || null);
    };

    req.onerror = () => {
      db.close();
      reject(req.error || new Error("Failed to read snapshot from IndexedDB."));
    };
  });
}

/**
 * Removes the stored registry snapshot from IndexedDB.
 */
export async function clearRegistrySnapshot(customFactory?: IDBFactory): Promise<void> {
  const db = await openReaderDatabase(customFactory);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOTS, "readwrite");
    const store = tx.objectStore(STORE_SNAPSHOTS);
    const req = store.delete("latest");

    req.onsuccess = () => {
      db.close();
      resolve();
    };

    req.onerror = () => {
      db.close();
      reject(req.error || new Error("Failed to clear snapshot from IndexedDB."));
    };
  });
}

/**
 * Full IndexedDB reader storage implementation implementing IReaderStorage.
 */
export class IndexedDBReaderStorage implements IReaderStorage {
  constructor(private customFactory?: IDBFactory) { }

  async saveSnapshot(
    snapshot: RegistrySnapshot,
    lastSyncedAt = Date.now()
  ): Promise<StoredSnapshotRecord> {
    return saveRegistrySnapshot(snapshot, lastSyncedAt, this.customFactory);
  }

  async getLatestSnapshot(): Promise<StoredSnapshotRecord | null> {
    return getLatestRegistrySnapshot(this.customFactory);
  }

  async clearSnapshot(): Promise<void> {
    return clearRegistrySnapshot(this.customFactory);
  }

  async saveVoucher(record: StoredVoucherRecord): Promise<void> {
    const db = await openReaderDatabase(this.customFactory);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VOUCHERS, "readwrite");
      const store = tx.objectStore(STORE_VOUCHERS);
      const req = store.put(record);

      req.onsuccess = () => {
        db.close();
        resolve();
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  }

  async getVoucher(id: string): Promise<StoredVoucherRecord | null> {
    return getVoucherRecord(id, this.customFactory);
  }

  async getVouchersByStatus(status?: StoredVoucherStatus): Promise<StoredVoucherRecord[]> {
    const db = await openReaderDatabase(this.customFactory);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VOUCHERS, "readonly");
      const store = tx.objectStore(STORE_VOUCHERS);

      let req: IDBRequest;
      if (status) {
        const index = store.index("status");
        req = index.getAll(status);
      } else {
        req = store.getAll();
      }

      req.onsuccess = () => {
        db.close();
        resolve((req.result as StoredVoucherRecord[]) || []);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  }

  async updateVoucherStatus(
    id: string,
    status: StoredVoucherStatus,
    details?: { txHash?: string; reason?: string }
  ): Promise<void> {
    const db = await openReaderDatabase(this.customFactory);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VOUCHERS, "readwrite");
      const store = tx.objectStore(STORE_VOUCHERS);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const record = getReq.result as StoredVoucherRecord | undefined;
        if (!record) {
          db.close();
          reject(new Error(`Voucher with id '${id}' not found.`));
          return;
        }

        record.status = status;
        if (details?.txHash) record.txHash = details.txHash;
        if (details?.reason) record.rejectionReason = details.reason;

        const putReq = store.put(record);
        putReq.onsuccess = () => {
          db.close();
          resolve();
        };
        putReq.onerror = () => {
          db.close();
          reject(putReq.error);
        };
      };

      getReq.onerror = () => {
        db.close();
        reject(getReq.error);
      };
    });
  }
}

/**
 * Derives the unique record ID for a voucher note in reader storage.
 */
export function getVoucherRecordId(
  bookId: bigint | string | number,
  noteIndex: number
): string {
  return `${bookId.toString()}:${noteIndex}`;
}

/**
 * Saves a voucher record directly into IndexedDB.
 */
export async function saveVoucherRecord(
  record: StoredVoucherRecord,
  customFactory?: IDBFactory
): Promise<void> {
  const db = await openReaderDatabase(customFactory);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VOUCHERS, "readwrite");
    const store = tx.objectStore(STORE_VOUCHERS);
    const req = store.put(record);

    req.onsuccess = () => {
      db.close();
      resolve();
    };
    req.onerror = () => {
      db.close();
      reject(req.error || new Error("Failed to save voucher record to IndexedDB."));
    };
  });
}

/**
 * Retrieves a single stored voucher record by its record ID.
 */
export async function getVoucherRecord(
  id: string,
  customFactory?: IDBFactory
): Promise<StoredVoucherRecord | null> {
  const db = await openReaderDatabase(customFactory);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VOUCHERS, "readonly");
    const store = tx.objectStore(STORE_VOUCHERS);
    const req = store.get(id);

    req.onsuccess = () => {
      db.close();
      resolve((req.result as StoredVoucherRecord) || null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error || new Error("Failed to get voucher record from IndexedDB."));
    };
  });
}

/**
 * Checks whether a voucher (bookId + noteIndex) has already been accepted on this terminal.
 * Returns true if an active voucher record exists with status not equal to "Rejected".
 */
export async function isVoucherAlreadyAccepted(
  bookId: bigint | string | number,
  noteIndex: number,
  customFactory?: IDBFactory
): Promise<boolean> {
  const id = getVoucherRecordId(bookId, noteIndex);
  const record = await getVoucherRecord(id, customFactory);
  if (!record) return false;
  return record.status !== "Rejected";
}

/**
 * Records an accepted offline voucher in IndexedDB with initial status "AcceptedOffline".
 * Throws if the voucher has already been accepted.
 */
export async function recordAcceptedVoucher(
  voucher: OfflineVoucher,
  rawWirePayload?: string,
  customFactory?: IDBFactory
): Promise<StoredVoucherRecord> {
  const id = getVoucherRecordId(voucher.bookId, voucher.noteIndex);
  const alreadyAccepted = await isVoucherAlreadyAccepted(voucher.bookId, voucher.noteIndex, customFactory);
  if (alreadyAccepted) {
    throw new Error(
      `Cannot accept voucher: Book #${voucher.bookId.toString()} Note #${voucher.noteIndex} has already been accepted.`
    );
  }

  const record: StoredVoucherRecord = {
    id,
    voucher,
    rawWirePayload,
    receivedAt: Date.now(),
    status: "AcceptedOffline",
  };

  await saveVoucherRecord(record, customFactory);
  return record;
}

/**
 * Retrieves all stored voucher records from IndexedDB.
 */
export async function getAllStoredVouchers(
  customFactory?: IDBFactory
): Promise<StoredVoucherRecord[]> {
  const db = await openReaderDatabase(customFactory);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VOUCHERS, "readonly");
    const store = tx.objectStore(STORE_VOUCHERS);
    const req = store.getAll();

    req.onsuccess = () => {
      db.close();
      resolve((req.result as StoredVoucherRecord[]) || []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error || new Error("Failed to get all vouchers from IndexedDB."));
    };
  });
}

/**
 * Clears all voucher records from IndexedDB.
 */
export async function clearAllStoredVouchers(
  customFactory?: IDBFactory
): Promise<void> {
  const db = await openReaderDatabase(customFactory);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VOUCHERS, "readwrite");
    const store = tx.objectStore(STORE_VOUCHERS);
    const req = store.clear();

    req.onsuccess = () => {
      db.close();
      resolve();
    };
    req.onerror = () => {
      db.close();
      reject(req.error || new Error("Failed to clear vouchers from IndexedDB."));
    };
  });
}
