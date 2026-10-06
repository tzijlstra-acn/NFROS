/**
 * The offline composers of the meeting lifecycle.
 *
 * Pure. These are the offline branch of the AI layer, in the process
 * engine's sense: what the product prepares when no live model is in use and
 * no validated safe mode output matches the sources. Everything they write is
 * grounded in a structured field. A fact is a turn the record marks as a
 * verified fact or an approved record; an action is an open action a turn
 * names by its identifier, or a request a record turn states with its owner;
 * an unresolved item is a statement the record flagged against a document. A
 * composer never invents a position, an owner or a date it cannot point at.
 * What it cannot know (whether a decision was agreed, when an action is due)
 * it leaves for the person, and the draft says so.
 *
 * Both outputs then pass the same validator as every other mode
 * (`ai-schema.ts`).
 */

import type { Language } from "@/i18n/labels";
import type { WorkActionRow, WorkDecisionRef, WorkEvidenceRow } from "@/db/repositories/work-hub";
import type { MeetingTurnRow, RecordedContradiction } from "@/db/repositories/meetings";
import { fill, say, type Pair } from "../../copy";
import { dateOf, displayDate, timeOf } from "../../model";
import type { MeetingRow } from "../../shared";
import {
  emptyMinutesDraft,
  MEETING_PREPARATION_SCHEMA_VERSION,
  type MeetingPreparationOutput,
  type MinutesAction,
  type MinutesDraft,
  type MinutesItemKind,
} from "./ai-schema";
import { COMPOSE_COPY } from "./copy";

/* ==========================================================================
   Reading identifiers out of text
   ========================================================================== */

/** Object identifiers as the scenario writes them, for example EVD-2026-00001, CTL-ABC-001, MSN-2026-0001 or TP-0001.1. */
const OBJECT_ID = /\b[A-Z]{2,5}(?:-[A-Z0-9]+){1,6}(?:\.\d+)?\b/g;
/** A person, as the record names one: P-002. */
const PERSON_ID = /\bP-\d{3}\b/g;

export function mentionedIds(text: string): string[] {
  return [...new Set(text.match(OBJECT_ID) ?? [])];
}

export function mentionedPeople(text: string): string[] {
  return [...new Set(text.match(PERSON_ID) ?? [])];
}

/** The first sentences of a text, within a limit, for an item that quotes a turn. */
export function firstSentences(text: string, count: number, limit = 600): string {
  const sentences = text.trim().replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9"])/);
  let out = "";
  for (const sentence of sentences.slice(0, count)) {
    const next = out.length > 0 ? `${out} ${sentence}` : sentence;
    if (next.length > limit) break;
    out = next;
  }
  return out.length > 0 ? out : text.trim().slice(0, limit);
}

/* ==========================================================================
   Before the meeting
   ========================================================================== */

export interface PreparationInput {
  meeting: MeetingRow;
  typeLabel: Pair;
  /** The pack, as the corpus holds it. A pack document the corpus lacks is absent here. */
  pack: ReadonlyMap<string, WorkEvidenceRow>;
  /** Open decisions on the meeting's subject, visible to the role now. */
  openDecisions: readonly WorkDecisionRef[];
  /** The completion criteria of the stage the meeting serves, when it serves one. */
  stageCriteria: readonly Pair[];
  contradictions: readonly RecordedContradiction[];
  /** Open work on the meeting's subject due on or before the meeting day. */
  dueBefore: readonly WorkActionRow[];
  scenarioDate: string;
}

/** Pack documents the text names, by identifier or by an object they evidence. */
function evidenceFor(text: string, pack: ReadonlyMap<string, WorkEvidenceRow>): string[] {
  const ids = mentionedIds(text);
  const found: string[] = [];
  for (const doc of pack.values()) {
    if (ids.includes(doc.id) || doc.relatedObjectIds.some((objectId) => ids.includes(objectId))) found.push(doc.id);
    if (found.length >= 4) break;
  }
  return found;
}

