/**
 * Tool handlers for the meeting lifecycle.
 *
 * Every write the lifecycle makes is one of these handlers, reached only
 * through `executeTool`, so the authority gate has already run and, for the
 * confirmation, a person's payload bound approval has been found and will be
 * consumed. As in `modules/actions/tools.ts`, a handler does not check
 * authority itself; it checks the facts the gate cannot see, and throws
 * rather than write something untrue.
 *
 *   The draft tools (capture, prepare, edit) write the minutes draft and
 *   nothing else. Each carries the version it was built on, and refuses when
 *   the draft has moved since, so two writers cannot silently overwrite each
 *   other. Each validates the draft it is given against the institution.
 *
 *   The confirmation is one transaction. It files the minutes as an evidence
 *   document with lineage, raises their new actions with the meeting, the
 *   minutes and the process stage as their source, writes a follow-up entry
 *   on the existing actions they name, records the meeting as held if it was
 *   not, marks the minutes confirmed with their final record, and publishes
 *   the backbone events (meeting completed, action updated, source changed,
 *   decision requested), each under an idempotency key derived from the
 *   minutes. Every identifier it writes is derived from the minutes
 *   identifier, so a repeated confirmation cannot write a second set: the
 *   status check refuses it, and if it ever got past that the primary keys
 *   would. Either everything is written or nothing is.
 *
 *   The distribution is a simulated collaboration message to exactly the
 *   recipients confirmed with the minutes. Nothing leaves the machine.
 *
 * Nothing here writes a process stage table. The stage hears about the
 * meeting through the backbone, and the operation brings it up to date
 * through the process engine's public API after this transaction commits.
 */

import { and, eq, inArray } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import { actions } from "@/db/schema/decisions";
import { meetingMinutes } from "@/db/schema/role-app-runtime";
import { calendarEvents, collaborationMessages, evidenceChunks, evidenceDocuments, meetings } from "@/db/schema/work";
import { getEvidenceByIds } from "@/db/repositories/work-hub";
import { getMeetingTranscript, getMinutesById, type MinutesRecordRow } from "@/db/repositories/meetings";
import {
  hasToolHandler,
  registerToolHandler,
  type ToolContext,
  type ToolHandler,
  type ToolHandlerResult,
} from "@/agents/tools/runtime";
import { publishOsEvent } from "@/features/events/backbone";
import { requireScenarioState } from "@/scenario/engine/state";
import { displayDate, firstLine, minutesOf, timeOf } from "../../model";
import { decisionTitle, personName, type MeetingRow, type WorkSharedData } from "../../shared";
import { loadWorkShared } from "../../hub-data";
import { carriedStatus, insertEntry } from "../actions/tools";
import { validateMinutesDraft, type MinutesDraft } from "./ai-schema";
import { digestOf } from "./ai";
import { renderMinutesText } from "./compose";
import {
  actionIdForMinutes,
  draftOfMinutes,
  evidenceIdForMinutes,
  heardTurns,
  isConfirmedMinutes,
  minutesSuffix,
  minutesValidationContext,
  outcomeLabel,
} from "./lifecycle";

const db = () => getDb();

function register(toolName: string, handler: ToolHandler): void {
  if (hasToolHandler(toolName)) return;
  registerToolHandler(toolName, handler);
}

function str(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function requireText(payload: Record<string, unknown>, key: string, label: string): string {
  const value = str(payload, key);
  if (value.length === 0) throw new Error(`${label} is required, so nothing was written.`);
  return value;
}

function stringList(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim()))];
}

/** The hub data of the acting role, which every reference in a draft is checked against. */
function sharedFor(context: ToolContext): WorkSharedData {
  const shared = loadWorkShared(context.roleId);
  if (!shared) throw new Error(`The role ${context.roleId} has no Work Hub, so nothing was written.`);
  return shared;
}

function meetingOf(context: ToolContext, shared: WorkSharedData, meetingId: string): MeetingRow {
  const meeting = shared.meetings.find((candidate) => candidate.id === meetingId);
  if (!meeting) throw new Error(`The meeting "${meetingId}" is not on this role's agenda, so nothing was written.`);
  return meeting;
}

