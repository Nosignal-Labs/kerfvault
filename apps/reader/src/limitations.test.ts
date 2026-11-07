import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import LimitationsPage from "./app/limitations/page";
import { KnownLimitations, READER_LIMITATION_ITEMS } from "./components/KnownLimitations";

describe("Reader App - Known Limitations Display", () => {
  it("renders the Known Limitations page with merchant terminal disclosures", () => {
    const html = renderToString(React.createElement(LimitationsPage));

    expect(html).toContain("Known Limitations");
    expect(html).toContain("TRANSPARENCY");
    expect(html).toContain("Testnet Prototype Only");
    expect(html).toContain("Unaudited Contracts &amp; Protocols");
    expect(html).toContain("Merchant Acceptance Caps");
    expect(html).toContain("Local Replay Protection");
    expect(html).toContain("Relay Settlement Dependency");
    expect(html).toContain("Browser Storage Persistence");
    expect(html).toContain("href=\"/how-it-works\"");
  });

  it("exports all reader limitation items with badges and descriptions", () => {
    expect(READER_LIMITATION_ITEMS.length).toBeGreaterThanOrEqual(6);
    for (const item of READER_LIMITATION_ITEMS) {
      expect(item.title).toBeTruthy();
      expect(item.badge).toBeTruthy();
      expect(item.description).toBeTruthy();
    }
  });
});

