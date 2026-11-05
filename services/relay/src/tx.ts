import {
  Account,
  Address,
  Contract,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { hexToBytes } from "@kerfvault/sdk";
import type { RedeemRequestBody } from "./index.js";

/**
 * Strict regex for 56-character Stellar contract address starting with 'C'.
 */
export const STELLAR_CONTRACT_REGEX = /^C[A-Z2-7]{55}$/;

/**
 * The single contract function that the relay is permitted to invoke.
 */
export const ALLOWED_RELAY_FUNCTION = "redeem";

export interface RelayTxConfig {
  contractId: string;
  networkPassphrase: string;
  baseFee?: string;
  timeoutSeconds?: number;
}

/**
 * Verifies that a transaction strictly adheres to the relay execution restrictions:
 * 1. Exactly one operation.
 * 2. Operation type must be invokeHostFunction.
 * 3. Host function must be invokeContract.
 * 4. Contract ID must match the single expected target contract.
 * 5. Function name must match the single allowed function ("redeem").
 *
 * Throws a Security violation Error if any restriction is violated.
 */
export function verifyRestrictedTransaction(
  tx: Transaction,
  expectedContractId: string
): void {
  if (!STELLAR_CONTRACT_REGEX.test(expectedContractId)) {
    throw new Error(
      `Invalid expectedContractId: "${expectedContractId}" is not a valid 56-character Stellar contract ID`
    );
  }

  if (tx.operations.length !== 1) {
    throw new Error(
      `Security violation: Relay transaction must contain exactly 1 operation, found ${tx.operations.length}`
    );
  }

  const op = tx.operations[0] as any;
  if (op.type !== "invokeHostFunction") {
    throw new Error(
      `Security violation: Operation type must be invokeHostFunction, found "${op.type}"`
    );
  }

  const hostFn = op.func;
  if (!hostFn || hostFn.type !== "hostFunctionTypeInvokeContract") {
    throw new Error(
      `Security violation: Host function type must be hostFunctionTypeInvokeContract, found "${hostFn?.type}"`
    );
  }

  const invokeContract = hostFn.invokeContract;
  if (!invokeContract) {
    throw new Error("Security violation: Missing invokeContract payload in host function");
  }

  const invokedFunctionName = invokeContract.functionName?.toString();
  if (invokedFunctionName !== ALLOWED_RELAY_FUNCTION) {
    throw new Error(
      `Security violation: Relay is strictly restricted to function "${ALLOWED_RELAY_FUNCTION}". Attempted invocation of "${invokedFunctionName}" is prohibited.`
    );
  }

  const invokedContractId = Address.fromScAddress(invokeContract.contractAddress).toString();
  if (invokedContractId !== expectedContractId) {
    throw new Error(
      `Security violation: Relay is strictly restricted to contract "${expectedContractId}". Attempted invocation of "${invokedContractId}" is prohibited.`
    );
  }
}

/**
 * Constructs a Soroban redeem transaction directly from validated, structured parameters
 * signed by the relay's fee account.
 *
 * Security invariants:
 * - The relay NEVER accepts or parses raw transaction XDR from callers.
 * - The relay is strictly restricted to ONE contract and ONE function ("redeem").
 */
export function buildRedeemTransaction(
  config: RelayTxConfig,
  sourceAccount: Account,
  body: RedeemRequestBody
): Transaction {
  // Enforce valid target contract ID
  if (!STELLAR_CONTRACT_REGEX.test(config.contractId)) {
    throw new Error(
      `Invalid contractId: "${config.contractId}" is not a valid 56-character Stellar contract ID`
    );
  }

  // Reject any payload attempting to smuggle raw XDR
  const rawCandidate = body as unknown as Record<string, unknown>;
  if (
    rawCandidate.rawXdr != null ||
    rawCandidate.txXdr != null ||
    rawCandidate.envelopeXdr != null ||
    rawCandidate.xdr != null
  ) {
    throw new Error(
      "Security violation: Relay never accepts caller-supplied raw XDR transactions. All transactions must be constructed from structured parameters."
    );
  }

  // Parse 64-byte Ed25519 signature from hex or base64
  let sigBytes: Uint8Array;
  if (/^[0-9a-fA-F]{128}$/.test(body.signature)) {
    sigBytes = hexToBytes(body.signature);
  } else {
    sigBytes = Buffer.from(body.signature, "base64");
  }

  if (sigBytes.length !== 64) {
    throw new Error(
      `Invalid signature length: expected 64 bytes, received ${sigBytes.length}`
    );
  }

  const contract = new Contract(config.contractId);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: config.baseFee ?? "100",
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        ALLOWED_RELAY_FUNCTION,
        nativeToScVal(BigInt(body.bookId), { type: "u64" }),
        nativeToScVal(body.noteIndex, { type: "u32" }),
        new Address(body.merchant).toScVal(),
        nativeToScVal(BigInt(body.amount), { type: "i128" }),
        nativeToScVal(BigInt(body.cap), { type: "i128" }),
        nativeToScVal(BigInt(body.acceptUntil), { type: "u64" }),
        nativeToScVal(sigBytes, { type: "bytes" })
      )
    )
    .setTimeout(config.timeoutSeconds ?? 30)
    .build();

  // Validate that the built transaction satisfies single contract and single function restrictions
  verifyRestrictedTransaction(tx, config.contractId);

  return tx;
}
