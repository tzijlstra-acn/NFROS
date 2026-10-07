/**
 * The proactive Partner's notification budget, kept in the 0006 ledger.
 *
 * Server only. Updates (os-shell, `src/features/updates/`) decides what is
 * material and applies its budget to what is on screen at once: one update
 * per thing, at most five raised, at most three of a kind. That is a budget
 * on a moment. The proactive Partner also needs a budget on the day, because
 * a routine runs again every time the clock passes a trigger, and a day of
 * routines must not become a feed. So, for the one category the Partner
 * raises on its own, "new work from a routine":
 *
 *   a routine run raises a notification only when it created work (a run that
 *   checked and found nothing is never one, plan 4.11);
 *   at most `ROUTINE_DAILY_BUDGET` are raised per role and day; the rest are
 *   recorded as held back, with the reason, and Updates lists them behind
 *   its disclosure instead of raising them;
 *   a person who chose quiet notifications (`user_preferences`) has them all
 *   held back. Only this category can be quietened; every other category is
 *   mandatory (`MANDATORY_NOTIFICATION_CATEGORIES`).
 *
 * The ledger row's dedupe key is the Updates item key (`routine:<event id>`),
 * so the ledger and the panel name the same thing, and its read mark is what
 * the panel's Mark read writes for a routine update.
 */

import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import {
  countRaisedByCategory,
  findNotification,
  markNotificationRead,
  recordNotification,
  type NotificationRow,
} from "@/db/repositories/notifications";
import { getUserPreferences } from "@/db/repositories/personalisation";
import { getRole } from "@/db/repositories/workday";
import { NOTIFICATION_BUDGET } from "@/features/updates/budget";
import type { UpdateItem } from "@/features/updates/types";
import { getDb } from "@/db/client";
import { notifications } from "@/db/schema/ai-partner";
import { and, eq } from "drizzle-orm";

/** New work from routines raised per role and scenario day. The shell's at-once total. */
export const ROUTINE_DAILY_BUDGET = NOTIFICATION_BUDGET.total;

export const ROUTINE_HELD_REASONS = {
  dailyBudget: "daily-budget",
  quiet: "quiet-preference",
} as const;

export function routineUpdateKey(eventId: string): string {
  return `routine:${eventId}`;
}

/**
 * Records the notification decision for a routine run that created work.
 * Once per event: a second call returns the first decision.
 */
export function recordRoutineNotification(input: {
  roleId: RoleId;
  eventId: string;
  subject: { kind: string; id: string } | null;
  atMoment: string;
  runId?: string;
}): NotificationRow {
  const runId = input.runId ?? DEFAULT_RUN_ID;
  const key = routineUpdateKey(input.eventId);
  const existing = findNotification(input.roleId, key, runId);
  if (existing) return existing;

  const holder = getRole(input.roleId, runId)?.holderUserId ?? null;
  let quiet = false;
  try {
    quiet = holder !== null && getUserPreferences(holder, runId)?.notificationPreference === "quiet";
  } catch {
    quiet = false;
  }
  const raisedToday = countRaisedByCategory(input.roleId, "", runId)["routine-created-work"];
  const heldBackReason = quiet ? ROUTINE_HELD_REASONS.quiet : raisedToday >= ROUTINE_DAILY_BUDGET ? ROUTINE_HELD_REASONS.dailyBudget : null;

  return recordNotification({
    id: `NTF-${input.eventId}`,
    runId,
    roleId: input.roleId,
    userId: holder,
    category: "routine-created-work",
    dedupeKey: key,
    sourceKind: "backbone",
    sourceId: input.eventId,
    subjectKind: input.subject?.kind ?? null,
    subjectId: input.subject?.id ?? null,
    budgetOutcome: heldBackReason ? "held-back" : "raised",
    heldBackReason,
    raisedAt: new Date().toISOString(),
    raisedAtMoment: input.atMoment,
  }).notification;
}

/**
 * Applies the ledger to the routine updates Updates found on the backbone.
 *
 * A routine update the ledger holds back moves behind the disclosure; one the
 * person read is gone; one it raised becomes readable, the read mark being the
 * ledger's. Every other update passes through untouched.
 */
export function applyRoutineLedger(
  items: readonly UpdateItem[],
  roleId: RoleId,
  runId = DEFAULT_RUN_ID,
): { candidates: UpdateItem[]; heldBack: UpdateItem[] } {
  const routine = items.filter((item) => item.key.startsWith("routine:"));
  if (routine.length === 0) return { candidates: [...items], heldBack: [] };
  const rows = new Map(
    getDb()
      .select()
      .from(notifications)
      .where(and(eq(notifications.runId, runId), eq(notifications.roleId, roleId), eq(notifications.category, "routine-created-work")))
      .all()
      .map((row) => [row.dedupeKey, row]),
  );
  const candidates: UpdateItem[] = [];
  const heldBack: UpdateItem[] = [];
  for (const item of items) {
    if (!item.key.startsWith("routine:")) {
      candidates.push(item);
      continue;
    }
    const row = rows.get(item.key);
    if (!row) {
      candidates.push(item);
      continue;
    }
    if (row.readAt !== null) continue;
    if (row.budgetOutcome === "held-back") heldBack.push(item);
    else candidates.push({ ...item, readableEventId: row.id });
  }
  return { candidates, heldBack };
}

/** Marks a routine notification read, for the role it was raised to. */
export function markRoutineNotificationRead(roleId: RoleId, notificationId: string, runId = DEFAULT_RUN_ID): boolean {
  const row = getDb()
    .select()
    .from(notifications)
    .where(and(eq(notifications.runId, runId), eq(notifications.id, notificationId)))
    .get();
  if (!row || row.roleId !== roleId || row.category !== "routine-created-work") return false;
  const holder = getRole(roleId, runId)?.holderUserId ?? null;
  return markNotificationRead(row.id, holder, new Date().toISOString());
}
