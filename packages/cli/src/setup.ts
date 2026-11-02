import fs from "node:fs";
import path from "node:path";
import {
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
  rpc,
} from "@stellar/stellar-sdk";

export interface DemoKeys {
  ownerPublicKey: string;
  ownerSecret: string;
  merchantPublicKey: string;
  merchantSecret: string;
  voucherPublicKey: string;
  voucherSecret: string;
}

export interface SetupOptions {
  keysFile?: string;
  deploymentFile?: string;
  rpcUrl?: string;
  networkPassphrase?: string;
  friendbotUrl?: string;
  skipTrustline?: boolean;
}

export async function fundWithFriendbot(
  publicKey: string,
  friendbotUrl = "https://friendbot.stellar.org"
): Promise<void> {
  const url = `${friendbotUrl}?addr=${encodeURIComponent(publicKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Friendbot funding failed for ${publicKey}: ${res.status} ${text}`);
  }
}

export async function addTrustline(
  accountSecret: string,
  assetCode: string,
  issuer: string,
  server: rpc.Server,
  networkPassphrase: string
): Promise<string> {
  const kp = Keypair.fromSecret(accountSecret);
  const account = await server.getAccount(kp.publicKey());
  const asset = new Asset(assetCode, issuer);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(kp);
  const sendRes = await server.sendTransaction(prepared);
  if (sendRes.status === "ERROR") {
    throw new Error(
      `Failed to submit changeTrust transaction: ${
        sendRes.errorResult?.toXDR("base64") ?? "unknown"
      }`
    );
  }
  return sendRes.hash;
}

export async function runSetup(
  options: SetupOptions = {},
  stdout: (msg: string) => void = console.log,
  deps?: {
    funder?: (addr: string) => Promise<void>;
    server?: rpc.Server;
  }
): Promise<DemoKeys> {
  const keysPath = path.resolve(process.cwd(), options.keysFile || ".demo-keys.json");
  const deploymentPath = path.resolve(
    process.cwd(),
    options.deploymentFile || "deployments/testnet.json"
  );

  let rpcUrl = options.rpcUrl || "https://soroban-testnet.stellar.org";
  let networkPassphrase =
    options.networkPassphrase || "Test SDF Network ; September 2015";
  let assetInfo: { code: string; issuer: string } | undefined;

  if (fs.existsSync(deploymentPath)) {
    try {
      const dep = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      if (dep.rpcUrl) rpcUrl = dep.rpcUrl;
      if (dep.networkPassphrase) networkPassphrase = dep.networkPassphrase;
      if (dep.asset?.code && dep.asset?.issuer) {
        assetInfo = { code: dep.asset.code, issuer: dep.asset.issuer };
      }
    } catch {
      // Use defaults if deployment file is unreadable
    }
  }

  // Generate demo keypairs
  const owner = Keypair.random();
  const merchant = Keypair.random();
  const voucher = Keypair.random();

  const keys: DemoKeys = {
    ownerPublicKey: owner.publicKey(),
    ownerSecret: owner.secret(),
    merchantPublicKey: merchant.publicKey(),
    merchantSecret: merchant.secret(),
    voucherPublicKey: voucher.publicKey(),
    voucherSecret: voucher.secret(),
  };

  stdout("==> Generating demo keypairs...");
  stdout(`Owner public address:    ${keys.ownerPublicKey}`);
  stdout(`Merchant public address: ${keys.merchantPublicKey}`);
  stdout(`Voucher signing key:     ${keys.voucherPublicKey}`);

  const funder = deps?.funder || ((addr: string) => fundWithFriendbot(addr, options.friendbotUrl));
  stdout("==> Funding accounts via Friendbot on testnet...");
  await funder(keys.ownerPublicKey);
  await funder(keys.merchantPublicKey);
  stdout("Accounts funded successfully.");

  if (assetInfo && !options.skipTrustline) {
    stdout(`==> Adding trustline for test asset ${assetInfo.code}:${assetInfo.issuer}...`);
    const server = deps?.server || new rpc.Server(rpcUrl);
    try {
      await addTrustline(keys.ownerSecret, assetInfo.code, assetInfo.issuer, server, networkPassphrase);
      await addTrustline(keys.merchantSecret, assetInfo.code, assetInfo.issuer, server, networkPassphrase);
      stdout("Trustlines established for Owner and Merchant.");
    } catch (err) {
      stdout(`Trustline note: ${(err as Error).message}`);
    }
  }

  // Save keys file safely with restricted permissions
  fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2), { mode: 0o600 });
  stdout(`==> Demo keys securely saved to ${path.basename(keysPath)} (gitignored).`);
  stdout("==> Setup complete.");

  return keys;
}

