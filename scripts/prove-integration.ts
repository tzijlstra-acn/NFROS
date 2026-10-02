/**
 * The end to end integration proof.
 *
 * Run with: npx tsx scripts/prove-integration.ts
 *
 * The brief requires the integration model to be proven, not described. This
 * script does that in three parts, and it asserts rather than prints: every
 * numbered line is a claim that has already been checked, and a failure exits
 * non-zero with the expected and actual values.
 *
 *   INBOUND   a simulated process intelligence event arrives, is deduplicated,
 *             is mapped, produces a live day event, pulls the related GRC and
 *             evidence records in, and changes the affected work object.
 *
 *   OUTBOUND  a material change is proposed, the authority gate requires an
 *             approval, the approved command enters the outbox, a connector
 *             executes it, an external reference comes back, a receipt exists,
 *             and the audit trail and activity stream are updated.
 *
 *   FAILURE   a simulated target system is set unavailable, an approved change
 *             is retried and dead lettered, the approved decision is
 *             preserved, the retry creates no duplicate external object, the
 *             connector recovers, the same command completes on its original
 *             idempotency key, and the receipt and audit update.
 *
 * It runs against a disposable database in the system temporary directory, not
 * the developer's own. That is not caution for its own sake: the script sets a
 * connector unavailable and dead letters a command, and doing that to the
 * database somebody is about to present from would be worse than having no
 * proof at all.
 */

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

/* ==========================================================================
   Assertions and transcript
   ========================================================================== */

let stepNumber = 0;
let failures = 0;

function step(label: string): void {
  stepNumber += 1;
  console.log(`\n${String(stepNumber).padStart(2, "0")}. ${label}`);
}

function section(title: string): void {
  console.log(`\n${"=".repeat(74)}\n${title}\n${"=".repeat(74)}`);
}

function ok(claim: string, detail?: string): void {
  console.log(`    PASS  ${claim}${detail ? `  (${detail})` : ""}`);
}

function fail(claim: string, detail: string): void {
  failures += 1;
  console.error(`    FAIL  ${claim}\n          ${detail}`);
}

function assertTrue(condition: boolean, claim: string, detail = ""): void {
  if (condition) ok(claim, detail);
  else fail(claim, detail || "the condition was false");
}

function assertEqual<T>(actual: T, expected: T, claim: string): void {
  if (actual === expected) ok(claim, `value ${String(actual)}`);
  else fail(claim, `expected ${String(expected)}, got ${String(actual)}`);
}

function assertAtLeast(actual: number, minimum: number, claim: string): void {
  if (actual >= minimum) ok(claim, `value ${actual}`);
  else fail(claim, `expected at least ${minimum}, got ${actual}`);
}

/* ==========================================================================
   Disposable database
   ========================================================================== */

function createDisposableDatabase(): string {
  const directory = mkdtempSync(join(tmpdir(), "nfr-workos-prove-"));
  const dbPath = join(directory, "proof.db");

  const repositoryRoot = resolve(process.cwd());
  if (dbPath.startsWith(repositoryRoot + sep)) {
    throw new Error(`Refusing to run the proof against ${dbPath}, which is inside the repository.`);
  }

  process.env.NFR_DB_PATH = dbPath;
  return directory;
}

