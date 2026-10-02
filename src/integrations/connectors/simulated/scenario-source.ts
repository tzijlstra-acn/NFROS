/**
 * Where the simulated connectors get their data.
 *
 * Every record the simulators return is read from the seeded scenario: the
 * real controls, risks, assessments, suppliers, services, processes, test
 * cases, evidence documents and collaboration messages that the rest of the
 * product already works with.
 *
 * That constraint is the point of this module and it is worth being explicit
 * about why. A simulator that generated its own plausible controls would
 * produce an integration centre full of objects nobody can find anywhere else
 * in the application, and the product's central claim, that one institution
 * and one day are shared across six functions, would quietly become false at
 * exactly the layer that is supposed to prove it. A source attribution row
 * saying "GRC platform, 14 controls" has to mean the same fourteen controls
 * the Operational Risk Partner is looking at.
 *
 * So there is no second dataset here. There are projections of the first one
 * into the shape an external system would return it in.
 */

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { controls, processes, risks, services, suppliers } from "@/db/schema/domain";
import { assessments, controlTests, incidents, obligations, testCases } from "@/db/schema/practice";
import { collaborationMessages, evidenceDocuments, inboxMessages, meetings } from "@/db/schema/work";
import { users } from "@/db/schema/core";
import { actions, issues } from "@/db/schema/decisions";
import type { ExternalRecord } from "@/integrations/core/Connector";
import type { CanonicalType } from "@/workday/contracts";

/**
 * Builds an external record.
 *
 * `sourceUpdatedAt` is taken from a real column on the row wherever the
 * scenario has one, and falls back to the scenario date rather than to the
 * wall clock. A simulator that stamped every record with "now" would make
 * every source permanently fresh, and the freshness indicator, which is one of
 * the honest signals in this product, would become decoration.
 */
export function externalRecord(params: {
  externalType: string;
  externalId: string;
  canonicalType: CanonicalType;
  canonicalId: string;
  title: string;
  summary: string;
  sourceUpdatedAt: string | null;
  externalVersion?: string | null;
  fields: Record<string, unknown>;
}): ExternalRecord {
  return {
    externalType: params.externalType,
    externalId: params.externalId,
    externalUrl: null,
    externalVersion: params.externalVersion ?? null,
    sourceUpdatedAt: params.sourceUpdatedAt,
    canonicalType: params.canonicalType,
    canonicalId: params.canonicalId,
    title: params.title,
    summary: params.summary,
    fields: params.fields,
  };
}

/** The scenario date, used where a row has no timestamp of its own. */
export const SCENARIO_FALLBACK_TIMESTAMP = "2026-10-06T06:00:00.000Z";

/* ==========================================================================
   GRC platform projections
   ========================================================================== */

export function grcControls(runId: string): ExternalRecord[] {
  return getDb()
    .select()
    .from(controls)
    .where(eq(controls.runId, runId))
    .orderBy(asc(controls.id))
    .all()
    .map((row) =>
      externalRecord({
        externalType: "grc.control",
        externalId: row.id,
        canonicalType: "Control",
        canonicalId: row.id,
        title: `${row.reference} ${row.title}`,
        summary: `Recorded effectiveness ${row.currentEffectiveness}. First line records ${row.firstLineEffectiveness}.`,
        sourceUpdatedAt: row.effectivenessSetAt ?? SCENARIO_FALLBACK_TIMESTAMP,
        externalVersion: `${row.currentEffectiveness}:${row.effectivenessSetBy}`,
        fields: {
          reference: row.reference,
          title: row.title,
          effectiveness: row.currentEffectiveness,
          firstLineEffectiveness: row.firstLineEffectiveness,
          nature: row.nature,
          automation: row.automation,
          frequency: row.frequency,
          keyControl: row.isKeyControl,
          ownerUserId: row.ownerUserId,
          entityIds: row.entityIds,
          riskIds: row.riskIds,
          processIds: row.processIds,
          lastTestedOn: row.lastTestedOn,
        },
      }),
    );
}

