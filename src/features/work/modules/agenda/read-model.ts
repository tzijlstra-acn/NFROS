/**
 * The Agenda module read model.
 *
 * Pure: the calendar, the meetings behind it, the packs' evidence and the
 * open actions in; Day and Week views, conflicts, preparation and the
 * selected entry's detail out.
 *
 * Everything shown comes from a row, and nothing replaces an empty calendar.
 * The earlier hub put four role specific entries on screen whenever the
 * calendar query returned nothing, which meant a reader could never tell
 * whether the 10:30 workshop was their day or the product's decoration.
 *
 * Four derivations are worth naming, because each replaces something that
 * used to be a seeded flag or a static label:
 *
 *   Conflict is computed from the times. Two entries conflict when one starts
 *   before the other ends. The seeded `hasConflict` agrees for the seeded day,
 *   and a session change to a time would be caught where a flag would not.
 *
 *   Preparation is current. The recorded status is the calendar's own field,
 *   and the pack's state is read from each document in it at request time, so
 *   a source that went stale this morning shows as needing attention now.
 *
 *   A process deadline depends on a meeting when there is open work with a
 *   due date on the object the meeting is about. That is a structured link
 *   (`actions.related_object_id` against `meetings.subject_id`), stated in
 *   the interface, not a guess about which meetings matter.
 *
 *   A completed meeting changes its downstream work. Recording it as held
 *   writes a follow-up entry to each dependent action (see the
 *   `recordMeetingHeld` handler), the entry's next action becomes the follow
 *   up, and the Meetings archive and Home pick it up from the same rows.
 */

import type { Language } from "@/i18n/labels";
import type { WorkAuditRow, WorkEvidenceRow } from "@/db/repositories/work-hub";
import { AUTHORITY_LABELS } from "@/features/decisions/copy";
import { COPY, KIND_LABELS, WEEKDAYS, fill, say } from "../../copy";
import { sourceFreshness } from "../../freshness";
import {
  addDays,
  dateOf,
  displayDate,
  firstLine,
  minutesOf,
  timeOf,
  weekStart,
  type ActivityEntry,
  type AuditRef,
  type DetailBase,
  type DetailFact,
  type ModuleQueueView,
  type ProposalView,
  type QueueGroup,
  type QueueNote,
  type QueueRowView,
  type RelatedLink,
  type Tone,
  type WorkChip,
} from "../../model";
import {
  actionLink,
  auditLink,
  compactLinks,
  decisionLink,
  evidenceLink,
  meetingLink,
  objectLink,
  processLink,
} from "../../related";
import { subjectAiContext } from "../../selection";
import {
  actionTitle,
  decisionTitle,
  matchesObject,
  meetingTitle,
  objectKindLabel,
  objectName,
  personName,
  type CalendarRow,
  type MeetingRow,
  type WorkSharedData,
} from "../../shared";
import { itemHref, workHref, type WorkQuery } from "../../url";
import {
  dependentActions,
  meetingDecisions,
  meetingPack,
  meetingProcess,
  meetingTypeLabel,
  type PackState,
} from "../meeting-facts";
import { AGENDA_COPY } from "./copy";

/* ==========================================================================
   Inputs
   ========================================================================== */

export interface AgendaExtras {
  /** Every document named in a meeting pack of the role. */
  packEvidence: ReadonlyMap<string, WorkEvidenceRow>;
  /** Audit events on the selected entry's meeting. */
  audit: ReadonlyMap<string, WorkAuditRow[]>;
}

export const EMPTY_AGENDA_EXTRAS: AgendaExtras = { packEvidence: new Map(), audit: new Map() };

/** The registry tools this module asks the gate about. */
export const AGENDA_TOOLS = ["prepareChallengeQuestions", "recordMeetingHeld"] as const;

/* ==========================================================================
   Conflicts
   ========================================================================== */

export interface TimedEntry {
  id: string;
  date: string;
  start: string;
  end: string;
  /** Completed entries no longer conflict with anything: the time has been spent. */
  completed: boolean;
}

export interface Conflict {
  withId: string;
  minutes: number;
}

/**
 * Overlaps between entries on the same day.
 *
 * Symmetric: if A conflicts with B then B conflicts with A, with the same
 * overlap. Touching entries (one ends at 11:00, the next starts at 11:00) do
 * not conflict.
 */
