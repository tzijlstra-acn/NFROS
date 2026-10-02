/**
 * Role-app runtime schema.
 *
 * Persists the execution state of structured process apps (RCSA Cycle
 * Assistant, Third-Party Onboarding) so the process pages read live state from
 * the database rather than static in-memory constants.
 *
 * Every table carries `runId` following the project-wide convention. Rows
 * belong to the active scenario run and are cleared by `demo:reset`.
 *
 * Identifier conventions match the core schema: stable kebab-case or
 * uppercase slugs for content identifiers.
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/* ---------------------------------------------------------------------------
   Role-app runs
   --------------------------------------------------------------------------- */

/**
 * One live instance of a role-app process for a named subject.
 *
 * A run is the top-level container the process page renders. The home page
 * Now item links to the run's current stage when an in-progress run exists.
 */
export const roleAppRuns = sqliteTable(
  "role_app_runs",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    roleAppId: text("role_app_id").notNull(),
    /** "rcsa" | "tprm" */
    roleId: text("role_id").notNull(),
    /** "assessment" | "supplier" */
    subjectKind: text("subject_kind").notNull(),
    subjectId: text("subject_id").notNull(),
    currentStageId: text("current_stage_id").notNull(),
    /** "not-started" | "in-progress" | "ai-preparing" | "waiting-for-input" | "waiting-for-decision" | "completed" | "blocked" */
    status: text("status").notNull(),
    /** "live" | "safe" | "offline" */
    mode: text("mode").notNull().default("offline"),
    startedAt: text("started_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
    blockedReason: text("blocked_reason"),
  },
  (table) => [index("role_app_runs_run_idx").on(table.runId, table.roleId)],
);

/* ---------------------------------------------------------------------------
   Stage runs
   --------------------------------------------------------------------------- */

/**
 * Stage-level state for each role-app run.
 *
 * One row per stage that has been entered. Stages that have not yet been
 * reached have no row; their status is inferred as "locked".
 */
export const roleAppStageRuns = sqliteTable(
  "role_app_stage_runs",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    roleAppRunId: text("role_app_run_id").notNull(),
    stageId: text("stage_id").notNull(),
    /** "locked" | "ready" | "ai-preparing" | "ready-for-review" | "waiting-for-input" | "waiting-for-decision" | "completed" | "blocked" */
    status: text("status").notNull(),
    openedAt: text("opened_at"),
    completedAt: text("completed_at"),
    completedByUserId: text("completed_by_user_id"),
    aiOutputId: text("ai_output_id"),
  },
  (table) => [index("role_app_stage_runs_run_idx").on(table.runId, table.roleAppRunId)],
);

/* ---------------------------------------------------------------------------
   Stage tasks
   --------------------------------------------------------------------------- */

/**
 * Tasks within a stage: the individual work items the AI or the human must
 * complete before the stage can be marked done.
 */
export const roleAppStageTasks = sqliteTable(
  "role_app_stage_tasks",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    stageRunId: text("stage_run_id").notNull(),
    /** "ai-job" | "human-input" | "human-review" | "human-decision" | "approval" | "tool-execution" | "source-wait" */
    taskKind: text("task_kind").notNull(),
    label: text("label").notNull(),
    /** "pending" | "in-progress" | "completed" | "skipped" */
    status: text("status").notNull(),
    requiredForCompletion: integer("required_for_completion", { mode: "boolean" }).notNull().default(true),
    completedAt: text("completed_at"),
    /** JSON string holding the task output. */
    output: text("output"),
  },
  (table) => [index("role_app_stage_tasks_run_idx").on(table.runId, table.stageRunId)],
);

/* ---------------------------------------------------------------------------
   Artifacts
   --------------------------------------------------------------------------- */

/** Artifacts produced by stages: evidence packs, preparation documents, etc. */
export const roleAppArtifacts = sqliteTable(
  "role_app_artifacts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    roleAppRunId: text("role_app_run_id").notNull(),
    stageId: text("stage_id").notNull(),
    /** "evidence-pack" | "meeting-preparation" | "minutes-draft" | etc. */
    artifactKind: text("artifact_kind").notNull(),
    label: text("label").notNull(),
    /** JSON string or plain text content. */
    content: text("content"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("role_app_artifacts_run_idx").on(table.runId, table.roleAppRunId)],
);

