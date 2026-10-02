#!/usr/bin/env tsx
/**
 * scripts/dev-all.ts
 *
 * Starts the Next.js dev server and the background job worker as sibling
 * processes. Both inherit stdio so their log lines appear in the same terminal.
 *
 * Install `concurrently` for a richer experience:
 *   npm install --save-dev concurrently
 * and replace this script with:
 *   "dev:all": "concurrently \"npm run dev\" \"npm run worker\""
 */

import { spawn } from "node:child_process";

function launch(cmd: string, args: string[], label: string) {
  const proc = spawn(cmd, args, { stdio: "inherit", shell: true });
  proc.on("error", (err) => {
    console.error(`[${label}] failed to start:`, err.message);
  });
  proc.on("exit", (code) => {
    console.log(`[${label}] exited with code ${code ?? "?"}`);
    process.exit(code ?? 1);
  });
  return proc;
}

console.log("[dev:all] Starting Next.js dev server and job worker...");
console.log("[dev:all] Tip: install 'concurrently' for a richer parallel dev experience.");

const next = launch("npm", ["run", "dev"], "next");
const worker = launch("npm", ["run", "worker"], "worker");

process.on("SIGINT", () => {
  next.kill("SIGINT");
  worker.kill("SIGINT");
});
process.on("SIGTERM", () => {
  next.kill("SIGTERM");
  worker.kill("SIGTERM");
});
