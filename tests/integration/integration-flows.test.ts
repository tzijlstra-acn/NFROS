/**
 * Integration flow tests.
 *
 * These are about the guarantees that only hold across a whole flow, which is
 * why they are here rather than in the unit suite.
 *
 * The one that matters most is the fourth describe block. A receipt line in
 * this product is a claim that something happened, and the local mutation
 * suite exists because that claim was once made for an update that matched
 * zero rows. The external case is strictly worse: a user cannot check it by
 * looking at the next screen. So these tests assert that a failed delivery
 * produces no acknowledged receipt, that the approved decision behind it
 * survives, and that a retry cannot produce a second external object.
 *
 * The harness gives each run a fresh temporary database. That is not
 * politeness: these tests set a connector unavailable and dead letter a
 * command, and doing that to the database somebody is about to present from
 * would be worse than having no tests.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTemporaryDatabase,
  destroyTemporaryDatabase,
  rowCount,
} from "./support/harness";

/** The person who holds each role, matching the engine's own map. */
const HOLDERS = {
  tprm: "P-002",
  rcsa: "P-003",
  "control-assurance": "P-004",
  "incident-resilience": "P-005",
  "regulatory-change": "P-006",
  "nfr-governance": "P-001",
} as const;

/** The seeded control effectiveness decision the scenario turns on. */
const DECISION_ID = "DEC-2026-0772";
const CONTROL_ID = "CTL-PAY-014";

let runtime: typeof import("@/integrations/runtime/IntegrationRuntime");
let ids: typeof import("@/integrations/seed");
let events: typeof import("@/integrations/connectors/simulated/events");
let simulated: typeof import("@/integrations/connectors/simulated");
let seedScenario: typeof import("@/db/seed/run").seedScenario;
let requireScenarioState: typeof import("@/scenario/engine/state").requireScenarioState;
let switchRole: typeof import("@/scenario/engine/state").switchRole;
let grantApproval: typeof import("@/scenario/engine/decide").grantApproval;
let fingerprintPayload: typeof import("@/server/security/authority").fingerprintPayload;
let getSqlite: typeof import("@/db/client").getSqlite;

beforeAll(async () => {
  createTemporaryDatabase("integration-flows");
  ({ seedScenario } = await import("@/db/seed/run"));
  ids = await import("@/integrations/seed");
  runtime = await import("@/integrations/runtime/IntegrationRuntime");
  events = await import("@/integrations/connectors/simulated/events");
  simulated = await import("@/integrations/connectors/simulated");
  ({ requireScenarioState, switchRole } = await import("@/scenario/engine/state"));
  ({ grantApproval } = await import("@/scenario/engine/decide"));
  ({ fingerprintPayload } = await import("@/server/security/authority"));
  ({ getSqlite } = await import("@/db/client"));
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  seedScenario();
  ids.seedIntegrations();
  simulated.resetExternalStore();
  runtime.clearInboundHooks();
  switchRole("rcsa");
});

/** Syncs every declared read type on one connector. */
async function syncAll(connectorInstanceId: string): Promise<void> {
  const state = requireScenarioState();
  const instance = runtime.requireConnectorInstance(connectorInstanceId);
  for (const objectType of instance.capabilities.read) {
    await runtime.runSync({
      runId: state.runId,
      connectorInstanceId,
      objectType,
      atMoment: state.currentMoment,
    });
  }
}

/** The assessment update payload used by several tests. */
function assessmentPayload(): Record<string, unknown> {
  return {
    decisionId: DECISION_ID,
    assessmentId: "ASM-PAY-2026-Q3",
    residualRisk: "high",
    conclusion: "The payment repair control is partially effective.",
  };
}

/** Approves a payload under the acting role and returns the approval id. */
function approve(toolName: string, payload: Record<string, unknown>): string {
  return grantApproval({
    decisionId: DECISION_ID,
    toolName,
    payloadFingerprint: fingerprintPayload(toolName, payload),
    rationale: "I own this conclusion.",
    rationaleConfirmed: true,
  });
}

/* ==========================================================================
   Inbound
   ========================================================================== */

