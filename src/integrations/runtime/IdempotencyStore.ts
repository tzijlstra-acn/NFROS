/**
 * Idempotency for outbound commands.
 *
 * The guarantee: a replay of the same approved change finds the existing
 * command row rather than creating a second external object.
 *
 * It is enforced by the `ic_idempotency_unq` unique index on
 * `integration_commands.idempotency_key`, not by a read-then-write check in
 * application code. That distinction is the whole reason this module is small.
 * A select followed by an insert has a window in which two callers both see
 * nothing and both insert, and in this product the two callers are plausible:
 * a user pressing "retry" on a queued command while the outbox drain is
 * already working on it. The unique index closes the window; this module's job
 * is to catch the resulting constraint violation and return the row that won.
 *
 * The key itself is built from the decision, the tool, the target object and
 * the payload fingerprint. It deliberately does not include a timestamp or a
 * counter, because a key that changes between attempts is not an idempotency
 * key.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { integrationCommands } from "@/db/schema/integration";

export type CommandRow = typeof integrationCommands.$inferSelect;
export type NewCommandRow = typeof integrationCommands.$inferInsert;

export interface ReservationResult {
  /** False when an identical command already existed. */
  created: boolean;
  command: CommandRow;
}

/**
 * Builds the idempotency key for an external change.
 *
 * The payload fingerprint is included so that approving a rating change of
 * "partially effective" and then dispatching "ineffective" produces a
 * different key and therefore a different command. Without it, a second,
 * different change would be silently swallowed as a duplicate of the first,
 * which is a far worse failure than a duplicate: the user would see an
 * acknowledgement for a change the target never received.
 */
export function buildIdempotencyKey(params: {
  runId: string;
  commandKind: string;
  connectorInstanceId: string;
  targetExternalType: string;
  targetExternalId: string | null;
  payloadFingerprint: string;
  decisionId?: string | null;
}): string {
  return [
    params.runId,
    params.decisionId ?? "no-decision",
    params.connectorInstanceId,
    params.commandKind,
    params.targetExternalType,
    params.targetExternalId ?? "new",
    params.payloadFingerprint,
  ].join("|");
}

/** The command carrying this key, or null. */
export function findCommandByIdempotencyKey(key: string): CommandRow | null {
  return (
    getDb()
      .select()
      .from(integrationCommands)
      .where(eq(integrationCommands.idempotencyKey, key))
      .get() ?? null
  );
}

export function findCommandById(commandId: string): CommandRow | null {
  return (
    getDb().select().from(integrationCommands).where(eq(integrationCommands.id, commandId)).get() ??
    null
  );
}

/**
 * Inserts the command, or returns the one that already holds the key.
 *
 * `onConflictDoNothing` plus a read is used rather than a try and catch around
 * the insert, because better-sqlite3 surfaces a constraint violation as a
 * thrown error whose shape is driver specific, and catching by message is the
 * kind of thing that breaks on a dependency bump. Asking the driver how many
 * rows it changed is unambiguous.
 */
export function reserveCommand(values: NewCommandRow): ReservationResult {
  const existing = findCommandByIdempotencyKey(values.idempotencyKey);
  if (existing) return { created: false, command: existing };

  const result = getDb()
    .insert(integrationCommands)
    .values(values)
    .onConflictDoNothing({ target: integrationCommands.idempotencyKey })
    .run();

  if (result.changes === 0) {
    // Another caller won the race. Its row is the authoritative one.
    const winner = findCommandByIdempotencyKey(values.idempotencyKey);
    if (!winner) {
      throw new Error(
        `The command for idempotency key "${values.idempotencyKey}" was neither inserted nor found. The unique index may be missing.`,
      );
    }
    return { created: false, command: winner };
  }

  const inserted = findCommandById(values.id);
  if (!inserted) {
    throw new Error(`The command ${values.id} was inserted but could not be read back.`);
  }
  return { created: true, command: inserted };
}

/**
 * True when this command has already been acknowledged.
 *
 * Checked before every attempt, including a manual retry from the integration
 * centre. An operator pressing retry on a command that in fact succeeded must
 * not produce a second external object, and the clearest place to stop that is
 * before the connector is called.
 */
export function isAlreadyAcknowledged(command: CommandRow): boolean {
  return command.status === "acknowledged" && command.acknowledgedAt !== null;
}
