import { describe, expect, it } from "vitest";
import { handleRequest } from "./index.js";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";

function mockReqRes(method: string, url: string, payload?: object) {
  const req = Object.assign(new EventEmitter(), {
    url,
    method,
    socket: { remoteAddress: "127.0.0.1" },
  }) as unknown as IncomingMessage;

  let statusCode = 0;
  let headers: Record<string, string> = {};
  let body = "";

  const resPromise = new Promise<{ status: number; headers: Record<string, string>; body: string }>(
    (resolve) => {
      const res = {
        writeHead(code: number, h: Record<string, string>) {
          statusCode = code;
          headers = h;
        },
        end(chunk: string) {
          body = chunk;
          resolve({ status: statusCode, headers, body });
        },
      } as unknown as ServerResponse;

      handleRequest(req, res);

      if (payload) {
        req.emit("data", Buffer.from(JSON.stringify(payload)));
      }
      req.emit("end");
    }
  );

  return resPromise;
}

describe("Relay Service Smoke Test", () => {
  it("responds 200 ok to GET /health", async () => {
    const res = await mockReqRes("GET", "/health");
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe("ok");
  });

  it("responds 400 on invalid POST /redeem body", async () => {
    const res = await mockReqRes("POST", "/redeem", { invalid: "payload" });
    expect(res.status).toBe(400);
  });

  it("responds 501 Not Implemented on valid POST /redeem body shape", async () => {
    const validBody = {
      bookId: 101,
      noteIndex: 0,
      merchant: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
      amount: "10000000",
      cap: "10000000",
      acceptUntil: 1793404800,
      signature: "PLACEHOLDER_ED25519_SIGNATURE_HEX_OR_BASE64_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    };

    const res = await mockReqRes("POST", "/redeem", validBody);
    expect(res.status).toBe(501);
    const json = JSON.parse(res.body);
    expect(json.status).toBe("Not Implemented");
  });
});

