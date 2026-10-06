/**
 * The consequence engine.
 *
 * This is the heart of the product, so these are the tests that matter most.
 * The claim being tested is narrow and strong: choosing an option does not
 * change a label, it executes that option's declared consequences through the
 * governed tool path, and the receipt the user reads afterwards is assembled
 * from mutations that genuinely happened.
 *
 * Each test is written to try to break one specific part of that claim:
 * execute without a confirmed rationale, reuse an approval, raise autonomy to
 * get a material change through unapproved, read the changed object through a
 * different query path to see whether the two views agree, and reset to see
 * whether the day really goes back.
 *
 * Runs against a temporary database. See `support/harness.ts`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase, rowCount } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import { resetScenarioDay } from "@/scenario/engine/reset";
import {
  grantApproval,
  recordDecisionAndExecute,
  type Consequence,
} from "@/scenario/engine/decide";
import {
  requireScenarioState,
  setAutonomyLevel,
  setMoment,
  switchRole,
} from "@/scenario/engine/state";
import { executeTool, type ToolContext } from "@/agents/tools/runtime";
import "@/agents/tools/mutations";
import { fingerprintPayload, ROLE_AUTHORITY_SCOPES } from "@/server/security/authority";
import {
  getAssessments,
  getControl,
  getControls,
  getDecision,
  getExecutionReceipt,
  getRiskControlGraph,
} from "@/db/repositories/workday";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";

/** The disputed key control. Everything in this file turns on this one row. */
const CONTROL_ID = "CTL-PAY-014";
/** The RCSA control effectiveness decision on that control. */
const RCSA_DECISION_ID = "DEC-2026-0772";
/** The option that records Partially Effective with the full chain attached. */
const RCSA_FULL_CHAIN_OPTION_ID = "DEC-2026-0772-O3";
const RCSA_HOLDER = "P-003";

const RATIONALE =
  "The only preventive control mapped to this risk carries a design and an operating deficiency, and two of six flagged items cannot be concluded, so the deviation rate is unknown rather than four in sixty.";

/** Tables whose row counts form the "nothing happened" fingerprint. */
const MUTABLE_TABLES = [
  "approvals",
  "tool_calls",
  "audit_events",
  "execution_receipt_lines",
  "actions",
  "issues",
  "committee_items",
  "monitoring_activations",
  "assessments",
  "assessment_lines",
  "collaboration_messages",
  "controls",
  "control_tests",
  "test_cases",
  "incidents",
  "obligations",
  "suppliers",
  "portfolio_themes",
  "decisions",
] as const;

function fingerprintDatabase(): Record<string, unknown> {
  const counts: Record<string, unknown> = {};
  for (const table of MUTABLE_TABLES) counts[table] = rowCount(table);

  // Row counts alone would miss an in place update, so the mutable columns
  // that a decision would change are captured too.
  counts["controls.effectiveness"] = getControls()
    .map((control) => `${control.id}=${control.currentEffectiveness}`)
    .sort()
    .join("|");
  counts["decisions.status"] = (
    getSqlite()
      .prepare("select id, status, chosen_option_id as chosen from decisions order by id")
      .all() as Array<{ id: string; status: string; chosen: string | null }>
  )
    .map((row) => `${row.id}=${row.status}/${row.chosen ?? "none"}`)
    .join("|");
  counts["assessments.status"] = (
    getSqlite()
      .prepare("select id, status, superseded_by as supersededBy from assessments order by id")
      .all() as Array<{ id: string; status: string; supersededBy: string | null }>
  )
    .map((row) => `${row.id}=${row.status}/${row.supersededBy ?? "none"}`)
    .join("|");

  return counts;
}

function toolContext(overrides: Partial<ToolContext> = {}): ToolContext {
  const state = requireScenarioState();
  return {
    runId: state.runId,
    roleId: "rcsa",
    autonomyLevel: state.autonomyLevel,
    actingUserId: RCSA_HOLDER,
    atMoment: state.currentMoment,
    sessionId: "session-rcsa",
    actorKind: "human",
    language: state.language,
    ...overrides,
  };
}

/** The consequences the seed declares for one option. */
function declaredConsequences(optionId: string): Consequence[] {
  const row = getSqlite()
    .prepare("select consequences from decision_options where id = ?")
    .get(optionId) as { consequences: string } | undefined;
  if (!row) throw new Error(`Option ${optionId} is not in the seed.`);
  return JSON.parse(row.consequences) as Consequence[];
}