export function grcRisks(runId: string): ExternalRecord[] {
  return getDb()
    .select()
    .from(risks)
    .where(eq(risks.runId, runId))
    .orderBy(asc(risks.id))
    .all()
    .map((row) =>
      externalRecord({
        externalType: "grc.risk",
        externalId: row.id,
        canonicalType: "Risk",
        canonicalId: row.id,
        title: row.title,
        summary: `${row.taxonomyL1} / ${row.taxonomyL2}. Appetite position ${row.appetitePosition}.`,
        sourceUpdatedAt: SCENARIO_FALLBACK_TIMESTAMP,
        externalVersion: row.appetitePosition,
        fields: {
          title: row.title,
          taxonomyL1: row.taxonomyL1,
          taxonomyL2: row.taxonomyL2,
          inherentLikelihood: row.inherentLikelihood,
          inherentImpact: row.inherentImpact,
          appetitePosition: row.appetitePosition,
          ownerUserId: row.ownerUserId,
          entityIds: row.entityIds,
          processIds: row.processIds,
        },
      }),
    );
}

export function grcAssessments(runId: string): ExternalRecord[] {
  return getDb()
    .select()
    .from(assessments)
    .where(eq(assessments.runId, runId))
    .orderBy(asc(assessments.id))
    .all()
    .map((row) =>
      externalRecord({
        externalType: "grc.assessment",
        externalId: row.id,
        canonicalType: "Assessment",
        canonicalId: row.id,
        title: `${row.reference} ${row.title}`,
        summary: `Version ${row.version}, status ${row.status}. Residual risk ${row.residualRisk}.`,
        sourceUpdatedAt: row.approvedOn ?? row.performedOn,
        externalVersion: `v${row.version}`,
        fields: {
          reference: row.reference,
          title: row.title,
          kind: row.kind,
          subjectKind: row.subjectKind,
          subjectId: row.subjectId,
          entityId: row.entityId,
          version: row.version,
          status: row.status,
          cycle: row.cycle,
          residualRisk: row.residualRisk,
          overallConclusion: row.overallConclusion,
          performedByUserId: row.performedByUserId,
          approvedByUserId: row.approvedByUserId,
        },
      }),
    );
}

export function grcIssues(runId: string): ExternalRecord[] {
  return getDb()
    .select()
    .from(issues)
    .where(eq(issues.runId, runId))
    .orderBy(asc(issues.id))
    .all()
    .map((row) =>
      externalRecord({
        externalType: "grc.finding",
        externalId: row.id,
        canonicalType: "Finding",
        canonicalId: row.id,
        title: `${row.reference} ${row.title}`,
        summary: `Severity ${row.severity}, status ${row.status}.`,
        sourceUpdatedAt: row.raisedOn,
        externalVersion: row.status,
        fields: {
          reference: row.reference,
          title: row.title,
          kind: row.kind,
          severity: row.severity,
          status: row.status,
          ownerUserId: row.ownerUserId,
          dueOn: row.dueOn,
          entityId: row.entityId,
          controlIds: row.controlIds,
          supplierIds: row.supplierIds,
        },
      }),
    );
}

export function grcActions(runId: string): ExternalRecord[] {
  return getDb()
    .select()
    .from(actions)
    .where(eq(actions.runId, runId))
    .orderBy(asc(actions.id))
    .all()
    .map((row) =>
      externalRecord({
        externalType: "grc.action",
        externalId: row.id,
        canonicalType: "Action",
        canonicalId: row.id,
        title: `${row.reference} ${row.title}`,
        summary: `Status ${row.status}, priority ${row.priority}.`,
        sourceUpdatedAt: row.completedOn ?? row.createdOn,
        externalVersion: row.status,
        fields: {
          reference: row.reference,
          title: row.title,
          kind: row.kind,
          status: row.status,
          priority: row.priority,
          ownerUserId: row.ownerUserId,
          ownerLabel: row.ownerLabel,
          dueOn: row.dueOn,
          unowned: row.isUnowned,
          entityId: row.entityId,
        },
      }),
    );
}

