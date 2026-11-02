#!/usr/bin/env node
import { runCli } from "../dist/index.js";

runCli(process.argv.slice(2)).catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});

