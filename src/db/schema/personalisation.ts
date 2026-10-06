/**
 * Personalisation schema (migration 0006, plan section 8.5 and Wave 5).
 *
 * Limited, safe personalisation: language, theme, default Work tab,
 * notification preference, saved views, pinned and recent objects, and a
 * watchlist. Three tables.
 *
 * The rule every table here is designed around: personalisation must never
 * hide mandatory work or controls. Concretely,
 *
 *   - a notification preference can quiet only `QUIETABLE_NOTIFICATION_CATEGORIES`,
 *     and a quieted update is held back behind the disclosure, still listed;
 *     a failed execution, a blocked process, a request for the person's
 *     input, an approaching deadline and a material change are always raised;
 *   - a saved view narrows a list the person is looking at; it is never
 *     applied to Home's Now, the Decisions queue's open count, the header
 *     counts or Updates, and a surface showing a saved view still flags what
 *     is mandatory outside it;
 *   - pinned, recent and watched objects add shortcuts; removing one hides
 *     nothing.
 *
 * Keyed by the person the workday acts as (`user_id`): today the role's
 * holder from `roles.holder_user_id`, and the session's user id once
 * identities bind (Wave 5). Every row carries `runId` and is cleared by
 * `demo:reset`, like the people it belongs to.
 */

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { RoleId } from "./core";
import type { NotificationCategory } from "./ai-partner";

/**
 * The Work Hub tabs a person may open Work on. Kept equal to `WORK_TABS` in
 * `src/features/work/model.ts` by a unit test.
 */
export const PREFERENCE_WORK_TABS = ["agenda", "meetings", "actions", "inbox"] as const;
export type PreferenceWorkTab = (typeof PREFERENCE_WORK_TABS)[number];

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/**
 * `standard` raises every material update within the budget. `quiet` also
 * holds back a routine's new work: the work itself still appears in Work and
 * on Home, only the notification waits behind the disclosure.
 */
export const NOTIFICATION_PREFERENCES = ["standard", "quiet"] as const;
export type NotificationPreference = (typeof NOTIFICATION_PREFERENCES)[number];

/** The only categories a preference may quiet. */
export const QUIETABLE_NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = ["routine-created-work"];

/**
 * Categories no preference can quiet, because each one names work, a control
 * or a material change that needs the person. A unit test keeps the two lists
 * a partition of `NOTIFICATION_CATEGORIES`, so a new category is mandatory
 * until someone decides otherwise.
 */
export const MANDATORY_NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  "execution-failed",
  "process-blocked",
  "human-input-required",
  "deadline-approaching",
  "material-change",
];

/**
 * A person's preferences.
 *
 * Serves the shell's language and theme, Work's default tab and the Partner's
 * notification budget. Every column is nullable or defaulted, and null means
 * "follow the product": the scenario's language, the light theme, the Work
 * Hub's own first tab.
 */
export const userPreferences = sqliteTable(
  "user_preferences",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    userId: text("user_id").notNull(),
    language: text("language").$type<"en" | "de">(),
    theme: text("theme").$type<ThemePreference>(),
    defaultWorkTab: text("default_work_tab").$type<PreferenceWorkTab>(),
    notificationPreference: text("notification_preference").$type<NotificationPreference>().notNull().default("standard"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("upref_person_unq").on(table.runId, table.userId)],
);

/** The lists a saved view can narrow. */
export const SAVED_VIEW_SURFACES = ["work", "processes", "decisions"] as const;
export type SavedViewSurface = (typeof SAVED_VIEW_SURFACES)[number];

/**
 * A named filter on one list (plan 8.5: saved view).
 *
 * Serves Work, Processes and Decisions, where a person can keep "Overdue
 * evidence requests" or "Veridian only" as a view. `filters` holds the
 * surface's own query parameters; the surface validates them on read, so a
 * stale or edited filter narrows nothing it does not recognise. One default
 * per surface at most, enforced by the writer.
 */
export const savedViews = sqliteTable(
  "saved_views",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    userId: text("user_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    surface: text("surface").$type<SavedViewSurface>().notNull(),
    name: text("name").notNull(),
    filters: text("filters", { mode: "json" }).$type<Record<string, string | string[]>>().notNull(),
    sort: text("sort"),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("sview_name_unq").on(table.runId, table.userId, table.roleId, table.surface, table.name),
  ],
);

/**
 * The three object lists a person keeps.
 *
 *   pinned      the command palette's pinned objects
 *   recent      the command palette's recent objects
 *   watchlist   objects the person follows; a change to one is a material
 *               change for them
 */
export const OBJECT_LISTS = ["pinned", "recent", "watchlist"] as const;
export type ObjectList = (typeof OBJECT_LISTS)[number];

/**
 * Pinned, recent and watched objects, kept for the person rather than the browser.
 *
 * Serves the command palette (os-shell keeps recent and pinned in local
 * storage per role, `src/features/search/stored.ts`, and says so; this is its
 * server option) and the watchlist (plan 8.5). Only the kind and the id are
 * stored: the palette takes the label and the route from the role's scope on
 * every opening, so a stored row can never surface an object out of scope.
 * `position` orders a list; `touched_at` is when it was pinned, opened or
 * watched.
 */
export const userObjectLists = sqliteTable(
  "user_object_lists",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    userId: text("user_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    list: text("list").$type<ObjectList>().notNull(),
    /** A search kind, for example "control", "supplier", "decision". */
    objectKind: text("object_kind").notNull(),
    objectId: text("object_id").notNull(),
    position: integer("position").notNull().default(0),
    note: text("note").notNull().default(""),
    touchedAt: text("touched_at").notNull(),
  },
  (table) => [
    uniqueIndex("uol_entry_unq").on(table.runId, table.userId, table.roleId, table.list, table.objectKind, table.objectId),
    index("uol_list_idx").on(table.runId, table.userId, table.roleId, table.list, table.position),
  ],
);
