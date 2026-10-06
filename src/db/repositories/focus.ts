/**
 * The focus queue: Now, Next, Watching and the four sections behind them.
 *
 * This module answers one question for one role at one moment: what is being
 * asked of this person, what has already been dealt with, and what is merely
 * being watched. Everything it returns is derived from rows that exist. There
 * is no per role list of queue items anywhere in this codebase, because a
 * written list is exactly how a demonstration drifts out of agreement with its
 * own data: the seed changes a subject identifier, nothing fails, and the queue
 * keeps describing work the database no longer contains.
 *
 * Two rules in here are product rules rather than implementation details, so
 * both are pure functions and both are tested directly.
 *
 * Section assignment follows what the scenario has actually done. An open
 * decision needs you; a suggestion the partner finished needs reviewing; work
 * it completed within policy is handled; a subject under observation with no
 * action attached is watched. Recording a decision moves its item without
 * anything in this file knowing that a decision was recorded, because the
 * section is read from the row rather than stored beside it.
 *
 * One item appears in one section. `dedupeFocusItems` in the contracts module
 * owns that precedence and is used here rather than reimplemented, so the shell
 * and the queue cannot disagree about which section an item belongs to.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { backgroundActions, decisions } from "@/db/schema/decisions";
import { aiSuggestions, workdayLiveEvents } from "@/db/schema/live";
import type { LiveEventSeverity } from "@/db/schema/live";
import type { AuthorityClass } from "@/db/schema/decisions";
import {
  dedupeFocusItems,
  FOCUS_SECTIONS,
  type FocusItemView,
  type FocusSection,
  type SourceAttribution,
} from "@/workday/contracts";
import { getRoleMoments } from "@/scenario/engine/state";
import { buildIntelligenceRail, uncertaintyFromEvidence } from "./rail";
import type { Language } from "@/i18n/labels";
import { momentToMinutes } from "@/domain/nfr/calculators";
import {
  getActions,
  getCommitteeItems,
  getDecisions,
  getExecutionReceipt,
  getKriReadings,
  getKris,
  getMissingEvidence,
  getMonitoringActivations,
  getObligations,
  getServices,
  getSharedEventIncident,
  getSuppliers,
} from "./workday";
import { buildRoleScope, detectChangedObjects, type RoleScope } from "./workspace";

const db = () => getDb();

/** The moment the shared event lands. Mirrors the scenario engine constant. */
const SHARED_EVENT_MOMENT = "14:05";

/** The Next list is short on purpose. Two or three tasks, never a backlog. */
export const NEXT_LIMIT = 3;

/** Watching is a glance, not an inventory. */
export const WATCHING_LIMIT = 6;

/* ==========================================================================
   Bilingual interface copy
   ========================================================================== */

interface Pair {
  en: string;
  de: string;
}

