/**
 * Meetings in the V2 interface.
 *
 * Thin by design. The shell, the context drawer, the AI Partner and the live
 * day bar are assembled once in `WorkdayV2Route`; this file names the route
 * and renders the centre content. The heading comes from the navigation
 * dictionary rather than a literal, so the route title and the rail label
 * cannot disagree in either language.
 */

import { WorkdayV2Route, parseRole } from "@/components/workday-v2/WorkdayV2Route";
import { MeetingsSection } from "@/components/workday-v2/sections/MeetingsSection";
import { NAV_LABELS, t } from "@/i18n/labels";
import type { RouteQuery } from "@/workday/dispatch";

export default async function MeetingsV2({
  params,
}: {
  params: Promise<{ role: string }>;
  searchParams?: RouteQuery;
}) {
  const { role } = await params;
  const roleId = parseRole(role);

  return (
    <WorkdayV2Route roleId={roleId} activeNav="meetings">
      {(context) => (
        <>
          <header className="app-workspace-head">
            <span className="app-eyebrow">
              <span className="app-data">{context.currentMoment}</span>
              <span className="app-faint">{context.roleTitleHint}</span>
            </span>
            <h1 className="app-title">{t(NAV_LABELS, "meetings", context.language)}</h1>
          </header>
          <MeetingsSection roleId={context.roleId} language={context.language} />
        </>
      )}
    </WorkdayV2Route>
  );
}
