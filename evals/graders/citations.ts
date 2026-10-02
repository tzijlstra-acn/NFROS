/**
 * Citations grader.
 *
 * Checks that evidence parts carry refs (source identifiers) and that the
 * minimum number of sources referenced by the expectedCitations spec is met.
 *
 * Does not check whether the cited identifiers exist in the seeded corpus.
 * That is the responsibility of the structural evaluations in
 * src/agents/evaluations/suite.ts.
 *
 * Illustrative regulatory context, not legal advice.
 * Synthetic institution and data.
 */

import type { EvalCase, AssistantResponseEnvelope, GraderResult } from "./types.js";

/** Identifier pattern matching the product's naming conventions. */
const IDENTIFIER_PATTERN =
  /\b(?:EVD|CTL|TST|RSK|TP|CTR|INC|OBL|MSN|KRI|PRC|ITOL|DEC|IBS|SVC|CMT|AG|REG|EXC|UTC|P)-[0-9A-Za-z.-]+/g;

function extractIdentifiersFromText(text: string): string[] {
  return [...new Set(text.match(IDENTIFIER_PATTERN) ?? [])];
}

/**
 * Grades citation discipline.
 *
 * Checks:
 *   1. Evidence parts carry refs or mention identifiers in their text.
 *   2. The minimum source count from expectedCitations is satisfied.
 *
 * Score is proportional: partial credit when some but not all evidence
 * parts are cited.
 */
export function grade(testCase: EvalCase, response: AssistantResponseEnvelope): GraderResult {
  const failures: string[] = [];
  const allIdentifiers = new Set<string>();

  const evidenceParts = response.parts.filter((p) => p.kind === "evidence");
  let evidencePartsWithCitations = 0;

  for (const part of evidenceParts) {
    const refsFromField = part.refs ?? [];
    const refsFromText = extractIdentifiersFromText(part.text);
    const combined = new Set([...refsFromField, ...refsFromText]);

    if (combined.size > 0) {
      evidencePartsWithCitations += 1;
    }

    for (const id of combined) allIdentifiers.add(id);
  }

  if (evidenceParts.length > 0 && evidencePartsWithCitations === 0) {
    failures.push(
      `${evidenceParts.length} evidence part(s) present but none carry source identifiers.`,
    );
  } else if (evidenceParts.length > 0 && evidencePartsWithCitations < evidenceParts.length) {
    const missing = evidenceParts.length - evidencePartsWithCitations;
    failures.push(
      `${missing} of ${evidenceParts.length} evidence part(s) carry no source identifiers.`,
    );
  }

  const minSources = testCase.expectedCitations?.minimumSourcesReferenced ?? 0;
  if (allIdentifiers.size < minSources) {
    failures.push(
      `Expected at least ${minSources} source identifier(s); found ${allIdentifiers.size}.`,
    );
  }

  const score =
    failures.length === 0
      ? 1.0
      : evidenceParts.length === 0
        ? 1.0
        : evidencePartsWithCitations / evidenceParts.length;

  return {
    grader: "citations",
    caseId: testCase.id,
    passed: failures.length === 0,
    score,
    details:
      failures.length === 0
        ? `${allIdentifiers.size} unique identifier(s) cited across ${evidenceParts.length} evidence part(s).`
        : failures.join(" | "),
  };
}
