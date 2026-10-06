/**
 * The meeting lifecycle, as a view: before, during and after the meeting.
 *
 * Pure. The loader (`load.ts`) reads what one selected meeting needs: its
 * conversation record, the documents the record and the pack name, the
 * contradictions on record, the preparation the AI layer produced, the
 * working minutes and the state of the process stage it serves. This file
 * turns that into what the detail shows, and it decides nothing about
 * authority: whether an operation is offered is the gate's verdict, read from
 * the shared hub data, plus the facts the gate cannot see (the meeting has
 * not started, the minutes are already confirmed).
 *
 * The phase follows the scenario clock. Before the start the reader prepares;
 * between start and end the conversation appears as far as it has been
 * spoken, and statements can be captured into the minutes draft; after the
 * end, or once the meeting is recorded as held, the minutes are drafted,
 * edited and confirmed. Every phase stays readable whichever one is current,
 * because a reader preparing at 07:45 should still see what the after phase
 * will ask of them.
 */

import type { Language } from "@/i18n/labels";
import type { WorkEvidenceRow, WorkMinutesRow } from "@/db/repositories/work-hub";
import type { DistributionMessageRow, MeetingTurnRow, RecordedContradiction } from "@/db/repositories/meetings";
import { AUTHORITY_LABELS } from "@/features/decisions/copy";
import { fill, say, type Pair } from "../../copy";
import { evidenceRef } from "../../freshness";
import { addDays, dateOf, displayDate, minutesOf, timeOf, type EvidenceRef, type Tone, type WorkChip } from "../../model";
import { actionTitle, decisionTitle, personName, type MeetingRow, type WorkSharedData } from "../../shared";
import { itemHref } from "../../url";
import type { PackState } from "../meeting-facts";
import {
  MINUTES_DRAFT_SCHEMA_VERSION,
  minutesDraftSchema,
  validateMinutesDraft,
  type MeetingPreparationOutput,
  type MinutesDecisionOutcome,
  type MinutesDraft,
  type MinutesItemKind,
  type MinutesValidationContext,
} from "./ai-schema";
import { firstSentences, mentionedIds, mentionedPeople } from "./compose";
import { LIFECYCLE_COPY as L } from "./copy";

/* ==========================================================================
   What the loader provides
   ========================================================================== */

export interface PreparationResult {
  output: MeetingPreparationOutput | null;
  mode: "safe" | "offline" | "unavailable";
  note: Pair;
}

/** The process stage a meeting serves, read through the process engine's public API. */
export interface StageSnapshot {
  processRunId: string;
  stageId: string;
  stageName: Pair;
  state: "open" | "not-open" | "completed";
  stageRunId: string | null;
  currentStageName: Pair | null;
  /** The completion criteria the stage contract states, by label. */
  criteria: Pair[];
}

export interface MeetingLifecycleData {
  meetingId: string;
  /** Every recorded turn, in speaking order. The clock decides which are shown. */
  turns: MeetingTurnRow[];
  /** Every document the pack, a turn, a contradiction or the minutes names, as the corpus holds it. */
  evidence: ReadonlyMap<string, WorkEvidenceRow>;
  contradictions: RecordedContradiction[];
  preparation: PreparationResult;
  /** The working minutes of the meeting, or null when none exist yet. */
  minutes: WorkMinutesRow | null;
  distribution: DistributionMessageRow | null;
  stage: StageSnapshot | null;
  /** The agenda entry's end time, when the calendar has one. */
  endsAt: string | null;
}

/* ==========================================================================
   The phase and the clock
   ========================================================================== */

export type MeetingPhase = "before" | "during" | "after";

export interface MeetingClock {
  phase: MeetingPhase;
  started: boolean;
  /** "10:30" */
  start: string;
  end: string;
  /** The scenario moment, as a full ISO time on the scenario day. */
  nowIso: string;
}

