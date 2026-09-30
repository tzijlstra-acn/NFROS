/**
 * Practice schema: the function specific professional work products.
 *
 * Assessments are versioned rather than overwritten, because a risk decision
 * that silently replaces the previous rating destroys the audit story. Each
 * human decision creates a new version and leaves the prior one intact.
 */

import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import type { ProvenanceKind, RoleId } from "./core";

/**
 * An RCSA or supplier assessment version.
 *
 * `supersededBy` is set when a newer version is created, so "compare current
 * and previous" is a simple two row read rather than a reconstruction.
 */
export const assessments = sqliteTable(
  "assessments",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    /** "rcsa" or "supplier". */
    kind: text("kind").notNull(),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    /** Subject of the assessment: a process identifier or a supplier identifier. */
    subjectKind: text("subject_kind").notNull(),
    subjectId: text("subject_id").notNull(),
    entityId: text("entity_id").notNull(),
    version: integer("version").notNull(),
    /** "draft", "approved", "superseded" or "off-cycle". */
    status: text("status").notNull(),
    /** Assessment cycle label, for example "Q3 2026". */
    cycle: text("cycle").notNull(),
    performedByUserId: text("performed_by_user_id").notNull(),
    approvedByUserId: text("approved_by_user_id"),
    performedOn: text("performed_on").notNull(),
    approvedOn: text("approved_on"),
    supersededBy: text("superseded_by"),
    /** Residual risk conclusion at assessment level. */
    residualRisk: text("residual_risk").notNull(),
    overallConclusion: text("overall_conclusion").notNull(),
    /** Rationale recorded by the human who owns the conclusion. */
    rationale: text("rationale").notNull().default(""),
    /** True when this version was created by a user decision in this session. */
    createdBySession: integer("created_by_session", { mode: "boolean" }).notNull().default(false),
    /** The decision that produced this version, when applicable. */
    sourceDecisionId: text("source_decision_id"),
  },
  (table) => [
    index("assess_run_subject_idx").on(table.runId, table.subjectKind, table.subjectId),
    index("assess_status_idx").on(table.runId, table.status),
  ],
);

/** One risk and control line within an assessment version. */
export const assessmentLines = sqliteTable(
  "assessment_lines",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    assessmentId: text("assessment_id").notNull(),
    riskId: text("risk_id").notNull(),
    controlIds: text("control_ids", { mode: "json" }).$type<string[]>().notNull(),
    inherentLikelihood: integer("inherent_likelihood").notNull(),
    inherentImpact: integer("inherent_impact").notNull(),
    controlEffectiveness: text("control_effectiveness").notNull(),
    residualLikelihood: integer("residual_likelihood").notNull(),
    residualImpact: integer("residual_impact").notNull(),
    residualRating: text("residual_rating").notNull(),
    appetitePosition: text("appetite_position").notNull(),
    commentary: text("commentary").notNull().default(""),
    /** Set when this line changed relative to the previous version. */
    changeFromPrevious: text("change_from_previous").notNull().default(""),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [index("assess_line_idx").on(table.runId, table.assessmentId, table.sortOrder)],
);

