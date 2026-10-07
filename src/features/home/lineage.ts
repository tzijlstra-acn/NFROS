/**
 * Where a piece of work opens.
 *
 * One function per destination, so a statement's link and a Done row's link
 * to the same object cannot disagree. The routes are the ones the rest of the
 * workday already uses: decisions open on the Decisions surface at their own
 * anchor, personal work opens in the Work Hub on the tab that holds it, a
 * process stage opens on its process page, and any other domain object uses
 * the `?select=` form the focus queue links with.
 */

import type { RoleId } from "@/db/schema/core";
import { itemHref } from "@/features/work/url";
import { SELECTION_PARAM } from "@/workday/selection-url";
import type { LineageKind, LineageRef } from "./types";

/**
 * The process page for a process definition.
 *
 * The route slug and the definition identifier differ for the third party
 * process, so the mapping is written out rather than derived.
 */
const PROCESS_ROUTE: Record<string, string> = {
  "rcsa-cycle": "rcsa-cycle",
  "tprm-third-party-onboarding": "third-party-onboarding",
};

/** The role-app identifiers whose runs map onto those processes. */
const ROLE_APP_PROCESS: Record<string, string> = {
  "rcsa-cycle-assistant": "rcsa-cycle",
  "tprm-third-party-onboarding": "tprm-third-party-onboarding",
};

export function decisionHref(roleId: RoleId, decisionId: string): string {
  return `/workday/${roleId}/decisions#${encodeURIComponent(decisionId)}`;
}

/*
 * Personal work opens in the Work Hub with the item selected, through the
 * hub's own `itemHref`, so a link from Home and a link inside the hub to the
 * same action are the same address.
 */

export function actionHref(roleId: RoleId, actionId: string): string {
  return itemHref(roleId, "actions", actionId);
}

export function inboxHref(roleId: RoleId, messageId?: string): string {
  return messageId ? itemHref(roleId, "inbox", messageId) : `/workday/${roleId}/work?view=inbox`;
}

export function agendaHref(roleId: RoleId, entryId?: string): string {
  return entryId ? itemHref(roleId, "agenda", entryId) : `/workday/${roleId}/work?view=agenda`;
}

export function meetingHref(roleId: RoleId, meetingId: string): string {
  return itemHref(roleId, "meetings", meetingId);
}

export function actionsHref(roleId: RoleId): string {
  return `/workday/${roleId}/work?view=actions`;
}

/** A process stage, by role-app run identifier or process definition identifier. */
export function stageHref(roleId: RoleId, processOrRoleAppId: string | null, stageId: string | null): string {
  const processId = processOrRoleAppId
    ? (ROLE_APP_PROCESS[processOrRoleAppId] ?? processOrRoleAppId)
    : null;
  const slug = processId ? PROCESS_ROUTE[processId] : undefined;
  if (!slug) return `/workday/${roleId}/processes`;
  return stageId
    ? `/workday/${roleId}/processes/${slug}?stage=${encodeURIComponent(stageId)}`
    : `/workday/${roleId}/processes/${slug}`;
}

/** Any other domain object, in the selection form the focus queue uses. */
export function objectHref(roleId: RoleId, objectKind: string, objectId: string): string {
  if (objectKind === "decision") return decisionHref(roleId, objectId);
  if (objectKind === "action") return actionHref(roleId, objectId);
  // A meeting and a message open in the Work Hub, which is where their work is done.
  if (objectKind === "meeting") return meetingHref(roleId, objectId);
  if (objectKind === "message" || objectKind === "inbox-message") return inboxHref(roleId, objectId);
  return `/workday/${roleId}?${SELECTION_PARAM}=${encodeURIComponent(objectKind)}:${encodeURIComponent(objectId)}`;
}

/**
 * Where a routine run's output opens (`ai_routine_run_outputs.object_kind`):
 * the meeting a brief was prepared for, the action a reminder was drafted
 * for, the message a classification was proposed for. Null for an output
 * kind that names no workday object of its own.
 */
export function outputHref(roleId: RoleId, outputKind: string, objectId: string): string | null {
  switch (outputKind) {
    case "meeting-preparation":
      return meetingHref(roleId, objectId);
    case "action-reminder-draft":
      return actionHref(roleId, objectId);
    case "inbox-triage-proposal":
      return inboxHref(roleId, objectId);
    default:
      return null;
  }
}

export function lineageKindOfOutput(outputKind: string): LineageKind {
  switch (outputKind) {
    case "meeting-preparation":
      return "meeting";
    case "action-reminder-draft":
      return "action";
    case "inbox-triage-proposal":
      return "message";
    default:
      return "event";
  }
}

export function lineage(kind: LineageKind, id: string, label: string, href: string): LineageRef {
  return { kind, id, label: label.length > 0 ? label : id, href };
}

/** True when a reference has somewhere to go. The statement assembler drops any that do not. */
export function isLinkable(ref: LineageRef): boolean {
  return ref.id.length > 0 && ref.href.startsWith("/workday/");
}
