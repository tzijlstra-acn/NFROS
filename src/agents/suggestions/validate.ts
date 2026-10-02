/**
 * Structured validation before publication.
 *
 * Nothing reaches the interface until every check here passes. The checks are
 * ordered cheapest first, but they are all run rather than short circuited,
 * because a suggestion that fails three rules should report three rules: a
 * single failure message sends whoever is debugging it back round the loop
 * once per problem.
 *
 * This module is pure. Evidence resolution is passed in as a set rather than
 * read from the database, for two reasons. It makes every rule testable in the
 * unit suite without a seeded scenario, and it keeps the validator usable from
 * the seed script, which needs to validate authored content before writing it
 * and must not depend on rows it is in the middle of writing.
 */

import { z } from "zod";
import { aiSuggestionSchema, type AISuggestionContent } from "@/workday/contracts";
import { groundingSchema, type Grounding } from "@/agents/schemas";
import { TOOL_REGISTRY, type AuthorityClass } from "@/server/security/authority";

/*
 * Built from code points.
 *
 * This file exists to reject the em dash, so writing one literally here would
 * make the repository wide copy gate fail on the validator that enforces it.
 */
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

/** The disclosure that must accompany any regulatory reference. */
export const REGULATORY_DISCLOSURE = "Illustrative regulatory context, not legal advice.";

/**
 * The confidence above which a suggestion counts as high confidence.
 *
 * Constrained output may not cross this line. The number is on the published
 * 0 to 100 scale that `aiSuggestionSchema` uses.
 */
export const HIGH_CONFIDENCE_THRESHOLD = 70;

/**
 * The draft a generator produces, before it becomes a view model.
 *
 * `AISuggestionContent` is fixed by the shared contract and carries no field
 * for a tool name or a grounding block, but both are needed: the authority
 * class a recommendation would require has to be computed from the registry
 * rather than asserted in prose, and the five array discipline has to survive
 * into the suggestion rather than being dropped at this boundary.
 *
 * So the draft carries them alongside, the validator checks them, and the
 * generator projects the result down onto the contract plus the
 * `authorityClass` column. The alternative, parsing a tool name out of the
 * recommendation sentence, was tried and rejected: it made the copy read like
 * an API call and it silently resolved to READ whenever the parse missed.
 */
export const suggestionDraftSchema = aiSuggestionSchema.extend({
  /**
   * The registry tool the recommended action would use. Null only when
   * `recommendedAction` is also null.
   */
  recommendedToolName: z.string().max(80).nullable(),
  /** The five array grounding block. Never collapsed into one list. */
  grounding: groundingSchema,
});

export type SuggestionDraft = z.infer<typeof suggestionDraftSchema>;

export interface ValidationContext {
  /** Every evidence identifier that resolves to a real document. */
  knownEvidenceIds: ReadonlySet<string>;
  /** True when a required source was unavailable for this context. */
  constrained: boolean;
  /** The entity this suggestion concerns, so the jurisdiction rule can fire. */
  entityId: string;
  language: "en" | "de";
}

export type ValidationFailureCode =
  | "schema"
  | "dangling-evidence"
  | "unknown-tool"
  | "prohibited-tool"
  | "em-dash"
  | "provider-name"
  | "missing-disclosure"
  | "compliance-claim"
  | "savings-claim"
  | "swiss-dora"
  | "confidence-while-constrained"
  | "inference-as-record"
  | "uncited-recommendation";

export interface ValidationFailure {
  code: ValidationFailureCode;
  detail: string;
}

export type ValidationResult =
  | {
      ok: true;
      content: AISuggestionContent;
      grounding: Grounding;
      authorityClass: AuthorityClass;
      recommendedToolName: string | null;
    }
  | { ok: false; failures: ValidationFailure[] };

/* ==========================================================================
   Copy rules
   ========================================================================== */

/**
 * Provider and model names.
 *
 * The product is neutral: no model name, provider name or trace metadata may
 * appear in the workday interface. The route may carry a model string inside a
 * separate details object behind an explicit disclosure, but it must never be
 * inside the suggestion copy, which is what this list defends.
 *
 * Word boundaries are used rather than substring matching because "gpt" and
 * "o3" are short enough to appear inside legitimate identifiers.
 */
const PROVIDER_NAME_PATTERNS: RegExp[] = [
  /\bopen\s?ai\b/i,
  /\bchat\s?gpt\b/i,
  /\bgpt(?:-[0-9a-z.]+)?\b/i,
  /\banthropic\b/i,
  /\bclaude\b/i,
  /\bgemini\b/i,
  /\bllama\b/i,
  /\bmistral\b/i,
  /\bcohere\b/i,
  /\bazure\s+open\s?ai\b/i,
  /\blanguage\s+model\b/i,
  /\blarge\s+language\s+model\b/i,
  /\btoken\s+usage\b/i,
  /\btemperature\s+setting\b/i,
];

