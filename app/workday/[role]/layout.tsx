/**
 * The workday layout.
 *
 * This file is the fix for the header defect, and the mechanism is worth
 * stating plainly because the symptom and the cause looked unrelated.
 *
 * The symptom was a header that failed to appear during normal use. The cause
 * was that the header was built inside the page's own server component, so the
 * document's first byte waited for everything the page needed. Measured on
 * this machine: the header needs 312ms of data and was waiting 1224ms, with
 * the delay dominated by `buildRoleWorkspace` at 382ms, `buildNowDetail` at
 * 170ms, `buildIntelligenceRail` at 134ms and `buildFocusQueueView` at 125ms.
 * Nothing was on screen for that whole period, because there was also no
 * `loading.tsx` to show the shell in the meantime, and no `error.tsx`, so a
 * failure in any of it blanked the header too.
 *
 * A layout is the one thing in the App Router that is rendered once and kept
 * across navigation between its child routes, and that streams independently
 * of them. Putting the frame here means:
 *
 *   the header renders from its own small query set, not the page's;
 *   the header survives client navigation between the workday routes;
 *   `loading.tsx` below replaces only the main region;
 *   `error.tsx` below replaces only the main region.
 *
 * The version is read from a request header rather than the query string,
 * because a layout does not receive `searchParams` by design. `middleware.ts`
 * resolves `?ui=` and sets that header. The reasoning is recorded there.
 */

import { headers, cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ROLE_IDS } from "@/db/schema/core";
import { normaliseWorkdayUi } from "@/workday/contracts";
import { WorkdayAppFrame } from "@/components/workday-v3/WorkdayAppFrame";
import {
  THEME_COOKIE,
  DEMO_COOKIE,
  NAV_COOKIE,
  type WdTheme,
} from "@/components/workday-v3/ChromeContext";

export const dynamic = "force-dynamic";

export default async function WorkdayRoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  if (!(ROLE_IDS as readonly string[]).includes(role)) notFound();

  const requestHeaders = await headers();
  const version = normaliseWorkdayUi(requestHeaders.get("x-nfr-workday-ui")) ?? null;

  /*
   * Only V3.1 gets this frame. V1 and V2 render their own shells inside their
   * pages, so wrapping them here would produce two headers, and the whole
   * point of keeping them is an honest comparison.
   */
  if (version !== "v3.1") return children;

  const cookieStore = await cookies();

  /*
   * The theme is read server side from a cookie, so the first response
   * already carries the right one. Reading it after mount would paint light
   * and then repaint dark, and a flash of the wrong theme on every navigation
   * is worse than not offering the choice.
   */
  const theme: WdTheme = cookieStore.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
  const demoMode = cookieStore.get(DEMO_COOKIE)?.value === "1";

  /*
   * The rail is expanded unless the reader has collapsed it. The comparison
   * is against the collapsed value rather than for the expanded one, so a
   * first visit with no cookie gets labels.
   */
  const navExpanded = cookieStore.get(NAV_COOKIE)?.value !== "0";

  return (
    <WorkdayAppFrame
      roleParam={role}
      theme={theme}
      demoMode={demoMode}
      navExpanded={navExpanded}
    >
      {children}
    </WorkdayAppFrame>
  );
}
