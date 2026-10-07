/**
 * The Home read model against the seeded day.
 *
 * The unit tests prove the rules on hand built rows. These prove the rules
 * meet real data, and that Home moves when the day moves: a decision
 * recorded, an action completed, a process stage completed and a meeting
 * concluded each change Home on the next read, because Home is read from the
 * rows those writes change and holds no copy of its own.
 *
 * The last block empties the role's data and reads Home again, which is the
 * test the old route would have failed most plainly: with no actions and no
 * inbox it reported four open actions and two messages needing attention.
 *
 * Runs against a temporary database. See `support/harness.ts`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import { recordDecisionAndExecute } from "@/scenario/engine/decide";
import { getScenarioState, setMoment, type ScenarioState } from "@/scenario/engine/state";
import { readHomeView, type HomeView } from "@/features/home";
import { momentToMinutes } from "@/domain/nfr/calculators";
import type { RoleId } from "@/db/schema/core";
import { getRole } from "@/db/repositories/workday";
import { getActionUpdatesFor, getWorkActions } from "@/db/repositories/work-hub";
import { classifyAction } from "@/features/work/modules/actions/policy";

const FLAGSHIP: readonly RoleId[] = ["rcsa", "tprm"];

const RCSA_DECISION_ID = "DEC-2026-0772";
const RCSA_OPTION_ID = "DEC-2026-0772-O3";
const RATIONALE =
  "The only preventive control mapped to this risk carries a design and an operating deficiency, and two of six flagged items cannot be concluded.";

beforeAll(() => {
  createTemporaryDatabase("home-read-model");
  seedScenario();
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  seedScenario();
});

function state(overrides: Partial<ScenarioState> = {}): ScenarioState {
  const current = getScenarioState();
  if (!current) throw new Error("The scenario was not seeded.");
  return { ...current, ...overrides };
}

function scalar(sql: string, ...params: unknown[]): number {
  const row = getSqlite().prepare(sql).get(...params) as { n: number } | undefined;
  return row?.n ?? 0;
}

function allStatements(view: HomeView) {
  return [...view.partner.statements, ...view.partner.more];
}

/* ==========================================================================
   The seeded morning
   ========================================================================== */

