/**
 * The notification budget.
 *
 * Plan section 9.1 asks for a product that is quiet by default: one priority,
 * one next action, one material alert, and everything else behind View all.
 * Updates cannot be that quiet, because six kinds of thing are material, but
 * it can refuse to become a feed. So:
 *
 *   One update per thing. Two events about the same decision, task or stage
 *   preparation share a key and raise one update: the most urgent of them,
 *   and the newest when two are equally urgent. A decision that arrived with
 *   the morning and was then requested by its stage is one decision.
 *
 *   At most `total` raised at once, and at most `perCategory` of one kind, so a
 *   morning with six open tasks cannot push a failed execution out of sight.
 *
 *   Raised in priority order: failed executions, blocked processes, input
 *   needed, deadlines, material changes, new work from routines. Newest first
 *   within a kind.
 *
 * What the budget holds back is not lost. It is returned as `heldBack`, in the
 * same order, and the panel shows it behind a disclosure that says how many
 * and why. The badge counts only what is raised, which is exactly what the
 * panel opens on.
 */

import { UPDATE_CATEGORIES, type NotificationBudget, type UpdateItem } from "./types";

export const NOTIFICATION_BUDGET: NotificationBudget = { total: 5, perCategory: 3 };

function priority(item: UpdateItem): number {
  return UPDATE_CATEGORIES.indexOf(item.category);
}

/** Lower is raised first: category priority, then newest. */
export function compareUpdates(a: UpdateItem, b: UpdateItem): number {
  return priority(a) - priority(b) || b.rank - a.rank || a.key.localeCompare(b.key);
}

/** One update per key: the most urgent, then the newest. */
export function dedupeUpdates(items: readonly UpdateItem[]): UpdateItem[] {
  const best = new Map<string, UpdateItem>();
  for (const item of items) {
    const current = best.get(item.key);
    if (!current || compareUpdates(item, current) < 0) best.set(item.key, item);
  }
  return [...best.values()];
}

export function applyBudget(
  items: readonly UpdateItem[],
  budget: NotificationBudget = NOTIFICATION_BUDGET,
): { raised: UpdateItem[]; heldBack: UpdateItem[] } {
  const ordered = dedupeUpdates(items).sort(compareUpdates);
  const raised: UpdateItem[] = [];
  const heldBack: UpdateItem[] = [];
  const perCategory = new Map<string, number>();

  for (const item of ordered) {
    const used = perCategory.get(item.category) ?? 0;
    if (raised.length < budget.total && used < budget.perCategory) {
      raised.push(item);
      perCategory.set(item.category, used + 1);
    } else {
      heldBack.push(item);
    }
  }

  return { raised, heldBack };
}