function auditEvents(): Array<{
  id: string;
  category: string;
  action: string;
  blocked: number;
  blockedReason: string | null;
  preExisting: number;
  approvalId: string | null;
}> {
  return getSqlite()
    .prepare(
      `select id, category, action, blocked, blocked_reason as blockedReason,
              pre_existing as preExisting, approval_id as approvalId
       from audit_events order by id`,
    )
    .all() as Array<{
    id: string;
    category: string;
    action: string;
    blocked: number;
    blockedReason: string | null;
    preExisting: number;
    approvalId: string | null;
  }>;
}

/**
 * The control effectiveness the seed writes, captured before any decision.
 *
 * Captured rather than hard coded, so the test tracks the scenario data.
 */
let seededControlEffectiveness = "";

beforeAll(() => {
  createTemporaryDatabase("decisions");
  seedScenario();
  seededControlEffectiveness = getControl(CONTROL_ID)?.currentEffectiveness ?? "";
  if (seededControlEffectiveness.length === 0) {
    throw new Error(`${CONTROL_ID} has no seeded effectiveness rating.`);
  }
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  // Every test starts from the seeded morning. The engine writes to shared
  // rows, so an ordering dependency between tests would make a failure here
  // impossible to interpret.
  seedScenario();
});

/* ==========================================================================
   Recording a decision
   ========================================================================== */

describe("recording a decision with a confirmed rationale", () => {
  it("records the human judgment before anything executes", async () => {
    setMoment("11:45");
    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const entry = getDecision(RCSA_DECISION_ID);
    expect(entry).not.toBeNull();
    expect(entry?.decision.status).toBe("decided");
    expect(entry?.decision.chosenOptionId).toBe(RCSA_FULL_CHAIN_OPTION_ID);
    expect(entry?.decision.recordedRationale).toBe(RATIONALE);
    expect(entry?.decision.decidedByUserId).toBe(RCSA_HOLDER);
    expect(entry?.decision.decidedAtMoment).toBe("11:45");
  });

  it("executes every declared consequence of the chosen option", async () => {
    setMoment("11:45");
    const declared = declaredConsequences(RCSA_FULL_CHAIN_OPTION_ID);
    expect(declared.length).toBeGreaterThan(3);

    const result = await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    // A blocked reason means a declared consequence did not happen. The
    // option told the user it would.
    expect(result.blockedReasons, result.blockedReasons.join("; ")).toStrictEqual([]);
    expect(result.ok).toBe(true);

    const executed = getSqlite()
      .prepare("select tool_name as toolName from tool_calls where outcome = 'executed'")
      .all() as Array<{ toolName: string }>;
    expect(executed.length).toBe(declared.length);
  });

  it("writes receipt lines that each point at a real audit event", async () => {
    setMoment("11:45");
    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const receipt = getExecutionReceipt(RCSA_DECISION_ID);
    expect(receipt.length).toBeGreaterThan(0);

    const knownAuditIds = new Set(auditEvents().map((event) => event.id));
    for (const line of receipt) {
      expect(line.statement.length, `${line.id} has an empty statement`).toBeGreaterThan(5);
      // A receipt line with no audit event behind it is a claim with no record.
      expect(line.auditEventId, `${line.id} has no audit event`).not.toBeNull();
      expect(
        knownAuditIds.has(line.auditEventId ?? ""),
        `${line.id} cites audit event ${line.auditEventId}, which does not exist`,
      ).toBe(true);
      expect(line.approvalId, `${line.id} has no approval`).not.toBeNull();
    }
  });

  it("binds each consequence to its own approval rather than one blanket approval", async () => {
    setMoment("11:45");
    const declared = declaredConsequences(RCSA_FULL_CHAIN_OPTION_ID);

    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const approvals = getSqlite()
      .prepare(
        "select id, tool_name as toolName, payload_fingerprint as fingerprint, consumed_at as consumedAt from approvals",
      )
      .all() as Array<{
      id: string;
      toolName: string;
      fingerprint: string;
      consumedAt: string | null;
    }>;

    // Approving a rating change must not silently authorise the committee
    // escalation that travels with it.
    expect(approvals.length).toBe(declared.length);
    expect(new Set(approvals.map((row) => row.fingerprint)).size).toBe(declared.length);

    // An approval that authorised a change is spent; one whose change never
    // ran is still live, which is correct because the change never happened.
    const executedTools = new Set(
      (
        getSqlite()
          .prepare("select tool_name as toolName from tool_calls where outcome = 'executed'")
          .all() as Array<{ toolName: string }>
      ).map((row) => row.toolName),
    );
    for (const approval of approvals) {
      if (executedTools.has(approval.toolName)) {
        expect(approval.consumedAt, `${approval.id} authorised a change and was not spent`).not.toBeNull();
      }
    }
  });
});