describe("an inbound connector event", () => {
  it("updates the live workday and attributes the beat to the integration layer", () => {
    const state = requireScenarioState();
    const event = events.processDeviationEvent({
      runId: state.runId,
      connectorInstanceId: ids.CI_PROCESS_INTELLIGENCE,
      atMoment: "10:30",
    });
    expect(event).not.toBeNull();
    if (!event) return;

    const liveBefore = rowCount("workday_live_events");
    const result = runtime.ingestInboundEvent(event);

    expect(result.status).toBe("published");
    expect(rowCount("workday_live_events")).toBe(liveBefore + 1);

    const row = getSqlite()
      .prepare(
        "select derived_from as d, integration_event_id as i, object_id as o, source_connector_ids as s, requires_decision as r from workday_live_events where id = ?",
      )
      .get(result.liveEventId ?? "") as
      | { d: string; i: string; o: string; s: string; r: number }
      | undefined;

    expect(row?.d).toBe("integration");
    expect(row?.i).toBe(result.integrationEventId);
    expect(row?.o).toBe(CONTROL_ID);
    expect(JSON.parse(row?.s ?? "[]")).toStrictEqual([ids.CI_PROCESS_INTELLIGENCE]);
    expect(row?.r).toBe(1);
  });

  it("records the external reference so the projection can be opened at source", () => {
    const state = requireScenarioState();
    const event = events.processDeviationEvent({
      runId: state.runId,
      connectorInstanceId: ids.CI_PROCESS_INTELLIGENCE,
      atMoment: "10:30",
    });
    if (!event) return;

    runtime.ingestInboundEvent(event);
    const references = runtime.referencesForCanonicalObject(state.runId, "Control", CONTROL_ID);
    const pi = references.find(
      (reference) => reference.connectorInstanceId === ids.CI_PROCESS_INTELLIGENCE,
    );

    expect(pi).toBeDefined();
    expect(pi?.externalType).toBe("pi.deviation");
    expect(pi?.externalId).toMatch(/^PI-DEV-/);
    expect(pi?.externalUrl).toMatch(/processmining\.arcadia\.example/);
  });

  it("resolves evidence that exists in the seeded corpus rather than inventing it", () => {
    const state = requireScenarioState();
    const event = events.processDeviationEvent({
      runId: state.runId,
      connectorInstanceId: ids.CI_PROCESS_INTELLIGENCE,
      atMoment: "10:30",
    });
    if (!event) return;

    const result = runtime.ingestInboundEvent(event);
    expect(result.evidenceIds.length).toBeGreaterThan(0);

    for (const evidenceId of result.evidenceIds) {
      const found = getSqlite()
        .prepare("select count(*) as n from evidence_documents where id = ?")
        .get(evidenceId) as { n: number };
      expect(found.n).toBe(1);
    }
  });

  it("flags the disagreement when two sources describe the same object differently", async () => {
    const state = requireScenarioState();
    await syncAll(ids.CI_GRC);

    const event = events.processDeviationEvent({
      runId: state.runId,
      connectorInstanceId: ids.CI_PROCESS_INTELLIGENCE,
      atMoment: "10:30",
    });
    if (!event) return;
    runtime.ingestInboundEvent(event);

    const references = runtime.referencesForCanonicalObject(state.runId, "Control", CONTROL_ID);
    expect(references.length).toBe(2);
    // Both sides are flagged, so the disagreement is visible from either row.
    expect(references.every((reference) => reference.conflicted)).toBe(true);
    expect(references.every((reference) => reference.conflictNote.length > 0)).toBe(true);
  });

  it("deduplicates a repeated delivery", () => {
    const state = requireScenarioState();
    const event = events.processDeviationEvent({
      runId: state.runId,
      connectorInstanceId: ids.CI_PROCESS_INTELLIGENCE,
      atMoment: "10:30",
    });
    if (!event) return;

    runtime.ingestInboundEvent(event);
    const after = { events: rowCount("integration_events"), live: rowCount("workday_live_events") };
    const second = runtime.ingestInboundEvent(event);

    expect(second.deduplicated).toBe(true);
    expect(rowCount("integration_events")).toBe(after.events);
    expect(rowCount("workday_live_events")).toBe(after.live);
  });
});

/* ==========================================================================
   Outbound and the authority gate
   ========================================================================== */

