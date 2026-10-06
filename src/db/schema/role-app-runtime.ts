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

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

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
 * reached have no row; their status is inferred as "locked". The unique index
 * on run and stage is what makes opening a stage idempotent: a second open of
 * the same stage finds the row instead of creating a twin.
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
    /** The artifact holding the validated AI preparation, once it exists. */
    aiOutputId: text("ai_output_id"),
    /** The durable background job that prepares this stage. */
    preparationJobId: text("preparation_job_id"),
    /** The payload bound approval that authorised the completion. */
    completionApprovalId: text("completion_approval_id"),
    /** The rationale the person confirmed as their own when completing. */
    completionRationale: text("completion_rationale"),
  },
  (table) => [
    index("role_app_stage_runs_run_idx").on(table.runId, table.roleAppRunId),
    uniqueIndex("role_app_stage_runs_stage_unq").on(table.roleAppRunId, table.stageId),
  ],
);

/* ---------------------------------------------------------------------------
   Stage tasks
   --------------------------------------------------------------------------- */

/**
 * Tasks within a stage: the individual work items the AI or the human must
 * complete before the stage can be marked done.
 *
 * One row per contract item (AI job, human task, decision, governed tool,
 * completion approval), keyed by `taskKey`. The unique index on stage run and
 * task key makes every task write idempotent: creating a task twice, or
 * recording the same human input twice, finds the existing row.
 */
export const roleAppStageTasks = sqliteTable(
  "role_app_stage_tasks",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    stageRunId: text("stage_run_id").notNull(),
    /** The contract key of the item this task tracks, for example "evidence-dispositions". */
    taskKey: text("task_key").notNull().default(""),
    /** "ai-job" | "human-input" | "human-review" | "human-decision" | "approval" | "tool-execution" | "source-wait" */
    taskKind: text("task_kind").notNull(),
    label: text("label").notNull(),
    /** "pending" | "in-progress" | "completed" | "skipped" | "failed" */
    status: text("status").notNull(),
    requiredForCompletion: integer("required_for_completion", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at"),
    completedAt: text("completed_at"),
    completedByUserId: text("completed_by_user_id"),
    /** The approval that authorised the task's change, for tool and approval tasks. */
    approvalId: text("approval_id"),
    /** Plain language reason for the current status, shown beside the task. */
    statusReason: text("status_reason"),
    /** JSON string holding the task output. */
    output: text("output"),
  },
  (table) => [
    index("role_app_stage_tasks_run_idx").on(table.runId, table.stageRunId),
    uniqueIndex("role_app_stage_tasks_key_unq").on(table.stageRunId, table.taskKey),
  ],
);

/* ---------------------------------------------------------------------------
   Artifacts
   --------------------------------------------------------------------------- */

/**
 * Artifacts produced by stages: evidence packs, preparation documents, stage
 * records.
 *
 * Versioned by `artifactKey`: a stage that writes the same artifact again
 * writes version two rather than overwriting version one, and the digest lets
 * a completion approval bind to the exact content it covered.
 */
export const roleAppArtifacts = sqliteTable(
  "role_app_artifacts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    roleAppRunId: text("role_app_run_id").notNull(),
    stageId: text("stage_id").notNull(),
    stageRunId: text("stage_run_id"),
    /** The contract key of the artifact spec, for example "evidence-pack". */
    artifactKey: text("artifact_key").notNull().default(""),
    /** "evidence-pack" | "meeting-preparation" | "minutes-draft" | etc. */
    artifactKind: text("artifact_kind").notNull(),
    label: text("label").notNull(),
    /** JSON string or plain text content. */
    content: text("content"),
    version: integer("version").notNull().default(1),
    /** sha256 over the content, truncated. Bound into completion approvals. */
    contentDigest: text("content_digest"),
    /** "ai-preparation" | "stage-completion" | "human" */
    producedBy: text("produced_by"),
    /** The AI mode that produced it: "live" | "safe" | "offline". Null for human work. */
    mode: text("mode"),
    createdByUserId: text("created_by_user_id"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("role_app_artifacts_run_idx").on(table.runId, table.roleAppRunId),
    index("role_app_artifacts_key_idx").on(table.roleAppRunId, table.stageId, table.artifactKey),
  ],
);

