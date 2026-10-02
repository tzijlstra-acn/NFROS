/**
 * The activity stream writer.
 *
 * One rule governs this module and it is worth stating before the code: a row
 * in `ai_activity_entries` must correspond to something that actually
 * happened. An actual tool call, an actual connector read, an actual
 * reconciliation, an actual mutation, an actual escalation.
 *
 * The temptation in a demonstration product is to write a plausible stream of
 * activity so the panel looks busy. That would be the single most corrosive
 * thing this product could do, because the Activity tab is the evidence that
 * the rest of the interface is telling the truth. If it can contain an entry
 * for work that did not happen, it cannot be used to check anything.
 *
 * Two consequences in the API below. First, `durationMs` is a required
 * parameter rather than an optional one with a default: a caller that has not
 * measured the work has to pass zero explicitly and will notice. Second, the
 * only way to record a tool call is `recordToolCallActivity`, which takes the
 * `ToolCallResult` the runtime returned, so the outcome and the authority
 * class come from the gate rather than from the caller's description of what
 * it thinks it did.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { aiActivityEntries } from "@/db/schema/live";
import { TOOL_REGISTRY, type AuthorityClass } from "@/server/security/authority";
import type { AIActivityEntryView } from "@/workday/contracts";
import type { ToolCallResult } from "@/agents/tools/runtime";
import { createLogger } from "@/server/logging/redact";

const log = createLogger("ai-activity");
const db = () => getDb();

export type ActivityKind = AIActivityEntryView["kind"];

export interface ActivityInput {
  runId?: string;
  roleId: RoleId;
  /** Scenario clock at which the work happened. */
  atMoment: string;
  kind: ActivityKind;
  /** Short label. Names the object or the system that was touched. */
  label: string;
  labelDe: string;
  detail?: string;
  objectType?: string;
  objectId?: string;
  /** The tool or the connector operation. Empty for a plain reconciliation. */
  toolName?: string;
  /**
   * Measured duration. Required, because a guessed duration in an audit
   * adjacent stream is a fabrication with a number attached to it.
   */
  durationMs: number;
  outcome?: string;
  authorityClass?: AuthorityClass | "";
  auditEventId?: string | null;
  toolCallId?: string | null;
  evidenceIds?: string[];
  suggestionId?: string | null;
  eventId?: string | null;
  connectorInstanceId?: string | null;
}

let writeSequence = 0;

function nextId(): string {
  writeSequence += 1;
  return `AAE-${Date.now().toString(36).toUpperCase()}-${String(writeSequence).padStart(4, "0")}`;
}

/**
 * The next sequence number for a role.
 *
 * Read from the table rather than held in memory, because the seed writes the
 * opening stream in one process and the dev server appends to it in another.
 * An in-memory counter would restart at one and reorder the morning.
 */
export function nextActivitySequence(roleId: RoleId, runId = DEFAULT_RUN_ID): number {
  const row = db()
    .select({ sequence: aiActivityEntries.sequence })
    .from(aiActivityEntries)
    .where(and(eq(aiActivityEntries.runId, runId), eq(aiActivityEntries.roleId, roleId)))
    .orderBy(desc(aiActivityEntries.sequence))
    .limit(1)
    .get();
  return (row?.sequence ?? 0) + 1;
}

/** Writes one entry. Returns the identifier. */
export function recordActivity(input: ActivityInput): string {
  const runId = input.runId ?? DEFAULT_RUN_ID;
  const id = nextId();

  db()
    .insert(aiActivityEntries)
    .values({
      id,
      runId,
      roleId: input.roleId,
      atMoment: input.atMoment,
      sequence: nextActivitySequence(input.roleId, runId),
      kind: input.kind,
      label: input.label,
      labelDe: input.labelDe,
      detail: input.detail ?? "",
      objectType: input.objectType ?? "",
      objectId: input.objectId ?? "",
      toolName: input.toolName ?? "",
      durationMs: Math.max(0, Math.round(input.durationMs)),
      outcome: input.outcome ?? "",
      authorityClass: input.authorityClass ?? "",
      auditEventId: input.auditEventId ?? null,
      toolCallId: input.toolCallId ?? null,
      evidenceIds: input.evidenceIds ?? [],
      suggestionId: input.suggestionId ?? null,
      eventId: input.eventId ?? null,
      connectorInstanceId: input.connectorInstanceId ?? null,
      createdAt: new Date().toISOString(),
    })
    .run();

  return id;
}

