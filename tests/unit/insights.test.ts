/**
 * The insight contract and the question router (NFR Workspace v3).
 *
 * The schema is the boundary between the engine and the renderer: it must
 * refuse anything the renderer cannot draw. The router must send each
 * curated question, its usual rephrasings and its German form to the same
 * analysis every time, and send nothing it does not understand anywhere.
 */

import { describe, expect, it } from "vitest";
import { INTENTS, normaliseQuestion, routeQuestion, suggestedIntents } from "@/features/insights/intents";
import { validateInsight, VISUALISATION_TYPES } from "@/features/insights/schema";

const minimal = {
  version: 1,
  intentId: "test",
  question: "Which controls are repeatedly failing?",
  title: "Controls failing repeatedly",
  conclusion: "Two controls fail repeatedly.",
  language: "en",
  roleId: "rcsa",
  dataAsOf: "06.10.2026, 07:45",
  scope: "34 controls",
  plan: { using: ["Control test results"], timeWindow: "Q4 2024 to Q3 2026", groupedBy: "Control", output: "Heatmap" },
  confidence: { level: "high", explanation: "Counted from records." },
  metrics: [{ id: "m", label: "Failing", value: 2, status: "critical" }],
  visualisations: [
    { id: "v", type: "bar", title: "Two controls fail", unit: "quarters", data: [{ id: "a", label: "CTL-A", value: 2 }] },
  ],
  findings: [],
  evidence: [],
  recommendations: [],
  followUps: [],
};

describe("the insight schema", () => {
  it("accepts a minimal well-formed response and applies defaults", () => {
    const checked = validateInsight(minimal);
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      const bar = checked.response.visualisations[0];
      expect(bar?.type).toBe("bar");
      if (bar?.type === "bar") expect(bar.data[0]?.tone).toBe("neutral");
    }
  });

  it("refuses a visual type the renderer does not draw", () => {
    const checked = validateInsight({ ...minimal, visualisations: [{ id: "v", type: "pie3d", title: "x", data: [] }] });
    expect(checked.ok).toBe(false);
  });

  it("refuses executable content in place of data", () => {
    const checked = validateInsight({
      ...minimal,
      visualisations: [{ id: "v", type: "bar", title: "x", unit: "u", data: "function () { return 1; }" }],
    });
    expect(checked.ok).toBe(false);
  });

  it("refuses an answer with no visual and more than five key numbers", () => {
    expect(validateInsight({ ...minimal, visualisations: [] }).ok).toBe(false);
    const six = Array.from({ length: 6 }, (_, index) => ({ id: `m${index}`, label: "x", value: index }));
    expect(validateInsight({ ...minimal, metrics: six }).ok).toBe(false);
  });

  it("refuses an external link on a mark", () => {
    const checked = validateInsight({
      ...minimal,
      visualisations: [{ id: "v", type: "bar", title: "x", unit: "u", data: [{ id: "a", label: "a", value: 1, href: "https://example.com" }] }],
    });
    expect(checked.ok).toBe(false);
  });

  it("names every visual type the renderer supports", () => {
    expect([...VISUALISATION_TYPES].sort()).toStrictEqual(
      ["area", "bar", "bullet", "heatmap", "line", "network", "stacked-bar", "table", "timeline", "treemap", "waterfall"].sort(),
    );
  });
});

describe("the question router", () => {
  it("routes every curated question to its own analysis, in both languages", () => {
    for (const intent of INTENTS) {
      expect(routeQuestion(intent.question.en)?.intent.id, intent.question.en).toBe(intent.id);
      expect(routeQuestion(intent.question.de)?.intent.id, intent.question.de).toBe(intent.id);
    }
  });

  it("routes common rephrasings", () => {
    const cases: Array<[string, string]> = [
      ["Show me vendors getting worse", "third-party-deterioration"],
      ["Which suppliers are declining?", "third-party-deterioration"],
      ["Do several critical services depend on the same cloud provider?", "provider-concentration"],
      ["Which controls keep failing their tests?", "failing-controls"],
      ["What remediation is past due?", "overdue-issues"],
      ["Which waivers lapse soon?", "expiring-acceptances"],
      ["Which services exceed their impact tolerance?", "resilience-gaps"],
      ["What does the new circular affect?", "policy-change-impact"],
      ["Give me an executive overview", "management-summary"],
      ["What should I do next?", "case-next-action"],
    ];
    for (const [question, intent] of cases) expect(routeQuestion(question)?.intent.id, question).toBe(intent);
  });

  it("does not mistake 'latest' for 'late'", () => {
    expect(routeQuestion("Which areas are affected by the latest policy change?")?.intent.id).toBe("policy-change-impact");
  });

  it("leans to the case analyses when a case is in context", () => {
    expect(routeQuestion("What changed since last quarter?", { kind: "decision", id: "DEC-2026-0741" })?.intent.id).toBe("payment-review-change");
    expect(routeQuestion("Why is this case high priority?", { kind: "decision", id: "DEC-2026-0741" })?.intent.id).toBe("case-next-action");
  });

  it("sends a question it does not understand nowhere", () => {
    expect(routeQuestion("What is the weather like in Zurich?")).toBeNull();
    expect(routeQuestion("")).toBeNull();
  });

  it("folds umlauts so a German question with them routes like one without", () => {
    expect(normaliseQuestion("Überfällige Maßnahmen")).toContain("ueberfaellige massnahmen");
    expect(routeQuestion("Welche Maßnahmen sind überfällig?")?.intent.id).toBe("overdue-issues");
  });

  it("suggests a role's own questions first", () => {
    const tprm = suggestedIntents("tprm", 3).map((intent) => intent.id);
    expect(tprm).toContain("third-party-deterioration");
    expect(suggestedIntents("rcsa", 2).map((intent) => intent.id)).toContain("failing-controls");
  });
});
