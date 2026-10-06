/**
 * The Work Hub module interface, and the four modules that implement it.
 *
 * Server only, because each module's `loadExtras` reads the database. The
 * read models the modules are built from are pure and live beside them, and
 * the unit tests import those directly.
 *
 * The contract is deliberately small, and it is the seam the next
 * workstreams build on. A module:
 *
 *   loads what it needs beyond the shared hub data (`loadExtras`);
 *   builds its left pane from the shared data, its extras and the URL
 *   (`buildQueue`): saved views, filters, groups of rows, an honest empty
 *   state, any proposals;
 *   resolves an identifier to its detail when the identifier is one of its
 *   items, and returns null otherwise (`resolve`);
 *   says what number belongs on its tab (`tabCount`);
 *   names the registry tools it can run, so the hub asks the gate about them
 *   once (`toolNames`).
 *
 * The shell never looks inside a module's extras or its detail beyond
 * `DetailBase`. A module can therefore grow a full lifecycle, as Meetings and
 * Inbox will, by changing its own read model, its own detail component and
 * its own operations, without the shell or the other modules changing.
 */

import type { DetailBase, ModuleQueueView, WorkTab } from "../model";
import type { WorkSharedData } from "../shared";
import type { WorkQuery } from "../url";
import { loadActionsExtras } from "./actions/load";
import {
  actionToolNames,
  buildActionsView,
  countActions,
  resolveActionDetail,
  type ActionDetail,
  type ActionsExtras,
} from "./actions/read-model";
import { loadAgendaExtras } from "./agenda/load";
import {
  AGENDA_TOOLS,
  buildAgendaView,
  countAgenda,
  resolveAgendaDetail,
  type AgendaDetail,
  type AgendaExtras,
} from "./agenda/read-model";
import { loadInboxExtras } from "./inbox/load";
import { buildInboxView, countInbox, resolveInboxDetail, type InboxDetail, type InboxExtras } from "./inbox/read-model";
import { INBOX_TOOLS } from "./inbox/tool-names";
import { loadMeetingsExtras } from "./meetings/load";
import {
  buildMeetingsView,
  countMeetings,
  resolveMeetingDetail,
  type MeetingDetail,
  type MeetingsExtras,
} from "./meetings/read-model";
import { MEETING_TOOLS } from "./meetings/tool-names";

export interface WorkModule<TExtras, TDetail extends DetailBase> {
  tab: WorkTab;
  toolNames: readonly string[];
  loadExtras(shared: WorkSharedData, query: WorkQuery): TExtras;
  buildQueue(shared: WorkSharedData, extras: TExtras, query: WorkQuery): ModuleQueueView;
  resolve(itemId: string, shared: WorkSharedData, extras: TExtras, query: WorkQuery): TDetail | null;
  tabCount(shared: WorkSharedData, extras: TExtras): number;
}

export type WorkDetail = AgendaDetail | MeetingDetail | ActionDetail | InboxDetail;

export const AGENDA_MODULE: WorkModule<AgendaExtras, AgendaDetail> = {
  tab: "agenda",
  toolNames: AGENDA_TOOLS,
  loadExtras: loadAgendaExtras,
  buildQueue: buildAgendaView,
  resolve: resolveAgendaDetail,
  tabCount: (shared, extras) => countAgenda(shared, extras).today,
};

export const MEETINGS_MODULE: WorkModule<MeetingsExtras, MeetingDetail> = {
  tab: "meetings",
  toolNames: MEETING_TOOLS,
  loadExtras: loadMeetingsExtras,
  buildQueue: buildMeetingsView,
  resolve: resolveMeetingDetail,
  tabCount: (shared) => countMeetings(shared).upcoming,
};

export const ACTIONS_MODULE: WorkModule<ActionsExtras, ActionDetail> = {
  tab: "actions",
  toolNames: actionToolNames(),
  loadExtras: loadActionsExtras,
  buildQueue: buildActionsView,
  resolve: resolveActionDetail,
  tabCount: (shared, extras) => countActions(shared, extras).needsMe,
};

export const INBOX_MODULE: WorkModule<InboxExtras, InboxDetail> = {
  tab: "inbox",
  toolNames: INBOX_TOOLS,
  loadExtras: loadInboxExtras,
  buildQueue: buildInboxView,
  resolve: resolveInboxDetail,
  tabCount: (shared, extras) => countInbox(shared, extras).triage,
};
