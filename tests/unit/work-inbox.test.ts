/**
 * The Inbox module: the AI layer of triage, the source labels, what a message
 * became, and the read model that shows it.
 *
 * Pure, driven with plain objects. The claims are the plan's (section 4.8):
 *
 *   every classification passes a schema and content validator, and none is
 *   shown without its rationale;
 *   safe mode serves the proposal captured with the message, offline mode
 *   composes one from the message's own facts, and a failure says so;
 *   the six sources are labelled, a supplier's own submission included, and
 *   every one is Simulated;
 *   a message is in exactly one of Needs me, Converted to work and Handled,
 *   read from the objects it became;
 *   each message has one primary action, and an operation the message cannot
 *   take is disabled with the reason;
 *   handled messages stay searchable.
 */

import { describe, expect, it } from "vitest";
import {
  buildInboxSearchEntries,
  buildInboxView,
  countInbox,
  EMPTY_INBOX_EXTRAS,
  resolveInboxDetail,
  type InboxExtras,
  type ProcessStageOption,
} from "@/features/work/modules/inbox/read-model";
import { composeTriage, proposeTriage, TRIAGE_NOTES, type TriageContext } from "@/features/work/modules/inbox/triage";
import { validateReplyDraft, validateTriageProposal } from "@/features/work/modules/inbox/triage-schema";
import { messageSource } from "@/features/work/modules/inbox/sources";
import { deriveLineage, DELEGATION_CHANNEL, EMPTY_LINEAGE_INPUT, REPLY_CHANNEL, type InboxEventFact } from "@/features/work/modules/inbox/lineage";
import { composeReply, firstNameOf } from "@/features/work/modules/inbox/reply";
import type { WorkFollowUpRow } from "@/db/repositories/work-hub";
import { actionRow, at, evidenceRow, inboxRow, processScope, query, shared } from "./support/work-fixtures";

const EM_DASH = String.fromCharCode(0x2014);
const UMLAUT = String.fromCharCode(0xfc);

function context(overrides: Partial<TriageContext> = {}): TriageContext {
  return {
    knownIds: new Set(["M-1", "M-2", "CTL-1", "DEC-1", "A-1", "EVD-1", "P-007"]),
    source: messageSource({ channel: "mail", fromUserId: null, relatedObjectKind: null }, shared()),
    original: null,
    decisionStatus: null,
    ...overrides,
  };
}

function event(overrides: Partial<InboxEventFact> & { payload: InboxEventFact["payload"] }): InboxEventFact {
  return {
    id: `OSE-${overrides.payload.operation}`,
    sequence: 1,
    type: "work-arrived",
    atMoment: "10:30",
    occurredAt: "2026-10-06T10:30:00.000Z",
    actorUserId: "P-003",
    summary: "Recorded.",
    processRunId: null,
    stageId: null,
    ...overrides,
  };
}

function outbound(overrides: Partial<WorkFollowUpRow> & Pick<WorkFollowUpRow, "id" | "channelName">): WorkFollowUpRow {
  return {
    runId: "run-001",
    fromRoleId: "rcsa",
    toUserIds: ["P-007"],
    kind: "message",
    subject: "Subject",
    body: "Body",
    sentAtMoment: "10:30",
    sentAt: "2026-10-06T10:30:00.000Z",
    simulatedOnly: true,
    relatedObjectKind: "inbox-message",
    relatedObjectId: "M-1",
    decisionId: null,
    replyBody: "",
    replyFromUserId: null,
    replyAtMoment: null,
    ...overrides,
  };
}

function extras(overrides: Partial<InboxExtras> = {}): InboxExtras {
  return { ...EMPTY_INBOX_EXTRAS, ...overrides };
}

const STAGE: ProcessStageOption = {
  processRunId: "RUN-1",
  processName: { en: "RCSA cycle", de: "RCSA-Zyklus" },
  subjectId: "ASSESS-1",
  scopeIds: ["ASSESS-1", "CTL-1"],
  stageId: "evidence-refresh",
  stageName: { en: "Evidence refresh", de: "Nachweisauffrischung" },
  stageRunId: "SR-1",
  current: true,
};

/* ==========================================================================
   The validator
   ========================================================================== */

