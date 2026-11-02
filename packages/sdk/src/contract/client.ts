import {
  Account,
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import {
  type ClientConfig,
  type DeploymentFile,
  loadDeploymentConfig,
} from "../config.js";
import { bytesToHex, hexToBytes } from "../voucher/encode.js";
import { parseContractError } from "./errors.js";

export type { ClientConfig };

export enum NoteState {
  Open = 0,
  Redeemed = 1,
}

export interface NoteView {
  denomination: bigint;
  state: NoteState;
}

export interface OpenBookParams {
  ownerSecret: string;
  tokenAddress: string;
  voucherKey: string | Uint8Array;
  denominations: bigint[];
  redeemDeadline: bigint;
}

export interface RedeemParams {
  submitterSecret?: string;
  bookId: bigint;
  noteIndex: number;
  merchant: string;
  amount: bigint;
  cap: bigint;
  acceptUntil: bigint;
  signature: string | Uint8Array;
}

export interface ReclaimParams {
  ownerSecret: string;
  bookId: bigint;
}

export interface BookView {
  bookId: bigint;
  owner: string;
  token: string;
  voucherKey: string;
  redeemDeadline: bigint;
  freeBalance: bigint;
  noteCount: number;
}

// Dummy account used for stateless read simulations
const SIMULATION_DUMMY_ACCOUNT =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

/**
 * Polls for transaction confirmation until SUCCESS or failure.
 */
export async function pollTransaction(
  server: rpc.Server,
  hash: string,
  timeoutMs = 30000,
  intervalMs = 1000
): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await server.getTransaction(hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return res;
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      const rawError = res.resultXdr
        ? res.resultXdr.toXDR("base64")
        : "unknown error";
      const parsed = parseContractError(rawError);
      if (parsed) throw parsed;
      throw new Error(`Transaction ${hash} failed: ${rawError}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Transaction ${hash} timed out after ${timeoutMs}ms`);
}

export class KerfvaultClient {
  public readonly config: ClientConfig;
  public readonly server: rpc.Server;

  constructor(config: ClientConfig, server?: rpc.Server) {
    this.config = config;
    this.server = server ?? new rpc.Server(config.rpcUrl);
  }

  /**
   * Initializes a KerfvaultClient from a deployment file or parsed deployment configuration.
   */
  static fromDeployment(
    deployment: DeploymentFile | string,
    server?: rpc.Server
  ): KerfvaultClient {
    return new KerfvaultClient(loadDeploymentConfig(deployment), server);
  }

  /**
   * Queries book metadata from contract storage.
   */
  async getBook(bookId: bigint): Promise<BookView> {
    const contract = new Contract(this.config.contractId);
    const dummyAccount = new Account(SIMULATION_DUMMY_ACCOUNT, "0");
    const tx = new TransactionBuilder(dummyAccount, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        contract.call(
          "get_book",
          nativeToScVal(BigInt(bookId), { type: "u64" })
        )
      )
      .setTimeout(30)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      const parsed = parseContractError(sim.error);
      if (parsed) throw parsed;
      throw new Error(`Failed to simulate get_book: ${sim.error}`);
    }
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
      throw new Error(
        "Failed to simulate get_book: No simulation retval returned"
      );
    }

    const raw = scValToNative(sim.result.retval) as {
      free_balance: bigint;
      note_count: number;
      owner: string;
      redeem_deadline: bigint;
      token: string;
      voucher_key: Uint8Array;
    };

    return {
      bookId: BigInt(bookId),
      owner: raw.owner,
      token: raw.token,
      voucherKey: bytesToHex(raw.voucher_key),
      redeemDeadline: BigInt(raw.redeem_deadline),
      freeBalance: BigInt(raw.free_balance),
      noteCount: Number(raw.note_count),
    };
  }

  /**
   * Queries note metadata from contract storage.
   */
  async getNote(bookId: bigint, noteIndex: number): Promise<NoteView> {
    const contract = new Contract(this.config.contractId);
    const dummyAccount = new Account(SIMULATION_DUMMY_ACCOUNT, "0");
    const tx = new TransactionBuilder(dummyAccount, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        contract.call(
          "get_note",
          nativeToScVal(BigInt(bookId), { type: "u64" }),
          nativeToScVal(noteIndex, { type: "u32" })
        )
      )
      .setTimeout(30)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      const parsed = parseContractError(sim.error);
      if (parsed) throw parsed;
      throw new Error(`Failed to simulate get_note: ${sim.error}`);
    }
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
      throw new Error(
        "Failed to simulate get_note: No simulation retval returned"
      );
    }

    const raw = scValToNative(sim.result.retval) as {
      denomination: bigint;
      state: number | bigint;
    };

    return {
      denomination: BigInt(raw.denomination),
      state: Number(raw.state) as NoteState,
    };
  }

  /**
   * Opens a new book of voucher notes on-chain.
   */
  async openBook(params: OpenBookParams): Promise<bigint> {
    const ownerKeypair = Keypair.fromSecret(params.ownerSecret);
    const account = await this.server.getAccount(ownerKeypair.publicKey());
    const contract = new Contract(this.config.contractId);

    const voucherKeyBytes =
      typeof params.voucherKey === "string"
        ? hexToBytes(params.voucherKey)
        : params.voucherKey;

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        contract.call(
          "open_book",
          new Address(ownerKeypair.publicKey()).toScVal(),
          new Address(params.tokenAddress).toScVal(),
          nativeToScVal(voucherKeyBytes, { type: "bytes" }),
          xdr.ScVal.scvVec(
            params.denominations.map((d) =>
              nativeToScVal(BigInt(d), { type: "i128" })
            )
          ),
          nativeToScVal(BigInt(params.redeemDeadline), { type: "u64" })
        )
      )
      .setTimeout(30)
      .build();

    const preparedTx = await this.server.prepareTransaction(tx);
    preparedTx.sign(ownerKeypair);

    const sendRes = await this.server.sendTransaction(preparedTx);
    if (sendRes.status === "ERROR") {
      const raw =
        sendRes.errorResult?.toXDR("base64") ?? "Unknown send error";
      const parsed = parseContractError(raw);
      if (parsed) throw parsed;
      throw new Error(`Failed to submit open_book transaction: ${raw}`);
    }

    const txRes = await pollTransaction(this.server, sendRes.hash);
    if (!txRes.returnValue) {
      throw new Error("open_book transaction did not return a value");
    }

    const bookId = scValToNative(txRes.returnValue);
    return BigInt(bookId);
  }

  /**
   * Submits a voucher for on-chain redemption.
   * Returns the confirmed transaction hash.
   */
  async redeem(params: RedeemParams): Promise<string> {
    if (!params.submitterSecret) {
      throw new Error(
        "submitterSecret is required to sign and submit redemption transaction"
      );
    }

    const sigBytes =
      typeof params.signature === "string"
        ? hexToBytes(params.signature)
        : params.signature;

    if (sigBytes.length !== 64) {
      throw new Error(
        `Invalid signature length: expected 64 bytes, received ${sigBytes.length}`
      );
    }

    const submitterKeypair = Keypair.fromSecret(params.submitterSecret);
    const account = await this.server.getAccount(submitterKeypair.publicKey());
    const contract = new Contract(this.config.contractId);

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        contract.call(
          "redeem",
          nativeToScVal(BigInt(params.bookId), { type: "u64" }),
          nativeToScVal(params.noteIndex, { type: "u32" }),
          new Address(params.merchant).toScVal(),
          nativeToScVal(BigInt(params.amount), { type: "i128" }),
          nativeToScVal(BigInt(params.cap), { type: "i128" }),
          nativeToScVal(BigInt(params.acceptUntil), { type: "u64" }),
          nativeToScVal(sigBytes, { type: "bytes" })
        )
      )
      .setTimeout(30)
      .build();

    const preparedTx = await this.server.prepareTransaction(tx);
    preparedTx.sign(submitterKeypair);

    const sendRes = await this.server.sendTransaction(preparedTx);
    if (sendRes.status === "ERROR") {
      const raw =
        sendRes.errorResult?.toXDR("base64") ?? "Unknown send error";
      const parsed = parseContractError(raw);
      if (parsed) throw parsed;
      throw new Error(`Failed to submit redeem transaction: ${raw}`);
    }

    await pollTransaction(this.server, sendRes.hash);
    return sendRes.hash;
  }

  /**
   * Reclaims remaining funds from an expired book.
   */
  async reclaim(_params: ReclaimParams): Promise<void> {
    // TODO: Build, sign with owner secret, and invoke reclaim on Soroban contract via RPC
    throw new Error("TODO: reclaim contract invocation not yet implemented");
  }
}
