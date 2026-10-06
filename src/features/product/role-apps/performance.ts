/**
 * Role App performance (plan 7.3): aggregate process measures only.
 *
 * Read from what the process engine already records, never from a second
 * account of the same work:
 *
 *   runs, stage runs                `role_app_runs`, `role_app_stage_runs`
 *   human task time                 `human-task-created` to the first
 *                                   `human-task-completed` of the same task
 *   source delay                    `ai-preparation-held` for a source to
 *                                   the job's `ai-preparation-completed`
 *   decision delay                  `decision-requested` to the first
 *                                   `decision-recorded` of the same decision
 *   approval delay                  `approval-requested` to the next
 *                                   `approval-granted` in the same stage
 *   failure rate                    `ai-preparation-failed` out of the
 *                                   preparations started
 *   resume rate                     preparations interrupted (held, or
 *                                   started more than once) that completed
 *   AI suggestion lifecycle         `ai_suggestions.disposition` (0006)
 *   feedback                        `ai_feedback`, `product_feedback`
 *
 * The pairs are matched on the backbone's own idempotency keys
 * (`src/features/process/keys.ts`), which name the stage run and the task or
 * decision, so a pairing is a fact about one piece of work, not a guess.
 *
 * Never a person: nothing here groups by user, and no measure names or ranks
 * anyone (plan 7.3: "Do not rank employees"). A measure with nothing to
 * measure says "Not measured" with the reason; it is never a zero.
 *
 * The computation is pure (`computeRoleAppPerformance`), so it is tested
 * without a database; `readRoleAppPerformance` reads the rows.
 */

import { getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import type { Bilingual } from "../permissions";

export interface PerformanceRun {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
}

export interface PerformanceStageRun {
  id: string;
  roleAppRunId: string;
  stageId: string;
  status: string;
  openedAt: string | null;
  completedAt: string | null;
}

export interface PerformanceEvent {
  type: string;
  idempotencyKey: string;
  occurredAt: string;
  processRunId: string | null;
  stageId: string | null;
}

export interface DurationMeasure {
  measured: boolean;
  /** Median in milliseconds; null when not measured. */
  medianMs: number | null;
  /** How many intervals the median rests on. */
  count: number;
  note: Bilingual;
}

export interface StageWaiting {
  stageId: string;
  completed: number;
  open: number;
  /** Median time a completed stage was open. */
  completedDuration: DurationMeasure;
  /** Median time the open stages have been open, to the measurement time. */
  openFor: DurationMeasure;
}

export interface RateMeasure {
  numerator: number;
  denominator: number;
  /** 0 to 1; null when the denominator is zero. */
  rate: number | null;
}

export interface SuggestionLifecycle {
  total: number;
  accepted: number;
  modified: number;
  rejected: number;
  /** Suggestions a person has acted on: accepted, modified or rejected. */
  decided: number;
}

export interface RoleAppPerformance {
  runsStarted: number;
  runsCompleted: number;
  runsActive: number;
  runsBlocked: number;
  cycleTime: DurationMeasure;
  stages: StageWaiting[];
  humanTaskTime: DurationMeasure;
  sourceDelay: DurationMeasure & { held: number };
  decisionDelay: DurationMeasure;
  approvalDelay: DurationMeasure;
  failureRate: RateMeasure;
  resumeRate: RateMeasure;
  /** The ISO time open intervals are measured to. */
  measuredAt: string;
}

/* ==========================================================================
   Pure computation
   ========================================================================== */

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const low = sorted[middle - 1];
  const high = sorted[middle];
  return low !== undefined && high !== undefined ? (low + high) / 2 : null;
}

function span(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return b - a;
}

function measure(values: number[], empty: Bilingual): DurationMeasure {
  const value = median(values);
  return value === null
    ? { measured: false, medianMs: null, count: 0, note: empty }
    : {
        measured: true,
        medianMs: value,
        count: values.length,
        note: {
          en: `Median of ${values.length} interval(s).`,
          de: `Median aus ${values.length} Intervall(en).`,
        },
      };
}

