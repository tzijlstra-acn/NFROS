/**
 * Tool handlers for inbox triage and conversion.
 *
 * Every write the inbox makes is one of these handlers, or `createAction` in
 * `src/agents/tools/mutations.ts`, and every handler is reached only through
 * `executeTool`, so the authority gate has already run and, where the gate
 * asks for one, a person's payload bound approval has been found and will be
 * consumed. As in `modules/actions/tools.ts`, a handler does not check
 * authority itself; it checks the facts the gate cannot see, and throws
 * rather than write something untrue:
 *
 *   the message is in the acting role's inbox and has arrived by the
 *   scenario clock;
 *   an action linked as raised from the message names the message as its
 *   source; an existing action it is linked to is open and on the role's
 *   desk; a decision it is routed to is open and visible to the role;
 *   a message is filed as evidence once, against objects it or the role's
 *   running processes actually concern;
 *   a process stage it joins belongs to the role's own running process and
 *   is open;
 *   a delegate is an internal person, and a reply has a person to go to.
 *
 * Each handler writes its change and publishes its one backbone event in the
 * same transaction, so the record and the event cannot disagree. The event
 * carries the message as its correlation, and identifiers, classifications
 * and the person's own reason as its payload; never the message text, which
 * is an external party's words. Nothing here writes a process stage table:
 * a message joins a stage as a stage input (`process_stage_inputs`, which the
 * engine reads as part of the stage context) and through the backbone, and
 * the operation brings the stage up to date through the process engine's
 * public API afterwards.
 *
 * What the message became is stored on the message itself (migration 0008)
 * in the same transaction: the conversion and its attribution through
 * `recordInboxConversion`, a classification and who confirmed it through
 * `recordTriageConfirmation`, and the evidence document and the delegate in
 * their own columns. The repository keeps the rules; a handler only says
 * what happened.
 */

import { and, eq } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import { actions } from "@/db/schema/decisions";
import { collaborationMessages, evidenceChunks, evidenceDocuments, inboxMessages, type InboxConversionKind } from "@/db/schema/work";
import type { ProvenanceKind } from "@/db/schema/core";
import { getRun, getStageRun } from "@/db/repositories/role-app-runtime";
import { getActionsRaisedFrom, getEvidenceFiledFrom, getInboxMessage, getOutboundAbout, INBOX_MESSAGE_KIND, type InboxMessageRow } from "@/db/repositories/inbox";
import { recordInboxConversion, recordTriageConfirmation } from "@/db/repositories/inbox-conversion";
import { addStageInput, findStageInputsForSource } from "@/db/repositories/process-stage-inputs";
import {
  hasToolHandler,
  registerToolHandler,
  type ToolContext,
  type ToolHandler,
  type ToolHandlerResult,
} from "@/agents/tools/runtime";
import { publishOsEvent, type PublishOsEventInput } from "@/features/events/backbone";
import { momentToMinutes } from "@/domain/nfr/calculators";
import { requireScenarioState } from "@/scenario/engine/state";
import { say } from "../../copy";
import { loadWorkShared } from "../../hub-data";
import { dateOf, displayDate, firstLine } from "../../model";
import { personName } from "../../shared";
import { getWorkRoleConfig } from "../../roles";
import { insertEntry } from "../actions/tools";
import { deriveLineage, DELEGATION_CHANNEL, INBOX_EVENT_SOURCE, REPLY_CHANNEL, type InboxEventPayload } from "./lineage";
import { loadInboxEvents } from "./load";
import { composeReply, firstNameOf } from "./reply";
import { messageSource } from "./sources";
import { isInboxClassification, validateReplyDraft } from "./triage-schema";

const db = () => getDb();

function register(toolName: string, handler: ToolHandler): void {
  if (hasToolHandler(toolName)) return;
  registerToolHandler(toolName, handler);
}

function str(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function requireText(payload: Record<string, unknown>, key: string, label: string, max = 2000): string {
  const value = str(payload, key);
  if (value.length === 0) throw new Error(`${label} is required, so nothing was written.`);
  if (value.length > max) throw new Error(`${label} is longer than ${max} characters, so nothing was written.`);
  return value;
}

function stringList(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim()))];
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

