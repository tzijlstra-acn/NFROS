/**
 * Migration 0006 (AI Partner, Product Owner Console and personalisation), from a database at 0005.
 *
 * Migrates a temporary database to 0005 with the migrations as they were,
 * writes the rows a 0005 day can hold that 0006 has a rule for, applies 0006
 * and checks:
 *
 *   every new table exists, empty, with its unique and partial indexes;
 *   `inbox_messages.converted_by_user_id` and `converted_at` from the
 *     backbone's first `inbox-converted:<message>:action:` or `:decision:`
 *     event, and null where no event records who made the message work
 *     (filing it as evidence alone is not converting it to work);
 *   `decisions.due_at` for the three seeded decisions whose own text names
 *     the time, matched on id and reference, and null for every other;
 *   `ai_suggestions.disposition` "new" for an existing suggestion;
 *   a second migrate changes nothing.
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

const NEW_TABLES = [
  "ai_routine_runs", "ai_routine_run_outputs", "ai_suggestion_dispositions", "ai_feedback", "partner_contexts",
  "notifications", "role_app_versions", "role_app_lifecycle_events", "role_app_enablements", "product_cohorts",
  "ai_evaluation_runs", "ai_evaluation_case_results", "ai_configuration_releases", "product_feedback",
  "pilot_programmes", "pilot_measures", "pilot_measure_readings", "pilot_issues", "pilot_exit_decisions",
  "product_release_events", "release_gate_runs", "integration_incidents", "data_quality_issues",
  "experience_events", "user_preferences", "saved_views", "user_object_lists",
] as const;

function run(sql: string, ...args: unknown[]): void {
  getSqlite().prepare(sql).run(...args);
}

function one<T>(sql: string, ...args: unknown[]): T {
  return getSqlite().prepare(sql).get(...args) as T;
}

/**
 * A migrations folder holding 0000 to `last` only, with the journal as it
 * stood. The test stops at 0006 on purpose: 0008 recomputes the inbox
 * conversion under a wider definition, and is tested on its own.
 */
