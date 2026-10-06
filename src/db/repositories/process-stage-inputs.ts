/**
 * Data access for process stage inputs (migration 0008).
 *
 * What a person attached to a stage as input: an inbox message, confirmed
 * minutes or a document. The Inbox ("Add to process"), Meetings and the
 * stage workspace write here inside their governed handlers; the process
 * engine reads `listStageInputs` as a stage source through its public API.
 *
 * An attachment is recorded once per stage and source: attaching it again
 * returns the first row and writes nothing. Whether something may be attached
 * (the stage is open, the run is the role's own) is the handler's check, as
 * it is today in `addInboxMessageToProcess`.
 */

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { processStageInputs, type StageInputSourceKind } from "@/db/schema/process-inputs";

const db = () => getDb();

export type ProcessStageInput = typeof processStageInputs.$inferSelect;

export interface AddStageInput {
  /** Defaults to a stable id derived from the stage and the source. */
  id?: string;
  processRunId: string;
  stageId: string;
  stageRunId?: string | null;
  sourceKind: StageInputSourceKind;
  sourceId: string;
  addedByUserId: string | null;
  addedAt: string;
  addedAtMoment: string;
  note?: string;
  osEventId?: string | null;
  auditEventId?: string | null;
  runId?: string;
}

function findStageInput(input: Pick<AddStageInput, "processRunId" | "stageId" | "sourceKind" | "sourceId">, runId: string): ProcessStageInput | undefined {
  return db()
    .select()
    .from(processStageInputs)
    .where(
      and(
        eq(processStageInputs.runId, runId),
        eq(processStageInputs.processRunId, input.processRunId),
        eq(processStageInputs.stageId, input.stageId),
        eq(processStageInputs.sourceKind, input.sourceKind),
        eq(processStageInputs.sourceId, input.sourceId),
      ),
    )
    .get();
}

/** Records an attachment, once per stage and source. */
export function addStageInput(input: AddStageInput): { input: ProcessStageInput; created: boolean } {
  const runId = input.runId ?? DEFAULT_RUN_ID;
  const result = db()
    .insert(processStageInputs)
    .values({
      id: input.id ?? `PSI-${input.processRunId}-${input.stageId}-${input.sourceKind}-${input.sourceId}`,
      runId,
      processRunId: input.processRunId,
      stageId: input.stageId,
      stageRunId: input.stageRunId ?? null,
      sourceKind: input.sourceKind,
      sourceId: input.sourceId,
      addedByUserId: input.addedByUserId,
      addedAt: input.addedAt,
      addedAtMoment: input.addedAtMoment,
      note: input.note ?? "",
      osEventId: input.osEventId ?? null,
      auditEventId: input.auditEventId ?? null,
    })
    .onConflictDoNothing({
      target: [
        processStageInputs.runId,
        processStageInputs.processRunId,
        processStageInputs.stageId,
        processStageInputs.sourceKind,
        processStageInputs.sourceId,
      ],
    })
    .run();
  const row = findStageInput(input, runId);
  if (!row) throw new Error(`The stage input ${input.sourceKind} ${input.sourceId} was not written.`);
  return { input: row, created: result.changes > 0 };
}

/**
 * Links the backbone event or the audit row to an attachment, once each, for
 * a handler whose audit row is written after the change (as `executeTool`
 * writes it).
 */
export function linkStageInputRecords(id: string, links: { osEventId?: string; auditEventId?: string }): ProcessStageInput | undefined {
  const row = db().select().from(processStageInputs).where(eq(processStageInputs.id, id)).get();
  if (!row) return undefined;
  const set: Partial<ProcessStageInput> = {};
  if (links.osEventId && !row.osEventId) set.osEventId = links.osEventId;
  if (links.auditEventId && !row.auditEventId) set.auditEventId = links.auditEventId;
  if (Object.keys(set).length > 0) db().update(processStageInputs).set(set).where(eq(processStageInputs.id, id)).run();
  return db().select().from(processStageInputs).where(eq(processStageInputs.id, id)).get();
}

/** A run's inputs, or one stage's, in the order they were attached. */
export function listStageInputs(processRunId: string, stageId?: string, runId = DEFAULT_RUN_ID): ProcessStageInput[] {
  return db()
    .select()
    .from(processStageInputs)
    .where(
      and(
        eq(processStageInputs.runId, runId),
        eq(processStageInputs.processRunId, processRunId),
        stageId ? eq(processStageInputs.stageId, stageId) : undefined,
      ),
    )
    .orderBy(asc(processStageInputs.addedAt), asc(processStageInputs.id))
    .all();
}

/** Where one message, set of minutes or document was attached. */
export function findStageInputsForSource(sourceKind: StageInputSourceKind, sourceId: string, runId = DEFAULT_RUN_ID): ProcessStageInput[] {
  return db()
    .select()
    .from(processStageInputs)
    .where(and(eq(processStageInputs.runId, runId), eq(processStageInputs.sourceKind, sourceKind), eq(processStageInputs.sourceId, sourceId)))
    .orderBy(asc(processStageInputs.addedAt), asc(processStageInputs.id))
    .all();
}
