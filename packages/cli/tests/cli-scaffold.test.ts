import { describe, it, expect, vi } from "vitest";
import { parseArgs, runCli, USAGE } from "../src/index.js";

describe("CLI Scaffold", () => {
  it("parses options and commands correctly", () => {
    const res = parseArgs(["open-book", "--owner=SECRET", "--token", "CTOKEN", "--dry-run", "-v"]);
    expect(res.command).toBe("open-book");
    expect(res.options.owner).toBe("SECRET");
    expect(res.options.token).toBe("CTOKEN");
    expect(res.options["dry-run"]).toBe(true);
    expect(res.options.v).toBe(true);
  });

  it("outputs usage when --help or no command is passed", async () => {
    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);

    const code1 = await runCli([], logger);
    expect(code1).toBe(0);
    expect(logs[0]).toBe(USAGE);

    logs.length = 0;
    const code2 = await runCli(["--help"], logger);
    expect(code2).toBe(0);
    expect(logs[0]).toBe(USAGE);
  });

  it("outputs version when --version is passed", async () => {
    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);

    const code = await runCli(["--version"], logger);
    expect(code).toBe(0);
    expect(logs[0]).toBe("0.1.0");
  });

  it("handles unknown commands gracefully with non-zero exit code", async () => {
    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);

    const code = await runCli(["foobar"], logger);
    expect(code).toBe(1);
    expect(logs[0]).toContain('Unknown command: "foobar"');
  });

  it("routes known commands to their stubs", async () => {
    const commands = ["setup", "open-book", "sign-voucher", "verify", "redeem", "show-book"];
    for (const cmd of commands) {
      const logs: string[] = [];
      const code = await runCli([cmd], (msg) => logs.push(msg));
      expect(code).toBe(0);
      expect(logs[0]).toContain(`${cmd} command`);
    }
  });
});

