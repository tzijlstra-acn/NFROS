/**
 * Migration 0008 (stored inbox lineage and process stage inputs), from a database at 0007.
 *
 * Migrates a temporary database to 0007, writes the rows and backbone events
 * the Inbox's handlers leave behind (in the shapes `inbox/tools.ts` writes
 * them), applies 0008 and checks each backfill against the Inbox's own
 * derivation (`inbox/lineage.ts`):
 *
 *   `collaboration_messages.kind` from the channel the Inbox, Meetings and
 *     Actions write;
 *   `linked_evidence_document_id` and `delegated_to_user_id` from the
 *     evidence filed from a message and its delegation;
 *   `conversion_kind`, `converted_by_user_id`, `converted_at`: the first
 *     conversion to work of any kind; a dismissal only while there is none;
 *     the kind alone for a link no event records;
 *   triage attribution from the person's latest triage of the standing
 *     classification, or from the conversion that confirmed it;
 *   one `process_stage_inputs` row per "Add to process" event;
 *   a second migrate changes nothing.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { closeDb, getDb, getSqlite, resolveDbPath } from "@/db/client";

let directory = "";
let sequence = 0;

function run(sql: string, ...args: unknown[]): void {
  getSqlite().prepare(sql).run(...args);
}

function all<T>(sql: string): T[] {
  return getSqlite().prepare(sql).all() as T[];
}

function migrationsUpTo0007(target: string): void {
  const source = resolve(process.cwd(), "src/db/migrations");
  mkdirSync(join(target, "meta"), { recursive: true });
  const journal = JSON.parse(readFileSync(join(source, "meta", "_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
  const kept = journal.entries.filter((entry) => entry.idx <= 7);
  expect(kept.map((entry) => entry.idx)).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  writeFileSync(join(target, "meta", "_journal.json"), JSON.stringify({ ...journal, entries: kept }));
  for (const entry of kept) copyFileSync(join(source, `${entry.tag}.sql`), join(target, `${entry.tag}.sql`));
}

function message(id: string, values: { confirmedTriage?: string; linkedActionId?: string; linkedDecisionId?: string } = {}): void {
  run(
    "insert into inbox_messages (id, run_id, role_id, channel, from_label, subject, body, received_at, revealed_at_moment, proposed_triage, confirmed_triage, linked_action_id, linked_decision_id) values (?, 'run-001', 'tprm', 'mail', 'Sender', ?, 'Body.', '2026-10-06T07:00:00.000Z', '07:45', 'action', ?, ?, ?)",
    id,
    id,
    values.confirmedTriage ?? null,
    values.linkedActionId ?? null,
    values.linkedDecisionId ?? null,
  );
}

/** One inbox event, in the payload shape `publish` in inbox/tools.ts writes. */
function event(key: string, actor: string, at: string, payload: Record<string, unknown>, audit: string | null = null): void {
  sequence += 1;
  run(
    "insert into os_events (id, run_id, sequence, type, role_id, at_moment, occurred_at, actor_kind, actor_user_id, summary, summary_de, payload, idempotency_key, audit_event_id, process_run_id, stage_id) values (?, 'run-001', ?, 'work-arrived', 'tprm', '09:00', ?, 'human', ?, 'x', 'x', ?, ?, ?, ?, ?)",
    `OSE-${sequence}`,
    sequence,
    at,
    actor,
    JSON.stringify({ source: "inbox", outcome: "executed", ...payload }),
    key,
    audit,
    (payload["processRunId"] as string | undefined) ?? null,
    (payload["stageId"] as string | undefined) ?? null,
  );
}

function collaboration(id: string, channel: string, relatedId: string | null, toUserId = "P-010"): void {
  run(
    "insert into collaboration_messages (id, run_id, from_role_id, to_user_ids, channel_name, subject, body, sent_at_moment, sent_at, related_object_kind, related_object_id) values (?, 'run-001', 'tprm', ?, ?, 's', 'b', '09:00', '2026-10-06T09:00:00.000Z', ?, ?)",
    id,
    JSON.stringify([toUserId]),
    channel,
    relatedId ? "inbox-message" : null,
    relatedId,
  );
}

function evidenceFrom(messageId: string): void {
  run(
    "insert into evidence_documents (id, run_id, reference, title, source_type, source_system, author_label, document_date, ingested_at, entity_ids, data_classification, status, provenance, body, summary, related_object_ids, source_message_id) values (?, 'run-001', ?, 't', 'correspondence', 'Work Hub inbox', 'Sender', '2026-10-06', '2026-10-06T08:30:00.000Z', '[\"ARC-DE\"]', 'internal', 'current', 'stakeholder-statement', 'b', 's', '[]', ?)",
    `EVD-${messageId}`,
    messageId,
    messageId,
  );
}

