import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Infrastructure & Environment Audit", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const expectedContractId = "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE";
  const expectedTokenAddress = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
  const expectedPassphrase = "Test SDF Network ; September 2015";

  describe("Environment Configuration Files (.env.example)", () => {
    const requiredEnvFiles = [
      path.join(rootDir, ".env.example"),
      path.join(rootDir, "apps/kerf/.env.example"),
      path.join(rootDir, "apps/reader/.env.example"),
      path.join(rootDir, "services/indexer/.env.example"),
      path.join(rootDir, "services/relay/.env.example"),
    ];

    it("ensures all deployed apps and backend services have an .env.example file", () => {
      for (const filePath of requiredEnvFiles) {
        expect(
          fs.existsSync(filePath),
          `Missing environment template file: ${path.relative(rootDir, filePath)}`
        ).toBe(true);
      }
    });

    it("verifies deployed contract ID consistency across environment templates", () => {
      for (const filePath of requiredEnvFiles) {
        const content = fs.readFileSync(filePath, "utf-8");
        expect(content).not.toContain("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        expect(
          content,
          `File ${path.relative(rootDir, filePath)} must contain deployed contract ID`
        ).toContain(expectedContractId);
      }
    });

    it("verifies Stellar Testnet network passphrase consistency", () => {
      for (const filePath of requiredEnvFiles) {
        const content = fs.readFileSync(filePath, "utf-8");
        expect(
          content,
          `File ${path.relative(rootDir, filePath)} must specify Testnet passphrase`
        ).toContain(expectedPassphrase);
      }
    });

    it("verifies Native SAC token address in frontend app configs", () => {
      const frontendEnvFiles = [
        path.join(rootDir, "apps/kerf/.env.example"),
        path.join(rootDir, "apps/reader/.env.example"),
      ];

      for (const filePath of frontendEnvFiles) {
        const content = fs.readFileSync(filePath, "utf-8");
        expect(content).toContain(expectedTokenAddress);
      }
    });

    it("verifies docker-compose.yml environment targets deployed contract", () => {
      const composePath = path.join(rootDir, "docker-compose.yml");
      expect(fs.existsSync(composePath)).toBe(true);
      const content = fs.readFileSync(composePath, "utf-8");
      expect(content).toContain(expectedContractId);
      expect(content).toContain(expectedPassphrase);
      expect(content).toContain("4001:4001");
      expect(content).toContain("4002:4002");
    });
  });

  describe("Security Response Headers Audit (vercel.json)", () => {
    const vercelConfigs = [
      path.join(rootDir, "apps/kerf/vercel.json"),
      path.join(rootDir, "apps/reader/vercel.json"),
    ];

    it("ensures both frontend applications have vercel.json configurations", () => {
      for (const configPath of vercelConfigs) {
        expect(
          fs.existsSync(configPath),
          `Missing vercel configuration: ${path.relative(rootDir, configPath)}`
        ).toBe(true);
      }
    });

    it("enforces mandatory security headers across frontend deployments", () => {
      for (const configPath of vercelConfigs) {
        const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        expect(parsed.headers).toBeInstanceOf(Array);

        const wildcardHeaderRule = parsed.headers.find(
          (h: { source: string }) => h.source === "/(.*)"
        );
        expect(wildcardHeaderRule).toBeDefined();

        const headersMap = new Map<string, string>(
          wildcardHeaderRule.headers.map((h: { key: string; value: string }) => [h.key, h.value])
        );

        expect(headersMap.get("X-Frame-Options")).toBe("DENY");
        expect(headersMap.get("X-Content-Type-Options")).toBe("nosniff");
        expect(headersMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
      }
    });

    it("ensures reader application explicitly permits camera access via permissions header", () => {
      const readerVercelPath = path.join(rootDir, "apps/reader/vercel.json");
      const parsed = JSON.parse(fs.readFileSync(readerVercelPath, "utf-8"));
      const wildcardRule = parsed.headers.find(
        (h: { source: string }) => h.source === "/(.*)"
      );
      expect(wildcardRule).toBeDefined();

      const headersMap = new Map<string, string>(
        wildcardRule.headers.map((h: { key: string; value: string }) => [h.key, h.value])
      );
      expect(headersMap.get("Permissions-Policy")).toBe("camera=(self)");

      const nextConfigPath = path.join(rootDir, "apps/reader/next.config.ts");
      const nextConfigContent = fs.readFileSync(nextConfigPath, "utf-8");
      expect(nextConfigContent).toContain('key: "Permissions-Policy"');
      expect(nextConfigContent).toContain('value: "camera=(self)"');
    });

    it("verifies root README documents live demo endpoints, scope table, and testnet warning", () => {
      const readmePath = path.join(rootDir, "README.md");
      const readmeContent = fs.readFileSync(readmePath, "utf-8");

      expect(readmeContent).toContain("## Live Demo");
      expect(readmeContent).toContain("Strictly Testnet & Pre-Audit");
      expect(readmeContent).toContain("http://localhost:3000");
      expect(readmeContent).toContain("http://localhost:3001");
      expect(readmeContent).toContain("http://localhost:4002");
      expect(readmeContent).toContain("CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE");
      expect(readmeContent).toContain("Demo Slice Scope: Built vs Deferred Matrix");
    });

    it("verifies live demo runbook exists with checklist, script, fallback plan, and FAQs", () => {
      const runbookPath = path.join(rootDir, "docs/DEMO_RUNBOOK.md");
      expect(fs.existsSync(runbookPath)).toBe(true);

      const runbookContent = fs.readFileSync(runbookPath, "utf-8");
      expect(runbookContent).toContain("# Kerfvault Live Demonstration Runbook");
      expect(runbookContent).toContain("Pre-Flight Checklist");
      expect(runbookContent).toContain("5-Minute Live Demo Script");
      expect(runbookContent).toContain("Fallback & Incident Response Procedures");
      expect(runbookContent).toContain("Likely Questions & Honest Answers");
      expect(runbookContent).toContain("pnpm reset-demo");
    });

    it("verifies roadmap marks S1-S7 complete and details second-half waves", () => {
      const roadmapPath = path.join(rootDir, "docs/ROADMAP.md");
      expect(fs.existsSync(roadmapPath)).toBe(true);

      const roadmapContent = fs.readFileSync(roadmapPath, "utf-8");
      expect(roadmapContent).toContain("First Half: Demo Slice Execution (Phases S1–S7) — COMPLETE");
      expect(roadmapContent).toContain("Phase S1: Foundation, Spec Freeze");
      expect(roadmapContent).toContain("Phase S7: Integration, Live Demo & Runbook");
      expect(roadmapContent).toContain("Second Half: Production & Hardening Roadmap (Waves 8–13)");
      expect(roadmapContent).toContain("Wave 8: Smart Contract Hardening, Reclaim Flow & TTL Management");
      expect(roadmapContent).toContain("Wave 13: External Audits, Formal Verification & Mainnet Launch");
    });
  });
});
