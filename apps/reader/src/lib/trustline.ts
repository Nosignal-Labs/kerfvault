import {
  Asset,
  Operation,
  TransactionBuilder,
  Keypair,
  rpc,
} from "@stellar/stellar-sdk";

export const DEFAULT_ASSET_CODE = "KVUSD";
export const DEFAULT_ASSET_ISSUER = "GCOQSUSRFKOLBTEMY5THMHIMLOLILMI6WI4R6XGT3LJ2YGHXFTADSTLD";
export const DEFAULT_HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";
export const DEFAULT_SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
export const DEFAULT_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";

export interface TrustlineStatus {
  accountExists: boolean;
  hasTrustline: boolean;
  assetCode: string;
  assetIssuer: string;
  balance?: string;
  xlmBalance?: string;
  error?: string;
}

export interface HorizonBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
}

export interface HorizonAccountResponse {
  id: string;
  balances: HorizonBalance[];
}

/**
 * Checks whether the merchant account exists on Horizon and holds an active trustline for the test asset.
 */
export async function checkTrustlineStatus(
  merchantAddress: string,
  options?: {
    horizonUrl?: string;
    assetCode?: string;
    assetIssuer?: string;
    fetchFn?: typeof fetch;
  }
): Promise<TrustlineStatus> {
  const horizonUrl = options?.horizonUrl || DEFAULT_HORIZON_URL;
  const assetCode = options?.assetCode || DEFAULT_ASSET_CODE;
  const assetIssuer = options?.assetIssuer || DEFAULT_ASSET_ISSUER;
  const fetcher = options?.fetchFn || globalThis.fetch;

  try {
    const res = await fetcher(`${horizonUrl}/accounts/${merchantAddress}`);
    if (res.status === 404) {
      return {
        accountExists: false,
        hasTrustline: false,
        assetCode,
        assetIssuer,
      };
    }

    if (!res.ok) {
      throw new Error(`Horizon account lookup failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as HorizonAccountResponse;
    const balances = Array.isArray(data.balances) ? data.balances : [];

    const nativeBal = balances.find((b) => b.asset_type === "native");
    const assetTrustline = balances.find(
      (b) => b.asset_code === assetCode && b.asset_issuer === assetIssuer
    );

    return {
      accountExists: true,
      hasTrustline: Boolean(assetTrustline),
      assetCode,
      assetIssuer,
      balance: assetTrustline?.balance || "0",
      xlmBalance: nativeBal?.balance || "0",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to query trustline status.";
    return {
      accountExists: false,
      hasTrustline: false,
      assetCode,
      assetIssuer,
      error: msg,
    };
  }
}

/**
 * Requests testnet funding from Friendbot if merchant account is unfunded.
 */
export async function fundMerchantViaFriendbot(
  merchantAddress: string,
  friendbotUrl = "https://friendbot.stellar.org",
  fetcher = globalThis.fetch
): Promise<void> {
  const url = `${friendbotUrl}?addr=${encodeURIComponent(merchantAddress)}`;
  const res = await fetcher(url);
  if (!res.ok) {
    const text = await res.text();
    if (!text.includes("already funded")) {
      throw new Error(`Friendbot funding error: ${res.status} ${text}`);
    }
  }
}

/**
 * Constructs, signs, and submits a ChangeTrust transaction establishing the asset trustline.
 */
export async function addMerchantTrustline(
  merchantSecret: string,
  options?: {
    rpcUrl?: string;
    networkPassphrase?: string;
    assetCode?: string;
    assetIssuer?: string;
    server?: rpc.Server;
  }
): Promise<{ txHash: string }> {
  const rpcUrl = options?.rpcUrl || DEFAULT_SOROBAN_RPC_URL;
  const networkPassphrase = options?.networkPassphrase || DEFAULT_PASSPHRASE;
  const assetCode = options?.assetCode || DEFAULT_ASSET_CODE;
  const assetIssuer = options?.assetIssuer || DEFAULT_ASSET_ISSUER;
  const server = options?.server || new rpc.Server(rpcUrl);

  const kp = Keypair.fromSecret(merchantSecret);
  const account = await server.getAccount(kp.publicKey());
  const asset = new Asset(assetCode, assetIssuer);

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

  return {
    txHash: sendRes.hash,
  };
}

