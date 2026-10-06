/**
 * Updates: the material changes for a role, under a notification budget.
 *
 * Client safe. The server read model is imported from
 * `@/features/updates/read`, and the one write from `@/features/updates/actions`.
 */

export type { NotificationBudget, UpdateCategory, UpdateItem, UpdateOrigin, UpdatesView } from "./types";
export { UPDATE_CATEGORIES } from "./types";
export { applyBudget, compareUpdates, dedupeUpdates, NOTIFICATION_BUDGET } from "./budget";
export { CATEGORY_LABELS, countLabel, fill, say, UPDATE_TITLES, UPDATES_COPY } from "./copy";
