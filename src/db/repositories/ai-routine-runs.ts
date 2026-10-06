/**
 * Data access for AI routine runs and what each run produced.
 *
 * Thin by design. The routine runner (Wave 3) decides when a routine fires,
 * what it prepares and what its outcome is; this module records it and
 * answers the reads Home and the dock need: the runs of a role, newest first,
 * with their outputs, and the reverse lineage from an object to the run that
 * produced it.
 *
 * Idempotency is enforced here because it is a property of the record, not of
 * the runner: `startRoutineRun` with an idempotency key that already exists
 * returns the existing run and writes nothing, so a routine fired twice for
 * the same trigger cannot become two runs.
 *
 * Synchronous throughout, like every repository on better-sqlite3.
 */

import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import {
  aiRoutineRunOutputs,
  aiRoutineRuns,
  type RoutineRunOutcome,
  type RoutineRunStatus,
} from "@/db/schema/ai-partner";

const db = () => getDb();

export type AIRoutineRun = typeof aiRoutineRuns.$inferSelect;
/** A new run. `runId` defaults to the active scenario run. */
export type NewAIRoutineRun = Omit<typeof aiRoutineRuns.$inferInsert, "runId"> & { runId?: string };
export type AIRoutineRunOutput = typeof aiRoutineRunOutputs.$inferSelect;
export type NewAIRoutineRunOutput = Omit<typeof aiRoutineRunOutputs.$inferInsert, "runId" | "routineRunId">;

/* ==========================================================================
   Writes
   ========================================================================== */

/**
 * Records the start of a run, once per idempotency key.
 *
 * `created` is false when a run with the key already exists; the existing run
 * is returned unchanged.
 */
export function startRoutineRun(run: NewAIRoutineRun): { run: AIRoutineRun; created: boolean } {
  const runId = run.runId ?? DEFAULT_RUN_ID;
  const existing = findRoutineRunByKey(run.idempotencyKey, runId);
  if (existing) return { run: existing, created: false };

  const result = db()
    .insert(aiRoutineRuns)
    .values({ ...run, runId })
    .onConflictDoNothing({ target: [aiRoutineRuns.runId, aiRoutineRuns.idempotencyKey] })
    .run();
  const written = findRoutineRunByKey(run.idempotencyKey, runId);
  if (!written) throw new Error(`Routine run ${run.id} was not written.`);
  return { run: written, created: result.changes > 0 };
}

/** Changes a run's columns, for example to "running" with its job id. */
export function updateRoutineRun(
  id: string,
  patch: Partial<Omit<NewAIRoutineRun, "id" | "runId" | "idempotencyKey">>,
): AIRoutineRun | undefined {
  db().update(aiRoutineRuns).set(patch).where(eq(aiRoutineRuns.id, id)).run();
  return getRoutineRun(id);
}

/**
 * Records outputs of a run. An object already recorded for the run is kept as
 * it was, so recording the same outputs twice writes nothing the second time.
 * Returns the number of rows written.
 */
export function recordRoutineRunOutputs(routineRunId: string, outputs: readonly NewAIRoutineRunOutput[]): number {
  const run = getRoutineRun(routineRunId);
  if (!run || outputs.length === 0) return 0;
  let written = 0;
  for (const output of outputs) {
    written += db()
      .insert(aiRoutineRunOutputs)
      .values({ ...output, runId: run.runId, routineRunId })
      .onConflictDoNothing({
        target: [aiRoutineRunOutputs.routineRunId, aiRoutineRunOutputs.objectKind, aiRoutineRunOutputs.objectId],
      })
      .run().changes;
  }
  return written;
}

export interface RoutineRunCompletion {
  status: Extract<RoutineRunStatus, "completed" | "failed" | "cancelled">;
  outcome: RoutineRunOutcome;
  summary: string;
  summaryDe: string;
  completedAt: string;
  osEventId?: string | null;
  errorRedacted?: string | null;
}

/**
 * Completes a run and records its outputs in one transaction, so a reader
 * never sees a completed run without the objects it says it produced.
 */
export function completeRoutineRun(
  id: string,
  completion: RoutineRunCompletion,
  outputs: readonly NewAIRoutineRunOutput[] = [],
): AIRoutineRun | undefined {
  const write = getSqlite().transaction(() => {
    db()
      .update(aiRoutineRuns)
      .set({
        status: completion.status,
        outcome: completion.outcome,
        summary: completion.summary,
        summaryDe: completion.summaryDe,
        completedAt: completion.completedAt,
        ...(completion.osEventId !== undefined ? { osEventId: completion.osEventId } : {}),
        ...(completion.errorRedacted !== undefined ? { errorRedacted: completion.errorRedacted } : {}),
      })
      .where(eq(aiRoutineRuns.id, id))
      .run();
    recordRoutineRunOutputs(id, outputs);
  });
  write();
  return getRoutineRun(id);
}

