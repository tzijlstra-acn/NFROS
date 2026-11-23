/**
 * Analysis agents (migration 0011, NFR Workspace v3).
 *
 * An analysis agent is a person's saved analysis that runs again on demand
 * or on a weekly schedule: one intent of the insight engine, a name, and the
 * outcome the person described. It holds no access of its own. Each run goes
 * through the analyseQuestion READ tool in the person's Work context, and is
 * kept in insight_runs with this agent as its context, which is the agent's
 * run history.
 *
 * Lifecycle: personal, then submitted for review as a team template, then a
 * template (set by a reviewer, not by the owner), or retired. Every row
 * carries `runId` and is cleared by `demo:reset`.
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import type { RoleId } from "./core";

export const AGENT_STATUSES = ["personal", "submitted", "template", "retired"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const analysisAgents = sqliteTable(
  "analysis_agents",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    userId: text("user_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    name: text("name").notNull(),
    /** The outcome the person described, in their words. */
    outcome: text("outcome").notNull(),
    /** The question each run asks. */
    question: text("question").notNull(),
    intentId: text("intent_id").notNull(),
    /** "manual" or "weekly". */
    schedule: text("schedule").notNull().default("manual"),
    status: text("status").$type<AgentStatus>().notNull().default("personal"),
    /** The analysis it was saved from, when it was. */
    sourceInsightId: text("source_insight_id"),
    createdAt: text("created_at").notNull(),
    createdAtMoment: text("created_at_moment").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastRunInsightId: text("last_run_insight_id"),
    lastRunAt: text("last_run_at"),
    runCount: integer("run_count").notNull().default(0),
  },
  (table) => [index("analysis_agents_role_idx").on(table.runId, table.roleId)],
);
