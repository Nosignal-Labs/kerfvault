import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  isRegistryStale,
  formatStalenessAge,
  getRegistryStalenessInfo,
  DEFAULT_STALE_THRESHOLD_MS,
} from "./lib/registryStaleness";
import { StaleRegistryBanner } from "./components/StaleRegistryBanner";

describe("Registry Staleness Detector and Warning Banner", () => {
  const baseNow = 1793860000000;

  it("identifies null or 0 timestamp as unsynced and stale", () => {
    expect(isRegistryStale(null, DEFAULT_STALE_THRESHOLD_MS, baseNow)).toBe(true);
    expect(isRegistryStale(undefined, DEFAULT_STALE_THRESHOLD_MS, baseNow)).toBe(true);
    expect(isRegistryStale(0, DEFAULT_STALE_THRESHOLD_MS, baseNow)).toBe(true);

    const info = getRegistryStalenessInfo(null, DEFAULT_STALE_THRESHOLD_MS, baseNow);
    expect(info.status).toBe("unsynced");
    expect(info.isStale).toBe(true);
    expect(info.formattedAge).toBe("Never synced");
  });

  it("considers snapshot under 24 hours as fresh", () => {
    const twoHoursAgo = baseNow - 2 * 60 * 60 * 1000;
    expect(isRegistryStale(twoHoursAgo, DEFAULT_STALE_THRESHOLD_MS, baseNow)).toBe(false);

    const info = getRegistryStalenessInfo(twoHoursAgo, DEFAULT_STALE_THRESHOLD_MS, baseNow);
    expect(info.status).toBe("fresh");
    expect(info.isStale).toBe(false);
    expect(info.formattedAge).toBe("2h ago");
  });

  it("considers snapshot older than 24 hours as stale", () => {
    const twentyFiveHoursAgo = baseNow - 25 * 60 * 60 * 1000;
    expect(isRegistryStale(twentyFiveHoursAgo, DEFAULT_STALE_THRESHOLD_MS, baseNow)).toBe(true);

    const info = getRegistryStalenessInfo(twentyFiveHoursAgo, DEFAULT_STALE_THRESHOLD_MS, baseNow);
    expect(info.status).toBe("stale");
    expect(info.isStale).toBe(true);
    expect(info.formattedAge).toBe("1d 1h ago");
  });

  it("formats staleness ages correctly across units", () => {
    expect(formatStalenessAge(baseNow - 45 * 1000, baseNow)).toBe("45s ago");
    expect(formatStalenessAge(baseNow - 15 * 60 * 1000, baseNow)).toBe("15m ago");
    expect(formatStalenessAge(baseNow - 5 * 3600 * 1000, baseNow)).toBe("5h ago");
    expect(formatStalenessAge(baseNow - (48 + 3) * 3600 * 1000, baseNow)).toBe("2d 3h ago");
  });

  it("renders null for fresh snapshots", () => {
    const recent = Date.now() - 60000;
    const html = renderToString(
      React.createElement(StaleRegistryBanner, { lastSyncedAt: recent })
    );
    expect(html).toBe("");
  });

  it("renders unsynced warning when snapshot is null", () => {
    const html = renderToString(
      React.createElement(StaleRegistryBanner, { lastSyncedAt: null })
    );
    expect(html).toContain("No Registry Snapshot Cached");
  });

  it("renders stale alert when snapshot exceeds 24 hours", () => {
    const staleTime = Date.now() - 30 * 3600 * 1000;
    const html = renderToString(
      React.createElement(StaleRegistryBanner, { lastSyncedAt: staleTime })
    );
    expect(html).toContain("Warning: Stale Registry Snapshot");
    expect(html).toContain("Snapshot is older than");
  });
});

