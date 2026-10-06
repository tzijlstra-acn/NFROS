/**
 * Verifies the seeded scenario against the depth minimums in the product
 * brief.
 *
 * This exists because "the seed is deep enough" is easy to assert and easy to
 * get wrong, and a thin scenario is the failure mode that makes a prototype
 * feel like a mock-up. The minimums are the brief's, not ours.
 *
 * Run with: npm run verify:seed
 */

import { closeDb, getSqlite, isDatabaseReady } from "../src/db/client";

interface Check {
  label: string;
  sql: string;
  minimum: number;
}

const CHECKS: Check[] = [
  { label: "personas", sql: "select count(*) as n from users", minimum: 6 },
  { label: "function roles", sql: "select count(*) as n from roles", minimum: 6 },
  { label: "legal entities", sql: "select count(*) as n from legal_entities", minimum: 3 },
  { label: "suppliers", sql: "select count(*) as n from suppliers", minimum: 6 },
  { label: "services", sql: "select count(*) as n from services", minimum: 12 },
  { label: "processes", sql: "select count(*) as n from processes", minimum: 10 },
  { label: "risks", sql: "select count(*) as n from risks", minimum: 14 },
  { label: "controls", sql: "select count(*) as n from controls", minimum: 24 },
  { label: "key risk indicators", sql: "select count(*) as n from kris", minimum: 8 },
  { label: "assessments", sql: "select count(*) as n from assessments", minimum: 6 },
  { label: "control tests", sql: "select count(*) as n from control_tests", minimum: 8 },
  { label: "synthetic transactions", sql: "select count(*) as n from test_cases", minimum: 100 },
  { label: "incidents and near misses", sql: "select count(*) as n from incidents", minimum: 8 },
  { label: "actions", sql: "select count(*) as n from actions", minimum: 30 },
  { label: "evidence documents", sql: "select count(*) as n from evidence_documents", minimum: 40 },
  { label: "inbox messages", sql: "select count(*) as n from inbox_messages", minimum: 60 },
  { label: "meetings", sql: "select count(*) as n from meetings", minimum: 18 },
  { label: "policy sections", sql: "select count(*) as n from policies", minimum: 15 },
  { label: "obligations", sql: "select count(*) as n from obligations", minimum: 12 },
  {
    label: "pre-existing audit events",
    sql: "select count(*) as n from audit_events where pre_existing = 1",
    minimum: 20,
  },
  {
    label: "committee meetings",
    sql: "select count(distinct committee_ref) as n from committee_items",
    minimum: 2,
  },
  {
    label: "shared cross-function event",
    sql: "select count(*) as n from incidents where is_shared_event = 1",
    minimum: 1,
  },
];

/** Further structural expectations that a bare count would not catch. */
const STRUCTURAL: Check[] = [
  {
    label: "decisions, at least four per role",
    sql: "select min(n) as n from (select count(*) as n from decisions group by role_id)",
    minimum: 4,
  },
  {
    label: "options per decision, at least three",
    sql: "select min(n) as n from (select count(*) as n from decision_options group by decision_id)",
    minimum: 3,
  },
  {
    label: "timeline moments per role",
    sql: "select min(n) as n from (select count(*) as n from timeline_role_moments group by role_id)",
    minimum: 10,
  },
  {
    label: "roles reached by the shared event",
    sql: "select count(distinct role_id) as n from decisions where from_shared_event = 1",
    minimum: 4,
  },
  {
    label: "functions on the widest decision thread",
    sql: "select max(n) as n from (select count(distinct role_id) as n from decisions where shared_thread_id is not null group by shared_thread_id)",
    minimum: 4,
  },
  {
    label: "evidence documents that are requested or missing",
    sql: "select count(*) as n from evidence_documents where status in ('requested','missing')",
    minimum: 3,
  },
  {
    label: "stale evidence documents",
    sql: "select count(*) as n from evidence_documents where is_stale = 1",
    minimum: 3,
  },
  {
    label: "duplicate inbox requests",
    sql: "select count(*) as n from inbox_messages where is_duplicate_of is not null",
    minimum: 3,
  },
  {
    label: "calendar conflicts",
    sql: "select count(*) as n from calendar_events where has_conflict = 1",
    minimum: 4,
  },
  {
    label: "meeting turns carrying a contradiction flag",
    sql: "select count(*) as n from meeting_messages where contradicts_evidence_id is not null",
    minimum: 4,
  },
  {
    label: "subprocessor discrepancies",
    sql: "select count(*) as n from subprocessors where is_discrepancy = 1",
    minimum: 1,
  },
  {
    label: "unowned obligation gaps",
    sql: "select count(*) as n from obligations where is_unowned_gap = 1",
    minimum: 3,
  },
  {
    label: "unowned actions",
    sql: "select count(*) as n from actions where is_unowned = 1",
    minimum: 3,
  },
  {
    label: "background actions",
    sql: "select count(*) as n from background_actions",
    minimum: 60,
  },
  {
    label: "retrieval chunks",
    sql: "select count(*) as n from evidence_chunks",
    minimum: 100,
  },
];

