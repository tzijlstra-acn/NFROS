/**
 * The structured outputs of the meeting lifecycle, and their validators.
 *
 * Two outputs, built the way the process engine builds a stage preparation
 * (`src/features/process/preparation-schema.ts`): a Zod schema that every
 * mode produces, and a content validator that every mode passes through.
 *
 *   The meeting preparation is what the AI Partner prepared for the reader
 *   before the meeting: the expected outcomes, the questions with the
 *   evidence behind them, the contradictions on record and what to watch.
 *   Its framing is bilingual in the output itself; the questions and
 *   contradictions quote the seeded record as it was written.
 *
 *   The minutes draft is the working document a person edits and confirms:
 *   facts, decisions, actions with owners and due dates, unresolved
 *   questions, evidence references and the distribution list. It is written
 *   in one language, the one the person works in, because it becomes a
 *   record and a record has one text.
 *
 * The content checks are the ones that matter. A cited evidence identifier
 * must be one the corpus holds; a turn must be one of the meeting's own; an
 * owner or a recipient must be a person in the institution; a decision or an
 * existing action must be one the role can see; a new action's due date
 * cannot be before the scenario day; and anything the AI wrote obeys the
 * product's copy rules. A person's own words are not held to the copy rules,
 * because they are the person's, but every reference they make is checked.
 *
 * Pure. Client safe.
 */

import { z } from "zod";
import type { Pair } from "../../copy";

export const MEETING_PREPARATION_SCHEMA_VERSION = "meeting-preparation-v1" as const;
export const MINUTES_DRAFT_SCHEMA_VERSION = "meeting-minutes-draft-v1" as const;

