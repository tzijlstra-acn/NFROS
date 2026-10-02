/**
 * Reads the moment the user is looking at.
 *
 * The scenario run holds LIVE time. The live player holds VIEWED time. Keeping
 * them in separate columns is what lets the interface say "Viewing 10:30, live
 * at 14:05" truthfully, and it is why scrubbing backwards never rewinds the
 * day or un-records a decision: time is a view, decisions are facts.
 *
 * This is a tiny read rather than a call into the live day engine because the
 * shell needs it on every render and must not depend on the player module
 * being initialised. If the player state row does not exist yet, viewed time
 * is live time, which is the correct answer for a day that has not been
 * scrubbed.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { livePlayerState } from "@/db/schema/live";

export function getViewedMoment(runId: string, liveMoment: string): string {
  try {
    const row = getDb()
      .select({ viewedMoment: livePlayerState.viewedMoment })
      .from(livePlayerState)
      .where(eq(livePlayerState.runId, runId))
      .get();
    return row?.viewedMoment ?? liveMoment;
  } catch {
    return liveMoment;
  }
}
