/**
 * Exercises the governed execution path and the reset guarantee end to end.
 *
 * Kept as a script rather than a test because it is a hands-on check of the
 * two claims that matter most in a demonstration: that a human decision
 * produces real state changes, and that reset genuinely restores the original
 * day. The integration suite asserts both; this prints them so a person can
 * look at them.
 *
 * Run with: npx tsx scripts/probe-reset.ts
 */

import { closeDb, getSqlite } from "../src/db/client";
import { recordDecisionAndExecute } from "../src/scenario/engine/decide";
import { resetScenarioDay } from "../src/scenario/engine/reset";

interface Snapshot {
  decided: number;
  approvals: number;
  receipts: number;
  sessionAudit: number;
  preExistingAudit: number;
  sessionActions: number;
  monitoring: number;
  assessments: number;
}

function count(sql: string): number {
  const row = getSqlite().prepare(sql).get() as { n: number } | undefined;
  return row?.n ?? 0;
}

function snapshot(): Snapshot {
  return {
    decided: count("select count(*) as n from decisions where status != 'open'"),
    approvals: count("select count(*) as n from approvals"),
    receipts: count("select count(*) as n from execution_receipt_lines"),
    sessionAudit: count("select count(*) as n from audit_events where pre_existing = 0"),
    preExistingAudit: count("select count(*) as n from audit_events where pre_existing = 1"),
    sessionActions: count("select count(*) as n from actions where created_by_session = 1"),
    monitoring: count("select count(*) as n from monitoring_activations"),
    assessments: count("select count(*) as n from assessments"),
  };
}

function controlRating(): string {
  const row = getSqlite()
    .prepare("select current_effectiveness as e from controls where id = 'CTL-PAY-014'")
    .get() as { e: string } | undefined;
  return row?.e ?? "missing";
}

function show(label: string, snap: Snapshot): void {
  console.log(`\n${label}`);
  console.log(`  decisions decided        ${snap.decided}`);
  console.log(`  approvals granted        ${snap.approvals}`);
  console.log(`  execution receipt lines  ${snap.receipts}`);
  console.log(`  session audit events     ${snap.sessionAudit}`);
  console.log(`  pre-existing audit       ${snap.preExistingAudit}`);
  console.log(`  actions from this run    ${snap.sessionActions}`);
  console.log(`  monitoring activations   ${snap.monitoring}`);
  console.log(`  assessment versions      ${snap.assessments}`);
  console.log(`  CTL-PAY-014 rating       ${controlRating()}`);
}

async function main(): Promise<void> {
  const before = snapshot();
  show("Seeded baseline", before);

  const decision = getSqlite()
    .prepare(
      "select id, title from decisions where role_id = 'rcsa' and judgment_kind = 'control-effectiveness' and status = 'open' limit 1",
    )
    .get() as { id: string; title: string } | undefined;

  if (!decision) {
    console.log("\nNo open control effectiveness decision was found for the rcsa role.");
    closeDb();
    return;
  }

  // The option with the longest consequence chain is the showcase path.
  const option = getSqlite()
    .prepare(
      "select id, label, json_array_length(consequences) as n from decision_options where decision_id = ? order by n desc limit 1",
    )
    .get(decision.id) as { id: string; label: string; n: number };

  console.log(`\nDeciding ${decision.id}: ${decision.title}`);
  console.log(`  chosen option: ${option.label}`);
  console.log(`  declared consequences: ${option.n}`);

  const result = await recordDecisionAndExecute({
    decisionId: decision.id,
    optionId: option.id,
    rationale:
      "Probe rationale, recorded to exercise the governed execution path end to end and to confirm that the receipt is assembled from completed mutations.",
    rationaleConfirmed: true,
  });

  console.log(`\n  ok: ${result.ok}`);
  console.log(`  ${result.message}`);
  console.log("\n  Execution receipt:");
  for (const statement of result.receiptStatements) console.log(`    ${statement}`);
  if (result.blockedReasons.length > 0) {
    console.log("\n  Not executed:");
    for (const reason of result.blockedReasons) console.log(`    ${reason}`);
  }

  const after = snapshot();
  show("After the decision", after);

  /*
   * The confirmation check, exercised directly against the engine rather than
   * through the server action, because the guard used to live only in the
   * action and that was a real defect.
   */
  const withheld = await recordDecisionAndExecute({
    decisionId: decision.id,
    optionId: option.id,
    rationale: "This should never be recorded.",
    rationaleConfirmed: false,
  });
  console.log(`\nConfirmation withheld: ok=${withheld.ok}, reason=${withheld.blockedReasons.join(", ")}`);

  resetScenarioDay();
  const reset = snapshot();
  show("After reset", reset);

  const restored =
    reset.decided === before.decided &&
    reset.approvals === 0 &&
    reset.receipts === 0 &&
    reset.sessionActions === before.sessionActions &&
    reset.monitoring === before.monitoring &&
    reset.assessments === before.assessments &&
    reset.preExistingAudit === before.preExistingAudit &&
    controlRating() === "fully-effective";

  console.log(`\nDecision produced real state changes: ${after.receipts > 0 && after.decided > before.decided}`);
  console.log(`Unconfirmed rationale executed nothing: ${!withheld.ok}`);
  console.log(`Reset restored the original day: ${restored}`);

  closeDb();
  process.exit(restored && after.receipts > 0 && !withheld.ok ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error("The probe failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