/** The first occurrence of each key, by time. */
function firstByKey(events: readonly PerformanceEvent[], keyOf: (event: PerformanceEvent) => string | null): Map<string, PerformanceEvent> {
  const out = new Map<string, PerformanceEvent>();
  for (const event of [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
    const key = keyOf(event);
    if (key !== null && !out.has(key)) out.set(key, event);
  }
  return out;
}

/** "human-task-completed:SR-1:task:x:r2" to "SR-1:task:x"; null when the key has another shape. */
function withoutRevision(key: string, prefix: string): string | null {
  if (!key.startsWith(prefix)) return null;
  return key.slice(prefix.length).replace(/:r\d+$/, "");
}

export function computeRoleAppPerformance(input: {
  runs: readonly PerformanceRun[];
  stageRuns: readonly PerformanceStageRun[];
  events: readonly PerformanceEvent[];
  measuredAt: string;
}): RoleAppPerformance {
  const { runs, stageRuns, events, measuredAt } = input;

  const completedRuns = runs.filter((run) => run.completedAt !== null || run.status === "completed");
  const cycleTime = measure(
    completedRuns.map((run) => span(run.startedAt, run.completedAt)).filter((value): value is number => value !== null),
    { en: "Not measured: no run has completed yet.", de: "Nicht gemessen: Noch kein Lauf ist abgeschlossen." },
  );

  const stageIds = [...new Set(stageRuns.map((stage) => stage.stageId))];
  const stages: StageWaiting[] = stageIds.map((stageId) => {
    const rows = stageRuns.filter((stage) => stage.stageId === stageId);
    const done = rows.filter((stage) => stage.completedAt !== null);
    const open = rows.filter((stage) => stage.completedAt === null && stage.openedAt !== null);
    return {
      stageId,
      completed: done.length,
      open: open.length,
      completedDuration: measure(
        done.map((stage) => span(stage.openedAt, stage.completedAt)).filter((value): value is number => value !== null),
        { en: "No completed stage run.", de: "Kein abgeschlossener Stufenlauf." },
      ),
      openFor: measure(
        open.map((stage) => span(stage.openedAt, measuredAt)).filter((value): value is number => value !== null),
        { en: "Nothing open.", de: "Nichts offen." },
      ),
    };
  });

  /* Human task time: created to the first completion of the same task. */
  const created = firstByKey(events.filter((event) => event.type === "human-task-created"), (event) =>
    withoutRevision(event.idempotencyKey, "human-task-created:"),
  );
  const completed = firstByKey(events.filter((event) => event.type === "human-task-completed"), (event) =>
    withoutRevision(event.idempotencyKey, "human-task-completed:"),
  );
  const humanTaskTime = measure(
    [...completed.entries()]
      .map(([key, done]) => span(created.get(key)?.occurredAt ?? null, done.occurredAt))
      .filter((value): value is number => value !== null),
    { en: "Not measured: no human task has been completed through the engine yet.", de: "Nicht gemessen: Noch keine menschliche Aufgabe wurde ueber die Prozesssteuerung abgeschlossen." },
  );

  /* Source delay: held for a source to the job's completion. */
  const heldForSource = firstByKey(
    events.filter((event) => event.type === "ai-preparation-held" && /:source:a\d+$/.test(event.idempotencyKey)),
    (event) => /^ai-preparation-held:(.+):source:a\d+$/.exec(event.idempotencyKey)?.[1] ?? null,
  );
  const preparationCompleted = firstByKey(events.filter((event) => event.type === "ai-preparation-completed"), (event) =>
    event.idempotencyKey.startsWith("ai-preparation-completed:") ? event.idempotencyKey.slice("ai-preparation-completed:".length) : null,
  );
  const sourceDelayMeasure = measure(
    [...heldForSource.entries()]
      .map(([jobId, held]) => span(held.occurredAt, preparationCompleted.get(jobId)?.occurredAt ?? null))
      .filter((value): value is number => value !== null),
    heldForSource.size > 0
      ? { en: "Held for a source and not yet resumed.", de: "Wartet auf eine Quelle und wurde noch nicht fortgesetzt." }
      : { en: "No preparation has waited for a source.", de: "Keine Vorbereitung hat auf eine Quelle gewartet." },
  );

  /* Decision delay: requested to the first recording of the same decision. */
  const requested = firstByKey(events.filter((event) => event.type === "decision-requested"), (event) =>
    withoutRevision(event.idempotencyKey, "decision-requested:"),
  );
  const recorded = firstByKey(events.filter((event) => event.type === "decision-recorded"), (event) =>
    withoutRevision(event.idempotencyKey, "decision-recorded:"),
  );
  const decisionDelay = measure(
    [...recorded.entries()]
      .map(([key, done]) => span(requested.get(key)?.occurredAt ?? null, done.occurredAt))
      .filter((value): value is number => value !== null),
    { en: "Not measured: no stage decision has been requested and recorded yet.", de: "Nicht gemessen: Noch keine Stufenentscheidung wurde angefordert und erfasst." },
  );

  /* Approval delay: requested to the next grant in the same stage of the same run. */
  const grants = events
    .filter((event) => event.type === "approval-granted")
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const used = new Set<PerformanceEvent>();
  const approvalSpans: number[] = [];
  for (const request of events
    .filter((event) => event.type === "approval-requested")
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
    const grant = grants.find(
      (event) =>
        !used.has(event) &&
        event.processRunId === request.processRunId &&
        event.stageId === request.stageId &&
        event.occurredAt >= request.occurredAt,
    );
    if (!grant) continue;
    used.add(grant);
    const value = span(request.occurredAt, grant.occurredAt);
    if (value !== null) approvalSpans.push(value);
  }
  const approvalDelay = measure(approvalSpans, {
    en: "Not measured: no approval has been requested and granted yet.",
    de: "Nicht gemessen: Noch keine Genehmigung wurde angefordert und erteilt.",
  });

  /* Failure and resume. */
  const started = events.filter((event) => event.type === "ai-preparation-started");
  const jobsStarted = new Map<string, number>();
  for (const event of started) {
    const match = /^ai-preparation-started:(.+):a(\d+)$/.exec(event.idempotencyKey);
    if (!match?.[1]) continue;
    jobsStarted.set(match[1], Math.max(jobsStarted.get(match[1]) ?? 0, Number(match[2])));
  }
  const failedJobs = new Set(
    events
      .filter((event) => event.type === "ai-preparation-failed")
      .map((event) => event.idempotencyKey.slice("ai-preparation-failed:".length)),
  );
  const heldJobs = new Set(
    events
      .filter((event) => event.type === "ai-preparation-held")
      .map((event) => /^ai-preparation-held:(.+):[a-z]+:a\d+$/.exec(event.idempotencyKey)?.[1])
      .filter((value): value is string => typeof value === "string"),
  );
  const interrupted = new Set([...heldJobs, ...[...jobsStarted.entries()].filter(([, attempts]) => attempts > 1).map(([id]) => id)]);
  const resumed = [...interrupted].filter((id) => preparationCompleted.has(id)).length;

  return {
    runsStarted: runs.length,
    runsCompleted: completedRuns.length,
    runsActive: runs.length - completedRuns.length,
    runsBlocked: runs.filter((run) => run.status === "blocked").length,
    cycleTime,
    stages,
    humanTaskTime,
    sourceDelay: { ...sourceDelayMeasure, held: heldForSource.size },
    decisionDelay,
    approvalDelay,
    failureRate: {
      numerator: failedJobs.size,
      denominator: jobsStarted.size,
      rate: jobsStarted.size > 0 ? failedJobs.size / jobsStarted.size : null,
    },
    resumeRate: {
      numerator: resumed,
      denominator: interrupted.size,
      rate: interrupted.size > 0 ? resumed / interrupted.size : null,
    },
    measuredAt,
  };
}

/* ==========================================================================
   Reading
   ========================================================================== */

/** The scenario clock as an ISO time: the day of the demonstration at its current moment. */
export function scenarioNow(runId: string = DEFAULT_RUN_ID): string {
  try {
    const row = getSqlite()
      .prepare("SELECT scenario_date AS date, current_moment AS moment FROM scenario_runs WHERE id = ?")
      .get(runId) as { date: string; moment: string } | undefined;
    if (row && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && /^\d{2}:\d{2}$/.test(row.moment)) {
      return `${row.date}T${row.moment}:00.000Z`;
    }
  } catch {
    /* fall through */
  }
  return new Date().toISOString();
}

export function readRoleAppPerformance(roleAppId: string, runId: string = DEFAULT_RUN_ID): RoleAppPerformance | null {
  try {
    const sqlite = getSqlite();
    const runs = sqlite
      .prepare("SELECT id, status, started_at AS startedAt, completed_at AS completedAt FROM role_app_runs WHERE run_id = ? AND role_app_id = ?")
      .all(runId, roleAppId) as PerformanceRun[];
    const ids = runs.map((run) => run.id);
    const placeholders = ids.map(() => "?").join(",");
    const stageRuns =
      ids.length === 0
        ? []
        : (sqlite
            .prepare(
              `SELECT id, role_app_run_id AS roleAppRunId, stage_id AS stageId, status, opened_at AS openedAt, completed_at AS completedAt FROM role_app_stage_runs WHERE run_id = ? AND role_app_run_id IN (${placeholders})`,
            )
            .all(runId, ...ids) as PerformanceStageRun[]);
    const events =
      ids.length === 0
        ? []
        : (sqlite
            .prepare(
              `SELECT type, idempotency_key AS idempotencyKey, occurred_at AS occurredAt, process_run_id AS processRunId, stage_id AS stageId FROM os_events WHERE run_id = ? AND process_run_id IN (${placeholders})`,
            )
            .all(runId, ...ids) as PerformanceEvent[]);
    return computeRoleAppPerformance({ runs, stageRuns, events, measuredAt: scenarioNow(runId) });
  } catch {
    return null;
  }
}

/** The AI suggestion lifecycle of a role's working day, as aggregates. */
export function readSuggestionLifecycle(roleId: string, runId: string = DEFAULT_RUN_ID): SuggestionLifecycle | null {
  try {
    const rows = getSqlite()
      .prepare("SELECT disposition, count(*) AS n FROM ai_suggestions WHERE run_id = ? AND role_id = ? GROUP BY disposition")
      .all(runId, roleId) as Array<{ disposition: string; n: number }>;
    const count = (name: string) => Number(rows.find((row) => row.disposition === name)?.n ?? 0);
    const total = rows.reduce((sum, row) => sum + Number(row.n), 0);
    const accepted = count("accepted") + count("executed");
    const modified = count("modified");
    const rejected = count("rejected");
    return { total, accepted, modified, rejected, decided: accepted + modified + rejected };
  } catch {
    return null;
  }
}

export interface FeedbackCounts {
  aiFeedback: number;
  productFeedback: number;
  byKind: Array<{ kind: string; count: number }>;
}

/** Feedback about a Role App: AI feedback in its role, and product feedback linked to it. */
export function readRoleAppFeedback(roleAppId: string, roleId: string, runId: string = DEFAULT_RUN_ID): FeedbackCounts | null {
  try {
    const sqlite = getSqlite();
    const ai = sqlite
      .prepare("SELECT kind, count(*) AS n FROM ai_feedback WHERE run_id = ? AND role_id = ? GROUP BY kind")
      .all(runId, roleId) as Array<{ kind: string; n: number }>;
    const product = sqlite
      .prepare("SELECT kind, count(*) AS n FROM product_feedback WHERE role_app_id = ? GROUP BY kind")
      .all(roleAppId) as Array<{ kind: string; n: number }>;
    const byKind = new Map<string, number>();
    for (const row of [...ai, ...product]) byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + Number(row.n));
    return {
      aiFeedback: ai.reduce((sum, row) => sum + Number(row.n), 0),
      productFeedback: product.reduce((sum, row) => sum + Number(row.n), 0),
      byKind: [...byKind.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
    };
  } catch {
    return null;
  }
}

/** A duration in plain words: minutes, hours or days. */
export function formatDuration(ms: number | null, language: "en" | "de"): string {
  if (ms === null) return "-";
  const minutes = ms / 60000;
  if (minutes < 1) return language === "de" ? "unter 1 Min." : "under 1 min";
  if (minutes < 90) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 48) return language === "de" ? `${hours.toFixed(1).replace(".", ",")} Std.` : `${hours.toFixed(1)} h`;
  const days = hours / 24;
  return language === "de" ? `${days.toFixed(1).replace(".", ",")} Tage` : `${days.toFixed(1)} days`;
}

export function formatRate(rate: RateMeasure, language: "en" | "de"): string {
  if (rate.rate === null) return language === "de" ? "Nicht gemessen" : "Not measured";
  const percent = Math.round(rate.rate * 100);
  return `${percent} % (${rate.numerator}/${rate.denominator})`;
}