function say(pair: Pair, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

/**
 * Why an item appeared, one short clause per judgment kind.
 *
 * A clause rather than a sentence, and certainly not a paragraph. A queue row
 * whose reason runs to three lines defeats the purpose of the queue: the
 * reader stops scanning and starts reading, and the five second read the
 * redesign is built around is gone.
 */
const DECISION_REASON: Record<string, Pair> = {
  materiality: { en: "a materiality call only you can make", de: "eine Wesentlichkeitsfrage, die nur Sie entscheiden" },
  "control-effectiveness": { en: "the recorded control effectiveness is disputed", de: "die erfasste Kontrollwirksamkeit ist umstritten" },
  "residual-risk": { en: "the residual position needs your conclusion", de: "die Restrisikoposition braucht Ihren Schluss" },
  severity: { en: "severity is unset and the clock is running", de: "der Schweregrad ist offen und die Zeit laeuft" },
  criticality: { en: "the recorded criticality may be wrong", de: "die erfasste Kritikalitaet kann falsch sein" },
  applicability: { en: "applicability to an entity is a human call", de: "die Anwendbarkeit auf eine Einheit ist menschlich zu entscheiden" },
  "assurance-conclusion": { en: "the assurance conclusion is yours to sign", de: "die Pruefungsaussage ist von Ihnen zu zeichnen" },
  "conditional-approval": { en: "an approval condition is not satisfied", de: "eine Genehmigungsbedingung ist nicht erfuellt" },
  escalation: { en: "an escalation is waiting on your authority", de: "eine Eskalation wartet auf Ihre Befugnis" },
  agenda: { en: "the agenda position is yours to set", de: "die Agendaposition legen Sie fest" },
  "risk-acceptance": { en: "accepting this risk requires a named person", de: "die Risikoakzeptanz erfordert eine namentliche Person" },
};

const COPY: Record<string, Pair> = {
  decisionDefault: { en: "your judgment is required", de: "Ihr Urteil ist erforderlich" },
  recordDecision: { en: "Record the decision", de: "Entscheidung erfassen" },
  reviewSuggestion: { en: "Review and accept or change it", de: "Pruefen und annehmen oder aendern" },
  suggestionReady: { en: "a suggestion is prepared and cited", de: "ein Vorschlag ist vorbereitet und belegt" },
  suggestionNeedsUser: { en: "the suggestion stops at your approval", de: "der Vorschlag endet bei Ihrer Genehmigung" },
  escalated: { en: "escalated to you after a check", de: "nach einer Pruefung an Sie eskaliert" },
  reviewEscalation: { en: "Review the escalation", de: "Eskalation pruefen" },
  contradiction: { en: "two records do not agree", de: "zwei Datensaetze stimmen nicht ueberein" },
  resolveContradiction: { en: "Resolve the difference", de: "Unterschied klaeren" },
  eventDecision: { en: "an event arrived with a decision attached", de: "ein Ereignis mit angehaengter Entscheidung" },
  openEvent: { en: "Open the event", de: "Ereignis oeffnen" },
  sharedEvent: { en: "the shared event reaches your objects", de: "das gemeinsame Ereignis betrifft Ihre Objekte" },
  confirmReach: { en: "Confirm what it touches", de: "Betroffene Objekte bestaetigen" },
  /*
   * Says what was done, not that it complied.
   *
   * This read `completed within policy` and was attached to every automated
   * background item, around 30 renderings across the six role homes. No
   * policy evaluation is recorded for those rows, so the phrase asserted a
   * compliance determination the product had not made. The brief forbids
   * claiming regulatory compliance, and this was the clearest instance of it
   * in the application's own copy.
   */
  handledInPolicy: { en: "completed without your input", de: "ohne Ihre Mitwirkung abgeschlossen" },
  handledExecuted: { en: "executed after your approval", de: "nach Ihrer Genehmigung ausgefuehrt" },
  watchKriRed: { en: "outside the red threshold", de: "ausserhalb des roten Schwellenwerts" },
  watchKriAmber: { en: "past the amber threshold", de: "ueber dem gelben Schwellenwert" },
  watchEvidenceRequested: { en: "requested and not yet delivered", de: "angefordert und noch nicht geliefert" },
  watchEvidenceMissing: { en: "not in the corpus", de: "nicht im Bestand" },
  watchMonitoring: { en: "enhanced monitoring is active", de: "verstaerkte Ueberwachung ist aktiv" },
  watchSupplier: { en: "the arrangement is under reassessment", de: "die Vereinbarung wird neu bewertet" },
  watchSupplierExit: { en: "an exit is planned", de: "ein Ausstieg ist geplant" },
  watchService: { en: "the service is not operating normally", de: "der Dienst laeuft nicht normal" },
  watchActionOverdue: { en: "past its due date", de: "ueber dem Faelligkeitsdatum" },
  watchActionOpen: { en: "open with a date ahead", de: "offen mit Termin in der Zukunft" },
  watchObligationUnowned: { en: "extracted with no owner", de: "extrahiert ohne Eigentuemer" },
  watchCommitteeOffAgenda: { en: "raised and not yet on the agenda", de: "eingebracht und noch nicht auf der Agenda" },
  noAction: { en: "No action is needed from you", de: "Von Ihnen ist nichts erforderlich" },
  systemsChecked: { en: "systems checked", de: "Systeme geprueft" },
  recordsReconciled: { en: "records reconciled", de: "Datensaetze abgeglichen" },
  documentsClassified: { en: "documents classified", de: "Dokumente klassifiziert" },
  itemsRequested: { en: "missing items requested", de: "fehlende Unterlagen angefordert" },
  routineUpdates: { en: "routine updates applied", de: "Routineaktualisierungen vorgenommen" },
};

/** Labels for the grouped handled rows, one per background action kind. */
const BACKGROUND_KIND_LABEL: Record<string, Pair> = {
  "system-checked": COPY.systemsChecked as Pair,
  "record-reconciled": COPY.recordsReconciled as Pair,
  "document-classified": COPY.documentsClassified as Pair,
  "item-requested": COPY.itemsRequested as Pair,
  "routine-update": COPY.routineUpdates as Pair,
};

/**
 * The background kinds that belong under "Handled automatically".
 *
 * `escalated-to-human` and `contradiction-identified` are deliberately absent.
 * Both end with something a person has to look at, so filing them as handled
 * would be the one dishonest thing this section could do.
 */
export const HANDLED_BACKGROUND_KINDS = [
  "system-checked",
  "record-reconciled",
  "document-classified",
  "item-requested",
  "routine-update",
] as const;

/* ==========================================================================
   Candidates
   ========================================================================== */

/**
 * A queue item plus the work object it is about.
 *
 * The related key is kept beside the item rather than inside it because
 * `FocusItemView` is a contract this module does not own, and because the key
 * is only needed while the queue is being assembled. It drives one rule: a
 * subject the user is already being asked to decide is not also listed as
 * something being watched, which would be the same thing said twice in two
 * registers.
 */
export interface FocusCandidate {
  item: FocusItemView;
  relatedObjectKey: string | null;
}

function severityFromRank(rank: number, fromSharedEvent: boolean): LiveEventSeverity {
  if (fromSharedEvent) return "critical";
  if (rank <= 1) return "high";
  if (rank <= 3) return "medium";
  return "low";
}

/**
 * Sentences that must never be truncated away.
 *
 * A qualifier limits what the sentence before it claims, so dropping it
 * changes the meaning of what is left rather than merely shortening it. The
 * regulatory note is the case that matters here: the brief requires every
 * regulatory reference to carry it, and the seeded scenario text does, by
 * ending with it. Truncating to the first sentence removed it from all six
 * V3.1 screens while leaving the regulatory assertion on display. Verified
 * against the delivered HTML: `current` rendered it once on the regulatory
 * change role, `v3.1` rendered it zero times.
 *
 * They are split OFF before truncation and handed back separately, rather
 * than being stitched onto the end of a shortened line. A 49 character
 * disclosure appended to an 86 character row would simply move the problem
 * into the layout, and a qualifier set in the same size and colour as the
 * claim is easy to read past anyway.
 */
const QUALIFIER_TAILS = [
  "Illustrative regulatory context, not legal advice.",
  "Illustrativer regulatorischer Kontext, keine Rechtsberatung.",
  "Scenario figure, not a client outcome.",
  "Szenariowert, kein Kundenergebnis.",
] as const;

/** Separates the claim from any qualifier that limits it. */
export function splitQualifier(text: string): { body: string; qualifier: string } {
  for (const tail of QUALIFIER_TAILS) {
    const at = text.indexOf(tail);
    if (at >= 0) {
      return { body: `${text.slice(0, at)} ${text.slice(at + tail.length)}`.trim(), qualifier: tail };
    }
  }
  return { body: text.trim(), qualifier: "" };
}

/**
 * Whether the punctuation at `index` actually ends a clause.
 *
 * A bare search for `[.,;:]` does not, which produced a visible defect: the
 * `tprm` AI line read `Read the disaster recovery test report of 22`, because
 * the first period in the string belongs to the date `22.05.2026`. A boundary
 * is punctuation followed by whitespace or the end of the string, and a
 * period directly between two digits is never one.
 */
function isBoundary(text: string, index: number): boolean {
  const next = text[index + 1];
  /*
   * One rule, and it is enough. Punctuation inside a token is always
   * followed by more of the token, so requiring whitespace or the end of the
   * string covers the date `22.05.2026`, the identifier `CTR-2023-0117-A3`
   * and a decimal figure without naming any of them as special cases. A
   * period that genuinely ends a sentence is followed by a space.
   */
  return next === undefined || /\s/.test(next);
}

/** Finds the first clause or sentence boundary, or -1. */
function boundaryAt(text: string, pattern: RegExp): number {
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char !== undefined && pattern.test(char) && isBoundary(text, index)) return index;
  }
  return -1;
}

/** The first clause of a sentence, so a row stays a row. */
export function firstClause(text: string, limit = 86): string {
  const { body } = splitQualifier(text);
  const trimmed = body.trim();
  if (trimmed.length === 0) return "";
  const cut = boundaryAt(trimmed, /[.,;:]/);
  const clause = cut > 12 ? trimmed.slice(0, cut) : trimmed;
  if (clause.length <= limit) return clause;
  const space = clause.lastIndexOf(" ", limit);
  return `${clause.slice(0, space > 20 ? space : limit).trimEnd()} ...`;
}

/**
 * The first whole sentence, for a block that has room for one.
 *
 * `firstClause` is right for a row, which has one line and must not wrap. It
 * is wrong for the V3 Now card, which is a block with room for two lines: the
 * clause cut produced `... that each explain one symptom and ...`, breaking
 * before the clause that carried the point. A reader given the first half of
 * a thought has to open the item to learn why it is on screen, which is the
 * opposite of what the card is for.
 *
 * This cuts at the sentence boundary, and only falls back to a word boundary
 * when one sentence is longer than the limit.
 */
