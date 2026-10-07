/**
 * Pure assembly of Home from rows.
 *
 * Nothing in this file touches the database. Each function takes the rows a
 * repository already returned, in the smallest shape the rule needs, and turns
 * them into one region of Home. That is what lets the rules that matter be
 * tested against hand built input, including the one this module exists to
 * enforce: an empty input produces an empty region, never a plausible one.
 *
 * The rules, stated once:
 *
 * - Your day counts rows. Actions are the role's desk as the Work Hub reads
 *   it, classified by the Work Hub's own `classifyAction`: an overdue or
 *   blocked action is still open, and overdue includes a due date that has
 *   passed whatever the stored status says. Inbox attention is a revealed, unread
 *   message triaged to a decision or an action that has not already been
 *   converted into work, as the message's stored conversion
 *   (`conversion_kind`) says. The next meeting follows the same rule as the role
 *   signals: the first entry on the scenario day that is not focus time and
 *   starts at or after the scenario clock.
 *
 * - A Partner update statement exists only when a row says the work
 *   happened, and only when it can link to what that work created or touched.
 *   Grouped statements (three missing items requested) link to every row in
 *   the group. A statement with no linkable reference is dropped rather than
 *   shown without one.
 *
 * - Done counts units of work. "Handled automatically" is the background work
 *   and the completed suggestions the focus queue already files as handled;
 *   "completed by you" is the decisions, process stages, actions and meetings
 *   the person completed today. A decided decision is never counted as
 *   automatic, even though the queue lists it under handled once its receipt
 *   exists, because the person made it.
 */

import type { RoleId } from "@/db/schema/core";
import { INBOX_WORK_CONVERSION_KINDS, type InboxConversionKind } from "@/db/schema/work";
import type { Language } from "@/i18n/labels";
import { firstClause, firstSentence } from "@/db/repositories/focus";
import { momentToMinutes } from "@/domain/nfr/calculators";
import { selectNextMeeting, startTimeOf } from "@/features/role-signals";
import type { FocusItemView } from "@/workday/contracts";
import { fill, HOME_COPY as C, pick, plural, type Pair } from "./copy";
import {
  actionHref,
  actionsHref,
  agendaHref,
  decisionHref,
  inboxHref,
  isLinkable,
  lineage,
  meetingHref,
  objectHref,
  outputHref,
  lineageKindOfOutput,
  stageHref,
} from "./lineage";
import type {
  DoneRow,
  DoneSummary,
  LineageRef,
  PartnerSource,
  PartnerSourceStatus,
  PartnerStatement,
  PartnerUpdate,
  YourDay,
  YourDayActions,
  YourDayInbox,
  YourDayMeeting,
} from "./types";

/** The Partner update shows three statements, as the plan's example does. The rest is one click away. */
export const PARTNER_STATEMENT_LIMIT = 3;

/** How long a statement title may run before it is cut at a word. */
const TITLE_LIMIT = 72;

function isClock(value: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(value);
}

function minutes(value: string | null | undefined): number {
  if (!value || !isClock(value)) return -1;
  return momentToMinutes(value);
}

/* ==========================================================================
   The day
   ========================================================================== */

/**
 * The working day a Home is read for.
 *
 * Two clocks are in play and both are honest. Scenario rows carry the
 * scenario clock (`07:45`) or the scenario date (`2026-10-06`). Rows written
 * live, by a person or by the engine during this session, carry the wall
 * clock, because that is when they were written. The seed time is the line
 * between the two: anything written after the day was seeded happened in this
 * working day, and seeded history is dated before it.
 */
export interface DayWindow {
  scenarioDate: string;
  seededAt: string;
  atMoment: string;
}

/** True when a recorded time falls inside the working day and not after the clock. */
export function happenedToday(value: string | null | undefined, day: DayWindow): boolean {
  if (!value) return false;
  if (isClock(value)) return momentToMinutes(value) <= momentToMinutes(day.atMoment);
  const date = value.slice(0, 10);
  if (date === day.scenarioDate) return true;
  // A date with no time, written live on the wall clock day the scenario was seeded.
  if (value.length <= 10) return date === day.seededAt.slice(0, 10);
  return value >= day.seededAt;
}