/** Things that must be ZERO, because they are the human's to decide. */
const MUST_BE_ZERO: Check[] = [
  {
    label: "decisions already decided at seed time",
    sql: "select count(*) as n from decisions where status != 'open'",
    minimum: 0,
  },
  {
    label: "shared event carrying a severity at seed time",
    sql: "select count(*) as n from incidents where is_shared_event = 1 and severity is not null",
    minimum: 0,
  },
  {
    label: "obligations with an applicability decision at seed time",
    sql: "select count(*) as n from obligations where applicability_decision is not null",
    minimum: 0,
  },
  {
    label: "test exceptions already classified at seed time",
    sql: "select count(*) as n from test_cases where outcome = 'exception' and exception_classification is not null",
    minimum: 0,
  },
  {
    label: "approvals present at seed time",
    sql: "select count(*) as n from approvals",
    minimum: 0,
  },
  {
    label: "execution receipt lines at seed time",
    sql: "select count(*) as n from execution_receipt_lines",
    minimum: 0,
  },
];

/* Minutes are referentially intact (audit T20): every reference resolves. Each must be zero. */
const REFERENTIAL: Check[] = [
  {
    label: "minutes whose meeting does not exist",
    sql: "select count(*) as n from meeting_minutes m where not exists (select 1 from meetings g where g.run_id = m.run_id and g.id = m.meeting_id)",
    minimum: 0,
  },
  {
    label: "minutes citing a missing decision or action",
    sql: "select (select count(*) from meeting_minutes m, json_each(m.decision_ids) j where not exists (select 1 from decisions d where d.id = j.value)) + (select count(*) from meeting_minutes m, json_each(m.action_ids) j where not exists (select 1 from actions a where a.id = j.value)) as n",
    minimum: 0,
  },
  {
    label: "minutes citing missing evidence",
    sql: "select count(*) as n from meeting_minutes m, json_each(m.evidence_ids) j where not exists (select 1 from evidence_documents e where e.id = j.value)",
    minimum: 0,
  },
  {
    label: "confirmed minutes not filed as evidence",
    sql: "select count(*) as n from meeting_minutes m where m.status in ('confirmed','distributed') and not exists (select 1 from evidence_documents e where e.id = m.evidence_document_id and e.source_minutes_id = m.id)",
    minimum: 0,
  },
];

function run(checks: Check[], mode: "at-least" | "exactly-zero"): number {
  let failures = 0;
  for (const check of checks) {
    const row = getSqlite().prepare(check.sql).get() as { n: number | null } | undefined;
    const value = row?.n ?? 0;
    const ok = mode === "at-least" ? value >= check.minimum : value === 0;
    if (!ok) failures += 1;
    const expectation = mode === "at-least" ? `min ${check.minimum}` : "must be 0";
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${check.label.padEnd(46)} ${String(value).padStart(5)}  (${expectation})`,
    );
  }
  return failures;
}

function main(): void {
  if (!isDatabaseReady()) {
    console.error("The scenario is not seeded. Run npm run db:migrate and npm run db:seed.");
    process.exit(1);
  }

  console.log("Seed depth minimums from the product brief:");
  let failures = run(CHECKS, "at-least");

  console.log("\nStructural expectations:");
  failures += run(STRUCTURAL, "at-least");

  console.log("\nDecisions reserved for a human, which must be unmade:");
  failures += run(MUST_BE_ZERO, "exactly-zero");

  console.log("\nReferences that must resolve:");
  failures += run(REFERENTIAL, "exactly-zero");

  const total = getSqlite()
    .prepare(
      "select (select count(*) from evidence_documents) + (select count(*) from decisions) + (select count(*) from test_cases) as n",
    )
    .get() as { n: number };
  console.log(`\nSpot total across three of the largest tables: ${total.n} rows.`);

  closeDb();

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nEvery seed depth and structural check passed.");
}

main();