const ids = z.array(z.string().min(1).max(80)).max(24);
const key = z.string().min(1).max(40);
const origin = z.enum(["ai", "person"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const bilingual = z.object({ en: z.string().min(1).max(1400), de: z.string().min(1).max(1400) });

/* ==========================================================================
   Before the meeting
   ========================================================================== */

export const meetingPreparationSchema = z.object({
  schemaVersion: z.literal(MEETING_PREPARATION_SCHEMA_VERSION),
  /** Two or three sentences, counted from the pack and the record. */
  summary: bilingual,
  /** What the meeting should leave behind. */
  expectedOutcomes: z
    .array(
      z.object({
        text: bilingual,
        basis: z.enum(["objective", "decision", "stage", "minutes"]),
        refId: z.string().min(1).max(80).nullable(),
      }),
    )
    .max(10),
  /** The questions prepared for the reader, each with the documents it rests on. */
  questions: z.array(z.object({ text: z.string().min(1).max(1400), evidenceIds: ids })).max(12),
  /** Contradictions on record before the meeting. Each cites at least one document. */
  contradictions: z
    .array(
      z.object({
        text: z.string().min(1).max(1400),
        evidenceIds: z.array(z.string().min(1).max(80)).min(1).max(8),
        objectId: z.string().min(1).max(80).nullable(),
      }),
    )
    .max(8),
  /** Short counted warnings: documents needing attention, overdue work due before the meeting. */
  watch: z.array(bilingual).max(8),
  /** What this preparation cannot say, and why. */
  limitations: z.array(bilingual).max(4),
});

export type MeetingPreparationOutput = z.infer<typeof meetingPreparationSchema>;

/* ==========================================================================
   After the meeting
   ========================================================================== */

export const MINUTES_DECISION_OUTCOMES = ["agreed", "not-agreed", "deferred", "referred"] as const;
export type MinutesDecisionOutcome = (typeof MINUTES_DECISION_OUTCOMES)[number];

export const MINUTES_ITEM_KINDS = ["fact", "decision", "action", "unresolved"] as const;
export type MinutesItemKind = (typeof MINUTES_ITEM_KINDS)[number];

const factSchema = z.object({
  key,
  text: z.string().trim().min(1).max(1600),
  evidenceIds: ids,
  turnIds: ids,
  origin,
});

const decisionSchema = z.object({
  key,
  text: z.string().trim().min(1).max(1600),
  /** An existing decision the role can see, or null for one the meeting only records. */
  decisionId: z.string().min(1).max(80).nullable(),
  outcome: z.enum(MINUTES_DECISION_OUTCOMES),
  turnIds: ids,
  origin,
});

const actionSchema = z.object({
  key,
  title: z.string().trim().min(1).max(240),
  /** Set when the minutes follow up an action that already exists, rather than raising a new one. */
  existingActionId: z.string().min(1).max(80).nullable(),
  /** The accountable person. Accountability is never empty on a confirmed action. */
  ownerUserId: z.string().min(1).max(40).nullable(),
  /** Who delivers it, when that is outside the institution: a supplier contact. */
  ownerLabel: z.string().trim().max(200),
  dueOn: isoDate.nullable(),
  kind: z.string().min(1).max(40),
  completionCondition: z.string().trim().max(600),
  evidenceIds: ids,
  turnIds: ids,
  origin,
});

const unresolvedSchema = z.object({
  key,
  text: z.string().trim().min(1).max(1600),
  turnIds: ids,
  origin,
});

export const minutesDraftSchema = z.object({
  schemaVersion: z.literal(MINUTES_DRAFT_SCHEMA_VERSION),
  language: z.enum(["en", "de"]),
  summary: z.string().trim().max(2400),
  facts: z.array(factSchema).max(30),
  decisions: z.array(decisionSchema).max(12),
  actions: z.array(actionSchema).max(20),
  unresolved: z.array(unresolvedSchema).max(20),
  evidenceIds: z.array(z.string().min(1).max(80)).max(40),
  distribution: z.array(z.string().min(1).max(40)).max(30),
});

export type MinutesDraft = z.infer<typeof minutesDraftSchema>;
export type MinutesFact = MinutesDraft["facts"][number];
export type MinutesDecision = MinutesDraft["decisions"][number];
export type MinutesAction = MinutesDraft["actions"][number];
export type MinutesUnresolved = MinutesDraft["unresolved"][number];

export function emptyMinutesDraft(language: "en" | "de"): MinutesDraft {
  return {
    schemaVersion: MINUTES_DRAFT_SCHEMA_VERSION,
    language,
    summary: "",
    facts: [],
    decisions: [],
    actions: [],
    unresolved: [],
    evidenceIds: [],
    distribution: [],
  };
}

/* ==========================================================================
   Validation
   ========================================================================== */

export interface ValidationFailure {
  path: string;
  message: Pair;
}

export type Validation<T> = { ok: true; output: T } | { ok: false; failures: ValidationFailure[] };

/*
 * The characters are built from their code points so this file itself stays
 * ASCII, which is what the repository copy check requires of every source.
 */
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);
const UMLAUTS = [0xe4, 0xf6, 0xfc, 0xc4, 0xd6, 0xdc, 0xdf].map((code) => String.fromCharCode(code)).join("");
const GERMAN_UMLAUTS = new RegExp(`[${UMLAUTS}]`);
const FORBIDDEN_CHARACTERS: Array<{ pattern: RegExp; name: Pair }> = [
  { pattern: new RegExp(EM_DASH), name: { en: "an em dash", de: "einen Geviertstrich" } },
  { pattern: new RegExp(EN_DASH), name: { en: "an en dash", de: "einen Halbgeviertstrich" } },
  { pattern: /\s--\s/, name: { en: "a double hyphen used as punctuation", de: "einen doppelten Bindestrich als Satzzeichen" } },
];
const FORBIDDEN_TERMS = [/\bLLM\b/i, /\bstub\b/i, /\bOpenAI\b/i, /\bGPT\b/i, /\broutine handler\b/i];

function walkStrings(value: unknown, path: string, visit: (text: string, path: string) => void): void {
  if (typeof value === "string") {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => walkStrings(child, `${path}[${index}]`, visit));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [name, child] of Object.entries(value as Record<string, unknown>)) {
      walkStrings(child, path.length > 0 ? `${path}.${name}` : name, visit);
    }
  }
}

