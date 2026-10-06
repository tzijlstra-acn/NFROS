/**
 * The decision engine after J20 and J21, and the five-part workspace.
 *
 * J20 was the product's central claim failing in the browser: a Third-Party
 * Risk Manager recorded a decision, it was written as decided, every
 * consequence was refused by the authority gate because the approvals were
 * granted under the Operational Risk Partner's role, and the analyst was told
 * nothing. J21 was the receipt vanishing on refresh, with a pseudo line in its
 * count. These tests are written to reproduce each failure and prove it gone,
 * for both flagship roles, and to break the new rules: a decision of another
 * role, a change the gate would refuse, a change that fails while executing,
 * an approval of a payload that is not the one that would execute, and a
 * second recording of the same decision.
 *
 * Runs against a temporary database. See `support/harness.ts`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase, rowCount } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import {
  grantApproval,
  planDecisionOption,
  recordDecisionAndExecute,
} from "@/scenario/engine/decide";
import { requireScenarioState, setAutonomyLevel, setMoment, switchRole } from "@/scenario/engine/state";
import { executeTool } from "@/agents/tools/runtime";
import { getDecisionOutcome } from "@/db/repositories/decisions";
import { findOsEvent } from "@/features/events/backbone";
import { buildDecisionQueueView } from "@/features/decisions/queue";
import { findRecorded } from "@/features/decisions/model";
import { actionConfirmDecision } from "@/features/decisions/actions";
import type { RoleId } from "@/db/schema/core";

const TPRM_DECISION = "DEC-2026-0741";
/** "Material gap": createIssue, requestEvidenceDocument and activateMonitoring on TP-0042. */
const TPRM_OPTION = "DEC-2026-0741-O1";
const TPRM_HOLDER = "P-002";

const RCSA_DECISION = "DEC-2026-0771";
/** "One causal investigation": requestFactualValidation and createIssue on KRI-PAY-007. */
const RCSA_OPTION = "DEC-2026-0771-O1";
const RCSA_HOLDER = "P-003";

const RATIONALE =
  "The recovery objective is missed by 1 hour 40 minutes on a service that supports an important business service, so this is a material gap.";

/** Tables whose row counts and mutable columns form the "nothing was written" fingerprint. */
const WRITE_TABLES = [
  "approvals",
  "tool_calls",
  "audit_events",
  "execution_receipt_lines",
  "issues",
  "actions",
  "monitoring_activations",
  "collaboration_messages",
  "os_events",
] as const;

function writes(): Record<string, unknown> {
  const counts: Record<string, unknown> = {};
  for (const table of WRITE_TABLES) counts[table] = rowCount(table);
  counts["decisions"] = (
    getSqlite().prepare("select id, status, chosen_option_id as c from decisions order by id").all() as Array<{
      id: string;
      status: string;
      c: string | null;
    }>
  )
    .map((row) => `${row.id}=${row.status}/${row.c ?? ""}`)
    .join("|");
  return counts;
}

function approvalsFor(decisionId: string): Array<{ approver: string; role: string; consumed: number; tool: string }> {
  return getSqlite()
    .prepare(
      "select approved_by_user_id as approver, role_id as role, consumed_at is not null as consumed, tool_name as tool from approvals where decision_id = ? order by approved_at",
    )
    .all(decisionId) as Array<{ approver: string; role: string; consumed: number; tool: string }>;
}

function receiptLines(decisionId: string): number {
  return (
    getSqlite().prepare("select count(*) as n from execution_receipt_lines where decision_id = ?").get(decisionId) as {
      n: number;
    }
  ).n;
}

/** Appends a consequence to a seeded option, to drive a specific failure. */
function appendConsequence(optionId: string, consequence: Record<string, string>): void {
  const row = getSqlite().prepare("select consequences from decision_options where id = ?").get(optionId) as {
    consequences: string;
  };
  const list = JSON.parse(row.consequences) as Array<Record<string, string>>;
  list.push(consequence);
  getSqlite().prepare("update decision_options set consequences = ? where id = ?").run(JSON.stringify(list), optionId);
}

beforeAll(() => {
  createTemporaryDatabase("decision-workspace");
  seedScenario();
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  seedScenario();
  setMoment("07:45");
});

/* ==========================================================================
   J20: the decision executes as the role that owns it
   ========================================================================== */

