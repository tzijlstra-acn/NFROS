/**
 * The live event projection and the read state engine.
 *
 * `workday_live_events` is a projection over content that already exists in
 * the database. This module reads it, resolves language and per-role read
 * state, and owns the unread arithmetic. It does not write events; that is
 * `src/scenario/live-event-seed.ts`.
 *
 * The unread rule is the one thing here worth reading twice. An event is
 * unread only when it has arrived, which means `atMoment` is at or before live
 * time AND no read row for the acting role carries a `readAt`. Counting events
 * the day has not reached yet would open the morning with a backlog of things
 * that have not happened, which is the specific failure the seed comment in
 * `src/db/schema/live.ts` warns about.
 *
 * Read state is keyed by (event, role) and is never reset by a role switch.
 * That is structural rather than careful: switching role changes a column on
 * the run row and touches nothing in `workday_live_event_reads`, so the third
 * party risk lead's unread set survives a trip through the resilience lead's
 * day and back.
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, ROLE_IDS, type RoleId } from "@/db/schema/core";
import { livePlayerState, workdayLiveEventReads, workdayLiveEvents } from "@/db/schema/live";
import { momentToMinutes } from "@/domain/nfr/calculators";
import type { Language } from "@/i18n/labels";
import { eventVisibleToRole, type WorkdayLiveEvent } from "@/workday/contracts";
import { isPlayerSpeed, type PlayerSnapshot } from "./live-player";

const db = () => getDb();

type EventRow = typeof workdayLiveEvents.$inferSelect;
type ReadRow = typeof workdayLiveEventReads.$inferSelect;

/* ==========================================================================
   Pure helpers
   ========================================================================== */

/**
 * Canonical ordering: scenario time, then the projection's own sort order.
 *
 * The identifier is the final tie-break so two events written at the same
 * moment with the same sort order still order identically on every machine. A
 * non-deterministic track is a track whose markers move between two runs of
 * the same demonstration.
 */
export function compareLiveEvents(a: WorkdayLiveEvent, b: WorkdayLiveEvent): number {
  return (
    momentToMinutes(a.atMoment) - momentToMinutes(b.atMoment) ||
    a.sortOrder - b.sortOrder ||
    a.id.localeCompare(b.id)
  );
}

export function sortLiveEvents(events: readonly WorkdayLiveEvent[]): WorkdayLiveEvent[] {
  return [...events].sort(compareLiveEvents);
}

/** Events the day has reached. */
export function arrivedBy(
  events: readonly WorkdayLiveEvent[],
  liveMoment: string,
): WorkdayLiveEvent[] {
  const now = momentToMinutes(liveMoment);
  return events.filter((event) => momentToMinutes(event.atMoment) <= now);
}

/** Arrived events with no read timestamp, in order. This is the catch-up list. */
export function unreadEvents(
  events: readonly WorkdayLiveEvent[],
  liveMoment: string,
): WorkdayLiveEvent[] {
  return sortLiveEvents(arrivedBy(events, liveMoment).filter((event) => event.readAt === null));
}

export function countUnread(events: readonly WorkdayLiveEvent[], liveMoment: string): number {
  return unreadEvents(events, liveMoment).length;
}

/**
 * The guided catch-up order.
 *
 * Chronological, not by severity. A walk that jumped to the critical item
 * first would describe a day that did not happen, and the explanation of the
 * 15:00 decision only makes sense after the 14:05 event that caused it.
 */
export function orderForCatchUp(
  events: readonly WorkdayLiveEvent[],
  liveMoment: string,
): WorkdayLiveEvent[] {
  return unreadEvents(events, liveMoment);
}

/** The index in the catch-up walk at which the player must stop. */
export function firstBlockingIndex(events: readonly WorkdayLiveEvent[]): number {
  return events.findIndex((event) => event.autoPause);
}

/* ==========================================================================
   Row to contract
   ========================================================================== */

function toLiveEvent(row: EventRow, read: ReadRow | undefined, language: Language): WorkdayLiveEvent {
  return {
    id: row.id,
    atMoment: row.atMoment,
    sortOrder: row.sortOrder,
    type: row.type,
    roleIds: row.roleIds,
    severity: row.severity,
    title: language === "de" ? row.titleDe : row.title,
    summary: language === "de" ? row.summaryDe : row.summary,
    objectType: row.objectType,
    objectId: row.objectId,
    evidenceIds: row.evidenceIds,
    requiresDecision: row.requiresDecision,
    autoPause: row.autoPause,
    decisionId: row.decisionId,
    derivedFrom: row.derivedFrom,
    sourceConnectorIds: row.sourceConnectorIds,
    createdAt: row.createdAt,
    readAt: read?.readAt ?? null,
    acknowledgedAt: read?.acknowledgedAt ?? null,
  };
}

/* ==========================================================================
   Reads
   ========================================================================== */

export interface LiveEventQuery {
  language?: Language;
  runId?: string;
  /** Only events at or before this moment. Omit for the whole day. */
  throughMoment?: string;
}

