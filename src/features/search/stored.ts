/**
 * Recent and pinned objects, as pure list operations.
 *
 * Where they are kept, and why. The product has no table for a person's recent
 * or pinned objects, and this workstream does not change the schema, so both
 * lists live in the browser's local storage, one pair per role. That has two
 * consequences the interface states rather than hides: they follow the
 * browser, not the person, and clearing the browser clears them.
 *
 * What is stored is only what the palette shows: the type, the identifier, a
 * label, a reference and the route. Nothing else about the object, and never
 * anything a role outside this one could not already see.
 *
 * What is trusted. Nothing. Stored items are reconciled against the scope the
 * server sent each time the palette opens: an item the role can no longer see
 * is dropped, and the label and route are taken from the server's entry, so a
 * stale or edited value in storage can neither surface an object out of scope
 * nor send the reader somewhere the object no longer opens.
 */

import { isSearchKind, type SearchEntry, type SearchKind } from "./types";

export const RECENT_LIMIT = 6;
export const PINNED_LIMIT = 10;

export interface StoredSearchItem {
  kind: SearchKind;
  id: string;
  label: string;
  reference: string;
  href: string;
}

export function storageKey(list: "recent" | "pinned", roleId: string): string {
  return `nfr-wd-search-${list}:${roleId}`;
}

function sameItem(a: { kind: string; id: string }, b: { kind: string; id: string }): boolean {
  return a.kind === b.kind && a.id === b.id;
}

export function toStored(entry: SearchEntry): StoredSearchItem {
  return { kind: entry.kind, id: entry.id, label: entry.label, reference: entry.reference, href: entry.href };
}

/** Puts an item at the front, once, and keeps the list to its limit. */
export function rememberRecent(list: readonly StoredSearchItem[], item: StoredSearchItem): StoredSearchItem[] {
  return [item, ...list.filter((entry) => !sameItem(entry, item))].slice(0, RECENT_LIMIT);
}

/** Pins an item that is not pinned, unpins one that is. New pins go first. */
export function togglePinned(list: readonly StoredSearchItem[], item: StoredSearchItem): StoredSearchItem[] {
  if (list.some((entry) => sameItem(entry, item))) return list.filter((entry) => !sameItem(entry, item));
  return [item, ...list].slice(0, PINNED_LIMIT);
}

export function isPinned(list: readonly StoredSearchItem[], item: { kind: string; id: string }): boolean {
  return list.some((entry) => sameItem(entry, item));
}

/**
 * Reads a stored list, defensively.
 *
 * Anything that is not an array of well formed items, or whose route is not a
 * workday route of this role, is discarded. A malformed value yields an empty
 * list rather than an error, because a palette that fails to open over a
 * corrupted preference is a worse outcome than losing the preference.
 */
export function parseStored(raw: string | null, roleId: string): StoredSearchItem[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const prefix = `/workday/${roleId}`;
  const items: StoredSearchItem[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null) continue;
    const row = candidate as Record<string, unknown>;
    if (!isSearchKind(row["kind"])) continue;
    if (typeof row["id"] !== "string" || typeof row["label"] !== "string") continue;
    if (typeof row["reference"] !== "string" || typeof row["href"] !== "string") continue;
    const href = row["href"];
    if (href !== prefix && !href.startsWith(`${prefix}/`) && !href.startsWith(`${prefix}?`)) continue;
    items.push({ kind: row["kind"], id: row["id"], label: row["label"], reference: row["reference"], href });
  }
  return items;
}

/**
 * Keeps the stored items that are still in scope, refreshed from the scope.
 *
 * The order of the stored list is kept. Label, reference and route come from
 * the server's entry, never from storage.
 */
export function reconcileStored(
  stored: readonly StoredSearchItem[],
  entries: readonly SearchEntry[],
): StoredSearchItem[] {
  const byKey = new Map(entries.map((entry) => [`${entry.kind}:${entry.id}`, entry]));
  const out: StoredSearchItem[] = [];
  for (const item of stored) {
    const entry = byKey.get(`${item.kind}:${item.id}`);
    if (entry) out.push(toStored(entry));
  }
  return out;
}