describe("the triage validator", () => {
  const valid = {
    schemaVersion: "inbox-triage-v1",
    messageId: "M-1",
    classification: "action",
    rationale: { en: "It asks for an owned response by a date.", de: null },
    confidence: 0.8,
    citedIds: ["M-1", "CTL-1"],
  };
  const check = { messageId: "M-1", knownIds: new Set(["M-1", "CTL-1"]) };

  it("accepts a well formed proposal", () => {
    expect(validateTriageProposal(valid, check).ok).toBe(true);
  });

  it("refuses a classification outside the six, and a missing or empty rationale", () => {
    expect(validateTriageProposal({ ...valid, classification: "urgent" }, check).ok).toBe(false);
    expect(validateTriageProposal({ ...valid, rationale: { en: "", de: null } }, check).ok).toBe(false);
    expect(validateTriageProposal({ ...valid, rationale: undefined }, check).ok).toBe(false);
  });

  it("refuses a citation the message context does not hold, and another message's proposal", () => {
    expect(validateTriageProposal({ ...valid, citedIds: ["M-1", "EVD-404"] }, check).ok).toBe(false);
    expect(validateTriageProposal({ ...valid, messageId: "M-2" }, check).ok).toBe(false);
  });

  it("applies the copy rules: no dash as punctuation, no umlaut in German, no internal technology terms", () => {
    expect(validateTriageProposal({ ...valid, rationale: { en: `It asks ${EM_DASH} for a response.`, de: null } }, check).ok).toBe(false);
    expect(validateTriageProposal({ ...valid, rationale: { en: `It asks ${"-".repeat(2)} for a response today.`, de: null } }, check).ok).toBe(false);
    expect(validateTriageProposal({ ...valid, rationale: { en: "It asks for a response.", de: `Sie fragt nach einer Antwort f${UMLAUT}r heute.` } }, check).ok).toBe(false);
    expect(validateTriageProposal({ ...valid, rationale: { en: "The LLM thinks it needs a response.", de: null } }, check).ok).toBe(false);
  });

  it("validates reply drafts with the same copy rules", () => {
    expect(validateReplyDraft({ subject: "Re: the extract", body: "Thank you for your message. I will come back to you." }, "en").ok).toBe(true);
    expect(validateReplyDraft({ subject: "Re", body: "Thank you for your message. I will come back to you." }, "en").ok).toBe(false);
    expect(validateReplyDraft({ subject: "AW: Auszug", body: `Vielen Dank f${UMLAUT}r Ihre Nachricht, ich melde mich.` }, "de").ok).toBe(false);
  });
});

/* ==========================================================================
   The AI layer
   ========================================================================== */

