/**
 * Data access for release management: what happened to a product release,
 * and the release gate runs.
 *
 * The release identity is code (`PRODUCT_RELEASE` in `src/product/release/`).
 * Rows here carry only its version, so nothing in this module can claim a
 * name, a stage or a limitation the registry does not. A gate run's mandatory
 * counts are computed from its results when it completes, so "Do not allow
 * release while mandatory gates fail" reads a number that cannot disagree
 * with the gates.
 */

import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  productReleaseEvents,
  releaseGateRuns,
  type ReleaseGateResult,
  type RolloutStatus,
} from "@/db/schema/product-console";

const db = () => getDb();

export type ProductReleaseEvent = typeof productReleaseEvents.$inferSelect;
export type NewProductReleaseEvent = typeof productReleaseEvents.$inferInsert;
export type ReleaseGateRun = typeof releaseGateRuns.$inferSelect;
export type NewReleaseGateRun = typeof releaseGateRuns.$inferInsert;

/* ==========================================================================
   Release events
   ========================================================================== */

export function recordReleaseEvent(event: NewProductReleaseEvent): ProductReleaseEvent {
  db().insert(productReleaseEvents).values(event).run();
  const written = db().select().from(productReleaseEvents).where(eq(productReleaseEvents.id, event.id)).get();
  if (!written) throw new Error(`Release event ${event.id} was not written.`);
  return written;
}

/** Events, oldest first; one release's when a version is given. */
export function listReleaseEvents(releaseVersion?: string): ProductReleaseEvent[] {
  return db()
    .select()
    .from(productReleaseEvents)
    .where(releaseVersion ? eq(productReleaseEvents.releaseVersion, releaseVersion) : undefined)
    .orderBy(asc(productReleaseEvents.at), asc(productReleaseEvents.id))
    .all();
}

export interface DeployedRelease {
  releaseVersion: string;
  deployedAt: string;
  rolloutStatus: RolloutStatus | null;
}

/**
 * The release deployed now: the latest `deployed` version not rolled back
 * since, with its latest rollout status. Null when nothing has been deployed,
 * which on a fresh installation is the truth.
 */
export function getDeployedRelease(): DeployedRelease | null {
  /* Asserted rather than annotated, so the compiler does not narrow it to null for the whole loop. */
  let current = null as DeployedRelease | null;
  for (const event of listReleaseEvents()) {
    const deployed = current;
    if (event.kind === "deployed") {
      current = { releaseVersion: event.releaseVersion, deployedAt: event.at, rolloutStatus: event.rolloutStatus };
    } else if (deployed !== null && event.releaseVersion === deployed.releaseVersion) {
      if (event.kind === "rolled-back") {
        current = null;
      } else if (event.kind === "rollout-updated" && event.rolloutStatus) {
        current = { releaseVersion: deployed.releaseVersion, deployedAt: deployed.deployedAt, rolloutStatus: event.rolloutStatus };
      }
    }
  }
  return current;
}

/* ==========================================================================
   Gate runs
   ========================================================================== */

export function startReleaseGateRun(run: Omit<NewReleaseGateRun, "status" | "results" | "mandatoryTotal" | "mandatoryFailed">): ReleaseGateRun {
  db()
    .insert(releaseGateRuns)
    .values({ ...run, status: "running", results: [], mandatoryTotal: 0, mandatoryFailed: 0 })
    .run();
  const written = getReleaseGateRun(run.id);
  if (!written) throw new Error(`Gate run ${run.id} was not written.`);
  return written;
}

export interface GateRunCompletion {
  status: "passed" | "failed" | "error";
  results: ReleaseGateResult[];
  completedAt: string;
  summary?: string;
}

/**
 * Completes a gate run with its results. The mandatory counts are taken from
 * the results: a mandatory gate fails the count when it failed or did not run.
 */
export function completeReleaseGateRun(id: string, completion: GateRunCompletion): ReleaseGateRun | undefined {
  const mandatory = completion.results.filter((result) => result.mandatory);
  db()
    .update(releaseGateRuns)
    .set({
      status: completion.status,
      results: completion.results,
      mandatoryTotal: mandatory.length,
      mandatoryFailed: mandatory.filter((result) => result.status !== "passed").length,
      completedAt: completion.completedAt,
      ...(completion.summary !== undefined ? { summary: completion.summary } : {}),
    })
    .where(eq(releaseGateRuns.id, id))
    .run();
  return getReleaseGateRun(id);
}

export function getReleaseGateRun(id: string): ReleaseGateRun | undefined {
  return db().select().from(releaseGateRuns).where(eq(releaseGateRuns.id, id)).get();
}

/** Gate runs, newest first; one release's when a version is given. */
export function listReleaseGateRuns(releaseVersion?: string): ReleaseGateRun[] {
  return db()
    .select()
    .from(releaseGateRuns)
    .where(releaseVersion ? eq(releaseGateRuns.releaseVersion, releaseVersion) : undefined)
    .orderBy(desc(releaseGateRuns.startedAt), desc(releaseGateRuns.id))
    .all();
}

export function getLatestReleaseGateRun(releaseVersion: string): ReleaseGateRun | undefined {
  return listReleaseGateRuns(releaseVersion)[0];
}
