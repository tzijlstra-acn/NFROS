/**
 * Where an object opens, for search results and for Updates.
 *
 * The V3 interface has no read-only page for a risk, a control or a supplier,
 * and a link to one would be a dead end. So a register object opens where it
 * is worked on: in the running process of this role that covers it, at the
 * current stage, or else in the Work Hub filtered to the work linked to it,
 * which is the convention `src/features/work/related.ts` set for objects with
 * no page of their own.
 *
 * Pure, and kept apart from `read.ts` so that Updates can share the rule
 * without importing the search read model.
 */

import type { WorkProcessScope } from "@/db/repositories/work-hub";

/** A running process at its current stage, or null when the app has no route. */
export function processHref(scope: Pick<WorkProcessScope, "entryRoute" | "currentStageId">): string | null {
  return scope.entryRoute ? `${scope.entryRoute}?stage=${encodeURIComponent(scope.currentStageId)}` : null;
}

/**
 * Where a register object opens: the first running process whose scope holds
 * any of the identifiers, else the Work Hub filtered to the first of them.
 */
export function objectHref(
  roleId: string,
  objectIds: ReadonlyArray<string | null | undefined>,
  scopes: readonly WorkProcessScope[],
): string {
  const ids = objectIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  for (const scope of scopes) {
    if (scope.status === "completed") continue;
    if (!ids.some((id) => scope.scopeIds.includes(id))) continue;
    const href = processHref(scope);
    if (href) return href;
  }
  const subject = ids[0] ?? "";
  return `/workday/${roleId}/work?view=actions&object=${encodeURIComponent(subject)}`;
}