export function firstSentence(text: string, limit = 200): string {
  const { body } = splitQualifier(text);
  const trimmed = body.trim();
  if (trimmed.length === 0) return "";
  const stop = boundaryAt(trimmed, /\./);
  const sentence = stop > 20 ? trimmed.slice(0, stop + 1) : trimmed;
  if (sentence.length <= limit) return sentence;
  const space = sentence.lastIndexOf(" ", limit);
  return `${sentence.slice(0, space > 40 ? space : limit).trimEnd()} ...`;
}

/* ==========================================================================
   Ordering
   ========================================================================== */

const SEVERITY_RANK: Record<LiveEventSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

/**
 * The attention order, as named keys in the order they are applied.
 *
 * Plan section 4.3 states the order for Next in four words: materiality,
 * deadline, dependency, readiness. Each one is read from a field the item
 * already carries, so the order is a function of the row and nothing else:
 *
 *   materiality  `severity`. Derived upstream from the decision's priority
 *                rank, the suggestion's priority or the event's severity,
 *                and critical for anything raised by the shared event.
 *   deadline     `dueMoment`. An item with a due time comes before one
 *                without, and the earlier time first. Nothing is given a
 *                deadline it does not have.
 *   dependency   `section`. Work in `needs-you` is blocked on this person;
 *                work in `prepared` is ready for review and blocks nobody
 *                yet. So, at equal materiality and deadline, what is waiting
 *                on the reader comes first.
 *   readiness    `aiStatus`. An item whose preparation is finished (ready,
 *                needs the user, completed) can be acted on now, ahead of one
 *                the partner is still checking or only monitoring.
 *
 * Then two tie breaks that are not product rules but keep the order honest:
 * the item waiting longest first, and the identifier, so two renders of the
 * same queue agree and a test can assert the result.
 */
export const ATTENTION_ORDER = [
  "materiality",
  "deadline",
  "dependency",
  "readiness",
  "age",
  "identifier",
] as const;

export type AttentionKey = (typeof ATTENTION_ORDER)[number];

/** Lower is more demanding. `needs-you` blocks on the person, `prepared` does not. */
const DEPENDENCY_RANK: Record<FocusSection, number> = {
  "needs-you": 0,
  prepared: 1,
  handled: 2,
  watching: 3,
};

/** Preparation that is finished can be acted on; the rest is still in hand. */
const READY_AI_STATUSES: ReadonlySet<FocusItemView["aiStatus"]> = new Set([
  "ready",
  "needs-user",
  "completed",
]);

/**
 * Compares two items on one attention key.
 *
 * Exported with the key list so the test can check each key in isolation
 * rather than inferring them from a sorted result.
 */
export function compareOnAttentionKey(key: AttentionKey, a: FocusItemView, b: FocusItemView): number {
  switch (key) {
    case "materiality":
      return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    case "deadline": {
      const aDue = a.dueMoment === null ? Number.MAX_SAFE_INTEGER : momentMinutesSafe(a.dueMoment);
      const bDue = b.dueMoment === null ? Number.MAX_SAFE_INTEGER : momentMinutesSafe(b.dueMoment);
      return aDue === bDue ? 0 : aDue < bDue ? -1 : 1;
    }
    case "dependency":
      return DEPENDENCY_RANK[a.section] - DEPENDENCY_RANK[b.section];
    case "readiness":
      return Number(!READY_AI_STATUSES.has(a.aiStatus)) - Number(!READY_AI_STATUSES.has(b.aiStatus));
    case "age": {
      const aAge = momentMinutesSafe(a.arrivedAtMoment);
      const bAge = momentMinutesSafe(b.arrivedAtMoment);
      return aAge === bAge ? 0 : aAge < bAge ? -1 : 1;
    }
    case "identifier":
      return a.id.localeCompare(b.id);
  }
}

/** The full attention comparator: the keys in `ATTENTION_ORDER`, first difference wins. */
export function compareForAttention(a: FocusItemView, b: FocusItemView): number {
  for (const key of ATTENTION_ORDER) {
    const result = compareOnAttentionKey(key, a, b);
    if (result !== 0) return result;
  }
  return 0;
}

/**
 * Orders the active queue, Now first and then Next.
 *
 * This is the order the reader sees across sections. Within one section the
 * dependency key is equal for every item, so `orderFocusItems` below and this
 * function agree on any list drawn from a single section.
 */
export function orderForAttention(items: FocusItemView[]): FocusItemView[] {
  return [...items].sort(compareForAttention);
}

/**
 * Order within a section.
 *
 * The attention order applied to one section: severity first, then anything
 * with a due time ahead of anything without one, then finished preparation
 * ahead of preparation still in hand, then the oldest item, because an item
 * that has been waiting since 07:45 is more urgent than one that arrived two
 * minutes ago at the same severity. The identifier is the final tie break so
 * the order is stable between renders and a test can assert it.
 */
export function orderFocusItems(items: FocusItemView[]): FocusItemView[] {
  return orderForAttention(items);
}

/** Minutes for a moment that may not be a clock value. */
function momentMinutesSafe(moment: string): number {
  if (!/^\d{1,2}:\d{2}$/.test(moment)) return Number.MAX_SAFE_INTEGER;
  return momentToMinutes(moment);
}

/* ==========================================================================
   Assembly
   ========================================================================== */

export interface FocusQueue {
  roleId: RoleId;
  atMoment: string;
  /** Every item, deduplicated, ordered within its section. */
  items: FocusItemView[];
  sections: Record<FocusSection, FocusItemView[]>;
  /** Exactly one item, or none. The single thing that needs attention now. */
  now: FocusItemView | null;
  /** The next two or three, after Now. */
  next: FocusItemView[];
  watching: FocusItemView[];
  counts: Record<FocusSection, number>;
}

/**
 * Turns candidates into the queue.
 *
 * Pure, so the section rules can be tested against hand built candidates
 * without a database. The deduplication is delegated to the contract, and the
 * ordering to `orderFocusItems`, so this function only owns the watching
 * suppression rule and the Now and Next split.
 */