let idSequence = 0;
function newId(prefix: string): string {
  idSequence += 1;
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${String(idSequence).padStart(4, "0")}`;
}

/** The message, checked to be in the acting role's inbox and to have arrived by the clock. */
function messageFor(context: ToolContext, payload: Record<string, unknown>): InboxMessageRow {
  const messageId = requireText(payload, "messageId", "The message", 120);
  const row = getInboxMessage(messageId, context.runId);
  if (!row || row.roleId !== context.roleId) {
    throw new Error(`The message "${messageId}" is not in this role's inbox, so nothing was written.`);
  }
  if (momentToMinutes(row.revealedAtMoment) > momentToMinutes(context.atMoment)) {
    throw new Error(`${messageId} has not arrived by ${context.atMoment}, so nothing was written.`);
  }
  return row;
}

function updateMessage(context: ToolContext, messageId: string, values: Partial<typeof inboxMessages.$inferInsert>): void {
  db()
    .update(inboxMessages)
    .set(values)
    .where(and(eq(inboxMessages.runId, context.runId), eq(inboxMessages.id, messageId)))
    .run();
}

/**
 * What the message became, who made it so and when, by the repository's one
 * rule (migration 0008): the first conversion to work is kept and never
 * replaced, a dismissal is recorded only while there is none, and a
 * conversion to work replaces a dismissal. Called inside the handler's
 * transaction, beside the change itself.
 */
function recordConversion(context: ToolContext, row: InboxMessageRow, kind: InboxConversionKind, at: string): void {
  recordInboxConversion(row.id, { kind, byUserId: context.actingUserId, at }, context.runId);
}

/**
 * Turning a message into work confirms the classification the conversion
 * implies, when the person has not classified it themselves. The
 * classification is then written once with who and when, so the attribution
 * always describes the classification beside it. A classification the
 * person recorded is never replaced by a conversion.
 */
function confirmByConversion(context: ToolContext, row: InboxMessageRow, classification: string | null, at: string): void {
  if (row.confirmedTriage || !classification) return;
  recordTriageConfirmation(row.id, { classification, byUserId: context.actingUserId, at, reason: null }, context.runId);
}

function actorName(context: ToolContext): string {
  const row = getSqlite().prepare("select name from users where run_id = ? and id = ?").get(context.runId, context.actingUserId) as
    | { name: string }
    | undefined;
  return row?.name ?? context.actingUserId;
}

function userName(context: ToolContext, userId: string | null): string {
  if (!userId) return "";
  const row = getSqlite().prepare("select name from users where run_id = ? and id = ?").get(context.runId, userId) as { name: string } | undefined;
  return row?.name ?? userId;
}

function classWord(context: ToolContext, classification: string | null, language: "en" | "de"): string {
  if (!classification) return language === "de" ? "nicht eingeordnet" : "not classified";
  const label = getWorkRoleConfig(context.roleId)?.inboxClassifications[classification]?.label;
  return label ? say(label, language) : classification;
}

/** Publishes the one event of an inbox change, inside the caller's transaction. Returns its identifier. */
function publish(
  context: ToolContext,
  input: Omit<PublishOsEventInput, "runId" | "roleId" | "atMoment" | "actorKind" | "actorUserId" | "correlationId" | "payload"> & {
    payload: Omit<InboxEventPayload, "source" | "outcome">;
  },
): string {
  const payload: InboxEventPayload = { ...input.payload, source: INBOX_EVENT_SOURCE, outcome: "executed" };
  return publishOsEvent({
    ...input,
    runId: context.runId,
    roleId: context.roleId,
    atMoment: context.atMoment,
    actorKind: context.actorKind === "human" ? "human" : "ai",
    actorUserId: context.actingUserId,
    correlationId: payload.messageId,
    payload: payload as unknown as Record<string, unknown>,
  }).event.id;
}

/* ==========================================================================
   Triage
   ========================================================================== */

/**
 * Records a person's triage. The classification is the person's; the AI's
 * proposal stays on the row beside it (`proposed_triage`), so the record
 * shows both. Filing as information and dismissing as noise close the
 * message, and mark it read; confirming any other classification leaves it
 * in Needs me until it is turned into work.
 *
 * The classification is written with who confirmed it, when and why. A
 * dismissal is also what the message became (`conversion_kind` dismissed).
 * A person who later classifies a dismissed message as anything else takes
 * the dismissal back: nothing became of the message, so the stored
 * conversion is cleared rather than left saying it was dismissed.
 */
