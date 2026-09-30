#!/usr/bin/env node
/**
 * The combined audit gate.
 *
 * Runs every non-interactive quality check in sequence and reports a single
 * verdict. This is the command to run before claiming the product is in a
 * shippable state.
 *
 * Checks are ordered cheapest first, so a copy violation fails in seconds
 * rather than after a full browser test run. Each check reports independently,
 * and the script continues after a failure so one run tells you everything
 * that is wrong rather than only the first thing.
 *
 * Run with: npm run audit:all
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const checks = [
  {
    name: "Copy standard (no em dash, no mojibake, no placeholder copy)",
    command: "node",
    args: ["scripts/check-no-emdash.mjs"],
    required: true,
  },
  {
    name: "Secret scan (source, bundles, exports)",
    command: "node",
    args: ["scripts/scan-secrets.mjs"],
    required: true,
  },
  {
    name: "TypeScript strict typecheck",
    command: "npx",
    args: ["tsc", "--noEmit"],
    required: true,
  },
  {
    name: "Unit tests",
    command: "npx",
    args: ["vitest", "run", "tests/unit"],
    required: true,
  },
  {
    name: "Integration tests",
    command: "npx",
    args: ["vitest", "run", "tests/integration"],
    required: true,
    skipIf: () => !existsSync("tests/integration"),
    skipReason: "No integration test directory is present.",
  },
  {
    /*
     * Seed depth is a gate because a thin scenario is the failure mode that
     * makes a prototype feel like a mock-up, and because the checks that must
     * be zero are the ones that prove nothing reserved for a human has been
     * pre-decided in the seeded state.
     */
    name: "Seed depth and structural expectations",
    command: "npx",
    args: ["tsx", "scripts/verify-seed-depth.ts"],
    required: true,
    skipIf: () => !existsSync("data/nfr-workos.db"),
    skipReason: "No seeded database is present. Run npm run db:migrate and npm run db:seed.",
  },
  {
    /*
     * The structural evaluations are part of the gate, not an optional extra.
     * They include the check that no Swiss scoped content asserts an EU
     * instrument applies, which is the single most damaging factual error this
     * product could make to its audience. A check that never runs is not a
     * control.
     */
    name: "Evaluation suite (grounding, refusals, jurisdiction separation)",
    command: "npx",
    args: ["tsx", "scripts/evaluate.ts"],
    required: true,
    skipIf: () => !existsSync("data/nfr-workos.db"),
    skipReason: "No seeded database is present. Run npm run db:migrate and npm run db:seed.",
  },
  {
    name: "End to end and visual tests",
    command: "npx",
    args: ["playwright", "test", "tests/e2e"],
    required: false,
    skipIf: () => !existsSync("tests/e2e"),
    skipReason: "No end to end test directory is present.",
  },
];

function run() {
  const results = [];
  const started = Date.now();

  for (const check of checks) {
    if (check.skipIf && check.skipIf()) {
      console.log(`\n=== SKIP: ${check.name} ===`);
      console.log(`  ${check.skipReason}`);
      results.push({ name: check.name, status: "skipped", required: check.required });
      continue;
    }

    console.log(`\n=== ${check.name} ===`);
    const outcome = spawnSync(check.command, check.args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    const ok = outcome.status === 0;
    results.push({
      name: check.name,
      status: ok ? "passed" : "failed",
      required: check.required,
      exitCode: outcome.status,
    });
  }

  const elapsed = Math.round((Date.now() - started) / 1000);

  console.log("\n".padEnd(72, "="));
  console.log("AUDIT SUMMARY");
  console.log("".padEnd(72, "="));

  for (const result of results) {
    const label =
      result.status === "passed" ? "PASS" : result.status === "skipped" ? "SKIP" : "FAIL";
    const suffix = result.required ? "" : "  (not required)";
    console.log(`  ${label}  ${result.name}${suffix}`);
  }

  const requiredFailures = results.filter((r) => r.status === "failed" && r.required);
  const optionalFailures = results.filter((r) => r.status === "failed" && !r.required);

  console.log("".padEnd(72, "="));
  console.log(`Completed in ${elapsed}s.`);

  if (requiredFailures.length > 0) {
    console.error(`\n${requiredFailures.length} required check(s) failed. The build is not clean.`);
    process.exit(1);
  }

  if (optionalFailures.length > 0) {
    console.log(
      `\n${optionalFailures.length} optional check(s) failed. Review them before presenting.`,
    );
    process.exit(0);
  }

  console.log("\nEvery check passed.");
}

run();