export function assembleFocusQueue(
  candidates: FocusCandidate[],
  roleId: RoleId,
  atMoment: string,
  limits: { next?: number; watching?: number } = {},
): FocusQueue {
  const nextLimit = limits.next ?? NEXT_LIMIT;
  const watchingLimit = limits.watching ?? WATCHING_LIMIT;

  const activeKeys = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.item.section !== "needs-you" && candidate.item.section !== "prepared") continue;
    if (candidate.relatedObjectKey !== null) activeKeys.add(candidate.relatedObjectKey);
    activeKeys.add(`${candidate.item.objectType}:${candidate.item.objectId}`);
  }

  const kept = candidates.filter((candidate) => {
    if (candidate.item.section !== "watching") return true;
    const ownKey = `${candidate.item.objectType}:${candidate.item.objectId}`;
    if (activeKeys.has(ownKey)) return false;
    return candidate.relatedObjectKey === null || !activeKeys.has(candidate.relatedObjectKey);
  });

  const deduped = dedupeFocusItems(kept.map((candidate) => candidate.item));

  const sections = {
    "needs-you": [] as FocusItemView[],
    prepared: [] as FocusItemView[],
    handled: [] as FocusItemView[],
    watching: [] as FocusItemView[],
  } satisfies Record<FocusSection, FocusItemView[]>;

  for (const item of deduped) sections[item.section].push(item);
  for (const section of FOCUS_SECTIONS) {
    sections[section] = orderFocusItems(sections[section]);
  }
  sections.watching = sections.watching.slice(0, watchingLimit);

  /*
   * Now is the most demanding single item, and Next is what follows it.
   *
   * The two active sections are merged and ordered by the attention order:
   * materiality, then deadline, then dependency, then readiness. Dependency is
   * the section, so at equal materiality and deadline work waiting on the
   * reader still comes before work prepared for review, which keeps the old
   * rule that a prepared suggestion does not displace an equally serious open
   * decision. What changed is that a critical item prepared for review (the
   * shared event reaching the role's own objects) is no longer ranked below a
   * medium decision merely because of the section it sits in.
   */
  const queue = orderForAttention([...sections["needs-you"], ...sections.prepared]);
  const now = queue[0] ?? null;
  const next = queue.slice(1, 1 + nextLimit);

  return {
    roleId,
    atMoment,
    items: [...sections["needs-you"], ...sections.prepared, ...sections.handled, ...sections.watching],
    sections,
    now,
    next,
    watching: sections.watching,
    counts: {
      "needs-you": sections["needs-you"].length,
      prepared: sections.prepared.length,
      handled: sections.handled.length,
      watching: sections.watching.length,
    },
  };
}

/* ==========================================================================
   Derivation from the scenario
   ========================================================================== */

export interface FocusQueueOptions {
  roleId: RoleId;
  atMoment: string;
  language: Language;
  runId?: string;
  scope?: RoleScope;
  /** Caps, overridable so a narrow layout can ask for a shorter list. */
  limits?: { next?: number; watching?: number };
}

/**
 * The assembled queue for one role at one moment, from real rows.
 *
 * Returns the sections, Now, Next and Watching already resolved. The shell
 * takes the flat list from `buildFocusQueue` instead, because it deduplicates
 * and splits the sections itself; this is the shape the focus components in
 * this feature render.
 */
export function buildFocusQueueView(options: FocusQueueOptions): FocusQueue {
  const candidates = buildFocusCandidates(options);
  return assembleFocusQueue(candidates, options.roleId, options.atMoment, options.limits);
}

/**
 * The flat queue, in the positional form the shell calls.
 *
 * Already deduplicated and ordered, so a caller that groups by section gets
 * the same answer as `buildFocusQueueView`. Passing it through
 * `dedupeFocusItems` a second time is harmless: the function is idempotent
 * because it keys on the object and keeps the most demanding section, and a
 * list that has already been collapsed collapses to itself.
 */
export function buildFocusQueue(
  roleId: RoleId,
  atMoment: string,
  language: Language,
  runId: string = DEFAULT_RUN_ID,
): FocusItemView[] {
  return buildFocusQueueView({ roleId, atMoment, language, runId }).items;
}

/**
 * The single context line under the page title.
 *
 * One sentence of counted fact. Not a narrative: the V1 Today route opened with
 * a lede paragraph describing the moment, and a reader had to finish it before
 * they could act. Three clauses of arithmetic replace it, and every number in
 * it is the length of a list the same screen is about to show.
 */
export function buildFocusContext(
  roleId: RoleId,
  atMoment: string,
  language: Language,
  runId: string = DEFAULT_RUN_ID,
): string {
  const queue = buildFocusQueueView({ roleId, atMoment, language, runId });
  const needs = queue.counts["needs-you"];
  const prepared = queue.counts.prepared;
  const handled = queue.counts.handled;

  if (language === "de") {
    const head =
      needs === 0
        ? `Um ${atMoment} benoetigt nichts Ihr Urteil`
        : `${needs} benoetigen Ihr Urteil`;
    return `${head}, ${prepared} zur Pruefung vorbereitet, ${handled} ohne Sie bearbeitet.`;
  }

  const head = needs === 0 ? `Nothing needs your judgment at ${atMoment}` : `${needs} need your judgment`;
  return `${head}, ${prepared} prepared for review, ${handled} handled without you.`;
}

/**
 * The one line version, for a screen that shows the other counts anyway.
 *
 * `buildFocusContext` states three counts, and on the V3.1 role home two of
 * them were already on the screen: `handled` is the number beside
 * `Handled automatically` a few rows below, and `prepared` counts a section
 * that home does not render as a section at all. So the line said one useful
 * thing and two things the reader could already see or could not act on.
 *
 * V2 keeps the three count form, where the sections it refers to are laid out
 * differently and the line is doing more work.
 */
export function buildFocusHeadline(
  roleId: RoleId,
  atMoment: string,
  language: Language,
  runId: string = DEFAULT_RUN_ID,
): string {
  const queue = buildFocusQueueView({ roleId, atMoment, language, runId });
  const needs = queue.counts["needs-you"];

  if (language === "de") {
    return needs === 0
      ? `Um ${atMoment} benoetigt nichts Ihr Urteil.`
      : `${needs} benoetigen Ihr Urteil.`;
  }
  return needs === 0
    ? `Nothing needs your judgment at ${atMoment}.`
    : `${needs} need your judgment.`;
}

/**
 * Evidence identifiers relevant to this role at this moment.
 *
 * The role's own timeline moment names the evidence the scenario puts in front
 * of them, and the open decisions add what their own judgments rest on. Taking
 * only one of the two sources would understate the corpus: a decision can cite
 * a document the moment does not surface, and a moment can surface a document
 * no open decision cites yet.
 */
export function focusEvidenceIds(
  roleId: RoleId,
  atMoment: string,
  runId: string = DEFAULT_RUN_ID,
): string[] {
  const ids = new Set<string>();

  for (const entry of getRoleMoments(roleId, runId)) {
    if (entry.roleMoment === null) continue;
    if (momentMinutesSafe(entry.event.moment) !== momentMinutesSafe(atMoment)) continue;
    for (const id of entry.roleMoment.evidenceIds) ids.add(id);
  }

  for (const entry of getDecisions(roleId, atMoment, runId)) {
    if (entry.decision.status !== "open") continue;
    for (const id of entry.decision.supportingEvidenceIds) ids.add(id);
    for (const id of entry.decision.opposingEvidenceIds) ids.add(id);
  }

  return [...ids];
}

export type ContextTriggerCounts = Record<
  "evidence" | "uncertainty" | "policy" | "approvals" | "activity" | "audit",
  number
>;

/**
 * Counts for the compact context triggers.
 *
 * Computed from the same rail assembly the drawer itself renders, so "Evidence
 * 7" on the trigger and seven citations in the drawer cannot disagree. A
 * trigger that promises a number the panel does not deliver is worse than no
 * trigger, because the reader stops trusting the other five.
 */
