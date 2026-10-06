/**
 * The Meetings and Inbox module read models.
 *
 * Both modules keep the earlier hub's behaviour inside the new shell, so the
 * claims tested here are the ones that changed: no static upcoming list, no
 * static archive, no static messages; the archive reads the minutes records
 * the database already held; proposed noise waits in its own group; and the detail
 * links and the AI Partner binding come from structured fields.
 */

import { describe, expect, it } from "vitest";
import {
  buildMeetingsView,
  countMeetings,
  EMPTY_MEETINGS_EXTRAS,
  resolveMeetingDetail,
} from "@/features/work/modules/meetings/read-model";
import {
  buildInboxView,
  countInbox,
  EMPTY_INBOX_EXTRAS,
  resolveInboxDetail,
} from "@/features/work/modules/inbox/read-model";
import { THIRD_PARTY_RISK_WORK } from "@/features/work/roles/third-party-risk";
import { actionRow, at, calendarRow, inboxRow, meetingRow, minutesRow, query, shared } from "./support/work-fixtures";

describe("meetings", () => {
  it("shows an explicit empty state when the role has no meetings and no minutes", () => {
    const view = buildMeetingsView(shared(), EMPTY_MEETINGS_EXTRAS, query({ tab: "meetings" }));
    expect(view.groups).toStrictEqual([]);
    expect(view.empty?.title).toBe("No meetings");
  });

  it("lists upcoming meetings and keeps an empty archive honest", () => {
    const data = shared({ meetings: [meetingRow({ id: "MTG-2", scheduledFor: at("13:30") }), meetingRow({ id: "MTG-1" })] });
    const upcoming = buildMeetingsView(data, EMPTY_MEETINGS_EXTRAS, query({ tab: "meetings" }));
    expect(upcoming.groups[0]?.rows.map((row) => row.id)).toStrictEqual(["MTG-1", "MTG-2"]);

    const archive = buildMeetingsView(data, EMPTY_MEETINGS_EXTRAS, query({ tab: "meetings", meetingsView: "archive" }));
    expect(archive.groups[0]?.rows).toStrictEqual([]);
    expect(archive.groups[0]?.emptyText).toContain("No meeting has been recorded as held");
  });

  it("reads held meetings and minutes records into the archive", () => {
    const data = shared({
      meetings: [meetingRow({ id: "MTG-1", status: "concluded", outcome: "Agreed." })],
      minutes: [minutesRow({ id: "MIN-1", meetingId: "MTG-OLD", status: "confirmed" })],
    });
    const archive = buildMeetingsView(data, EMPTY_MEETINGS_EXTRAS, query({ tab: "meetings", meetingsView: "archive" }));
    expect(archive.groups[0]?.rows.map((row) => row.id)).toStrictEqual(["MTG-1", "MIN-1"]);
    expect(archive.groups[0]?.rows[1]?.trailing).toBe("Minutes confirmed");
    expect(countMeetings(data)).toStrictEqual({ upcoming: 0, held: 1, minutes: 1 });
  });

  it("resolves a minutes record whose meeting is not in the list, without inventing one", () => {
    const data = shared({ minutes: [minutesRow({ id: "MIN-1", meetingId: "MTG-OLD", factItems: ["Scope confirmed."] })] });
    const detail = resolveMeetingDetail("MIN-1", data, EMPTY_MEETINGS_EXTRAS, query());
    expect(detail?.variant).toBe("minutes");
    expect(detail?.minutes?.facts).toStrictEqual(["Scope confirmed."]);
    expect(detail?.related).toStrictEqual([]);
  });

  it("links the agenda entry, the dependent work and the subject of a meeting", () => {
    const data = shared({
      meetings: [meetingRow({ id: "MTG-1", subjectKind: "control", subjectId: "CTL-1", preparedQuestions: ["Q1", "Q2"] })],
      calendar: [calendarRow({ id: "CAL-1", meetingId: "MTG-1" })],
      actions: [actionRow({ id: "A-1", relatedObjectId: "CTL-1" })],
    });
    const detail = resolveMeetingDetail("MTG-1", data, EMPTY_MEETINGS_EXTRAS, query({ tab: "meetings" }));
    expect(detail?.agendaEntryHref).toContain("item=CAL-1");
    expect(detail?.dependents.map((action) => action.id)).toStrictEqual(["A-1"]);
    expect(detail?.questions).toHaveLength(2);
    expect(detail?.ai.selection?.objectType).toBe("control");
  });

  it("uses the role's own name for each meeting type", () => {
    const data = shared({
      config: THIRD_PARTY_RISK_WORK,
      roleId: "tprm",
      meetings: [meetingRow({ id: "MTG-1", kind: "supplier-challenge", roleId: "tprm" })],
    });
    const view = buildMeetingsView(data, EMPTY_MEETINGS_EXTRAS, query({ tab: "meetings" }));
    expect(view.groups[0]?.rows[0]?.sub).toContain("Supplier challenge call");
  });
});

