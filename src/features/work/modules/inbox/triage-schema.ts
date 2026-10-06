/**
 * The structured output of inbox triage and of a reply draft, and their
 * validators.
 *
 * Pure. The same discipline as the process engine's stage preparation
 * (`src/features/process/preparation-schema.ts`): every path that produces a
 * classification (the proposal captured before the day, and the offline
 * composition from the message) yields this shape, and every one passes
 * `validateTriageProposal` before anything is shown. The checks that matter
 * are the content checks:
 *
 *   the classification is one of the six the plan names;
 *   the rationale is present, because a classification is never shown
 *   without the reason for it;
 *   every identifier the rationale cites is one the message or its context
 *   actually holds;
 *   the copy obeys the product's rules (no em or en dash, no double hyphen as
 *   punctuation, no umlaut in German, no internal technology terms).
 *
 * A candidate that fails is not repaired and not shown. The caller falls
 * through to the next path, and says so.
 */

import { z } from "zod";
import type { Pair } from "../../copy";

export const INBOX_CLASSIFICATIONS = ["decision", "action", "evidence", "information", "delegate", "noise"] as const;
export type InboxClassification = (typeof INBOX_CLASSIFICATIONS)[number];

export function isInboxClassification(value: unknown): value is InboxClassification {
  return typeof value === "string" && (INBOX_CLASSIFICATIONS as readonly string[]).includes(value);
}

export const INBOX_TRIAGE_SCHEMA_VERSION = "inbox-triage-v1" as const;

const rationaleText = z.string().trim().min(12).max(1400);

export const triageProposalSchema = z.object({
  schemaVersion: z.literal(INBOX_TRIAGE_SCHEMA_VERSION),
  messageId: z.string().min(1).max(80),
  classification: z.enum(INBOX_CLASSIFICATIONS),
  /**
   * Why. English always; German when the path that produced it wrote one.
   * The proposals captured before the day were written in English only, and
   * the interface says so rather than presenting a translation nobody wrote.
   */
  rationale: z.object({ en: rationaleText, de: rationaleText.nullable() }),
  /** Zero to one, or null when the path does not estimate one. Offline composition does not. */
  confidence: z.number().min(0).max(1).nullable(),
  /** Identifiers the rationale relies on. Each must be one the message context holds. */
  citedIds: z.array(z.string().min(1).max(80)).max(8),
});

export type TriageProposal = z.infer<typeof triageProposalSchema>;

export const replyDraftSchema = z.object({
  subject: z.string().trim().min(3).max(240),
  body: z.string().trim().min(20).max(4000),
});

export type ReplyDraft = z.infer<typeof replyDraftSchema>;

export interface TriageValidationFailure {
  path: string;
  message: Pair;
}

export type Validation<T> = { ok: true; output: T } | { ok: false; failures: TriageValidationFailure[] };

/*
 * The characters are built from their code points so this file stays ASCII,
 * which is what the repository copy check requires of every source.
 */
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);
const UMLAUTS = new RegExp(`[${[0xe4, 0xf6, 0xfc, 0xc4, 0xd6, 0xdc, 0xdf].map((code) => String.fromCharCode(code)).join("")}]`);
const FORBIDDEN_TERMS = [/\bLLM\b/i, /\bstub\b/i, /\bOpenAI\b/i, /\bGPT\b/i, /\broutine handler\b/i];

/** The product's copy rules, applied to one string. Returns the failures, empty when it passes. */
export function copyFailures(value: string, path: string, german: boolean): TriageValidationFailure[] {
  const failures: TriageValidationFailure[] = [];
  if (value.includes(EM_DASH) || value.includes(EN_DASH)) {
    failures.push({ path, message: { en: "The text contains a dash used as punctuation.", de: "Der Text enthaelt einen Gedankenstrich." } });
  }
  if (/\s--\s/.test(value)) {
    failures.push({ path, message: { en: "The text contains a double hyphen used as punctuation.", de: "Der Text enthaelt einen doppelten Bindestrich als Satzzeichen." } });
  }
  if (german && UMLAUTS.test(value)) {
    failures.push({ path, message: { en: "German text must use ASCII transliteration.", de: "Deutscher Text muss ASCII-Umschrift verwenden." } });
  }
  if (FORBIDDEN_TERMS.some((term) => term.test(value))) {
    failures.push({ path, message: { en: "The text names internal technology.", de: "Der Text nennt interne Technik." } });
  }
  return failures;
}

function schemaFailures(issues: readonly z.core.$ZodIssue[]): TriageValidationFailure[] {
  return issues.slice(0, 8).map((issue) => ({
    path: issue.path.join("."),
    message: { en: issue.message, de: issue.message },
  }));
}

/**
 * Validates a candidate classification against the schema and the message.
 *
 * `knownIds` is every identifier the message context holds: the message, its
 * linked object, the earlier message it duplicates, the people it names, the
 * decisions and actions the role can see. A cited identifier outside it is a
 * failure, not something to drop silently.
 */
export function validateTriageProposal(
  candidate: unknown,
  context: { messageId: string; knownIds: ReadonlySet<string> },
): Validation<TriageProposal> {
  const parsed = triageProposalSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, failures: schemaFailures(parsed.error.issues) };

  const output = parsed.data;
  const failures: TriageValidationFailure[] = [];
  if (output.messageId !== context.messageId) {
    failures.push({
      path: "messageId",
      message: { en: "The proposal belongs to another message.", de: "Der Vorschlag gehoert zu einer anderen Nachricht." },
    });
  }
  output.citedIds.forEach((id, index) => {
    if (!context.knownIds.has(id)) {
      failures.push({
        path: `citedIds[${index}]`,
        message: { en: `${id} is not held by this message or its context.`, de: `${id} gehoert nicht zu dieser Nachricht oder ihrem Kontext.` },
      });
    }
  });
  failures.push(...copyFailures(output.rationale.en, "rationale.en", false));
  if (output.rationale.de !== null) failures.push(...copyFailures(output.rationale.de, "rationale.de", true));
  return failures.length === 0 ? { ok: true, output } : { ok: false, failures };
}

/** Validates a reply draft, AI or person, against the schema and the copy rules. */
export function validateReplyDraft(candidate: unknown, language: "en" | "de"): Validation<ReplyDraft> {
  const parsed = replyDraftSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, failures: schemaFailures(parsed.error.issues) };
  const failures = [
    ...copyFailures(parsed.data.subject, "subject", language === "de"),
    ...copyFailures(parsed.data.body, "body", language === "de"),
  ];
  return failures.length === 0 ? { ok: true, output: parsed.data } : { ok: false, failures };
}