export function triggerCountsForRole(
  roleId: RoleId,
  atMoment: string,
  runId: string = DEFAULT_RUN_ID,
): ContextTriggerCounts {
  const evidenceIds = focusEvidenceIds(roleId, atMoment, runId);
  const rail = buildIntelligenceRail({
    roleId,
    atMoment,
    // Counts do not vary by language, and the rail requires one.
    language: "en",
    contextLabel: "",
    evidenceIds,
    uncertainty: uncertaintyFromEvidence(evidenceIds, runId),
    runId,
  });

  return {
    evidence: rail.evidence.length,
    uncertainty: rail.uncertainty.length + rail.contradictions.length,
    policy: rail.policies.length,
    approvals: rail.approvals.length,
    activity: rail.agentActivity.length,
    audit: rail.auditTrail.length,
  };
}

/**
 * Every candidate item, before deduplication.
 *
 * Exported because the integration tests assert on what each derivation
 * produces, and asserting on the assembled queue alone would hide a derivation
 * that silently returns nothing.
 */
export function buildFocusCandidates(options: FocusQueueOptions): FocusCandidate[] {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const { roleId, atMoment, language } = options;
  const scope = options.scope ?? buildRoleScope(roleId, runId);
  const now = momentToMinutes(atMoment);

  const candidates: FocusCandidate[] = [
    ...decisionCandidates(roleId, atMoment, language, runId),
    ...suggestionCandidates(roleId, atMoment, language, runId),
    ...eventCandidates(roleId, atMoment, language, runId),
    ...backgroundCandidates(roleId, atMoment, language, runId),
    ...sharedEventCandidates(roleId, atMoment, language, runId, scope),
    ...watchingCandidates(roleId, atMoment, language, runId, scope),
  ];

  // Nothing from the future. The queue is the day as far as it has been lived.
  return candidates.filter((candidate) => momentMinutesSafe(candidate.item.arrivedAtMoment) <= now);
}

/* ---- Decisions ---------------------------------------------------------- */

function decisionCandidates(
  roleId: RoleId,
  atMoment: string,
  language: Language,
  runId: string,
): FocusCandidate[] {
  const out: FocusCandidate[] = [];

  for (const entry of getDecisions(roleId, atMoment, runId)) {
    const row = entry.decision;
    const evidenceCount = new Set([...row.supportingEvidenceIds, ...row.opposingEvidenceIds]).size;
    const requiresApproval = entry.options.some((option) => option.requiresApproval);
    const authorityClass: AuthorityClass = requiresApproval ? "APPROVAL_REQUIRED" : "PROPOSE";
    const relatedObjectKey =
      row.relatedObjectKind && row.relatedObjectId
        ? `${row.relatedObjectKind}:${row.relatedObjectId}`
        : null;
    const title = language === "de" && row.titleDe.length > 0 ? row.titleDe : row.title;

    if (row.status === "open") {
      out.push({
        relatedObjectKey,
        item: {
          id: `focus-decision-${row.id}`,
          section: "needs-you",
          title,
          objectType: "decision",
          objectId: row.id,
          reason: say(
            DECISION_REASON[row.judgmentKind] ?? (COPY.decisionDefault as Pair),
            language,
          ),
          arrivedAtMoment: row.presentedAtMoment,
          sourceCount: evidenceCount,
          aiStatus: row.preparedPosition.length > 0 ? "ready" : "none",
          humanAction: say(COPY.recordDecision as Pair, language),
          dueMoment: null,
          decisionId: row.id,
          suggestionId: null,
          eventId: null,
          severity: severityFromRank(row.priorityRank, row.fromSharedEvent),
          authorityClass,
          href: `/workday/${roleId}/decisions#${row.id}`,
          /*
           * Carried through to the interface rather than only into the
           * `Watching` suppression key. It is the only field on a decision
           * row that differs between one profession and the next.
           */
          relatedObjectKind: row.relatedObjectKind,
          relatedObjectId: row.relatedObjectId,
        },
      });
      continue;
    }

    /*
     * A decided decision leaves the active queue, and lands under handled only
     * when something actually happened. A decision with no receipt line behind
     * it executed nothing, and filing it as handled would claim a change the
     * database does not contain.
     */
    if (row.status === "decided" && getExecutionReceipt(row.id, runId).length > 0) {
      out.push({
        relatedObjectKey,
        item: {
          id: `focus-decision-${row.id}`,
          section: "handled",
          title,
          objectType: "decision",
          objectId: row.id,
          reason: say(COPY.handledExecuted as Pair, language),
          arrivedAtMoment: row.decidedAtMoment ?? row.presentedAtMoment,
          sourceCount: evidenceCount,
          aiStatus: "completed",
          humanAction: null,
          dueMoment: null,
          decisionId: row.id,
          suggestionId: null,
          eventId: null,
          severity: "informational",
          authorityClass,
          href: `/workday/${roleId}/decisions#${row.id}`,
          /*
           * Carried through to the interface rather than only into the
           * `Watching` suppression key. It is the only field on a decision
           * row that differs between one profession and the next.
           */
          relatedObjectKind: row.relatedObjectKind,
          relatedObjectId: row.relatedObjectId,
        },
      });
    }
  }

  return out;
}

/* ---- Suggestions -------------------------------------------------------- */