describe("an outbound command", () => {
  it("passes through the same authority gate as a local mutation", async () => {
    const state = requireScenarioState();
    const payload = assessmentPayload();

    const held = await runtime.dispatchCommand({
      runId: state.runId,
      connectorInstanceId: ids.CI_GRC,
      commandKind: "updateAssessment",
      toolName: "updateAssessment",
      actingUserId: HOLDERS.rcsa,
      roleId: "rcsa",
      actorKind: "human",
      autonomyLevel: state.autonomyLevel,
      decisionId: DECISION_ID,
      sourceCanonicalType: "Assessment",
      sourceCanonicalId: "ASM-PAY-2026-Q3",
      targetExternalType: "grc.assessment",
      payload,
      intentStatement: "Create an assessment version",
      atMoment: state.currentMoment,
    });

    expect(held.blocked).toBe(true);
    expect(held.denialCode).toBe("approval-missing");
    expect(held.status).toBe("awaiting-approval");
    expect(simulated.countExternalObjects(simulated.GRC_SYSTEM_KEY)).toBe(0);
    expect(rowCount("external_execution_receipts")).toBe(0);
  });

  it("refuses a role that does not hold the required scope, and records the refusal", async () => {
    const state = requireScenarioState();
    const payload = assessmentPayload();

    // The third party risk role does not hold rcsa.rate.
    const refused = await runtime.dispatchCommand({
      runId: state.runId,
      connectorInstanceId: ids.CI_GRC,
      commandKind: "updateAssessment",
      toolName: "updateAssessment",
      actingUserId: HOLDERS.tprm,
      roleId: "tprm",
      actorKind: "human",
      autonomyLevel: state.autonomyLevel,
      decisionId: DECISION_ID,
      sourceCanonicalType: "Assessment",
      sourceCanonicalId: "ASM-PAY-2026-Q3",
      targetExternalType: "grc.assessment",
      payload,
      intentStatement: "Create an assessment version",
      atMoment: state.currentMoment,
    });

    expect(refused.blocked).toBe(true);
    expect(refused.denialCode).toBe("missing-scope");
    expect(refused.status).toBe("cancelled");

    const blocked = getSqlite()
      .prepare("select count(*) as n from audit_events where blocked = 1 and object_id = ?")
      .get(refused.commandId ?? "") as { n: number };
    expect(blocked.n).toBe(1);
  });

  it("refuses an approval bound to a different payload", async () => {
    const state = requireScenarioState();
    const payload = assessmentPayload();
    const approvalId = approve("updateAssessment", { ...payload, residualRisk: "medium" });

    const refused = await runtime.dispatchCommand({
      runId: state.runId,
      connectorInstanceId: ids.CI_GRC,
      commandKind: "updateAssessment",
      toolName: "updateAssessment",
      actingUserId: HOLDERS.rcsa,
      roleId: "rcsa",
      actorKind: "human",
      autonomyLevel: state.autonomyLevel,
      approvalId,
      decisionId: DECISION_ID,
      sourceCanonicalType: "Assessment",
      sourceCanonicalId: "ASM-PAY-2026-Q3",
      targetExternalType: "grc.assessment",
      payload,
      intentStatement: "Create an assessment version",
      atMoment: state.currentMoment,
    });

    expect(refused.blocked).toBe(true);
    expect(refused.denialCode).toBe("approval-payload-mismatch");
    expect(simulated.countExternalObjects(simulated.GRC_SYSTEM_KEY)).toBe(0);
  });

  it("refuses a write the connector never declared, before the connector is called", async () => {
    const state = requireScenarioState();
    const refused = await runtime.dispatchCommand({
      runId: state.runId,
      connectorInstanceId: ids.CI_PROCESS_INTELLIGENCE,
      commandKind: "writeSignal",
      toolName: "updateControlRating",
      actingUserId: HOLDERS.rcsa,
      roleId: "rcsa",
      actorKind: "human",
      autonomyLevel: state.autonomyLevel,
      sourceCanonicalType: "Process",
      sourceCanonicalId: "PRC-0042",
      targetExternalType: "pi.process",
      payload: { note: "never" },
      intentStatement: "Write to the mining platform",
      atMoment: state.currentMoment,
    });

    expect(refused.blocked).toBe(true);
    expect(refused.denialCode).toBe("capability-not-declared");
    // No command row at all: there was nothing to send to.
    expect(refused.commandId).toBeNull();
    expect(rowCount("integration_commands")).toBe(0);
  });
});

