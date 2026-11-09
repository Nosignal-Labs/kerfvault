import { describe, it, expect, vi } from "vitest";
import {
  fetchRegistrySnapshot,
  validateRegistrySnapshot,
  RegistryClientError,
  DEFAULT_INDEXER_URL,
} from "./lib/registryClient";
import type { RegistrySnapshot } from "@kerfvault/sdk";

describe("Registry Client (Snapshot Fetcher)", () => {
  it("defaults to port 4001 when NEXT_PUBLIC_INDEXER_URL is unset", () => {
    expect(DEFAULT_INDEXER_URL).toBe("http://localhost:4001");
  });
  const sampleSnapshot: RegistrySnapshot = {
    version: 1,
    contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
    ledgerSequence: 15420,
    snapshotTimestamp: 1793860000,
    books: {
      "1": {
        bookId: "1",
        owner: "GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK",
        token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        voucherKey: "67980208cb1bf0a5cf571efc5cf8c4ccf7547eb2ea61ffdc59868e42dbd8ad64",
        redeemDeadline: "1794000000",
        freeBalance: "50000000",
        notes: [
          {
            index: 0,
            denomination: "100000000",
            status: "Open",
          },
          {
            index: 1,
            denomination: "50000000",
            status: "Open",
          },
        ],
      },
    },
  };

  it("fetches and validates snapshot successfully via GET /registry", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleSnapshot,
    });

    const result = await fetchRegistrySnapshot({
      indexerUrl: "http://mock-indexer:3001",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result).toEqual(sampleSnapshot);
    expect(result.contractId).toBe("CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE");
    expect(result.ledgerSequence).toBe(15420);
    expect(result.books["1"].notes).toHaveLength(2);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://mock-indexer:3001/registry",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("validates valid snapshot object", () => {
    const validated = validateRegistrySnapshot(sampleSnapshot);
    expect(validated.version).toBe(1);
    expect(validated.ledgerSequence).toBe(15420);
  });

  it("rejects non-object or null snapshots", () => {
    expect(() => validateRegistrySnapshot(null)).toThrow(RegistryClientError);
    expect(() => validateRegistrySnapshot("string")).toThrow(RegistryClientError);
  });

  it("rejects snapshots with missing contractId or version", () => {
    const invalid = { ...sampleSnapshot, contractId: "" };
    expect(() => validateRegistrySnapshot(invalid)).toThrow(/contractId/i);

    const missingVersion = { ...sampleSnapshot, version: 0 };
    expect(() => validateRegistrySnapshot(missingVersion)).toThrow(/version/i);
  });

  it("rejects snapshots with invalid books mapping", () => {
    const invalidBooks = { ...sampleSnapshot, books: null };
    expect(() => validateRegistrySnapshot(invalidBooks)).toThrow(/books/i);
  });

  it("handles indexer HTTP errors", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "Indexer sync in progress",
    });

    await expect(
      fetchRegistrySnapshot({
        indexerUrl: "http://mock-indexer:3001",
        fetchFn: mockFetch as unknown as typeof fetch,
      })
    ).rejects.toThrow(/HTTP 503/i);
  });

  it("handles network failures gracefully", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

    await expect(
      fetchRegistrySnapshot({
        indexerUrl: "http://offline-host:3001",
        fetchFn: mockFetch as unknown as typeof fetch,
      })
    ).rejects.toThrow(/Failed to fetch registry snapshot/i);
  });
});

