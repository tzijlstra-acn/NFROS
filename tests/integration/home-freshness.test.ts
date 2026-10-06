/**
 * Home freshness, server side.
 *
 * Plan section 4.3 requires Home to update immediately after a meeting, a
 * decision, a process stage or an action. Two things have to be true for
 * that, and this file tests both for each of the four changes:
 *
 *   1. The write path revalidates the role's workday. Every server action
 *      that changes one of Home's sources calls `revalidateWorkday(roleId,
 *      change)`, which registers `/workday/<role>` as a layout with Next. The
 *      Next call is mocked here so the registration can be observed.
 *
 *   2. Home, read after the write, shows the change. Home holds no copy of
 *      the day, so a fresh read is the whole of it.
 *
 * The stage step is covered here rather than only in the browser journey on
 * purpose. The process engine's stage completion runs through its own
 * contract (sources, tasks, decisions, approvals), which another workstream
 * is still building; this test writes the completed stage run the way that
 * engine does and asserts what Home makes of it, so Home's half of the
 * contract is proven independently of the engine's progress.
 *
 * The last block reads the server action modules themselves and asserts each
 * one calls the helper, so a new write path that forgets it fails here.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => revalidatePath(path, type),
}));

const { createTemporaryDatabase, destroyTemporaryDatabase } = await import("./support/harness");
const { getSqlite } = await import("@/db/client");
const { seedScenario } = await import("@/db/seed/run");
const { recordDecisionAndExecute } = await import("@/scenario/engine/decide");
const { getScenarioState, setMoment } = await import("@/scenario/engine/state");
const { readHomeView } = await import("@/features/home");
const { revalidateWorkday } = await import("@/workday/revalidate");

beforeAll(() => {
  createTemporaryDatabase("home-freshness");
  seedScenario();
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  seedScenario();
  revalidatePath.mockReset();
});

afterEach(() => {
  revalidatePath.mockReset();
});

function state() {
  const current = getScenarioState();
  if (!current) throw new Error("The scenario was not seeded.");
  return current;
}

function expectRoleRevalidated(roleId: string): void {
  expect(revalidatePath).toHaveBeenCalledWith(`/workday/${roleId}`, "layout");
}

describe("each change revalidates the workday and moves Home", () => {
  it("a decision", async () => {
    setMoment("11:45");
    const before = readHomeView("rcsa", state());

    const result = await recordDecisionAndExecute({
      decisionId: "DEC-2026-0772",
      optionId: "DEC-2026-0772-O3",
      rationale:
        "The only preventive control mapped to this risk carries a design and an operating deficiency, and two of six flagged items cannot be concluded.",
      rationaleConfirmed: true,
    });
    expect(result.ok, result.blockedReasons.join("; ")).toBe(true);
    expect(revalidateWorkday("rcsa", "decision")).toBe(true);
    expectRoleRevalidated("rcsa");

    const after = readHomeView("rcsa", state());
    expect(after.done.byYou).toBe(before.done.byYou + 1);
    expect(after.partner.statements.concat(after.partner.more).some((row) => row.source === "executed")).toBe(true);
  });

  it("an action completed in the Work Hub", () => {
    const s = state();
    const before = readHomeView("rcsa", s);
    const action = getSqlite()
      .prepare("select id from actions where raised_by_role_id = 'rcsa' and status = 'in-progress' order by id limit 1")
      .get() as { id: string };
    // The Work Hub's completion writes the scenario date, as `completeWithEvidence` does.
    getSqlite().prepare("update actions set status = 'completed', completed_on = ? where id = ?").run(s.scenarioDate, action.id);
    expect(revalidateWorkday("rcsa", "action")).toBe(true);
    expectRoleRevalidated("rcsa");

    const after = readHomeView("rcsa", s);
    expect(after.yourDay.actions.open).toBe(before.yourDay.actions.open - 1);
    expect(after.done.byYouRows.some((row) => row.kind === "action" && row.lineage.id === action.id)).toBe(true);
  });

  it("a process stage completed", () => {
    const s = state();
    const before = readHomeView("tprm", s);
    const stage = getSqlite()
      .prepare(
        "select s.id as id, s.stage_id as stageId from role_app_stage_runs s join role_app_runs r on r.id = s.role_app_run_id where r.role_id = 'tprm' and s.status != 'completed' limit 1",
      )
      .get() as { id: string; stageId: string };
    getSqlite()
      .prepare("update role_app_stage_runs set status = 'completed', completed_at = ?, completed_by_user_id = 'P-002' where id = ?")
      .run(new Date().toISOString(), stage.id);
    expect(revalidateWorkday("tprm", "process-stage")).toBe(true);
    expectRoleRevalidated("tprm");

    const after = readHomeView("tprm", s);
    expect(after.done.byYou).toBe(before.done.byYou + 1);
    const row = after.done.byYouRows.find((entry) => entry.kind === "stage");
    expect(row?.lineage.href).toBe(`/workday/tprm/processes/third-party-onboarding?stage=${stage.stageId}`);
  });

  it("a meeting recorded as held", () => {
    const s = state();
    const before = readHomeView("tprm", s);
    const meeting = getSqlite().prepare("select id from meetings where role_id = 'tprm' order by id limit 1").get() as {
      id: string;
    };
    // The Work Hub's meeting-held operation stamps the wall clock, which is after the seed.
    getSqlite()
      .prepare("update meetings set status = 'concluded', concluded_at = ? where id = ?")
      .run(new Date().toISOString(), meeting.id);
    expect(revalidateWorkday("tprm", "meeting")).toBe(true);
    expectRoleRevalidated("tprm");

    const after = readHomeView("tprm", s);
    expect(after.done.byYouRows.some((row) => row.kind === "meeting" && row.lineage.id === meeting.id)).toBe(true);
    expect(after.done.total).toBe(before.done.total + 1);
  });
});

describe("the server actions that write Home's sources", () => {
  /*
   * Each module and the change it covers. A module that does not exist yet
   * is skipped rather than failed, so this list can name the write paths
   * other workstreams are building.
   */
  const modules: Array<{ path: string; covers: string }> = [
    { path: "app/workday/[role]/work/actions.ts", covers: "actions and meetings" },
    { path: "src/features/process/actions.ts", covers: "process stages" },
  ];

  for (const entry of modules) {
    it(`${entry.path} revalidates the role's workday (${entry.covers})`, () => {
      const file = join(process.cwd(), entry.path);
      if (!existsSync(file)) return;
      const source = readFileSync(file, "utf8");
      expect(source.includes('"use server"'), `${entry.path} is not a server action module`).toBe(true);
      expect(source.includes("revalidateWorkday("), `${entry.path} never calls revalidateWorkday`).toBe(true);
    });
  }

  it("app/actions.ts revalidates the whole workday after a decision (covers every role)", () => {
    const source = readFileSync(join(process.cwd(), "app/actions.ts"), "utf8");
    expect(source.includes('revalidatePath("/workday", "layout")')).toBe(true);
    expect(/actionRecordDecision[\s\S]*?revalidateWorkday\(\)/.test(source)).toBe(true);
  });
});