describe("the AI layer of triage", () => {
  it("serves the proposal captured with the message in safe mode, with its rationale and confidence", () => {
    const row = inboxRow({ id: "M-1", proposedTriage: "decision", triageRationale: "A decision wearing the clothes of a status update.", triageConfidence: 0.84 });
    const result = proposeTriage(row, context(), { mode: "safe", live: false });
    expect(result.mode).toBe("safe");
    expect(result.proposal).toMatchObject({ classification: "decision", confidence: 0.84 });
    expect(result.proposal?.rationale.en).toContain("status update");
    expect(result.note).toStrictEqual(TRIAGE_NOTES.safe);
  });

  it("says when a live configuration is served as safe, because no model is called for the inbox", () => {
    const result = proposeTriage(inboxRow({ id: "M-1" }), context(), { mode: "safe", live: true });
    expect(result.note).toStrictEqual(TRIAGE_NOTES.live);
  });

  it("falls back to an offline composition when the captured proposal fails the checks, and says so", () => {
    const row = inboxRow({ id: "M-1", proposedTriage: "urgent", requiresResponseBy: at("12:00") });
    const result = proposeTriage(row, context(), { mode: "safe", live: false });
    expect(result.mode).toBe("offline");
    expect(result.proposal?.classification).toBe("action");
    expect(result.proposal?.confidence).toBeNull();
    expect(result.note).toStrictEqual(TRIAGE_NOTES.fellBack);
  });

  it("composes from the message's own facts in offline mode, in both languages", () => {
    const row = inboxRow({ id: "M-1", proposedTriage: "noise", relatedObjectKind: "decision", relatedObjectId: "DEC-1" });
    const result = proposeTriage(row, context({ decisionStatus: "open" }), { mode: "offline", live: false });
    expect(result.mode).toBe("offline");
    expect(result.proposal?.classification).toBe("decision");
    expect(result.proposal?.rationale.en).toContain("DEC-1");
    expect(result.proposal?.rationale.de).toContain("DEC-1");
    expect(result.note).toStrictEqual(TRIAGE_NOTES.offline);
  });

  it("shows no classification at all when nothing passes the checks", () => {
    const row = inboxRow({ id: "M-9", proposedTriage: "urgent" });
    const result = proposeTriage(row, context({ knownIds: new Set() }), { mode: "safe", live: false });
    expect(result.proposal).toBeNull();
    expect(result.mode).toBe("unavailable");
    expect(result.note).toStrictEqual(TRIAGE_NOTES.unavailable);
  });

  it("applies its rules in order, each naming the fact it rests on", () => {
    const compose = (overrides: Parameters<typeof inboxRow>[0], ctx: Partial<TriageContext> = {}) =>
      composeTriage(inboxRow(overrides), { ...context(ctx) }).classification;
    expect(compose({ id: "M-1", relatedObjectKind: "decision", relatedObjectId: "DEC-1" }, { decisionStatus: "decided" })).toBe("information");
    expect(compose({ id: "M-2", isDuplicateOf: "M-1" }, { original: { id: "M-1", proposedTriage: "evidence", confirmedTriage: null } })).toBe("evidence");
    expect(
      compose({ id: "M-1", channel: "service-management" }, { source: messageSource({ channel: "service-management", fromUserId: null, relatedObjectKind: null }, shared()) }),
    ).toBe("noise");
    expect(compose({ id: "M-1", relatedObjectKind: "evidence-document", relatedObjectId: "EVD-1" })).toBe("evidence");
    expect(compose({ id: "M-1", requiresResponseBy: at("12:00"), relatedObjectKind: "control", relatedObjectId: "CTL-1" })).toBe("action");
    expect(compose({ id: "M-1", relatedObjectKind: "action", relatedObjectId: "A-1" })).toBe("action");
    expect(
      compose({ id: "M-1", channel: "alert", relatedObjectKind: "kri", relatedObjectId: "CTL-1" }, { source: messageSource({ channel: "alert", fromUserId: null, relatedObjectKind: "kri" }, shared()) }),
    ).toBe("action");
    expect(compose({ id: "M-1" })).toBe("noise");
    expect(compose({ id: "M-1", fromUserId: "P-007" })).toBe("information");
  });
});

/* ==========================================================================
   Sources
   ========================================================================== */

describe("sources", () => {
  const people = shared({
    people: new Map([
      ["P-011", { id: "P-011", name: "Supplier contact", jobTitle: "Client Service Director", line: "external" }],
      ["P-007", { id: "P-007", name: "Jonas Keller", jobTitle: "Head of Payment Operations", line: "1lod" }],
    ]),
  });

  it("labels the six source kinds, and every source as simulated", () => {
    const kinds = [
      messageSource({ channel: "mail", fromUserId: "P-007", relatedObjectKind: null }, people).kind,
      messageSource({ channel: "collaboration", fromUserId: "P-007", relatedObjectKind: null }, people).kind,
      messageSource({ channel: "grc-queue", fromUserId: null, relatedObjectKind: "rcsa" }, people).kind,
      messageSource({ channel: "alert", fromUserId: null, relatedObjectKind: "kri" }, people).kind,
      messageSource({ channel: "service-management", fromUserId: null, relatedObjectKind: null }, people).kind,
      messageSource({ channel: "mail", fromUserId: "P-011", relatedObjectKind: "evidence-document" }, people).kind,
    ];
    expect(kinds).toStrictEqual(["mail", "collaboration", "grc-queue", "monitoring-event", "service-management", "supplier-submission"]);
    expect(messageSource({ channel: "mail", fromUserId: null, relatedObjectKind: null }, people).simulated).toBe(true);
  });

  it("keeps the transport beside a derived supplier submission, and knows who can be replied to", () => {
    const source = messageSource({ channel: "mail", fromUserId: "P-011", relatedObjectKind: "evidence-document" }, people);
    expect(source.label.en).toBe("Supplier submission");
    expect(source.channel.en).toBe("Mail");
    expect(source.replyable).toBe(true);
    expect(messageSource({ channel: "mail", fromUserId: null, relatedObjectKind: null }, people).replyable).toBe(false);
  });
});

/* ==========================================================================
   Lineage
   ========================================================================== */