/* ---------------------------------------------------------------------------
   Process events (audit trail)
   --------------------------------------------------------------------------- */

/**
 * Append-only event log for role-app runs.
 *
 * Every state transition writes exactly one row. The process page and the
 * audit view read this table to reconstruct what happened and when.
 */
export const roleAppEvents = sqliteTable(
  "role_app_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    roleAppRunId: text("role_app_run_id").notNull(),
    stageId: text("stage_id"),
    /** "run-started" | "stage-entered" | "stage-completed" | "ai-prepared" | "human-decided" | "tool-executed" | "run-completed" | "run-blocked" */
    eventKind: text("event_kind").notNull(),
    /** "ai" | "human" | "system" */
    actorKind: text("actor_kind").notNull(),
    actorId: text("actor_id"),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
    at: text("at").notNull(),
  },
  (table) => [index("role_app_events_run_idx").on(table.runId, table.roleAppRunId)],
);

/* ---------------------------------------------------------------------------
   AI routines
   --------------------------------------------------------------------------- */

/**
 * Scheduled and event-driven AI routines that run on behalf of a role.
 *
 * A routine is not a one-off job: it recurs according to its trigger
 * configuration and produces a new output each time it fires.
 */
export const aiRoutines = sqliteTable(
  "ai_routines",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    roleId: text("role_id").notNull(),
    name: text("name").notNull(),
    /** "schedule" | "event" | "before-meeting" | "after-meeting" */
    triggerType: text("trigger_type").notNull(),
    triggerConfig: text("trigger_config", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    /** "active" | "paused" | "blocked" | "completed" */
    status: text("status").notNull(),
    authorityClass: text("authority_class").notNull(),
    outputKind: text("output_kind").notNull(),
    lastRunAt: text("last_run_at"),
    nextRunAt: text("next_run_at"),
  },
  (table) => [index("ai_routines_run_role_idx").on(table.runId, table.roleId)],
);

/* ---------------------------------------------------------------------------
   Meeting minutes
   --------------------------------------------------------------------------- */

/**
 * Structured meeting minutes produced by the AI after a concluded meeting.
 *
 * Linked to the meetings table by `meetingId`. A meeting row exists before
 * minutes are drafted; the minutes row records the outcome once the AI has
 * processed the transcript or the scripted anchor turns.
 */
export const meetingMinutes = sqliteTable(
  "meeting_minutes",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    meetingId: text("meeting_id").notNull(),
    roleId: text("role_id").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    factItems: text("fact_items", { mode: "json" }).$type<string[]>().notNull(),
    decisionIds: text("decision_ids", { mode: "json" }).$type<string[]>().notNull(),
    actionIds: text("action_ids", { mode: "json" }).$type<string[]>().notNull(),
    unresolvedItems: text("unresolved_items", { mode: "json" }).$type<string[]>().notNull(),
    evidenceIds: text("evidence_ids", { mode: "json" }).$type<string[]>().notNull(),
    participantUserIds: text("participant_user_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** "draft" | "awaiting-confirmation" | "confirmed" | "distributed" */
    status: text("status").notNull(),
    /** "ai" | "human" */
    preparedBy: text("prepared_by").notNull(),
    confirmedByUserId: text("confirmed_by_user_id"),
    confirmedAt: text("confirmed_at"),
    distributedAt: text("distributed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("meeting_minutes_run_idx").on(table.runId, table.meetingId)],
);

/* ---------------------------------------------------------------------------
   Action updates
   --------------------------------------------------------------------------- */

/**
 * Append-only progress notes on actions.
 *
 * Corresponds to the `actions` table via `actionId`. Each note records who
 * wrote it, what the action status was at that point, and any evidence cited.
 */
export const actionUpdates = sqliteTable(
  "action_updates",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    actionId: text("action_id").notNull(),
    at: text("at").notNull(),
    authorUserId: text("author_user_id"),
    /** "human" | "ai" | "system" */
    authorKind: text("author_kind").notNull(),
    note: text("note").notNull(),
    evidenceIds: text("evidence_ids", { mode: "json" }).$type<string[]>().notNull(),
    statusAfter: text("status_after").notNull(),
  },
  (table) => [index("action_updates_run_idx").on(table.runId, table.actionId)],
);