/* ==========================================================================
   Without a confirmed rationale
   ========================================================================== */

describe("a decision without a confirmed rationale", () => {
  it("is refused by the server action, which changes nothing", async () => {
    setMoment("11:45");
    const before = fingerprintDatabase();

    const { actionRecordDecision } = await import("@app/actions");
    const result = await actionRecordDecision({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: false,
    });

    expect(result.ok).toBe(false);
    expect(result.blockedReasons).toContain("approval-not-confirmed");
    expect(result.receiptStatements).toStrictEqual([]);
    expect(fingerprintDatabase()).toStrictEqual(before);
  });

  it("is refused by the authority gate when the approval itself is unconfirmed", async () => {
    setMoment("11:45");
    const payload = { controlId: CONTROL_ID, effectiveness: "not-effective" };
    const approvalId = grantApproval({
      decisionId: RCSA_DECISION_ID,
      toolName: "updateControlRating",
      payloadFingerprint: fingerprintPayload("updateControlRating", payload),
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    // Strip the confirmation on the stored approval, which is the only way a
    // caller could get an unconfirmed approval in front of the gate.
    getSqlite().prepare("update approvals set rationale_confirmed = 0 where id = ?").run(approvalId);

    const before = getControl(CONTROL_ID)?.currentEffectiveness;
    const result = await executeTool("updateControlRating", payload, toolContext(), approvalId);

    expect(result.outcome).toBe("blocked");
    expect(result.denialCode).toBe("approval-not-confirmed");
    expect(getControl(CONTROL_ID)?.currentEffectiveness).toBe(before);
  });

  it("executes nothing when the engine is called with the confirmation withheld", async () => {
    // This is the defence in depth the module comments promise: the server
    // action validates the confirmation "and then it is validated again
    // independently inside the gate". The engine is called directly here,
    // which is what any other caller would do.
    setMoment("11:45");
    const before = fingerprintDatabase();

    const result = await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: false,
    });

    expect(result.ok).toBe(false);
    expect(result.receiptStatements).toStrictEqual([]);
    expect(fingerprintDatabase()).toStrictEqual(before);
  });
});

/* ==========================================================================
   The central RCSA consequence chain
   ========================================================================== */