function suggestionCandidates(
  roleId: RoleId,
  atMoment: string,
  language: Language,
  runId: string,
): FocusCandidate[] {
  const now = momentToMinutes(atMoment);
  const rows = db()
    .select()
    .from(aiSuggestions)
    .where(and(eq(aiSuggestions.runId, runId), eq(aiSuggestions.roleId, roleId)))
    .all()
    .filter((row) => momentMinutesSafe(row.atMoment) <= now)
    .filter((row) => row.dismissedAt === null)
    // An answered suggestion (accepted, modified, rejected, executed, expired) no longer asks anything of the person.
    .filter((row) => row.disposition === "new" || row.disposition === "reviewed");

  /*
   * A suggestion that prepared a decision is spent once the decision is made.
   *
   * Without this, recording a decision moved the decision out of "Needs you"
   * and the suggestion that prepared it moved straight back in: Home put the
   * question the person had just answered in front of them again, as "Review
   * and accept or change it". The decision's own row is what Home reports
   * from then on (under Done, and in the Partner update through its receipt).
   */
  const settled = new Set(
    getDecisions(roleId, atMoment, runId)
      .filter((entry) => entry.decision.status !== "open")
      .map((entry) => entry.decision.id),
  );

  const out: FocusCandidate[] = [];

  for (const row of rows) {
    if (row.decisionId !== null && settled.has(row.decisionId)) continue;
    const relatedObjectKey = `${row.objectType}:${row.objectId}`;
    /*
     * A suggestion that names a decision is about that decision, so it is
     * keyed to it. Without this the same control assessment would appear once
     * under "Needs you" as the decision and again under "Prepared for review"
     * as the suggestion, which is precisely the duplicate the precedence in the
     * contract exists to collapse.
     */
    const objectType = row.decisionId !== null ? "decision" : row.objectType;
    const objectId = row.decisionId ?? row.objectId;

    const common = {
      title: row.headline,
      objectType,
      objectId,
      arrivedAtMoment: row.atMoment,
      sourceCount: new Set([...row.evidenceIds, ...row.sourceConnectorIds]).size,
      decisionId: row.decisionId,
      suggestionId: row.id,
      eventId: row.eventId,
      severity: priorityToSeverity(row.priority),
      authorityClass: row.authorityClass,
      href:
        row.decisionId !== null
          ? `/workday/${roleId}/decisions#${row.decisionId}`
          : `/workday/${roleId}?select=${row.objectType}:${row.objectId}`,
    };

    if (row.status === "needs-user") {
      out.push({
        relatedObjectKey,
        item: {
          ...common,
          id: `focus-suggestion-user-${row.id}`,
          section: "needs-you",
          reason: say(COPY.suggestionNeedsUser as Pair, language),
          aiStatus: "needs-user",
          humanAction: say(COPY.reviewSuggestion as Pair, language),
          dueMoment: null,
        },
      });
    }

    if (row.status === "ready" || row.status === "needs-user") {
      out.push({
        relatedObjectKey,
        item: {
          ...common,
          id: `focus-suggestion-${row.id}`,
          section: "prepared",
          reason: say(COPY.suggestionReady as Pair, language),
          aiStatus: row.status,
          humanAction: say(COPY.reviewSuggestion as Pair, language),
          dueMoment: null,
        },
      });
    }

    if (row.status === "completed") {
      out.push({
        relatedObjectKey,
        item: {
          ...common,
          id: `focus-suggestion-${row.id}`,
          section: "handled",
          reason: say(COPY.handledInPolicy as Pair, language),
          aiStatus: "completed",
          humanAction: null,
          dueMoment: null,
          severity: "informational",
        },
      });
    }
  }

  return out;
}

function priorityToSeverity(priority: "critical" | "high" | "medium" | "low"): LiveEventSeverity {
  return priority;
}

/* ---- Live events -------------------------------------------------------- */

function eventCandidates(
  roleId: RoleId,
  atMoment: string,
  language: Language,
  runId: string,
): FocusCandidate[] {
  const now = momentToMinutes(atMoment);

  return db()
    .select()
    .from(workdayLiveEvents)
    .where(eq(workdayLiveEvents.runId, runId))
    .all()
    .filter((row) => row.roleIds.length === 0 || row.roleIds.includes(roleId))
    .filter((row) => momentMinutesSafe(row.atMoment) <= now)
    /*
     * Only events that put a decision in front of a person become their own
     * item. Every other event is already represented by the object it changed,
     * and promoting all of them would turn the queue back into a feed.
     */
    .filter((row) => row.requiresDecision && row.decisionId === null)
    .map<FocusCandidate>((row) => ({
      relatedObjectKey: `${row.objectType}:${row.objectId}`,
      item: {
        id: `focus-event-${row.id}`,
        section: "needs-you",
        title: language === "de" ? row.titleDe : row.title,
        objectType: row.objectType,
        objectId: row.objectId,
        reason: say(COPY.eventDecision as Pair, language),
        arrivedAtMoment: row.atMoment,
        sourceCount: new Set([...row.evidenceIds, ...row.sourceConnectorIds]).size,
        aiStatus: "monitoring",
        humanAction: say(COPY.openEvent as Pair, language),
        dueMoment: null,
        decisionId: null,
        suggestionId: null,
        eventId: row.id,
        severity: row.severity,
        authorityClass: null,
        href: `/workday/${roleId}?select=${row.objectType}:${row.objectId}`,
      },
    }));
}

/* ---- Background work ---------------------------------------------------- */

function backgroundCandidates(
  roleId: RoleId,
  atMoment: string,
  language: Language,
  runId: string,
): FocusCandidate[] {
  const now = momentToMinutes(atMoment);
  const rows = db()
    .select()
    .from(backgroundActions)
    .where(and(eq(backgroundActions.runId, runId), eq(backgroundActions.roleId, roleId)))
    .all()
    .filter((row) => momentMinutesSafe(row.performedAtMoment) <= now);

  const out: FocusCandidate[] = [];

  /*
   * Escalations and contradictions are individual rows, because each one ends
   * at a person and the person needs to know which object it was about.
   */
  for (const row of rows) {
    if (row.kind !== "escalated-to-human" && row.kind !== "contradiction-identified") continue;
    const escalation = row.kind === "escalated-to-human";
    out.push({
      relatedObjectKey: `${row.targetKind}:${row.targetId}`,
      item: {
        id: `focus-background-${row.id}`,
        section: "prepared",
        title: row.targetLabel.length > 0 ? row.targetLabel : row.targetId,
        objectType: row.targetKind,
        objectId: row.targetId,
        reason: say((escalation ? COPY.escalated : COPY.contradiction) as Pair, language),
        arrivedAtMoment: row.performedAtMoment,
        sourceCount: row.evidenceIds.length,
        aiStatus: "ready",
        humanAction: say(
          (escalation ? COPY.reviewEscalation : COPY.resolveContradiction) as Pair,
          language,
        ),
        dueMoment: null,
        decisionId: null,
        suggestionId: null,
        eventId: null,
        severity: escalation ? "high" : "medium",
        authorityClass: row.authorityClass,
        href: `/workday/${roleId}?select=${row.targetKind}:${row.targetId}`,
      },
    });
  }

  /*
   * The routine kinds are grouped, one row per kind with its count.
   *
   * Thirty-eight reconciliation rows under a collapsed section is a scroll,
   * not information. One row saying thirty-eight records were reconciled is the
   * same fact in a form a reader can use, and the individual rows remain in the
   * database for anyone who opens them.
   */
  for (const kind of HANDLED_BACKGROUND_KINDS) {
    const forKind = rows.filter((row) => row.kind === kind);
    if (forKind.length === 0) continue;
    const label = BACKGROUND_KIND_LABEL[kind];
    const latest = forKind.reduce(
      (newest, row) =>
        momentMinutesSafe(row.performedAtMoment) > momentMinutesSafe(newest) ? row.performedAtMoment : newest,
      forKind[0]?.performedAtMoment ?? atMoment,
    );
    out.push({
      relatedObjectKey: null,
      item: {
        id: `focus-handled-${kind}`,
        section: "handled",
        title: `${forKind.length} ${label ? say(label, language) : kind}`,
        objectType: "background-work",
        objectId: kind,
        reason: say(COPY.handledInPolicy as Pair, language),
        arrivedAtMoment: latest,
        sourceCount: new Set(forKind.map((row) => row.targetId)).size,
        aiStatus: "completed",
        humanAction: null,
        dueMoment: null,
        decisionId: null,
        suggestionId: null,
        eventId: null,
        severity: "informational",
        authorityClass: forKind[0]?.authorityClass ?? null,
        href: `/workday/${roleId}#handled-${kind}`,
      },
    });
  }

  return out;
}

