import fs from "node:fs";
import path from "node:path";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import {
  decodeVoucher,
  encodeVoucher,
  signVoucher,
  verifyVoucher,
  type OfflineVoucher,
  type SignVoucherParams,
  type VoucherVerifyOptions,
} from "@kerfvault/sdk";

export interface SignVoucherCliOptions {
  bookId?: string | number | bigint;
  noteIndex?: string | number;
  merchant?: string;
  amount?: string | bigint;
  cap?: string | bigint;
  acceptUntil?: string | bigint;
  voucherSecret?: string;
  contractId?: string;
  keysFile?: string;
  deploymentFile?: string;
}

export interface VerifyCliOptions {
  voucher?: string;
  voucherKey?: string;
  expectedContractId?: string;
  merchantAddress?: string;
  keysFile?: string;
  deploymentFile?: string;
}

export async function runSignVoucher(
  options: SignVoucherCliOptions = {},
  stdout: (msg: string) => void = console.log
): Promise<{ voucher: OfflineVoucher; encoded: string }> {
  const deploymentPath = path.resolve(
    process.cwd(),
    options.deploymentFile || "deployments/testnet.json"
  );
  const keysPath = path.resolve(process.cwd(), options.keysFile || ".demo-keys.json");
  const statePath = path.resolve(process.cwd(), ".demo-state.json");

  let contractId = options.contractId;
  let bookIdStr = options.bookId?.toString();
  let merchant = options.merchant;
  let voucherSecret = options.voucherSecret;

  if (fs.existsSync(deploymentPath)) {
    try {
      const dep = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      if (!contractId && dep.contracts?.kerfvault) {
        contractId = dep.contracts.kerfvault;
      }
      if (!merchant && dep.accounts?.merchant) {
        merchant = dep.accounts.merchant;
      }
    } catch {
      // Ignore
    }
  }

  if (fs.existsSync(keysPath)) {
    try {
      const keys = JSON.parse(fs.readFileSync(keysPath, "utf8"));
      if (!voucherSecret && keys.voucherSecret) {
        voucherSecret = keys.voucherSecret;
      }
      if (!merchant && keys.merchantPublicKey) {
        merchant = keys.merchantPublicKey;
      }
    } catch {
      // Ignore
    }
  }

  if (!bookIdStr && fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
      if (state.lastBookId) bookIdStr = state.lastBookId;
    } catch {
      // Ignore
    }
  }

  if (!contractId) {
    throw new Error(
      "Contract ID is required. Specify --contract-id or ensure deployments/testnet.json exists."
    );
  }

  if (!voucherSecret) {
    throw new Error(
      "Voucher secret is required to sign offline. Run 'kerfvault setup' first or pass --voucher-secret."
    );
  }

  if (!merchant) {
    throw new Error(
      "Merchant address is required. Run 'kerfvault setup' first or pass --merchant."
    );
  }

  const bookId = BigInt(bookIdStr || "1");
  const noteIndex = Number(options.noteIndex ?? 0);
  const amount = options.amount !== undefined ? BigInt(options.amount) : 7_000_000n;
  const cap = options.cap !== undefined ? BigInt(options.cap) : 10_000_000n;

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const acceptUntil =
    options.acceptUntil !== undefined
      ? BigInt(options.acceptUntil)
      : nowSec + 30n * 86400n;

  // Convert secret key: if StrKey 'S...', extract 32 raw seed bytes
  let seedBytes: Uint8Array;
  if (voucherSecret.startsWith("S") && voucherSecret.length === 56) {
    seedBytes = new Uint8Array(Keypair.fromSecret(voucherSecret).rawSecretKey());
  } else {
    seedBytes = Buffer.from(voucherSecret.replace(/^0x/, ""), "hex");
  }

  stdout("==> Creating and signing offline voucher...");
  stdout(`Contract ID:   ${contractId}`);
  stdout(`Book ID:       ${bookId}`);
  stdout(`Note Index:    ${noteIndex}`);
  stdout(`Merchant:      ${merchant}`);
  stdout(`Amount:        ${amount} stroops`);
  stdout(`Cap:           ${cap} stroops`);
  stdout(`Accept Until:  ${acceptUntil}`);

  const signParams: SignVoucherParams = {
    contractId,
    bookId,
    noteIndex,
    merchant,
    amount,
    cap,
    acceptUntil,
    voucherSecretKey: seedBytes,
  };

  const voucher = await signVoucher(signParams);
  const encoded = encodeVoucher(voucher);

  stdout("==> Voucher signed successfully!");
  stdout("Encoded voucher payload (Base64 URL-safe):");
  stdout(encoded);

  // Cache in .demo-state.json
  try {
    let currentState: Record<string, unknown> = {};
    if (fs.existsSync(statePath)) {
      currentState = JSON.parse(fs.readFileSync(statePath, "utf8"));
    }
    currentState.lastVoucher = encoded;
    currentState.lastVoucherBookId = bookId.toString();
    currentState.lastVoucherNoteIndex = noteIndex;
    currentState.lastVoucherMerchant = merchant;
    currentState.lastVoucherAmount = amount.toString();
    currentState.lastVoucherCap = cap.toString();
    currentState.lastVoucherAcceptUntil = acceptUntil.toString();
    currentState.lastVoucherSignature = voucher.signature;
    fs.writeFileSync(statePath, JSON.stringify(currentState, null, 2), {
      mode: 0o600,
    });
    stdout("Saved voucher to .demo-state.json (gitignored).");
  } catch {
    // Ignore state write errors
  }

  return { voucher, encoded };
}