register("recordInboxTriage", (payload, context): ToolHandlerResult => {
  const row = messageFor(context, payload);
  const classification = str(payload, "classification");
  if (!isInboxClassification(classification)) {
    throw new Error(`"${classification}" is not one of the six classifications, so nothing was written.`);
  }
  const proposed = str(payload, "proposed");
  const reason = str(payload, "reason");
  if (reason.length > 1000) throw new Error("The reason is longer than 1000 characters, so nothing was written.");
  if (row.confirmedTriage === classification) {
    throw new Error(`${row.id} is already classified as ${classification}. Nothing was changed.`);
  }
  /* A classification that departs from the proposal is the person's judgment, and it carries their reason. */
  if (classification !== proposed && reason.length === 0) {
    throw new Error("A classification other than the proposal needs a reason, so nothing was written.");
  }

  const closes = classification === "information" || classification === "noise";
  const from = row.confirmedTriage ?? (proposed.length > 0 ? proposed : null);
  const holder = actorName(context);
  const changed = from !== null && from !== classification;
  const triageCount = (getSqlite()
    .prepare("select count(*) as n from os_events where run_id = ? and idempotency_key like ?")
    .get(context.runId, `inbox-triage:${row.id}:%`) as { n: number }).n;

  const summary = {
    en:
      classification === "noise"
        ? `${holder} dismissed ${row.id} as ${classWord(context, "noise", "en")}.${reason ? ` Reason: ${firstLine(reason, 200)}` : ""}`
        : classification === "information" && !changed
          ? `${holder} filed ${row.id} as ${classWord(context, "information", "en")}.`
          : changed
            ? `${holder} changed the triage of ${row.id} from ${classWord(context, from, "en")} to ${classWord(context, classification, "en")}. Reason: ${firstLine(reason, 200)}`
            : `${holder} confirmed the triage of ${row.id} as ${classWord(context, classification, "en")}.`,
    de:
      classification === "noise"
        ? `${holder} hat ${row.id} als ${classWord(context, "noise", "de")} verworfen.${reason ? ` Begruendung: ${firstLine(reason, 200)}` : ""}`
        : classification === "information" && !changed
          ? `${holder} hat ${row.id} als ${classWord(context, "information", "de")} abgelegt.`
          : changed
            ? `${holder} hat die Einordnung von ${row.id} von ${classWord(context, from, "de")} in ${classWord(context, classification, "de")} geaendert. Begruendung: ${firstLine(reason, 200)}`
            : `${holder} hat die Einordnung von ${row.id} als ${classWord(context, classification, "de")} bestaetigt.`,
  };

  const now = new Date().toISOString();
  const write = getSqlite().transaction(() => {
    recordTriageConfirmation(row.id, { classification, byUserId: context.actingUserId, at: now, reason: reason.length > 0 ? reason : null }, context.runId);
    if (closes) updateMessage(context, row.id, { isRead: true });
    if (classification === "noise") {
      recordConversion(context, row, "dismissed", now);
    } else if (row.conversionKind === "dismissed") {
      updateMessage(context, row.id, { conversionKind: null, convertedByUserId: null, convertedAt: null });
    }
    return publish(context, {
      type: "tool-executed",
      subject: { kind: INBOX_MESSAGE_KIND, id: row.id },
      summary,
      payload: { messageId: row.id, operation: "triage", toolName: "recordInboxTriage", from, to: classification, reason },
      idempotencyKey: `inbox-triage:${row.id}:${triageCount + 1}`,
    });
  });
  const eventId = write();

  return {
    summary: summary.en,
    objectKind: INBOX_MESSAGE_KIND,
    objectId: row.id,
    data: { messageId: row.id, classification, eventId },
    receiptStatements: [`Triage of ${row.id} recorded as ${classWord(context, classification, "en")}`],
  };
});

/* ==========================================================================
   Message to action, message to decision
   ========================================================================== */

