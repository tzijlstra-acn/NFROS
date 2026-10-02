/**
 * The simulated external systems.
 *
 * Each simulated connector writes into one of these stores instead of into a
 * bank system. Two things make it worth having rather than just returning a
 * fabricated acknowledgement.
 *
 * First, it is idempotent on the command's idempotency key, so a retry that
 * reaches the same simulator twice produces one external object and returns
 * the same identifier. That makes "retry does not duplicate" an assertion
 * about a counted object rather than about the absence of an error, which is
 * what the proof script needs.
 *
 * Second, it can be switched off. `setSystemAvailability` is what the failure
 * proof uses to make a target unavailable, and because the connector asks this
 * module rather than reading its own instance row at execute time, the
 * availability change takes effect for an in flight retry sequence.
 *
 * The store is in process memory and does not survive a restart. That is the
 * right scope for a simulator, and it is recorded as a limitation in
 * docs/PRODUCTIZATION_GAPS.md: the durable idempotency guarantee in this
 * product is the unique index on `integration_commands.idempotency_key`, not
 * this map.
 */

import { ConnectorError } from "@/integrations/core/errors";

export interface SimulatedExternalObject {
  systemKey: string;
  externalType: string;
  externalId: string;
  externalVersion: string;
  idempotencyKey: string;
  commandKind: string;
  /** A digest, not the payload. The simulator has no reason to keep content. */
  payloadDigest: string;
  createdAt: string;
  updatedAt: string;
  writeCount: number;
}

/** Keyed by idempotency key, which is what makes a replay find the object. */
const objectsByKey = new Map<string, SimulatedExternalObject>();

/** Availability per simulated system, defaulting to available. */
const availability = new Map<string, boolean>();

/** A counter per system, so a test can assert that nothing was created twice. */
const writeAttempts = new Map<string, number>();

let objectSequence = 0;

/** Switches a simulated target system on or off. */
export function setSystemAvailability(systemKey: string, available: boolean): void {
  availability.set(systemKey, available);
}

export function isSystemAvailable(systemKey: string): boolean {
  return availability.get(systemKey) ?? true;
}

/** Number of distinct external objects a simulated system holds. */
export function countExternalObjects(systemKey?: string): number {
  if (!systemKey) return objectsByKey.size;
  let count = 0;
  for (const object of objectsByKey.values()) {
    if (object.systemKey === systemKey) count += 1;
  }
  return count;
}

/** Number of write attempts that reached a system, successful or not. */
export function countWriteAttempts(systemKey: string): number {
  return writeAttempts.get(systemKey) ?? 0;
}

/** Every object a simulated system holds, for the proof transcript. */
export function listExternalObjects(systemKey?: string): SimulatedExternalObject[] {
  const all = [...objectsByKey.values()];
  const scoped = systemKey ? all.filter((object) => object.systemKey === systemKey) : all;
  return scoped.sort((a, b) => a.externalId.localeCompare(b.externalId));
}

export function findExternalObjectByKey(idempotencyKey: string): SimulatedExternalObject | null {
  return objectsByKey.get(idempotencyKey) ?? null;
}

/** Clears every store. Called between tests and by the proof script. */
export function resetExternalStore(): void {
  objectsByKey.clear();
  availability.clear();
  writeAttempts.clear();
  objectSequence = 0;
}

export interface ApplyWriteInput {
  systemKey: string;
  externalType: string;
  /** Null when the write creates a new object. */
  targetExternalId: string | null;
  idempotencyKey: string;
  commandKind: string;
  payloadDigest: string;
  expectedVersion: string | null;
  now: string;
  /** Prefix for generated identifiers, for example "GRC". */
  idPrefix: string;
}

export interface ApplyWriteResult {
  object: SimulatedExternalObject;
  /** False when the idempotency key had already been applied. */
  created: boolean;
}

/**
 * Applies one write to a simulated system.
 *
 * Throws `connector-unavailable` when the system is switched off, which is a
 * retryable code, so the dispatcher retries and then dead letters exactly as
 * it would against a real target that is down.
 *
 * Throws `version-mismatch` when an expected version is supplied and does not
 * match. That path exists so optimistic concurrency is a real behaviour in
 * this build and not only a column on a table.
 */
export function applyExternalWrite(input: ApplyWriteInput): ApplyWriteResult {
  writeAttempts.set(input.systemKey, (writeAttempts.get(input.systemKey) ?? 0) + 1);

  if (!isSystemAvailable(input.systemKey)) {
    throw new ConnectorError(
      "connector-unavailable",
      `The simulated system "${input.systemKey}" is currently unavailable and did not accept the change.`,
      { detail: `target ${input.systemKey} unavailable` },
    );
  }

  const existing = objectsByKey.get(input.idempotencyKey);
  if (existing) {
    // The replay path. The same key returns the same object, untouched except
    // for a counter that lets a test see that a second attempt arrived.
    existing.writeCount += 1;
    existing.updatedAt = input.now;
    return { object: existing, created: false };
  }

  if (input.expectedVersion !== null && input.targetExternalId !== null) {
    const current = [...objectsByKey.values()].find(
      (object) =>
        object.systemKey === input.systemKey && object.externalId === input.targetExternalId,
    );
    if (current && current.externalVersion !== input.expectedVersion) {
      throw new ConnectorError(
        "version-mismatch",
        `The object ${input.targetExternalId} in "${input.systemKey}" is at version ${current.externalVersion} and the change expected ${input.expectedVersion}. Another change reached the target first.`,
        { detail: `version mismatch on ${input.targetExternalId}` },
      );
    }
  }

  objectSequence += 1;
  const externalId =
    input.targetExternalId ??
    `${input.idPrefix}-${String(objectSequence).padStart(6, "0")}`;

  const object: SimulatedExternalObject = {
    systemKey: input.systemKey,
    externalType: input.externalType,
    externalId,
    externalVersion: `v${objectSequence}`,
    idempotencyKey: input.idempotencyKey,
    commandKind: input.commandKind,
    payloadDigest: input.payloadDigest,
    createdAt: input.now,
    updatedAt: input.now,
    writeCount: 1,
  };

  objectsByKey.set(input.idempotencyKey, object);
  return { object, created: true };
}
