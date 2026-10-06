/**
 * Data access for structured AI feedback.
 *
 * The AI Partner records feedback through `recordAIFeedback`; the Product
 * Owner Console reads it by configuration, kind and role, and links an item
 * to the product feedback inbox once it is triaged there. One row per person,
 * output and kind: giving the same feedback twice returns the first row and
 * writes nothing.
 *
 * Which kinds are offered on which output, and whether "Useful" and "Not
 * useful" may stand together, is the Partner's rule, not this module's.
 */

import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import {
  AI_FEEDBACK_KINDS,
  aiFeedback,
  type AIFeedbackKind,
  type AIFeedbackTargetKind,
} from "@/db/schema/ai-partner";

const db = () => getDb();

export type AIFeedbackRow = typeof aiFeedback.$inferSelect;
/** New feedback. `runId` defaults to the active scenario run. */
export type NewAIFeedback = Omit<typeof aiFeedback.$inferInsert, "runId"> & { runId?: string };

/** Records feedback once per person, output and kind. */
export function recordAIFeedback(feedback: NewAIFeedback): { feedback: AIFeedbackRow; created: boolean } {
  const runId = feedback.runId ?? DEFAULT_RUN_ID;
  const result = db()
    .insert(aiFeedback)
    .values({ ...feedback, runId })
    .onConflictDoNothing({
      target: [aiFeedback.runId, aiFeedback.userId, aiFeedback.targetKind, aiFeedback.targetId, aiFeedback.kind],
    })
    .run();
  const row = db()
    .select()
    .from(aiFeedback)
    .where(
      and(
        eq(aiFeedback.runId, runId),
        eq(aiFeedback.userId, feedback.userId),
        eq(aiFeedback.targetKind, feedback.targetKind),
        eq(aiFeedback.targetId, feedback.targetId),
        eq(aiFeedback.kind, feedback.kind),
      ),
    )
    .get();
  if (!row) throw new Error(`Feedback ${feedback.id} was not written.`);
  return { feedback: row, created: result.changes > 0 };
}

/** Removes one person's feedback, for a person who takes it back. Returns whether a row was removed. */
export function removeAIFeedback(id: string, userId: string, runId = DEFAULT_RUN_ID): boolean {
  return (
    db()
      .delete(aiFeedback)
      .where(and(eq(aiFeedback.runId, runId), eq(aiFeedback.id, id), eq(aiFeedback.userId, userId)))
      .run().changes > 0
  );
}

/** Feedback on one output, newest first. */
export function getAIFeedbackForTarget(
  targetKind: AIFeedbackTargetKind,
  targetId: string,
  runId = DEFAULT_RUN_ID,
): AIFeedbackRow[] {
  return db()
    .select()
    .from(aiFeedback)
    .where(and(eq(aiFeedback.runId, runId), eq(aiFeedback.targetKind, targetKind), eq(aiFeedback.targetId, targetId)))
    .orderBy(desc(aiFeedback.createdAt), desc(aiFeedback.id))
    .all();
}

export interface AIFeedbackFilter {
  roleId?: RoleId;
  kinds?: readonly AIFeedbackKind[];
  configurationId?: string;
  /** true: only items already in the product inbox; false: only those not yet forwarded. */
  forwarded?: boolean;
  limit?: number;
  runId?: string;
}

/** Feedback, newest first. */
export function listAIFeedback(filter: AIFeedbackFilter = {}): AIFeedbackRow[] {
  const conditions = [eq(aiFeedback.runId, filter.runId ?? DEFAULT_RUN_ID)];
  if (filter.roleId) conditions.push(eq(aiFeedback.roleId, filter.roleId));
  if (filter.kinds && filter.kinds.length > 0) conditions.push(inArray(aiFeedback.kind, [...filter.kinds]));
  if (filter.configurationId) conditions.push(eq(aiFeedback.configurationId, filter.configurationId));
  if (filter.forwarded === true) conditions.push(isNotNull(aiFeedback.productFeedbackId));
  if (filter.forwarded === false) conditions.push(isNull(aiFeedback.productFeedbackId));
  const query = db()
    .select()
    .from(aiFeedback)
    .where(and(...conditions))
    .orderBy(desc(aiFeedback.createdAt), desc(aiFeedback.id));
  return filter.limit !== undefined ? query.limit(filter.limit).all() : query.all();
}

/** Links feedback to the product feedback item it was forwarded to. */
export function linkAIFeedbackToProductFeedback(id: string, productFeedbackId: string): boolean {
  return db().update(aiFeedback).set({ productFeedbackId }).where(eq(aiFeedback.id, id)).run().changes > 0;
}

/**
 * Counts by kind, every kind present: the AI quality view's user feedback
 * figures, per configuration or role.
 */
export function countAIFeedbackByKind(
  filter: Pick<AIFeedbackFilter, "roleId" | "configurationId" | "runId"> = {},
): Record<AIFeedbackKind, number> {
  const conditions = [eq(aiFeedback.runId, filter.runId ?? DEFAULT_RUN_ID)];
  if (filter.roleId) conditions.push(eq(aiFeedback.roleId, filter.roleId));
  if (filter.configurationId) conditions.push(eq(aiFeedback.configurationId, filter.configurationId));
  const rows = db()
    .select({ kind: aiFeedback.kind, n: sql<number>`count(*)` })
    .from(aiFeedback)
    .where(and(...conditions))
    .groupBy(aiFeedback.kind)
    .all();
  const counts = Object.fromEntries(AI_FEEDBACK_KINDS.map((kind) => [kind, 0])) as Record<AIFeedbackKind, number>;
  for (const row of rows) counts[row.kind] = Number(row.n);
  return counts;
}