describe("J20: a decision is executed as its own role, approved by that role's holder", () => {
  it("records a TPRM decision while the scenario's active role is still rcsa, and every change executes", async () => {
    // The V3.3 shell never switches the active role; the seeded day starts as rcsa.
    expect(requireScenarioState().activeRoleId).toBe("rcsa");

    const result = await recordDecisionAndExecute({
      decisionId: TPRM_DECISION,
      optionId: TPRM_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
      actingRoleId: "tprm",
    });

    expect(result.blockedReasons, result.blockedReasons.join("; ")).toStrictEqual([]);
    expect(result.ok).toBe(true);
    expect(result.recorded).toBe(true);
    expect(result.executedCount).toBe(3);
    expect(result.failedCount).toBe(0);

    const approvals = approvalsFor(TPRM_DECISION);
    expect(approvals.length).toBe(3);
    for (const approval of approvals) {
      // The Third-Party Risk Manager, not Marlene Aigner, the Operational Risk Partner.
      expect(approval.approver).toBe(TPRM_HOLDER);
      expect(approval.role).toBe("tprm");
      expect(approval.consumed).toBe(1);
    }

    const decided = getSqlite()
      .prepare("select status, decided_by_user_id as by from decisions where id = ?")
      .get(TPRM_DECISION) as { status: string; by: string };
    expect(decided).toStrictEqual({ status: "decided", by: TPRM_HOLDER });

    const blocked = getSqlite()
      .prepare("select count(*) as n from tool_calls where outcome <> 'executed'")
      .get() as { n: number };
    expect(blocked.n).toBe(0);
    expect(receiptLines(TPRM_DECISION)).toBe(3);
  });

  it("records an RCSA decision while the active role is tprm, approved by the RCSA holder", async () => {
    switchRole("tprm");
    const result = await recordDecisionAndExecute({
      decisionId: RCSA_DECISION,
      optionId: RCSA_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
      actingRoleId: "rcsa",
    });

    expect(result.ok, result.blockedReasons.join("; ")).toBe(true);
    const approvals = approvalsFor(RCSA_DECISION);
    expect(approvals.length).toBe(2);
    expect(approvals.every((approval) => approval.approver === RCSA_HOLDER && approval.role === "rcsa")).toBe(true);
  });

  it("acts as the decision's owner when the caller names no role", async () => {
    // The V1 and V2 server action, and the process engine before it stated a role.
    const result = await recordDecisionAndExecute({
      decisionId: TPRM_DECISION,
      optionId: TPRM_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });
    expect(result.ok, result.blockedReasons.join("; ")).toBe(true);
    expect(approvalsFor(TPRM_DECISION).every((approval) => approval.approver === TPRM_HOLDER)).toBe(true);
  });

  it("still lets a standalone approval follow the active role, which the tool tests rely on", () => {
    switchRole("incident-resilience");
    grantApproval({
      decisionId: RCSA_DECISION,
      toolName: "classifyIncident",
      payloadFingerprint: "f".repeat(32),
      rationale: "Standalone approval.",
      rationaleConfirmed: true,
    });
    expect(approvalsFor(RCSA_DECISION)[0]).toMatchObject({ approver: "P-005", role: "incident-resilience" });
  });
});

/* ==========================================================================
   Refusals before anything is written
   ========================================================================== */

