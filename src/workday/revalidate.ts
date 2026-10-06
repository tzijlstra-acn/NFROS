/**
 * Freshness for the workday routes, in one place.
 *
 * Home is a projection of the day: the focus queue, Your day, the Partner
 * update and Done are all read from rows at request time. The route is
 * `force-dynamic`, so a fresh request always renders fresh state. What goes
 * stale is the CLIENT: the App Router keeps the payload of pages already
 * visited, and a reader who records a decision on Decisions, completes a stage
 * on a process page or concludes a meeting in the Work Hub, and then returns to
 * Home through the rail or the back button, can be shown the Home they left.
 *
 * A server action that calls `revalidatePath` fixes both halves at once. The
 * response re-renders the page the reader is on, so a change made from inside
 * Home (the AI Partner dock, a future inline action) shows immediately, and the
 * client router discards what it had kept for every other workday page, so the
 * next visit to Home is rendered from the database again.
 *
 * The rule for every workstream is therefore one line: a server action that
 * writes anything Home reads calls `revalidateWorkday(roleId)` after the write
 * and before any `redirect`. What Home reads is listed in
 * `HOME_DATA_SOURCES` in `src/features/home/sources.ts`, so the dependency is a
 * list a reviewer can check rather than a convention somebody has to remember.
 *
 * Where it can be called, and what it does there:
 *
 *   Server action     The current page re-renders in the action response and
 *                     the client router cache is cleared. This is the case
 *                     the helper exists for.
 *
 *   Route handler     The path is marked for revalidation on the next visit.
 *                     The page the reader is looking at does NOT re-render,
 *                     so the client that called the handler must also call
 *                     `router.refresh()` when the response arrives.
 *
 *   Anything else     Scripts, the worker, tests and render. There is no
 *                     request to revalidate, so the call is a no-op and
 *                     returns `false` rather than throwing, which keeps engine
 *                     code that is shared with tests safe to call it.
 */

import { revalidatePath } from "next/cache";
import type { RoleId } from "@/db/schema/core";

/** One `revalidatePath` call, kept as data so it can be asserted in a test. */
export interface RevalidationTarget {
  path: string;
  type?: "layout" | "page";
}

/**
 * What changed, for the reader of a call site rather than for the helper.
 *
 * Every kind revalidates the same targets today, because Home, Work, Processes
 * and Decisions all show some part of each. The kind is still worth passing:
 * it says at the call site which dependency the write touched, and it is the
 * seam a later, narrower revalidation would use.
 */
export type WorkdayChange =
  | "decision"
  | "approval"
  | "action"
  | "meeting"
  | "minutes"
  | "inbox"
  | "process-stage"
  | "suggestion"
  | "activity"
  | "routine"
  | "scenario";

/**
 * The paths a change for one role invalidates.
 *
 * With a role: that role's workday layout, which covers Home, Work, Processes
 * and Decisions and the header counts above them. Without one: every role's
 * workday, for a change that is not owned by a single role (the scenario
 * clock, the language, a reset), plus the two cross-role surfaces that render
 * the same day.
 */
export function workdayRevalidationTargets(roleId?: RoleId | null): RevalidationTarget[] {
  if (roleId) {
    return [{ path: `/workday/${roleId}`, type: "layout" }];
  }
  return [
    { path: "/workday", type: "layout" },
    { path: "/control-room" },
  ];
}

/**
 * True when the error is Next saying there is no request to revalidate.
 *
 * Matched on the published error code first and the message second, so a
 * genuine failure inside a request (revalidating during render, for example,
 * which is a bug at the call site) is still thrown.
 */
function isOutsideRequest(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { __NEXT_ERROR_CODE?: string }).__NEXT_ERROR_CODE;
  if (code === "E263") return true;
  return error.message.includes("static generation store missing");
}

/**
 * Revalidates the workday a change touched.
 *
 * Returns true when the revalidation was registered with a request, false when
 * there was no request to register it with. Callers do not need the value; it
 * exists so a test can tell the two apart.
 */
export function revalidateWorkday(
  roleId?: RoleId | null,
  _change?: WorkdayChange,
): boolean {
  try {
    for (const target of workdayRevalidationTargets(roleId)) {
      if (target.type) revalidatePath(target.path, target.type);
      else revalidatePath(target.path);
    }
    return true;
  } catch (error) {
    if (isOutsideRequest(error)) return false;
    throw error;
  }
}
