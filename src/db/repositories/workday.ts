/**
 * Read side data access for the workday experience.
 *
 * Everything here is a query. Mutations live in the scenario engine and are
 * reachable only through governed tools. Keeping the two apart means a server
 * component can import freely from this module without any risk of changing
 * state as a side effect of rendering.
 *
 * Reveal semantics: content carries a `revealedAtMoment`. These functions
 * filter by the scenario clock so scrubbing time genuinely changes what the
 * professional can see, rather than merely restyling it.
 */

import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, legalEntities, roles, users, type RoleId } from "@/db/schema/core";
import {
  contractObligations,
  contracts,
  controls,
  impactTolerances,
  kriReadings,
  kris,
  processes,
  risks,
  serviceDependencies,
  services,
  subprocessors,
  suppliers,
} from "@/db/schema/domain";
import {
  assessmentLines,
  assessments,
  controlTests,
  incidentEvents,
  incidents,
  obligations,
  policies,
  recoveryOptions,
  regulatoryPublications,
  testCases,
} from "@/db/schema/practice";
import {
  calendarEvents,
  collaborationMessages,
  evidenceDocuments,
  inboxMessages,
  meetingMessages,
  meetings,
} from "@/db/schema/work";
import {
  actions,
  backgroundActions,
  committeeItems,
  decisionOptions,
  decisions,
  executionReceiptLines,
  issues,
  monitoringActivations,
  portfolioThemes,
} from "@/db/schema/decisions";
import { momentToMinutes } from "@/domain/nfr/calculators";

const db = () => getDb();

/* ==========================================================================
   Institution
   ========================================================================== */

export function getEntities(runId = DEFAULT_RUN_ID) {
  return db().select().from(legalEntities).where(eq(legalEntities.runId, runId)).all();
}

export function getEntity(entityId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(legalEntities)
    .where(and(eq(legalEntities.runId, runId), eq(legalEntities.id, entityId)))
    .get();
}

export function getRoles(runId = DEFAULT_RUN_ID) {
  return db().select().from(roles).where(eq(roles.runId, runId)).orderBy(asc(roles.sortOrder)).all();
}

export function getRole(roleId: RoleId, runId = DEFAULT_RUN_ID) {
  return db().select().from(roles).where(and(eq(roles.runId, runId), eq(roles.id, roleId))).get();
}

export function getUsers(runId = DEFAULT_RUN_ID) {
  return db().select().from(users).where(eq(users.runId, runId)).all();
}

export function getUser(userId: string, runId = DEFAULT_RUN_ID) {
  return db().select().from(users).where(and(eq(users.runId, runId), eq(users.id, userId))).get();
}

/** A name lookup, used wherever the interface renders an owner or a speaker. */
export function getUserNameMap(runId = DEFAULT_RUN_ID): Map<string, string> {
  return new Map(getUsers(runId).map((u) => [u.id, u.name]));
}

/* ==========================================================================
   Personal work layer
   ========================================================================== */

export function getInbox(roleId: RoleId, atMoment: string, runId = DEFAULT_RUN_ID) {
  const rows = db()
    .select()
    .from(inboxMessages)
    .where(and(eq(inboxMessages.runId, runId), eq(inboxMessages.roleId, roleId)))
    .orderBy(asc(inboxMessages.priorityRank))
    .all();
  const now = momentToMinutes(atMoment);
  return rows.filter((row) => momentToMinutes(row.revealedAtMoment) <= now);
}

export function getCalendar(roleId: RoleId, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.runId, runId), eq(calendarEvents.roleId, roleId)))
    .orderBy(asc(calendarEvents.startsAt))
    .all();
}

export function getMeetings(roleId: RoleId, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(meetings)
    .where(and(eq(meetings.runId, runId), eq(meetings.roleId, roleId)))
    .orderBy(asc(meetings.scheduledFor))
    .all();
}

