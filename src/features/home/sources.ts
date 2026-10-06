/**
 * What Home reads, as data.
 *
 * Home is fresh only if every write to one of these tables is followed by a
 * revalidation of the role's workday. Writing the list down is what turns
 * that from a convention into something a reviewer can check: a server action
 * that writes a table named here and does not call `revalidateWorkday(roleId)`
 * from `src/workday/revalidate.ts` is a bug, and this file is where to look to
 * know.
 *
 * Each entry names the Home region that reads it and the kind of change that
 * reaches it, in the `WorkdayChange` vocabulary the helper takes. The test in
 * `tests/unit/home-read-model.test.ts` asserts that the four changes the plan
 * names for freshness (a meeting, a decision, a process stage and an action)
 * are all covered.
 */

import type { WorkdayChange } from "@/workday/revalidate";

export type HomeRegion = "now" | "next" | "your-day" | "partner-update" | "done" | "context";

export interface HomeDataSource {
  /** The SQLite table, as named in the schema. */
  table: string;
  regions: readonly HomeRegion[];
  /** The change kinds whose writes land in this table. */
  changes: readonly WorkdayChange[];
}

export const HOME_DATA_SOURCES: readonly HomeDataSource[] = [
  { table: "scenario_runs", regions: ["now", "next", "your-day", "partner-update", "done", "context"], changes: ["scenario"] },
  { table: "decisions", regions: ["now", "next", "done", "context"], changes: ["decision"] },
  { table: "decision_options", regions: ["now", "next"], changes: ["decision"] },
  { table: "approvals", regions: ["now", "next"], changes: ["approval", "decision"] },
  { table: "execution_receipt_lines", regions: ["partner-update", "done"], changes: ["decision", "approval"] },
  { table: "ai_suggestions", regions: ["now", "next", "partner-update", "done"], changes: ["suggestion"] },
  { table: "ai_activity_entries", regions: ["partner-update"], changes: ["activity", "suggestion", "routine"] },
  { table: "background_actions", regions: ["next", "partner-update", "done"], changes: ["activity"] },
  { table: "workday_live_events", regions: ["now", "next"], changes: ["scenario"] },
  { table: "os_events", regions: ["partner-update", "done"], changes: ["process-stage", "routine", "meeting", "action", "decision"] },
  { table: "actions", regions: ["next", "your-day", "done"], changes: ["action", "decision"] },
  { table: "action_updates", regions: ["your-day", "done"], changes: ["action"] },
  { table: "inbox_messages", regions: ["your-day", "partner-update"], changes: ["inbox"] },
  { table: "calendar_events", regions: ["your-day"], changes: ["meeting"] },
  { table: "meetings", regions: ["your-day", "done"], changes: ["meeting"] },
  { table: "meeting_minutes", regions: ["done"], changes: ["minutes", "meeting"] },
  { table: "role_app_runs", regions: ["done", "partner-update"], changes: ["process-stage"] },
  { table: "role_app_stage_runs", regions: ["done"], changes: ["process-stage"] },
  { table: "kris", regions: ["next"], changes: ["scenario"] },
  { table: "suppliers", regions: ["next"], changes: ["decision"] },
  { table: "monitoring_activations", regions: ["next"], changes: ["decision"] },
] as const;

/** The change kinds the plan requires Home to reflect without a reload. */
export const HOME_FRESHNESS_CHANGES: readonly WorkdayChange[] = ["meeting", "decision", "process-stage", "action"];
