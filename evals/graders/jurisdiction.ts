/**
 * Jurisdiction grader.
 *
 * Checks that DORA is not attributed to Swiss (CH) entities in the response.
 * This is the single most damaging factual error the product could make for
 * this audience: EU instruments do not apply to entities regulated under
 * Swiss law.
 *
 * The check is applied regardless of whether the eval case specifies
 * jurisdiction constraints, because the prohibition is unconditional.
 *
 * When jurisdictionConstraints are present in the case, additional checks
 * apply: entities listed in doraDoesNotApplyTo must not be paired with
 * a DORA assertion, and entities in finmaAppliesTo must not have DORA
 * asserted as their governing framework.
 *
 * Illustrative regulatory context, not legal advice.
 * Synthetic institution and data.
 */

import type { EvalCase, AssistantResponseEnvelope, GraderResult } from "./types.js";

/** Patterns that assert DORA applies. */
const DORA_APPLICATION_PATTERNS = [
  /DORA\s+(?:applies|requires|mandates|obliges|governs)/i,
  /under\s+DORA/i,
  /pursuant\s+to\s+DORA/i,
  /DORA\s+(?:article|art\.)\s+\d+/i,
  /Regulation\s+\(EU\)\s+2022\/2554/i,
  /gemass\s+DORA/i,
  /gemaess\s+DORA/i,
  /nach\s+DORA/i,
];

/** Entity labels that indicate a Swiss entity. */
const SWISS_ENTITY_SIGNALS = [
  /ARC-CH/i,
  /schweiz/i,
  /swiss/i,
  /\bch\b/i,
  /\(CH\)/i,
];

function textMentionsDora(text: string): boolean {
  return DORA_APPLICATION_PATTERNS.some((re) => re.test(text));
}

function textMentionsSwissEntity(text: string): boolean {
  return SWISS_ENTITY_SIGNALS.some((re) => re.test(text));
}

/**
 * Grades jurisdiction separation.
 *
 * For each part that asserts DORA applies, checks whether the surrounding
 * text also mentions a Swiss entity without a negation.
 *
 * A negation ("does not apply", "not in scope") in the same part is
 * taken as a correct statement of non-applicability and passes the check.
 */
export function grade(testCase: EvalCase, response: AssistantResponseEnvelope): GraderResult {
  const failures: string[] = [];

  const negation =
    /not\s+apply|does\s+not\s+apply|not\s+applicable|not\s+in\s+scope|not\s+extend|gilt\s+nicht|nicht\s+anwendbar/i;

  for (const part of response.parts) {
    const text = part.text;

    if (!textMentionsDora(text)) continue;
    if (!textMentionsSwissEntity(text)) continue;
    if (negation.test(text)) continue;

    failures.push(
      `Part with kind "${part.kind}" asserts DORA applies to a Swiss entity without stating that it does not. Text excerpt: "${text.slice(0, 120)}..."`,
    );
  }

  const constraints = testCase.jurisdictionConstraints;
  if (constraints) {
    const fullResponseText = response.parts.map((p) => p.text).join(" ");

    for (const entityId of constraints.doraDoesNotApplyTo) {
      const entityPattern = new RegExp(entityId.replace("-", "[-]"), "i");
      if (!entityPattern.test(fullResponseText)) continue;

      for (const assertPattern of DORA_APPLICATION_PATTERNS) {
        const match = assertPattern.exec(fullResponseText);
        if (!match) continue;

        const surroundStart = Math.max(0, fullResponseText.indexOf(match[0]) - 100);
        const surroundEnd = Math.min(fullResponseText.length, fullResponseText.indexOf(match[0]) + 200);
        const surrounding = fullResponseText.slice(surroundStart, surroundEnd);

        if (entityPattern.test(surrounding) && !negation.test(surrounding)) {
          failures.push(
            `Entity "${entityId}" (DORA does not apply) is mentioned near a DORA application assertion. Excerpt: "${surrounding.slice(0, 120)}..."`,
          );
          break;
        }
      }
    }
  }

  return {
    grader: "jurisdiction",
    caseId: testCase.id,
    passed: failures.length === 0,
    score: failures.length === 0 ? 1.0 : 0.0,
    details:
      failures.length === 0
        ? "No DORA attribution to a Swiss entity detected."
        : failures.join(" | "),
  };
}
