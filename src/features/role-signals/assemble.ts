/**
 * Pure assembly of role signals from rows.
 *
 * Nothing in this file touches the database. Each function takes the rows a
 * repository already returned and turns them into a signal, so the rules that
 * matter can be tested against hand built input: which calendar entry counts
 * as the next meeting, how a run and its stage rows become "Stage 2 of 8", and
 * what is said when there is nothing to say.
 *
 * The rules, stated once:
 *
 * - Current focus is the queue's Now item. The queue already owns ordering and
 *   deduplication, so this file never re-ranks anything.
 * - Active process is the run of the role's installed Role App. Stage progress
 *   is read from the stage run rows: a stage counts as completed because a row
 *   says so, not because its sequence is lower than the current one.
 * - Next meeting is the first calendar entry on the scenario day that is not
 *   focus time and starts at or after the scenario clock. Focus time is the
 *   professional's own work block, not a meeting.
 */

import type { RoleId } from "@/db/schema/core";
import type { Language } from "@/i18n/labels";
import type { FocusItemView } from "@/workday/contracts";
import { momentToMinutes } from "@/domain/nfr/calculators";
import { fill, pick, ROLE_SIGNAL_LABELS as L, STAGE_STATUS_LABELS, type Pair } from "./labels";
import type {
  FocusSignal,
  MeetingSignal,
  ProcessSignal,
  ProcessStageMark,
  RoleSignals,
} from "./types";

/* ==========================================================================
   Current focus
   ========================================================================== */

export function focusSignalFrom(now: FocusItemView | null, language: Language): FocusSignal {
  if (now === null) {
    return { state: "empty", value: pick(L.focusEmpty, language), href: null, needsJudgment: false };
  }
  return {
    state: "present",
    value: now.title,
    href: now.href,
    needsJudgment: now.section === "needs-you",
  };
}

/* ==========================================================================
   Active process
   ========================================================================== */

/*
 * The inputs are the minimum of each row or definition this file reads,
 * stated structurally. A Role App definition and a run row both satisfy them
 * as they are, and the stage contract can grow without this file, or its
 * tests, having to follow.
 */

/** The minimum of a Role App definition this file needs. */
export interface RoleAppInput {
  name: string;
  nameDe: string;
  entryRoute: string | null;
}

/** The minimum of a process definition this file needs. */
export interface ProcessDefinitionInput {
  stages: ReadonlyArray<{ id: string; sequence: number; name: string; nameDe: string }>;
}

/** The minimum of a run row this file needs. */
export interface ProcessRunInput {
  id: string;
  currentStageId: string;
  status: string;
}

/** The minimum of a stage run row this file needs. */
export interface StageRunInput {
  stageId: string;
  status: string;
}

export interface ProcessSignalInput {
  app: RoleAppInput | null;
  process: ProcessDefinitionInput | null;
  run: ProcessRunInput | null;
  stageRuns: readonly StageRunInput[];
  language: Language;
}

function emptyProcess(language: Language): ProcessSignal {
  return {
    state: "empty",
    value: pick(L.processEmpty, language),
    processName: null,
    stageName: null,
    stageSequence: null,
    stageCount: null,
    stageStatus: null,
    runStatus: null,
    stages: [],
    href: null,
  };
}

export function processSignalFrom(input: ProcessSignalInput): ProcessSignal {
  const { app, process, run, stageRuns, language } = input;
  if (app === null || process === null || run === null) return emptyProcess(language);

  const processName = language === "de" ? app.nameDe : app.name;
  const ordered = [...process.stages].sort((a, b) => a.sequence - b.sequence);
  const stageCount = ordered.length;
  const current = ordered.find((stage) => stage.id === run.currentStageId) ?? null;
  const statusByStage = new Map(stageRuns.map((row) => [row.stageId, row.status]));

  const stages: ProcessStageMark[] = ordered.map((stage) => ({
    id: stage.id,
    sequence: stage.sequence,
    name: language === "de" ? stage.nameDe : stage.name,
    progress:
      statusByStage.get(stage.id) === "completed" || run.status === "completed"
        ? "completed"
        : stage.id === run.currentStageId
          ? "current"
          : "upcoming",
  }));

  const base = {
    processName,
    stageCount,
    runStatus: run.status,
    stages,
    href: app.entryRoute,
  };

  /*
   * A completed or unstarted run is stated as such. Writing "Stage 8 of 8"
   * for a closed assessment would describe work that is no longer running.
   */
  if (run.status === "completed" || run.status === "not-started") {
    const word = run.status === "completed" ? L.runCompleted : L.runNotStarted;
    return {
      ...base,
      state: "present",
      value: `${processName}, ${pick(word, language)}`,
      stageName: null,
      stageSequence: null,
      stageStatus: null,
    };
  }

  /*
   * A stage identifier the definition does not contain is a data defect. It
   * is reported as one, because inventing a position would hide it.
   */
  if (current === null) {
    return {
      ...base,
      state: "unavailable",
      value: `${processName}: ${pick(L.stageNotRecognised, language)}`,
      stageName: null,
      stageSequence: null,
      stageStatus: null,
    };
  }

  const stageStatusRaw = run.status === "blocked" ? "blocked" : (statusByStage.get(current.id) ?? null);
  const stageStatusPair: Pair | undefined =
    stageStatusRaw === null ? undefined : STAGE_STATUS_LABELS[stageStatusRaw];
  const stageText = fill(pick(L.stageOf, language), { n: current.sequence, total: stageCount });
  const blocked = run.status === "blocked" ? `, ${pick(L.runBlocked, language)}` : "";

  return {
    ...base,
    state: "present",
    value: `${processName}, ${stageText}${blocked}`,
    stageName: language === "de" ? current.nameDe : current.name,
    stageSequence: current.sequence,
    stageStatus: stageStatusPair ? pick(stageStatusPair, language) : stageStatusRaw,
  };
}

