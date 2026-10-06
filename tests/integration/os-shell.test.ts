/**
 * The shell against the seeded day: header counts, search scope, Updates.
 *
 * Every header count is asserted against the read its destination uses, at
 * several moments of the day, so a badge can no longer drift from the page it
 * opens (audit T06, T07). The search scope is asserted against the role and
 * legal-entity rule of plan section 4.12, and Updates against the backbone.
 *
 * Runs on a temporary database (`support/harness.ts`). The runtime facade is
 * mocked to Safe mode so nothing here resolves AI configuration.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/server/config/runtime", () => ({
  getResolvedDemoMode: () => ({ mode: "safe", requested: "safe", downgraded: false, reason: null }),
  getRuntimeStatus: () => ({ demoMode: { mode: "safe" }, liveCallsPermitted: false }),
  recordLiveVerification: () => undefined,
}));

const { createTemporaryDatabase, destroyTemporaryDatabase } = await import("./support/harness");
const { getSqlite } = await import("@/db/client");
const { seedScenario } = await import("@/db/seed/run");
const { getScenarioState, setMoment } = await import("@/scenario/engine/state");
const { buildHeaderModel, countOpenDecisions } = await import("@/db/repositories/header");
const { buildDecisionQueueView } = await import("@/features/decisions/queue");
const { getActiveSuggestions } = await import("@/db/repositories/partner");
const { readUpdates } = await import("@/features/updates/read");
const { readSearchPayload } = await import("@/features/search/read");
const { markEventRead } = await import("@/scenario/engine/live-events");
const { SEARCH_KINDS } = await import("@/features/search");

beforeAll(() => {
  createTemporaryDatabase("os-shell");
  seedScenario();
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  seedScenario();
});

function state() {
  const current = getScenarioState();
  if (!current) throw new Error("The scenario was not seeded.");
  return current;
}

const FLAGSHIPS = ["rcsa", "tprm"] as const;
const MOMENTS = ["07:45", "11:45", "15:00", "16:30"];

describe("header counts equal their destinations", () => {
  it("the Decisions badge is the queue's open count at every moment, not the table's", () => {
    for (const moment of MOMENTS) {
      setMoment(moment);
      for (const roleId of FLAGSHIPS) {
        const queue = buildDecisionQueueView({ roleId, atMoment: moment, language: "en", autonomyLevel: state().autonomyLevel });
        const header = buildHeaderModel(roleId);
        expect(header.decisionsOpen, `${roleId} at ${moment}`).toBe(queue.rows.length);
        expect(countOpenDecisions(roleId, moment), `${roleId} at ${moment}`).toBe(queue.rows.length);
      }
    }
  });

  it("no longer counts decisions the day presents later (the measured 5 and 6 against 3)", () => {
    setMoment("07:45");
    for (const roleId of FLAGSHIPS) {
      const everyOpenRow = (
        getSqlite()
          .prepare("select count(*) as n from decisions where role_id = ? and status = 'open'")
          .get(roleId) as { n: number }
      ).n;
      expect(everyOpenRow, roleId).toBeGreaterThan(3);
      expect(buildHeaderModel(roleId).decisionsOpen, roleId).toBe(3);
    }
  });

  it("the AI Partner count is the dock's needs-you count, and follows dismissal and the clock", () => {
    setMoment("07:45");
    for (const roleId of FLAGSHIPS) {
      const dock = getActiveSuggestions(roleId, "07:45").filter(
        (suggestion) => suggestion.status === "needs-user" || suggestion.decisionRequired,
      );
      const header = buildHeaderModel(roleId);
      expect(header.suggestionsNeedingYou, roleId).toBe(dock.length);
      expect(header.aiState, roleId).toBe(dock.length > 0 ? "ready" : "idle");
    }

    getSqlite().prepare("update ai_suggestions set dismissed_at = '2026-10-06T08:00:00.000Z' where role_id = 'rcsa'").run();
    expect(buildHeaderModel("rcsa").suggestionsNeedingYou).toBe(0);
    expect(buildHeaderModel("rcsa").aiState).toBe("idle");

    setMoment("07:30");
    expect(buildHeaderModel("tprm").suggestionsNeedingYou).toBe(0);
  });

  it("the Updates count is the number of updates the panel raises", () => {
    for (const moment of MOMENTS) {
      setMoment(moment);
      for (const roleId of FLAGSHIPS) {
        expect(buildHeaderModel(roleId).updatesCount, `${roleId} at ${moment}`).toBe(readUpdates(roleId, state()).raised.length);
      }
    }
  });

  it("a Demo or Planned role counts nothing and carries its release state", () => {
    const demo = buildHeaderModel("control-assurance");
    expect(demo.releaseStatus).toBe("demo");
    expect([demo.updatesCount, demo.suggestionsNeedingYou, demo.decisionsOpen]).toEqual([0, 0, 0]);
    expect(buildHeaderModel("nfr-governance").releaseStatus).toBe("planned");
    expect(buildHeaderModel("rcsa").releaseStatus).toBe("available");
  });
});

describe("Updates on the seeded day", () => {
  it("raises the open stage task, the required decision once, and the overdue action for the Operational Risk Partner", () => {
    setMoment("07:45");
    const view = readUpdates("rcsa", state());
    expect(view.state).toBe("present");
    const keys = view.raised.map((item) => item.key);
    expect(keys).toContain("task:STAGERUN-RCSA-2:evidence-sufficiency");
    expect(keys.filter((key) => key === "decision:DEC-2026-0771")).toHaveLength(1);
    expect(keys).toContain("action-due:MSN-2026-0166");
    for (const item of view.raised) {
      expect(item.href.startsWith("/workday/rcsa"), item.key).toBe(true);
    }
    expect(view.raised.find((item) => item.key === "decision:DEC-2026-0771")?.href).toBe(
      "/workday/rcsa/decisions#DEC-2026-0771",
    );
    expect(view.raised.find((item) => item.key.startsWith("task:"))?.href).toBe(
      "/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh",
    );
  });

  it("raises the Third-Party Risk Manager's evidence task and the action due tomorrow", () => {
    setMoment("07:45");
    const keys = readUpdates("tprm", state()).raised.map((item) => item.key);
    expect(keys).toContain("task:STAGERUN-TPRM-4:evidence-dispositions");
    expect(keys).toContain("action-due:MSN-2026-0179");
    expect(keys).toContain("decision:DEC-2026-0741");
  });

  it("drops a required decision once it is taken", () => {
    setMoment("07:45");
    getSqlite().prepare("update decisions set status = 'decided' where id = 'DEC-2026-0771'").run();
    const keys = readUpdates("rcsa", state()).raised.map((item) => item.key);
    expect(keys).not.toContain("decision:DEC-2026-0771");
  });

  it("raises a high arrival as a material change until it is read, and only arrivals can be marked read", () => {
    setMoment("14:05");
    const before = readUpdates("rcsa", state());
    const all = [...before.raised, ...before.heldBack];
    const arrival = all.find((item) => item.key === "arrival:WLE-IN-IMSG-2026-0032");
    expect(arrival?.category).toBe("material-change");
    expect(arrival?.readableEventId).toBe("WLE-IN-IMSG-2026-0032");
    expect(arrival?.href).toBe("/workday/rcsa/work?view=inbox&item=IMSG-2026-0032");
    expect(all.filter((item) => item.readableEventId !== null).every((item) => item.origin === "live-event")).toBe(true);

    markEventRead("WLE-IN-IMSG-2026-0032", "rcsa");
    const after = readUpdates("rcsa", state());
    expect([...after.raised, ...after.heldBack].some((item) => item.key === "arrival:WLE-IN-IMSG-2026-0032")).toBe(false);
  });

  it("never raises more than the budget, and holds the rest back rather than dropping it", () => {
    setMoment("16:30");
    for (const roleId of FLAGSHIPS) {
      const view = readUpdates(roleId, state());
      expect(view.raised.length).toBeLessThanOrEqual(view.budget.total);
      const keys = [...view.raised, ...view.heldBack].map((item) => item.key);
      expect(new Set(keys).size, roleId).toBe(keys.length);
    }
  });
});

describe("the search scope", () => {
  it("covers all twelve professional object types for both flagship roles", () => {
    setMoment("07:45");
    for (const roleId of FLAGSHIPS) {
      const kinds = new Set(readSearchPayload(roleId, state()).entries.map((entry) => entry.kind));
      for (const kind of SEARCH_KINDS) expect(kinds.has(kind), `${roleId} ${kind}`).toBe(true);
    }
  });

  it("keeps registers to the role's legal entity", () => {
    setMoment("07:45");
    const payload = readSearchPayload("tprm", state());
    expect(payload.entityLabel).toBe("Arcadia Bank AG");
    const ids = new Set(payload.entries.map((entry) => `${entry.kind}:${entry.id}`));
    // Contracted for the Swiss entity only.
    expect(ids.has("supplier:TP-0023")).toBe(false);
    expect(ids.has("supplier:TP-0099")).toBe(true);
    expect(ids.has("assessment:RCSA-ARC-AT-PAYOPS-2026-Q3")).toBe(false);
    expect(ids.has("assessment:RCSA-ARC-CH-PAYOPS-2026-Q3")).toBe(false);

    const foreignEvidence = getSqlite()
      .prepare("select id from evidence_documents where entity_ids not like '%ARC-DE%'")
      .all() as Array<{ id: string }>;
    expect(foreignEvidence.length).toBeGreaterThan(0);
    for (const row of foreignEvidence) expect(ids.has(`evidence:${row.id}`), row.id).toBe(false);
  });

  it("keeps work to the role, and decisions and evidence to what the day has shown", () => {
    setMoment("07:45");
    const early = readSearchPayload("rcsa", state());
    const decisions = early.entries.filter((entry) => entry.kind === "decision").map((entry) => entry.id);
    expect(decisions).toContain("DEC-2026-0771");
    expect(decisions).not.toContain("DEC-2026-0772");
    expect(decisions).not.toContain("DEC-2026-0741");
    expect(early.entries.filter((entry) => entry.kind === "meeting").every((entry) => entry.id !== "MTG-2026-0001")).toBe(true);

    const later = getSqlite()
      .prepare("select id from evidence_documents where revealed_at_moment > '07:45' and entity_ids like '%ARC-DE%' limit 1")
      .get() as { id: string } | undefined;
    if (later) expect(early.entries.some((entry) => entry.id === later.id)).toBe(false);

    setMoment("11:45");
    const noon = readSearchPayload("rcsa", state());
    expect(noon.entries.some((entry) => entry.kind === "decision" && entry.id === "DEC-2026-0772")).toBe(true);
  });

  it("opens every result on a workday surface of the same role, in the right place for its type", () => {
    setMoment("07:45");
    const payload = readSearchPayload("tprm", state());
    for (const entry of payload.entries) expect(entry.href.startsWith("/workday/tprm"), entry.id).toBe(true);
    const find = (kind: string, id: string) => payload.entries.find((entry) => entry.kind === kind && entry.id === id);
    expect(find("process-run", "RUN-TPRM-VERIDIAN-2026")?.href).toBe(
      "/workday/tprm/processes/third-party-onboarding?stage=evidence-review",
    );
    // The supplier under onboarding opens in that process; another opens its linked work.
    expect(find("supplier", "TP-0099")?.href).toBe("/workday/tprm/processes/third-party-onboarding?stage=evidence-review");
    expect(find("supplier", "TP-0042")?.href).toBe("/workday/tprm/work?view=actions&object=TP-0042");
    expect(find("decision", "DEC-2026-0741")?.href).toBe("/workday/tprm/decisions#DEC-2026-0741");
    expect(find("action", "MSN-2026-0179")?.href).toBe("/workday/tprm/work?view=actions&item=MSN-2026-0179");
    expect(find("meeting", "MTG-2026-0001")?.href).toBe("/workday/tprm/work?view=meetings&item=MTG-2026-0001");
  });

  it("builds the commands from the day: the next meeting moves with the clock, and the decision count is the badge's", () => {
    setMoment("07:45");
    const morning = readSearchPayload("rcsa", state()).commands;
    const meeting = morning.find((command) => command.id === "open-next-meeting");
    expect(meeting?.available).toBe(true);
    expect(meeting?.action).toEqual({ kind: "navigate", href: "/workday/rcsa/work?view=meetings&item=MTG-2026-0006" });
    expect(morning.find((command) => command.id === "review-decisions")?.detail).toBe(
      `${buildHeaderModel("rcsa").decisionsOpen} open`,
    );
    expect(morning.find((command) => command.id === "open-current-process")?.action).toEqual({
      kind: "navigate",
      href: "/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh",
    });

    setMoment("17:00");
    const evening = readSearchPayload("rcsa", state()).commands.find((command) => command.id === "open-next-meeting");
    expect(evening?.available).toBe(false);
    expect(evening?.unavailableReason).toBe("No further meeting today");
  });
});
