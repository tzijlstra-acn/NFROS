/**
 * Product Owner Console schema (migration 0006, plan sections 7.1 to 7.9 and Wave 4).
 *
 * The console's records, separated the way plan section 8.3 asks: release
 * state, AI quality, feedback, pilot management and operations are not domain
 * state and do not sit in the scenario's tables.
 *
 * Two scopes, and the reason for each:
 *
 *   Product state, no `runId`: Role App versions, lifecycle and enablement,
 *   cohorts, AI evaluation runs and configuration releases, product feedback,
 *   pilot programmes, product release events and release gate runs. These
 *   describe the product and its installation, like the product configuration
 *   tables in `./product.ts`. `seedProductState` (src/db/seed/product-state.ts)
 *   clears and rewrites them on every seed, exactly as the product
 *   configuration seed does, so `demo:reset` restores them too.
 *
 *   Scenario operations, with `runId`: integration incidents, data quality
 *   issues and experience events. Each refers to scenario records (a dead
 *   letter, an external reference, a Now item) that `demo:reset` deletes, so
 *   it is cleared with them.
 *
 * What is deliberately not here:
 *
 *   - A copy of any definition. Role App definitions stay in
 *     `src/role-apps/`, reviewed code; the product release identity stays in
 *     `src/product/release/`; AI configurations stay in
 *     `src/ai/prompt-registry.ts`. Rows here name them by id and version and
 *     record release state, never their content.
 *   - Per person analytics. Experience events carry no user id, and nothing
 *     here ranks or scores a person (plan 7.3, 7.4).
 *   - Analytics the backbone already answers. Minutes confirmed, message
 *     converted, action and decision completed and stage completed are
 *     `os_events` rows; only interactions the backbone does not record have a
 *     table.
 */

import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { AutonomyLevel, RoleId } from "./core";

/* ==========================================================================
   Role App lifecycle and versions (plan 7.2)
   ========================================================================== */

/**
 * The Role App lifecycle states, in the plan's order.
 *
 *   draft       a version being prepared; not visible outside the console
 *   candidate   a reviewed version that can be evaluated and compared
 *   pilot       enabled for a pilot cohort only
 *   installed   live in the workday for its role
 *   available   packaged and licensed, not provisioned to this tenant
 *   demo        demonstrable, not runnable (a prototype in the catalogue)
 *   planned     on the roadmap, not built (a concept in the catalogue)
 *   retired     withdrawn; kept for the record
 */
export const ROLE_APP_LIFECYCLE_STATES = [
  "draft",
  "candidate",
  "pilot",
  "installed",
  "available",
  "demo",
  "planned",
  "retired",
] as const;
export type RoleAppLifecycleState = (typeof ROLE_APP_LIFECYCLE_STATES)[number];

/**
 * What the product team stands behind for a version.
 *
 *   maintained           defects are fixed in this version
 *   demonstration-only   shown, not supported for work
 *   not-built            nothing to support yet
 *   ended                support has ended (a retired version)
 */
export const ROLE_APP_SUPPORT_STATES = ["maintained", "demonstration-only", "not-built", "ended"] as const;
export type RoleAppSupportState = (typeof ROLE_APP_SUPPORT_STATES)[number];

/** One source a version's stages read, as its contract declared it at release. */
export interface RoleAppVersionSource {
  stageId: string;
  key: string;
  necessity: "required" | "helpful";
  connectorInstanceId: string | null;
}

/** The authority a version exercises, as its contract declared it at release. */
export interface RoleAppVersionAuthority {
  stageCompletionToolName: string | null;
  /** Tools whose execution needs a payload bound approval. */
  approvalTools: string[];
  /** The judgment kinds that stay human. */
  humanDecisionKinds: string[];
}

/** The AI configurations and evaluation suites a version depends on. */
export interface RoleAppVersionEvaluations {
  configurationIds: string[];
  evaluationSuiteIds: string[];
}

/**
 * One version of one Role App: its release record.
 *
 * Serves the console's Role Apps view (plan 7.2): version, lifecycle state,
 * compare versions, approve, enable, roll back, retire. Each version names the
 * reviewed code it was released from by the process definition's digest and
 * holds the manifest the plan lists (source requirements, tools, authority,
 * evaluations, connector dependencies, the migration it was released against,
 * release notes and support state), so two versions can be compared without
 * reading code that has since moved on.
 *
 * At most one version per app is current (`is_current`, enforced by a partial
 * unique index); the app's lifecycle state is its current version's state. A
 * candidate is a further version that is not current.
 */
