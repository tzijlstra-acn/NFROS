/**
 * Which AI routines run, and through which governed tool.
 *
 * The routine definitions are the `ai_routines` rows of each role (name,
 * trigger, authority class, status); what a routine of each output kind does
 * is code, here and in `./prepare.ts`. A routine runs only when:
 *
 *   its role is Available in the release registry (Demo and Planned roles
 *   run nothing, as they open nothing);
 *   its row is active (a paused routine is skipped, and says so in Processes);
 *   its output kind has a runner (`ROUTINE_KIND_BY_OUTPUT`).
 *
 * Every routine step is one registry tool, so the authority gate decides
 * whether it may run at the current autonomy level, and the attempt is
 * audited either way.
 */

import { getRoutines, type AIRoutine } from "@/db/repositories/role-app-runtime";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { getRoleRelease } from "@/product/release/role-release";
import { ROUTINE_KIND_BY_OUTPUT, type RoutineKind } from "@/features/partner/tasks";

/** The tool each routine kind runs its one gated step through. */
export const ROUTINE_TOOL: Record<RoutineKind, string> = {
  "meeting-preparation": "prepareChallengeQuestions",
  "action-follow-up": "draftActionReminder",
  "inbox-triage": "proposeInboxTriage",
  "event-monitoring": "monitorWorkEvents",
};

/** The lineage kind of the thing each routine kind prepares, in `ai_routine_run_outputs`. */
export const ROUTINE_OUTPUT_KIND: Record<RoutineKind, string> = {
  "meeting-preparation": "meeting-preparation",
  "action-follow-up": "action-reminder-draft",
  "inbox-triage": "inbox-triage-proposal",
  "event-monitoring": "material-change",
};

/** The roles whose routines may run: the flagship roles the release registry marks Available. */
export const ROUTINE_ROLES: readonly RoleId[] = ["rcsa", "tprm"];

export function routineRolesInRelease(): RoleId[] {
  return ROUTINE_ROLES.filter((roleId) => getRoleRelease(roleId)?.status === "available");
}

export interface RunnableRoutine {
  row: AIRoutine;
  kind: RoutineKind;
}

/** The active routines of a role that have a runner in this release. */
export function runnableRoutines(roleId: RoleId, runId = DEFAULT_RUN_ID): RunnableRoutine[] {
  return getRoutines(roleId, runId).flatMap((row) => {
    const kind = ROUTINE_KIND_BY_OUTPUT[row.outputKind];
    return kind && row.status === "active" ? [{ row, kind }] : [];
  });
}

/** The routine kind of a routine row, or null when it has no runner. */
export function routineKindOf(routineId: string, runId = DEFAULT_RUN_ID): RoutineKind | null {
  for (const roleId of ROUTINE_ROLES) {
    const row = getRoutines(roleId, runId).find((entry) => entry.id === routineId);
    if (row) return ROUTINE_KIND_BY_OUTPUT[row.outputKind] ?? null;
  }
  return null;
}
