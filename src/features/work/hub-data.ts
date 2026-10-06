/**
 * Loads the data every Work Hub module shares, once per request.
 *
 * Server only. Each value is read from an existing repository; the authority
 * verdicts are the gate's own `evaluateAuthority` with no approval attached,
 * asked once per tool the hub can run. Nothing here writes.
 *
 * Returns null when the role has no Work Hub configuration or the scenario is
 * not seeded, and the route shows the matching page instead of a hub built
 * from nothing.
 */

import type { RoleId } from "@/db/schema/core";
import {
  getCalendar,
  getInbox,
  getMeetings,
  getRole,
  getUsers,
} from "@/db/repositories/workday";
import {
  getAssignablePeople,
  getDecisionRefs,
  getMinutesForRole,
  getObjectLabels,
  getProcessScopes,
  getWorkActions,
  type WorkPerson,
} from "@/db/repositories/work-hub";
import { evaluateAuthority } from "@/server/security/authority";
import { getScenarioState } from "@/scenario/engine/state";
import type { AutonomyLevel } from "@/db/schema/core";
import type { Language } from "@/i18n/labels";
import { getWorkRoleConfig } from "./roles";
import type { GateVerdict, GateView, WorkSharedData } from "./shared";
import { actionToolNames } from "./modules/actions/read-model";
import { AGENDA_TOOLS } from "./modules/agenda/read-model";
import { MEETING_TOOLS } from "./modules/meetings/tool-names";
import { INBOX_TOOLS } from "./modules/inbox/tool-names";

/** Every registry tool a hub module can run, for one gate evaluation each. */
export function hubToolNames(): string[] {
  return [...new Set([...actionToolNames(), ...AGENDA_TOOLS, ...MEETING_TOOLS, ...INBOX_TOOLS])];
}

/**
 * The gate's verdict on each tool, for this role at this autonomy level.
 *
 * `approval-missing` is not a refusal: it is the gate saying the tool is
 * reachable and needs a person. Every other denial is a refusal and carries
 * the gate's own reason.
 */
export function gateViewFor(roleId: RoleId, autonomyLevel: AutonomyLevel, holderUserId: string): GateView {
  const view: Record<string, GateVerdict> = {};
  for (const toolName of hubToolNames()) {
    const decision = evaluateAuthority({
      toolName,
      roleId,
      autonomyLevel,
      payload: {},
      actingUserId: holderUserId,
      approval: null,
    });
    if (!decision.tool) continue;
    view[toolName] = {
      toolName,
      authorityClass: decision.tool.authorityClass,
      reachable: decision.allowed || decision.code === "approval-missing",
      needsApproval: !decision.allowed && decision.code === "approval-missing",
      material: decision.tool.material,
      reason: decision.allowed || decision.code === "approval-missing" ? "" : decision.reason,
    };
  }
  return view;
}

export function loadWorkShared(roleId: RoleId): WorkSharedData | null {
  const config = getWorkRoleConfig(roleId);
  const state = getScenarioState();
  if (!config || !state) return null;

  const role = getRole(roleId);
  const holderUserId = role?.holderUserId ?? null;

  const people = new Map<string, WorkPerson>(
    getUsers().map((user) => [user.id, { id: user.id, name: user.name, jobTitle: user.jobTitle, line: user.line }]),
  );

  return {
    roleId,
    holderUserId,
    holderName: holderUserId ? (people.get(holderUserId)?.name ?? holderUserId) : "",
    scenarioDate: state.scenarioDate,
    currentMoment: state.currentMoment,
    language: state.language as Language,
    autonomyLevel: state.autonomyLevel,
    config,
    people,
    assignable: getAssignablePeople(),
    objectLabels: getObjectLabels(),
    processScopes: getProcessScopes(roleId),
    decisions: getDecisionRefs(roleId, state.currentMoment),
    calendar: getCalendar(roleId),
    meetings: getMeetings(roleId),
    actions: getWorkActions(roleId, holderUserId),
    minutes: getMinutesForRole(roleId),
    messages: getInbox(roleId, state.currentMoment),
    gate: gateViewFor(roleId, state.autonomyLevel, holderUserId ?? roleId),
  };
}
