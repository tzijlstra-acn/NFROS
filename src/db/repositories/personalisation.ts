/**
 * Data access for personalisation: preferences, saved views, and pinned,
 * recent and watched objects.
 *
 * Every write is the person's own and is merged or toggled, never inferred.
 * Two rules are kept here because they are properties of the record: at most
 * one default saved view per surface, and an object appears in a list once.
 * The rule that personalisation never hides mandatory work belongs to the
 * surfaces that read these rows (see `src/db/schema/personalisation.ts`).
 */

import { and, asc, desc, eq, notInArray } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import {
  savedViews,
  userObjectLists,
  userPreferences,
  type ObjectList,
  type SavedViewSurface,
} from "@/db/schema/personalisation";

const db = () => getDb();

export type UserPreferences = typeof userPreferences.$inferSelect;
export type SavedView = typeof savedViews.$inferSelect;
/** A new saved view. `runId` defaults to the active scenario run. */
export type NewSavedView = Omit<typeof savedViews.$inferInsert, "runId"> & { runId?: string };
export type ObjectListEntry = typeof userObjectLists.$inferSelect;

export type PreferencePatch = Partial<
  Pick<UserPreferences, "language" | "theme" | "defaultWorkTab" | "notificationPreference">
>;

/* ==========================================================================
   Preferences
   ========================================================================== */

export function getUserPreferences(userId: string, runId = DEFAULT_RUN_ID): UserPreferences | undefined {
  return db()
    .select()
    .from(userPreferences)
    .where(and(eq(userPreferences.runId, runId), eq(userPreferences.userId, userId)))
    .get();
}

/**
 * Saves preferences, merging into what is stored: a field left out keeps its
 * value, a field set to null returns to the product's default.
 */
export function saveUserPreferences(userId: string, patch: PreferencePatch, updatedAt: string, runId = DEFAULT_RUN_ID): UserPreferences {
  const set = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as PreferencePatch;
  db()
    .insert(userPreferences)
    .values({ id: `UPREF-${runId}-${userId}`, runId, userId, ...set, updatedAt })
    .onConflictDoUpdate({ target: [userPreferences.runId, userPreferences.userId], set: { ...set, updatedAt } })
    .run();
  const saved = getUserPreferences(userId, runId);
  if (!saved) throw new Error(`Preferences for ${userId} were not written.`);
  return saved;
}

/* ==========================================================================
   Saved views
   ========================================================================== */

/** A person's saved views in a role, by surface then name. */
export function listSavedViews(userId: string, roleId: RoleId, surface?: SavedViewSurface, runId = DEFAULT_RUN_ID): SavedView[] {
  return db()
    .select()
    .from(savedViews)
    .where(
      and(
        eq(savedViews.runId, runId),
        eq(savedViews.userId, userId),
        eq(savedViews.roleId, roleId),
        surface ? eq(savedViews.surface, surface) : undefined,
      ),
    )
    .orderBy(asc(savedViews.surface), asc(savedViews.name))
    .all();
}

/**
 * Saves a view by its name on its surface, replacing a view of the same name.
 * A view saved as the default makes the surface's previous default an
 * ordinary view, in the same transaction.
 */
export function saveSavedView(view: NewSavedView): SavedView {
  const runId = view.runId ?? DEFAULT_RUN_ID;
  const write = getSqlite().transaction((): SavedView => {
    if (view.isDefault) {
      db()
        .update(savedViews)
        .set({ isDefault: false })
        .where(
          and(
            eq(savedViews.runId, runId),
            eq(savedViews.userId, view.userId),
            eq(savedViews.roleId, view.roleId),
            eq(savedViews.surface, view.surface),
          ),
        )
        .run();
    }
    db()
      .insert(savedViews)
      .values({ ...view, runId })
      .onConflictDoUpdate({
        target: [savedViews.runId, savedViews.userId, savedViews.roleId, savedViews.surface, savedViews.name],
        set: { filters: view.filters, sort: view.sort ?? null, isDefault: view.isDefault ?? false, updatedAt: view.updatedAt },
      })
      .run();
    const saved = db()
      .select()
      .from(savedViews)
      .where(
        and(
          eq(savedViews.runId, runId),
          eq(savedViews.userId, view.userId),
          eq(savedViews.roleId, view.roleId),
          eq(savedViews.surface, view.surface),
          eq(savedViews.name, view.name),
        ),
      )
      .get();
    if (!saved) throw new Error(`Saved view ${view.name} was not written.`);
    return saved;
  });
  return write();
}

/** Deletes one of the person's own views. Returns whether it existed. */
export function deleteSavedView(id: string, userId: string, runId = DEFAULT_RUN_ID): boolean {
  return (
    db()
      .delete(savedViews)
      .where(and(eq(savedViews.runId, runId), eq(savedViews.id, id), eq(savedViews.userId, userId)))
      .run().changes > 0
  );
}

