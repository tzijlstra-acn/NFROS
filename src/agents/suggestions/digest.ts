/**
 * The state digest and the two layers of deduplication.
 *
 * Automatic generation is the point of the AI Partner: nobody presses a
 * Generate button. The cost of that is a generator that fires on every
 * selection change, every arriving event and every role switch, which without
 * a key would produce several identical suggestions for the same state and,
 * worse, several concurrent model calls for the same state.
 *
 * Two layers stop that, and they stop different failures.
 *
 *   1. The persistent layer. `stateDigest` is a stable hash over everything a
 *      suggestion depends on. A validated row with the same digest is the
 *      answer to the same question, so it is returned instead of regenerated.
 *      This survives a reload and a second browser tab.
 *
 *   2. The in-process layer. Two requests that arrive before the first one has
 *      written its row would both miss the cache and both call the model. The
 *      single-flight map makes the second request await the first one's
 *      promise. Without it the persistent layer is useless under exactly the
 *      conditions that matter, because the duplicate arrives in the same
 *      few hundred milliseconds.
 *
 * The digest deliberately includes the autonomy level, the world view and the
 * language. All three change the content of a correct suggestion, and an
 * earlier design that keyed only on role and object served German cached
 * content to an English session.
 */

import { createHash } from "node:crypto";
import type { AutonomyLevel, RoleId } from "@/db/schema/core";

/** Everything a suggestion's content legitimately depends on. */
export interface SuggestionStateInput {
  roleId: RoleId;
  objectType: string;
  objectId: string;
  /** The live event that triggered generation, when one did. */
  eventId: string | null;
  /** The moment the user is looking at, which may be earlier than live time. */
  viewedMoment: string;
  autonomyLevel: AutonomyLevel;
  worldView: "today" | "future";
  language: "en" | "de";
  /** The evidence set in scope. Order must not matter. */
  evidenceIds: readonly string[];
}

/**
 * Computes the deduplication key.
 *
 * The evidence set is sorted and de-duplicated before hashing. That matters
 * more than it looks: the evidence identifiers arrive from several repository
 * calls whose ordering is not guaranteed to be stable across queries, and an
 * order sensitive hash would miss the cache on every second request while
 * appearing to work in a test that happened to build the list the same way
 * twice.
 */
export function computeStateDigest(input: SuggestionStateInput): string {
  const evidence = [...new Set(input.evidenceIds)].sort();
  const canonical = JSON.stringify([
    input.roleId,
    input.objectType,
    input.objectId,
    input.eventId ?? "",
    input.viewedMoment,
    input.autonomyLevel,
    input.worldView,
    input.language,
    evidence,
  ]);
  return createHash("sha256").update(canonical).digest("hex").slice(0, 40);
}

/** The reasons a request is answered without starting new work. */
export type DedupeReason =
  | "running"
  | "cached"
  | "unchanged"
  | "historical-view"
  | "none";

export const DEDUPE_REASON_LABELS: Record<DedupeReason, { en: string; de: string }> = {
  running: {
    en: "A check for this state is already running.",
    de: "Eine Pruefung fuer diesen Stand laeuft bereits.",
  },
  cached: {
    en: "A validated suggestion for this state is already prepared.",
    de: "Ein validierter Vorschlag fuer diesen Stand liegt bereits vor.",
  },
  unchanged: {
    en: "Nothing about the current object has changed.",
    de: "Am aktuellen Objekt hat sich nichts geaendert.",
  },
  "historical-view": {
    en: "You are viewing an earlier moment. Ask for a refresh to prepare a new suggestion.",
    de: "Sie betrachten einen frueheren Zeitpunkt. Fordern Sie eine Aktualisierung an.",
  },
  none: { en: "", de: "" },
};

/**
 * In-flight generations, keyed by digest.
 *
 * Module scoped rather than passed around, because the whole purpose is that
 * two independent route invocations in the same server process see the same
 * map. A per-request instance would be a no-op with a comment claiming
 * otherwise.
 */
const inFlight = new Map<string, Promise<unknown>>();

/** How many requests have been collapsed into an existing generation. */
let collapsedCount = 0;

/**
 * Runs `work` once per digest, sharing the result with concurrent callers.
 *
 * The caller is told whether it started the work or joined someone else's, so
 * the route can report `cached` honestly rather than claiming it generated
 * something it merely awaited.
 */
export async function singleFlight<T>(
  digest: string,
  work: () => Promise<T>,
): Promise<{ value: T; joined: boolean }> {
  const existing = inFlight.get(digest);
  if (existing !== undefined) {
    collapsedCount += 1;
    // The cast is safe because the map is only ever written by this function
    // and a digest identifies one shape of work.
    const value = (await existing) as T;
    return { value, joined: true };
  }

  const promise = work();
  inFlight.set(digest, promise);
  try {
    const value = await promise;
    return { value, joined: false };
  } finally {
    /*
     * Cleared in `finally` rather than after a successful await.
     *
     * A rejected generation that stayed in the map would make every later
     * request for that state await a promise that is already rejected, so one
     * transient provider failure would permanently poison one digest. That
     * failure mode is invisible in testing because the first request still
     * returns an error correctly.
     */
    inFlight.delete(digest);
  }
}

/** True when a generation for this digest is running right now. */
export function isGenerationInFlight(digest: string): boolean {
  return inFlight.has(digest);
}

/** How many concurrent duplicates have been collapsed. Used by the tests. */
export function collapsedRequestCount(): number {
  return collapsedCount;
}

/** Clears the in-flight map and the counter. Test use only. */
export function resetSingleFlight(): void {
  inFlight.clear();
  collapsedCount = 0;
}
