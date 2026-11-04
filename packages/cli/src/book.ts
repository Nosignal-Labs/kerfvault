import fs from "node:fs";
import path from "node:path";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import {
  KerfvaultClient,
  loadDeploymentConfig,
  NoteState,
  type OpenBookParams,
} from "@kerfvault/sdk";

export interface OpenBookCliOptions {
  ownerSecret?: string;
  voucherKey?: string;
  tokenAddress?: string;
  denominations?: string;
  redeemDeadline?: string;
  keysFile?: string;
  deploymentFile?: string;
}

export interface ShowBookCliOptions {
  bookId?: string | number | bigint;
  deploymentFile?: string;
}

export async function runOpenBook(
  options: OpenBookCliOptions = {},
  stdout: (msg: string) => void = console.log,
  clientOverride?: KerfvaultClient
): Promise<bigint> {
  const deploymentPath = path.resolve(
    process.cwd(),
    options.deploymentFile || "deployments/testnet.json"
  );
  const keysPath = path.resolve(process.cwd(), options.keysFile || ".demo-keys.json");
  const statePath = path.resolve(process.cwd(), ".demo-state.json");

  let ownerSecret = options.ownerSecret;
  let voucherKey = options.voucherKey;

  if (fs.existsSync(keysPath)) {
    try {
      const keys = JSON.parse(fs.readFileSync(keysPath, "utf8"));
      if (!ownerSecret && keys.ownerSecret) {
        ownerSecret = keys.ownerSecret;
      }
      if (!voucherKey && keys.voucherPublicKey) {
        voucherKey = keys.voucherPublicKey;
      }
    } catch {
      // Ignore read errors
    }
  }

  if (!ownerSecret) {
    throw new Error(
      "Owner secret key is required. Run 'kerfvault setup' first or pass --owner."
    );
  }

  const client =
    clientOverride ||
    KerfvaultClient.fromDeployment(
      JSON.parse(fs.readFileSync(deploymentPath, "utf8"))
    );

  let tokenAddress = options.tokenAddress;
  if (!tokenAddress) {
    if (fs.existsSync(deploymentPath)) {
      const dep = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      tokenAddress =
        dep.contracts?.nativeSac || dep.contracts?.testAssetSac;
    }
  }

  if (!tokenAddress) {
    throw new Error(
      "Token address is required. Specify --token or define contracts.nativeSac in deployments/testnet.json."
    );
  }

  if (!voucherKey) {
    // Generate a temporary voucher keypair if none exists
    const randomVoucher = Keypair.random();
    voucherKey = randomVoucher.publicKey();
  }

  // Convert Ed25519 public key StrKey (G...) to raw 32-byte hex if needed
  let voucherKeyHex = voucherKey;
  if (voucherKey.startsWith("G") && voucherKey.length === 56) {
    const rawBytes = StrKey.decodeEd25519PublicKey(voucherKey);
    voucherKeyHex = Buffer.from(rawBytes).toString("hex");
  }

  const denominations: bigint[] = options.denominations
    ? options.denominations.split(",").map((s) => BigInt(s.trim()))
    : [10_000_000n, 20_000_000n];

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const deadlineSec = options.redeemDeadline
    ? BigInt(options.redeemDeadline)
    : nowSec + 30n * 86400n; // 30 days default

  const ownerKeypair = Keypair.fromSecret(ownerSecret);

  stdout("==> Opening voucher book on-chain...");
  stdout(`Owner:            ${ownerKeypair.publicKey()}`);
  stdout(`Token:            ${tokenAddress}`);
  stdout(`Voucher key:      ${voucherKey}`);
  stdout(
    `Denominations:    ${denominations.map((d) => d.toString()).join(", ")} stroops (${
      denominations.length
    } notes)`
  );
  stdout(`Redeem deadline:  ${deadlineSec}`);

  const params: OpenBookParams = {
    ownerSecret,
    tokenAddress,
    voucherKey: voucherKeyHex,
    denominations,
    redeemDeadline: deadlineSec,
  };

  const bookId = await client.openBook(params);

  stdout("==> Book opened successfully!");
  stdout(`Book ID:          ${bookId}`);

  // Persist state for subsequent CLI invocations
  try {
    let currentState: Record<string, unknown> = {};
    if (fs.existsSync(statePath)) {
      currentState = JSON.parse(fs.readFileSync(statePath, "utf8"));
    }
    currentState.lastBookId = bookId.toString();
    currentState.lastToken = tokenAddress;
    currentState.lastVoucherKey = voucherKey;
    fs.writeFileSync(statePath, JSON.stringify(currentState, null, 2), {
      mode: 0o600,
    });
    stdout("Saved book context to .demo-state.json (gitignored).");
  } catch {
    // Ignore state file write failure
  }

  return bookId;
}

export async function runShowBook(
  options: ShowBookCliOptions = {},
  stdout: (msg: string) => void = console.log,
  clientOverride?: KerfvaultClient
): Promise<void> {
  const deploymentPath = path.resolve(
    process.cwd(),
    options.deploymentFile || "deployments/testnet.json"
  );
  const statePath = path.resolve(process.cwd(), ".demo-state.json");

  let bookIdStr = options.bookId?.toString();
  if (!bookIdStr && fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
      bookIdStr = state.lastBookId;
    } catch {
      // Ignore
    }
  }

  const bookId = BigInt(bookIdStr || "1");
  const client =
    clientOverride ||
    KerfvaultClient.fromDeployment(
      JSON.parse(fs.readFileSync(deploymentPath, "utf8"))
    );

  stdout(`==> Querying book #${bookId} from contract storage...`);
  const book = await client.getBook(bookId);

  stdout(`Book ID:          ${book.bookId}`);
  stdout(`Owner:            ${book.owner}`);
  stdout(`Token:            ${book.token}`);
  stdout(`Voucher key:      ${book.voucherKey}`);
  stdout(`Redeem deadline:  ${book.redeemDeadline}`);
  stdout(`Free balance:     ${book.freeBalance} stroops`);
  stdout(`Note count:       ${book.noteCount}`);

  stdout("--- Notes ---");
  for (let i = 0; i < book.noteCount; i++) {
    const note = await client.getNote(bookId, i);
    const stateStr =
      note.state === NoteState.Open ? "OPEN" : "REDEEMED";
    stdout(
      `Note #${i}: denomination = ${note.denomination} stroops, state = ${stateStr}`
    );
  }
}

