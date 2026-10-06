/**
 * The rules of the Actions module.
 *
 * Pure. Everything that decides what state an action is in, whether it is
 * material, whether it may close without evidence, and what the AI may say
 * about it, is a function here with no database and no React, because these
 * are the rules a reviewer will want to check and a test will want to pin.
 *
 * Three of them carry the accountability claims the plan makes, so they are
 * worth stating.
 *
 *   Updates are append only. Progress entries live in `action_updates` and
 *   are only ever inserted. The kind of entry is the `kind` column (migration
 *   0005 copied it from the identifier prefix, `AUP-CMP-...`, which entries
 *   still carry); an entry with an unknown kind is read by its prefix.
 *
 *   Blocked is a structured state on the action: `blocked_reason` and
 *   `blocked_since`, written by the entry that sets the blocker and cleared
 *   by the one that lifts it. An entry whose `statusAfter` is `blocked` still
 *   counts, for any history written before the columns existed. The action
 *   row keeps its own status, so every existing reader of `actions.status` is
 *   unaffected.
 *
 *   Material closure is human. Materiality is decided here from the role's
 *   configuration; the completion tool is classed APPROVAL_REQUIRED in the
 *   registry, so the gate refuses it without an approval granted by a person
 *   whatever this file says.
 */

import type { Language } from "@/i18n/labels";
import type { WorkActionRow, WorkActionUpdateRow } from "@/db/repositories/work-hub";
import { fill, say, type Pair } from "../../copy";
import { daysBetween, displayDate } from "../../model";
import type { WorkRoleConfig } from "../../roles/types";
import { ACTIONS_COPY } from "./copy";

/* ==========================================================================
   Entry kinds
   ========================================================================== */