export const roleAppVersions = sqliteTable(
  "role_app_versions",
  {
    id: text("id").primaryKey(),
    /** The Role App's id in `ROLE_APP_REGISTRY`. */
    roleAppId: text("role_app_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    version: text("version").notNull(),
    lifecycleState: text("lifecycle_state").$type<RoleAppLifecycleState>().notNull(),
    isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
    /** The process definition id. Null when the registry has no definition for it. */
    processId: text("process_id"),
    /** sha256 over the process definition, truncated. Null when there is no definition. */
    processDefinitionDigest: text("process_definition_digest"),
    processStageIds: text("process_stage_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** The stages the engine could execute end to end when the version was recorded. */
    implementedStageIds: text("implemented_stage_ids", { mode: "json" }).$type<string[]>().notNull(),
    sourceRequirements: text("source_requirements", { mode: "json" }).$type<RoleAppVersionSource[]>().notNull(),
    tools: text("tools", { mode: "json" }).$type<string[]>().notNull(),
    authority: text("authority", { mode: "json" }).$type<RoleAppVersionAuthority>().notNull(),
    evaluations: text("evaluations", { mode: "json" }).$type<RoleAppVersionEvaluations>().notNull(),
    connectorDependencies: text("connector_dependencies", { mode: "json" }).$type<string[]>().notNull(),
    /** The schema migration tag this version was recorded against, for example "0006_data_model". */
    migrationTag: text("migration_tag"),
    releaseNotes: text("release_notes").notNull().default(""),
    releaseNotesDe: text("release_notes_de").notNull().default(""),
    supportState: text("support_state").$type<RoleAppSupportState>().notNull(),
    /** The evaluation run that supported its release, when one did. */
    evaluationRunId: text("evaluation_run_id"),
    /** The payload bound approval behind its release, when the console used one. */
    approvalId: text("approval_id"),
    createdAt: text("created_at").notNull(),
    createdByLabel: text("created_by_label").notNull(),
    releasedAt: text("released_at"),
  },
  (table) => [
    uniqueIndex("rav_app_version_unq").on(table.roleAppId, table.version),
    uniqueIndex("rav_current_unq").on(table.roleAppId).where(sql`${table.isCurrent} = 1`),
  ],
);

/** What can happen to a Role App release. */
export const ROLE_APP_EVENT_KINDS = [
  "registered",
  "state-changed",
  "enabled",
  "disabled",
  "cohort-assigned",
  "rolled-back",
] as const;
export type RoleAppEventKind = (typeof ROLE_APP_EVENT_KINDS)[number];

/** Who an enablement applies to: the whole tenant, or one cohort. */
export const ENABLEMENT_SCOPE_KINDS = ["tenant", "cohort"] as const;
export type EnablementScopeKind = (typeof ENABLEMENT_SCOPE_KINDS)[number];

/**
 * The history of a Role App's release state. Append only.
 *
 * Serves the Role App's history in the console and the release view: every
 * state change, enablement, cohort assignment and rollback, with who, when,
 * why and under which approval or evaluation. Product configuration history,
 * not domain audit (plan 8.3): the authority record of a material change
 * remains `audit_events`, which a governed console action still writes.
 */
export const roleAppLifecycleEvents = sqliteTable(
  "role_app_lifecycle_events",
  {
    id: text("id").primaryKey(),
    roleAppId: text("role_app_id").notNull(),
    versionId: text("version_id"),
    kind: text("kind").$type<RoleAppEventKind>().notNull(),
    fromState: text("from_state").$type<RoleAppLifecycleState>(),
    toState: text("to_state").$type<RoleAppLifecycleState>(),
    scopeKind: text("scope_kind").$type<EnablementScopeKind>(),
    scopeId: text("scope_id"),
    actorKind: text("actor_kind").$type<"human" | "system">().notNull(),
    actorUserId: text("actor_user_id"),
    /** A readable actor, for example "seed" or the product owner's name. */
    actorLabel: text("actor_label").notNull(),
    at: text("at").notNull(),
    reason: text("reason").notNull().default(""),
    approvalId: text("approval_id"),
    evaluationRunId: text("evaluation_run_id"),
  },
  (table) => [index("rale_app_idx").on(table.roleAppId, table.at)],
);

/**
 * Whether a Role App is enabled for the tenant or for one cohort.
 *
 * Serves the console's Enable and Disable (Wave 4 exit criterion: an installed
 * app can be enabled and disabled) and Assign pilot cohort. One row per app
 * and scope; `version_id` null means the scope follows the app's current
 * version, and a version id pins the scope to it, which is how a candidate
 * reaches a pilot cohort before the tenant. Every change made through
 * `setRoleAppEnablement` (src/db/repositories/role-app-release.ts) also
 * appends a `role_app_lifecycle_events` row; the seeded tenant enablement of
 * the installed apps is their starting state, not a change.
 */
export const roleAppEnablements = sqliteTable(
  "role_app_enablements",
  {
    id: text("id").primaryKey(),
    roleAppId: text("role_app_id").notNull(),
    versionId: text("version_id"),
    scopeKind: text("scope_kind").$type<EnablementScopeKind>().notNull(),
    /** The organisation profile id for the tenant, the cohort id for a cohort. */
    scopeId: text("scope_id").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    changedAt: text("changed_at").notNull(),
    changedByLabel: text("changed_by_label").notNull(),
    changedByUserId: text("changed_by_user_id"),
    reason: text("reason").notNull().default(""),
  },
  (table) => [uniqueIndex("rae_scope_unq").on(table.roleAppId, table.scopeKind, table.scopeId)],
);

/**
 * A named group of people a release or a pilot applies to.
 *
 * Serves enablement per cohort (above), the pilot's users (`pilot_programmes`
 * points here) and the Cohort filter on experience analytics (7.4). Members
 * are identity user ids (`src/identity/`), with the roles they work in.
 * Membership is an entitlement, never a measure: analytics group by cohort,
 * never by member.
 */
export const productCohorts = sqliteTable("product_cohorts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameDe: text("name_de").notNull(),
  description: text("description").notNull().default(""),
  userIds: text("user_ids", { mode: "json" }).$type<string[]>().notNull(),
  roleIds: text("role_ids", { mode: "json" }).$type<RoleId[]>().notNull(),
  legalEntityIds: text("legal_entity_ids", { mode: "json" }).$type<string[]>().notNull(),
  pilotProgrammeId: text("pilot_programme_id"),
  createdAt: text("created_at").notNull(),
  createdByLabel: text("created_by_label").notNull(),
});

/* ==========================================================================
   AI quality (plan 7.5)
   ========================================================================== */

/** The evaluation runner's modes, as `scripts/eval-runner.ts` names them. */
export const EVALUATION_MODES = ["structural", "grounding", "live", "golden", "release"] as const;
export type EvaluationMode = (typeof EVALUATION_MODES)[number];

export const EVALUATION_RUN_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const;
export type EvaluationRunStatus = (typeof EVALUATION_RUN_STATUSES)[number];

/**
 * One evaluation run of one AI configuration.
 *
 * Serves AI quality's Run evaluation, coverage and Compare candidate and
 * released configuration (plan 7.5), and the rule that a configuration cannot
 * release while a mandatory evaluation fails (`mandatory_failed`). The
 * configuration's identifying values (prompt version, model profile, output
 * schema, suite) are recorded as they were when the run started, because the
 * question is what was evaluated, and the registry may have moved since.
 *
 * Grounded and live modes currently record cases as not run; the counts say
 * so rather than reading as passes.
 */
export const aiEvaluationRuns = sqliteTable(
  "ai_evaluation_runs",
  {
    id: text("id").primaryKey(),
    configurationId: text("configuration_id").notNull(),
    configurationStatus: text("configuration_status").$type<"released" | "candidate">().notNull(),
    roleId: text("role_id").notNull(),
    taskKind: text("task_kind").notNull(),
    promptVersion: text("prompt_version").notNull(),
    modelProfileId: text("model_profile_id").notNull(),
    outputSchemaVersion: text("output_schema_version").notNull(),
    evaluationSuiteId: text("evaluation_suite_id").notNull(),
    /** The Role App version the run was for, when it was part of a release. */
    roleAppVersionId: text("role_app_version_id"),
    mode: text("mode").$type<EvaluationMode>().notNull(),
    status: text("status").$type<EvaluationRunStatus>().notNull(),
    totalCases: integer("total_cases").notNull().default(0),
    passed: integer("passed").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    notRun: integer("not_run").notNull().default(0),
    /** Failed cases marked mandatory. A release is refused while this is above zero. */
    mandatoryFailed: integer("mandatory_failed").notNull().default(0),
    /** The durable job that ran it ("evaluation-run"), when it ran as one. */
    jobId: text("job_id"),
    /** Where the runner wrote its full result, for example "evals/results/latest.json". */
    resultsPath: text("results_path"),
    triggeredByLabel: text("triggered_by_label").notNull(),
    triggeredByUserId: text("triggered_by_user_id"),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    errorRedacted: text("error_redacted"),
  },
  (table) => [
    index("aer_config_idx").on(table.configurationId, table.startedAt),
    index("aer_role_task_idx").on(table.roleId, table.taskKind, table.startedAt),
  ],
);

/** One grader's verdict on one case, as the runner reports it. */
export interface EvaluationGraderResult {
  grader: string;
  passed: boolean;
  score: number;
  details: string;
}

/**
 * One case's result in one evaluation run.
 *
 * Serves Inspect failed case and Compare output (plan 7.5), and the failure
 * counts by kind (grounding, citation, required source, authority refusal,
 * German language), which are read from the graders that failed. `output` is
 * the graded output, redacted, kept so a candidate's answer can be put beside
 * the released configuration's answer to the same case.
 */
export const aiEvaluationCaseResults = sqliteTable(
  "ai_evaluation_case_results",
  {
    id: text("id").primaryKey(),
    evaluationRunId: text("evaluation_run_id").notNull(),
    caseId: text("case_id").notNull(),
    roleId: text("role_id").notNull(),
    taskKind: text("task_kind").notNull(),
    stageId: text("stage_id"),
    /** "en" | "de", the language the case asks for. */
    language: text("language"),
    mandatory: integer("mandatory", { mode: "boolean" }).notNull().default(false),
    status: text("status").$type<"passed" | "failed" | "not-run">().notNull(),
    graderResults: text("grader_results", { mode: "json" }).$type<EvaluationGraderResult[]>().notNull(),
    /** Why a case was not run, or the first failing grader's reason. */
    reason: text("reason").notNull().default(""),
    latencyMs: integer("latency_ms"),
    /** Illustrative cost of a live case. Null when no model was called. */
    costUsd: real("cost_usd"),
    outputDigest: text("output_digest"),
    output: text("output", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (table) => [
    uniqueIndex("aecr_case_unq").on(table.evaluationRunId, table.caseId),
    index("aecr_status_idx").on(table.evaluationRunId, table.status),
  ],
);

/**
 * A product owner's release decision on an AI configuration, and its rollback.
 *
 * Serves Approve candidate, Reject candidate and Roll back (plan 7.5). One row
 * per decision. An approval names the evaluation run it rests on and the
 * configuration it supersedes; a rollback is recorded on the approval it
 * reverses, with the configuration it restored. The configuration in force
 * for a role and task is the latest approval that is not rolled back, or the
 * code registry's released entry when no approval is recorded.
 */
export const aiConfigurationReleases = sqliteTable(
  "ai_configuration_releases",
  {
    id: text("id").primaryKey(),
    configurationId: text("configuration_id").notNull(),
    roleId: text("role_id").notNull(),
    taskKind: text("task_kind").notNull(),
    decision: text("decision").$type<"approved" | "rejected">().notNull(),
    evaluationRunId: text("evaluation_run_id"),
    supersedesConfigurationId: text("supersedes_configuration_id"),
    rationale: text("rationale").notNull(),
    decidedAt: text("decided_at").notNull(),
    decidedByLabel: text("decided_by_label").notNull(),
    decidedByUserId: text("decided_by_user_id"),
    approvalId: text("approval_id"),
    rolledBackAt: text("rolled_back_at"),
    rolledBackByLabel: text("rolled_back_by_label"),
    rollbackReason: text("rollback_reason"),
    restoredConfigurationId: text("restored_configuration_id"),
  },
  (table) => [index("acr_role_task_idx").on(table.roleId, table.taskKind, table.decidedAt)],
);

/* ==========================================================================
   Feedback and product discovery (plan 7.8)
   ========================================================================== */

/** The eight kinds of product feedback, in the plan's order. */
export const PRODUCT_FEEDBACK_KINDS = [
  "wrong-source",
  "missing-context",
  "incorrect-interpretation",
  "unhelpful-suggestion",
  "workflow-friction",
  "feature-request",
  "data-issue",
  "performance-issue",
] as const;
export type ProductFeedbackKind = (typeof PRODUCT_FEEDBACK_KINDS)[number];

export const PRODUCT_FEEDBACK_STATUSES = ["new", "triaged", "planned", "in-release", "closed", "declined"] as const;
export type ProductFeedbackStatus = (typeof PRODUCT_FEEDBACK_STATUSES)[number];

export const SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];

/**
 * One item in the product feedback inbox.
 *
 * Serves the console's feedback inbox: triage, severity, owner, and the links
 * to a feature, a Role App, a stage and the release that addresses it (plan
 * 7.8). Structured on purpose: "Do not rely on free-form chat transcripts as
 * product research". An item may come from a person directly or be forwarded
 * from AI feedback (`ai_feedback_id`).
 *
 * The context columns name scenario records by id (`context_run_id` says
 * which run they belong to). They are a pointer for the product owner, not a
 * copy of the work.
 */
export const productFeedback = sqliteTable(
  "product_feedback",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<ProductFeedbackKind>().notNull(),
    /** The person's statement, in their words. */
    summary: text("summary").notNull(),
    detail: text("detail").notNull().default(""),
    submittedByUserId: text("submitted_by_user_id"),
    submittedAt: text("submitted_at").notNull(),
    /* ---- where it was raised ---- */
    contextRunId: text("context_run_id"),
    roleId: text("role_id"),
    legalEntityId: text("legal_entity_id"),
    /** The workday route the person was on. */
    route: text("route"),
    subjectKind: text("subject_kind"),
    subjectId: text("subject_id"),
    processRunId: text("process_run_id"),
    aiFeedbackId: text("ai_feedback_id"),
    /* ---- triage ---- */
    status: text("status").$type<ProductFeedbackStatus>().notNull().default("new"),
    severity: text("severity").$type<Severity>(),
    ownerLabel: text("owner_label"),
    ownerUserId: text("owner_user_id"),
    triagedAt: text("triaged_at"),
    triagedByLabel: text("triaged_by_label"),
    resolution: text("resolution").notNull().default(""),
    closedAt: text("closed_at"),
    /* ---- links ---- */
    featureKey: text("feature_key"),
    roleAppId: text("role_app_id"),
    stageId: text("stage_id"),
    /** The product release version expected to address it, for example "4.2.0". */
    releaseVersion: text("release_version"),
  },
  (table) => [
    index("pfb_status_idx").on(table.status, table.submittedAt),
    index("pfb_app_stage_idx").on(table.roleAppId, table.stageId),
  ],
);

/* ==========================================================================
   Pilot management (plan 7.7)
   ========================================================================== */

export const PILOT_STATUSES = ["setup", "running", "paused", "closed"] as const;
export type PilotStatus = (typeof PILOT_STATUSES)[number];

/** The authority a pilot runs under. */
export interface PilotAuthority {
  /** An entitlement profile from `entitlement_profiles`. */
  entitlementProfileId: string | null;
  /** The highest autonomy level the pilot allows. */
  maxAutonomyLevel: AutonomyLevel;
  /** False means no action executes without a person's approval. */
  autonomousExecution: boolean;
  note: string;
}

export interface PilotSupportContact {
  label: string;
  role: string;
  channel: string;
}

/**
 * One design-partner pilot: its setup.
 *
 * Serves the console's Pilot view, Setup (plan 7.7): business area, legal
 * entities, users (through the cohort), roles, processes (Role Apps), source
 * systems (connector instances), authority, measures (`pilot_measures`) and
 * support contacts. Wave 4 exit criterion: a pilot cohort can be managed.
 */
export const pilotProgrammes = sqliteTable("pilot_programmes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameDe: text("name_de").notNull(),
  status: text("status").$type<PilotStatus>().notNull(),
  businessArea: text("business_area").notNull(),
  businessAreaDe: text("business_area_de").notNull(),
  legalEntityIds: text("legal_entity_ids", { mode: "json" }).$type<string[]>().notNull(),
  /** The cohort that holds the pilot's users. */
  cohortId: text("cohort_id"),
  roleIds: text("role_ids", { mode: "json" }).$type<RoleId[]>().notNull(),
  roleAppIds: text("role_app_ids", { mode: "json" }).$type<string[]>().notNull(),
  sourceSystemIds: text("source_system_ids", { mode: "json" }).$type<string[]>().notNull(),
  authority: text("authority", { mode: "json" }).$type<PilotAuthority>().notNull(),
  supportContacts: text("support_contacts", { mode: "json" }).$type<PilotSupportContact[]>().notNull(),
  /** Planned window. Null until agreed with the design partner. */
  plannedStartOn: text("planned_start_on"),
  plannedEndOn: text("planned_end_on"),
  startedAt: text("started_at"),
  closedAt: text("closed_at"),
  createdAt: text("created_at").notNull(),
  createdByLabel: text("created_by_label").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const PILOT_MEASURE_KINDS = ["efficiency", "control", "adoption", "quality", "value"] as const;
export type PilotMeasureKind = (typeof PILOT_MEASURE_KINDS)[number];

export const MEASURE_UNITS = ["minutes", "hours", "days", "count", "percent"] as const;
export type MeasureUnit = (typeof MEASURE_UNITS)[number];

/**
 * Whether a value exists. `not-measured` is the honest state of a baseline
 * nobody has taken yet, and it is never shown as zero.
 */
export const MEASUREMENT_STATUSES = ["not-measured", "measured", "unavailable"] as const;
export type MeasurementStatus = (typeof MEASUREMENT_STATUSES)[number];

/**
 * One measure a pilot tracks, with its baseline.
 *
 * Serves the pilot's Baseline (plan 7.7: preparation time, cycle time,
 * handoffs, systems opened, overdue actions, evidence completeness) and the
 * measures of the weekly view. The baseline is one value per measure, so it
 * lives on the measure: its value, period, method and who recorded it, or
 * `not-measured`. The target is the success criterion, null until the design
 * partner agrees one. No value is ever computed from synthetic data and shown
 * as a client result (plan 12: do not calculate a commercial outcome from
 * synthetic data).
 */
export const pilotMeasures = sqliteTable(
  "pilot_measures",
  {
    id: text("id").primaryKey(),
    pilotId: text("pilot_id").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    labelDe: text("label_de").notNull(),
    kind: text("kind").$type<PilotMeasureKind>().notNull(),
    unit: text("unit").$type<MeasureUnit>().notNull(),
    direction: text("direction").$type<"lower-is-better" | "higher-is-better">().notNull(),
    /** How the measure is taken, in plain words. */
    method: text("method").notNull(),
    methodDe: text("method_de").notNull(),
    /** Where readings come from, for example "os-events", "action-register", "recorded-by-pilot-lead". */
    source: text("source").notNull(),
    target: real("target"),
    baselineStatus: text("baseline_status").$type<MeasurementStatus>().notNull(),
    baselineValue: real("baseline_value"),
    baselinePeriod: text("baseline_period"),
    baselineRecordedAt: text("baseline_recorded_at"),
    baselineRecordedByLabel: text("baseline_recorded_by_label"),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [uniqueIndex("pm_key_unq").on(table.pilotId, table.key)],
);

/**
 * One week's reading of one pilot measure.
 *
 * Serves the pilot's Weekly view (plan 7.7: adoption, completion, quality,
 * value). A week with no reading has no row; a reading that could not be
 * taken is a row with `unavailable` and a note, never a zero.
 */
export const pilotMeasureReadings = sqliteTable(
  "pilot_measure_readings",
  {
    id: text("id").primaryKey(),
    pilotId: text("pilot_id").notNull(),
    measureId: text("measure_id").notNull(),
    /** ISO date of the Monday the week starts on. */
    weekStarting: text("week_starting").notNull(),
    status: text("status").$type<MeasurementStatus>().notNull(),
    value: real("value"),
    source: text("source").notNull(),
    note: text("note").notNull().default(""),
    recordedAt: text("recorded_at").notNull(),
    recordedByLabel: text("recorded_by_label").notNull(),
  },
  (table) => [uniqueIndex("pmr_week_unq").on(table.measureId, table.weekStarting)],
);

export const PILOT_ISSUE_KINDS = ["issue", "risk", "decision-required"] as const;
export type PilotIssueKind = (typeof PILOT_ISSUE_KINDS)[number];

/**
 * An issue, risk or decision the pilot has to carry.
 *
 * Serves the Weekly view's issues, risks and decisions required (plan 7.7)
 * and the exit decision's unresolved conditions. May link to the product
 * feedback, Role App or integration incident it concerns.
 */
export const pilotIssues = sqliteTable(
  "pilot_issues",
  {
    id: text("id").primaryKey(),
    pilotId: text("pilot_id").notNull(),
    kind: text("kind").$type<PilotIssueKind>().notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    severity: text("severity").$type<Severity>().notNull(),
    status: text("status").$type<"open" | "resolved" | "accepted" | "closed">().notNull(),
    ownerLabel: text("owner_label"),
    raisedAt: text("raised_at").notNull(),
    raisedByLabel: text("raised_by_label").notNull(),
    resolvedAt: text("resolved_at"),
    resolution: text("resolution").notNull().default(""),
    productFeedbackId: text("product_feedback_id"),
    roleAppId: text("role_app_id"),
    integrationIncidentId: text("integration_incident_id"),
  },
  (table) => [index("pi_pilot_idx").on(table.pilotId, table.status)],
);

export const PILOT_EXIT_OUTCOMES = ["scale", "extend", "pause", "stop"] as const;
export type PilotExitOutcome = (typeof PILOT_EXIT_OUTCOMES)[number];

/** A piece of evidence the exit decision rests on. */
export interface PilotEvidenceRef {
  /** For example "measure-reading", "evidence-pack", "product-feedback", "release-gate-run". */
  kind: string;
  ref: string;
  label: string;
}

/**
 * A pilot's exit decision: Scale, Extend pilot, Pause or Stop.
 *
 * Serves the pilot's Exit decision (plan 7.7) and the Wave 5 exit criterion
 * that a go or stop decision can be supported: the evidence, the unresolved
 * conditions, the control findings, the commercial implication as the person
 * states it, and the next-wave recommendation. A person decides it; the row
 * records who, when and why. A pilot may have more than one over its life
 * (Extend, then Scale), read in order.
 */
export const pilotExitDecisions = sqliteTable(
  "pilot_exit_decisions",
  {
    id: text("id").primaryKey(),
    pilotId: text("pilot_id").notNull(),
    outcome: text("outcome").$type<PilotExitOutcome>().notNull(),
    evidence: text("evidence", { mode: "json" }).$type<PilotEvidenceRef[]>().notNull(),
    unresolvedConditions: text("unresolved_conditions", { mode: "json" }).$type<string[]>().notNull(),
    controlFindings: text("control_findings", { mode: "json" }).$type<string[]>().notNull(),
    commercialImplication: text("commercial_implication").notNull().default(""),
    nextWaveRecommendation: text("next_wave_recommendation").notNull().default(""),
    rationale: text("rationale").notNull(),
    decidedAt: text("decided_at").notNull(),
    decidedByLabel: text("decided_by_label").notNull(),
    decidedByUserId: text("decided_by_user_id"),
    approvalId: text("approval_id"),
  },
  (table) => [index("ped_pilot_idx").on(table.pilotId, table.decidedAt)],
);

/* ==========================================================================
   Release management (plan 7.9)
   ========================================================================== */

export const RELEASE_EVENT_KINDS = [
  "candidate-declared",
  "gate-run-recorded",
  "evidence-pack-generated",
  "pilot-release-approved",
  "deployed",
  "rollout-updated",
  "rolled-back",
] as const;
export type ReleaseEventKind = (typeof RELEASE_EVENT_KINDS)[number];

export const ROLLOUT_STATUSES = ["not-started", "pilot", "partial", "complete", "rolled-back"] as const;
export type RolloutStatus = (typeof ROLLOUT_STATUSES)[number];

/**
 * What happened to a product release. Append only.
 *
 * Serves the console's Releases view (plan 7.9): current release, candidate
 * release, evidence pack, rollout status and the rollback plan. The release's
 * identity (version, name, stage, limitations) is the code registry,
 * `PRODUCT_RELEASE` in `src/product/release/`; rows here carry only its
 * version and what happened to it. The current release is the latest
 * `deployed` version not followed by a `rolled-back`; a candidate is a
 * declared version that is not deployed.
 */
export const productReleaseEvents = sqliteTable(
  "product_release_events",
  {
    id: text("id").primaryKey(),
    releaseVersion: text("release_version").notNull(),
    kind: text("kind").$type<ReleaseEventKind>().notNull(),
    rolloutStatus: text("rollout_status").$type<RolloutStatus>(),
    gateRunId: text("gate_run_id"),
    /** A path or reference to the evidence pack, for example "release/pilot-evidence.json". */
    evidencePackRef: text("evidence_pack_ref"),
    evidencePackDigest: text("evidence_pack_digest"),
    /** The rollback plan as stated when the candidate was declared or approved. */
    rollbackPlan: text("rollback_plan"),
    rollbackToVersion: text("rollback_to_version"),
    note: text("note").notNull().default(""),
    at: text("at").notNull(),
    actorLabel: text("actor_label").notNull(),
    actorUserId: text("actor_user_id"),
    approvalId: text("approval_id"),
  },
  (table) => [index("pre_version_idx").on(table.releaseVersion, table.at)],
);

/** One gate's verdict in a release gate run. */
export interface ReleaseGateResult {
  /** For example "typecheck", "unit-tests", "integration-tests", "check-copy", "scan-secrets", "eval-structural", "migration". */
  gateKey: string;
  label: string;
  mandatory: boolean;
  status: "passed" | "failed" | "not-run" | "skipped";
  detail: string;
  evidenceRef: string | null;
  durationMs: number | null;
}

/**
 * One run of the release gate for one product release.
 *
 * Serves Run release gate and "Do not allow release while mandatory gates
 * fail" (plan 7.9; Wave 4 exit criterion: the release gate is visible). The
 * gate results are a short fixed list per run, so they are held on the run.
 */
export const releaseGateRuns = sqliteTable(
  "release_gate_runs",
  {
    id: text("id").primaryKey(),
    releaseVersion: text("release_version").notNull(),
    status: text("status").$type<"running" | "passed" | "failed" | "error">().notNull(),
    results: text("results", { mode: "json" }).$type<ReleaseGateResult[]>().notNull(),
    mandatoryTotal: integer("mandatory_total").notNull().default(0),
    mandatoryFailed: integer("mandatory_failed").notNull().default(0),
    summary: text("summary").notNull().default(""),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    triggeredByLabel: text("triggered_by_label").notNull(),
  },
  (table) => [index("rgr_version_idx").on(table.releaseVersion, table.startedAt)],
);

/* ==========================================================================
   Integration operations (plan 7.6 and the operations gap in 6.2)
   ========================================================================== */

/**
 * A period in which a connector failed the work that depends on it.
 *
 * Serves the console's Integrations and Operations views. Connector health
 * (`connector_instances.health_state`) says what a connector is now; a dead
 * letter (`dead_letter_entries`) says one command failed. Neither says that
 * an outage began, which roles, processes and how many people it affected,
 * what work failed, how it recovered and which release decision it bears on:
 * the gap plan section 6.2 names ("Operations is technical but isolated").
 * Affected people are a count, never a list of names.
 */
export const integrationIncidents = sqliteTable(
  "integration_incidents",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    connectorInstanceId: text("connector_instance_id").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    severity: text("severity").$type<Severity>().notNull(),
    status: text("status").$type<"open" | "monitoring" | "resolved">().notNull(),
    affectedRoleIds: text("affected_role_ids", { mode: "json" }).$type<RoleId[]>().notNull(),
    affectedProcessRunIds: text("affected_process_run_ids", { mode: "json" }).$type<string[]>().notNull(),
    affectedUserCount: integer("affected_user_count"),
    failedCommandIds: text("failed_command_ids", { mode: "json" }).$type<string[]>().notNull(),
    deadLetterIds: text("dead_letter_ids", { mode: "json" }).$type<string[]>().notNull(),
    recoveryNote: text("recovery_note").notNull().default(""),
    /** The release the incident bears on, when it bears on one. */
    releaseVersion: text("release_version"),
    openedAt: text("opened_at").notNull(),
    openedAtMoment: text("opened_at_moment").notNull(),
    openedByLabel: text("opened_by_label").notNull(),
    resolvedAt: text("resolved_at"),
    resolvedByLabel: text("resolved_by_label"),
  },
  (table) => [index("ii_run_status_idx").on(table.runId, table.status, table.openedAt)],
);

export const DATA_QUALITY_ISSUE_KINDS = ["mapping", "conflict", "stale-source", "missing-value", "rejected-event"] as const;
export type DataQualityIssueKind = (typeof DATA_QUALITY_ISSUE_KINDS)[number];

/**
 * A data quality issue in what a connector delivered, and its resolution.
 *
 * Serves Mapping issues and Resolve mapping (plan 7.6) and the data-quality
 * issue workflow (plan 11). Detection already has a home: a rejected
 * integration event carries its reason, a conflicted external reference its
 * note. What had none is the issue's life: who reviewed it, how it was
 * resolved or accepted, and the mapping change that fixed it
 * (`product_config_change_id`).
 */
export const dataQualityIssues = sqliteTable(
  "data_quality_issues",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    kind: text("kind").$type<DataQualityIssueKind>().notNull(),
    connectorInstanceId: text("connector_instance_id").notNull(),
    sourceMappingId: text("source_mapping_id"),
    externalReferenceId: text("external_reference_id"),
    integrationEventId: text("integration_event_id"),
    canonicalType: text("canonical_type"),
    canonicalId: text("canonical_id"),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    severity: text("severity").$type<Severity>().notNull(),
    status: text("status").$type<"open" | "in-review" | "resolved" | "accepted">().notNull(),
    detectedAt: text("detected_at").notNull(),
    detectedAtMoment: text("detected_at_moment").notNull(),
    detectedBy: text("detected_by").$type<"connector" | "system" | "person">().notNull(),
    resolvedAt: text("resolved_at"),
    resolvedByLabel: text("resolved_by_label"),
    resolution: text("resolution").notNull().default(""),
    productConfigChangeId: text("product_config_change_id"),
  },
  (table) => [
    index("dqi_run_status_idx").on(table.runId, table.status, table.detectedAt),
    index("dqi_connector_idx").on(table.connectorInstanceId),
  ],
);

/* ==========================================================================
   Experience analytics (plan 7.4)
   ========================================================================== */

/**
 * The interactions the backbone does not record.
 *
 * Plan 7.4's other measures are already backbone events and are read from
 * `os_events`: minutes confirmed (`meeting-completed`), message converted to
 * work (`inbox_messages.converted_at` and its `work-arrived` or
 * `action-updated` event), action completed (`action-updated`), decision
 * completed (`decision-recorded`) and process stage completed
 * (`stage-completed`). These four are what is left:
 *
 *   workday-opened                 the start that time to first meaningful action is measured from
 *   now-item-opened                the Now item was opened
 *   evidence-opened                an evidence document was opened
 *   meeting-preparation-reviewed   a meeting's preparation was reviewed before the meeting
 */
export const EXPERIENCE_EVENT_KINDS = [
  "workday-opened",
  "now-item-opened",
  "evidence-opened",
  "meeting-preparation-reviewed",
] as const;
export type ExperienceEventKind = (typeof EXPERIENCE_EVENT_KINDS)[number];

/**
 * One interaction, for aggregate experience analytics.
 *
 * Serves the console's Experience view (plan 7.4) and its filters: role,
 * legal entity, process, cohort, week (from `occurred_at`) and mode. There is
 * deliberately no user id: the cohort is resolved when the event is written
 * and the person is not stored, so no query can rank or score an employee.
 * No keystrokes, no dwell times, no content: one row per meaningful
 * interaction, deduplicated by `idempotency_key` so a double render records
 * one event.
 */
export const experienceEvents = sqliteTable(
  "experience_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    kind: text("kind").$type<ExperienceEventKind>().notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    legalEntityId: text("legal_entity_id"),
    /** The Role App process id, for the Process filter. */
    processId: text("process_id"),
    processRunId: text("process_run_id"),
    stageId: text("stage_id"),
    cohortId: text("cohort_id"),
    mode: text("mode").$type<"live" | "safe" | "offline">().notNull(),
    /** The work object the interaction was with: the Now item, the document, the meeting. */
    subjectKind: text("subject_kind"),
    subjectId: text("subject_id"),
    atMoment: text("at_moment").notNull(),
    occurredAt: text("occurred_at").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
  },
  (table) => [
    uniqueIndex("xev_idempotency_unq").on(table.runId, table.idempotencyKey),
    index("xev_kind_idx").on(table.runId, table.kind, table.occurredAt),
    index("xev_role_idx").on(table.runId, table.roleId, table.occurredAt),
  ],
);