export function detectConflicts(entries: readonly TimedEntry[]): Map<string, Conflict[]> {
  const found = new Map<string, Conflict[]>();
  const active = entries.filter((entry) => !entry.completed);
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i];
      const b = active[j];
      if (!a || !b || a.date !== b.date) continue;
      const overlap = Math.min(minutesOf(a.end), minutesOf(b.end)) - Math.max(minutesOf(a.start), minutesOf(b.start));
      if (overlap <= 0) continue;
      found.set(a.id, [...(found.get(a.id) ?? []), { withId: b.id, minutes: overlap }]);
      found.set(b.id, [...(found.get(b.id) ?? []), { withId: a.id, minutes: overlap }]);
    }
  }
  return found;
}

/* ==========================================================================
   One entry
   ========================================================================== */

export type EventStatus = "upcoming" | "in-progress" | "ended" | "completed";

export interface AgendaEntry {
  row: CalendarRow;
  meeting: MeetingRow | null;
  date: string;
  start: string;
  end: string;
  status: EventStatus;
  pack: PackState;
  conflicts: Conflict[];
}

function statusOf(
  row: CalendarRow,
  meeting: MeetingRow | null,
  scenarioDate: string,
  currentMoment: string,
): EventStatus {
  if (meeting?.status === "concluded" || row.preparationStatus === "completed") return "completed";
  const date = dateOf(row.startsAt);
  if (date < scenarioDate) return "ended";
  if (date > scenarioDate) return "upcoming";
  const now = minutesOf(currentMoment);
  if (now >= minutesOf(timeOf(row.endsAt))) return "ended";
  if (now >= minutesOf(timeOf(row.startsAt))) return "in-progress";
  return "upcoming";
}

export function agendaEntries(shared: WorkSharedData, extras: AgendaExtras): AgendaEntry[] {
  const meetingsById = new Map(shared.meetings.map((meeting) => [meeting.id, meeting]));
  const base = [...shared.calendar]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .map((row) => {
      const meeting = row.meetingId ? (meetingsById.get(row.meetingId) ?? null) : null;
      return {
        row,
        meeting,
        date: dateOf(row.startsAt),
        start: timeOf(row.startsAt),
        end: timeOf(row.endsAt),
        status: statusOf(row, meeting, shared.scenarioDate, shared.currentMoment),
        pack: meetingPack(meeting, extras.packEvidence, shared.language),
      };
    });

  const conflicts = detectConflicts(
    base.map((entry) => ({
      id: entry.row.id,
      date: entry.date,
      start: entry.start,
      end: entry.end,
      completed: entry.status === "completed",
    })),
  );

  return base.map((entry) => ({ ...entry, conflicts: conflicts.get(entry.row.id) ?? [] }));
}

function kindName(shared: WorkSharedData, kind: string): string {
  const label = shared.config.agendaLabels[kind];
  return label ? say(label, shared.language) : kind;
}

function entryTitle(row: CalendarRow, language: Language): string {
  return language === "de" && row.titleDe.length > 0 ? row.titleDe : row.title;
}

function recordedPrepChip(entry: AgendaEntry, language: Language): WorkChip {
  if (entry.status === "completed") return { label: say(AGENDA_COPY.prepCompleted, language), tone: "success" };
  if (entry.row.kind === "focus-time" && !entry.meeting) return { label: say(AGENDA_COPY.prepNotNeeded, language), tone: "neutral" };
  switch (entry.row.preparationStatus) {
    case "ready":
      return { label: say(AGENDA_COPY.prepReady, language), tone: "success" };
    case "in-progress":
      return { label: say(AGENDA_COPY.prepStarted, language), tone: "info" };
    default:
      return { label: say(AGENDA_COPY.prepNotStarted, language), tone: "warning" };
  }
}

function packLabel(pack: PackState, language: Language): string {
  if (pack.state === "none") return say(AGENDA_COPY.packNone, language);
  if (pack.state === "ready") return fill(say(AGENDA_COPY.packReady, language), { current: pack.current, total: pack.total });
  return fill(say(AGENDA_COPY.packIssues, language), { issues: pack.issues.length, total: pack.total });
}

