/**
 * The outbox.
 *
 * Every intended external change is a row in `integration_commands` before it
 * is an attempt against a target system. The order is load bearing: the
 * durable record of intent is written first, the attempt happens second, and
 * the acknowledgement is written third. A process that dies between the
 * second and third step leaves a command the operator can see and retry,
 * rather than a change that either happened or did not with no trace either
 * way.
 *
 * This module owns the lifecycle transitions and nothing else. It does not
 * call connectors, evaluate authority or write receipts, because the status
 * column is read by three screens and an engine, and a module that both moves
 * the status and decides when to move it is where contradictory transitions
 * come from.
 */

import { and, asc, eq, inArray, lte, or, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { integrationCommands, type CommandStatus } from "@/db/schema/integration";
import { systemClock, type IntegrationClock } from "@/integrations/core/ConnectorContext";
import type { CommandRow } from "./IdempotencyStore";

/** Statuses from which an attempt may be made. */
export const ATTEMPTABLE_STATUSES: readonly CommandStatus[] = ["approved", "queued", "failed"];

/** Statuses the integration centre shows in the retry queue. */
export const QUEUE_STATUSES: readonly CommandStatus[] = [
  "awaiting-approval",
  "approved",
  "queued",
  "executing",
  "failed",
  "dead-letter",
];

/** Moves an approved command into the queue. */
export function enqueue(commandId: string, clock: IntegrationClock = systemClock): void {
  getDb()
    .update(integrationCommands)
    .set({ status: "queued", queuedAt: clock.nowIso(), nextAttemptAt: clock.nowIso() })
    .where(eq(integrationCommands.id, commandId))
    .run();
}

/** Marks an attempt as in flight and increments the attempt counter. */
export function markExecuting(
  commandId: string,
  attempt: number,
  clock: IntegrationClock = systemClock,
): void {
  getDb()
    .update(integrationCommands)
    .set({ status: "executing", attempts: attempt, executedAt: clock.nowIso() })
    .where(eq(integrationCommands.id, commandId))
    .run();
}

/**
 * Records a successful acknowledgement.
 *
 * `acknowledgedAt` is set here and only here, and the receipt writer refuses
 * to write a line for a command without it. Those two facts together are what
 * make "no receipt without an acknowledgement" structural.
 */
export function markAcknowledged(
  commandId: string,
  params: { externalId: string | null; externalVersion: string | null },
  clock: IntegrationClock = systemClock,
): void {
  getDb()
    .update(integrationCommands)
    .set({
      status: "acknowledged",
      acknowledgedAt: clock.nowIso(),
      nextAttemptAt: null,
      lastError: "",
      targetExternalId: params.externalId,
      expectedVersion: params.externalVersion,
    })
    .where(eq(integrationCommands.id, commandId))
    .run();
}

/** Records a failed attempt and when the next one is due. */
export function markFailed(
  commandId: string,
  params: { lastError: string; nextAttemptAt: string | null; attempts: number },
): void {
  getDb()
    .update(integrationCommands)
    .set({
      status: "failed",
      lastError: params.lastError,
      nextAttemptAt: params.nextAttemptAt,
      attempts: params.attempts,
    })
    .where(eq(integrationCommands.id, commandId))
    .run();
}

/** Cancels a command. The decision behind it is untouched. */
export function markCancelled(commandId: string, reason: string): void {
  getDb()
    .update(integrationCommands)
    .set({ status: "cancelled", lastError: reason, nextAttemptAt: null })
    .where(eq(integrationCommands.id, commandId))
    .run();
}

/** Moves a command out of dead letter so it can be attempted again. */
export function requeueFromDeadLetter(
  commandId: string,
  clock: IntegrationClock = systemClock,
): void {
  getDb()
    .update(integrationCommands)
    .set({ status: "queued", queuedAt: clock.nowIso(), nextAttemptAt: clock.nowIso(), lastError: "" })
    .where(eq(integrationCommands.id, commandId))
    .run();
}

/**
 * Commands due for an attempt now.
 *
 * `nextAttemptAt` being null is treated as due, which covers a command that
 * was approved and queued without ever having failed. Comparing ISO strings
 * with `lte` is correct here because every value written by this module comes
 * from `toISOString()` and is therefore fixed width and UTC.
 */
export function claimDue(
  runId: string,
  clock: IntegrationClock = systemClock,
  limit = 25,
): CommandRow[] {
  const now = clock.nowIso();
  return getDb()
    .select()
    .from(integrationCommands)
    .where(
      and(
        eq(integrationCommands.runId, runId),
        inArray(integrationCommands.status, [...ATTEMPTABLE_STATUSES]),
        or(isNull(integrationCommands.nextAttemptAt), lte(integrationCommands.nextAttemptAt, now)),
      ),
    )
    .orderBy(asc(integrationCommands.createdAt), asc(integrationCommands.sequence))
    .limit(limit)
    .all();
}

/** Everything the integration centre shows in the queue, oldest first. */
export function listQueue(runId: string): CommandRow[] {
  return getDb()
    .select()
    .from(integrationCommands)
    .where(
      and(
        eq(integrationCommands.runId, runId),
        inArray(integrationCommands.status, [...QUEUE_STATUSES]),
      ),
    )
    .orderBy(asc(integrationCommands.createdAt), asc(integrationCommands.sequence))
    .all();
}

/** Every command for one decision, in receipt order. */
export function listCommandsForDecision(runId: string, decisionId: string): CommandRow[] {
  return getDb()
    .select()
    .from(integrationCommands)
    .where(and(eq(integrationCommands.runId, runId), eq(integrationCommands.decisionId, decisionId)))
    .orderBy(asc(integrationCommands.sequence), asc(integrationCommands.createdAt))
    .all();
}

/** Every command for a run, for the proof script and the control room. */
export function listAllCommands(runId: string): CommandRow[] {
  return getDb()
    .select()
    .from(integrationCommands)
    .where(eq(integrationCommands.runId, runId))
    .orderBy(asc(integrationCommands.createdAt))
    .all();
}

export interface OutboxSummary {
  total: number;
  byStatus: Record<string, number>;
  awaitingApproval: number;
  queued: number;
  failed: number;
  deadLettered: number;
  acknowledged: number;
}

/** Counts for the integration centre header. */
export function summariseOutbox(runId: string): OutboxSummary {
  const rows = listAllCommands(runId);
  const byStatus: Record<string, number> = {};
  for (const row of rows) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  return {
    total: rows.length,
    byStatus,
    awaitingApproval: byStatus["awaiting-approval"] ?? 0,
    queued: (byStatus.queued ?? 0) + (byStatus.approved ?? 0) + (byStatus.executing ?? 0),
    failed: byStatus.failed ?? 0,
    deadLettered: byStatus["dead-letter"] ?? 0,
    acknowledged: byStatus.acknowledged ?? 0,
  };
}