register("linkInboxMessage", (payload, context): ToolHandlerResult => {
  const row = messageFor(context, payload);
  const targetKind = str(payload, "targetKind");
  const targetId = requireText(payload, "targetId", "The target", 120);
  const holder = actorName(context);
  const now = new Date().toISOString();

  if (targetKind === "action") {
    if (row.linkedActionId && row.linkedActionId !== targetId) {
      throw new Error(`${row.id} already became action ${row.linkedActionId}. Nothing was linked.`);
    }
    const action = db().select().from(actions).where(and(eq(actions.runId, context.runId), eq(actions.id, targetId))).get();
    if (!action) throw new Error(`The action "${targetId}" does not exist, so nothing was linked.`);
    const created = payload["created"] === true;
    if (created && action.sourceMessageId !== row.id) {
      throw new Error(`${targetId} does not name ${row.id} as its source, so it was not linked as raised from it.`);
    }
    if (!created) {
      const holderId = (getSqlite().prepare("select holder_user_id as holder from roles where run_id = ? and id = ?").get(context.runId, context.roleId) as
        | { holder: string }
        | undefined)?.holder ?? null;
      if (action.raisedByRoleId !== context.roleId && action.ownerUserId !== holderId) {
        throw new Error(`${targetId} is not on this role's desk, so the message was not linked to it.`);
      }
      if (action.status === "completed" || action.status === "cancelled") {
        throw new Error(`${targetId} is ${action.status}. Reopen it before linking a message to it.`);
      }
    }
    const subjectLine = firstLine(row.subject, 160);
    const write = getSqlite().transaction(() => {
      updateMessage(context, row.id, { linkedActionId: targetId, isRead: true });
      confirmByConversion(context, row, "action", now);
      recordConversion(context, row, "action", now);
      insertEntry(context, {
        actionId: targetId,
        kind: created ? "CRT" : "UPD",
        note: created
          ? `Raised from inbox message ${row.id} from ${row.fromLabel}, by ${holder}: ${subjectLine}`
          : `Inbox message ${row.id} from ${row.fromLabel} linked by ${holder}: ${subjectLine}`,
        evidenceIds: [],
        statusAfter: action.blockedReason ? "blocked" : action.status,
        authorKind: "human",
        at: now,
      });
      return publish(context, {
        type: created ? "work-arrived" : "action-updated",
        subject: { kind: "action", id: targetId },
        summary: created
          ? { en: `${holder} raised action ${targetId} from message ${row.id}.`, de: `${holder} hat die Massnahme ${targetId} aus der Nachricht ${row.id} erfasst.` }
          : { en: `${holder} linked message ${row.id} to action ${targetId}.`, de: `${holder} hat die Nachricht ${row.id} mit der Massnahme ${targetId} verknuepft.` },
        payload: { messageId: row.id, operation: "link", toolName: "linkInboxMessage", targetKind: "action", targetId, created },
        idempotencyKey: `inbox-converted:${row.id}:action:${targetId}`,
      });
    });
    const eventId = write();
    return {
      summary: created ? `Message ${row.id} linked to action ${targetId}, raised from it.` : `Message ${row.id} linked to action ${targetId}.`,
      objectKind: INBOX_MESSAGE_KIND,
      objectId: row.id,
      data: { messageId: row.id, actionId: targetId, eventId },
      receiptStatements: [`${row.id} linked to action ${targetId}`, `History entry added to ${targetId}`],
    };
  }

  if (targetKind === "decision") {
    if (row.linkedDecisionId && row.linkedDecisionId !== targetId) {
      throw new Error(`${row.id} is already routed to decision ${row.linkedDecisionId}. Nothing was linked.`);
    }
    const decision = getSqlite()
      .prepare("select status, role_id as roleId, presented_at_moment as presented from decisions where run_id = ? and id = ?")
      .get(context.runId, targetId) as { status: string; roleId: string; presented: string } | undefined;
    if (!decision || decision.roleId !== context.roleId || momentToMinutes(decision.presented) > momentToMinutes(context.atMoment)) {
      throw new Error(`The decision "${targetId}" is not in front of this role, so nothing was linked.`);
    }
    if (decision.status !== "open") {
      throw new Error(`${targetId} is already recorded. A message is routed only to an open decision.`);
    }
    const write = getSqlite().transaction(() => {
      updateMessage(context, row.id, { linkedDecisionId: targetId, isRead: true });
      confirmByConversion(context, row, "decision", now);
      recordConversion(context, row, "decision", now);
      return publish(context, {
        type: "work-arrived",
        subject: { kind: "decision", id: targetId },
        summary: {
          en: `${holder} routed message ${row.id} to decision ${targetId}. The judgment stays on Decisions.`,
          de: `${holder} hat die Nachricht ${row.id} an die Entscheidung ${targetId} weitergeleitet. Die Beurteilung bleibt unter Entscheidungen.`,
        },
        payload: { messageId: row.id, operation: "link", toolName: "linkInboxMessage", targetKind: "decision", targetId, created: false },
        idempotencyKey: `inbox-converted:${row.id}:decision:${targetId}`,
      });
    });
    const eventId = write();
    return {
      summary: `Message ${row.id} routed to decision ${targetId}.`,
      objectKind: INBOX_MESSAGE_KIND,
      objectId: row.id,
      data: { messageId: row.id, decisionId: targetId, eventId },
      receiptStatements: [`${row.id} routed to decision ${targetId}`],
    };
  }

  throw new Error(`"${targetKind}" is not something a message can be linked to, so nothing was written.`);
});

