/**
 * Core schema: the institution, the people, the scenario run container, the
 * shared timeline, and the audit log.
 *
 * Identifier convention, applied across the whole schema:
 *   <type-prefix>-<sequence or slug>   for example SUP-001, CTL-PAY-004, DEC-012
 * Identifiers are stable and are reused across every view, so the same control
 * genuinely is the same row in RCSA and in Control Assurance.
 *
 * Every content row carries `runId`. The seeded baseline is written into a run,
 * and `demo:reset` deletes and rewrites that run. This makes the guarantee
 * "reset restores the entire original day" structurally true rather than a
 * best effort cleanup.
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/** The single active scenario run created by the seed. */
export const DEFAULT_RUN_ID = "run-001";

/** Role identifiers. These match the workday route segments. */
export const ROLE_IDS = [
  "tprm",
  "rcsa",
  "control-assurance",
  "incident-resilience",
  "regulatory-change",
  "nfr-governance",
] as const;

export type RoleId = (typeof ROLE_IDS)[number];

/** Autonomy levels, ordered from least to most permissive. */
export const AUTONOMY_LEVELS = [
  "assist",
  "prepare",
  "recommend",
  "act-with-approval",
  "act-within-policy",
] as const;

export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

/**
 * Provenance classification. Verified fact, approved record, stakeholder
 * statement and model inference are never merged into one unlabelled field.
 */
export const PROVENANCE_KINDS = [
  "verified-fact",
  "approved-record",
  "stakeholder-statement",
  "model-inference",
  "conflicting-evidence",
  "telemetry",
] as const;

export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export const legalEntities = sqliteTable("legal_entities", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  /** "eu" or "ch". Drives which regulatory context may be referenced. */
  regulatoryBloc: text("regulatory_bloc").notNull(),
  currency: text("currency").notNull(),
  locations: text("locations", { mode: "json" }).$type<string[]>().notNull(),
  employeeCount: integer("employee_count").notNull(),
  supervisoryContext: text("supervisory_context").notNull(),
  notes: text("notes").notNull().default(""),
});

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    name: text("name").notNull(),
    jobTitle: text("job_title").notNull(),
    entityId: text("entity_id").notNull(),
    /** Set for the six NFR professionals; null for first line and externals. */
    roleId: text("role_id").$type<RoleId>(),
    /** "1lod", "2lod", "3lod", "external" or "management". */
    line: text("line").notNull(),
    department: text("department").notNull(),
    email: text("email").notNull(),
    /** Short practitioner description used in meeting simulations. */
    persona: text("persona").notNull().default(""),
  },
  (table) => [index("users_run_role_idx").on(table.runId, table.roleId)],
);

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey().$type<RoleId>(),
  runId: text("run_id").notNull(),
  title: text("title").notNull(),
  titleDe: text("title_de").notNull(),
  mandate: text("mandate").notNull(),
  /** The role's hero visualisation identifier. */
  heroVisual: text("hero_visual").notNull(),
  heroVisualLabel: text("hero_visual_label").notNull(),
  /** Which user holds this role in the scenario. */
  holderUserId: text("holder_user_id").notNull(),
  entityId: text("entity_id").notNull(),
  /** Ordered list of the decisions that must remain human owned. */
  humanOwnedDecisions: text("human_owned_decisions", { mode: "json" }).$type<string[]>().notNull(),
  primaryObjects: text("primary_objects", { mode: "json" }).$type<string[]>().notNull(),
  /** The specialist agent this role delegates to. */
  specialistAgent: text("specialist_agent").notNull(),
  sortOrder: integer("sort_order").notNull(),
  /** True for the four deeply interactive roles. */
  deeplyInteractive: integer("deeply_interactive", { mode: "boolean" }).notNull(),
});

export const scenarioRuns = sqliteTable("scenario_runs", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  /** The scenario date, stored ISO and displayed DD.MM.YYYY. */
  scenarioDate: text("scenario_date").notNull(),
  createdAt: text("created_at").notNull(),
  /** Current position on the shared timeline, for example "10:30". */
  currentMoment: text("current_moment").notNull(),
  activeRoleId: text("active_role_id").$type<RoleId>().notNull(),
  autonomyLevel: text("autonomy_level").$type<AutonomyLevel>().notNull(),
  /** "today" or "future". Drives the transformation toggle. */
  worldView: text("world_view").notNull(),
  language: text("language").notNull(),
  /** True once the 14:05 event has been reached on the timeline. */
  eventTriggered: integer("event_triggered", { mode: "boolean" }).notNull(),
  seededAt: text("seeded_at").notNull(),
});

