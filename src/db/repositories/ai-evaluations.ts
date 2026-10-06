/**
 * Data access for AI quality: evaluation runs, their case results, and the
 * product owner's release decisions on a configuration.
 *
 * The evaluation runner and the console decide what to run and whether to
 * approve; this module records it. One thing it does keep honest itself: a
 * completed run's counts are recomputed from its stored case results in the
 * same transaction, so the summary a reader sees can never disagree with the
 * cases behind it, and `mandatory_failed` is exactly the failed cases marked
 * mandatory.
 */

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import {
  aiConfigurationReleases,
  aiEvaluationCaseResults,
  aiEvaluationRuns,
  type EvaluationRunStatus,
} from "@/db/schema/product-console";

const db = () => getDb();

export type AIEvaluationRun = typeof aiEvaluationRuns.$inferSelect;
export type NewAIEvaluationRun = typeof aiEvaluationRuns.$inferInsert;
export type AIEvaluationCaseResult = typeof aiEvaluationCaseResults.$inferSelect;
export type NewAIEvaluationCaseResult = Omit<typeof aiEvaluationCaseResults.$inferInsert, "evaluationRunId">;
export type AIConfigurationRelease = typeof aiConfigurationReleases.$inferSelect;
export type NewAIConfigurationRelease = typeof aiConfigurationReleases.$inferInsert;

/* ==========================================================================
   Evaluation runs
   ========================================================================== */

export function createEvaluationRun(run: NewAIEvaluationRun): AIEvaluationRun {
  db().insert(aiEvaluationRuns).values(run).run();
  const written = getEvaluationRun(run.id);
  if (!written) throw new Error(`Evaluation run ${run.id} was not written.`);
  return written;
}

export function updateEvaluationRun(
  id: string,
  patch: Partial<Omit<NewAIEvaluationRun, "id" | "totalCases" | "passed" | "failed" | "notRun" | "mandatoryFailed">>,
): AIEvaluationRun | undefined {
  db().update(aiEvaluationRuns).set(patch).where(eq(aiEvaluationRuns.id, id)).run();
  return getEvaluationRun(id);
}

/**
 * Records case results for a run. A case already recorded for the run is
 * replaced by the new result, so a re-graded case keeps one row.
 */
export function recordEvaluationCaseResults(evaluationRunId: string, results: readonly NewAIEvaluationCaseResult[]): number {
  const write = getSqlite().transaction((): number => {
    let written = 0;
    for (const result of results) {
      /* Everything but the identity is replaced by a re-graded result. */
      const set = Object.fromEntries(
        Object.entries(result).filter(([key, value]) => key !== "id" && key !== "caseId" && value !== undefined),
      ) as Partial<typeof aiEvaluationCaseResults.$inferInsert>;
      written += db()
        .insert(aiEvaluationCaseResults)
        .values({ ...result, evaluationRunId })
        .onConflictDoUpdate({
          target: [aiEvaluationCaseResults.evaluationRunId, aiEvaluationCaseResults.caseId],
          set,
        })
        .run().changes;
    }
    return written;
  });
  return write();
}

export interface EvaluationRunCompletion {
  status: Extract<EvaluationRunStatus, "completed" | "failed" | "cancelled">;
  completedAt: string;
  errorRedacted?: string | null;
  resultsPath?: string | null;
}

/** Completes a run, its counts recomputed from the stored case results. */
export function completeEvaluationRun(id: string, completion: EvaluationRunCompletion): AIEvaluationRun | undefined {
  const write = getSqlite().transaction(() => {
    const counts = db()
      .select({
        total: sql<number>`count(*)`,
        passed: sql<number>`coalesce(sum(case when ${aiEvaluationCaseResults.status} = 'passed' then 1 else 0 end), 0)`,
        failed: sql<number>`coalesce(sum(case when ${aiEvaluationCaseResults.status} = 'failed' then 1 else 0 end), 0)`,
        notRun: sql<number>`coalesce(sum(case when ${aiEvaluationCaseResults.status} = 'not-run' then 1 else 0 end), 0)`,
        mandatoryFailed: sql<number>`coalesce(sum(case when ${aiEvaluationCaseResults.status} = 'failed' and ${aiEvaluationCaseResults.mandatory} = 1 then 1 else 0 end), 0)`,
      })
      .from(aiEvaluationCaseResults)
      .where(eq(aiEvaluationCaseResults.evaluationRunId, id))
      .get();
    db()
      .update(aiEvaluationRuns)
      .set({
        status: completion.status,
        completedAt: completion.completedAt,
        totalCases: Number(counts?.total ?? 0),
        passed: Number(counts?.passed ?? 0),
        failed: Number(counts?.failed ?? 0),
        notRun: Number(counts?.notRun ?? 0),
        mandatoryFailed: Number(counts?.mandatoryFailed ?? 0),
        ...(completion.errorRedacted !== undefined ? { errorRedacted: completion.errorRedacted } : {}),
        ...(completion.resultsPath !== undefined ? { resultsPath: completion.resultsPath } : {}),
      })
      .where(eq(aiEvaluationRuns.id, id))
      .run();
  });
  write();
  return getEvaluationRun(id);
}

export function getEvaluationRun(id: string): AIEvaluationRun | undefined {
  return db().select().from(aiEvaluationRuns).where(eq(aiEvaluationRuns.id, id)).get();
}

export interface EvaluationRunFilter {
  configurationId?: string;
  roleId?: string;
  taskKind?: string;
  statuses?: readonly EvaluationRunStatus[];
  limit?: number;
}

