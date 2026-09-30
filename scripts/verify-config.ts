/**
 * Configuration verification.
 *
 * Prints the safe configuration metadata and asserts that nothing key shaped
 * appears in it. Useful before a demonstration, and useful as a standing check
 * that the status object has not grown a field that discloses too much.
 *
 * Run with: npx tsx scripts/verify-config.ts
 */

import { getOpenAIStatus } from "../src/server/config/load-openai-config";
import { getPublicHealth, getRuntimeStatus } from "../src/server/config/runtime";
import { isDatabaseReady, resolveDbPath } from "../src/db/client";

function main(): void {
  const status = getOpenAIStatus();
  const health = getPublicHealth();
  const runtime = getRuntimeStatus();

  console.log("=== OpenAI configuration, safe metadata only ===");
  console.log(`  configured          ${status.configured}`);
  console.log(`  source              ${status.source}`);
  console.log(`  variable name       ${status.variableName ?? "none"}`);
  console.log(`  live mode available ${status.liveModeAvailable}`);
  if (status.reason) console.log(`  reason              ${status.reason}`);

  console.log("\n=== Demo mode ===");
  console.log(`  requested           ${runtime.demoMode.requested}`);
  console.log(`  effective           ${runtime.demoMode.mode}`);
  console.log(`  downgraded          ${runtime.demoMode.downgraded}`);
  if (runtime.demoMode.reason) console.log(`  reason              ${runtime.demoMode.reason}`);

  console.log("\n=== Resolved models (not yet probed against the account) ===");
  console.log(`  primary             ${runtime.models.primary} (${runtime.models.provenance.primary})`);
  console.log(`  fast                ${runtime.models.fast} (${runtime.models.provenance.fast})`);
  console.log(`  deep                ${runtime.models.deep} (${runtime.models.provenance.deep})`);
  console.log(`  realtime            ${runtime.models.realtime ?? "unavailable"}`);
  console.log(`  embedding           ${runtime.models.embedding ?? "unavailable"}`);

  console.log("\n=== Database ===");
  console.log(`  path                ${resolveDbPath()}`);
  console.log(`  seeded              ${isDatabaseReady()}`);

  // The assertion that matters: no key material anywhere in what we expose.
  const serialised = JSON.stringify({ status, health, models: runtime.models });
  const leaks: string[] = [];
  if (/sk-[A-Za-z0-9_-]{8,}/.test(serialised)) leaks.push("an OpenAI key shaped string");
  if (/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/.test(serialised)) leaks.push("a bearer token");
  if (/\bapiKey\b\s*[:=]\s*"[^"]{8,}"/.test(serialised)) leaks.push("an apiKey field with a value");

  console.log("\n=== Leak check on the exposed metadata ===");
  if (leaks.length > 0) {
    console.error(`  FAILED: found ${leaks.join(", ")}`);
    process.exit(1);
  }
  console.log("  PASSED: no key material in the status, health or model metadata.");

  if (!isDatabaseReady()) {
    console.log("\nNext: run npm run db:migrate and npm run db:seed.");
  }
}

main();
