/**
 * The inbox's governed operations, against a real database.
 *
 * Every claim plan section 4.8 makes is tried here against the seeded day,
 * through the same operation functions the server actions call:
 *
 *   a triage is the person's, recorded with a payload bound approval in the
 *   role holder's name and one backbone event linked to its audit row;
 *   a classification other than the proposal needs a reason;
 *   raising an action is material: unconfirmed, nothing is written and no
 *   approval is recorded; confirmed, the action names the message as its
 *   source, its history says so, the message links to it, and one event
 *   accounts for it;
 *   filing as evidence writes one document with the message as its source,
 *   indexed for retrieval, once;
 *   adding to a process attaches through the backbone to the role's own open
 *   stage and nowhere else, and never writes the engine's tables;
 *   delegation and replies are simulated messages, a draft writes nothing;
 *   a converted message leaves Needs me, Home's count follows, and search
 *   still finds it;
 *   the gate refuses below the autonomy level that can reach a change, and a
 *   message that has not arrived cannot be touched.
 *
 * Runs against a temporary database. See `support/harness.ts`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import { setAutonomyLevel, setMoment } from "@/scenario/engine/state";
import {
  addToProcess,
  changeTriage,
  confirmTriage,
  createActionFromMessage,
  delegateMessage,
  dismissMessage,
  draftReply,
  linkAsEvidence,
  sendReply,
} from "@/features/work/modules/inbox/operations";
import { readInboxSearchEntries } from "@/features/work/modules/inbox/search";
import { buildWorkHub } from "@/features/work/hub";
import { readHomeView } from "@/features/home/read";
import { getScenarioState } from "@/scenario/engine/state";

function count(sql: string, ...args: unknown[]): number {
  return (getSqlite().prepare(sql).get(...args) as { n: number }).n;
}

function row<T>(sql: string, ...args: unknown[]): T | undefined {
  return getSqlite().prepare(sql).get(...args) as T | undefined;
}

function events(messageId: string): Array<{ type: string; subject_kind: string; subject_id: string; process_run_id: string | null; stage_id: string | null; audit_event_id: string | null; payload: string }> {
  return getSqlite()
    .prepare("select type, subject_kind, subject_id, process_run_id, stage_id, audit_event_id, payload from os_events where correlation_id = ? order by sequence")
    .all(messageId) as Array<{ type: string; subject_kind: string; subject_id: string; process_run_id: string | null; stage_id: string | null; audit_event_id: string | null; payload: string }>;
}

function inboxIds(roleId: "rcsa" | "tprm", view: string): string[] {
  const hub = buildWorkHub(roleId, { view: "inbox", iview: view });
  return hub?.queue.groups.flatMap((group) => group.rows.map((entry) => entry.id)) ?? [];
}

beforeAll(() => {
  createTemporaryDatabase("work-inbox-operations");
  seedScenario();
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  seedScenario();
});

describe("triage", () => {
  it("records the person's confirmation with an approval in the holder's name, and one event linked to its audit row", async () => {
    const outcome = await confirmTriage({ roleId: "tprm", messageId: "IMSG-2026-0003" });
    expect(outcome.ok, outcome.message).toBe(true);
    expect(row<{ t: string }>("select confirmed_triage as t from inbox_messages where id = 'IMSG-2026-0003'")?.t).toBe("evidence");

    const approval = row<{ by: string; kind: string; target: string; consumed: string | null; decision: string | null }>(
      "select approved_by_user_id as by, target_kind as kind, target_id as target, consumed_at as consumed, decision_id as decision from approvals where tool_name = 'recordInboxTriage'",
    );
    expect(approval).toMatchObject({ by: "P-002", kind: "inbox-message", target: "IMSG-2026-0003", decision: null });
    expect(approval?.consumed).not.toBeNull();

    const published = events("IMSG-2026-0003");
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ type: "tool-executed", subject_kind: "inbox-message", subject_id: "IMSG-2026-0003" });
    expect(published[0]?.audit_event_id).not.toBeNull();
    expect(JSON.parse(published[0]?.payload ?? "{}")).toMatchObject({ source: "inbox", operation: "triage", to: "evidence" });
    /* Confirming a classification that still needs work leaves the message in Needs me. */
    expect(inboxIds("tprm", "needs-triage")).toContain("IMSG-2026-0003");
  });

  it("needs a reason for a classification other than the proposal, and refuses a change to the same one", async () => {
    const refused = await changeTriage({ roleId: "tprm", messageId: "IMSG-2026-0002", classification: "information", reason: "" });
    expect(refused.ok).toBe(false);
    expect(count("select count(*) as n from approvals")).toBe(count("select count(*) as n from approvals where tool_name <> 'recordInboxTriage'"));

    const changed = await changeTriage({ roleId: "tprm", messageId: "IMSG-2026-0002", classification: "information", reason: "Explained in the indicator pack already." });
    expect(changed.ok, changed.message).toBe(true);
    expect(inboxIds("tprm", "handled")).toContain("IMSG-2026-0002");
    const again = await changeTriage({ roleId: "tprm", messageId: "IMSG-2026-0002", classification: "information", reason: "Again." });
    expect(again.ok).toBe(false);
    expect(JSON.parse(events("IMSG-2026-0002")[0]?.payload ?? "{}")).toMatchObject({ from: "action", to: "information", reason: "Explained in the indicator pack already." });
  });

  it("dismisses proposed noise without a reason, and a message it does not propose as noise only with one", async () => {
    expect((await dismissMessage({ roleId: "tprm", messageId: "IMSG-2026-0008", reason: "" })).ok).toBe(true);
    expect(inboxIds("tprm", "handled")).toContain("IMSG-2026-0008");
    expect((await dismissMessage({ roleId: "tprm", messageId: "IMSG-2026-0009", reason: "" })).ok).toBe(false);
    expect(row<{ t: string | null }>("select confirmed_triage as t from inbox_messages where id = 'IMSG-2026-0009'")?.t).toBeNull();
  });
});

