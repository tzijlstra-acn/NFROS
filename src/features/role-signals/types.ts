/**
 * The shape of a role signal.
 *
 * A role signal is the one line of real work that tells a professional why to
 * enter a role now: what needs them, which process is running and at which
 * stage, and what is next on the calendar. Every value is read from rows that
 * exist. When there is nothing to say, the signal says that, in words, with
 * `state: "empty"`. When the database cannot answer, it says that instead,
 * with `state: "unavailable"`. There is no third path in which a plausible
 * sentence is substituted for a missing row.
 *
 * The status words follow the product vocabulary: a signal is either present,
 * Empty or Unavailable.
 */

import type { RoleId } from "@/db/schema/core";

export type SignalState = "present" | "empty" | "unavailable";

/** The top Now item on the role's focus queue. */
export interface FocusSignal {
  state: SignalState;
  /** The Now item title, or the empty or unavailable sentence. */
  value: string;
  /** Where the item opens, when there is one. */
  href: string | null;
  /** True when the item is waiting on the person rather than prepared for review. */
  needsJudgment: boolean;
}

/** One stage of the active process, for a compact progress rendering. */
export interface ProcessStageMark {
  id: string;
  sequence: number;
  name: string;
  /** Read from the stage run rows, not inferred from the sequence alone. */
  progress: "completed" | "current" | "upcoming";
}

/** The installed Role App's run for the role, and the stage it is on. */
export interface ProcessSignal {
  state: SignalState;
  /** One line, for example "RCSA Cycle Assistant, Stage 2 of 8". */
  value: string;
  processName: string | null;
  stageName: string | null;
  stageSequence: number | null;
  stageCount: number | null;
  /** The current stage status in plain words, for example "Waiting for your input". */
  stageStatus: string | null;
  /** The run status as recorded, for example "in-progress". */
  runStatus: string | null;
  stages: ProcessStageMark[];
  href: string | null;
}

/** The next calendar entry that is a meeting, from the scenario clock onwards. */
export interface MeetingSignal {
  state: SignalState;
  /** The meeting title, or the empty or unavailable sentence. */
  value: string;
  /** Start time as HH:MM, when there is a meeting. */
  time: string | null;
  href: string | null;
}

export interface RoleSignals {
  roleId: RoleId;
  /** The scenario clock the signals were read at, or null when unavailable. */
  atMoment: string | null;
  /** The scenario day, ISO date, or null when unavailable. */
  scenarioDate: string | null;
  focus: FocusSignal;
  process: ProcessSignal;
  meeting: MeetingSignal;
}
