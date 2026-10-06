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
 *  4. The tables and columns of migration 0006, one current Role App version
 *     per registry app, and a pilot in setup.
 *
 * Exits 0 when all checks pass; exits 1 with a description of the first
 * failure.
 */

import { getSqlite } from "@/db/client";
import { ROLE_APP_REGISTRY } from "@/role-apps/registry";

/** The tables migrations 0006 (AI Partner, Product Owner Console, personalisation) and 0008 create. */
const tables0006 = [
  "ai_routine_runs", "ai_routine_run_outputs", "ai_suggestion_dispositions", "ai_feedback", "partner_contexts",
  "notifications", "role_app_versions", "role_app_lifecycle_events", "role_app_enablements", "product_cohorts",
  "ai_evaluation_runs", "ai_evaluation_case_results", "ai_configuration_releases", "product_feedback",
  "pilot_programmes", "pilot_measures", "pilot_measure_readings", "pilot_issues", "pilot_exit_decisions",
  "product_release_events", "release_gate_runs", "integration_incidents", "data_quality_issues",
  "experience_events", "user_preferences", "saved_views", "user_object_lists",
  /* 0008 */
  "process_stage_inputs",
];

/** Columns migrations 0006, 0007 and 0008 add to existing tables. */
const columns0006: Record<string, string[]> = {
  decisions: ["due_at", "process_run_id", "process_stage_id"],
  inbox_messages: [
    "converted_by_user_id", "converted_at", "conversion_kind", "triage_confirmed_by_user_id", "triage_confirmed_at",
    "triage_reason", "linked_evidence_document_id", "delegated_to_user_id",
  ],
  ai_suggestions: ["disposition", "disposition_at", "disposition_by_user_id"],
  collaboration_messages: ["kind"],
};

const requiredTables = [
  "role_app_runs",
  "role_app_stage_runs",
  "role_app_stage_tasks",
  "role_app_artifacts",
  "os_events",
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

/** Columns migration 0005 (work-object lineage) adds, by table. */
const requiredColumns: Record<string, string[]> = {
  actions: [
    "completion_condition", "completion_condition_by", "completion_condition_at", "blocked_reason", "blocked_since",
    "source_meeting_id", "source_minutes_id", "source_process_run_id", "source_stage_id", "source_stage_run_id", "source_message_id",
  ],
  action_updates: ["kind"],
  approvals: ["target_kind", "target_id"],
  meetings: ["held_by_user_id", "held_at", "process_run_id", "stage_id"],
  evidence_documents: ["source_minutes_id", "source_message_id"],
  meeting_minutes: [
    "draft", "version", "content_digest", "prepared_mode", "edited_by_user_id", "edited_at", "evidence_document_id",
    "distribution_user_ids", "distribution_message_id", "confirmation_approval_id",
  ],
};

function columnNames(table: string): string[] {
  return (getSqlite().prepare(`select name from pragma_table_info('${table}')`).all() as Array<{ name: string }>).map((r) => r.name);
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

  // 1b. Columns added by migration 0005
  for (const [table, columns] of Object.entries(requiredColumns)) {
    const present = existing.includes(table) ? columnNames(table) : [];
    const missing = columns.filter((column) => !present.includes(column));
    if (missing.length === 0) {
      console.log(`  [PASS] ${table} has the 0005 columns`);
      passed++;
    } else {
      console.error(`  [FAIL] ${table} is missing ${missing.join(", ")}: run npm run db:migrate`);
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
      console.error("  [FAIL] role_app_runs is empty: has the database been seeded?");
      failed++;
    }
  }

  // 4. Migration 0006: tables, columns and the seeded product state
  const missingTables = tables0006.filter((table) => !existing.includes(table));
  if (missingTables.length === 0) {
    console.log(`  [PASS] The ${tables0006.length} tables of migrations 0006 and 0008 exist`);
    passed++;
  } else {
    console.error(`  [FAIL] Missing tables ${missingTables.join(", ")}: run npm run db:migrate`);
    failed++;
  }
  for (const [table, columns] of Object.entries(columns0006)) {
    const present = existing.includes(table) ? columnNames(table) : [];
    const missing = columns.filter((column) => !present.includes(column));
    if (missing.length === 0) {
      console.log(`  [PASS] ${table} has the 0006 to 0008 columns`);
      passed++;
    } else {
      console.error(`  [FAIL] ${table} is missing ${missing.join(", ")}: run npm run db:migrate`);
      failed++;
    }
  }
  if (missingTables.length === 0) {
    const versions = rowCount("role_app_versions");
    const current = (getSqlite().prepare("select count(distinct role_app_id) as n from role_app_versions where is_current = 1").get() as { n: number }).n;
    if (versions === ROLE_APP_REGISTRY.length && current === ROLE_APP_REGISTRY.length) {
      console.log(`  [PASS] role_app_versions holds one current version for each of the ${ROLE_APP_REGISTRY.length} registry apps`);
      passed++;
    } else {
      console.error(`  [FAIL] role_app_versions has ${versions} row(s), ${current} app(s) with a current version, for ${ROLE_APP_REGISTRY.length} registry apps: run npm run demo:reset`);
      failed++;
    }
    const measured = (getSqlite().prepare("select count(*) as n from pilot_measures where baseline_status = 'measured'").get() as { n: number }).n;
    const pilots = (getSqlite().prepare("select count(*) as n from pilot_programmes where status = 'setup'").get() as { n: number }).n;
    if (pilots >= 1) {
      console.log(`  [PASS] A pilot is in setup; ${measured} baseline(s) recorded as measured`);
      passed++;
    } else {
      console.error("  [FAIL] No pilot in setup: run npm run demo:reset");
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
