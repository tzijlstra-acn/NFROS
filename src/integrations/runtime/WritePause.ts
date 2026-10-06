/**
 * Paused writes, per connector instance.
 *
 * "Pause writes" is an operational hold, not a configuration of what a
 * connector can do. `connector_instances.write_enabled` says whether a
 * connector may write at all, and the dispatcher refuses a new command for a
 * connector that may not. A pause is different: the connector may write, the
 * Integration Owner has stopped it for a while (an incident at the target, a
 * mapping under review), and an approved change routed to it must be kept,
 * not refused. So a paused connector still accepts commands into the outbox,
 * and the dispatcher makes no attempt against it until writes resume.
 *
 * Where the state lives. There is no column for it, and the schema is not
 * changed for it: the pause is a product configuration change, so it is a
 * row in the append only `product_config_changes` log (area
 * `integration-writes`), with the connector, the new write state, who and
 * why. A connector's write state is its latest entry; no entry means writes
 * are not paused. The log is the record of every pause and resume, and the
 * product configuration seed clears it, so `demo:reset` restores the
 * seeded state.
 *
 * Server only. Nothing here calls a connector.
 */

import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { productConfigChanges } from "@/db/schema/product";

/** The configuration area a pause or resume is recorded under. */
export const WRITE_PAUSE_AREA = "integration-writes";

export interface WritePauseValue {
  connectorInstanceId: string;
  writeState: "paused" | "resumed";
  reason: string;
}

export interface WritePauseState {
  paused: boolean;
  /** When the latest pause or resume was recorded. Null when none ever was. */
  changedAt: string | null;
  changedBy: string | null;
  reason: string;
}

function isPauseValue(value: unknown): value is WritePauseValue {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.connectorInstanceId === "string" &&
    (candidate.writeState === "paused" || candidate.writeState === "resumed")
  );
}

/** Every recorded pause and resume, newest first. */
function pauseEntries() {
  return getDb()
    .select()
    .from(productConfigChanges)
    .where(eq(productConfigChanges.area, WRITE_PAUSE_AREA))
    .orderBy(desc(productConfigChanges.at), desc(productConfigChanges.id))
    .all();
}

/** The write state of every connector that has one, keyed by instance id. */
export function listWritePauses(): Map<string, WritePauseState> {
  const states = new Map<string, WritePauseState>();
  for (const entry of pauseEntries()) {
    if (!isPauseValue(entry.newValue)) continue;
    const id = entry.newValue.connectorInstanceId;
    if (states.has(id)) continue;
    states.set(id, {
      paused: entry.newValue.writeState === "paused",
      changedAt: entry.at,
      changedBy: entry.changedBy,
      reason: entry.newValue.reason,
    });
  }
  return states;
}

/** The write state of one connector. */
export function getWritePause(connectorInstanceId: string): WritePauseState {
  return (
    listWritePauses().get(connectorInstanceId) ?? { paused: false, changedAt: null, changedBy: null, reason: "" }
  );
}

/** True while the Integration Owner has paused writes to this connector. */
export function isWritePaused(connectorInstanceId: string): boolean {
  return getWritePause(connectorInstanceId).paused;
}

/**
 * Records a pause or a resume. Returns false, writing nothing, when the
 * connector is already in that state, so a repeated press is not a change.
 */
export function recordWritePause(params: {
  connectorInstanceId: string;
  paused: boolean;
  reason: string;
  changedBy: string;
  at?: string;
}): boolean {
  const current = getWritePause(params.connectorInstanceId);
  if (current.paused === params.paused) return false;
  const value: WritePauseValue = {
    connectorInstanceId: params.connectorInstanceId,
    writeState: params.paused ? "paused" : "resumed",
    reason: params.reason,
  };
  getDb()
    .insert(productConfigChanges)
    .values({
      id: `PCC-WRITES-${randomUUID()}`,
      at: params.at ?? new Date().toISOString(),
      area: WRITE_PAUSE_AREA,
      summary: params.paused
        ? `Writes to ${params.connectorInstanceId} were paused. Approved changes stay queued until writes resume.`
        : `Writes to ${params.connectorInstanceId} were resumed.`,
      previousValue: { connectorInstanceId: params.connectorInstanceId, writeState: current.paused ? "paused" : "resumed" },
      newValue: value,
      changedBy: params.changedBy,
    })
    .run();
  return true;
}
