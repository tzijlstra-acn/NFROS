/**
 * Loads what the Inbox module needs beyond the shared hub data.
 *
 * Server only, reads only:
 *
 *   the evidence documents messages name directly;
 *   each message's lineage, read from the objects it became (evidence filed
 *   from it, actions raised from it, simulated delegations and replies about
 *   it, the stage inputs it is) and from the backbone events the inbox
 *   handlers published;
 *   the audit rows of the selected message;
 *   the open stages of the role's running processes, which a message can
 *   join, read through the process runtime's own repository;
 *   the AI mode the classification runs in.
 */

import { getStageRuns } from "@/db/repositories/role-app-runtime";
import { getAuditForObject, getEvidenceByIds } from "@/db/repositories/work-hub";
import { getActionsRaisedFrom, getEvidenceFiledFrom, getOutboundAbout, getStageInputsFor, INBOX_MESSAGE_KIND } from "@/db/repositories/inbox";
import { listOsEvents } from "@/features/events/backbone";
import { getResolvedDemoMode } from "@/server/config/runtime";
import { createLogger } from "@/server/logging/redact";
import type { WorkSharedData } from "../../shared";
import type { WorkQuery } from "../../url";
import { readInboxEvent, type InboxEventFact } from "./lineage";
import type { InboxExtras, ProcessStageOption } from "./read-model";
import type { TriageModeSetting } from "./triage";

const log = createLogger("work-inbox");

/** The mode the inbox classification runs in. Live is served as safe: no model is called for the inbox. */
export function inboxTriageMode(): TriageModeSetting {
  const resolved = getResolvedDemoMode().mode;
  return { mode: resolved === "offline" ? "offline" : "safe", live: resolved === "live" };
}

/** Inbox events for the role, grouped by message, oldest first. */
export function loadInboxEvents(roleId: string): Map<string, InboxEventFact[]> {
  const grouped = new Map<string, InboxEventFact[]>();
  try {
    for (const view of listOsEvents({ roleId, types: ["work-arrived", "tool-executed", "action-updated"], order: "asc" })) {
      const event = readInboxEvent(view);
      if (!event) continue;
      const list = grouped.get(event.payload.messageId) ?? [];
      list.push(event);
      grouped.set(event.payload.messageId, list);
    }
  } catch (error) {
    /* The backbone is a projection. Without it the lineage still reads from the objects; who and when are then unknown. */
    log.warn("The inbox events could not be read from the backbone.", { error });
  }
  return grouped;
}

/** Every open stage of the role's running processes. */
export function loadOpenStages(shared: Pick<WorkSharedData, "processScopes">): ProcessStageOption[] {
  const options: ProcessStageOption[] = [];
  for (const scope of shared.processScopes) {
    if (scope.status === "completed") continue;
    for (const stageRun of getStageRuns(scope.roleAppRunId)) {
      if (stageRun.status === "completed") continue;
      const name = scope.stageNames[stageRun.stageId];
      options.push({
        processRunId: scope.roleAppRunId,
        processName: scope.processName,
        subjectId: scope.subjectId,
        scopeIds: scope.scopeIds,
        stageId: stageRun.stageId,
        stageName: name ?? { en: stageRun.stageId, de: stageRun.stageId },
        stageRunId: stageRun.id,
        current: scope.currentStageId === stageRun.stageId,
      });
    }
  }
  return options;
}

export function loadInboxExtras(shared: WorkSharedData, query: WorkQuery): InboxExtras {
  const ids = shared.messages.map((row) => row.id);
  const named = shared.messages
    .filter((row) => row.relatedObjectKind === "evidence-document" && row.relatedObjectId)
    .map((row) => row.relatedObjectId ?? "");
  const selected = query.item && ids.includes(query.item) ? query.item : null;

  return {
    evidence: getEvidenceByIds(named),
    filed: getEvidenceFiledFrom(ids),
    raised: getActionsRaisedFrom(ids),
    outbound: getOutboundAbout(ids),
    stageInputs: getStageInputsFor(ids),
    events: loadInboxEvents(shared.roleId),
    audit: selected ? new Map([[selected, getAuditForObject(INBOX_MESSAGE_KIND, selected)]]) : new Map(),
    stages: loadOpenStages(shared),
    triageMode: inboxTriageMode(),
  };
}
