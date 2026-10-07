/**
 * The Updates read model.
 *
 * Server only. One call, `readUpdates(roleId, state)`, returns what is
 * material for the role now, already put through the notification budget. The
 * header bell, the bottom bar and the Updates panel all read it, so the count
 * on the badge and the list the badge opens are the same rows by
 * construction.
 *
 * Driven by the OS event backbone: `listOsEvents` with the seeded arrivals
 * read through it. Three things are read beside it, each because the backbone
 * cannot answer the question on its own:
 *
 *   the decisions the role can see now, because a decision taken on the
 *   Decisions page settles a "decision required" arrival whether or not the
 *   decisions engine published an event for it;
 *
 *   the role's read marks on arrivals, which are the only updates a person
 *   can mark as read;
 *
 *   the action register, for due dates, because no deadline event exists.
 *
 * Where each update opens is resolved here from the process registry and the
 * arrivals' own projection rows, so every update lands on the surface where
 * its work is done.
 *
 * Nothing here writes. Marking an arrival read is `actions.ts`.
 */

import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { workdayLiveEventReads, workdayLiveEvents } from "@/db/schema/live";
import { getRole } from "@/db/repositories/workday";
import {
  getDecisionRefs,
  getProcessScopes,
  getWorkActions,
  type WorkProcessScope,
} from "@/db/repositories/work-hub";
import { listOsEvents, type OsEventView } from "@/features/events/backbone";
import { happenedToday, type DayWindow } from "@/features/home/assemble";
import { objectHref, processHref } from "@/features/search/routes";
import { DEFAULT_QUERY, itemHref, workHref } from "@/features/work/url";
import { getInstalledRoleApps, getProcessDefinition, getRoleApp } from "@/role-apps/registry";
import type { ScenarioState } from "@/scenario/engine/state";
import { createLogger } from "@/server/logging/redact";
import { momentToMinutes } from "@/domain/nfr/calculators";
import type { Language } from "@/i18n/labels";
import { applyBudget, NOTIFICATION_BUDGET } from "./budget";
import { applyRoutineLedger } from "@/features/partner/notifications";
import { classifyArrivals, classifyBackbone, deadlineUpdates, type ClassifyContext } from "./classify";
import type { UpdatesView } from "./types";

const log = createLogger("updates");
const db = () => getDb();

function isClock(value: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(value);
}

/** The stage label and route for every process run of the role. */
function processIndex(scopes: readonly WorkProcessScope[], language: Language) {
  const byRun = new Map(scopes.map((scope) => [scope.roleAppRunId, scope]));

  const stageOf = (processRunId: string | null, stageId: string | null) => {
    if (!processRunId || !stageId) return null;
    const scope = byRun.get(processRunId);
    const app = scope ? getRoleApp(scope.roleAppId) : undefined;
    const definition = app ? getProcessDefinition(app.processId) : undefined;
    return definition?.stages.find((stage) => stage.id === stageId) ?? null;
  };

  return {
    stageLabel(processRunId: string | null, stageId: string | null): string | null {
      const stage = stageOf(processRunId, stageId);
      if (!stage) return null;
      return language === "de"
        ? `Stufe ${stage.sequence}: ${stage.nameDe}`
        : `Stage ${stage.sequence}: ${stage.name}`;
    },
    seededDecisionId(processRunId: string | null, stageId: string | null, decisionKey: string): string | null {
      const decision = stageOf(processRunId, stageId)?.decisions.find((entry) => entry.key === decisionKey);
      return decision?.binding.kind === "seeded-decision" ? decision.binding.decisionId : null;
    },
    stageHref(roleId: string, processRunId: string | null, stageId: string | null): string {
      const scope = processRunId ? byRun.get(processRunId) : undefined;
      if (scope?.entryRoute) {
        return stageId
          ? `${scope.entryRoute}?stage=${encodeURIComponent(stageId)}`
          : (processHref(scope) ?? scope.entryRoute);
      }
      return `/workday/${roleId}/processes`;
    },
  };
}

/** The projection row behind each arrival, for routing it to its own object. */
function arrivalSources(runId: string): Map<string, { derivedFrom: string; derivedFromId: string | null }> {
  return new Map(
    db()
      .select({
        id: workdayLiveEvents.id,
        derivedFrom: workdayLiveEvents.derivedFrom,
        derivedFromId: workdayLiveEvents.derivedFromId,
      })
      .from(workdayLiveEvents)
      .where(eq(workdayLiveEvents.runId, runId))
      .all()
      .map((row) => [row.id, { derivedFrom: row.derivedFrom, derivedFromId: row.derivedFromId || null }]),
  );
}

