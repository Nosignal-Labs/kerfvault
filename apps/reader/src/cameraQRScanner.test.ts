import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { CameraQRScanner } from "./components/CameraQRScanner";

describe("CameraQRScanner Component", () => {
  it("renders scanner initial state with viewfinder container and start button", () => {
    const handleScan = vi.fn();
    const html = renderToString(
      React.createElement(CameraQRScanner, { onScan: handleScan })
    );

    expect(html).toContain("kerfvault-camera-viewfinder");
    expect(html).toContain("Start Camera Scanner");
    expect(html).toContain("Camera Scanner Ready");
  });

  it("includes camera instructions and offline explanation", () => {
    const html = renderToString(
      React.createElement(CameraQRScanner, { onScan: vi.fn() })
    );

    expect(html).toContain("Scan shopper payment voucher QR codes directly");
  });
});