/* ==========================================================================
   Procurement and third party projections
   ========================================================================== */

export function supplierRecords(runId: string): ExternalRecord[] {
  return getDb()
    .select()
    .from(suppliers)
    .where(eq(suppliers.runId, runId))
    .orderBy(asc(suppliers.id))
    .all()
    .map((row) =>
      externalRecord({
        externalType: "grc.supplier",
        externalId: row.id,
        canonicalType: "Supplier",
        canonicalId: row.id,
        title: row.name,
        summary: `Criticality ${row.criticality}, status ${row.status}. ${row.isOutsourcing ? "Regulated outsourcing." : "Not a regulated outsourcing."}`,
        sourceUpdatedAt: row.lastAssessmentDate ?? SCENARIO_FALLBACK_TIMESTAMP,
        externalVersion: `${row.criticality}:${row.status}`,
        fields: {
          name: row.name,
          legalForm: row.legalForm,
          domicile: row.domicile,
          criticality: row.criticality,
          outsourcing: row.isOutsourcing,
          status: row.status,
          contractingEntityIds: row.contractingEntityIds,
          lastAssessmentDate: row.lastAssessmentDate,
          nextAssessmentDue: row.nextAssessmentDue,
          relationshipOwnerUserId: row.relationshipOwnerUserId,
        },
      }),
    );
}

export function serviceRecords(runId: string): ExternalRecord[] {
  return getDb()
    .select()
    .from(services)
    .where(eq(services.runId, runId))
    .orderBy(asc(services.id))
    .all()
    .map((row) =>
      externalRecord({
        externalType: "grc.service",
        externalId: row.id,
        canonicalType: "Service",
        canonicalId: row.id,
        title: row.name,
        summary: `Operational status ${row.operationalStatus}.${row.isImportantBusinessService ? " Important business service." : ""}`,
        sourceUpdatedAt: SCENARIO_FALLBACK_TIMESTAMP,
        externalVersion: row.operationalStatus,
        fields: {
          name: row.name,
          domain: row.domain,
          importantBusinessService: row.isImportantBusinessService,
          operationalStatus: row.operationalStatus,
          entityIds: row.entityIds,
          supplierIds: row.supplierIds,
          ownerUserId: row.ownerUserId,
        },
      }),
    );
}

/* ==========================================================================
   Process intelligence projections
   ========================================================================== */

export function processRecords(runId: string): ExternalRecord[] {
  return getDb()
    .select()
    .from(processes)
    .where(eq(processes.runId, runId))
    .orderBy(asc(processes.id))
    .all()
    .map((row) =>
      externalRecord({
        externalType: "pi.process",
        externalId: row.id,
        canonicalType: "Process",
        canonicalId: row.id,
        title: `${row.code} ${row.name}`,
        summary:
          row.monthlyVolume === null
            ? "No volume is mined for this process."
            : `Monthly volume ${row.monthlyVolume}. Manual touch rate ${row.manualTouchRate ?? 0}.`,
        sourceUpdatedAt: SCENARIO_FALLBACK_TIMESTAMP,
        externalVersion: String(row.monthlyVolume ?? 0),
        fields: {
          code: row.code,
          name: row.name,
          serviceId: row.serviceId,
          entityIds: row.entityIds,
          ownerUserId: row.ownerUserId,
          monthlyVolume: row.monthlyVolume,
          manualTouchRate: row.manualTouchRate,
          recentChangeNote: row.recentChangeNote,
        },
      }),
    );
}

/**
 * The mined cases behind a control test.
 *
 * These are the payment repair overrides the control assurance story turns on.
 * A process intelligence platform is exactly where they would come from in a
 * real bank, which is why they are projected under `pi.case` rather than
 * invented as a separate population.
 */
