import { describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { Keypair, Account, rpc } from "@stellar/stellar-sdk";
import {
  signVoucher,
  verifyVoucher,
  type SignVoucherParams,
} from "@kerfvault/sdk";
import { submitRedeemTransaction } from "./submit.js";
import { handleRequest, type RelayServerConfig } from "./index.js";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";

function mockReqRes(
  method: string,
  url: string,
  payload?: object | string,
  options?: { config?: RelayServerConfig }
) {
  const req = Object.assign(new EventEmitter(), {
    url,
    method,
    headers: {},
    socket: {
      remoteAddress: `127.0.0.${Math.floor(Math.random() * 200) + 10}`,
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
        if (h) {
          for (const [k, v] of Object.entries(h)) {
            headers[k.toLowerCase()] = v;
          }
        }
      },
      end(chunk: string) {
        body = chunk;
        resolve({ status: statusCode, headers, body });
      },
    } as unknown as ServerResponse;

    void handleRequest(req, res, options?.config);

    if (payload) {
      req.emit("data", Buffer.from(JSON.stringify(payload)));
    }
    req.emit("end");
  });

  return resPromise;
}

describe("Security: Merchant Address Redirection & Tamper Resistance", () => {
  const contractId = "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE";
  const voucherSeed = crypto.randomBytes(32);
  const voucherKeypair = Keypair.fromRawEd25519Seed(voucherSeed);
  const legitimateMerchant = Keypair.random();
  const attackerMerchant = Keypair.random();
  const relayFeeKeypair = Keypair.random();

  const futureDeadline = BigInt(Math.floor(Date.now() / 1000) + 86400 * 30);

  const baseVoucherParams: SignVoucherParams = {
    contractId,
    bookId: 101n,
    noteIndex: 0,
    merchant: legitimateMerchant.publicKey(),
    amount: 5_000_000n,
    cap: 10_000_000n,
    acceptUntil: futureDeadline,
    voucherSecretKey: voucherSeed,
  };

  it("fails signature verification when merchant address is altered", async () => {
    // 1. Legitimate shopper generates valid voucher signed for legitimate merchant
    const validVoucher = await signVoucher(baseVoucherParams);

    // Verify legitimate voucher signature is valid
    const legitimateVerification = await verifyVoucher(validVoucher, {
      expectedContractId: contractId,
      merchantAddress: legitimateMerchant.publicKey(),
      voucherKey: voucherKeypair.publicKey(),
    });
    expect(legitimateVerification.valid).toBe(true);

    // 2. Attacker intercepts and replaces merchant address with attacker's address
    const tamperedVoucher = {
      ...validVoucher,
      merchant: attackerMerchant.publicKey(),
    };

    // Verification must fail because merchant is cryptographically bound into the signed payload
    const tamperedVerification = await verifyVoucher(tamperedVoucher, {
      expectedContractId: contractId,
      voucherKey: voucherKeypair.publicKey(),
    });
    expect(tamperedVerification.valid).toBe(false);
    expect(tamperedVerification.reason).toBe("InvalidSignature");

    // Also fails if merchantAddress expectation is checked
    const merchantMismatchVerification = await verifyVoucher(tamperedVoucher, {
      expectedContractId: contractId,
      merchantAddress: legitimateMerchant.publicKey(),
      voucherKey: voucherKeypair.publicKey(),
    });
    expect(merchantMismatchVerification.valid).toBe(false);
    expect(merchantMismatchVerification.reason).toBe("MerchantMismatch");
  });

  it("causes Soroban simulation to reject tampered merchant redemption in the relay", async () => {
    const validVoucher = await signVoucher(baseVoucherParams);

    // Attacker submits tampered merchant address to relay submitRedeemTransaction
    const tamperedRequestBody = {
      bookId: 101,
      noteIndex: 0,
      merchant: attackerMerchant.publicKey(), // Tampered!
      amount: "5000000",
      cap: "10000000",
      acceptUntil: Number(futureDeadline),
      signature: validVoucher.signature,
    };

    // Mock RPC server simulating Soroban smart contract host error on signature mismatch
    const mockRpcServer = {
      getAccount: vi.fn().mockResolvedValue(new Account(relayFeeKeypair.publicKey(), "100")),
      prepareTransaction: vi.fn().mockImplementation(() => {
        // Contract reverts with host error: Ed25519 signature does not verify against tampered merchant payload
        const simError = new Error(
          "Transaction simulation failed: HostError: Error(Contract, #2) - BadSignature: voucher signature mismatch"
        );
        return Promise.reject(simError);
      }),
      sendTransaction: vi.fn(),
    } as unknown as rpc.Server;

    const config: RelayServerConfig = {
      contractId,
      relaySecret: relayFeeKeypair.secret(),
      server: mockRpcServer,
    };

    // Attempting to submit tampered voucher must throw simulation error and never submit
    await expect(submitRedeemTransaction(tamperedRequestBody, config)).rejects.toThrow(
      "Transaction simulation failed: HostError"
    );

    // Ensure sendTransaction was NEVER invoked (no funds redirected on chain)
    expect(mockRpcServer.sendTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 Bad Request over HTTP POST /redeem when merchant tampering is attempted", async () => {
    const validVoucher = await signVoucher(baseVoucherParams);

    const tamperedPayload = {
      bookId: 101,
      noteIndex: 0,
      merchant: attackerMerchant.publicKey(), // Tampered recipient
      amount: "5000000",
      cap: "10000000",
      acceptUntil: Number(futureDeadline),
      signature: validVoucher.signature,
    };

    const mockRpcServer = {
      getAccount: vi.fn().mockResolvedValue(new Account(relayFeeKeypair.publicKey(), "100")),
      prepareTransaction: vi.fn().mockRejectedValue(
        new Error("HostError: Error(Contract, #2) - ed25519_verify failed")
      ),
      sendTransaction: vi.fn(),
    } as unknown as rpc.Server;

    const config: RelayServerConfig = {
      contractId,
      relaySecret: relayFeeKeypair.secret(),
      server: mockRpcServer,
    };

    const res = await mockReqRes("POST", "/redeem", tamperedPayload, { config });

    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.error).toBe("Redemption transaction failed");
    expect(json.details).toContain("ed25519_verify failed");
    expect(mockRpcServer.sendTransaction).not.toHaveBeenCalled();
  });
});