/**
 * The shared workday timeline. Every role sees the same ten moments; the work
 * object and interactions differ per role.
 */
export const timelineEvents = sqliteTable(
  "timeline_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    /** "07:45" style label, 24 hour. */
    moment: text("moment").notNull(),
    sortOrder: integer("sort_order").notNull(),
    title: text("title").notNull(),
    titleDe: text("title_de").notNull(),
    /** Which of the five work lanes dominates this moment. */
    dominantLane: text("dominant_lane").notNull(),
    /** True for 14:05, the shared cross functional event. */
    isSharedEvent: integer("is_shared_event", { mode: "boolean" }).notNull(),
    description: text("description").notNull(),
  },
  (table) => [index("timeline_run_sort_idx").on(table.runId, table.sortOrder)],
);

/**
 * Per role, per moment detail: what today looks like, what the AI already did,
 * and what the human is asked to decide.
 */
export const timelineRoleMoments = sqliteTable(
  "timeline_role_moments",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    timelineEventId: text("timeline_event_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    /** The work object rendered in the centre workspace at this moment. */
    workObjectKind: text("work_object_kind").notNull(),
    workObjectId: text("work_object_id"),
    headline: text("headline").notNull(),
    /** The manual reality: systems opened, spreadsheets, rework, waiting. */
    todayNarrative: text("today_narrative").notNull(),
    todaySignals: text("today_signals", { mode: "json" }).$type<string[]>().notNull(),
    /** What the AI completed before the professional arrived. */
    futureNarrative: text("future_narrative").notNull(),
    futureSignals: text("future_signals", { mode: "json" }).$type<string[]>().notNull(),
    /** Evidence document identifiers surfaced at this moment. */
    evidenceIds: text("evidence_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** Open decision identifiers presented at this moment. */
    decisionIds: text("decision_ids", { mode: "json" }).$type<string[]>().notNull(),
    uncertaintyNote: text("uncertainty_note").notNull().default(""),
  },
  (table) => [
    index("trm_run_role_idx").on(table.runId, table.roleId),
    index("trm_event_idx").on(table.timelineEventId),
  ],
);

/**
 * The audit log. Every mutation writes exactly one row here, through the audit
 * service. Rows are append only; nothing in the application updates or deletes
 * an audit event.
 */
export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    /** Scenario clock time, for example "11:47". */
    atMoment: text("at_moment").notNull(),
    /** Wall clock time the event was recorded. */
    recordedAt: text("recorded_at").notNull(),
    /** "decision", "mutation", "approval", "blocked", "tool-call", "system". */
    category: text("category").notNull(),
    action: text("action").notNull(),
    /** The object type and identifier the event concerns. */
    objectKind: text("object_kind").notNull(),
    objectId: text("object_id").notNull(),
    actorUserId: text("actor_user_id"),
    actorKind: text("actor_kind").notNull(),
    roleId: text("role_id").$type<RoleId>(),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    /** Authority classification of the tool that produced this event. */
    authorityClass: text("authority_class"),
    decisionId: text("decision_id"),
    approvalId: text("approval_id"),
    /** True when the authority gate refused the action. */
    blocked: integer("blocked", { mode: "boolean" }).notNull().default(false),
    blockedReason: text("blocked_reason"),
    /** Whether the underlying change can be reversed in this prototype. */
    reversible: integer("reversible", { mode: "boolean" }).notNull().default(false),
    detail: text("detail", { mode: "json" }).$type<Record<string, unknown>>(),
    /** True for the twenty pre existing audit events created by the seed. */
    preExisting: integer("pre_existing", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    index("audit_run_idx").on(table.runId, table.recordedAt),
    index("audit_object_idx").on(table.objectKind, table.objectId),
    index("audit_role_idx").on(table.runId, table.roleId),
  ],
);
