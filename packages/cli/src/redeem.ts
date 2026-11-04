import fs from "node:fs";
import path from "node:path";
import { Keypair } from "@stellar/stellar-sdk";
import {
  decodeVoucher,
  KerfvaultClient,
  type RedeemParams,
} from "@kerfvault/sdk";

export interface RedeemCliOptions {
  voucher?: string;
  submitterSecret?: string;
  keysFile?: string;
  deploymentFile?: string;
  stateFile?: string;
}

export async function runRedeemVoucher(
  options: RedeemCliOptions = {},
  stdout: (msg: string) => void = console.log,
  clientOverride?: KerfvaultClient
): Promise<string> {
  const deploymentPath = path.resolve(
    process.cwd(),
    options.deploymentFile || "deployments/testnet.json"
  );
  const keysPath = path.resolve(process.cwd(), options.keysFile || ".demo-keys.json");
  const statePath = path.resolve(process.cwd(), options.stateFile || ".demo-state.json");

  let encoded = options.voucher;
  let submitterSecret = options.submitterSecret;

  if (!encoded && fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
      if (state.lastVoucher) encoded = state.lastVoucher;
    } catch {
      // Ignore
    }
  }

  if (!encoded) {
    throw new Error(
      "Voucher string is required. Run 'kerfvault sign-voucher' first or pass --voucher <base64>."
    );
  }

  if (!submitterSecret && fs.existsSync(keysPath)) {
    try {
      const keys = JSON.parse(fs.readFileSync(keysPath, "utf8"));
      // Prefer merchant secret, fallback to owner secret
      submitterSecret = keys.merchantSecret || keys.ownerSecret;
    } catch {
      // Ignore
    }
  }

  if (!submitterSecret) {
    throw new Error(
      "Submitter secret key is required to sign and pay for the redemption transaction. Pass --submitter or run 'kerfvault setup' first."
    );
  }

  const voucher = decodeVoucher(encoded);
  const submitterKeypair = Keypair.fromSecret(submitterSecret);
  const client =
    clientOverride ||
    KerfvaultClient.fromDeployment(
      JSON.parse(fs.readFileSync(deploymentPath, "utf8"))
    );

  stdout("==> Submitting voucher for on-chain contract redemption...");
  stdout(`Submitter:       ${submitterKeypair.publicKey()}`);
  stdout(`Contract ID:     ${voucher.contractId}`);
  stdout(`Book ID:         ${voucher.bookId}`);
  stdout(`Note Index:      ${voucher.noteIndex}`);
  stdout(`Merchant:        ${voucher.merchant}`);
  stdout(`Amount:          ${voucher.amount} stroops`);
  stdout(`Cap:             ${voucher.cap} stroops`);
  stdout(`Accept Until:    ${voucher.acceptUntil}`);

  const redeemParams: RedeemParams = {
    submitterSecret,
    bookId: voucher.bookId,
    noteIndex: voucher.noteIndex,
    merchant: voucher.merchant,
    amount: voucher.amount,
    cap: voucher.cap,
    acceptUntil: voucher.acceptUntil,
    signature: voucher.signature,
  };

  const txHash = await client.redeem(redeemParams);

  stdout("==> Redemption confirmed on-chain!");
  stdout(`Transaction Hash: ${txHash}`);

  // Persist txHash to .demo-state.json
  try {
    let currentState: Record<string, unknown> = {};
    if (fs.existsSync(statePath)) {
      currentState = JSON.parse(fs.readFileSync(statePath, "utf8"));
    }
    currentState.lastRedeemTx = txHash;
    currentState.lastRedeemedBookId = voucher.bookId.toString();
    currentState.lastRedeemedNoteIndex = voucher.noteIndex;
    fs.writeFileSync(statePath, JSON.stringify(currentState, null, 2), {
      mode: 0o600,
    });
    stdout("Saved transaction hash to .demo-state.json (gitignored).");
  } catch {
    // Ignore state write failure
  }

  return txHash;
}
