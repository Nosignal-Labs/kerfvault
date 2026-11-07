import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  saveRegistrySnapshot,
  getLatestRegistrySnapshot,
  clearRegistrySnapshot,
  IndexedDBReaderStorage,
  getVoucherRecordId,
  saveVoucherRecord,
  getVoucherRecord,
  isVoucherAlreadyAccepted,
  recordAcceptedVoucher,
  getAllStoredVouchers,
  clearAllStoredVouchers,
} from "./lib/storage";
import type { OfflineVoucher, RegistrySnapshot } from "@kerfvault/sdk";

describe("IndexedDB Reader Storage for Registry Snapshot", () => {
  const testSnapshot1: RegistrySnapshot = {
    version: 1,
    contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
    ledgerSequence: 20000,
    snapshotTimestamp: 1793860000,
    books: {
      "10": {
        bookId: "10",
        owner: "GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK",
        token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        voucherKey: "67980208cb1bf0a5cf571efc5cf8c4ccf7547eb2ea61ffdc59868e42dbd8ad64",
        redeemDeadline: "1794500000",
        freeBalance: "100000000",
        notes: [
          {
            index: 0,
            denomination: "50000000",
            status: "Open",
          },
        ],
      },
    },
  };

  const testSnapshot2: RegistrySnapshot = {
    ...testSnapshot1,
    ledgerSequence: 20500,
    snapshotTimestamp: 1793865000,
  };

  beforeEach(async () => {
    await clearRegistrySnapshot();
  });

  it("returns null when no snapshot is stored", async () => {
    const latest = await getLatestRegistrySnapshot();
    expect(latest).toBeNull();
  });

  it("saves a snapshot to IndexedDB with a last-synced timestamp", async () => {
    const syncTime = 1793861234000;
    const saved = await saveRegistrySnapshot(testSnapshot1, syncTime);

    expect(saved.id).toBe("latest");
    expect(saved.lastSyncedAt).toBe(syncTime);
    expect(saved.snapshot.ledgerSequence).toBe(20000);

    const retrieved = await getLatestRegistrySnapshot();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.lastSyncedAt).toBe(syncTime);
    expect(retrieved?.snapshot.contractId).toBe(testSnapshot1.contractId);
    expect(retrieved?.snapshot.books["10"].notes[0].denomination).toBe("50000000");
  });

  it("updates existing snapshot with a newer sync stamp", async () => {
    await saveRegistrySnapshot(testSnapshot1, 1000);
    const updated = await saveRegistrySnapshot(testSnapshot2, 2000);

    expect(updated.lastSyncedAt).toBe(2000);
    expect(updated.snapshot.ledgerSequence).toBe(20500);

    const latest = await getLatestRegistrySnapshot();
    expect(latest?.lastSyncedAt).toBe(2000);
    expect(latest?.snapshot.ledgerSequence).toBe(20500);
  });

  it("clears stored snapshot from IndexedDB", async () => {
    await saveRegistrySnapshot(testSnapshot1);
    expect(await getLatestRegistrySnapshot()).not.toBeNull();

    await clearRegistrySnapshot();
    expect(await getLatestRegistrySnapshot()).toBeNull();
  });

  it("operates through the IndexedDBReaderStorage class", async () => {
    const storage = new IndexedDBReaderStorage();

    const record = await storage.saveSnapshot(testSnapshot1, 5555);
    expect(record.lastSyncedAt).toBe(5555);

    const loaded = await storage.getLatestSnapshot();
    expect(loaded?.lastSyncedAt).toBe(5555);
    expect(loaded?.snapshot.ledgerSequence).toBe(20000);

    await storage.clearSnapshot();
    expect(await storage.getLatestSnapshot()).toBeNull();
  });
});

describe("IndexedDB Reader Storage for Accepted Vouchers", () => {
  const dummyVoucher: OfflineVoucher = {
    version: 1,
    contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
    bookId: 10n,
    noteIndex: 2,
    amount: 15_000_000n,
    cap: 25_000_000n,
    acceptUntil: 1794500000n,
    merchant: "GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK",
    signature: "dummy_sig_hex",
  };

  beforeEach(async () => {
    await clearAllStoredVouchers();
  });

  it("generates predictable voucher record IDs from bookId and noteIndex", () => {
    expect(getVoucherRecordId(10n, 2)).toBe("10:2");
    expect(getVoucherRecordId("42", 0)).toBe("42:0");
  });

  it("checks voucher acceptance status accurately", async () => {
    expect(await isVoucherAlreadyAccepted(10n, 2)).toBe(false);

    await recordAcceptedVoucher(dummyVoucher, "raw_wire_payload_here");
    expect(await isVoucherAlreadyAccepted(10n, 2)).toBe(true);

    const record = await getVoucherRecord("10:2");
    expect(record).not.toBeNull();
    expect(record?.id).toBe("10:2");
    expect(record?.status).toBe("AcceptedOffline");
    expect(record?.rawWirePayload).toBe("raw_wire_payload_here");
    expect(record?.voucher.amount).toBe(15_000_000n);
  });

  it("throws when attempting to record an already accepted voucher", async () => {
    await recordAcceptedVoucher(dummyVoucher);
    await expect(recordAcceptedVoucher(dummyVoucher)).rejects.toThrow(
      "Cannot accept voucher: Book #10 Note #2 has already been accepted."
    );
  });

  it("lists all stored vouchers and clears them", async () => {
    await recordAcceptedVoucher(dummyVoucher);
    const voucher2: OfflineVoucher = {
      ...dummyVoucher,
      noteIndex: 3,
    };
    await recordAcceptedVoucher(voucher2);

    const all = await getAllStoredVouchers();
    expect(all.length).toBe(2);
    expect(all.map((v) => v.id)).toEqual(["10:2", "10:3"]);

    await clearAllStoredVouchers();
    const afterClear = await getAllStoredVouchers();
    expect(afterClear.length).toBe(0);
  });

  it("handles storage through IndexedDBReaderStorage class", async () => {
    const storage = new IndexedDBReaderStorage();
    await storage.saveVoucher({
      id: "99:1",
      voucher: dummyVoucher,
      receivedAt: 123456,
      status: "AcceptedOffline",
    });

    const retrieved = await storage.getVoucher("99:1");
    expect(retrieved?.id).toBe("99:1");

    const acceptedList = await storage.getVouchersByStatus("AcceptedOffline");
    expect(acceptedList.some((v) => v.id === "99:1")).toBe(true);

    await storage.updateVoucherStatus("99:1", "RedeemedOnChain", { txHash: "tx_abc123" });
    const updated = await storage.getVoucher("99:1");
    expect(updated?.status).toBe("RedeemedOnChain");
    expect(updated?.txHash).toBe("tx_abc123");
  });
});

