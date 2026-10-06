/**
 * Facts about a meeting that both the Agenda and the Meetings module show.
 *
 * Pure. A meeting's pack, the process it serves, the decisions waiting on it
 * and the work whose deadlines depend on it are the same facts whichever tab
 * the meeting is selected from, so they are derived once, here, and the two
 * modules cannot disagree about them.
 *
 * Every link is derived from a structured field, never from the text:
 *
 *   the pack is `meetings.evidenceDocumentIds`, with each document's own
 *   status and staleness read from the corpus;
 *   the process and stage are the meeting's recorded `process_run_id` and
 *   `stage_id`. Migration 0005 and the seed wrote them with the rule this
 *   file used to apply on every read (`deriveMeetingProcessLink`: a running
 *   process whose scope contains the meeting's subject, at the stage the
 *   role's configuration says this kind of meeting serves), and a row that
 *   records none is still read by that rule;
 *   the dependent work is the open actions on the meeting's subject, plus any
 *   action raised in the meeting (`actions.source_meeting_id`) or listed by
 *   its minutes.
 */

import type { Language } from "@/i18n/labels";
import type { WorkActionRow, WorkDecisionRef, WorkEvidenceRow, WorkProcessScope } from "@/db/repositories/work-hub";
import { say } from "../copy";
import { evidenceRef } from "../freshness";
import type { EvidenceRef } from "../model";
import { findProcessFor } from "../related";
import type { MeetingRow, WorkSharedData } from "../shared";

export interface PackState {
  state: "ready" | "issues" | "none";
  total: number;
  current: number;
  issues: EvidenceRef[];
  docs: EvidenceRef[];
  questions: number;
  summary: string;
}

const PACK_RELATION = { en: "In the meeting pack", de: "Im Besprechungspaket" } as const;

export function meetingPack(
  meeting: MeetingRow | null,
  evidence: ReadonlyMap<string, WorkEvidenceRow>,
  language: Language,
): PackState {
  if (!meeting || (meeting.preparationSummary.trim().length === 0 && meeting.evidenceDocumentIds.length === 0)) {
    return { state: "none", total: 0, current: 0, issues: [], docs: [], questions: 0, summary: "" };
  }

  const docs: EvidenceRef[] = [];
  const issues: EvidenceRef[] = [];
  for (const id of meeting.evidenceDocumentIds) {
    const row = evidence.get(id);
    if (!row) {
      /*
       * A pack that names a document the corpus does not hold is a pack with
       * a missing document, and it is shown as one rather than skipped.
       */
      const missing: EvidenceRef = {
        id,
        title: id,
        status: language === "de" ? "Fehlt" : "Missing",
        statusTone: "warning",
        stale: false,
        sourceSystem: "",
        relation: say(PACK_RELATION, language),
      };
      docs.push(missing);
      issues.push(missing);
      continue;
    }
    const ref = evidenceRef(row, say(PACK_RELATION, language), language);
    docs.push(ref);
    if (row.isStale || row.status !== "current") issues.push(ref);
  }

  return {
    state: issues.length > 0 ? "issues" : "ready",
    total: docs.length,
    current: docs.length - issues.length,
    issues,
    docs,
    questions: meeting.preparedQuestions.length,
    summary: meeting.preparationSummary,
  };
}

export interface MeetingProcess {
  scope: WorkProcessScope;
  stageId: string | null;
}

/**
 * The rule that links a meeting to the process whose deadline depends on it.
 *
 * A running process whose scope contains the meeting's subject, at the stage
 * the role's configuration says this kind of meeting serves. The seed writes
 * `meetings.process_run_id` and `stage_id` with it; migration 0005 applied
 * the same rule in SQL to existing rows.
 */
export function deriveMeetingProcessLink(
  meeting: Pick<MeetingRow, "subjectId" | "kind">,
  scopes: readonly WorkProcessScope[],
  config: Pick<WorkSharedData["config"], "meetingTypes">,
): { processRunId: string; stageId: string | null } | null {
  const scope = findProcessFor([meeting.subjectId], scopes);
  if (!scope) return null;
  const configured = config.meetingTypes[meeting.kind]?.processStageId ?? null;
  return { processRunId: scope.roleAppRunId, stageId: configured && scope.stageNames[configured] ? configured : null };
}

/** The running process this meeting serves: the recorded link, or the rule for a row that records none. */
export function meetingProcess(meeting: MeetingRow | null, shared: WorkSharedData): MeetingProcess | null {
  if (!meeting) return null;
  const link =
    meeting.processRunId !== null
      ? { processRunId: meeting.processRunId, stageId: meeting.stageId }
      : deriveMeetingProcessLink(meeting, shared.processScopes, shared.config);
  if (!link) return null;
  const scope = shared.processScopes.find((candidate) => candidate.roleAppRunId === link.processRunId);
  if (!scope) return null;
  const stageId = link.stageId && scope.stageNames[link.stageId] ? link.stageId : null;
  return { scope, stageId };
}

function isOpen(action: Pick<WorkActionRow, "status">): boolean {
  return action.status !== "completed" && action.status !== "cancelled";
}

/**
 * Open work whose deadline depends on this meeting.
 *
 * Earliest deadline first, undated last, because the first row is the one a
 * reader needs: the date by which what the meeting establishes must be known.
 */
export function dependentActions(meeting: MeetingRow | null, shared: WorkSharedData): WorkActionRow[] {
  if (!meeting) return [];
  const fromMinutes = new Set(
    shared.minutes.filter((entry) => entry.meetingId === meeting.id).flatMap((entry) => entry.actionIds),
  );
  return shared.actions
    .filter(
      (action) =>
        isOpen(action) &&
        ((meeting.subjectId !== null && action.relatedObjectId === meeting.subjectId) ||
          action.sourceMeetingId === meeting.id ||
          fromMinutes.has(action.id)),
    )
    .sort((a, b) => (a.dueOn ?? "9999-12-31").localeCompare(b.dueOn ?? "9999-12-31") || a.id.localeCompare(b.id));
}

/** Decisions on the meeting's subject, open ones first. */
export function meetingDecisions(meeting: MeetingRow | null, shared: WorkSharedData): WorkDecisionRef[] {
  if (!meeting || meeting.subjectId === null) return [];
  return shared.decisions
    .filter((decision) => decision.relatedObjectId === meeting.subjectId)
    .sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || a.id.localeCompare(b.id));
}

/** The role's name for this kind of meeting. */
export function meetingTypeLabel(kind: string, shared: Pick<WorkSharedData, "config" | "language">): string {
  const label = shared.config.meetingTypes[kind]?.label;
  return label ? say(label, shared.language) : kind;
}

/** The evidence identifiers every meeting pack of the role names, for loading. */
export function packEvidenceIds(meetings: readonly MeetingRow[]): string[] {
  return [...new Set(meetings.flatMap((meeting) => meeting.evidenceDocumentIds))];
}