/* ==========================================================================
   Your day
   ========================================================================== */

export interface CalendarRowInput {
  id: string;
  title: string;
  titleDe: string;
  startsAt: string;
  kind: string;
  meetingId: string | null;
}

/**
 * One action on the role's desk, as the Work Hub classifies it.
 *
 * The classification is `classifyAction` from the Work Hub's actions policy,
 * applied by the read model to the row and its update history, so Home and
 * the Work Hub cannot disagree about whether an action is open, overdue or
 * blocked. Blocked is recorded in the history rather than in a status column,
 * which is why Home cannot derive it from `actions.status` alone.
 */
export interface ActionRowInput {
  id: string;
  open: boolean;
  overdue: boolean;
  blocked: boolean;
}

export interface InboxRowInput {
  id: string;
  isRead: boolean;
  proposedTriage: string;
  confirmedTriage: string | null;
  /** What the message became, as the message records it (migration 0008). */
  conversionKind: InboxConversionKind | null;
}

/** The triage outcomes that put work in front of the person. */
export const ATTENTION_TRIAGE: readonly string[] = ["decision", "action"];

/** True when the message's stored conversion is work, of any kind. */
export function isConvertedToWork(kind: InboxConversionKind | null): boolean {
  return kind !== null && INBOX_WORK_CONVERSION_KINDS.includes(kind);
}

export function assembleMeeting(
  roleId: RoleId,
  rows: readonly CalendarRowInput[] | null,
  day: DayWindow,
  language: Language,
): YourDayMeeting {
  const href = agendaHref(roleId);
  if (rows === null) {
    return { state: "unavailable", reason: "unavailable", time: null, title: null, href, lineage: null, value: pick(C.unavailable, language) };
  }
  const selection = selectNextMeeting(rows, day.atMoment, day.scenarioDate);
  if (selection.outcome !== "next") {
    const none = selection.outcome === "none-scheduled" ? C.meetingNoneScheduled : C.meetingNoneRemaining;
    return { state: "empty", reason: selection.outcome, time: null, title: null, href, lineage: null, value: pick(none, language) };
  }
  const entry = selection.entry;
  const title = language === "de" && entry.titleDe.length > 0 ? entry.titleDe : entry.title;
  const time = startTimeOf(entry.startsAt);
  const target = entry.meetingId ? meetingHref(roleId, entry.meetingId) : agendaHref(roleId, entry.id);
  return {
    state: "present",
    reason: "next",
    time,
    title,
    href: target,
    lineage: lineage(entry.meetingId ? "meeting" : "object", entry.meetingId ?? entry.id, title, target),
    value: `${time}, ${title}`,
  };
}

export function assembleActions(
  roleId: RoleId,
  rows: readonly ActionRowInput[] | null,
  language: Language,
): YourDayActions {
  const href = actionsHref(roleId);
  if (rows === null) {
    return { state: "unavailable", open: 0, overdue: 0, blocked: 0, href, value: pick(C.unavailable, language) };
  }
  const open = rows.filter((row) => row.open).length;
  const overdue = rows.filter((row) => row.open && row.overdue).length;
  const blocked = rows.filter((row) => row.open && row.blocked).length;
  if (open === 0) return { state: "empty", open, overdue, blocked, href, value: pick(C.noOpenActions, language) };
  const parts = [fill(pick(C.openCount, language), { n: open })];
  if (overdue > 0) parts.push(fill(pick(C.overdueCount, language), { n: overdue }));
  if (blocked > 0) parts.push(fill(pick(C.blockedCount, language), { n: blocked }));
  return { state: "present", open, overdue, blocked, href, value: parts.join(", ") };
}

/** The one definition of an inbox message that needs the person. */
export function needsAttention(row: InboxRowInput): boolean {
  if (row.isRead) return false;
  if (isConvertedToWork(row.conversionKind)) return false;
  return ATTENTION_TRIAGE.includes(row.confirmedTriage ?? row.proposedTriage);
}

