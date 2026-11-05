import { describe, it, expect, vi } from "vitest";
import {
  FaucetRequestSchema,
  requestDemoFaucet,
  type FaucetConfig,
} from "./faucet.js";

describe("Faucet validation and execution", () => {
  const validAddress = "GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK";

  it("validates valid Stellar G-address", () => {
    const res = FaucetRequestSchema.safeParse({ address: validAddress });
    expect(res.success).toBe(true);
  });

  it("rejects invalid addresses or unexpected properties", () => {
    expect(FaucetRequestSchema.safeParse({ address: "invalid" }).success).toBe(false);
    expect(
      FaucetRequestSchema.safeParse({
        address: validAddress,
        extra: "not-allowed",
      }).success
    ).toBe(false);
  });

  it("calls friendbotUrl with address and succeeds", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: "ok" }),
    });

    const config: FaucetConfig = {
      friendbotUrl: "https://friendbot.custom.org",
      fetchFn: mockFetch as unknown as typeof fetch,
    };

    const res = await requestDemoFaucet({ address: validAddress }, config);
    expect(res.success).toBe(true);
    expect(res.address).toBe(validAddress);
    expect(mockFetch).toHaveBeenCalledWith(
      `https://friendbot.custom.org?addr=${validAddress}`
    );
  });

  it("handles 'already funded' response gracefully", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "op_already_exists / account already funded",
    });

    const config: FaucetConfig = {
      fetchFn: mockFetch as unknown as typeof fetch,
    };

    const res = await requestDemoFaucet({ address: validAddress }, config);
    expect(res.success).toBe(true);
    expect(res.message).toContain("already exists");
  });

  it("throws on other friendbot failures", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "internal server error",
    });

    const config: FaucetConfig = {
      fetchFn: mockFetch as unknown as typeof fetch,
    };

    await expect(
      requestDemoFaucet({ address: validAddress }, config)
    ).rejects.toThrow("Friendbot funding failed (500)");
  });
});