export function getMeeting(meetingId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(meetings)
    .where(and(eq(meetings.runId, runId), eq(meetings.id, meetingId)))
    .get();
}

export function getMeetingMessages(meetingId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(meetingMessages)
    .where(and(eq(meetingMessages.runId, runId), eq(meetingMessages.meetingId, meetingId)))
    .orderBy(asc(meetingMessages.sortOrder))
    .all();
}

export function getCollaborationMessages(roleId: RoleId, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(collaborationMessages)
    .where(
      and(eq(collaborationMessages.runId, runId), eq(collaborationMessages.fromRoleId, roleId)),
    )
    .orderBy(asc(collaborationMessages.sentAt))
    .all();
}

/* ==========================================================================
   Decisions
   ========================================================================== */

export interface DecisionWithOptions {
  decision: typeof decisions.$inferSelect;
  options: Array<typeof decisionOptions.$inferSelect>;
}

export function getDecisions(
  roleId: RoleId,
  atMoment: string,
  runId = DEFAULT_RUN_ID,
): DecisionWithOptions[] {
  const rows = db()
    .select()
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.roleId, roleId)))
    .orderBy(asc(decisions.priorityRank))
    .all();

  const now = momentToMinutes(atMoment);
  const visible = rows.filter((row) => momentToMinutes(row.presentedAtMoment) <= now);
  if (visible.length === 0) return [];

  const allOptions = db()
    .select()
    .from(decisionOptions)
    .where(
      and(
        eq(decisionOptions.runId, runId),
        inArray(
          decisionOptions.decisionId,
          visible.map((d) => d.id),
        ),
      ),
    )
    .orderBy(asc(decisionOptions.sortOrder))
    .all();

  const byDecision = new Map<string, Array<typeof decisionOptions.$inferSelect>>();
  for (const option of allOptions) {
    const list = byDecision.get(option.decisionId) ?? [];
    list.push(option);
    byDecision.set(option.decisionId, list);
  }

  return visible.map((decision) => ({
    decision,
    options: byDecision.get(decision.id) ?? [],
  }));
}

export function getDecision(decisionId: string, runId = DEFAULT_RUN_ID): DecisionWithOptions | null {
  const decision = db()
    .select()
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.id, decisionId)))
    .get();
  if (!decision) return null;

  const options = db()
    .select()
    .from(decisionOptions)
    .where(and(eq(decisionOptions.runId, runId), eq(decisionOptions.decisionId, decisionId)))
    .orderBy(asc(decisionOptions.sortOrder))
    .all();

  return { decision, options };
}

/** Open decisions across every role. Used by the portfolio lens. */
export function getAllDecisions(atMoment: string, runId = DEFAULT_RUN_ID) {
  const now = momentToMinutes(atMoment);
  return db()
    .select()
    .from(decisions)
    .where(eq(decisions.runId, runId))
    .orderBy(asc(decisions.priorityRank))
    .all()
    .filter((row) => momentToMinutes(row.presentedAtMoment) <= now);
}

/** Every decision on one shared thread, which is the portfolio hero view. */
export function getDecisionThread(sharedThreadId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.sharedThreadId, sharedThreadId)))
    .orderBy(asc(decisions.priorityRank))
    .all();
}

export function getExecutionReceipt(decisionId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(executionReceiptLines)
    .where(
      and(eq(executionReceiptLines.runId, runId), eq(executionReceiptLines.decisionId, decisionId)),
    )
    .orderBy(asc(executionReceiptLines.sortOrder))
    .all();
}

/* ==========================================================================
   Evidence
   ========================================================================== */

export function getEvidenceDocument(documentId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(evidenceDocuments)
    .where(and(eq(evidenceDocuments.runId, runId), eq(evidenceDocuments.id, documentId)))
    .get();
}