export function assembleInbox(
  roleId: RoleId,
  rows: readonly InboxRowInput[] | null,
  language: Language,
): YourDayInbox {
  const href = inboxHref(roleId);
  if (rows === null) {
    return { state: "unavailable", needsAttention: 0, href, value: pick(C.unavailable, language) };
  }
  const count = rows.filter(needsAttention).length;
  if (count === 0) return { state: "empty", needsAttention: 0, href, value: pick(C.inboxNoneNeeded, language) };
  return {
    state: "present",
    needsAttention: count,
    href,
    value: plural(count, C.inboxNeedsOne, C.inboxNeedsMany, language),
  };
}

export function assembleYourDay(input: {
  roleId: RoleId;
  language: Language;
  day: DayWindow;
  calendar: readonly CalendarRowInput[] | null;
  actions: readonly ActionRowInput[] | null;
  inbox: readonly InboxRowInput[] | null;
}): YourDay {
  return {
    meeting: assembleMeeting(input.roleId, input.calendar, input.day, input.language),
    actions: assembleActions(input.roleId, input.actions, input.language),
    inbox: assembleInbox(input.roleId, input.inbox, input.language),
  };
}

/* ==========================================================================
   Partner update
   ========================================================================== */

export interface SuggestionInput {
  id: string;
  headline: string;
  status: string;
  atMoment: string;
  decisionId: string | null;
  objectType: string;
  objectId: string;
}

/** A backbone `ai-preparation-completed` event. */
export interface PreparationInput {
  id: string;
  summary: string;
  atMoment: string;
  processId: string | null;
  stageId: string | null;
  activityEntryId: string | null;
}

/** A backbone `routine-completed` event. */
export interface RoutineInput {
  id: string;
  summary: string;
  atMoment: string;
  subjectKind: string | null;
  subjectId: string | null;
  activityEntryId: string | null;
  /**
   * What the run produced, from `ai_routine_run_outputs` (AI Partner, Wave
   * 3): the routine lineage, each linked to where it opens.
   */
  outputs?: ReadonlyArray<{ kind: string; id: string }>;
}

export interface ReceiptInput {
  decisionId: string;
  decisionTitle: string;
  decidedAtMoment: string | null;
  lines: Array<{ id: string; objectKind: string; objectId: string; statement: string }>;
}

export interface ConversionInput {
  messageId: string;
  subject: string;
  atMoment: string;
  /** What the message became (migration 0008). Only a work kind is a conversion. */
  conversionKind: InboxConversionKind | null;
  /** Who converted it, by name, as the message records it; null when it does not. */
  convertedBy: string | null;
  /** True when the person who holds the role converted it. */
  convertedByYou: boolean;
  linkedActionId: string | null;
  linkedDecisionId: string | null;
}

export interface BackgroundInput {
  id: string;
  kind: string;
  targetKind: string;
  targetId: string;
  targetLabel: string;
  performedAtMoment: string;
}

export interface ActivityInput {
  id: string;
  kind: string;
  label: string;
  atMoment: string;
  objectType: string;
  objectId: string;
  suggestionId: string | null;
}

/**
 * Every source the Partner update reads, and what each returned.
 *
 * `null` means the source could not be read, which is a different fact from
 * an empty list and is reported as `unavailable` rather than silently skipped.
 */
export interface PartnerInputs {
  roleId: RoleId;
  language: Language;
  suggestions: SuggestionInput[] | null;
  preparations: PreparationInput[] | null;
  routines: RoutineInput[] | null;
  receipts: ReceiptInput[] | null;
  conversions: ConversionInput[] | null;
  background: BackgroundInput[] | null;
  activity: ActivityInput[] | null;
  /** The suggestion already on screen as the inline AI line, so it is not said twice. */
  shownSuggestionId: string | null;
}

/**
 * Which source comes first when two statements happened at the same moment.
 *
 * The consequences of the person's own actions first, because that is what
 * they will look for after acting; then what the partner prepared; then what
 * it followed up; then what it flagged.
 */
