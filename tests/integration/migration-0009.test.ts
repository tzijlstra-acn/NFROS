/**
 * Migration 0009 (saved skills), from a database at 0008.
 *
 * Migrates a temporary database to 0008, writes a saved view (the closest
 * existing personalisation row), applies 0009 and checks that:
 *
 *   the `skills` table exists with its columns and both indexes;
 *   the person's existing personalisation is untouched;
 *   the name index refuses a second skill with the same name for the same
 *     person and role, and allows it for another role;
 *   a second migrate changes nothing.
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

function all<T>(sql: string): T[] {
  return getSqlite().prepare(sql).all() as T[];
}

function migrationsUpTo0008(target: string): void {
  const source = resolve(process.cwd(), "src/db/migrations");
  mkdirSync(join(target, "meta"), { recursive: true });
  const journal = JSON.parse(readFileSync(join(source, "meta", "_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
  const kept = journal.entries.filter((entry) => entry.idx <= 8);
  expect(kept.map((entry) => entry.idx)).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  writeFileSync(join(target, "meta", "_journal.json"), JSON.stringify({ ...journal, entries: kept }));
  for (const entry of kept) copyFileSync(join(source, `${entry.tag}.sql`), join(target, `${entry.tag}.sql`));
}

function skill(id: string, roleId: string, name: string): void {
  run(
    "insert into skills (id, run_id, user_id, role_id, name, spec, drafted_via, created_at, created_at_moment, updated_at) values (?, 'run-001', 'P-002', ?, ?, ?, 'rules', '2026-10-06T08:00:00.000Z', '07:45', '2026-10-06T08:00:00.000Z')",
    id,
    roleId,
    name,
    JSON.stringify({ source: "kris", filters: [], sort: { field: "currentStatus", direction: "asc" }, columns: ["name"], limit: 25, schedule: "manual" }),
  );
}

beforeAll(() => {
  closeDb();
  directory = mkdtempSync(join(tmpdir(), "nfr-workos-migration-0009-"));
  const dbPath = join(directory, "scenario.db");
  if (dbPath.startsWith(resolve(process.cwd()) + sep)) throw new Error("Refusing a database inside the repository.");
  process.env.NFR_DB_PATH = dbPath;
  expect(resolveDbPath()).toBe(dbPath);
  const old = join(directory, "migrations-0008");
  migrationsUpTo0008(old);
  migrate(getDb(), { migrationsFolder: old });
  expect(all<{ name: string }>("select name from sqlite_master where type = 'table' and name = 'skills'")).toStrictEqual([]);
  run(
    "insert into saved_views (id, run_id, user_id, role_id, surface, name, filters, created_at, updated_at) values ('SV-1', 'run-001', 'P-002', 'tprm', 'work', 'Overdue evidence requests', '{}', '2026-10-06T08:00:00.000Z', '2026-10-06T08:00:00.000Z')",
  );
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

describe("migration 0009 from 0008", () => {
  it("creates the skills table with its columns and indexes", () => {
    const columns = all<{ name: string; notnull: number }>("pragma table_info(skills)").map((column) => column.name);
    expect(columns).toStrictEqual([
      "id", "run_id", "user_id", "role_id", "name", "request", "spec", "schedule", "drafted_via",
      "created_at", "created_at_moment", "updated_at",
      "last_run_at", "last_run_moment", "last_run_matched", "last_run_in_scope", "last_run_audit_event_id",
    ]);
    const indexes = all<{ name: string }>("select name from sqlite_master where type = 'index' and tbl_name = 'skills' and name not like 'sqlite_%' order by name").map((row) => row.name);
    expect(indexes).toStrictEqual(["skills_name_unq", "skills_role_idx"]);
  });

  it("leaves existing personalisation untouched", () => {
    expect(all("select id, name from saved_views")).toStrictEqual([{ id: "SV-1", name: "Overdue evidence requests" }]);
  });

  it("defaults the schedule and the request, and refuses a duplicate name for the same person and role", () => {
    skill("SKL-AAAAAAAA", "tprm", "KRIs in breach");
    expect(all("select schedule, request from skills where id = 'SKL-AAAAAAAA'")).toStrictEqual([{ schedule: "manual", request: "" }]);
    expect(() => skill("SKL-BBBBBBBB", "tprm", "KRIs in breach")).toThrow(/UNIQUE/);
    skill("SKL-CCCCCCCC", "rcsa", "KRIs in breach");
    expect(all("select count(*) as n from skills")).toStrictEqual([{ n: 2 }]);
  });

  it("is applied once: migrating again changes nothing", () => {
    migrate(getDb(), { migrationsFolder: "src/db/migrations" });
    expect(all("select count(*) as n from skills")).toStrictEqual([{ n: 2 }]);
    expect(all("select count(*) as n from saved_views")).toStrictEqual([{ n: 1 }]);
  });
});