/** The product's copy rules, over every string of an AI output. */
function copyRuleFailures(output: unknown, germanPaths: (path: string) => boolean): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  walkStrings(output, "", (text, path) => {
    for (const forbidden of FORBIDDEN_CHARACTERS) {
      if (forbidden.pattern.test(text)) {
        failures.push({ path, message: { en: `The text contains ${forbidden.name.en}.`, de: `Der Text enthaelt ${forbidden.name.de}.` } });
      }
    }
    if (germanPaths(path) && GERMAN_UMLAUTS.test(text)) {
      failures.push({ path, message: { en: "German text must use ASCII transliteration.", de: "Deutscher Text muss ASCII-Umschrift verwenden." } });
    }
    for (const term of FORBIDDEN_TERMS) {
      if (term.test(text)) {
        failures.push({ path, message: { en: "The text names internal technology.", de: "Der Text nennt interne Technik." } });
      }
    }
  });
  return failures;
}

function schemaFailures(issues: readonly z.core.$ZodIssue[]): ValidationFailure[] {
  return issues.slice(0, 12).map((issue) => ({
    path: issue.path.join("."),
    message: { en: issue.message, de: issue.message },
  }));
}

export function validateMeetingPreparation(
  candidate: unknown,
  context: { knownEvidenceIds: ReadonlySet<string> },
): Validation<MeetingPreparationOutput> {
  const parsed = meetingPreparationSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, failures: schemaFailures(parsed.error.issues) };
  const output = parsed.data;
  const failures: ValidationFailure[] = [];
  const checkIds = (list: readonly string[], path: string) => {
    for (const id of list) {
      if (!context.knownEvidenceIds.has(id)) {
        failures.push({ path, message: { en: `The evidence ${id} is not in the corpus.`, de: `Der Nachweis ${id} ist nicht im Bestand.` } });
      }
    }
  };
  output.questions.forEach((question, index) => checkIds(question.evidenceIds, `questions[${index}].evidenceIds`));
  output.contradictions.forEach((item, index) => checkIds(item.evidenceIds, `contradictions[${index}].evidenceIds`));
  failures.push(...copyRuleFailures(output, (path) => path.endsWith(".de")));
  return failures.length === 0 ? { ok: true, output } : { ok: false, failures };
}

export interface MinutesValidationContext {
  knownEvidenceIds: ReadonlySet<string>;
  knownTurnIds: ReadonlySet<string>;
  /** Decisions the role can see. */
  knownDecisionIds: ReadonlySet<string>;
  /** Open actions on the role's desk that the minutes may follow up. */
  openActionIds: ReadonlySet<string>;
  /** People who can hold accountability or receive the minutes: internal people. */
  internalPeople: ReadonlySet<string>;
  /** The action kinds the role's configuration defines. */
  actionKinds: ReadonlySet<string>;
  /** ISO date of the scenario day. */
  scenarioDate: string;
  /** Who wrote the draft: the AI's text obeys the copy rules too. */
  author: "ai" | "person";
  /** For confirmation: every new action needs an owner and a due date, and the draft cannot be empty. */
  forConfirmation?: boolean;
}

/**
 * Validates a minutes draft against the schema and the institution.
 *
 * An identifier outside the known sets is rejected rather than dropped, for
 * the reason the process engine gives: a citation that resolves to nothing is
 * exactly what makes a record untrustworthy, and removing it silently would
 * hide that it was written.
 */
