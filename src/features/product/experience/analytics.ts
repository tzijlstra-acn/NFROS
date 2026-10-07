/**
 * Experience analytics (plan 7.4): how the working day is used, in aggregate.
 *
 * Nine measures, each from the one place that records it:
 *
 *   time to first meaningful action   per role and day: the first "workday
 *                                     opened" to the first human action after
 *                                     it that day (median over role-days)
 *   Now item opened, evidence opened,  `experience_events` (0006), written by a
 *   meeting preparation reviewed       recording point; see `RECORDING`
 *   minutes confirmed                 `os_events` meeting-completed
 *   message converted to work         `inbox_messages.conversion_kind` (0008)
 *   action completed                  `action_updates` of kind CMP
 *   decision completed                `os_events` decision-recorded
 *   process stage completed           `os_events` stage-completed
 *
 * Filters: role, legal entity, process, cohort, week and mode. Not every
 * source carries every dimension (the backbone has no legal entity, cohort or
 * mode); a filter that cannot apply to a measure is reported as such and the
 * measure is not silently counted unfiltered.
 *
 * No keystrokes, no dwell times, no person: no source here is grouped by a
 * user, and nothing scores or ranks anyone.
 *
 * Server only.
 */

import { getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID, ROLE_IDS, type RoleId } from "@/db/schema/core";
import { aggregateExperienceEvents } from "@/db/repositories/experience-events";
import type { ExperienceEventKind } from "@/db/schema/product-console";
import { PROCESS_DEFINITIONS, ROLE_APP_REGISTRY } from "@/role-apps/registry";
import type { Bilingual } from "../permissions";
import { median } from "../role-apps/performance";

export interface ExperienceFilters {
  roleId: RoleId | null;
  legalEntityId: string | null;
  processId: string | null;
  cohortId: string | null;
  /** ISO date of a Monday. */
  week: string | null;
  mode: "live" | "safe" | "offline" | null;
}

export type FilterDimension = keyof ExperienceFilters;

export interface ExperienceMeasure {
  key: string;
  label: Bilingual;
  /** Null when the source could not be read. */
  value: number | null;
  /** "count" or a duration in ms. */
  unit: "count" | "duration";
  source: string;
  /** Whether anything records this interaction yet. */
  recorded: boolean;
  /** Filters set that this measure's source cannot apply. */
  notApplied: FilterDimension[];
  note: Bilingual | null;
}

/** Which interactions are recorded, and where. Stated on the page. */
export const RECORDING: Record<ExperienceEventKind, { recorded: boolean; where: Bilingual }> = {
  "workday-opened": {
    recorded: true,
    where: { en: "Recorded when a role's Home opens (one event per visit, no user stored).", de: "Erfasst, wenn die Startseite einer Rolle oeffnet (ein Ereignis je Besuch, ohne Benutzer)." },
  },
  "now-item-opened": {
    recorded: false,
    where: { en: "Not recorded yet: no recording point on the Now item.", de: "Noch nicht erfasst: kein Erfassungspunkt am Jetzt-Eintrag." },
  },
  "evidence-opened": {
    recorded: false,
    where: { en: "Not recorded yet: no recording point on the evidence viewer.", de: "Noch nicht erfasst: kein Erfassungspunkt in der Nachweisansicht." },
  },
  "meeting-preparation-reviewed": {
    recorded: false,
    where: { en: "Not recorded yet: no recording point on meeting preparation.", de: "Noch nicht erfasst: kein Erfassungspunkt an der Besprechungsvorbereitung." },
  },
};

export const PROCESS_OPTIONS = PROCESS_DEFINITIONS.map((process) => ({ id: process.id, label: { en: process.name, de: process.nameDe } }));