describe("a decision that cannot be executed as approved is refused before anything is written", () => {
  it("refuses a decision recorded as another role", async () => {
    const before = writes();
    const result = await recordDecisionAndExecute({
      decisionId: TPRM_DECISION,
      optionId: TPRM_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
      actingRoleId: "rcsa",
    });

    expect(result.recorded).toBe(false);
    expect(result.refusal).toBe("role-mismatch");
    expect(writes()).toStrictEqual(before);
  });

  it("refuses through the workspace's server action when the route role is not the decision's role", async () => {
    const before = writes();
    const plan = planDecisionOption({ decisionId: TPRM_DECISION, optionId: TPRM_OPTION });
    const result = await actionConfirmDecision({
      roleId: "rcsa",
      decisionId: TPRM_DECISION,
      optionId: TPRM_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
      approvedChanges: (plan?.consequences ?? []).map((entry) => entry.fingerprint ?? ""),
    });
    expect(result.recorded).toBe(false);
    expect(result.message).toContain("belongs to another role");
    expect(writes()).toStrictEqual(before);
  });

  it("refuses when the gate would refuse a change, rather than recording a decision whose changes will not run", async () => {
    // The Third-Party Risk Manager does not hold control.rate.
    appendConsequence(TPRM_OPTION, { kind: "set-control-effectiveness", targetId: "CTL-PAY-014", value: "not-effective" });
    const before = writes();

    const result = await recordDecisionAndExecute({
      decisionId: TPRM_DECISION,
      optionId: TPRM_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
      actingRoleId: "tprm",
    });

    expect(result.recorded).toBe(false);
    expect(result.refusal).toBe("consequence-refused");
    const refused = result.consequences.filter((entry) => entry.code !== null);
    expect(refused.map((entry) => entry.code)).toStrictEqual(["missing-scope"]);
    expect(result.consequences.every((entry) => entry.outcome === "not-attempted")).toBe(true);
    expect(writes()).toStrictEqual(before);
  });

  it("refuses a consequence kind this build cannot execute", async () => {
    appendConsequence(TPRM_OPTION, { kind: "teleport-supplier", targetId: "TP-0042" });
    const before = writes();
    const result = await recordDecisionAndExecute({
      decisionId: TPRM_DECISION,
      optionId: TPRM_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });
    expect(result.refusal).toBe("consequence-refused");
    expect(result.consequences.some((entry) => entry.code === "not-implemented")).toBe(true);
    expect(writes()).toStrictEqual(before);
  });

  it("refuses at an autonomy level that cannot reach a material change", async () => {
    setAutonomyLevel("recommend");
    const before = writes();
    const result = await recordDecisionAndExecute({
      decisionId: TPRM_DECISION,
      optionId: TPRM_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });
    expect(result.refusal).toBe("consequence-refused");
    expect(result.consequences.every((entry) => entry.code === "autonomy-too-low")).toBe(true);
    expect(writes()).toStrictEqual(before);
  });

  it("refuses to record the same decision twice", async () => {
    await recordDecisionAndExecute({
      decisionId: TPRM_DECISION,
      optionId: TPRM_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });
    const before = writes();
    const again = await recordDecisionAndExecute({
      decisionId: TPRM_DECISION,
      optionId: "DEC-2026-0741-O2",
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });
    expect(again.refusal).toBe("already-recorded");
    expect(writes()).toStrictEqual(before);
  });

  it("enforces the rationale minimum on the server, whatever the browser sends", async () => {
    const before = writes();
    const result = await actionConfirmDecision({
      roleId: "tprm",
      decisionId: TPRM_DECISION,
      optionId: TPRM_OPTION,
      rationale: "Material.",
      rationaleConfirmed: true,
      approvedChanges: [],
    });
    expect(result.recorded).toBe(false);
    expect(result.message).toContain("20 characters");
    expect(writes()).toStrictEqual(before);
  });
});

/* ==========================================================================
   The approval binds to the exact payload the person saw
   ========================================================================== */

describe("an approval binds to the exact payload", () => {
  it("plans the exact payload, fingerprint and gate verdict for every change", () => {
    const plan = planDecisionOption({ decisionId: TPRM_DECISION, optionId: TPRM_OPTION });
    expect(plan?.roleId).toBe("tprm");
    expect(plan?.approverUserId).toBe(TPRM_HOLDER);
    expect(plan?.consequences.map((entry) => entry.toolName)).toStrictEqual([
      "createIssue",
      "requestEvidenceDocument",
      "activateMonitoring",
    ]);
    for (const entry of plan?.consequences ?? []) {
      expect(entry.fingerprint).toMatch(/^[a-f0-9]{32}$/);
      expect(entry.payload?.["decisionId"]).toBe(TPRM_DECISION);
      expect(entry.verdict).toStrictEqual({ allowed: true, requiresApproval: true });
    }
  });

  it("refuses a confirmation whose approved fingerprints are not the changes that would execute", async () => {
    const plan = planDecisionOption({ decisionId: TPRM_DECISION, optionId: TPRM_OPTION });
    const approved = (plan?.consequences ?? []).map((entry) => entry.fingerprint ?? "");
    const before = writes();

    // One change approved short: the person did not approve all three.
    const short = await recordDecisionAndExecute({
      decisionId: TPRM_DECISION,
      optionId: TPRM_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
      actingRoleId: "tprm",
      approvedFingerprints: approved.slice(0, 2),
    });
    expect(short.refusal).toBe("payload-changed");

    // The seeded change itself moved after the person reviewed it.
    getSqlite()
      .prepare("update decision_options set consequences = replace(consequences, 'Weekly review', 'Monthly review') where id = ?")
      .run(TPRM_OPTION);
    const moved = await recordDecisionAndExecute({
      decisionId: TPRM_DECISION,
      optionId: TPRM_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
      actingRoleId: "tprm",
      approvedFingerprints: approved,
    });
    expect(moved.refusal).toBe("payload-changed");
    expect(writes()).toStrictEqual(before);
  });

  it("binds each approval row to the fingerprint the person approved", async () => {
    const plan = planDecisionOption({ decisionId: TPRM_DECISION, optionId: TPRM_OPTION });
    const approved = (plan?.consequences ?? []).map((entry) => entry.fingerprint ?? "");
    const result = await actionConfirmDecision({
      roleId: "tprm",
      decisionId: TPRM_DECISION,
      optionId: TPRM_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
      approvedChanges: approved,
    });
    expect(result.recorded).toBe(true);
    expect(result.ok).toBe(true);
    const stored = (
      getSqlite()
        .prepare("select payload_fingerprint as f from approvals where decision_id = ? order by approved_at")
        .all(TPRM_DECISION) as Array<{ f: string }>
    ).map((row) => row.f);
    expect(stored).toStrictEqual(approved);
  });
});