/* ==========================================================================
   Message to evidence
   ========================================================================== */

/** The provenance of a message filed as evidence: a person's statement, or system output. */
function provenanceOf(row: InboxMessageRow): ProvenanceKind {
  return row.channel === "mail" || row.channel === "collaboration" ? "stakeholder-statement" : "telemetry";
}

export function evidenceIdForMessage(messageId: string): string {
  return `EVD-${messageId}`;
}

register("fileInboxMessageAsEvidence", (payload, context): ToolHandlerResult => {
  const row = messageFor(context, payload);
  const evidenceId = evidenceIdForMessage(row.id);
  const existing = db().select({ id: evidenceDocuments.id }).from(evidenceDocuments).where(and(eq(evidenceDocuments.runId, context.runId), eq(evidenceDocuments.id, evidenceId))).get();
  if (existing) throw new Error(`${row.id} is already filed as evidence ${evidenceId}. Nothing was filed twice.`);

  const title = requireText(payload, "title", "The document title", 240);
  const objectIds = stringList(payload, "objectIds");
  /*
   * A message is evidence of what it is about, or of the subject of one of the
   * role's running processes. Anything else would put a document on an object
   * the message does not concern.
   */
  const subjects = (getSqlite()
    .prepare("select subject_id as id from role_app_runs where run_id = ? and role_id = ?")
    .all(context.runId, context.roleId) as Array<{ id: string }>).map((entry) => entry.id);
  const allowed = new Set([row.relatedObjectId, ...subjects].filter((id): id is string => typeof id === "string" && id.length > 0));
  for (const id of objectIds) {
    if (!IDENTIFIER.test(id) || !allowed.has(id)) {
      throw new Error(`${id} is not an object this message or the role's running processes concern, so nothing was filed.`);
    }
  }

  const state = requireScenarioState(context.runId);
  const entity = (getSqlite().prepare("select entity_id as entity from roles where run_id = ? and id = ?").get(context.runId, context.roleId) as
    | { entity: string }
    | undefined)?.entity ?? "ARC-DE";
  const holder = actorName(context);
  const now = new Date().toISOString();
  /* The sender's record is all the source label needs. */
  const sender = row.fromUserId
    ? (getSqlite().prepare("select id, name, job_title as jobTitle, line from users where run_id = ? and id = ?").get(context.runId, row.fromUserId) as
        | { id: string; name: string; jobTitle: string; line: string }
        | undefined)
    : undefined;
  const sourceLabel = messageSource(row, { people: new Map(sender ? [[sender.id, sender]] : []) }).label.en;
  const relatedObjectIds = [
    ...new Set([...objectIds, row.id, ...(row.relatedObjectKind === "evidence-document" && row.relatedObjectId ? [row.relatedObjectId] : [])]),
  ];

  const write = getSqlite().transaction(() => {
    db()
      .insert(evidenceDocuments)
      .values({
        id: evidenceId,
        runId: context.runId,
        reference: row.id,
        title,
        titleDe: row.subjectDe.length > 0 && title === row.subject ? row.subjectDe : title,
        sourceType: "correspondence",
        sourceSystem: `Work Hub inbox, ${sourceLabel} (simulated)`,
        authorLabel: row.fromLabel,
        authorUserId: row.fromUserId,
        documentDate: dateOf(row.receivedAt),
        ingestedAt: now,
        entityIds: [entity],
        dataClassification: "internal",
        status: "current",
        requestedFromLabel: null,
        requestedOn: null,
        isStale: false,
        stalenessNote: "",
        provenance: provenanceOf(row),
        body: row.body,
        summary: firstLine(row.body, 300),
        relatedObjectIds,
        pageCount: 1,
        fromSharedEvent: row.fromSharedEvent,
        revealedAtMoment: context.atMoment,
        sourceMinutesId: null,
        sourceMessageId: row.id,
      })
      .run();
    db()
      .insert(evidenceChunks)
      .values({
        id: `${evidenceId}-C00`,
        runId: context.runId,
        documentId: evidenceId,
        chunkIndex: 0,
        locator: "Message",
        content: row.body,
        embedding: null,
        embeddingModel: null,
        embeddedAt: null,
        tokenEstimate: Math.ceil(row.body.length / 4),
      })
      .run();
    updateMessage(context, row.id, { linkedEvidenceDocumentId: evidenceId, isRead: true });
    confirmByConversion(context, row, "evidence", now);
    recordConversion(context, row, "evidence", now);
    return publish(context, {
      type: "work-arrived",
      subject: { kind: "evidence-document", id: evidenceId },
      summary: {
        en: `${holder} filed message ${row.id} as evidence ${evidenceId}${objectIds.length > 0 ? ` against ${objectIds.join(", ")}` : ""}.`,
        de: `${holder} hat die Nachricht ${row.id} als Nachweis ${evidenceId}${objectIds.length > 0 ? ` zu ${objectIds.join(", ")}` : ""} abgelegt.`,
      },
      payload: { messageId: row.id, operation: "evidence", toolName: "fileInboxMessageAsEvidence", evidenceDocumentId: evidenceId, objectIds },
      idempotencyKey: `inbox-converted:${row.id}:evidence:${evidenceId}`,
    });
  });
  const eventId = write();

  return {
    summary: `Message ${row.id} filed as evidence ${evidenceId} on ${displayDate(state.scenarioDate)}.`,
    objectKind: INBOX_MESSAGE_KIND,
    objectId: row.id,
    evidenceIds: [evidenceId],
    data: { messageId: row.id, evidenceDocumentId: evidenceId, eventId },
    receiptStatements: [
      `${row.id} filed as evidence ${evidenceId}`,
      ...(objectIds.length > 0 ? [`Evidence linked to ${objectIds.join(", ")}`] : []),
    ],
  };
});

