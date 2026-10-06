/**
 * Process stage inputs (migration 0008).
 *
 * A record a person attached to a process stage as input: an inbox message,
 * confirmed minutes or a document. Until 0008 the Inbox's "Add to process"
 * published a `work-arrived` event on the stage and stored nothing a stage
 * could read, so the message was announced to the stage but never part of
 * its sources. This table is that record; the process engine reads it through
 * its public API as a stage source, and the Inbox, Meetings and the stage
 * workspace write it when a person attaches something.
 *
 * One row per stage and source: attaching the same message twice finds the
 * first row. The backbone event and the audit row of the attachment are
 * linked, not copied. Every row carries `runId` and is cleared by
 * `demo:reset`.
 */

import { sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/** What was attached. */
export const STAGE_INPUT_SOURCE_KINDS = ["message", "minutes", "document"] as const;
export type StageInputSourceKind = (typeof STAGE_INPUT_SOURCE_KINDS)[number];

export const processStageInputs = sqliteTable(
  "process_stage_inputs",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    processRunId: text("process_run_id").notNull(),
    stageId: text("stage_id").notNull(),
    /** The stage run open when it was attached. Null when the stage had none yet. */
    stageRunId: text("stage_run_id"),
    sourceKind: text("source_kind").$type<StageInputSourceKind>().notNull(),
    /** The inbox message, minutes or evidence document id. */
    sourceId: text("source_id").notNull(),
    addedByUserId: text("added_by_user_id"),
    addedAt: text("added_at").notNull(),
    addedAtMoment: text("added_at_moment").notNull(),
    /** The person's note on why it belongs to the stage. */
    note: text("note").notNull().default(""),
    /** The backbone event that announced the attachment. */
    osEventId: text("os_event_id"),
    /** The audit row of the governed write, when it has one. */
    auditEventId: text("audit_event_id"),
  },
  (table) => [
    uniqueIndex("psi_source_unq").on(table.runId, table.processRunId, table.stageId, table.sourceKind, table.sourceId),
    index("psi_source_idx").on(table.runId, table.sourceKind, table.sourceId),
  ],
);