/* ==========================================================================
   Acknowledgement and the receipt
   ========================================================================== */

describe("an external acknowledgement", () => {
  it("creates a receipt that carries the reference the target returned", async () => {
    const state = requireScenarioState();
    const payload = assessmentPayload();
    const approvalId = approve("updateAssessment", payload);

    const result = await runtime.dispatchCommand({
      runId: state.runId,
      connectorInstanceId: ids.CI_GRC,
      commandKind: "updateAssessment",
      toolName: "updateAssessment",
      actingUserId: HOLDERS.rcsa,
      roleId: "rcsa",
      actorKind: "human",
      autonomyLevel: state.autonomyLevel,
      approvalId,
      decisionId: DECISION_ID,
      sourceCanonicalType: "Assessment",
      sourceCanonicalId: "ASM-PAY-2026-Q3",
      targetExternalType: "grc.assessment",
      payload,
      intentStatement: "Create an assessment version",
      atMoment: state.currentMoment,
    });

    expect(result.acknowledged).toBe(true);
    expect(rowCount("external_execution_receipts")).toBe(1);

    const receipts = runtime.receiptsForCommand(result.commandId ?? "");
    expect(receipts[0]?.status).toBe("acknowledged");
    expect(receipts[0]?.externalId).toBe(result.externalId);
    expect(receipts[0]?.auditEventId).toBeTruthy();
    expect(receipts[0]?.statement).toMatch(/GRC platform/);
  });

  it("updates the local projection so the object carries its external identity", async () => {
    const state = requireScenarioState();
    const payload = assessmentPayload();
    const approvalId = approve("updateAssessment", payload);

    const result = await runtime.dispatchCommand({
      runId: state.runId,
      connectorInstanceId: ids.CI_GRC,
      commandKind: "updateAssessment",
      toolName: "updateAssessment",
      actingUserId: HOLDERS.rcsa,
      roleId: "rcsa",
      actorKind: "human",
      autonomyLevel: state.autonomyLevel,
      approvalId,
      decisionId: DECISION_ID,
      sourceCanonicalType: "Assessment",
      sourceCanonicalId: "ASM-PAY-2026-Q3",
      targetExternalType: "grc.assessment",
      payload,
      intentStatement: "Create an assessment version",
      atMoment: state.currentMoment,
    });

    const references = runtime.referencesForCanonicalObject(
      state.runId,
      "Assessment",
      "ASM-PAY-2026-Q3",
    );
    expect(references.some((reference) => reference.externalId === result.externalId)).toBe(true);
  });

  it("appears in the audit trail and the activity stream", async () => {
    const state = requireScenarioState();
    const payload = assessmentPayload();
    const approvalId = approve("updateAssessment", payload);
    const activityBefore = rowCount("ai_activity_entries");

    const result = await runtime.dispatchCommand({
      runId: state.runId,
      connectorInstanceId: ids.CI_GRC,
      commandKind: "updateAssessment",
      toolName: "updateAssessment",
      actingUserId: HOLDERS.rcsa,
      roleId: "rcsa",
      actorKind: "human",
      autonomyLevel: state.autonomyLevel,
      approvalId,
      decisionId: DECISION_ID,
      sourceCanonicalType: "Assessment",
      sourceCanonicalId: "ASM-PAY-2026-Q3",
      targetExternalType: "grc.assessment",
      payload,
      intentStatement: "Create an assessment version",
      atMoment: state.currentMoment,
    });

    const mutation = getSqlite()
      .prepare(
        "select count(*) as n from audit_events where object_id = ? and category = 'mutation'",
      )
      .get(result.commandId ?? "") as { n: number };
    expect(mutation.n).toBe(1);

    expect(rowCount("ai_activity_entries")).toBe(activityBefore + 1);
    const activity = getSqlite()
      .prepare(
        "select connector_instance_id as c, kind as k, authority_class as a from ai_activity_entries order by sequence desc limit 1",
      )
      .get() as { c: string; k: string; a: string };
    expect(activity.c).toBe(ids.CI_GRC);
    expect(activity.k).toBe("executed");
    expect(activity.a).toBe("APPROVAL_REQUIRED");
  });
});

/* ==========================================================================
   Failure: the guarantee this suite exists for
   ========================================================================== */

