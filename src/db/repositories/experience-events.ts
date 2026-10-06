/**
 * Data access for experience analytics: the interactions the backbone does
 * not record, written once and read only as aggregates.
 *
 * There is no per person read here, by construction: the table holds no user
 * id. `aggregateExperienceEvents` counts by any of the plan's filters (role,
 * legal entity, process, cohort, week and mode) and by kind, and that is the
 * only shape the console receives (plan 7.4: no keystroke tracking, no
 * employee productivity score).
 */

import { and, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { experienceEvents, type ExperienceEventKind } from "@/db/schema/product-console";

const db = () => getDb();

export type ExperienceEvent = typeof experienceEvents.$inferSelect;
/** A new interaction. `runId` defaults to the active scenario run. */
export type NewExperienceEvent = Omit<typeof experienceEvents.$inferInsert, "runId"> & { runId?: string };

/** Records an interaction once per idempotency key. */
export function recordExperienceEvent(event: NewExperienceEvent): { created: boolean } {
  const result = db()
    .insert(experienceEvents)
    .values({ ...event, runId: event.runId ?? DEFAULT_RUN_ID })
    .onConflictDoNothing({ target: [experienceEvents.runId, experienceEvents.idempotencyKey] })
    .run();
  return { created: result.changes > 0 };
}

export interface ExperienceFilter {
  kinds?: readonly ExperienceEventKind[];
  roleId?: RoleId;
  legalEntityId?: string;
  processId?: string;
  cohortId?: string;
  mode?: "live" | "safe" | "offline";
  /** ISO bounds on `occurred_at`: from inclusive, to exclusive. */
  from?: string;
  to?: string;
  runId?: string;
}

/** The dimensions a count can be grouped by. "week" is the Monday the week starts on. */
export type ExperienceDimension = "kind" | "roleId" | "legalEntityId" | "processId" | "cohortId" | "mode" | "week";

export type ExperienceCount = Partial<Record<ExperienceDimension, string | null>> & { count: number };

const WEEK = sql<string>`date(${experienceEvents.occurredAt}, '-6 days', 'weekday 1')`;

const DIMENSIONS: Record<ExperienceDimension, SQL> = {
  kind: sql`${experienceEvents.kind}`,
  roleId: sql`${experienceEvents.roleId}`,
  legalEntityId: sql`${experienceEvents.legalEntityId}`,
  processId: sql`${experienceEvents.processId}`,
  cohortId: sql`${experienceEvents.cohortId}`,
  mode: sql`${experienceEvents.mode}`,
  week: WEEK,
};

/**
 * Counts interactions, grouped by the dimensions asked for and filtered by
 * the plan's filters. With no dimension, one row with the total.
 */
export function aggregateExperienceEvents(
  filter: ExperienceFilter = {},
  groupBy: readonly ExperienceDimension[] = [],
): ExperienceCount[] {
  const conditions = [
    eq(experienceEvents.runId, filter.runId ?? DEFAULT_RUN_ID),
    filter.kinds && filter.kinds.length > 0 ? inArray(experienceEvents.kind, [...filter.kinds]) : undefined,
    filter.roleId ? eq(experienceEvents.roleId, filter.roleId) : undefined,
    filter.legalEntityId ? eq(experienceEvents.legalEntityId, filter.legalEntityId) : undefined,
    filter.processId ? eq(experienceEvents.processId, filter.processId) : undefined,
    filter.cohortId ? eq(experienceEvents.cohortId, filter.cohortId) : undefined,
    filter.mode ? eq(experienceEvents.mode, filter.mode) : undefined,
    filter.from ? gte(experienceEvents.occurredAt, filter.from) : undefined,
    filter.to ? lt(experienceEvents.occurredAt, filter.to) : undefined,
  ];

  const selection: Record<string, SQL> = { count: sql<number>`count(*)` };
  for (const dimension of groupBy) selection[dimension] = DIMENSIONS[dimension];

  const base = db().select(selection).from(experienceEvents).where(and(...conditions));
  const rows = (groupBy.length > 0 ? base.groupBy(...groupBy.map((dimension) => DIMENSIONS[dimension])) : base).all() as Array<
    Record<string, unknown>
  >;

  return rows.map((row) => {
    const out: ExperienceCount = { count: Number(row["count"] ?? 0) };
    for (const dimension of groupBy) {
      const value = row[dimension];
      out[dimension] = value === null || value === undefined ? null : String(value);
    }
    return out;
  });
}
