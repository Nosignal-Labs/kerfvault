import type { OfflineVoucher, RegistrySnapshot } from "@kerfvault/sdk";

export type StoredVoucherStatus = "AcceptedOffline" | "PendingRelay" | "RedeemedOnChain" | "Rejected";

export interface StoredVoucherRecord {
  id: string;
  voucher: OfflineVoucher;
  receivedAt: number;
  status: StoredVoucherStatus;
  txHash?: string;
  rejectionReason?: string;
}

export interface MerchantLimits {
  maxOfflineVoucherAmount: bigint;
  maxTotalOfflineExposure: bigint;
}

export interface IReaderStorage {
  // Snapshot cache operations
  saveSnapshot(snapshot: RegistrySnapshot): Promise<void>;
  getLatestSnapshot(): Promise<RegistrySnapshot | null>;

  // Voucher operations
  saveVoucher(record: StoredVoucherRecord): Promise<void>;
  getVouchersByStatus(status?: StoredVoucherStatus): Promise<StoredVoucherRecord[]>;
  updateVoucherStatus(id: string, status: StoredVoucherStatus, details?: { txHash?: string; reason?: string }): Promise<void>;

  // Merchant offline settings
  getLimits(): Promise<MerchantLimits>;
  updateLimits(limits: Partial<MerchantLimits>): Promise<void>;
}

/**
 * Placeholder IndexedDB storage implementation.
 */
export class IndexedDBReaderStorage implements IReaderStorage {
  async saveSnapshot(_snapshot: RegistrySnapshot): Promise<void> {
    // TODO: Open IndexedDB 'kerfvault_reader' object store and persist snapshot
    throw new Error("TODO: IndexedDB saveSnapshot not implemented");
  }

  async getLatestSnapshot(): Promise<RegistrySnapshot | null> {
    // TODO: Retrieve latest cached snapshot from IndexedDB
    throw new Error("TODO: IndexedDB getLatestSnapshot not implemented");
  }

  async saveVoucher(_record: StoredVoucherRecord): Promise<void> {
    // TODO: Store accepted voucher record in IndexedDB 'vouchers' store
    throw new Error("TODO: IndexedDB saveVoucher not implemented");
  }

  async getVouchersByStatus(_status?: StoredVoucherStatus): Promise<StoredVoucherRecord[]> {
    // TODO: Query vouchers by status index from IndexedDB
    throw new Error("TODO: IndexedDB getVouchersByStatus not implemented");
  }

  async updateVoucherStatus(
    _id: string,
    _status: StoredVoucherStatus,
    _details?: { txHash?: string; reason?: string }
  ): Promise<void> {
    // TODO: Update voucher record status and txHash in IndexedDB
    throw new Error("TODO: IndexedDB updateVoucherStatus not implemented");
  }

  async getLimits(): Promise<MerchantLimits> {
    // TODO: Load merchant offline exposure limits from IndexedDB
    throw new Error("TODO: IndexedDB getLimits not implemented");
  }

  async updateLimits(_limits: Partial<MerchantLimits>): Promise<void> {
    // TODO: Persist merchant offline exposure limits to IndexedDB
    throw new Error("TODO: IndexedDB updateLimits not implemented");
  }
}