/** A meeting that has not started cannot be minuted. Checked against the scenario clock. */
function requireStarted(context: ToolContext, meeting: MeetingRow): void {
  const state = requireScenarioState(context.runId);
  const day = meeting.scheduledFor.slice(0, 10);
  const notYet =
    meeting.status !== "concluded" &&
    (day > state.scenarioDate || (day === state.scenarioDate && minutesOf(timeOf(meeting.scheduledFor)) > minutesOf(context.atMoment)));
  if (notYet) {
    throw new Error(`${meeting.id} starts at ${timeOf(meeting.scheduledFor)}. A meeting cannot be minuted before it starts.`);
  }
}

/** Checks a draft against the institution as the acting role sees it now. Throws with the first failures. */
function checkDraft(
  shared: WorkSharedData,
  meeting: MeetingRow,
  candidate: unknown,
  author: "ai" | "person",
  forConfirmation = false,
): MinutesDraft {
  const turns = getMeetingTranscript(meeting.id);
  const parsedIds = new Set<string>();
  if (candidate && typeof candidate === "object") {
    const draft = candidate as Partial<MinutesDraft>;
    for (const id of draft.evidenceIds ?? []) parsedIds.add(id);
    for (const item of [...(draft.facts ?? []), ...(draft.actions ?? [])]) for (const id of item.evidenceIds ?? []) parsedIds.add(id);
  }
  const evidence = getEvidenceByIds([...parsedIds]);
  const checked = validateMinutesDraft(candidate, minutesValidationContext(shared, meeting, { turns, evidence }, author, forConfirmation));
  if (!checked.ok) {
    throw new Error(
      `The minutes were not written because they do not check against the record: ${checked.failures
        .slice(0, 3)
        .map((failure) => failure.message.en)
        .join(" ")}`,
    );
  }
  return checked.output;
}

/* ==========================================================================
   The draft
   ========================================================================== */

interface DraftWrite {
  meetingId: string;
  minutesId: string;
  /** The version the draft was built on. Zero for a meeting with no minutes yet. */
  expectedVersion: number;
  draft: unknown;
  preparedMode: string | null;
  author: "ai" | "person";
}

function readDraftWrite(payload: Record<string, unknown>, author: "ai" | "person"): DraftWrite {
  const version = payload["expectedVersion"];
  return {
    meetingId: requireText(payload, "meetingId", "The meeting"),
    minutesId: requireText(payload, "minutesId", "The minutes"),
    expectedVersion: typeof version === "number" && Number.isInteger(version) && version >= 0 ? version : -1,
    draft: payload["draft"],
    preparedMode: str(payload, "preparedMode") || null,
    author,
  };
}

