/**
 * Skills: the catalog, the spec check, the rule-based drafter, the readings
 * and the model seam. No database.
 *
 * The claims under test:
 *   - a spec can only name what the catalog lists, on every path;
 *   - the rule-based drafter reads the builder's own examples, in English and
 *     German, into the spec a person would expect, and says what it assumed;
 *   - the model is called only in live mode, and its draft is checked like
 *     any other, falling back to the rules when it fails;
 *   - a weekly skill is due on the Monday after the scenario day.
 */

import { describe, expect, it, vi } from "vitest";
import { OPERATORS_BY_KIND, SKILL_CATALOG, SKILL_SOURCES } from "@/features/skills/catalog";
import { checkSkillSpec, decodeSpec, defaultSpec, encodeSpec, SKILL_SPEC_JSON_SCHEMA, type SkillSpec } from "@/features/skills/schema";
import { draftSkillByRules, normaliseRequest } from "@/features/skills/rules";
import { draftSkill, skillInstructions, type SkillModel } from "@/features/skills/compile";
import { describeFilters, describeSchedule, nextWeeklyRun, proposeSkillTitle } from "@/features/skills/describe";
import { detectSkillRequest } from "@/features/skills/chat";
import { TOOL_REGISTRY } from "@/server/security/authority";

const NAMES = ["Novalink Payment Services GmbH", "Sentinel Screening Solutions Ltd", "Kestrel Governance Cloud SE"];

function draft(request: string): SkillSpec {
  const result = draftSkillByRules(request, { knownNames: NAMES });
  expect(result.problems, request).toStrictEqual([]);
  expect(result.spec, request).not.toBeNull();
  return result.spec as SkillSpec;
}

describe("the catalog", () => {
  it("lists five sources, each with valid defaults", () => {
    expect(SKILL_SOURCES).toStrictEqual(["suppliers", "evidence", "obligations", "incidents", "kris"]);
    for (const source of SKILL_SOURCES) {
      const check = checkSkillSpec(defaultSpec(source));
      expect(check.ok, source).toBe(true);
    }
  });

  it("gives every enum field values, and keeps German labels ASCII", () => {
    const umlauts = new RegExp(`[${String.fromCharCode(0xe4, 0xf6, 0xfc, 0xc4, 0xd6, 0xdc, 0xdf)}]`);
    for (const source of SKILL_SOURCES) {
      const definition = SKILL_CATALOG[source];
      expect(definition.label.de).not.toMatch(umlauts);
      expect(definition.scope.de).not.toMatch(umlauts);
      for (const field of definition.fields) {
        expect(field.label.de, `${source}.${field.id}`).not.toMatch(umlauts);
        if (field.kind === "enum") expect((field.values ?? []).length, `${source}.${field.id}`).toBeGreaterThan(0);
        for (const value of field.values ?? []) expect(value.label.de).not.toMatch(umlauts);
      }
    }
  });

  it("registers runSkill as a READ tool that changes nothing", () => {
    const tool = TOOL_REGISTRY["runSkill"];
    expect(tool?.authorityClass).toBe("READ");
    expect(tool?.mutates).toBe(false);
    expect(tool?.requiredScopes).toStrictEqual(["work.read", "evidence.read"]);
  });
});

describe("the spec check", () => {
  const base = defaultSpec("suppliers");

  it("refuses a field the source does not have", () => {
    const result = checkSkillSpec({ ...base, filters: [{ field: "password", operator: "contains", values: ["x"], days: null }] });
    expect(result.ok).toBe(false);
  });

  it("refuses an operator the field kind does not accept", () => {
    const result = checkSkillSpec({ ...base, filters: [{ field: "criticality", operator: "within-next-days", values: [], days: 30 }] });
    expect(result.ok).toBe(false);
  });

  it("refuses an enum value the field does not list", () => {
    const result = checkSkillSpec({ ...base, filters: [{ field: "criticality", operator: "is-any-of", values: ["catastrophic"], days: null }] });
    expect(result.ok).toBe(false);
  });

  it("refuses a date window without a number of days", () => {
    const result = checkSkillSpec({ ...base, filters: [{ field: "nextAssessmentDue", operator: "within-next-days", values: [], days: null }] });
    expect(result.ok).toBe(false);
  });

  it("refuses an unknown source, an unknown column, a sort on a display-only field and too many rows", () => {
    expect(checkSkillSpec({ ...base, source: "users" }).ok).toBe(false);
    expect(checkSkillSpec({ ...base, columns: ["name", "spend"] }).ok).toBe(false);
    expect(checkSkillSpec({ ...defaultSpec("kris"), sort: { field: "unit", direction: "asc" } }).ok).toBe(false);
    expect(checkSkillSpec({ ...base, limit: 500 }).ok).toBe(false);
    expect(checkSkillSpec("select * from suppliers").ok).toBe(false);
  });

  it("round-trips a spec through a URL and refuses a tampered one", () => {
    const spec = draft("Critical suppliers with an assessment due in the next 90 days");
    expect(decodeSpec(encodeSpec(spec))).toStrictEqual(spec);
    const tampered = Buffer.from(JSON.stringify({ ...spec, source: "users" }), "utf8").toString("base64url");
    expect(decodeSpec(tampered)).toBeNull();
    expect(decodeSpec("not base64 json")).toBeNull();
  });

  it("offers the model only the catalog's operators and sources", () => {
    const properties = SKILL_SPEC_JSON_SCHEMA["properties"] as Record<string, { enum?: string[] }>;
    expect(properties["source"]?.enum).toStrictEqual([...SKILL_SOURCES]);
    const operators = new Set(Object.values(OPERATORS_BY_KIND).flat());
    const instructions = skillInstructions();
    for (const operator of operators) expect(instructions).toContain(operator);
    expect(instructions).not.toMatch(/\b(?:sql|tables?|database)\b/i);
  });
});

