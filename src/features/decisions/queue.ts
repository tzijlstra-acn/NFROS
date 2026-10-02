/**
 * Builds the V3.1 decision queue.
 *
 * Server side. Everything here is a read: the decisions and their options come
 * from `getDecisions`, the receipt from `getExecutionReceipt`, the accountable
 * person from the roles and users tables, and the authority position from the
 * authority gate's own `toolsAvailableAt`. Nothing about the domain, the
 * approval model or the audit trail is decided in this file, and nothing is
 * written by it.
 *
 * Two things are worth stating because they are the brief's requirements
 * rather than incidental choices.
 *
 * The row headline carries what distinguishes a decision. The defect this
 * replaces headed four rows "Record the decision", which is the shared action
 * class every decision carries, so four different judgments rendered as one
 * line repeated four times. The seeded titles already say what each decision
 * turns on, so the row leads with the title and the action class does not
 * appear on the row at all. A duplicate title, which the seed does not
 * currently contain, is disambiguated with its reference rather than left to
 * reproduce the defect quietly.
 *
 * The authority class is derived from the seeded `requiresApproval` flag with
 * exactly the rule `decisionCandidates` in `src/db/repositories/focus.ts`
 * already uses, so the home page and this queue cannot disagree about whether
 * a decision needs an approval. The class names themselves are
 * `AUTHORITY_CLASSES` from the decision schema.
 */

import type { AutonomyLevel, RoleId } from "@/db/schema/core";
import type { AuthorityClass } from "@/db/schema/decisions";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import {
  getDecisions,
  getEntity,
  getExecutionReceipt,
  getRole,
  getUser,
} from "@/db/repositories/workday";
import { firstClause, firstSentence } from "@/db/repositories/focus";
import { toolsAvailableAt } from "@/server/security/authority";
import { AUTONOMY_LABELS, NAV_LABELS, t, type Language } from "@/i18n/labels";
import {
  AUTHORITY_LABELS,
  CONSEQUENCE_LABELS,
  COPY,
  JUDGMENT_FALLBACK,
  JUDGMENT_LABELS,
  say,
} from "./copy";
import type {
  ActiveDecisionView,
  DecisionAuthorityView,
  DecisionOptionCard,
  DecisionQueueRow,
  DecisionQueueViewModel,
} from "./model";

export interface DecisionQueueOptions {
  roleId: RoleId;
  atMoment: string;
  language: Language;
  autonomyLevel: AutonomyLevel;
  runId?: string;
}

/**
 * One short paragraph, at most two sentences.
 *
 * Built on the repository's `firstSentence` rather than a second cutting rule,
 * because that function already learned the lesson about clause cuts breaking
 * before the clause that carried the point. Two sentences because the seeded
 * `whyThisMatters` opens with the stakes and then says what rests on them, and
 * the first sentence alone reads as an assertion with no support.
 */
export function shortParagraph(text: string, limit = 280): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "";

  /*
   * One sentence is enough when it is already a long one.
   *
   * Measured on the rendered screen: the seeded `whyThisMatters` for the
   * indicator decision opens with a 189 character sentence, and appending a
   * second one inside a 280 character budget left 90 characters, so the
   * paragraph ended "puts the second line's analysis ..." in the middle of the
   * clause that carried the point. A reader given the first half of a thought
   * has to open something else to finish it.
   */
  const first = firstSentence(trimmed, limit);
  if (first.endsWith("...") || first.length > limit - 120) return first;

  const rest = trimmed.slice(first.length).trim();
  if (rest.length === 0) return first;

  const second = firstSentence(rest, limit - first.length - 1);
  return second.length === 0 ? first : `${first} ${second}`;
}

/**
 * The authority position, as the gate reports it.
 *
 * `toolsAvailableAt` is the gate's own interface facing query: it evaluates
 * every tool in the registry for this role at this autonomy level and reports
 * which are reachable, treating "reachable but gated on an approval" as
 * available. So a class with no available tool is a class this role cannot
 * reach today, and the confirm control is disabled with the gate's wording
 * rather than a sentence invented here.
 */
function authorityView(options: {
  authorityClass: AuthorityClass;
  requiresApproval: boolean;
  roleId: RoleId;
  autonomyLevel: AutonomyLevel;
  approverName: string;
  approverTitle: string;
  language: Language;
}): DecisionAuthorityView {
  const { available, withheld } = toolsAvailableAt(options.autonomyLevel, options.roleId);
  const reachable = available.some((tool) => tool.authorityClass === options.authorityClass);
  const refusal = withheld.find((entry) => entry.tool.authorityClass === options.authorityClass);

  return {
    authorityClass: options.authorityClass,
    authorityLabel: say(AUTHORITY_LABELS[options.authorityClass], options.language),
    requiresApproval: options.requiresApproval,
    reachable,
    gateNote: reachable ? "" : (refusal?.reason ?? say(COPY.blockedByGate, options.language)),
    approverName: options.approverName,
    approverTitle: options.approverTitle,
    autonomyLabel: t(AUTONOMY_LABELS, options.autonomyLevel, options.language),
  };
}