describe("message to action", () => {
  const input = {
    roleId: "tprm" as const,
    messageId: "IMSG-2026-0001",
    linkExisting: false,
    title: "Close the four open resilience items before cycle close",
    kind: "reassessment",
    ownerUserId: "P-002",
    dueOn: "2026-10-20",
    reason: "A sole provider with four open items needs one owned plan.",
    confirmed: true,
  };

  it("writes nothing and records no approval while the material change is unconfirmed", async () => {
    const before = count("select count(*) as n from actions");
    const outcome = await createActionFromMessage({ ...input, confirmed: false });
    expect(outcome.ok).toBe(false);
    expect(count("select count(*) as n from actions")).toBe(before);
    expect(count("select count(*) as n from approvals where tool_name = 'createAction'")).toBe(0);
  });

  it("refuses an owner, a kind or a date the form does not offer", async () => {
    expect((await createActionFromMessage({ ...input, ownerUserId: "P-011" })).ok).toBe(false);
    expect((await createActionFromMessage({ ...input, kind: "anything" })).ok).toBe(false);
    expect((await createActionFromMessage({ ...input, dueOn: "2026-10-01" })).ok).toBe(false);
    expect(count("select count(*) as n from actions where source_message_id is not null")).toBe(0);
  });

  it("raises the action with the message as its source, links both ways, and publishes one account of it", async () => {
    const homeBefore = readHomeView("tprm", getScenarioState()!);
    const outcome = await createActionFromMessage(input);
    expect(outcome.ok, outcome.message).toBe(true);

    const message = row<{ action: string; read: number; triage: string; by: string; at: string | null }>(
      "select linked_action_id as action, is_read as read, confirmed_triage as triage, converted_by_user_id as by, converted_at as at from inbox_messages where id = 'IMSG-2026-0001'",
    );
    expect(message).toMatchObject({ read: 1, triage: "action", by: "P-002" });
    expect(message?.at).not.toBeNull();
    const action = row<{ id: string; source: string; owner: string; due: string; kind: string; related: string }>(
      "select id, source_message_id as source, owner_user_id as owner, due_on as due, kind, related_object_id as related from actions where id = ?",
      message?.action,
    );
    expect(action).toMatchObject({ source: "IMSG-2026-0001", owner: "P-002", due: "2026-10-20", kind: "reassessment", related: "TP-0042" });
    expect(row<{ note: string; kind: string }>("select note, kind from action_updates where action_id = ?", action?.id)).toMatchObject({ kind: "CRT" });

    const approval = row<{ target: string; consumed: string | null }>("select target_id as target, consumed_at as consumed from approvals where tool_name = 'createAction'");
    expect(approval?.target).toBe("IMSG-2026-0001");
    expect(approval?.consumed).not.toBeNull();

    /* One account: the link step's event, with the action as its subject. createAction itself is not published a second time. */
    const published = events("IMSG-2026-0001");
    expect(published.map((entry) => [entry.type, entry.subject_kind, entry.subject_id])).toStrictEqual([["work-arrived", "action", action?.id]]);
    expect(count("select count(*) as n from os_events where type = 'action-updated' and subject_id = 'IMSG-2026-0001'")).toBe(0);

    /* The message leaves Needs me, appears in Converted to work, and the action's detail names it. */
    expect(inboxIds("tprm", "needs-triage")).not.toContain("IMSG-2026-0001");
    expect(inboxIds("tprm", "converted")).toContain("IMSG-2026-0001");
    const actionHub = buildWorkHub("tprm", { view: "actions", item: action?.id ?? "" });
    expect(actionHub?.detail?.kind).toBe("action");
    if (actionHub?.detail?.kind === "action") expect(actionHub.detail.sources.message?.id).toBe("IMSG-2026-0001");

    /* Home's inbox count follows. */
    const homeAfter = readHomeView("tprm", getScenarioState()!);
    expect(homeAfter.yourDay.inbox.needsAttention).toBe(homeBefore.yourDay.inbox.needsAttention - 1);

    /* A second action from the same message is refused. */
    expect((await createActionFromMessage(input)).ok).toBe(false);
  });

  it("links a message to the open action it concerns, with an entry on that action's history", async () => {
    setMoment("08:10");
    const outcome = await createActionFromMessage({ ...input, messageId: "IMSG-2026-0010", linkExisting: true, confirmed: false });
    expect(outcome.ok, outcome.message).toBe(true);
    expect(row<{ action: string }>("select linked_action_id as action from inbox_messages where id = 'IMSG-2026-0010'")?.action).toBe("MSN-2026-0188");
    expect(count("select count(*) as n from action_updates where action_id = 'MSN-2026-0188' and note like '%IMSG-2026-0010%'")).toBe(1);
    expect(events("IMSG-2026-0010")[0]).toMatchObject({ type: "action-updated", subject_id: "MSN-2026-0188" });
  });
});