describe("the rule-based drafter", () => {
  it("reads critical suppliers due in the next 90 days", () => {
    const spec = draft("Critical suppliers with an assessment due in the next 90 days");
    expect(spec.source).toBe("suppliers");
    expect(spec.filters).toStrictEqual([
      { field: "criticality", operator: "is-any-of", values: ["critical"], days: null },
      { field: "nextAssessmentDue", operator: "within-next-days", values: [], days: 90 },
    ]);
    expect(spec.sort).toStrictEqual({ field: "nextAssessmentDue", direction: "asc" });
    expect(spec.schedule).toBe("manual");
  });

  it("reads missing or requested supplier due diligence evidence without a second source", () => {
    const result = draftSkillByRules("Missing or requested supplier due diligence evidence", { knownNames: NAMES });
    expect(result.spec?.source).toBe("evidence");
    expect(result.spec?.filters).toStrictEqual([
      { field: "sourceType", operator: "is-any-of", values: ["supplier-due-diligence"], days: null },
      { field: "status", operator: "is-any-of", values: ["missing", "requested"], days: null },
    ]);
    expect(result.notes).toStrictEqual([]);
  });

  it("reads breached or not evidenced obligations, weekly", () => {
    const spec = draft("Contract obligations that are breached or not evidenced, weekly");
    expect(spec.source).toBe("obligations");
    expect(spec.filters).toStrictEqual([{ field: "evidenceStatus", operator: "is-any-of", values: ["breached", "not-evidenced"], days: null }]);
    expect(spec.schedule).toBe("weekly");
  });

  it("reads open incidents involving a named supplier", () => {
    const spec = draft("Open incidents involving Novalink");
    expect(spec.source).toBe("incidents");
    expect(spec.filters).toContainEqual({ field: "supplierName", operator: "contains", values: ["Novalink"], days: null });
    expect(spec.filters).toContainEqual({ field: "status", operator: "is-any-of", values: ["open", "under-assessment", "contained"], days: null });
  });

  it("reads KRIs in breach as red or amber", () => {
    const spec = draft("KRIs in breach");
    expect(spec.source).toBe("kris");
    expect(spec.filters).toStrictEqual([{ field: "currentStatus", operator: "is-any-of", values: ["red", "amber"], days: null }]);
  });

  it("reads the German examples to the same specs", () => {
    expect(draft("Kritische Lieferanten mit Bewertung faellig in den naechsten 90 Tagen").filters).toStrictEqual(
      draft("Critical suppliers with an assessment due in the next 90 days").filters,
    );
    expect(draft("Fehlende oder angeforderte Due-Diligence-Nachweise").filters).toStrictEqual(
      draft("Missing or requested supplier due diligence evidence").filters,
    );
    const obligations = draft("Verletzte oder nicht nachgewiesene Vertragspflichten, woechentlich");
    expect(obligations.filters).toStrictEqual(draft("Contract obligations that are breached or not evidenced, weekly").filters);
    expect(obligations.schedule).toBe("weekly");
    expect(draft("Offene Vorfaelle mit Novalink").filters).toStrictEqual(draft("Open incidents involving Novalink").filters);
    expect(draft("Ueberschrittene Risikoindikatoren").filters).toStrictEqual(draft("KRIs in breach").filters);
  });

  it("folds umlauts, so a German request typed with them reads the same", () => {
    const typed = `${String.fromCharCode(0xdc)}berschrittene Risikoindikatoren`;
    expect(normaliseRequest(typed)).toBe("ueberschrittene risikoindikatoren");
    expect(draft(typed).filters).toStrictEqual(draft("KRIs in breach").filters);
  });

  it("converts weeks and months, looks back on past dates and reads older than", () => {
    expect(draft("suppliers due within 6 weeks").filters).toContainEqual({ field: "nextAssessmentDue", operator: "within-next-days", values: [], days: 42 });
    expect(draft("incidents in the last 30 days").filters).toContainEqual({ field: "detectedAt", operator: "within-last-days", values: [], days: 30 });
    expect(draft("stale evidence older than 12 months").filters).toStrictEqual([
      { field: "isStale", operator: "is", values: ["true"], days: null },
      { field: "documentDate", operator: "older-than-days", values: [], days: 360 },
    ]);
    expect(draft("suppliers whose assessment is overdue").filters).toContainEqual({ field: "nextAssessmentDue", operator: "overdue", values: [], days: null });
  });

  it("says what it assumed", () => {
    const soon = draftSkillByRules("critical suppliers due soon");
    expect(soon.spec?.filters).toContainEqual({ field: "nextAssessmentDue", operator: "within-next-days", values: [], days: 90 });
    expect(soon.notes.map((entry) => entry.en).join(" ")).toContain("90 days");
    const bare = draftSkillByRules("list suppliers");
    expect(bare.notes.map((entry) => entry.en).join(" ")).toContain("No filter was recognised");
    const mixed = draftSkillByRules("open incidents for critical suppliers");
    expect(mixed.spec?.source).toBe("incidents");
    expect(mixed.notes.map((entry) => entry.en).join(" ")).toContain("Suppliers were also mentioned");
  });

  it("refuses a request that names no record type", () => {
    const result = draftSkillByRules("make me a coffee every monday");
    expect(result.spec).toBeNull();
    expect(result.problems[0]?.en).toContain("does not say which records to read");
  });

  it("is deterministic", () => {
    const request = "Critical or important suppliers due in the next 120 days, top 5, weekly";
    expect(draftSkillByRules(request)).toStrictEqual(draftSkillByRules(request));
    const spec = draft(request);
    expect(spec.limit).toBe(5);
    expect(spec.filters[0]).toStrictEqual({ field: "criticality", operator: "is-any-of", values: ["critical", "important"], days: null });
  });
});