export function getEvidenceDocuments(ids: string[], runId = DEFAULT_RUN_ID) {
  if (ids.length === 0) return [];
  return db()
    .select()
    .from(evidenceDocuments)
    .where(and(eq(evidenceDocuments.runId, runId), inArray(evidenceDocuments.id, ids)))
    .all();
}

export function getAllEvidenceDocuments(atMoment: string, runId = DEFAULT_RUN_ID) {
  const now = momentToMinutes(atMoment);
  return db()
    .select()
    .from(evidenceDocuments)
    .where(eq(evidenceDocuments.runId, runId))
    .orderBy(desc(evidenceDocuments.documentDate))
    .all()
    .filter((row) => momentToMinutes(row.revealedAtMoment) <= now);
}

/** Documents that were requested and have not arrived. A real gap, shown as one. */
export function getMissingEvidence(runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(evidenceDocuments)
    .where(
      and(
        eq(evidenceDocuments.runId, runId),
        or(eq(evidenceDocuments.status, "requested"), eq(evidenceDocuments.status, "missing")),
      ),
    )
    .all();
}

export function getStaleEvidence(runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(evidenceDocuments)
    .where(and(eq(evidenceDocuments.runId, runId), eq(evidenceDocuments.isStale, true)))
    .all();
}

export function getApplicablePolicies(roleId: RoleId, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(policies)
    .where(eq(policies.runId, runId))
    .all()
    .filter((row) => row.relatedRoleIds.includes(roleId));
}

export function getPolicy(policyId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(policies)
    .where(and(eq(policies.runId, runId), eq(policies.id, policyId)))
    .get();
}

/* ==========================================================================
   Third-party domain
   ========================================================================== */

export function getSuppliers(runId = DEFAULT_RUN_ID) {
  return db().select().from(suppliers).where(eq(suppliers.runId, runId)).all();
}

export function getSupplier(supplierId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.runId, runId), eq(suppliers.id, supplierId)))
    .get();
}

export function getSubprocessors(supplierId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(subprocessors)
    .where(and(eq(subprocessors.runId, runId), eq(subprocessors.supplierId, supplierId)))
    .all();
}

export function getAllSubprocessors(runId = DEFAULT_RUN_ID) {
  return db().select().from(subprocessors).where(eq(subprocessors.runId, runId)).all();
}

export function getServices(runId = DEFAULT_RUN_ID) {
  return db().select().from(services).where(eq(services.runId, runId)).all();
}

export function getService(serviceId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(services)
    .where(and(eq(services.runId, runId), eq(services.id, serviceId)))
    .get();
}

export function getServiceDependencies(runId = DEFAULT_RUN_ID) {
  return db().select().from(serviceDependencies).where(eq(serviceDependencies.runId, runId)).all();
}

export function getImpactTolerances(runId = DEFAULT_RUN_ID) {
  return db().select().from(impactTolerances).where(eq(impactTolerances.runId, runId)).all();
}

/**
 * True when a tolerance applies to an entity.
 *
 * The scope column holds a label, not a single key, because a board can
 * approve one tolerance covering several entities or the whole group. A plain
 * equality test would silently miss the two-entity case, which is precisely
 * the case that matters for the cross-border payment service.
 */
export function toleranceAppliesToEntity(scopeLabel: string, entityId: string): boolean {
  const normalised = scopeLabel.trim().toLowerCase();
  if (normalised === "group") return true;
  return normalised
    .split(",")
    .map((part) => part.trim())
    .includes(entityId.toLowerCase());
}

/** Tolerances in scope for one entity, including group wide ones. */
export function getImpactTolerancesForEntity(entityId: string, runId = DEFAULT_RUN_ID) {
  return getImpactTolerances(runId).filter((tolerance) =>
    toleranceAppliesToEntity(tolerance.entityId, entityId),
  );
}

export function getContracts(supplierId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(contracts)
    .where(and(eq(contracts.runId, runId), eq(contracts.supplierId, supplierId)))
    .all();
}