export const controlTests = sqliteTable(
  "control_tests",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    reference: text("reference").notNull(),
    controlId: text("control_id").notNull(),
    entityId: text("entity_id").notNull(),
    title: text("title").notNull(),
    /** "design", "operating-effectiveness" or "combined". */
    testType: text("test_type").notNull(),
    testerUserId: text("tester_user_id").notNull(),
    periodFrom: text("period_from").notNull(),
    periodTo: text("period_to").notNull(),
    /** Full population size for the period. */
    populationSize: integer("population_size").notNull(),
    sampleSize: integer("sample_size").notNull(),
    /** How the sample was drawn, needed to answer "why was this case selected". */
    samplingMethod: text("sampling_method").notNull(),
    samplingRationale: text("sampling_rationale").notNull(),
    testProcedure: text("test_procedure").notNull(),
    /** "planned", "in-progress", "preliminary", "concluded" or "disputed". */
    status: text("status").notNull(),
    exceptionCount: integer("exception_count").notNull().default(0),
    /** Preliminary conclusion before the human assurance conclusion. */
    preliminaryConclusion: text("preliminary_conclusion").notNull().default(""),
    /** The human owned assurance conclusion. Null until decided. */
    assuranceConclusion: text("assurance_conclusion"),
    concludedByUserId: text("concluded_by_user_id"),
    concludedOn: text("concluded_on"),
    /** The first line management response, which disputes the result. */
    managementResponse: text("management_response").notNull().default(""),
    managementResponseBy: text("management_response_by"),
    /** True when the test population includes the 14:05 fallback cases. */
    includesEventPopulation: integer("includes_event_population", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [index("ctest_run_control_idx").on(table.runId, table.controlId)],
);

/**
 * One transaction in a control test population.
 *
 * The full population is stored, not just the sample, so the interactive
 * population field can show the real anomaly distribution and the professional
 * can inspect a case that was not sampled.
 */
export const testCases = sqliteTable(
  "test_cases",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    controlTestId: text("control_test_id").notNull(),
    /** Business reference of the underlying transaction. */
    transactionRef: text("transaction_ref").notNull(),
    occurredAt: text("occurred_at").notNull(),
    entityId: text("entity_id").notNull(),
    /** Payment amount, in minor units to avoid floating point drift. */
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    /** Why the payment needed repair. */
    repairReason: text("repair_reason").notNull(),
    /** Who performed the repair, and who reviewed it. */
    repairedByUserId: text("repaired_by_user_id").notNull(),
    reviewerUserId: text("reviewer_user_id"),
    /** True when a secondary review is evidenced. */
    secondaryReviewEvidenced: integer("secondary_review_evidenced", { mode: "boolean" }).notNull(),
    reviewEvidenceRef: text("review_evidence_ref"),
    /** True when this case was drawn into the sample. */
    inSample: integer("in_sample", { mode: "boolean" }).notNull().default(false),
    /** "conforming", "anomaly" or "exception". */
    outcome: text("outcome").notNull(),
    /** Set when the case is an anomaly: what is unusual about it. */
    anomalyKind: text("anomaly_kind"),
    /** Human classification of an exception. Null until the specialist decides. */
    exceptionClassification: text("exception_classification"),
    /** "isolated" or "systemic", decided by the human. */
    exceptionScope: text("exception_scope"),
    rootCause: text("root_cause"),
    classifiedByUserId: text("classified_by_user_id"),
    classifiedAt: text("classified_at"),
    /** True when this case arose from the 14:05 fallback route. */
    fromFallbackRoute: integer("from_fallback_route", { mode: "boolean" }).notNull().default(false),
    evidenceDocumentIds: text("evidence_document_ids", { mode: "json" }).$type<string[]>().notNull(),
    note: text("note").notNull().default(""),
  },
  (table) => [
    index("tcase_test_idx").on(table.runId, table.controlTestId),
    index("tcase_outcome_idx").on(table.runId, table.outcome),
  ],
);

export const incidents = sqliteTable(
  "incidents",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    titleDe: text("title_de").notNull(),
    entityIds: text("entity_ids", { mode: "json" }).$type<string[]>().notNull(),
    serviceIds: text("service_ids", { mode: "json" }).$type<string[]>().notNull(),
    supplierIds: text("supplier_ids", { mode: "json" }).$type<string[]>().notNull(),
    processIds: text("process_ids", { mode: "json" }).$type<string[]>().notNull(),
    detectedAt: text("detected_at").notNull(),
    occurredAt: text("occurred_at"),
    closedAt: text("closed_at"),
    /** "near-miss", "incident" or "major-incident". */
    kind: text("kind").notNull(),
    /** Human owned severity. Null until classified in this session. */
    severity: text("severity"),
    severitySetByUserId: text("severity_set_by_user_id"),
    /** The proposed severity from the specialist, pending human decision. */
    proposedSeverity: text("proposed_severity"),
    /** "open", "contained", "recovered", "closed" or "under-assessment". */
    status: text("status").notNull(),
    /** Human owned classification for regulatory purposes. */
    regulatoryClassification: text("regulatory_classification"),
    /** True when the human recommended a supervisory notification. */
    notificationRecommended: integer("notification_recommended", { mode: "boolean" }),
    notificationRationale: text("notification_rationale"),
    grossLossMinor: integer("gross_loss_minor"),
    lossCurrency: text("loss_currency"),
    description: text("description").notNull(),
    leadUserId: text("lead_user_id"),
    /** True for the 14:05 shared event. */
    isSharedEvent: integer("is_shared_event", { mode: "boolean" }).notNull().default(false),
    lessonsLearned: text("lessons_learned").notNull().default(""),
  },
  (table) => [index("incidents_run_idx").on(table.runId)],
);

/**
 * The incident chronology. Each entry is explicitly classified as a verified
 * fact, a stakeholder statement, or telemetry inference, and conflicting
 * statements are linked to each other.
 */