/**
 * Writes several entries in order.
 *
 * Sequence numbers are allocated once and then incremented locally, so a
 * batch written for one generation stays contiguous rather than interleaving
 * with a concurrent generation for the same role.
 */
export function recordActivityBatch(inputs: readonly ActivityInput[]): string[] {
  if (inputs.length === 0) return [];
  const runId = inputs[0]?.runId ?? DEFAULT_RUN_ID;
  const roleId = inputs[0]?.roleId;
  if (!roleId) return [];

  let sequence = nextActivitySequence(roleId, runId);
  const ids: string[] = [];
  const now = new Date().toISOString();

  const rows = inputs.map((input) => {
    const id = nextId();
    ids.push(id);
    const row = {
      id,
      runId: input.runId ?? runId,
      roleId: input.roleId,
      atMoment: input.atMoment,
      sequence,
      kind: input.kind,
      label: input.label,
      labelDe: input.labelDe,
      detail: input.detail ?? "",
      objectType: input.objectType ?? "",
      objectId: input.objectId ?? "",
      toolName: input.toolName ?? "",
      durationMs: Math.max(0, Math.round(input.durationMs)),
      outcome: input.outcome ?? "",
      authorityClass: input.authorityClass ?? ("" as AuthorityClass | ""),
      auditEventId: input.auditEventId ?? null,
      toolCallId: input.toolCallId ?? null,
      evidenceIds: input.evidenceIds ?? [],
      suggestionId: input.suggestionId ?? null,
      eventId: input.eventId ?? null,
      connectorInstanceId: input.connectorInstanceId ?? null,
      createdAt: now,
    };
    sequence += 1;
    return row;
  });

  // Batched because SQLite has a bound parameter limit and this table is wide.
  const batchSize = 40;
  for (let i = 0; i < rows.length; i += batchSize) {
    db()
      .insert(aiActivityEntries)
      .values(rows.slice(i, i + batchSize))
      .run();
  }

  return ids;
}

/**
 * Records a tool call that genuinely ran through the authority gate.
 *
 * The outcome, the authority class and the audit reference all come from the
 * `ToolCallResult`, so an entry cannot claim a tool executed when the gate
 * returned it as a proposal. The `kind` is derived from the outcome for the
 * same reason.
 */
export function recordToolCallActivity(params: {
  runId?: string;
  roleId: RoleId;
  atMoment: string;
  result: ToolCallResult;
  label: string;
  labelDe: string;
  detail?: string;
  objectType?: string;
  objectId?: string;
  suggestionId?: string | null;
  eventId?: string | null;
  connectorInstanceId?: string | null;
}): string {
  const tool = TOOL_REGISTRY[params.result.toolName];
  const kind: ActivityKind =
    params.result.outcome === "executed"
      ? tool?.mutates
        ? "executed"
        : "retrieved"
      : params.result.outcome === "proposed"
        ? "waiting"
        : "blocked";

  return recordActivity({
    ...(params.runId ? { runId: params.runId } : {}),
    roleId: params.roleId,
    atMoment: params.atMoment,
    kind,
    label: params.label,
    labelDe: params.labelDe,
    detail: params.detail ?? params.result.summary,
    objectType: params.objectType ?? "",
    objectId: params.objectId ?? "",
    toolName: params.result.toolName,
    durationMs: params.result.durationMs,
    outcome: params.result.outcome,
    authorityClass: tool?.authorityClass ?? "",
    auditEventId: params.result.auditEventId ?? null,
    evidenceIds: params.result.evidenceIds,
    suggestionId: params.suggestionId ?? null,
    eventId: params.eventId ?? null,
    connectorInstanceId: params.connectorInstanceId ?? null,
  });
}

/**
 * Records a retrieval that actually read rows.
 *
 * `recordCount` is reported rather than described, and a read that returned
 * nothing is still recorded. A nil return is a finding in this product, and a
 * stream that silently omitted empty reads would make the morning look more
 * productive than it was.
 */