export const PARTNER_SOURCE_ORDER: readonly PartnerSource[] = [
  "executed",
  "conversion",
  "prepared",
  "preparation",
  "routine",
  "follow-up",
  "escalation",
  "contradiction",
  "activity",
];

/** Suggestion states that mean the partner finished preparing something. */
const PREPARED_SUGGESTION_STATUSES: readonly string[] = ["ready", "needs-user", "executing", "completed"];

/**
 * Activity kinds that are an outcome rather than a check.
 *
 * `observed`, `retrieved`, `reconciled` and `analysed` are the reading the
 * partner does on the way to an outcome. They are counted under Done as
 * handled work through the background record, and repeating them here as
 * statements would turn the update back into a feed.
 */
const OUTCOME_ACTIVITY: Record<string, Pair> = {
  drafted: C.activityDrafted,
  completed: C.activityCompleted,
  executed: C.activityExecuted,
  escalated: C.activityEscalated,
  blocked: C.activityBlocked,
  waiting: C.activityWaiting,
};

function shortTitle(text: string): string {
  return firstClause(text, TITLE_LIMIT);
}

function latestMoment(moments: Array<string | null>): string | null {
  let best: string | null = null;
  for (const moment of moments) {
    if (moment && minutes(moment) > minutes(best)) best = moment;
  }
  return best ?? moments.find((moment) => moment !== null) ?? null;
}

/**
 * Builds a statement only when it can link to something.
 *
 * References are deduplicated by kind and identifier: two receipt lines that
 * both changed the same indicator are one thing the statement points at, not
 * two.
 */