/* ==========================================================================
   Message to process
   ========================================================================== */

export function processEventKey(messageId: string, processRunId: string, stageId: string): string {
  return `inbox-converted:${messageId}:process:${processRunId}:${stageId}`;
}

/**
 * Attaches the message to an open stage of the role's own running process.
 * The attachment is a stage input (`addStageInput`, once per stage and
 * source), which the process engine reads into the stage context, and one
 * `work-arrived` event on the run and stage, linked to the input. The
 * operation links the audit row once `executeTool` has written it.
 */
register("addInboxMessageToProcess", (payload, context): ToolHandlerResult => {
  const row = messageFor(context, payload);
  const processRunId = requireText(payload, "processRunId", "The process", 120);
  const stageId = requireText(payload, "stageId", "The stage", 120);
  const classification = str(payload, "classification");

  const run = getRun(processRunId, context.runId);
  if (!run || run.roleId !== context.roleId) {
    throw new Error(`The process run ${processRunId} is not this role's, so the message was not attached.`);
  }
  if (run.status === "completed") throw new Error(`${processRunId} is completed. A message joins only a running process.`);
  const stageRun = getStageRun(run.id, stageId, context.runId);
  if (!stageRun || stageRun.status === "completed") {
    throw new Error(`Stage ${stageId} of ${processRunId} is not open, so the message was not attached.`);
  }
  const attached = findStageInputsForSource("message", row.id, context.runId).some(
    (input) => input.processRunId === processRunId && input.stageId === stageId,
  );
  if (attached) throw new Error(`${row.id} is already attached to stage ${stageId}. Nothing was attached twice.`);

  const holder = actorName(context);
  const now = new Date().toISOString();
  const write = getSqlite().transaction(() => {
    updateMessage(context, row.id, { isRead: true });
    confirmByConversion(context, row, isInboxClassification(classification) ? classification : null, now);
    const eventId = publish(context, {
      type: "work-arrived",
      subject: { kind: INBOX_MESSAGE_KIND, id: row.id },
      process: { runId: processRunId, stageId },
      summary: {
        en: `${holder} added message ${row.id} from ${row.fromLabel} to this stage: ${firstLine(row.subject, 120)}`,
        de: `${holder} hat die Nachricht ${row.id} von ${row.fromLabel} dieser Stufe zugeordnet: ${firstLine(row.subjectDe.length > 0 ? row.subjectDe : row.subject, 120)}`,
      },
      payload: { messageId: row.id, operation: "process", toolName: "addInboxMessageToProcess", processRunId, stageId, stageRunId: stageRun.id },
      idempotencyKey: processEventKey(row.id, processRunId, stageId),
    });
    const { input } = addStageInput({
      runId: context.runId,
      processRunId,
      stageId,
      stageRunId: stageRun.id,
      sourceKind: "message",
      sourceId: row.id,
      addedByUserId: context.actingUserId,
      addedAt: now,
      addedAtMoment: context.atMoment,
      osEventId: eventId,
    });
    recordConversion(context, row, "process", now);
    return { eventId, stageInputId: input.id };
  });
  const { eventId, stageInputId } = write();

  return {
    summary: `Message ${row.id} attached to stage ${stageId} of ${processRunId}.`,
    objectKind: INBOX_MESSAGE_KIND,
    objectId: row.id,
    data: { messageId: row.id, processRunId, stageId, stageRunId: stageRun.id, eventId, stageInputId },
    receiptStatements: [`${row.id} attached to stage ${stageId} of ${processRunId} as a stage input`],
  };
});