function statusChip(status: EventStatus, language: Language): WorkChip {
  switch (status) {
    case "completed":
      return { label: say(AGENDA_COPY.completed, language), tone: "success" };
    case "in-progress":
      return { label: say(AGENDA_COPY.inProgress, language), tone: "accent" };
    case "ended":
      return { label: say(AGENDA_COPY.ended, language), tone: "warning" };
    case "upcoming":
      return { label: say(AGENDA_COPY.upcoming, language), tone: "neutral" };
  }
}

/** Whether the meeting behind an entry still has preparation outstanding. */
function unprepared(entry: AgendaEntry): boolean {
  return (
    entry.meeting !== null &&
    entry.status === "upcoming" &&
    entry.row.preparationStatus !== "ready" &&
    entry.row.preparationStatus !== "completed"
  );
}

/* ==========================================================================
   The queue
   ========================================================================== */

function rowFor(shared: WorkSharedData, entry: AgendaEntry, query: WorkQuery, titles: Map<string, string>): QueueRowView {
  const { language } = shared;
  const chips: WorkChip[] = [];
  if (entry.meeting) chips.push({ label: meetingTypeLabel(entry.meeting.kind, shared), tone: "neutral" });
  else chips.push({ label: kindName(shared, entry.row.kind), tone: "neutral" });
  /* A focus block has nothing to prepare, and its kind chip already says what it is. */
  if (entry.meeting || entry.row.kind !== "focus-time" || entry.status === "completed") {
    chips.push(recordedPrepChip(entry, language));
  }
  if (entry.pack.state === "issues" && entry.status !== "completed") {
    chips.push({ label: packLabel(entry.pack, language), tone: "warning" });
  }
  const conflict = entry.conflicts[0];
  if (conflict) {
    chips.push({
      label: say(AGENDA_COPY.conflict, language),
      tone: "danger",
      title: fill(say(AGENDA_COPY.conflictWith, language), {
        title: titles.get(conflict.withId) ?? conflict.withId,
        minutes: conflict.minutes,
      }),
    });
  }

  return {
    id: entry.row.id,
    kind: "event",
    lead: entry.start,
    title: entryTitle(entry.row, language),
    sub: [`${language === "de" ? "bis" : "to"} ${entry.end}`, entry.row.location]
      .filter((part) => part.length > 0)
      .join(", "),
    chips,
    trailing: statusChip(entry.status, language).label,
    trailingTone: statusChip(entry.status, language).tone,
    href: workHref(shared.roleId, query, { item: entry.row.id }),
    selected: query.item === entry.row.id,
    flag: conflict ? "danger" : entry.status === "ended" ? "warning" : null,
  };
}

/** Open actions due on a date, as quiet notes under that day. */
function deadlineNotes(shared: WorkSharedData, date: string, query: WorkQuery): QueueNote[] {
  return shared.actions
    .filter(
      (action) =>
        action.dueOn === date &&
        action.status !== "completed" &&
        action.status !== "cancelled" &&
        matchesObject(query.object, action.id, action.relatedObjectId),
    )
    .map((action) => ({
      id: action.id,
      text: fill(say(AGENDA_COPY.dueNote, shared.language), { title: `${action.reference} ${firstLine(actionTitle(action, shared.language), 80)}` }),
      tone: "warning" as Tone,
      href: itemHref(shared.roleId, "actions", action.id),
    }));
}

function dayLabel(date: string, scenarioDate: string, language: Language): string {
  const weekday = WEEKDAYS[(new Date(`${date}T00:00:00.000Z`).getUTCDay() + 6) % 7];
  const day = weekday ? say(weekday, language) : "";
  return date === scenarioDate
    ? fill(say(AGENDA_COPY.today, language), { day, date: displayDate(date) })
    : fill(say(AGENDA_COPY.dayLabel, language), { day, date: displayDate(date) });
}

export function countAgenda(shared: WorkSharedData, extras: AgendaExtras): { today: number; conflicts: number; unprepared: number } {
  const entries = agendaEntries(shared, extras).filter((entry) => entry.date === shared.scenarioDate);
  return {
    today: entries.length,
    conflicts: entries.filter((entry) => entry.conflicts.length > 0).length,
    unprepared: entries.filter(unprepared).length,
  };
}