async function main(): Promise<void> {
  const directory = createDisposableDatabase();

  /*
   * Dynamic imports, after the path is set. A static import of the client
   * would be harmless because `getDb()` resolves lazily, but a transitively
   * imported module that opened a handle at load time would silently point
   * the proof at the developer's database, and that failure is invisible
   * until something is already overwritten.
   */
  const { getDb, getSqlite, closeDb, resolveDbPath } = await import("../src/db/client");

  if (resolveDbPath() !== process.env.NFR_DB_PATH) {
    throw new Error("The database client did not resolve the disposable path. Isolation is not in force.");
  }

  migrate(getDb(), { migrationsFolder: "src/db/migrations" });

  const { seedScenario } = await import("../src/db/seed/run");
  const { seedIntegrations, CI_GRC, CI_PROCESS_INTELLIGENCE, CI_DOCUMENT_REPOSITORY } =
    await import("../src/integrations/seed");
  const { requireScenarioState, switchRole } = await import("../src/scenario/engine/state");
  const { grantApproval } = await import("../src/scenario/engine/decide");
  const { fingerprintPayload } = await import("../src/server/security/authority");
  const runtime = await import("../src/integrations/runtime/IntegrationRuntime");
  const { processDeviationEvent } = await import(
    "../src/integrations/connectors/simulated/events"
  );
  const {
    countExternalObjects,
    resetExternalStore,
    setSystemAvailability,
    GRC_SYSTEM_KEY,
  } = await import("../src/integrations/connectors/simulated");
  const { eq, and } = await import("drizzle-orm");
  const schema = await import("../src/db/schema");

  console.log("NFR WorkOS integration proof");
  console.log(`Disposable database: ${process.env.NFR_DB_PATH}`);

  seedScenario();
  const integrationSeed = seedIntegrations();
  resetExternalStore();

  const state = requireScenarioState();
  const runId = state.runId;
  const db = getDb();
  const sqlite = getSqlite();

  const count = (table: string, where = "1=1", params: unknown[] = []): number => {
    const row = sqlite.prepare(`select count(*) as n from ${table} where ${where}`).get(...(params as never[])) as
      | { n: number }
      | undefined;
    return row?.n ?? 0;
  };

  /* ======================================================================
     Preconditions
     ====================================================================== */

  section("PRECONDITIONS");

  step("The integration layer is seeded and every instance declares a readiness mode.");
  const instances = runtime.listConnectorInstances();
  assertAtLeast(instances.length, 15, "connector instances exist");
  assertAtLeast(integrationSeed.counts.sourceMappings ?? 0, 10, "source mappings exist");
  assertAtLeast(
    integrationSeed.counts.sourceRequirements ?? 0,
    10,
    "source requirements derived from the seeded decisions exist",
  );
  const modes = new Set(instances.map((instance) => instance.mode));
  assertTrue(modes.has("simulated"), "at least one instance is simulated");
  assertTrue(modes.has("sandbox-ready"), "at least one instance is sandbox ready");
  assertTrue(modes.has("configured-unavailable"), "at least one instance is configured but unavailable");
  assertTrue(modes.has("planned"), "at least one instance is planned and declares nothing");
  assertTrue(
    instances.every((instance) => instance.secretStatus !== "present"),
    "no instance claims to hold a credential, so the local experience needs none",
  );

  step("A planned adapter declares no capabilities, so the runtime refuses every operation.");
  const planned = instances.find((instance) => instance.mode === "planned");
  if (!planned) {
    fail("a planned instance exists", "none found");
  } else {
    assertEqual(planned.capabilities.read.length, 0, "a planned adapter declares no readable types");
    assertEqual(planned.capabilities.write.length, 0, "a planned adapter declares no writable types");
    assertEqual(
      runtime.canPerform(planned.id, "read", "anything"),
      false,
      `${planned.displayName} cannot be read`,
    );
  }

  step("A read only connector is refused a write by the runtime, not by the connector.");
  const refusal = await runtime
    .dispatchCommand({
      runId,
      connectorInstanceId: CI_PROCESS_INTELLIGENCE,
      commandKind: "writeProcessSignal",
      toolName: "updateControlRating",
      actingUserId: "P-003",
      roleId: "rcsa",
      actorKind: "human",
      autonomyLevel: state.autonomyLevel,
      sourceCanonicalType: "Process",
      sourceCanonicalId: "PRC-0042",
      targetExternalType: "pi.process",
      payload: { note: "this must never reach the connector" },
      intentStatement: "Write a value back to the process intelligence platform",
      atMoment: state.currentMoment,
    })
    .catch((error: unknown) => ({ blocked: true, denialCode: "threw", message: String(error), commandId: null }));
  assertEqual(refusal.blocked, true, "the write was refused");
  assertEqual(
    refusal.denialCode,
    "capability-not-declared",
    "the refusal names the undeclared capability",
  );
  assertEqual(refusal.commandId, null, "no command row was created for a refused capability");

  /* ======================================================================
     INBOUND
     ====================================================================== */

  section("INBOUND: a simulated process intelligence event arrives");

  step("Related GRC and evidence records load, so the required sources can answer.");
  /*
   * Every declared type on the three sources, not one each. A decision carries
   * the union of the requirements of every judgment kind recorded against its
   * object, and the payment control is the subject of more than one, so
   * syncing only the obvious types leaves a required source unanswered. That
   * is the correct behaviour of the required source check and the wrong
   * behaviour of a proof script.
   */
  const syncTargets = [CI_GRC, CI_PROCESS_INTELLIGENCE, CI_DOCUMENT_REPOSITORY];
  let mappedTotal = 0;
  for (const instanceId of syncTargets) {
    const instance = runtime.requireConnectorInstance(instanceId);
    for (const objectType of instance.capabilities.read) {
      const outcome = await runtime.runSync({
        runId,
        connectorInstanceId: instanceId,
        objectType,
        atMoment: state.currentMoment,
      });
      assertEqual(outcome.status, "ok", `${instance.sourceSystem} returned ${objectType}`);
      mappedTotal += outcome.recordsMapped;
    }
  }
  assertAtLeast(mappedTotal, 100, "records were mapped to canonical objects");
  assertAtLeast(
    count("external_references", "run_id = ?", [runId]),
    100,
    "external identities were retained, so every projection can be opened in its source system",
  );

  step("The event is built from the seeded scenario rather than invented.");
  const event = processDeviationEvent({
    runId,
    connectorInstanceId: CI_PROCESS_INTELLIGENCE,
    atMoment: "10:30",
  });
  if (!event) {
    fail("a deviation event could be derived from the seeded cases", "none derived");
    throw new Error("The scenario holds no mined cases. The proof cannot continue.");
  }
  const controlId = event.record.canonicalId;
  const seededControl = db
    .select()
    .from(schema.controls)
    .where(and(eq(schema.controls.runId, runId), eq(schema.controls.id, controlId)))
    .get();
  assertTrue(
    seededControl !== undefined,
    "the event concerns a control that exists in the seeded institution",
    controlId,
  );
  const deviationCount = Number(event.record.fields.value);
  const population = Number(event.record.fields.population);
  const seededPopulation = count("test_cases", "run_id = ?", [runId]);
  const seededUnreviewed = count("test_cases", "run_id = ? and secondary_review_evidenced = 0", [runId]);
  assertEqual(population, seededPopulation, "the population in the event equals the seeded case count");
  assertEqual(
    deviationCount,
    seededUnreviewed,
    "the deviation count equals the seeded cases with no evidenced secondary review",
  );
  assertAtLeast(deviationCount, 1, "the deviation is derived from real rows rather than asserted");

  step("The first delivery runs the full ten step inbound pipeline.");
  const first = runtime.ingestInboundEvent(event);
  assertEqual(first.status, "published", "the delivery was published");
  assertEqual(first.steps.length, 10, "all ten pipeline steps were recorded");
  assertEqual(first.deduplicated, false, "the first delivery is not a duplicate");
  assertTrue(first.integrationEventId !== null, "an integration event was created", first.integrationEventId ?? "");
  assertTrue(first.liveEventId !== null, "a live workday event was created", first.liveEventId ?? "");
  assertTrue(first.externalReferenceId !== null, "the raw external reference was retained");
  assertEqual(first.canonicalId, controlId, "the event mapped onto the affected control");
  for (const entry of first.steps) {
    console.log(`          ${entry.step}. ${entry.name}: ${entry.outcome}. ${entry.detail}`);
  }

  step("The same event delivered twice produces one row. Deduplication is by unique index.");
  const second = runtime.ingestInboundEvent(event);
  assertEqual(second.status, "deduplicated", "the second delivery was deduplicated");
  assertEqual(second.integrationEventId, first.integrationEventId, "it resolved to the existing event");
  assertEqual(
    count("integration_events", "run_id = ? and event_key = ?", [runId, event.eventKey]),
    1,
    "exactly one integration event row exists for this event key",
  );
  assertEqual(
    count("workday_live_events", "run_id = ? and integration_event_id = ?", [
      runId,
      first.integrationEventId ?? "",
    ]),
    1,
    "exactly one live day event was created, not two",
  );

  step("The live day event is attributable to the integration layer.");
  const liveEvent = db
    .select()
    .from(schema.workdayLiveEvents)
    .where(eq(schema.workdayLiveEvents.id, first.liveEventId ?? ""))
    .get();
  if (!liveEvent) {
    fail("the live day event can be read back", "not found");
  } else {
    assertEqual(liveEvent.derivedFrom, "integration", "derivedFrom records the integration origin");
    assertEqual(
      liveEvent.integrationEventId,
      first.integrationEventId,
      "the live event names the integration event that produced it",
    );
    assertEqual(
      liveEvent.sourceConnectorIds[0],
      CI_PROCESS_INTELLIGENCE,
      "the live event names the connector its data depends on",
    );
    assertEqual(liveEvent.objectId, controlId, "the live event points at the affected work object");
    assertEqual(liveEvent.requiresDecision, true, "the event puts a decision in front of a human");
  }

  step("Evidence loading started: the event carries the documents the object depends on.");
  assertAtLeast(first.evidenceIds.length, 1, "related evidence documents were resolved");
  const resolvedEvidence = count(
    "evidence_documents",
    `run_id = ? and id in (${first.evidenceIds.map(() => "?").join(",")})`,
    [runId, ...first.evidenceIds],
  );
  assertEqual(
    resolvedEvidence,
    first.evidenceIds.length,
    "every resolved evidence identifier exists in the seeded corpus",
  );

  step("The affected work object changed: its source attribution now names the new source.");
  const sources = runtime.getSourceAttribution({
    runId,
    canonicalType: "Control",
    canonicalId: controlId,
    contextType: "Control",
    contextId: controlId,
  });
  assertAtLeast(sources.length, 2, "the control is attributed to more than one source");
  assertTrue(
    sources.some((source) => source.connectorInstanceId === CI_PROCESS_INTELLIGENCE),
    "the process intelligence platform now appears under the control",
  );
  assertTrue(
    sources.some((source) => source.connectorInstanceId === CI_GRC),
    "the GRC platform appears under the control",
  );
  assertTrue(
    sources.every((source) => source.freshness !== "unknown"),
    "every attributed source reports a freshness state",
  );
  assertTrue(
    sources.some((source) => source.necessity === "required"),
    "the necessity comes from the declared source requirements, not a default",
  );
  /*
   * Both sources are flagged as conflicted, and that is the escalate-to-human
   * policy working rather than a defect. The GRC platform holds a recorded
   * rating and the mining platform has just asserted a deviation against the
   * same control. Reconciling that silently would destroy the only signal
   * that the disagreement exists, so the projection keeps both and the source
   * row says so.
   */
  assertTrue(
    sources.filter((source) => source.recordCount > 0).every((source) => source.conflicted),
    "the disagreement between the two sources that hold data is flagged rather than reconciled away",
  );
  /*
   * A declared source with no records still appears in the row. That is the
   * behaviour the AI layer depends on: a required source that has returned
   * nothing has to be visible as present and empty, because "we did not ask"
   * and "we asked and there was nothing" are different situations for a person
   * deciding whether to trust a conclusion.
   */
  assertTrue(
    sources.some((source) => source.recordCount === 0),
    "a declared source that has returned nothing for this object is still listed",
  );
  const conflictedReference = db
    .select()
    .from(schema.externalReferences)
    .where(
      and(
        eq(schema.externalReferences.runId, runId),
        eq(schema.externalReferences.connectorInstanceId, CI_PROCESS_INTELLIGENCE),
        eq(schema.externalReferences.externalType, "pi.deviation"),
      ),
    )
    .get();
  assertTrue(
    (conflictedReference?.conflictNote ?? "").length > 0,
    "the conflict carries a note a person can act on",
    conflictedReference?.conflictNote ?? "",
  );
  for (const source of sources) {
    console.log(
      `          ${source.sourceSystem}: ${source.freshness}, ${source.recordCount} record(s), necessity ${source.necessity}, mode ${source.mode}${source.conflicted ? ", CONFLICTED" : ""}`,
    );
  }

  step("The AI generation layer is told whether every required source answered.");
  const requiredCheck = runtime.checkRequiredSources({
    runId,
    contextType: "Control",
    contextId: controlId,
    canonicalType: "Control",
    canonicalId: controlId,
  });
  assertEqual(requiredCheck.satisfied, true, "every required source for this control answered");
  console.log(`          ${requiredCheck.statement}`);

  /* ======================================================================
     OUTBOUND
     ====================================================================== */

  section("OUTBOUND: a material decision produces a confirmed external change");

  const decision = db
    .select()
    .from(schema.decisions)
    .where(
      and(
        eq(schema.decisions.runId, runId),
        eq(schema.decisions.roleId, "rcsa"),
        eq(schema.decisions.judgmentKind, "control-effectiveness"),
      ),
    )
    .get();

  if (!decision) {
    fail("a material control effectiveness decision exists in the seeded day", "none found");
    throw new Error("The scenario holds no control effectiveness decision. The proof cannot continue.");
  }

  switchRole("rcsa");
  const liveState = requireScenarioState();

  const assessmentPayload = {
    decisionId: decision.id,
    entityId: decision.entityId,
    assessmentId: "ASM-PAY-2026-Q3",
    residualRisk: "high",
    conclusion: "The payment repair control is partially effective and the residual position rises.",
  };

  step("Without an approval the authority gate refuses and the command is held.");
  const held = await runtime.dispatchCommand({
    runId,
    connectorInstanceId: CI_GRC,
    commandKind: "updateAssessment",
    toolName: "updateAssessment",
    actingUserId: "P-003",
    roleId: "rcsa",
    actorKind: "human",
    autonomyLevel: liveState.autonomyLevel,
    decisionId: decision.id,
    sourceCanonicalType: "Assessment",
    sourceCanonicalId: assessmentPayload.assessmentId,
    targetExternalType: "grc.assessment",
    payload: assessmentPayload,
    intentStatement: "Create an assessment version carrying the human conclusion",
    atMoment: liveState.currentMoment,
    sequence: 1,
  });
  assertEqual(held.blocked, true, "the gate refused the unapproved change");
  assertEqual(held.denialCode, "approval-missing", "the refusal is that an approval is missing");
  assertEqual(held.status, "awaiting-approval", "the command is held rather than cancelled");
  assertEqual(
    countExternalObjects(GRC_SYSTEM_KEY),
    0,
    "nothing reached the target system without an approval",
  );
  assertTrue(held.auditEventId !== null, "the held action was written to the audit trail");

  step("A person approves the exact payload, and the same gate now permits it.");
  const approvalId = grantApproval({
    decisionId: decision.id,
    toolName: "updateAssessment",
    payloadFingerprint: fingerprintPayload("updateAssessment", assessmentPayload),
    rationale:
      "The mined repair cases show the secondary review is not evidenced for a material share of the population. I own this conclusion.",
    rationaleConfirmed: true,
  });
  const auditBefore = count("audit_events", "run_id = ?", [runId]);
  const activityBefore = count("ai_activity_entries", "run_id = ?", [runId]);

  const dispatched = await runtime.dispatchCommand({
    runId,
    connectorInstanceId: CI_GRC,
    commandKind: "updateAssessment",
    toolName: "updateAssessment",
    actingUserId: "P-003",
    roleId: "rcsa",
    actorKind: "human",
    autonomyLevel: liveState.autonomyLevel,
    approvalId,
    decisionId: decision.id,
    sourceCanonicalType: "Assessment",
    sourceCanonicalId: assessmentPayload.assessmentId,
    targetExternalType: "grc.assessment",
    payload: assessmentPayload,
    intentStatement: "Create an assessment version carrying the human conclusion",
    atMoment: liveState.currentMoment,
    sequence: 1,
  });

  assertEqual(dispatched.blocked, false, "the approved change passed the gate");
  assertEqual(dispatched.acknowledged, true, "the target system acknowledged the change");
  assertEqual(dispatched.status, "acknowledged", "the command reached its only terminal success state");
  for (const entry of dispatched.steps) {
    console.log(`          ${entry.step}. ${entry.name}: ${entry.outcome}. ${entry.detail}`);
  }

  step("The command passed through the outbox before anything was sent.");
  const commandRow = runtime.findCommandById(dispatched.commandId ?? "");
  if (!commandRow) {
    fail("the command row can be read back", "not found");
  } else {
    assertTrue(commandRow.queuedAt !== null, "the command was queued", commandRow.queuedAt ?? "");
    assertTrue(commandRow.executedAt !== null, "the command was executed after being queued");
    assertTrue(commandRow.acknowledgedAt !== null, "the acknowledgement time is recorded");
    assertEqual(commandRow.approvalId, approvalId, "the command carries the approval that authorised it");
    assertEqual(commandRow.authorityClass, "APPROVAL_REQUIRED", "the command carries its authority class");
    assertTrue(commandRow.correlationId.length > 0, "a correlation identifier travels with the command");
    assertTrue(commandRow.traceId.length > 0, "a trace identifier travels with the command");
  }

  step("An external reference came back, so the record can be opened in its source system.");
  assertTrue(dispatched.externalId !== null, "the target returned an external identifier", dispatched.externalId ?? "");
  const reference = db
    .select()
    .from(schema.externalReferences)
    .where(
      and(
        eq(schema.externalReferences.runId, runId),
        eq(schema.externalReferences.externalId, dispatched.externalId ?? ""),
      ),
    )
    .get();
  if (!reference) {
    fail("the external reference was projected locally", "not found");
  } else {
    assertEqual(reference.canonicalType, "Assessment", "the reference points at the canonical object");
    assertTrue(reference.externalUrl !== null, "a deep link was built from the connector template");
  }

  step("A receipt exists, and it was written from the acknowledgement.");
  const receipts = runtime.receiptsForCommand(dispatched.commandId ?? "");
  assertEqual(receipts.length, 1, "exactly one receipt row exists for the command");
  assertEqual(receipts[0]?.status, "acknowledged", "the receipt is acknowledged");
  assertEqual(
    receipts[0]?.externalId,
    dispatched.externalId,
    "the receipt carries the external reference the target returned",
  );
  console.log(`          ${receipts[0]?.statement}`);

  step("The audit trail and the activity stream were updated.");
  assertAtLeast(count("audit_events", "run_id = ?", [runId]) - auditBefore, 1, "audit events were added");
  assertEqual(
    count("audit_events", "run_id = ? and object_kind = ? and object_id = ? and category = ?", [
      runId,
      "integration-command",
      dispatched.commandId ?? "",
      "mutation",
    ]),
    1,
    "exactly one audit event records the change as a confirmed mutation",
  );
  assertAtLeast(
    count("audit_events", "run_id = ? and object_kind = ? and object_id = ?", [
      runId,
      "integration-command",
      dispatched.commandId ?? "",
    ]),
    2,
    "the earlier hold for approval is also on the record, so the whole sequence is auditable",
  );
  assertAtLeast(
    count("ai_activity_entries", "run_id = ?", [runId]) - activityBefore,
    1,
    "the change appears in the activity stream",
  );
  assertEqual(
    receipts[0]?.auditEventId !== null,
    true,
    "the receipt line cites the audit event that recorded it",
  );

  step("A replay of the same approved change finds the existing row, not a second object.");
  const objectsAfterFirst = countExternalObjects(GRC_SYSTEM_KEY);
  const replay = await runtime.dispatchCommand({
    runId,
    connectorInstanceId: CI_GRC,
    commandKind: "updateAssessment",
    toolName: "updateAssessment",
    actingUserId: "P-003",
    roleId: "rcsa",
    actorKind: "human",
    autonomyLevel: liveState.autonomyLevel,
    approvalId,
    decisionId: decision.id,
    sourceCanonicalType: "Assessment",
    sourceCanonicalId: assessmentPayload.assessmentId,
    targetExternalType: "grc.assessment",
    payload: assessmentPayload,
    intentStatement: "Create an assessment version carrying the human conclusion",
    atMoment: liveState.currentMoment,
    sequence: 1,
  });
  assertEqual(replay.created, false, "the replay found the existing command");
  assertEqual(replay.commandId, dispatched.commandId, "it resolved to the same command identifier");
  assertEqual(
    countExternalObjects(GRC_SYSTEM_KEY),
    objectsAfterFirst,
    "the external object count did not change",
  );
  assertEqual(
    runtime.receiptsForCommand(dispatched.commandId ?? "").length,
    1,
    "no second receipt was written",
  );

  /* ======================================================================
     FAILURE
     ====================================================================== */

  section("FAILURE: an unavailable target system, a dead letter, and a recovery");

  const actionPayload = {
    decisionId: decision.id,
    entityId: decision.entityId,
    title: "Evidence the secondary review on every fallback route repair",
    description:
      "First line to evidence the secondary review for repair cases routed through the fallback.",
    relatedObjectId: controlId,
    relatedObjectKind: "control",
    kind: "remediation",
    dueOn: "2026-11-14",
  };

  step("The target system is set unavailable. The connector reports it at call time.");
  setSystemAvailability(GRC_SYSTEM_KEY, false);
  assertEqual(
    (await runtime.checkConnectorHealth(CI_GRC, { runId })).state,
    "unavailable",
    "the GRC simulator reports itself unavailable",
  );
  const objectsBeforeFailure = countExternalObjects(GRC_SYSTEM_KEY);

  step("A person approves an action anyway. The approval and the decision are recorded.");
  const actionApprovalId = grantApproval({
    decisionId: decision.id,
    toolName: "createAction",
    payloadFingerprint: fingerprintPayload("createAction", actionPayload),
    rationale: "First line must evidence the review. I own this conclusion.",
    rationaleConfirmed: true,
  });
  const approvalRow = db
    .select()
    .from(schema.approvals)
    .where(eq(schema.approvals.id, actionApprovalId))
    .get();
  assertTrue(approvalRow !== undefined, "the approval row exists", actionApprovalId);
  assertEqual(approvalRow?.rationaleConfirmed, true, "the approver confirmed the rationale as their own");

  step("The approved command exhausts its bounded retries and enters dead letter.");
  const deadLettered = await runtime.dispatchCommand(
    {
      runId,
      connectorInstanceId: CI_GRC,
      commandKind: "createAction",
      toolName: "createAction",
      actingUserId: "P-003",
      roleId: "rcsa",
      actorKind: "human",
      autonomyLevel: liveState.autonomyLevel,
      approvalId: actionApprovalId,
      decisionId: decision.id,
      sourceCanonicalType: "Action",
      sourceCanonicalId: `ACT-FOR-${controlId}`,
      targetExternalType: "grc.action",
      payload: actionPayload,
      intentStatement: "Create a remediation action for the control owner",
      atMoment: liveState.currentMoment,
      sequence: 2,
    },
    { jitter: runtime.noJitter },
  );

  assertEqual(deadLettered.status, "dead-letter", "the command is dead lettered");
  assertEqual(deadLettered.deadLettered, true, "the dead letter flag is set");
  assertEqual(deadLettered.acknowledged, false, "the change was never acknowledged");
  assertEqual(deadLettered.attempts, 3, "the bounded retry made exactly the configured attempts");
  assertEqual(deadLettered.denialCode, "connector-unavailable", "the failure is classified and retryable");
  for (const entry of deadLettered.steps) {
    console.log(`          ${entry.step}. ${entry.name}: ${entry.outcome}. ${entry.detail}`);
  }

  step("The approved human decision is preserved. Only the delivery failed.");
  const approvalAfter = db
    .select()
    .from(schema.approvals)
    .where(eq(schema.approvals.id, actionApprovalId))
    .get();
  assertTrue(approvalAfter !== undefined, "the approval row still exists");
  assertEqual(
    approvalAfter?.rationale,
    approvalRow?.rationale,
    "the recorded rationale is unchanged",
  );
  assertEqual(
    count("dead_letter_entries", "run_id = ? and command_id = ?", [runId, deadLettered.commandId ?? ""]),
    1,
    "one dead letter entry exists for the command",
  );

  step("No receipt was written, because nothing was acknowledged.");
  assertEqual(
    runtime.receiptsForCommand(deadLettered.commandId ?? "").length,
    0,
    "the receipts table holds no row for an unacknowledged change",
  );
  assertEqual(
    runtime.hasNoAcknowledgedReceipt(deadLettered.commandId ?? ""),
    true,
    "there is no acknowledged receipt line",
  );

  step("The interface state is queued or failed, never complete.");
  const pendingLines = runtime.receiptLinesForDecision(runId, decision.id);
  const failedLine = pendingLines.find((line) => line.id === `PEND-${deadLettered.commandId}`);
  if (!failedLine) {
    fail("the decision receipt projects the unacknowledged command", "no pending line found");
  } else {
    assertEqual(failedLine.status, "dead-letter", "the line reports that a retry is needed");
    assertEqual(failedLine.externalId, null, "the line carries no external reference");
    assertTrue(
      failedLine.statement.includes("not been confirmed"),
      "the line says plainly that the change is not confirmed",
    );
    console.log(`          ${failedLine.statement}`);
  }
  const acknowledgedLines = pendingLines.filter((line) => line.status === "acknowledged");
  assertEqual(acknowledgedLines.length, 1, "only the genuinely confirmed change reads as acknowledged");

  step("A retry against the still unavailable target creates no duplicate external object.");
  const retryWhileDown = await runtime.retryCommand(deadLettered.commandId ?? "", {
    jitter: runtime.noJitter,
  });
  assertEqual(retryWhileDown.acknowledged, false, "the retry did not succeed");
  assertEqual(
    countExternalObjects(GRC_SYSTEM_KEY),
    objectsBeforeFailure,
    "the external object count is unchanged",
  );
  assertEqual(
    runtime.receiptsForCommand(deadLettered.commandId ?? "").length,
    0,
    "still no receipt row",
  );

  step("The connector recovers.");
  setSystemAvailability(GRC_SYSTEM_KEY, true);
  assertEqual(
    (await runtime.checkConnectorHealth(CI_GRC, { runId })).state,
    "healthy",
    "the GRC simulator is responding again",
  );

  step("The same command completes on its original idempotency key.");
  const originalKey = runtime.findCommandById(deadLettered.commandId ?? "")?.idempotencyKey ?? "";
  const recovered = await runtime.retryCommand(deadLettered.commandId ?? "", {
    jitter: runtime.noJitter,
  });
  assertEqual(recovered.acknowledged, true, "the retry was acknowledged");
  assertEqual(recovered.commandId, deadLettered.commandId, "it is the same command, not a new one");
  assertEqual(
    runtime.findCommandById(recovered.commandId ?? "")?.idempotencyKey,
    originalKey,
    "the idempotency key did not change",
  );
  assertEqual(
    countExternalObjects(GRC_SYSTEM_KEY),
    objectsBeforeFailure + 1,
    "the target holds exactly one more object than before, across four attempts",
  );

  step("The receipt and the audit trail update, and the dead letter closes.");
  const recoveredReceipts = runtime.receiptsForCommand(recovered.commandId ?? "");
  assertEqual(recoveredReceipts.length, 1, "exactly one receipt row now exists");
  assertEqual(recoveredReceipts[0]?.status, "acknowledged", "the receipt is acknowledged");
  assertEqual(
    count("audit_events", "run_id = ? and object_kind = ? and object_id = ? and category = ?", [
      runId,
      "integration-command",
      recovered.commandId ?? "",
      "mutation",
    ]),
    1,
    "exactly one mutation event exists, for the one change the target confirmed",
  );
  assertAtLeast(
    count("audit_events", "run_id = ? and object_kind = ? and object_id = ? and category = ?", [
      runId,
      "integration-command",
      recovered.commandId ?? "",
      "system",
    ]),
    1,
    "every dead letter along the way is also on the record",
  );
  const closed = db
    .select()
    .from(schema.deadLetterEntries)
    .where(eq(schema.deadLetterEntries.commandId, recovered.commandId ?? ""))
    .get();
  assertTrue(closed?.resolvedAt !== null, "the dead letter entry is resolved", closed?.resolution ?? "");

  step("A retry after success sends nothing at all.")
  const retryAfterSuccess = await runtime.retryCommand(recovered.commandId ?? "");
  assertEqual(retryAfterSuccess.acknowledged, true, "the retry reports the existing acknowledgement");
  assertEqual(
    countExternalObjects(GRC_SYSTEM_KEY),
    objectsBeforeFailure + 1,
    "the target still holds exactly one more object than before",
  );
  assertEqual(
    runtime.receiptsForCommand(recovered.commandId ?? "").length,
    1,
    "no second receipt was written",
  );

  /* ======================================================================
     Summary
     ====================================================================== */

  section("SUMMARY");
  const summary = runtime.summariseOutbox(runId);
  console.log(`    Connector instances              ${instances.length}`);
  console.log(`    External references retained      ${count("external_references", "run_id = ?", [runId])}`);
  console.log(`    Inbound integration events        ${count("integration_events", "run_id = ? and direction = ?", [runId, "inbound"])}`);
  console.log(`    Live day events from integration  ${count("workday_live_events", "run_id = ? and derived_from = ?", [runId, "integration"])}`);
  console.log(`    Outbound commands                 ${summary.total}`);
  console.log(`    Acknowledged                      ${summary.acknowledged}`);
  console.log(`    Held awaiting approval            ${summary.awaitingApproval}`);
  console.log(`    External receipts                 ${count("external_execution_receipts", "run_id = ?", [runId])}`);
  console.log(`    Distinct external objects created ${countExternalObjects()}`);
  console.log(`    Assertions failed                 ${failures}`);

  closeDb();
  try {
    rmSync(directory, { recursive: true, force: true });
  } catch {
    // A locked file on Windows is not worth failing the proof over. The
    // directory is under the system temporary path and will be reclaimed.
  }

  if (failures > 0) {
    console.error(`\nThe integration proof failed: ${failures} assertion(s) did not hold.`);
    process.exit(1);
  }

  console.log("\nThe integration proof passed. Every numbered claim above was asserted.");
}

main().catch((error: unknown) => {
  console.error("\nThe integration proof could not complete.");
  console.error(error);
  process.exit(1);
});
