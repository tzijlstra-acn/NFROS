/**
 * The pilot's weekly view.
 *
 * Server only. One week at a time, every figure with its source, and every
 * figure an aggregate: there is no per-person count anywhere in this module,
 * because "adoption" in a pilot is a question about the product, never a
 * ranking of the people using it (plan 7.3 and 7.4, "do not rank employees").
 *
 *   adoption     human actions recorded on the pilot roles' desks, by role
 *                (`os_events`), and the interactions the experience recorder
 *                holds for the cohort (`experience_events`)
 *   completion   stages completed, process runs completed and decisions
 *                recorded on the pilot roles' desks (`os_events`)
 *   issues       issues, risks and decisions required (`pilot_issues`)
 *   feedback     structured feedback on the pilot's roles and Role Apps
 *                (`product_feedback`, the 0006 inbox)
 *   quality      the recorded AI evaluation evidence for the pilot's roles
 *   value        each measure's reading for the week beside its baseline and
 *                success criterion, as people recorded them
 *
 * In this environment everything behind adoption, completion and quality is
 * the synthetic institution, so each of those sections carries the
 * Simulated status. Value readings are what a person entered, and are shown
 * only when entered.
 */

import { getSqlite } from "@/db/client";
import { listEvaluationRuns } from "@/db/repositories/ai-evaluations";
import { aggregateExperienceEvents } from "@/db/repositories/experience-events";
import { listProductFeedback, type ProductFeedbackItem } from "@/db/repositories/product-feedback";
import type { PilotIssue, PilotMeasureReading } from "@/db/repositories/pilot";
import type { ProductFeedbackStatus } from "@/db/schema/product-console";
import { readEvaluationEvidence, evaluationReadingsForRole } from "@/product/status/sources";
import { reading, type StatusReading } from "@/product/status/vocabulary";
import { isMonday, weekStartOf, type Bilingual } from "./rules";
import type { PilotWorkspace, WorkspaceMeasure } from "./workspace";

export interface RoleActivity {
  roleId: string;
  label: string;
  humanActions: number;
  stagesCompleted: number;
  processesCompleted: number;
  decisionsRecorded: number;
}

export interface WeeklyValueRow {
  entry: WorkspaceMeasure;
  reading: PilotMeasureReading | null;
  /** Reading minus baseline, only when both were measured by people. */
  difference: number | null;
}