export function recordRetrievalActivity(params: {
  runId?: string;
  roleId: RoleId;
  atMoment: string;
  label: string;
  labelDe: string;
  objectType: string;
  objectId: string;
  recordCount: number;
  durationMs: number;
  evidenceIds?: string[];
  suggestionId?: string | null;
  connectorInstanceId?: string | null;
  sourceLabel?: string;
}): string {
  const detail =
    params.recordCount === 0
      ? `Returned no rows. The query scope is recorded so the nil return is itself evidence.`
      : `Returned ${params.recordCount} row(s)${params.sourceLabel ? ` from ${params.sourceLabel}` : ""}.`;

  return recordActivity({
    ...(params.runId ? { runId: params.runId } : {}),
    roleId: params.roleId,
    atMoment: params.atMoment,
    kind: "retrieved",
    label: params.label,
    labelDe: params.labelDe,
    detail,
    objectType: params.objectType,
    objectId: params.objectId,
    durationMs: params.durationMs,
    outcome: params.recordCount === 0 ? "empty" : "ok",
    authorityClass: "READ",
    evidenceIds: params.evidenceIds ?? [],
    suggestionId: params.suggestionId ?? null,
    connectorInstanceId: params.connectorInstanceId ?? null,
  });
}

/** Projects rows onto the view model the interface receives. */
export function getActivityEntries(
  roleId: RoleId,
  options: { runId?: string; language?: "en" | "de"; limit?: number; sinceSequence?: number } = {},
): AIActivityEntryView[] {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const language = options.language ?? "en";

  const rows = db()
    .select()
    .from(aiActivityEntries)
    .where(and(eq(aiActivityEntries.runId, runId), eq(aiActivityEntries.roleId, roleId)))
    .orderBy(asc(aiActivityEntries.sequence))
    .all()
    .filter((row) => row.sequence > (options.sinceSequence ?? 0));

  const limited = options.limit !== undefined ? rows.slice(-options.limit) : rows;

  return limited.map((row) => ({
    id: row.id,
    atMoment: row.atMoment,
    sequence: row.sequence,
    kind: row.kind,
    label: language === "de" ? row.labelDe : row.label,
    detail: row.detail,
    objectType: row.objectType,
    objectId: row.objectId,
    toolName: row.toolName,
    durationMs: row.durationMs,
    outcome: row.outcome,
    authorityClass: row.authorityClass,
    auditEventId: row.auditEventId,
    evidenceIds: row.evidenceIds,
    connectorLabel: row.connectorInstanceId,
  }));
}

/** Entries belonging to one suggestion, for the expanded card. */
export function getActivityForSuggestion(
  suggestionId: string,
  options: { runId?: string; language?: "en" | "de" } = {},
): AIActivityEntryView[] {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const language = options.language ?? "en";

  return db()
    .select()
    .from(aiActivityEntries)
    .where(
      and(eq(aiActivityEntries.runId, runId), eq(aiActivityEntries.suggestionId, suggestionId)),
    )
    .orderBy(asc(aiActivityEntries.sequence))
    .all()
    .map((row) => ({
      id: row.id,
      atMoment: row.atMoment,
      sequence: row.sequence,
      kind: row.kind,
      label: language === "de" ? row.labelDe : row.label,
      detail: row.detail,
      objectType: row.objectType,
      objectId: row.objectId,
      toolName: row.toolName,
      durationMs: row.durationMs,
      outcome: row.outcome,
      authorityClass: row.authorityClass,
      auditEventId: row.auditEventId,
      evidenceIds: row.evidenceIds,
      connectorLabel: row.connectorInstanceId,
    }));
}

/** Removes every entry for a run. Used by the seed so a reseed is idempotent. */
export function clearActivityForRun(runId = DEFAULT_RUN_ID): number {
  const existing = db()
    .select({ id: aiActivityEntries.id })
    .from(aiActivityEntries)
    .where(eq(aiActivityEntries.runId, runId))
    .all();
  if (existing.length === 0) return 0;
  db().delete(aiActivityEntries).where(eq(aiActivityEntries.runId, runId)).run();
  log.info("Activity stream cleared for a reseed.", { runId, removed: existing.length });
  return existing.length;
}
