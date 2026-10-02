/**
 * Source coverage grader.
 *
 * Checks that the required sources listed in the eval case are referenced
 * in the response. Source types (not document identifiers) are checked here,
 * because the eval cases list source types rather than specific document IDs.
 *
 * A source type match is a substring match against the text and refs of
 * all evidence and answer parts. This is intentionally loose: a response
 * that mentions "the control test report" matches the required source
 * "control-test-report". Precision checking of specific document IDs is
 * covered by the citations grader and the structural suite.
 *
 * Illustrative regulatory context, not legal advice.
 * Synthetic institution and data.
 */

import type { EvalCase, AssistantResponseEnvelope, GraderResult } from "./types.js";

/** Normalises a source type label for fuzzy matching. */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[-_\s]/g, "");
}

/**
 * Grades source coverage.
 *
 * For each required source, checks whether the source type label appears
 * (after normalisation) in any evidence or answer part text or refs.
 *
 * Score is the fraction of required sources that are covered. If no sources
 * are required, the grader passes with a score of 1.0.
 */
export function grade(testCase: EvalCase, response: AssistantResponseEnvelope): GraderResult {
  const required = testCase.requiredSources ?? [];

  if (required.length === 0) {
    return {
      grader: "source-coverage",
      caseId: testCase.id,
      passed: true,
      score: 1.0,
      details: "No required sources specified for this case.",
    };
  }

  const responseText = response.parts
    .filter((p) => p.kind === "evidence" || p.kind === "answer")
    .map((p) => {
      const refText = (p.refs ?? []).join(" ");
      return `${p.text} ${refText}`;
    })
    .join(" ");

  const normalisedText = normalise(responseText);
  const missing: string[] = [];
  const covered: string[] = [];

  for (const source of required) {
    const normSource = normalise(source);
    if (normalisedText.includes(normSource)) {
      covered.push(source);
    } else {
      missing.push(source);
    }
  }

  const score = covered.length / required.length;
  const passed = missing.length === 0;

  return {
    grader: "source-coverage",
    caseId: testCase.id,
    passed,
    score,
    details: passed
      ? `All ${required.length} required source type(s) referenced.`
      : `Missing ${missing.length} of ${required.length} required source type(s): ${missing.join(", ")}. Covered: ${covered.join(", ") || "none"}.`,
  };
}