export function buildAgendaView(shared: WorkSharedData, extras: AgendaExtras, query: WorkQuery): ModuleQueueView {
  const { language, roleId } = shared;
  const all = agendaEntries(shared, extras);
  const titles = new Map(all.map((entry) => [entry.row.id, entryTitle(entry.row, language)]));
  const filtered = all.filter((entry) =>
    matchesObject(query.object, entry.row.id, entry.meeting?.id, entry.meeting?.subjectId),
  );
  const kinds = [...new Set(filtered.map((entry) => entry.row.kind))].sort();
  const shown = query.kind ? filtered.filter((entry) => entry.row.kind === query.kind) : filtered;

  const days =
    query.scope === "week"
      ? Array.from({ length: 7 }, (_, index) => addDays(weekStart(shared.scenarioDate), index))
      : [shared.scenarioDate];

  const groups: QueueGroup[] = days.map((date) => ({
    id: date,
    label: dayLabel(date, shared.scenarioDate, language),
    rows: shown.filter((entry) => entry.date === date).map((entry) => rowFor(shared, entry, query, titles)),
    emptyText: say(AGENDA_COPY.noEntriesDay, language),
    notes: deadlineNotes(shared, date, query),
  }));

  const counts = countAgenda(shared, extras);

  return {
    tab: "agenda",
    savedViews: [
      { id: "day", label: say(AGENDA_COPY.day, language), count: null, href: workHref(roleId, query, { scope: "day" }), active: query.scope === "day" },
      { id: "week", label: say(AGENDA_COPY.week, language), count: null, href: workHref(roleId, query, { scope: "week" }), active: query.scope === "week" },
    ],
    filters:
      kinds.length > 1
        ? [
            { id: "all", label: say(COPY.allKinds, language), count: filtered.length, href: workHref(roleId, query, { kind: null }), active: query.kind === null },
            ...kinds.map((kind) => ({
              id: kind,
              label: kindName(shared, kind),
              count: filtered.filter((entry) => entry.row.kind === kind).length,
              href: workHref(roleId, query, { kind }),
              active: query.kind === kind,
            })),
          ]
        : [],
    objectFilter: query.object
      ? { id: query.object, label: objectName(shared, query.object), clearHref: workHref(roleId, query, { object: null }) }
      : null,
    groups: shared.calendar.length === 0 ? [] : groups,
    empty:
      shared.calendar.length === 0
        ? { title: say(AGENDA_COPY.emptyTitle, language), body: say(AGENDA_COPY.emptyBody, language) }
        : null,
    proposals: query.object ? [] : agendaProposals(shared, all, query),
    summary: fill(say(AGENDA_COPY.summary, language), counts),
  };
}

/* ==========================================================================
   Proposals
   ========================================================================== */

/**
 * The two AI behaviours the plan names for the agenda, as proposals.
 *
 * Prepare the next meeting: the next upcoming entry with a meeting pack whose
 * preparation is not recorded as done. Its authority is the gate's verdict on
 * `prepareChallengeQuestions`, which is the drafting tool that prepares a
 * meeting, and acting on it opens the prepared pack, which writes nothing.
 *
 * Reserve focus time: a free slot of at least thirty minutes before that
 * meeting. There is no calendar write in this release, so the proposal says
 * so rather than offering a button that would do nothing.
 */