describe("a connector failure", () => {
  it("produces no acknowledged receipt line", async () => {
    const state = requireScenarioState();
    simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, false);

    const payload = assessmentPayload();
    const approvalId = approve("updateAssessment", payload);

    const result = await runtime.dispatchCommand(
      {
        runId: state.runId,
        connectorInstanceId: ids.CI_GRC,
        commandKind: "updateAssessment",
        toolName: "updateAssessment",
        actingUserId: HOLDERS.rcsa,
        roleId: "rcsa",
        actorKind: "human",
        autonomyLevel: state.autonomyLevel,
        approvalId,
        decisionId: DECISION_ID,
        sourceCanonicalType: "Assessment",
        sourceCanonicalId: "ASM-PAY-2026-Q3",
        targetExternalType: "grc.assessment",
        payload,
        intentStatement: "Create an assessment version",
        atMoment: state.currentMoment,
      },
      { jitter: runtime.noJitter },
    );

    expect(result.acknowledged).toBe(false);
    expect(result.status).toBe("dead-letter");
    // The assertion this whole file exists for.
    expect(rowCount("external_execution_receipts")).toBe(0);
    expect(runtime.hasNoAcknowledgedReceipt(result.commandId ?? "")).toBe(true);

    const lines = runtime.receiptLinesForCommand(result.commandId ?? "");
    expect(lines.every((line) => line.status !== "acknowledged")).toBe(true);
    expect(lines[0]?.externalId).toBeNull();

    simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, true);
  });

  it("preserves the approved decision and its approval", async () => {
    const state = requireScenarioState();
    simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, false);

    const payload = assessmentPayload();
    const approvalId = approve("updateAssessment", payload);
    const approvalBefore = getSqlite()
      .prepare("select rationale as r, rationale_confirmed as c from approvals where id = ?")
      .get(approvalId) as { r: string; c: number };

    await runtime.dispatchCommand(
      {
        runId: state.runId,
        connectorInstanceId: ids.CI_GRC,
        commandKind: "updateAssessment",
        toolName: "updateAssessment",
        actingUserId: HOLDERS.rcsa,
        roleId: "rcsa",
        actorKind: "human",
        autonomyLevel: state.autonomyLevel,
        approvalId,
        decisionId: DECISION_ID,
        sourceCanonicalType: "Assessment",
        sourceCanonicalId: "ASM-PAY-2026-Q3",
        targetExternalType: "grc.assessment",
        payload,
        intentStatement: "Create an assessment version",
        atMoment: state.currentMoment,
      },
      { jitter: runtime.noJitter },
    );

    const approvalAfter = getSqlite()
      .prepare("select rationale as r, rationale_confirmed as c from approvals where id = ?")
      .get(approvalId) as { r: string; c: number } | undefined;

    expect(approvalAfter).toBeDefined();
    expect(approvalAfter?.r).toBe(approvalBefore.r);
    expect(approvalAfter?.c).toBe(approvalBefore.c);
    expect(rowCount("dead_letter_entries")).toBe(1);

    simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, true);
  });

  it("does not duplicate the external object across retries", async () => {
    const state = requireScenarioState();
    simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, false);

    const payload = assessmentPayload();
    const approvalId = approve("updateAssessment", payload);

    const first = await runtime.dispatchCommand(
      {
        runId: state.runId,
        connectorInstanceId: ids.CI_GRC,
        commandKind: "updateAssessment",
        toolName: "updateAssessment",
        actingUserId: HOLDERS.rcsa,
        roleId: "rcsa",
        actorKind: "human",
        autonomyLevel: state.autonomyLevel,
        approvalId,
        decisionId: DECISION_ID,
        sourceCanonicalType: "Assessment",
        sourceCanonicalId: "ASM-PAY-2026-Q3",
        targetExternalType: "grc.assessment",
        payload,
        intentStatement: "Create an assessment version",
        atMoment: state.currentMoment,
      },
      { jitter: runtime.noJitter },
    );

    expect(simulated.countExternalObjects(simulated.GRC_SYSTEM_KEY)).toBe(0);
    // Four attempts reached the target and created nothing.
    expect(simulated.countWriteAttempts(simulated.GRC_SYSTEM_KEY)).toBe(3);

    const retryWhileDown = await runtime.retryCommand(first.commandId ?? "", {
      jitter: runtime.noJitter,
    });
    expect(retryWhileDown.acknowledged).toBe(false);
    expect(simulated.countExternalObjects(simulated.GRC_SYSTEM_KEY)).toBe(0);

    simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, true);

    const key = runtime.findCommandById(first.commandId ?? "")?.idempotencyKey;
    const recovered = await runtime.retryCommand(first.commandId ?? "");

    expect(recovered.acknowledged).toBe(true);
    expect(recovered.commandId).toBe(first.commandId);
    expect(runtime.findCommandById(recovered.commandId ?? "")?.idempotencyKey).toBe(key);
    expect(simulated.countExternalObjects(simulated.GRC_SYSTEM_KEY)).toBe(1);
    expect(rowCount("external_execution_receipts")).toBe(1);
    expect(rowCount("integration_commands")).toBe(1);

    // A further retry after success sends nothing at all.
    const again = await runtime.retryCommand(recovered.commandId ?? "");
    expect(again.acknowledged).toBe(true);
    expect(simulated.countExternalObjects(simulated.GRC_SYSTEM_KEY)).toBe(1);
    expect(rowCount("external_execution_receipts")).toBe(1);
  });

  it("closes the dead letter when the retry finally succeeds", async () => {
    const state = requireScenarioState();
    simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, false);

    const payload = assessmentPayload();
    const approvalId = approve("updateAssessment", payload);
    const failed = await runtime.dispatchCommand(
      {
        runId: state.runId,
        connectorInstanceId: ids.CI_GRC,
        commandKind: "updateAssessment",
        toolName: "updateAssessment",
        actingUserId: HOLDERS.rcsa,
        roleId: "rcsa",
        actorKind: "human",
        autonomyLevel: state.autonomyLevel,
        approvalId,
        decisionId: DECISION_ID,
        sourceCanonicalType: "Assessment",
        sourceCanonicalId: "ASM-PAY-2026-Q3",
        targetExternalType: "grc.assessment",
        payload,
        intentStatement: "Create an assessment version",
        atMoment: state.currentMoment,
      },
      { jitter: runtime.noJitter },
    );

    const open = runtime.partitionDeadLetters(state.runId);
    expect(open.open).toHaveLength(1);

    simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, true);
    await runtime.retryCommand(failed.commandId ?? "");

    const closed = runtime.partitionDeadLetters(state.runId);
    expect(closed.open).toHaveLength(0);
    expect(closed.resolved).toHaveLength(1);
  });

  it("shows a queued or failed state in the receipt, never a complete one", async () => {
    const state = requireScenarioState();

    /* One confirmed change and one that cannot be delivered, on one decision. */
    const payload = assessmentPayload();
    const approvalId = approve("updateAssessment", payload);
    await runtime.dispatchCommand({
      runId: state.runId,
      connectorInstanceId: ids.CI_GRC,
      commandKind: "updateAssessment",
      toolName: "updateAssessment",
      actingUserId: HOLDERS.rcsa,
      roleId: "rcsa",
      actorKind: "human",
      autonomyLevel: state.autonomyLevel,
      approvalId,
      decisionId: DECISION_ID,
      sourceCanonicalType: "Assessment",
      sourceCanonicalId: "ASM-PAY-2026-Q3",
      targetExternalType: "grc.assessment",
      payload,
      intentStatement: "Create an assessment version",
      atMoment: state.currentMoment,
      sequence: 1,
    });

    const restPayload = { note: "A record for a system with no endpoint" };
    const restApproval = approve("createAction", restPayload);
    await runtime.dispatchCommand(
      {
        runId: state.runId,
        connectorInstanceId: ids.CI_GENERIC_REST,
        commandKind: "createRecord",
        toolName: "createAction",
        actingUserId: HOLDERS.rcsa,
        roleId: "rcsa",
        actorKind: "human",
        autonomyLevel: state.autonomyLevel,
        approvalId: restApproval,
        decisionId: DECISION_ID,
        sourceCanonicalType: "Action",
        sourceCanonicalId: "ACT-REST",
        targetExternalType: "rest.record",
        payload: restPayload,
        intentStatement: "Create a record in the downstream system",
        atMoment: state.currentMoment,
        sequence: 2,
      },
      { jitter: runtime.noJitter },
    );

    const lines = runtime.receiptLinesForDecision(state.runId, DECISION_ID);
    expect(lines).toHaveLength(2);
    expect(lines.filter((line) => line.status === "acknowledged")).toHaveLength(1);

    const pending = lines.find((line) => line.status !== "acknowledged");
    expect(pending?.status).toBe("dead-letter");
    expect(pending?.externalId).toBeNull();
    expect(pending?.statement).toMatch(/not been confirmed/);
  });
});