export function processCases(runId: string, limit = 60): ExternalRecord[] {
  return getDb()
    .select()
    .from(testCases)
    .where(eq(testCases.runId, runId))
    .orderBy(asc(testCases.occurredAt), asc(testCases.id))
    .limit(limit)
    .all()
    .map((row) =>
      externalRecord({
        externalType: "pi.case",
        externalId: row.id,
        canonicalType: "Test",
        canonicalId: row.id,
        title: `Repair case ${row.transactionRef}`,
        summary: `${row.repairReason}. Outcome ${row.outcome}.${row.secondaryReviewEvidenced ? "" : " No secondary review evidenced."}`,
        sourceUpdatedAt: row.occurredAt,
        externalVersion: row.outcome,
        fields: {
          transactionRef: row.transactionRef,
          controlTestId: row.controlTestId,
          occurredAt: row.occurredAt,
          entityId: row.entityId,
          repairReason: row.repairReason,
          repairedByUserId: row.repairedByUserId,
          reviewerUserId: row.reviewerUserId,
          secondaryReviewEvidenced: row.secondaryReviewEvidenced,
          outcome: row.outcome,
          anomalyKind: row.anomalyKind,
          inSample: row.inSample,
          fromFallbackRoute: row.fromFallbackRoute,
        },
      }),
    );
}

/**
 * A derived process signal.
 *
 * Computed from the seeded cases rather than stated, so the number on the live
 * day event is the number a reviewer gets by counting the rows.
 *
 * `unreviewedCount` is the headline metric and `fallbackCount` is secondary,
 * which is a decision about this scenario rather than a general preference.
 * The seeded test population covers the tested period, in which no case took
 * the fallback route: the fallback cases belong to the 14:05 event and are a
 * different population. Leading with a count that is legitimately zero would
 * make the deviation event look like noise. The absent secondary review on
 * seven of the hundred cases is the real finding, and it is the one the
 * control assurance lead challenges the first line about.
 */
export function processDeviationSignal(
  runId: string,
): { processId: string; controlTestId: string; fallbackCount: number; unreviewedCount: number; totalCases: number } | null {
  const cases = getDb().select().from(testCases).where(eq(testCases.runId, runId)).all();
  if (cases.length === 0) return null;

  const fallback = cases.filter((row) => row.fromFallbackRoute);
  const unreviewed = cases.filter((row) => !row.secondaryReviewEvidenced);
  const controlTestId = cases[0]?.controlTestId ?? "";

  const test = getDb()
    .select()
    .from(controlTests)
    .where(and(eq(controlTests.runId, runId), eq(controlTests.id, controlTestId)))
    .get();

  const control = test
    ? getDb()
        .select()
        .from(controls)
        .where(and(eq(controls.runId, runId), eq(controls.id, test.controlId)))
        .get()
    : undefined;

  const processId = control?.processIds[0] ?? "";

  return {
    processId,
    controlTestId,
    fallbackCount: fallback.length,
    unreviewedCount: unreviewed.length,
    totalCases: cases.length,
  };
}

/* ==========================================================================
   Document repository projections
   ========================================================================== */

export function documentRecords(runId: string, limit = 200): ExternalRecord[] {
  return getDb()
    .select()
    .from(evidenceDocuments)
    .where(eq(evidenceDocuments.runId, runId))
    .orderBy(asc(evidenceDocuments.id))
    .limit(limit)
    .all()
    .map((row) =>
      externalRecord({
        externalType: "dms.document",
        externalId: row.id,
        canonicalType: "Evidence",
        canonicalId: row.id,
        title: `${row.reference} ${row.title}`,
        summary: row.summary,
        sourceUpdatedAt: row.documentDate,
        externalVersion: row.isStale ? "stale" : "current",
        fields: {
          reference: row.reference,
          title: row.title,
          sourceType: row.sourceType,
          sourceSystem: row.sourceSystem,
          authorLabel: row.authorLabel,
          documentDate: row.documentDate,
          dataClassification: row.dataClassification,
          status: row.status,
          stale: row.isStale,
          pageCount: row.pageCount,
          entityIds: row.entityIds,
          relatedObjectIds: row.relatedObjectIds,
        },
      }),
    );
}

/* ==========================================================================
   Collaboration suite projections
   ========================================================================== */

