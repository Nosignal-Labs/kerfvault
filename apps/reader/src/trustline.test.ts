import { describe, it, expect, vi } from "vitest";
import { Keypair, rpc, Asset } from "@stellar/stellar-sdk";
import {
  checkTrustlineStatus,
  addMerchantTrustline,
  fundMerchantViaFriendbot,
  DEFAULT_ASSET_CODE,
  DEFAULT_ASSET_ISSUER,
} from "./lib/trustline";

describe("Merchant Trustline Detection & Creation", () => {
  const merchantAddress = "GDELSDATL7W2JEDSUGSQUFP3YP36VPWM4V4C5TJLIY4LZMIMKGCSRNFG";

  it("detects missing trustline when account does not exist on testnet (404)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
    });

    const result = await checkTrustlineStatus(merchantAddress, {
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.accountExists).toBe(false);
    expect(result.hasTrustline).toBe(false);
    expect(result.assetCode).toBe(DEFAULT_ASSET_CODE);
  });

  it("detects missing trustline when account exists but lacks KVUSD asset", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        id: merchantAddress,
        balances: [
          {
            asset_type: "native",
            balance: "100.0000000",
          },
          {
            asset_type: "credit_alphanum4",
            asset_code: "USDC",
            asset_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            balance: "50.0000000",
          },
        ],
      }),
    });

    const result = await checkTrustlineStatus(merchantAddress, {
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.accountExists).toBe(true);
    expect(result.hasTrustline).toBe(false);
    expect(result.xlmBalance).toBe("100.0000000");
  });

  it("detects active trustline when account holds KVUSD balance", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        id: merchantAddress,
        balances: [
          {
            asset_type: "native",
            balance: "25.0000000",
          },
          {
            asset_type: "credit_alphanum4",
            asset_code: DEFAULT_ASSET_CODE,
            asset_issuer: DEFAULT_ASSET_ISSUER,
            balance: "150.0000000",
          },
        ],
      }),
    });

    const result = await checkTrustlineStatus(merchantAddress, {
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.accountExists).toBe(true);
    expect(result.hasTrustline).toBe(true);
    expect(result.balance).toBe("150.0000000");
    expect(result.xlmBalance).toBe("25.0000000");
  });

  it("funds merchant account via Friendbot", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "funded",
    });

    await expect(
      fundMerchantViaFriendbot(merchantAddress, "https://friendbot.test", mockFetch as unknown as typeof fetch)
    ).resolves.not.toThrow();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(merchantAddress))
    );
  });

  it("builds and signs ChangeTrust transaction with mock server", async () => {
    const kp = Keypair.random();
    const mockServer = {
      getAccount: vi.fn().mockResolvedValue({
        accountId: () => kp.publicKey(),
        sequenceNumber: () => "12345",
        incrementSequenceNumber: vi.fn(),
      }),
      prepareTransaction: vi.fn().mockImplementation((tx) => Promise.resolve(tx)),
      sendTransaction: vi.fn().mockResolvedValue({
        status: "SUCCESS",
        hash: "test-tx-hash-123",
      }),
    } as unknown as rpc.Server;

    const res = await addMerchantTrustline(kp.secret(), {
      server: mockServer,
      networkPassphrase: "Test SDF Network ; September 2015",
    });

    expect(res.txHash).toBe("test-tx-hash-123");
    expect(mockServer.getAccount).toHaveBeenCalledWith(kp.publicKey());
    expect(mockServer.sendTransaction).toHaveBeenCalled();
  });
});

