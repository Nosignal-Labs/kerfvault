import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

describe("Demo Reset Tool (scripts/reset-demo.mjs)", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const scenarioPath = path.join(rootDir, ".demo-scenario.json");

  afterEach(() => {
    if (fs.existsSync(scenarioPath)) {
      fs.unlinkSync(scenarioPath);
    }
  });

  it("successfully generates fresh demo identities and configuration in dry-run mode", () => {
    const scriptPath = path.join(rootDir, "scripts/reset-demo.mjs");
    execSync(`node "${scriptPath}" --dry-run`, {
      encoding: "utf-8",
      cwd: rootDir,
    });

    expect(fs.existsSync(scenarioPath)).toBe(true);
    const result = JSON.parse(fs.readFileSync(scenarioPath, "utf-8"));

    expect(result).toBeDefined();
    expect(result.contractId).toBe("CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE");
    expect(result.tokenAddress).toBe("CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC");
    expect(result.assetCode).toBe("XLM");

    // Verify shopper, merchant, and relay identities
    expect(result.accounts.shopper.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
    expect(result.accounts.shopper.secretKey).toMatch(/^S[A-Z0-9]{55}$/);

    expect(result.accounts.merchant.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
    expect(result.accounts.merchant.secretKey).toMatch(/^S[A-Z0-9]{55}$/);

    expect(result.accounts.relay.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
    expect(result.accounts.relay.secretKey).toMatch(/^S[A-Z0-9]{55}$/);
  }, 20000);

  it("can be executed via CLI with --dry-run", () => {
    const scriptPath = path.join(rootDir, "scripts/reset-demo.mjs");
    const output = execSync(`node "${scriptPath}" --dry-run`, {
      encoding: "utf-8",
      cwd: rootDir,
    });

    expect(output).toContain("KerfVault Demo State Reset Tool");
    expect(output).toContain("Generated fresh demo identities");
    expect(output).toContain("dry-run/offline mode");
    expect(output).toContain("Saved clean scenario configuration");
  }, 20000);

  it("displays help when invoked with --help", () => {
    const scriptPath = path.join(rootDir, "scripts/reset-demo.mjs");
    const output = execSync(`node "${scriptPath}" --help`, {
      encoding: "utf-8",
      cwd: rootDir,
    });

    expect(output).toContain("Usage: node scripts/reset-demo.mjs [options]");
    expect(output).toContain("--dry-run");
  }, 20000);
});