/** Every projected row, unfiltered by role. Used by the verification script. */
export function getAllLiveEventRows(runId = DEFAULT_RUN_ID): EventRow[] {
  return db()
    .select()
    .from(workdayLiveEvents)
    .where(eq(workdayLiveEvents.runId, runId))
    .orderBy(asc(workdayLiveEvents.atMoment), asc(workdayLiveEvents.sortOrder))
    .all();
}

/**
 * The events one role can see, with that role's read state resolved.
 *
 * A missing read row means unread. Integration events written by another agent
 * after the seed will have no read row at all, and treating that as unread is
 * the only reading that does not silently hide an inbound connector event.
 */
export function getLiveEventsForRole(
  roleId: RoleId,
  options: LiveEventQuery = {},
): WorkdayLiveEvent[] {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const language = options.language ?? "en";

  const rows = getAllLiveEventRows(runId).filter((row) => eventVisibleToRole(row, roleId));

  const reads = db()
    .select()
    .from(workdayLiveEventReads)
    .where(and(eq(workdayLiveEventReads.runId, runId), eq(workdayLiveEventReads.roleId, roleId)))
    .all();
  const byEvent = new Map(reads.map((read) => [read.eventId, read]));

  const events = rows.map((row) => toLiveEvent(row, byEvent.get(row.id), language));
  const limited =
    options.throughMoment === undefined ? events : arrivedBy(events, options.throughMoment);

  return sortLiveEvents(limited);
}

export function getLiveEvent(
  eventId: string,
  roleId: RoleId,
  options: LiveEventQuery = {},
): WorkdayLiveEvent | null {
  return getLiveEventsForRole(roleId, options).find((event) => event.id === eventId) ?? null;
}

/** The distinct moments the projection has events at, in order. */
export function getLiveEventMoments(runId = DEFAULT_RUN_ID): string[] {
  const moments = new Set(getAllLiveEventRows(runId).map((row) => row.atMoment));
  return [...moments].sort((a, b) => momentToMinutes(a) - momentToMinutes(b));
}

/** Unread count for one role at the live moment. */
export function getUnreadCount(
  roleId: RoleId,
  liveMoment: string,
  runId = DEFAULT_RUN_ID,
): number {
  return countUnread(getLiveEventsForRole(roleId, { runId }), liveMoment);
}

/** The ordered unread list for the catch-up walk. */
export function getUnreadEvents(
  roleId: RoleId,
  liveMoment: string,
  options: LiveEventQuery = {},
): WorkdayLiveEvent[] {
  return orderForCatchUp(getLiveEventsForRole(roleId, options), liveMoment);
}

/**
 * Unread counts for every role.
 *
 * Used by the verification script and by the role switcher, which has to show
 * the other functions' counts without changing the acting role to read them.
 */
export function getUnreadCountsByRole(
  liveMoment: string,
  runId = DEFAULT_RUN_ID,
): Record<RoleId, number> {
  const counts = {} as Record<RoleId, number>;
  for (const roleId of ROLE_IDS) counts[roleId] = getUnreadCount(roleId, liveMoment, runId);
  return counts;
}

/* ==========================================================================
   Writes: read state only
   ========================================================================== */

function readRowId(runId: string, eventId: string, roleId: RoleId): string {
  return `WLER-${runId}-${eventId}-${roleId}`;
}

/**
 * Upserts a read row.
 *
 * The unique constraint is (event, role), so this is an insert with a targeted
 * conflict update rather than a delete and rewrite. Deleting first would lose
 * `reviewedInCatchUp` when the same event is marked read twice, and the catch
 * up walk would then offer the same event again.
 */
function upsertRead(
  runId: string,
  eventId: string,
  roleId: RoleId,
  patch: Partial<Pick<ReadRow, "readAt" | "acknowledgedAt" | "reviewedInCatchUp">>,
): void {
  db()
    .insert(workdayLiveEventReads)
    .values({
      id: readRowId(runId, eventId, roleId),
      runId,
      eventId,
      roleId,
      readAt: patch.readAt ?? null,
      acknowledgedAt: patch.acknowledgedAt ?? null,
      reviewedInCatchUp: patch.reviewedInCatchUp ?? false,
    })
    .onConflictDoUpdate({
      target: [workdayLiveEventReads.eventId, workdayLiveEventReads.roleId],
      set: {
        ...(patch.readAt === undefined ? {} : { readAt: patch.readAt }),
        ...(patch.acknowledgedAt === undefined ? {} : { acknowledgedAt: patch.acknowledgedAt }),
        ...(patch.reviewedInCatchUp === undefined
          ? {}
          : { reviewedInCatchUp: patch.reviewedInCatchUp }),
      },
    })
    .run();
}

/** Marks one event read for one role. Idempotent. */
export function markEventRead(
  eventId: string,
  roleId: RoleId,
  runId = DEFAULT_RUN_ID,
): void {
  const existing = db()
    .select()
    .from(workdayLiveEventReads)
    .where(
      and(
        eq(workdayLiveEventReads.runId, runId),
        eq(workdayLiveEventReads.eventId, eventId),
        eq(workdayLiveEventReads.roleId, roleId),
      ),
    )
    .get();
  if (existing?.readAt) return;

  upsertRead(runId, eventId, roleId, { readAt: new Date().toISOString() });
}

