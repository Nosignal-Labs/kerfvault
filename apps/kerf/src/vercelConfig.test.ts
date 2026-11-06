import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Shopper App Vercel Configuration & Deployment Documentation", () => {
  const vercelJsonPath = path.resolve(__dirname, "../vercel.json");
  const envExamplePath = path.resolve(__dirname, "../.env.example");
  const deployDocPath = path.resolve(__dirname, "../../../docs/DEPLOY_SHOPPER.md");

  it("verifies vercel.json exists and defines nextjs framework with SW headers", () => {
    expect(fs.existsSync(vercelJsonPath)).toBe(true);
    const raw = fs.readFileSync(vercelJsonPath, "utf-8");
    const config = JSON.parse(raw);

    expect(config.framework).toBe("nextjs");
    expect(Array.isArray(config.headers)).toBe(true);

    const swHeader = config.headers.find((h: { source: string }) => h.source === "/sw.js");
    expect(swHeader).toBeDefined();

    const allowed = swHeader.headers.find(
      (h: { key: string }) => h.key === "Service-Worker-Allowed"
    );
    expect(allowed?.value).toBe("/");
  });

  it("verifies .env.example defines testnet variables and contract ID", () => {
    expect(fs.existsSync(envExamplePath)).toBe(true);
    const content = fs.readFileSync(envExamplePath, "utf-8");

    expect(content).toContain("NEXT_PUBLIC_STELLAR_NETWORK=testnet");
    expect(content).toContain("NEXT_PUBLIC_CONTRACT_ID=CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE");
    expect(content).toContain("NEXT_PUBLIC_TOKEN_ADDRESS=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC");
  });

  it("verifies deploy documentation covers Vercel setup and airplane mode verification", () => {
    expect(fs.existsSync(deployDocPath)).toBe(true);
    const doc = fs.readFileSync(deployDocPath, "utf-8");

    expect(doc).toContain("Deploying Kerfvault Shopper App to Vercel");
    expect(doc).toContain("NEXT_PUBLIC_STELLAR_NETWORK");
    expect(doc).toContain("Airplane Mode Checklist");
  });
});