/** The same list as `ACTION_UPDATE_KINDS` in the schema; a unit test keeps the two equal. */
export const ENTRY_KINDS = ["UPD", "CC", "BLK", "UNB", "ASN", "DUE", "CMP", "REO", "ESC", "RMD", "REQ", "MTG", "CRT"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

let entrySequence = 0;

/**
 * A new entry identifier of the given kind.
 *
 * A monotonic sequence rather than a random suffix, for the reason the
 * approval identifiers give in `decide.ts`: two entries written in the same
 * millisecond must not collide, and an identifier should not be random for no
 * benefit.
 */
export function newEntryId(kind: EntryKind): string {
  entrySequence += 1;
  return `AUP-${kind}-${Date.now().toString(36).toUpperCase()}-${String(entrySequence).padStart(4, "0")}`;
}

/** The kind of an entry, from its identifier. Unknown or seeded shapes read as an update. */
export function entryKindOf(entryId: string): EntryKind {
  const segment = entryId.split("-")[1] ?? "";
  return (ENTRY_KINDS as readonly string[]).includes(segment) ? (segment as EntryKind) : "UPD";
}

function isEntryKind(value: unknown): value is EntryKind {
  return typeof value === "string" && (ENTRY_KINDS as readonly string[]).includes(value);
}

/**
 * The kind of an entry: its `kind` column, or its identifier prefix when the
 * column does not hold a known kind. The column defaults to "UPD", so an entry
 * written before the column existed and not yet migrated reads by its prefix
 * rather than as a plain update.
 */
export function kindOfEntry(entry: { id: string; kind?: string | null }): EntryKind {
  if (isEntryKind(entry.kind) && entry.kind !== "UPD") return entry.kind;
  return entryKindOf(entry.id);
}

/* ==========================================================================
   State
   ========================================================================== */

export type EffectiveStatus = "open" | "in-progress" | "overdue" | "blocked" | "completed" | "cancelled";

export interface ActionState {
  open: boolean;
  completed: boolean;
  cancelled: boolean;
  overdue: boolean;
  /** Days past the due date. Zero when not overdue. */
  overdueDays: number;
  blocked: boolean;
  /** The note of the entry that recorded the current blocker. */
  blockerNote: string | null;
  /** The holder must act: they own it, or it is theirs to assign. */
  needsMe: boolean;
  /** Someone else must act: another owner, or a supplier contact. */
  waitingOn: string | null;
  unowned: boolean;
  effective: EffectiveStatus;
}

/**
 * Classifies one action for the person who holds the role.
 *
 * Overdue is computed against the scenario date as well as read from the
 * stored status, because a due date that has passed is overdue whether or not
 * anything wrote the word. The stored `overdue` is respected too, so the
 * seeded group count and this view cannot disagree about a row.
 */
export function classifyAction(
  row: Pick<WorkActionRow, "status" | "dueOn" | "ownerUserId" | "ownerLabel" | "isUnowned"> &
    Partial<Pick<WorkActionRow, "blockedReason">>,
  updates: ReadonlyArray<Pick<WorkActionUpdateRow, "statusAfter" | "note" | "at" | "id"> & Partial<Pick<WorkActionUpdateRow, "kind">>>,
  holderUserId: string | null,
  scenarioDate: string,
  ownerName: string | null,
): ActionState {
  const completed = row.status === "completed";
  const cancelled = row.status === "cancelled";
  const open = !completed && !cancelled;

  const pastDue = row.dueOn !== null && row.dueOn < scenarioDate;
  const overdue = open && (row.status === "overdue" || pastDue);
  const overdueDays = overdue && row.dueOn ? Math.max(daysBetween(row.dueOn, scenarioDate), 0) : 0;

  /*
   * The recorded blocker first. The history is read as well, so an action
   * whose history was written before the column existed is not shown as
   * moving when its last entry says it is blocked.
   */
  const recordedBlocker = typeof row.blockedReason === "string" ? row.blockedReason : null;
  const latest = updates.length > 0 ? updates[updates.length - 1] : undefined;
  const blocked = open && (recordedBlocker !== null || latest?.statusAfter === "blocked");
  let blockerNote: string | null = null;
  if (blocked) {
    blockerNote = recordedBlocker;
    for (let index = updates.length - 1; index >= 0 && blockerNote === null; index -= 1) {
      const entry = updates[index];
      if (entry && kindOfEntry(entry) === "BLK") blockerNote = entry.note;
    }
    blockerNote ??= latest?.note ?? null;
  }

  const unowned = row.ownerUserId === null || row.isUnowned;
  const external = row.ownerLabel.trim().length > 0 ? row.ownerLabel.trim() : null;
  const ownedByHolder = holderUserId !== null && row.ownerUserId === holderUserId;

  /*
   * Needs me: the holder owns it and nobody outside is delivering it, or it
   * has no owner at all and so is the raising role's to assign. Waiting on
   * others: anyone else is the one who must move next.
   */
  const needsMe = open && ((ownedByHolder && external === null) || unowned);
  const waitingOn = open && !needsMe ? (external ?? ownerName) : null;

  let effective: EffectiveStatus;
  if (completed) effective = "completed";
  else if (cancelled) effective = "cancelled";
  else if (blocked) effective = "blocked";
  else if (overdue) effective = "overdue";
  else effective = row.status === "in-progress" ? "in-progress" : "open";

  return { open, completed, cancelled, overdue, overdueDays, blocked, blockerNote, needsMe, waitingOn, unowned, effective };
}

/* ==========================================================================
   Materiality and evidence
   ========================================================================== */

export interface Materiality {
  material: boolean;
  reasons: string[];
}

/**
 * Whether an action is material.
 *
 * Three grounds, any one of which is enough: high priority, raised against an
 * issue, or of a kind the role treats as material whatever its priority. The
 * reasons are kept so the interface can say why before the person acts,
 * rather than refusing afterwards.
 */
export function actionMateriality(
  row: Pick<WorkActionRow, "priority" | "issueId" | "kind">,
  config: WorkRoleConfig,
  language: Language,
): Materiality {
  const reasons: string[] = [];
  if (row.priority === "high") reasons.push(say(ACTIONS_COPY.reasonHighPriority, language));
  if (row.issueId) reasons.push(fill(say(ACTIONS_COPY.reasonIssue, language), { issue: row.issueId }));
  if (config.materialActionKinds.includes(row.kind)) {
    const kindLabel = config.actionKinds[row.kind]?.label;
    reasons.push(
      fill(say(ACTIONS_COPY.reasonKind, language), {
        kind: (kindLabel ? say(kindLabel, language) : row.kind).toLowerCase(),
      }),
    );
  }
  return { material: reasons.length > 0, reasons };
}

/** Whether closing this action requires cited evidence. Unknown kinds require it. */
export function evidenceRequiredToComplete(kind: string, config: WorkRoleConfig): boolean {
  return config.actionKinds[kind]?.evidenceRequired ?? true;
}

/* ==========================================================================
   What the AI may say
   ========================================================================== */

/**
 * Words that name an activity rather than the result that closes it.
 *
 * Deterministic on purpose. This is an offline check over the action record,
 * labelled as a proposal, and a reviewer can read the whole rule here.
 */
const VAGUE_TERMS: ReadonlyArray<{ pattern: RegExp; term: string; why: Pair }> = [
  { pattern: /\breview(ed|s|ing)?\b/i, term: "review", why: { en: "names an activity, not the result that closes it", de: "nennt eine Taetigkeit, nicht das Ergebnis, das sie abschliesst" } },
  { pattern: /\bmonitor(ing|ed|s)?\b/i, term: "monitor", why: { en: "has no end point unless a reading or a date is named", de: "hat keinen Endpunkt, solange kein Messwert oder Datum genannt ist" } },
  { pattern: /\bensure\b/i, term: "ensure", why: { en: "states an aim, not a checkable outcome", de: "beschreibt ein Ziel, kein pruefbares Ergebnis" } },
  { pattern: /\bimprove\b/i, term: "improve", why: { en: "does not say by how much or measured against what", de: "sagt nicht, um wie viel oder woran gemessen" } },
  { pattern: /\baddress\b/i, term: "address", why: { en: "does not say what closing the point means", de: "sagt nicht, was das Schliessen des Punktes bedeutet" } },
  { pattern: /\bconsider\b/i, term: "consider", why: { en: "can be completed without anything changing", de: "kann erledigt sein, ohne dass sich etwas aendert" } },
  { pattern: /\bfollow[ -]up\b/i, term: "follow up", why: { en: "names a contact, not a result", de: "nennt einen Kontakt, kein Ergebnis" } },
  { pattern: /\blook into\b/i, term: "look into", why: { en: "names an investigation, not its conclusion", de: "nennt eine Untersuchung, nicht ihr Ergebnis" } },
  { pattern: /\balign\b/i, term: "align", why: { en: "does not say who must agree to what", de: "sagt nicht, wer wem zustimmen muss" } },
  { pattern: /\bas appropriate\b|\bwhere possible\b/i, term: "as appropriate", why: { en: "leaves the standard to the person being measured", de: "ueberlaesst den Massstab der bewerteten Person" } },
  { pattern: /\btimely\b|\bregularly\b/i, term: "timely", why: { en: "has no date or frequency to test against", de: "hat kein Datum und keine Frequenz zum Pruefen" } },
];

export interface VagueFinding {
  term: string;
  why: string;
}

/** Terms in the action's own title that a completion test could not be written against. */
export function vagueWording(title: string, language: Language): VagueFinding[] {
  const findings: VagueFinding[] = [];
  for (const entry of VAGUE_TERMS) {
    if (entry.pattern.test(title)) findings.push({ term: entry.term, why: say(entry.why, language) });
  }
  return findings;
}

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3),
  );
}