/* ==========================================================================
   Continuity across a role switch
   ========================================================================== */

describe("a role switch", () => {
  it("preserves external references, receipts and the command history", async () => {
    const state = requireScenarioState();
    await syncAll(ids.CI_GRC);

    const payload = assessmentPayload();
    const approvalId = approve("updateAssessment", payload);
    const result = await runtime.dispatchCommand({
      runId: state.runId,
      connectorInstanceId: ids.CI_GRC,
      commandKind: "updateAssessment",
      toolName: "updateAssessment",
      actingUserId: HOLDERS.rcsa,
      roleId: "rcsa",
      actorKind: "human",
      autonomyLevel: state.autonomyLevel,
      approvalId,
      decisionId: DECISION_ID,
      sourceCanonicalType: "Assessment",
      sourceCanonicalId: "ASM-PAY-2026-Q3",
      targetExternalType: "grc.assessment",
      payload,
      intentStatement: "Create an assessment version",
      atMoment: state.currentMoment,
    });

    const before = {
      references: rowCount("external_references"),
      receipts: rowCount("external_execution_receipts"),
      commands: rowCount("integration_commands"),
      sources: runtime.getSourceAttribution({
        runId: state.runId,
        canonicalType: "Control",
        canonicalId: CONTROL_ID,
      }).length,
    };

    switchRole("control-assurance");

    expect(rowCount("external_references")).toBe(before.references);
    expect(rowCount("external_execution_receipts")).toBe(before.receipts);
    expect(rowCount("integration_commands")).toBe(before.commands);
    expect(
      runtime.getSourceAttribution({
        runId: state.runId,
        canonicalType: "Control",
        canonicalId: CONTROL_ID,
      }).length,
    ).toBe(before.sources);

    // The receipt still names the person who took the decision, not the new role.
    const command = runtime.findCommandById(result.commandId ?? "");
    expect(command?.actingUserId).toBe(HOLDERS.rcsa);
    expect(command?.roleId).toBe("rcsa");
  });
});

