import { describe, expect, it } from "vitest";
import { Account, scValToNative, xdr } from "@stellar/stellar-sdk";
import { buildRedeemTransaction, type RelayTxConfig } from "./tx.js";
import type { RedeemRequestBody } from "./index.js";

const TEST_CONFIG: RelayTxConfig = {
  contractId: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
  networkPassphrase: "Test SDF Network ; September 2015",
  baseFee: "100",
  timeoutSeconds: 30,
};

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

describe("Relay Transaction Builder", () => {
  const dummyAccount = new Account(
    "GD3QC7FB6RAMQCKEJQR74L6LR5DTS3QKI46M6NNABSE27M2HV5DEZYZU",
    "1000"
  );

  it("builds a valid Soroban transaction calling redeem with exact parameters", () => {
    const tx = buildRedeemTransaction(TEST_CONFIG, dummyAccount, VALID_PARAMS);
    expect(tx).toBeDefined();
    expect(tx.operations).toHaveLength(1);

    const op = tx.operations[0] as any;
    expect(op.type).toBe("invokeHostFunction");
    const hostFn = op.func;
    expect(hostFn.type).toBe("hostFunctionTypeInvokeContract");

    const invokeArgs = hostFn.invokeContract;
    const functionName = invokeArgs.functionName.toString();
    expect(functionName).toBe("redeem");

    const args = invokeArgs.args;
    expect(args).toHaveLength(7);
    expect(scValToNative(args[0])).toBe(101n);
    expect(scValToNative(args[1])).toBe(0);
    expect(scValToNative(args[3])).toBe(7000000n);
    expect(scValToNative(args[4])).toBe(10000000n);
    expect(scValToNative(args[5])).toBe(1793404800n);
  });

  it("strictly rejects raw XDR parameter injection attempts", () => {
    const poisonedParams = {
      ...VALID_PARAMS,
      rawXdr: "AAAAAGX/...",
    } as any;

    expect(() =>
      buildRedeemTransaction(TEST_CONFIG, dummyAccount, poisonedParams)
    ).toThrow(/Security violation: Relay never accepts caller-supplied raw XDR/);
  });

  it("accepts valid 64-byte base64 encoded signature", () => {
    const base64Sig = Buffer.alloc(64, 0xef).toString("base64");
    const params: RedeemRequestBody = {
      ...VALID_PARAMS,
      signature: base64Sig,
    };

    const tx = buildRedeemTransaction(TEST_CONFIG, dummyAccount, params);
    expect(tx).toBeDefined();
  });

  it("rejects invalid signature length", () => {
    const invalidSigParams = {
      ...VALID_PARAMS,
      signature: "0102030405",
    } as any;

    expect(() =>
      buildRedeemTransaction(TEST_CONFIG, dummyAccount, invalidSigParams)
    ).toThrow(/Invalid signature length/);
  });
});