export async function runVerifyVoucher(
  options: VerifyCliOptions = {},
  stdout: (msg: string) => void = console.log
): Promise<boolean> {
  const deploymentPath = path.resolve(
    process.cwd(),
    options.deploymentFile || "deployments/testnet.json"
  );
  const keysPath = path.resolve(process.cwd(), options.keysFile || ".demo-keys.json");
  const statePath = path.resolve(process.cwd(), ".demo-state.json");

  let encoded = options.voucher;
  let voucherKey = options.voucherKey;
  let contractId = options.expectedContractId;

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

  if (!voucherKey && fs.existsSync(keysPath)) {
    try {
      const keys = JSON.parse(fs.readFileSync(keysPath, "utf8"));
      if (keys.voucherPublicKey) voucherKey = keys.voucherPublicKey;
    } catch {
      // Ignore
    }
  }

  if (!contractId && fs.existsSync(deploymentPath)) {
    try {
      const dep = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      if (dep.contracts?.kerfvault) contractId = dep.contracts.kerfvault;
    } catch {
      // Ignore
    }
  }

  stdout("==> Decoding voucher payload...");
  const voucher = decodeVoucher(encoded);

  // Convert voucherKey StrKey G... to hex if given
  let voucherKeyHex = voucherKey;
  if (voucherKey && voucherKey.startsWith("G") && voucherKey.length === 56) {
    const rawBytes = StrKey.decodeEd25519PublicKey(voucherKey);
    voucherKeyHex = Buffer.from(rawBytes).toString("hex");
  }

  const verifyOpts: VoucherVerifyOptions = {
    voucherKey: voucherKeyHex,
    expectedContractId: contractId,
    merchantAddress: options.merchantAddress,
  };

  stdout("==> Verifying voucher cryptographically offline (zero network calls)...");
  const result = await verifyVoucher(voucher, verifyOpts);

  if (!result.valid) {
    stdout(`==> Offline voucher verification: INVALID (reason: ${result.reason})`);
    return false;
  }

  stdout("==> Offline voucher verification: VALID");
  stdout(`Contract:    ${voucher.contractId}`);
  stdout(`Book ID:     ${voucher.bookId}`);
  stdout(`Note Index:  ${voucher.noteIndex}`);
  stdout(`Merchant:    ${voucher.merchant}`);
  stdout(`Amount:      ${voucher.amount} stroops`);
  stdout(`Cap:         ${voucher.cap} stroops`);
  stdout(`Expires:     ${voucher.acceptUntil}`);
  stdout(`Signature:   ${voucher.signature}`);
  stdout("Verification verified completely offline with zero network calls.");

  return true;
}

