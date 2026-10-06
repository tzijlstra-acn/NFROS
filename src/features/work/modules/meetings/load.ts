/**
 * Loads what the Meetings module needs beyond the shared hub data: the pack
 * documents, and for the selected meeting its audit trail and its lifecycle.
 *
 * Server only, and reads only. The lifecycle of one meeting is its
 * conversation record, every document the pack, a turn, a contradiction or
 * the minutes names, the contradictions on record, the preparation the AI
 * layer produced, the working minutes, the simulated distribution message,
 * and the state of the process stage the meeting serves. The stage is read
 * through the process engine's public API (`buildStageContext`), never from
 * its tables, so the Meetings module and the process page cannot disagree
 * about whether a stage is open.
 */

import {
  getAuditForObject,
  getEvidenceByIds,
  type WorkEvidenceRow,
  type WorkMinutesRow,
} from "@/db/repositories/work-hub";
import {
  getDistributionMessage,
  getMeetingTranscript,
  getRecordedContradictions,
  type MeetingTurnRow,
  type RecordedContradiction,
} from "@/db/repositories/meetings";
import { buildStageContext } from "@/features/process/orchestrator";
import { createLogger } from "@/server/logging/redact";
import type { MeetingRow, WorkSharedData } from "../../shared";
import type { WorkQuery } from "../../url";
import { meetingDecisions, meetingProcess, packEvidenceIds } from "../meeting-facts";
import { prepareMeeting } from "./ai";
import { mentionedIds, type PreparationInput } from "./compose";
import { draftOfMinutes, type MeetingLifecycleData, type StageSnapshot } from "./lifecycle";
import type { MeetingsExtras } from "./read-model";

const log = createLogger("work-meetings");

/** The meeting an item identifier selects: a meeting, or minutes whose meeting is in the list. */
export function selectedMeeting(shared: WorkSharedData, itemId: string | null): MeetingRow | null {
  if (!itemId) return null;
  const direct = shared.meetings.find((meeting) => meeting.id === itemId);
  if (direct) return direct;
  const minutes = shared.minutes.find((entry) => entry.id === itemId);
  return minutes ? (shared.meetings.find((meeting) => meeting.id === minutes.meetingId) ?? null) : null;
}

/** The working minutes of a meeting: the latest minutes row written for it. */
export function workingMinutes(shared: Pick<WorkSharedData, "minutes">, meetingId: string) {
  const rows = shared.minutes.filter((entry) => entry.meetingId === meetingId);
  return rows.length > 0 ? (rows[rows.length - 1] ?? null) : null;
}

/**
 * The stage a meeting serves, as the process engine sees it.
 *
 * Unavailable (null) when the meeting serves no stage, and logged rather than
 * thrown when the engine cannot build the stage, so a process that is
 * mid-change never takes the meeting detail down with it.
 */
export function stageSnapshotFor(meeting: MeetingRow, shared: WorkSharedData): StageSnapshot | null {
  const process = meetingProcess(meeting, shared);
  if (!process || !process.stageId) return null;
  try {
    const context = buildStageContext({ processRunId: process.scope.roleAppRunId, stageId: process.stageId });
    const state = context.stageRun === null ? "not-open" : context.stageRun.status === "completed" ? "completed" : "open";
    return {
      processRunId: context.run.id,
      stageId: context.stage.id,
      stageName: { en: context.stage.name, de: context.stage.nameDe },
      state,
      stageRunId: context.stageRun?.id ?? null,
      currentStageName: process.scope.currentStageName,
      /*
       * Only the criteria a person meets (a task, a decision) are outcomes a
       * meeting can leave behind; the stage's own mechanics (sources read, a
       * preparation stored) are not the meeting's to deliver.
       */
      criteria: context.stage.completionCriteria
        .filter((criterion) => criterion.kind === "human-task-completed" || criterion.kind === "decision-recorded")
        .map((criterion) => criterion.label),
    };
  } catch (error) {
    log.warn("The process stage of a meeting could not be read.", { meetingId: meeting.id, error });
    return null;
  }
}