function migrationsUpTo(target: string, last: number): void {
  const source = resolve(process.cwd(), "src/db/migrations");
  mkdirSync(join(target, "meta"), { recursive: true });
  const journal = JSON.parse(readFileSync(join(source, "meta", "_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
  const kept = journal.entries.filter((entry) => entry.idx <= last);
  expect(kept.map((entry) => entry.idx)).toStrictEqual(Array.from({ length: last + 1 }, (_, index) => index));
  writeFileSync(join(target, "meta", "_journal.json"), JSON.stringify({ ...journal, entries: kept }));
  for (const entry of kept) copyFileSync(join(source, `${entry.tag}.sql`), join(target, `${entry.tag}.sql`));
}

function inbox(id: string, linkedActionId: string | null, linkedDecisionId: string | null): void {
  run(
    "insert into inbox_messages (id, run_id, role_id, channel, from_label, subject, body, received_at, revealed_at_moment, proposed_triage, linked_action_id, linked_decision_id) values (?, 'run-001', 'tprm', 'mail', 'Sender', ?, 'Body.', '2026-10-06T07:00:00.000Z', '07:45', 'action', ?, ?)",
    id,
    id,
    linkedActionId,
    linkedDecisionId,
  );
}

function backboneEvent(id: string, sequence: number, key: string, actor: string, occurredAt: string): void {
  run(
    "insert into os_events (id, run_id, sequence, type, role_id, at_moment, occurred_at, actor_kind, actor_user_id, summary, summary_de, payload, idempotency_key) values (?, 'run-001', ?, 'work-arrived', 'tprm', '09:00', ?, 'human', ?, 'Converted.', 'Umgewandelt.', '{}', ?)",
    id,
    sequence,
    occurredAt,
    actor,
    key,
  );
}

function decision(id: string, reference: string): void {
  run(
    "insert into decisions (id, run_id, reference, role_id, entity_id, title, question, judgment_kind, presented_at_moment, priority_rank, why_this_matters, prepared_position, supporting_evidence_ids, opposing_evidence_ids, uncertainty_note, confidence, required_authority) values (?, 'run-001', ?, 'rcsa', 'ARC-DE', 'D', 'Q', 'agenda', '07:45', 1, 'x', 'x', '[]', '[]', 'x', 0.5, 'rcsa.rate')",
    id,
    reference,
  );
}

function writeLegacyDay(): void {
  /* Two messages converted on the backbone, one linked with no event, one untouched. */
  inbox("MSG-A", "ACT-1", null);
  inbox("MSG-D", null, "DEC-X");
  inbox("MSG-SILENT", "ACT-2", null);
  inbox("MSG-NONE", null, null);
  inbox("MSG-E", "ACT-4", null);
  inbox("MSG-FILED", null, null);
  /* Two events for MSG-A: the earlier one is the conversion. MSG-AB shares a prefix and must not match. */
  backboneEvent("OSE-1", 1, "inbox-converted:MSG-A:action:ACT-1", "P-002", "2026-10-06T09:00:00.000Z");
  backboneEvent("OSE-2", 2, "inbox-converted:MSG-A:action:ACT-9", "P-099", "2026-10-06T10:00:00.000Z");
  backboneEvent("OSE-3", 3, "inbox-converted:MSG-D:decision:DEC-X", "P-002", "2026-10-06T11:00:00.000Z");
  backboneEvent("OSE-4", 4, "inbox-converted:MSG-AB:action:ACT-3", "P-077", "2026-10-06T08:00:00.000Z");
  /* Filed as evidence first, raised as an action later: work is the action. Filing alone is not work. */
  backboneEvent("OSE-5", 5, "inbox-converted:MSG-E:evidence:EVD-MSG-E", "P-003", "2026-10-06T08:30:00.000Z");
  backboneEvent("OSE-6", 6, "inbox-converted:MSG-E:action:ACT-4", "P-003", "2026-10-06T12:00:00.000Z");
  backboneEvent("OSE-7", 7, "inbox-converted:MSG-FILED:evidence:EVD-MSG-FILED", "P-003", "2026-10-06T08:40:00.000Z");

  /* The three decisions the seed dates, one id reused under another reference, and one with no stated time. */
  decision("DEC-2026-0745", "RCSA-D3");
  decision("DEC-2026-0772", "RCSA-D4");
  decision("DEC-2026-0782", "RCSA-D5");
  decision("DEC-2026-0741", "TPRM-D1");
  run("insert into decisions (id, run_id, reference, role_id, entity_id, title, question, judgment_kind, presented_at_moment, priority_rank, why_this_matters, prepared_position, supporting_evidence_ids, opposing_evidence_ids, uncertainty_note, confidence, required_authority) values ('DEC-OTHER', 'run-002', 'RCSA-D3', 'rcsa', 'ARC-DE', 'D', 'Q', 'agenda', '07:45', 1, 'x', 'x', '[]', '[]', 'x', 0.5, 'rcsa.rate')");

  /* A suggestion from before dispositions existed. */
  run(
    "insert into ai_suggestions (id, run_id, role_id, object_type, object_id, at_moment, status, priority, headline, change_summary, why_it_matters, checks_completed, actions_completed, alternatives, evidence_ids, confidence, uncertainty, decision_required, authority_class, source, missing_required_sources, source_connector_ids, stages, state_digest, created_at) values ('SUG-1', 'run-001', 'rcsa', 'kri', 'KRI-1', '07:45', 'needs-user', 'high', 'H', 'C', 'W', '[]', '[]', '[]', '[]', 70, '[]', 1, 'PROPOSE', 'seeded', '[]', '[]', '[]', 'digest', '2026-10-06T06:00:00.000Z')",
  );
}

beforeAll(() => {
  closeDb();
  directory = mkdtempSync(join(tmpdir(), "nfr-workos-migration-0006-"));
  const dbPath = join(directory, "scenario.db");
  if (dbPath.startsWith(resolve(process.cwd()) + sep)) throw new Error("Refusing a database inside the repository.");
  process.env.NFR_DB_PATH = dbPath;
  expect(resolveDbPath()).toBe(dbPath);

  const old = join(directory, "migrations-0005");
  migrationsUpTo(old, 5);
  migrationsUpTo(join(directory, "migrations-0006"), 6);
  migrate(getDb(), { migrationsFolder: old });
  expect(one<{ n: number }>("select count(*) as n from pragma_table_info('decisions') where name = 'due_at'").n).toBe(0);
  expect(one<{ n: number }>("select count(*) as n from sqlite_master where type = 'table' and name = 'role_app_versions'").n).toBe(0);
  writeLegacyDay();
  migrate(getDb(), { migrationsFolder: join(directory, "migrations-0006") });
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

describe("migration 0006 from 0005", () => {
  it("creates every new table, empty", () => {
    for (const table of NEW_TABLES) {
      expect(one<{ n: number }>("select count(*) as n from sqlite_master where type = 'table' and name = ?", table).n, table).toBe(1);
      expect(one<{ n: number }>(`select count(*) as n from "${table}"`).n, table).toBe(0);
    }
  });

  it("records who converted a message, and when, from the backbone's conversion event only", () => {
    const rows = Object.fromEntries(
      (getSqlite().prepare("select id, converted_by_user_id as by, converted_at as at from inbox_messages").all() as Array<{ id: string; by: string | null; at: string | null }>).map((row) => [
        row.id,
        { by: row.by, at: row.at },
      ]),
    );
    expect(rows).toStrictEqual({
      "MSG-A": { by: "P-002", at: "2026-10-06T09:00:00.000Z" },
      "MSG-D": { by: "P-002", at: "2026-10-06T11:00:00.000Z" },
      /* Linked, but nothing records who linked it: left null, not guessed. */
      "MSG-SILENT": { by: null, at: null },
      "MSG-NONE": { by: null, at: null },
      "MSG-E": { by: "P-003", at: "2026-10-06T12:00:00.000Z" },
      "MSG-FILED": { by: null, at: null },
    });
  });

  it("dates only the decisions whose own record names the time", () => {
    const due = Object.fromEntries(
      (getSqlite().prepare("select id, due_at as due from decisions").all() as Array<{ id: string; due: string | null }>).map((row) => [row.id, row.due]),
    );
    expect(due).toStrictEqual({
      "DEC-2026-0745": "2026-10-06T10:30:00.000Z",
      "DEC-2026-0772": "2026-10-06T12:00:00.000Z",
      "DEC-2026-0782": "2026-10-08T12:00:00.000Z",
      "DEC-2026-0741": null,
      "DEC-OTHER": null,
    });
  });

  it("gives an existing suggestion the disposition new, with no history", () => {
    expect(one("select disposition, disposition_at as at, disposition_by_user_id as by from ai_suggestions where id = 'SUG-1'")).toStrictEqual({
      disposition: "new",
      at: null,
      by: null,
    });
  });

  it("enforces one current version per Role App, and once-only keys", () => {
    const insert = (id: string, version: string, current: number) =>
      run(
        "insert into role_app_versions (id, role_app_id, role_id, version, lifecycle_state, is_current, process_stage_ids, implemented_stage_ids, source_requirements, tools, authority, evaluations, connector_dependencies, support_state, created_at, created_by_label) values (?, 'app', 'rcsa', ?, 'installed', ?, '[]', '[]', '[]', '[]', '{}', '{}', '[]', 'maintained', 'x', 'test')",
        id,
        version,
        current,
      );
    insert("V1", "1.0.0", 1);
    insert("V2", "1.1.0", 0);
    expect(() => insert("V3", "1.2.0", 1)).toThrow(/UNIQUE/);
    expect(() => insert("V4", "1.0.0", 0)).toThrow(/UNIQUE/);

    const routine = (id: string) =>
      run(
        "insert into ai_routine_runs (id, run_id, routine_id, role_id, trigger_kind, status, mode, at_moment, started_at, idempotency_key) values (?, 'run-001', 'morning-brief-rcsa', 'rcsa', 'schedule', 'queued', 'offline', '07:00', 'x', 'routine:morning-brief-rcsa:2026-10-06')",
        id,
      );
    routine("RR-1");
    expect(() => routine("RR-2")).toThrow(/UNIQUE/);
    run("delete from role_app_versions");
    run("delete from ai_routine_runs");
  });

  it("is applied once: migrating again changes nothing", () => {
    const before = one<{ n: number }>("select count(*) as n from decisions where due_at is not null").n;
    migrate(getDb(), { migrationsFolder: join(directory, "migrations-0006") });
    expect(one<{ n: number }>("select count(*) as n from decisions where due_at is not null").n).toBe(before);
    expect(one<{ n: number }>("select count(*) as n from inbox_messages where converted_at is not null").n).toBe(3);
  });
});