/** Writes one version of a draft, or refuses. Returns the row as written. */
function writeDraft(context: ToolContext, input: DraftWrite): { row: MinutesRecordRow; created: boolean } {
  const shared = sharedFor(context);
  const meeting = meetingOf(context, shared, input.meetingId);
  requireStarted(context, meeting);
  const draft = checkDraft(shared, meeting, input.draft, input.author);

  const existing = getMinutesById(input.minutesId, context.runId);
  if (existing && existing.meetingId !== meeting.id) {
    throw new Error(`${input.minutesId} records another meeting, so nothing was written.`);
  }
  if (existing && isConfirmedMinutes(existing)) {
    throw new Error(`${input.minutesId} is confirmed. A confirmed record is not edited.`);
  }
  const currentVersion = existing?.version ?? 0;
  if (input.expectedVersion !== currentVersion) {
    throw new Error(
      `The minutes draft moved to version ${currentVersion} since this change was prepared on version ${input.expectedVersion}. Reload and make the change again.`,
    );
  }

  const now = new Date().toISOString();
  const values = {
    draft: draft as unknown as Record<string, unknown>,
    version: currentVersion + 1,
    contentDigest: digestOf(draft),
    summary: draft.summary,
    factItems: draft.facts.map((fact) => fact.text),
    unresolvedItems: draft.unresolved.map((item) => item.text),
    evidenceIds: draft.evidenceIds,
    distributionUserIds: draft.distribution,
    editedByUserId: context.actingUserId,
    editedAt: now,
    ...(input.author === "ai" ? { preparedBy: "ai", preparedMode: input.preparedMode ?? "offline" } : {}),
  };

  if (existing) {
    db().update(meetingMinutes).set(values).where(and(eq(meetingMinutes.runId, context.runId), eq(meetingMinutes.id, existing.id))).run();
  } else {
    db()
      .insert(meetingMinutes)
      .values({
        id: input.minutesId,
        runId: context.runId,
        meetingId: meeting.id,
        roleId: context.roleId,
        title: `${context.language === "de" ? "Protokoll" : "Minutes"}: ${context.language === "de" && meeting.titleDe.length > 0 ? meeting.titleDe : meeting.title}`,
        decisionIds: [],
        actionIds: [],
        participantUserIds: meeting.participantUserIds,
        status: "draft",
        preparedBy: input.author === "ai" ? "ai" : "human",
        confirmedByUserId: null,
        confirmedAt: null,
        distributedAt: null,
        createdAt: now,
        ...values,
        preparedMode: input.author === "ai" ? (input.preparedMode ?? "offline") : null,
      })
      .run();
  }
  const row = getMinutesById(input.minutesId, context.runId);
  if (!row) throw new Error(`${input.minutesId} was not written.`);
  return { row, created: !existing };
}

register("captureMeetingItem", (payload, context): ToolHandlerResult => {
  const kind = requireText(payload, "itemKind", "The kind of item");
  const { row, created } = writeDraft(context, readDraftWrite(payload, "person"));
  return {
    summary: `A ${kind} was captured from ${row.meetingId} into the minutes draft ${row.id}, version ${row.version}.`,
    objectKind: "minutes",
    objectId: row.id,
    data: { minutesId: row.id, version: row.version, created },
    receiptStatements: [`Captured into the minutes draft ${row.id} as a ${kind}`],
  };
});

register("prepareMeetingMinutes", (payload, context): ToolHandlerResult => {
  const { row } = writeDraft(context, readDraftWrite(payload, "ai"));
  return {
    summary: `Minutes draft ${row.id} prepared for ${row.meetingId} (${row.preparedMode ?? "offline"}), version ${row.version}. It is not a record until confirmed.`,
    objectKind: "minutes",
    objectId: row.id,
    data: { minutesId: row.id, version: row.version },
    receiptStatements: [`Minutes draft ${row.id} prepared from the meeting record`],
  };
});

register("editMeetingMinutes", (payload, context): ToolHandlerResult => {
  const { row } = writeDraft(context, readDraftWrite(payload, "person"));
  return {
    summary: `Minutes draft ${row.id} saved as version ${row.version}.`,
    objectKind: "minutes",
    objectId: row.id,
    data: { minutesId: row.id, version: row.version },
    receiptStatements: [`Minutes draft ${row.id} saved as version ${row.version}`],
  };
});

/* ==========================================================================
   Confirmation
   ========================================================================== */

/** Paragraph chunks for retrieval, the same shape the seed writes. */
function chunksOf(documentId: string, runId: string, body: string): Array<typeof evidenceChunks.$inferInsert> {
  const paragraphs = body.split(/\n\s*\n/).map((part) => part.trim()).filter((part) => part.length > 0);
  const chunks: Array<typeof evidenceChunks.$inferInsert> = [];
  let buffer: string[] = [];
  let length = 0;
  const flush = () => {
    if (buffer.length === 0) return;
    const content = buffer.join("\n\n");
    chunks.push({
      id: `${documentId}-C${String(chunks.length).padStart(2, "0")}`,
      runId,
      documentId,
      chunkIndex: chunks.length,
      locator: `Section ${chunks.length + 1}`,
      content,
      embedding: null,
      embeddingModel: null,
      embeddedAt: null,
      tokenEstimate: Math.ceil(content.length / 4),
    });
    buffer = [];
    length = 0;
  };
  for (const paragraph of paragraphs) {
    if (length > 0 && length + paragraph.length > 900) flush();
    buffer.push(paragraph);
    length += paragraph.length;
  }
  flush();
  return chunks;
}