/** Claims of compliance, which this product never makes. */
const COMPLIANCE_CLAIM_PATTERNS: RegExp[] = [
  /\b(?:is|are|was|were|remains?|stays?|fully|now)\s+compliant\b/i,
  /\bcompl(?:ies|ied|iant)\s+with\b/i,
  /\bmeets\s+all\b[^.]{0,30}\brequirements?\b/i,
  /\bin\s+full\s+compliance\b/i,
  /\bguarantees?\b/i,
  /\bwir\s+sind\s+konform\b/i,
  /\bvollstaendig\s+konform\b/i,
];

/** Claims of client savings, which the brief forbids outright. */
const SAVINGS_CLAIM_PATTERNS: RegExp[] = [
  /\bsav(?:es|ed|ing|ings)\b[^.]{0,40}\b(?:EUR|CHF|USD|euro|franc|hours?|days?|FTE)\b/i,
  /\b(?:EUR|CHF|USD)\s?[0-9][0-9.,]*\s*(?:k|m|million|thousand)?\s+(?:sav|benefit|return)/i,
  /\breduces?\s+cost\b/i,
  /\bcost\s+reduction\s+of\b/i,
  /\breturn\s+on\s+investment\b/i,
  /\bEinsparung(?:en)?\b/i,
];

/**
 * Tokens that make a sentence a regulatory reference.
 *
 * Kept narrow. A list that fired on the word "risk" would demand the
 * disclosure on every sentence in the product, and a disclosure attached to
 * everything carries no information.
 */
const REGULATORY_TOKENS: RegExp[] = [
  /\bDORA\b/,
  /\bEBA\b/i,
  /\bFINMA\b/i,
  /\bBaFin\b/i,
  /\bdigital\s+operational\s+resilience\b/i,
  /\bsupervisory\s+(?:authority|notification|expectation|requirement)\b/i,
  /\bregulatory\s+(?:requirement|obligation|notification|deadline)\b/i,
  /\bOBL-[0-9]/,
  /\bAufsichtsbehoerde\b/i,
  /\bregulatorische\s+Anforderung\b/i,
];

/** The Swiss entity, by every name the copy might use for it. */
const SWISS_ENTITY_PATTERNS: RegExp[] = [
  /\bARC-CH\b/,
  /\bArcadia\s+Bank\s+Schweiz\b/i,
  /\bSwiss\s+(?:entity|bank|lane|clearing)\b/i,
  /\bSchweizer?\s+(?:Einheit|Bank)\b/i,
];

/**
 * The European Union instruments that must never attach to the Swiss entity.
 *
 * This is the single most damaging factual error the product could make in
 * front of this audience, so it is a hard failure rather than a warning.
 */
const EU_INSTRUMENT_PATTERNS: RegExp[] = [
  /\bDORA\b/,
  /\bEBA\b/i,
  /\bdigital\s+operational\s+resilience\s+(?:act|regulation|framework)\b/i,
  /\bEU\s+(?:regulation|requirement)\b/i,
];

/** Every string in a draft that a human will read. */
export function copyStrings(draft: SuggestionDraft): string[] {
  return [
    draft.headline,
    draft.changeSummary,
    draft.whyItMatters,
    ...draft.checksCompleted,
    ...draft.actionsCompleted,
    draft.recommendedAction ?? "",
    ...draft.alternatives,
    ...draft.uncertainty,
    ...draft.grounding.verifiedFacts.map((entry) => entry.statement),
    ...draft.grounding.approvedRecords.map((entry) => entry.statement),
    ...draft.grounding.stakeholderStatements.map((entry) => entry.statement),
    ...draft.grounding.modelInference.map((entry) => entry.statement),
    ...draft.grounding.conflictingEvidence.map((entry) => entry.statement),
  ].filter((value) => value.length > 0);
}

/** Splits copy into sentences, for the rules that are sentence scoped. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * The jurisdiction rule.
 *
 * Checked per sentence rather than per document. A suggestion that discusses
 * the German notification requirement in one sentence and the Swiss position
 * in the next is correct and common in this scenario; one that puts the Swiss
 * entity and an EU instrument in the same sentence is the error.
 */