describe("what a message became", () => {
  const data = shared({ processScopes: [processScope()], actions: [actionRow({ id: "A-9", sourceMessageId: "M-1", title: "Chase the extract" })] });

  it("is Needs me until something is done with it, and proposed noise waits for a person", () => {
    const row = inboxRow({ id: "M-1" });
    expect(deriveLineage(row, EMPTY_LINEAGE_INPUT, data).place).toBe("needs-me");
    const noise = deriveLineage(row, { ...EMPTY_LINEAGE_INPUT, proposal: { schemaVersion: "inbox-triage-v1", messageId: "M-1", classification: "noise", rationale: { en: "A fulfilled ticket.", de: null }, confidence: 0.9, citedIds: [] } }, data);
    expect(noise.place).toBe("needs-me");
    expect(noise.likelyNoise).toBe(true);
  });

  it("reads an action from the message's link and from the action's source, and the place from the stored conversion", () => {
    const lineage = deriveLineage(inboxRow({ id: "M-1", conversionKind: "action" }), { ...EMPTY_LINEAGE_INPUT, raised: [actionRow({ id: "A-9", sourceMessageId: "M-1" })] }, data);
    expect(lineage.place).toBe("converted");
    expect(lineage.conversions[0]).toMatchObject({ kind: "action", id: "A-9", note: "Raised from this message" });
    expect(lineage.conversions[0]?.href).toContain("item=A-9");
    /* No stored conversion: the message stays where it is, whatever names it as a source. */
    expect(deriveLineage(inboxRow({ id: "M-1" }), { ...EMPTY_LINEAGE_INPUT, raised: [actionRow({ id: "A-9", sourceMessageId: "M-1" })] }, data).place).toBe("needs-me");
  });

  it("reads evidence filed from it, the stage input it is and a delegation, with who and when", () => {
    const lineage = deriveLineage(
      inboxRow({ id: "M-1", conversionKind: "evidence", convertedByUserId: "P-003", convertedAt: at("10:30"), delegatedToUserId: "P-007" }),
      {
        ...EMPTY_LINEAGE_INPUT,
        filed: [evidenceRow({ id: "EVD-M-1", sourceMessageId: "M-1", relatedObjectIds: ["CTL-1", "M-1"] })],
        outbound: [outbound({ id: "COL-1", channelName: DELEGATION_CHANNEL, kind: "delegation" })],
        stageInputs: [
          {
            id: "PSI-1",
            runId: "run-001",
            processRunId: "RUN-1",
            stageId: "evidence-refresh",
            stageRunId: "SR-1",
            sourceKind: "message",
            sourceId: "M-1",
            addedByUserId: "P-003",
            addedAt: at("10:40"),
            addedAtMoment: "10:40",
            note: "",
            osEventId: "OSE-process",
            auditEventId: null,
          },
        ],
        events: [event({ payload: { source: "inbox", messageId: "M-1", operation: "evidence", toolName: "fileInboxMessageAsEvidence", outcome: "executed", evidenceDocumentId: "EVD-M-1" } })],
      },
      data,
    );
    expect(lineage.place).toBe("converted");
    expect(lineage.conversions.map((conversion) => conversion.kind)).toStrictEqual(["evidence", "process", "delegated"]);
    expect(lineage.conversions[0]).toMatchObject({ note: "Filed against CTL-1 Four-eyes review", by: "Anna Weber", at: "10:30" });
    expect(lineage.conversions[1]).toMatchObject({ href: "/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh", stage: "Evidence refresh", by: "Anna Weber", at: "10:40" });
    expect(lineage.delegatedTo).toStrictEqual({ userId: "P-007", name: "Jonas Keller" });
  });

  it("tells a delegation and a reply by their kind, not by the channel name", () => {
    const relabelled = deriveLineage(inboxRow({ id: "M-1" }), { ...EMPTY_LINEAGE_INPUT, outbound: [outbound({ id: "COL-9", channelName: DELEGATION_CHANNEL, kind: "message" })] }, data);
    expect(relabelled.conversions).toHaveLength(0);
    expect(relabelled.place).toBe("needs-me");
  });

  it("is Handled when it was filed, dismissed or only answered", () => {
    expect(deriveLineage(inboxRow({ id: "M-1", confirmedTriage: "information" }), EMPTY_LINEAGE_INPUT, data).closure).toBe("filed");
    expect(deriveLineage(inboxRow({ id: "M-1", confirmedTriage: "noise", conversionKind: "dismissed" }), EMPTY_LINEAGE_INPUT, data).closure).toBe("dismissed");
    const replied = deriveLineage(inboxRow({ id: "M-1" }), { ...EMPTY_LINEAGE_INPUT, outbound: [outbound({ id: "COL-2", channelName: REPLY_CHANNEL, kind: "reply" })] }, data);
    expect(replied).toMatchObject({ place: "handled", closure: "replied" });
  });

  it("keeps the person's triage history with the reason for a change", () => {
    const lineage = deriveLineage(
      inboxRow({ id: "M-1", confirmedTriage: "decision" }),
      {
        ...EMPTY_LINEAGE_INPUT,
        events: [event({ type: "tool-executed", payload: { source: "inbox", messageId: "M-1", operation: "triage", toolName: "recordInboxTriage", outcome: "executed", from: "evidence", to: "decision", reason: "It is a judgment." } })],
      },
      data,
    );
    expect(lineage.triage).toStrictEqual([{ eventId: "OSE-triage", from: "evidence", to: "decision", reason: "It is a judgment.", at: "10:30", by: "Anna Weber" }]);
    expect(lineage.confirmed).toBe("decision");
  });
});

