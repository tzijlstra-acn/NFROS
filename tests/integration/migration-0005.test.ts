/**
 * Migration 0005 (work-object lineage), from a database at 0004.
 *
 * Migrates a temporary database to 0004 with the migrations as they were,
 * writes the rows a 0004 day can hold (history entries whose kind is only in
 * their identifier, a blocker and an agreed condition recorded as entries,
 * Work approvals with no decision, a held meeting, confirmed minutes listing
 * an action), then applies 0005 and checks every backfill:
 *
 *   `action_updates.kind` from the identifier prefix;
 *   `actions.blocked_reason` and `completion_condition` from the history;
 *   `actions` meeting, minutes and process lineage from the minutes;
 *   `approvals.target_kind` and `target_id` for decision, Work and stage approvals;
 *   `meetings.held_by_user_id` and `held_at` for a held meeting;
 *   `meetings.process_run_id` and `stage_id` by the Work Hub's own rule;
 *   confirmed minutes filed as an evidence document with lineage.
 *
 * The database lives in the system temporary directory, never the repository.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { closeDb, getDb, getSqlite, resolveDbPath } from "@/db/client";

let directory = "";

function run(sql: string, ...args: unknown[]): void {
  getSqlite().prepare(sql).run(...args);
}

function one<T>(sql: string, ...args: unknown[]): T {
  return getSqlite().prepare(sql).get(...args) as T;
}

/** A migrations folder holding 0000 to 0004 only, with the journal as it stood. */
function migrationsUpTo0004(target: string): void {
  const source = resolve(process.cwd(), "src/db/migrations");
  mkdirSync(join(target, "meta"), { recursive: true });
  const journal = JSON.parse(readFileSync(join(source, "meta", "_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
  const kept = journal.entries.filter((entry) => entry.idx <= 4);
  expect(kept.map((entry) => entry.idx)).toStrictEqual([0, 1, 2, 3, 4]);
  writeFileSync(join(target, "meta", "_journal.json"), JSON.stringify({ ...journal, entries: kept }));
  for (const entry of kept) copyFileSync(join(source, `${entry.tag}.sql`), join(target, `${entry.tag}.sql`));
}

function writeLegacyDay(): void {
  run(
    "insert into scenario_runs (id, label, scenario_date, created_at, current_moment, active_role_id, autonomy_level, world_view, language, event_triggered, seeded_at) values ('run-001', 'Legacy', '2026-10-06', 'x', '13:30', 'rcsa', 'act-with-approval', 'future', 'en', 0, 'x')",
  );
  for (const [id, holder] of [["rcsa", "P-003"], ["tprm", "P-002"]]) {
    run(
      "insert into roles (id, run_id, title, title_de, mandate, hero_visual, hero_visual_label, holder_user_id, entity_id, human_owned_decisions, primary_objects, specialist_agent, sort_order, deeply_interactive) values (?, 'run-001', ?, ?, '', '', '', ?, 'ARC-DE', '[]', '[]', '', 1, 1)",
      id,
      id,
      id,
      holder,
    );
  }
  run("insert into users (id, run_id, name, job_title, entity_id, line, department, email) values ('P-003', 'run-001', 'Marlene Aigner', 'Operational Risk Partner', 'ARC-DE', '2lod', 'Risk', 'm@example.test')");

  /* Two running processes and their scope. */
  run("insert into role_app_runs (id, run_id, role_app_id, role_id, subject_kind, subject_id, current_stage_id, status, started_at, updated_at) values ('RUN-R', 'run-001', 'rcsa-cycle-assistant', 'rcsa', 'assessment', 'ASM-1', 'evidence-refresh', 'in-progress', '2026-10-01', '2026-10-01')");
  run("insert into role_app_runs (id, run_id, role_app_id, role_id, subject_kind, subject_id, current_stage_id, status, started_at, updated_at) values ('RUN-T', 'run-001', 'tprm-third-party-onboarding', 'tprm', 'supplier', 'TP-9', 'evidence-review', 'in-progress', '2026-09-15', '2026-10-01')");
  run("insert into assessments (id, run_id, kind, reference, title, subject_kind, subject_id, entity_id, version, status, cycle, performed_by_user_id, performed_on, residual_risk, overall_conclusion) values ('ASM-1', 'run-001', 'rcsa', 'ASM-1', 'Q4', 'process', 'PRC-1', 'ARC-DE', 1, 'draft', 'Q4', 'P-003', '2026-10-01', 'x', 'x')");
  run("insert into assessment_lines (id, run_id, assessment_id, risk_id, control_ids, inherent_likelihood, inherent_impact, control_effectiveness, residual_likelihood, residual_impact, residual_rating, appetite_position, sort_order) values ('L-1', 'run-001', 'ASM-1', 'RSK-1', '[\"CTL-1\"]', 3, 3, 'partially-effective', 3, 3, 9, 'within', 1)");
  run("insert into role_app_stage_runs (id, run_id, role_app_run_id, stage_id, status) values ('SR-SCOPE', 'run-001', 'RUN-R', 'scope-trigger', 'completed')");
  run("insert into role_app_stage_runs (id, run_id, role_app_run_id, stage_id, status) values ('SR-T4', 'run-001', 'RUN-T', 'evidence-review', 'waiting-for-input')");

  /* Meetings: one per derivation case, and one held. */
  const meeting = (id: string, role: string, kind: string, subject: string, status = "not-started") =>
    run(
      "insert into meetings (id, run_id, role_id, reference, title, kind, moment_label, scheduled_for, participant_user_ids, objective, evidence_document_ids, prepared_questions, status, subject_id, concluded_at) values (?, 'run-001', ?, ?, ?, ?, '10:30', '2026-10-06T10:30:00.000Z', '[]', 'x', '[]', '[]', ?, ?, ?)",
      id,
      role,
      id,
      id,
      kind,
      status,
      subject,
      status === "concluded" ? "2026-10-06T09:40:00.000Z" : null,
    );
  meeting("M-CTL", "rcsa", "rcsa-workshop", "CTL-1");
  meeting("M-SCOPE", "rcsa", "scope-confirmation", "ASM-1", "concluded");
  meeting("M-SUP", "tprm", "supplier-challenge", "TP-9");
  meeting("M-OUT", "tprm", "supplier-challenge", "TP-OTHER", "concluded");
  run(
    "insert into audit_events (id, run_id, at_moment, recorded_at, category, action, object_kind, object_id, actor_kind, summary) values ('AUD-HELD', 'run-001', '11:45', '2026-10-06T09:40:01.000Z', 'mutation', 'recordMeetingHeld', 'meeting', 'M-OUT', 'human', 'Held.')",
  );

  /* Actions and their history, the kind only in the identifier. */
  for (const id of ["ACT-BLK", "ACT-CC", "ACT-MIN"]) {
    run("insert into actions (id, run_id, reference, title, description, kind, entity_id, created_on, status) values (?, 'run-001', ?, ?, 'x', 'evidence-request', 'ARC-DE', '2026-10-01', 'in-progress')", id, id, id);
  }
  const entry = (id: string, action: string, at: string, note: string, after: string, author = "human") =>
    run("insert into action_updates (id, run_id, action_id, at, author_user_id, author_kind, note, evidence_ids, status_after) values (?, 'run-001', ?, ?, 'P-003', ?, ?, '[]', ?)", id, action, at, author, note, after);
  entry("AUP-UPD-L1-0001", "ACT-BLK", "2026-10-06T08:00:00.000Z", "Chased.", "in-progress");
  entry("AUP-BLK-L1-0002", "ACT-BLK", "2026-10-06T08:10:00.000Z", "Supplier will not release it.", "blocked");
  entry("AUP-CC-L1-0003", "ACT-CC", "2026-10-06T08:20:00.000Z", "Closed when the report is filed.", "in-progress");
  entry("AUP-CMP-L1-0004", "ACT-CC", "2026-10-06T08:30:00.000Z", "Done.", "completed");
  entry("imported-1", "ACT-MIN", "2026-10-06T08:40:00.000Z", "Imported.", "in-progress", "system");

  /* Confirmed minutes listing an action, and a draft. */
  run(
    "insert into meeting_minutes (id, run_id, meeting_id, role_id, title, summary, fact_items, decision_ids, action_ids, unresolved_items, evidence_ids, participant_user_ids, status, prepared_by, confirmed_by_user_id, confirmed_at, created_at) values ('MINUTES-1', 'run-001', 'M-SCOPE', 'rcsa', 'Scope minutes', 'Scope confirmed.', '[\"Fact one.\",\"Fact two.\"]', '[]', '[\"ACT-MIN\"]', '[]', '[]', '[\"P-003\"]', 'confirmed', 'ai', 'P-003', '2026-10-01T10:15:00.000Z', '2026-10-01T10:00:00.000Z')",
  );
  run(
    "insert into meeting_minutes (id, run_id, meeting_id, role_id, title, summary, fact_items, decision_ids, action_ids, unresolved_items, evidence_ids, participant_user_ids, status, prepared_by, created_at) values ('MINUTES-2', 'run-001', 'M-SUP', 'tprm', 'Draft', 'Draft.', '[]', '[]', '[]', '[]', '[]', '[]', 'draft', 'ai', '2026-10-01T11:00:00.000Z')",
  );

  /* Approvals: a decision's, a Work approval with no decision, a stage approval. */
  run(
    "insert into decisions (id, run_id, reference, role_id, entity_id, title, question, judgment_kind, presented_at_moment, priority_rank, why_this_matters, prepared_position, supporting_evidence_ids, opposing_evidence_ids, uncertainty_note, confidence, required_authority) values ('DEC-1', 'run-001', 'DEC-1', 'rcsa', 'ARC-DE', 'D', 'Q', 'agenda', '07:45', 1, 'x', 'x', '[]', '[]', 'x', 0.5, 'rcsa.rate')",
  );
  const approval = (id: string, decision: string | null) =>
    run(
      "insert into approvals (id, run_id, decision_id, tool_name, authority_class, approved_by_user_id, role_id, authority_scope, approved_at, approved_at_moment, rationale_confirmed, rationale, autonomy_level, payload_fingerprint) values (?, 'run-001', ?, 'completeAction', 'APPROVAL_REQUIRED', 'P-003', 'rcsa', '[]', 'x', '08:00', 1, 'Mine.', 'act-with-approval', 'fp')",
      id,
      decision,
    );
  approval("APR-D", "DEC-1");
  approval("APR-W", null);
  approval("APR-PRC", "TASK-SR-T4-stage-gate");
  run(
    "insert into audit_events (id, run_id, at_moment, recorded_at, category, action, object_kind, object_id, actor_kind, summary, detail) values ('AUD-APR', 'run-001', '08:00', 'x', 'approval', 'recordApproval', 'approval', 'APR-W', 'human', 'Approved.', ?)",
    JSON.stringify({ subjectKind: "action", subjectId: "ACT-CC", toolName: "completeAction" }),
  );
  run(
    "insert into os_events (id, run_id, sequence, type, at_moment, occurred_at, actor_kind, summary, summary_de, payload, idempotency_key, correlation_id) values ('OSE-1', 'run-001', 1, 'approval-granted', '08:00', 'x', 'human', 'Approved.', 'Genehmigt.', ?, 'approval-granted:APR-PRC', 'SR-T4')",
    JSON.stringify({ approvalId: "APR-PRC" }),
  );
}

beforeAll(() => {
  closeDb();
  directory = mkdtempSync(join(tmpdir(), "nfr-workos-migration-0005-"));
  const dbPath = join(directory, "scenario.db");
  if (dbPath.startsWith(resolve(process.cwd()) + sep)) throw new Error("Refusing a database inside the repository.");
  process.env.NFR_DB_PATH = dbPath;
  expect(resolveDbPath()).toBe(dbPath);

  const old = join(directory, "migrations-0004");
  migrationsUpTo0004(old);
  migrate(getDb(), { migrationsFolder: old });
  expect(one<{ n: number }>("select count(*) as n from pragma_table_info('actions') where name = 'source_meeting_id'").n).toBe(0);
  writeLegacyDay();
  migrate(getDb(), { migrationsFolder: "src/db/migrations" });
});

afterAll(() => {
  closeDb();
  delete process.env.NFR_DB_PATH;
  try {
    rmSync(directory, { recursive: true, force: true });
  } catch {
    /* A locked file on Windows is reclaimed with the temporary directory. */
  }
});

describe("migration 0005 from 0004", () => {
  it("copies the entry kind out of the identifier", () => {
    const kinds = Object.fromEntries(
      (getSqlite().prepare("select id, kind from action_updates").all() as Array<{ id: string; kind: string }>).map((row) => [row.id, row.kind]),
    );
    expect(kinds).toStrictEqual({ "AUP-UPD-L1-0001": "UPD", "AUP-BLK-L1-0002": "BLK", "AUP-CC-L1-0003": "CC", "AUP-CMP-L1-0004": "CMP", "imported-1": "UPD" });
  });

  it("records the blocker and the agreed completion condition the history held", () => {
    expect(one("select blocked_reason as reason, blocked_since as since from actions where id = 'ACT-BLK'")).toStrictEqual({
      reason: "Supplier will not release it.",
      since: "2026-10-06T08:10:00.000Z",
    });
    expect(one("select completion_condition as condition, completion_condition_by as person from actions where id = 'ACT-CC'")).toStrictEqual({
      condition: "Closed when the report is filed.",
      person: "P-003",
    });
    expect(one("select blocked_reason as reason from actions where id = 'ACT-CC'")).toStrictEqual({ reason: null });
  });

  it("gives every approval its target", () => {
    const targets = Object.fromEntries(
      (getSqlite().prepare("select id, target_kind as kind, target_id as target from approvals").all() as Array<{ id: string; kind: string; target: string }>).map((row) => [
        row.id,
        `${row.kind}:${row.target}`,
      ]),
    );
    expect(targets).toStrictEqual({ "APR-D": "decision:DEC-1", "APR-W": "action:ACT-CC", "APR-PRC": "stage-run:SR-T4" });
    /* The decision column is kept for decisions. */
    expect(one("select decision_id as decision from approvals where id = 'APR-D'")).toStrictEqual({ decision: "DEC-1" });
  });

  it("links meetings to the process stage they serve, by the Work Hub's rule, and records who held one and when", () => {
    const links = Object.fromEntries(
      (getSqlite().prepare("select id, process_run_id as run, stage_id as stage from meetings").all() as Array<{ id: string; run: string | null; stage: string | null }>).map((row) => [
        row.id,
        row.run ? `${row.run}/${row.stage}` : null,
      ]),
    );
    expect(links).toStrictEqual({
      "M-CTL": "RUN-R/challenge-workshop",
      "M-SCOPE": "RUN-R/scope-trigger",
      "M-SUP": "RUN-T/evidence-review",
      "M-OUT": null,
    });
    expect(one("select held_by_user_id as by, held_at as at from meetings where id = 'M-OUT'")).toStrictEqual({ by: "P-002", at: "2026-10-06T11:45:00.000Z" });
    expect(one("select held_by_user_id as by from meetings where id = 'M-CTL'")).toStrictEqual({ by: null });
  });

  it("gives the action its minutes listed the meeting, minutes and process lineage", () => {
    expect(
      one("select source_meeting_id as meeting, source_minutes_id as minutes, source_process_run_id as run, source_stage_id as stage, source_stage_run_id as stageRun from actions where id = 'ACT-MIN'"),
    ).toStrictEqual({ meeting: "M-SCOPE", minutes: "MINUTES-1", run: "RUN-R", stage: "scope-trigger", stageRun: "SR-SCOPE" });
    expect(one("select source_minutes_id as minutes from actions where id = 'ACT-BLK'")).toStrictEqual({ minutes: null });
  });

  it("files confirmed minutes as evidence with lineage, and leaves a draft alone", () => {
    const doc = one<{ type: string; related: string; body: string; source: string }>(
      "select source_type as type, related_object_ids as related, body, source_minutes_id as source from evidence_documents where id = 'EVD-MINUTES-1'",
    );
    expect(doc).toMatchObject({ type: "meeting-minutes", source: "MINUTES-1" });
    expect(JSON.parse(doc.related)).toStrictEqual(["M-SCOPE", "MINUTES-1"]);
    expect(doc.body).toContain("Fact two.");
    expect(one("select count(*) as n from evidence_chunks where document_id = 'EVD-MINUTES-1'")).toStrictEqual({ n: 1 });
    expect(one("select evidence_document_id as doc from meeting_minutes where id = 'MINUTES-1'")).toStrictEqual({ doc: "EVD-MINUTES-1" });
    expect(one("select evidence_document_id as doc, version, distribution_user_ids as distribution from meeting_minutes where id = 'MINUTES-2'")).toStrictEqual({
      doc: null,
      version: 1,
      distribution: "[]",
    });
  });

  it("is applied once: migrating again changes nothing", () => {
    const before = one<{ n: number }>("select count(*) as n from evidence_documents").n;
    migrate(getDb(), { migrationsFolder: "src/db/migrations" });
    expect(one<{ n: number }>("select count(*) as n from evidence_documents").n).toBe(before);
  });
});
