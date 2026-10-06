/**
 * The OS event backbone.
 *
 * One append-only table that answers "what happened in this working day" for
 * every surface that needs to know: Home, Work, Processes, the AI Partner,
 * Activity, Audit and product analytics. Plan section 8.1 names the event
 * types and the rule that matters most: do not create separate accounts of
 * the same event.
 *
 * What that rule means here, concretely:
 *
 *   - Each event is written once, keyed by `idempotency_key`. Publishing the
 *     same event twice finds the existing row and writes nothing, so a retried
 *     server action or a duplicate submission cannot produce a second account.
 *
 *   - The audit trail (`audit_events`) and the AI activity stream
 *     (`ai_activity_entries`) remain what they are: the tamper-evident record
 *     of authority and the measured record of AI work. When an event also
 *     belongs in one of them, the publisher writes that projection in the same
 *     call and stores its identifier here (`audit_event_id`,
 *     `activity_entry_id`). A consumer reads this table and follows the link;
 *     it never has to merge three streams and guess which rows describe the
 *     same thing.
 *
 *   - This table replaces `role_app_events`, which was a process-only account
 *     with its own vocabulary. Process events are now ordinary backbone events
 *     with a `process_run_id`.
 *
 * Every row carries `runId` and is cleared by `demo:reset`, like the rest of
 * the scenario.
 */

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * The event types.
 *
 * The first fourteen are the plan's shared event model (section 8.1), in the
 * plan's order. The remaining six are lifecycle facts the process engine needs
 * so that a stage can be reconstructed from the backbone alone: a stage was
 * opened, a preparation was held or failed, a task or decision was recorded,
 * an approval was granted.
 */
export const OS_EVENT_TYPES = [
  "work-arrived",
  "source-changed",
  "ai-preparation-started",
  "ai-preparation-completed",
  "human-task-created",
  "decision-requested",
  "approval-requested",
  "tool-executed",
  "external-command-acknowledged",
  "stage-completed",
  "process-completed",
  "routine-completed",
  "meeting-completed",
  "action-updated",
  /* Process lifecycle detail. */
  "stage-opened",
  "ai-preparation-held",
  "ai-preparation-failed",
  "human-task-completed",
  "decision-recorded",
  "approval-granted",
] as const;

export type OsEventType = (typeof OS_EVENT_TYPES)[number];

/** Who caused the event. "connector" is an external system acknowledging or sending. */
export const OS_EVENT_ACTOR_KINDS = ["human", "ai", "system", "connector"] as const;
export type OsEventActorKind = (typeof OS_EVENT_ACTOR_KINDS)[number];

export const osEvents = sqliteTable(
  "os_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    /**
     * Monotonic position within the run. Allocated at write time as the
     * current maximum plus one in the same statement, so a reader can ask for
     * "everything since sequence n" without depending on clock resolution.
     */
    sequence: integer("sequence").notNull(),
    type: text("type").$type<OsEventType>().notNull(),
    /** The role whose working day the event belongs to. Null for cross-role system events. */
    roleId: text("role_id"),
    /** Scenario clock, for example "07:45". */
    atMoment: text("at_moment").notNull(),
    /** Wall clock time the event occurred, ISO. */
    occurredAt: text("occurred_at").notNull(),
    actorKind: text("actor_kind").$type<OsEventActorKind>().notNull(),
    actorUserId: text("actor_user_id"),
    /** The work object the event is about, for example "supplier" / "TP-0099". */
    subjectKind: text("subject_kind"),
    subjectId: text("subject_id"),
    /** Set for process events: the role-app run and the stage. */
    processRunId: text("process_run_id"),
    stageId: text("stage_id"),
    /** Groups the events of one unit of work, for example a stage run id. */
    correlationId: text("correlation_id"),
    summary: text("summary").notNull(),
    summaryDe: text("summary_de").notNull(),
    /** Structured detail. Never secrets, never free text from an external party verbatim. */
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    /** One event, one row. A second publish with the same key writes nothing. */
    idempotencyKey: text("idempotency_key").notNull(),
    /** The audit projection of this event, when it has one. */
    auditEventId: text("audit_event_id"),
    /** The AI activity projection of this event, when it has one. */
    activityEntryId: text("activity_entry_id"),
  },
  (table) => [
    uniqueIndex("os_events_idempotency_unq").on(table.runId, table.idempotencyKey),
    index("os_events_run_seq_idx").on(table.runId, table.sequence),
    index("os_events_role_seq_idx").on(table.runId, table.roleId, table.sequence),
    index("os_events_process_idx").on(table.runId, table.processRunId),
    index("os_events_subject_idx").on(table.runId, table.subjectKind, table.subjectId),
  ],
);
