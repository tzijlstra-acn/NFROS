/**
 * Source completeness computation.
 *
 * A response is evidence-complete only when every required source is loaded.
 * The display status is a categorical label, never a percentage. A numerical
 * confidence figure would suggest a precision the model does not have and the
 * regulatory context does not permit.
 */

import type { RequiredSourceStatus } from "./contracts";

export type SourceCompletenessStatus =
  | "evidence-complete"
  | "evidence-incomplete"
  | "sources-conflict"
  | "source-stale"
  | "judgment-required";

/**
 * Derive the completeness status from the required source list.
 *
 * Priority: unavailable sources (evidence-incomplete) beat stale sources
 * (source-stale) beat the all-loaded case (evidence-complete). The
 * sources-conflict and judgment-required values are not derived here -- they
 * are set by the AI pipeline when a contradiction or an unresolvable ambiguity
 * is detected.
 */
export function computeSourceCompleteness(
  required: RequiredSourceStatus[]
): SourceCompletenessStatus {
  const hasUnavailable = required.some((s) => s.status === "unavailable");
  const hasStale = required.some((s) => s.status === "stale");
  if (hasUnavailable) return "evidence-incomplete";
  if (hasStale) return "source-stale";
  return "evidence-complete";
}

/**
 * The display label for a source completeness status.
 *
 * No percentages. The contract is categorical: a source is either available
 * or it is not, and presenting a number would imply a gradient that does not
 * exist in the evidence model.
 */
export function getDisplayStatus(status: SourceCompletenessStatus): string {
  const map: Record<SourceCompletenessStatus, string> = {
    "evidence-complete": "Evidence complete",
    "evidence-incomplete": "Evidence incomplete",
    "sources-conflict": "Sources conflict",
    "source-stale": "Source stale",
    "judgment-required": "Judgment required",
  };
  return map[status];
}