function optionCards(
  options: ReturnType<typeof getDecisions>[number]["options"],
  language: Language,
): DecisionOptionCard[] {
  return options.map((option) => ({
    id: option.id,
    label: language === "de" && option.labelDe.length > 0 ? option.labelDe : option.label,
    implication: option.riskImplication,
    description: option.description,
    isRecommended: option.isRecommended,
    recommendationBasis: option.recommendationBasis,
    requiresApproval: option.requiresApproval,
    consequenceLabels: option.consequences.map((consequence) => {
      const label = CONSEQUENCE_LABELS[consequence.kind];
      return label ? say(label, language) : consequence.kind;
    }),
  }));
}

/**
 * Assembles the whole view for one role at one moment.
 *
 * Open decisions carry their full stage content, so selecting another row is a
 * local state change rather than a round trip. Recorded decisions carry the
 * row only: a decision already taken is a record, and the reader who wants the
 * receipt behind it opens the disclosure.
 */
export function buildDecisionQueueView(options: DecisionQueueOptions): DecisionQueueViewModel {
  const { roleId, atMoment, language, autonomyLevel } = options;
  const runId = options.runId ?? DEFAULT_RUN_ID;

  const role = getRole(roleId, runId);
  const holder = role ? getUser(role.holderUserId, runId) : undefined;
  const entity = role ? getEntity(role.entityId, runId) : undefined;

  const roleTitle = role ? (language === "de" ? role.titleDe : role.title) : roleId;
  const approverName = holder?.name ?? role?.holderUserId ?? roleId;
  const approverTitle = holder?.jobTitle ?? "";

  const entries = getDecisions(roleId, atMoment, runId);

  /*
   * Headlines are made unique before anything is rendered.
   *
   * The seeded titles are already distinct, so in normal use this does
   * nothing. It is here because the failure mode it guards against is the one
   * the brief names, and a screen that silently repeats a heading is worse
   * than one that shows a reference the reader did not need.
   */
  const seen = new Map<string, number>();
  const headlineFor = (title: string, reference: string): string => {
    const count = seen.get(title) ?? 0;
    seen.set(title, count + 1);
    return count === 0 ? title : `${title} (${reference})`;
  };

  const rows: DecisionQueueRow[] = [];
  const recorded: DecisionQueueRow[] = [];
  const details: ActiveDecisionView[] = [];

  for (const entry of entries) {
    const decision = entry.decision;
    const title =
      language === "de" && decision.titleDe.length > 0 ? decision.titleDe : decision.title;
    const headline = headlineFor(title, decision.reference);

    const requiresApproval = entry.options.some((option) => option.requiresApproval);
    const authorityClass: AuthorityClass = requiresApproval ? "APPROVAL_REQUIRED" : "PROPOSE";

    const evidenceCount = new Set([
      ...decision.supportingEvidenceIds,
      ...decision.opposingEvidenceIds,
    ]).size;

    const receipt = getExecutionReceipt(decision.id, runId);
    const chosen = entry.options.find((option) => option.id === decision.chosenOptionId);
    const judgment = JUDGMENT_LABELS[decision.judgmentKind] ?? JUDGMENT_FALLBACK;
    const isOpen = decision.status === "open";

    const row: DecisionQueueRow = {
      decisionId: decision.id,
      reference: decision.reference,
      headline,
      summary: firstClause(decision.question, 110),
      judgmentLabel: say(judgment, language),
      authorityClass,
      authorityLabel: say(AUTHORITY_LABELS[authorityClass], language),
      presentedAtMoment: decision.presentedAtMoment,
      decidedAtMoment: decision.decidedAtMoment,
      status: isOpen ? "open" : "recorded",
      fromSharedEvent: decision.fromSharedEvent,
      evidenceCount,
      optionCount: entry.options.length,
      receiptCount: receipt.length,
      chosenOptionLabel: chosen
        ? language === "de" && chosen.labelDe.length > 0
          ? chosen.labelDe
          : chosen.label
        : null,
    };

    if (!isOpen) {
      recorded.push(row);
      continue;
    }

    rows.push(row);
    details.push({
      decisionId: decision.id,
      reference: decision.reference,
      headline,
      question: decision.question,
      understandParagraph: shortParagraph(decision.whyThisMatters),
      evidenceCount,
      preparedPosition: shortParagraph(decision.preparedPosition, 240),
      uncertaintyNote: shortParagraph(decision.uncertaintyNote, 170),
      options: optionCards(entry.options, language),
      authority: authorityView({
        authorityClass,
        requiresApproval,
        roleId,
        autonomyLevel,
        approverName,
        approverTitle,
        language,
      }),
      status: "open",
      recordedRationale: decision.recordedRationale,
      chosenOptionId: decision.chosenOptionId,
      receiptStatements: receipt.map((line) => line.statement),
    });
  }

  const contextLine =
    language === "de"
      ? `${rows.length} offen, ${recorded.length} heute erfasst. ${say(COPY.oneAtATime, language)}`
      : `${rows.length} open, ${recorded.length} recorded today. ${say(COPY.oneAtATime, language)}`;

  return {
    roleId,
    language,
    currentMoment: atMoment,
    locationParts: [roleTitle, entity?.shortName ?? role?.entityId ?? ""].filter(
      (part) => part.length > 0,
    ),
    pageTitle: t(NAV_LABELS, "decisions", language),
    contextLine,
    rows,
    recorded,
    initialActiveId: rows[0]?.decisionId ?? null,
    details,
  };
}
