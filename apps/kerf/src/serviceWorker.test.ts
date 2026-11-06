import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Service Worker and App Shell Airplane Mode Cache", () => {
  const swPath = path.resolve(__dirname, "../public/sw.js");

  it("verifies that public/sw.js exists and is non-empty", () => {
    expect(fs.existsSync(swPath)).toBe(true);
    const content = fs.readFileSync(swPath, "utf-8");
    expect(content.length).toBeGreaterThan(100);
  });

  it("ensures public/sw.js precaches the app shell and /pay route", () => {
    const content = fs.readFileSync(swPath, "utf-8");
    expect(content).toContain("kerfvault-shopper-v1");
    expect(content).toContain('"/pay"');
    expect(content).toContain('"/"');
    expect(content).toContain('"/manifest.json"');
    expect(content).toContain('"/icon.svg"');
  });

  it("ensures public/sw.js includes navigation fallback logic for airplane mode", () => {
    const content = fs.readFileSync(swPath, "utf-8");
    expect(content).toContain("request.mode === \"navigate\"");
    expect(content).toContain('caches.match("/pay")');
    expect(content).toContain('caches.match("/")');
  });

  it("ensures public/sw.js bypasses external RPC and Horizon endpoints", () => {
    const content = fs.readFileSync(swPath, "utf-8");
    expect(content).toContain("stellar.org");
    expect(content).toContain("friendbot");
  });

  it("verifies manifest.json defines standalone PWA configuration", () => {
    const manifestPath = path.resolve(__dirname, "../public/manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    expect(manifest.name).toBe("Kerfvault Shopper");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
  });
});