/* ---- The shared event --------------------------------------------------- */

/**
 * The 14:05 event, for the roles it reaches.
 *
 * Every function sees this one beat, so the queue has to show it to all six
 * even though only two of them have a decision open on it at 14:05 itself. The
 * section depends on whether the role's own objects are in its path: a role
 * whose supplier, service or process the event touches is being asked to look,
 * and a role it has not reached yet is watching.
 *
 * The suppression in `assembleFocusQueue` then removes this item for the role
 * that already has a decision on the incident, because that role is not being
 * told about the event, it is being asked to classify it.
 */
function sharedEventCandidates(
  roleId: RoleId,
  atMoment: string,
  language: Language,
  runId: string,
  scope: RoleScope,
): FocusCandidate[] {
  if (momentToMinutes(atMoment) < momentToMinutes(SHARED_EVENT_MOMENT)) return [];
  const incident = getSharedEventIncident(runId);
  if (!incident) return [];

  const reaches =
    scope.groupScope ||
    incident.serviceIds.some((id) => scope.serviceIds.has(id) || scope.objectIds.has(id)) ||
    incident.supplierIds.some((id) => scope.supplierIds.has(id) || scope.objectIds.has(id)) ||
    incident.processIds.some((id) => scope.processIds.has(id));

  return [
    {
      relatedObjectKey: `incident:${incident.id}`,
      item: {
        id: `focus-shared-event-${incident.id}`,
        section: reaches ? "prepared" : "watching",
        title: language === "de" ? incident.titleDe : incident.title,
        objectType: "incident",
        objectId: incident.id,
        reason: say(COPY.sharedEvent as Pair, language),
        arrivedAtMoment: SHARED_EVENT_MOMENT,
        sourceCount: incident.serviceIds.length + incident.supplierIds.length,
        aiStatus: "monitoring",
        humanAction: reaches ? say(COPY.confirmReach as Pair, language) : null,
        dueMoment: null,
        decisionId: null,
        suggestionId: null,
        eventId: null,
        severity: "critical",
        authorityClass: null,
        href: `/workday/${roleId}?select=incident:${incident.id}`,
      },
    },
  ];
}

/* ---- Watching ----------------------------------------------------------- */

/**
 * The monitored subjects, from real monitoring.
 *
 * Six sources, every one of them a row somebody can open: indicators outside or
 * approaching a threshold, evidence that was requested and has not arrived,
 * monitoring a person switched on, supplier arrangements whose status is not
 * steady, services not operating normally, and the role's own open actions.
 * Obligations with no owner and committee items not yet on an agenda are
 * included for the two roles whose monitoring those genuinely are.
 *
 * Relevance is decided by the role's recorded scope rather than by a list per
 * role, so an indicator reaches the operational risk partner because it
 * indicates a risk in that partner's scope, not because this file says so.
 */
function watchingCandidates(
  roleId: RoleId,
  atMoment: string,
  language: Language,
  runId: string,
  scope: RoleScope,
): FocusCandidate[] {
  const out: FocusCandidate[] = [];

  const base = {
    section: "watching" as FocusSection,
    arrivedAtMoment: atMoment,
    aiStatus: "monitoring" as const,
    humanAction: null,
    dueMoment: null,
    decisionId: null,
    suggestionId: null,
    eventId: null,
    authorityClass: null,
  };

  /* 1. Indicators outside or approaching a threshold. */
  for (const kri of getKris(runId)) {
    if (kri.currentStatus !== "red" && kri.currentStatus !== "amber") continue;
    const inScope =
      scope.objectIds.has(kri.id) ||
      kri.riskIds.some((id) => scope.riskIds.has(id)) ||
      kri.processIds.some((id) => scope.processIds.has(id)) ||
      (scope.groupScope && kri.entityId.toUpperCase().includes("GROUP"));
    if (!inScope) continue;

    out.push({
      relatedObjectKey: `kri:${kri.id}`,
      item: {
        ...base,
        id: `focus-watch-kri-${kri.id}`,
        title: language === "de" ? kri.nameDe : kri.name,
        objectType: "kri",
        objectId: kri.id,
        reason: say(
          (kri.currentStatus === "red" ? COPY.watchKriRed : COPY.watchKriAmber) as Pair,
          language,
        ),
        sourceCount: getKriReadings(kri.id, runId).length,
        severity: kri.currentStatus === "red" ? "high" : "medium",
        href: `/workday/${roleId}?select=risk:${kri.id}`,
      },
    });
  }

  /* 2. Evidence requested and not delivered. */
  for (const document of getMissingEvidence(runId)) {
    if (!scope.evidenceIds.has(document.id)) continue;
    out.push({
      relatedObjectKey: `evidence:${document.id}`,
      item: {
        ...base,
        id: `focus-watch-evidence-${document.id}`,
        title: document.title,
        objectType: "evidence",
        objectId: document.id,
        reason: say(
          (document.status === "missing"
            ? COPY.watchEvidenceMissing
            : COPY.watchEvidenceRequested) as Pair,
          language,
        ),
        sourceCount: 1,
        severity: document.status === "missing" ? "high" : "medium",
        href: `/workday/${roleId}#evidence-${document.id}`,
      },
    });
  }

  /* 3. Monitoring somebody switched on. */
  for (const activation of getMonitoringActivations(runId)) {
    if (!activation.active) continue;
    if (!scope.objectIds.has(activation.subjectId)) continue;
    out.push({
      relatedObjectKey: `${activation.subjectKind}:${activation.subjectId}`,
      item: {
        ...base,
        id: `focus-watch-monitoring-${activation.id}`,
        title: activation.description,
        objectType: activation.subjectKind,
        objectId: activation.subjectId,
        reason: say(COPY.watchMonitoring as Pair, language),
        arrivedAtMoment: activation.activatedAtMoment,
        sourceCount: 1,
        severity: "medium",
        href: `/workday/${roleId}?select=supplier:${activation.subjectId}`,
      },
    });
  }

  /* 4. Supplier arrangements whose status is not steady. */
  for (const supplier of getSuppliers(runId)) {
    if (!scope.supplierIds.has(supplier.id)) continue;
    if (supplier.status !== "under-reassessment" && supplier.status !== "exit-planned") continue;
    out.push({
      relatedObjectKey: `supplier:${supplier.id}`,
      item: {
        ...base,
        id: `focus-watch-supplier-${supplier.id}`,
        title: supplier.name,
        objectType: "supplier",
        objectId: supplier.id,
        reason: say(
          (supplier.status === "exit-planned" ? COPY.watchSupplierExit : COPY.watchSupplier) as Pair,
          language,
        ),
        sourceCount: 1,
        severity: supplier.criticality === "critical" ? "high" : "medium",
        href: `/workday/${roleId}?select=supplier:${supplier.id}`,
      },
    });
  }

  /* 5. Services not operating normally. */
  for (const service of getServices(runId)) {
    if (!scope.serviceIds.has(service.id)) continue;
    if (service.operationalStatus === "normal") continue;
    out.push({
      relatedObjectKey: `service:${service.id}`,
      item: {
        ...base,
        id: `focus-watch-service-${service.id}`,
        title: language === "de" ? service.nameDe : service.name,
        objectType: "service",
        objectId: service.id,
        reason: say(COPY.watchService as Pair, language),
        sourceCount: service.supplierIds.length,
        severity: service.isImportantBusinessService ? "high" : "medium",
        href: `/workday/${roleId}?select=service:${service.id}`,
      },
    });
  }

  /* 6. The role's own open and overdue actions. */
  for (const action of getActions({ roleId }, runId)) {
    if (action.status !== "overdue" && action.status !== "open" && action.status !== "in-progress") {
      continue;
    }
    out.push({
      relatedObjectKey:
        action.relatedObjectKind && action.relatedObjectId
          ? `${action.relatedObjectKind}:${action.relatedObjectId}`
          : null,
      item: {
        ...base,
        id: `focus-watch-action-${action.id}`,
        title: language === "de" && action.titleDe.length > 0 ? action.titleDe : action.title,
        objectType: "action",
        objectId: action.id,
        reason: say(
          (action.status === "overdue" ? COPY.watchActionOverdue : COPY.watchActionOpen) as Pair,
          language,
        ),
        sourceCount: 1,
        severity: action.status === "overdue" ? "high" : "low",
        href: `/workday/${roleId}?select=action:${action.id}`,
      },
    });
  }

  /* 7. Obligations extracted with nobody named. */
  if (roleId === "regulatory-change") {
    for (const obligation of getObligations(undefined, runId)) {
      if (!obligation.isUnownedGap) continue;
      out.push({
        relatedObjectKey: `obligation:${obligation.id}`,
        item: {
          ...base,
          id: `focus-watch-obligation-${obligation.id}`,
          title: obligation.paragraphReference,
          objectType: "obligation",
          objectId: obligation.id,
          reason: say(COPY.watchObligationUnowned as Pair, language),
          sourceCount: 1,
          severity: "medium",
          href: `/workday/${roleId}?select=obligation:${obligation.id}`,
        },
      });
    }
  }

  /* 8. Committee items raised and not yet on an agenda. */
  if (roleId === "nfr-governance") {
    for (const item of getCommitteeItems(runId)) {
      if (item.onAgenda) continue;
      out.push({
        relatedObjectKey: item.themeId ? `theme:${item.themeId}` : null,
        item: {
          ...base,
          id: `focus-watch-committee-${item.id}`,
          title: language === "de" && item.titleDe.length > 0 ? item.titleDe : item.title,
          objectType: "committee-item",
          objectId: item.id,
          reason: say(COPY.watchCommitteeOffAgenda as Pair, language),
          sourceCount: 1,
          severity: item.itemType === "escalation" ? "high" : "low",
          href: `/workday/${roleId}#committee-${item.id}`,
        },
      });
    }
  }

  return out;
}

