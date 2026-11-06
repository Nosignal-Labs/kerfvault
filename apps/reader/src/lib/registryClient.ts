import type { RegistrySnapshot } from "@kerfvault/sdk";

export const DEFAULT_INDEXER_URL =
  process.env.NEXT_PUBLIC_INDEXER_URL || "http://localhost:3001";

export class RegistryClientError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "RegistryClientError";
  }
}

/**
 * Validates the schema of an incoming registry snapshot.
 */
export function validateRegistrySnapshot(data: unknown): RegistrySnapshot {
  if (!data || typeof data !== "object") {
    throw new RegistryClientError("Invalid registry snapshot: payload must be an object.");
  }

  const s = data as Partial<RegistrySnapshot>;
  if (typeof s.version !== "number" || s.version < 1) {
    throw new RegistryClientError("Invalid registry snapshot: missing or invalid 'version'.");
  }
  if (typeof s.contractId !== "string" || !s.contractId) {
    throw new RegistryClientError("Invalid registry snapshot: missing or invalid 'contractId'.");
  }
  if (typeof s.ledgerSequence !== "number" || s.ledgerSequence < 0) {
    throw new RegistryClientError("Invalid registry snapshot: missing or invalid 'ledgerSequence'.");
  }
  if (typeof s.snapshotTimestamp !== "number" || s.snapshotTimestamp < 0) {
    throw new RegistryClientError("Invalid registry snapshot: missing or invalid 'snapshotTimestamp'.");
  }
  if (!s.books || typeof s.books !== "object") {
    throw new RegistryClientError("Invalid registry snapshot: missing or invalid 'books' mapping.");
  }

  return s as RegistrySnapshot;
}

/**
 * Fetches the point-in-time registry snapshot from the Kerfvault indexer service.
 */
export async function fetchRegistrySnapshot(
  options?: {
    indexerUrl?: string;
    timeoutMs?: number;
    fetchFn?: typeof fetch;
  }
): Promise<RegistrySnapshot> {
  const indexerUrl = (options?.indexerUrl || DEFAULT_INDEXER_URL).replace(/\/+$/, "");
  const fetcher = options?.fetchFn || globalThis.fetch;
  const timeoutMs = options?.timeoutMs || 10000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetcher(`${indexerUrl}/registry`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new RegistryClientError(
        `Indexer returned HTTP ${res.status}: ${errText || res.statusText}`,
        res.status
      );
    }

    const json = await res.json();
    return validateRegistrySnapshot(json);
  } catch (err: unknown) {
    if (err instanceof RegistryClientError) {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new RegistryClientError(`Registry snapshot fetch timed out after ${timeoutMs}ms.`);
    }
    const msg = err instanceof Error ? err.message : "Network error";
    throw new RegistryClientError(`Failed to fetch registry snapshot from indexer: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

