import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  PastePayloadInput,
  sanitizePastedPayload,
} from "./components/PastePayloadInput";

describe("PastePayloadInput Component & Sanitization", () => {
  describe("sanitizePastedPayload", () => {
    it("returns error for empty string or whitespace only", () => {
      const res1 = sanitizePastedPayload("");
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain("cannot be empty");

      const res2 = sanitizePastedPayload("   \n\t  ");
      expect(res2.valid).toBe(false);
      expect(res2.error).toBeDefined();
    });

    it("strips whitespace, newlines, and carriage returns from valid payloads", () => {
      const input = "  AQEB\nCg==\r\n ";
      const res = sanitizePastedPayload(input);
      expect(res.valid).toBe(true);
      expect(res.payload).toBe("AQEBCg==");
      expect(res.error).toBeUndefined();
    });

    it("preserves URL-safe base64 characters (- and _)", () => {
      const input = "AQE-_w==";
      const res = sanitizePastedPayload(input);
      expect(res.valid).toBe(true);
      expect(res.payload).toBe("AQE-_w==");
    });
  });

  describe("PastePayloadInput Component Rendering", () => {
    it("renders textarea, submit button, and clear button", () => {
      const handleSubmit = vi.fn();
      const html = renderToString(
        React.createElement(PastePayloadInput, { onSubmit: handleSubmit })
      );

      expect(html).toContain("voucher-payload-input");
      expect(html).toContain("Pasted Voucher Payload");
      expect(html).toContain("Desktop / Manual Entry");
      expect(html).toContain("Submit Voucher Payload");
      expect(html).toContain("Clear");
    });

    it("renders disabled state while loading", () => {
      const html = renderToString(
        React.createElement(PastePayloadInput, {
          onSubmit: vi.fn(),
          isLoading: true,
        })
      );

      expect(html).toContain("Processing...");
      expect(html).toContain("disabled");
    });
  });
});
