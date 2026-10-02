/**
 * The version dispatcher.
 *
 * Each workday route is one module that picks an interface and hands it the
 * same parameters. Both versions then read the same repositories, the same
 * scenario engine, the same server actions and the same authority gate, which
 * is the condition the brief sets for keeping V1 around: a fallback during the
 * transition, not a second business implementation.
 *
 * The factory exists so the choice is made in exactly one place. Eight copies
 * of the same four lines would drift, and a route that silently kept rendering
 * V1 after V2 became the default would be a confusing bug to find.
 */

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { resolveUiVersionFrom } from "./ui-version";

export type RoleRouteParams = { role: string };
export type RouteQuery = Record<string, string | string[] | undefined>;

/**
 * A server component, which may be async.
 *
 * Typed by hand rather than with `ComponentType`, because an async server
 * component returns a promise and the React element types do not describe
 * that shape.
 */
type ServerComponent<P> = (props: P) => ReactNode | Promise<ReactNode>;

export interface WorkdayPageProps {
  params: Promise<RoleRouteParams>;
  searchParams?: Promise<RouteQuery>;
}

export function createWorkdayPage(
  V1: ServerComponent<{ params: Promise<RoleRouteParams> }>,
  V2: ServerComponent<{ params: Promise<RoleRouteParams>; searchParams: RouteQuery }>,
  V3?: ServerComponent<{ params: Promise<RoleRouteParams>; searchParams: RouteQuery }>,
): ServerComponent<WorkdayPageProps> {
  return async function WorkdayPage({ params, searchParams }: WorkdayPageProps) {
    const query = searchParams ? await searchParams : {};

    /*
     * The version comes from the request header, not from the query string.
     *
     * This was the single worst defect in the V3.1 work, and it was invisible
     * to anyone testing with `?ui=v3.1` in the address bar. The layout read
     * the middleware header and the page read the query, so a reader who
     * arrived by bookmark or by clicking an in-application link, with the
     * preference in the cookie and nothing in the query, got the V3.1 frame
     * from the layout and the V2 page inside it: four `header` elements in
     * one document and the V2 interface painted over the V3 one. Measured at
     * eighteen of eighteen home loads with the cookie set.
     *
     * `resolveUiVersionFrom` was written for this and had no callers. Its own
     * comment described the symptom before it happened.
     */
    const requestHeaders = await headers();
    const version = resolveUiVersionFrom(requestHeaders.get("x-nfr-workday-ui"), query);

    /*
     * `params` is forwarded unawaited. Every version already awaits it, and
     * awaiting here as well would make the dispatcher the thing that forces
     * the route dynamic rather than the pages themselves.
     *
     * A route that has no V3.1 implementation yet falls back to V2 rather
     * than erroring, so the eight routes can be migrated one at a time
     * without any of them being unreachable in between.
     */
    if (version === "v1") return <V1 params={params} />;
    if (version === "v3.1" && V3) return <V3 params={params} searchParams={query} />;
    return <V2 params={params} searchParams={query} />;
  };
}
