import { Keypair } from "@stellar/stellar-sdk";
import { KerfvaultClient } from "@kerfvault/sdk";
import {
  STELLAR_TESTNET_PASSPHRASE,
  STELLAR_TESTNET_RPC_URL,
} from "@kerfvault/web-wallet";
import { type BookConfiguration } from "./bookConfig";
import { saveStoredBook, type StoredBook } from "./booksStore";

export const DEFAULT_CONTRACT_ID =
  "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE";

export type OpenBookStep =
  | "IDLE"
  | "VALIDATING"
  | "PREPARING"
  | "SIMULATING"
  | "SIGNING"
  | "SUBMITTING"
  | "CONFIRMED"
  | "ERROR";

export interface OpenBookProgress {
  step: OpenBookStep;
  message: string;
  bookId?: string;
  error?: string;
}

export interface OpenBookWorkflowOptions {
  config: BookConfiguration;
  ownerSecret: string;
  ownerAddress: string;
  voucherPublicKey: string;
  contractId?: string;
  rpcUrl?: string;
  networkPassphrase?: string;
  client?: KerfvaultClient;
  storage?: Storage | null;
  onProgress?: (progress: OpenBookProgress) => void;
}

export async function openBookWorkflow(
  options: OpenBookWorkflowOptions
): Promise<{ bookId: string; storedBook: StoredBook }> {
  const {
    config,
    ownerSecret,
    ownerAddress,
    voucherPublicKey,
    contractId = process.env.NEXT_PUBLIC_CONTRACT_ID || DEFAULT_CONTRACT_ID,
    rpcUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || STELLAR_TESTNET_RPC_URL,
    networkPassphrase = STELLAR_TESTNET_PASSPHRASE,
    client: injectedClient,
    storage,
    onProgress,
  } = options;

  const notify = (step: OpenBookStep, message: string, extra?: { bookId?: string; error?: string }) => {
    onProgress?.({ step, message, ...extra });
  };

  try {
    // 1. Validation
    notify("VALIDATING", "Validating book parameters and voucher key...");
    if (!ownerSecret) {
      throw new Error("Wallet is locked: missing owner secret key.");
    }
    if (!voucherPublicKey) {
      throw new Error("Voucher signing key is missing or not initialized.");
    }

    // 2. Prepare voucher key raw bytes (32-byte Ed25519 public key)
    notify("PREPARING", "Extracting 32-byte Ed25519 voucher public key...");
    const voucherKeypair = Keypair.fromPublicKey(voucherPublicKey);
    const voucherKeyBytes = voucherKeypair.rawPublicKey();

    // 3. Initialize SDK Client
    notify("PREPARING", "Connecting to Soroban RPC on Stellar Testnet...");
    const client =
      injectedClient ||
      new KerfvaultClient({
        contractId,
        rpcUrl,
        networkPassphrase,
      });

    // 4. Dispatch transaction via SDK (simulates, signs with ownerSecret, submits, waits for confirmation)
    notify("SIMULATING", "Simulating open_book Soroban transaction...");

    // We notify SUBMITTING before calling client.openBook which handles simulation, signing, and submission
    notify("SUBMITTING", "Signing and submitting transaction to Stellar Testnet...");

    const bookIdBigInt = await client.openBook({
      ownerSecret,
      tokenAddress: config.tokenAddress,
      voucherKey: voucherKeyBytes,
      denominations: config.denominationsInStroops,
      redeemDeadline: BigInt(config.deadlineTimestamp),
    });

    const bookId = bookIdBigInt.toString();

    // 5. Store book in local cache
    const storedBook: StoredBook = {
      id: bookId,
      ownerAddress,
      tokenAddress: config.tokenAddress,
      voucherPublicKey,
      denominations: config.denominations,
      denominationsStroops: config.denominationsInStroops.map((d) => d.toString()),
      totalAmountXlm: config.totalXlm,
      redeemDeadline: config.deadlineTimestamp,
      createdAt: Math.floor(Date.now() / 1000),
      status: "active",
    };

    saveStoredBook(storedBook, storage);

    notify("CONFIRMED", `Success! Book #${bookId} opened on-chain.`, { bookId });

    return { bookId, storedBook };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to open book on-chain.";
    notify("ERROR", `Failed: ${errorMsg}`, { error: errorMsg });
    throw err;
  }
}