export function findSwissJurisdictionErrors(strings: readonly string[]): string[] {
  const errors: string[] = [];
  for (const value of strings) {
    for (const sentence of sentences(value)) {
      const mentionsSwiss = SWISS_ENTITY_PATTERNS.some((pattern) => pattern.test(sentence));
      if (!mentionsSwiss) continue;
      const instrument = EU_INSTRUMENT_PATTERNS.find((pattern) => pattern.test(sentence));
      if (!instrument) continue;
      /*
       * An explicit denial is correct copy and must pass.
       *
       * "The digital operational resilience regulation does not apply to the
       * Swiss entity" is the sentence the product most wants to be able to
       * say, and a naive co-occurrence rule would reject exactly it.
       */
      if (/\b(?:does\s+not\s+apply|not\s+applicable|nicht\s+anwendbar|gilt\s+nicht)\b/i.test(sentence)) {
        continue;
      }
      errors.push(sentence.slice(0, 180));
    }
  }
  return errors;
}

/* ==========================================================================
   The validator
   ========================================================================== */

export function validateSuggestionDraft(
  input: unknown,
  context: ValidationContext,
): ValidationResult {
  const failures: ValidationFailure[] = [];

  /* ---- 1. The schema ---- */
  const parsed = suggestionDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      failures: parsed.error.issues.map((issue) => ({
        code: "schema" as const,
        detail: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      })),
    };
  }

  const draft = parsed.data;
  const strings = copyStrings(draft);

  /* ---- 2. Every cited identifier resolves ---- */
  const cited = new Set<string>(draft.evidenceIds);
  for (const entry of [
    ...draft.grounding.verifiedFacts,
    ...draft.grounding.approvedRecords,
    ...draft.grounding.stakeholderStatements,
    ...draft.grounding.conflictingEvidence,
  ]) {
    for (const id of entry.sourceIds) cited.add(id);
  }

  for (const id of cited) {
    if (!context.knownEvidenceIds.has(id)) {
      failures.push({
        code: "dangling-evidence",
        detail: `The evidence identifier "${id}" does not resolve to a document in the corpus.`,
      });
    }
  }

  /* ---- 3. The recommended action maps onto the authority registry ---- */
  let authorityClass: AuthorityClass = "READ";
  if (draft.recommendedAction !== null && draft.recommendedAction.trim().length > 0) {
    const toolName = draft.recommendedToolName?.trim() ?? "";
    const tool = toolName.length > 0 ? TOOL_REGISTRY[toolName] : undefined;
    if (!tool) {
      failures.push({
        code: "unknown-tool",
        detail: `The recommended action does not name a tool in the authority registry, so the authority a person would need to approve it cannot be computed. Received "${toolName || "(empty)"}".`,
      });
    } else if (tool.authorityClass === "PROHIBITED") {
      failures.push({
        code: "prohibited-tool",
        detail: `The recommended action names "${toolName}", which is refused by design and must never be offered as a recommendation.`,
      });
    } else {
      authorityClass = tool.authorityClass;
    }
  }

  /* ---- 4. A recommendation must rest on a citation ---- */
  if (
    draft.recommendedAction !== null &&
    draft.recommendedAction.trim().length > 0 &&
    draft.evidenceIds.length === 0
  ) {
    failures.push({
      code: "uncited-recommendation",
      detail:
        "A recommendation is offered with no evidence identifier attached. An uncited recommendation is worse than an admission that the corpus does not support one.",
    });
  }

  /* ---- 5. Copy rules ---- */
  for (const value of strings) {
    if (value.includes(EM_DASH)) {
      failures.push({
        code: "em-dash",
        detail: `Copy contains the em dash character: "${value.slice(0, 120)}".`,
      });
      break;
    }
  }

  for (const value of strings) {
    const pattern = PROVIDER_NAME_PATTERNS.find((candidate) => candidate.test(value));
    if (pattern) {
      failures.push({
        code: "provider-name",
        detail: `Copy names a provider, a model or trace metadata, which must never reach the workday interface: "${value.slice(0, 120)}".`,
      });
      break;
    }
  }

  for (const value of strings) {
    const pattern = COMPLIANCE_CLAIM_PATTERNS.find((candidate) => candidate.test(value));
    if (pattern) {
      failures.push({
        code: "compliance-claim",
        detail: `Copy asserts compliance, which this product never claims: "${value.slice(0, 120)}".`,
      });
      break;
    }
  }

  for (const value of strings) {
    const pattern = SAVINGS_CLAIM_PATTERNS.find((candidate) => candidate.test(value));
    if (pattern) {
      failures.push({
        code: "savings-claim",
        detail: `Copy states a saving or a financial benefit, which this product never claims: "${value.slice(0, 120)}".`,
      });
      break;
    }
  }

  /* ---- 6. A regulatory reference carries the disclosure ---- */
  const joined = strings.join(" ");
  const touchesRegulation = REGULATORY_TOKENS.some((pattern) => pattern.test(joined));
  if (touchesRegulation && !joined.includes(REGULATORY_DISCLOSURE)) {
    failures.push({
      code: "missing-disclosure",
      detail: `A regulatory reference appears without the disclosure "${REGULATORY_DISCLOSURE}".`,
    });
  }

  /* ---- 7. The Swiss entity and the EU instruments stay apart ---- */
  for (const sentence of findSwissJurisdictionErrors(strings)) {
    failures.push({
      code: "swiss-dora",
      detail: `A sentence associates the Swiss entity with a European Union instrument: "${sentence}".`,
    });
  }

  /* ---- 8. Constrained output cannot be confident ---- */
  if (context.constrained && draft.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    failures.push({
      code: "confidence-while-constrained",
      detail: `Confidence is ${draft.confidence} while a required source is unavailable. Constrained output must stay below ${HIGH_CONFIDENCE_THRESHOLD}.`,
    });
  }

  /* ---- 9. An inference is never presented as a record ---- */
  for (const entry of draft.grounding.modelInference) {
    if (entry.provenance !== "model-inference") {
      failures.push({
        code: "inference-as-record",
        detail: `An entry in the inference section claims provenance "${entry.provenance}". The sections are the discipline; relabelling inside one defeats it.`,
      });
    }
  }
  for (const entry of draft.grounding.verifiedFacts) {
    if (entry.provenance === "model-inference") {
      failures.push({
        code: "inference-as-record",
        detail: "An inference is filed under verified facts.",
      });
    }
  }
  for (const entry of draft.grounding.approvedRecords) {
    if (entry.provenance === "model-inference") {
      failures.push({
        code: "inference-as-record",
        detail: "An inference is filed under approved records.",
      });
    }
  }

  if (failures.length > 0) return { ok: false, failures };

  /*
   * The contract shape is rebuilt field by field rather than spread, so a
   * later addition to the draft schema cannot leak an internal field into the
   * payload the browser receives.
   */
  const content: AISuggestionContent = {
    headline: draft.headline,
    changeSummary: draft.changeSummary,
    whyItMatters: draft.whyItMatters,
    checksCompleted: draft.checksCompleted,
    actionsCompleted: draft.actionsCompleted,
    recommendedAction: draft.recommendedAction,
    alternatives: draft.alternatives,
    evidenceIds: draft.evidenceIds,
    confidence: draft.confidence,
    uncertainty: draft.uncertainty,
    decisionRequired: draft.decisionRequired,
  };

  return {
    ok: true,
    content,
    grounding: draft.grounding,
    authorityClass,
    recommendedToolName: draft.recommendedToolName,
  };
}