/* ==========================================================================
   Next meeting
   ========================================================================== */

/** The minimum of a calendar row this file needs. */
export interface CalendarEntryInput {
  id: string;
  title: string;
  titleDe: string;
  startsAt: string;
  kind: string;
}

/** Calendar kinds that are the professional's own time, not a meeting. */
export const NON_MEETING_KINDS: readonly string[] = ["focus-time"];

/**
 * HH:MM from a stored start.
 *
 * The scenario stores the day as ISO strings whose clock part IS the scenario
 * clock, and every other screen reads it with the same slice. Converting it
 * through a time zone here would make this one surface disagree with the
 * agenda by the server's offset.
 */
export function startTimeOf(startsAt: string): string {
  return startsAt.length >= 16 ? startsAt.slice(11, 16) : startsAt;
}

function minutesOf(moment: string): number | null {
  if (!/^\d{1,2}:\d{2}$/.test(moment)) return null;
  return momentToMinutes(moment);
}

export type NextMeetingSelection<T extends CalendarEntryInput> =
  | { outcome: "next"; entry: T }
  | { outcome: "none-scheduled" }
  | { outcome: "none-remaining" };

/**
 * The next meeting, or why there is none.
 *
 * "None scheduled" and "none remaining" are different facts and are kept
 * apart: a calendar with no meetings at all and a calendar whose last meeting
 * finished at 16:30 should not read the same at 17:00.
 */
export function selectNextMeeting<T extends CalendarEntryInput>(
  entries: readonly T[],
  atMoment: string,
  scenarioDate: string | null,
): NextMeetingSelection<T> {
  const today = entries.filter(
    (entry) =>
      !NON_MEETING_KINDS.includes(entry.kind) &&
      (scenarioDate === null || entry.startsAt.slice(0, 10) === scenarioDate),
  );
  if (today.length === 0) return { outcome: "none-scheduled" };

  const now = minutesOf(atMoment);
  const upcoming = today
    .map((entry) => ({ entry, start: minutesOf(startTimeOf(entry.startsAt)) }))
    .filter((row): row is { entry: T; start: number } => row.start !== null)
    .filter((row) => now === null || row.start >= now)
    .sort((a, b) => a.start - b.start || a.entry.id.localeCompare(b.entry.id));

  const first = upcoming[0];
  return first ? { outcome: "next", entry: first.entry } : { outcome: "none-remaining" };
}

export function meetingSignalFrom<T extends CalendarEntryInput>(
  selection: NextMeetingSelection<T>,
  language: Language,
  href: string | null,
): MeetingSignal {
  if (selection.outcome === "none-scheduled") {
    return { state: "empty", value: pick(L.meetingNoneScheduled, language), time: null, href: null };
  }
  if (selection.outcome === "none-remaining") {
    return { state: "empty", value: pick(L.meetingNoneRemaining, language), time: null, href: null };
  }
  const { entry } = selection;
  return {
    state: "present",
    value: language === "de" && entry.titleDe.length > 0 ? entry.titleDe : entry.title,
    time: startTimeOf(entry.startsAt),
    href,
  };
}

/* ==========================================================================
   Unavailable
   ========================================================================== */

/**
 * Every signal for a role, stated as unavailable.
 *
 * Used when the database has no scenario or a read failed. The reason is
 * carried in the value so a reader is not left guessing whether "nothing" is
 * an answer or an outage.
 */
export function unavailableSignals(
  roleId: RoleId,
  language: Language,
  reason: "not-seeded" | "read-failed",
): RoleSignals {
  const value = pick(reason === "not-seeded" ? L.unavailableNotSeeded : L.unavailableReadFailed, language);
  return {
    roleId,
    atMoment: null,
    scenarioDate: null,
    focus: { state: "unavailable", value, href: null, needsJudgment: false },
    process: {
      state: "unavailable",
      value,
      processName: null,
      stageName: null,
      stageSequence: null,
      stageCount: null,
      stageStatus: null,
      runStatus: null,
      stages: [],
      href: null,
    },
    meeting: { state: "unavailable", value, time: null, href: null },
  };
}