describe("Home at the opening moment", () => {
  for (const roleId of FLAGSHIP) {
    it(`${roleId}: counts open, overdue and blocked actions exactly as the Work Hub classifies them`, () => {
      const s = state();
      const view = readHomeView(roleId, s);

      // The Work Hub's own desk and rule, read independently of Home.
      const holder = getRole(roleId)?.holderUserId ?? null;
      const desk = getWorkActions(roleId, holder);
      const history = getActionUpdatesFor(desk.map((row) => row.id));
      const classified = desk.map((row) => classifyAction(row, history.get(row.id) ?? [], holder, s.scenarioDate, null));

      expect(view.yourDay.actions.open).toBe(classified.filter((entry) => entry.open).length);
      expect(view.yourDay.actions.overdue).toBe(classified.filter((entry) => entry.open && entry.overdue).length);
      expect(view.yourDay.actions.blocked).toBe(classified.filter((entry) => entry.open && entry.blocked).length);
      // The seeded overdue action is counted, which the old Home left out.
      expect(view.yourDay.actions.open).toBeGreaterThanOrEqual(
        scalar("select count(*) as n from actions where raised_by_role_id = ? and status in ('open', 'in-progress', 'overdue')", roleId),
      );
    });

    it(`${roleId}: counts an action blocked in its history as blocked, as the Work Hub does`, () => {
      const s = state();
      const action = getSqlite()
        .prepare("select id from actions where raised_by_role_id = ? and status = 'in-progress' order by id limit 1")
        .get(roleId) as { id: string };
      getSqlite()
        .prepare(
          "insert into action_updates (id, run_id, action_id, at, author_user_id, author_kind, note, evidence_ids, status_after) values (?, ?, ?, ?, ?, 'human', ?, '[]', 'blocked')",
        )
        .run(`AUP-BLK-TEST-${roleId}`, s.runId, action.id, new Date().toISOString(), getRole(roleId)?.holderUserId ?? null, "Waiting on the supplier");

      const view = readHomeView(roleId, s);
      expect(view.yourDay.actions.blocked).toBe(1);
      expect(view.yourDay.actions.value).toMatch(/1 blocked/);
    });

    it(`${roleId}: counts the inbox messages that need attention at the clock`, () => {
      const s = state();
      const view = readHomeView(roleId, s);
      const rows = getSqlite()
        .prepare(
          "select revealed_at_moment as m, is_read as r, proposed_triage as p, confirmed_triage as c, conversion_kind as k from inbox_messages where role_id = ?",
        )
        .all(roleId) as Array<{ m: string; r: number; p: string; c: string | null; k: string | null }>;
      const expected = rows.filter(
        (row) =>
          momentToMinutes(row.m) <= momentToMinutes(s.currentMoment) &&
          row.r === 0 &&
          !["action", "decision", "evidence", "process", "delegated"].includes(row.k ?? "") &&
          ["decision", "action"].includes(row.c ?? row.p),
      ).length;
      expect(view.yourDay.inbox.needsAttention).toBe(expected);
    });

    it(`${roleId}: names a next meeting that is a meeting and has not started yet`, () => {
      const s = state();
      const view = readHomeView(roleId, s);
      if (view.yourDay.meeting.state === "present") {
        const kind = getSqlite()
          .prepare("select kind from calendar_events where role_id = ? and title = ?")
          .get(roleId, view.yourDay.meeting.title) as { kind: string } | undefined;
        expect(kind?.kind).not.toBe("focus-time");
        expect(momentToMinutes(view.yourDay.meeting.time ?? "00:00")).toBeGreaterThanOrEqual(
          momentToMinutes(s.currentMoment),
        );
      } else {
        expect(view.yourDay.meeting.value.length).toBeGreaterThan(0);
      }
    });

    it(`${roleId}: states only what rows record, each statement linked to a real row`, () => {
      const view = readHomeView(roleId, state());
      const statements = allStatements(view);
      expect(statements.length).toBeGreaterThan(0);
      for (const statement of statements) {
        expect(statement.lineage.length, statement.id).toBeGreaterThan(0);
        for (const ref of statement.lineage) {
          expect(ref.href.startsWith(`/workday/${roleId}`), `${statement.id} -> ${ref.href}`).toBe(true);
        }
      }
      // A grouped follow-up lists exactly the rows it groups.
      const followUp = statements.find((statement) => statement.source === "follow-up");
      if (followUp) {
        const targets = scalar(
          "select count(distinct target_kind || ':' || target_id) as n from background_actions where role_id = ? and kind = 'item-requested'",
          roleId,
        );
        expect(followUp.lineage).toHaveLength(targets);
      }
    });

    it(`${roleId}: counts Done from the background rows, and nothing as yours before you act`, () => {
      const view = readHomeView(roleId, state());
      const automatic = scalar(
        "select count(*) as n from background_actions where role_id = ? and kind in ('system-checked', 'record-reconciled', 'document-classified', 'item-requested', 'routine-update')",
        roleId,
      );
      const completedSuggestions = scalar(
        "select count(*) as n from ai_suggestions where role_id = ? and status = 'completed' and dismissed_at is null",
        roleId,
      );
      expect(view.done.automatic).toBe(automatic + completedSuggestions);
      // The seeded history (stages completed on 01.10.2026) is not today's work.
      expect(view.done.byYou).toBe(0);
    });

    it(`${roleId}: answers the Now card's questions from the item's own records`, () => {
      const view = readHomeView(roleId, state());
      expect(view.now).not.toBeNull();
      expect(view.now?.detail.why.length).toBeGreaterThan(0);
      if (view.now?.whatChanged) expect(view.now.whatChangedSource).not.toBeNull();
      expect(view.next.length).toBeLessThanOrEqual(3);
    });

    it(`${roleId}: reads in German with no umlaut in anything Home wrote`, () => {
      const view = readHomeView(roleId, state({ language: "de" }));
      const own = [
        view.yourDay.meeting.value,
        view.yourDay.actions.value,
        view.yourDay.inbox.value,
        ...allStatements(view).map((statement) => statement.text),
      ].join(" | ");
      expect(/[\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df]/.test(own), own).toBe(false);
      expect(own.includes(String.fromCharCode(0x2014))).toBe(false);
    });
  }
});

/* ==========================================================================
   Home moves when the day moves
   ========================================================================== */