export function getContractObligations(contractIds: string[], runId = DEFAULT_RUN_ID) {
  if (contractIds.length === 0) return [];
  return db()
    .select()
    .from(contractObligations)
    .where(
      and(
        eq(contractObligations.runId, runId),
        inArray(contractObligations.contractId, contractIds),
      ),
    )
    .all();
}

/**
 * The full supplier exposure picture: the supplier, its services, its
 * subprocessors and fourth parties, its contracts and obligation evidence
 * status. This is the data behind the constellation visual.
 */
export function getSupplierExposure(supplierId: string, runId = DEFAULT_RUN_ID) {
  const supplier = getSupplier(supplierId, runId);
  if (!supplier) return null;

  const supplierServices = getServices(runId).filter((s) => s.supplierIds.includes(supplierId));
  const subs = getSubprocessors(supplierId, runId);
  const contractRows = getContracts(supplierId, runId);
  const obligationRows = getContractObligations(
    contractRows.map((c) => c.id),
    runId,
  );
  const dependencies = getServiceDependencies(runId).filter(
    (d) => d.fromId === supplierId || d.toId === supplierId || subs.some((s) => s.id === d.toId || s.id === d.fromId),
  );

  return {
    supplier,
    services: supplierServices,
    subprocessors: subs,
    contracts: contractRows,
    obligations: obligationRows,
    dependencies,
    /** Obligations without sufficient evidence. The gaps a professional acts on. */
    evidenceGaps: obligationRows.filter(
      (o) => o.evidenceStatus === "not-evidenced" || o.evidenceStatus === "partially-met",
    ),
    discrepancies: subs.filter((s) => s.isDiscrepancy),
  };
}

/* ==========================================================================
   Risk and control domain
   ========================================================================== */

export function getProcesses(runId = DEFAULT_RUN_ID) {
  return db().select().from(processes).where(eq(processes.runId, runId)).all();
}

export function getProcess(processId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(processes)
    .where(and(eq(processes.runId, runId), eq(processes.id, processId)))
    .get();
}

export function getRisks(runId = DEFAULT_RUN_ID) {
  return db().select().from(risks).where(eq(risks.runId, runId)).all();
}

export function getRisk(riskId: string, runId = DEFAULT_RUN_ID) {
  return db().select().from(risks).where(and(eq(risks.runId, runId), eq(risks.id, riskId))).get();
}

export function getControls(runId = DEFAULT_RUN_ID) {
  return db().select().from(controls).where(eq(controls.runId, runId)).all();
}

export function getControl(controlId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(controls)
    .where(and(eq(controls.runId, runId), eq(controls.id, controlId)))
    .get();
}

export function getKris(runId = DEFAULT_RUN_ID) {
  return db().select().from(kris).where(eq(kris.runId, runId)).all();
}

export function getKriReadings(kriId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(kriReadings)
    .where(and(eq(kriReadings.runId, runId), eq(kriReadings.kriId, kriId)))
    .orderBy(asc(kriReadings.sortOrder))
    .all();
}

/** Indicators currently in amber or red. Drives the morning brief. */
export function getBreachedKris(runId = DEFAULT_RUN_ID) {
  return getKris(runId).filter((k) => k.currentStatus === "red" || k.currentStatus === "amber");
}

/**
 * The process, risk and control graph for a subject.
 *
 * Returns nodes and edges ready for a graph layout. The same control node
 * appears here and in the Control Assurance population view because it is the
 * same row, which is the point.
 */
