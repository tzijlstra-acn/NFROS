/**
 * Skills against the seeded day.
 *
 *   - the builder's examples return the rows the synthetic data holds, in the
 *     TPRM role's scope (Arcadia Bank AG, ARC-DE) and at the current moment;
 *   - every preview and run is a `runSkill` tool call through the gate,
 *     recorded in `tool_calls` and the audit trail, and changes no record;
 *   - saving, running and removing a skill is the person's own, audited, and
 *     a stored spec that no longer passes the catalog is not run;
 *   - the work partner drafts and previews a skill, hands it to the builder
 *     as a link, and saves nothing; a governed action still reaches the gate
 *     first.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase, rowCount } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { setMoment } from "@/scenario/engine/state";
import { setResolvedDemoMode } from "@/server/config/runtime";
import { executeTool } from "@/agents/tools/runtime";
import { workToolContext } from "@/features/work/governance";
import { draftSkillByRules } from "@/features/skills/rules";
import { defaultSpec, type SkillSpec } from "@/features/skills/schema";
import { previewSkill, removeSkill, runSavedSkill, savedSkills, saveSkill } from "@/features/skills/operations";
import { knownSupplierNames } from "@/features/skills/execute";
import { postChatTurn } from "@/agents/chat/service";
import "@/agents/tools/reads";

function sqlite() {
  return getSqlite();
}

function spec(request: string): SkillSpec {
  const drafted = draftSkillByRules(request, { knownNames: knownSupplierNames("tprm") });
  if (!drafted.spec) throw new Error(`No spec for "${request}"`);
  return drafted.spec;
}

function runSkillCalls(): Array<{ outcome: string }> {
  return sqlite().prepare("select outcome from tool_calls where tool_name = 'runSkill'").all() as Array<{ outcome: string }>;
}

function recordFingerprint(): string {
  const tables = ["suppliers", "evidence_documents", "contract_obligations", "incidents", "kris", "decisions", "actions"];
  return tables.map((table) => `${table}:${rowCount(table)}`).join(",") +
    JSON.stringify(sqlite().prepare("select id, status, criticality, next_assessment_due from suppliers order by id").all());
}

beforeAll(() => {
  createTemporaryDatabase("skills");
  seedScenario(DEFAULT_RUN_ID);
}, 600_000);

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  setResolvedDemoMode("safe");
  setMoment("07:45", { runId: DEFAULT_RUN_ID });
});

describe("the builder's examples on the seeded day", () => {
  it("finds the one critical supplier due in the next 90 days, and not the Swiss one", async () => {
    const outcome = await previewSkill("tprm", spec("Critical suppliers with an assessment due in the next 90 days"));
    expect(outcome.ok).toBe(true);
    expect(outcome.result?.entityId).toBe("ARC-DE");
    expect(outcome.result?.entityName).toBe("Arcadia Bank AG");
    expect(outcome.result?.inScope).toBe(8);
    expect(outcome.result?.rows.map((row) => row.ref)).toStrictEqual(["TP-0042"]);
    expect(outcome.result?.rows[0]?.cells).toStrictEqual(["Novalink Payment Services GmbH", "Critical", "Under reassessment", "31.10.2026"]);
  });

  it("keeps a supplier outside the role's entity out of every result", async () => {
    const outcome = await previewSkill("tprm", spec("Critical suppliers"));
    const refs = outcome.result?.rows.map((row) => row.ref) ?? [];
    expect(refs).toContain("TP-0042");
    expect(refs).not.toContain("TP-0023");
  });

  it("finds the missing and requested supplier due diligence evidence", async () => {
    const expected = [
      "EVD-2026-41215", "EVD-2026-41220", "EVD-2026-41240",
      "EVD-OB-0099-05", "EVD-OB-0104-06", "EVD-OB-0104-07", "EVD-OB-0104-09", "EVD-OB-0104-10",
    ];
    const outcome = await previewSkill("tprm", spec("Missing or requested supplier due diligence evidence"));
    expect(outcome.result?.rows.map((row) => row.id).sort()).toStrictEqual(expected);
    expect(outcome.tool.evidenceIds.sort()).toStrictEqual(expected);
  });

  it("lists breached obligations before the ones not evidenced", async () => {
    const outcome = await previewSkill("tprm", spec("Contract obligations that are breached or not evidenced, weekly"));
    expect(outcome.result?.matched).toBe(20);
    expect(outcome.result?.inScope).toBe(30);
    const statuses = outcome.result?.rows.map((row) => row.cells[3]) ?? [];
    expect(statuses.slice(0, 3)).toStrictEqual(["Breached", "Breached", "Breached"]);
    expect(new Set(statuses.slice(3))).toStrictEqual(new Set(["Not evidenced"]));
  });

  it("reads KRIs in breach for the entity and the group", async () => {
    const outcome = await previewSkill("tprm", spec("KRIs in breach"));
    expect(outcome.result?.matched).toBe(9);
    expect(outcome.result?.rows[0]?.cells[1]).toBe("Red");
    expect(outcome.result?.rows.some((row) => row.ref === "KRI-TPR-002")).toBe(true);
  });

  it("shows an incident only once it has been detected", async () => {
    const request = spec("Open incidents involving Novalink");
    setMoment("14:05", { runId: DEFAULT_RUN_ID });
    expect((await previewSkill("tprm", request)).result?.matched).toBe(0);
    setMoment("15:00", { runId: DEFAULT_RUN_ID });
    const later = await previewSkill("tprm", request);
    expect(later.result?.rows.map((row) => row.ref)).toStrictEqual(["INC-2026-0412"]);
  });
});

describe("the gate and the audit trail", () => {
  it("records every preview as a runSkill tool call and changes no record", async () => {
    const before = recordFingerprint();
    const calls = runSkillCalls().length;
    const outcome = await previewSkill("tprm", spec("KRIs in breach"));
    expect(outcome.tool.outcome).toBe("executed");
    expect(outcome.auditEventId).toMatch(/\S+/);
    expect(runSkillCalls().length).toBe(calls + 1);
    expect(recordFingerprint()).toBe(before);
  });

  it("refuses a spec the catalog does not allow, even when it reaches the tool directly", async () => {
    const result = await executeTool("runSkill", { spec: { ...defaultSpec("suppliers"), source: "users" } }, workToolContext("tprm"));
    expect(result.outcome).toBe("failed");
    expect(result.data).toBeUndefined();
  });

  it("takes the scope from the context, not the payload", async () => {
    const result = await executeTool("runSkill", { spec: spec("Critical suppliers"), roleId: "nfr-governance", entityId: "ARC-CH" }, workToolContext("tprm"));
    expect(result.outcome).toBe("executed");
    const rows = (result.data as { rows: Array<{ ref: string }> }).rows.map((row) => row.ref);
    expect(rows).not.toContain("TP-0023");
  });
});

describe("saved skills", () => {
  it("saves, lists, runs and removes a skill, auditing each step", async () => {
    const saved = saveSkill("tprm", { name: "Critical suppliers due soon", request: "Critical suppliers with an assessment due in the next 90 days", spec: spec("Critical suppliers with an assessment due in the next 90 days"), via: "rules" });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.skill.userId).toBe("P-002");
    expect(savedSkills("tprm").map((entry) => entry.row.name)).toContain("Critical suppliers due soon");
    expect(savedSkills("rcsa").map((entry) => entry.row.id)).not.toContain(saved.skill.id);

    const duplicate = saveSkill("tprm", { name: "Critical suppliers due soon", request: "", spec: spec("Critical suppliers"), via: "rules" });
    expect(duplicate.ok).toBe(false);

    const run = await runSavedSkill("tprm", saved.skill.id);
    expect(run?.ok).toBe(true);
    const after = savedSkills("tprm").find((entry) => entry.row.id === saved.skill.id);
    expect(after?.row.lastRunMatched).toBe(1);
    expect(after?.row.lastRunInScope).toBe(8);
    expect(after?.row.lastRunMoment).toBe("07:45");

    expect(await runSavedSkill("rcsa", saved.skill.id)).toBeNull();
    expect(removeSkill("rcsa", saved.skill.id)).toBe(false);
    expect(removeSkill("tprm", saved.skill.id)).toBe(true);
    expect(savedSkills("tprm").map((entry) => entry.row.id)).not.toContain(saved.skill.id);

    const actions = (sqlite().prepare("select action from audit_events where object_kind = 'skill' and object_id = ? order by recorded_at").all(saved.skill.id) as Array<{ action: string }>).map((row) => row.action);
    expect(actions).toContain("skill-saved");
    expect(actions).toContain("skill-removed");
  });

  it("does not run a stored spec that no longer passes the catalog", async () => {
    const saved = saveSkill("tprm", { name: "Tampered skill", request: "", spec: spec("KRIs in breach"), via: "rules" });
    if (!saved.ok) throw new Error("not saved");
    sqlite().prepare("update skills set spec = ? where id = ?").run(JSON.stringify({ source: "users", filters: [] }), saved.skill.id);
    expect(savedSkills("tprm").find((entry) => entry.row.id === saved.skill.id)?.spec).toBeNull();
    const calls = runSkillCalls().length;
    const run = await runSavedSkill("tprm", saved.skill.id);
    expect(run?.ok).toBe(false);
    expect(runSkillCalls().length).toBe(calls);
    removeSkill("tprm", saved.skill.id);
  });

  it("refuses a skill without a usable name or spec", () => {
    expect(saveSkill("tprm", { name: "ab", request: "", spec: spec("KRIs in breach"), via: "rules" }).ok).toBe(false);
    expect(saveSkill("tprm", { name: "Valid name", request: "", spec: { source: "users" }, via: "rules" }).ok).toBe(false);
  });

  it("is cleared by a reseed", async () => {
    const saved = saveSkill("tprm", { name: "Cleared by reseed", request: "", spec: spec("KRIs in breach"), via: "rules" });
    expect(saved.ok).toBe(true);
    seedScenario(DEFAULT_RUN_ID);
    expect(rowCount("skills")).toBe(0);
  }, 600_000);
});

describe("the work partner", () => {
  it("drafts and previews a skill, links to the builder and saves nothing", async () => {
    const skillsBefore = rowCount("skills");
    const calls = runSkillCalls().length;
    const result = await postChatTurn({ roleId: "tprm", input: "Build a skill that lists critical suppliers with an assessment due in the next 90 days" });
    const parts = result.turn.parts;
    expect(result.blocked).toBeUndefined();
    expect(parts[0]?.kind).toBe("answer");
    expect(parts[0]?.text).toContain("I drafted a skill: Critical suppliers, next assessment due within the next 90 days");
    const evidence = parts.find((entry) => entry.kind === "evidence");
    expect(evidence?.text).toContain("1 of 8 suppliers match");
    expect(evidence?.refs).toContain("TP-0042");
    const followUp = parts.find((entry) => entry.kind === "follow-up");
    expect(String(followUp?.meta?.["href"])).toMatch(/^\/workday\/tprm\/processes\?view=skills&draft=[A-Za-z0-9_-]+&via=rules&ask=/);
    expect(followUp?.meta?.["hrefLabel"]).toBe("Open in Skills");
    expect(runSkillCalls().length).toBe(calls + 1);
    expect(rowCount("skills")).toBe(skillsBefore);
  });

  it("says what it could not read and still links to the builder", async () => {
    const result = await postChatTurn({ roleId: "tprm", input: "Create a skill for my coffee breaks" });
    expect(result.turn.parts[0]?.text).toContain("could not draft a skill");
    expect(result.turn.parts.some((entry) => entry.kind === "uncertainty")).toBe(true);
    expect(String(result.turn.parts.at(-1)?.meta?.["href"])).toContain("view=skills");
  });

  it("still sends a governed action to the gate first", async () => {
    const result = await postChatTurn({ roleId: "tprm", input: "Build a skill and email the supplier directly that we are escalating" });
    expect(result.turn.parts.some((entry) => entry.kind === "blocked")).toBe(true);
  });
});