/**
 * Strips the two dash characters from a string.
 *
 * Used on live model output before validation. The em dash is a hard copy
 * requirement rather than a judgment, so removing it is correct; everything
 * substantive is reported as a failure instead, because quietly rewriting a
 * risk conclusion would be worse than refusing to publish it.
 */
export function stripDashes(value: string): string {
  return value.split(EM_DASH).join(", ").split(EN_DASH).join(" to ");
}

/** Applies `stripDashes` across every copy field of a draft shaped object. */
export function sanitiseDraftCopy(draft: SuggestionDraft): SuggestionDraft {
  const fixStatements = (entries: Grounding["verifiedFacts"]): Grounding["verifiedFacts"] =>
    entries.map((entry) => ({ ...entry, statement: stripDashes(entry.statement) }));

  return {
    ...draft,
    headline: stripDashes(draft.headline),
    changeSummary: stripDashes(draft.changeSummary),
    whyItMatters: stripDashes(draft.whyItMatters),
    checksCompleted: draft.checksCompleted.map(stripDashes),
    actionsCompleted: draft.actionsCompleted.map(stripDashes),
    recommendedAction:
      draft.recommendedAction === null ? null : stripDashes(draft.recommendedAction),
    alternatives: draft.alternatives.map(stripDashes),
    uncertainty: draft.uncertainty.map(stripDashes),
    grounding: {
      verifiedFacts: fixStatements(draft.grounding.verifiedFacts),
      approvedRecords: fixStatements(draft.grounding.approvedRecords),
      stakeholderStatements: fixStatements(draft.grounding.stakeholderStatements),
      modelInference: fixStatements(draft.grounding.modelInference),
      conflictingEvidence: fixStatements(draft.grounding.conflictingEvidence),
    },
  };
}

/** Renders failures as one line for an audit record. */
export function describeFailures(failures: readonly ValidationFailure[]): string {
  return failures.map((failure) => `${failure.code}: ${failure.detail}`).join(" | ").slice(0, 900);
}
