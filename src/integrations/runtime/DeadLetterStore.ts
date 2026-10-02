/**
 * Dead letter handling.
 *
 * The rule this module exists to enforce: a delivery failure never deletes
 * the human decision behind it.
 *
 * When an approved change exhausts its attempts, the command moves to
 * `dead-letter` and a row appears here. What does not happen is any change to
 * the decision row, the approval row or the audit trail. The professional's
 * judgment stands and remains visible; what failed is the delivery of its
 * consequence to one external system, and the interface says exactly that.
 *
 * Getting this wrong in the obvious way, rolling the decision back when the
 * write fails, would teach the user that a recorded decision is provisional
 * until every downstream system agrees, which is both false and corrosive to
 * the accountability the product is about.
 */

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { deadLetterEntries, integrationCommands } from "@/db/schema/integration";
import { systemClock, type IntegrationClock } from "@/integrations/core/ConnectorContext";

export type DeadLetterRow = typeof deadLetterEntries.$inferSelect;

let deadLetterSequence = 0;

function nextDeadLetterId(clock: IntegrationClock): string {
  deadLetterSequence += 1;
  return `DLQ-${clock.nowMs().toString(36).toUpperCase()}-${String(deadLetterSequence).padStart(4, "0")}`;
}

export interface EnterDeadLetterInput {
  runId: string;
  commandId: string;
  connectorInstanceId: string;
  reason: string;
  lastError: string;
  attempts: number;
  payloadDigest: string;
  atMoment: string;
  /** False for a failure an operator cannot resolve by pressing retry. */
  retryable: boolean;
}

/**
 * Moves a command to dead letter and records why.
 *
 * Idempotent on `commandId`, which has a unique index. A second exhaustion of
 * the same command updates the existing row rather than accumulating history,
 * because the queue is a worklist and a worklist with three entries for one
 * stuck command is harder to act on, not more informative.
 */
export function enterDeadLetter(
  input: EnterDeadLetterInput,
  clock: IntegrationClock = systemClock,
): DeadLetterRow {
  const now = clock.nowIso();

  getDb()
    .insert(deadLetterEntries)
    .values({
      id: nextDeadLetterId(clock),
      runId: input.runId,
      commandId: input.commandId,
      connectorInstanceId: input.connectorInstanceId,
      reason: input.reason,
      lastError: input.lastError,
      attempts: input.attempts,
      payloadDigest: input.payloadDigest,
      enteredAt: now,
      atMoment: input.atMoment,
      resolvedAt: null,
      resolution: "",
      retryable: input.retryable,
    })
    .onConflictDoUpdate({
      target: deadLetterEntries.commandId,
      set: {
        reason: input.reason,
        lastError: input.lastError,
        attempts: input.attempts,
        enteredAt: now,
        atMoment: input.atMoment,
        resolvedAt: null,
        resolution: "",
        retryable: input.retryable,
      },
    })
    .run();

  getDb()
    .update(integrationCommands)
    .set({ status: "dead-letter", lastError: input.lastError, nextAttemptAt: null })
    .where(eq(integrationCommands.id, input.commandId))
    .run();

  const row = findDeadLetterByCommand(input.commandId);
  if (!row) {
    throw new Error(`The dead letter entry for command ${input.commandId} could not be read back.`);
  }
  return row;
}

export function findDeadLetterByCommand(commandId: string): DeadLetterRow | null {
  return (
    getDb()
      .select()
      .from(deadLetterEntries)
      .where(eq(deadLetterEntries.commandId, commandId))
      .get() ?? null
  );
}

/** Open dead letters for a run, newest first. The integration centre worklist. */
export function listOpenDeadLetters(runId: string): DeadLetterRow[] {
  return getDb()
    .select()
    .from(deadLetterEntries)
    .where(and(eq(deadLetterEntries.runId, runId), eq(deadLetterEntries.resolvedAt, "")))
    .orderBy(desc(deadLetterEntries.enteredAt))
    .all();
}

/**
 * All dead letters for a run, resolved and open.
 *
 * `resolvedAt` is nullable rather than an empty string, so the open filter
 * cannot be written as an equality against "". This function returns both and
 * the caller partitions, which avoids repeating that trap in three places.
 */
export function listDeadLetters(runId: string): DeadLetterRow[] {
  return getDb()
    .select()
    .from(deadLetterEntries)
    .where(eq(deadLetterEntries.runId, runId))
    .orderBy(desc(deadLetterEntries.enteredAt))
    .all();
}

/** Partitioned view for the integration centre. */
export function partitionDeadLetters(runId: string): {
  open: DeadLetterRow[];
  resolved: DeadLetterRow[];
} {
  const rows = listDeadLetters(runId);
  return {
    open: rows.filter((row) => row.resolvedAt === null),
    resolved: rows.filter((row) => row.resolvedAt !== null),
  };
}

/** Closes a dead letter. Called when a retry finally succeeds, or by an operator. */
export function resolveDeadLetter(
  commandId: string,
  resolution: string,
  clock: IntegrationClock = systemClock,
): void {
  getDb()
    .update(deadLetterEntries)
    .set({ resolvedAt: clock.nowIso(), resolution })
    .where(eq(deadLetterEntries.commandId, commandId))
    .run();
}
