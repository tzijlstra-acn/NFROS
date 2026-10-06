/**
 * Read side data access for the Inbox module.
 *
 * Everything here is a query, in the spirit of `work-hub.ts`: the writes the
 * inbox performs are tool handlers reached through `executeTool`, never
 * functions in this file.
 *
 * Each function answers one lineage question about a set of messages, in one
 * query, grouped by message: which evidence documents were filed from them
 * (`evidence_documents.source_message_id`), which actions were raised from
 * them (`actions.source_message_id`), and which simulated messages were sent
 * about them (a delegation or a reply, `collaboration_messages` pointing at
 * the message), and which process stages hold them as a stage input
 * (`process_stage_inputs`). The inbox row records what the message became,
 * who confirmed its classification and its links (migration 0008); the
 * objects it became carry the detail, which is why that is read from them.
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { actions } from "@/db/schema/decisions";
import { processStageInputs } from "@/db/schema/process-inputs";
import { collaborationMessages, evidenceDocuments, inboxMessages } from "@/db/schema/work";

const db = () => getDb();

export type InboxMessageRow = typeof inboxMessages.$inferSelect;
export type InboxEvidenceRow = typeof evidenceDocuments.$inferSelect;
export type InboxActionRow = typeof actions.$inferSelect;
export type InboxOutboundRow = typeof collaborationMessages.$inferSelect;
export type InboxStageInputRow = typeof processStageInputs.$inferSelect;

/** The `related_object_kind` a simulated message about an inbox message carries. */
export const INBOX_MESSAGE_KIND = "inbox-message";

function group<T>(rows: readonly T[], key: (row: T) => string | null): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    if (!id) continue;
    const list = grouped.get(id) ?? [];
    list.push(row);
    grouped.set(id, list);
  }
  return grouped;
}

/** One message, whatever the clock says. The operations check visibility themselves. */
export function getInboxMessage(messageId: string, runId = DEFAULT_RUN_ID): InboxMessageRow | undefined {
  return db()
    .select()
    .from(inboxMessages)
    .where(and(eq(inboxMessages.runId, runId), eq(inboxMessages.id, messageId)))
    .get();
}

/** Evidence documents filed from these messages, grouped by message, oldest first. */
export function getEvidenceFiledFrom(
  messageIds: readonly string[],
  runId = DEFAULT_RUN_ID,
): Map<string, InboxEvidenceRow[]> {
  if (messageIds.length === 0) return new Map();
  const rows = db()
    .select()
    .from(evidenceDocuments)
    .where(and(eq(evidenceDocuments.runId, runId), inArray(evidenceDocuments.sourceMessageId, [...messageIds])))
    .orderBy(asc(evidenceDocuments.ingestedAt))
    .all();
  return group(rows, (row) => row.sourceMessageId);
}

/**
 * Actions raised from these messages, grouped by message.
 *
 * Read from every action, not only the role's desk: an action raised from a
 * message and then transferred to someone outside the role is still what the
 * message became.
 */
export function getActionsRaisedFrom(
  messageIds: readonly string[],
  runId = DEFAULT_RUN_ID,
): Map<string, InboxActionRow[]> {
  if (messageIds.length === 0) return new Map();
  const rows = db()
    .select()
    .from(actions)
    .where(and(eq(actions.runId, runId), inArray(actions.sourceMessageId, [...messageIds])))
    .all();
  return group(rows, (row) => row.sourceMessageId);
}

/** Simulated messages sent about these messages (delegations and replies), oldest first. */
export function getOutboundAbout(
  messageIds: readonly string[],
  runId = DEFAULT_RUN_ID,
): Map<string, InboxOutboundRow[]> {
  if (messageIds.length === 0) return new Map();
  const rows = db()
    .select()
    .from(collaborationMessages)
    .where(
      and(
        eq(collaborationMessages.runId, runId),
        eq(collaborationMessages.relatedObjectKind, INBOX_MESSAGE_KIND),
        inArray(collaborationMessages.relatedObjectId, [...messageIds]),
      ),
    )
    .orderBy(asc(collaborationMessages.sentAt))
    .all();
  return group(rows, (row) => row.relatedObjectId);
}

/**
 * The process stages these messages were attached to, as stage inputs,
 * grouped by message, in the order they were attached. The batched form of
 * `findStageInputsForSource("message", id)` for a whole inbox.
 */
export function getStageInputsFor(
  messageIds: readonly string[],
  runId = DEFAULT_RUN_ID,
): Map<string, InboxStageInputRow[]> {
  if (messageIds.length === 0) return new Map();
  const rows = db()
    .select()
    .from(processStageInputs)
    .where(
      and(
        eq(processStageInputs.runId, runId),
        eq(processStageInputs.sourceKind, "message"),
        inArray(processStageInputs.sourceId, [...messageIds]),
      ),
    )
    .orderBy(asc(processStageInputs.addedAt), asc(processStageInputs.id))
    .all();
  return group(rows, (row) => row.sourceId);
}
