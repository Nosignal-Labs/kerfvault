import { describe, expect, it, vi } from "vitest";
import { rpc } from "@stellar/stellar-sdk";
import { getRedemptionStatus, type RelayStatusConfig } from "./status.js";

const VALID_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("Relay Status Lookup (GET /redeem/:hash)", () => {
  it("returns status success when transaction is confirmed by RPC", async () => {
    const mockServer = {
      getTransaction: vi.fn().mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
        latestLedger: 54321,
        createdAt: 1710000000,
      }),
    } as unknown as rpc.Server;

    const res = await getRedemptionStatus(VALID_HASH, { server: mockServer });

    expect(res.status).toBe("success");
    if (res.status === "success") {
      expect(res.hash).toBe(VALID_HASH);
      expect(res.ledger).toBe(54321);
      expect(res.createdAt).toBe(1710000000);
    }
    expect(mockServer.getTransaction).toHaveBeenCalledWith(VALID_HASH);
  });

  it("returns status pending when transaction is NOT_FOUND on RPC", async () => {
    const mockServer = {
      getTransaction: vi.fn().mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.NOT_FOUND,
      }),
    } as unknown as rpc.Server;

    const res = await getRedemptionStatus(VALID_HASH, { server: mockServer });

    expect(res.status).toBe("pending");
    if (res.status === "pending") {
      expect(res.hash).toBe(VALID_HASH);
      expect(res.message).toContain("pending");
    }
  });

  it("returns status failed when transaction execution failed on-chain", async () => {
    const mockServer = {
      getTransaction: vi.fn().mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.FAILED,
        resultXdr: {
          toXDR: () => "AAAA...",
        },
      }),
    } as unknown as rpc.Server;

    const res = await getRedemptionStatus(VALID_HASH, { server: mockServer });

    expect(res.status).toBe("failed");
    if (res.status === "failed") {
      expect(res.hash).toBe(VALID_HASH);
      expect(res.error).toBeDefined();
    }
  });

  it("throws validation error when hash format is invalid", async () => {
    const mockServer = {
      getTransaction: vi.fn(),
    } as unknown as rpc.Server;

    await expect(
      getRedemptionStatus("not-a-valid-hex-hash", { server: mockServer })
    ).rejects.toThrow(/not a valid 64-character hex string/);

    expect(mockServer.getTransaction).not.toHaveBeenCalled();
  });
});