function writeInboxDay(): void {
  const T = (time: string) => `2026-10-06T${time}:00.000Z`;

  /* An action raised from a message. */
  message("M-ACT", { confirmedTriage: "action", linkedActionId: "ACT-1" });
  event("inbox-converted:M-ACT:action:ACT-1", "P-002", T("09:00"), { messageId: "M-ACT", operation: "link", targetKind: "action", targetId: "ACT-1" });

  /* Filed as evidence first, then raised as an action: the first conversion stands. */
  message("M-EV", { confirmedTriage: "evidence", linkedActionId: "ACT-2" });
  evidenceFrom("M-EV");
  event("inbox-converted:M-EV:evidence:EVD-M-EV", "P-003", T("08:30"), { messageId: "M-EV", operation: "evidence", evidenceDocumentId: "EVD-M-EV" });
  event("inbox-converted:M-EV:action:ACT-2", "P-002", T("10:00"), { messageId: "M-EV", operation: "link", targetKind: "action", targetId: "ACT-2" });

  /* Dismissed, then turned into a decision input: work replaces the dismissal. */
  message("M-UNDO", { confirmedTriage: "noise", linkedDecisionId: "DEC-1" });
  event("inbox-triage:M-UNDO:1", "P-002", T("08:00"), { messageId: "M-UNDO", operation: "triage", from: "decision", to: "noise", reason: "Looked like noise." });
  event("inbox-converted:M-UNDO:decision:DEC-1", "P-002", T("11:00"), { messageId: "M-UNDO", operation: "link", targetKind: "decision", targetId: "DEC-1" });

  /* Dismissed and nothing else. And one dismissed with no event at all. */
  message("M-NOISE", { confirmedTriage: "noise" });
  event("inbox-triage:M-NOISE:1", "P-002", T("08:10"), { messageId: "M-NOISE", operation: "triage", from: "noise", to: "noise", reason: "" });
  message("M-NOISE-SILENT", { confirmedTriage: "noise" });

  /* Attached to a process stage. */
  message("M-PROC", { confirmedTriage: "decision" });
  event(
    "inbox-converted:M-PROC:process:RUN-T:evidence-review",
    "P-002",
    T("09:30"),
    { messageId: "M-PROC", operation: "process", processRunId: "RUN-T", stageId: "evidence-review", stageRunId: "SR-T4" },
    "AUD-9",
  );

  /* Delegated to a colleague, and a reply on another message. */
  message("M-DEL", { confirmedTriage: "delegate" });
  collaboration("COL-1", "Inbox delegation", "M-DEL", "P-010");
  event("inbox-converted:M-DEL:delegated:COL-1", "P-002", T("09:40"), { messageId: "M-DEL", operation: "delegate", collaborationMessageId: "COL-1", toUserIds: ["P-010"] });
  collaboration("COL-2", "Inbox reply", "M-ACT", "P-020");
  collaboration("COL-3", "Meeting minutes", null);
  collaboration("COL-4", "Factual validation", null);
  collaboration("COL-5", "Action follow-up", null);
  collaboration("COL-6", "Novalink Reassessment 2026", null);
  /* A delegation channel name on a row that is not about an inbox message is not a delegation. */
  collaboration("COL-7", "Inbox delegation", null);

  /* Filed as information by a person, with a reason, after re-triage. */
  message("M-INFO", { confirmedTriage: "information" });
  event("inbox-triage:M-INFO:1", "P-002", T("08:20"), { messageId: "M-INFO", operation: "triage", from: "action", to: "action", reason: "" });
  event("inbox-triage:M-INFO:2", "P-003", T("08:40"), { messageId: "M-INFO", operation: "triage", from: "action", to: "information", reason: "Already in the pack." });

  /* Linked before events existed: the kind is known, who and when are not. */
  message("M-OLD", { linkedActionId: "ACT-OLD" });

  /* A prefix of another message's id must not take its events. */
  message("M-AC");
  message("M-NONE");
}

