export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfterSeconds?: number;
}

interface ClientRecord {
  timestamps: number[];
}

export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute sliding window
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

/**
 * In-memory sliding-window rate limiter per client IP.
 *
 * Operational limitations & architectural boundaries:
 * 1. Scope: Local to this single Node.js process. Clustered or multi-instance deployments
 *    require a distributed backing store (e.g., Redis) for shared token tracking.
 * 2. Persistence: Volatile; process restarts or deployments reset rate limit buckets.
 * 3. Memory management: Stale client entries are automatically pruned every 60 seconds
 *    to prevent memory leakage from transient IPs.
 */
export class InMemoryRateLimiter {
  private clients = new Map<string, ClientRecord>();
  private lastCleanup = Date.now();
  private readonly cleanupIntervalMs = 60 * 1000;

  check(clientIp: string, options?: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    const windowMs = options?.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
    const maxRequests = options?.maxRequests ?? DEFAULT_RATE_LIMIT_MAX_REQUESTS;

    this.maybeCleanup(now, windowMs);

    let record = this.clients.get(clientIp);
    if (!record) {
      record = { timestamps: [] };
      this.clients.set(clientIp, record);
    }

    // Prune timestamps older than sliding window
    const windowStart = now - windowMs;
    record.timestamps = record.timestamps.filter((t) => t > windowStart);

    if (record.timestamps.length >= maxRequests) {
      const oldestInWindow = record.timestamps[0];
      const resetTime = oldestInWindow + windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfterSeconds,
      };
    }

    record.timestamps.push(now);
    const oldestInWindow = record.timestamps[0];
    const resetTime = oldestInWindow + windowMs;

    return {
      allowed: true,
      remaining: maxRequests - record.timestamps.length,
      resetTime,
    };
  }

  private maybeCleanup(now: number, windowMs: number): void {
    if (now - this.lastCleanup > this.cleanupIntervalMs) {
      this.lastCleanup = now;
      const cutoff = now - windowMs * 2;
      for (const [ip, record] of this.clients.entries()) {
        record.timestamps = record.timestamps.filter((t) => t > cutoff);
        if (record.timestamps.length === 0) {
          this.clients.delete(ip);
        }
      }
    }
  }

  reset(): void {
    this.clients.clear();
  }
}

export const rateLimiter = new InMemoryRateLimiter();

export function checkRateLimit(
  clientIp: string,
  options?: RateLimitOptions
): RateLimitResult {
  return rateLimiter.check(clientIp, options);
}
