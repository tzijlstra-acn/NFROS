/**
 * The Meetings module read model.
 *
 * Pure. The behaviour is the earlier hub's, moved into the shell: upcoming
 * meetings and a minutes archive, each row opening its detail. What changed
 * is what changed everywhere in the hub. The static upcoming list and the
 * static archive are gone, so an empty archive says it is empty; the archive
 * now also lists the minutes records the database already held, which the
 * earlier hub never read; and a selected meeting shows its pack, its
 * questions and its links to the rest of the work.
 *
 * The meeting lifecycle (before, during and after, with minutes that are
 * captured, drafted, edited and confirmed into records) is built on this
 * file's interface. `MeetingsExtras.lifecycle` holds what the loader read for
 * the selected meeting, and `MeetingDetail.lifecycle` is the view
 * `lifecycle.ts` builds from it. The archive lists a meeting's own minutes
 * on the meeting's row, so a held meeting and its minutes are one entry, and
 * lists separately only minutes whose meeting is not in the role's list.
 */

import type { Language } from "@/i18n/labels";
import type { WorkAuditRow, WorkEvidenceRow, WorkMinutesRow } from "@/db/repositories/work-hub";
import { COPY, KIND_LABELS, fill, say } from "../../copy";
import { evidenceRef, sourceFreshness } from "../../freshness";
import {
  dateOf,
  displayDate,
  timeOf,
  type ActivityEntry,
  type AuditRef,
  type DetailBase,
  type DetailFact,
  type ModuleQueueView,
  type QueueRowView,
  type RelatedLink,
  type WorkChip,
} from "../../model";
import {
  actionLink,
  auditLink,
  compactLinks,
  decisionLink,
  evidenceLink,
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
  type MeetingRow,
  type WorkSharedData,
} from "../../shared";
import { itemHref, MEETING_VIEWS, workHref, type WorkQuery } from "../../url";
import {
  dependentActions,
  meetingDecisions,
  meetingPack,
  meetingProcess,
  meetingTypeLabel,
  type PackState,
} from "../meeting-facts";
import { MEETINGS_COPY } from "./copy";
import { buildLifecycleView, meetingClock, meetingEnd, type MeetingLifecycleData, type MeetingLifecycleView } from "./lifecycle";

export interface MeetingsExtras {
  packEvidence: ReadonlyMap<string, WorkEvidenceRow>;
  audit: ReadonlyMap<string, WorkAuditRow[]>;
  /** The lifecycle of the selected meeting, loaded for that meeting only. */
  lifecycle: MeetingLifecycleData | null;
}

export const EMPTY_MEETINGS_EXTRAS: MeetingsExtras = { packEvidence: new Map(), audit: new Map(), lifecycle: null };

export interface MeetingDetail extends DetailBase {
  kind: "meeting";
  /** A meeting row, or a minutes record whose meeting is not in the list. */
  variant: "meeting" | "minutes";
  typeLabel: string;
  when: string;
  participants: string[];
  objective: string;
  pack: PackState;
  questions: string[];
  outcome: string | null;
  minutes: {
    id: string;
    title: string;
    status: WorkChip;
    summary: string;
    facts: string[];
    unresolved: string[];
  } | null;
  process: { link: RelatedLink; stage: string | null } | null;
  dependents: Array<{ id: string; title: string; due: string; href: string }>;
  /** The agenda entry for this meeting, when the calendar has one. */
  agendaEntryHref: string | null;
  /** Before, during and after the meeting. Null for minutes whose meeting is not in the list. */
  lifecycle: MeetingLifecycleView | null;
}

/**
 * A meeting's status. Held is what the row records; in progress is what the
 * scenario clock says between the start and the end of the agenda entry, so
 * a workshop at 11:45 does not read as not started because nobody has yet
 * recorded it as held. After the end and before it is recorded, it is
 * awaiting its record.
 */
