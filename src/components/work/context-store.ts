"use client";

/**
 * The bound work context: what the Work Hub has selected, for the shell.
 *
 * The context drawer and the AI Partner dock are rendered by the workday
 * frame, as siblings of the page rather than children of it, because they are
 * overlays that must survive navigation between the workday routes. A React
 * context provided by the Work Hub page therefore cannot reach them. This is
 * a small external store instead: the hub publishes the selected item, and
 * the drawer and the dock host subscribe with `useSyncExternalStore`.
 *
 * Three rules, each of which exists because the opposite would be a defect:
 *
 *   A selection is replaced, never silently dropped. Leaving the Work Hub, or
 *   arriving on it without an item in the URL, does not clear what was
 *   selected; the drawer keeps showing it and the partner keeps reading it,
 *   which is what "the context drawer never says Nothing selected after an
 *   item was selected" requires. Only an explicit Clear selection clears it.
 *
 *   It is per role. The store holds one context and every reader filters by
 *   the role it is rendered for, so a selection made as the Operational Risk
 *   Partner never appears in the Third-Party Risk Manager's drawer.
 *
 *   It holds no authority. The bound context is a projection of what the
 *   server rendered; nothing that has a consequence is decided from it. The
 *   partner still assembles its own context on the server from the identifier.
 *
 * Kept in session storage as well as memory, so a reload of the tab restores
 * the drawer's content rather than emptying it.
 */

import { useSyncExternalStore } from "react";
import type { BoundWorkContext } from "@/features/work/model";

const STORAGE_KEY = "nfr.work.bound";

let current: BoundWorkContext | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BoundWorkContext> | null;
      if (parsed && typeof parsed.itemId === "string" && typeof parsed.roleId === "string") {
        current = parsed as BoundWorkContext;
      }
    }
  } catch {
    // Storage disabled or unreadable: the context starts empty and nothing else changes.
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    if (current) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // As above: losing persistence loses nothing that matters.
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

/** Publishes the selected item. A null is ignored: see the rules above. */
export function publishBoundContext(next: BoundWorkContext | null): void {
  hydrate();
  if (next === null) return;
  if (current && JSON.stringify(current) === JSON.stringify(next)) return;
  current = next;
  persist();
  emit();
}

/** Clears the selection, when the person asks to. */
export function clearBoundContext(): void {
  hydrate();
  if (current === null) return;
  current = null;
  persist();
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): BoundWorkContext | null {
  hydrate();
  return current;
}

/** The bound context for one role, or null. */
export function useBoundContext(roleId: string): BoundWorkContext | null {
  const value = useSyncExternalStore(subscribe, snapshot, () => null);
  return value && value.roleId === roleId ? value : null;
}
