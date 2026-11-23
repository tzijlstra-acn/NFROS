/**
 * The portfolio register and its history (migration 0010, NFR Workspace v3).
 *
 * The operational tables hold the flagship day: eight suppliers, the
 * Novalink event, the decisions a person must still make. Analysis across
 * the group needs more breadth and more time than one day holds, so this
 * layer adds what a bank's group register and history mart would hold:
 *
 *   portfolio_third_parties     the third parties in the group register that
 *                               are not part of the day's case work;
 *   portfolio_provider_links    which underlying provider (fourth party)
 *                               carries each register third party, and which
 *                               service it supports;
 *   third_party_monthly_metrics 24 months of performance per third party,
 *                               the operational ones included;
 *   control_test_results        eight quarters of test outcomes per control;
 *   kri_history                 the indicator readings before 2026;
 *   risk_acceptances            the register of accepted risks, which the
 *                               operational model did not have;
 *   service_resilience_tests    tolerance against observed recovery per
 *                               service, from the latest exercise or event;
 *   insight_runs                every analysis the workspace prepared, with
 *                               the response exactly as it was shown.
 *
 * None of these rows is a decision, an approval or a human conclusion, so
 * the seed leaves the person's judgment as unmade as before. Every row
 * carries `runId` and is cleared and rewritten by `demo:reset`. The
 * operational tables are not changed by this migration.
 */

import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import type { RoleId } from "./core";

export const portfolioThirdParties = sqliteTable(
  "portfolio_third_parties",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    name: text("name").notNull(),
    domicile: text("domicile").notNull(),
    /** What the third party provides, for grouping: "payments", "cloud", "data", ... */
    category: text("category").notNull(),
    /** "critical", "important" or "standard". */
    criticality: text("criticality").notNull(),
    isOutsourcing: integer("is_outsourcing", { mode: "boolean" }).notNull(),
    entityIds: text("entity_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** "active", "under-review", "exit-planned". */
    status: text("status").notNull(),
    relationshipOwnerUserId: text("relationship_owner_user_id").notNull(),
    annualSpend: integer("annual_spend").notNull(),
    lastAssessmentDate: text("last_assessment_date").notNull(),
    nextAssessmentDue: text("next_assessment_due").notNull(),
    /** Date of the latest independent assurance report on file. */
    assuranceReportDate: text("assurance_report_date").notNull(),
    description: text("description").notNull(),
  },
  (table) => [index("portfolio_third_parties_run_idx").on(table.runId)],
);

export const portfolioProviderLinks = sqliteTable(
  "portfolio_provider_links",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    /** A register third party (`portfolio_third_parties`). */
    thirdPartyId: text("third_party_id").notNull(),
    /** Normalised key, shared with operational subprocessors of the same provider. */
    providerKey: text("provider_key").notNull(),
    providerName: text("provider_name").notNull(),
    providerDomicile: text("provider_domicile").notNull(),
    /** The service the dependency supports, an operational service id. */
    serviceId: text("service_id").notNull(),
    supportsCriticalFunction: integer("supports_critical_function", { mode: "boolean" }).notNull(),
    /** Whether the third party declared this provider in its register submission. */
    declared: integer("declared", { mode: "boolean" }).notNull(),
  },
  (table) => [index("portfolio_provider_links_run_idx").on(table.runId, table.providerKey)],
);

export const thirdPartyMonthlyMetrics = sqliteTable(
  "third_party_monthly_metrics",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    /** An operational supplier or a register third party. */
    thirdPartyId: text("third_party_id").notNull(),
    /** "2026-09". */
    period: text("period").notNull(),
    availabilityPct: real("availability_pct").notNull(),
    slaBreaches: integer("sla_breaches").notNull(),
    incidents: integer("incidents").notNull(),
    /** Composite risk score, 0 to 100, higher is worse. */
    riskScore: integer("risk_score").notNull(),
    /** "current", "aging" or "stale": the assurance evidence position in the month. */
    assuranceStatus: text("assurance_status").notNull(),
  },
  (table) => [index("third_party_monthly_metrics_run_idx").on(table.runId, table.thirdPartyId)],
);

