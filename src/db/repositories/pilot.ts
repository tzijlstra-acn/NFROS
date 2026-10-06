/**
 * Data access for pilot management: the pilot's setup, its measures and
 * baselines, weekly readings, issues and exit decisions.
 *
 * Records only. Whether a pilot may start, what counts as a reading and what
 * an exit decision must cite are the console's rules. Two properties are kept
 * here because they are properties of the record: a week holds one reading
 * per measure (recording it again replaces it), and a baseline is written
 * only with an explicit status, so "not measured" can never be stored as a
 * zero.
 */

import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  pilotExitDecisions,
  pilotIssues,
  pilotMeasureReadings,
  pilotMeasures,
  pilotProgrammes,
  type MeasurementStatus,
  type PilotIssueKind,
} from "@/db/schema/product-console";

const db = () => getDb();

export type PilotProgramme = typeof pilotProgrammes.$inferSelect;
export type NewPilotProgramme = typeof pilotProgrammes.$inferInsert;
export type PilotMeasure = typeof pilotMeasures.$inferSelect;
export type NewPilotMeasure = typeof pilotMeasures.$inferInsert;
export type PilotMeasureReading = typeof pilotMeasureReadings.$inferSelect;
export type NewPilotMeasureReading = typeof pilotMeasureReadings.$inferInsert;
export type PilotIssue = typeof pilotIssues.$inferSelect;
export type NewPilotIssue = typeof pilotIssues.$inferInsert;
export type PilotExitDecision = typeof pilotExitDecisions.$inferSelect;
export type NewPilotExitDecision = typeof pilotExitDecisions.$inferInsert;

function definedOnly<T extends Record<string, unknown>>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/* ==========================================================================
   Programmes
   ========================================================================== */

export function getPilotProgramme(id: string): PilotProgramme | undefined {
  return db().select().from(pilotProgrammes).where(eq(pilotProgrammes.id, id)).get();
}

export function listPilotProgrammes(): PilotProgramme[] {
  return db().select().from(pilotProgrammes).orderBy(asc(pilotProgrammes.createdAt), asc(pilotProgrammes.id)).all();
}

export function createPilotProgramme(programme: NewPilotProgramme): PilotProgramme {
  db().insert(pilotProgrammes).values(programme).run();
  const written = getPilotProgramme(programme.id);
  if (!written) throw new Error(`Pilot ${programme.id} was not written.`);
  return written;
}

/** Changes a pilot's setup or status. `updatedAt` is required, so every change is dated. */
export function updatePilotProgramme(
  id: string,
  patch: Partial<Omit<NewPilotProgramme, "id" | "createdAt" | "createdByLabel">> & { updatedAt: string },
): PilotProgramme | undefined {
  db().update(pilotProgrammes).set(definedOnly(patch)).where(eq(pilotProgrammes.id, id)).run();
  return getPilotProgramme(id);
}

/* ==========================================================================
   Measures and baselines
   ========================================================================== */

/** A pilot's measures in their display order. */
export function listPilotMeasures(pilotId: string): PilotMeasure[] {
  return db()
    .select()
    .from(pilotMeasures)
    .where(eq(pilotMeasures.pilotId, pilotId))
    .orderBy(asc(pilotMeasures.sortOrder), asc(pilotMeasures.key))
    .all();
}

export function getPilotMeasure(id: string): PilotMeasure | undefined {
  return db().select().from(pilotMeasures).where(eq(pilotMeasures.id, id)).get();
}

/** Adds a measure, or replaces the definition of the one with the same key. The baseline is kept. */
export function savePilotMeasure(measure: NewPilotMeasure): PilotMeasure {
  db()
    .insert(pilotMeasures)
    .values(measure)
    .onConflictDoUpdate({
      target: [pilotMeasures.pilotId, pilotMeasures.key],
      set: {
        label: measure.label,
        labelDe: measure.labelDe,
        kind: measure.kind,
        unit: measure.unit,
        direction: measure.direction,
        method: measure.method,
        methodDe: measure.methodDe,
        source: measure.source,
        sortOrder: measure.sortOrder,
      },
    })
    .run();
  const saved = db()
    .select()
    .from(pilotMeasures)
    .where(and(eq(pilotMeasures.pilotId, measure.pilotId), eq(pilotMeasures.key, measure.key)))
    .get();
  if (!saved) throw new Error(`Pilot measure ${measure.key} was not written.`);
  return saved;
}

export type BaselineRecord =
  | { status: "measured"; value: number; period: string; recordedAt: string; recordedByLabel: string }
  | { status: Exclude<MeasurementStatus, "measured">; recordedAt: string; recordedByLabel: string; period?: string | null };

/**
 * Records a measure's baseline. A measured baseline carries its value and
 * period; any other status clears the value, so a stale number cannot
 * survive a baseline that became unavailable.
 */
export function recordPilotBaseline(measureId: string, baseline: BaselineRecord): PilotMeasure | undefined {
  db()
    .update(pilotMeasures)
    .set({
      baselineStatus: baseline.status,
      baselineValue: baseline.status === "measured" ? baseline.value : null,
      baselinePeriod: baseline.period ?? null,
      baselineRecordedAt: baseline.recordedAt,
      baselineRecordedByLabel: baseline.recordedByLabel,
    })
    .where(eq(pilotMeasures.id, measureId))
    .run();
  return getPilotMeasure(measureId);
}

