/**
 * The governed steps of the AI Partner's routines.
 *
 * Each routine runs exactly one registry tool, through `executeTool`, so the
 * authority gate decides whether it may run at the current autonomy level and
 * the attempt is audited either way. None of these handlers writes a record:
 * they read, and return what they read or prepared. The runner turns that
 * into a validated suggestion for the person.
 *
 *   prepareChallengeQuestions (DRAFT)   the meeting's preparation, through the
 *                                        Meetings module's own AI layer
 *                                        (`loadMeetingLifecycle`): safe serves
 *                                        the validated preparation captured
 *                                        before the day while its records are
 *                                        unchanged, otherwise it is composed.
 *   proposeInboxTriage (PROPOSE)        a classification per message, through
 *                                        the Inbox module's AI layer
 *                                        (`proposeTriage`), every path
 *                                        validated, never without its reason.
 *   monitorWorkEvents (READ)            the facts a material change bears on:
 *                                        the role's view of the moment, the
 *                                        open decisions it names, the rest of
 *                                        the day's meetings and the running
 *                                        process stage.
 *
 * `draftActionReminder` (DRAFT) is the Work Hub's own handler and is reused
 * as it is, which is why its module is imported here.
 *
 * Registered once per process, as the other tool modules do.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { timelineRoleMoments } from "@/db/schema/core";
import { workdayLiveEvents } from "@/db/schema/live";
import {
  hasToolHandler,
  registerToolHandler,
  type ToolHandler,
  type ToolHandlerResult,
} from "@/agents/tools/runtime";
import { loadWorkShared } from "@/features/work/hub-data";
import { loadMeetingLifecycle } from "@/features/work/modules/meetings/load";
import { inboxTriageMode } from "@/features/work/modules/inbox/load";
import { messageSource } from "@/features/work/modules/inbox/sources";
import { proposeTriage } from "@/features/work/modules/inbox/triage";
import { listOsEvents } from "@/features/events/backbone";
import "@/features/work/modules/actions/tools";
import { clockOf, minutesOf } from "./windows";

const db = () => getDb();

function register(toolName: string, handler: ToolHandler): void {
  if (hasToolHandler(toolName)) return;
  registerToolHandler(toolName, handler);
}

function stringList(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];
}

function requireShared(roleId: Parameters<typeof loadWorkShared>[0]) {
  const shared = loadWorkShared(roleId);
  if (!shared) throw new Error(`The role ${roleId} has no workday data to read.`);
  return shared;
}

/* ==========================================================================
   Meeting preparation
   ========================================================================== */

export interface MeetingPreparationData {
  meeting: { id: string; title: string; titleDe: string; scheduledFor: string; subjectKind: string | null; subjectId: string | null };
  preparation: ReturnType<typeof loadMeetingLifecycle>["preparation"];
  openDecisionIds: string[];
  knownEvidenceIds: string[];
}

register("prepareChallengeQuestions", (payload, context): ToolHandlerResult => {
  const meetingId = typeof payload["meetingId"] === "string" ? payload["meetingId"] : "";
  const shared = requireShared(context.roleId);
  const meeting = shared.meetings.find((row) => row.id === meetingId);
  if (!meeting) throw new Error(`The meeting "${meetingId}" is not on this role's calendar, so nothing was prepared.`);
  const lifecycle = loadMeetingLifecycle(shared, meeting);
  const data: MeetingPreparationData = {
    meeting: {
      id: meeting.id,
      title: meeting.title,
      titleDe: meeting.titleDe,
      scheduledFor: meeting.scheduledFor,
      subjectKind: meeting.subjectKind,
      subjectId: meeting.subjectId,
    },
    preparation: lifecycle.preparation,
    openDecisionIds: shared.decisions
      .filter((decision) => decision.status === "open" && meeting.subjectId !== null && decision.relatedObjectId === meeting.subjectId)
      .map((decision) => decision.id),
    knownEvidenceIds: [...lifecycle.evidence.keys()],
  };
  return {
    summary: `Prepared the brief for ${meeting.id}. Nothing was changed.`,
    objectKind: "meeting",
    objectId: meeting.id,
    data,
    evidenceIds: lifecycle.preparation.output?.questions.flatMap((question) => question.evidenceIds).slice(0, 24) ?? [],
  };
});

/* ==========================================================================
   Inbox triage
   ========================================================================== */

export interface TriageProposalData {
  messageId: string;
  subject: string;
  subjectDe: string;
  revealedAtMoment: string;
  classification: string | null;
  rationale: { en: string; de: string | null } | null;
  mode: "safe" | "offline" | "unavailable";
}

