import type { OfflineVoucher } from "@kerfvault/sdk";
import {
  type StoredVoucherRecord,
  type IReaderStorage,
  IndexedDBReaderStorage,
} from "./storage";

export interface RelaySubmitResult {
  success: boolean;
  txHash?: string;
  ledgerSequence?: number;
  error?: string;
}

export interface BatchRedeemResult {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    id: string;
    success: boolean;
    txHash?: string;
    error?: string;
  }>;
}

export interface RelayClientOptions {
  relayUrl?: string;
  customFetch?: typeof fetch;
  customFactory?: IDBFactory;
}

export function getDefaultRelayUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_RELAY_URL) {
    return process.env.NEXT_PUBLIC_RELAY_URL.replace(/\/+$/, "");
  }
  return "http://localhost:4002";
}

/**
 * Sends a single offline voucher to the KerfVault fee-paying relay service (/redeem).
 */
export async function submitVoucherToRelay(
  voucher: OfflineVoucher,
  options?: RelayClientOptions
): Promise<RelaySubmitResult> {
  const relayBase = options?.relayUrl || getDefaultRelayUrl();
  const fetchFn = options?.customFetch || fetch;

  const payload = {
    bookId: voucher.bookId.toString(),
    noteIndex: voucher.noteIndex,
    merchant: voucher.merchant,
    amount: voucher.amount.toString(),
    cap: voucher.cap.toString(),
    acceptUntil: Number(voucher.acceptUntil),
    signature: voucher.signature,
  };

  try {
    const response = await fetchFn(`${relayBase}/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg =
        data.details || data.error || `Relay rejected voucher with status ${response.status}`;
      return {
        success: false,
        error: errorMsg,
      };
    }

    return {
      success: true,
      txHash: data.txHash,
      ledgerSequence: data.ledgerSequence,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Redeems an offline voucher stored in reader IndexedDB by updating status to PendingRelay,
 * calling the relay service, and updating status to RedeemedOnChain (or resetting on error).
 */
export async function redeemQueuedVoucher(
  record: StoredVoucherRecord,
  options?: RelayClientOptions
): Promise<RelaySubmitResult> {
  const storage = new IndexedDBReaderStorage(options?.customFactory);

  // Transition to PendingRelay
  try {
    await storage.updateVoucherStatus(record.id, "PendingRelay");
  } catch {
    // If update fails, continue with submission attempt
  }

  const result = await submitVoucherToRelay(record.voucher, options);

  if (result.success && result.txHash) {
    await storage.updateVoucherStatus(record.id, "RedeemedOnChain", {
      txHash: result.txHash,
    });
  } else {
    // Revert status back to AcceptedOffline with error detail recorded
    await storage.updateVoucherStatus(record.id, "AcceptedOffline", {
      reason: result.error,
    });
  }

  return result;
}

/**
 * Sequentially submits all queued offline vouchers to the relay service.
 */
export async function redeemAllQueuedVouchers(
  vouchers: StoredVoucherRecord[],
  options?: RelayClientOptions
): Promise<BatchRedeemResult> {
  const queued = vouchers.filter(
    (v) => v.status === "AcceptedOffline" || v.status === "PendingRelay"
  );

  const results: BatchRedeemResult["results"] = [];
  let succeeded = 0;
  let failed = 0;

  for (const record of queued) {
    const res = await redeemQueuedVoucher(record, options);
    if (res.success) {
      succeeded++;
      results.push({
        id: record.id,
        success: true,
        txHash: res.txHash,
      });
    } else {
      failed++;
      results.push({
        id: record.id,
        success: false,
        error: res.error,
      });
    }
  }

  return {
    total: queued.length,
    succeeded,
    failed,
    results,
  };
}
