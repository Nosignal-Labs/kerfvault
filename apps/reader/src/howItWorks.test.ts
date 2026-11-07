import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import HowItWorksPage from "./app/how-it-works/page";

describe("Reader App - How It Works Page", () => {
  it("renders the merchant terminal guide and all 4 lifecycle steps", () => {
    const html = renderToString(React.createElement(HowItWorksPage));

    expect(html).toContain("How KerfVault Reader Works");
    expect(html).toContain("DEMO GUIDE");
    expect(html).toContain("Sync On-Chain Registry (While Online)");
    expect(html).toContain("Scan Customer Vouchers Completely Offline");
    expect(html).toContain("Instant Cryptographic Validation");
    expect(html).toContain("On-Chain Batch Redemption (When Reconnected)");
    expect(html).toContain("Ed25519 cryptographic signature");
    expect(html).toContain("href=\"/scan\"");
    expect(html).toContain("href=\"/accepted\"");
  });
});

