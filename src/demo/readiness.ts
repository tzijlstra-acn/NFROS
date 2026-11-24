/**
 * Demonstration readiness: can the scripted meeting journey run right now?
 *
 * Read-only. It answers the presenter's checklist before a meeting, in one
 * call the launcher polls:
 *   - the database is migrated (every journal entry applied);
 *   - the synthetic institution is seeded (scenario run and portfolio history);
 *   - the day is clean (no analyses, approvals or agents since the last reset);
 *   - the first scripted question routes to its analysis and builds a valid,
 *     visual answer from the records, deterministically, with no model call.
 *
 * Building the first answer here also warms the analysis code and the
 * records it reads, so the presenter's first question is fast. Nothing is
 * written: the answer is built and validated in memory, not stored, and no
 * audit event is recorded.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { count, eq } from "drizzle-orm";
import { getDb, getSqlite, isDatabaseReady } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { analysisAgents } from "@/db/schema/agents";
import { approvals } from "@/db/schema/decisions";
import { insightRuns, thirdPartyMonthlyMetrics } from "@/db/schema/portfolio";
import { getScenarioState } from "@/scenario/engine/state";
import { loadAnalyticsData } from "@/features/insights/data";
import { routeQuestion } from "@/features/insights/intents";
import { validateInsight } from "@/features/insights/schema";

/** The question the presenter asks in act 3. */
export const FIRST_QUESTION = "Which critical third-party services are deteriorating, and why?";
const FIRST_ROLE = "tprm" as const;

export type ReadinessCheck = { name: string; ok: boolean; detail: string };

export type DemoReadiness = {
  ready: boolean;
  /** False when the day already shows earlier analyses, approvals or agents: reset first. */
  cleanDay: boolean;
  checks: ReadinessCheck[];
  firstAnswer: {
    intentId: string;
    title: string;
    conclusion: string;
    metrics: string[];
    visualisations: string[];
    evidence: number;
    recommendations: string[];
    buildMs: number;
  } | null;
  scenario: { date: string; moment: string } | null;
  checkedAt: string;
};

function migrationsCurrent(): ReadinessCheck {
  try {
    const journalPath = join(process.cwd(), "src", "db", "migrations", "meta", "_journal.json");
    if (!existsSync(journalPath)) return { name: "migrations", ok: true, detail: "journal not shipped with this build; schema checked by the database probe" };
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: unknown[] };
    const row = getSqlite().prepare("select count(*) as n from __drizzle_migrations").get() as { n: number };
    const ok = row.n >= journal.entries.length;
    return { name: "migrations", ok, detail: `${row.n} of ${journal.entries.length} applied` };
  } catch (error) {
    return { name: "migrations", ok: false, detail: error instanceof Error ? error.message : "unreadable" };
  }
}

function countRows(table: typeof insightRuns | typeof approvals | typeof analysisAgents | typeof thirdPartyMonthlyMetrics): number {
  const row = getDb().select({ n: count() }).from(table).get();
  return row?.n ?? 0;
}

function formatMoment(date: string, moment: string): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}, ${moment}`;
}

export function checkDemoReadiness(): DemoReadiness {
  const checks: ReadinessCheck[] = [];
  const checkedAt = new Date().toISOString();
  const dbReady = isDatabaseReady();
  checks.push({ name: "database", ok: dbReady, detail: dbReady ? "open" : "unavailable" });
  if (!dbReady) return { ready: false, cleanDay: false, checks, firstAnswer: null, scenario: null, checkedAt };

  checks.push(migrationsCurrent());

  const state = getScenarioState(DEFAULT_RUN_ID);
  checks.push({ name: "scenario", ok: Boolean(state), detail: state ? `${state.runId}, ${state.scenarioDate} ${state.currentMoment}` : "not seeded" });
  const history = countRows(thirdPartyMonthlyMetrics);
  checks.push({ name: "portfolio history", ok: history > 0, detail: `${history} monthly metric rows` });

  const analyses = getDb().select({ n: count() }).from(insightRuns).where(eq(insightRuns.runId, DEFAULT_RUN_ID)).get()?.n ?? 0;
  const approvalRows = countRows(approvals);
  const agents = countRows(analysisAgents);
  const cleanDay = analyses === 0 && approvalRows === 0 && agents === 0;
  checks.push({
    name: "clean day",
    ok: cleanDay,
    detail: cleanDay ? "no analyses, approvals or agents since the reset" : `${analyses} analyses, ${approvalRows} approvals, ${agents} agents: reset the demonstration`,
  });

  let firstAnswer: DemoReadiness["firstAnswer"] = null;
  if (state) {
    const started = Date.now();
    try {
      const routed = routeQuestion(FIRST_QUESTION, null);
      if (!routed) throw new Error("the first question routes to no analysis");
      const data = loadAnalyticsData({
        runId: state.runId,
        roleId: FIRST_ROLE,
        atMoment: state.currentMoment,
        today: state.scenarioDate,
        language: "en",
      });
      const built = routed.intent.build({
        data,
        question: FIRST_QUESTION,
        roleId: FIRST_ROLE,
        language: "en",
        dataAsOf: formatMoment(state.scenarioDate, state.currentMoment),
        context: null,
      });
      const checked = validateInsight(built);
      if (!checked.ok) throw new Error(`the first answer fails its schema: ${checked.issues.slice(0, 3).join("; ")}`);
      const r = checked.response;
      firstAnswer = {
        intentId: r.intentId,
        title: r.title,
        conclusion: r.conclusion,
        metrics: r.metrics.map((m) => `${m.label}: ${m.value}${m.unit ? " " + m.unit : ""}`),
        visualisations: r.visualisations.map((v) => `${v.type}: ${v.title}`),
        evidence: r.evidence.length,
        recommendations: r.recommendations.map((rec) => rec.title),
        buildMs: Date.now() - started,
      };
      checks.push({ name: "first question", ok: true, detail: `${r.intentId}: ${r.metrics.length} figures, ${r.visualisations.length} visuals, ${r.evidence.length} evidence items in ${firstAnswer.buildMs} ms` });
    } catch (error) {
      checks.push({ name: "first question", ok: false, detail: error instanceof Error ? error.message : "could not be built" });
    }
  }

  /* A used day is still runnable, so it warns rather than blocks readiness. */
  const ready = checks.filter((c) => c.name !== "clean day").every((c) => c.ok);
  return {
    ready,
    cleanDay,
    checks,
    firstAnswer,
    scenario: state ? { date: state.scenarioDate, moment: state.currentMoment } : null,
    checkedAt,
  };
}
