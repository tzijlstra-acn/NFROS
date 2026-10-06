/**
 * The AI Partner's own rules, pure and client safe.
 *
 * Three rules live here because two sides of the product must apply them
 * identically, and the only way to guarantee that is one function:
 *
 *   Which suggestions still wait for the person. The header's "N suggestions
 *   need you" and the dock's own count are both this rule over the same rows
 *   (audit T06), so the two can never disagree once a suggestion is answered.
 *
 *   Which disposition can follow which. A person answers an open suggestion
 *   (reviewed, accepted, modified, rejected); only the system records what
 *   came of an answer (executed, expired). An executed or expired suggestion
 *   is never reopened, because the history would then describe two different
 *   things under one identifier.
 *
 *   The feedback vocabulary the Partner offers, in the plan's order.
 *
 * Nothing here reads the database or React.
 */

import type { SuggestionDisposition, SuggestionStatus } from "@/db/schema/live";

/* ==========================================================================
   Dispositions
   ========================================================================== */

/** Repeated as a value (not imported from the schema) so a client bundle never pulls the table builders. */
export const PARTNER_DISPOSITIONS = [
  "new",
  "reviewed",
  "accepted",
  "modified",
  "rejected",
  "executed",
  "expired",
] as const satisfies readonly SuggestionDisposition[];

/** The dispositions in which a suggestion still waits for the person's answer. */
export const OPEN_DISPOSITIONS: readonly SuggestionDisposition[] = ["new", "reviewed"];

export function isOpenDisposition(value: SuggestionDisposition | null | undefined): boolean {
  return OPEN_DISPOSITIONS.includes(value ?? "new");
}

/** What a person can do with a suggestion from the dock. */
export const PARTNER_ANSWERS = ["review", "accept", "modify", "reject", "snooze"] as const;
export type PartnerAnswer = (typeof PARTNER_ANSWERS)[number];

export function isPartnerAnswer(value: unknown): value is PartnerAnswer {
  return typeof value === "string" && (PARTNER_ANSWERS as readonly string[]).includes(value);
}

/** The disposition a person's answer records. Snoozing is a look without an answer. */
export const ANSWER_DISPOSITION: Record<PartnerAnswer, SuggestionDisposition> = {
  review: "reviewed",
  accept: "accepted",
  modify: "modified",
  reject: "rejected",
  snooze: "reviewed",
};

export type TransitionVerdict = { allowed: true } | { allowed: false; reason: "closed" | "not-a-person-step" | "system-only" };

/**
 * Whether a disposition may follow the current one.
 *
 * A person may answer only while the suggestion is open. The system records
 * the outcome of an answer: `executed` only after an acceptance or a
 * modification, `expired` from anything that is not already final.
 */
export function canTransition(
  from: SuggestionDisposition,
  to: SuggestionDisposition,
  actor: "human" | "system",
): TransitionVerdict {
  if (from === "executed" || from === "expired" || from === "rejected") return { allowed: false, reason: "closed" };
  if (actor === "human") {
    if (to === "executed" || to === "expired" || to === "new") return { allowed: false, reason: "system-only" };
    if (!isOpenDisposition(from)) return { allowed: false, reason: "closed" };
    return { allowed: true };
  }
  if (to === "executed") {
    return from === "accepted" || from === "modified" ? { allowed: true } : { allowed: false, reason: "not-a-person-step" };
  }
  if (to === "expired") return { allowed: true };
  return { allowed: false, reason: "not-a-person-step" };
}

/* ==========================================================================
   The needs-you rule (header and dock)
   ========================================================================== */

export interface NeedsYouInput {
  status: SuggestionStatus;
  decisionRequired: boolean;
  disposition?: SuggestionDisposition | null;
}

/**
 * True when a suggestion waits for the person.
 *
 * Revealable (not monitoring, not checking, not dismissed), either waiting for
 * the user or requiring a decision, and not yet answered. An accepted
 * suggestion whose decision is still open no longer counts here: the decision
 * itself is on Decisions and is counted by the Decisions badge.
 */
export function suggestionNeedsYou(suggestion: NeedsYouInput): boolean {
  if (suggestion.status === "dismissed" || suggestion.status === "monitoring" || suggestion.status === "checking") {
    return false;
  }
  if (!isOpenDisposition(suggestion.disposition)) return false;
  return suggestion.status === "needs-user" || suggestion.decisionRequired;
}

export function countNeedingYou(suggestions: readonly NeedsYouInput[]): number {
  return suggestions.filter(suggestionNeedsYou).length;
}

/* ==========================================================================
   Feedback
   ========================================================================== */

/** Repeated from `AI_FEEDBACK_KINDS` for the client, in the plan's order. A unit test keeps the two equal. */
export const PARTNER_FEEDBACK_KINDS = [
  "useful",
  "not-useful",
  "wrong-source",
  "wrong-interpretation",
  "missing-context",
  "too-verbose",
] as const;
export type PartnerFeedbackKind = (typeof PARTNER_FEEDBACK_KINDS)[number];

export const PARTNER_FEEDBACK_TARGETS = ["suggestion", "chat-turn", "routine-run"] as const;
export type PartnerFeedbackTarget = (typeof PARTNER_FEEDBACK_TARGETS)[number];

export function isFeedbackKind(value: unknown): value is PartnerFeedbackKind {
  return typeof value === "string" && (PARTNER_FEEDBACK_KINDS as readonly string[]).includes(value);
}

export function isFeedbackTarget(value: unknown): value is PartnerFeedbackTarget {
  return typeof value === "string" && (PARTNER_FEEDBACK_TARGETS as readonly string[]).includes(value);
}

/** "Useful" and "Not useful" exclude each other; the four specific kinds may stand beside either. */
export function exclusiveWith(kind: PartnerFeedbackKind): PartnerFeedbackKind | null {
  if (kind === "useful") return "not-useful";
  if (kind === "not-useful") return "useful";
  return null;
}

/* ==========================================================================
   Snooze
   ========================================================================== */

/** How long a snooze holds a suggestion back, on the scenario clock. */
export const SNOOZE_MINUTES = 60;

export function snoozeUntil(moment: string, minutes = SNOOZE_MINUTES): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(moment);
  const base = match ? Number(match[1]) * 60 + Number(match[2]) : 0;
  const total = Math.min(23 * 60 + 59, base + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
