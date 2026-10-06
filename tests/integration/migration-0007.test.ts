/**
 * Migration 0007 (decisions that belong to a process run), from a database at 0006.
 *
 * Migrates a temporary database to 0006, writes the Q4 RCSA run, the five
 * decisions the RCSA stage contract binds and a decision no stage binds;
 * applies 0007 and checks that the five are linked, each to the stage that
 * waits for it, and nothing else is. A second database holds the five without
 * the Q4 run, and nothing is linked there. The migration's fixed list is held
 * equal to the links the seed derives from the contracts, so a fresh seed and
 * a migrated database agree.
 *
 * The database lives in the system temporary directory, never the repository.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { closeDb, getDb, getSqlite, resolveDbPath } from "@/db/client";
import { decisionProcessLinks } from "@/db/seed/decision-process-links";

let directory = "";

const EXPECTED: Record<string, string> = {
  "DEC-2026-0771": "evidence-refresh",
  "DEC-2026-0744": "risk-control-change",
  "DEC-2026-0745": "first-line-input",
  "DEC-2026-0772": "challenge-workshop",
  "DEC-2026-0782": "actions-approval",
};

function run(sql: string, ...args: unknown[]): void {
  getSqlite().prepare(sql).run(...args);
}

function migrationsUpTo0006(target: string): void {
  const source = resolve(process.cwd(), "src/db/migrations");
  mkdirSync(join(target, "meta"), { recursive: true });
  const journal = JSON.parse(readFileSync(join(source, "meta", "_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
  const kept = journal.entries.filter((entry) => entry.idx <= 6);
  expect(kept.map((entry) => entry.idx)).toStrictEqual([0, 1, 2, 3, 4, 5, 6]);
  writeFileSync(join(target, "meta", "_journal.json"), JSON.stringify({ ...journal, entries: kept }));
  for (const entry of kept) copyFileSync(join(source, `${entry.tag}.sql`), join(target, `${entry.tag}.sql`));
}

function decision(id: string, runId: string, roleId = "rcsa"): void {
  run(
    "insert into decisions (id, run_id, reference, role_id, entity_id, title, question, judgment_kind, presented_at_moment, priority_rank, why_this_matters, prepared_position, supporting_evidence_ids, opposing_evidence_ids, uncertainty_note, confidence, required_authority) values (?, ?, ?, ?, 'ARC-DE', 'D', 'Q', 'agenda', '07:45', 1, 'x', 'x', '[]', '[]', 'x', 0.5, 'rcsa.rate')",
    id,
    runId,
    id,
    roleId,
  );
}

/** Opens a fresh database at 0006, lets `write` add rows, then applies 0007. */
function upgradeFrom0006(name: string, write: () => void): void {
  closeDb();
  const dbPath = join(directory, `${name}.db`);
  if (dbPath.startsWith(resolve(process.cwd()) + sep)) throw new Error("Refusing a database inside the repository.");
  process.env.NFR_DB_PATH = dbPath;
  expect(resolveDbPath()).toBe(dbPath);
  migrate(getDb(), { migrationsFolder: join(directory, "migrations-0006") });
  write();
  migrate(getDb(), { migrationsFolder: "src/db/migrations" });
}

beforeAll(() => {
  closeDb();
  directory = mkdtempSync(join(tmpdir(), "nfr-workos-migration-0007-"));
  migrationsUpTo0006(join(directory, "migrations-0006"));
  upgradeFrom0006("scenario", () => {
    run(
      "insert into role_app_runs (id, run_id, role_app_id, role_id, subject_kind, subject_id, current_stage_id, status, started_at, updated_at) values ('RUN-RCSA-PAYOPS-Q4-2026', 'run-001', 'rcsa-cycle-assistant', 'rcsa', 'assessment', 'RCSA-ARC-DE-PAYOPS-2026-Q4', 'evidence-refresh', 'in-progress', '2026-10-01', '2026-10-01')",
    );
    for (const id of Object.keys(EXPECTED)) decision(id, "run-001");
    decision("DEC-2026-0741", "run-001", "tprm");
  });
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

describe("migration 0007 from 0006", () => {
  it("links the five Q4 decisions to the Q4 run and the stage that waits for each", () => {
    const rows = getSqlite()
      .prepare("select id, process_run_id as run, process_stage_id as stage from decisions where run_id = 'run-001' order by id")
      .all() as Array<{ id: string; run: string | null; stage: string | null }>;
    const linked = Object.fromEntries(rows.filter((row) => row.run !== null).map((row) => [row.id, row.stage]));
    expect(linked).toStrictEqual(EXPECTED);
    expect(rows.every((row) => row.run === null || row.run === "RUN-RCSA-PAYOPS-Q4-2026")).toBe(true);
    expect(rows.find((row) => row.id === "DEC-2026-0741")?.run).toBeNull();
  });

  it("agrees with the links the seed derives from the stage contracts", () => {
    const derived = Object.fromEntries(
      decisionProcessLinks()
        .filter((link) => link.processRunId === "RUN-RCSA-PAYOPS-Q4-2026")
        .map((link) => [link.decisionId, link.processStageId]),
    );
    expect(derived).toStrictEqual(EXPECTED);
    expect(decisionProcessLinks().every((link) => link.processRunId === "RUN-RCSA-PAYOPS-Q4-2026")).toBe(true);
  });

  it("is applied once: migrating again changes nothing", () => {
    migrate(getDb(), { migrationsFolder: "src/db/migrations" });
    expect(getSqlite().prepare("select count(*) as n from decisions where process_run_id is not null").get()).toStrictEqual({ n: 5 });
  });

  it("links nothing on a database that has the decisions but not the Q4 run", () => {
    upgradeFrom0006("no-run", () => {
      for (const id of Object.keys(EXPECTED)) decision(id, "run-001");
    });
    expect(getSqlite().prepare("select count(*) as n from decisions where process_run_id is not null").get()).toStrictEqual({ n: 0 });
  });
});
