/**
 * Which interactive interface to render.
 *
 * Both versions are served from the same routes, read the same database, the
 * same scenario run and the same authority gate. The only thing that differs
 * is presentation, which is what makes a side by side comparison meaningful
 * rather than a comparison of two different products.
 *
 * Resolution order, and the reason for it:
 *
 *   1. `?ui=v1`, `?ui=v2`, `?ui=v3.1` or `?ui=current` in the query. A reviewer
 *      can put two versions in two tabs and switch between them without
 *      restarting anything, which is the whole point of keeping the previous
 *      interface during a transition. `current` is an alias, so the word keeps
 *      meaning the same thing as the default moves.
 *   2. `NFR_WORKDAY_UI` in the environment, so a deployment can pin a version.
 *   3. The default.
 *
 * There is deliberately no third implementation and no per-user persistence.
 * The brief is explicit that two permanent business implementations must not
 * be maintained: V1 is a fallback for the transition, not a supported variant,
 * and it shares every repository, action and engine with V2.
 */

import {
  CURRENT_WORKDAY_UI,
  DEFAULT_WORKDAY_UI,
  isWorkdayUiVersion,
  normaliseWorkdayUi,
  resolveWorkdayUi,
  type WorkdayUiVersion,
} from "./contracts";

export type { WorkdayUiVersion };
export { CURRENT_WORKDAY_UI, DEFAULT_WORKDAY_UI, isWorkdayUiVersion, normaliseWorkdayUi };

/** The query parameter and environment variable names, in one place. */
export const UI_QUERY_PARAM = "ui";
export const UI_ENV_VAR = "NFR_WORKDAY_UI";

/**
 * Resolves the version for a request.
 *
 * `searchParams` arrives as the already awaited object from a page, because a
 * page is the only caller and awaiting it here would make this function async
 * for no reason.
 */
export function resolveUiVersion(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): { version: WorkdayUiVersion; source: "query" | "environment" | "default" } {
  const raw = searchParams?.[UI_QUERY_PARAM];
  const queryValue = Array.isArray(raw) ? raw[0] : raw;
  return resolveWorkdayUi(queryValue, process.env[UI_ENV_VAR]);
}

/**
 * The version a page should render, agreeing with the layout.
 *
 * A page CAN read the query and the layout cannot, so the layout reads the
 * request header that `middleware.ts` sets. If a page resolved the version
 * from the query alone the two could disagree, and the symptom would be a
 * V3.1 frame around a V2 page or the reverse. This reads the header first for
 * exactly that reason, and falls back to the query so the function still
 * works in a test that renders a page without the middleware.
 */
export function resolveUiVersionFrom(
  headerValue: string | null | undefined,
  searchParams: Record<string, string | string[] | undefined> | undefined,
): WorkdayUiVersion {
  const fromHeader = normaliseWorkdayUi(headerValue);
  if (fromHeader) return fromHeader;
  return resolveUiVersion(searchParams).version;
}

/**
 * Builds a link that switches version while keeping the rest of the query.
 *
 * Used by the demo menu so a presenter can show the before and after without
 * losing the moment, the role or the selection they had reached.
 */
export function uiSwitchHref(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined> | undefined,
  target: WorkdayUiVersion,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (key === UI_QUERY_PARAM) continue;
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) params.set(key, value[0]);
  }
  params.set(UI_QUERY_PARAM, target);
  return `${pathname}?${params.toString()}`;
}
