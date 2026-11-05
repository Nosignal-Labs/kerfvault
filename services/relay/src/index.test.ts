import { describe, expect, it, vi } from "vitest";
import { Account, Keypair, rpc } from "@stellar/stellar-sdk";
import {
  handleRequest,
  MAX_PAYLOAD_BYTES,
  type RelayServerConfig,
} from "./index.js";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";

function mockReqRes(
  method: string,
  url: string,
  payload?: object | string,
  options?: { rawString?: boolean; config?: RelayServerConfig; remoteIp?: string }
) {
  const req = Object.assign(new EventEmitter(), {
    url,
    method,
    socket: {
      remoteAddress: options?.remoteIp ?? `127.0.0.${Math.floor(Math.random() * 200) + 10}`,
    },
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
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value;
      },
      writeHead(code: number, h?: Record<string, string>) {
        statusCode = code;
        if (h) Object.assign(headers, h);
      },
      end(chunk: string) {
        body = chunk;
        resolve({ status: statusCode, headers, body });
      },
    } as unknown as ServerResponse;

    void handleRequest(req, res, options?.config);

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

const VALID_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

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
    expect(res.headers["x-ratelimit-limit"]).toBeDefined();
  });

  it("throttles callers exceeding per-IP limit with 429 and Retry-After header", async () => {
    const dedicatedIp = "192.168.10.99";
    const testKeypair = Keypair.random();
    const mockServer = {
      getAccount: vi.fn().mockResolvedValue(new Account(testKeypair.publicKey(), "100")),
      prepareTransaction: vi.fn().mockImplementation((tx) => Promise.resolve(tx)),
      sendTransaction: vi.fn().mockResolvedValue({
        status: "PENDING",
        hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      }),
    } as unknown as rpc.Server;

    const opts = {
      remoteIp: dedicatedIp,
      config: {
        relaySecret: testKeypair.secret(),
        server: mockServer,
      },
    };

    // Burn through allowance
    for (let i = 0; i < 10; i++) {
      const res = await mockReqRes("POST", "/redeem", VALID_REDEEM_PAYLOAD, opts);
      expect(res.status).toBe(200);
    }

    // 11th request must be throttled with 429
    const throttled = await mockReqRes("POST", "/redeem", VALID_REDEEM_PAYLOAD, opts);
    expect(throttled.status).toBe(429);
    const json = JSON.parse(throttled.body);
    expect(json.error).toContain("Rate limit exceeded");
    expect(throttled.headers["retry-after"]).toBeDefined();
  });

  it("looks up redemption status via GET /redeem/:hash", async () => {
    const mockServer = {
      getTransaction: vi.fn().mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
        latestLedger: 998877,
        createdAt: 1720000000,
      }),
    } as unknown as rpc.Server;

    const res = await mockReqRes("GET", `/redeem/${VALID_HASH}`, undefined, {
      config: {
        server: mockServer,
      },
    });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe("success");
    expect(json.hash).toBe(VALID_HASH);
    expect(json.ledger).toBe(998877);
  });

  it("rejects invalid hash format in GET /redeem/:hash with 400", async () => {
    const res = await mockReqRes("GET", "/redeem/not-a-valid-hash");
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.error).toContain("Invalid transaction hash");
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

  describe("Demo Faucet Endpoint", () => {
    const testAddr = "GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK";

    it("returns 404 when DEMO_MODE is not enabled", async () => {
      const res = await mockReqRes("POST", "/demo/faucet", { address: testAddr }, {
        config: { demoMode: false },
      });
      expect(res.status).toBe(404);
      const json = JSON.parse(res.body);
      expect(json.error).toContain("disabled");
    });

    it("funds account when DEMO_MODE is enabled", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      });

      const res = await mockReqRes(
        "POST",
        "/demo/faucet",
        { address: testAddr },
        {
          config: {
            demoMode: true,
            fetchFn: mockFetch as unknown as typeof fetch,
          },
        }
      );

      expect(res.status).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.address).toBe(testAddr);
    });

    it("rejects invalid address with 400", async () => {
      const res = await mockReqRes(
        "POST",
        "/demo/faucet",
        { address: "invalid-stellar-key" },
        {
          config: { demoMode: true },
        }
      );
      expect(res.status).toBe(400);
    });
  });
});
