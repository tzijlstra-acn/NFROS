/**
 * Skills schema (migration 0009).
 *
 * A skill is a person's own saved, read-only query over the records their
 * role already reads, built by describing it in a sentence on Processes,
 * Skills, or by asking the work partner. One row per saved skill.
 *
 * `spec` is stored as the person saved it and is checked against the skills
 * catalog every time it is read back (`src/features/skills/schema.ts`), so a
 * row edited outside the product can never widen what a skill reads. The
 * schedule is a stored preference; a weekly skill is due on the Monday after
 * the scenario day and is run by the person until a scheduler exists.
 *
 * Keyed by the person (`user_id`, the role's holder) and the role. Every row
 * carries `runId` and is cleared by `demo:reset`.
 */

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { RoleId } from "./core";

export const SKILL_DRAFT_SOURCES = ["model", "rules"] as const;
export type SkillDraftSource = (typeof SKILL_DRAFT_SOURCES)[number];

export const skills = sqliteTable(
  "skills",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    userId: text("user_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    name: text("name").notNull(),
    /** The sentence the skill was drafted from, as the person wrote it. */
    request: text("request").notNull().default(""),
    /** The skill spec. Checked against the catalog on every read. */
    spec: text("spec", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    /** "manual" or "weekly". Mirrors the spec, so a scheduler can select on it. */
    schedule: text("schedule").notNull().default("manual"),
    /** Whether the model or the rule-based builder drafted the saved spec. */
    draftedVia: text("drafted_via").$type<SkillDraftSource>().notNull(),
    createdAt: text("created_at").notNull(),
    createdAtMoment: text("created_at_moment").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastRunAt: text("last_run_at"),
    lastRunMoment: text("last_run_moment"),
    lastRunMatched: integer("last_run_matched"),
    lastRunInScope: integer("last_run_in_scope"),
    /** The audit event the last run's tool call wrote. */
    lastRunAuditEventId: text("last_run_audit_event_id"),
  },
  (table) => [
    uniqueIndex("skills_name_unq").on(table.runId, table.userId, table.roleId, table.name),
    index("skills_role_idx").on(table.runId, table.roleId),
  ],
);