/* ==========================================================================
   Pinned, recent and watched objects
   ========================================================================== */

export interface ObjectListKey {
  userId: string;
  roleId: RoleId;
  list: ObjectList;
  runId?: string;
}

/** One list, by position, most recently touched first within a position. */
export function listObjectList(key: ObjectListKey): ObjectListEntry[] {
  return db()
    .select()
    .from(userObjectLists)
    .where(
      and(
        eq(userObjectLists.runId, key.runId ?? DEFAULT_RUN_ID),
        eq(userObjectLists.userId, key.userId),
        eq(userObjectLists.roleId, key.roleId),
        eq(userObjectLists.list, key.list),
      ),
    )
    .orderBy(asc(userObjectLists.position), desc(userObjectLists.touchedAt), asc(userObjectLists.id))
    .all();
}

export interface ObjectListEntryInput extends ObjectListKey {
  objectKind: string;
  objectId: string;
  touchedAt: string;
  position?: number;
  note?: string;
}

/** Adds an object to a list, or touches it when it is already there. */
export function addToObjectList(entry: ObjectListEntryInput): ObjectListEntry {
  const runId = entry.runId ?? DEFAULT_RUN_ID;
  db()
    .insert(userObjectLists)
    .values({
      id: `UOL-${runId}-${entry.userId}-${entry.roleId}-${entry.list}-${entry.objectKind}-${entry.objectId}`,
      runId,
      userId: entry.userId,
      roleId: entry.roleId,
      list: entry.list,
      objectKind: entry.objectKind,
      objectId: entry.objectId,
      position: entry.position ?? 0,
      note: entry.note ?? "",
      touchedAt: entry.touchedAt,
    })
    .onConflictDoUpdate({
      target: [
        userObjectLists.runId,
        userObjectLists.userId,
        userObjectLists.roleId,
        userObjectLists.list,
        userObjectLists.objectKind,
        userObjectLists.objectId,
      ],
      set: {
        touchedAt: entry.touchedAt,
        ...(entry.position !== undefined ? { position: entry.position } : {}),
        ...(entry.note !== undefined ? { note: entry.note } : {}),
      },
    })
    .run();
  const saved = db()
    .select()
    .from(userObjectLists)
    .where(
      and(
        eq(userObjectLists.runId, runId),
        eq(userObjectLists.userId, entry.userId),
        eq(userObjectLists.roleId, entry.roleId),
        eq(userObjectLists.list, entry.list),
        eq(userObjectLists.objectKind, entry.objectKind),
        eq(userObjectLists.objectId, entry.objectId),
      ),
    )
    .get();
  if (!saved) throw new Error(`The ${entry.list} entry for ${entry.objectId} was not written.`);
  return saved;
}

/** Removes an object from a list. Returns whether it was there. */
export function removeFromObjectList(key: ObjectListKey & { objectKind: string; objectId: string }): boolean {
  return (
    db()
      .delete(userObjectLists)
      .where(
        and(
          eq(userObjectLists.runId, key.runId ?? DEFAULT_RUN_ID),
          eq(userObjectLists.userId, key.userId),
          eq(userObjectLists.roleId, key.roleId),
          eq(userObjectLists.list, key.list),
          eq(userObjectLists.objectKind, key.objectKind),
          eq(userObjectLists.objectId, key.objectId),
        ),
      )
      .run().changes > 0
  );
}

/**
 * Keeps the most recently touched `keep` entries of a list and removes the
 * rest, for a bounded list such as recent objects. Returns how many went.
 */
export function trimObjectList(key: ObjectListKey, keep: number): number {
  const kept = db()
    .select({ id: userObjectLists.id })
    .from(userObjectLists)
    .where(
      and(
        eq(userObjectLists.runId, key.runId ?? DEFAULT_RUN_ID),
        eq(userObjectLists.userId, key.userId),
        eq(userObjectLists.roleId, key.roleId),
        eq(userObjectLists.list, key.list),
      ),
    )
    .orderBy(desc(userObjectLists.touchedAt), asc(userObjectLists.id))
    .limit(Math.max(0, keep))
    .all()
    .map((row) => row.id);
  return db()
    .delete(userObjectLists)
    .where(
      and(
        eq(userObjectLists.runId, key.runId ?? DEFAULT_RUN_ID),
        eq(userObjectLists.userId, key.userId),
        eq(userObjectLists.roleId, key.roleId),
        eq(userObjectLists.list, key.list),
        kept.length > 0 ? notInArray(userObjectLists.id, kept) : undefined,
      ),
    )
    .run().changes;
}
