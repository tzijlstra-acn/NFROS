/**
 * The Role Apps read model (plan 7.2 and 7.3).
 *
 * One row per app in the code registry, with its release state from the
 * 0006 tables: the current version (whose state is the app's lifecycle
 * state), every version, the tenant enablement the workday obeys, cohort
 * enablements, the open candidate and its evaluation verdict, the history,
 * and the process performance of an installed app.
 *
 * The definitions are code (`src/role-apps/registry.ts`); nothing here
 * describes an app the registry does not. A database without the release
 * tables reads as Unavailable, never as a list of invented versions.
 *
 * Server only.
 */

import {
  listCohorts,
  listRoleAppEnablements,
  listRoleAppLifecycleEvents,
  listRoleAppVersions,
  type ProductCohort,
  type RoleAppEnablement,
  type RoleAppLifecycleEvent,
  type RoleAppVersion,
} from "@/db/repositories/role-app-release";
import { getRunsForApp } from "@/db/repositories/role-app-runtime";
import type { RoleAppLifecycleState } from "@/db/schema/product-console";
import { readRoleAppAvailability, type RoleAppAvailability } from "@/role-apps/enablement";
import { ROLE_APP_REGISTRY } from "@/role-apps/registry";
import type { RoleAppDefinition } from "@/role-apps/contracts";
import { evaluationRunsForVersion, evaluationVerdict, type EvaluationVerdict } from "./evaluations";
import { openCandidate } from "./lifecycle";
import {
  readRoleAppFeedback,
  readRoleAppPerformance,
  readSuggestionLifecycle,
  type FeedbackCounts,
  type RoleAppPerformance,
  type SuggestionLifecycle,
} from "./performance";

export interface RoleAppRow {
  app: RoleAppDefinition;
  installed: boolean;
  current: RoleAppVersion | null;
  state: RoleAppLifecycleState | null;
  versions: RoleAppVersion[];
  availability: RoleAppAvailability;
  cohortEnablements: RoleAppEnablement[];
  candidate: RoleAppVersion | null;
  candidateVerdict: EvaluationVerdict | null;
  /** Newest first. */
  history: RoleAppLifecycleEvent[];
  activeRuns: number;
  performance: RoleAppPerformance | null;
  suggestions: SuggestionLifecycle | null;
  feedback: FeedbackCounts | null;
}

export interface RoleAppsView {
  /** False when the release tables could not be read (a database before migration 0006). */
  available: boolean;
  rows: RoleAppRow[];
  cohorts: ProductCohort[];
  stateCounts: Partial<Record<RoleAppLifecycleState, number>>;
}

export function readRoleAppsView(): RoleAppsView {
  let versions: RoleAppVersion[] = [];
  let enablements: RoleAppEnablement[] = [];
  let events: RoleAppLifecycleEvent[] = [];
  let cohorts: ProductCohort[] = [];
  let available = true;
  try {
    versions = listRoleAppVersions();
    enablements = listRoleAppEnablements();
    events = listRoleAppLifecycleEvents();
    cohorts = listCohorts();
  } catch {
    available = false;
  }

  const rows: RoleAppRow[] = ROLE_APP_REGISTRY.map((app) => {
    const appVersions = versions.filter((version) => version.roleAppId === app.id);
    const current = appVersions.find((version) => version.isCurrent) ?? null;
    const installed = app.status === "installed";
    let candidate: RoleAppVersion | null = null;
    try {
      candidate = available ? (openCandidate(app.id) ?? null) : null;
    } catch {
      candidate = null;
    }
    let activeRuns = 0;
    try {
      activeRuns = installed ? getRunsForApp(app.roleId, app.id).filter((run) => run.status !== "completed").length : 0;
    } catch {
      activeRuns = 0;
    }
    return {
      app,
      installed,
      current,
      state: current?.lifecycleState ?? null,
      versions: appVersions,
      availability: readRoleAppAvailability(app.id),
      cohortEnablements: enablements.filter((entry) => entry.roleAppId === app.id && entry.scopeKind === "cohort"),
      candidate,
      candidateVerdict: candidate ? evaluationVerdict(candidate, evaluationRunsForVersion(candidate.id)) : null,
      history: events.filter((event) => event.roleAppId === app.id).reverse(),
      activeRuns,
      performance: installed ? readRoleAppPerformance(app.id) : null,
      suggestions: installed ? readSuggestionLifecycle(app.roleId) : null,
      feedback: installed ? readRoleAppFeedback(app.id, app.roleId) : null,
    };
  });

  const stateCounts: Partial<Record<RoleAppLifecycleState, number>> = {};
  for (const row of rows) {
    if (row.state) stateCounts[row.state] = (stateCounts[row.state] ?? 0) + 1;
    if (row.candidate) stateCounts[row.candidate.lifecycleState] = (stateCounts[row.candidate.lifecycleState] ?? 0) + 1;
  }

  return { available, rows, cohorts, stateCounts };
}