describe("message to evidence", () => {
  it("files one document with the message as its source, indexed for retrieval, and refuses a second", async () => {
    const outcome = await linkAsEvidence({ roleId: "tprm", messageId: "IMSG-2026-0003", objectIds: ["REG-2026-0031"], title: "Subprocessor chain extract request" });
    expect(outcome.ok, outcome.message).toBe(true);
    const doc = row<{ source: string; related: string; type: string; provenance: string }>(
      "select source_message_id as source, related_object_ids as related, source_type as type, provenance from evidence_documents where id = 'EVD-IMSG-2026-0003'",
    );
    expect(doc).toMatchObject({ source: "IMSG-2026-0003", type: "correspondence", provenance: "stakeholder-statement" });
    expect(JSON.parse(doc?.related ?? "[]")).toStrictEqual(["REG-2026-0031", "IMSG-2026-0003"]);
    expect(count("select count(*) as n from evidence_chunks_fts where document_id = 'EVD-IMSG-2026-0003'")).toBe(1);
    expect(inboxIds("tprm", "converted")).toContain("IMSG-2026-0003");
    expect(events("IMSG-2026-0003")[0]).toMatchObject({ type: "work-arrived", subject_kind: "evidence-document", subject_id: "EVD-IMSG-2026-0003" });

    expect((await linkAsEvidence({ roleId: "tprm", messageId: "IMSG-2026-0003", objectIds: [], title: "Again" })).ok).toBe(false);
  });

  it("refuses an object the message and the role's processes do not concern", async () => {
    const outcome = await linkAsEvidence({ roleId: "tprm", messageId: "IMSG-2026-0007", objectIds: ["CTL-PAY-014"], title: "Portal notice" });
    expect(outcome.ok).toBe(false);
    expect(count("select count(*) as n from evidence_documents where source_message_id is not null")).toBe(0);
  });
});