function readArrivalMarks(roleId: RoleId, runId: string): Set<string> {
  return new Set(
    db()
      .select({ eventId: workdayLiveEventReads.eventId })
      .from(workdayLiveEventReads)
      .where(
        and(
          eq(workdayLiveEventReads.runId, runId),
          eq(workdayLiveEventReads.roleId, roleId),
          isNotNull(workdayLiveEventReads.readAt),
        ),
      )
      .all()
      .map((row) => row.eventId),
  );
}

function empty(roleId: string, state: ScenarioState, value: UpdatesView["state"]): UpdatesView {
  return {
    roleId,
    language: state.language,
    atMoment: state.currentMoment,
    state: value,
    raised: [],
    heldBack: [],
    budget: NOTIFICATION_BUDGET,
  };
}

export function readUpdates(roleId: RoleId, state: ScenarioState): UpdatesView {
  const runId = state.runId ?? DEFAULT_RUN_ID;
  const language: Language = state.language;
  const atMoment = state.currentMoment;
  const day: DayWindow = { scenarioDate: state.scenarioDate, seededAt: state.seededAt, atMoment };

  let events: OsEventView[];
  try {
    events = listOsEvents({ runId, roleId, language, includeArrivals: { upToMoment: atMoment } });
  } catch (error) {
    log.warn("The event backbone could not be read for Updates.", { roleId, error });
    return empty(roleId, state, "unavailable");
  }

  try {
    const role = getRole(roleId, runId);
    const scopes = getProcessScopes(roleId, runId);
    const index = processIndex(scopes, language);
    const sources = arrivalSources(runId);
    const decisions = getDecisionRefs(roleId, atMoment, runId);
    const open = decisions.filter((decision) => decision.status === "open");
    const completionTools = new Set(
      getInstalledRoleApps()
        .map((app) => app.stageCompletionToolName)
        .filter((name): name is string => typeof name === "string"),
    );

    const decisionHref = (decisionId: string) => `/workday/${roleId}/decisions#${encodeURIComponent(decisionId)}`;
    const home = `/workday/${roleId}`;

    const ctx: ClassifyContext = {
      language,
      openDecisionIds: new Set(open.map((decision) => decision.id)),
      decisionTitles: new Map(
        open.map((decision) => [
          decision.id,
          language === "de" && decision.titleDe.length > 0 ? decision.titleDe : decision.title,
        ]),
      ),
      readEventIds: readArrivalMarks(roleId, runId),
      stageLabel: index.stageLabel,
      seededDecisionId: index.seededDecisionId,
      isStageCompletionTool: (toolName) => completionTools.has(toolName),
      stageHref: (processRunId, stageId) => index.stageHref(roleId, processRunId, stageId),
      decisionHref,
      subjectHref: (_kind, subjectId) => (subjectId ? objectHref(roleId, [subjectId], scopes) : home),
      arrivalHref: (arrival) => {
        const source = sources.get(arrival.id);
        const id = source?.derivedFromId ?? null;
        if (source && id) {
          if (source.derivedFrom === "inbox") return itemHref(roleId, "inbox", id);
          if (source.derivedFrom === "meeting") return itemHref(roleId, "meetings", id);
          if (source.derivedFrom === "decision") return decisionHref(id);
        }
        /* Prepared work and the day's timeline beats are on Home. */
        return home;
      },
      happenedToday: (event) =>
        happenedToday(event.occurredAt, day) &&
        (!isClock(event.atMoment) || momentToMinutes(event.atMoment) <= momentToMinutes(atMoment)),
    };

    const deadlines = deadlineUpdates(
      getWorkActions(roleId, role?.holderUserId ?? null, runId).map((action) => ({
        id: action.id,
        title: language === "de" && action.titleDe.length > 0 ? action.titleDe : action.title,
        status: action.status,
        dueOn: action.dueOn,
        href: workHref(roleId, DEFAULT_QUERY, {
          tab: "actions",
          actionsView: action.status === "overdue" ? "overdue" : DEFAULT_QUERY.actionsView,
          item: action.id,
        }),
      })),
      state.scenarioDate,
      language,
    );

    const candidates = [...classifyBackbone(events, ctx), ...classifyArrivals(events, ctx), ...deadlines];
    /*
     * The proactive Partner's daily budget for new work from routines, kept in
     * the 0006 notification ledger (`src/features/partner/notifications.ts`):
     * a routine update the ledger held back is listed as held back, one the
     * person read is gone, one it raised can be marked read.
     */
    const ledger = applyRoutineLedger(candidates, roleId, runId);
    const { raised, heldBack } = applyBudget(ledger.candidates, NOTIFICATION_BUDGET);

    return {
      roleId,
      language,
      atMoment,
      state: raised.length > 0 ? "present" : "empty",
      raised,
      heldBack: [...heldBack, ...ledger.heldBack],
      budget: NOTIFICATION_BUDGET,
    };
  } catch (error) {
    log.warn("Updates could not be assembled.", { roleId, error });
    return empty(roleId, state, "unavailable");
  }
}