export function composeMeetingPreparation(input: PreparationInput): MeetingPreparationOutput {
  const { meeting, pack } = input;
  const packIds = meeting.evidenceDocumentIds;
  const held = packIds.filter((id) => pack.has(id));
  const needing = packIds.filter((id) => {
    const doc = pack.get(id);
    return !doc || doc.isStale || doc.status !== "current";
  });

  /*
   * A contradiction bears on the meeting when it is about the meeting's
   * subject, about an object the meeting's own text names, or cites a
   * document in the pack.
   */
  const named = new Set(mentionedIds(`${meeting.title} ${meeting.objective} ${meeting.preparationSummary}`));
  const relevant = input.contradictions.filter(
    (item) =>
      item.targetId === meeting.subjectId ||
      named.has(item.targetId) ||
      item.evidenceIds.some((id) => packIds.includes(id)),
  );
  const contradictions = relevant
    .map((item) => ({ text: item.description, evidenceIds: item.evidenceIds.slice(0, 8), objectId: item.targetId }))
    .filter((item) => item.evidenceIds.length > 0)
    .slice(0, 8);

  const values = {
    type: input.typeLabel.en,
    date: displayDate(dateOf(meeting.scheduledFor)),
    time: timeOf(meeting.scheduledFor),
    current: held.length - needing.filter((id) => pack.has(id)).length,
    total: packIds.length,
    questions: meeting.preparedQuestions.length,
    contradictions: contradictions.length,
    decisions: input.openDecisions.length,
  };

  const expectedOutcomes: MeetingPreparationOutput["expectedOutcomes"] = [
    ...input.openDecisions.slice(0, 4).map((decision) => ({
      text: {
        en: fill(COMPOSE_COPY.outcomeDecision.en, { title: decision.title }),
        de: fill(COMPOSE_COPY.outcomeDecision.de, { title: decision.titleDe.length > 0 ? decision.titleDe : decision.title }),
      },
      basis: "decision" as const,
      refId: decision.id,
    })),
    ...input.stageCriteria.slice(0, 3).map((criterion) => ({ text: criterion, basis: "stage" as const, refId: null })),
    { text: COMPOSE_COPY.outcomeMinutes, basis: "minutes" as const, refId: null },
  ];

  const watch: MeetingPreparationOutput["watch"] = [];
  if (needing.length > 0) {
    watch.push({
      en: fill(COMPOSE_COPY.watchPack.en, { count: needing.length, ids: needing.join(", ") }),
      de: fill(COMPOSE_COPY.watchPack.de, { count: needing.length, ids: needing.join(", ") }),
    });
  }
  const overdue = input.dueBefore.filter((action) => action.dueOn !== null && action.dueOn < input.scenarioDate);
  if (overdue.length > 0) {
    watch.push({
      en: fill(COMPOSE_COPY.watchOverdue.en, { count: overdue.length, ids: overdue.map((action) => action.id).join(", ") }),
      de: fill(COMPOSE_COPY.watchOverdue.de, { count: overdue.length, ids: overdue.map((action) => action.id).join(", ") }),
    });
  }

  return {
    schemaVersion: MEETING_PREPARATION_SCHEMA_VERSION,
    summary: {
      en: fill(COMPOSE_COPY.prepSummary.en, values),
      de: fill(COMPOSE_COPY.prepSummary.de, { ...values, type: input.typeLabel.de }),
    },
    expectedOutcomes,
    questions: meeting.preparedQuestions.slice(0, 12).map((text) => ({ text, evidenceIds: evidenceFor(text, pack) })),
    contradictions,
    watch,
    limitations: [COMPOSE_COPY.prepLimitation],
  };
}

/* ==========================================================================
   After the meeting
   ========================================================================== */

export interface MinutesComposeInput {
  meeting: MeetingRow;
  typeLabel: string;
  /** The turns heard so far, in speaking order. */
  turns: readonly MeetingTurnRow[];
  /** True when every recorded turn has been heard. */
  complete: boolean;
  language: Language;
  /** Internal people, who can own an action or receive the minutes. */
  internalPeople: ReadonlySet<string>;
  /** Decisions the role can see now. */
  decisions: readonly WorkDecisionRef[];
  /** Open actions on the role's desk. */
  openActions: readonly WorkActionRow[];
  knownEvidenceIds: ReadonlySet<string>;
  /** The kinds the role's configuration defines, first preferred. */
  actionKinds: readonly string[];
  holderUserId: string | null;
}