describe("inbox", () => {
  const messages = () => [
    inboxRow({ id: "M-1", proposedTriage: "decision", requiresResponseBy: at("10:30") }),
    inboxRow({ id: "M-2", proposedTriage: "noise" }),
    inboxRow({ id: "M-3", proposedTriage: "evidence", isDuplicateOf: "M-1" }),
    inboxRow({ id: "M-4", proposedTriage: "action", confirmedTriage: "action", linkedActionId: "A-1", conversionKind: "action" }),
  ];

  it("shows an explicit empty state when nothing has arrived", () => {
    const view = buildInboxView(shared(), EMPTY_INBOX_EXTRAS, query({ tab: "inbox" }));
    expect(view.groups).toStrictEqual([]);
    expect(view.empty?.title).toBe("No messages");
  });

  it("keeps proposed noise in its own group and converted messages out of Needs me, and counts the same rows", () => {
    const data = shared({ messages: messages() });
    const view = buildInboxView(data, EMPTY_INBOX_EXTRAS, query({ tab: "inbox" }));
    expect(view.groups[0]?.rows.map((row) => row.id)).toStrictEqual(["M-1", "M-3"]);
    expect(view.groups[1]?.rows.map((row) => row.id)).toStrictEqual(["M-2"]);
    expect(countInbox(data)).toStrictEqual({ triage: 2, respond: 1, duplicates: 1, converted: 1, handled: 0, noise: 1 });
    const converted = buildInboxView(data, EMPTY_INBOX_EXTRAS, query({ tab: "inbox", inboxView: "converted" }));
    expect(converted.groups[0]?.rows.map((row) => row.id)).toStrictEqual(["M-4"]);
  });

  it("labels the proposed classification with the role's words and flags the response deadline", () => {
    const view = buildInboxView(shared({ messages: messages() }), EMPTY_INBOX_EXTRAS, query({ tab: "inbox" }));
    const first = view.groups[0]?.rows[0];
    expect(first?.chips[0]?.label).toBe("AI: Decision");
    expect(first?.flag).toBe("warning");
  });

  it("links the duplicate's original and binds the partner to a linked action", () => {
    const data = shared({ messages: messages(), actions: [actionRow({ id: "A-1" })] });
    const duplicate = resolveInboxDetail("M-3", data, EMPTY_INBOX_EXTRAS, query({ tab: "inbox" }));
    expect(duplicate?.duplicateOf?.id).toBe("M-1");
    expect(duplicate?.related.some((link) => link.kind === "message" && link.id === "M-1")).toBe(true);

    const linked = resolveInboxDetail("M-4", data, EMPTY_INBOX_EXTRAS, query());
    expect(linked?.related.some((link) => link.kind === "action" && link.id === "A-1")).toBe(true);
    expect(linked?.ai.selection).toMatchObject({ objectType: "action", objectId: "A-1" });
    expect(linked?.classification.confirmed).toBe(true);
  });
});
