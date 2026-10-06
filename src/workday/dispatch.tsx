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
 *
 * It is also where the release gate is applied while rendering, for the same
 * reason: every workday page is built by this factory, so a rule here reaches
 * every route and every interface version at once. `middleware.ts` applies the
 * same gate before rendering; this is the second line, for a page reached
 * without it. The rule is `src/workday/role-gate.ts`.
 */

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import type { RoleId } from "@/db/schema/core";
import { getRole } from "@/db/repositories/workday";
import { getScenarioState } from "@/scenario/engine/state";
import { PreviewRolePage } from "@/components/workday-v3/PreviewRolePage";
import type { Language } from "@/i18n/labels";
import { gateForRole, plannedRoleRedirectHref } from "./role-gate";
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
     * The release gate, before any interface is chosen. A Planned role is
     * redirected; a Demo role gets its demo page on every route and under
     * every `?ui=`, so no version of Work, Processes or Decisions renders
     * for a role the release does not include.
     */
    const { role } = await params;
    const gate = gateForRole(role);
    if (gate.kind === "planned") redirect(plannedRoleRedirectHref(role));
    if (gate.kind === "demo") {
      const ready = isDatabaseReady();
      const language: Language = ready ? (getScenarioState()?.language ?? "en") : "en";
      const holder = ready ? getRole(role as RoleId) : undefined;
      const title = holder ? (language === "de" ? holder.titleDe : holder.title) : null;
      return <PreviewRolePage role={gate.release} language={language} title={title} />;
    }

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
     * `params` is forwarded as the same promise. Every version awaits it
     * itself; the gate above awaiting it too costs nothing, because every
     * workday route is already dynamic and reading the request headers above
     * makes it so regardless.
     *
     * A route that has no V3.1 implementation yet falls back to V2 rather
     * than erroring, so the eight routes can be migrated one at a time
     * without any of them being unreachable in between.
     */
    if (version === "v1") return <V1 params={params} />;
    if (version === "v3.3" && V3) return <V3 params={params} searchParams={query} />;
    return <V2 params={params} searchParams={query} />;
  };
}