/** Every document a meeting's record names: the pack, the turns, the contradictions on record and the minutes. */
export function evidenceNamedBy(
  meeting: MeetingRow,
  turns: readonly MeetingTurnRow[],
  contradictions: readonly RecordedContradiction[],
  minutes: WorkMinutesRow | null,
  language: WorkSharedData["language"],
): string[] {
  const draft = minutes ? draftOfMinutes(minutes, language) : null;
  const named = new Set<string>(meeting.evidenceDocumentIds);
  for (const turn of turns) {
    if (turn.contradictsEvidenceId) named.add(turn.contradictsEvidenceId);
    for (const id of mentionedIds(turn.content)) if (id.startsWith("EVD-")) named.add(id);
  }
  for (const item of contradictions) for (const id of item.evidenceIds) named.add(id);
  for (const id of draft?.evidenceIds ?? []) named.add(id);
  for (const action of draft?.actions ?? []) for (const id of action.evidenceIds) named.add(id);
  for (const fact of draft?.facts ?? []) for (const id of fact.evidenceIds) named.add(id);
  if (minutes?.evidenceDocumentId) named.add(minutes.evidenceDocumentId);
  return [...named];
}

/**
 * What a meeting's preparation is composed from. The seed captures the safe
 * mode preparation from exactly this, so the page and the cache agree on the
 * digest until the records actually change.
 */
export function preparationInputFor(
  shared: WorkSharedData,
  meeting: MeetingRow,
  evidence: ReadonlyMap<string, WorkEvidenceRow>,
  stage: StageSnapshot | null,
  contradictions: readonly RecordedContradiction[],
): PreparationInput {
  const pack = new Map(
    meeting.evidenceDocumentIds.flatMap((id) => {
      const doc = evidence.get(id);
      return doc ? [[id, doc] as const] : [];
    }),
  );
  return {
    meeting,
    typeLabel: shared.config.meetingTypes[meeting.kind]?.label ?? { en: meeting.kind, de: meeting.kind },
    pack,
    openDecisions: meetingDecisions(meeting, shared).filter((decision) => decision.status === "open"),
    stageCriteria: stage?.criteria ?? [],
    contradictions,
    dueBefore: shared.actions.filter(
      (action) =>
        action.status !== "completed" &&
        action.status !== "cancelled" &&
        action.dueOn !== null &&
        action.dueOn <= meeting.scheduledFor.slice(0, 10) &&
        ((meeting.subjectId !== null && action.relatedObjectId === meeting.subjectId) || action.sourceMeetingId === meeting.id),
    ),
    scenarioDate: shared.scenarioDate,
  };
}

export function loadMeetingLifecycle(shared: WorkSharedData, meeting: MeetingRow): MeetingLifecycleData {
  const turns = getMeetingTranscript(meeting.id);
  const contradictions = getRecordedContradictions(shared.roleId);
  const minutes = workingMinutes(shared, meeting.id);
  const evidence = getEvidenceByIds(evidenceNamedBy(meeting, turns, contradictions, minutes, shared.language));
  const stage = stageSnapshotFor(meeting, shared);
  const preparation = prepareMeeting(preparationInputFor(shared, meeting, evidence, stage, contradictions), new Set(evidence.keys()));

  return {
    meetingId: meeting.id,
    turns,
    evidence,
    contradictions,
    preparation,
    minutes,
    distribution: minutes?.distributionMessageId ? (getDistributionMessage(minutes.distributionMessageId) ?? null) : null,
    stage,
    endsAt: shared.calendar.find((entry) => entry.meetingId === meeting.id)?.endsAt ?? null,
  };
}

/** The meeting's audit trail and its minutes', newest first: the lifecycle writes against both. */
function auditFor(shared: WorkSharedData, meeting: MeetingRow) {
  const minutesIds = shared.minutes.filter((entry) => entry.meetingId === meeting.id).map((entry) => entry.id);
  return [...getAuditForObject("meeting", meeting.id), ...minutesIds.flatMap((id) => getAuditForObject("minutes", id))].sort(
    (a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id),
  );
}

export function loadMeetingsExtras(shared: WorkSharedData, query: WorkQuery): MeetingsExtras {
  const meeting = selectedMeeting(shared, query.item);
  return {
    packEvidence: getEvidenceByIds(packEvidenceIds(shared.meetings)),
    audit: meeting ? new Map([[meeting.id, auditFor(shared, meeting)]]) : new Map(),
    lifecycle: meeting ? loadMeetingLifecycle(shared, meeting) : null,
  };
}