/** Jaccard similarity over the meaningful words of two titles. */
export function titleSimilarity(a: string, b: string): number {
  const left = words(a);
  const right = words(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

export interface DuplicateCandidate {
  id: string;
  title: string;
  reason: "same-object" | "similar-title";
}

/**
 * Open actions that may duplicate this one.
 *
 * Two grounds: the same object and the same kind with some shared wording,
 * or titles that share most of their meaningful words. An evidence request
 * raised from this action is linked work, not a duplicate, and is excluded.
 */
export function duplicateCandidates(
  target: Pick<WorkActionRow, "id" | "title" | "kind" | "relatedObjectId">,
  others: ReadonlyArray<Pick<WorkActionRow, "id" | "title" | "kind" | "relatedObjectId" | "relatedObjectKind" | "status">>,
): DuplicateCandidate[] {
  const out: DuplicateCandidate[] = [];
  for (const other of others) {
    if (other.id === target.id) continue;
    if (other.status === "completed" || other.status === "cancelled") continue;
    if (other.relatedObjectKind === "action" && other.relatedObjectId === target.id) continue;
    /*
     * Same object and kind is not enough on its own: a supplier under
     * reassessment carries several evidence requests that are plainly
     * different documents. Some shared wording is required as well, so the
     * check flags a likely repeat rather than every sibling.
     */
    const similarity = titleSimilarity(target.title, other.title);
    const sameObject =
      target.relatedObjectId !== null && other.relatedObjectId === target.relatedObjectId && other.kind === target.kind;
    if (sameObject && similarity >= 0.2) {
      out.push({ id: other.id, title: other.title, reason: "same-object" });
      continue;
    }
    if (similarity >= 0.5) {
      out.push({ id: other.id, title: other.title, reason: "similar-title" });
    }
  }
  return out;
}

/** A measurable completion condition for this action, from the role's template. */
export function proposedCompletionCondition(
  row: Pick<WorkActionRow, "kind" | "dueOn" | "relatedObjectId">,
  objectLabel: string,
  config: WorkRoleConfig,
  language: Language,
): string {
  const template = config.actionKinds[row.kind]?.completionTemplate ?? config.actionKinds["remediation"]?.completionTemplate;
  if (!template) return "";
  return fill(say(template, language), {
    object: objectLabel.length > 0 ? objectLabel : (row.relatedObjectId ?? ""),
    due: row.dueOn ? displayDate(row.dueOn) : language === "de" ? "zum vereinbarten Datum" : "the agreed date",
  });
}

/** The reminder text the AI drafts, from the role's template. */
export function composeReminder(
  input: {
    ownerName: string;
    title: string;
    reference: string;
    dueOn: string | null;
    condition: string;
  },
  config: WorkRoleConfig,
  language: Language,
): { subject: string; body: string } {
  const values = {
    owner: input.ownerName,
    title: input.title,
    reference: input.reference,
    due: input.dueOn ? displayDate(input.dueOn) : language === "de" ? "ohne Datum" : "no date",
    condition: input.condition,
  };
  return {
    subject: fill(say(config.professionalActions.reminderSubject, language), values),
    body: fill(say(config.professionalActions.reminderTemplate, language), values),
  };
}

/** A due date in the compact form a row needs. */
export function dueText(
  dueOn: string | null,
  state: Pick<ActionState, "overdue" | "overdueDays" | "completed">,
  completedOn: string | null,
  scenarioDate: string,
  language: Language,
): string {
  if (state.completed) {
    return completedOn ? fill(say(ACTIONS_COPY.completedOn, language), { date: displayDate(completedOn) }) : say(ACTIONS_COPY.statusCompletedFallback, language);
  }
  if (!dueOn) return say(ACTIONS_COPY.noDate, language);
  if (state.overdue) {
    return state.overdueDays <= 1
      ? say(ACTIONS_COPY.overdueByOne, language)
      : fill(say(ACTIONS_COPY.overdueBy, language), { days: state.overdueDays });
  }
  const days = daysBetween(scenarioDate, dueOn);
  if (days === 0) return say(ACTIONS_COPY.dueToday, language);
  if (days === 1) return say(ACTIONS_COPY.dueTomorrow, language);
  return fill(say(ACTIONS_COPY.dueIn, language), { days });
}
