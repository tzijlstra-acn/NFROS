/**
 * Mutation tool handlers.
 *
 * Every write to the database that is not the seed passes through one of these
 * handlers, and every handler is reached only through `executeTool`, which
 * means the authority gate has already run. None of these functions checks
 * authority itself, deliberately: a second, differently written check would
 * eventually disagree with the first, and then the security question becomes
 * which one is authoritative.
 *
 * Each handler returns receipt statements describing what genuinely changed,
 * so the execution receipt shown to the user is derived from completed
 * mutations rather than from the proposal.
 */

import { and, eq, max } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import {
  assessmentLines,
  assessments,
  controlTests,
  incidents,
  obligations,
  recoveryOptions,
  testCases,
} from "@/db/schema/practice";
import { controls, suppliers } from "@/db/schema/domain";
import {
  actions,
  committeeItems,
  issues,
  monitoringActivations,
  portfolioThemes,
} from "@/db/schema/decisions";
import { collaborationMessages } from "@/db/schema/work";
import { registerToolHandler, type ToolContext, type ToolHandlerResult } from "./runtime";
import {
  calculateRiskMatrixPosition,
  ratingFor,
  type ControlEffectiveness,
} from "@/domain/nfr/calculators";

const db = () => getDb();

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${String(idCounter).padStart(3, "0")}`;
}

function str(payload: Record<string, unknown>, key: string, fallback = ""): string {
  const value = payload[key];
  return typeof value === "string" ? value : fallback;
}

function requireStr(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`The tool requires a "${key}" value.`);
  }
  return value;
}

/** The shape better-sqlite3 returns from a statement. */
interface RunResult {
  changes: number;
}

/**
 * Asserts that an update actually matched a row.
 *
 * This exists because of a real defect. Several handlers issued an
 * `update ... where id = ?` against an identifier that named nothing, matched
 * zero rows, and then returned their receipt statements as though the change
 * had happened. The module header claims the execution receipt is derived from
 * completed mutations, and for those handlers it was not: a mistyped target in
 * seeded data produced a confident receipt line saying a record had been
 * updated when nothing had been written.
 *
 * Throwing here is the right behaviour rather than returning a soft failure.
 * The tool runtime catches it, records the call as failed, writes the audit
 * event, and the decision engine reports it under "not executed". So the user
 * sees that the change did not happen, which is the whole point.
 */
function assertWrote(result: RunResult, description: string): void {
  if (result.changes === 0) {
    throw new Error(
      `${description} matched no row, so nothing was written. The target identifier does not exist. No receipt line is produced for a change that did not happen.`,
    );
  }
}

/**
 * Asserts that a referenced row exists before an insert that points at it.
 *
 * An insert always succeeds, so a foreign reference to a non-existent object
 * would otherwise be recorded silently and appear on a receipt.
 */
function assertExists(sql: string, id: string, kind: string): void {
  const row = getSqlite().prepare(sql).get(id) as { n: number } | undefined;
  if ((row?.n ?? 0) === 0) {
    throw new Error(
      `The ${kind} "${id}" does not exist, so the record was not created. A reference to a missing object would appear on a receipt as though it were real.`,
    );
  }
}

/* ==========================================================================
   Control effectiveness and assessment versioning
   ========================================================================== */

/**
 * Changes recorded control effectiveness.
 *
 * The change is written to the single control row, which is why it becomes
 * visible in the RCSA view, the Control Assurance view and the portfolio view
 * at the same time. There is no per view copy to keep in step.
 */
registerToolHandler("updateControlRating", (payload, context): ToolHandlerResult => {
  const controlId = requireStr(payload, "controlId");
  const effectiveness = requireStr(payload, "effectiveness") as ControlEffectiveness;

  const control = db()
    .select()
    .from(controls)
    .where(and(eq(controls.runId, context.runId), eq(controls.id, controlId)))
    .get();
  if (!control) throw new Error(`Control ${controlId} was not found.`);

  const previous = control.currentEffectiveness;

  db()
    .update(controls)
    .set({
      currentEffectiveness: effectiveness,
      effectivenessSetBy: context.actingUserId,
      effectivenessSetAt: new Date().toISOString(),
    })
    .where(and(eq(controls.runId, context.runId), eq(controls.id, controlId)))
    .run();

  return {
    summary: `Control ${control.reference} effectiveness changed from ${previous} to ${effectiveness} by ${context.actingUserId}.`,
    objectKind: "control",
    objectId: controlId,
    data: { controlId, previous, effectiveness, firstLineEffectiveness: control.firstLineEffectiveness },
    receiptStatements: [`Control assessment updated: ${control.reference} is now ${effectiveness.replace(/-/g, " ")}`],
  };
});

/**
 * Creates a new assessment version carrying the human conclusion.
 *
 * The previous version is marked superseded rather than edited. A risk
 * decision that overwrites its predecessor leaves nothing for an auditor to
 * compare, which defeats the point of versioning at all.
 */
registerToolHandler("updateAssessment", (payload, context): ToolHandlerResult => {
  const assessmentId = requireStr(payload, "assessmentId");
  const residualRisk = str(payload, "residualRisk");
  const conclusion = str(payload, "conclusion");
  const rationale = str(payload, "rationale");
  const decisionId = str(payload, "decisionId") || null;

  const current = db()
    .select()
    .from(assessments)
    .where(and(eq(assessments.runId, context.runId), eq(assessments.id, assessmentId)))
    .get();
  if (!current) throw new Error(`Assessment ${assessmentId} was not found.`);

  const highest =
    db()
      .select({ value: max(assessments.version) })
      .from(assessments)
      .where(
        and(
          eq(assessments.runId, context.runId),
          eq(assessments.subjectId, current.subjectId),
          eq(assessments.kind, current.kind),
        ),
      )
      .get()?.value ?? current.version;

  const newVersion = highest + 1;
  const newAssessmentId = `${current.reference}-v${newVersion}`;
  const now = new Date().toISOString();

  db()
    .insert(assessments)
    .values({
      ...current,
      id: newAssessmentId,
      version: newVersion,
      status: "approved",
      supersededBy: null,
      performedByUserId: context.actingUserId,
      approvedByUserId: context.actingUserId,
      performedOn: now,
      approvedOn: now,
      residualRisk: residualRisk || current.residualRisk,
      overallConclusion: conclusion || current.overallConclusion,
      rationale,
      createdBySession: true,
      sourceDecisionId: decisionId,
    })
    .run();

  // Copy the lines forward so the new version is complete, not a stub.
  const lines = db()
    .select()
    .from(assessmentLines)
    .where(
      and(eq(assessmentLines.runId, context.runId), eq(assessmentLines.assessmentId, assessmentId)),
    )
    .all();

  for (const line of lines) {
    const control = line.controlIds[0]
      ? db()
          .select()
          .from(controls)
          .where(and(eq(controls.runId, context.runId), eq(controls.id, line.controlIds[0])))
          .get()
      : undefined;

    const effectiveness = (control?.currentEffectiveness ?? line.controlEffectiveness) as ControlEffectiveness;
    const position = calculateRiskMatrixPosition({
      inherentLikelihood: line.inherentLikelihood,
      inherentImpact: line.inherentImpact,
      controlEffectiveness: effectiveness,
    });

    const changed = effectiveness !== line.controlEffectiveness;

    db()
      .insert(assessmentLines)
      .values({
        ...line,
        id: `${newAssessmentId}-L${line.sortOrder}`,
        assessmentId: newAssessmentId,
        controlEffectiveness: effectiveness,
        residualLikelihood: position.residualLikelihood,
        residualImpact: position.residualImpact,
        residualRating: position.residualRating,
        changeFromPrevious: changed
          ? `Control effectiveness moved from ${line.controlEffectiveness} to ${effectiveness}, which moved the residual position to ${position.residualRating}.`
          : "",
      })
      .run();
  }

  db()
    .update(assessments)
    .set({ status: "superseded", supersededBy: newAssessmentId })
    .where(and(eq(assessments.runId, context.runId), eq(assessments.id, assessmentId)))
    .run();

  return {
    summary: `Assessment ${current.reference} version ${newVersion} created and version ${current.version} superseded.`,
    objectKind: "assessment",
    objectId: newAssessmentId,
    data: { assessmentId: newAssessmentId, version: newVersion, supersededId: assessmentId },
    receiptStatements: [
      `Assessment version created: ${current.reference} version ${newVersion}`,
      `Decision rationale recorded against ${newAssessmentId}`,
    ],
  };
});

registerToolHandler("proposeAndRecordResidualRisk", (payload, context): ToolHandlerResult => {
  const lineId = requireStr(payload, "assessmentLineId");
  const likelihood = Number(payload.residualLikelihood ?? 0);
  const impact = Number(payload.residualImpact ?? 0);
  const rating = ratingFor(likelihood, impact);

  const line = db()
    .select()
    .from(assessmentLines)
    .where(and(eq(assessmentLines.runId, context.runId), eq(assessmentLines.id, lineId)))
    .get();
  if (!line) throw new Error(`Assessment line ${lineId} was not found.`);

  db()
    .update(assessmentLines)
    .set({
      residualLikelihood: likelihood,
      residualImpact: impact,
      residualRating: rating,
      commentary: str(payload, "commentary", line.commentary),
    })
    .where(and(eq(assessmentLines.runId, context.runId), eq(assessmentLines.id, lineId)))
    .run();

  return {
    summary: `Residual risk on line ${lineId} recorded as ${rating} at likelihood ${likelihood} and impact ${impact}.`,
    objectKind: "assessment-line",
    objectId: lineId,
    data: { lineId, rating },
    receiptStatements: [`Residual risk recorded: ${rating}`],
  };
});

registerToolHandler("initiateReassessment", (payload, context): ToolHandlerResult => {
  const subjectId = requireStr(payload, "subjectId");
  const scope = str(payload, "scope", "Targeted off-cycle reassessment.");
  const id = newId("RCSA-OFFCYCLE");
  const now = new Date().toISOString();

  db()
    .insert(assessments)
    .values({
      id,
      runId: context.runId,
      kind: "rcsa",
      reference: id,
      title: `Off-cycle reassessment: ${subjectId}`,
      subjectKind: str(payload, "subjectKind", "process"),
      subjectId,
      entityId: str(payload, "entityId", "ARC-DE"),
      version: 1,
      status: "off-cycle",
      cycle: "Off-cycle 2026",
      performedByUserId: context.actingUserId,
      performedOn: now,
      residualRisk: "pending",
      overallConclusion: "Reassessment initiated. No conclusion has been reached.",
      rationale: scope,
      createdBySession: true,
      sourceDecisionId: str(payload, "decisionId") || null,
    })
    .run();

  return {
    summary: `Off-cycle reassessment ${id} initiated for ${subjectId}.`,
    objectKind: "assessment",
    objectId: id,
    data: { assessmentId: id },
    receiptStatements: [`Off-cycle reassessment created: ${id}`],
  };
});

/* ==========================================================================
   Actions, issues, committee, monitoring
   ========================================================================== */

registerToolHandler("createAction", (payload, context): ToolHandlerResult => {
  const id = newId("MSN");
  const title = requireStr(payload, "title");
  const ownerUserId = str(payload, "ownerUserId") || null;

  db()
    .insert(actions)
    .values({
      id,
      runId: context.runId,
      reference: id,
      title,
      description: str(payload, "description", title),
      kind: str(payload, "kind", "remediation"),
      issueId: str(payload, "issueId") || null,
      raisedByRoleId: context.roleId,
      ownerUserId,
      ownerLabel: str(payload, "ownerLabel"),
      entityId: str(payload, "entityId", "ARC-DE"),
      createdOn: new Date().toISOString(),
      dueOn: str(payload, "dueOn") || null,
      status: "open",
      priority: str(payload, "priority", "medium"),
      isUnowned: ownerUserId === null,
      relatedObjectKind: str(payload, "relatedObjectKind") || null,
      relatedObjectId: str(payload, "relatedObjectId") || null,
      sourceDecisionId: str(payload, "decisionId") || null,
      createdBySession: true,
      progressNote: "",
    })
    .run();

  return {
    summary: `Remediation action ${id} created and assigned to ${ownerUserId ?? "no owner yet"}.`,
    objectKind: "action",
    objectId: id,
    data: { actionId: id },
    receiptStatements: [`Action assigned: ${id}${ownerUserId ? ` to ${ownerUserId}` : " (owner not yet named)"}`],
  };
});

registerToolHandler("createIssue", (payload, context): ToolHandlerResult => {
  const id = newId("ISS");
  const title = requireStr(payload, "title");

  db()
    .insert(issues)
    .values({
      id,
      runId: context.runId,
      reference: id,
      title,
      description: str(payload, "description", title),
      kind: str(payload, "kind", "control-gap"),
      raisedByUserId: context.actingUserId,
      raisedOn: new Date().toISOString(),
      entityId: str(payload, "entityId", "ARC-DE"),
      severity: str(payload, "severity", "medium"),
      status: "open",
      ownerUserId: str(payload, "ownerUserId") || null,
      dueOn: str(payload, "dueOn") || null,
      relatedObjectKind: str(payload, "relatedObjectKind") || null,
      relatedObjectId: str(payload, "relatedObjectId") || null,
      controlIds: Array.isArray(payload.controlIds) ? (payload.controlIds as string[]) : [],
      supplierIds: Array.isArray(payload.supplierIds) ? (payload.supplierIds as string[]) : [],
      createdBySession: true,
    })
    .run();

  return {
    summary: `Issue ${id} raised: ${title}`,
    objectKind: "issue",
    objectId: id,
    data: { issueId: id },
    receiptStatements: [`Issue raised: ${id}`],
  };
});

registerToolHandler("addCommitteeAgendaItem", (payload, context): ToolHandlerResult => {
  const id = newId("AG");
  const title = requireStr(payload, "title");
  const committeeRef = str(payload, "committeeRef", "CMT-NFR-2026-10");

  const existing = db()
    .select()
    .from(committeeItems)
    .where(and(eq(committeeItems.runId, context.runId), eq(committeeItems.committeeRef, committeeRef)))
    .all();

  db()
    .insert(committeeItems)
    .values({
      id,
      runId: context.runId,
      committeeRef,
      committeeName: str(payload, "committeeName", "Group Non-Financial Risk Committee"),
      meetingDate: str(payload, "meetingDate", "2026-10-13"),
      entityId: str(payload, "entityId", "ARC-DE"),
      title,
      summary: str(payload, "summary", title),
      itemType: str(payload, "itemType", "decision"),
      raisedByRoleId: context.roleId,
      agendaPosition: existing.length + 1,
      onAgenda: true,
      relatedObjectKind: str(payload, "relatedObjectKind") || null,
      relatedObjectId: str(payload, "relatedObjectId") || null,
      sourceDecisionId: str(payload, "decisionId") || null,
      createdBySession: true,
      themeId: str(payload, "themeId") || null,
    })
    .run();

  return {
    summary: `Committee agenda item ${id} added to ${committeeRef}: ${title}`,
    objectKind: "committee-item",
    objectId: id,
    data: { itemId: id },
    receiptStatements: [`Committee agenda updated: ${committeeRef} item ${existing.length + 1}`],
  };
});

registerToolHandler("activateMonitoring", (payload, context): ToolHandlerResult => {
  const id = newId("MON");
  const subjectId = requireStr(payload, "subjectId");

  db()
    .insert(monitoringActivations)
    .values({
      id,
      runId: context.runId,
      subjectKind: str(payload, "subjectKind", "supplier"),
      subjectId,
      kind: str(payload, "kind", "enhanced-supplier-monitoring"),
      description: str(payload, "description", `Enhanced monitoring activated on ${subjectId}.`),
      activatedByUserId: context.actingUserId,
      activatedAtMoment: context.atMoment,
      activatedAt: new Date().toISOString(),
      reviewFrequency: str(payload, "reviewFrequency", "weekly"),
      nextReviewOn: str(payload, "nextReviewOn") || null,
      sourceDecisionId: str(payload, "decisionId") || null,
      active: true,
    })
    .run();

  return {
    summary: `Enhanced monitoring activated on ${subjectId} with a ${str(payload, "reviewFrequency", "weekly")} review.`,
    objectKind: "monitoring",
    objectId: id,
    data: { monitoringId: id },
    receiptStatements: [`Monitoring activated: ${subjectId}`],
  };
});

/* ==========================================================================
   Supplier decisions
   ========================================================================== */

registerToolHandler("setSupplierCriticality", (payload, context): ToolHandlerResult => {
  const supplierId = requireStr(payload, "supplierId");
  const criticality = requireStr(payload, "criticality");

  const supplier = db()
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.runId, context.runId), eq(suppliers.id, supplierId)))
    .get();
  if (!supplier) throw new Error(`Supplier ${supplierId} was not found.`);

  db()
    .update(suppliers)
    .set({ criticality })
    .where(and(eq(suppliers.runId, context.runId), eq(suppliers.id, supplierId)))
    .run();

  return {
    summary: `Supplier ${supplier.name} criticality changed from ${supplier.criticality} to ${criticality}.`,
    objectKind: "supplier",
    objectId: supplierId,
    data: { supplierId, previous: supplier.criticality, criticality },
    receiptStatements: [`Supplier criticality updated: ${supplier.name} is now ${criticality}`],
  };
});

registerToolHandler("recordSupplierAssessment", (payload, context): ToolHandlerResult => {
  const supplierId = requireStr(payload, "supplierId");
  const conclusion = requireStr(payload, "conclusion");
  const id = newId("SUPASS");
  const now = new Date().toISOString();

  db()
    .insert(assessments)
    .values({
      id,
      runId: context.runId,
      kind: "supplier",
      reference: id,
      title: `Supplier assessment conclusion: ${supplierId}`,
      subjectKind: "supplier",
      subjectId: supplierId,
      entityId: str(payload, "entityId", "ARC-DE"),
      version: 1,
      status: "approved",
      cycle: "2026 reassessment",
      performedByUserId: context.actingUserId,
      approvedByUserId: context.actingUserId,
      performedOn: now,
      approvedOn: now,
      residualRisk: str(payload, "residualRisk", "medium"),
      overallConclusion: conclusion,
      rationale: str(payload, "rationale"),
      createdBySession: true,
      sourceDecisionId: str(payload, "decisionId") || null,
    })
    .run();

  db()
    .update(suppliers)
    .set({ status: str(payload, "supplierStatus", "active"), lastAssessmentDate: now })
    .where(and(eq(suppliers.runId, context.runId), eq(suppliers.id, supplierId)))
    .run();

  return {
    summary: `Supplier assessment ${id} recorded for ${supplierId}: ${conclusion}`,
    objectKind: "assessment",
    objectId: id,
    data: { assessmentId: id },
    receiptStatements: [`Supplier assessment recorded: ${id}`],
  };
});

registerToolHandler("applySupplierRestriction", (payload, context): ToolHandlerResult => {
  const supplierId = requireStr(payload, "supplierId");
  const restriction = requireStr(payload, "restriction");

  assertWrote(
    db()
      .update(suppliers)
      .set({ status: restriction === "exit-planned" ? "exit-planned" : "under-reassessment" })
      .where(and(eq(suppliers.runId, context.runId), eq(suppliers.id, supplierId)))
      .run(),
    "Applying a restriction to supplier " + supplierId,
  );

  return {
    summary: `Restriction applied to supplier ${supplierId}: ${restriction}`,
    objectKind: "supplier",
    objectId: supplierId,
    data: { supplierId, restriction },
    receiptStatements: [`Supplier restriction applied: ${restriction}`],
  };
});

/* ==========================================================================
   Control testing decisions
   ========================================================================== */

registerToolHandler("recordTestConclusion", (payload, context): ToolHandlerResult => {
  const testId = requireStr(payload, "controlTestId");
  const conclusion = requireStr(payload, "conclusion");

  const test = db()
    .select()
    .from(controlTests)
    .where(and(eq(controlTests.runId, context.runId), eq(controlTests.id, testId)))
    .get();
  if (!test) throw new Error(`Control test ${testId} was not found.`);

  db()
    .update(controlTests)
    .set({
      assuranceConclusion: conclusion,
      concludedByUserId: context.actingUserId,
      concludedOn: new Date().toISOString(),
      status: "concluded",
    })
    .where(and(eq(controlTests.runId, context.runId), eq(controlTests.id, testId)))
    .run();

  return {
    summary: `Assurance conclusion recorded on ${test.reference}: ${conclusion}`,
    objectKind: "control-test",
    objectId: testId,
    data: { testId, conclusion },
    receiptStatements: [`Assurance conclusion recorded: ${test.reference}`],
  };
});

registerToolHandler("classifyTestException", (payload, context): ToolHandlerResult => {
  const caseId = requireStr(payload, "testCaseId");
  const classification = requireStr(payload, "classification");
  const scope = str(payload, "scope", "indeterminate");

  assertWrote(
    db()
      .update(testCases)
      .set({
        exceptionClassification: classification,
        exceptionScope: scope,
        rootCause: str(payload, "rootCause") || null,
        classifiedByUserId: context.actingUserId,
        classifiedAt: new Date().toISOString(),
      })
      .where(and(eq(testCases.runId, context.runId), eq(testCases.id, caseId)))
      .run(),
    "Classifying test case " + caseId,
  );

  return {
    summary: `Exception ${caseId} classified as ${classification} and ${scope}.`,
    objectKind: "test-case",
    objectId: caseId,
    data: { caseId, classification, scope },
    receiptStatements: [`Exception classified: ${caseId} is ${scope}`],
  };
});

registerToolHandler("recordFinding", (payload, context): ToolHandlerResult => {
  const id = newId("FND");
  const title = requireStr(payload, "title");
  const controlTestId = str(payload, "controlTestId");

  /*
   * A finding is recorded against a control test, and the row it creates
   * claims that relationship. So the control test has to exist.
   *
   * Without this check the consequence mapping would accept any identifier,
   * and a target that was actually an indicator or an impact tolerance would
   * produce a finding asserting a relationship to a control test that does
   * not exist. The insert would succeed and the receipt would say so.
   */
  if (controlTestId.length > 0) {
    assertExists(
      "select count(*) as n from control_tests where id = ?",
      controlTestId,
      "control test",
    );
  }

  db()
    .insert(issues)
    .values({
      id,
      runId: context.runId,
      reference: id,
      title,
      description: str(payload, "description", title),
      kind: "finding",
      raisedByUserId: context.actingUserId,
      raisedOn: new Date().toISOString(),
      entityId: str(payload, "entityId", "ARC-DE"),
      severity: str(payload, "severity", "medium"),
      status: "open",
      ownerUserId: str(payload, "ownerUserId") || null,
      dueOn: str(payload, "dueOn") || null,
      relatedObjectKind: "control-test",
      relatedObjectId: controlTestId || null,
      controlIds: Array.isArray(payload.controlIds) ? (payload.controlIds as string[]) : [],
      supplierIds: [],
      createdBySession: true,
    })
    .run();

  return {
    summary: `Finding ${id} recorded at severity ${str(payload, "severity", "medium")}: ${title}`,
    objectKind: "issue",
    objectId: id,
    data: { findingId: id },
    receiptStatements: [`Finding recorded: ${id}`],
  };
});

/* ==========================================================================
   Incident decisions
   ========================================================================== */

registerToolHandler("classifyIncident", (payload, context): ToolHandlerResult => {
  const incidentId = requireStr(payload, "incidentId");
  const severity = requireStr(payload, "severity");

  assertWrote(
    db()
      .update(incidents)
      .set({
        severity,
        severitySetByUserId: context.actingUserId,
        regulatoryClassification: str(payload, "regulatoryClassification") || null,
        status: str(payload, "status", "contained"),
      })
      .where(and(eq(incidents.runId, context.runId), eq(incidents.id, incidentId)))
      .run(),
    "Classifying incident " + incidentId,
  );

  return {
    summary: `Incident ${incidentId} classified at severity ${severity} by ${context.actingUserId}.`,
    objectKind: "incident",
    objectId: incidentId,
    data: { incidentId, severity },
    receiptStatements: [`Incident severity recorded: ${severity}`],
  };
});

registerToolHandler("escalateIncident", (payload, context): ToolHandlerResult => {
  const incidentId = requireStr(payload, "incidentId");
  const escalateTo = requireStr(payload, "escalateTo");

  assertWrote(
    db()
      .update(incidents)
      .set({ status: "under-assessment" })
      .where(and(eq(incidents.runId, context.runId), eq(incidents.id, incidentId)))
      .run(),
    "Escalating incident " + incidentId,
  );

  return {
    summary: `Incident ${incidentId} escalated to ${escalateTo}.`,
    objectKind: "incident",
    objectId: incidentId,
    data: { incidentId, escalateTo },
    receiptStatements: [`Escalation recorded: ${incidentId} to ${escalateTo}`],
  };
});

/**
 * Records a recommendation about supervisory notification.
 *
 * Note carefully what this does not do. It records a recommendation for the
 * accountable entity executive. It does not contact any authority, and
 * `notifySupervisor` is a registered PROHIBITED tool so the refusal is
 * explicit rather than merely unimplemented.
 */
registerToolHandler("recordNotificationRecommendation", (payload, context): ToolHandlerResult => {
  const incidentId = requireStr(payload, "incidentId");
  const recommended = payload.recommended === true;
  const rationale = requireStr(payload, "rationale");

  assertWrote(
    db()
      .update(incidents)
      .set({ notificationRecommended: recommended, notificationRationale: rationale })
      .where(and(eq(incidents.runId, context.runId), eq(incidents.id, incidentId)))
      .run(),
    "Recording a notification recommendation on incident " + incidentId,
  );

  return {
    summary: `Notification recommendation recorded on ${incidentId}: ${recommended ? "recommend notification" : "do not recommend notification at this time"}. No authority was contacted.`,
    objectKind: "incident",
    objectId: incidentId,
    data: { incidentId, recommended },
    receiptStatements: [
      `Notification recommendation recorded for the accountable entity executive. No supervisory authority was contacted.`,
    ],
  };
});

registerToolHandler("selectRecoveryOption", (payload, context): ToolHandlerResult => {
  const optionId = requireStr(payload, "recoveryOptionId");

  const option = db()
    .select()
    .from(recoveryOptions)
    .where(and(eq(recoveryOptions.runId, context.runId), eq(recoveryOptions.id, optionId)))
    .get();
  if (!option) throw new Error(`Recovery option ${optionId} was not found.`);

  db()
    .update(recoveryOptions)
    .set({ selected: false })
    .where(and(eq(recoveryOptions.runId, context.runId), eq(recoveryOptions.incidentId, option.incidentId)))
    .run();

  db()
    .update(recoveryOptions)
    .set({ selected: true })
    .where(and(eq(recoveryOptions.runId, context.runId), eq(recoveryOptions.id, optionId)))
    .run();

  return {
    summary: `Recovery option selected: ${option.name}. Control trade off accepted: ${option.controlTradeOff}`,
    objectKind: "recovery-option",
    objectId: optionId,
    data: { optionId, name: option.name },
    receiptStatements: [
      `Recovery option selected: ${option.name}`,
      `Control trade off recorded: ${option.controlTradeOff}`,
    ],
  };
});

registerToolHandler("captureLessonsLearned", (payload, context): ToolHandlerResult => {
  const incidentId = requireStr(payload, "incidentId");
  const lessons = requireStr(payload, "lessonsLearned");

  assertWrote(
    db()
      .update(incidents)
      .set({ lessonsLearned: lessons })
      .where(and(eq(incidents.runId, context.runId), eq(incidents.id, incidentId)))
      .run(),
    "Recording lessons learned on incident " + incidentId,
  );

  return {
    summary: `Lessons learned recorded against ${incidentId}.`,
    objectKind: "incident",
    objectId: incidentId,
    data: { incidentId },
    receiptStatements: [`Lessons learned recorded: ${incidentId}`],
  };
});

registerToolHandler("openIncident", (payload, context): ToolHandlerResult => {
  const id = newId("INC");
  const title = requireStr(payload, "title");

  db()
    .insert(incidents)
    .values({
      id,
      runId: context.runId,
      reference: id,
      title,
      titleDe: str(payload, "titleDe", title),
      entityIds: Array.isArray(payload.entityIds) ? (payload.entityIds as string[]) : ["ARC-DE"],
      serviceIds: Array.isArray(payload.serviceIds) ? (payload.serviceIds as string[]) : [],
      supplierIds: Array.isArray(payload.supplierIds) ? (payload.supplierIds as string[]) : [],
      processIds: Array.isArray(payload.processIds) ? (payload.processIds as string[]) : [],
      detectedAt: new Date().toISOString(),
      kind: str(payload, "kind", "incident"),
      status: "open",
      description: str(payload, "description", title),
      leadUserId: context.actingUserId,
      isSharedEvent: false,
      lessonsLearned: "",
    })
    .run();

  return {
    summary: `Incident ${id} opened: ${title}`,
    objectKind: "incident",
    objectId: id,
    data: { incidentId: id },
    receiptStatements: [`Incident opened: ${id}`],
  };
});

/* ==========================================================================
   Regulatory and portfolio decisions
   ========================================================================== */

registerToolHandler("recordObligationInterpretation", (payload, context): ToolHandlerResult => {
  const obligationId = requireStr(payload, "obligationId");
  const decision = requireStr(payload, "applicabilityDecision");
  const rationale = requireStr(payload, "rationale");

  assertWrote(
    db()
      .update(obligations)
      .set({
        applicabilityDecision: decision,
        applicabilityRationale: rationale,
        decidedByUserId: context.actingUserId,
        decidedOn: new Date().toISOString(),
        ownerUserId: str(payload, "ownerUserId") || null,
        implementationPriority: str(payload, "implementationPriority") || null,
        isUnownedGap: str(payload, "ownerUserId").length === 0,
      })
      .where(and(eq(obligations.runId, context.runId), eq(obligations.id, obligationId)))
      .run(),
    "Recording an interpretation on obligation " + obligationId,
  );

  return {
    summary: `Obligation ${obligationId} interpretation recorded: ${decision}`,
    objectKind: "obligation",
    objectId: obligationId,
    data: { obligationId, decision },
    receiptStatements: [`Obligation interpretation recorded: ${obligationId} is ${decision}`],
  };
});

registerToolHandler("setPortfolioMateriality", (payload, context): ToolHandlerResult => {
  const themeId = requireStr(payload, "themeId");
  const materiality = requireStr(payload, "materiality");

  assertWrote(
    db()
      .update(portfolioThemes)
      .set({ materiality, materialityDecidedBy: context.actingUserId })
      .where(and(eq(portfolioThemes.runId, context.runId), eq(portfolioThemes.id, themeId)))
      .run(),
    "Recording materiality on theme " + themeId,
  );

  return {
    summary: `Portfolio materiality on theme ${themeId} recorded as ${materiality}.`,
    objectKind: "portfolio-theme",
    objectId: themeId,
    data: { themeId, materiality },
    receiptStatements: [`Portfolio materiality recorded: ${materiality}`],
  };
});

/* ==========================================================================
   Policy bound autonomous actions
   ========================================================================== */

/**
 * Posts a simulated internal collaboration message.
 *
 * `simulatedOnly` is written as true on the row rather than merely implied by
 * the absence of a transport, so the trust page can prove from the data that
 * nothing left the machine.
 */
registerToolHandler("sendSimulatedCollaborationMessage", (payload, context): ToolHandlerResult => {
  const id = newId("COL");
  const subject = requireStr(payload, "subject");

  db()
    .insert(collaborationMessages)
    .values({
      id,
      runId: context.runId,
      fromRoleId: context.roleId,
      toUserIds: Array.isArray(payload.toUserIds) ? (payload.toUserIds as string[]) : [],
      channelName: str(payload, "channelName", "NFR WorkOS"),
      subject,
      body: str(payload, "body", subject),
      sentAtMoment: context.atMoment,
      sentAt: new Date().toISOString(),
      simulatedOnly: true,
      relatedObjectKind: str(payload, "relatedObjectKind") || null,
      relatedObjectId: str(payload, "relatedObjectId") || null,
      decisionId: str(payload, "decisionId") || null,
      replyBody: "",
      replyFromUserId: null,
      replyAtMoment: null,
    })
    .run();

  return {
    summary: `Simulated collaboration message ${id} posted. It was not delivered to any real recipient.`,
    objectKind: "collaboration-message",
    objectId: id,
    data: { messageId: id },
    receiptStatements: [`Simulated collaboration message sent: ${subject}`],
  };
});

registerToolHandler("requestFactualValidation", (payload, context): ToolHandlerResult => {
  const id = newId("VAL");
  const question = requireStr(payload, "question");

  db()
    .insert(collaborationMessages)
    .values({
      id,
      runId: context.runId,
      fromRoleId: context.roleId,
      toUserIds: Array.isArray(payload.toUserIds) ? (payload.toUserIds as string[]) : [],
      channelName: "Factual validation",
      subject: `Factual validation requested: ${str(payload, "topic", "open point")}`,
      body: question,
      sentAtMoment: context.atMoment,
      sentAt: new Date().toISOString(),
      simulatedOnly: true,
      relatedObjectKind: str(payload, "relatedObjectKind") || null,
      relatedObjectId: str(payload, "relatedObjectId") || null,
      decisionId: str(payload, "decisionId") || null,
      replyBody: "",
      replyFromUserId: null,
      replyAtMoment: null,
    })
    .run();

  return {
    summary: `Factual validation requested from the first line: ${question.slice(0, 90)}`,
    objectKind: "collaboration-message",
    objectId: id,
    data: { messageId: id },
    receiptStatements: [`Factual validation requested: ${id}`],
  };
});

registerToolHandler("requestEvidenceDocument", (payload, context): ToolHandlerResult => {
  const id = newId("REQ");
  const what = requireStr(payload, "documentDescription");

  db()
    .insert(actions)
    .values({
      id,
      runId: context.runId,
      reference: id,
      title: `Evidence requested: ${what}`,
      description: what,
      kind: "evidence-request",
      raisedByRoleId: context.roleId,
      ownerUserId: str(payload, "ownerUserId") || null,
      ownerLabel: str(payload, "ownerLabel"),
      entityId: str(payload, "entityId", "ARC-DE"),
      createdOn: new Date().toISOString(),
      dueOn: str(payload, "dueOn") || null,
      status: "open",
      priority: "medium",
      isUnowned: str(payload, "ownerUserId").length === 0,
      relatedObjectKind: str(payload, "relatedObjectKind") || null,
      relatedObjectId: str(payload, "relatedObjectId") || null,
      sourceDecisionId: str(payload, "decisionId") || null,
      createdBySession: true,
      progressNote: "",
    })
    .run();

  return {
    summary: `Evidence request ${id} recorded: ${what}`,
    objectKind: "action",
    objectId: id,
    data: { actionId: id },
    receiptStatements: [`Evidence requested: ${what}`],
  };
});

/** Ensures the module's registrations have run. Imported by the tool index. */
export const mutationHandlersRegistered = true;
