/**
 * The stored lineage of an inbox message (migration 0008): what it became,
 * who confirmed its classification, and the writers that keep both honest.
 *
 * The Inbox's handlers (`src/features/work/modules/inbox/tools.ts`) call
 * these inside their governed transaction, beside the change itself and its
 * backbone event, so the stored value, the change and the event cannot
 * disagree. The rules are the columns' definitions, kept in one place so no
 * handler can apply a different one:
 *
 *   conversion   the first conversion to work (action, decision, evidence,
 *                process or delegated) is recorded once and never replaced;
 *                a dismissal is recorded only while there is no conversion
 *                to work, and a later conversion to work replaces it;
 *   triage       the classification, who confirmed it, when and why are
 *                written together, so the attribution always describes the
 *                classification beside it.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { inboxMessages, INBOX_WORK_CONVERSION_KINDS, type InboxConversionKind } from "@/db/schema/work";

const db = () => getDb();

type InboxRow = typeof inboxMessages.$inferSelect;

export interface InboxConversion {
  kind: InboxConversionKind;
  byUserId: string | null;
  at: string;
}

export type ConversionPatch = Pick<InboxRow, "conversionKind" | "convertedByUserId" | "convertedAt">;

function isWork(kind: InboxConversionKind | null): boolean {
  return kind !== null && INBOX_WORK_CONVERSION_KINDS.includes(kind);
}

/**
 * The change a conversion makes to what the message has become, or null when
 * it makes none. Pure, so a handler can test the rule without a database.
 */
export function conversionPatch(current: Pick<InboxRow, "conversionKind">, incoming: InboxConversion): ConversionPatch | null {
  const existing = current.conversionKind ?? null;
  const replace = isWork(incoming.kind) ? !isWork(existing) : existing === null;
  if (!replace) return null;
  return { conversionKind: incoming.kind, convertedByUserId: incoming.byUserId, convertedAt: incoming.at };
}

/**
 * Records a conversion by the rule above. Returns whether the stored value
 * changed; undefined when the message does not exist.
 */
export function recordInboxConversion(messageId: string, conversion: InboxConversion, runId = DEFAULT_RUN_ID): { changed: boolean } | undefined {
  const row = db()
    .select({ conversionKind: inboxMessages.conversionKind })
    .from(inboxMessages)
    .where(and(eq(inboxMessages.runId, runId), eq(inboxMessages.id, messageId)))
    .get();
  if (!row) return undefined;
  const patch = conversionPatch(row, conversion);
  if (!patch) return { changed: false };
  db()
    .update(inboxMessages)
    .set(patch)
    .where(and(eq(inboxMessages.runId, runId), eq(inboxMessages.id, messageId)))
    .run();
  return { changed: true };
}

export interface TriageConfirmation {
  classification: string;
  byUserId: string | null;
  at: string;
  /** The person's reason; required by the Inbox when they depart from the proposal. */
  reason: string | null;
}

/** Writes a classification with who confirmed it, when and why. Returns false for an unknown message. */
export function recordTriageConfirmation(messageId: string, confirmation: TriageConfirmation, runId = DEFAULT_RUN_ID): boolean {
  return (
    db()
      .update(inboxMessages)
      .set({
        confirmedTriage: confirmation.classification,
        triageConfirmedByUserId: confirmation.byUserId,
        triageConfirmedAt: confirmation.at,
        triageReason: confirmation.reason,
      })
      .where(and(eq(inboxMessages.runId, runId), eq(inboxMessages.id, messageId)))
      .run().changes > 0
  );
}