/** The end of a meeting: its agenda entry, else its last recorded turn, else an hour after it starts. */
export function meetingEnd(meeting: Pick<MeetingRow, "scheduledFor">, endsAt: string | null, turns: readonly MeetingTurnRow[]): string {
  if (endsAt) return timeOf(endsAt);
  const last = turns.length > 0 ? turns[turns.length - 1] : undefined;
  if (last) return last.atMoment;
  const start = minutesOf(timeOf(meeting.scheduledFor)) + 60;
  return `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
}

export function meetingClock(
  meeting: Pick<MeetingRow, "scheduledFor" | "status">,
  scenarioDate: string,
  currentMoment: string,
  end: string,
): MeetingClock {
  const day = dateOf(meeting.scheduledFor);
  const start = timeOf(meeting.scheduledFor);
  const now = minutesOf(currentMoment);
  const nowIso = `${scenarioDate}T${currentMoment}:00.000Z`;
  if (meeting.status === "concluded" || day < scenarioDate) return { phase: "after", started: true, start, end, nowIso };
  if (day > scenarioDate || now < minutesOf(start)) return { phase: "before", started: false, start, end, nowIso };
  if (now < minutesOf(end)) return { phase: "during", started: true, start, end, nowIso };
  return { phase: "after", started: true, start, end, nowIso };
}

/** The turns spoken by the current moment. A meeting on another day is all or nothing. */
export function heardTurns(
  meeting: Pick<MeetingRow, "scheduledFor" | "status">,
  turns: readonly MeetingTurnRow[],
  scenarioDate: string,
  currentMoment: string,
): MeetingTurnRow[] {
  const day = dateOf(meeting.scheduledFor);
  if (meeting.status === "concluded" || day < scenarioDate) return [...turns];
  if (day > scenarioDate) return [];
  const now = minutesOf(currentMoment);
  return turns.filter((turn) => minutesOf(turn.atMoment) <= now);
}

/* ==========================================================================
   The working draft
   ========================================================================== */

/**
 * The draft a minutes row holds.
 *
 * A row written by the lifecycle holds a structured draft and it is read as
 * it is. A row written before drafts were structured (the archive's older
 * records) is read from its flat columns, so it can still be shown, edited
 * and confirmed; nothing in it is invented on the way.
 */
export function draftOfMinutes(row: WorkMinutesRow, language: Language): MinutesDraft {
  const parsed = row.draft ? minutesDraftSchema.safeParse(row.draft) : null;
  if (parsed?.success) return parsed.data;
  const origin = row.preparedBy === "ai" ? ("ai" as const) : ("person" as const);
  return {
    schemaVersion: MINUTES_DRAFT_SCHEMA_VERSION,
    language,
    summary: row.summary,
    facts: row.factItems.map((text, index) => ({ key: `F-${String(index + 1).padStart(2, "0")}`, text, evidenceIds: [], turnIds: [], origin })),
    decisions: row.decisionIds.map((decisionId, index) => ({
      key: `D-${String(index + 1).padStart(2, "0")}`,
      text: decisionId,
      decisionId,
      outcome: "referred" as const,
      turnIds: [],
      origin,
    })),
    actions: [],
    unresolved: row.unresolvedItems.map((text, index) => ({ key: `U-${String(index + 1).padStart(2, "0")}`, text, turnIds: [], origin })),
    evidenceIds: row.evidenceIds,
    distribution: row.distributionUserIds,
  };
}

export function isConfirmedMinutes(row: Pick<WorkMinutesRow, "status"> | null): boolean {
  return row !== null && (row.status === "confirmed" || row.status === "distributed");
}

/** Identifiers the confirmation will write, derived from the minutes identifier so a retry writes the same rows. */
export function minutesSuffix(minutesId: string): string {
  return minutesId.replace(/^(MINUTES|MIN)-/, "");
}

export function evidenceIdForMinutes(minutesId: string): string {
  return `EVD-${minutesId}`;
}

export function actionIdForMinutes(minutesId: string, index: number): string {
  return `MSN-${minutesSuffix(minutesId)}-A${String(index).padStart(2, "0")}`;
}

/** The minutes identifier a meeting's first minutes take. */
export function minutesIdForMeeting(meetingId: string): string {
  return `MIN-${meetingId.replace(/^MTG-/, "")}`;
}

/** The validation context for a draft of one meeting, from the hub data and the loaded record. */
export function minutesValidationContext(
  shared: WorkSharedData,
  meeting: MeetingRow,
  data: Pick<MeetingLifecycleData, "turns" | "evidence">,
  author: "ai" | "person",
  forConfirmation = false,
): MinutesValidationContext {
  return {
    knownEvidenceIds: new Set([...data.evidence.keys()]),
    knownTurnIds: new Set(data.turns.filter((turn) => turn.meetingId === meeting.id).map((turn) => turn.id)),
    knownDecisionIds: new Set(shared.decisions.map((decision) => decision.id)),
    openActionIds: new Set(
      shared.actions.filter((action) => action.status !== "completed" && action.status !== "cancelled").map((action) => action.id),
    ),
    internalPeople: new Set(shared.assignable.map((person) => person.id)),
    actionKinds: new Set(Object.keys(shared.config.actionKinds)),
    scenarioDate: shared.scenarioDate,
    author,
    forConfirmation,
  };
}

/* ==========================================================================
   The view
   ========================================================================== */

export interface OptionView {
  id: string;
  label: string;
}

export interface TurnView {
  id: string;
  at: string;
  speaker: string;
  speakerKind: string;
  basis: WorkChip;
  text: string;
  flag: { note: string; evidence: EvidenceRef | null } | null;
  evidence: Array<EvidenceRef & { summary: string }>;
  captured: string[];
  /** What the capture form starts from. The person edits all of it. */
  prefill: { text: string; title: string; ownerUserId: string | null; existingActionId: string | null };
}

export interface MinutesItemView {
  key: string;
  text: string;
  origin: string;
  evidenceIds: string[];
}

export interface MinutesActionView {
  key: string;
  title: string;
  existing: { id: string; href: string } | null;
  createdId: string | null;
  owner: string;
  ownerLabel: string;
  due: string;
  kind: string;
  condition: string;
  origin: string;
  problems: string[];
}

export interface MinutesPanelView {
  minutesId: string;
  title: string;
  status: WorkChip;
  version: number;
  confirmed: boolean;
  editable: boolean;
  preparedNote: string;
  editedNote: string | null;
  draft: MinutesDraft;
  summary: string;
  facts: MinutesItemView[];
  decisions: Array<MinutesItemView & { outcome: string; decision: { id: string; label: string; href: string } | null }>;
  actions: MinutesActionView[];
  unresolved: MinutesItemView[];
  evidence: EvidenceRef[];
  distribution: string[];
  readiness: { ready: boolean; missing: string[] };
  confirmation: {
    willChange: string[];
    approval: string;
    authorityLabel: string;
    reachable: boolean;
    reason: string;
  };
  record: {
    confirmedNote: string;
    evidenceDocument: { id: string; title: string } | null;
    raised: Array<{ id: string; title: string; href: string }>;
    distribution: string;
  } | null;
}

export interface MeetingLifecycleView {
  roleId: string;
  meetingId: string;
  phase: MeetingPhase;
  phases: Array<{ id: MeetingPhase; label: string; state: string }>;
  clockNote: string;
  before: {
    purpose: string;
    participants: Array<{ id: string; name: string; detail: string }>;
    stage: { label: string; href: string | null; state: string; tone: Tone; note: string } | null;
    noStage: string;
    openDecisions: Array<{ id: string; title: string; href: string }>;
    pack: PackState;
    contradictions: Array<{ id: string; text: string; evidence: EvidenceRef[] }>;
    questions: Array<{ text: string; evidence: EvidenceRef[] }>;
    dueBefore: Array<{ id: string; title: string; due: string; href: string; tone: Tone }>;
    expectedOutcomes: string[];
    watch: string[];
    preparation: { label: string; tone: Tone; note: string };
  };
  during: {
    started: boolean;
    notStartedText: string;
    noRecord: boolean;
    turns: TurnView[];
    pending: number;
    capture: {
      enabled: boolean;
      reason: string;
      owners: OptionView[];
      decisions: OptionView[];
      kinds: OptionView[];
      existingActions: OptionView[];
      minDate: string;
      defaultDue: string;
    };
  };
  after: {
    canPrepare: boolean;
    prepareReason: string;
    minutes: MinutesPanelView | null;
    editor: {
      owners: OptionView[];
      decisions: OptionView[];
      kinds: OptionView[];
      existingActions: OptionView[];
      evidence: EvidenceRef[];
      people: OptionView[];
      minDate: string;
    };
  };
}

const BASIS: Record<string, { pair: Pair; tone: Tone }> = {
  "stakeholder-statement": { pair: L.basisStatement, tone: "neutral" },
  "verified-fact": { pair: L.basisFact, tone: "success" },
  "approved-record": { pair: L.basisRecord, tone: "info" },
  "model-inference": { pair: L.basisInference, tone: "accent" },
};

export const OUTCOME_LABELS: Record<MinutesDecisionOutcome, Pair> = {
  agreed: L.outcomeAgreed,
  "not-agreed": L.outcomeNotAgreed,
  deferred: L.outcomeDeferred,
  referred: L.outcomeReferred,
};

const CAPTURE_LABELS: Record<MinutesItemKind, Pair> = {
  fact: L.captureFact,
  decision: L.captureDecision,
  action: L.captureAction,
  unresolved: L.captureUnresolved,
};

function minutesChip(row: WorkMinutesRow, language: Language): WorkChip {
  if (row.status === "distributed") return { label: say({ en: "Distributed", de: "Verteilt" }, language), tone: "success" };
  if (row.status === "confirmed") return { label: say({ en: "Confirmed", de: "Bestaetigt" }, language), tone: "success" };
  return { label: say({ en: "Draft", de: "Entwurf" }, language), tone: "neutral" };
}

function docRef(doc: WorkEvidenceRow | undefined, relation: string, language: Language): (EvidenceRef & { summary: string }) | null {
  if (!doc) return null;
  return { ...evidenceRef(doc, relation, language), summary: firstSentences(doc.summary, 2, 260) };
}

/** Documents a turn rests on: the one it is flagged against, the ones it names, the pack documents on what it names. */
function retrieve(
  turn: MeetingTurnRow,
  evidence: ReadonlyMap<string, WorkEvidenceRow>,
  packIds: readonly string[],
  language: Language,
): Array<EvidenceRef & { summary: string }> {
  const relation = say(L.retrieved, language);
  const ids = mentionedIds(turn.content);
  const out = new Map<string, EvidenceRef & { summary: string }>();
  const add = (id: string) => {
    if (out.size >= 4 || out.has(id)) return;
    const ref = docRef(evidence.get(id), relation, language);
    if (ref) out.set(id, ref);
  };
  if (turn.contradictsEvidenceId) add(turn.contradictsEvidenceId);
  for (const id of ids) if (id.startsWith("EVD-")) add(id);
  for (const id of packIds) {
    const doc = evidence.get(id);
    if (doc && doc.relatedObjectIds.some((objectId) => ids.includes(objectId))) add(id);
  }
  return [...out.values()];
}

function capturedKinds(draft: MinutesDraft | null, turnId: string): MinutesItemKind[] {
  if (!draft) return [];
  const kinds: MinutesItemKind[] = [];
  const has = (items: ReadonlyArray<{ turnIds: string[]; origin: string }>) =>
    items.some((item) => item.origin === "person" && item.turnIds.includes(turnId));
  if (has(draft.facts)) kinds.push("fact");
  if (has(draft.decisions)) kinds.push("decision");
  if (has(draft.actions)) kinds.push("action");
  if (has(draft.unresolved)) kinds.push("unresolved");
  return kinds;
}

export interface LifecycleInput {
  shared: WorkSharedData;
  meeting: MeetingRow;
  data: MeetingLifecycleData;
  pack: PackState;
  typeLabel: string;
  openDecisions: ReadonlyArray<{ id: string; title: string; titleDe: string; status: string }>;
}

export function buildLifecycleView(input: LifecycleInput): MeetingLifecycleView {
  const { shared, meeting, data, pack } = input;
  const { language, roleId } = shared;
  const t = (pair: Pair) => say(pair, language);

  const end = meetingEnd(meeting, data.endsAt, data.turns);
  const clock = meetingClock(meeting, shared.scenarioDate, shared.currentMoment, end);
  const heard = heardTurns(meeting, data.turns, shared.scenarioDate, shared.currentMoment);
  const minutes = data.minutes;
  const confirmed = isConfirmedMinutes(minutes);
  const draft = minutes ? draftOfMinutes(minutes, language) : null;
  const options = optionsFor(shared);

  const order: MeetingPhase[] = ["before", "during", "after"];
  const at = order.indexOf(clock.phase);
  const phases = order.map((id, index) => ({
    id,
    label: t(id === "before" ? L.before : id === "during" ? L.during : L.after),
    state: t(index < at ? L.phaseDone : index === at ? L.phaseNow : L.phaseLater),
  }));

  /* ---- Before ---------------------------------------------------------- */
  const prep = data.preparation.output;
  const packIds = meeting.evidenceDocumentIds;
  const relation = (pair: Pair) => say(pair, language);
  const refs = (ids: readonly string[], why: Pair): EvidenceRef[] =>
    ids.flatMap((id) => {
      const doc = data.evidence.get(id);
      return doc ? [evidenceRef(doc, relation(why), language)] : [];
    });

  const stage = data.stage;
  const stageRoute = stage ? (shared.processScopes.find((scope) => scope.roleAppRunId === stage.processRunId)?.entryRoute ?? null) : null;
  const stageView = stage
    ? {
        label: say(stage.stageName, language),
        href: stageRoute ? `${stageRoute}?stage=${encodeURIComponent(stage.stageId)}` : null,
        state: t(stage.state === "open" ? L.stageOpen : stage.state === "completed" ? L.stageCompleted : L.stageNotOpen),
        tone: (stage.state === "open" ? "accent" : stage.state === "completed" ? "success" : "neutral") as Tone,
        note:
          stage.state === "open"
            ? t(L.stageOpenNote)
            : stage.state === "completed"
              ? t(L.stageCompletedNote)
              : fill(t(L.stageNotOpenNote), { current: stage.currentStageName ? say(stage.currentStageName, language) : "" }),
      }
    : null;

  const meetingDay = dateOf(meeting.scheduledFor);
  const dueBefore = shared.actions
    .filter(
      (action) =>
        action.status !== "completed" &&
        action.status !== "cancelled" &&
        action.dueOn !== null &&
        action.dueOn <= meetingDay &&
        ((meeting.subjectId !== null && action.relatedObjectId === meeting.subjectId) || action.sourceMeetingId === meeting.id),
    )
    .sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? ""));

  const preparationLabel =
    data.preparation.mode === "safe" ? L.prepSafe : data.preparation.mode === "offline" ? L.prepOffline : L.prepUnavailable;

  const before: MeetingLifecycleView["before"] = {
    purpose: meeting.objective,
    participants: meeting.participantUserIds.map((id) => {
      const person = shared.people.get(id);
      return {
        id,
        name: person?.name ?? id,
        detail: person ? `${person.jobTitle}${person.line === "external" ? `, ${t(L.external)}` : ""}` : "",
      };
    }),
    stage: stageView,
    noStage: t(L.noStage),
    openDecisions: input.openDecisions
      .filter((decision) => decision.status === "open")
      .map((decision) => ({
        id: decision.id,
        title: decisionTitle(decision, language),
        href: `/workday/${roleId}/decisions#${encodeURIComponent(decision.id)}`,
      })),
    pack,
    contradictions: (prep?.contradictions ?? []).map((item, index) => ({
      id: `C-${index + 1}`,
      text: item.text,
      evidence: refs(item.evidenceIds, L.contradictions),
    })),
    questions: (prep?.questions ?? []).map((question) => ({ text: question.text, evidence: refs(question.evidenceIds, L.questions) })),
    dueBefore: dueBefore.map((action) => ({
      id: action.id,
      title: actionTitle(action, language),
      due: action.dueOn ? displayDate(action.dueOn) : "",
      href: itemHref(roleId, "actions", action.id),
      tone: (action.dueOn !== null && action.dueOn < shared.scenarioDate ? "danger" : "warning") as Tone,
    })),
    expectedOutcomes: (prep?.expectedOutcomes ?? []).map((outcome) => say(outcome.text, language)),
    watch: (prep?.watch ?? []).map((item) => say(item, language)),
    preparation: {
      label: t(preparationLabel),
      tone: data.preparation.mode === "unavailable" ? "warning" : "info",
      note: say(data.preparation.note, language),
    },
  };

  /* ---- During ----------------------------------------------------------- */
  const captureGate = shared.gate["captureMeetingItem"];
  const captureReason = !clock.started
    ? t(L.captureNotStarted)
    : confirmed
      ? t(L.captureConfirmed)
      : !captureGate
        ? say({ en: "This operation is not registered with the authority gate.", de: "Dieser Vorgang ist bei der Befugnispruefung nicht registriert." }, language)
        : captureGate.reachable
          ? ""
          : captureGate.reason;

  const openActions = new Map(
    shared.actions.filter((action) => action.status !== "completed" && action.status !== "cancelled").map((action) => [action.id, action]),
  );
  const internal = new Set(shared.assignable.map((person) => person.id));

  const turns: TurnView[] = heard.map((turn) => {
    const basis = BASIS[turn.provenance] ?? { pair: L.basisStatement, tone: "neutral" as Tone };
    const flagged = turn.contradictsEvidenceId !== null && !turn.flagDismissed;
    const flagDoc = turn.contradictsEvidenceId ? data.evidence.get(turn.contradictsEvidenceId) : undefined;
    const named = mentionedIds(turn.content);
    const existing = named.find((id) => openActions.has(id)) ?? null;
    const owner = mentionedPeople(turn.content).find((id) => internal.has(id)) ?? null;
    const speaker =
      turn.speakerKind === "assistant" ? t(L.aiPartner) : turn.speakerUserId ? (personName(shared, turn.speakerUserId) ?? turn.speakerLabel) : turn.speakerLabel;
    return {
      id: turn.id,
      at: turn.atMoment,
      speaker,
      speakerKind: turn.speakerKind,
      basis: { label: t(basis.pair), tone: basis.tone },
      text: turn.content,
      flag: flagged
        ? {
            note: turn.contradictionNote,
            evidence: flagDoc ? evidenceRef(flagDoc, t(L.flag), language) : null,
          }
        : null,
      evidence: retrieve(turn, data.evidence, packIds, language),
      captured: capturedKinds(draft, turn.id).map((kind) => t(CAPTURE_LABELS[kind])),
      prefill: {
        text: firstSentences(turn.content, 3, 900),
        title: firstSentences(turn.content, 1, 200),
        ownerUserId: owner ?? shared.holderUserId,
        existingActionId: existing,
      },
    };
  });

  const during: MeetingLifecycleView["during"] = {
    started: clock.started,
    notStartedText: fill(t(L.notStartedYet), { time: clock.start }),
    noRecord: clock.started && data.turns.length === 0,
    turns,
    pending: Math.max(data.turns.length - heard.length, 0),
    capture: {
      enabled: captureReason.length === 0,
      reason: captureReason,
      owners: options.owners,
      decisions: options.decisions,
      kinds: options.kinds,
      existingActions: options.existingActions,
      minDate: shared.scenarioDate,
      defaultDue: addDays(shared.scenarioDate, 7),
    },
  };

  /* ---- After ------------------------------------------------------------ */
  const prepareGate = shared.gate["prepareMeetingMinutes"];
  const prepareReason = !clock.started
    ? t(L.prepareNotStarted)
    : confirmed
      ? t(L.captureConfirmed)
      : minutes?.preparedMode
        ? t(L.prepareDone)
        : !prepareGate
          ? say({ en: "This operation is not registered with the authority gate.", de: "Dieser Vorgang ist bei der Befugnispruefung nicht registriert." }, language)
          : prepareGate.reachable
            ? ""
            : prepareGate.reason;

  const evidenceChoices = [...new Set([...packIds, ...(draft?.evidenceIds ?? [])])].flatMap((id) => {
    const doc = data.evidence.get(id);
    return doc ? [evidenceRef(doc, t(L.evidenceLabel), language)] : [];
  });

  const after: MeetingLifecycleView["after"] = {
    canPrepare: prepareReason.length === 0,
    prepareReason,
    minutes: minutes && draft ? minutesPanel(input, minutes, draft, clock) : null,
    editor: { ...options, evidence: evidenceChoices, minDate: shared.scenarioDate },
  };

  return {
    roleId,
    meetingId: meeting.id,
    phase: clock.phase,
    phases,
    clockNote: fill(t(L.clock), {
      now: shared.currentMoment,
      date: displayDate(meetingDay),
      start: clock.start,
      end: clock.end,
    }),
    before,
    during,
    after,
  };
}