export interface PilotWeek {
  weekStarting: string;
  /** The weeks the view can move between: the pilot window and every week with a reading. */
  weeks: string[];
  inWindow: boolean;
  adoption: {
    reading: StatusReading;
    byRole: RoleActivity[];
    experience: Array<{ kind: string; count: number }>;
    experienceReading: StatusReading;
  };
  completion: { reading: StatusReading; stages: number; processes: number; decisions: number };
  issues: { open: PilotIssue[]; risks: PilotIssue[]; decisions: PilotIssue[]; raisedThisWeek: number; resolvedThisWeek: number };
  feedback: { reading: StatusReading; items: ProductFeedbackItem[]; byStatus: Partial<Record<ProductFeedbackStatus, number>> };
  quality: { harness: StatusReading; modelOutput: StatusReading; byRole: Array<{ roleId: string; harness: StatusReading; cases: number }>; runs: number };
  value: { reading: StatusReading; rows: WeeklyValueRow[] };
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The Mondays from one date to another, inclusive, capped so a mistyped window cannot run away. */
export function weeksBetween(from: string, to: string, cap = 26): string[] {
  const weeks: string[] = [];
  let cursor = weekStartOf(from);
  const last = weekStartOf(to);
  while (cursor <= last && weeks.length < cap) {
    weeks.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

/** The week the view opens on: the asked week, else the scenario's week. */
export function chooseWeek(asked: string | null | undefined, scenarioDate: string | null, weeks: readonly string[]): string {
  if (asked && isMonday(asked)) return asked;
  if (scenarioDate) return weekStartOf(scenarioDate);
  return weeks[weeks.length - 1] ?? weekStartOf(new Date().toISOString().slice(0, 10));
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

function activityFor(workspace: PilotWorkspace, weekStarting: string): RoleActivity[] {
  const roleIds = workspace.pilot.roleIds as readonly string[];
  if (roleIds.length === 0) return [];
  const weekEnd = addDays(weekStarting, 7);
  const rows = getSqlite()
    .prepare(
      `SELECT role_id AS roleId,
              sum(CASE WHEN actor_kind = 'human' THEN 1 ELSE 0 END) AS human,
              sum(CASE WHEN type = 'stage-completed' THEN 1 ELSE 0 END) AS stages,
              sum(CASE WHEN type = 'process-completed' THEN 1 ELSE 0 END) AS processes,
              sum(CASE WHEN type = 'decision-recorded' THEN 1 ELSE 0 END) AS decisions
         FROM os_events
        WHERE run_id = ? AND role_id IN (${placeholders(roleIds.length)})
          AND occurred_at >= ? AND occurred_at < ?
        GROUP BY role_id`,
    )
    .all(workspace.runId, ...roleIds, `${weekStarting}T00:00:00.000Z`, `${weekEnd}T00:00:00.000Z`) as Array<{
    roleId: string;
    human: number;
    stages: number;
    processes: number;
    decisions: number;
  }>;
  return roleIds.map((roleId) => {
    const row = rows.find((entry) => entry.roleId === roleId);
    return {
      roleId,
      label: workspace.roles.find((role) => role.roleId === roleId)?.label ?? roleId,
      humanActions: Number(row?.human ?? 0),
      stagesCompleted: Number(row?.stages ?? 0),
      processesCompleted: Number(row?.processes ?? 0),
      decisionsRecorded: Number(row?.decisions ?? 0),
    };
  });
}

/** Assembles one week of the pilot. */
export function readPilotWeek(workspace: PilotWorkspace, askedWeek?: string | null): PilotWeek {
  const window =
    workspace.pilot.plannedStartOn && workspace.pilot.plannedEndOn
      ? weeksBetween(workspace.pilot.plannedStartOn, workspace.pilot.plannedEndOn)
      : [];
  const readingWeeks = workspace.readings.map((entry) => entry.weekStarting);
  const scenarioWeek = workspace.scenarioDate ? [weekStartOf(workspace.scenarioDate)] : [];
  const weeks = [...new Set([...window, ...readingWeeks, ...scenarioWeek])].sort();
  const weekStarting = chooseWeek(askedWeek, workspace.scenarioDate, weeks);
  if (!weeks.includes(weekStarting)) {
    weeks.push(weekStarting);
    weeks.sort();
  }
  const weekEnd = addDays(weekStarting, 7);

  /* ---- adoption and completion ---- */
  let byRole: RoleActivity[] = [];
  let activityReading: StatusReading;
  try {
    byRole = activityFor(workspace, weekStarting);
    const total = byRole.reduce((sum, entry) => sum + entry.humanActions, 0);
    activityReading =
      total === 0
        ? reading(
            "empty",
            "No action by a person is recorded on the pilot roles' desks in this week.",
            "In dieser Woche ist auf den Arbeitslisten der Pilotrollen keine Handlung einer Person erfasst.",
          )
        : reading(
            "simulated",
            `${total} actions by people on the pilot roles' desks, from the event backbone of the synthetic institution. Counted per role, never per person.`,
            `${total} Handlungen von Personen auf den Arbeitslisten der Pilotrollen, aus dem Ereignisstrom der synthetischen Institution. Je Rolle gezaehlt, nie je Person.`,
          );
  } catch {
    activityReading = reading("unavailable", "The event backbone could not be read.", "Der Ereignisstrom konnte nicht gelesen werden.");
  }

  let experience: Array<{ kind: string; count: number }> = [];
  let experienceReading: StatusReading;
  try {
    experience = aggregateExperienceEvents(
      {
        runId: workspace.runId,
        ...(workspace.cohort ? { cohortId: workspace.cohort.id } : {}),
        from: `${weekStarting}T00:00:00.000Z`,
        to: `${weekEnd}T00:00:00.000Z`,
      },
      ["kind"],
    ).map((row) => ({ kind: String(row.kind ?? ""), count: row.count }));
    const total = experience.reduce((sum, entry) => sum + entry.count, 0);
    experienceReading =
      total === 0
        ? reading(
            "empty",
            "The experience recorder holds no interaction for the cohort in this week.",
            "Der Nutzungsrekorder enthaelt fuer die Kohorte in dieser Woche keine Interaktion.",
          )
        : reading(
            "simulated",
            `${total} interactions recorded for the cohort as a whole. No person is stored with them.`,
            `${total} Interaktionen fuer die Kohorte insgesamt erfasst. Keine Person ist dabei gespeichert.`,
          );
  } catch {
    experienceReading = reading("unavailable", "The experience recorder could not be read.", "Der Nutzungsrekorder konnte nicht gelesen werden.");
  }

  const stages = byRole.reduce((sum, entry) => sum + entry.stagesCompleted, 0);
  const processes = byRole.reduce((sum, entry) => sum + entry.processesCompleted, 0);
  const decisions = byRole.reduce((sum, entry) => sum + entry.decisionsRecorded, 0);
  const completionReading =
    activityReading.status === "unavailable"
      ? activityReading
      : stages + processes + decisions === 0
        ? reading(
            "empty",
            "No stage, process run or decision was completed on the pilot roles' desks in this week.",
            "In dieser Woche wurde auf den Arbeitslisten der Pilotrollen keine Stufe, kein Prozesslauf und keine Entscheidung abgeschlossen.",
          )
        : reading(
            "simulated",
            "Completions on the pilot roles' desks, from the event backbone of the synthetic institution.",
            "Abschluesse auf den Arbeitslisten der Pilotrollen, aus dem Ereignisstrom der synthetischen Institution.",
          );

  /* ---- issues ---- */
  const open = workspace.issues.filter((issue) => issue.status === "open");
  const inWeek = (iso: string | null) => iso !== null && iso >= `${weekStarting}T00:00:00.000Z` && iso < `${weekEnd}T00:00:00.000Z`;

  /* ---- feedback ---- */
  let items: ProductFeedbackItem[] = [];
  let feedbackReading: StatusReading;
  try {
    const apps = new Set(workspace.pilot.roleAppIds);
    const roles = new Set(workspace.pilot.roleIds as readonly string[]);
    items = listProductFeedback({ limit: 200 }).filter(
      (item) => (item.roleAppId !== null && apps.has(item.roleAppId)) || (item.roleId !== null && roles.has(item.roleId)),
    );
    feedbackReading =
      items.length === 0
        ? reading(
            "empty",
            "No structured feedback is recorded on the pilot's roles or Role Apps yet.",
            "Zu den Rollen und Rollen-Apps des Piloten ist noch keine strukturierte Rueckmeldung erfasst.",
          )
        : reading(
            "simulated",
            `${items.length} feedback items on the pilot's roles and Role Apps, from the product feedback inbox.`,
            `${items.length} Rueckmeldungen zu den Rollen und Rollen-Apps des Piloten, aus dem Eingang fuer Produktrueckmeldungen.`,
          );
  } catch {
    feedbackReading = reading("unavailable", "The feedback inbox could not be read.", "Der Rueckmeldungseingang konnte nicht gelesen werden.");
  }
  const byStatus: Partial<Record<ProductFeedbackStatus, number>> = {};
  for (const item of items) byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;

  /* ---- quality ---- */
  const evidence = readEvaluationEvidence();
  const qualityByRole = (workspace.pilot.roleIds as readonly string[]).map((roleId) => {
    const scoped = evaluationReadingsForRole(evidence, roleId);
    return { roleId, harness: scoped.harness, cases: scoped.tally.cases };
  });
  let runs = 0;
  try {
    runs = (workspace.pilot.roleIds as readonly string[]).reduce((sum, roleId) => sum + listEvaluationRuns({ roleId }).length, 0);
  } catch {
    runs = 0;
  }

  /* ---- value ---- */
  const rows: WeeklyValueRow[] = workspace.measures.map((entry) => {
    const found = entry.readings.find((candidate) => candidate.weekStarting === weekStarting) ?? null;
    const baseline = entry.measure.baselineStatus === "measured" ? entry.measure.baselineValue : null;
    const value = found && found.status === "measured" ? found.value : null;
    return {
      entry,
      reading: found,
      difference: baseline !== null && value !== null ? Math.round((value - baseline) * 100) / 100 : null,
    };
  });
  const recorded = rows.filter((row) => row.reading !== null).length;
  const valueReading =
    recorded === 0
      ? reading(
          "empty",
          "No reading is recorded for this week. Readings are entered by the pilot lead from the design partner's records.",
          "Fuer diese Woche ist kein Wert erfasst. Werte erfasst die Pilotleitung aus den Unterlagen des Designpartners.",
        )
      : reading(
          "not-verified",
          `${recorded} of ${rows.length} measures have a reading for this week, as the pilot lead recorded them. The product does not verify a reading.`,
          `${recorded} von ${rows.length} Kennzahlen haben fuer diese Woche einen Wert, wie die Pilotleitung ihn erfasst hat. Das Produkt prueft keinen Wert.`,
        );

  return {
    weekStarting,
    weeks,
    inWindow: window.includes(weekStarting),
    adoption: { reading: activityReading, byRole, experience, experienceReading },
    completion: { reading: completionReading, stages, processes, decisions },
    issues: {
      open: open.filter((issue) => issue.kind === "issue"),
      risks: open.filter((issue) => issue.kind === "risk"),
      decisions: open.filter((issue) => issue.kind === "decision-required"),
      raisedThisWeek: workspace.issues.filter((issue) => inWeek(issue.raisedAt)).length,
      resolvedThisWeek: workspace.issues.filter((issue) => inWeek(issue.resolvedAt)).length,
    },
    feedback: { reading: feedbackReading, items, byStatus },
    quality: { harness: evidence.harness, modelOutput: evidence.modelOutput, byRole: qualityByRole, runs },
    value: { reading: valueReading, rows },
  };
}

/** The week label, for headings: "Week of 05.10.2026". */
export function weekLabel(weekStarting: string, language: "en" | "de"): string {
  const [year, month, day] = weekStarting.split("-");
  const date = `${day}.${month}.${year}`;
  return language === "de" ? `Woche ab ${date}` : `Week of ${date}`;
}

export type { Bilingual };