/* ==========================================================================
   The read model
   ========================================================================== */

describe("the inbox read model", () => {
  const messages = () => [
    inboxRow({ id: "M-1", proposedTriage: "action", requiresResponseBy: at("12:00"), relatedObjectKind: "control", relatedObjectId: "CTL-1" }),
    inboxRow({ id: "M-2", proposedTriage: "evidence", linkedActionId: null }),
    inboxRow({ id: "M-3", proposedTriage: "information", confirmedTriage: "information" }),
    inboxRow({ id: "M-4", proposedTriage: "action", linkedActionId: "A-1", conversionKind: "action" }),
    inboxRow({ id: "M-5", proposedTriage: "urgent", triageRationale: "" }),
  ];
  const data = () => shared({ messages: messages(), actions: [actionRow({ id: "A-1" })], processScopes: [processScope()] });

  it("puts each message in exactly one place and counts the same rows", () => {
    /* M-5's captured proposal fails the checks; composed offline, an automated notice naming nothing is proposed as noise. */
    const counts = countInbox(data());
    expect(counts).toMatchObject({ triage: 2, noise: 1, converted: 1, handled: 1, respond: 1 });
    const groups = (view: "needs-triage" | "converted" | "handled") =>
      buildInboxView(data(), EMPTY_INBOX_EXTRAS, query({ tab: "inbox", inboxView: view })).groups.map((group) => [group.id, group.rows.map((row) => row.id)]);
    expect(groups("needs-triage")).toStrictEqual([
      ["needs-me", ["M-1", "M-2"]],
      ["likely-noise", ["M-5"]],
    ]);
    expect(groups("converted")).toStrictEqual([["converted", ["M-4"]]]);
    expect(groups("handled")).toStrictEqual([["handled", ["M-3"]]]);
    const saved = buildInboxView(data(), EMPTY_INBOX_EXTRAS, query({ tab: "inbox" })).savedViews;
    expect(saved.map((view) => [view.id, view.count])).toStrictEqual([
      ["needs-triage", 2],
      ["converted", 1],
      ["handled", 1],
      ["all", 5],
    ]);
  });

  it("never shows a classification without its rationale", () => {
    const view = buildInboxView(data(), EMPTY_INBOX_EXTRAS, query({ tab: "inbox" }));
    const rows = view.groups.flatMap((group) => group.rows);
    const ai = rows.find((row) => row.id === "M-1")?.chips[0];
    expect(ai?.label).toBe("AI: Action");
    expect(ai?.title).toContain("something it owns");
    const failed = resolveInboxDetail("M-5", data(), EMPTY_INBOX_EXTRAS, query({ tab: "inbox" }));
    /* The captured proposal failed, so the offline composition is shown, with its own rationale. */
    expect(failed?.classification.available).toBe(true);
    expect(failed?.classification.rationale.length).toBeGreaterThan(12);
    expect(failed?.classification.mode).toBe("Offline");
  });

  it("shows the converted message's destination on its row", () => {
    const view = buildInboxView(data(), EMPTY_INBOX_EXTRAS, query({ tab: "inbox", inboxView: "converted" }));
    expect(view.groups[0]?.rows[0]?.chips.map((chip) => chip.label)).toContain("Action A-1");
  });

  it("gives every message the plan's eight facts and one primary action", () => {
    const detail = resolveInboxDetail("M-1", data(), extras({ stages: [STAGE] }), query({ tab: "inbox" }));
    expect(detail?.facts.map((fact) => fact.label)).toStrictEqual(["Source", "From", "Received", "Respond by", "Linked object", "Reference"]);
    expect(detail?.facts[0]?.value).toBe("Mail, Simulated");
    expect(detail?.respondBy?.text).toBe("06.10.2026 12:00");
    expect(detail?.operations.filter((op) => op.primary).map((op) => op.id)).toStrictEqual(["create-action"]);
    expect(detail?.primaryAction.length).toBeGreaterThan(0);
  });

  it("routes a decision the role can see, and sends one it cannot into the process that covers it", () => {
    const decided = shared({
      messages: [inboxRow({ id: "M-1", proposedTriage: "decision", relatedObjectKind: "decision", relatedObjectId: "DEC-1" })],
      decisions: [{ id: "DEC-1", reference: "DEC-1", title: "Accept the summary", titleDe: "", status: "open", roleId: "rcsa", relatedObjectId: null }],
    });
    const routed = resolveInboxDetail("M-1", decided, EMPTY_INBOX_EXTRAS, query());
    expect(routed?.forms.routeDecision?.id).toBe("DEC-1");
    expect(routed?.operations.find((op) => op.primary)?.id).toBe("confirm-triage");

    const covered = shared({
      messages: [inboxRow({ id: "M-1", proposedTriage: "decision", relatedObjectKind: "control", relatedObjectId: "CTL-1" })],
      processScopes: [processScope()],
    });
    const intoProcess = resolveInboxDetail("M-1", covered, extras({ stages: [STAGE] }), query());
    expect(intoProcess?.operations.find((op) => op.primary)?.id).toBe("add-to-process");
    expect(intoProcess?.forms.stages[0]).toMatchObject({ value: "RUN-1::evidence-refresh", coversObject: true, selected: true, warning: null });
  });

  it("disables what a message cannot take, with the reason", () => {
    const detail = resolveInboxDetail("M-4", data(), EMPTY_INBOX_EXTRAS, query());
    const create = detail?.operations.find((op) => op.id === "create-action");
    expect(create?.enabled).toBe(false);
    expect(create?.disabledReason).toBe("Already became action A-1.");
    const process = detail?.operations.find((op) => op.id === "add-to-process");
    expect(process?.disabledReason).toContain("No running process");
    const reply = detail?.operations.find((op) => op.id === "draft-reply");
    expect(reply?.disabledReason).toContain("no person record");
  });

  it("says who confirmed the classification, when and why, from what the message records", () => {
    const recorded = shared({
      messages: [
        inboxRow({ id: "M-1", proposedTriage: "action", confirmedTriage: "information", triageConfirmedByUserId: "P-003", triageConfirmedAt: at("09:15"), triageReason: "Covered in the indicator pack." }),
        inboxRow({ id: "M-2", proposedTriage: "action", confirmedTriage: "action", linkedActionId: "A-1", conversionKind: "action", convertedByUserId: "P-003", convertedAt: at("09:20"), triageConfirmedByUserId: "P-003", triageConfirmedAt: at("09:20") }),
        inboxRow({ id: "M-3", proposedTriage: "action", confirmedTriage: "action" }),
      ],
      actions: [actionRow({ id: "A-1" })],
    });
    const own = resolveInboxDetail("M-1", recorded, EMPTY_INBOX_EXTRAS, query());
    expect(own?.personTriage).toStrictEqual({ label: "Information", note: "Recorded by Anna Weber at 09:15.", reason: "Changed from Action. Reason: Covered in the indicator pack." });
    expect(resolveInboxDetail("M-2", recorded, EMPTY_INBOX_EXTRAS, query())?.personTriage?.note).toBe("Recorded with the conversion, by Anna Weber at 09:20.");
    expect(resolveInboxDetail("M-3", recorded, EMPTY_INBOX_EXTRAS, query())?.personTriage?.note).toBe("Recorded on the message, with no record of who recorded it.");
  });

  it("marks only raising an action as material, and states what each operation changes and needs", () => {
    const detail = resolveInboxDetail("M-1", data(), extras({ stages: [STAGE] }), query());
    const create = detail?.operations.find((op) => op.id === "create-action");
    expect(create?.material).toBe(true);
    expect(create?.approval).toContain("Material");
    expect(detail?.operations.filter((op) => op.material).map((op) => op.id)).toStrictEqual(["create-action"]);
    for (const op of detail?.operations ?? []) {
      expect(op.aiPrepared.length, op.id).toBeGreaterThan(0);
      expect(op.youDecide.length, op.id).toBeGreaterThan(0);
      expect(op.willChange.length, op.id).toBeGreaterThan(0);
      expect(op.approval.length, op.id).toBeGreaterThan(0);
    }
  });

  it("offers an operation only when the gate has a verdict for its tools", () => {
    const closed = shared({ messages: messages(), gate: {} });
    const detail = resolveInboxDetail("M-1", closed, EMPTY_INBOX_EXTRAS, query());
    expect(detail?.operations.every((op) => !op.enabled)).toBe(true);
    expect(detail?.operations[0]?.disabledReason).toBe("This operation is not registered with the authority gate.");
  });

  it("suggests the colleague the rationale names as the delegate", () => {
    const named = shared({ messages: [inboxRow({ id: "M-1", proposedTriage: "delegate", triageRationale: "Commercial, not risk. It sits with P-007 in operations." })] });
    const detail = resolveInboxDetail("M-1", named, EMPTY_INBOX_EXTRAS, query());
    expect(detail?.forms.delegates[0]).toMatchObject({ id: "P-007", suggested: true });
    expect(detail?.forms.delegates.some((person) => person.id === "P-003")).toBe(false);
  });

  it("is bilingual", () => {
    const detail = resolveInboxDetail("M-1", shared({ ...data(), language: "de" }), EMPTY_INBOX_EXTRAS, query());
    expect(detail?.facts[0]?.value).toBe("E-Mail, Simuliert");
    expect(detail?.classification.rationaleNote).toBe("Mit der Nachricht auf Englisch erfasst.");
    expect(detail?.operations.find((op) => op.id === "create-action")?.label).toBe("Massnahme anlegen");
  });

  it("keeps handled messages searchable, by what they became", () => {
    const entries = buildInboxSearchEntries(data(), EMPTY_INBOX_EXTRAS);
    expect(entries.map((entry) => entry.id)).toStrictEqual(["M-1", "M-2", "M-3", "M-4", "M-5"]);
    const converted = entries.find((entry) => entry.id === "M-4");
    expect(converted?.kind).toBe("message");
    expect(converted?.keywords).toContain("A-1");
    expect(converted?.href).toBe("/workday/rcsa/work?view=inbox&iview=converted&item=M-4");
    expect(entries.find((entry) => entry.id === "M-3")?.detail).toBe("Mail, Handled: Filed");
  });
});