const FACT_BASES = ["verified-fact", "approved-record"];
/** "Action requested of P-002: obtain ... clause 2.1." The request ends at a full stop that ends the sentence. */
const ACTION_REQUEST = /Action requested of (P-\d{3}):\s*(.+?)\.(?=\s|$)/g;

function knownEvidence(turn: MeetingTurnRow, known: ReadonlySet<string>): string[] {
  const ids = [...(turn.contradictsEvidenceId ? [turn.contradictsEvidenceId] : []), ...mentionedIds(turn.content)];
  return [...new Set(ids.filter((id) => known.has(id)))];
}

/**
 * The offline minutes draft, from the turns heard so far.
 *
 * Decisions are listed as referred to their owner, because whether a
 * decision was agreed is a judgment the transcript records in words, and the
 * person confirming the minutes states it. New actions have no due date for
 * the same reason: the person sets it, and confirmation refuses without it.
 */
export function composeMinutesDraft(input: MinutesComposeInput): MinutesDraft {
  const { meeting, turns, language } = input;
  const t = (pair: Pair) => say(pair, language);
  const draft = emptyMinutesDraft(language);

  const records = turns.filter((turn) => turn.speakerKind === "system");
  const closing = records.length > 1 ? records[records.length - 1] : undefined;
  const flagged = turns.filter((turn) => turn.contradictsEvidenceId !== null && !turn.flagDismissed);
  const participants = meeting.participantUserIds.length;

  draft.summary = [
    fill(t(COMPOSE_COPY.minutesSummary), {
      type: input.typeLabel,
      date: displayDate(dateOf(meeting.scheduledFor)),
      participants,
      turns: turns.length,
      flags: flagged.length,
    }),
    input.complete ? null : t(COMPOSE_COPY.minutesInProgress),
    closing ? firstSentences(closing.content, 4, 900) : null,
  ]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(" ");

  let n = 0;
  const nextKey = (prefix: string) => {
    n += 1;
    return `${prefix}-${String(n).padStart(2, "0")}`;
  };

  for (const turn of turns) {
    if (!FACT_BASES.includes(turn.provenance) || turn === closing) continue;
    draft.facts.push({
      key: nextKey("F"),
      text: firstSentences(turn.content, 2),
      evidenceIds: knownEvidence(turn, input.knownEvidenceIds),
      turnIds: [turn.id],
      origin: "ai",
    });
  }

  const visible = new Map(input.decisions.map((decision) => [decision.id, decision]));
  const named = new Set<string>();
  for (const turn of turns) {
    for (const id of mentionedIds(turn.content)) if (visible.has(id)) named.add(id);
  }
  for (const decision of input.decisions) {
    if (meeting.subjectId !== null && decision.relatedObjectId === meeting.subjectId) named.add(decision.id);
  }
  for (const id of [...named].sort()) {
    const turnIds = turns.filter((turn) => turn.content.includes(id)).map((turn) => turn.id).slice(0, 4);
    draft.decisions.push({
      key: nextKey("D"),
      text: t(COMPOSE_COPY.decisionReferred),
      decisionId: id,
      outcome: "referred",
      turnIds,
      origin: "ai",
    });
  }

  const open = new Map(input.openActions.map((action) => [action.id, action]));
  const followed = new Set<string>();
  for (const turn of turns) {
    for (const id of mentionedIds(turn.content)) {
      const action = open.get(id);
      if (!action || followed.has(id)) continue;
      followed.add(id);
      draft.actions.push({
        key: nextKey("A"),
        title: action.title,
        existingActionId: action.id,
        ownerUserId: action.ownerUserId,
        ownerLabel: action.ownerLabel,
        dueOn: action.dueOn,
        kind: action.kind,
        completionCondition: "",
        evidenceIds: knownEvidence(turn, input.knownEvidenceIds),
        turnIds: [turn.id],
        origin: "ai",
      });
    }
  }

  const kind = input.actionKinds[0] ?? "evidence-request";
  for (const turn of records) {
    for (const match of turn.content.matchAll(ACTION_REQUEST)) {
      const owner = match[1] ?? "";
      const title = (match[2] ?? "").trim();
      if (title.length === 0) continue;
      draft.actions.push({
        key: nextKey("A"),
        title: title.charAt(0).toUpperCase() + title.slice(1),
        existingActionId: null,
        ownerUserId: input.internalPeople.has(owner) ? owner : null,
        ownerLabel: "",
        dueOn: null,
        kind,
        completionCondition: "",
        evidenceIds: [],
        turnIds: [turn.id],
        origin: "ai",
      });
    }
  }

  for (const turn of flagged) {
    const note = turn.contradictionNote.trim().length > 0 ? firstSentences(turn.contradictionNote, 1, 400) : "";
    draft.unresolved.push({
      key: nextKey("U"),
      text: `${turn.speakerLabel}: ${firstSentences(turn.content, 1, 300)}${note ? ` ${fill(t(COMPOSE_COPY.contradictedBy), { note })}` : ""}`,
      turnIds: [turn.id],
      origin: "ai",
    });
  }

  draft.evidenceIds = [
    ...new Set([
      ...meeting.evidenceDocumentIds.filter((id) => input.knownEvidenceIds.has(id)),
      ...draft.facts.flatMap((fact) => fact.evidenceIds),
      ...draft.actions.flatMap((action) => action.evidenceIds),
    ]),
  ].slice(0, 40);

  draft.distribution = [
    ...new Set([...(input.holderUserId ? [input.holderUserId] : []), ...meeting.participantUserIds]),
  ].filter((id) => input.internalPeople.has(id));

  return draft;
}

