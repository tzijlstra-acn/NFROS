/**
 * Fixture for the os-console-quality journeys. Writes to an ISOLATED database
 * only: it refuses to run unless NFR_DB_PATH names a file outside the
 * repository, so it can never touch the shared demonstration database.
 *
 *   dead-letter   dispatches one approved change to the GRC simulator while
 *                 that simulator is unavailable in this process, through the
 *                 real dispatcher, so a real dead letter exists for the
 *                 console's Retry. The server's own simulator stays
 *                 available, so the retry there reaches it.
 *   language:de   sets the scenario language to German (and language:en back).
 *
 * Usage: NFR_DB_PATH=<scratch db> npx tsx tests/e2e/support/os-console-quality-fixture.ts dead-letter
 */

import { resolve, sep } from "node:path";

async function main(): Promise<void> {
  const path = process.env.NFR_DB_PATH ?? "";
  const repo = resolve(process.cwd());
  if (path.length === 0 || resolve(path).startsWith(`${repo}${sep}`)) {
    console.error("Refused: NFR_DB_PATH must name an isolated database outside the repository.");
    process.exit(1);
  }

  const command = process.argv[2] ?? "";
  const { getSqlite } = await import("@/db/client");

  if (command === "language:de" || command === "language:en") {
    getSqlite().prepare("update scenario_runs set language = ?").run(command.slice(9));
    console.log(`Scenario language set to ${command.slice(9)}.`);
    return;
  }

  if (command === "dead-letter") {
    const runtime = await import("@/integrations/runtime/IntegrationRuntime");
    const simulated = await import("@/integrations/connectors/simulated");
    const { CI_GRC } = await import("@/integrations/seed");
    const { requireScenarioState, switchRole } = await import("@/scenario/engine/state");
    const { grantApproval } = await import("@/scenario/engine/decide");
    const { fingerprintPayload } = await import("@/server/security/authority");

    switchRole("rcsa");
    const state = requireScenarioState();
    const payload = {
      decisionId: "DEC-2026-0772",
      assessmentId: "ASM-PAY-2026-Q3",
      residualRisk: "high",
      conclusion: `Console retry fixture ${Date.now()}.`,
    };
    const approvalId = grantApproval({
      decisionId: "DEC-2026-0772",
      toolName: "updateAssessment",
      payloadFingerprint: fingerprintPayload("updateAssessment", payload),
      rationale: "I own this conclusion.",
      rationaleConfirmed: true,
    });
    simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, false);
    const result = await runtime.dispatchCommand(
      {
        runId: state.runId,
        connectorInstanceId: CI_GRC,
        commandKind: "updateAssessment",
        toolName: "updateAssessment",
        actingUserId: "P-003",
        roleId: "rcsa",
        actorKind: "human",
        autonomyLevel: state.autonomyLevel,
        approvalId,
        decisionId: "DEC-2026-0772",
        sourceCanonicalType: "Assessment",
        sourceCanonicalId: "ASM-PAY-2026-Q3",
        targetExternalType: "grc.assessment",
        payload,
        intentStatement: "Record the Q3 assessment conclusion in the GRC platform",
        atMoment: state.currentMoment,
      },
      { jitter: runtime.noJitter },
    );
    console.log(`COMMAND=${result.commandId ?? ""} STATUS=${result.status}`);
    return;
  }

  console.error("Name a fixture: dead-letter, language:de or language:en.");
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
