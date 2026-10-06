/**
 * Work Hub, V3.
 *
 * Thin, like the other V3 routes. The frame, the header, the navigation, the
 * updates bar, the context drawer and the AI Partner come from `layout.tsx`.
 * This supplies the main region: it resolves the role, checks the scenario is
 * seeded, and renders what `buildWorkHub` assembled.
 *
 * Nothing about the work is decided here. The shell lives in
 * `src/features/work/hub.ts` and `src/components/work/`, the four modules
 * (Agenda, Meetings, Actions, Inbox) in `src/features/work/modules/`, and what
 * each role calls things in `src/features/work/roles/`. The earlier version of
 * this file was 1455 lines and carried static agenda entries, meetings,
 * actions and messages that appeared whenever the database returned nothing;
 * none of that survives. An empty module now says it is empty.
 *
 * Demo and planned roles get the preview page, as the role home does, rather
 * than a hub with no configuration behind it.
 *
 * Synthetic institution and data.
 */

import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { getRoleRelease } from "@/product/release/role-release";
import { NotSeeded } from "@/components/shell/WorkdayShell";
import { PreviewRolePage } from "@/components/workday-v3/PreviewRolePage";
import { WorkHub } from "@/components/work/WorkHub";
import { buildWorkHub } from "@/features/work/hub";
import type { RouteQuery } from "@/workday/dispatch";

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

export default async function WorkV3({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams?: RouteQuery;
}) {
  const { role } = await params;
  const roleId = parseRole(role);

  const release = getRoleRelease(roleId);
  if (release && (release.status === "demo" || release.status === "planned")) {
    return <PreviewRolePage role={release} />;
  }

  if (!isDatabaseReady()) return <NotSeeded />;

  const view = buildWorkHub(roleId, searchParams);
  if (!view) return <NotSeeded />;

  return <WorkHub view={view} />;
}
