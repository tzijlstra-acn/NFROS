/**
 * Data access for the notification budget's ledger.
 *
 * What was raised to a role, when, whether the budget held it back, whether
 * the person read it and when the state behind it cleared. One row per role
 * and thing (`dedupe_key`, the Updates item key): recording the same thing
 * again returns the first row and writes nothing, which is how the proactive
 * Partner avoids raising one matter twice.
 *
 * Read state is not duplicated. An arrival's read mark stays in
 * `workday_live_event_reads`, which os-shell's mark-as-read writes
 * (`markEventRead` in `src/scenario/engine/live-events.ts`); `listNotifications`
 * joins it, so a reader sees one `readAt` whatever the source. A backbone
 * message (a routine's new work) is marked read here. A state is never marked
 * read: it settles when its work is done.
 *
 * Which things to raise, and the budget itself, are the Updates and Partner
 * rules (`src/features/updates/budget.ts`), not this module's.
 */

import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { workdayLiveEventReads } from "@/db/schema/live";
import {
  NOTIFICATION_CATEGORIES,
  notifications,
  type NotificationCategory,
} from "@/db/schema/ai-partner";

const db = () => getDb();

export type NotificationRow = typeof notifications.$inferSelect;
/** A new notification. `runId` defaults to the active scenario run. */
export type NewNotification = Omit<typeof notifications.$inferInsert, "runId"> & { runId?: string };

/** A notification as a reader sees it: the read mark resolved from wherever it is kept. */
export type NotificationView = NotificationRow & { read: boolean };

/** Records a notification once per role and thing. */
export function recordNotification(notification: NewNotification): { notification: NotificationRow; created: boolean } {
  const runId = notification.runId ?? DEFAULT_RUN_ID;
  const result = db()
    .insert(notifications)
    .values({ ...notification, runId })
    .onConflictDoNothing({ target: [notifications.runId, notifications.roleId, notifications.dedupeKey] })
    .run();
  const row = findNotification(notification.roleId, notification.dedupeKey, runId);
  if (!row) throw new Error(`Notification ${notification.id} was not written.`);
  return { notification: row, created: result.changes > 0 };
}

export function findNotification(roleId: RoleId, dedupeKey: string, runId = DEFAULT_RUN_ID): NotificationRow | undefined {
  return db()
    .select()
    .from(notifications)
    .where(and(eq(notifications.runId, runId), eq(notifications.roleId, roleId), eq(notifications.dedupeKey, dedupeKey)))
    .get();
}

export interface NotificationFilter {
  roleId: RoleId;
  /** ISO lower bound on `raised_at`, inclusive. */
  raisedFrom?: string;
  budgetOutcome?: "raised" | "held-back";
  /** Leave out what has settled. Default false: everything is listed. */
  openOnly?: boolean;
  runId?: string;
}

/** A role's notifications, newest first, with the read mark resolved. */
export function listNotifications(filter: NotificationFilter): NotificationView[] {
  const runId = filter.runId ?? DEFAULT_RUN_ID;
  const conditions = [eq(notifications.runId, runId), eq(notifications.roleId, filter.roleId)];
  if (filter.raisedFrom) conditions.push(gte(notifications.raisedAt, filter.raisedFrom));
  if (filter.budgetOutcome) conditions.push(eq(notifications.budgetOutcome, filter.budgetOutcome));
  if (filter.openOnly) conditions.push(isNull(notifications.settledAt));

  const rows = db()
    .select({ notification: notifications, arrivalReadAt: workdayLiveEventReads.readAt })
    .from(notifications)
    .leftJoin(
      workdayLiveEventReads,
      and(
        eq(notifications.sourceKind, "live-event"),
        eq(workdayLiveEventReads.runId, notifications.runId),
        eq(workdayLiveEventReads.eventId, notifications.sourceId),
        eq(workdayLiveEventReads.roleId, notifications.roleId),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(notifications.raisedAt), desc(notifications.id))
    .all();

  return rows.map(({ notification, arrivalReadAt }) => {
    const readAt = notification.sourceKind === "live-event" ? (arrivalReadAt ?? null) : notification.readAt;
    return { ...notification, readAt, read: readAt !== null };
  });
}

/**
 * Marks a backbone or action-register notification read.
 *
 * Refused (false) for an arrival, whose read mark belongs to
 * `workday_live_event_reads`; mark the arrival read there instead.
 */
export function markNotificationRead(id: string, userId: string | null, at: string): boolean {
  const row = db().select().from(notifications).where(eq(notifications.id, id)).get();
  if (!row || row.sourceKind === "live-event") return false;
  return (
    db()
      .update(notifications)
      .set({ readAt: at, readByUserId: userId })
      .where(and(eq(notifications.id, id), isNull(notifications.readAt)))
      .run().changes > 0
  );
}

/** Records that the state behind a notification cleared, and which event cleared it. Once only. */
export function settleNotification(id: string, at: string, eventId: string | null): boolean {
  return (
    db()
      .update(notifications)
      .set({ settledAt: at, settledByEventId: eventId })
      .where(and(eq(notifications.id, id), isNull(notifications.settledAt)))
      .run().changes > 0
  );
}

/**
 * How many were raised per category since a moment: what a budget that holds
 * across the day counts. Every category present, zero when none.
 */
export function countRaisedByCategory(roleId: RoleId, raisedFrom: string, runId = DEFAULT_RUN_ID): Record<NotificationCategory, number> {
  const rows = db()
    .select({ category: notifications.category, n: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.runId, runId),
        eq(notifications.roleId, roleId),
        eq(notifications.budgetOutcome, "raised"),
        gte(notifications.raisedAt, raisedFrom),
      ),
    )
    .groupBy(notifications.category)
    .all();
  const counts = Object.fromEntries(NOTIFICATION_CATEGORIES.map((category) => [category, 0])) as Record<
    NotificationCategory,
    number
  >;
  for (const row of rows) counts[row.category] = Number(row.n);
  return counts;
}