describe("the central RCSA decision on the disputed control", () => {
  beforeEach(async () => {
    setMoment("11:45");
    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });
  });

  it("records the control effectiveness the chosen option declared", () => {
    const declared = declaredConsequences(RCSA_FULL_CHAIN_OPTION_ID).find(
      (consequence) => consequence.kind === "set-control-effectiveness",
    );
    expect(declared).toBeDefined();
    expect(getControl(CONTROL_ID)?.currentEffectiveness).toBe(declared?.value);
  });

  it("genuinely changes the recorded rating rather than restating it", () => {
    // The demonstration claim is that the rating moves when the decision is
    // taken, and that the movement is then visible in a second function's
    // view. If the seeded value already equals the decided value, nothing on
    // screen changes and the claim cannot be shown from the seeded day.
    const declared = declaredConsequences(RCSA_FULL_CHAIN_OPTION_ID).find(
      (consequence) => consequence.kind === "set-control-effectiveness",
    );
    expect(
      declared?.value,
      `the decision records "${declared?.value}", which the seed already holds`,
    ).not.toBe(seededControlEffectiveness);
  });

  it("creates a new assessment version and supersedes the previous one", () => {
    const assessments = getAssessments({ kind: "rcsa" });
    const versioned = assessments.filter((row) => row.createdBySession);
    expect(versioned.length).toBeGreaterThan(0);

    const created = versioned[0];
    expect(created).toBeDefined();
    if (!created) return;
    expect(created.status).toBe("approved");
    expect(created.sourceDecisionId).toBe(RCSA_DECISION_ID);
    // The version carries the declared basis for the conclusion; the person's
    // own words are on the decision row, reachable through sourceDecisionId.
    expect(created.rationale.length).toBeGreaterThan(20);
    expect(getDecision(RCSA_DECISION_ID)?.decision.recordedRationale).toBe(RATIONALE);

    const superseded = assessments.filter(
      (row) => row.status === "superseded" && row.supersededBy === created.id,
    );
    expect(superseded.length).toBe(1);
    expect(superseded[0]?.version).toBe(created.version - 1);

    // A version with no lines is a stub, not a version.
    const lines = rowCount("assessment_lines");
    expect(lines).toBeGreaterThan(0);
    const copied = getSqlite()
      .prepare("select count(*) as n from assessment_lines where assessment_id = ?")
      .get(created.id) as { n: number };
    expect(copied.n).toBeGreaterThan(0);
  });

  it("creates a remediation action attributed to the decision", () => {
    const actions = getSqlite()
      .prepare(
        "select id, status, created_by_session as createdBySession, source_decision_id as sourceDecisionId from actions where created_by_session = 1",
      )
      .all() as Array<{ id: string; status: string; sourceDecisionId: string | null }>;

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some((action) => action.sourceDecisionId === RCSA_DECISION_ID)).toBe(true);
    expect(actions.every((action) => action.status === "open")).toBe(true);
  });

  it("puts the matter on a committee agenda", () => {
    const items = getSqlite()
      .prepare(
        "select id, on_agenda as onAgenda, source_decision_id as sourceDecisionId from committee_items where created_by_session = 1",
      )
      .all() as Array<{ id: string; onAgenda: number; sourceDecisionId: string | null }>;

    expect(items.length).toBeGreaterThan(0);
    expect(items.some((item) => item.sourceDecisionId === RCSA_DECISION_ID)).toBe(true);
    expect(items.every((item) => item.onAgenda === 1)).toBe(true);
  });

  it("activates monitoring on the control and leaves it active", () => {
    const activations = getSqlite()
      .prepare(
        "select id, subject_id as subjectId, active, source_decision_id as sourceDecisionId from monitoring_activations",
      )
      .all() as Array<{
      id: string;
      subjectId: string;
      active: number;
      sourceDecisionId: string | null;
    }>;

    expect(activations.length).toBeGreaterThan(0);
    const onControl = activations.filter((row) => row.subjectId === CONTROL_ID);
    expect(onControl.length).toBeGreaterThan(0);
    expect(onControl.every((row) => row.active === 1)).toBe(true);
    expect(onControl.every((row) => row.sourceDecisionId === RCSA_DECISION_ID)).toBe(true);
  });

  it("commissions the off cycle reassessment", () => {
    const offCycle = getAssessments({}).filter((row) => row.status === "off-cycle");
    expect(offCycle.length).toBeGreaterThan(0);
    expect(offCycle.every((row) => row.createdBySession)).toBe(true);
  });
});

/* ==========================================================================
   State propagation: one control, several views
   ========================================================================== */