function statement(
  source: PartnerSource,
  key: string,
  text: string,
  atMoment: string | null,
  refs: LineageRef[],
): PartnerStatement | null {
  const seen = new Set<string>();
  const linkable = refs.filter(isLinkable).filter((ref) => {
    const identity = `${ref.kind}:${ref.id}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
  if (linkable.length === 0 || text.trim().length === 0) return null;
  return { id: `${source}:${key}`, source, text, atMoment, lineage: linkable };
}

function preparedStatements(input: PartnerInputs): PartnerStatement[] {
  const out: PartnerStatement[] = [];
  for (const row of input.suggestions ?? []) {
    if (row.id === input.shownSuggestionId) continue;
    if (!PREPARED_SUGGESTION_STATUSES.includes(row.status)) continue;
    const work = row.decisionId
      ? lineage("decision", row.decisionId, row.decisionId, decisionHref(input.roleId, row.decisionId))
      : lineage("object", row.objectId, row.objectId, objectHref(input.roleId, row.objectType, row.objectId));
    const record = lineage("suggestion", row.id, row.id, work.href);
    const made = statement(
      "prepared",
      row.id,
      fill(pick(C.statementPrepared, input.language), { title: shortTitle(row.headline) }),
      row.atMoment,
      [work, record],
    );
    if (made) out.push(made);
  }
  return out;
}

function preparationStatements(input: PartnerInputs): PartnerStatement[] {
  const out: PartnerStatement[] = [];
  for (const row of input.preparations ?? []) {
    const href = stageHref(input.roleId, row.processId, row.stageId);
    const made = statement(
      "preparation",
      row.id,
      shortTitle(row.summary),
      row.atMoment || null,
      [
        lineage("stage", row.stageId ?? row.id, row.stageId ?? row.id, href),
        lineage("event", row.id, row.id, href),
      ],
    );
    if (made) out.push(made);
  }
  return out;
}

function routineStatements(input: PartnerInputs): PartnerStatement[] {
  const out: PartnerStatement[] = [];
  for (const row of input.routines ?? []) {
    // A routine run with no subject has nothing to link to, so it is not stated.
    if (!row.subjectKind || !row.subjectId) continue;
    const href = objectHref(input.roleId, row.subjectKind, row.subjectId);
    // Each thing the run prepared, then the run's event: the lineage the plan asks to be visible.
    const produced = (row.outputs ?? [])
      .filter((output) => output.kind !== "suggestion")
      .map((output) => lineage(lineageKindOfOutput(output.kind), output.id, output.id, outputHref(input.roleId, output.kind, output.id) ?? href));
    const subjectRefs = produced.some((ref) => ref.id === row.subjectId) ? [] : [lineage("object", row.subjectId, row.subjectId, href)];
    const made = statement(
      "routine",
      row.id,
      fill(pick(C.statementRoutine, input.language), { title: shortTitle(row.summary) }),
      row.atMoment || null,
      [...produced, ...subjectRefs, lineage("event", row.id, row.id, href)],
    );
    if (made) out.push(made);
  }
  return out;
}

function executedStatements(input: PartnerInputs): PartnerStatement[] {
  const out: PartnerStatement[] = [];
  for (const receipt of input.receipts ?? []) {
    if (receipt.lines.length === 0) continue;
    const decision = lineage(
      "decision",
      receipt.decisionId,
      receipt.decisionId,
      decisionHref(input.roleId, receipt.decisionId),
    );
    const created = receipt.lines.map((line) =>
      lineage(
        line.objectKind === "action" ? "action" : line.objectKind === "decision" ? "decision" : "object",
        line.objectId,
        line.objectId,
        objectHref(input.roleId, line.objectKind, line.objectId),
      ),
    );
    const text = fill(
      pick(receipt.lines.length === 1 ? C.statementExecutedOne : C.statementExecutedMany, input.language),
      { n: receipt.lines.length, title: shortTitle(receipt.decisionTitle) },
    );
    const made = statement("executed", receipt.decisionId, text, receipt.decidedAtMoment, [decision, ...created]);
    if (made) out.push(made);
  }
  return out;
}

/**
 * Messages turned into work, of any kind the message records: an action, a
 * decision, evidence, a process stage input or a delegation. The statement
 * names who did it when the messages record one person for all of them, and
 * links the action or decision a message became, and the message itself,
 * whose detail shows everything it became.
 */
function conversionStatements(input: PartnerInputs): PartnerStatement[] {
  const rows = (input.conversions ?? []).filter((row) => isConvertedToWork(row.conversionKind));
  if (rows.length === 0) return [];
  const refs: LineageRef[] = [];
  for (const row of rows) {
    if (row.linkedActionId) {
      refs.push(lineage("action", row.linkedActionId, row.linkedActionId, actionHref(input.roleId, row.linkedActionId)));
    }
    if (row.linkedDecisionId) {
      refs.push(
        lineage("decision", row.linkedDecisionId, row.linkedDecisionId, decisionHref(input.roleId, row.linkedDecisionId)),
      );
    }
    refs.push(lineage("message", row.messageId, row.subject, inboxHref(input.roleId, row.messageId)));
  }
  const actors = new Set(rows.map((row) => (row.convertedByYou ? "you" : row.convertedBy)));
  const [actor] = [...actors];
  const text =
    actors.size !== 1 || actor === null || actor === undefined
      ? plural(rows.length, C.statementConversionOne, C.statementConversionMany, input.language)
      : actor === "you"
        ? plural(rows.length, C.statementConversionYouOne, C.statementConversionYouMany, input.language)
        : fill(plural(rows.length, C.statementConversionByOne, C.statementConversionByMany, input.language), { person: actor });
  const made = statement(
    "conversion",
    rows.map((row) => row.messageId).sort().join(","),
    text,
    latestMoment(rows.map((row) => row.atMoment)),
    refs,
  );
  return made ? [made] : [];
}

function groupedBackground(
  input: PartnerInputs,
  kind: string,
  source: PartnerSource,
  one: Pair,
  many: Pair,
): PartnerStatement[] {
  const rows = (input.background ?? []).filter((row) => row.kind === kind);
  if (rows.length === 0) return [];
  const seen = new Set<string>();
  const refs: LineageRef[] = [];
  for (const row of rows) {
    const key = `${row.targetKind}:${row.targetId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push(
      lineage("object", row.targetId, row.targetLabel || row.targetId, objectHref(input.roleId, row.targetKind, row.targetId)),
    );
  }
  const made = statement(
    source,
    kind,
    plural(rows.length, one, many, input.language),
    latestMoment(rows.map((row) => row.performedAtMoment)),
    refs,
  );
  return made ? [made] : [];
}

function activityStatements(input: PartnerInputs): PartnerStatement[] {
  /*
   * An activity row that a backbone event already accounts for is not said a
   * second time. The backbone stores the link for exactly this reason.
   */
  const accounted = new Set<string>();
  for (const row of [...(input.preparations ?? []), ...(input.routines ?? [])]) {
    if (row.activityEntryId) accounted.add(row.activityEntryId);
  }

  const out: PartnerStatement[] = [];
  for (const row of input.activity ?? []) {
    if (accounted.has(row.id)) continue;
    const template = OUTCOME_ACTIVITY[row.kind];
    if (!template) continue;
    const work =
      row.objectType && row.objectId
        ? lineage("object", row.objectId, row.objectId, objectHref(input.roleId, row.objectType, row.objectId))
        : null;
    if (!work) continue;
    const made = statement(
      "activity",
      row.id,
      fill(pick(template, input.language), { title: shortTitle(row.label) }),
      row.atMoment,
      [work, lineage("activity", row.id, row.id, work.href)],
    );
    if (made) out.push(made);
  }
  return out;
}

/** Most recent first, then by source order, then by identifier. */
export function orderStatements(statements: PartnerStatement[]): PartnerStatement[] {
  return [...statements].sort((a, b) => {
    const byMoment = minutes(b.atMoment) - minutes(a.atMoment);
    if (byMoment !== 0) return byMoment;
    const bySource = PARTNER_SOURCE_ORDER.indexOf(a.source) - PARTNER_SOURCE_ORDER.indexOf(b.source);
    if (bySource !== 0) return bySource;
    return a.id.localeCompare(b.id);
  });
}

function sourceStatus(
  source: PartnerSource,
  rows: unknown[] | null,
  statements: PartnerStatement[],
): PartnerSourceStatus {
  if (rows === null) return { source, state: "unavailable" };
  return { source, state: statements.some((entry) => entry.source === source) ? "present" : "empty" };
}

export function assemblePartnerUpdate(input: PartnerInputs): PartnerUpdate {
  const all = orderStatements([
    ...executedStatements(input),
    ...conversionStatements(input),
    ...preparedStatements(input),
    ...preparationStatements(input),
    ...routineStatements(input),
    ...groupedBackground(input, "item-requested", "follow-up", C.statementFollowUpOne, C.statementFollowUpMany),
    ...groupedBackground(input, "escalated-to-human", "escalation", C.statementEscalationOne, C.statementEscalationMany),
    ...groupedBackground(
      input,
      "contradiction-identified",
      "contradiction",
      C.statementContradictionOne,
      C.statementContradictionMany,
    ),
    ...activityStatements(input),
  ]);

  const sources: PartnerSourceStatus[] = [
    sourceStatus("executed", input.receipts, all),
    sourceStatus("conversion", input.conversions, all),
    sourceStatus("prepared", input.suggestions, all),
    sourceStatus("preparation", input.preparations, all),
    sourceStatus("routine", input.routines, all),
    sourceStatus("follow-up", input.background, all),
    sourceStatus("escalation", input.background, all),
    sourceStatus("contradiction", input.background, all),
    sourceStatus("activity", input.activity, all),
  ];

  /*
   * Unavailable only when nothing could be read at all. One source failing
   * while the others answer is reported per source, and the update still
   * shows what the readable sources said.
   */
  const everyUnavailable = sources.every((entry) => entry.state === "unavailable");
  return {
    state: all.length > 0 ? "present" : everyUnavailable ? "unavailable" : "empty",
    statements: all.slice(0, PARTNER_STATEMENT_LIMIT),
    more: all.slice(PARTNER_STATEMENT_LIMIT),
    sources,
  };
}

/* ==========================================================================
   Done
   ========================================================================== */

export interface DecisionDoneInput {
  id: string;
  title: string;
  status: string;
  decidedAtMoment: string | null;
}

/** A backbone `decision-recorded` event for a decision recorded inside a process stage. */
export interface StageDecisionDoneInput {
  id: string;
  summary: string;
  occurredAt: string;
  atMoment: string;
  /** Set when the event is about a row in the `decisions` table. */
  decisionId: string | null;
  decisionKey: string | null;
  correlationId: string | null;
  processId: string | null;
  stageId: string | null;
}

export interface StageDoneInput {
  id: string;
  roleAppId: string;
  stageId: string;
  stageName: string;
  status: string;
  completedAt: string | null;
}

export interface ActionDoneInput {
  id: string;
  title: string;
  status: string;
  completedOn: string | null;
}

export interface MeetingDoneInput {
  id: string;
  title: string;
  status: string;
  concludedAt: string | null;
}

export interface DoneInputs {
  roleId: RoleId;
  day: DayWindow;
  /** `queue.sections.handled`, as the focus queue assembled it. */
  handledRows: FocusItemView[];
  /** Background rows per handled kind, counted from the same rows the queue grouped. */
  backgroundCounts: Record<string, number>;
  decisions: DecisionDoneInput[] | null;
  stageDecisions: StageDecisionDoneInput[] | null;
  stages: StageDoneInput[] | null;
  actions: ActionDoneInput[] | null;
  meetings: MeetingDoneInput[] | null;
}

/** The id prefixes `focus.ts` gives handled rows that the person did not do. */
const AUTOMATIC_ROW_PREFIXES = ["focus-handled-", "focus-suggestion-"] as const;

export function isAutomaticRow(row: FocusItemView): boolean {
  return AUTOMATIC_ROW_PREFIXES.some((prefix) => row.id.startsWith(prefix));
}

/** How many units of work one automatic row stands for. */
export function automaticUnits(row: FocusItemView, backgroundCounts: Record<string, number>): number {
  if (row.id.startsWith("focus-handled-")) return backgroundCounts[row.objectId] ?? 0;
  return 1;
}

export function assembleDone(input: DoneInputs): DoneSummary {
  const { roleId, day } = input;

  const automaticRows = input.handledRows.filter(isAutomaticRow);
  const automatic = automaticRows.reduce((sum, row) => sum + automaticUnits(row, input.backgroundCounts), 0);

  const byYouRows: DoneRow[] = [];
  const seen = new Set<string>();
  const push = (key: string, row: DoneRow) => {
    if (seen.has(key)) return;
    seen.add(key);
    byYouRows.push(row);
  };

  for (const row of input.decisions ?? []) {
    if (row.status !== "decided" || !happenedToday(row.decidedAtMoment, day)) continue;
    const href = decisionHref(roleId, row.id);
    push(`decision:${row.id}`, {
      id: `done-decision-${row.id}`,
      kind: "decision",
      title: row.title,
      at: row.decidedAtMoment,
      lineage: lineage("decision", row.id, row.id, href),
    });
  }

  for (const row of input.stageDecisions ?? []) {
    if (!happenedToday(row.occurredAt, day)) continue;
    if (row.decisionId) {
      // The same decision recorded through a stage: one decision, counted once.
      const href = decisionHref(roleId, row.decisionId);
      push(`decision:${row.decisionId}`, {
        id: `done-decision-${row.decisionId}`,
        kind: "decision",
        title: row.decisionId,
        at: row.atMoment || null,
        lineage: lineage("decision", row.decisionId, row.decisionId, href),
      });
      continue;
    }
    const href = stageHref(roleId, row.processId, row.stageId);
    push(`stage-decision:${row.correlationId ?? row.id}:${row.decisionKey ?? row.id}`, {
      id: `done-stage-decision-${row.id}`,
      kind: "stage-decision",
      title: shortTitle(row.summary),
      at: row.atMoment || null,
      lineage: lineage("stage", row.stageId ?? row.id, row.stageId ?? row.id, href),
    });
  }

  for (const row of input.stages ?? []) {
    if (row.status !== "completed" || !happenedToday(row.completedAt, day)) continue;
    const href = stageHref(roleId, row.roleAppId, row.stageId);
    push(`stage:${row.id}`, {
      id: `done-stage-${row.id}`,
      kind: "stage",
      title: row.stageName,
      at: row.completedAt,
      lineage: lineage("stage", row.stageId, row.stageName, href),
    });
  }

  for (const row of input.actions ?? []) {
    if (row.status !== "completed" || !happenedToday(row.completedOn, day)) continue;
    const href = actionHref(roleId, row.id);
    push(`action:${row.id}`, {
      id: `done-action-${row.id}`,
      kind: "action",
      title: row.title,
      at: row.completedOn,
      lineage: lineage("action", row.id, row.id, href),
    });
  }

  for (const row of input.meetings ?? []) {
    if (row.status !== "concluded" || !happenedToday(row.concludedAt, day)) continue;
    const href = meetingHref(roleId, row.id);
    push(`meeting:${row.id}`, {
      id: `done-meeting-${row.id}`,
      kind: "meeting",
      title: row.title,
      at: row.concludedAt,
      lineage: lineage("meeting", row.id, row.title, href),
    });
  }

  const byYou = byYouRows.length;
  const total = automatic + byYou;
  return {
    state: total > 0 ? "present" : "empty",
    total,
    automatic,
    byYou,
    automaticRows,
    byYouRows,
  };
}

/**
 * "5 handled automatically, 2 completed by you".
 *
 * When only one category has work the line names the category without
 * repeating the number, because the total already sits beside the label and
 * "Done today 63, 63 handled automatically" says the same number twice.
 */
export function doneSummaryLine(done: Pick<DoneSummary, "automatic" | "byYou">, language: Language): string {
  if (done.automatic > 0 && done.byYou > 0) {
    return `${plural(done.automatic, C.doneAutomaticOne, C.doneAutomaticMany, language)}, ${plural(
      done.byYou,
      C.doneByYouOne,
      C.doneByYouMany,
      language,
    )}`;
  }
  if (done.automatic > 0) return pick(C.doneAllAutomatic, language);
  if (done.byYou > 0) return pick(C.doneAllByYou, language);
  return "";
}

/** The label for a Done row of work the person completed. */
export function doneKindLabel(kind: DoneRow["kind"], language: Language): string {
  switch (kind) {
    case "decision":
    case "stage-decision":
      return pick(C.doneDecisionRecorded, language);
    case "stage":
      return pick(C.doneStageCompleted, language);
    case "action":
      return pick(C.doneActionCompleted, language);
    case "meeting":
      return pick(C.doneMeetingConcluded, language);
  }
}

/* ==========================================================================
   Now: what changed
   ========================================================================== */

export interface WhatChangedSources {
  /** The suggestion behind the item, or the one that prepared its decision. */
  suggestion: { id: string; changeSummary: string } | null;
  /** The live event that brought the item. */
  event: { id: string; summary: string } | null;
  /** The background action that escalated or flagged it. */
  background: { id: string; description: string } | null;
}

/**
 * What changed, for one item, from the first source that records it.
 *
 * The suggestion's change summary is the most specific record of a change
 * and is preferred. The event summary is next, then the background
 * description. When none of them exists the answer is null and the card
 * leaves the line out, because inventing a change is the one thing it must
 * not do.
 */
export function whatChangedFrom(
  item: FocusItemView,
  sources: WhatChangedSources,
): { text: string; source: LineageRef } | null {
  const candidates: Array<{ text: string; source: LineageRef } | null> = [
    sources.suggestion && sources.suggestion.changeSummary.trim().length > 0
      ? {
          text: firstSentence(sources.suggestion.changeSummary, 180),
          source: lineage("suggestion", sources.suggestion.id, sources.suggestion.id, item.href),
        }
      : null,
    sources.event && sources.event.summary.trim().length > 0
      ? {
          text: firstSentence(sources.event.summary, 180),
          source: lineage("event", sources.event.id, sources.event.id, item.href),
        }
      : null,
    sources.background && sources.background.description.trim().length > 0
      ? {
          text: firstSentence(sources.background.description, 180),
          source: lineage("background-action", sources.background.id, sources.background.id, item.href),
        }
      : null,
  ];
  return candidates.find((candidate) => candidate !== null && candidate.text.length > 0) ?? null;
}
