import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { checkRateLimit } from "./rateLimit.js";
import { buildRedeemTransaction } from "./tx.js";
import { submitRedeemTransaction, type SubmitRedeemConfig } from "./submit.js";

export * from "./rateLimit.js";
export * from "./tx.js";
export * from "./submit.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4002;

/**
 * Maximum request body size capped at 16 KB (16,384 bytes).
 */
export const MAX_PAYLOAD_BYTES = 16 * 1024;

/**
 * Regex for standard 56-character Stellar public address starting with 'G'.
 */
const STELLAR_ACCOUNT_REGEX = /^G[A-Z2-7]{55}$/;

/**
 * Strict schema for incoming structured voucher redemption requests.
 * Rejects raw XDR or unrecognized transaction fields.
 */
export const RedeemRequestSchema = z
  .object({
    bookId: z.union([
      z.string().regex(/^\d+$/, "bookId must be a positive integer"),
      z.number().int().positive(),
    ]),
    noteIndex: z.number().int().min(0).max(65535),
    merchant: z
      .string()
      .regex(STELLAR_ACCOUNT_REGEX, "merchant must be a valid 56-character Stellar G-address"),
    amount: z
      .string()
      .regex(/^[1-9]\d*$/, "amount must be a positive integer in stroops"),
    cap: z
      .string()
      .regex(/^[1-9]\d*$/, "cap must be a positive integer in stroops"),
    acceptUntil: z.number().int().positive(),
    signature: z
      .string()
      .refine(
        (val) =>
          /^[0-9a-fA-F]{128}$/.test(val) ||
          (val.length === 88 && /^[A-Za-z0-9+/=]+$/.test(val)),
        "signature must be a 64-byte Ed25519 signature in hex (128 characters) or base64"
      ),
  })
  .strict()
  .refine(
    (data) => {
      try {
        return BigInt(data.amount) <= BigInt(data.cap);
      } catch {
        return false;
      }
    },
    {
      message: "Redemption amount cannot exceed signed cap",
      path: ["amount"],
    }
  );

export type RedeemRequestBody = z.infer<typeof RedeemRequestSchema>;

export function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config?: SubmitRedeemConfig
): void {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";
  const clientIp = req.socket.remoteAddress ?? "127.0.0.1";

  if (method === "GET" && url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
    return;
  }

  if (method === "POST" && url === "/redeem") {
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Rate limit exceeded" }));
      return;
    }

    let rawBody = "";
    let bodyBytes = 0;
    let exceededSize = false;

    req.on("data", (chunk: Buffer) => {
      if (exceededSize) return;
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_PAYLOAD_BYTES) {
        exceededSize = true;
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Payload Too Large: request body exceeds 16KB limit",
          })
        );
        req.destroy();
        return;
      }
      rawBody += chunk.toString("utf-8");
    });

    req.on("end", async () => {
      if (exceededSize) return;

      try {
        const parsed = JSON.parse(rawBody || "{}");
        const validation = RedeemRequestSchema.safeParse(parsed);

        if (!validation.success) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Invalid request payload",
              issues: validation.error.issues,
            })
          );
          return;
        }

        try {
          const result = await submitRedeemTransaction(validation.data, config);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (submitErr) {
          const message = (submitErr as Error).message;
          const status = message.includes("missing") ? 500 : 400;
          res.writeHead(status, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Redemption transaction failed",
              details: message,
            })
          );
        }
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Malformed JSON" }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
}

export function createRelayServer(config?: SubmitRedeemConfig) {
  return createServer((req, res) => handleRequest(req, res, config));
}

export const server = createRelayServer();

if (process.env.NODE_ENV !== "test" && process.argv[1]?.endsWith("index.js")) {
  server.listen(PORT, () => {
    console.log(`[relay] Redemption relay service listening on port ${PORT}`);
  });
}