/** Runs, newest first. */
export function listEvaluationRuns(filter: EvaluationRunFilter = {}): AIEvaluationRun[] {
  const query = db()
    .select()
    .from(aiEvaluationRuns)
    .where(
      and(
        filter.configurationId ? eq(aiEvaluationRuns.configurationId, filter.configurationId) : undefined,
        filter.roleId ? eq(aiEvaluationRuns.roleId, filter.roleId) : undefined,
        filter.taskKind ? eq(aiEvaluationRuns.taskKind, filter.taskKind) : undefined,
        filter.statuses && filter.statuses.length > 0 ? inArray(aiEvaluationRuns.status, [...filter.statuses]) : undefined,
      ),
    )
    .orderBy(desc(aiEvaluationRuns.startedAt), desc(aiEvaluationRuns.id));
  return filter.limit !== undefined ? query.limit(filter.limit).all() : query.all();
}

/** The latest completed run of a configuration, the one a release rests on. */
export function getLatestCompletedEvaluationRun(configurationId: string): AIEvaluationRun | undefined {
  return db()
    .select()
    .from(aiEvaluationRuns)
    .where(and(eq(aiEvaluationRuns.configurationId, configurationId), eq(aiEvaluationRuns.status, "completed")))
    .orderBy(desc(aiEvaluationRuns.completedAt), desc(aiEvaluationRuns.id))
    .limit(1)
    .get();
}

/** A run's case results, failed first, then by case. */
export function getEvaluationCaseResults(
  evaluationRunId: string,
  status?: AIEvaluationCaseResult["status"],
): AIEvaluationCaseResult[] {
  return db()
    .select()
    .from(aiEvaluationCaseResults)
    .where(
      and(
        eq(aiEvaluationCaseResults.evaluationRunId, evaluationRunId),
        status ? eq(aiEvaluationCaseResults.status, status) : undefined,
      ),
    )
    .orderBy(
      sql`case ${aiEvaluationCaseResults.status} when 'failed' then 0 when 'not-run' then 1 else 2 end`,
      asc(aiEvaluationCaseResults.caseId),
    )
    .all();
}

/** One case across runs, newest run first: the input to Compare output. */
export function getCaseResultsAcrossRuns(caseId: string, evaluationRunIds: readonly string[]): AIEvaluationCaseResult[] {
  if (evaluationRunIds.length === 0) return [];
  return db()
    .select()
    .from(aiEvaluationCaseResults)
    .where(and(eq(aiEvaluationCaseResults.caseId, caseId), inArray(aiEvaluationCaseResults.evaluationRunId, [...evaluationRunIds])))
    .all();
}

/* ==========================================================================
   Configuration releases
   ========================================================================== */

export function recordConfigurationRelease(release: NewAIConfigurationRelease): AIConfigurationRelease {
  db().insert(aiConfigurationReleases).values(release).run();
  const written = db().select().from(aiConfigurationReleases).where(eq(aiConfigurationReleases.id, release.id)).get();
  if (!written) throw new Error(`Configuration release ${release.id} was not written.`);
  return written;
}

export interface ConfigurationRollback {
  at: string;
  byLabel: string;
  reason: string;
  restoredConfigurationId: string | null;
}

/**
 * Records the rollback of an approval, once. Returns the updated row, or
 * undefined when the release does not exist, was not an approval, or is
 * already rolled back.
 */
export function recordConfigurationRollback(releaseId: string, rollback: ConfigurationRollback): AIConfigurationRelease | undefined {
  const changed = db()
    .update(aiConfigurationReleases)
    .set({
      rolledBackAt: rollback.at,
      rolledBackByLabel: rollback.byLabel,
      rollbackReason: rollback.reason,
      restoredConfigurationId: rollback.restoredConfigurationId,
    })
    .where(
      and(
        eq(aiConfigurationReleases.id, releaseId),
        eq(aiConfigurationReleases.decision, "approved"),
        isNull(aiConfigurationReleases.rolledBackAt),
      ),
    )
    .run().changes;
  if (changed === 0) return undefined;
  return db().select().from(aiConfigurationReleases).where(eq(aiConfigurationReleases.id, releaseId)).get();
}

/** Release decisions for a role and task, newest first. */
export function listConfigurationReleases(filter: { roleId?: string; taskKind?: string } = {}): AIConfigurationRelease[] {
  return db()
    .select()
    .from(aiConfigurationReleases)
    .where(
      and(
        filter.roleId ? eq(aiConfigurationReleases.roleId, filter.roleId) : undefined,
        filter.taskKind ? eq(aiConfigurationReleases.taskKind, filter.taskKind) : undefined,
      ),
    )
    .orderBy(desc(aiConfigurationReleases.decidedAt), desc(aiConfigurationReleases.id))
    .all();
}

/**
 * The approval in force for a role and task: the latest approval not rolled
 * back. Undefined when none is recorded, in which case the code registry's
 * released configuration is the one in force.
 */
export function getApprovedConfigurationInForce(roleId: string, taskKind: string): AIConfigurationRelease | undefined {
  return db()
    .select()
    .from(aiConfigurationReleases)
    .where(
      and(
        eq(aiConfigurationReleases.roleId, roleId),
        eq(aiConfigurationReleases.taskKind, taskKind),
        eq(aiConfigurationReleases.decision, "approved"),
        isNull(aiConfigurationReleases.rolledBackAt),
      ),
    )
    .orderBy(desc(aiConfigurationReleases.decidedAt), desc(aiConfigurationReleases.id))
    .limit(1)
    .get();
}