describe("message to process", () => {
  const stageTables = () =>
    [
      count("select count(*) as n from role_app_stage_runs"),
      count("select count(*) as n from role_app_stage_tasks"),
      count("select count(*) as n from role_app_runs"),
    ].join(",");

  it("attaches to the role's own open stage through the backbone, once, without writing the engine's own records", async () => {
    const before = stageTables();
    const outcome = await addToProcess({ roleId: "rcsa", messageId: "IMSG-2026-0023", processRunId: "RUN-RCSA-PAYOPS-Q4-2026", stageId: "evidence-refresh" });
    expect(outcome.ok, outcome.message).toBe(true);
    const attached = events("IMSG-2026-0023").find((entry) => entry.process_run_id !== null);
    expect(attached).toMatchObject({ type: "work-arrived", process_run_id: "RUN-RCSA-PAYOPS-Q4-2026", stage_id: "evidence-refresh", subject_id: "IMSG-2026-0023" });
    /* The stage's own reader lists it. */
    expect(count("select count(*) as n from os_events where process_run_id = 'RUN-RCSA-PAYOPS-Q4-2026' and stage_id = 'evidence-refresh' and summary like '%IMSG-2026-0023%'")).toBe(1);
    expect(stageTables()).toBe(before);
    expect(inboxIds("rcsa", "converted")).toContain("IMSG-2026-0023");

    expect((await addToProcess({ roleId: "rcsa", messageId: "IMSG-2026-0023", processRunId: "RUN-RCSA-PAYOPS-Q4-2026", stageId: "evidence-refresh" })).ok).toBe(false);
  });

  it("refuses a completed stage, and another role's process", async () => {
    expect((await addToProcess({ roleId: "tprm", messageId: "IMSG-2026-0006", processRunId: "RUN-TPRM-VERIDIAN-2026", stageId: "request-and-intake" })).ok).toBe(false);
    expect((await addToProcess({ roleId: "rcsa", messageId: "IMSG-2026-0023", processRunId: "RUN-TPRM-VERIDIAN-2026", stageId: "evidence-review" })).ok).toBe(false);
    expect(count("select count(*) as n from os_events where type = 'work-arrived' and payload like '%\"operation\":\"process\"%'")).toBe(0);
  });
});