export function agendaProposals(shared: WorkSharedData, entries: readonly AgendaEntry[], query: WorkQuery): ProposalView[] {
  const { language, roleId } = shared;
  const today = entries.filter((entry) => entry.date === shared.scenarioDate);
  const next = today.find((entry) => unprepared(entry) && entry.pack.state !== "none");
  if (!next || !next.meeting) return [];

  const proposals: ProposalView[] = [];
  const title = meetingTitle(next.meeting, language);
  const prepareGate = shared.gate["prepareChallengeQuestions"];
  proposals.push({
    id: `prepare-${next.row.id}`,
    title: fill(say(AGENDA_COPY.proposePrepareTitle, language), { title: firstLine(title, 60), time: next.start }),
    body: fill(say(AGENDA_COPY.proposePrepareBody, language), {
      docs: next.pack.total,
      questions: next.pack.questions,
      stale: next.pack.issues.length > 0 ? fill(say(AGENDA_COPY.proposeStale, language), { count: next.pack.issues.length }) : "",
      prep: recordedPrepChip(next, language).label.toLowerCase(),
    }),
    authorityLabel: prepareGate ? say(AUTHORITY_LABELS[prepareGate.authorityClass], language) : "",
    available: prepareGate?.reachable ?? false,
    unavailableReason: prepareGate?.reachable ? "" : (prepareGate?.reason ?? ""),
    decide: say(AGENDA_COPY.proposePrepareDecide, language),
    href: workHref(roleId, query, { tab: "meetings", item: next.meeting.id }),
    hrefLabel: say(shared.config.professionalActions.prepareMeeting, language),
  });

  const slot = freeSlotBefore(today, next, shared.currentMoment);
  if (slot) {
    proposals.push({
      id: `focus-${next.row.id}`,
      title: fill(say(AGENDA_COPY.proposeFocusTitle, language), slot),
      body: fill(say(AGENDA_COPY.proposeFocusBody, language), {
        reason: fill(say(shared.config.professionalActions.reserveFocus, language), { title: firstLine(title, 60) }),
        time: next.start,
      }),
      authorityLabel: say(AUTHORITY_LABELS.PROPOSE, language),
      available: false,
      unavailableReason: say(AGENDA_COPY.proposeFocusUnavailable, language),
      decide: say(AGENDA_COPY.proposeFocusDecide, language),
      href: null,
      hrefLabel: say(AGENDA_COPY.notConnected, language),
    });
  }
  return proposals;
}

/** The latest free thirty minutes before a meeting, from now or 08:00, whichever is later. */
export function freeSlotBefore(
  entries: readonly Pick<AgendaEntry, "start" | "end" | "row">[],
  target: Pick<AgendaEntry, "start" | "row">,
  currentMoment: string,
): { start: string; end: string } | null {
  const earliest = Math.max(minutesOf(currentMoment), 8 * 60);
  const busy = entries
    .filter((entry) => entry.row.id !== target.row.id && minutesOf(entry.start) < minutesOf(target.start))
    .map((entry) => ({ start: minutesOf(entry.start), end: minutesOf(entry.end) }));

  /*
   * Walk backwards from the meeting. Each candidate is the thirty minutes
   * ending at `end`; if anything on the agenda overlaps it, the next
   * candidate ends where that entry starts.
   */
  let end = minutesOf(target.start);
  for (let guard = 0; guard <= busy.length; guard += 1) {
    const start = end - 30;
    if (start < earliest) return null;
    const blocking = busy.find((entry) => entry.start < end && entry.end > start);
    if (!blocking) {
      const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      return { start: fmt(start), end: fmt(end) };
    }
    end = blocking.start;
  }
  return null;
}

/* ==========================================================================
   The detail
   ========================================================================== */

export interface AgendaDetail extends DetailBase {
  kind: "event";
  time: { date: string; start: string; end: string; label: string };
  eventStatus: WorkChip;
  kindName: string;
  meeting: { id: string; reference: string; typeLabel: string; href: string } | null;
  prep: { recorded: WorkChip; pack: PackState; packLabel: string };
  required: string[];
  conflicts: Array<{ id: string; title: string; minutes: number; href: string; text: string }>;
  process: { link: RelatedLink; stage: string | null; note: string } | null;
  dependents: Array<{ id: string; title: string; due: string; href: string; overdue: boolean }>;
  dependencyNote: string;
  nextAction: { label: string; href: string | null };
  outcome: string | null;
  recordHeld: {
    enabled: boolean;
    reason: string;
    meetingId: string | null;
    dependentIds: string[];
    approval: string;
  };
}

