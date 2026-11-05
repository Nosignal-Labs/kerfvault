import { describe, expect, it, vi } from "vitest";
import { Account, Keypair, rpc, type Transaction } from "@stellar/stellar-sdk";
import { submitRedeemTransaction, type SubmitRedeemConfig } from "./submit.js";
import type { RedeemRequestBody } from "./index.js";

const TEST_FEE_KEYPAIR = Keypair.random();

const VALID_PARAMS: RedeemRequestBody = {
  bookId: 101,
  noteIndex: 0,
  merchant: "GDELSDATL7W2JEDSUGSQUFP3YP36VPWM4V4C5TJLIY4LZMIMKGCSRNFG",
  amount: "7000000",
  cap: "10000000",
  acceptUntil: 1793404800,
  signature:
    "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
};

describe("Relay Submission (Simulate, Sign with Fee Account, Submit)", () => {
  const dummyFeeAccount = new Account(TEST_FEE_KEYPAIR.publicKey(), "100");

  function createMockServer(overrides?: Partial<rpc.Server>) {
    return {
      getAccount: vi.fn().mockResolvedValue(dummyFeeAccount),
      prepareTransaction: vi.fn().mockImplementation((tx: Transaction) => Promise.resolve(tx)),
      sendTransaction: vi.fn().mockResolvedValue({
        status: "PENDING",
        hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      }),
      ...overrides,
    } as unknown as rpc.Server;
  }

  it("successfully simulates, signs with fee account, and submits transaction", async () => {
    const mockServer = createMockServer();
    const config: SubmitRedeemConfig = {
      contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
      networkPassphrase: "Test SDF Network ; September 2015",
      relaySecret: TEST_FEE_KEYPAIR.secret(),
      server: mockServer,
    };

    const res = await submitRedeemTransaction(VALID_PARAMS, config);

    expect(res.status).toBe("success");
    expect(res.txHash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

    expect(mockServer.getAccount).toHaveBeenCalledWith(TEST_FEE_KEYPAIR.publicKey());
    expect(mockServer.prepareTransaction).toHaveBeenCalledTimes(1);
    expect(mockServer.sendTransaction).toHaveBeenCalledTimes(1);

    // Verify the submitted transaction was signed
    const submittedTx = vi.mocked(mockServer.sendTransaction).mock.calls[0][0] as Transaction;
    expect(submittedTx.signatures.length).toBeGreaterThan(0);
  });

  it("throws error when RPC sendTransaction returns status ERROR", async () => {
    const mockServer = createMockServer({
      sendTransaction: vi.fn().mockResolvedValue({
        status: "ERROR",
        errorResult: {
          toXDR: () => "tx_failed_sim_error",
        },
      }),
    });

    const config: SubmitRedeemConfig = {
      contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
      networkPassphrase: "Test SDF Network ; September 2015",
      relaySecret: TEST_FEE_KEYPAIR.secret(),
      server: mockServer,
    };

    await expect(submitRedeemTransaction(VALID_PARAMS, config)).rejects.toThrow(
      /RPC submission failed: tx_failed_sim_error/
    );
  });

  it("throws error when RELAY_SECRET is missing", async () => {
    const originalEnv = process.env.RELAY_SECRET;
    delete process.env.RELAY_SECRET;
    try {
      const mockServer = createMockServer();
      const config: SubmitRedeemConfig = {
        contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
        networkPassphrase: "Test SDF Network ; September 2015",
        server: mockServer,
      };

      await expect(submitRedeemTransaction(VALID_PARAMS, config)).rejects.toThrow(
        /Relay fee account secret is missing/
      );
    } finally {
      if (originalEnv) process.env.RELAY_SECRET = originalEnv;
    }
  });

  it("throws error when RELAY_SECRET is malformed", async () => {
    const mockServer = createMockServer();
    const config: SubmitRedeemConfig = {
      contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
      networkPassphrase: "Test SDF Network ; September 2015",
      relaySecret: "NOT_A_VALID_STELLAR_SECRET",
      server: mockServer,
    };

    await expect(submitRedeemTransaction(VALID_PARAMS, config)).rejects.toThrow(
      /Invalid RELAY_SECRET keypair/
    );
  });
});