describe("Home after a change", () => {
  it("reflects a recorded decision in Now, the Partner update and Done", async () => {
    setMoment("11:45");
    const before = readHomeView("rcsa", state());
    const itemId = `focus-decision-${RCSA_DECISION_ID}`;

    const result = await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });
    expect(result.ok, result.blockedReasons.join("; ")).toBe(true);

    const after = readHomeView("rcsa", state());
    expect(after.counts["needs-you"]).toBe(before.counts["needs-you"] - 1);
    expect([after.now?.detail.item.id, ...after.next.map((row) => row.id)]).not.toContain(itemId);
    expect(after.contextLine).not.toBe(before.contextLine);
    expect(after.done.byYou).toBe(before.done.byYou + 1);
    expect(after.done.byYouRows.some((row) => row.lineage.id === RCSA_DECISION_ID)).toBe(true);

    const executed = allStatements(after).find((statement) => statement.id === `executed:${RCSA_DECISION_ID}`);
    expect(executed, "no statement records what the decision changed").toBeDefined();
    expect(executed?.lineage[0]?.href).toBe(`/workday/rcsa/decisions#${RCSA_DECISION_ID}`);
    // One reference per distinct object the receipt changed, plus the decision itself.
    const lines = getSqlite()
      .prepare("select object_kind as kind, object_id as id from execution_receipt_lines where decision_id = ?")
      .all(RCSA_DECISION_ID) as Array<{ kind: string; id: string }>;
    const as = (kind: string) => (kind === "action" ? "action" : kind === "decision" ? "decision" : "object");
    const distinct = new Set([`decision:${RCSA_DECISION_ID}`, ...lines.map((line) => `${as(line.kind)}:${line.id}`)]);
    expect(lines.length).toBeGreaterThan(0);
    expect(executed?.lineage.length).toBe(distinct.size);
  });

  it("does not put a decided question back in front of the person as a suggestion", async () => {
    const decisionId = "DEC-2026-0771";
    const before = readHomeView("rcsa", state());
    expect([before.now?.detail.item.decisionId, ...before.next.map((row) => row.decisionId)]).toContain(decisionId);

    const options = getSqlite()
      .prepare("select id from decision_options where decision_id = ? order by sort_order")
      .all(decisionId) as Array<{ id: string }>;
    const result = await recordDecisionAndExecute({
      decisionId,
      optionId: options[0]?.id ?? "",
      rationale: "One causal investigation names the mechanism behind all three indicators.",
      rationaleConfirmed: true,
    });
    expect(result.ok, result.blockedReasons.join("; ")).toBe(true);

    const after = readHomeView("rcsa", state());
    // Neither the decision nor the suggestion that prepared it is asked again.
    expect([after.now?.detail.item.decisionId, ...after.next.map((row) => row.decisionId)]).not.toContain(decisionId);
    expect(after.counts["needs-you"]).toBe(before.counts["needs-you"] - 1);
    expect(after.suggestion?.id).not.toBe(before.suggestion?.id);
    // What the suggestion prepared is still stated, as history with lineage to the decision.
    const prepared = allStatements(after).find((statement) => statement.source === "prepared");
    expect(prepared?.lineage[0]?.id).toBe(decisionId);
  });

  it("reflects an action completed today in Your day and Done", () => {
    const s = state();
    const before = readHomeView("rcsa", s);
    const open = getSqlite()
      .prepare("select id from actions where raised_by_role_id = 'rcsa' and status in ('open', 'in-progress') order by id limit 1")
      .get() as { id: string };
    getSqlite()
      .prepare("update actions set status = 'completed', completed_on = ? where id = ?")
      .run(new Date().toISOString(), open.id);

    const after = readHomeView("rcsa", s);
    expect(after.yourDay.actions.open).toBe(before.yourDay.actions.open - 1);
    expect(after.done.byYouRows.map((row) => row.lineage.id)).toContain(open.id);
    expect(after.done.total).toBe(before.done.total + 1);
  });

  it("reflects a process stage completed today in Done, linked to its stage", () => {
    const s = state();
    const before = readHomeView("rcsa", s);
    const stage = getSqlite()
      .prepare(
        "select s.id as id, s.stage_id as stageId from role_app_stage_runs s join role_app_runs r on r.id = s.role_app_run_id where r.role_id = 'rcsa' and s.status != 'completed' limit 1",
      )
      .get() as { id: string; stageId: string };
    getSqlite()
      .prepare("update role_app_stage_runs set status = 'completed', completed_at = ?, completed_by_user_id = 'P-003' where id = ?")
      .run(new Date().toISOString(), stage.id);

    const after = readHomeView("rcsa", s);
    expect(after.done.byYou).toBe(before.done.byYou + 1);
    const row = after.done.byYouRows.find((entry) => entry.kind === "stage");
    expect(row?.lineage.href).toBe(`/workday/rcsa/processes/rcsa-cycle?stage=${stage.stageId}`);
  });

  it("reflects a meeting concluded today in Done", () => {
    const s = state();
    const before = readHomeView("tprm", s);
    const meeting = getSqlite().prepare("select id from meetings where role_id = 'tprm' order by id limit 1").get() as {
      id: string;
    };
    getSqlite()
      .prepare("update meetings set status = 'concluded', concluded_at = ? where id = ?")
      .run(new Date().toISOString(), meeting.id);

    const after = readHomeView("tprm", s);
    expect(after.done.byYou).toBe(before.done.byYou + 1);
    expect(after.done.byYouRows.some((row) => row.kind === "meeting" && row.lineage.id === meeting.id)).toBe(true);
  });

  it("reflects a message converted into an action in the Partner update and the inbox count", () => {
    const s = state();
    const before = readHomeView("tprm", s);
    const message = getSqlite()
      .prepare(
        "select id from inbox_messages where role_id = 'tprm' and is_read = 0 and proposed_triage = 'action' and revealed_at_moment = '07:45' limit 1",
      )
      .get() as { id: string };
    const action = getSqlite()
      .prepare("select id from actions where raised_by_role_id = 'tprm' limit 1")
      .get() as { id: string };
    /* As the inbox's link handler records it: the link, and what the message became, by whom (migration 0008). */
    getSqlite()
      .prepare("update inbox_messages set linked_action_id = ?, conversion_kind = 'action', converted_by_user_id = 'P-002', converted_at = ? where id = ?")
      .run(action.id, new Date().toISOString(), message.id);

    const after = readHomeView("tprm", s);
    expect(after.yourDay.inbox.needsAttention).toBe(before.yourDay.inbox.needsAttention - 1);
    const conversion = allStatements(after).find((statement) => statement.source === "conversion");
    expect(conversion?.lineage.map((ref) => ref.id)).toStrictEqual([action.id, message.id]);
    /* P-002 holds the TPRM role, so the statement speaks to them. */
    expect(conversion?.text).toBe("You converted 1 message into work");
  });
});