function optionsFor(shared: WorkSharedData) {
  const { language } = shared;
  return {
    owners: shared.assignable.map((person) => ({ id: person.id, label: `${person.name}, ${person.jobTitle}` })),
    people: shared.assignable.map((person) => ({ id: person.id, label: person.name })),
    decisions: shared.decisions.map((decision) => ({ id: decision.id, label: `${decision.id} ${decisionTitle(decision, language)}` })),
    kinds: Object.entries(shared.config.actionKinds).map(([id, kind]) => ({ id, label: say(kind.label, language) })),
    existingActions: shared.actions
      .filter((action) => action.status !== "completed" && action.status !== "cancelled")
      .map((action) => ({ id: action.id, label: `${action.id} ${actionTitle(action, language)}` })),
  };
}

/* ==========================================================================
   The minutes panel
   ========================================================================== */

function minutesPanel(input: LifecycleInput, row: WorkMinutesRow, draft: MinutesDraft, clock: MeetingClock): MinutesPanelView {
  const { shared, meeting, data } = input;
  const { language, roleId } = shared;
  const t = (pair: Pair) => say(pair, language);
  const confirmed = isConfirmedMinutes(row);
  const origin = (value: "ai" | "person") => t(value === "person" ? L.originPerson : L.originAi);
  const kindLabel = (kind: string) => {
    const label = shared.config.actionKinds[kind]?.label;
    return label ? say(label, language) : kind;
  };

  /* Which created action belongs to which draft item, once the minutes are confirmed. */
  const created = new Map<string, string>();
  if (confirmed) {
    let index = 0;
    for (const action of draft.actions) {
      if (action.existingActionId !== null) continue;
      index += 1;
      created.set(action.key, actionIdForMinutes(row.id, index));
    }
  }

  const readiness = validateMinutesDraft(draft, minutesValidationContext(shared, meeting, data, "person", true));
  const missing = confirmed
    ? []
    : [
        ...(clock.started ? [] : [t(L.prepareNotStarted)]),
        ...(readiness.ok ? [] : [...new Set(readiness.failures.map((failure) => say(failure.message, language)))]),
      ];
  const problemsFor = (index: number) =>
    readiness.ok ? [] : readiness.failures.filter((failure) => failure.path.startsWith(`actions[${index}]`)).map((failure) => say(failure.message, language));

  const newActions = draft.actions.filter((action) => action.existingActionId === null).length;
  const followUps = draft.actions.length - newActions;
  const openDecisionIds = new Set(shared.decisions.filter((decision) => decision.status === "open").map((decision) => decision.id));
  const decisionsDiscussed = new Set(draft.decisions.flatMap((decision) => (decision.decisionId && openDecisionIds.has(decision.decisionId) ? [decision.decisionId] : []))).size;
  const willChange = [
    fill(t(L.willEvidence), { id: evidenceIdForMinutes(row.id) }),
    ...(newActions > 0 ? [fill(t(L.willActions), { count: newActions })] : []),
    ...(followUps > 0 ? [fill(t(L.willFollowUps), { count: followUps })] : []),
    ...(meeting.status !== "concluded" ? [fill(t(L.willHeld), { reference: meeting.reference })] : []),
    ...(data.stage ? [fill(t(L.willStage), { stage: say(data.stage.stageName, language) })] : []),
    ...(decisionsDiscussed > 0 ? [fill(t(L.willDecisions), { count: decisionsDiscussed })] : []),
    ...(draft.distribution.length > 0 ? [fill(t(L.willDistribute), { count: draft.distribution.length })] : []),
  ];

  const gate = shared.gate["confirmMeetingMinutes"];
  const evidenceDoc = row.evidenceDocumentId ? data.evidence.get(row.evidenceDocumentId) : undefined;
  const recipients = (data.distribution?.toUserIds ?? row.distributionUserIds).map((id) => personName(shared, id) ?? id);
  const confirmedAt = row.confirmedAt ? `${displayDate(row.confirmedAt)} ${timeOf(row.confirmedAt)}` : "";

  return {
    minutesId: row.id,
    title: row.title,
    status: minutesChip(row, language),
    version: row.version,
    confirmed,
    editable: !confirmed,
    preparedNote:
      row.preparedBy === "ai"
        ? fill(t(L.draftByAi), {
            mode: t(row.preparedMode === "offline" ? L.prepOffline : row.preparedMode === "safe" ? L.prepSafe : L.prepSafe),
          })
        : fill(t(L.draftByPerson), { person: personName(shared, row.editedByUserId ?? shared.holderUserId) ?? "" }),
    editedNote: row.editedByUserId
      ? fill(t(L.editedBy), { person: personName(shared, row.editedByUserId) ?? row.editedByUserId, version: row.version })
      : null,
    draft,
    summary: draft.summary,
    facts: draft.facts.map((fact) => ({ key: fact.key, text: fact.text, origin: origin(fact.origin), evidenceIds: fact.evidenceIds })),
    decisions: draft.decisions.map((decision) => {
      const known = decision.decisionId ? shared.decisions.find((candidate) => candidate.id === decision.decisionId) : undefined;
      return {
        key: decision.key,
        text: decision.text,
        origin: origin(decision.origin),
        evidenceIds: [],
        outcome: t(OUTCOME_LABELS[decision.outcome]),
        decision: decision.decisionId
          ? {
              id: decision.decisionId,
              label: known ? decisionTitle(known, language) : decision.decisionId,
              href: `/workday/${roleId}/decisions#${encodeURIComponent(decision.decisionId)}`,
            }
          : null,
      };
    }),
    actions: draft.actions.map((action, index) => {
      const existing = action.existingActionId;
      return {
        key: action.key,
        title: action.title,
        existing: existing ? { id: existing, href: itemHref(roleId, "actions", existing) } : null,
        createdId: created.get(action.key) ?? null,
        owner: action.ownerUserId ? (personName(shared, action.ownerUserId) ?? action.ownerUserId) : t(L.ownerNeeded),
        ownerLabel: action.ownerLabel,
        due: action.dueOn ? displayDate(action.dueOn) : t(L.dateNeeded),
        kind: kindLabel(action.kind),
        condition: action.completionCondition,
        origin: origin(action.origin),
        problems: confirmed ? [] : problemsFor(index),
      };
    }),
    unresolved: draft.unresolved.map((item) => ({ key: item.key, text: item.text, origin: origin(item.origin), evidenceIds: [] })),
    evidence: draft.evidenceIds.flatMap((id) => {
      const doc = data.evidence.get(id);
      return doc ? [evidenceRef(doc, t(L.evidenceLabel), language)] : [];
    }),
    distribution: draft.distribution.map((id) => personName(shared, id) ?? id),
    readiness: { ready: missing.length === 0 && !confirmed, missing },
    confirmation: {
      willChange,
      approval: fill(t(L.approval), { version: row.version }),
      authorityLabel: gate ? say(AUTHORITY_LABELS[gate.authorityClass], language) : "",
      reachable: gate?.reachable ?? false,
      reason: gate ? gate.reason : say({ en: "This operation is not registered with the authority gate.", de: "Dieser Vorgang ist bei der Befugnispruefung nicht registriert." }, language),
    },
    record: confirmed
      ? {
          confirmedNote: fill(t(L.confirmedBy), { person: personName(shared, row.confirmedByUserId) ?? "", when: confirmedAt }),
          evidenceDocument: evidenceDoc
            ? { id: evidenceDoc.id, title: language === "de" && evidenceDoc.titleDe.length > 0 ? evidenceDoc.titleDe : evidenceDoc.title }
            : row.evidenceDocumentId
              ? { id: row.evidenceDocumentId, title: row.evidenceDocumentId }
              : null,
          raised: [...created.values()].flatMap((id) => {
            const action = shared.actions.find((candidate) => candidate.id === id);
            return action ? [{ id, title: actionTitle(action, language), href: itemHref(roleId, "actions", id) }] : [];
          }),
          distribution: row.distributedAt
            ? fill(t(L.distributedTo), {
                names: recipients.join(", "),
                when: data.distribution ? data.distribution.sentAtMoment : timeOf(row.distributedAt),
              })
            : t(L.notDistributed),
        }
      : null,
  };
}

/** The labels a decision outcome reads with, for the record text. */
export function outcomeLabel(outcome: MinutesDecisionOutcome, language: Language): string {
  return say(OUTCOME_LABELS[outcome], language);
}
