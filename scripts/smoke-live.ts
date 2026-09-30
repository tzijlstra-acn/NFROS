/**
 * Minimal live API smoke test.
 *
 * Makes one small server side call, records only the model name, status,
 * latency and token counts, and never prints secret metadata. Falls back to
 * reporting safe mode when the call fails.
 *
 * Run with: NFR_DEMO_MODE=live npx tsx scripts/smoke-live.ts
 */

import { probeModelAvailability, runLiveSmokeTest } from "../src/server/openai/client";
import { getResolvedDemoMode } from "../src/server/config/runtime";

async function main(): Promise<void> {
  const mode = getResolvedDemoMode();
  console.log(`Requested mode: ${mode.requested}. Effective mode: ${mode.mode}.`);
  if (mode.reason) console.log(`Reason: ${mode.reason}`);

  const models = await probeModelAvailability();
  console.log(`\nModel availability probed: ${models.availabilityChecked}`);
  console.log(`  primary    ${models.primary} (${models.provenance.primary})`);
  console.log(`  fast       ${models.fast} (${models.provenance.fast})`);
  console.log(`  deep       ${models.deep} (${models.provenance.deep})`);
  console.log(`  realtime   ${models.realtime ?? "unavailable"} (${models.provenance.realtime})`);
  console.log(`  embedding  ${models.embedding ?? "unavailable"} (${models.provenance.embedding})`);

  const result = await runLiveSmokeTest();
  console.log("\nSmoke test:");
  console.log(`  ok          ${result.ok}`);
  console.log(`  model       ${result.model ?? "none"}`);
  console.log(`  status      ${result.status}`);
  console.log(`  latency     ${result.latencyMs} ms`);
  console.log(`  tokens in   ${result.inputTokens}`);
  console.log(`  tokens out  ${result.outputTokens}`);
  if (result.error) console.log(`  error       ${result.error}`);

  /*
   * The leak check covers masked forms too, as defence in depth behind the
   * redactor.
   *
   * An earlier version looked only for an unmasked key and missed the case
   * that actually occurred: a rejected key echoed back by the provider as
   * sk-proj followed by asterisks and four real trailing characters, which
   * discloses both the suffix and the length.
   */
  const serialised = JSON.stringify(result);
  const leakPatterns: RegExp[] = [
    /sk-[A-Za-z0-9_-]{8,}/,
    /sk-(?:proj-|svcacct-)?[A-Za-z0-9_*.-]*[*•]{4,}/,
  ];
  if (leakPatterns.some((pattern) => pattern.test(serialised))) {
    console.error("\nFAILED: the smoke test result contains key shaped material.");
    process.exit(1);
  }
  console.log("\nThe result contains no key material.");
  process.exit(result.ok ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error("The smoke test could not run.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
