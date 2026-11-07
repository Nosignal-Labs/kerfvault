import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import HowItWorksPage from "./app/how-it-works/page";

describe("Shopper App - How It Works Page", () => {
  it("renders the plain language guide and all 4 lifecycle steps", () => {
    const html = renderToString(React.createElement(HowItWorksPage));

    expect(html).toContain("How KerfVault Shopper Works");
    expect(html).toContain("DEMO GUIDE");
    expect(html).toContain("Open a Voucher Book (Online)");
    expect(html).toContain("Disconnect &amp; Go Offline");
    expect(html).toContain("Create an Offline Voucher");
    expect(html).toContain("Merchant Scans the QR Code");
    expect(html).toContain("href=\"/books/new\"");
    expect(html).toContain("href=\"/pay\"");
  });
});

