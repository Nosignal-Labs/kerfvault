export const DEFAULT_TESTNET_TOKEN =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

export const STROOPS_PER_XLM = 10_000_000n;

export interface DenominationPreset {
  id: string;
  name: string;
  denominations: number[];
}

export const DENOMINATION_PRESETS: DenominationPreset[] = [
  { id: "small", name: "Small Change", denominations: [1, 2, 5, 5, 10] },
  { id: "standard", name: "Standard", denominations: [5, 10, 20, 50] },
  { id: "merchant", name: "High Value", denominations: [25, 50, 100] },
];

export interface DeadlinePreset {
  days: number;
  label: string;
}

export const DEADLINE_PRESETS: DeadlinePreset[] = [
  { days: 1, label: "24 Hours (1 Day)" },
  { days: 7, label: "1 Week (7 Days)" },
  { days: 14, label: "2 Weeks (14 Days)" },
  { days: 30, label: "1 Month (30 Days)" },
];

export interface BookConfiguration {
  tokenAddress: string;
  denominations: number[];
  deadlineDays: number;
  deadlineTimestamp: number;
  totalXlm: number;
  totalStroops: bigint;
  denominationsInStroops: bigint[];
}

/**
 * Converts human XLM amounts (e.g. 5.5) to integer stroops (55,000,000).
 */
export function xlmToStroops(xlm: number): bigint {
  if (xlm <= 0 || !Number.isFinite(xlm)) {
    throw new Error(`Invalid XLM amount: ${xlm}`);
  }
  // Use toFixed(7) to format without scientific notation (e.g. 1e-7 -> 0.0000001)
  const fixed = xlm.toFixed(7);
  const [intPart, fracPart = ""] = fixed.split(".");
  const paddedFrac = fracPart.padEnd(7, "0").slice(0, 7);
  return BigInt(intPart) * STROOPS_PER_XLM + BigInt(paddedFrac);
}

/**
 * Calculates future UNIX deadline timestamp in seconds from current system clock.
 */
export function calculateDeadlineTimestamp(days: number, fromDate: Date = new Date()): number {
  const currentSeconds = Math.floor(fromDate.getTime() / 1000);
  const additionalSeconds = Math.max(1, Math.round(days)) * 86_400;
  return currentSeconds + additionalSeconds;
}

/**
 * Validates note denominations, deadline, and optional wallet balance sufficiency.
 */
export function validateBookConfig(params: {
  tokenAddress: string;
  denominations: number[];
  deadlineDays: number;
  walletBalance?: string | null;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const trimmedToken = params.tokenAddress.trim();
  if (!trimmedToken) {
    errors.push("Token address is required.");
  } else if (!/^C[A-Z0-9]{55}$/.test(trimmedToken)) {
    errors.push("Token address must be a valid 56-character Stellar C-address (Contract SAC).");
  }

  if (!params.denominations || params.denominations.length === 0) {
    errors.push("At least one note denomination must be selected.");
  } else {
    if (params.denominations.length > 50) {
      errors.push("Maximum 50 notes allowed per book.");
    }
    for (const d of params.denominations) {
      if (typeof d !== "number" || !Number.isFinite(d) || d <= 0) {
        errors.push(`Note denomination must be a positive number; got '${d}'.`);
        break;
      }
    }
  }

  if (
    typeof params.deadlineDays !== "number" ||
    !Number.isFinite(params.deadlineDays) ||
    params.deadlineDays < 1
  ) {
    errors.push("Redeem deadline must be at least 1 day.");
  } else if (params.deadlineDays > 365) {
    errors.push("Redeem deadline cannot exceed 365 days.");
  }

  const totalXlm = params.denominations.reduce((sum, d) => sum + (d > 0 ? d : 0), 0);

  if (params.walletBalance !== undefined && params.walletBalance !== null) {
    const bal = parseFloat(params.walletBalance);
    if (!Number.isNaN(bal) && bal < totalXlm) {
      errors.push(
        `Insufficient wallet balance: book requires ${totalXlm.toFixed(2)} XLM, but wallet has ${bal.toFixed(2)} XLM.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
