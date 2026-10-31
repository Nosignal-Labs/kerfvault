import { describe, expect, it } from "vitest";
import { handleRequest } from "./index.js";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";

describe("Indexer Service Smoke Test", () => {
  it("responds 200 ok to GET /health", async () => {
    const req = Object.assign(new EventEmitter(), {
      url: "/health",
      method: "GET",
    }) as unknown as IncomingMessage;

    let statusCode = 0;
    let headers: Record<string, string> = {};
    let body = "";

    const res = {
      writeHead(code: number, h: Record<string, string>) {
        statusCode = code;
        headers = h;
      },
      end(chunk: string) {
        body = chunk;
      },
    } as unknown as ServerResponse;

    handleRequest(req, res);

    expect(statusCode).toBe(200);
    expect(headers["Content-Type"]).toBe("application/json");
    const json = JSON.parse(body);
    expect(json.status).toBe("ok");
  });

  it("responds with snapshot to GET /registry", async () => {
    const req = Object.assign(new EventEmitter(), {
      url: "/registry",
      method: "GET",
    }) as unknown as IncomingMessage;

    let statusCode = 0;
    let body = "";

    const res = {
      writeHead(code: number) {
        statusCode = code;
      },
      end(chunk: string) {
        body = chunk;
      },
    } as unknown as ServerResponse;

    handleRequest(req, res);

    expect(statusCode).toBe(200);
    const snapshot = JSON.parse(body);
    expect(snapshot.version).toBe(1);
    expect(snapshot.books["101"]).toBeDefined();
  });
});

