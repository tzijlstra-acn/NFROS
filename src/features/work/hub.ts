/**
 * WorkHub: assembles one request's Work Hub.
 *
 * Server only. The route calls `buildWorkHub` and renders what it returns;
 * nothing about the domain is decided in the route. The steps:
 *
 *   1. Load the shared data once (`hub-data.ts`) and each module's extras.
 *   2. Build the active tab's left pane, and every tab's count.
 *   3. Resolve the selected item against the modules in tab order. The first
 *      module that recognises the identifier builds its detail, whichever tab
 *      is showing, which is what makes the selection persist across tabs.
 *   4. Project the detail into the bound context the drawer and the AI
 *      Partner read.
 *
 * The context line is counted from the same rows the tabs show. The earlier
 * hub carried a fixed sentence per role here ("Q4 cycle in progress"), which
 * stayed on screen whatever the data said.
 */

import type { RoleId } from "@/db/schema/core";
import type { RouteQuery } from "@/workday/dispatch";
import { COPY, TAB_LABELS, fill, say } from "./copy";
import { loadWorkShared } from "./hub-data";
import { toBoundContext, WORK_TABS, type BoundWorkContext, type ModuleQueueView, type WorkTab } from "./model";
import {
  ACTIONS_MODULE,
  AGENDA_MODULE,
  INBOX_MODULE,
  MEETINGS_MODULE,
  type WorkDetail,
} from "./modules";
import { countActions } from "./modules/actions/read-model";
import { countAgenda } from "./modules/agenda/read-model";
import { countInbox } from "./modules/inbox/read-model";
import { resolveSelected } from "./selection";
import { parseWorkQuery, workHref, type WorkQuery } from "./url";

export interface WorkTabView {
  tab: WorkTab;
  label: string;
  count: number;
  href: string;
  active: boolean;
}

export interface WorkHubView {
  roleId: RoleId;
  language: "en" | "de";
  /** ISO date of the scenario day, the earliest date a due date can move to. */
  scenarioDate: string;
  pageTitle: string;
  contextLine: string;
  tabs: WorkTabView[];
  query: WorkQuery;
  queue: ModuleQueueView;
  detail: WorkDetail | null;
  bound: BoundWorkContext | null;
  /** Set when the selected item belongs to another tab than the one showing. */
  selectedElsewhere: { tabLabel: string; href: string } | null;
  /** The current view without a selection. */
  closeHref: string;
}

const CONTEXT_LINE = {
  en: "Agenda today: {entries}, in conflict: {conflicts}. Actions needing you: {needsMe}, overdue: {overdue}. Messages to triage: {triage}.",
  de: "Agenda heute: {entries}, im Konflikt: {conflicts}. Massnahmen fuer Sie: {needsMe}, ueberfaellig: {overdue}. Zu sichtende Nachrichten: {triage}.",
} as const;

export function buildWorkHub(roleId: RoleId, rawQuery: RouteQuery | undefined): WorkHubView | null {
  const shared = loadWorkShared(roleId);
  if (!shared) return null;

  const query = parseWorkQuery(rawQuery);
  const { language } = shared;

  const extras = {
    agenda: AGENDA_MODULE.loadExtras(shared, query),
    meetings: MEETINGS_MODULE.loadExtras(shared, query),
    actions: ACTIONS_MODULE.loadExtras(shared, query),
    inbox: INBOX_MODULE.loadExtras(shared, query),
  };

  const queue: ModuleQueueView =
    query.tab === "agenda"
      ? AGENDA_MODULE.buildQueue(shared, extras.agenda, query)
      : query.tab === "meetings"
        ? MEETINGS_MODULE.buildQueue(shared, extras.meetings, query)
        : query.tab === "actions"
          ? ACTIONS_MODULE.buildQueue(shared, extras.actions, query)
          : INBOX_MODULE.buildQueue(shared, extras.inbox, query);

  const counts: Record<WorkTab, number> = {
    agenda: AGENDA_MODULE.tabCount(shared, extras.agenda),
    meetings: MEETINGS_MODULE.tabCount(shared, extras.meetings),
    actions: ACTIONS_MODULE.tabCount(shared, extras.actions),
    inbox: INBOX_MODULE.tabCount(shared, extras.inbox),
  };

  const detail = resolveSelected<WorkDetail>(query.item, [
    (id) => AGENDA_MODULE.resolve(id, shared, extras.agenda, query),
    (id) => MEETINGS_MODULE.resolve(id, shared, extras.meetings, query),
    (id) => ACTIONS_MODULE.resolve(id, shared, extras.actions, query),
    (id) => INBOX_MODULE.resolve(id, shared, extras.inbox, query),
  ]);

  const tabs: WorkTabView[] = WORK_TABS.map((tab) => ({
    tab,
    label: say(TAB_LABELS[tab], language),
    count: counts[tab],
    href: workHref(roleId, query, { tab }),
    active: tab === query.tab,
  }));

  const agenda = countAgenda(shared, extras.agenda);
  const actions = countActions(shared, extras.actions);
  const inbox = countInbox(shared, extras.inbox);

  return {
    roleId,
    language,
    scenarioDate: shared.scenarioDate,
    pageTitle: say(COPY.pageTitle, language),
    contextLine: fill(say(CONTEXT_LINE, language), {
      entries: agenda.today,
      conflicts: agenda.conflicts,
      needsMe: actions.needsMe,
      overdue: actions.overdue,
      triage: inbox.triage,
    }),
    tabs,
    query,
    queue,
    detail,
    bound: detail ? toBoundContext(roleId, detail) : null,
    selectedElsewhere:
      detail && detail.homeTab !== query.tab
        ? { tabLabel: say(TAB_LABELS[detail.homeTab], language), href: detail.homeHref }
        : null,
    closeHref: workHref(roleId, query, { item: null }),
  };
}