export function getRiskControlGraph(
  options: { processId?: string; riskId?: string } = {},
  runId = DEFAULT_RUN_ID,
) {
  const allProcesses = getProcesses(runId);
  const allRisks = getRisks(runId);
  const allControls = getControls(runId);
  const allKris = getKris(runId);

  let scopedRisks = allRisks;
  if (options.riskId) {
    scopedRisks = allRisks.filter((r) => r.id === options.riskId);
  } else if (options.processId) {
    scopedRisks = allRisks.filter((r) => r.processIds.includes(options.processId as string));
  }

  const riskIds = new Set(scopedRisks.map((r) => r.id));
  const scopedControls = allControls.filter((c) => c.riskIds.some((id) => riskIds.has(id)));
  const processIds = new Set(scopedRisks.flatMap((r) => r.processIds));
  const scopedProcesses = allProcesses.filter((p) => processIds.has(p.id));
  const scopedKris = allKris.filter((k) => k.riskIds.some((id) => riskIds.has(id)));

  const nodes = [
    ...scopedProcesses.map((p) => ({
      id: p.id,
      kind: "process" as const,
      label: p.name,
      detail: p.code,
      tone: "cyan" as const,
    })),
    ...scopedRisks.map((r) => ({
      id: r.id,
      kind: "risk" as const,
      label: r.title,
      detail: r.taxonomyL2,
      tone: r.appetitePosition === "outside" ? ("red" as const) : ("neutral" as const),
    })),
    ...scopedControls.map((c) => ({
      id: c.id,
      kind: "control" as const,
      label: c.reference,
      detail: c.title,
      tone:
        c.currentEffectiveness === "fully-effective"
          ? ("green" as const)
          : c.currentEffectiveness === "partially-effective" || c.currentEffectiveness === "not-effective"
            ? ("amber" as const)
            : ("neutral" as const),
    })),
    ...scopedKris.map((k) => ({
      id: k.id,
      kind: "kri" as const,
      label: k.reference,
      detail: k.name,
      tone:
        k.currentStatus === "red"
          ? ("red" as const)
          : k.currentStatus === "amber"
            ? ("amber" as const)
            : ("green" as const),
    })),
  ];

  const edges: Array<{ id: string; from: string; to: string; kind: string }> = [];
  for (const risk of scopedRisks) {
    for (const processId of risk.processIds) {
      if (processIds.has(processId)) {
        edges.push({ id: `${processId}->${risk.id}`, from: processId, to: risk.id, kind: "exposes" });
      }
    }
  }
  for (const control of scopedControls) {
    for (const riskId of control.riskIds) {
      if (riskIds.has(riskId)) {
        edges.push({ id: `${control.id}->${riskId}`, from: control.id, to: riskId, kind: "mitigates" });
      }
    }
  }
  for (const kri of scopedKris) {
    for (const riskId of kri.riskIds) {
      if (riskIds.has(riskId)) {
        edges.push({ id: `${kri.id}->${riskId}`, from: kri.id, to: riskId, kind: "indicates" });
      }
    }
  }

  return { nodes, edges, processes: scopedProcesses, risks: scopedRisks, controls: scopedControls, kris: scopedKris };
}

/* ==========================================================================
   Assessments
   ========================================================================== */

export function getAssessments(
  filter: { subjectId?: string; kind?: string } = {},
  runId = DEFAULT_RUN_ID,
) {
  let rows = db()
    .select()
    .from(assessments)
    .where(eq(assessments.runId, runId))
    .orderBy(desc(assessments.version))
    .all();
  if (filter.subjectId) rows = rows.filter((r) => r.subjectId === filter.subjectId);
  if (filter.kind) rows = rows.filter((r) => r.kind === filter.kind);
  return rows;
}

export function getAssessment(assessmentId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(assessments)
    .where(and(eq(assessments.runId, runId), eq(assessments.id, assessmentId)))
    .get();
}

export function getAssessmentLines(assessmentId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(assessmentLines)
    .where(and(eq(assessmentLines.runId, runId), eq(assessmentLines.assessmentId, assessmentId)))
    .orderBy(asc(assessmentLines.sortOrder))
    .all();
}

/**
 * The current and previous assessment version for a subject, with their lines.
 *
 * This is what makes "the RCSA starts with what changed" a two row read rather
 * than a reconstruction.
 */