/* ==========================================================================
   Reads
   ========================================================================== */

export function getRoutineRun(id: string): AIRoutineRun | undefined {
  return db().select().from(aiRoutineRuns).where(eq(aiRoutineRuns.id, id)).get();
}

export function findRoutineRunByKey(idempotencyKey: string, runId = DEFAULT_RUN_ID): AIRoutineRun | undefined {
  return db()
    .select()
    .from(aiRoutineRuns)
    .where(and(eq(aiRoutineRuns.runId, runId), eq(aiRoutineRuns.idempotencyKey, idempotencyKey)))
    .get();
}

export interface RoutineRunFilter {
  roleId?: RoleId;
  routineId?: string;
  statuses?: readonly RoutineRunStatus[];
  /** ISO lower bound on `started_at`, inclusive. */
  startedFrom?: string;
  limit?: number;
  runId?: string;
}

/** Runs, newest first. */
export function listRoutineRuns(filter: RoutineRunFilter = {}): AIRoutineRun[] {
  const runId = filter.runId ?? DEFAULT_RUN_ID;
  const conditions = [eq(aiRoutineRuns.runId, runId)];
  if (filter.roleId) conditions.push(eq(aiRoutineRuns.roleId, filter.roleId));
  if (filter.routineId) conditions.push(eq(aiRoutineRuns.routineId, filter.routineId));
  if (filter.statuses && filter.statuses.length > 0) conditions.push(inArray(aiRoutineRuns.status, [...filter.statuses]));
  if (filter.startedFrom) conditions.push(gte(aiRoutineRuns.startedAt, filter.startedFrom));
  const query = db()
    .select()
    .from(aiRoutineRuns)
    .where(and(...conditions))
    .orderBy(desc(aiRoutineRuns.startedAt), desc(aiRoutineRuns.id));
  return filter.limit !== undefined ? query.limit(filter.limit).all() : query.all();
}

/** One run's outputs, in their recorded order. */
export function getRoutineRunOutputs(routineRunId: string): AIRoutineRunOutput[] {
  return db()
    .select()
    .from(aiRoutineRunOutputs)
    .where(eq(aiRoutineRunOutputs.routineRunId, routineRunId))
    .orderBy(asc(aiRoutineRunOutputs.sortOrder), asc(aiRoutineRunOutputs.id))
    .all();
}

/** Outputs of several runs, grouped by run, for a list that shows each run's lineage. */
export function getOutputsForRoutineRuns(routineRunIds: readonly string[]): Map<string, AIRoutineRunOutput[]> {
  const grouped = new Map<string, AIRoutineRunOutput[]>();
  if (routineRunIds.length === 0) return grouped;
  const rows = db()
    .select()
    .from(aiRoutineRunOutputs)
    .where(inArray(aiRoutineRunOutputs.routineRunId, [...routineRunIds]))
    .orderBy(asc(aiRoutineRunOutputs.sortOrder), asc(aiRoutineRunOutputs.id))
    .all();
  for (const row of rows) {
    const list = grouped.get(row.routineRunId) ?? [];
    list.push(row);
    grouped.set(row.routineRunId, list);
  }
  return grouped;
}

/** The runs that produced or changed an object, newest first: "which run prepared this?". */
export function findRoutineRunsForObject(objectKind: string, objectId: string, runId = DEFAULT_RUN_ID): AIRoutineRun[] {
  const ids = db()
    .select({ id: aiRoutineRunOutputs.routineRunId })
    .from(aiRoutineRunOutputs)
    .where(
      and(
        eq(aiRoutineRunOutputs.runId, runId),
        eq(aiRoutineRunOutputs.objectKind, objectKind),
        eq(aiRoutineRunOutputs.objectId, objectId),
      ),
    )
    .all()
    .map((row) => row.id);
  if (ids.length === 0) return [];
  return db()
    .select()
    .from(aiRoutineRuns)
    .where(inArray(aiRoutineRuns.id, ids))
    .orderBy(desc(aiRoutineRuns.startedAt), desc(aiRoutineRuns.id))
    .all();
}
