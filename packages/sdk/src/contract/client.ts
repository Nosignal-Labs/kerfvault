import {
  Account,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
} from "@stellar/stellar-sdk";
import {
  type ClientConfig,
  type DeploymentFile,
  loadDeploymentConfig,
} from "../config.js";
import { bytesToHex } from "../voucher/encode.js";

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
  voucherKey: string;
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
  signature: string;
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
      throw new Error(`Failed to simulate get_book: ${sim.error}`);
    }
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
      throw new Error("Failed to simulate get_book: No simulation retval returned");
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
      throw new Error(`Failed to simulate get_note: ${sim.error}`);
    }
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
      throw new Error("Failed to simulate get_note: No simulation retval returned");
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
  async openBook(_params: OpenBookParams): Promise<bigint> {
    // TODO: Build, sign with owner secret, and invoke open_book on Soroban contract via RPC
    throw new Error("TODO: openBook contract invocation not yet implemented");
  }

  /**
   * Submits a voucher for on-chain redemption.
   */
  async redeem(_params: RedeemParams): Promise<void> {
    // TODO: Build, sign with submitter secret, and invoke redeem on Soroban contract via RPC
    throw new Error("TODO: redeem contract invocation not yet implemented");
  }

  /**
   * Reclaims remaining funds from an expired book.
   */
  async reclaim(_params: ReclaimParams): Promise<void> {
    // TODO: Build, sign with owner secret, and invoke reclaim on Soroban contract via RPC
    throw new Error("TODO: reclaim contract invocation not yet implemented");
  }
}
