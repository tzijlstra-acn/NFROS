/**
 * Today, in the V2 interface.
 *
 * The queue is assembled by `src/db/repositories/focus.ts`, which derives it
 * from real state: open decisions, prepared suggestions, completed background
 * work and the subjects under monitoring. This route renders it and nothing
 * else, because every piece of chrome around it belongs to the shell.
 *
 * The role work object sits below the queue in compact form. The queue answers
 * what needs the user, and the work object answers what the thing in question
 * actually is, in that order: a user who opens the day to a process and
 * control graph has to find their own way into it.
 */

import { getScenarioState, getTimeline } from "@/scenario/engine/state";
import {
  buildFocusContext,
  buildFocusQueueView,
  buildNowDetail,
} from "@/db/repositories/focus";
import { buildRoleWorkspace, selectableIdsOf } from "@/db/repositories/workspace";
import { getActiveSuggestions } from "@/db/repositories/partner";
import { getRoleLiveEvents } from "@/db/repositories/shell";
import { WorkdayV2Route, parseRole } from "@/components/workday-v2/WorkdayV2Route";
import { FocusWorkspace } from "@/components/workday-v2/FocusWorkspace";
import { RoleWorkObject } from "@/components/workday-v2/RoleWorkObject";
import type { RouteQuery } from "@/workday/dispatch";

export default async function TodayV2({
  params,
}: {
  params: Promise<{ role: string }>;
  searchParams?: RouteQuery;
}) {
  const { role } = await params;
  const roleId = parseRole(role);

  return (
    <WorkdayV2Route
      roleId={roleId}
      activeNav="today"
      selectableIds={selectableIdsOf(
        buildRoleWorkspace({ roleId, atMoment: "23:59", language: "en" }),
      )}
    >
      {(context) => {
        const state = getScenarioState();
        const timeline = getTimeline();
        const currentEvent = timeline.find((event) => event.moment === context.currentMoment);
        const view = buildRoleWorkspace({
          roleId: context.roleId,
          atMoment: context.currentMoment,
          language: context.language,
        });
        const suggestions = getActiveSuggestions(context.roleId, context.currentMoment, {
          language: context.language,
        });

        /*
         * One assembly, used for the Now card, the remaining sections and the
         * context line. Building it three times would let the number in the
         * context line disagree with the number of rows below it, which is the
         * kind of inconsistency a reviewer notices immediately and cannot
         * unsee.
         */
        const queue = buildFocusQueueView({
          roleId: context.roleId,
          atMoment: context.currentMoment,
          language: context.language,
        });
        const now = queue.now
          ? buildNowDetail(queue.now, {
              roleId: context.roleId,
              atMoment: context.currentMoment,
              language: context.language,
            })
          : null;

        return (
          <FocusWorkspace
            roleId={context.roleId}
            language={context.language}
            currentMoment={context.currentMoment}
            autonomyLevel={context.autonomyLevel}
            now={now}
            sections={queue.sections}
            changedObjectIds={view.changedIds}
            contextCounts={context.contextCounts}
            contextLine={buildFocusContext(context.roleId, context.currentMoment, context.language)}
            momentLabel={
              currentEvent
                ? context.language === "de"
                  ? currentEvent.titleDe
                  : currentEvent.title
                : context.roleTitleHint
            }
            workObject={
              <RoleWorkObject
                roleId={context.roleId}
                language={context.language}
                currentMoment={context.currentMoment}
                compact
                view={view}
                changedObjectIds={view.changedIds}
                events={getRoleLiveEvents(context.roleId, context.currentMoment, { limit: 20 })}
                suggestion={suggestions[0] ?? null}
                {...(state
                  ? {
                      scenario: {
                        currentMoment: state.currentMoment,
                        viewedMoment: context.viewedMoment,
                        worldView: state.worldView,
                        autonomyLevel: state.autonomyLevel,
                        eventTriggered: state.eventTriggered,
                        scenarioDate: state.scenarioDate,
                      },
                    }
                  : {})}
              />
            }
          />
        );
      }}
    </WorkdayV2Route>
  );
}
