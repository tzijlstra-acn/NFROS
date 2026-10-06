/**
 * Loads what the Actions module needs beyond the shared hub data.
 *
 * Server only. Every query is a read from `work-hub.ts`, and the audit trail
 * is read for the selected action alone, because it is the one place the
 * module would otherwise read every audit row for every action on every
 * render.
 */

import {
  getActionUpdatesFor,
  getActionsLinkedTo,
  getAuditForObject,
  getEscalationsFor,
  getEvidenceByIds,
  getEvidenceRelatedTo,
  getFollowUpsFor,
} from "@/db/repositories/work-hub";
import type { WorkSharedData } from "../../shared";
import type { WorkQuery } from "../../url";
import type { ActionsExtras } from "./read-model";

export function loadActionsExtras(shared: WorkSharedData, query: WorkQuery): ActionsExtras {
  const ids = shared.actions.map((action) => action.id);
  const updates = getActionUpdatesFor(ids);

  const citedIds: string[] = [];
  for (const list of updates.values()) for (const entry of list) citedIds.push(...entry.evidenceIds);

  const objectIds = shared.actions
    .map((action) => action.relatedObjectId)
    .filter((id): id is string => typeof id === "string");

  const selected = query.item !== null && ids.includes(query.item) ? query.item : null;

  return {
    updates,
    followUps: getFollowUpsFor(ids),
    linked: getActionsLinkedTo(ids),
    escalations: getEscalationsFor(ids),
    evidence: getEvidenceByIds(citedIds),
    relatedEvidence: getEvidenceRelatedTo(objectIds),
    audit: selected ? new Map([[selected, getAuditForObject("action", selected)]]) : new Map(),
  };
}
