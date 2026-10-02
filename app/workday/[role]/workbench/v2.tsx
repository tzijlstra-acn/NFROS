/**
 * The workbench, in the V2 interface.
 *
 * The role work object fills the centre and is the largest area on the screen,
 * which is the point. In V1 the same visualisation sat between a 232px left
 * rail and a 372px right rail, so at 1366 it had under half the viewport and
 * the baseline audit measured the permanent chrome at 54.4 percent.
 *
 * Selection arrives through the query string rather than client state, so a
 * command palette result, a suggestion card and a link from another route all
 * reach the same object the same way, and the selection survives a reload.
 * After that first render the selection is client state, held by
 * `SelectionProvider`, because a graph node click must not cost a round trip.
 */

import {
  getControl,
  getIncident,
  getObligations,
  getRisk,
  getService,
  getSupplier,
} from "@/db/repositories/workday";
import {
  buildRoleWorkspace,
  selectableIdsOf,
} from "@/db/repositories/workspace";
import { getActiveSuggestions, getSourceAttributions } from "@/db/repositories/partner";
import { getRoleLiveEvents } from "@/db/repositories/shell";
import { getScenarioState } from "@/scenario/engine/state";
import { WorkdayV2Route, parseRole } from "@/components/workday-v2/WorkdayV2Route";
import { RoleWorkObject } from "@/components/workday-v2/RoleWorkObject";
import { SELECTION_PARAM, parseSelectionParam } from "@/workday/selection-url";
import { SourceRow } from "@/components/workday-v2/primitives";
import { NAV_LABELS, t } from "@/i18n/labels";
import type { RouteQuery } from "@/workday/dispatch";

/**
 * Resolves a human readable label for a selected identifier.
 *
 * Passed to the shared parser so the top bar and the drawer show the object
 * title rather than its identifier. An identifier that resolves to nothing
 * falls back to itself: the parameter comes from a URL, so a stale or hand
 * edited link must degrade to showing the raw value rather than producing an
 * error page.
 */
function resolveLabel(objectId: string): string | undefined {
  return (
    getRisk(objectId)?.title ??
    getControl(objectId)?.title ??
    getSupplier(objectId)?.name ??
    getService(objectId)?.name ??
    getIncident(objectId)?.title ??
    getObligations(undefined).find((row) => row.id === objectId)?.extractedSummary
  );
}

export default async function WorkbenchV2({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams?: RouteQuery;
}) {
  const { role } = await params;
  const roleId = parseRole(role);

  const rawSelect = searchParams?.[SELECTION_PARAM];
  const selection = parseSelectionParam(
    Array.isArray(rawSelect) ? rawSelect[0] : rawSelect,
    resolveLabel,
  );

  return (
    <WorkdayV2Route
      roleId={roleId}
      activeNav="workbench"
      currentObjectLabel={selection?.label ?? null}
      initialSelection={selection}
      selectableIds={selectableIdsOf(
        buildRoleWorkspace({ roleId, atMoment: "23:59", language: "en" }),
      )}
    >
      {(context) => {
        const sources = selection
          ? getSourceAttributions(selection.objectType, selection.objectId)
          : [];
        const state = getScenarioState();
        const view = buildRoleWorkspace({
          roleId: context.roleId,
          atMoment: context.currentMoment,
          language: context.language,
        });
        const suggestions = getActiveSuggestions(context.roleId, context.currentMoment, {
          language: context.language,
        });

        return (
          <>
            <header className="app-workspace-head">
              <span className="app-eyebrow">
                <span className="app-data">{context.currentMoment}</span>
                <span className="app-faint">{context.roleTitleHint}</span>
              </span>
              <h1 className="app-title">
                {selection?.label ?? t(NAV_LABELS, "workbench", context.language)}
              </h1>
              {/*
                * The quiet source row. It names the systems behind the object,
                * how fresh each one is and whether any two disagree, and it
                * carries a deep link where the connector supports one. There
                * is nothing secret in it to leak: the view model holds a
                * system label and a freshness state, never a credential and
                * never an endpoint carrying a token.
                */}
              {sources.length > 0 ? (
                <SourceRow sources={sources} language={context.language} showNecessity />
              ) : null}
            </header>

            <RoleWorkObject
              roleId={context.roleId}
              language={context.language}
              currentMoment={context.currentMoment}
              selection={selection}
              view={view}
              changedObjectIds={view.changedIds}
              sources={sources}
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
          </>
        );
      }}
    </WorkdayV2Route>
  );
}