export const controlTestResults = sqliteTable(
  "control_test_results",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    controlId: text("control_id").notNull(),
    /** "2026-Q3". */
    period: text("period").notNull(),
    /** "effective", "minor-exceptions", "failed", "awaiting-conclusion" or "not-tested". */
    result: text("result").notNull(),
    exceptions: integer("exceptions").notNull(),
    sampleSize: integer("sample_size").notNull(),
    testedOn: text("tested_on"),
    /** The operational test this result came from, when there is one. */
    controlTestId: text("control_test_id"),
  },
  (table) => [index("control_test_results_run_idx").on(table.runId, table.controlId)],
);

export const kriHistory = sqliteTable(
  "kri_history",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    kriId: text("kri_id").notNull(),
    /** "2025-07". */
    period: text("period").notNull(),
    periodEnd: text("period_end").notNull(),
    value: real("value").notNull(),
    /** "green", "amber" or "red", against the thresholds in force. */
    status: text("status").notNull(),
  },
  (table) => [index("kri_history_run_idx").on(table.runId, table.kriId)],
);

export const riskAcceptances = sqliteTable(
  "risk_acceptances",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    reference: text("reference").notNull(),
    riskId: text("risk_id").notNull(),
    /** "supplier", "control", "service" or "process". */
    subjectKind: text("subject_kind").notNull(),
    subjectId: text("subject_id").notNull(),
    subjectLabel: text("subject_label").notNull(),
    entityId: text("entity_id").notNull(),
    title: text("title").notNull(),
    rationale: text("rationale").notNull(),
    conditions: text("conditions").notNull(),
    /** Whether the conditions of the acceptance are met today, as recorded. */
    conditionsMet: integer("conditions_met", { mode: "boolean" }).notNull(),
    grantedOn: text("granted_on").notNull(),
    expiresOn: text("expires_on").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    approverUserId: text("approver_user_id").notNull(),
    /** "active", "renewal-requested" or "expired". */
    status: text("status").notNull(),
    evidenceDocumentId: text("evidence_document_id"),
    issueId: text("issue_id"),
  },
  (table) => [index("risk_acceptances_run_idx").on(table.runId)],
);

export const serviceResilienceTests = sqliteTable(
  "service_resilience_tests",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    serviceId: text("service_id").notNull(),
    entityId: text("entity_id").notNull(),
    reference: text("reference").notNull(),
    /** "exercise" or "live-event". */
    source: text("source").notNull(),
    testedOn: text("tested_on").notNull(),
    scenario: text("scenario").notNull(),
    toleranceMinutes: integer("tolerance_minutes").notNull(),
    observedMinutes: integer("observed_minutes").notNull(),
    finding: text("finding").notNull(),
    /** A dependency the exercise found that the service map does not hold. */
    unmappedDependency: text("unmapped_dependency"),
    openActions: integer("open_actions").notNull(),
  },
  (table) => [index("service_resilience_tests_run_idx").on(table.runId)],
);

export const insightRuns = sqliteTable(
  "insight_runs",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    question: text("question").notNull(),
    intentId: text("intent_id").notNull(),
    /** The case or object the question was asked about, when there was one. */
    contextKind: text("context_kind"),
    contextId: text("context_id"),
    /** The validated insight response, exactly as it was rendered. */
    response: text("response", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    generatedAt: text("generated_at").notNull(),
    generatedAtMoment: text("generated_at_moment").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    /** Set when a person saved the analysis to Insights. */
    savedAt: text("saved_at"),
    savedTitle: text("saved_title"),
    auditEventId: text("audit_event_id"),
  },
  (table) => [index("insight_runs_role_idx").on(table.runId, table.roleId)],
);