export function compareAssessments(subjectId: string, runId = DEFAULT_RUN_ID) {
  const versions = getAssessments({ subjectId }, runId);
  const current = versions.find((v) => v.status !== "superseded") ?? versions[0];
  if (!current) return null;
  const previous = versions.find((v) => v.id !== current.id && v.version < current.version);

  return {
    current,
    previous: previous ?? null,
    currentLines: getAssessmentLines(current.id, runId),
    previousLines: previous ? getAssessmentLines(previous.id, runId) : [],
  };
}

/* ==========================================================================
   Control testing
   ========================================================================== */

export function getControlTests(runId = DEFAULT_RUN_ID) {
  return db().select().from(controlTests).where(eq(controlTests.runId, runId)).all();
}

export function getControlTest(testId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(controlTests)
    .where(and(eq(controlTests.runId, runId), eq(controlTests.id, testId)))
    .get();
}

export function getTestCases(testId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(testCases)
    .where(and(eq(testCases.runId, runId), eq(testCases.controlTestId, testId)))
    .orderBy(asc(testCases.occurredAt))
    .all();
}

/** Population statistics, computed rather than stated. */
export function getPopulationSummary(testId: string, runId = DEFAULT_RUN_ID) {
  const cases = getTestCases(testId, runId);
  const exceptions = cases.filter((c) => c.outcome === "exception");
  const anomalies = cases.filter((c) => c.outcome === "anomaly");
  const sampled = cases.filter((c) => c.inSample);

  const byReason = new Map<string, number>();
  for (const c of cases) byReason.set(c.repairReason, (byReason.get(c.repairReason) ?? 0) + 1);

  const byReviewer = new Map<string, number>();
  for (const c of cases) {
    if (c.reviewerUserId) byReviewer.set(c.reviewerUserId, (byReviewer.get(c.reviewerUserId) ?? 0) + 1);
  }

  return {
    total: cases.length,
    sampled: sampled.length,
    exceptions: exceptions.length,
    anomalies: anomalies.length,
    conforming: cases.filter((c) => c.outcome === "conforming").length,
    missingReviewEvidence: cases.filter((c) => !c.secondaryReviewEvidenced).length,
    fromFallbackRoute: cases.filter((c) => c.fromFallbackRoute).length,
    unclassifiedExceptions: exceptions.filter((c) => c.exceptionClassification === null).length,
    byRepairReason: Array.from(byReason.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    byReviewer: Array.from(byReviewer.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count),
    cases,
    exceptionCases: exceptions,
    anomalyCases: anomalies,
  };
}

/* ==========================================================================
   Incidents and resilience
   ========================================================================== */

export function getIncidents(runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(incidents)
    .where(eq(incidents.runId, runId))
    .orderBy(desc(incidents.detectedAt))
    .all();
}

export function getIncident(incidentId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(incidents)
    .where(and(eq(incidents.runId, runId), eq(incidents.id, incidentId)))
    .get();
}

export function getSharedEventIncident(runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(incidents)
    .where(and(eq(incidents.runId, runId), eq(incidents.isSharedEvent, true)))
    .get();
}

/** The chronology, filtered by the scenario clock so facts arrive over time. */
export function getIncidentTimeline(incidentId: string, atMoment: string, runId = DEFAULT_RUN_ID) {
  const rows = db()
    .select()
    .from(incidentEvents)
    .where(and(eq(incidentEvents.runId, runId), eq(incidentEvents.incidentId, incidentId)))
    .orderBy(asc(incidentEvents.sortOrder))
    .all();
  const now = momentToMinutes(atMoment);
  return rows.filter((row) => momentToMinutes(row.revealedAtMoment) <= now);
}

export function getRecoveryOptions(incidentId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(recoveryOptions)
    .where(and(eq(recoveryOptions.runId, runId), eq(recoveryOptions.incidentId, incidentId)))
    .orderBy(asc(recoveryOptions.sortOrder))
    .all();
}

/* ==========================================================================
   Regulatory change
   ========================================================================== */

export function getRegulatoryPublications(runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(regulatoryPublications)
    .where(eq(regulatoryPublications.runId, runId))
    .orderBy(desc(regulatoryPublications.publishedOn))
    .all();
}

export function getRegulatoryPublication(publicationId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(regulatoryPublications)
    .where(
      and(eq(regulatoryPublications.runId, runId), eq(regulatoryPublications.id, publicationId)),
    )
    .get();
}

export function getObligations(publicationId?: string, runId = DEFAULT_RUN_ID) {
  const rows = db()
    .select()
    .from(obligations)
    .where(eq(obligations.runId, runId))
    .orderBy(asc(obligations.sortOrder))
    .all();
  return publicationId ? rows.filter((r) => r.publicationId === publicationId) : rows;
}

export function getUnownedObligationGaps(runId = DEFAULT_RUN_ID) {
  return getObligations(undefined, runId).filter((o) => o.isUnownedGap);
}

/* ==========================================================================
   Issues, actions, committee and monitoring
   ========================================================================== */

export function getIssues(runId = DEFAULT_RUN_ID) {
  return db().select().from(issues).where(eq(issues.runId, runId)).all();
}

export function getActions(filter: { roleId?: RoleId; status?: string } = {}, runId = DEFAULT_RUN_ID) {
  let rows = db().select().from(actions).where(eq(actions.runId, runId)).all();
  if (filter.roleId) rows = rows.filter((r) => r.raisedByRoleId === filter.roleId);
  if (filter.status) rows = rows.filter((r) => r.status === filter.status);
  return rows;
}

export function getOverdueActions(runId = DEFAULT_RUN_ID) {
  return getActions({}, runId).filter((a) => a.status === "overdue");
}

export function getCommitteeItems(runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(committeeItems)
    .where(eq(committeeItems.runId, runId))
    .orderBy(asc(committeeItems.agendaPosition))
    .all();
}

export function getMonitoringActivations(runId = DEFAULT_RUN_ID) {
  return db().select().from(monitoringActivations).where(eq(monitoringActivations.runId, runId)).all();
}

export function getPortfolioThemes(runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(portfolioThemes)
    .where(eq(portfolioThemes.runId, runId))
    .orderBy(asc(portfolioThemes.sortOrder))
    .all();
}

/* ==========================================================================
   Background work
   ========================================================================== */

/**
 * The counts behind "What happened in the background?".
 *
 * These are real row counts over seeded actions, not decorative numbers, and
 * each count can be expanded to the individual actions with their targets.
 */
export function getBackgroundWork(roleId: RoleId, atMoment: string, runId = DEFAULT_RUN_ID) {
  const rows = db()
    .select()
    .from(backgroundActions)
    .where(and(eq(backgroundActions.runId, runId), eq(backgroundActions.roleId, roleId)))
    .all();

  const now = momentToMinutes(atMoment);
  const visible = rows.filter((row) => momentToMinutes(row.performedAtMoment) <= now);

  const counts = new Map<string, number>();
  for (const row of visible) counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1);

  // Distinct systems touched, which is a different count from actions taken.
  const systems = new Set(visible.filter((r) => r.kind === "system-checked").map((r) => r.targetId));

  return {
    actions: visible,
    total: visible.length,
    systemsChecked: systems.size,
    recordsReconciled: counts.get("record-reconciled") ?? 0,
    documentsClassified: counts.get("document-classified") ?? 0,
    itemsRequested: counts.get("item-requested") ?? 0,
    contradictionsIdentified: counts.get("contradiction-identified") ?? 0,
    routineUpdates: counts.get("routine-update") ?? 0,
    escalatedToHuman: counts.get("escalated-to-human") ?? 0,
  };
}
