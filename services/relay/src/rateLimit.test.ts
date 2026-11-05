import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryRateLimiter,
  checkRateLimit,
  rateLimiter,
} from "./rateLimit.js";

describe("Relay Rate Limiter (Per-IP Throttling)", () => {
  beforeEach(() => {
    rateLimiter.reset();
    vi.restoreAllMocks();
  });

  it("permits requests within the configured allowance", () => {
    const ip = "192.168.1.100";
    const opts = { windowMs: 10000, maxRequests: 3 };

    const r1 = checkRateLimit(ip, opts);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(ip, opts);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(ip, opts);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("throttles requests when limit is exceeded with retryAfter", () => {
    const ip = "10.0.0.5";
    const opts = { windowMs: 60000, maxRequests: 2 };

    expect(checkRateLimit(ip, opts).allowed).toBe(true);
    expect(checkRateLimit(ip, opts).allowed).toBe(true);

    const throttled = checkRateLimit(ip, opts);
    expect(throttled.allowed).toBe(false);
    expect(throttled.remaining).toBe(0);
    expect(throttled.retryAfterSeconds).toBeGreaterThan(0);
    expect(throttled.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("isolates client IPs independently", () => {
    const ip1 = "1.1.1.1";
    const ip2 = "2.2.2.2";
    const opts = { windowMs: 60000, maxRequests: 1 };

    expect(checkRateLimit(ip1, opts).allowed).toBe(true);
    expect(checkRateLimit(ip1, opts).allowed).toBe(false);

    // ip2 should still be allowed despite ip1 being throttled
    expect(checkRateLimit(ip2, opts).allowed).toBe(true);
  });

  it("resets limit once window expires", () => {
    const limiter = new InMemoryRateLimiter();
    const ip = "172.16.0.1";
    let simulatedNow = 1000000;
    vi.spyOn(Date, "now").mockImplementation(() => simulatedNow);

    const opts = { windowMs: 5000, maxRequests: 2 };

    expect(limiter.check(ip, opts).allowed).toBe(true);
    expect(limiter.check(ip, opts).allowed).toBe(true);
    expect(limiter.check(ip, opts).allowed).toBe(false);

    // Advance time beyond windowMs
    simulatedNow += 5500;

    const res = limiter.check(ip, opts);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(1);
  });
});