function statusChip(meeting: MeetingRow, language: Language, shared?: Pick<WorkSharedData, "calendar" | "scenarioDate" | "currentMoment">): WorkChip {
  if (meeting.status === "concluded") return { label: say(MEETINGS_COPY.held, language), tone: "success" };
  if (meeting.status === "in-progress") return { label: say(MEETINGS_COPY.inProgress, language), tone: "accent" };
  if (shared) {
    const endsAt = shared.calendar.find((entry) => entry.meetingId === meeting.id)?.endsAt ?? null;
    const clock = meetingClock(meeting, shared.scenarioDate, shared.currentMoment, meetingEnd(meeting, endsAt, []));
    if (clock.phase === "during") return { label: say(MEETINGS_COPY.inProgress, language), tone: "accent" };
    if (clock.phase === "after") return { label: say(MEETINGS_COPY.awaitingRecord, language), tone: "warning" };
  }
  return { label: say(MEETINGS_COPY.notStarted, language), tone: "neutral" };
}

function minutesChip(minutes: WorkMinutesRow, language: Language): WorkChip {
  switch (minutes.status) {
    case "confirmed":
      return { label: say(MEETINGS_COPY.minutesConfirmed, language), tone: "success" };
    case "distributed":
      return { label: say(MEETINGS_COPY.minutesDistributed, language), tone: "success" };
    case "awaiting-confirmation":
      return { label: say(MEETINGS_COPY.minutesAwaiting, language), tone: "warning" };
    default:
      return { label: say(MEETINGS_COPY.minutesDraft, language), tone: "neutral" };
  }
}

function packChip(pack: PackState, language: Language): WorkChip {
  if (pack.state === "none") return { label: say({ en: "No pack", de: "Kein Paket" }, language), tone: "neutral" };
  if (pack.state === "ready") return { label: say({ en: "Pack current", de: "Paket aktuell" }, language), tone: "success" };
  return {
    label: fill(say({ en: "Sources needing attention: {count}", de: "Quellen mit Handlungsbedarf: {count}" }, language), { count: pack.issues.length }),
    tone: "warning",
  };
}

export function countMeetings(shared: WorkSharedData): { upcoming: number; held: number; minutes: number } {
  return {
    upcoming: shared.meetings.filter((meeting) => meeting.status !== "concluded").length,
    held: shared.meetings.filter((meeting) => meeting.status === "concluded").length,
    minutes: shared.minutes.length,
  };
}