export function validateMinutesDraft(candidate: unknown, context: MinutesValidationContext): Validation<MinutesDraft> {
  const parsed = minutesDraftSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, failures: schemaFailures(parsed.error.issues) };
  const draft = parsed.data;
  const failures: ValidationFailure[] = [];
  const fail = (path: string, en: string, de: string) => failures.push({ path, message: { en, de } });

  const keys = new Set<string>();
  const checkKey = (value: string, path: string) => {
    if (keys.has(value)) fail(path, `The item key ${value} is used twice.`, `Der Schluessel ${value} ist doppelt vergeben.`);
    keys.add(value);
  };
  const checkEvidence = (list: readonly string[], path: string) => {
    for (const id of list) {
      if (!context.knownEvidenceIds.has(id)) fail(path, `The evidence ${id} does not exist.`, `Der Nachweis ${id} existiert nicht.`);
    }
  };
  const checkTurns = (list: readonly string[], path: string) => {
    for (const id of list) {
      if (!context.knownTurnIds.has(id)) fail(path, `${id} is not a statement of this meeting.`, `${id} ist keine Aussage dieser Besprechung.`);
    }
  };

  draft.facts.forEach((fact, index) => {
    checkKey(fact.key, `facts[${index}].key`);
    checkEvidence(fact.evidenceIds, `facts[${index}].evidenceIds`);
    checkTurns(fact.turnIds, `facts[${index}].turnIds`);
  });

  draft.decisions.forEach((decision, index) => {
    checkKey(decision.key, `decisions[${index}].key`);
    checkTurns(decision.turnIds, `decisions[${index}].turnIds`);
    if (decision.decisionId !== null && !context.knownDecisionIds.has(decision.decisionId)) {
      fail(`decisions[${index}].decisionId`, `${decision.decisionId} is not a decision this role can see now.`, `${decision.decisionId} ist keine Entscheidung, die diese Rolle jetzt sehen kann.`);
    }
  });

  draft.actions.forEach((action, index) => {
    const path = `actions[${index}]`;
    checkKey(action.key, `${path}.key`);
    checkEvidence(action.evidenceIds, `${path}.evidenceIds`);
    checkTurns(action.turnIds, `${path}.turnIds`);
    if (action.existingActionId !== null) {
      if (!context.openActionIds.has(action.existingActionId)) {
        fail(`${path}.existingActionId`, `${action.existingActionId} is not an open action on this desk.`, `${action.existingActionId} ist keine offene Massnahme dieser Rolle.`);
      }
      return;
    }
    if (!context.actionKinds.has(action.kind)) {
      fail(`${path}.kind`, `${action.kind} is not an action kind of this role.`, `${action.kind} ist keine Massnahmenart dieser Rolle.`);
    }
    if (action.ownerUserId !== null && !context.internalPeople.has(action.ownerUserId)) {
      fail(`${path}.ownerUserId`, `${action.ownerUserId} cannot hold accountability for an action.`, `${action.ownerUserId} kann keine Verantwortung fuer eine Massnahme tragen.`);
    }
    if (action.dueOn !== null && action.dueOn < context.scenarioDate) {
      fail(`${path}.dueOn`, "A due date cannot be before the scenario day.", "Ein Faelligkeitsdatum kann nicht vor dem Szenariotag liegen.");
    }
    if (context.forConfirmation) {
      if (action.ownerUserId === null) {
        fail(`${path}.ownerUserId`, `"${action.title}" has no accountable owner.`, `"${action.title}" hat keine verantwortliche Person.`);
      }
      if (action.dueOn === null) {
        fail(`${path}.dueOn`, `"${action.title}" has no due date.`, `"${action.title}" hat kein Faelligkeitsdatum.`);
      }
    }
  });

  draft.unresolved.forEach((item, index) => {
    checkKey(item.key, `unresolved[${index}].key`);
    checkTurns(item.turnIds, `unresolved[${index}].turnIds`);
  });

  checkEvidence(draft.evidenceIds, "evidenceIds");
  for (const id of draft.distribution) {
    if (!context.internalPeople.has(id)) fail("distribution", `${id} cannot receive the minutes.`, `${id} kann das Protokoll nicht erhalten.`);
  }

  if (context.forConfirmation) {
    const empty =
      draft.summary.trim().length === 0 &&
      draft.facts.length === 0 &&
      draft.decisions.length === 0 &&
      draft.actions.length === 0 &&
      draft.unresolved.length === 0;
    if (empty) fail("summary", "The minutes are empty.", "Das Protokoll ist leer.");
  }

  if (context.author === "ai") failures.push(...copyRuleFailures(draft, () => draft.language === "de"));

  return failures.length === 0 ? { ok: true, output: draft } : { ok: false, failures };
}