/* ==========================================================================
   Merging what the person captured
   ========================================================================== */

type Item = { key: string; turnIds: string[]; origin: "ai" | "person" };

function covered(kind: MinutesItemKind, item: Item, kept: Map<MinutesItemKind, Set<string>>): boolean {
  const turns = kept.get(kind);
  return turns !== undefined && item.turnIds.some((id) => turns.has(id));
}

/**
 * The person's items first, then the AI's, without an AI item for a turn the
 * person already captured as the same kind of item. A person's capture is
 * never overwritten by a draft; the person decides what the record says.
 */
export function mergeIntoDraft(base: MinutesDraft, captured: MinutesDraft | null): MinutesDraft {
  if (!captured) return base;
  const kept = new Map<MinutesItemKind, Set<string>>();
  const remember = (kind: MinutesItemKind, items: readonly Item[]) => {
    const set = kept.get(kind) ?? new Set<string>();
    for (const item of items) for (const id of item.turnIds) set.add(id);
    kept.set(kind, set);
  };
  const people = {
    facts: captured.facts.filter((item) => item.origin === "person"),
    decisions: captured.decisions.filter((item) => item.origin === "person"),
    actions: captured.actions.filter((item) => item.origin === "person"),
    unresolved: captured.unresolved.filter((item) => item.origin === "person"),
  };
  remember("fact", people.facts);
  remember("decision", people.decisions);
  remember("action", people.actions);
  remember("unresolved", people.unresolved);

  const used = new Set([...people.facts, ...people.decisions, ...people.actions, ...people.unresolved].map((item) => item.key));
  const rekey = <T extends Item>(item: T): T => {
    if (!used.has(item.key)) {
      used.add(item.key);
      return item;
    }
    let index = 1;
    while (used.has(`${item.key}-${index}`)) index += 1;
    const next = `${item.key}-${index}`;
    used.add(next);
    return { ...item, key: next };
  };

  return {
    ...base,
    summary: captured.summary.trim().length > 0 ? captured.summary : base.summary,
    facts: [...people.facts, ...base.facts.filter((item) => !covered("fact", item, kept)).map(rekey)],
    decisions: [
      ...people.decisions,
      ...base.decisions
        .filter((item) => !covered("decision", item, kept))
        .filter((item) => item.decisionId === null || !people.decisions.some((mine) => mine.decisionId === item.decisionId))
        .map(rekey),
    ],
    actions: [...people.actions, ...base.actions.filter((item) => !covered("action", item, kept)).map(rekey)],
    unresolved: [...people.unresolved, ...base.unresolved.filter((item) => !covered("unresolved", item, kept)).map(rekey)],
    evidenceIds: [...new Set([...captured.evidenceIds, ...base.evidenceIds])].slice(0, 40),
    distribution: captured.distribution.length > 0 ? captured.distribution : base.distribution,
  };
}

