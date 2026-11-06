import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MerchantAddressQR } from "./components/MerchantAddressQR";

describe("MerchantAddressQR Component", () => {
  const testAddress = "GDELSDATL7W2JEDSUGSQUFP3YP36VPWM4V4C5TJLIY4LZMIMKGCSRNFG";

  it("renders the merchant address text and SVG QR code", () => {
    const html = renderToString(
      React.createElement(MerchantAddressQR, { address: testAddress })
    );

    // Check address text exists in rendered output
    expect(html).toContain(testAddress);

    // Check SVG QR code element exists
    expect(html).toContain("<svg");
    expect(html).toContain("Merchant Payee QR");
    expect(html).toContain("RECEIVE PAYMENTS");
  });

  it("renders with custom dimensions", () => {
    const html = renderToString(
      React.createElement(MerchantAddressQR, { address: testAddress, size: 250 })
    );

    expect(html).toContain(testAddress);
    expect(html).toContain("<svg");
  });
});