/* ==========================================================================
   Partial failure: executed and not executed, stated separately
   ========================================================================== */

describe("a change that fails while executing", () => {
  it("leaves the decision recorded and states the executed and the failed changes separately", async () => {
    // The gate allows it (createIssue is in scope); the handler fails because the control does not exist.
    appendConsequence(RCSA_OPTION, { kind: "set-control-effectiveness", targetId: "CTL-DOES-NOT-EXIST", value: "not-effective" });

    const result = await recordDecisionAndExecute({
      decisionId: RCSA_DECISION,
      optionId: RCSA_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
      actingRoleId: "rcsa",
    });

    expect(result.recorded).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.executedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    const failed = result.consequences.find((entry) => entry.outcome !== "executed");
    expect(failed).toMatchObject({ kind: "set-control-effectiveness", targetId: "CTL-DOES-NOT-EXIST", outcome: "failed" });
    expect(failed?.reason).toBeTruthy();
    expect(result.message).toContain("1 did not execute");

    // The outcome is on the record, not only in the response.
    const outcome = getDecisionOutcome(RCSA_DECISION);
    expect(outcome.source).toBe("outcome-record");
    expect(outcome.consequences.filter((entry) => entry.outcome === "executed")).toHaveLength(2);
    expect(outcome.consequences.filter((entry) => entry.outcome === "failed")).toHaveLength(1);
  });

  it("shows the same split in the workspace after a refresh, with a warning rather than a success mark", async () => {
    appendConsequence(RCSA_OPTION, { kind: "set-control-effectiveness", targetId: "CTL-DOES-NOT-EXIST", value: "not-effective" });
    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION,
      optionId: RCSA_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    // A refresh is a fresh build of the view from the database.
    for (const language of ["en", "de"] as const) {
      const model = buildDecisionQueueView({ roleId: "rcsa", atMoment: "07:45", language, autonomyLevel: "act-with-approval" });
      const receipt = findRecorded(model, RCSA_DECISION);
      expect(receipt?.outcome).toBe("partial");
      expect(receipt?.executed).toHaveLength(2);
      expect(receipt?.failed).toHaveLength(1);
      expect(receipt?.failed[0]?.targetId).toBe("CTL-DOES-NOT-EXIST");
      expect(receipt?.outcomeLine).toContain(language === "de" ? "1 nicht ausgefuehrt" : "1 did not execute");
      const row = model.recorded.find((entry) => entry.decisionId === RCSA_DECISION);
      expect(row?.failedCount).toBe(1);
    }
  });
});

/* ==========================================================================
   J21: the receipt persists and counts only real lines
   ========================================================================== */

