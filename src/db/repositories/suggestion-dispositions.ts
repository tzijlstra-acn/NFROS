/**
 * Data access for the suggestion lifecycle: what the person did with a
 * suggestion, and when.
 *
 * The current disposition is `ai_suggestions.disposition`; the history is
 * `ai_suggestion_dispositions`. `recordSuggestionDisposition` is the only
 * writer of either, and it writes both in one transaction, so the current
 * value can never disagree with the last history entry.
 *
 * Which transitions are allowed (can an executed suggestion be rejected?) is
 * the AI Partner's rule, not this module's. What this module does guarantee:
 * a repeat of the current disposition writes nothing, and two writers cannot
 * record the same step (the sequence is unique per suggestion).
 */

import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { aiSuggestions, SUGGESTION_DISPOSITIONS, type SuggestionDisposition } from "@/db/schema/live";
import { aiSuggestionDispositions } from "@/db/schema/ai-partner";

const db = () => getDb();

export type SuggestionDispositionEntry = typeof aiSuggestionDispositions.$inferSelect;

export interface RecordDispositionInput {
  /** The history row's id, supplied by the caller like every id in this product. */
  id: string;
  suggestionId: string;
  to: SuggestionDisposition;
  actorKind: "human" | "system";
  actorUserId: string | null;
  at: string;
  atMoment: string;
  modification?: SuggestionDispositionEntry["modification"];
  reason?: string;
  resultKind?: string | null;
  resultId?: string | null;
  runId?: string;
}

export type RecordDispositionResult =
  | { recorded: true; entry: SuggestionDispositionEntry }
  | { recorded: false; reason: "unknown-suggestion" }
  | { recorded: false; reason: "unchanged"; entry: SuggestionDispositionEntry | null };

/**
 * Records a disposition: the history entry and the suggestion's current value.
 *
 * Refused, writing nothing, for a suggestion that does not exist. A repeat of
 * the current disposition with no modification is not a change and writes
 * nothing; the latest entry is returned.
 */
export function recordSuggestionDisposition(input: RecordDispositionInput): RecordDispositionResult {
  const runId = input.runId ?? DEFAULT_RUN_ID;

  const write = getSqlite().transaction((): RecordDispositionResult => {
    const suggestion = db()
      .select({ id: aiSuggestions.id, roleId: aiSuggestions.roleId, disposition: aiSuggestions.disposition })
      .from(aiSuggestions)
      .where(and(eq(aiSuggestions.runId, runId), eq(aiSuggestions.id, input.suggestionId)))
      .get();
    if (!suggestion) return { recorded: false, reason: "unknown-suggestion" };

    const latest = latestEntry(input.suggestionId);
    if (suggestion.disposition === input.to && !input.modification) {
      return { recorded: false, reason: "unchanged", entry: latest ?? null };
    }

    db()
      .insert(aiSuggestionDispositions)
      .values({
        id: input.id,
        runId,
        suggestionId: input.suggestionId,
        roleId: suggestion.roleId,
        sequence: (latest?.sequence ?? 0) + 1,
        fromDisposition: suggestion.disposition,
        toDisposition: input.to,
        actorKind: input.actorKind,
        actorUserId: input.actorUserId,
        at: input.at,
        atMoment: input.atMoment,
        modification: input.modification ?? null,
        reason: input.reason ?? "",
        resultKind: input.resultKind ?? null,
        resultId: input.resultId ?? null,
      })
      .run();
    db()
      .update(aiSuggestions)
      .set({ disposition: input.to, dispositionAt: input.at, dispositionByUserId: input.actorUserId })
      .where(eq(aiSuggestions.id, input.suggestionId))
      .run();

    const entry = db().select().from(aiSuggestionDispositions).where(eq(aiSuggestionDispositions.id, input.id)).get();
    if (!entry) throw new Error(`Disposition ${input.id} was not written.`);
    return { recorded: true, entry };
  });

  return write();
}

function latestEntry(suggestionId: string): SuggestionDispositionEntry | undefined {
  return db()
    .select()
    .from(aiSuggestionDispositions)
    .where(eq(aiSuggestionDispositions.suggestionId, suggestionId))
    .orderBy(desc(aiSuggestionDispositions.sequence))
    .limit(1)
    .get();
}

/** A suggestion's history, oldest first. */
export function getSuggestionDispositionHistory(suggestionId: string): SuggestionDispositionEntry[] {
  return db()
    .select()
    .from(aiSuggestionDispositions)
    .where(eq(aiSuggestionDispositions.suggestionId, suggestionId))
    .orderBy(asc(aiSuggestionDispositions.sequence))
    .all();
}

export interface DispositionCountFilter {
  roleId?: RoleId;
  /** ISO lower bound on the suggestion's `created_at`, inclusive. */
  createdFrom?: string;
  runId?: string;
}

/**
 * How many suggestions are in each disposition now: the aggregate behind
 * acceptance, modification and rejection (plan 7.3, 7.5). Every disposition
 * is present in the result, zero when none.
 */
export function countSuggestionDispositions(filter: DispositionCountFilter = {}): Record<SuggestionDisposition, number> {
  const conditions = [eq(aiSuggestions.runId, filter.runId ?? DEFAULT_RUN_ID)];
  if (filter.roleId) conditions.push(eq(aiSuggestions.roleId, filter.roleId));
  if (filter.createdFrom) conditions.push(gte(aiSuggestions.createdAt, filter.createdFrom));
  const rows = db()
    .select({ disposition: aiSuggestions.disposition, n: sql<number>`count(*)` })
    .from(aiSuggestions)
    .where(and(...conditions))
    .groupBy(aiSuggestions.disposition)
    .all();
  const counts = Object.fromEntries(SUGGESTION_DISPOSITIONS.map((value) => [value, 0])) as Record<SuggestionDisposition, number>;
  for (const row of rows) counts[row.disposition] = Number(row.n);
  return counts;
}