export function resolveAgendaDetail(
  itemId: string,
  shared: WorkSharedData,
  extras: AgendaExtras,
  query: WorkQuery,
): AgendaDetail | null {
  const entries = agendaEntries(shared, extras);
  const entry = entries.find((candidate) => candidate.row.id === itemId);
  if (!entry) return null;

  const { language, roleId } = shared;
  const meeting = entry.meeting;
  const title = entryTitle(entry.row, language);
  const titles = new Map(entries.map((candidate) => [candidate.row.id, entryTitle(candidate.row, language)]));

  const process = meetingProcess(meeting, shared);
  const dependents = dependentActions(meeting, shared);
  const decisions = meetingDecisions(meeting, shared);
  const subjectId = meeting?.subjectId ?? null;
  const subjectKind = objectKindLabel(shared, meeting?.subjectKind);

  const conflicts = entry.conflicts.map((conflict) => ({
    id: conflict.withId,
    title: titles.get(conflict.withId) ?? conflict.withId,
    minutes: conflict.minutes,
    href: workHref(roleId, query, { item: conflict.withId }),
    text: fill(say(AGENDA_COPY.conflictWith, language), {
      title: titles.get(conflict.withId) ?? conflict.withId,
      minutes: conflict.minutes,
    }),
  }));

  /* Required preparation, from the pack and the conflicts. */
  const required: string[] = [];
  if (entry.status === "completed") required.push(say(AGENDA_COPY.reqDone, language));
  else if (entry.pack.state === "none") required.push(say(AGENDA_COPY.reqNone, language));
  else {
    required.push(fill(say(AGENDA_COPY.reqReadPack, language), { count: entry.pack.total }));
    if (entry.pack.questions > 0) required.push(fill(say(AGENDA_COPY.reqQuestions, language), { count: entry.pack.questions }));
    for (const issue of entry.pack.issues) {
      required.push(fill(say(AGENDA_COPY.reqStale, language), { id: issue.id, status: issue.stale ? say(COPY.stale, language) : issue.status }));
    }
  }
  if (conflicts.length > 0 && entry.status !== "completed") required.push(say(AGENDA_COPY.reqConflict, language));

  /* The next action, in priority order. */
  const meetingHref = meeting ? workHref(roleId, query, { tab: "meetings", item: meeting.id }) : null;
  const firstConflict = conflicts[0];
  let nextAction: { label: string; href: string | null };
  if (entry.status === "completed") {
    nextAction =
      dependents.length > 0
        ? { label: fill(say(AGENDA_COPY.nextFollowUp, language), { count: dependents.length }), href: itemHref(roleId, "actions", dependents[0]?.id ?? "") }
        : { label: say(AGENDA_COPY.nextReviewOutcome, language), href: meetingHref };
  } else if (entry.status === "ended" && meeting) {
    nextAction = { label: say(AGENDA_COPY.nextRecord, language), href: null };
  } else if (entry.status === "in-progress" && meeting) {
    nextAction = { label: say(AGENDA_COPY.nextJoin, language), href: meetingHref };
  } else if (firstConflict) {
    nextAction = { label: fill(say(AGENDA_COPY.nextResolveConflict, language), { title: firstLine(firstConflict.title, 60) }), href: firstConflict.href };
  } else if (meeting && entry.pack.state !== "none") {
    nextAction = { label: fill(say(AGENDA_COPY.nextPrepare, language), { time: entry.start }), href: meetingHref };
  } else {
    nextAction = { label: fill(say(AGENDA_COPY.nextFocus, language), { agenda: firstLine(entry.row.agenda, 90) }), href: null };
  }

  /* Record as held: only an entry with a meeting, once it has started. */
  const recordGate = shared.gate["recordMeetingHeld"];
  let recordReason = "";
  if (!meeting) recordReason = say(AGENDA_COPY.recordHeldNoMeeting, language);
  else if (entry.status === "completed") recordReason = say(AGENDA_COPY.recordHeldDone, language);
  else if (entry.status === "upcoming") recordReason = fill(say(AGENDA_COPY.recordHeldNotYet, language), { time: entry.start });
  else if (!recordGate) recordReason = say({ en: "Not registered with the authority gate.", de: "Bei der Befugnispruefung nicht registriert." }, language);
  else if (!recordGate.reachable) recordReason = recordGate.reason;

  const audit: AuditRef[] = (meeting ? (extras.audit.get(meeting.id) ?? []) : []).map((row) => ({
    id: row.id,
    at: row.atMoment,
    summary: row.summary,
    actor: personName(shared, row.actorUserId) ?? row.actorKind,
    blocked: row.blocked,
  }));

  const evidence = entry.pack.docs;
  const processView = process
    ? {
        link: processLink(process.scope, language, process.stageId),
        stage: process.stageId ? say(process.scope.stageNames[process.stageId] ?? { en: process.stageId, de: process.stageId }, language) : null,
        note: fill(say(AGENDA_COPY.inScope, language), { object: subjectId ?? "" }),
      }
    : null;

  const related = compactLinks([
    processView?.link,
    ...decisions.map((decision) => decisionLink(roleId, decision.id, decisionTitle(decision, language), say(COPY.relatedDecision, language))),
    meeting ? meetingLink(roleId, meeting.id, meetingTitle(meeting, language), say(COPY.relatedMeeting, language)) : null,
    ...dependents.map((action) => actionLink(roleId, action.id, actionTitle(action, language), say(COPY.relatedAction, language))),
    subjectId ? objectLink(roleId, subjectId, objectName(shared, subjectId), subjectKind, language, "agenda") : null,
    evidenceLink(evidence.length, language),
    auditLink(audit.length, language),
  ]);

  const activity: ActivityEntry[] = [];
  if (meeting?.status === "concluded" && meeting.outcome.length > 0) {
    activity.push({
      id: `${meeting.id}-outcome`,
      at: meeting.concludedAt ? `${displayDate(meeting.concludedAt)} ${timeOf(meeting.concludedAt)}` : "",
      actor: shared.holderName,
      text: meeting.outcome,
      tone: "success",
      evidenceIds: [],
      label: say(AGENDA_COPY.outcome, language),
    });
  }

  const attendees = entry.row.attendeeUserIds.map((id) => personName(shared, id) ?? id);
  const timeLabel = `${displayDate(entry.date)}, ${entry.start} ${language === "de" ? "bis" : "to"} ${entry.end}`;
  const facts: DetailFact[] = [
    { label: say(COPY.factWhen, language), value: timeLabel },
    ...(entry.row.location ? [{ label: say(COPY.factWhere, language), value: entry.row.location }] : []),
    { label: say(COPY.factParticipants, language), value: attendees.join(", ") },
    ...(meeting ? [{ label: say(COPY.factReference, language), value: meeting.reference, mono: true }] : []),
  ];

  return {
    kind: "event",
    id: entry.row.id,
    reference: meeting?.reference ?? entry.row.id,
    title,
    kindLabel: say(KIND_LABELS.event, language),
    homeTab: "agenda",
    homeHref: workHref(roleId, query, { tab: "agenda", item: entry.row.id }),
    status: statusChip(entry.status, language),
    facts,
    context: entry.row.agenda,
    evidence,
    related,
    activity,
    audit,
    freshness: sourceFreshness(evidence, language),
    ai: subjectAiContext(meeting?.subjectKind, subjectId, title, say(KIND_LABELS.event, language), language),

    time: { date: entry.date, start: entry.start, end: entry.end, label: timeLabel },
    eventStatus: statusChip(entry.status, language),
    kindName: meeting ? meetingTypeLabel(meeting.kind, shared) : kindName(shared, entry.row.kind),
    meeting: meeting
      ? { id: meeting.id, reference: meeting.reference, typeLabel: meetingTypeLabel(meeting.kind, shared), href: meetingHref ?? "" }
      : null,
    prep: { recorded: recordedPrepChip(entry, language), pack: entry.pack, packLabel: packLabel(entry.pack, language) },
    required,
    conflicts,
    process: processView,
    dependents: dependents.map((action) => ({
      id: action.id,
      title: actionTitle(action, language),
      due: action.dueOn ? displayDate(action.dueOn) : "",
      href: itemHref(roleId, "actions", action.id),
      overdue: action.status === "overdue" || (action.dueOn !== null && action.dueOn < shared.scenarioDate),
    })),
    dependencyNote:
      dependents.length > 0
        ? fill(say(AGENDA_COPY.dependsNote, language), { object: subjectId ?? "" })
        : say(AGENDA_COPY.dependsNone, language),
    nextAction,
    outcome: meeting?.status === "concluded" ? meeting.outcome : null,
    recordHeld: {
      enabled: recordReason.length === 0,
      reason: recordReason,
      meetingId: meeting?.id ?? null,
      dependentIds: dependents.map((action) => action.id),
      approval: recordGate?.needsApproval
        ? say({ en: "Recorded as your approval, bound to exactly this outcome and these follow-ups.", de: "Als Ihre Genehmigung erfasst, gebunden an genau dieses Ergebnis und diese Folgeeintraege." }, language)
        : say({ en: "Audited in your name.", de: "In Ihrem Namen protokolliert." }, language),
    },
  };
}