register("proposeInboxTriage", (payload, context): ToolHandlerResult => {
  const ids = stringList(payload, "messageIds");
  const shared = requireShared(context.roleId);
  const known = new Set<string>();
  for (const message of shared.messages) {
    known.add(message.id);
    for (const id of [message.relatedObjectId, message.linkedActionId, message.linkedDecisionId, message.isDuplicateOf]) if (id) known.add(id);
  }
  for (const id of shared.people.keys()) known.add(id);
  for (const decision of shared.decisions) known.add(decision.id);
  for (const action of shared.actions) known.add(action.id);

  const setting = inboxTriageMode();
  const proposals: TriageProposalData[] = [];
  for (const id of ids) {
    const row = shared.messages.find((message) => message.id === id);
    if (!row) continue;
    const decisionId = row.linkedDecisionId ?? (row.relatedObjectKind === "decision" ? row.relatedObjectId : null);
    const result = proposeTriage(
      row,
      {
        knownIds: known,
        source: messageSource(row, shared),
        original: row.isDuplicateOf ? (shared.messages.find((candidate) => candidate.id === row.isDuplicateOf) ?? null) : null,
        decisionStatus: decisionId ? (shared.decisions.find((decision) => decision.id === decisionId)?.status ?? null) : null,
      },
      setting,
    );
    proposals.push({
      messageId: row.id,
      subject: row.subject,
      subjectDe: row.subjectDe,
      revealedAtMoment: row.revealedAtMoment,
      classification: result.proposal?.classification ?? null,
      rationale: result.proposal ? { en: result.proposal.rationale.en, de: result.proposal.rationale.de } : null,
      mode: result.mode,
    });
  }
  return {
    summary: `Proposed a classification for ${proposals.length} message(s). Nothing was filed or changed.`,
    objectKind: "inbox",
    objectId: ids[0] ?? "inbox",
    data: { proposals, live: setting.live },
  };
});

/* ==========================================================================
   Event monitoring
   ========================================================================== */

export interface MaterialChangeData {
  eventId: string;
  atMoment: string;
  title: string;
  titleDe: string;
  objectKind: string;
  objectId: string;
  /** The role's own view of a timeline moment, when the change is one. */
  roleView: { headline: string; workObjectKind: string; workObjectId: string; evidenceIds: string[]; decisionIds: string[]; uncertainty: string } | null;
  openDecisions: Array<{ id: string; title: string; titleDe: string }>;
  laterMeetings: Array<{ meetingId: string; title: string; titleDe: string; at: string }>;
  stage: { processRunId: string; name: { en: string; de: string } } | null;
}

function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

register("monitorWorkEvents", (payload, context): ToolHandlerResult => {
  const ids = stringList(payload, "eventIds");
  const shared = requireShared(context.roleId);
  const now = minutesOf(shared.currentMoment);
  const openDecisions = shared.decisions.filter((decision) => decision.status === "open");
  const laterMeetings = shared.calendar
    .filter((entry) => entry.meetingId && entry.kind !== "focus-time" && minutesOf(clockOf(entry.startsAt)) > now)
    .map((entry) => ({ meetingId: entry.meetingId as string, title: entry.title, titleDe: entry.titleDe, at: clockOf(entry.startsAt) }));
  const running = shared.processScopes.find((scope) => scope.status !== "completed" && scope.currentStageName !== null);
  const backbone = listOsEvents({ runId: context.runId, roleId: context.roleId, types: ["source-changed"] });

  const changes: MaterialChangeData[] = [];
  for (const id of ids) {
    const arrival = db()
      .select()
      .from(workdayLiveEvents)
      .where(and(eq(workdayLiveEvents.runId, context.runId), eq(workdayLiveEvents.id, id)))
      .get();
    const published = arrival ? null : backbone.find((event) => event.id === id) ?? null;
    if (!arrival && !published) continue;

    const objectKind = arrival?.objectType ?? published?.subjectKind ?? "";
    const objectId = arrival?.objectId ?? published?.subjectId ?? "";
    const moment =
      arrival && arrival.objectType === "timeline"
        ? db()
            .select()
            .from(timelineRoleMoments)
            .where(
              and(
                eq(timelineRoleMoments.runId, context.runId),
                eq(timelineRoleMoments.roleId, context.roleId),
                eq(timelineRoleMoments.timelineEventId, arrival.objectId),
              ),
            )
            .get()
        : undefined;
    const roleView = moment
      ? {
          headline: moment.headline,
          workObjectKind: moment.workObjectKind,
          workObjectId: moment.workObjectId ?? objectId,
          evidenceIds: parseList(moment.evidenceIds),
          decisionIds: parseList(moment.decisionIds),
          uncertainty: moment.uncertaintyNote ?? "",
        }
      : null;
    const touched = new Set<string>([objectId, ...(roleView ? [roleView.workObjectId, ...roleView.decisionIds] : [])]);
    changes.push({
      eventId: id,
      atMoment: arrival?.atMoment ?? published?.atMoment ?? shared.currentMoment,
      title: arrival?.title ?? published?.summary ?? id,
      titleDe: arrival?.titleDe ?? published?.summary ?? id,
      objectKind,
      objectId,
      roleView,
      openDecisions: openDecisions
        .filter((decision) => touched.has(decision.id) || (decision.relatedObjectId !== null && touched.has(decision.relatedObjectId)))
        .map((decision) => ({ id: decision.id, title: decision.title, titleDe: decision.titleDe })),
      laterMeetings: laterMeetings.slice(0, 3),
      stage: running?.currentStageName ? { processRunId: running.roleAppRunId, name: running.currentStageName } : null,
    });
  }
  return {
    summary: `Read ${changes.length} change(s) and the open work they bear on. Nothing was changed.`,
    objectKind: "work-events",
    objectId: ids[0] ?? "work-events",
    data: { changes },
    evidenceIds: changes.flatMap((change) => change.roleView?.evidenceIds ?? []).slice(0, 24),
  };
});

export const routineToolHandlersRegistered = true;
