/**
 * What this environment can measure about itself, for each pilot measure.
 *
 * Server only. A pilot baseline is the design partner's own figure, entered by
 * a person or imported, and never invented (`baseline.ts`). Beside it, for the
 * measures the product can compute from its own records, the workspace shows
 * what those records say in this environment. Every such value is read from
 * the synthetic institution, so it is labelled Simulated and shown as
 * "measured from synthetic data". It is evidence that the measurement works,
 * not a result: it is never placed in a baseline, never compared with one and
 * never turned into a saving (plan section 12).
 *
 * Three answers, one per measure:
 *
 *   computed        the product counted it here, with the source named
 *   not computed    the product records something near it, but not the
 *                   measure as defined; the pilot lead records it
 *   not applicable  the product must never track it (time spent by a
 *                   person, systems a person opens)
 */

import { getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import type { MeasureUnit } from "@/db/schema/product-console";
import { getActionUpdatesFor, getWorkActions } from "@/db/repositories/work-hub";
import { classifyAction } from "@/features/work/modules/actions/policy";
import { buildCurrentStageContext } from "@/features/process/context";
import "@/features/process/implementations";
import { getScenarioState } from "@/scenario/engine/state";
import { reading, type StatusReading } from "@/product/status/vocabulary";

type Bilingual = { en: string; de: string };

export type SyntheticKind = "computed" | "not-computed" | "not-applicable";

export interface SyntheticEquivalent {
  measureKey: string;
  kind: SyntheticKind;
  /** Simulated when computed from synthetic data; Empty when the source holds nothing yet. */
  reading: StatusReading;
  value: number | null;
  unit: MeasureUnit;
  /** What exactly was counted, so nobody mistakes it for the measure as the partner defines it. */
  basis: Bilingual;
  source: string;
}

/** The pilot's scope, as the computations need it. */
export interface SyntheticScope {
  roleIds: readonly string[];
  roleAppIds: readonly string[];
  runId?: string;
}

function runIdOf(scope: SyntheticScope): string {
  if (scope.runId) return scope.runId;
  try {
    return getScenarioState()?.runId ?? DEFAULT_RUN_ID;
  } catch {
    return DEFAULT_RUN_ID;
  }
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 1 ? sorted[middle] : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return value === undefined ? null : value;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

/* ==========================================================================
   Computed
   ========================================================================== */

/**
 * Cycle time: calendar days from a process run's start to its completion,
 * for the pilot's Role Apps. A run counts once the process runtime marks it
 * completed and the backbone holds its `process-completed` event.
 */
export function syntheticCycleTime(scope: SyntheticScope): SyntheticEquivalent {
  const base = { measureKey: "cycle-time", unit: "days" as const, source: "role_app_runs, os_events (process-completed)" };
  const runId = runIdOf(scope);
  if (scope.roleAppIds.length === 0) {
    return {
      ...base,
      kind: "computed",
      reading: reading("empty", "The pilot names no Role App.", "Der Pilot nennt keine Rollen-App."),
      value: null,
      basis: { en: "No process in scope.", de: "Kein Prozess im Umfang." },
    };
  }
  try {
    const rows = getSqlite()
      .prepare(
        `SELECT r.id AS id, r.status AS status, r.started_at AS startedAt, r.completed_at AS completedAt,
                EXISTS (SELECT 1 FROM os_events e WHERE e.run_id = r.run_id AND e.process_run_id = r.id AND e.type = 'process-completed') AS published
           FROM role_app_runs r
          WHERE r.run_id = ? AND r.role_app_id IN (${placeholders(scope.roleAppIds.length)})`,
      )
      .all(runId, ...scope.roleAppIds) as Array<{
      id: string;
      status: string;
      startedAt: string;
      completedAt: string | null;
      published: number;
    }>;

    const durations = rows
      .filter((row) => row.status === "completed" && row.completedAt !== null && row.published === 1)
      .map((row) => (Date.parse(row.completedAt ?? "") - Date.parse(row.startedAt)) / 86_400_000)
      .filter((days) => Number.isFinite(days) && days >= 0);
    const open = rows.filter((row) => row.status !== "completed").length;

    if (durations.length === 0) {
      return {
        ...base,
        kind: "computed",
        reading: reading(
          "empty",
          `No process run of the pilot's Role Apps has completed in this environment. ${open} are in progress.`,
          `Kein Prozesslauf der Rollen-Apps des Piloten ist in dieser Umgebung abgeschlossen. ${open} laufen noch.`,
        ),
        value: null,
        basis: {
          en: "Median calendar days from start to completion of completed runs.",
          de: "Median der Kalendertage vom Beginn bis zum Abschluss abgeschlossener Laeufe.",
        },
      };
    }
    const value = round1(median(durations) ?? 0);
    return {
      ...base,
      kind: "computed",
      reading: reading(
        "simulated",
        `Median of ${durations.length} completed process runs of the synthetic institution; ${open} more are in progress.`,
        `Median aus ${durations.length} abgeschlossenen Prozesslaeufen der synthetischen Institution; ${open} weitere laufen noch.`,
      ),
      value,
      basis: {
        en: "Median calendar days from start to completion of completed runs.",
        de: "Median der Kalendertage vom Beginn bis zum Abschluss abgeschlossener Laeufe.",
      },
    };
  } catch {
    return {
      ...base,
      kind: "computed",
      reading: reading("unavailable", "The process runs could not be read.", "Die Prozesslaeufe konnten nicht gelesen werden."),
      value: null,
      basis: { en: "Not read.", de: "Nicht gelesen." },
    };
  }
}

/**
 * Overdue actions: open actions past their due date on the pilot roles'
 * desks, on the scenario date. Classified by the Work Hub's own rule
 * (`classifyAction`), so this count and the Actions tab cannot disagree.
 */
export function syntheticOverdueActions(scope: SyntheticScope): SyntheticEquivalent {
  const base = { measureKey: "overdue-actions", unit: "count" as const, source: "actions, action_updates (Work Hub rule)" };
  const runId = runIdOf(scope);
  try {
    const state = getScenarioState(runId);
    if (!state) {
      return {
        ...base,
        kind: "computed",
        reading: reading("unavailable", "The scenario has not been seeded.", "Das Szenario ist nicht eingespielt."),
        value: null,
        basis: { en: "Not read.", de: "Nicht gelesen." },
      };
    }
    const holders = new Map(
      (getSqlite().prepare("SELECT id, holder_user_id AS holder FROM roles WHERE run_id = ?").all(runId) as Array<{
        id: string;
        holder: string;
      }>).map((row) => [row.id, row.holder]),
    );

    const seen = new Set<string>();
    let open = 0;
    let overdue = 0;
    for (const roleId of scope.roleIds) {
      const holder = holders.get(roleId) ?? null;
      const rows = getWorkActions(roleId as RoleId, holder, runId).filter((row) => !seen.has(row.id));
      const updates = getActionUpdatesFor(rows.map((row) => row.id), runId);
      for (const row of rows) {
        seen.add(row.id);
        const classified = classifyAction(row, updates.get(row.id) ?? [], holder, state.scenarioDate, null);
        if (classified.open) open += 1;
        if (classified.overdue) overdue += 1;
      }
    }
    return {
      ...base,
      kind: "computed",
      reading:
        open === 0
          ? reading("empty", "No open action on the pilot roles' desks.", "Keine offene Massnahme auf den Arbeitslisten der Pilotrollen.")
          : reading(
              "simulated",
              `${overdue} of ${open} open actions on the pilot roles' desks are past their due date on ${state.scenarioDate}, in the synthetic institution.`,
              `${overdue} von ${open} offenen Massnahmen auf den Arbeitslisten der Pilotrollen sind am ${state.scenarioDate} ueberfaellig, in der synthetischen Institution.`,
            ),
      value: open === 0 ? null : overdue,
      basis: {
        en: "Open actions past their due date on the scenario date, counted once each.",
        de: "Offene Massnahmen nach Faelligkeit am Szenariodatum, jede einmal gezaehlt.",
      },
    };
  } catch {
    return {
      ...base,
      kind: "computed",
      reading: reading("unavailable", "The actions could not be read.", "Die Massnahmen konnten nicht gelesen werden."),
      value: null,
      basis: { en: "Not read.", de: "Nicht gelesen." },
    };
  }
}

/**
 * Evidence completeness: the share of required sources the open stage of
 * each active process run can read. This counts sources a stage could read,
 * not evidence a person reviewed, and the basis says so.
 */
export function syntheticEvidenceCompleteness(scope: SyntheticScope): SyntheticEquivalent {
  const base = {
    measureKey: "evidence-completeness",
    unit: "percent" as const,
    source: "role_app_runs, process stage contracts (required sources)",
  };
  const runId = runIdOf(scope);
  const basis = {
    en: "Required sources readable at the open stage of each active process run. A source a stage can read is not yet evidence a person reviewed.",
    de: "Erforderliche Quellen, die die offene Stufe jedes aktiven Prozesslaufs lesen kann. Eine lesbare Quelle ist noch kein von einer Person gepruefter Nachweis.",
  };
  if (scope.roleAppIds.length === 0) {
    return {
      ...base,
      kind: "computed",
      reading: reading("empty", "The pilot names no Role App.", "Der Pilot nennt keine Rollen-App."),
      value: null,
      basis,
    };
  }
  try {
    const runs = getSqlite()
      .prepare(
        `SELECT id FROM role_app_runs WHERE run_id = ? AND status NOT IN ('completed', 'archived')
            AND role_app_id IN (${placeholders(scope.roleAppIds.length)})`,
      )
      .all(runId, ...scope.roleAppIds) as Array<{ id: string }>;

    let required = 0;
    let readable = 0;
    let stages = 0;
    for (const run of runs) {
      try {
        const context = buildCurrentStageContext(run.id, runId);
        const requiredSources = context.sources.filter((source) => source.necessity === "required");
        if (requiredSources.length === 0) continue;
        stages += 1;
        required += requiredSources.length;
        readable += requiredSources.filter((source) => source.status !== "unavailable").length;
      } catch {
        /* A run whose stage cannot be built is not counted; the process page reports why. */
      }
    }
    if (required === 0) {
      return {
        ...base,
        kind: "computed",
        reading: reading(
          "empty",
          "No open stage of the pilot's process runs names a required source.",
          "Keine offene Stufe der Prozesslaeufe des Piloten nennt eine erforderliche Quelle.",
        ),
        value: null,
        basis,
      };
    }
    const value = Math.round((readable / required) * 100);
    return {
      ...base,
      kind: "computed",
      reading: reading(
        "simulated",
        `${readable} of ${required} required sources are readable across ${stages} open stages, read from the synthetic institution through simulated connectors.`,
        `${readable} von ${required} erforderlichen Quellen sind in ${stages} offenen Stufen lesbar, aus der synthetischen Institution ueber simulierte Konnektoren gelesen.`,
      ),
      value,
      basis,
    };
  } catch {
    return {
      ...base,
      kind: "computed",
      reading: reading("unavailable", "The process runs could not be read.", "Die Prozesslaeufe konnten nicht gelesen werden."),
      value: null,
      basis,
    };
  }
}

/* ==========================================================================
   Not computed, not applicable
   ========================================================================== */

function notComputed(measureKey: string, unit: MeasureUnit, en: string, de: string): SyntheticEquivalent {
  return {
    measureKey,
    kind: "not-computed",
    reading: reading("unavailable", en, de),
    value: null,
    unit,
    basis: { en: "Recorded by the pilot lead.", de: "Von der Pilotleitung erfasst." },
    source: "recorded-by-pilot-lead",
  };
}

function notApplicable(measureKey: string, unit: MeasureUnit, en: string, de: string): SyntheticEquivalent {
  return {
    measureKey,
    kind: "not-applicable",
    reading: reading("unavailable", en, de),
    value: null,
    unit,
    basis: { en: "Never tracked by the product.", de: "Wird vom Produkt nie erfasst." },
    source: "recorded-by-pilot-lead",
  };
}

/**
 * The synthetic equivalent of every seeded measure, by key.
 *
 * A measure added later with an unknown key gets an honest "not computed"
 * rather than a guess.
 */
export function readSyntheticEquivalents(scope: SyntheticScope): Map<string, SyntheticEquivalent> {
  const entries: SyntheticEquivalent[] = [
    notApplicable(
      "preparation-time",
      "minutes",
      "The product does not time people, so it has no preparation time of its own. The pilot lead records it with the design partner.",
      "Das Produkt misst keine Arbeitszeit von Personen und hat daher keine eigene Vorbereitungszeit. Die Pilotleitung erfasst sie mit dem Designpartner.",
    ),
    syntheticCycleTime(scope),
    notComputed(
      "handoffs",
      "count",
      "The product records delegations and first-line requests, but not every handoff between people, so it does not count this measure.",
      "Das Produkt erfasst Delegationen und Anfragen an die erste Linie, aber nicht jede Uebergabe zwischen Personen, daher zaehlt es diese Kennzahl nicht.",
    ),
    notApplicable(
      "systems-opened",
      "count",
      "Systems a person opens are observed by the pilot lead, never tracked by the product.",
      "Von einer Person geoeffnete Systeme beobachtet die Pilotleitung; das Produkt erfasst sie nie.",
    ),
    syntheticOverdueActions(scope),
    syntheticEvidenceCompleteness(scope),
  ];
  return new Map(entries.map((entry) => [entry.measureKey, entry]));
}

/** The answer for a measure key the product does not know how to compute. */
export function unknownSyntheticEquivalent(measureKey: string, unit: MeasureUnit): SyntheticEquivalent {
  return notComputed(
    measureKey,
    unit,
    "The product has no computation for this measure. The pilot lead records it.",
    "Fuer diese Kennzahl hat das Produkt keine Berechnung. Die Pilotleitung erfasst sie.",
  );
}
