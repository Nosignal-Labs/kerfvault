import type { IncomingMessage, ServerResponse } from "node:http";

export const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
];

export function parseAllowedOrigins(envValue?: string): string[] {
  if (!envValue || envValue.trim() === "") {
    return DEFAULT_ALLOWED_ORIGINS;
  }
  return envValue
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export interface CorsOptions {
  allowedOrigins?: string[];
}

/**
 * Handles CORS headers and preflight requests for the indexer.
 * Returns true if request was handled (e.g. preflight completed or rejected),
 * or false if request processing should continue.
 */
export function handleCors(
  req: IncomingMessage,
  res: ServerResponse,
  options?: CorsOptions
): boolean {
  const rawOrigin = req.headers.origin;
  const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;

  if (!origin) {
    return false;
  }

  const allowed =
    options?.allowedOrigins ?? parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);

  const normalizedOrigin = origin.trim().replace(/\/+$/, "");
  const isAllowed = allowed.includes(normalizedOrigin);

  if (!isAllowed) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Forbidden: Origin not allowed by CORS policy",
      })
    );
    return true;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  return false;
}
