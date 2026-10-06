/**
 * Resolves the interface version before the route tree renders.
 *
 * This exists to solve one specific problem, and it is worth stating because
 * the alternative looks simpler and does not work.
 *
 * The V3.1 header has to live in a route LAYOUT, because that is the only
 * thing in the App Router that survives navigation between child routes and
 * that can stream before the page's own data resolves. Measured on this
 * machine, the header needs 312ms of data and was waiting 1224ms for the page,
 * so 913ms of the delay was purely structural.
 *
 * But a layout cannot read the query string. It receives `params`, not
 * `searchParams`, by design: a layout is not re-rendered when only the query
 * changes. So a layout cannot honour `?ui=v3.1`, and without that there is no
 * way for a reviewer to compare the interfaces side by side, which the brief
 * requires throughout the migration.
 *
 * Middleware can see the query. It resolves the version once and passes the
 * answer down two ways:
 *
 *   A REQUEST header, which the layout reads in the same request. A cookie set
 *   on the response would not be visible until the next one, which would make
 *   the first load of `?ui=v3.1` render the wrong shell.
 *
 *   A RESPONSE cookie, so a subsequent navigation that drops the parameter
 *   stays on the version the reviewer chose. Without it, clicking any link
 *   inside V3.1 would fall back to the default.
 *
 * It rewrites nothing. It redirects in exactly one case, the release gate: a
 * role the release registry marks Planned cannot be entered on any route, so
 * the request goes to the role selector, which says why. A request that does
 * not ask for a version is otherwise untouched apart from the header, which
 * carries the default.
 *
 * The gate is applied here, before the route tree renders, because this is the
 * one place every workday request passes through whatever its interface
 * version. A Demo role is pinned to the current interface for the same
 * reason: `?ui=v2` used to serve the whole earlier shell, fully interactive,
 * for a role the release does not include. The rule itself lives in
 * `src/workday/role-gate.ts`, which the page dispatcher also applies.
 */

import { NextResponse, type NextRequest } from "next/server";
import { CURRENT_WORKDAY_UI, isV3NativePath, resolveWorkdayUi } from "@/workday/contracts";
import { gateForPath, plannedRoleRedirectHref } from "@/workday/role-gate";
import { verifyAndExtract } from "@/identity/session";
import { DEMO_SESSION_COOKIE, PILOT_SESSION_COOKIE } from "@/identity/cookies";

/** The request header the workday layout and the page dispatcher read. */
export const UI_HEADER = "x-nfr-workday-ui";

/** The cookie that remembers a reviewer's choice across navigation. */
export const UI_COOKIE = "nfr-workday-ui";

/** The header carrying the resolved product mode for downstream layouts. */
export const PRODUCT_MODE_HEADER = "x-product-mode";

export async function middleware(request: NextRequest) {
  /*
   * The release gate comes first. A Planned role has nothing to render, so
   * there is no interface to resolve for it. A 307 keeps the method, which is
   * irrelevant for a page and correct for a form post that should not be
   * silently turned into a GET elsewhere.
   */
  const gate = gateForPath(request.nextUrl.pathname);
  if (gate.kind === "planned") {
    return NextResponse.redirect(new URL(plannedRoleRedirectHref(gate.release.roleId), request.url), 307);
  }

  const fromQuery = request.nextUrl.searchParams.get("ui");
  const fromCookie = request.cookies.get(UI_COOKIE)?.value;

  /*
   * Precedence: the query, then the remembered choice, then the environment,
   * then the default. The query is first so a reviewer can always override
   * what the cookie remembers, which matters when the cookie is the thing
   * producing a surprising result.
   */
  const { version, source } = resolveWorkdayUi(
    fromQuery ?? fromCookie,
    process.env["NFR_WORKDAY_UI"],
  );

  /*
   * A route with no V3.1 implementation is served as V2, and the decision is
   * made HERE so that the layout and the page cannot disagree about it.
   *
   * The layout reads this header and the page dispatcher reads this header,
   * so one answer reaches both. Downgrading in either of them separately was
   * the bug: the layout saw V3.1 and built the V3 frame, the page found no V3
   * component and rendered the V2 shell, and the document carried both.
   */
  /*
   * A Demo role always gets the current interface, on every path. The page
   * dispatcher renders the role's demo page for it there, inside the frame,
   * and the frame shows the Demo state in the header. Serving V1 or V2 instead
   * would hand the reviewer an interactive shell for a role that is not in the
   * release.
   */
  const effective =
    gate.kind === "demo"
      ? CURRENT_WORKDAY_UI
      : version === "v3.3" && !isV3NativePath(request.nextUrl.pathname)
        ? "v2"
        : version;

  const headers = new Headers(request.headers);
  headers.set(UI_HEADER, effective);

  /*
   * Session awareness: read whichever signed session cookie is present and
   * forward the product mode as a request header so layouts can read it
   * without querying a database or calling next/headers.
   *
   * Verification happens here (Edge runtime, no DB access). If the signature
   * is valid the mode is forwarded; if absent or tampered the header is omitted
   * and individual pages handle their own auth requirements.
   */
  const envMode = process.env["PRODUCT_MODE"] ?? "demonstration";

  const demoCookieRaw = request.cookies.get(DEMO_SESSION_COOKIE)?.value;
  const pilotCookieRaw = request.cookies.get(PILOT_SESSION_COOKIE)?.value;

  const hasValidDemoSession = demoCookieRaw ? (await verifyAndExtract(demoCookieRaw)) !== null : false;
  const hasValidPilotSession = pilotCookieRaw ? (await verifyAndExtract(pilotCookieRaw)) !== null : false;

  if (hasValidPilotSession && envMode === "design-partner") {
    headers.set(PRODUCT_MODE_HEADER, "design-partner");
  } else if (hasValidDemoSession) {
    headers.set(PRODUCT_MODE_HEADER, envMode === "offline-evaluation" ? "offline-evaluation" : "demonstration");
  }

  const response = NextResponse.next({ request: { headers } });

  /*
   * The cookie is written only when the query asked for something. A request
   * that did not ask should not acquire a sticky preference it never chose,
   * and writing on every request would make the cookie impossible to clear.
   */
  if (fromQuery !== null && source === "query") {
    /*
     * The cookie remembers what was ASKED for, not what this route could
     * honour. Otherwise visiting one un-migrated route would silently and
     * permanently downgrade a reviewer who had chosen V3.1.
     */
    response.cookies.set(UI_COOKIE, version, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}

export const config = {
  /*
   * The workday only. The presentation, the reporting surfaces and the
   * administrator area have one interface each and gain nothing from this.
   * Static assets and the fonts are excluded so no request pays for a
   * middleware hop it has no use for.
   */
  matcher: ["/workday", "/workday/:path*"],
};
