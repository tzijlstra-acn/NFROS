/**
 * Evaluation suite tests.
 *
 * These test the graders, not the product. The point is that a grader which
 * silently passes everything is worse than no grader at all, so each one is
 * checked against an input it must reject.
 *
 * The structural evaluations that read the database live in the integration
 * suite, because they need a seeded scenario. What is tested here is the
 * grading logic, which is pure.
 */

import { describe, expect, it } from "vitest";
import {
  formatEvaluationReport,
  gradeGroundedAnswer,
  GROUNDED_PROBES,
  type EvaluationResult,
} from "@/agents/evaluations/suite";

const KNOWN = new Set(["EVD-2026-41905", "CTL-PAY-014", "TP-0042", "TST-2026-0318"]);

function probe(id: string) {
  const found = GROUNDED_PROBES.find((entry) => entry.id === id);
  if (!found) throw new Error(`Probe ${id} is missing from the suite.`);
  return found;
}

describe("the probe set", () => {
  it("covers the roles whose failure would matter most", () => {
    const roles = new Set(GROUNDED_PROBES.map((entry) => entry.roleId));
    expect(roles.has("rcsa")).toBe(true);
    expect(roles.has("tprm")).toBe(true);
    expect(roles.has("incident-resilience")).toBe(true);
  });

  it("includes a question the corpus cannot answer", () => {
    // Without this probe the suite cannot detect a confident fabrication.
    const unanswerable = probe("probe-unanswerable");
    expect(unanswerable.expectedIdentifiers).toHaveLength(0);
    expect(unanswerable.forbiddenAssertions.length).toBeGreaterThan(0);
  });

  it("guards the Swiss jurisdiction error specifically", () => {
    const swiss = probe("probe-swiss-jurisdiction");
    const offending = "DORA applies to Arcadia Bank Schweiz AG for this event.";
    expect(swiss.forbiddenAssertions.some((pattern) => pattern.test(offending))).toBe(true);
  });
});

describe("grading a grounded answer", () => {
  it("fails an answer that invents an identifier", () => {
    const result = gradeGroundedAnswer(
      probe("probe-control-divergence"),
      "The divergence is documented in CTL-PAY-014 and in EVD-2026-99999.",
      KNOWN,
    );
    expect(result.passed).toBe(false);
    expect(result.citedUnknown).toContain("EVD-2026-99999");
  });

  it("does not treat a real identifier ending a sentence as invented", () => {
    /*
     * A regression guard. The identifier pattern must allow a dot, because a
     * fourth party is written TP-0042.3-F1, so a sentence final identifier
     * matched with its full stop attached and was reported as a fabrication.
     */
    const result = gradeGroundedAnswer(
      probe("probe-control-divergence"),
      "The divergence is recorded against CTL-PAY-014.",
      KNOWN,
    );
    expect(result.citedUnknown).toHaveLength(0);
    expect(result.citedKnown).toContain("CTL-PAY-014");
  });

  it("still recognises a fourth party identifier that contains a dot", () => {
    const result = gradeGroundedAnswer(
      probe("probe-subprocessor-gap"),
      "TP-0042 relies on TP-0042.3-F1, which appears in neither record.",
      new Set(["TP-0042", "TP-0042.3-F1"]),
    );
    expect(result.citedKnown).toContain("TP-0042.3-F1");
    expect(result.citedUnknown).toHaveLength(0);
  });

  it("passes an answer that cites only real identifiers", () => {
    const result = gradeGroundedAnswer(
      probe("probe-control-divergence"),
      "The first line assesses CTL-PAY-014 as fully effective. The test report EVD-2026-41905 concludes partially effective.",
      KNOWN,
    );
    expect(result.passed).toBe(true);
    expect(result.citedKnown).toContain("CTL-PAY-014");
    expect(result.citedUnknown).toHaveLength(0);
  });

  it("fails an answer that omits the identifier it was expected to cite", () => {
    const result = gradeGroundedAnswer(
      probe("probe-control-divergence"),
      "There is a disagreement between the two lines of defence about the control.",
      KNOWN,
    );
    expect(result.passed).toBe(false);
    expect(result.missingExpected).toContain("CTL-PAY-014");
  });

  it("fails an answer asserting that an EU instrument applies to the Swiss entity", () => {
    const result = gradeGroundedAnswer(
      probe("probe-swiss-jurisdiction"),
      "DORA applies to Arcadia Bank Schweiz AG, so a notification is required within four hours.",
      KNOWN,
    );
    expect(result.passed).toBe(false);
    expect(result.forbiddenMatches.length).toBeGreaterThan(0);
  });

  it("passes an answer that keeps the jurisdictions apart", () => {
    const result = gradeGroundedAnswer(
      probe("probe-swiss-jurisdiction"),
      "The Swiss entity is supervised by FINMA and the European Union resilience regulation does not apply to it. Illustrative regulatory context, not legal advice.",
      KNOWN,
    );
    expect(result.passed).toBe(true);
  });

  it("fails an invented monetary figure on an unanswerable question", () => {
    const result = gradeGroundedAnswer(
      probe("probe-unanswerable"),
      "The fourth exception caused a loss of EUR 38,400 confirmed by finance.",
      KNOWN,
    );
    expect(result.passed).toBe(false);
  });

  it("passes a correct refusal on an unanswerable question", () => {
    const result = gradeGroundedAnswer(
      probe("probe-unanswerable"),
      "The corpus does not contain a finance confirmed loss figure for that exception, so I cannot give one.",
      KNOWN,
    );
    expect(result.passed).toBe(true);
    expect(result.declined).toBe(true);
  });

  it("detects a declined answer", () => {
    const result = gradeGroundedAnswer(
      probe("probe-subprocessor-gap"),
      "TP-0042 has a register that does not agree with the appendix. I cannot say which document binds.",
      KNOWN,
    );
    expect(result.declined).toBe(true);
  });
});

describe("the report formatter", () => {
  const sample: EvaluationResult[] = [
    {
      id: "a",
      dimension: "evidence citation",
      name: "Passing check",
      passed: true,
      detail: "Checked things.",
      failures: [],
      kind: "structural",
    },
    {
      id: "b",
      dimension: "jurisdiction",
      name: "Failing check",
      passed: false,
      detail: "Checked other things.",
      failures: ["Something specific went wrong."],
      kind: "structural",
    },
  ];

  it("reports the pass count and surfaces the failures", () => {
    const report = formatEvaluationReport(sample);
    expect(report).toContain("1 of 2 passed");
    expect(report).toContain("Something specific went wrong.");
    expect(report).toContain("FAIL");
  });

  it("says plainly when the grounded evaluations did not run", () => {
    const report = formatEvaluationReport(sample);
    expect(report).toContain("Not run");
    expect(report).toContain("live mode");
  });

  it("does not claim legal correctness", () => {
    const report = formatEvaluationReport(sample);
    expect(report).toContain("does not claim legal correctness");
  });
});