/* ==========================================================================
   Delegate and reply
   ========================================================================== */

register("delegateInboxMessage", (payload, context): ToolHandlerResult => {
  const row = messageFor(context, payload);
  const toUserId = requireText(payload, "toUserId", "The colleague", 40);
  const note = requireText(payload, "note", "A note for the colleague", 2000);
  const person = getSqlite().prepare("select name, line from users where run_id = ? and id = ?").get(context.runId, toUserId) as
    | { name: string; line: string }
    | undefined;
  if (!person || person.line === "external") throw new Error(`"${toUserId}" is not an internal colleague, so nothing was delegated.`);
  if (toUserId === context.actingUserId) throw new Error("A message cannot be delegated to the person who holds it.");
  const already = getOutboundAbout([row.id], context.runId).get(row.id)?.find((sent) => sent.kind === "delegation");
  if (already) throw new Error(`${row.id} was already delegated to ${userName(context, row.delegatedToUserId ?? already.toUserIds[0] ?? null)}. Nothing was sent twice.`);

  const holder = actorName(context);
  const id = newId("COL-INB");
  const now = new Date().toISOString();
  const write = getSqlite().transaction(() => {
    db()
      .insert(collaborationMessages)
      .values({
        id,
        runId: context.runId,
        fromRoleId: context.roleId,
        toUserIds: [toUserId],
        kind: "delegation",
        channelName: DELEGATION_CHANNEL,
        subject: firstLine(`Delegated: ${row.subject}`, 230),
        body: `${note}\n\nOriginal message ${row.id} from ${row.fromLabel}, received ${displayDate(dateOf(row.receivedAt))}.`,
        sentAtMoment: context.atMoment,
        sentAt: now,
        simulatedOnly: true,
        relatedObjectKind: INBOX_MESSAGE_KIND,
        relatedObjectId: row.id,
        decisionId: row.linkedDecisionId,
        replyBody: "",
        replyFromUserId: null,
        replyAtMoment: null,
      })
      .run();
    updateMessage(context, row.id, { delegatedToUserId: toUserId, isRead: true });
    confirmByConversion(context, row, "delegate", now);
    recordConversion(context, row, "delegated", now);
    return publish(context, {
      type: "work-arrived",
      subject: { kind: INBOX_MESSAGE_KIND, id: row.id },
      summary: {
        en: `${holder} delegated message ${row.id} to ${person.name} with a simulated message.`,
        de: `${holder} hat die Nachricht ${row.id} mit einer simulierten Nachricht an ${person.name} delegiert.`,
      },
      payload: { messageId: row.id, operation: "delegate", toolName: "delegateInboxMessage", collaborationMessageId: id, toUserIds: [toUserId] },
      idempotencyKey: `inbox-converted:${row.id}:delegated:${id}`,
    });
  });
  const eventId = write();

  return {
    summary: `Message ${row.id} delegated to ${toUserId}. Simulated only, never delivered outside this machine.`,
    objectKind: INBOX_MESSAGE_KIND,
    objectId: row.id,
    data: { messageId: row.id, collaborationMessageId: id, eventId },
    receiptStatements: [`${row.id} delegated to ${person.name}`, "Simulated message recorded; nothing left this machine"],
  };
});

/**
 * Drafts a reply from the message and from what has been done with it.
 * Writes nothing: the draft is returned for the person to edit.
 */