describe("J21: the receipt persists, is read from execution_receipt_lines and counts only real lines", () => {
  for (const [roleId, decisionId, optionId] of [
    ["tprm", TPRM_DECISION, TPRM_OPTION],
    ["rcsa", RCSA_DECISION, RCSA_OPTION],
  ] as Array<[RoleId, string, string]>) {
    it(`builds the ${roleId} receipt from the database, with no line about the decision itself`, async () => {
      const result = await recordDecisionAndExecute({ decisionId, optionId, rationale: RATIONALE, rationaleConfirmed: true });
      expect(result.receiptStatements.some((line) => line.startsWith("Decision rationale recorded"))).toBe(false);
      expect(result.receiptStatements).toHaveLength(receiptLines(decisionId));

      const model = buildDecisionQueueView({ roleId, atMoment: "07:45", language: "en", autonomyLevel: "act-with-approval" });
      const receipt = findRecorded(model, decisionId);
      expect(receipt).not.toBeNull();
      expect(receipt?.outcome).toBe("complete");
      expect(receipt?.failed).toStrictEqual([]);
      const statements = receipt?.executed.flatMap((change) => change.statements) ?? [];
      expect(statements).toHaveLength(receiptLines(decisionId));
      expect(statements.some((line) => line.includes("Decision rationale recorded"))).toBe(false);
      expect(receipt?.executed.every((change) => change.auditEventId !== null)).toBe(true);
      expect(receipt?.rationale).toBe(RATIONALE);
      expect(model.recorded.find((row) => row.decisionId === decisionId)?.receiptCount).toBe(receiptLines(decisionId));
    });
  }

  it("states an older record's refused changes honestly, read from its approvals and tool calls", async () => {
    /*
     * The J20 state, reproduced the way the old engine produced it: the
     * decision written as decided, approvals granted under the active rcsa
     * role, and every TPRM consequence refused by the gate. This is what the
     * shared database already holds for DEC-2026-0741 after the audit run.
     */
    const plan = planDecisionOption({ decisionId: TPRM_DECISION, optionId: TPRM_OPTION });
    getSqlite()
      .prepare("update decisions set status = 'decided', chosen_option_id = ?, decided_by_user_id = 'P-002', decided_at_moment = '07:45', recorded_rationale = ? where id = ?")
      .run(TPRM_OPTION, RATIONALE, TPRM_DECISION);
    const state = requireScenarioState();
    for (const entry of plan?.consequences ?? []) {
      const approvalId = grantApproval({
        decisionId: TPRM_DECISION,
        toolName: entry.toolName ?? "",
        payloadFingerprint: entry.fingerprint ?? "",
        rationale: RATIONALE,
        rationaleConfirmed: true,
      });
      await executeTool(
        entry.toolName ?? "",
        entry.payload ?? {},
        {
          runId: state.runId,
          roleId: "tprm",
          autonomyLevel: state.autonomyLevel,
          actingUserId: TPRM_HOLDER,
          atMoment: state.currentMoment,
          sessionId: "session-tprm",
          actorKind: "human",
          language: "en",
        },
        approvalId,
      );
    }

    const outcome = getDecisionOutcome(TPRM_DECISION);
    expect(outcome.source).toBe("derived");
    expect(outcome.consequences.every((entry) => entry.outcome === "blocked" && entry.code === "approval-role-mismatch")).toBe(true);

    const model = buildDecisionQueueView({ roleId: "tprm", atMoment: "07:45", language: "en", autonomyLevel: "act-with-approval" });
    const receipt = findRecorded(model, TPRM_DECISION);
    expect(receipt?.outcome).toBe("none-executed");
    expect(receipt?.executed).toStrictEqual([]);
    expect(receipt?.failed).toHaveLength(3);
    expect(receipt?.failed[0]?.reason).toContain("different role");
  });
});

/* ==========================================================================
   The event backbone
   ========================================================================== */

describe("the decision on the event backbone", () => {
  it("publishes the recorded decision once, with the process stage that binds it", async () => {
    await recordDecisionAndExecute({ decisionId: RCSA_DECISION, optionId: RCSA_OPTION, rationale: RATIONALE, rationaleConfirmed: true });
    const event = findOsEvent(`decision-recorded:${RCSA_DECISION}`);
    expect(event).toBeDefined();
    expect(event?.roleId).toBe("rcsa");
    expect(event?.actorUserId).toBe(RCSA_HOLDER);
    expect(event?.processRunId).toBe("RUN-RCSA-PAYOPS-Q4-2026");
    expect(event?.stageId).toBe("evidence-refresh");
    expect(event?.auditEventId).toBeTruthy();
    expect(event?.payload).toMatchObject({ decisionId: RCSA_DECISION, executed: 2, failed: 0 });
  });

  it("publishes a decision no stage binds without a process", async () => {
    await recordDecisionAndExecute({ decisionId: TPRM_DECISION, optionId: TPRM_OPTION, rationale: RATIONALE, rationaleConfirmed: true });
    const event = findOsEvent(`decision-recorded:${TPRM_DECISION}`);
    expect(event?.roleId).toBe("tprm");
    expect(event?.processRunId).toBeNull();
    expect(event?.subjectId).toBe("TP-0042");
  });
});