export function collaborationRecords(runId: string): ExternalRecord[] {
  return getDb()
    .select()
    .from(collaborationMessages)
    .where(eq(collaborationMessages.runId, runId))
    .orderBy(asc(collaborationMessages.id))
    .all()
    .map((row) =>
      externalRecord({
        externalType: "m365.chatMessage",
        externalId: row.id,
        canonicalType: "Message",
        canonicalId: row.id,
        title: row.subject,
        summary: `${row.channelName}. Sent at ${row.sentAtMoment}.${row.simulatedOnly ? " Simulated only, never delivered outside this machine." : ""}`,
        sourceUpdatedAt: row.replyAtMoment ? null : row.sentAt,
        externalVersion: row.replyBody.length > 0 ? "replied" : "sent",
        fields: {
          channelName: row.channelName,
          subject: row.subject,
          fromRoleId: row.fromRoleId,
          toUserIds: row.toUserIds,
          sentAtMoment: row.sentAtMoment,
          simulatedOnly: row.simulatedOnly,
          hasReply: row.replyBody.length > 0,
          relatedObjectId: row.relatedObjectId,
        },
      }),
    );
}

export function mailRecords(runId: string): ExternalRecord[] {
  return getDb()
    .select()
    .from(inboxMessages)
    .where(eq(inboxMessages.runId, runId))
    .orderBy(asc(inboxMessages.id))
    .all()
    .map((row) =>
      externalRecord({
        externalType: "m365.message",
        externalId: row.id,
        canonicalType: "Message",
        canonicalId: row.id,
        title: row.subject,
        summary: `${row.channel} from ${row.fromLabel}. Proposed triage ${row.proposedTriage}.`,
        sourceUpdatedAt: row.receivedAt,
        externalVersion: row.isRead ? "read" : "unread",
        fields: {
          channel: row.channel,
          subject: row.subject,
          fromLabel: row.fromLabel,
          fromUserId: row.fromUserId,
          receivedAt: row.receivedAt,
          revealedAtMoment: row.revealedAtMoment,
          read: row.isRead,
          proposedTriage: row.proposedTriage,
          relatedObjectId: row.relatedObjectId,
        },
      }),
    );
}

export function meetingRecords(runId: string): ExternalRecord[] {
  return getDb()
    .select()
    .from(meetings)
    .where(eq(meetings.runId, runId))
    .orderBy(asc(meetings.id))
    .all()
    .map((row) =>
      externalRecord({
        externalType: "m365.event",
        externalId: row.id,
        canonicalType: "Meeting",
        canonicalId: row.id,
        title: row.title,
        summary: `${row.kind} at ${row.momentLabel}. Status ${row.status}.`,
        sourceUpdatedAt: row.concludedAt ?? row.scheduledFor,
        externalVersion: row.status,
        fields: {
          reference: row.reference,
          title: row.title,
          kind: row.kind,
          momentLabel: row.momentLabel,
          scheduledFor: row.scheduledFor,
          participantUserIds: row.participantUserIds,
          status: row.status,
          subjectKind: row.subjectKind,
          subjectId: row.subjectId,
        },
      }),
    );
}

export function personRecords(runId: string): ExternalRecord[] {
  return getDb()
    .select()
    .from(users)
    .where(eq(users.runId, runId))
    .orderBy(asc(users.id))
    .all()
    .map((row) =>
      externalRecord({
        externalType: "m365.user",
        externalId: row.id,
        canonicalType: "Person",
        canonicalId: row.id,
        title: row.name,
        summary: `${row.jobTitle}, ${row.department}.`,
        sourceUpdatedAt: SCENARIO_FALLBACK_TIMESTAMP,
        externalVersion: row.roleId ?? "no-role",
        fields: {
          name: row.name,
          jobTitle: row.jobTitle,
          department: row.department,
          entityId: row.entityId,
          line: row.line,
          roleId: row.roleId,
          /* The address is seeded synthetic and ends in .example, so it cannot
           * reach a real mailbox. It is still only projected as a field, never
           * used to send anything: `sendExternalEmail` is a PROHIBITED tool. */
          email: row.email,
        },
      }),
    );
}