export function buildMeetingsView(shared: WorkSharedData, extras: MeetingsExtras, query: WorkQuery): ModuleQueueView {
  const { language, roleId } = shared;
  const meetings = [...shared.meetings]
    .filter((meeting) => matchesObject(query.object, meeting.id, meeting.subjectId))
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor) || a.id.localeCompare(b.id));

  const upcoming = meetings.filter((meeting) => meeting.status !== "concluded");
  const held = meetings.filter((meeting) => meeting.status === "concluded");
  /* A meeting's own minutes are shown on its row; only minutes of meetings not in the list stand alone. */
  const listed = new Set(shared.meetings.map((meeting) => meeting.id));
  const minutes = query.object === null ? shared.minutes.filter((entry) => !listed.has(entry.meetingId)) : [];
  const minutesOf = (meetingId: string) => {
    const rows = shared.minutes.filter((entry) => entry.meetingId === meetingId);
    return rows.length > 0 ? (rows[rows.length - 1] ?? null) : null;
  };

  const pool = query.meetingsView === "upcoming" ? upcoming : held;
  const kinds = [...new Set(pool.map((meeting) => meeting.kind))].sort();
  const shownMeetings = query.kind ? pool.filter((meeting) => meeting.kind === query.kind) : pool;

  const meetingRow = (meeting: MeetingRow): QueueRowView => {
    const pack = meetingPack(meeting, extras.packEvidence, language);
    const status = statusChip(meeting, language, shared);
    const own = minutesOf(meeting.id);
    return {
      id: meeting.id,
      kind: "meeting",
      lead: meeting.status === "concluded" ? displayDate(dateOf(meeting.scheduledFor)) : timeOf(meeting.scheduledFor),
      title: meetingTitle(meeting, language),
      sub: [meetingTypeLabel(meeting.kind, shared), fill(say(MEETINGS_COPY.participants, language), { count: meeting.participantUserIds.length })].join(", "),
      chips: [...(meeting.status === "concluded" ? [] : [packChip(pack, language)]), ...(own ? [minutesChip(own, language)] : [])],
      trailing: status.label,
      trailingTone: status.tone,
      href: workHref(roleId, query, { item: meeting.id }),
      selected: query.item === meeting.id,
      flag: pack.state === "issues" && meeting.status !== "concluded" ? "warning" : null,
    };
  };

  const minutesRow = (entry: WorkMinutesRow): QueueRowView => {
    const chip = minutesChip(entry, language);
    return {
      id: entry.id,
      kind: "meeting",
      lead: displayDate(dateOf(entry.createdAt)),
      title: entry.title,
      sub: say(MEETINGS_COPY.minutesKind, language),
      chips: [],
      trailing: chip.label,
      trailingTone: chip.tone,
      href: workHref(roleId, query, { item: entry.id }),
      selected: query.item === entry.id,
      flag: null,
    };
  };

  const groups =
    query.meetingsView === "upcoming"
      ? [
          {
            id: "upcoming",
            label: say(MEETINGS_COPY.upcoming, language),
            rows: shownMeetings.map(meetingRow),
            emptyText: say(MEETINGS_COPY.noUpcoming, language),
          },
        ]
      : [
          {
            id: "archive",
            label: say(MEETINGS_COPY.archive, language),
            rows: [...shownMeetings.map(meetingRow), ...(query.kind ? [] : minutes.map(minutesRow))],
            emptyText: say(MEETINGS_COPY.noArchive, language),
          },
        ];

  const nothingAtAll = shared.meetings.length === 0 && shared.minutes.length === 0;
  const counts = countMeetings(shared);

  return {
    tab: "meetings",
    savedViews: MEETING_VIEWS.map((id) => ({
      id,
      label: say(id === "upcoming" ? MEETINGS_COPY.upcoming : MEETINGS_COPY.archive, language),
      count: id === "upcoming" ? upcoming.length : held.length + minutes.length,
      href: workHref(roleId, query, { meetingsView: id, kind: null }),
      active: query.meetingsView === id,
    })),
    filters:
      kinds.length > 1
        ? [
            { id: "all", label: say(COPY.allKinds, language), count: pool.length, href: workHref(roleId, query, { kind: null }), active: query.kind === null },
            ...kinds.map((kind) => ({
              id: kind,
              label: meetingTypeLabel(kind, shared),
              count: pool.filter((meeting) => meeting.kind === kind).length,
              href: workHref(roleId, query, { kind }),
              active: query.kind === kind,
            })),
          ]
        : [],
    objectFilter: query.object
      ? { id: query.object, label: objectName(shared, query.object), clearHref: workHref(roleId, query, { object: null }) }
      : null,
    groups: nothingAtAll ? [] : groups,
    empty: nothingAtAll ? { title: say(MEETINGS_COPY.emptyTitle, language), body: say(MEETINGS_COPY.emptyBody, language) } : null,
    proposals: [],
    summary: fill(say(MEETINGS_COPY.summary, language), counts),
  };
}

/* ==========================================================================
   The detail
   ========================================================================== */

function minutesView(entry: WorkMinutesRow, language: Language): NonNullable<MeetingDetail["minutes"]> {
  return {
    id: entry.id,
    title: entry.title,
    status: minutesChip(entry, language),
    summary: entry.summary,
    facts: entry.factItems,
    unresolved: entry.unresolvedItems,
  };
}

