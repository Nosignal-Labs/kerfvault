export type RegistryNoteStatus = "Open" | "Redeemed";

export interface RegistryNote {
  index: number;
  denomination: string;
  status: RegistryNoteStatus;
}

export interface RegistryBook {
  bookId: string;
  owner: string;
  token: string;
  voucherKey: string;
  redeemDeadline: string;
  freeBalance: string;
  notes: RegistryNote[];
}

export interface RegistrySnapshot {
  version: number;
  contractId: string;
  ledgerSequence: number;
  snapshotTimestamp: number;
  books: Record<string, RegistryBook>;
}