/*
 * Process events used to live in `role_app_events`. They are now ordinary
 * events on the OS event backbone, `os_events` in `./os-events.ts`, with a
 * `process_run_id`. Keeping a second, process-only account of the same events
 * is exactly what plan section 8.1 rules out.
 */

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
 * Meeting minutes: a draft while it is being written, a record once a person
 * confirms it.
 *
 * Linked to the meetings table by `meetingId`. The working draft is the
 * structured `draft` document (facts, decisions, actions with owners and due
 * dates, unresolved questions, evidence references and the distribution
 * list), which the person edits and the meetings module validates on every
 * write. Each write raises `version` and recomputes `contentDigest`, and the
 * confirmation approval binds to both, so a draft edited after it was
 * approved cannot be confirmed under that approval.
 *
 * On confirmation the flat record columns (`factItems`, `decisionIds`,
 * `actionIds`, `unresolvedItems`, `evidenceIds`) are written from the draft,
 * the minutes become the evidence document named in `evidenceDocumentId`, and
 * the actions they create carry `source_minutes_id` back to this row.
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
    /**
     * The structured working draft. Validated by the meetings module's
     * minutes schema on every read and write; null for a record that was
     * confirmed before drafts were structured.
     */
    draft: text("draft", { mode: "json" }).$type<Record<string, unknown>>(),
    /** Raised by every write to the draft. The confirmation approval binds to it. */
    version: integer("version").notNull().default(1),
    /** sha256 over the draft, truncated. Bound into the confirmation approval. */
    contentDigest: text("content_digest"),
    /** How the AI part of the draft was prepared: "safe" | "offline" | "live". Null when only a person wrote it. */
    preparedMode: text("prepared_mode"),
    editedByUserId: text("edited_by_user_id"),
    editedAt: text("edited_at"),
    /** The evidence document the confirmed minutes became. */
    evidenceDocumentId: text("evidence_document_id"),
    /** Who the confirmed minutes go to. Confirmed by the person with the minutes. */
    distributionUserIds: text("distribution_user_ids", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** The simulated collaboration message the distribution was recorded as. */
    distributionMessageId: text("distribution_message_id"),
    /** The payload bound approval that authorised the confirmation. */
    confirmationApprovalId: text("confirmation_approval_id"),
  },
  (table) => [index("meeting_minutes_run_idx").on(table.runId, table.meetingId)],
);

/* ---------------------------------------------------------------------------
   Action updates
   --------------------------------------------------------------------------- */

/**
 * The kinds of entry an action's history holds.
 *
 *   UPD update        CC  completion condition agreed   BLK blocked
 *   UNB unblocked     ASN accountability transferred    DUE due date moved
 *   CMP completed     REO reopened                      ESC escalated
 *   RMD reminder sent REQ evidence requested            MTG meeting record
 *   CRT created       (raised from confirmed minutes or another source)
 *
 * The kind used to be carried only in the identifier prefix (`AUP-CMP-...`).
 * Migration 0005 copied it into `kind`; the identifier keeps its prefix, so
 * an entry still reads the same in an export.
 */
export const ACTION_UPDATE_KINDS = [
  "UPD", "CC", "BLK", "UNB", "ASN", "DUE", "CMP", "REO", "ESC", "RMD", "REQ", "MTG", "CRT",
] as const;
export type ActionUpdateKind = (typeof ACTION_UPDATE_KINDS)[number];

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
    /** The kind of entry. See `ACTION_UPDATE_KINDS`. */
    kind: text("kind").$type<ActionUpdateKind>().notNull().default("UPD"),
  },
  (table) => [index("action_updates_run_idx").on(table.runId, table.actionId)],
);