register("confirmMeetingMinutes", (payload, context): ToolHandlerResult => {
  const minutesId = requireText(payload, "minutesId", "The minutes");
  const version = payload["version"];
  const digest = requireText(payload, "contentDigest", "The content digest");
  const recipients = stringList(payload, "distribution");

  const shared = sharedFor(context);
  const row = getMinutesById(minutesId, context.runId);
  if (!row) throw new Error(`The minutes "${minutesId}" do not exist, so nothing was written.`);
  if (row.roleId !== context.roleId) throw new Error(`${minutesId} belong to another role's meeting.`);
  if (isConfirmedMinutes(row)) throw new Error(`${minutesId} are already confirmed. Nothing was written a second time.`);
  if (row.version !== version) {
    throw new Error(`${minutesId} moved to version ${row.version} after version ${String(version)} was approved. Confirm the current version.`);
  }
  const meeting = meetingOf(context, shared, row.meetingId);
  requireStarted(context, meeting);

  const draft = checkDraft(shared, meeting, draftOfMinutes(row, context.language), "person", true);
  if (digestOf(draft) !== digest) {
    throw new Error(`${minutesId} changed after they were approved. The approval covers the version it was granted for only.`);
  }
  if (recipients.join(",") !== draft.distribution.join(",")) {
    throw new Error("The distribution list differs from the one in the minutes, so nothing was confirmed.");
  }

  const state = requireScenarioState(context.runId);
  const now = new Date().toISOString();
  const heldAt = `${state.scenarioDate}T${context.atMoment}:00.000Z`;
  const holderName = personName(shared, context.actingUserId) ?? context.actingUserId;
  const role = getSqlite()
    .prepare("select entity_id as entity from roles where run_id = ? and id = ?")
    .get(context.runId, context.roleId) as { entity: string } | undefined;
  const entityId = role?.entity ?? "ARC-DE";
  const evidenceId = evidenceIdForMinutes(minutesId);
  const process = meeting.processRunId ? { runId: meeting.processRunId, stageId: meeting.stageId } : null;
  const stageRunId = process?.stageId
    ? ((getSqlite()
        .prepare("select id from role_app_stage_runs where run_id = ? and role_app_run_id = ? and stage_id = ?")
        .get(context.runId, process.runId, process.stageId) as { id: string } | undefined)?.id ?? null)
    : null;

  /* The new actions, with the identifiers the confirmation writes for them. */
  const planned: Array<{ id: string; item: MinutesDraft["actions"][number] }> = [];
  for (const item of draft.actions) {
    if (item.existingActionId !== null) continue;
    planned.push({ id: actionIdForMinutes(minutesId, planned.length + 1), item });
  }
  const plannedIds = stringList(payload, "actionIds");
  if (plannedIds.join(",") !== planned.map((entry) => entry.id).join(",")) {
    throw new Error("The actions to be raised differ from the ones the approval covers, so nothing was confirmed.");
  }
  const followUps = draft.actions.filter((item) => item.existingActionId !== null);
  const named = new Set(followUps.flatMap((item) => (item.existingActionId ? [item.existingActionId] : [])));
  const createdIds = new Map(planned.map((entry) => [entry.item.key, entry.id]));
  const linkedDecisions = [...new Set(draft.decisions.flatMap((decision) => (decision.decisionId ? [decision.decisionId] : [])))];
  const openDecisions = linkedDecisions.filter((id) => shared.decisions.find((decision) => decision.id === id)?.status === "open");
  const wasHeld = meeting.status === "concluded";

  const body = renderMinutesText({
    title: row.title,
    reference: meeting.reference,
    when: `${meeting.scheduledFor.slice(8, 10)}.${meeting.scheduledFor.slice(5, 7)}.${meeting.scheduledFor.slice(0, 4)}, ${timeOf(meeting.scheduledFor)}`,
    participants: meeting.participantUserIds.map((id) => personName(shared, id) ?? id),
    draft,
    personName: (id) => personName(shared, id) ?? "",
    decisionTitle: (id) => {
      const decision = shared.decisions.find((candidate) => candidate.id === id);
      return decision ? decisionTitle(decision, draft.language) : "";
    },
    actionIds: createdIds,
    outcomeLabel: (outcome) => outcomeLabel(outcome, draft.language),
  });

  const turns = heardTurns(meeting, getMeetingTranscript(meeting.id), state.scenarioDate, context.atMoment);
  const eventIds: string[] = [];
  const receipt: string[] = [];

  const write = getSqlite().transaction(() => {
    /* 1. The minutes become evidence, with lineage. */
    db()
      .insert(evidenceDocuments)
      .values({
        id: evidenceId,
        runId: context.runId,
        reference: minutesId,
        title: row.title,
        titleDe: row.title,
        sourceType: "meeting-minutes",
        sourceSystem: "Work Hub minutes",
        authorLabel: `${holderName} (${context.actingUserId})`,
        authorUserId: context.actingUserId,
        documentDate: state.scenarioDate,
        ingestedAt: now,
        entityIds: [entityId],
        dataClassification: "internal",
        status: "current",
        requestedFromLabel: null,
        requestedOn: null,
        isStale: false,
        stalenessNote: "",
        provenance: "approved-record",
        body,
        summary: firstLine(draft.summary.length > 0 ? draft.summary : body, 400),
        relatedObjectIds: [
          ...new Set([
            meeting.id,
            minutesId,
            ...(meeting.subjectId ? [meeting.subjectId] : []),
            ...linkedDecisions,
            ...planned.map((entry) => entry.id),
            ...followUps.flatMap((item) => (item.existingActionId ? [item.existingActionId] : [])),
            ...(process ? [process.runId] : []),
          ]),
        ],
        pageCount: 1,
        fromSharedEvent: false,
        revealedAtMoment: context.atMoment,
        sourceMinutesId: minutesId,
        sourceMessageId: null,
      })
      .run();
    for (const chunk of chunksOf(evidenceId, context.runId, body)) db().insert(evidenceChunks).values(chunk).run();
    receipt.push(`Minutes ${minutesId} filed as evidence ${evidenceId}`);

    /* 2. The new actions, with meeting, minutes and process lineage. */
    for (const { id, item } of planned) {
      db()
        .insert(actions)
        .values({
          id,
          runId: context.runId,
          reference: id,
          title: item.title,
          titleDe: "",
          description: item.completionCondition.length > 0 ? item.completionCondition : item.title,
          kind: item.kind,
          issueId: null,
          raisedByRoleId: context.roleId,
          ownerUserId: item.ownerUserId,
          ownerLabel: item.ownerLabel,
          entityId,
          createdOn: state.scenarioDate,
          dueOn: item.dueOn,
          completedOn: null,
          status: "open",
          priority: "medium",
          isUnowned: item.ownerUserId === null,
          relatedObjectKind: meeting.subjectKind,
          relatedObjectId: meeting.subjectId,
          sourceDecisionId: null,
          createdBySession: true,
          progressNote: "",
          completionCondition: item.completionCondition.length > 0 ? item.completionCondition : null,
          completionConditionBy: item.completionCondition.length > 0 ? context.actingUserId : null,
          completionConditionAt: item.completionCondition.length > 0 ? now : null,
          blockedReason: null,
          blockedSince: null,
          sourceMeetingId: meeting.id,
          sourceMinutesId: minutesId,
          sourceProcessRunId: process?.runId ?? null,
          sourceStageId: process?.stageId ?? null,
          sourceStageRunId: stageRunId,
          sourceMessageId: null,
        })
        .run();
      insertEntry(context, {
        actionId: id,
        kind: "CRT",
        note: `Raised in the minutes of ${meeting.reference} (${minutesId}), confirmed by ${holderName}.`,
        evidenceIds: item.evidenceIds,
        statusAfter: "open",
        authorKind: "human",
        at: now,
      });
      receipt.push(
        `Action ${id} raised: ${firstLine(item.title, 90)}, owner ${personName(shared, item.ownerUserId) ?? ""}, due ${item.dueOn ? displayDate(item.dueOn) : ""}`,
      );
    }

    /* 3. A follow-up on each existing action the minutes name, and, if the meeting was not yet held, on the rest of the work that depended on it. */
    const existingRows = named.size > 0
      ? db().select().from(actions).where(and(eq(actions.runId, context.runId), inArray(actions.id, [...named]))).all()
      : [];
    for (const actionRow of existingRows) {
      if (actionRow.status === "completed" || actionRow.status === "cancelled") {
        throw new Error(`${actionRow.id} is ${actionRow.status}, so the minutes cannot follow it up. Reopen it or remove it from the minutes.`);
      }
      const item = followUps.find((candidate) => candidate.existingActionId === actionRow.id);
      insertEntry(context, {
        actionId: actionRow.id,
        kind: "MTG",
        note: `Recorded in the minutes of ${meeting.reference} (${minutesId}): ${firstLine(item && item.completionCondition.length > 0 ? item.completionCondition : (item?.title ?? actionRow.title), 400)}`,
        evidenceIds: item?.evidenceIds ?? [],
        statusAfter: carriedStatus(context, actionRow, actionRow.status),
        authorKind: "human",
        at: now,
      });
      receipt.push(`Follow-up entry added to ${actionRow.id}`);
    }
    if (existingRows.length !== named.size) throw new Error("An action the minutes follow up does not exist, so nothing was confirmed.");

    const dependents = wasHeld
      ? []
      : shared.actions.filter(
          (candidate) =>
            candidate.status !== "completed" &&
            candidate.status !== "cancelled" &&
            !named.has(candidate.id) &&
            meeting.subjectId !== null &&
            candidate.relatedObjectId === meeting.subjectId,
        );
    for (const dependent of dependents) {
      insertEntry(context, {
        actionId: dependent.id,
        kind: "MTG",
        note: `${meeting.reference} was held and its minutes ${minutesId} confirmed. Check whether this action is affected.`,
        evidenceIds: [],
        statusAfter: carriedStatus(context, dependent, dependent.status),
        authorKind: "system",
        at: now,
      });
    }
    if (dependents.length > 0) receipt.push(`Follow-up entry added to ${dependents.map((entry) => entry.id).join(", ")}`);

    /* 4. The meeting is held. */
    if (!wasHeld) {
      db()
        .update(meetings)
        .set({
          status: "concluded",
          outcome: meeting.outcome.length > 0 ? meeting.outcome : firstLine(draft.summary, 600),
          concludedAt: now,
          heldByUserId: context.actingUserId,
          heldAt,
        })
        .where(and(eq(meetings.runId, context.runId), eq(meetings.id, meeting.id)))
        .run();
      db()
        .update(calendarEvents)
        .set({ preparationStatus: "completed" })
        .where(and(eq(calendarEvents.runId, context.runId), eq(calendarEvents.meetingId, meeting.id)))
        .run();
      receipt.push(`${meeting.reference} recorded as held`);
    }

    /* 5. The minutes are the record. */
    db()
      .update(meetingMinutes)
      .set({
        status: "confirmed",
        summary: draft.summary,
        factItems: draft.facts.map((fact) => fact.text),
        decisionIds: linkedDecisions,
        actionIds: [...planned.map((entry) => entry.id), ...named],
        unresolvedItems: draft.unresolved.map((item) => item.text),
        evidenceIds: draft.evidenceIds,
        participantUserIds: meeting.participantUserIds,
        confirmedByUserId: context.actingUserId,
        confirmedAt: now,
        evidenceDocumentId: evidenceId,
        distributionUserIds: draft.distribution,
      })
      .where(and(eq(meetingMinutes.runId, context.runId), eq(meetingMinutes.id, minutesId)))
      .run();
    receipt.push(`Minutes ${minutesId} confirmed by ${holderName}`);

    /* 6. The backbone. */
    const common = {
      runId: context.runId,
      roleId: context.roleId,
      atMoment: context.atMoment,
      actorKind: "human" as const,
      actorUserId: context.actingUserId,
      correlationId: minutesId,
    };
    eventIds.push(
      publishOsEvent({
        ...common,
        type: "meeting-completed",
        subject: { kind: "meeting", id: meeting.id },
        process: process ? { runId: process.runId, stageId: process.stageId } : null,
        summary: {
          en: `${meeting.reference} minutes confirmed by ${holderName}: ${planned.length} actions raised, filed as ${evidenceId}.`,
          de: `Protokoll zu ${meeting.reference} von ${holderName} bestaetigt: ${planned.length} Massnahmen erfasst, abgelegt als ${evidenceId}.`,
        },
        payload: {
          minutesId,
          evidenceDocumentId: evidenceId,
          createdActionIds: planned.map((entry) => entry.id),
          followedUpActionIds: [...named],
          decisionIds: linkedDecisions,
          turnsHeard: turns.length,
        },
        idempotencyKey: `minutes-confirmed:${minutesId}`,
      }).event.id,
    );
    if (process) {
      eventIds.push(
        publishOsEvent({
          ...common,
          type: "source-changed",
          subject: { kind: "meeting", id: meeting.id },
          process: { runId: process.runId, stageId: process.stageId },
          summary: {
            en: `The record of ${meeting.reference} changed: its minutes were confirmed as ${evidenceId}.`,
            de: `Die Aufzeichnung zu ${meeting.reference} hat sich geaendert: Das Protokoll wurde als ${evidenceId} bestaetigt.`,
          },
          payload: { sourceKind: "meeting-record", meetingId: meeting.id, minutesId, evidenceDocumentId: evidenceId, stageRunId },
          idempotencyKey: `source-changed:minutes:${minutesId}`,
        }).event.id,
      );
      receipt.push(`Meeting record published to the process stage ${process.stageId ?? process.runId}`);
    }
    for (const { id, item } of planned) {
      eventIds.push(
        publishOsEvent({
          ...common,
          type: "action-updated",
          subject: { kind: "action", id },
          process: process ? { runId: process.runId, stageId: process.stageId } : null,
          summary: {
            en: `Action ${id} raised from the minutes of ${meeting.reference}: ${firstLine(item.title, 120)}`,
            de: `Massnahme ${id} aus dem Protokoll zu ${meeting.reference} erfasst: ${firstLine(item.title, 120)}`,
          },
          payload: { minutesId, meetingId: meeting.id, ownerUserId: item.ownerUserId, dueOn: item.dueOn },
          idempotencyKey: `action-raised:${id}`,
        }).event.id,
      );
    }
    for (const id of named) {
      eventIds.push(
        publishOsEvent({
          ...common,
          type: "action-updated",
          subject: { kind: "action", id },
          summary: {
            en: `Action ${id} followed up in the minutes of ${meeting.reference}.`,
            de: `Massnahme ${id} im Protokoll zu ${meeting.reference} nachverfolgt.`,
          },
          payload: { minutesId, meetingId: meeting.id },
          idempotencyKey: `action-followed-up:${minutesId}:${id}`,
        }).event.id,
      );
    }
    for (const decisionId of openDecisions) {
      const decision = draft.decisions.find((candidate) => candidate.decisionId === decisionId);
      eventIds.push(
        publishOsEvent({
          ...common,
          type: "decision-requested",
          subject: { kind: "decision", id: decisionId },
          summary: {
            en: `${decisionId} was discussed at ${meeting.reference} (${decision ? outcomeLabel(decision.outcome, "en").toLowerCase() : "discussed"}). It stays with its owner to record on Decisions; the minutes are ${evidenceId}.`,
            de: `${decisionId} wurde in ${meeting.reference} eroertert (${decision ? outcomeLabel(decision.outcome, "de").toLowerCase() : "eroertert"}). Sie bleibt zur Erfassung unter Entscheidungen bei ihrer verantwortlichen Person; das Protokoll ist ${evidenceId}.`,
          },
          payload: { minutesId, meetingId: meeting.id, evidenceDocumentId: evidenceId, outcome: decision?.outcome ?? "referred" },
          idempotencyKey: `decision-requested:minutes:${minutesId}:${decisionId}`,
        }).event.id,
      );
      receipt.push(`Decision ${decisionId}: discussion recorded, the decision stays open with its owner`);
    }
  });
  write();

  return {
    summary: `Minutes ${minutesId} of ${meeting.id} confirmed as the record: filed as ${evidenceId}, ${planned.length} actions raised, ${named.size} followed up.`,
    objectKind: "minutes",
    objectId: minutesId,
    evidenceIds: draft.evidenceIds,
    data: {
      minutesId,
      meetingId: meeting.id,
      evidenceDocumentId: evidenceId,
      createdActionIds: planned.map((entry) => entry.id),
      followedUpActionIds: [...named],
      eventIds,
      process: process ? { runId: process.runId, stageId: process.stageId, stageRunId } : null,
    },
    receiptStatements: receipt,
  };
});