/* ==========================================================================
   Honesty about readiness
   ========================================================================== */

describe("the connector inventory", () => {
  it("declares exactly one mode per instance and never claims a credential", () => {
    const instances = runtime.listConnectorInstances();
    expect(instances.length).toBeGreaterThan(14);

    const modes = new Set(instances.map((instance) => instance.mode));
    expect(modes.has("simulated")).toBe(true);
    expect(modes.has("sandbox-ready")).toBe(true);
    expect(modes.has("configured-unavailable")).toBe(true);
    expect(modes.has("planned")).toBe(true);
    // The complete local experience requires no credential anywhere.
    expect(instances.every((instance) => instance.secretStatus !== "present")).toBe(true);
  });

  it("gives every planned adapter an empty capability set", () => {
    for (const instance of runtime.listConnectorInstances({ mode: "planned" })) {
      expect(instance.capabilities.read).toStrictEqual([]);
      expect(instance.capabilities.write).toStrictEqual([]);
      expect(instance.capabilities.events).toStrictEqual([]);
      expect(instance.writeEnabled).toBe(false);
    }
  });

  it("resolves every seeded connector key to a registered implementation", () => {
    for (const instance of runtime.listConnectorInstances()) {
      expect(() => runtime.resolveConnector(instance.id)).not.toThrow();
      const metadata = runtime.resolveConnector(instance.id).connector.metadata();
      expect(metadata.readinessNote.length).toBeGreaterThan(20);
    }
  });

  it("gives every mapping a declared conflict policy and a note", () => {
    const mappings = runtime.listSourceMappings();
    expect(mappings.length).toBeGreaterThan(10);
    for (const mapping of mappings) {
      expect(mapping.conflictPolicy.length).toBeGreaterThan(0);
      expect(mapping.notes.length).toBeGreaterThan(20);
    }
  });
});