/* ==========================================================================
   An emptied role
   ========================================================================== */

describe("Home for a role with no data", () => {
  function empty(roleId: RoleId): void {
    const db = getSqlite();
    // The whole desk: what the role raised and what its holder owns.
    db.prepare(
      "delete from actions where raised_by_role_id = ? or owner_user_id = (select holder_user_id from roles where id = ?)",
    ).run(roleId, roleId);
    db.prepare("delete from inbox_messages where role_id = ?").run(roleId);
    db.prepare("delete from calendar_events where role_id = ?").run(roleId);
    db.prepare("delete from ai_suggestions where role_id = ?").run(roleId);
    db.prepare("delete from ai_activity_entries where role_id = ?").run(roleId);
    db.prepare("delete from background_actions where role_id = ?").run(roleId);
    db.prepare("delete from decision_options where decision_id in (select id from decisions where role_id = ?)").run(roleId);
    db.prepare("delete from decisions where role_id = ?").run(roleId);
  }

  for (const roleId of FLAGSHIP) {
    it(`${roleId}: says so in every region instead of showing seeded work`, () => {
      empty(roleId);
      const view = readHomeView(roleId, state());

      expect(view.yourDay.actions.open).toBe(0);
      expect(view.yourDay.actions.value).toBe("No open actions");
      expect(view.yourDay.inbox.needsAttention).toBe(0);
      expect(view.yourDay.inbox.value).toBe("Nothing needs attention");
      expect(view.yourDay.meeting.state).toBe("empty");
      expect(view.yourDay.meeting.value).toBe("No meeting scheduled today");

      expect(view.partner.state).toBe("empty");
      expect(allStatements(view)).toStrictEqual([]);

      expect(view.done.state).toBe("empty");
      expect(view.done.total).toBe(0);
      expect(view.suggestion).toBeNull();
    });
  }

  it("reads the empty German Home in German", () => {
    empty("rcsa");
    const view = readHomeView("rcsa", state({ language: "de" }));
    expect(view.yourDay.actions.value).toBe("Keine offenen Massnahmen");
    expect(view.yourDay.inbox.value).toBe("Nichts benoetigt Aufmerksamkeit");
    expect(view.yourDay.meeting.value).toBe("Heute keine Besprechung geplant");
  });
});
