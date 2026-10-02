/**
 * External execution receipts.
 *
 * One guarantee, stated as plainly as it can be: a row in
 * `external_execution_receipts` means a target system returned a reference for
 * a change it accepted. Nothing else writes to that table, and the single
 * writer below refuses a command that has no `acknowledgedAt`.
 *
 * This mirrors the rule the local mutation layer already enforces, where a
 * receipt line only exists for a change that actually happened. That rule was
 * broken once locally: handlers issued an update that matched zero rows and
 * returned their receipt statement anyway, so the interface confidently
 * reported a change nobody had made. The external case is worse, because the
 * user cannot check it by looking at the next screen.
 *
 * The queued, failed and dead letter states that the interface shows are
 * therefore not rows in the receipt table. They are projected from the command
 * rows by `receiptLinesForDecision`, which merges acknowledged receipts with
 * commands still in flight. That keeps the table honest and still lets a
 * receipt read "Assessment update queued for the GRC platform" without
 * implying it landed.
 */

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  connectorInstances,
  externalExecutionReceipts,
  integrationCommands,
} from "@/db/schema/integration";
import type { ExecutionReceiptLineView } from "@/workday/contracts";
import { systemClock, type IntegrationClock } from "@/integrations/core/ConnectorContext";
import type { ConnectorAcknowledgement } from "@/integrations/core/Connector";
import type { CommandRow } from "@/integrations/runtime/IdempotencyStore";

export type ExternalReceiptRow = typeof externalExecutionReceipts.$inferSelect;

let receiptSequence = 0;

function nextReceiptId(clock: IntegrationClock): string {
  receiptSequence += 1;
  return `XRC-${clock.nowMs().toString(36).toUpperCase()}-${String(receiptSequence).padStart(4, "0")}`;
}

/**
 * Writes the receipt line for an acknowledged command.
 *
 * The command row is passed in rather than an identifier so the precondition
 * can be checked against the state the caller actually observed. Throwing here
 * is correct: a caller reaching this function without an acknowledgement has a
 * logic error, and the right response is a loud failure during development,
 * not a receipt line with a hopeful status.
 */
export function writeReceiptFromAcknowledgement(params: {
  command: CommandRow;
  acknowledgement: ConnectorAcknowledgement;
  targetSystem: string;
  auditEventId: string | null;
  clock?: IntegrationClock;
}): ExternalReceiptRow {
  const { command, acknowledgement } = params;
  const clock = params.clock ?? systemClock;

  if (command.acknowledgedAt === null) {
    throw new Error(
      `Refusing to write an external receipt for command ${command.id}: the command has no acknowledgement. A receipt line may only be written from an acknowledgement.`,
    );
  }

  const id = nextReceiptId(clock);

  getDb()
    .insert(externalExecutionReceipts)
    .values({
      id,
      runId: command.runId,
      commandId: command.id,
      connectorInstanceId: command.connectorInstanceId,
      targetSystem: params.targetSystem,
      externalType: acknowledgement.externalType,
      externalId: acknowledgement.externalId,
      externalUrl: acknowledgement.externalUrl,
      externalVersion: acknowledgement.externalVersion,
      statement: acknowledgement.statement,
      statementDe: acknowledgement.statementDe,
      status: acknowledgement.outcome,
      statusDetail:
        acknowledgement.outcome === "partial"
          ? `Not applied: ${acknowledgement.notApplied.join("; ")}`
          : "",
      retryState: "",
      attempts: command.attempts,
      completedAt: acknowledgement.acknowledgedAt,
      atMoment: command.atMoment,
      auditEventId: params.auditEventId,
      decisionId: command.decisionId,
      sequence: command.sequence,
    })
    .run();

  const row = getDb()
    .select()
    .from(externalExecutionReceipts)
    .where(eq(externalExecutionReceipts.id, id))
    .get();
  if (!row) throw new Error(`The external receipt ${id} could not be read back.`);
  return row;
}

/** Acknowledged receipts for one command. */
export function receiptsForCommand(commandId: string): ExternalReceiptRow[] {
  return getDb()
    .select()
    .from(externalExecutionReceipts)
    .where(eq(externalExecutionReceipts.commandId, commandId))
    .orderBy(asc(externalExecutionReceipts.sequence))
    .all();
}

/** Acknowledged receipts for one decision. */
export function receiptsForDecision(runId: string, decisionId: string): ExternalReceiptRow[] {
  return getDb()
    .select()
    .from(externalExecutionReceipts)
    .where(
      and(
        eq(externalExecutionReceipts.runId, runId),
        eq(externalExecutionReceipts.decisionId, decisionId),
      ),
    )
    .orderBy(asc(externalExecutionReceipts.sequence))
    .all();
}

/**
 * Maps a command status onto the receipt status the interface shows.
 *
 * `acknowledged` is absent from this map on purpose. An acknowledged command
 * has a real receipt row, so it is never projected from a command, and
 * including it here would create a second path to the word "acknowledged" that
 * did not require an acknowledgement.
 */
const PENDING_STATUS: Record<string, ExecutionReceiptLineView["status"]> = {
  proposed: "queued",
  "awaiting-approval": "queued",
  approved: "queued",
  queued: "queued",
  executing: "queued",
  failed: "failed",
  "dead-letter": "dead-letter",
  cancelled: "failed",
};

