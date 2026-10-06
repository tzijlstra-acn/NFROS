/**
 * The Work Hub's URL state.
 *
 * Everything the reader can change in the hub without writing anything lives
 * in the query string: the tab, the selected item, each module's saved view,
 * the kind filter and the object filter. Three reasons, in order of weight.
 *
 *   The selection persists across tabs because it is in the URL, and the tab
 *   links carry it. Moving from Actions to Agenda and back does not lose the
 *   action, and nothing in a client store has to agree with the server about
 *   which one it was.
 *
 *   The server renders the selected item on the first byte. A selection held
 *   only in the browser would paint the queue, then the detail, then the
 *   drawer, each a frame apart.
 *
 *   A view is a link. Saved views are therefore real: a reader can keep one,
 *   send it, or come back to it tomorrow.
 *
 * Pure and dependency free, so the same functions run in the route, in the
 * client components that build hrefs, and in the tests.
 */

import { isWorkTab, type WorkTab } from "./model";

export const AGENDA_SCOPES = ["day", "week"] as const;
export type AgendaScope = (typeof AGENDA_SCOPES)[number];

/**
 * The action views.
 *
 * `waiting-others` keeps the parameter value the earlier Work Hub used, so a
 * link someone already kept still lands on the same view.
 */
export const ACTION_VIEWS = ["needs-me", "waiting-others", "overdue", "completed"] as const;
export type ActionViewId = (typeof ACTION_VIEWS)[number];

export const MEETING_VIEWS = ["upcoming", "archive"] as const;
export type MeetingViewId = (typeof MEETING_VIEWS)[number];

/**
 * The inbox views. `needs-triage` keeps the parameter value the earlier hub
 * used for what is now labelled Needs me, so a kept link still lands there.
 */
export const INBOX_VIEWS = ["needs-triage", "converted", "handled", "all"] as const;
export type InboxViewId = (typeof INBOX_VIEWS)[number];

export interface WorkQuery {
  tab: WorkTab;
  /** The selected item identifier, of any kind. */
  item: string | null;
  scope: AgendaScope;
  actionsView: ActionViewId;
  meetingsView: MeetingViewId;
  inboxView: InboxViewId;
  /** The kind filter of the current tab. Dropped when the tab changes. */
  kind: string | null;
  /** Restricts every queue to work linked to one object. */
  object: string | null;
}

/** The query parameter names, in one place. */
export const PARAM = {
  tab: "view",
  item: "item",
  scope: "scope",
  actionsView: "filter",
  meetingsView: "mview",
  inboxView: "iview",
  kind: "kind",
  object: "object",
} as const;

export const DEFAULT_QUERY: WorkQuery = {
  tab: "agenda",
  item: null,
  scope: "day",
  actionsView: "needs-me",
  meetingsView: "upcoming",
  inboxView: "needs-triage",
  kind: null,
  object: null,
};

type RawQuery = Record<string, string | string[] | undefined>;

function first(raw: RawQuery, key: string): string | undefined {
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * An identifier as it may appear in the URL.
 *
 * Seeded and session identifiers are letters, digits, dots and hyphens. A
 * value with anything else is not an identifier this product produced, so it
 * is treated as absent rather than passed into a query.
 */
function identifier(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(trimmed) ? trimmed : null;
}

export function parseWorkQuery(raw: RawQuery | undefined): WorkQuery {
  const q = raw ?? {};
  const tab = first(q, PARAM.tab);
  return {
    tab: isWorkTab(tab) ? tab : DEFAULT_QUERY.tab,
    item: identifier(first(q, PARAM.item)),
    scope: oneOf(first(q, PARAM.scope), AGENDA_SCOPES, DEFAULT_QUERY.scope),
    actionsView: oneOf(first(q, PARAM.actionsView), ACTION_VIEWS, DEFAULT_QUERY.actionsView),
    meetingsView: oneOf(first(q, PARAM.meetingsView), MEETING_VIEWS, DEFAULT_QUERY.meetingsView),
    inboxView: oneOf(first(q, PARAM.inboxView), INBOX_VIEWS, DEFAULT_QUERY.inboxView),
    kind: identifier(first(q, PARAM.kind)),
    object: identifier(first(q, PARAM.object)),
  };
}

/**
 * Builds a hub link from the current query and a change.
 *
 * Only values that differ from the default are written, so the common links
 * stay short and `/work?view=actions` from an earlier link and the one built
 * here are the same address. Changing the tab drops the kind filter, because
 * a meeting type means nothing on the Actions tab, and keeps everything else:
 * the selection, each module's saved view and the object filter.
 */
export function workHref(roleId: string, current: WorkQuery, patch: Partial<WorkQuery> = {}): string {
  const tabChanged = patch.tab !== undefined && patch.tab !== current.tab;
  const next: WorkQuery = {
    ...current,
    ...(tabChanged ? { kind: null } : {}),
    ...patch,
  };

  const params = new URLSearchParams();
  if (next.tab !== DEFAULT_QUERY.tab) params.set(PARAM.tab, next.tab);
  if (next.scope !== DEFAULT_QUERY.scope) params.set(PARAM.scope, next.scope);
  if (next.actionsView !== DEFAULT_QUERY.actionsView) params.set(PARAM.actionsView, next.actionsView);
  if (next.meetingsView !== DEFAULT_QUERY.meetingsView) params.set(PARAM.meetingsView, next.meetingsView);
  if (next.inboxView !== DEFAULT_QUERY.inboxView) params.set(PARAM.inboxView, next.inboxView);
  if (next.kind) params.set(PARAM.kind, next.kind);
  if (next.object) params.set(PARAM.object, next.object);
  if (next.item) params.set(PARAM.item, next.item);

  const search = params.toString();
  return `/workday/${roleId}/work${search.length > 0 ? `?${search}` : ""}`;
}

/** A link that opens an item in its own tab, from anywhere in the product. */
export function itemHref(roleId: string, tab: WorkTab, itemId: string): string {
  return workHref(roleId, DEFAULT_QUERY, { tab, item: itemId });
}
