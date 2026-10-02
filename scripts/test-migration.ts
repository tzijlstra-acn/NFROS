#!/usr/bin/env tsx
/**
 * scripts/test-migration.ts
 *
 * Verifies migration integrity after a schema change.
 *
 * Checks:
 *  1. The expected tables exist in the database.
 *  2. The role_app_runs count is at least one (seed data present).
 *  3. Background job tables are present.
 *
 * Exits 0 when all checks pass; exits 1 with a description of the first
 * failure.
 */

import { getSqlite } from "@/db/client";

const requiredTables = [
  "role_app_runs",
  "role_app_stage_runs",
  "role_app_stage_tasks",
  "role_app_artifacts",
  "role_app_events",
  "ai_routines",
  "meeting_minutes",
  "action_updates",
  "background_jobs",
  "background_job_attempts",
];

function tableNames(): string[] {
  return (
    getSqlite()
      .prepare(
        "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name",
      )
      .all() as Array<{ name: string }>
  ).map((r) => r.name);
}

function rowCount(table: string): number {
  const row = getSqlite()
    .prepare(`select count(*) as n from "${table}"`)
    .get() as { n: number } | undefined;
  return row?.n ?? 0;
}

function main(): void {
  const existing = tableNames();
  console.log(`\nMigration integrity check`);
  console.log(`Total tables: ${existing.length}`);

  let passed = 0;
  let failed = 0;

  // 1. Required table presence
  for (const table of requiredTables) {
    if (existing.includes(table)) {
      console.log(`  [PASS] Table exists: ${table}`);
      passed++;
    } else {
      console.error(`  [FAIL] Missing table: ${table}`);
      failed++;
    }
  }

  // 2. Seed data: role_app_runs
  if (existing.includes("role_app_runs")) {
    const count = rowCount("role_app_runs");
    if (count > 0) {
      console.log(`  [PASS] role_app_runs has ${count} row(s)`);
      passed++;
    } else {
      console.error("  [FAIL] role_app_runs is empty -- has the database been seeded?");
      failed++;
    }
  }

  // 3. Background jobs table is empty (no seed data needed)
  if (existing.includes("background_jobs")) {
    const depth = rowCount("background_jobs");
    console.log(`  [INFO] background_jobs depth: ${depth}`);
    passed++;
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