export const incidentEvents = sqliteTable(
  "incident_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    incidentId: text("incident_id").notNull(),
    /** Scenario clock time, for example "14:05". */
    atMoment: text("at_moment").notNull(),
    sortOrder: integer("sort_order").notNull(),
    /** "mail", "alert", "telemetry", "supplier-notification", "call", "system". */
    channel: text("channel").notNull(),
    sourceLabel: text("source_label").notNull(),
    sourceUserId: text("source_user_id"),
    provenance: text("provenance").$type<ProvenanceKind>().notNull(),
    statement: text("statement").notNull(),
    /** Identifier of another chronology entry this one contradicts. */
    conflictsWithId: text("conflicts_with_id"),
    /** Set when the conflict was later resolved, describing the resolution. */
    conflictResolution: text("conflict_resolution").notNull().default(""),
    /** Confidence in the entry, zero to one. Null for verified facts. */
    confidence: real("confidence"),
    evidenceDocumentIds: text("evidence_document_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** True when this entry only becomes visible after the timeline reaches it. */
    revealedAtMoment: text("revealed_at_moment").notNull(),
  },
  (table) => [
    index("incev_incident_idx").on(table.runId, table.incidentId, table.sortOrder),
  ],
);

/** Recovery options compared during the event response. */
export const recoveryOptions = sqliteTable(
  "recovery_options",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    incidentId: text("incident_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    estimatedMinutesToRestore: integer("estimated_minutes_to_restore").notNull(),
    /** What this option costs in control terms, stated plainly. */
    controlTradeOff: text("control_trade_off").notNull(),
    operationalRisk: text("operational_risk").notNull(),
    /** "available", "requires-approval" or "not-available". */
    availability: text("availability").notNull(),
    requiresApprovalFrom: text("requires_approval_from").notNull().default(""),
    /** Set when the human selects this option. */
    selected: integer("selected", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [index("recopt_incident_idx").on(table.runId, table.incidentId)],
);

export const regulatoryPublications = sqliteTable(
  "regulatory_publications",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    /** Synthetic issuing body. */
    issuer: text("issuer").notNull(),
    /** "eu", "de", "at" or "ch". Keeps EU and Swiss contexts distinct. */
    jurisdiction: text("jurisdiction").notNull(),
    publishedOn: text("published_on").notNull(),
    effectiveFrom: text("effective_from"),
    consultationCloses: text("consultation_closes"),
    /** "regulation", "guideline", "circular" or "consultation". */
    instrumentType: text("instrument_type").notNull(),
    summary: text("summary").notNull(),
    /** The mandatory illustrative context label is rendered with every reference. */
    fullText: text("full_text").notNull(),
    evidenceDocumentId: text("evidence_document_id"),
  },
  (table) => [index("regpub_run_idx").on(table.runId)],
);

/** A candidate obligation extracted from a publication paragraph. */
export const obligations = sqliteTable(
  "obligations",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    publicationId: text("publication_id").notNull(),
    paragraphReference: text("paragraph_reference").notNull(),
    obligationText: text("obligation_text").notNull(),
    /** Model extracted summary, clearly separated from the quoted text. */
    extractedSummary: text("extracted_summary").notNull(),
    extractionConfidence: real("extraction_confidence").notNull(),
    /** "operational-risk", "outsourcing", "resilience", "reporting", "governance". */
    theme: text("theme").notNull(),
    /** Which entities it may apply to. Applicability is a human decision. */
    candidateEntityIds: text("candidate_entity_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** Human owned applicability decision. Null until decided. */
    applicabilityDecision: text("applicability_decision"),
    applicabilityRationale: text("applicability_rationale"),
    decidedByUserId: text("decided_by_user_id"),
    decidedOn: text("decided_on"),
    /** Mapped policies, processes and controls. */
    policyIds: text("policy_ids", { mode: "json" }).$type<string[]>().notNull(),
    processIds: text("process_ids", { mode: "json" }).$type<string[]>().notNull(),
    controlIds: text("control_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** True when no owner or control currently covers this obligation. */
    isUnownedGap: integer("is_unowned_gap", { mode: "boolean" }).notNull().default(false),
    gapNote: text("gap_note").notNull().default(""),
    ownerUserId: text("owner_user_id"),
    implementationPriority: text("implementation_priority"),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    index("obl_pub_idx").on(table.runId, table.publicationId, table.sortOrder),
    index("obl_gap_idx").on(table.runId, table.isUnownedGap),
  ],
);

export const policies = sqliteTable(
  "policies",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    titleDe: text("title_de").notNull(),
    /** Section reference within the policy, for example "4.3". */
    section: text("section").notNull(),
    sectionTitle: text("section_title").notNull(),
    /** "group", or a specific entity identifier for local policy. */
    scope: text("scope").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    version: text("version").notNull(),
    effectiveFrom: text("effective_from").notNull(),
    nextReviewDue: text("next_review_due"),
    /** The policy text that the assistant retrieves as applicable policy. */
    body: text("body").notNull(),
    /** Roles whose autonomy this section constrains. */
    relatedRoleIds: text("related_role_ids", { mode: "json" }).$type<RoleId[]>().notNull(),
    controlIds: text("control_ids", { mode: "json" }).$type<string[]>().notNull(),
  },
  (table) => [index("policies_run_idx").on(table.runId)],
);
