/**
 * Read side data access for the meeting lifecycle.
 *
 * Queries only, in the spirit of `work-hub.ts`: a server component can call
 * any of these while it renders without any risk of changing state. Every
 * write the lifecycle performs (capturing a statement, preparing and editing
 * the minutes draft, confirming and distributing the minutes) is a tool
 * handler reached through `executeTool`, in
 * `src/features/work/modules/meetings/tools.ts`, never a function here.
 *
 * Two of these are the seams other workstreams read the lifecycle through:
 *
 *   `getConfirmedMinutesForStage` is what a process stage that depends on a
 *   meeting (the RCSA challenge workshop's "workshop record" source, for
 *   example) reads once the stage is implemented: the confirmed minutes of
 *   the meetings recorded against that run and stage.
 *
 *   `getMinutesForDecision` is what the Decisions surface reads to show that
 *   a decision was discussed in a meeting, and where the record of it is.
 *
 * Confirmed minutes are findable by search twice over: as a minutes record
 * (`getMinutesForRole` in `work-hub.ts`, which the search read model already
 * lists) and as the evidence document they became.
 */

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { backgroundActions, cachedAiOutputs } from "@/db/schema/decisions";
import { meetingMinutes } from "@/db/schema/role-app-runtime";
import { collaborationMessages, meetingMessages, meetings } from "@/db/schema/work";

const db = () => getDb();

export type MeetingTurnRow = typeof meetingMessages.$inferSelect;
export type MeetingRecordRow = typeof meetings.$inferSelect;
export type MinutesRecordRow = typeof meetingMinutes.$inferSelect;
export type DistributionMessageRow = typeof collaborationMessages.$inferSelect;

/* ==========================================================================
   The conversation
   ========================================================================== */

/** Every recorded turn of one meeting, in speaking order. */
export function getMeetingTranscript(meetingId: string, runId = DEFAULT_RUN_ID): MeetingTurnRow[] {
  return db()
    .select()
    .from(meetingMessages)
    .where(and(eq(meetingMessages.runId, runId), eq(meetingMessages.meetingId, meetingId)))
    .orderBy(asc(meetingMessages.sortOrder))
    .all();
}

export function getMeetingRecord(meetingId: string, runId = DEFAULT_RUN_ID): MeetingRecordRow | undefined {
  return db()
    .select()
    .from(meetings)
    .where(and(eq(meetings.runId, runId), eq(meetings.id, meetingId)))
    .get();
}

/* ==========================================================================
   Minutes
   ========================================================================== */

export function getMinutesById(minutesId: string, runId = DEFAULT_RUN_ID): MinutesRecordRow | undefined {
  return db()
    .select()
    .from(meetingMinutes)
    .where(and(eq(meetingMinutes.runId, runId), eq(meetingMinutes.id, minutesId)))
    .get();
}

/**
 * The minutes of one meeting, latest first.
 *
 * A meeting has one working set of minutes; the list form is kept because a
 * minutes row is never deleted, so a meeting whose first record was confirmed
 * before drafts were structured still shows it.
 */
export function getMinutesForMeeting(meetingId: string, runId = DEFAULT_RUN_ID): MinutesRecordRow[] {
  return db()
    .select()
    .from(meetingMinutes)
    .where(and(eq(meetingMinutes.runId, runId), eq(meetingMinutes.meetingId, meetingId)))
    .orderBy(desc(meetingMinutes.createdAt), desc(meetingMinutes.id))
    .all();
}

const CONFIRMED = ["confirmed", "distributed"];

/**
 * The confirmed minutes of the meetings a process stage depends on.
 *
 * The link is the meeting's recorded `process_run_id` and `stage_id`, so a
 * stage reads exactly the meetings the Work Hub shows against it.
 */
export function getConfirmedMinutesForStage(
  processRunId: string,
  stageId: string,
  runId = DEFAULT_RUN_ID,
): Array<{ meeting: MeetingRecordRow; minutes: MinutesRecordRow }> {
  const linked = db()
    .select()
    .from(meetings)
    .where(and(eq(meetings.runId, runId), eq(meetings.processRunId, processRunId), eq(meetings.stageId, stageId)))
    .all();
  if (linked.length === 0) return [];
  const byMeeting = new Map(linked.map((meeting) => [meeting.id, meeting]));
  return db()
    .select()
    .from(meetingMinutes)
    .where(
      and(
        eq(meetingMinutes.runId, runId),
        inArray(meetingMinutes.meetingId, [...byMeeting.keys()]),
        inArray(meetingMinutes.status, CONFIRMED),
      ),
    )
    .orderBy(asc(meetingMinutes.confirmedAt))
    .all()
    .flatMap((minutes) => {
      const meeting = byMeeting.get(minutes.meetingId);
      return meeting ? [{ meeting, minutes }] : [];
    });
}

/** Confirmed minutes that record a discussion of this decision. */
export function getMinutesForDecision(decisionId: string, runId = DEFAULT_RUN_ID): MinutesRecordRow[] {
  return db()
    .select()
    .from(meetingMinutes)
    .where(and(eq(meetingMinutes.runId, runId), inArray(meetingMinutes.status, CONFIRMED)))
    .orderBy(asc(meetingMinutes.confirmedAt))
    .all()
    .filter((row) => row.decisionIds.includes(decisionId));
}

/** The simulated message a distribution was recorded as. */
export function getDistributionMessage(messageId: string, runId = DEFAULT_RUN_ID): DistributionMessageRow | undefined {
  return db()
    .select()
    .from(collaborationMessages)
    .where(and(eq(collaborationMessages.runId, runId), eq(collaborationMessages.id, messageId)))
    .get();
}

/* ==========================================================================
   Preparation inputs
   ========================================================================== */

export interface RecordedContradiction {
  id: string;
  targetKind: string;
  targetId: string;
  description: string;
  evidenceIds: string[];
}

/**
 * Contradictions the AI identified in the role's background work, before the
 * day began. These are `background_actions` rows of kind
 * `contradiction-identified`, each citing the documents that disagree; the
 * preparation shows the ones that bear on a meeting.
 */
export function getRecordedContradictions(roleId: RoleId, runId = DEFAULT_RUN_ID): RecordedContradiction[] {
  return db()
    .select()
    .from(backgroundActions)
    .where(
      and(
        eq(backgroundActions.runId, runId),
        eq(backgroundActions.roleId, roleId),
        eq(backgroundActions.kind, "contradiction-identified"),
      ),
    )
    .orderBy(asc(backgroundActions.id))
    .all()
    .map((row) => ({
      id: row.id,
      targetKind: row.targetKind,
      targetId: row.targetId,
      description: row.description,
      evidenceIds: row.evidenceIds,
    }));
}

/** A safe mode cache entry, by beat key. */
export function getCachedOutput(
  beatKey: string,
  runId = DEFAULT_RUN_ID,
): { payload: Record<string, unknown>; capturedAt: string } | null {
  const row = db()
    .select()
    .from(cachedAiOutputs)
    .where(and(eq(cachedAiOutputs.runId, runId), eq(cachedAiOutputs.beatKey, beatKey)))
    .get();
  return row ? { payload: row.payload, capturedAt: row.capturedAt } : null;
}