export function resolveMeetingDetail(
  itemId: string,
  shared: WorkSharedData,
  extras: MeetingsExtras,
  query: WorkQuery,
): MeetingDetail | null {
  const { language, roleId } = shared;
  /*
   * A minutes identifier whose meeting is in the list opens the meeting, with
   * those minutes; search and the Actions detail link to minutes that way.
   */
  const selectedMinutes = shared.minutes.find((entry) => entry.id === itemId) ?? null;
  const meeting =
    shared.meetings.find((candidate) => candidate.id === itemId) ??
    (selectedMinutes ? (shared.meetings.find((candidate) => candidate.id === selectedMinutes.meetingId) ?? null) : null);
  const minutesRecord =
    shared.minutes.find((entry) => entry.id === itemId) ??
    (meeting ? ([...shared.minutes].reverse().find((entry) => entry.meetingId === meeting.id) ?? null) : null);
  if (!meeting && !minutesRecord) return null;

  /* A minutes record selected on its own, whose meeting is not in the list. */
  if (!meeting && minutesRecord) {
    const actionIds = minutesRecord.actionIds.filter((id) => shared.actions.some((action) => action.id === id));
    const decisionIds = minutesRecord.decisionIds.filter((id) => shared.decisions.some((decision) => decision.id === id));
    const chip = minutesChip(minutesRecord, language);
    const related = compactLinks([
      ...decisionIds.map((id) => {
        const decision = shared.decisions.find((candidate) => candidate.id === id);
        return decision ? decisionLink(roleId, id, decisionTitle(decision, language)) : null;
      }),
      ...actionIds.map((id) => {
        const action = shared.actions.find((candidate) => candidate.id === id);
        return action ? actionLink(roleId, id, actionTitle(action, language)) : null;
      }),
    ]);
    const facts: DetailFact[] = [
      { label: say(COPY.factReference, language), value: minutesRecord.id, mono: true },
      { label: say(COPY.factWhen, language), value: displayDate(dateOf(minutesRecord.createdAt)) },
      { label: say(COPY.factParticipants, language), value: minutesRecord.participantUserIds.map((id) => personName(shared, id) ?? id).join(", ") },
    ];
    return {
      kind: "meeting",
      variant: "minutes",
      id: minutesRecord.id,
      reference: minutesRecord.id,
      title: minutesRecord.title,
      kindLabel: say(MEETINGS_COPY.minutesKind, language),
      homeTab: "meetings",
      homeHref: workHref(roleId, query, { tab: "meetings", meetingsView: "archive", item: minutesRecord.id }),
      status: chip,
      facts,
      context: minutesRecord.summary,
      evidence: [],
      related,
      activity: [],
      audit: [],
      freshness: sourceFreshness([], language),
      ai: subjectAiContext(null, null, minutesRecord.title, say(MEETINGS_COPY.minutesKind, language), language),
      typeLabel: say(MEETINGS_COPY.minutesKind, language),
      when: displayDate(dateOf(minutesRecord.createdAt)),
      participants: minutesRecord.participantUserIds.map((id) => personName(shared, id) ?? id),
      objective: "",
      pack: { state: "none", total: 0, current: 0, issues: [], docs: [], questions: 0, summary: "" },
      questions: [],
      outcome: null,
      minutes: minutesView(minutesRecord, language),
      process: null,
      dependents: [],
      agendaEntryHref: null,
      lifecycle: null,
    };
  }

  if (!meeting) return null;

  const title = meetingTitle(meeting, language);
  const pack = meetingPack(meeting, extras.packEvidence, language);
  const process = meetingProcess(meeting, shared);
  const dependents = dependentActions(meeting, shared);
  const decisions = meetingDecisions(meeting, shared);
  const agendaEntry = shared.calendar.find((row) => row.meetingId === meeting.id) ?? null;
  const subjectKind = objectKindLabel(shared, meeting.subjectKind);
  const audit: AuditRef[] = (extras.audit.get(meeting.id) ?? []).map((row) => ({
    id: row.id,
    at: row.atMoment,
    summary: row.summary,
    actor: personName(shared, row.actorUserId) ?? row.actorKind,
    blocked: row.blocked,
  }));

  const processView = process
    ? {
        link: processLink(process.scope, language, process.stageId),
        stage: process.stageId ? say(process.scope.stageNames[process.stageId] ?? { en: process.stageId, de: process.stageId }, language) : null,
      }
    : null;

  const related = compactLinks([
    processView?.link,
    ...decisions.map((decision) => decisionLink(roleId, decision.id, decisionTitle(decision, language), say(COPY.relatedDecision, language))),
    ...dependents.map((action) => actionLink(roleId, action.id, actionTitle(action, language), say(COPY.relatedAction, language))),
    meeting.subjectId ? objectLink(roleId, meeting.subjectId, objectName(shared, meeting.subjectId), subjectKind, language, "meetings") : null,
    evidenceLink(pack.docs.length, language),
    auditLink(audit.length, language),
  ]);

  const activity: ActivityEntry[] = [];
  if (meeting.status === "concluded" && meeting.outcome.length > 0) {
    /* The recorded author and scenario time, where the row holds them (migration 0005). */
    const heldAt = meeting.heldAt ?? meeting.concludedAt;
    activity.push({
      id: `${meeting.id}-outcome`,
      at: heldAt ? `${displayDate(heldAt)} ${timeOf(heldAt)}` : "",
      actor: personName(shared, meeting.heldByUserId) ?? shared.holderName,
      text: meeting.outcome,
      tone: "success",
      evidenceIds: [],
      label: say(MEETINGS_COPY.outcome, language),
    });
  }

  const participants = meeting.participantUserIds.map((id) => personName(shared, id) ?? id);
  const when = `${displayDate(dateOf(meeting.scheduledFor))}, ${timeOf(meeting.scheduledFor)}`;
  const lifecycle =
    extras.lifecycle && extras.lifecycle.meetingId === meeting.id
      ? buildLifecycleView({
          shared,
          meeting,
          data: extras.lifecycle,
          pack,
          typeLabel: meetingTypeLabel(meeting.kind, shared),
          openDecisions: decisions,
        })
      : null;
  /* Once confirmed, the minutes are evidence of the meeting too. */
  const minutesDoc =
    minutesRecord?.evidenceDocumentId && extras.lifecycle
      ? extras.lifecycle.evidence.get(minutesRecord.evidenceDocumentId)
      : undefined;
  const evidence = minutesDoc
    ? [evidenceRef(minutesDoc, say(MEETINGS_COPY.minutesKind, language), language), ...pack.docs.filter((doc) => doc.id !== minutesDoc.id)]
    : pack.docs;

  return {
    kind: "meeting",
    variant: "meeting",
    id: meeting.id,
    reference: meeting.reference,
    title,
    kindLabel: say(KIND_LABELS.meeting, language),
    homeTab: "meetings",
    homeHref: workHref(roleId, query, {
      tab: "meetings",
      meetingsView: meeting.status === "concluded" ? "archive" : "upcoming",
      item: meeting.id,
    }),
    status: statusChip(meeting, language, shared),
    facts: [
      { label: say(COPY.factWhen, language), value: when },
      { label: say({ en: "Type", de: "Art" }, language), value: meetingTypeLabel(meeting.kind, shared) },
      { label: say(COPY.factParticipants, language), value: participants.join(", ") },
      { label: say(COPY.factReference, language), value: meeting.reference, mono: true },
    ],
    context: meeting.objective,
    evidence,
    related,
    activity,
    audit,
    freshness: sourceFreshness(evidence, language),
    ai: subjectAiContext(meeting.subjectKind, meeting.subjectId, title, say(KIND_LABELS.meeting, language), language),
    typeLabel: meetingTypeLabel(meeting.kind, shared),
    when,
    participants,
    objective: meeting.objective,
    pack,
    questions: meeting.preparedQuestions,
    outcome: meeting.status === "concluded" ? meeting.outcome : null,
    minutes: minutesRecord ? minutesView(minutesRecord, language) : null,
    process: processView,
    dependents: dependents.map((action) => ({
      id: action.id,
      title: actionTitle(action, language),
      due: action.dueOn ? displayDate(action.dueOn) : "",
      href: itemHref(roleId, "actions", action.id),
    })),
    agendaEntryHref: agendaEntry ? workHref(roleId, query, { tab: "agenda", item: agendaEntry.id }) : null,
    lifecycle,
  };
}