describe("the readings", () => {
  it("describes every filter in both languages", () => {
    const spec = draft("Critical suppliers with an assessment due in the next 90 days");
    expect(describeFilters(spec, "en")).toStrictEqual(["Criticality is critical", "Next assessment due within the next 90 days"]);
    expect(describeFilters(spec, "de")).toStrictEqual(["Kritikalitaet ist kritisch", "Naechste Bewertung faellig in den naechsten 90 Tagen"]);
    expect(proposeSkillTitle(spec, "en")).toBe("Critical suppliers, next assessment due within the next 90 days");
  });

  it("puts a weekly skill on the Monday after the scenario day", () => {
    expect(nextWeeklyRun("2026-10-06")).toBe("2026-10-12");
    expect(nextWeeklyRun("2026-10-12")).toBe("2026-10-19");
    expect(describeSchedule("weekly", "en", "2026-10-06")).toBe("Weekly on Monday, next run 12.10.2026");
    expect(describeSchedule("manual", "de")).toBe("Laeuft, wenn Sie ihn starten");
  });
});

describe("the model seam", () => {
  const valid: SkillModel = async () => ({
    model: "test-model",
    output: { ...draft("KRIs in breach"), note: "" },
  });

  it("never calls the model in safe or offline mode", async () => {
    const model = vi.fn(valid);
    for (const mode of ["safe", "offline"] as const) {
      const result = await draftSkill("KRIs in breach", { mode, model });
      expect(result.via).toBe("rules");
      expect(result.ok).toBe(true);
    }
    expect(model).not.toHaveBeenCalled();
  });

  it("uses a checked model draft in live mode", async () => {
    const result = await draftSkill("KRIs in breach", { mode: "live", model: valid });
    expect(result.via).toBe("model");
    expect(result.spec?.source).toBe("kris");
  });

  it("falls back to the rules, and says so, when the model's draft fails the check", async () => {
    const invalid: SkillModel = async () => ({ model: "test-model", output: { source: "users", filters: [], sort: { field: "id", direction: "asc" }, columns: ["id"], limit: 10, schedule: "manual", note: "" } });
    const failing: SkillModel = async () => ({ error: "unavailable" });
    for (const model of [invalid, failing]) {
      const result = await draftSkill("KRIs in breach", { mode: "live", model });
      expect(result.via).toBe("rules");
      expect(result.spec?.source).toBe("kris");
      expect(result.notes[0]?.en).toContain("rule-based builder drafted this skill");
    }
  });

  it("drops a model note that breaks the copy rules", async () => {
    const noisy: SkillModel = async () => ({ model: "test-model", output: { ...draft("KRIs in breach"), note: "Parsed by GPT" } });
    const result = await draftSkill("KRIs in breach", { mode: "live", model: noisy });
    expect(result.via).toBe("model");
    expect(result.notes).toStrictEqual([]);
  });
});

describe("the chat intent", () => {
  it("recognises a request to build a skill, in English and German, and nothing else", () => {
    expect(detectSkillRequest("Build a skill that lists critical suppliers due in the next 90 days")).not.toBeNull();
    expect(detectSkillRequest("Create a new skill: KRIs in breach")).not.toBeNull();
    expect(detectSkillRequest("Erstelle einen Skill fuer offene Vorfaelle")).not.toBeNull();
    expect(detectSkillRequest("skill: missing evidence")).not.toBeNull();
    expect(detectSkillRequest("Which critical suppliers are due for assessment?")).toBeNull();
    expect(detectSkillRequest("What skills does the team need?")).toBeNull();
  });
});
