import { describe, expect, it, vi } from "vitest";
import { Account, Keypair, type rpc } from "@stellar/stellar-sdk";
import { handleRequest, MAX_PAYLOAD_BYTES, type SubmitRedeemConfig } from "./index.js";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";

function mockReqRes(
  method: string,
  url: string,
  payload?: object | string,
  options?: { rawString?: boolean; config?: SubmitRedeemConfig }
) {
  const req = Object.assign(new EventEmitter(), {
    url,
    method,
    socket: { remoteAddress: `127.0.0.${Math.floor(Math.random() * 200) + 10}` },
    destroy: vi.fn(),
  }) as unknown as IncomingMessage;

  let statusCode = 0;
  let headers: Record<string, string> = {};
  let body = "";

  const resPromise = new Promise<{
    status: number;
    headers: Record<string, string>;
    body: string;
  }>((resolve) => {
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

    handleRequest(req, res, options?.config);

    if (payload) {
      const dataStr = options?.rawString ? (payload as string) : JSON.stringify(payload);
      req.emit("data", Buffer.from(dataStr));
    }
    req.emit("end");
  });

  return resPromise;
}

const VALID_REDEEM_PAYLOAD = {
  bookId: 101,
  noteIndex: 0,
  merchant: "GDELSDATL7W2JEDSUGSQUFP3YP36VPWM4V4C5TJLIY4LZMIMKGCSRNFG",
  amount: "7000000",
  cap: "10000000",
  acceptUntil: 1793404800,
  signature:
    "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
};

describe("Relay Request Validation & Payload Caps", () => {
  it("responds 200 ok to GET /health", async () => {
    const res = await mockReqRes("GET", "/health");
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe("ok");
  });

  it("accepts valid structured redeem payload and submits transaction", async () => {
    const testKeypair = Keypair.random();
    const mockServer = {
      getAccount: vi.fn().mockResolvedValue(new Account(testKeypair.publicKey(), "100")),
      prepareTransaction: vi.fn().mockImplementation((tx) => Promise.resolve(tx)),
      sendTransaction: vi.fn().mockResolvedValue({
        status: "PENDING",
        hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      }),
    } as unknown as rpc.Server;

    const res = await mockReqRes("POST", "/redeem", VALID_REDEEM_PAYLOAD, {
      config: {
        relaySecret: testKeypair.secret(),
        server: mockServer,
      },
    });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe("success");
    expect(json.txHash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("rejects oversized request payload exceeding 16KB with 413", async () => {
    const hugePayload = "x".repeat(MAX_PAYLOAD_BYTES + 100);
    const res = await mockReqRes("POST", "/redeem", hugePayload, { rawString: true });
    expect(res.status).toBe(413);
    const json = JSON.parse(res.body);
    expect(json.error).toContain("Payload Too Large");
  });

  it("rejects amount exceeding cap", async () => {
    const invalid = {
      ...VALID_REDEEM_PAYLOAD,
      amount: "15000000",
      cap: "10000000",
    };
    const res = await mockReqRes("POST", "/redeem", invalid);
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.issues.some((i: any) => i.message.includes("cannot exceed signed cap"))).toBe(true);
  });

  it("rejects invalid merchant address format", async () => {
    const invalid = {
      ...VALID_REDEEM_PAYLOAD,
      merchant: "INVALID_MERCHANT_ADDRESS",
    };
    const res = await mockReqRes("POST", "/redeem", invalid);
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.issues.some((i: any) => i.path.includes("merchant"))).toBe(true);
  });

  it("rejects raw transaction XDR submissions or unrecognized fields", async () => {
    const rawXdrSubmission = {
      ...VALID_REDEEM_PAYLOAD,
      rawTransactionXdr: "AAAAAGX/...",
    };
    const res = await mockReqRes("POST", "/redeem", rawXdrSubmission);
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.error).toBe("Invalid request payload");
  });

  it("rejects malformed signature length", async () => {
    const invalid = {
      ...VALID_REDEEM_PAYLOAD,
      signature: "toolshort",
    };
    const res = await mockReqRes("POST", "/redeem", invalid);
    expect(res.status).toBe(400);
  });
});
