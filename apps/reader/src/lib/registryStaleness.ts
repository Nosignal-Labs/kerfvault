export const DEFAULT_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export type RegistryFreshnessStatus = "fresh" | "stale" | "unsynced";

export interface RegistryStalenessInfo {
  status: RegistryFreshnessStatus;
  isStale: boolean;
  isUnsynced: boolean;
  ageMs: number;
  formattedAge: string;
  thresholdHours: number;
}

/**
 * Checks whether a registry snapshot timestamp exceeds the maximum staleness threshold.
 */
export function isRegistryStale(
  lastSyncedAt: number | null | undefined,
  thresholdMs = DEFAULT_STALE_THRESHOLD_MS,
  now = Date.now()
): boolean {
  if (!lastSyncedAt || lastSyncedAt <= 0) return true;
  return now - lastSyncedAt >= thresholdMs;
}

/**
 * Returns a human-readable description of how long ago the snapshot was synced.
 */
export function formatStalenessAge(lastSyncedAt: number, now = Date.now()): string {
  const diffMs = Math.max(0, now - lastSyncedAt);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return `${diffDays}d ${diffHours % 24}h ago`;
}

/**
 * Evaluates registry snapshot age and returns full freshness metadata.
 */
export function getRegistryStalenessInfo(
  lastSyncedAt: number | null | undefined,
  thresholdMs = DEFAULT_STALE_THRESHOLD_MS,
  now = Date.now()
): RegistryStalenessInfo {
  const thresholdHours = Math.round(thresholdMs / (60 * 60 * 1000));

  if (!lastSyncedAt || lastSyncedAt <= 0) {
    return {
      status: "unsynced",
      isStale: true,
      isUnsynced: true,
      ageMs: Infinity,
      formattedAge: "Never synced",
      thresholdHours,
    };
  }

  const ageMs = Math.max(0, now - lastSyncedAt);
  const stale = ageMs >= thresholdMs;

  return {
    status: stale ? "stale" : "fresh",
    isStale: stale,
    isUnsynced: false,
    ageMs,
    formattedAge: formatStalenessAge(lastSyncedAt, now),
    thresholdHours,
  };
}