/** Plain language for a command that has not been acknowledged. */
function pendingStatement(command: CommandRow, targetSystem: string): string {
  switch (command.status) {
    case "awaiting-approval":
      return `${command.intentStatement} in ${targetSystem}, held for approval.`;
    case "proposed":
    case "approved":
    case "queued":
    case "executing":
      return `${command.intentStatement} in ${targetSystem}, queued and not yet confirmed by the target system.`;
    case "failed":
      return `${command.intentStatement} in ${targetSystem} has not been confirmed. The attempt failed and will be retried.`;
    case "dead-letter":
      return `${command.intentStatement} in ${targetSystem} has not been confirmed after every attempt. The decision stands and the delivery needs a retry.`;
    case "cancelled":
      return `${command.intentStatement} in ${targetSystem} was cancelled before it reached the target system.`;
    default:
      return `${command.intentStatement} in ${targetSystem} is not confirmed.`;
  }
}

function targetSystemLabel(connectorInstanceId: string): string {
  const row = getDb()
    .select({ sourceSystem: connectorInstances.sourceSystem })
    .from(connectorInstances)
    .where(eq(connectorInstances.id, connectorInstanceId))
    .get();
  return row?.sourceSystem ?? connectorInstanceId;
}

/**
 * The receipt lines for one decision, acknowledged and pending together.
 *
 * This is what the workday renders under a decision. Acknowledged lines carry
 * the external reference the target returned; pending lines carry no external
 * identifier at all, because there is nothing to link to until the target says
 * there is.
 */
export function receiptLinesForDecision(
  runId: string,
  decisionId: string,
): ExecutionReceiptLineView[] {
  const commands = getDb()
    .select()
    .from(integrationCommands)
    .where(
      and(eq(integrationCommands.runId, runId), eq(integrationCommands.decisionId, decisionId)),
    )
    .orderBy(asc(integrationCommands.sequence), asc(integrationCommands.createdAt))
    .all();

  const receipts = receiptsForDecision(runId, decisionId);
  const receiptsByCommand = new Map<string, ExternalReceiptRow[]>();
  for (const receipt of receipts) {
    const list = receiptsByCommand.get(receipt.commandId) ?? [];
    list.push(receipt);
    receiptsByCommand.set(receipt.commandId, list);
  }

  const lines: ExecutionReceiptLineView[] = [];
  let sequence = 0;

  for (const command of commands) {
    const targetSystem = targetSystemLabel(command.connectorInstanceId);
    const own = receiptsByCommand.get(command.id) ?? [];

    if (own.length > 0) {
      for (const receipt of own) {
        sequence += 1;
        lines.push({
          id: receipt.id,
          statement: receipt.statement,
          targetSystem: receipt.targetSystem,
          externalType: receipt.externalType,
          externalId: receipt.externalId,
          externalUrl: receipt.externalUrl,
          status: receipt.status,
          statusDetail: receipt.statusDetail,
          retryState: receipt.retryState,
          attempts: receipt.attempts,
          completedAt: receipt.completedAt,
          auditEventId: receipt.auditEventId,
          sequence,
        });
      }
      continue;
    }

    sequence += 1;
    lines.push({
      id: `PEND-${command.id}`,
      statement: pendingStatement(command, targetSystem),
      targetSystem,
      externalType: command.targetExternalType,
      externalId: null,
      externalUrl: null,
      status: PENDING_STATUS[command.status] ?? "queued",
      statusDetail: command.lastError,
      retryState:
        command.nextAttemptAt === null
          ? command.status === "dead-letter"
            ? "needs manual retry"
            : ""
          : `next attempt due ${command.nextAttemptAt}`,
      attempts: command.attempts,
      completedAt: null,
      auditEventId: null,
      sequence,
    });
  }

  return lines;
}

/** The same projection for a single command, used by the proof script. */
export function receiptLinesForCommand(commandId: string): ExecutionReceiptLineView[] {
  const command = getDb()
    .select()
    .from(integrationCommands)
    .where(eq(integrationCommands.id, commandId))
    .get();
  if (!command) return [];
  if (!command.decisionId) {
    const targetSystem = targetSystemLabel(command.connectorInstanceId);
    const own = receiptsForCommand(commandId);
    if (own.length === 0) {
      return [
        {
          id: `PEND-${command.id}`,
          statement: pendingStatement(command, targetSystem),
          targetSystem,
          externalType: command.targetExternalType,
          externalId: null,
          externalUrl: null,
          status: PENDING_STATUS[command.status] ?? "queued",
          statusDetail: command.lastError,
          retryState: command.status === "dead-letter" ? "needs manual retry" : "",
          attempts: command.attempts,
          completedAt: null,
          auditEventId: null,
          sequence: 1,
        },
      ];
    }
    return own.map((receipt, index) => ({
      id: receipt.id,
      statement: receipt.statement,
      targetSystem: receipt.targetSystem,
      externalType: receipt.externalType,
      externalId: receipt.externalId,
      externalUrl: receipt.externalUrl,
      status: receipt.status,
      statusDetail: receipt.statusDetail,
      retryState: receipt.retryState,
      attempts: receipt.attempts,
      completedAt: receipt.completedAt,
      auditEventId: receipt.auditEventId,
      sequence: index + 1,
    }));
  }
  return receiptLinesForDecision(command.runId, command.decisionId).filter(
    (line) => line.id === `PEND-${commandId}` || receiptsForCommand(commandId).some((r) => r.id === line.id),
  );
}

/**
 * True when no acknowledged receipt exists for this command.
 *
 * Used by the test that proves a failed execution produces no acknowledged
 * receipt line. Written here rather than in the test so the assertion and the
 * writer share one definition of what acknowledged means.
 */
export function hasNoAcknowledgedReceipt(commandId: string): boolean {
  return receiptsForCommand(commandId).every((receipt) => receipt.status !== "acknowledged");
}
