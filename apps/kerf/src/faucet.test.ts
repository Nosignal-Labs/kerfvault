import { describe, it, expect, vi } from "vitest";
import {
  requestFaucetFunding,
  fetchAccountBalance,
  getDefaultRelayUrl,
} from "./lib/faucet";

describe("Shopper Demo Faucet & Balance Client", () => {
  const testAddress = "GBABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF123";

  it("provides default relay URL", () => {
    const url = getDefaultRelayUrl();
    expect(url).toBeDefined();
    expect(url).toMatch(/^https?:\/\//);
  });

  describe("requestFaucetFunding", () => {
    it("successfully funds via relay POST /demo/faucet", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          address: testAddress,
          message: "Funded successfully via Friendbot",
        }),
      });

      const res = await requestFaucetFunding(testAddress, {
        relayUrl: "http://localhost:3002",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(res.success).toBe(true);
      expect(res.address).toBe(testAddress);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3002/demo/faucet",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: testAddress }),
        })
      );
    });

    it("falls back to friendbot if relay returns 404", async () => {
      const mockFetch = vi
        .fn()
        // First call to relay returns 404
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: async () => "Not Found",
        })
        // Second call to Friendbot succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => "{}",
        });

      const res = await requestFaucetFunding(testAddress, {
        relayUrl: "http://localhost:3002",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(res.success).toBe(true);
      expect(res.message).toMatch(/Friendbot/i);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1][0]).toContain("friendbot.stellar.org");
    });

    it("falls back to friendbot if relay network fetch throws", async () => {
      const mockFetch = vi
        .fn()
        // First call throws NetworkError
        .mockRejectedValueOnce(new Error("Connection refused: ECONNREFUSED"))
        // Second call to Friendbot succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => "{}",
        });

      const res = await requestFaucetFunding(testAddress, {
        relayUrl: "http://localhost:3002",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(res.success).toBe(true);
      expect(res.message).toMatch(/Friendbot/i);
    });
  });

  describe("fetchAccountBalance", () => {
    it("returns null for unfunded accounts (404)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Account not found",
      });

      const bal = await fetchAccountBalance(testAddress, {
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(bal).toBeNull();
    });

    it("returns native XLM balance when account exists", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          balances: [
            { asset_type: "native", balance: "10000.0000000" },
            { asset_type: "credit_alphanum4", balance: "50.0000000" },
          ],
        }),
      });

      const bal = await fetchAccountBalance(testAddress, {
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(bal).toBe("10000.0000000");
    });
  });
});