/* ==========================================================================
   The Now panel detail
   ========================================================================== */

/**
 * Everything the Now card shows, and nothing more.
 *
 * Deliberately a fixed shape with capped arrays. The acceptance criterion is
 * that a user understands the day in under five seconds, and the way that is
 * made true is structural: the card cannot grow, because the view model it
 * renders cannot carry more than one line of each kind plus two changes and
 * three completed checks.
 */
export interface NowDetail {
  item: FocusItemView;
  /** Why it appeared. One clause. */
  why: string;
  /**
   * A qualifier that limits what `why` claims, or an empty string.
   *
   * Separate from `why` so it can be rendered as its own line and cannot be
   * truncated away with the sentence it qualifies.
   */
  whyQualifier: string;
  /** What changed. At most two. */
  changed: string[];
  /** What the partner already completed. At most three. */
  completed: string[];
  /** What it needs from the user. One clause. */
  needs: string;
  /** The next action. */
  action: { label: string; href: string };
  /** Where the underlying data came from. */
  sources: SourceAttribution[];
}

/** Hard caps on the Now card. Exported so a test can assert the panel stays small. */
export const NOW_CHANGED_LIMIT = 2;
export const NOW_COMPLETED_LIMIT = 3;

export function buildNowDetail(
  item: FocusItemView,
  options: FocusQueueOptions & {
    sources?: SourceAttribution[];
    /**
     * How much of the why line to keep.
     *
     * `clause` is the V1 and V2 behaviour, where the line sits in a dense
     * panel beside other panels. `sentence` is for the V3 Now card, which is
     * the only block on the screen with the strongest treatment and can carry
     * a complete thought. Defaulted so the existing callers are untouched.
     */
    whyStyle?: "clause" | "sentence";
  },
): NowDetail {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const { roleId, atMoment, language } = options;
  const shorten = options.whyStyle === "sentence" ? firstSentence : firstClause;

  const changed = detectChangedObjects({
    roleId,
    atMoment,
    language,
    runId,
    cap: NOW_CHANGED_LIMIT,
  }).map((entry) => `${entry.label}, ${entry.reason}`);

  let why = item.reason;
  let whyQualifier = "";
  const completed: string[] = [];

  if (item.decisionId !== null) {
    const row = db()
      .select()
      .from(decisions)
      .where(and(eq(decisions.runId, runId), eq(decisions.id, item.decisionId)))
      .get();
    if (row) {
      why = shorten(row.whyThisMatters);
      whyQualifier = splitQualifier(row.whyThisMatters).qualifier;
      if (row.preparedPosition.length > 0) completed.push(firstClause(row.preparedPosition, 110));
      if (row.uncertaintyNote.length > 0) completed.push(firstClause(row.uncertaintyNote, 110));
    }
  }

  if (item.suggestionId !== null) {
    const row = db()
      .select()
      .from(aiSuggestions)
      .where(and(eq(aiSuggestions.runId, runId), eq(aiSuggestions.id, item.suggestionId)))
      .get();
    if (row) {
      why = shorten(row.whyItMatters);
      whyQualifier = splitQualifier(row.whyItMatters).qualifier;
      for (const line of [...row.actionsCompleted, ...row.checksCompleted]) {
        completed.push(firstClause(line, 110));
      }
    }
  }

  return {
    item,
    why,
    whyQualifier,
    changed: changed.slice(0, NOW_CHANGED_LIMIT),
    completed: completed.slice(0, NOW_COMPLETED_LIMIT),
    needs: item.humanAction ?? say(COPY.noAction as Pair, language),
    action: {
      label: item.humanAction ?? say(COPY.openEvent as Pair, language),
      href: item.href,
    },
    sources: options.sources ?? [],
  };
}
