/**
 * Runs the evaluation suite and writes docs/EVALUATION_REPORT.md.
 *
 * Structural evaluations always run and need no model. Grounded evaluations
 * run only in live mode, cost a small amount, and are advisory.
 *
 * Run with:       npx tsx scripts/evaluate.ts
 * Including live: NFR_DEMO_MODE=live npx tsx scripts/evaluate.ts
 */

import { writeFileSync } from "node:fs";
import { closeDb, isDatabaseReady } from "../src/db/client";
import {
  collectKnownIdentifiers,
  formatEvaluationReport,
  gradeGroundedAnswer,
  GROUNDED_PROBES,
  runStructuralEvaluations,
  type GroundedResult,
} from "../src/agents/evaluations/suite";
import { getResolvedDemoMode } from "../src/server/config/runtime";
import { requireScenarioState } from "../src/scenario/engine/state";
import { runManagerTurn } from "../src/agents/manager";
import type { ToolContext } from "../src/agents/tools/runtime";

const ROLE_HOLDERS: Record<string, string> = {
  tprm: "P-002",
  rcsa: "P-003",
  "control-assurance": "P-004",
  "incident-resilience": "P-005",
  "regulatory-change": "P-006",
  "nfr-governance": "P-001",
};

async function main(): Promise<void> {
  if (!isDatabaseReady()) {
    console.error("The scenario is not seeded. Run npm run db:migrate and npm run db:seed first.");
    process.exit(1);
  }

  console.log("Running structural evaluations ...");
  const structural = runStructuralEvaluations();

  for (const result of structural) {
    console.log(`  ${result.passed ? "pass" : "FAIL"}  ${result.name}`);
    if (!result.passed) {
      for (const failure of result.failures.slice(0, 5)) console.log(`          ${failure}`);
    }
  }

  const grounded: GroundedResult[] = [];
  const mode = getResolvedDemoMode();

  if (mode.mode === "live") {
    console.log("\nRunning grounded evaluations against a live model ...");
    const known = collectKnownIdentifiers();
    const state = requireScenarioState();

    for (const probe of GROUNDED_PROBES) {
      const context: ToolContext = {
        runId: state.runId,
        roleId: probe.roleId,
        autonomyLevel: state.autonomyLevel,
        actingUserId: ROLE_HOLDERS[probe.roleId] ?? "P-001",
        atMoment: state.currentMoment,
        sessionId: `eval-${probe.id}`,
        actorKind: "manager-agent",
        language: "en",
      };

      try {
        const turn = await runManagerTurn({ context, userInput: probe.question });
        const result = gradeGroundedAnswer(probe, turn.output, known);
        grounded.push(result);
        console.log(`  ${result.passed ? "pass" : "FAIL"}  ${probe.id}`);
        if (result.citedUnknown.length > 0) {
          console.log(`          invented identifiers: ${result.citedUnknown.join(", ")}`);
        }
        if (result.forbiddenMatches.length > 0) {
          console.log(`          forbidden assertion: ${result.forbiddenMatches.join("; ")}`);
        }
      } catch (error) {
        console.log(`  SKIP  ${probe.id}: ${error instanceof Error ? error.message : "failed"}`);
      }
    }
  } else {
    console.log(
      `\nGrounded evaluations skipped: the application is in ${mode.mode} mode. Set NFR_DEMO_MODE=live to include them.`,
    );
  }

  const report = formatEvaluationReport(structural, grounded);
  writeFileSync("docs/EVALUATION_REPORT.md", report, "utf8");
  console.log("\nReport written to docs/EVALUATION_REPORT.md");

  const structuralFailures = structural.filter((r) => !r.passed).length;
  closeDb();

  if (structuralFailures > 0) {
    console.error(`\n${structuralFailures} structural evaluation(s) failed.`);
    process.exit(1);
  }
  console.log("\nEvery structural evaluation passed.");
}

main().catch((error: unknown) => {
  console.error("The evaluation run failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
