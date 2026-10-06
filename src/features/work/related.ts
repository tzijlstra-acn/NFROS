/**
 * RelatedWork: the links from a selected item to the rest of the work.
 *
 * The plan lists seven kinds every selected item should expose: related
 * process, decision, meeting, action, source message, evidence and audit. The
 * rule that matters is the one under the list: only show the links that
 * exist. Every constructor here therefore takes the thing it links to, and a
 * module that has nothing to link simply does not call it. There is no
 * "No related decision" placeholder anywhere in the hub.
 *
 * Pure. The hrefs are the product's own routes, so a link either lands on the
 * work it names or the test for it fails.
 */

import type { Language } from "@/i18n/labels";
import type { WorkProcessScope } from "@/db/repositories/work-hub";
import { COPY, fill, say } from "./copy";
import type { RelatedLink, WorkTab } from "./model";
import { itemHref } from "./url";

export function processLink(
  scope: WorkProcessScope,
  language: Language,
  stageId: string | null = null,
): RelatedLink {
  const stage = stageId ? scope.stageNames[stageId] : scope.currentStageName;
  const stageName = stage ? say(stage, language) : null;
  const stageKey = stageId ?? scope.currentStageId;
  return {
    kind: "process",
    id: scope.roleAppRunId,
    label: say(scope.processName, language),
    href: scope.entryRoute ? `${scope.entryRoute}?stage=${encodeURIComponent(stageKey)}` : null,
    ...(stageName ? { note: stageName } : {}),
  };
}

export function decisionLink(roleId: string, id: string, title: string, note?: string): RelatedLink {
  return {
    kind: "decision",
    id,
    label: title,
    href: `/workday/${roleId}/decisions#${encodeURIComponent(id)}`,
    ...(note ? { note } : {}),
  };
}

function workItemLink(
  kind: "meeting" | "action" | "message",
  tab: WorkTab,
  roleId: string,
  id: string,
  label: string,
  note?: string,
): RelatedLink {
  return { kind, id, label, href: itemHref(roleId, tab, id), ...(note ? { note } : {}) };
}

export function meetingLink(roleId: string, id: string, title: string, note?: string): RelatedLink {
  return workItemLink("meeting", "meetings", roleId, id, title, note);
}

export function actionLink(roleId: string, id: string, title: string, note?: string): RelatedLink {
  return workItemLink("action", "actions", roleId, id, title, note);
}

export function messageLink(roleId: string, id: string, subject: string, note?: string): RelatedLink {
  return workItemLink("message", "inbox", roleId, id, subject, note);
}

/** Opens the context drawer on Evidence. Only built when there is evidence to show. */
export function evidenceLink(count: number, language: Language): RelatedLink | null {
  if (count <= 0) return null;
  return {
    kind: "evidence",
    id: "evidence",
    label: `${say(COPY.openEvidence, language)} (${count})`,
    href: null,
    drawerTab: "evidence",
  };
}

/** Opens the context drawer on Audit. Only built when audit events exist. */
export function auditLink(count: number, language: Language): RelatedLink | null {
  if (count <= 0) return null;
  return {
    kind: "audit",
    id: "audit",
    label: `${say(COPY.openAudit, language)} (${count})`,
    href: null,
    drawerTab: "audit",
  };
}

/**
 * The object an item is about, as a link to all work on it.
 *
 * The V3 surface has no standalone page for a control or a supplier, so the
 * link lands on the Work Hub filtered to that object: every agenda entry,
 * meeting, action and message linked to it. That is a real page with real
 * rows, which a link to a placeholder page would not be.
 */
export function objectLink(
  roleId: string,
  objectId: string,
  label: string,
  kindLabel: string,
  language: Language,
  tab: WorkTab = "actions",
): RelatedLink {
  return {
    kind: "object",
    id: objectId,
    label: `${kindLabel}: ${label === objectId ? objectId : `${objectId} ${label}`}`,
    href: `/workday/${roleId}/work?view=${tab}&object=${encodeURIComponent(objectId)}`,
    note: fill(say(COPY.allWorkOnObject, language), { object: objectId }),
  };
}

/** The first running process whose scope contains any of these subjects. */
export function findProcessFor(
  subjectIds: ReadonlyArray<string | null | undefined>,
  scopes: readonly WorkProcessScope[],
): WorkProcessScope | null {
  const ids = subjectIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return null;
  return scopes.find((scope) => ids.some((id) => scope.scopeIds.includes(id))) ?? null;
}

/** Drops nulls and duplicate targets, keeping the first of each. */
export function compactLinks(links: ReadonlyArray<RelatedLink | null | undefined>): RelatedLink[] {
  const seen = new Set<string>();
  const out: RelatedLink[] = [];
  for (const link of links) {
    if (!link) continue;
    const key = `${link.kind}:${link.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link);
  }
  return out;
}