function weekBounds(week: string | null): { from: string; to: string } | null {
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) return null;
  const start = new Date(`${week}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Parses the page's query into filters; anything unknown is ignored. */
export function parseExperienceFilters(query: Record<string, string | string[] | undefined>): ExperienceFilters {
  const one = (key: string) => {
    const value = query[key];
    const text = Array.isArray(value) ? value[0] : value;
    return typeof text === "string" && /^[A-Za-z0-9._:-]{1,80}$/.test(text) ? text : null;
  };
  const role = one("role");
  const mode = one("mode");
  return {
    roleId: role && (ROLE_IDS as readonly string[]).includes(role) ? (role as RoleId) : null,
    legalEntityId: one("entity"),
    processId: PROCESS_OPTIONS.some((option) => option.id === one("process")) ? one("process") : null,
    cohortId: one("cohort"),
    week: weekBounds(one("week")) ? one("week") : null,
    mode: mode === "live" || mode === "safe" || mode === "offline" ? mode : null,
  };
}

function setFilters(filters: ExperienceFilters, supported: readonly FilterDimension[]): FilterDimension[] {
  return (Object.keys(filters) as FilterDimension[]).filter((key) => filters[key] !== null && !supported.includes(key));
}

function processRunIds(processId: string, runId: string): string[] {
  const apps = ROLE_APP_REGISTRY.filter((app) => app.processId === processId).map((app) => app.id);
  if (apps.length === 0) return [];
  const rows = getSqlite()
    .prepare(`SELECT id FROM role_app_runs WHERE run_id = ? AND role_app_id IN (${apps.map(() => "?").join(",")})`)
    .all(runId, ...apps) as Array<{ id: string }>;
  return rows.map((row) => row.id);
}

function countOsEvents(type: string, filters: ExperienceFilters, runId: string): number | null {
  try {
    const where = ["run_id = ?", "type = ?"];
    const params: unknown[] = [runId, type];
    if (filters.roleId) {
      where.push("role_id = ?");
      params.push(filters.roleId);
    }
    const bounds = weekBounds(filters.week);
    if (bounds) {
      where.push("occurred_at >= ? AND occurred_at < ?");
      params.push(bounds.from, bounds.to);
    }
    if (filters.processId) {
      const ids = processRunIds(filters.processId, runId);
      if (ids.length === 0) return 0;
      where.push(`process_run_id IN (${ids.map(() => "?").join(",")})`);
      params.push(...ids);
    }
    const row = getSqlite().prepare(`SELECT count(*) AS n FROM os_events WHERE ${where.join(" AND ")}`).get(...params) as { n: number };
    return Number(row.n);
  } catch {
    return null;
  }
}

function countConversions(filters: ExperienceFilters, runId: string): number | null {
  try {
    const where = ["run_id = ?", "converted_at IS NOT NULL", "conversion_kind IN ('action','decision','evidence','process','delegated')"];
    const params: unknown[] = [runId];
    if (filters.roleId) {
      where.push("role_id = ?");
      params.push(filters.roleId);
    }
    const bounds = weekBounds(filters.week);
    if (bounds) {
      where.push("converted_at >= ? AND converted_at < ?");
      params.push(bounds.from, bounds.to);
    }
    const row = getSqlite().prepare(`SELECT count(*) AS n FROM inbox_messages WHERE ${where.join(" AND ")}`).get(...params) as { n: number };
    return Number(row.n);
  } catch {
    return null;
  }
}

function countCompletedActions(filters: ExperienceFilters, runId: string): number | null {
  try {
    const where = ["u.run_id = ?", "u.kind = 'CMP'"];
    const params: unknown[] = [runId];
    if (filters.roleId) {
      where.push("a.role_id = ?");
      params.push(filters.roleId);
    }
    const bounds = weekBounds(filters.week);
    if (bounds) {
      where.push("u.at >= ? AND u.at < ?");
      params.push(bounds.from, bounds.to);
    }
    const row = getSqlite()
      .prepare(`SELECT count(*) AS n FROM action_updates u JOIN actions a ON a.id = u.action_id AND a.run_id = u.run_id WHERE ${where.join(" AND ")}`)
      .get(...params) as { n: number };
    return Number(row.n);
  } catch {
    return null;
  }
}

const MEANINGFUL_TYPES = ["decision-recorded", "human-task-completed", "meeting-completed", "stage-completed", "approval-granted"];

/** Per role and day: first workday opened to the first human action after it. Pure. */
export function firstActionDelays(
  opened: ReadonlyArray<{ roleId: string; occurredAt: string }>,
  actions: ReadonlyArray<{ roleId: string | null; occurredAt: string }>,
): number[] {
  const firstOpen = new Map<string, string>();
  for (const event of opened) {
    const key = `${event.roleId}:${event.occurredAt.slice(0, 10)}`;
    const current = firstOpen.get(key);
    if (!current || event.occurredAt < current) firstOpen.set(key, event.occurredAt);
  }
  const delays: number[] = [];
  for (const [key, openedAt] of firstOpen) {
    const [roleId, day] = key.split(":");
    const first = actions
      .filter((event) => event.roleId === roleId && event.occurredAt.slice(0, 10) === day && event.occurredAt >= openedAt)
      .map((event) => event.occurredAt)
      .sort()[0];
    if (first) delays.push(Date.parse(first) - Date.parse(openedAt));
  }
  return delays;
}

function timeToFirstAction(filters: ExperienceFilters, runId: string): { value: number | null; days: number } {
  try {
    const bounds = weekBounds(filters.week);
    const opened = getSqlite()
      .prepare(
        `SELECT role_id AS roleId, occurred_at AS occurredAt FROM experience_events WHERE run_id = ? AND kind = 'workday-opened'${filters.roleId ? " AND role_id = ?" : ""}${filters.mode ? " AND mode = ?" : ""}${bounds ? " AND occurred_at >= ? AND occurred_at < ?" : ""}`,
      )
      .all(runId, ...(filters.roleId ? [filters.roleId] : []), ...(filters.mode ? [filters.mode] : []), ...(bounds ? [bounds.from, bounds.to] : [])) as Array<{ roleId: string; occurredAt: string }>;
    if (opened.length === 0) return { value: null, days: 0 };
    const actions = getSqlite()
      .prepare(`SELECT role_id AS roleId, occurred_at AS occurredAt FROM os_events WHERE run_id = ? AND actor_kind = 'human' AND type IN (${MEANINGFUL_TYPES.map(() => "?").join(",")})`)
      .all(runId, ...MEANINGFUL_TYPES) as Array<{ roleId: string | null; occurredAt: string }>;
    const delays = firstActionDelays(opened, actions);
    return { value: median(delays), days: delays.length };
  } catch {
    return { value: null, days: 0 };
  }
}

export interface ExperienceView {
  filters: ExperienceFilters;
  measures: ExperienceMeasure[];
  weeks: string[];
  cohorts: Array<{ id: string; name: Bilingual }>;
  legalEntities: Array<{ id: string; name: string }>;
}

export function readExperienceView(filters: ExperienceFilters, runId: string = DEFAULT_RUN_ID): ExperienceView {
  const bounds = weekBounds(filters.week);
  const experienceCounts = (() => {
    try {
      return aggregateExperienceEvents(
        {
          runId,
          ...(filters.roleId ? { roleId: filters.roleId } : {}),
          ...(filters.legalEntityId ? { legalEntityId: filters.legalEntityId } : {}),
          ...(filters.processId ? { processId: filters.processId } : {}),
          ...(filters.cohortId ? { cohortId: filters.cohortId } : {}),
          ...(filters.mode ? { mode: filters.mode } : {}),
          ...(bounds ? { from: bounds.from, to: bounds.to } : {}),
        },
        ["kind"],
      );
    } catch {
      return null;
    }
  })();
  const kindCount = (kind: ExperienceEventKind) => (experienceCounts === null ? null : (experienceCounts.find((row) => row.kind === kind)?.count ?? 0));
  const backbone: FilterDimension[] = ["roleId", "processId", "week"];
  const roleWeek: FilterDimension[] = ["roleId", "week"];
  const first = timeToFirstAction(filters, runId);

  const measures: ExperienceMeasure[] = [
    {
      key: "time-to-first-action",
      label: { en: "Time to first meaningful action", de: "Zeit bis zur ersten wesentlichen Handlung" },
      value: first.value,
      unit: "duration",
      source: "experience_events + os_events",
      recorded: true,
      notApplied: setFilters(filters, ["roleId", "week", "mode"]),
      note:
        first.value === null
          ? { en: "Not measured: no day has both a workday opening and a later human action.", de: "Nicht gemessen: Kein Tag hat sowohl eine Oeffnung des Arbeitstags als auch eine spaetere menschliche Handlung." }
          : { en: `Median over ${first.days} role-day(s).`, de: `Median ueber ${first.days} Rollentag(e).` },
    },
    ...(["now-item-opened", "evidence-opened", "meeting-preparation-reviewed"] as const).map((kind): ExperienceMeasure => ({
      key: kind,
      label:
        kind === "now-item-opened"
          ? { en: "Now item opened", de: "Jetzt-Eintrag geoeffnet" }
          : kind === "evidence-opened"
            ? { en: "Evidence opened", de: "Nachweis geoeffnet" }
            : { en: "Meeting preparation reviewed", de: "Besprechungsvorbereitung geprueft" },
      value: RECORDING[kind].recorded ? kindCount(kind) : null,
      unit: "count",
      source: "experience_events",
      recorded: RECORDING[kind].recorded,
      notApplied: [],
      note: RECORDING[kind].recorded ? null : RECORDING[kind].where,
    })),
    {
      key: "minutes-confirmed",
      label: { en: "Minutes confirmed", de: "Protokolle bestaetigt" },
      value: countOsEvents("meeting-completed", filters, runId),
      unit: "count",
      source: "os_events meeting-completed",
      recorded: true,
      notApplied: setFilters(filters, backbone),
      note: null,
    },
    {
      key: "message-converted",
      label: { en: "Message converted to work", de: "Nachricht in Arbeit umgewandelt" },
      value: countConversions(filters, runId),
      unit: "count",
      source: "inbox_messages.conversion_kind",
      recorded: true,
      notApplied: setFilters(filters, roleWeek),
      note: null,
    },
    {
      key: "action-completed",
      label: { en: "Action completed", de: "Massnahme abgeschlossen" },
      value: countCompletedActions(filters, runId),
      unit: "count",
      source: "action_updates CMP",
      recorded: true,
      notApplied: setFilters(filters, roleWeek),
      note: null,
    },
    {
      key: "decision-completed",
      label: { en: "Decision completed", de: "Entscheidung abgeschlossen" },
      value: countOsEvents("decision-recorded", filters, runId),
      unit: "count",
      source: "os_events decision-recorded",
      recorded: true,
      notApplied: setFilters(filters, backbone),
      note: null,
    },
    {
      key: "stage-completed",
      label: { en: "Process stage completed", de: "Prozessstufe abgeschlossen" },
      value: countOsEvents("stage-completed", filters, runId),
      unit: "count",
      source: "os_events stage-completed",
      recorded: true,
      notApplied: setFilters(filters, backbone),
      note: null,
    },
  ];

  const weeks = (() => {
    try {
      return (
        getSqlite()
          .prepare("SELECT DISTINCT date(occurred_at, '-6 days', 'weekday 1') AS week FROM os_events WHERE run_id = ? ORDER BY week DESC LIMIT 12")
          .all(runId) as Array<{ week: string | null }>
      )
        .map((row) => row.week)
        .filter((week): week is string => typeof week === "string");
    } catch {
      return [];
    }
  })();
  const cohorts = (() => {
    try {
      return (getSqlite().prepare("SELECT id, name, name_de AS nameDe FROM product_cohorts ORDER BY id").all() as Array<{ id: string; name: string; nameDe: string }>).map(
        (row) => ({ id: row.id, name: { en: row.name, de: row.nameDe } }),
      );
    } catch {
      return [];
    }
  })();
  const legalEntities = (() => {
    try {
      return getSqlite().prepare("SELECT id, name FROM legal_entities WHERE run_id = ? ORDER BY id").all(runId) as Array<{ id: string; name: string }>;
    } catch {
      return [];
    }
  })();

  return { filters, measures, weeks, cohorts, legalEntities };
}
