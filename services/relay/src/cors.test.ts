import { describe, it, expect, vi } from "vitest";
import {
  handleCors,
  parseAllowedOrigins,
  DEFAULT_ALLOWED_ORIGINS,
} from "./cors.js";
import type { IncomingMessage, ServerResponse } from "node:http";

function mockReq(method: string, origin?: string): IncomingMessage {
  return {
    method,
    headers: origin ? { origin } : {},
  } as unknown as IncomingMessage;
}

function mockRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body = "";

  const res = {
    setHeader: vi.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    }),
    writeHead: vi.fn((code: number, h?: Record<string, string>) => {
      statusCode = code;
      if (h) {
        for (const [k, v] of Object.entries(h)) {
          headers[k.toLowerCase()] = v;
        }
      }
    }),
    end: vi.fn((chunk?: string) => {
      if (chunk) body = chunk;
    }),
  } as unknown as ServerResponse;

  return { res, headers, getStatus: () => statusCode, getBody: () => body };
}

describe("CORS handling in Relay", () => {
  it("defaults to localhost:3000 and localhost:3001", () => {
    expect(parseAllowedOrigins()).toEqual(DEFAULT_ALLOWED_ORIGINS);
    expect(parseAllowedOrigins("")).toEqual(DEFAULT_ALLOWED_ORIGINS);
    expect(parseAllowedOrigins("https://app.kerfvault.com, https://reader.kerfvault.com/")).toEqual([
      "https://app.kerfvault.com",
      "https://reader.kerfvault.com",
    ]);
  });

  it("passes through requests without Origin header", () => {
    const req = mockReq("GET");
    const { res, headers } = mockRes();
    const handled = handleCors(req, res);
    expect(handled).toBe(false);
    expect(Object.keys(headers).length).toBe(0);
  });

  it("sets CORS headers for allowed origins on GET/POST", () => {
    const req = mockReq("POST", "http://localhost:3000");
    const { res, headers } = mockRes();
    const handled = handleCors(req, res);
    expect(handled).toBe(false);
    expect(headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(headers["access-control-allow-methods"]).toBe("GET, POST, OPTIONS");
    expect(headers["access-control-allow-headers"]).toContain("Content-Type");
    expect(headers["vary"]).toBe("Origin");
  });

  it("handles OPTIONS preflight for allowed origin with 204", () => {
    const req = mockReq("OPTIONS", "http://localhost:3001");
    const { res, headers, getStatus } = mockRes();
    const handled = handleCors(req, res);
    expect(handled).toBe(true);
    expect(getStatus()).toBe(204);
    expect(headers["access-control-allow-origin"]).toBe("http://localhost:3001");
  });

  it("rejects unauthorized origin with 403 Forbidden", () => {
    const req = mockReq("GET", "https://malicious-site.com");
    const { res, headers, getStatus, getBody } = mockRes();
    const handled = handleCors(req, res);
    expect(handled).toBe(true);
    expect(getStatus()).toBe(403);
    expect(headers["access-control-allow-origin"]).toBeUndefined();
    expect(getBody()).toContain("Forbidden: Origin not allowed");
  });

  it("respects custom allowedOrigins option", () => {
    const req = mockReq("GET", "https://shopper.kerfvault.org");
    const { res, headers } = mockRes();
    const handled = handleCors(req, res, {
      allowedOrigins: ["https://shopper.kerfvault.org"],
    });
    expect(handled).toBe(false);
    expect(headers["access-control-allow-origin"]).toBe("https://shopper.kerfvault.org");
  });
});