register("draftInboxReply", (payload, context): ToolHandlerResult => {
  const row = messageFor(context, payload);
  const shared = loadWorkShared(context.roleId);
  if (!shared) throw new Error(`The role ${context.roleId} has no Work Hub, so no reply was drafted.`);
  const sender = row.fromUserId ? shared.people.get(row.fromUserId) : undefined;
  if (!sender) throw new Error(`${row.id} has no sender with a person record, so a reply cannot be addressed.`);

  const lineage = deriveLineage(
    row,
    {
      filed: getEvidenceFiledFrom([row.id], context.runId).get(row.id) ?? [],
      raised: getActionsRaisedFrom([row.id], context.runId).get(row.id) ?? [],
      outbound: getOutboundAbout([row.id], context.runId).get(row.id) ?? [],
      stageInputs: findStageInputsForSource("message", row.id, context.runId),
      events: loadInboxEvents(context.roleId).get(row.id) ?? [],
      proposal: null,
    },
    shared,
  );
  const language = context.language;
  const stage = lineage.conversions.find((conversion) => conversion.kind === "process");
  const evidence = lineage.filed[0];
  const draft = composeReply({
    language,
    addressee: firstNameOf(sender.name),
    subject: language === "de" && row.subjectDe.length > 0 ? row.subjectDe : row.subject,
    receivedOn: row.receivedAt,
    respondBy: row.requiresResponseBy,
    signer: personName(shared, context.actingUserId) ?? context.actingUserId,
    duplicateOf: row.isDuplicateOf,
    action: lineage.action
      ? {
          id: lineage.action.id,
          title: language === "de" && lineage.action.titleDe.length > 0 ? lineage.action.titleDe : lineage.action.title,
          owner: personName(shared, lineage.action.ownerUserId),
          dueOn: lineage.action.dueOn,
        }
      : null,
    evidence: evidence ? { id: evidence.id, objects: evidence.relatedObjectIds.filter((id) => id !== row.id) } : null,
    stage: stage ? { process: stage.label, stage: stage.stage ?? stage.id } : null,
    delegatedTo: lineage.delegatedTo?.name ?? null,
    decision: row.linkedDecisionId ? { id: row.linkedDecisionId } : null,
  });
  const checked = validateReplyDraft(draft, language);
  if (!checked.ok) {
    throw new Error(`The reply draft did not pass the checks (${checked.failures.map((failure) => failure.message.en).join(" ")}), so none is offered.`);
  }
  return {
    summary: `Reply drafted for ${row.id}. Nothing was sent.`,
    objectKind: INBOX_MESSAGE_KIND,
    objectId: row.id,
    data: { ...checked.output, to: sender.name },
  };
});

register("sendInboxReply", (payload, context): ToolHandlerResult => {
  const row = messageFor(context, payload);
  if (!row.fromUserId) throw new Error(`${row.id} has no sender with a person record, so a reply cannot be addressed.`);
  const subject = requireText(payload, "subject", "The subject", 240);
  const body = requireText(payload, "body", "The reply", 4000);
  const holder = actorName(context);
  const to = userName(context, row.fromUserId);
  const id = newId("COL-INB");

  const write = getSqlite().transaction(() => {
    db()
      .insert(collaborationMessages)
      .values({
        id,
        runId: context.runId,
        fromRoleId: context.roleId,
        toUserIds: [row.fromUserId ?? ""],
        kind: "reply",
        channelName: REPLY_CHANNEL,
        subject,
        body,
        sentAtMoment: context.atMoment,
        sentAt: new Date().toISOString(),
        simulatedOnly: true,
        relatedObjectKind: INBOX_MESSAGE_KIND,
        relatedObjectId: row.id,
        decisionId: row.linkedDecisionId,
        replyBody: "",
        replyFromUserId: null,
        replyAtMoment: null,
      })
      .run();
    updateMessage(context, row.id, { isRead: true });
    return publish(context, {
      type: "tool-executed",
      subject: { kind: INBOX_MESSAGE_KIND, id: row.id },
      summary: {
        en: `${holder} sent a simulated reply to ${to} about ${row.id}. Nothing left this machine.`,
        de: `${holder} hat ${to} zu ${row.id} simuliert geantwortet. Nichts hat diesen Rechner verlassen.`,
      },
      payload: { messageId: row.id, operation: "reply", toolName: "sendInboxReply", collaborationMessageId: id, toUserIds: [row.fromUserId ?? ""] },
      idempotencyKey: `inbox-reply:${row.id}:${id}`,
    });
  });
  const eventId = write();

  return {
    summary: `Simulated reply ${id} recorded for ${row.id}. It was not delivered to any real recipient.`,
    objectKind: INBOX_MESSAGE_KIND,
    objectId: row.id,
    data: { messageId: row.id, collaborationMessageId: id, eventId },
    receiptStatements: [`Simulated reply to ${to} recorded; nothing left this machine`],
  };
});

/** Ensures the module's registrations have run. Imported by the governance module. */
export const inboxToolHandlersRegistered = true;
