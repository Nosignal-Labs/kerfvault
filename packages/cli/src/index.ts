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
    case "setup":
      stdout("setup command: ready for execution");
      return 0;
    case "open-book":
      stdout("open-book command: ready for execution");
      return 0;
    case "sign-voucher":
      stdout("sign-voucher command: ready for execution");
      return 0;
    case "verify":
      stdout("verify command: ready for execution");
      return 0;
    case "redeem":
      stdout("redeem command: ready for execution");
      return 0;
    case "show-book":
      stdout("show-book command: ready for execution");
      return 0;
    default:
      stdout(`Unknown command: "${parsed.command}". Run "kerfvault --help" for available commands.`);
      return 1;
  }
}

