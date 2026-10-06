/**
 * The role home, V3.
 *
 * Thin. The frame, the header, the navigation and the bottom bar come from
 * `layout.tsx` and are already on screen before this renders, which is the
 * point of the layout. This supplies the main region only.
 *
 * Demo and planned roles (control-assurance, incident-resilience,
 * regulatory-change, nfr-governance) are not part of the current two-role
 * interactive release. When one of these role URLs is visited, the layout still
 * renders (providing the frame) but this component replaces the main region
 * with the PreviewRolePage rather than the full workday experience.
 *
 * Everything the Home shows comes from one call, `readHomeView` in
 * `src/features/home`, which reads every region from rows and states an empty
 * region in words. This file used to hold two components of its own, a daily
 * strip with fallback counts and a Partner Pulse with hard coded sentences.
 * Both were the route deciding what the day contained, which is exactly what a
 * route must not do, and both are gone.
 *
 * Freshness: the route is dynamic, and every server action that writes a
 * table Home reads calls `revalidateWorkday(roleId)` from
 * `src/workday/revalidate.ts`. The list of those tables is
 * `HOME_DATA_SOURCES` in `src/features/home/sources.ts`.
 */

import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { getRole } from "@/db/repositories/workday";
import { getRoleRelease } from "@/product/release/role-release";
import { PreviewRolePage } from "@/components/workday-v3/PreviewRolePage";
import { readHomeView } from "@/features/home";
import { getScenarioState } from "@/scenario/engine/state";
import { RoleHome } from "@/components/workday-v3/RoleHome";
import { NotSeeded } from "@/components/shell/WorkdayShell";
import type { RouteQuery } from "@/workday/dispatch";

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

export default async function RoleHomeV3({
  params,
}: {
  params: Promise<{ role: string }>;
  searchParams?: RouteQuery;
}) {
  const { role } = await params;
  const roleId = parseRole(role);

  /*
   * Demo and planned roles are defined in the release model. Visiting one
   * shows a dedicated page rather than a partially functional workday. The
   * layout still wraps this output, so the header and chrome remain consistent.
   */
  const releaseInfo = getRoleRelease(roleId);
  if (releaseInfo && (releaseInfo.status === "demo" || releaseInfo.status === "planned")) {
    return <PreviewRolePage role={releaseInfo} />;
  }

  if (!isDatabaseReady()) return <NotSeeded />;
  const state = getScenarioState();
  if (!state) return <NotSeeded />;
  if (!getRole(roleId)) return <NotSeeded />;

  return <RoleHome view={readHomeView(roleId, state)} />;
}
