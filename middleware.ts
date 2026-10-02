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
 * It rewrites nothing and redirects nothing. A request that does not ask for a
 * version is untouched apart from the header, which carries the default.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isV3NativePath, resolveWorkdayUi } from "@/workday/contracts";

/** The request header the workday layout and the page dispatcher read. */
export const UI_HEADER = "x-nfr-workday-ui";

/** The cookie that remembers a reviewer's choice across navigation. */
export const UI_COOKIE = "nfr-workday-ui";

export function middleware(request: NextRequest) {
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
  const effective = version === "v3.1" && !isV3NativePath(request.nextUrl.pathname)
    ? "v2"
    : version;

  const headers = new Headers(request.headers);
  headers.set(UI_HEADER, effective);

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