describe("delegate and reply", () => {
  it("delegates with a simulated message to an internal colleague only", async () => {
    expect((await delegateMessage({ roleId: "tprm", messageId: "IMSG-2026-0011", toUserId: "P-011", note: "Over to you." })).ok).toBe(false);
    const outcome = await delegateMessage({ roleId: "tprm", messageId: "IMSG-2026-0011", toUserId: "P-010", note: "Commercial indexation, for the Friday review." });
    expect(outcome.ok, outcome.message).toBe(true);
    expect(
      row<{ simulated: number; recipients: string }>(
        "select simulated_only as simulated, to_user_ids as recipients from collaboration_messages where related_object_id = 'IMSG-2026-0011'",
      ),
    ).toStrictEqual({ simulated: 1, recipients: '["P-010"]' });
    expect(inboxIds("tprm", "converted")).toContain("IMSG-2026-0011");
  });

  it("drafts a reply that writes nothing, and records a sent reply as simulated", async () => {
    const before = count("select count(*) as n from collaboration_messages");
    const drafted = await draftReply({ roleId: "tprm", messageId: "IMSG-2026-0003" });
    expect(drafted.ok, drafted.message).toBe(true);
    expect(drafted.draft?.subject.startsWith("Re: ")).toBe(true);
    expect(drafted.draft?.body).toContain("Tobias");
    expect(count("select count(*) as n from collaboration_messages")).toBe(before);

    const sent = await sendReply({ roleId: "tprm", messageId: "IMSG-2026-0003", subject: drafted.draft?.subject ?? "", body: drafted.draft?.body ?? "" });
    expect(sent.ok, sent.message).toBe(true);
    expect(count("select count(*) as n from collaboration_messages where channel_name = 'Inbox reply' and simulated_only = 1")).toBe(1);
    expect(inboxIds("tprm", "handled")).toContain("IMSG-2026-0003");
  });

  it("refuses a reply to a sender with no person record", async () => {
    expect((await draftReply({ roleId: "tprm", messageId: "IMSG-2026-0001" })).ok).toBe(false);
  });
});

describe("the gate and the clock", () => {
  it("refuses below the autonomy level that can reach the change, and audits the refusal; a draft still works", async () => {
    setAutonomyLevel("prepare", { actorUserId: "P-002" });
    const outcome = await confirmTriage({ roleId: "tprm", messageId: "IMSG-2026-0003" });
    expect(outcome.ok).toBe(false);
    expect(row<{ t: string | null }>("select confirmed_triage as t from inbox_messages where id = 'IMSG-2026-0003'")?.t).toBeNull();
    expect(count("select count(*) as n from audit_events where category = 'blocked' and action = 'recordInboxTriage'")).toBe(1);
    expect((await draftReply({ roleId: "tprm", messageId: "IMSG-2026-0003" })).ok).toBe(true);
    /* Sending is out of reach at this level; the gate refuses it and audits the refusal. */
    expect((await sendReply({ roleId: "tprm", messageId: "IMSG-2026-0003", subject: "Re: extract", body: "Thank you for your message, I will come back to you." })).ok).toBe(false);
    expect(count("select count(*) as n from audit_events where category = 'blocked' and action = 'sendInboxReply'")).toBe(1);
    expect(count("select count(*) as n from collaboration_messages where channel_name = 'Inbox reply'")).toBe(0);
  });

  it("refuses a message that has not arrived by the scenario clock", async () => {
    const outcome = await confirmTriage({ roleId: "tprm", messageId: "IMSG-2026-0012" });
    expect(outcome.ok).toBe(false);
    expect(count("select count(*) as n from os_events where correlation_id = 'IMSG-2026-0012'")).toBe(0);
  });

  it("refuses another role's message", async () => {
    expect((await confirmTriage({ roleId: "rcsa", messageId: "IMSG-2026-0003" })).ok).toBe(false);
  });
});

describe("search", () => {
  it("keeps handled and converted messages searchable, by what they became", async () => {
    await dismissMessage({ roleId: "tprm", messageId: "IMSG-2026-0008", reason: "" });
    await linkAsEvidence({ roleId: "tprm", messageId: "IMSG-2026-0003", objectIds: [], title: "Extract request" });
    const entries = readInboxSearchEntries("tprm");
    expect(entries.find((entry) => entry.id === "IMSG-2026-0008")?.href).toContain("iview=handled");
    expect(entries.find((entry) => entry.id === "IMSG-2026-0003")?.keywords).toContain("EVD-IMSG-2026-0003");
    expect(entries.every((entry) => entry.kind === "message")).toBe(true);
  });
});
