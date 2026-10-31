import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { checkRateLimit } from "./rateLimit.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4002;

export const RedeemRequestSchema = z.object({
  bookId: z.union([z.string(), z.number()]),
  noteIndex: z.number().int().nonnegative(),
  merchant: z.string().min(50).max(60),
  amount: z.string(),
  cap: z.string(),
  acceptUntil: z.number().int().positive(),
  signature: z.string().min(64),
});

export type RedeemRequestBody = z.infer<typeof RedeemRequestSchema>;

export function handleRequest(req: IncomingMessage, res: ServerResponse): void {
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
    req.on("data", (chunk: Buffer) => {
      rawBody += chunk.toString("utf-8");
    });

    req.on("end", () => {
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

        // Return 501 Not Implemented stub
        res.writeHead(501, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "Not Implemented",
            message: "TODO: On-chain redemption transaction submission will be implemented in Wave 4",
          })
        );
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

export const server = createServer(handleRequest);

if (process.env.NODE_ENV !== "test" && process.argv[1]?.endsWith("index.js")) {
  server.listen(PORT, () => {
    console.log(`[relay] Redemption relay service listening on port ${PORT}`);
  });
}

