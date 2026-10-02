/**
 * Schema grader.
 *
 * Validates that the response envelope has the correct structure:
 * a non-empty parts array, each part has a kind and text field, and
 * no part kind is outside the known set.
 *
 * Illustrative regulatory context, not legal advice.
 * Synthetic institution and data.
 */

import type { EvalCase, AssistantResponseEnvelope, GraderResult } from "./types.js";

const KNOWN_PART_KINDS = new Set([
  "answer",
  "evidence",
  "uncertainty",
  "recommendation",
  "alternative",
  "proposed-action",
  "approval-request",
  "execution-receipt",
  "blocked",
  "follow-up",
  "source-status",
]);

/**
 * Validates the envelope structure.
 *
 * Checks:
 *   1. Parts array is present and non-empty.
 *   2. Each part has a kind field that is a string.
 *   3. Each part has a text field that is a string.
 *   4. No part kind is outside the known set.
 *   5. If expectedStructure is defined, mustHaveParts are present and
 *      mustNotHaveParts are absent.
 */
export function grade(testCase: EvalCase, response: AssistantResponseEnvelope): GraderResult {
  const failures: string[] = [];

  if (!Array.isArray(response.parts)) {
    return {
      grader: "schema",
      caseId: testCase.id,
      passed: false,
      score: 0.0,
      details: "Response envelope has no parts array.",
    };
  }

  if (response.parts.length === 0) {
    failures.push("Parts array is empty.");
  }

  for (let i = 0; i < response.parts.length; i++) {
    const part = response.parts[i];
    if (part === undefined) {
      failures.push(`Part at index ${i} is undefined.`);
      continue;
    }
    if (typeof part.kind !== "string" || part.kind.length === 0) {
      failures.push(`Part at index ${i} has no kind field.`);
    } else if (!KNOWN_PART_KINDS.has(part.kind)) {
      failures.push(`Part at index ${i} has unknown kind: ${part.kind}`);
    }
    if (typeof part.text !== "string") {
      failures.push(`Part at index ${i} has no text field.`);
    }
  }

  const struct = testCase.expectedStructure;
  if (struct) {
    const presentKinds = new Set(response.parts.map((p) => p.kind));

    for (const required of struct.mustHaveParts) {
      if (!presentKinds.has(required)) {
        failures.push(`Expected part kind "${required}" is missing from the response.`);
      }
    }

    for (const forbidden of struct.mustNotHaveParts) {
      if (presentKinds.has(forbidden)) {
        failures.push(`Forbidden part kind "${forbidden}" is present in the response.`);
      }
    }
  }

  const totalChecks = 3 + (struct ? struct.mustHaveParts.length + struct.mustNotHaveParts.length : 0);
  const score = failures.length === 0 ? 1.0 : Math.max(0, 1.0 - failures.length / totalChecks);

  return {
    grader: "schema",
    caseId: testCase.id,
    passed: failures.length === 0,
    score,
    details: failures.length === 0
      ? `Schema valid. ${response.parts.length} part(s) present.`
      : failures.join(" | "),
  };
}