describe("state propagation", () => {
  it("shows the same rating through the control row and the risk control graph", async () => {
    setMoment("11:45");
    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const rating = getControl(CONTROL_ID)?.currentEffectiveness;
    expect(rating).toBeDefined();

    const graph = getRiskControlGraph({ riskId: "RSK-0211" });
    const graphControl = graph.controls.find((control) => control.id === CONTROL_ID);
    expect(graphControl, `${CONTROL_ID} is absent from the risk control graph`).toBeDefined();
    expect(graphControl?.currentEffectiveness).toBe(rating);

    const listed = getControls().find((control) => control.id === CONTROL_ID);
    expect(listed?.currentEffectiveness).toBe(rating);
  });

  it("moves every read path together when the rating is genuinely changed", async () => {
    // Driven through the governed tool path with a value the seed does not
    // hold, so the propagation is observable rather than coincidental.
    setMoment("11:45");
    const before = getControl(CONTROL_ID)?.currentEffectiveness;
    const target = before === "not-effective" ? "largely-effective" : "not-effective";
    const payload = { controlId: CONTROL_ID, effectiveness: target };

    const approvalId = grantApproval({
      decisionId: RCSA_DECISION_ID,
      toolName: "updateControlRating",
      payloadFingerprint: fingerprintPayload("updateControlRating", payload),
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const result = await executeTool("updateControlRating", payload, toolContext(), approvalId);
    expect(result.outcome).toBe("executed");

    expect(getControl(CONTROL_ID)?.currentEffectiveness).toBe(target);
    expect(
      getRiskControlGraph({ riskId: "RSK-0211" }).controls.find(
        (control) => control.id === CONTROL_ID,
      )?.currentEffectiveness,
    ).toBe(target);
    expect(getControls().find((control) => control.id === CONTROL_ID)?.currentEffectiveness).toBe(
      target,
    );

    // The graph's visual tone is derived from the same row, so it must move too.
    const node = getRiskControlGraph({ riskId: "RSK-0211" }).nodes.find(
      (candidate) => candidate.id === CONTROL_ID,
    );
    expect(node, "the control has no node in the graph").toBeDefined();
    expect(node?.kind).toBe("control");
  });

  it("carries the decided rating into the assessment version the decision creates", async () => {
    // The version and the rating are two consequences of one decision. If the
    // version is written before the rating changes, the new version records
    // the old rating and says nothing changed.
    setMoment("11:45");

    const preparatory = { controlId: CONTROL_ID, effectiveness: "fully-effective" };
    const preparatoryApproval = grantApproval({
      decisionId: RCSA_DECISION_ID,
      toolName: "updateControlRating",
      payloadFingerprint: fingerprintPayload("updateControlRating", preparatory),
      rationale: "Baseline set so the rating the decision records is a genuine change.",
      rationaleConfirmed: true,
    });
    const baseline = await executeTool(
      "updateControlRating",
      preparatory,
      toolContext(),
      preparatoryApproval,
    );
    expect(baseline.outcome).toBe("executed");
    expect(getControl(CONTROL_ID)?.currentEffectiveness).toBe("fully-effective");

    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const decided = declaredConsequences(RCSA_FULL_CHAIN_OPTION_ID).find(
      (consequence) => consequence.kind === "set-control-effectiveness",
    )?.value;
    expect(getControl(CONTROL_ID)?.currentEffectiveness).toBe(decided);

    const created = getAssessments({ kind: "rcsa" }).find((row) => row.createdBySession);
    expect(created).toBeDefined();
    if (!created) return;

    const lines = getSqlite()
      .prepare(
        "select id, control_ids as controlIds, control_effectiveness as effectiveness from assessment_lines where assessment_id = ?",
      )
      .all(created.id) as Array<{ id: string; controlIds: string; effectiveness: string }>;

    const line = lines.find((candidate) =>
      (JSON.parse(candidate.controlIds) as string[]).includes(CONTROL_ID),
    );
    expect(line, `the new version has no line for ${CONTROL_ID}`).toBeDefined();
    expect(line?.effectiveness).toBe(decided);
  });
});

/* ==========================================================================
   The audit trail
   ========================================================================== */

describe("the audit trail", () => {
  it("records an audit event for every mutation that executed", async () => {
    setMoment("11:45");
    const declared = declaredConsequences(RCSA_FULL_CHAIN_OPTION_ID);

    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const executedCalls = getSqlite()
      .prepare("select tool_name as toolName from tool_calls where outcome = 'executed' order by id")
      .all() as Array<{ toolName: string }>;
    expect(executedCalls.length).toBeGreaterThan(0);

    // Only events from this session. The seed writes twenty pre-existing
    // events, some of them mutations from earlier in the scenario's history.
    const session = auditEvents().filter((event) => event.preExisting === 0);
    const mutationEvents = session.filter((event) => event.category === "mutation");
    expect(mutationEvents.length).toBe(executedCalls.length);
    expect(new Set(mutationEvents.map((event) => event.action))).toStrictEqual(
      new Set(executedCalls.map((call) => call.toolName)),
    );

    // Every mutation event names the tool that made it and the approval that
    // permitted it, which is what makes the trail readable by someone who was
    // not in the room.
    for (const event of mutationEvents) {
      expect(event.action.length).toBeGreaterThan(0);
      expect(event.approvalId, `${event.action} has no approval on its audit event`).not.toBeNull();
    }

    // The human judgment is recorded once, and every consequence that was put
    // to the person produced an approval event of its own.
    expect(session.filter((event) => event.category === "decision").length).toBe(1);
    expect(session.filter((event) => event.category === "approval").length).toBe(declared.length);
  });

  it("is append only: the count grows and existing rows never change", async () => {
    setMoment("11:45");
    const before = auditEvents();
    const beforeById = new Map(before.map((event) => [event.id, JSON.stringify(event)]));
    expect(before.length).toBeGreaterThan(0);

    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const after = auditEvents();
    expect(after.length).toBeGreaterThan(before.length);
    for (const event of after) {
      const previous = beforeById.get(event.id);
      if (previous === undefined) continue;
      expect(JSON.stringify(event), `audit event ${event.id} was modified`).toBe(previous);
    }
  });

  it("offers no path to modify the trail, and records the attempt to try", async () => {
    setMoment("11:45");
    const before = auditEvents();

    const result = await executeTool(
      "modifyAuditTrail",
      { auditEventId: before[0]?.id ?? "AUD-0001", summary: "corrected" },
      toolContext(),
    );

    expect(result.outcome).toBe("blocked");
    expect(result.denialCode).toBe("prohibited");

    const after = auditEvents();
    // The only change is the record of the refusal itself.
    expect(after.length).toBe(before.length + 1);
    const added = after.filter((event) => !before.some((old) => old.id === event.id));
    expect(added.length).toBe(1);
    expect(added[0]?.blocked).toBe(1);
    expect(added[0]?.action).toBe("modifyAuditTrail");
  });
});

/* ==========================================================================
   Approvals
   ========================================================================== */

describe("an approval", () => {
  it("is single use: a second execution with the same approval is refused", async () => {
    setMoment("11:45");
    const payload = { controlId: CONTROL_ID, effectiveness: "not-effective" };
    const approvalId = grantApproval({
      decisionId: RCSA_DECISION_ID,
      toolName: "updateControlRating",
      payloadFingerprint: fingerprintPayload("updateControlRating", payload),
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const first = await executeTool("updateControlRating", payload, toolContext(), approvalId);
    expect(first.outcome).toBe("executed");

    const second = await executeTool("updateControlRating", payload, toolContext(), approvalId);
    expect(second.outcome).toBe("blocked");
    expect(second.denialCode).toBe("approval-already-consumed");

    // And the refusal is on the record, not merely returned to the caller.
    const blocked = auditEvents().filter((event) => event.blocked === 1);
    expect(blocked.length).toBeGreaterThan(0);
    expect(
      blocked.some((event) => (event.blockedReason ?? "").includes("approval-already-consumed")),
    ).toBe(true);
  });

  it("does not transfer to a different payload", async () => {
    setMoment("11:45");
    const approved = { controlId: CONTROL_ID, effectiveness: "largely-effective" };
    const approvalId = grantApproval({
      decisionId: RCSA_DECISION_ID,
      toolName: "updateControlRating",
      payloadFingerprint: fingerprintPayload("updateControlRating", approved),
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const attempted = { controlId: CONTROL_ID, effectiveness: "not-effective" };
    const result = await executeTool("updateControlRating", attempted, toolContext(), approvalId);

    expect(result.outcome).toBe("blocked");
    expect(result.denialCode).toBe("approval-payload-mismatch");
    expect(getControl(CONTROL_ID)?.currentEffectiveness).not.toBe("not-effective");
  });

  it("has an identifier that does not depend on the clock advancing", () => {
    /*
     * The approval identifier is a primary key and the only thing standing
     * between one approval and a second change. A single decision grants one
     * approval per consequence, and the central RCSA chain grants seven of
     * them inside the same millisecond.
     *
     * The clock is frozen here on purpose. That is not an artificial
     * condition: it isolates the part of the identifier that is supposed to
     * make it unique, and answers the question "how many distinct approvals
     * can this generator produce within one millisecond". If the answer is a
     * small number, a consequence chain can collide on its own primary key.
     */
    const ids = new Set<string>();
    let failure: unknown = null;

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T09:45:00.000Z"));
    try {
      for (let i = 0; i < 200; i += 1) {
        const payload = { controlId: CONTROL_ID, index: i };
        ids.add(
          grantApproval({
            decisionId: RCSA_DECISION_ID,
            toolName: "updateControlRating",
            payloadFingerprint: fingerprintPayload("updateControlRating", payload),
            rationale: RATIONALE,
            rationaleConfirmed: true,
          }),
        );
      }
    } catch (error) {
      failure = error;
    } finally {
      vi.useRealTimers();
    }

    expect(
      failure,
      `granting approvals within one millisecond threw: ${String(failure)}`,
    ).toBeNull();
    expect(ids.size).toBe(200);
  });
});

/* ==========================================================================
   Autonomy
   ========================================================================== */

describe("autonomy", () => {
  it("still requires approval for a material change at the most permissive level", async () => {
    setMoment("11:45");
    setAutonomyLevel("act-within-policy");
    expect(requireScenarioState().autonomyLevel).toBe("act-within-policy");

    const before = getControl(CONTROL_ID)?.currentEffectiveness;
    const payload = { controlId: CONTROL_ID, effectiveness: "not-effective" };
    const result = await executeTool("updateControlRating", payload, toolContext());

    // The action is prepared and held, not executed.
    expect(result.outcome).toBe("proposed");
    expect(result.denialCode).toBe("approval-missing");
    expect(result.proposedAction).toBeDefined();
    expect(result.proposedAction?.material).toBe(true);
    expect(result.proposedAction?.payloadFingerprint).toBe(
      fingerprintPayload("updateControlRating", payload),
    );
    expect(getControl(CONTROL_ID)?.currentEffectiveness).toBe(before);
  });

  it("refuses a material change outright below act with approval", async () => {
    setMoment("11:45");
    setAutonomyLevel("recommend");
    const before = getControl(CONTROL_ID)?.currentEffectiveness;

    const result = await executeTool(
      "updateControlRating",
      { controlId: CONTROL_ID, effectiveness: "not-effective" },
      toolContext(),
    );

    expect(result.outcome).toBe("blocked");
    expect(result.denialCode).toBe("autonomy-too-low");
    expect(getControl(CONTROL_ID)?.currentEffectiveness).toBe(before);
  });

  it("records the autonomy change itself, so the level in force is auditable", () => {
    setAutonomyLevel("act-within-policy");
    const events = auditEvents().filter((event) => event.action === "setAutonomyLevel");
    expect(events.length).toBe(1);
  });
});

/* ==========================================================================
   Blocked calls
   ========================================================================== */

describe("a blocked tool call", () => {
  it("is recorded with a reason rather than refused in silence", async () => {
    setMoment("11:45");
    const result = await executeTool(
      "sendExternalEmail",
      { to: "someone@example.invalid", body: "Please act." },
      toolContext(),
    );

    expect(result.outcome).toBe("blocked");
    expect(result.denialCode).toBe("prohibited");

    const recorded = auditEvents().find(
      (event) => event.action === "sendExternalEmail" && event.blocked === 1,
    );
    expect(recorded, "the refusal was not written to the audit trail").toBeDefined();
    expect(recorded?.category).toBe("blocked");
    expect(recorded?.blockedReason ?? "").toContain("prohibited");

    const call = getSqlite()
      .prepare(
        "select outcome, blocked_reason as blockedReason from tool_calls where tool_name = 'sendExternalEmail'",
      )
      .get() as { outcome: string; blockedReason: string | null } | undefined;
    expect(call?.outcome).toBe("blocked");
    expect(call?.blockedReason ?? "").toContain("prohibited");
  });

  it("is recorded when a role reaches for a scope it does not hold", async () => {
    setMoment("11:45");
    // Control Assurance may conclude a test but may not rate an RCSA.
    const result = await executeTool(
      "updateAssessment",
      { assessmentId: "x", residualRisk: "high", conclusion: "c", rationale: "r" },
      toolContext({ roleId: "control-assurance" as RoleId, actingUserId: "P-004" }),
    );

    expect(result.outcome).toBe("blocked");
    expect(result.denialCode).toBe("missing-scope");

    const recorded = auditEvents().find(
      (event) => event.action === "updateAssessment" && event.blocked === 1,
    );
    expect(recorded).toBeDefined();
    expect(recorded?.blockedReason ?? "").toContain("missing-scope");
  });
});

/* ==========================================================================
   Reset
   ========================================================================== */

describe("reset", () => {
  it("reopens the decision and restores the seeded control rating", async () => {
    setMoment("11:45");
    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });
    expect(getDecision(RCSA_DECISION_ID)?.decision.status).toBe("decided");

    resetScenarioDay();

    const entry = getDecision(RCSA_DECISION_ID);
    expect(entry?.decision.status).toBe("open");
    expect(entry?.decision.chosenOptionId).toBeNull();
    expect(entry?.decision.recordedRationale).toBe("");
    expect(entry?.decision.decidedByUserId).toBeNull();

    const control = getControl(CONTROL_ID);
    expect(control?.currentEffectiveness).toBe(seededControlEffectiveness);
    expect(control?.effectivenessSetBy).toBe("seed");

    // The scenario clock and the autonomy level go back with the day.
    const state = requireScenarioState();
    expect(state.currentMoment).toBe("07:45");
    expect(state.autonomyLevel).toBe("act-with-approval");
    expect(state.eventTriggered).toBe(false);
  });

  it("removes everything the session created", async () => {
    setMoment("11:45");
    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    expect(rowCount("approvals")).toBeGreaterThan(0);
    expect(rowCount("execution_receipt_lines")).toBeGreaterThan(0);
    expect(rowCount("monitoring_activations")).toBeGreaterThan(0);

    resetScenarioDay();

    expect(rowCount("approvals")).toBe(0);
    expect(rowCount("tool_calls")).toBe(0);
    expect(rowCount("execution_receipt_lines")).toBe(0);
    expect(rowCount("monitoring_activations")).toBe(0);

    const sessionCreated = getSqlite()
      .prepare(
        `select
           (select count(*) from actions where created_by_session = 1) as actions,
           (select count(*) from issues where created_by_session = 1) as issues,
           (select count(*) from committee_items where created_by_session = 1) as committeeItems,
           (select count(*) from assessments where created_by_session = 1) as assessments`,
      )
      .get() as { actions: number; issues: number; committeeItems: number; assessments: number };

    expect(sessionCreated).toStrictEqual({
      actions: 0,
      issues: 0,
      committeeItems: 0,
      assessments: 0,
    });
  });

  it("clears the session audit events and keeps the pre-existing ones", async () => {
    setMoment("11:45");
    const seededPreExisting = auditEvents().filter((event) => event.preExisting === 1).length;
    expect(seededPreExisting).toBeGreaterThan(0);

    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });
    expect(auditEvents().filter((event) => event.preExisting === 0).length).toBeGreaterThan(0);

    resetScenarioDay();

    const after = auditEvents();
    expect(after.filter((event) => event.preExisting === 1).length).toBe(seededPreExisting);

    // The reset itself is the only session event on the new day's record.
    const sessionEvents = after.filter((event) => event.preExisting === 0);
    expect(sessionEvents.length).toBe(1);
    expect(sessionEvents[0]?.action).toBe("resetScenario");
  });

  it("restores the same day the seed produced, not an approximation", async () => {
    setMoment("11:45");
    const seeded = fingerprintDatabase();

    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });
    expect(fingerprintDatabase()).not.toStrictEqual(seeded);

    resetScenarioDay();

    // The reset writes one audit event of its own, so that count is expected
    // to differ by exactly one and everything else must match.
    const after = fingerprintDatabase();
    const auditBefore = Number(seeded["audit_events"]);
    const auditAfter = Number(after["audit_events"]);
    expect(auditAfter).toBe(auditBefore + 1);

    const comparableBefore = { ...seeded };
    const comparableAfter = { ...after };
    delete comparableBefore["audit_events"];
    delete comparableAfter["audit_events"];
    expect(comparableAfter).toStrictEqual(comparableBefore);
  });
});

