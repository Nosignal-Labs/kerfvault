import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import LimitationsPage from "./app/limitations/page";
import { KnownLimitations, LIMITATION_ITEMS } from "./components/KnownLimitations";

describe("Shopper App - Known Limitations Display", () => {
  it("renders the Known Limitations page with all scope disclosures", () => {
    const html = renderToString(React.createElement(LimitationsPage));

    expect(html).toContain("Known Limitations");
    expect(html).toContain("TRANSPARENCY");
    expect(html).toContain("Testnet Prototype Only");
    expect(html).toContain("Unaudited Contracts &amp; Protocols");
    expect(html).toContain("Fixed Denominations Per Book");
    expect(html).toContain("Reclaim &amp; Clawback Deferred");
    expect(html).toContain("Local Browser Storage");
    expect(html).toContain("Gas Sponsored via Relay");
    expect(html).toContain("href=\"/how-it-works\"");
  });

  it("exports all limitation items with badges and descriptions", () => {
    expect(LIMITATION_ITEMS.length).toBeGreaterThanOrEqual(6);
    for (const item of LIMITATION_ITEMS) {
      expect(item.title).toBeTruthy();
      expect(item.badge).toBeTruthy();
      expect(item.description).toBeTruthy();
    }
  });
});

