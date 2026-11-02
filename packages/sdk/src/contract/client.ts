import {
  type ClientConfig,
  type DeploymentFile,
  loadDeploymentConfig,
} from "../config.js";

export type { ClientConfig };

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
}

export class KerfvaultClient {
  public readonly config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  /**
   * Initializes a KerfvaultClient from a deployment file or parsed deployment configuration.
   */
  static fromDeployment(deployment: DeploymentFile | string): KerfvaultClient {
    return new KerfvaultClient(loadDeploymentConfig(deployment));
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

  /**
   * Queries book metadata from contract storage.
   */
  async getBook(_bookId: bigint): Promise<BookView> {
    // TODO: Fetch contract persistent storage entry for bookId via Soroban RPC
    throw new Error("TODO: getBook contract query not yet implemented");
  }
}

