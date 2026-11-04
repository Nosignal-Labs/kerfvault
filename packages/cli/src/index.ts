import { runSetup, type SetupOptions } from "./setup.js";
import {
  runOpenBook,
  runShowBook,
  type OpenBookCliOptions,
  type ShowBookCliOptions,
} from "./book.js";
import {
  runSignVoucher,
  runVerifyVoucher,
  type SignVoucherCliOptions,
  type VerifyCliOptions,
} from "./voucher.js";
import { runRedeemVoucher, type RedeemCliOptions } from "./redeem.js";

export * from "./setup.js";
export * from "./book.js";
export * from "./voucher.js";
export * from "./redeem.js";

export interface ParsedArgs {
  command?: string;
  options: Record<string, string | boolean>;
  positionals: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const options: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const equalsIdx = arg.indexOf("=");
      if (equalsIdx !== -1) {
        const key = arg.slice(2, equalsIdx);
        const val = arg.slice(equalsIdx + 1);
        options[key] = val;
      } else {
        const key = arg.slice(2);
        if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
          options[key] = argv[i + 1];
          i++;
        } else {
          options[key] = true;
        }
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      options[key] = true;
    } else {
      positionals.push(arg);
    }
    i++;
  }

  const command = positionals[0];
  return {
    command,
    options,
    positionals: positionals.slice(1),
  };
}

export const USAGE = `Kerfvault CLI - Command-line interface and testnet demo driver

Usage:
  kerfvault <command> [options]

Commands:
  setup           Fund demo accounts and establish asset trustlines
  open-book       Lock escrow funds and open a new note book on-chain
  sign-voucher    Create and sign an offline voucher
  verify          Verify a signed voucher offline without network calls
  redeem          Submit a voucher for on-chain contract redemption
  show-book       Query book and note status from contract storage

Options:
  --help, -h      Show this help message
  --version, -v   Show CLI version
`;

export async function runCli(
  argv: string[],
  stdout: (msg: string) => void = console.log
): Promise<number> {
  const parsed = parseArgs(argv);

  if (parsed.options.version || parsed.options.v || parsed.command === "version") {
    stdout("0.1.0");
    return 0;
  }

  if (
    !parsed.command ||
    parsed.options.help ||
    parsed.options.h ||
    parsed.command === "help"
  ) {
    stdout(USAGE);
    return 0;
  }

  switch (parsed.command) {
    case "setup": {
      const options: SetupOptions = {
        keysFile: typeof parsed.options.keys === "string" ? parsed.options.keys : undefined,
        deploymentFile:
          typeof parsed.options.deployment === "string"
            ? parsed.options.deployment
            : undefined,
        rpcUrl: typeof parsed.options.rpc === "string" ? parsed.options.rpc : undefined,
        skipTrustline: Boolean(parsed.options["skip-trustline"]),
      };
      await runSetup(options, stdout);
      return 0;
    }
    case "open-book": {
      const options: OpenBookCliOptions = {
        ownerSecret:
          typeof parsed.options.owner === "string"
            ? parsed.options.owner
            : undefined,
        voucherKey:
          typeof parsed.options["voucher-key"] === "string"
            ? (parsed.options["voucher-key"] as string)
            : undefined,
        tokenAddress:
          typeof parsed.options.token === "string"
            ? parsed.options.token
            : undefined,
        denominations:
          typeof parsed.options.denoms === "string"
            ? parsed.options.denoms
            : undefined,
        redeemDeadline:
          typeof parsed.options.deadline === "string"
            ? parsed.options.deadline
            : undefined,
        keysFile:
          typeof parsed.options.keys === "string"
            ? parsed.options.keys
            : undefined,
        deploymentFile:
          typeof parsed.options.deployment === "string"
            ? parsed.options.deployment
            : undefined,
      };
      await runOpenBook(options, stdout);
      return 0;
    }
    case "sign-voucher": {
      const options: SignVoucherCliOptions = {
        bookId:
          typeof parsed.options.book === "string"
            ? parsed.options.book
            : undefined,
        noteIndex:
          typeof parsed.options.note === "string"
            ? parsed.options.note
            : undefined,
        merchant:
          typeof parsed.options.merchant === "string"
            ? parsed.options.merchant
            : undefined,
        amount:
          typeof parsed.options.amount === "string"
            ? parsed.options.amount
            : undefined,
        cap:
          typeof parsed.options.cap === "string"
            ? parsed.options.cap
            : undefined,
        acceptUntil:
          typeof parsed.options["accept-until"] === "string"
            ? (parsed.options["accept-until"] as string)
            : undefined,
        voucherSecret:
          typeof parsed.options["voucher-secret"] === "string"
            ? (parsed.options["voucher-secret"] as string)
            : undefined,
        contractId:
          typeof parsed.options["contract-id"] === "string"
            ? (parsed.options["contract-id"] as string)
            : undefined,
        keysFile:
          typeof parsed.options.keys === "string"
            ? parsed.options.keys
            : undefined,
        deploymentFile:
          typeof parsed.options.deployment === "string"
            ? parsed.options.deployment
            : undefined,
      };
      await runSignVoucher(options, stdout);
      return 0;
    }
    case "verify": {
      const options: VerifyCliOptions = {
        voucher:
          typeof parsed.options.voucher === "string"
            ? parsed.options.voucher
            : parsed.positionals[0],
        voucherKey:
          typeof parsed.options["voucher-key"] === "string"
            ? (parsed.options["voucher-key"] as string)
            : undefined,
        expectedContractId:
          typeof parsed.options["contract-id"] === "string"
            ? (parsed.options["contract-id"] as string)
            : undefined,
        merchantAddress:
          typeof parsed.options.merchant === "string"
            ? parsed.options.merchant
            : undefined,
        keysFile:
          typeof parsed.options.keys === "string"
            ? parsed.options.keys
            : undefined,
        deploymentFile:
          typeof parsed.options.deployment === "string"
            ? parsed.options.deployment
            : undefined,
      };
      const ok = await runVerifyVoucher(options, stdout);
      return ok ? 0 : 1;
    }
    case "redeem": {
      const options: RedeemCliOptions = {
        voucher:
          typeof parsed.options.voucher === "string"
            ? parsed.options.voucher
            : parsed.positionals[0],
        submitterSecret:
          typeof parsed.options.submitter === "string"
            ? parsed.options.submitter
            : undefined,
        keysFile:
          typeof parsed.options.keys === "string"
            ? parsed.options.keys
            : undefined,
        deploymentFile:
          typeof parsed.options.deployment === "string"
            ? parsed.options.deployment
            : undefined,
      };
      await runRedeemVoucher(options, stdout);
      return 0;
    }
    case "show-book": {
      const options: ShowBookCliOptions = {
        bookId:
          typeof parsed.options.book === "string"
            ? parsed.options.book
            : parsed.positionals[0],
        deploymentFile:
          typeof parsed.options.deployment === "string"
            ? parsed.options.deployment
            : undefined,
      };
      await runShowBook(options, stdout);
      return 0;
    }
    default:
      stdout(`Unknown command: "${parsed.command}". Run "kerfvault --help" for available commands.`);
      return 1;
  }
}

