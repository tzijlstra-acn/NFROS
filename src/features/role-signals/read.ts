/**
 * The role signals read model.
 *
 * Read only. This module calls the existing repositories (the focus queue,
 * the role-app runtime and the workday calendar) and hands their rows to the
 * pure functions in `assemble.ts`. It defines no query of its own and writes
 * nothing, so a server component can call it during render without any risk
 * of changing the day it is describing.
 *
 * Two surfaces use it: the landing page shows a compact preview of the two
 * Available roles, and the role selector shows one signal per Available role.
 * Both read the same overview, so the landing and the selector cannot
 * disagree about what a role is doing.
 *
 * Role status (Available, Demo, Planned) and which Role App is installed come
 * from the product release registry (`@/product/release`) and nothing else.
 * This module never decides which roles are released; it only reads signals
 * for the ones the registry says are Available.
 */

import { isDatabaseReady } from "@/db/client";
import { DEFAULT_RUN_ID, ROLE_IDS, type RoleId } from "@/db/schema/core";
import { buildFocusQueueView } from "@/db/repositories/focus";
import { getActiveRun, getStageRuns } from "@/db/repositories/role-app-runtime";
import { getCalendar } from "@/db/repositories/workday";
import type { Language } from "@/i18n/labels";
import {
  INSTALLED_ROLE_APPS,
  rolesWithReleaseStatus,
  type RoleReleaseDefinition,
} from "@/product/release";
import type { RoleAppDefinition, RoleProcessDefinition } from "@/role-apps/contracts";
import { RCSA_CYCLE_PROCESS } from "@/role-apps/rcsa/definition";
import { getRoleApp } from "@/role-apps/registry";
import { TPRM_ONBOARDING_PROCESS } from "@/role-apps/tprm/definition";
import { getScenarioState } from "@/scenario/engine/state";
import {
  focusSignalFrom,
  meetingSignalFrom,
  processSignalFrom,
  selectNextMeeting,
  unavailableSignals,
} from "./assemble";
import { pick, ROLE_SIGNAL_LABELS as L } from "./labels";
import type { FocusSignal, MeetingSignal, ProcessSignal, RoleSignals } from "./types";

/* ==========================================================================
   Definitions the signals resolve against
   ========================================================================== */

/**
 * Process definitions by identifier.
 *
 * The two installed Role Apps each implement one process, and the definitions
 * are code, not rows. Keyed by the definition's own identifier so a renamed
 * process cannot silently fall out of this map.
 */
const PROCESS_DEFINITIONS: ReadonlyMap<string, RoleProcessDefinition> = new Map(
  [RCSA_CYCLE_PROCESS, TPRM_ONBOARDING_PROCESS].map((process) => [process.id, process]),
);

/**
 * The installed Role App for a role, or null. Preview and concept apps never count.
 *
 * Installed-ness is the release registry's answer; the full definition is then
 * read from the Role App catalogue for the process it implements.
 */
export function installedRoleAppFor(roleId: string): RoleAppDefinition | null {
  const entry = INSTALLED_ROLE_APPS.find((app) => app.roleId === roleId);
  return entry ? (getRoleApp(entry.id) ?? null) : null;
}

export function processDefinitionFor(processId: string): RoleProcessDefinition | null {
  return PROCESS_DEFINITIONS.get(processId) ?? null;
}

function isRoleId(value: string): value is RoleId {
  return (ROLE_IDS as readonly string[]).includes(value);
}

/* ==========================================================================
   One role
   ========================================================================== */

export interface ReadRoleSignalsOptions {
  runId?: string;
  /** Overrides the scenario language. Defaults to the language the scenario is set to. */
  language?: Language;
}

/**
 * Runs one signal read and turns a failure into an honest Unavailable.
 *
 * Each signal is isolated, so a defect in the focus queue does not also blank
 * the process and the meeting, which are read from different tables.
 */
function guarded<T>(read: () => T, unavailable: T): T {
  try {
    return read();
  } catch {
    return unavailable;
  }
}

export function readRoleSignals(roleId: RoleId, options: ReadRoleSignalsOptions = {}): RoleSignals {
  const runId = options.runId ?? DEFAULT_RUN_ID;

  if (!isDatabaseReady()) return unavailableSignals(roleId, options.language ?? "en", "not-seeded");
  const state = guarded(() => getScenarioState(runId), null);
  if (state === null) return unavailableSignals(roleId, options.language ?? "en", "not-seeded");

  const language = options.language ?? state.language;
  const atMoment = state.currentMoment;
  const failed = unavailableSignals(roleId, language, "read-failed");

  const focus = guarded<FocusSignal>(() => {
    const queue = buildFocusQueueView({ roleId, atMoment, language, runId });
    return focusSignalFrom(queue.now, language);
  }, failed.focus);

  const process = guarded<ProcessSignal>(() => {
    const app = installedRoleAppFor(roleId);
    const definition = app ? processDefinitionFor(app.processId) : null;
    const run = app ? (getActiveRun(roleId, app.id, runId) ?? null) : null;
    const stageRuns = run ? getStageRuns(run.id, runId) : [];
    return processSignalFrom({ app, process: definition, run, stageRuns, language });
  }, failed.process);

  const meeting = guarded<MeetingSignal>(() => {
    const selection = selectNextMeeting(getCalendar(roleId, runId), atMoment, state.scenarioDate);
    return meetingSignalFrom(selection, language, `/workday/${roleId}/work?view=agenda`);
  }, failed.meeting);

  return { roleId, atMoment, scenarioDate: state.scenarioDate, focus, process, meeting };
}

/* ==========================================================================
   The overview both surfaces render
   ========================================================================== */

export interface AvailableRoleView {
  release: RoleReleaseDefinition;
  signals: RoleSignals;
}

export interface RoleSignalOverview {
  language: Language;
  /** The scenario day and clock the signals were read at, or null when unavailable. */
  scenario: { date: string; moment: string } | null;
  available: AvailableRoleView[];
  demo: RoleReleaseDefinition[];
  planned: RoleReleaseDefinition[];
}

/**
 * Every role from the release registry, with signals for the Available ones.
 *
 * Usable before the scenario is seeded: the registry is code, so the Demo and
 * Planned lists still render, and the Available roles carry an Unavailable
 * signal that says why.
 */
export function readRoleSignalOverview(options: ReadRoleSignalsOptions = {}): RoleSignalOverview {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const state = isDatabaseReady() ? guarded(() => getScenarioState(runId), null) : null;
  const language = options.language ?? state?.language ?? "en";

  /*
   * A registry entry whose identifier is not a scenario role cannot have
   * signals. It is left out rather than shown with invented ones; the
   * registry's own test guards against that entry existing.
   */
  const available = rolesWithReleaseStatus("available").flatMap((release): AvailableRoleView[] =>
    isRoleId(release.roleId)
      ? [{ release, signals: readRoleSignals(release.roleId, { runId, language }) }]
      : [],
  );

  return {
    language,
    scenario: state ? { date: state.scenarioDate, moment: state.currentMoment } : null,
    available,
    demo: rolesWithReleaseStatus("demo"),
    planned: rolesWithReleaseStatus("planned"),
  };
}

/** "06.10.2026", the date form the scenario uses throughout. */
export function formatScenarioDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/** The row labels, resolved, for surfaces that render the three signals. */
export function signalRowLabels(language: Language): {
  focus: string;
  process: string;
  meeting: string;
} {
  return {
    focus: pick(L.currentFocus, language),
    process: pick(L.activeProcess, language),
    meeting: pick(L.nextMeeting, language),
  };
}