/** Marks one event acknowledged, which is a stronger signal than read. */
export function markEventAcknowledged(
  eventId: string,
  roleId: RoleId,
  runId = DEFAULT_RUN_ID,
): void {
  const now = new Date().toISOString();
  upsertRead(runId, eventId, roleId, { readAt: now, acknowledgedAt: now });
}

/** Records that the guided walk has taken the user through this event. */
export function markReviewedInCatchUp(
  eventId: string,
  roleId: RoleId,
  runId = DEFAULT_RUN_ID,
): void {
  upsertRead(runId, eventId, roleId, {
    readAt: new Date().toISOString(),
    reviewedInCatchUp: true,
  });
}

/**
 * Marks every arrived event read for one role.
 *
 * Scoped to events the day has reached. Marking future events read would make
 * them arrive already read, and the heads-up card and the unread count would
 * disagree with the track for the rest of the day.
 */
export function markAllEventsRead(
  roleId: RoleId,
  liveMoment: string,
  runId = DEFAULT_RUN_ID,
): number {
  const pending = unreadEvents(getLiveEventsForRole(roleId, { runId }), liveMoment);
  if (pending.length === 0) return 0;

  const now = new Date().toISOString();
  const values = pending.map((event) => ({
    id: readRowId(runId, event.id, roleId),
    runId,
    eventId: event.id,
    roleId,
    readAt: now,
    acknowledgedAt: null,
    reviewedInCatchUp: false,
  }));

  // Batched because SQLite caps bound parameters per statement and a whole
  // day of events for one role can exceed it on a wide insert.
  const batchSize = 50;
  for (let i = 0; i < values.length; i += batchSize) {
    db()
      .insert(workdayLiveEventReads)
      .values(values.slice(i, i + batchSize))
      .onConflictDoUpdate({
        target: [workdayLiveEventReads.eventId, workdayLiveEventReads.roleId],
        set: { readAt: now },
      })
      .run();
  }

  return pending.length;
}

/* ==========================================================================
   The player singleton
   ========================================================================== */

/**
 * Reads the persisted player position.
 *
 * `liveMoment` is passed in rather than read here, because live time belongs to
 * the run row and this function must not become a second opinion about it. The
 * viewed moment is clamped to live time on read: a row left behind by an
 * earlier reset could otherwise point at a moment ahead of the day.
 */
export function getPlayerSnapshot(liveMoment: string, runId = DEFAULT_RUN_ID): PlayerSnapshot {
  const row = db().select().from(livePlayerState).where(eq(livePlayerState.runId, runId)).get();

  if (!row) {
    return {
      playing: false,
      speed: 1,
      viewedMoment: liveMoment,
      liveMoment,
      pausedByDecisionId: null,
      pausedReason: "",
      catchUpActive: false,
      catchUpIndex: 0,
    };
  }

  const viewedAhead = momentToMinutes(row.viewedMoment) > momentToMinutes(liveMoment);

  return {
    playing: row.playing,
    speed: isPlayerSpeed(row.speed) ? row.speed : 1,
    viewedMoment: viewedAhead ? liveMoment : row.viewedMoment,
    liveMoment,
    pausedByDecisionId: row.pausedByDecisionId,
    pausedReason: row.pausedReason,
    catchUpActive: row.catchUpActive,
    catchUpIndex: row.catchUpIndex,
  };
}

/**
 * Persists the player position.
 *
 * `liveMoment` is not written. The run row owns live time and `setMoment` is
 * the only thing that may change it, so that the 14:05 audit event and the
 * `eventTriggered` flag keep working.
 */
export function savePlayerSnapshot(snapshot: PlayerSnapshot, runId = DEFAULT_RUN_ID): void {
  db()
    .insert(livePlayerState)
    .values({
      id: `LPS-${runId}`,
      runId,
      playing: snapshot.playing,
      speed: snapshot.speed,
      viewedMoment: snapshot.viewedMoment,
      pausedByDecisionId: snapshot.pausedByDecisionId,
      pausedReason: snapshot.pausedReason,
      catchUpActive: snapshot.catchUpActive,
      catchUpIndex: snapshot.catchUpIndex,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: livePlayerState.id,
      set: {
        playing: snapshot.playing,
        speed: snapshot.speed,
        viewedMoment: snapshot.viewedMoment,
        pausedByDecisionId: snapshot.pausedByDecisionId,
        pausedReason: snapshot.pausedReason,
        catchUpActive: snapshot.catchUpActive,
        catchUpIndex: snapshot.catchUpIndex,
        updatedAt: new Date().toISOString(),
      },
    })
    .run();
}

/** Read rows for a set of events, for assertions and diagnostics. */
export function getReadRows(
  eventIds: readonly string[],
  runId = DEFAULT_RUN_ID,
): ReadRow[] {
  if (eventIds.length === 0) return [];
  return db()
    .select()
    .from(workdayLiveEventReads)
    .where(
      and(
        eq(workdayLiveEventReads.runId, runId),
        inArray(workdayLiveEventReads.eventId, [...eventIds]),
      ),
    )
    .all();
}