beforeAll(() => {
  closeDb();
  directory = mkdtempSync(join(tmpdir(), "nfr-workos-migration-0008-"));
  const dbPath = join(directory, "scenario.db");
  if (dbPath.startsWith(resolve(process.cwd()) + sep)) throw new Error("Refusing a database inside the repository.");
  process.env.NFR_DB_PATH = dbPath;
  expect(resolveDbPath()).toBe(dbPath);
  const old = join(directory, "migrations-0007");
  migrationsUpTo0007(old);
  migrate(getDb(), { migrationsFolder: old });
  writeInboxDay();
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

type Row = {
  id: string;
  kind: string | null;
  by: string | null;
  at: string | null;
  tby: string | null;
  tat: string | null;
  reason: string | null;
  evidence: string | null;
  delegate: string | null;
};

function rows(): Record<string, Omit<Row, "id">> {
  return Object.fromEntries(
    all<Row>(
      "select id, conversion_kind as kind, converted_by_user_id as by, converted_at as at, triage_confirmed_by_user_id as tby, triage_confirmed_at as tat, triage_reason as reason, linked_evidence_document_id as evidence, delegated_to_user_id as delegate from inbox_messages",
    ).map(({ id, ...rest }) => [id, rest]),
  );
}

describe("migration 0008 from 0007", () => {
  it("names each collaboration message's kind from the channel its writer uses", () => {
    const kinds = Object.fromEntries(all<{ id: string; kind: string }>("select id, kind from collaboration_messages").map((row) => [row.id, row.kind]));
    expect(kinds).toStrictEqual({
      "COL-1": "delegation",
      "COL-2": "reply",
      "COL-3": "minutes-distribution",
      "COL-4": "validation-request",
      "COL-5": "follow-up",
      "COL-6": "message",
      "COL-7": "message",
    });
  });

  it("records what each message became, first conversion to work first, and a dismissal only without one", () => {
    const r = rows();
    expect(r["M-ACT"]).toMatchObject({ kind: "action", by: "P-002", at: "2026-10-06T09:00:00.000Z" });
    expect(r["M-EV"]).toMatchObject({ kind: "evidence", by: "P-003", at: "2026-10-06T08:30:00.000Z", evidence: "EVD-M-EV" });
    expect(r["M-UNDO"]).toMatchObject({ kind: "decision", by: "P-002", at: "2026-10-06T11:00:00.000Z" });
    expect(r["M-NOISE"]).toMatchObject({ kind: "dismissed", by: "P-002", at: "2026-10-06T08:10:00.000Z" });
    expect(r["M-NOISE-SILENT"]).toMatchObject({ kind: "dismissed", by: null, at: null });
    expect(r["M-PROC"]).toMatchObject({ kind: "process", by: "P-002", at: "2026-10-06T09:30:00.000Z" });
    expect(r["M-DEL"]).toMatchObject({ kind: "delegated", by: "P-002", delegate: "P-010" });
    expect(r["M-OLD"]).toMatchObject({ kind: "action", by: null, at: null });
    expect(r["M-INFO"]?.kind).toBeNull();
    expect(r["M-AC"]).toMatchObject({ kind: null, by: null });
    expect(r["M-NONE"]).toMatchObject({ kind: null, by: null, tby: null, evidence: null, delegate: null });
  });

  it("attributes the standing classification to the person's latest triage of it, or to the conversion that confirmed it", () => {
    const r = rows();
    expect(r["M-INFO"]).toMatchObject({ tby: "P-003", tat: "2026-10-06T08:40:00.000Z", reason: "Already in the pack." });
    expect(r["M-NOISE"]).toMatchObject({ tby: "P-002", tat: "2026-10-06T08:10:00.000Z", reason: "" });
    expect(r["M-ACT"]).toMatchObject({ tby: "P-002", tat: "2026-10-06T09:00:00.000Z", reason: null });
    expect(r["M-PROC"]).toMatchObject({ tby: "P-002", tat: "2026-10-06T09:30:00.000Z" });
    /* M-UNDO's standing classification is noise, so its noise triage is the attribution. */
    expect(r["M-UNDO"]).toMatchObject({ tby: "P-002", tat: "2026-10-06T08:00:00.000Z", reason: "Looked like noise." });
    expect(r["M-NOISE-SILENT"]).toMatchObject({ tby: null, tat: null });
  });

  it("records each Add to process as a stage input, linked to its event and audit row", () => {
    expect(all("select process_run_id as run, stage_id as stage, stage_run_id as stageRun, source_kind as kind, source_id as source, added_by_user_id as by, os_event_id as event, audit_event_id as audit from process_stage_inputs")).toStrictEqual([
      { run: "RUN-T", stage: "evidence-review", stageRun: "SR-T4", kind: "message", source: "M-PROC", by: "P-002", event: expect.stringMatching(/^OSE-/), audit: "AUD-9" },
    ]);
  });

  it("is applied once: migrating again changes nothing", () => {
    const before = rows();
    migrate(getDb(), { migrationsFolder: "src/db/migrations" });
    expect(rows()).toStrictEqual(before);
    expect(all("select count(*) as n from process_stage_inputs")).toStrictEqual([{ n: 1 }]);
  });
});