/* ==========================================================================
   Incidents and obligations, for the webhook and generic REST projections
   ========================================================================== */

export function incidentRecords(runId: string): ExternalRecord[] {
  return getDb()
    .select()
    .from(incidents)
    .where(eq(incidents.runId, runId))
    .orderBy(asc(incidents.id))
    .all()
    .map((row) =>
      externalRecord({
        externalType: "itsm.incident",
        externalId: row.id,
        canonicalType: "Incident",
        canonicalId: row.id,
        title: `${row.reference} ${row.title}`,
        summary: `Status ${row.status}. Severity ${row.severity ?? "not yet classified"}.`,
        sourceUpdatedAt: row.closedAt ?? row.detectedAt,
        externalVersion: `${row.status}:${row.severity ?? "unset"}`,
        fields: {
          reference: row.reference,
          title: row.title,
          kind: row.kind,
          status: row.status,
          severity: row.severity,
          proposedSeverity: row.proposedSeverity,
          detectedAt: row.detectedAt,
          entityIds: row.entityIds,
          serviceIds: row.serviceIds,
          supplierIds: row.supplierIds,
          leadUserId: row.leadUserId,
        },
      }),
    );
}

export function obligationRecords(runId: string): ExternalRecord[] {
  return getDb()
    .select()
    .from(obligations)
    .where(eq(obligations.runId, runId))
    .orderBy(asc(obligations.sortOrder))
    .all()
    .map((row) =>
      externalRecord({
        externalType: "reg.obligation",
        externalId: row.id,
        canonicalType: "Obligation",
        canonicalId: row.id,
        title: `${row.paragraphReference} ${row.theme}`,
        summary: row.extractedSummary,
        sourceUpdatedAt: row.decidedOn ?? SCENARIO_FALLBACK_TIMESTAMP,
        externalVersion: row.applicabilityDecision ?? "undecided",
        fields: {
          publicationId: row.publicationId,
          paragraphReference: row.paragraphReference,
          theme: row.theme,
          candidateEntityIds: row.candidateEntityIds,
          applicabilityDecision: row.applicabilityDecision,
          ownerUserId: row.ownerUserId,
          unownedGap: row.isUnownedGap,
        },
      }),
    );
}

/* ==========================================================================
   Lookup helpers
   ========================================================================== */

/** Finds one record in a projection by external identifier. */
export function findRecord(records: ExternalRecord[], externalId: string): ExternalRecord | null {
  return records.find((record) => record.externalId === externalId) ?? null;
}

/**
 * Filters a projection by a free text query.
 *
 * Title and summary only. A simulator that searched every field would answer
 * queries the real adapter could not, which would make the local experience a
 * poor guide to what the product does once a genuine endpoint is connected.
 */
export function filterRecords(
  records: ExternalRecord[],
  query: string,
  limit: number,
): ExternalRecord[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return records.slice(0, limit);
  return records
    .filter(
      (record) =>
        record.title.toLowerCase().includes(needle) ||
        record.summary.toLowerCase().includes(needle) ||
        record.externalId.toLowerCase().includes(needle),
    )
    .slice(0, limit);
}

/**
 * Applies a cursor to a projection.
 *
 * The cursor is the last external identifier returned, and the records are
 * ordered by identifier, so a delta sync resumes where it stopped. Crude
 * compared with a real change token, and deliberately so: the shape of the
 * contract matters here, and pretending to have a change feed the simulator
 * does not have would hide the gap that docs/PRODUCTIZATION_GAPS.md records.
 */
export function applyCursor(
  records: ExternalRecord[],
  cursor: string | null,
  limit: number,
): { page: ExternalRecord[]; nextCursor: string | null; hasMore: boolean } {
  const startIndex = cursor === null ? 0 : records.findIndex((r) => r.externalId === cursor) + 1;
  const page = records.slice(startIndex, startIndex + limit);
  const last = page[page.length - 1];
  const hasMore = startIndex + limit < records.length;
  return { page, nextCursor: last ? last.externalId : cursor, hasMore };
}