/** A fresh item key of a kind, unique in the draft. */
export function nextItemKey(draft: MinutesDraft, kind: MinutesItemKind): string {
  const prefix = kind === "fact" ? "F" : kind === "decision" ? "D" : kind === "action" ? "A" : "U";
  const keys = new Set(
    [...draft.facts, ...draft.decisions, ...draft.actions, ...draft.unresolved].map((item) => item.key),
  );
  let index = 1;
  while (keys.has(`${prefix}P-${String(index).padStart(2, "0")}`)) index += 1;
  return `${prefix}P-${String(index).padStart(2, "0")}`;
}

/* ==========================================================================
   The record text
   ========================================================================== */

export interface RecordTextInput {
  title: string;
  reference: string;
  when: string;
  participants: readonly string[];
  draft: MinutesDraft;
  personName: (id: string | null) => string;
  decisionTitle: (id: string) => string;
  actionIds: ReadonlyMap<string, string>;
  outcomeLabel: (outcome: MinutesDraft["decisions"][number]["outcome"]) => string;
}

function actionLine(action: MinutesAction, input: RecordTextInput, t: (pair: Pair) => string): string {
  const id = action.existingActionId ?? input.actionIds.get(action.key) ?? "";
  const owner = input.personName(action.ownerUserId);
  const parts = [
    `${id ? `${id} ` : ""}${action.title}.`,
    `${t(COMPOSE_COPY.recordOwner)}: ${owner}${action.ownerLabel ? `, ${t(COMPOSE_COPY.recordDeliveredBy)} ${action.ownerLabel}` : ""}.`,
    action.dueOn ? `${t(COMPOSE_COPY.recordDue)} ${displayDate(action.dueOn)}.` : "",
    action.completionCondition ? `${t(COMPOSE_COPY.recordCondition)}: ${action.completionCondition}` : "",
  ];
  return `- ${parts.filter((part) => part.length > 0).join(" ")}`;
}

/**
 * The confirmed minutes as one plain text, in the draft's language.
 *
 * This is the body of the evidence document the minutes become, and of the
 * simulated message that distributes them, so a reader of either sees the
 * same record.
 */
export function renderMinutesText(input: RecordTextInput): string {
  const { draft } = input;
  const t = (pair: Pair) => say(pair, draft.language);
  const lines: string[] = [
    `${input.title} (${input.reference})`,
    `${input.when}. ${t(COMPOSE_COPY.recordParticipants)}: ${input.participants.join(", ")}.`,
    "",
  ];
  if (draft.summary.trim().length > 0) lines.push(t(COMPOSE_COPY.recordSummary), draft.summary.trim(), "");
  if (draft.facts.length > 0) {
    lines.push(t(COMPOSE_COPY.recordFacts), ...draft.facts.map((fact) => `- ${fact.text}${fact.evidenceIds.length > 0 ? ` (${fact.evidenceIds.join(", ")})` : ""}`), "");
  }
  if (draft.decisions.length > 0) {
    lines.push(
      t(COMPOSE_COPY.recordDecisions),
      ...draft.decisions.map(
        (decision) =>
          `- ${input.outcomeLabel(decision.outcome)}: ${decision.text}${decision.decisionId ? ` (${decision.decisionId} ${input.decisionTitle(decision.decisionId)})` : ""}`,
      ),
      "",
    );
  }
  if (draft.actions.length > 0) {
    lines.push(t(COMPOSE_COPY.recordActions), ...draft.actions.map((action) => actionLine(action, input, t)), "");
  }
  if (draft.unresolved.length > 0) lines.push(t(COMPOSE_COPY.recordUnresolved), ...draft.unresolved.map((item) => `- ${item.text}`), "");
  if (draft.evidenceIds.length > 0) lines.push(t(COMPOSE_COPY.recordEvidence), draft.evidenceIds.join(", "));
  return lines.join("\n").trim();
}
