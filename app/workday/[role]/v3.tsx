/**
 * The role home, V3.1.
 *
 * Thin. The frame, the header, the navigation and the bottom bar come from
 * `layout.tsx` and are already on screen before this renders, which is the
 * point of the layout. This supplies the main region only.
 *
 * The queue and the detail come from repositories that already existed and
 * are already tested. Nothing about the domain is recomputed here.
 */

import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { getRole } from "@/db/repositories/workday";
import {
  buildFocusHeadline,
  buildFocusQueueView,
  buildNowDetail,
  firstClause,
  NEXT_LIMIT,
} from "@/db/repositories/focus";
import { getActiveSuggestions } from "@/db/repositories/partner";
import { getScenarioState } from "@/scenario/engine/state";
import { RoleHome } from "@/components/workday-v3/RoleHome";
import { NotSeeded } from "@/components/shell/WorkdayShell";
import type { Language } from "@/i18n/labels";
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

  if (!isDatabaseReady()) return <NotSeeded />;
  const state = getScenarioState();
  if (!state) return <NotSeeded />;

  const language = state.language as Language;
  const roleRow = getRole(roleId);
  if (!roleRow) return <NotSeeded />;

  const queue = buildFocusQueueView({
    roleId,
    atMoment: state.currentMoment,
    language,
  });

  const now = queue.now
    ? buildNowDetail(queue.now, {
        roleId,
        atMoment: state.currentMoment,
        language,
        whyStyle: "sentence",
      })
    : null;

  /*
   * One suggestion at most, and only when it says something the Now card does
   * not. A second AI block on the opening screen is the thing the brief
   * removes: the budget is one inline suggestion.
   */
  const suggestions = getActiveSuggestions(roleId, state.currentMoment, { language, limit: 1 });
  const first = suggestions[0];
  const suggestionLead = first
    ? (first.actionsCompleted[0] ?? first.checksCompleted[0] ?? null)
    : null;
  /*
   * One clause, not two sentences. Joining two completed actions produced
   * three rendered lines, and the block has room for one. The rest is behind
   * `Review preparation`, which is what that link is for.
   */
  const suggestion = suggestionLead
    ? { body: firstClause(suggestionLead), href: `/workday/${roleId}/decisions` }
    : null;

  return (
    <RoleHome
      language={language}
      contextLine={buildFocusHeadline(roleId, state.currentMoment, language)}
      currentMoment={state.currentMoment}
      now={now}
      next={queue.next.slice(0, NEXT_LIMIT)}
      watching={queue.watching}
      sections={queue.sections}
      suggestion={suggestion}
      queueHref={`/workday/${roleId}/decisions`}
    />
  );
}
