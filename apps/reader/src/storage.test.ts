import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  saveRegistrySnapshot,
  getLatestRegistrySnapshot,
  clearRegistrySnapshot,
  IndexedDBReaderStorage,
} from "./lib/storage";
import type { RegistrySnapshot } from "@kerfvault/sdk";

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