/* ==========================================================================
   The reply draft
   ========================================================================== */

describe("the reply draft", () => {
  const base = {
    language: "en" as const,
    addressee: "Tobias",
    subject: "Subprocessor chain extract",
    receivedOn: "2026-10-05T18:12:00.000Z",
    respondBy: "2026-10-08T12:00:00.000Z",
    signer: "Stefan Brunner",
    duplicateOf: null,
    action: null,
    evidence: null,
    stage: null,
    delegatedTo: null,
    decision: null,
  };

  it("says only what has been done, and promises no date the message did not set", () => {
    const nothing = composeReply(base);
    expect(nothing.subject).toBe("Re: Subprocessor chain extract");
    expect(nothing.body).toContain("I will come back to you by 08.10.2026.");
    const done = composeReply({ ...base, action: { id: "MSN-1", title: "Assemble the extract", owner: "Stefan Brunner", dueOn: "2026-10-07" } });
    expect(done.body).toContain('I have raised action MSN-1, "Assemble the extract", owned by Stefan Brunner, due 07.10.2026.');
    expect(done.body).not.toContain("come back");
    expect(validateReplyDraft(done, "en").ok).toBe(true);
  });

  it("is written in German without umlauts", () => {
    const draft = composeReply({ ...base, language: "de", evidence: { id: "EVD-1", objects: ["CTL-1"] } });
    expect(draft.subject.startsWith("AW: ")).toBe(true);
    expect(draft.body).toContain("Nachweis EVD-1 zu CTL-1");
    expect(validateReplyDraft(draft, "de").ok).toBe(true);
  });

  it("addresses a person by first name without a title", () => {
    expect(firstNameOf("Dr. Katharina Vogt")).toBe("Katharina");
    expect(firstNameOf("Miriam Falk, Supplier")).toBe("Miriam");
  });
});
