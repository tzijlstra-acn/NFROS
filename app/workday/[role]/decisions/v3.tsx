/**
 * Decisions, V3.1.
 *
 * Thin, like the other V3.1 routes. The frame, the header, the navigation, the
 * updates bar and the contextual drawer come from `layout.tsx` and are already
 * on screen before this renders. This supplies the main region only: the
 * location line, the page label, one line of counted context, and the queue.
 *
 * Nothing about the domain is computed here. `buildDecisionQueueView` reads
 * the decisions, their options, the execution receipt, the accountable person
 * and the authority gate's verdict, all through things that already existed.
 */

import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type AutonomyLevel, type RoleId } from "@/db/schema/core";
import { getScenarioState } from "@/scenario/engine/state";
import { NotSeeded } from "@/components/shell/WorkdayShell";
import { DecisionQueue } from "@/features/decisions/DecisionQueue";
import { buildDecisionQueueView } from "@/features/decisions/queue";
import type { Language } from "@/i18n/labels";
import type { RouteQuery } from "@/workday/dispatch";

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

export default async function DecisionsV3({
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

  const model = buildDecisionQueueView({
    roleId,
    atMoment: state.currentMoment,
    language: state.language as Language,
    autonomyLevel: state.autonomyLevel as AutonomyLevel,
  });

  return (
    <div className="wd-main-inner">
      <div className="wd-location">
        {model.locationParts.map((part, index) => (
          <span key={part} className="wd-row" style={{ gap: "var(--wd-2)" }}>
            {index > 0 ? (
              <span className="wd-header-sep" aria-hidden="true">
                /
              </span>
            ) : null}
            <span>{part}</span>
          </span>
        ))}
      </div>

      <h1 className="wd-page-title">{model.pageTitle}</h1>
      <p className="wd-context-line" style={{ marginTop: "var(--wd-1)" }}>
        {model.contextLine}
      </p>

      <section className="wd-section">
        <DecisionQueue model={model} />
      </section>
    </div>
  );
}
