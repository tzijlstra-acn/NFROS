/**
 * Language grader.
 *
 * Checks that the response language matches the expected language in the
 * eval case context. Also checks that German cases use the required
 * banking terminology.
 *
 * Language detection is simple: German-specific characters and common
 * German function words are used as signal. This is intentionally not a
 * full language classifier; false positives are preferable to false
 * negatives for an eval context where the concern is a response that
 * silently switches language.
 *
 * Illustrative regulatory context, not legal advice.
 * Synthetic institution and data.
 */

import type { EvalCase, AssistantResponseEnvelope, GraderResult } from "./types.js";

/** Common German function words and their English equivalents absent in English text. */
const GERMAN_SIGNALS = [
  /\bund\b/i,
  /\bder\b/i,
  /\bdie\b/i,
  /\bdas\b/i,
  /\bist\b/i,
  /\bfuer\b/i,
  /\bkeine\b/i,
  /\bkein\b/i,
  /\bwird\b/i,
  /\bwurde\b/i,
  /\bsich\b/i,
  /\bsind\b/i,
];

function detectsGerman(text: string): boolean {
  const hits = GERMAN_SIGNALS.filter((re) => re.test(text)).length;
  return hits >= 3;
}

/**
 * Grades language conformance.
 *
 * When expectedLanguageBehavior is present:
 *   - Checks the response lang field matches the expected language.
 *   - For German ("de"), checks that the German signal words are present
 *     in the concatenated answer text.
 *   - Checks that required terminology appears in the response text.
 *
 * When no language behavior is specified, the grader passes trivially.
 */
export function grade(testCase: EvalCase, response: AssistantResponseEnvelope): GraderResult {
  const langBehavior = testCase.expectedLanguageBehavior;

  if (!langBehavior) {
    return {
      grader: "language",
      caseId: testCase.id,
      passed: true,
      score: 1.0,
      details: "No language behavior specified for this case.",
    };
  }

  const failures: string[] = [];
  const { outputLanguage, mustUseTerms } = langBehavior;
  const answerText = response.parts
    .filter((p) => p.kind === "answer" || p.kind === "evidence" || p.kind === "recommendation")
    .map((p) => p.text)
    .join(" ");

  if (response.lang && response.lang !== outputLanguage) {
    failures.push(
      `Response lang field is "${response.lang}" but expected "${outputLanguage}".`,
    );
  }

  if (outputLanguage === "de") {
    if (!detectsGerman(answerText)) {
      failures.push(
        `Response does not appear to be in German. Expected German output for case ${testCase.id}.`,
      );
    }
  }

  const normText = answerText.toLowerCase();
  for (const term of mustUseTerms) {
    if (!normText.includes(term.toLowerCase())) {
      failures.push(`Required term "${term}" not found in response text.`);
    }
  }

  const totalChecks = 1 + (outputLanguage === "de" ? 1 : 0) + mustUseTerms.length;
  const score = failures.length === 0 ? 1.0 : Math.max(0, 1.0 - failures.length / totalChecks);

  return {
    grader: "language",
    caseId: testCase.id,
    passed: failures.length === 0,
    score,
    details:
      failures.length === 0
        ? `Language check passed. Expected "${outputLanguage}". ${mustUseTerms.length} required term(s) found.`
        : failures.join(" | "),
  };
}