/**
 * Who the trail says approved it.
 *
 * The acting user and the approver used to be derived from two different
 * places: `recordDecisionAndExecute` from the decision's own role,
 * `grantApproval` from whichever role the scenario was pointed at. When they
 * disagreed, which the V3.3 shell made the normal case because it never
 * switches the active role, the gate refused every consequence after the
 * decision had been written (J20). The product's reading is now settled: the
 * holder of the decision's own role approves. This drives the two apart on
 * purpose and asserts that it no longer matters.
 */
describe("approval attribution when the active role is not the decision's role", () => {
  beforeEach(() => {
    resetScenarioDay();
    setMoment("11:45");
  });

  it("executes every consequence and attributes every approval to the decision role's holder", async () => {
    switchRole("tprm");
    expect(requireScenarioState().activeRoleId).toBe("tprm");

    const result = await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    expect(result.blockedReasons, result.blockedReasons.join("; ")).toStrictEqual([]);
    expect(result.ok).toBe(true);

    const approvers = getSqlite()
      .prepare(
        "SELECT DISTINCT approved_by_user_id AS approver, role_id AS role FROM approvals WHERE decision_id = ?",
      )
      .all(RCSA_DECISION_ID) as Array<{ approver: string; role: string }>;

    // The RCSA holder (P-003), never the holder of the role the shell happened to point at.
    expect(approvers).toStrictEqual([{ approver: RCSA_HOLDER, role: "rcsa" }]);
  });

  it("refuses, before writing anything, a caller that acts as another role", async () => {
    const before = fingerprintDatabase();
    const result = await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_FULL_CHAIN_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
      actingRoleId: "tprm",
    });

    expect(result.recorded).toBe(false);
    expect(result.refusal).toBe("role-mismatch");
    expect(fingerprintDatabase()).toStrictEqual(before);
  });
});

/** Guards against the harness silently pointing at the real database. */
describe("the harness", () => {
  it("runs against a temporary database and not the developer's", () => {
    const configured = process.env.NFR_DB_PATH ?? "";
    expect(configured.length).toBeGreaterThan(0);
    expect(configured.startsWith(process.cwd())).toBe(false);
    expect(configured.endsWith("scenario.db")).toBe(true);
    // And the run identifier is the seeded one, so the assertions above were
    // made against the real scenario rather than an empty container.
    expect(requireScenarioState().runId).toBe(DEFAULT_RUN_ID);
  });
});
