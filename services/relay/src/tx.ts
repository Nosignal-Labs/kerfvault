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

export interface RelayTxConfig {
  contractId: string;
  networkPassphrase: string;
  baseFee?: string;
  timeoutSeconds?: number;
}

/**
 * Constructs a Soroban redeem transaction directly from validated, structured parameters
 * signed by the relay's fee account.
 *
 * Security invariant: The relay NEVER accepts or parses raw transaction XDR from callers.
 */
export function buildRedeemTransaction(
  config: RelayTxConfig,
  sourceAccount: Account,
  body: RedeemRequestBody
): Transaction {
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
        "redeem",
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

  return tx;
}