/** Sets or clears a measure's success criterion. */
export function setPilotMeasureTarget(measureId: string, target: number | null): PilotMeasure | undefined {
  db().update(pilotMeasures).set({ target }).where(eq(pilotMeasures.id, measureId)).run();
  return getPilotMeasure(measureId);
}

/* ==========================================================================
   Weekly readings
   ========================================================================== */

/**
 * Records one week's reading of one measure, replacing an earlier reading of
 * the same week. A reading that is not `measured` carries no value.
 */
export function recordPilotMeasureReading(reading: NewPilotMeasureReading): PilotMeasureReading {
  const value = reading.status === "measured" ? (reading.value ?? null) : null;
  db()
    .insert(pilotMeasureReadings)
    .values({ ...reading, value })
    .onConflictDoUpdate({
      target: [pilotMeasureReadings.measureId, pilotMeasureReadings.weekStarting],
      set: {
        status: reading.status,
        value,
        source: reading.source,
        note: reading.note ?? "",
        recordedAt: reading.recordedAt,
        recordedByLabel: reading.recordedByLabel,
      },
    })
    .run();
  const saved = db()
    .select()
    .from(pilotMeasureReadings)
    .where(and(eq(pilotMeasureReadings.measureId, reading.measureId), eq(pilotMeasureReadings.weekStarting, reading.weekStarting)))
    .get();
  if (!saved) throw new Error(`Reading for ${reading.measureId} in week ${reading.weekStarting} was not written.`);
  return saved;
}

export interface ReadingFilter {
  measureId?: string;
  /** ISO dates of week starts, inclusive. */
  fromWeek?: string;
  toWeek?: string;
}

/** A pilot's readings, oldest week first. */
export function listPilotMeasureReadings(pilotId: string, filter: ReadingFilter = {}): PilotMeasureReading[] {
  return db()
    .select()
    .from(pilotMeasureReadings)
    .where(
      and(
        eq(pilotMeasureReadings.pilotId, pilotId),
        filter.measureId ? eq(pilotMeasureReadings.measureId, filter.measureId) : undefined,
        filter.fromWeek ? gte(pilotMeasureReadings.weekStarting, filter.fromWeek) : undefined,
        filter.toWeek ? lte(pilotMeasureReadings.weekStarting, filter.toWeek) : undefined,
      ),
    )
    .orderBy(asc(pilotMeasureReadings.weekStarting), asc(pilotMeasureReadings.measureId))
    .all();
}

/* ==========================================================================
   Issues
   ========================================================================== */

export function raisePilotIssue(issue: NewPilotIssue): PilotIssue {
  db().insert(pilotIssues).values(issue).run();
  const written = db().select().from(pilotIssues).where(eq(pilotIssues.id, issue.id)).get();
  if (!written) throw new Error(`Pilot issue ${issue.id} was not written.`);
  return written;
}

export function updatePilotIssue(
  id: string,
  patch: Partial<Omit<NewPilotIssue, "id" | "pilotId" | "raisedAt" | "raisedByLabel">>,
): PilotIssue | undefined {
  const set = definedOnly(patch);
  if (Object.keys(set).length > 0) db().update(pilotIssues).set(set).where(eq(pilotIssues.id, id)).run();
  return db().select().from(pilotIssues).where(eq(pilotIssues.id, id)).get();
}

/** A pilot's issues, newest first. */
export function listPilotIssues(
  pilotId: string,
  filter: { kind?: PilotIssueKind; status?: PilotIssue["status"] } = {},
): PilotIssue[] {
  return db()
    .select()
    .from(pilotIssues)
    .where(
      and(
        eq(pilotIssues.pilotId, pilotId),
        filter.kind ? eq(pilotIssues.kind, filter.kind) : undefined,
        filter.status ? eq(pilotIssues.status, filter.status) : undefined,
      ),
    )
    .orderBy(desc(pilotIssues.raisedAt), asc(pilotIssues.id))
    .all();
}

/* ==========================================================================
   Exit decisions
   ========================================================================== */

export function recordPilotExitDecision(decision: NewPilotExitDecision): PilotExitDecision {
  db().insert(pilotExitDecisions).values(decision).run();
  const written = db().select().from(pilotExitDecisions).where(eq(pilotExitDecisions.id, decision.id)).get();
  if (!written) throw new Error(`Exit decision ${decision.id} was not written.`);
  return written;
}

/** A pilot's exit decisions in the order they were taken. */
export function listPilotExitDecisions(pilotId: string): PilotExitDecision[] {
  return db()
    .select()
    .from(pilotExitDecisions)
    .where(eq(pilotExitDecisions.pilotId, pilotId))
    .orderBy(asc(pilotExitDecisions.decidedAt), asc(pilotExitDecisions.id))
    .all();
}

export function getLatestPilotExitDecision(pilotId: string): PilotExitDecision | undefined {
  return db()
    .select()
    .from(pilotExitDecisions)
    .where(eq(pilotExitDecisions.pilotId, pilotId))
    .orderBy(desc(pilotExitDecisions.decidedAt), desc(pilotExitDecisions.id))
    .limit(1)
    .get();
}