/* ==========================================================================
   Distribution
   ========================================================================== */

register("distributeMeetingMinutes", (payload, context): ToolHandlerResult => {
  const minutesId = requireText(payload, "minutesId", "The minutes");
  const recipients = stringList(payload, "recipients");
  const row = getMinutesById(minutesId, context.runId);
  if (!row) throw new Error(`The minutes "${minutesId}" do not exist, so nothing was sent.`);
  if (row.roleId !== context.roleId) throw new Error(`${minutesId} belong to another role's meeting.`);
  if (row.status !== "confirmed") {
    throw new Error(row.status === "distributed" ? `${minutesId} were already distributed. Nothing was sent twice.` : `${minutesId} are not confirmed, and only a confirmed record is distributed.`);
  }
  if (recipients.length === 0 || recipients.join(",") !== row.distributionUserIds.join(",")) {
    throw new Error("The recipients differ from the distribution list confirmed with the minutes, so nothing was sent.");
  }
  const evidence = row.evidenceDocumentId
    ? db().select().from(evidenceDocuments).where(and(eq(evidenceDocuments.runId, context.runId), eq(evidenceDocuments.id, row.evidenceDocumentId))).get()
    : undefined;

  const messageId = `COL-${minutesSuffix(minutesId)}-DIST`;
  const now = new Date().toISOString();
  const write = getSqlite().transaction(() => {
    db()
      .insert(collaborationMessages)
      .values({
        id: messageId,
        runId: context.runId,
        fromRoleId: context.roleId,
        toUserIds: recipients,
        kind: "minutes-distribution",
        channelName: "Meeting minutes",
        subject: row.title,
        body: evidence?.body ?? row.summary,
        sentAtMoment: context.atMoment,
        sentAt: now,
        simulatedOnly: true,
        relatedObjectKind: "minutes",
        relatedObjectId: minutesId,
        decisionId: null,
        replyBody: "",
        replyFromUserId: null,
        replyAtMoment: null,
      })
      .run();
    db()
      .update(meetingMinutes)
      .set({ status: "distributed", distributedAt: now, distributionMessageId: messageId })
      .where(and(eq(meetingMinutes.runId, context.runId), eq(meetingMinutes.id, minutesId)))
      .run();
  });
  write();

  return {
    summary: `Minutes ${minutesId} distributed to ${recipients.join(", ")} as simulated message ${messageId}. It was not delivered to any real recipient.`,
    objectKind: "minutes",
    objectId: minutesId,
    data: { minutesId, messageId, recipients },
    receiptStatements: [`Minutes distributed to ${recipients.length} people as a simulated message. Nothing left this machine`],
  };
});

/** Ensures the module's registrations have run. Imported by the governance module. */
export const meetingToolHandlersRegistered = true;
