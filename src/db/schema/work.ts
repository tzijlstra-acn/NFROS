/**
 * Work schema: the personal work layer and the evidence corpus.
 *
 * Lanes 1 and 2 of the work model live here. These tables are deliberately
 * role agnostic: inbox, calendar, meetings and evidence are shared
 * infrastructure across every NFR function, which is the point the product
 * makes about orchestration being largely common.
 */

import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import type { ProvenanceKind, RoleId } from "./core";

export const inboxMessages = sqliteTable(
  "inbox_messages",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    /** Which professional's inbox this sits in. */
    roleId: text("role_id").$type<RoleId>().notNull(),
    /** "mail", "collaboration", "grc-queue", "service-management" or "alert". */
    channel: text("channel").notNull(),
    fromUserId: text("from_user_id"),
    /** External sender name when there is no internal user row. */
    fromLabel: text("from_label").notNull(),
    subject: text("subject").notNull(),
    subjectDe: text("subject_de").notNull().default(""),
    body: text("body").notNull(),
    receivedAt: text("received_at").notNull(),
    /** Scenario moment at which this message becomes visible. */
    revealedAtMoment: text("revealed_at_moment").notNull(),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    /**
     * The triage outcome the assistant proposes. Lane 1 work.
     * "decision", "action", "evidence", "information", "delegate" or "noise".
     */
    proposedTriage: text("proposed_triage").notNull(),
    triageRationale: text("triage_rationale").notNull().default(""),
    /** Confidence in the triage, zero to one. */
    triageConfidence: real("triage_confidence").notNull().default(0.8),
    /** The human accepted or changed triage. Null until the user acts. */
    confirmedTriage: text("confirmed_triage"),
    /** Objects this message relates to, so triage can create real work. */
    relatedObjectKind: text("related_object_kind"),
    relatedObjectId: text("related_object_id"),
    /** Decision or action created from this message. */
    linkedDecisionId: text("linked_decision_id"),
    linkedActionId: text("linked_action_id"),
    /** True when this message is duplicate of another evidence request. */
    isDuplicateOf: text("is_duplicate_of"),
    requiresResponseBy: text("requires_response_by"),
    /** True when the message arrives as part of the 14:05 event. */
    fromSharedEvent: integer("from_shared_event", { mode: "boolean" }).notNull().default(false),
    priorityRank: integer("priority_rank").notNull().default(50),
  },
  (table) => [
    index("inbox_run_role_idx").on(table.runId, table.roleId, table.priorityRank),
    index("inbox_reveal_idx").on(table.runId, table.revealedAtMoment),
  ],
);

export const calendarEvents = sqliteTable(
  "calendar_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    title: text("title").notNull(),
    titleDe: text("title_de").notNull().default(""),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    /** Scenario moment label this entry aligns to, when it is part of the day. */
    momentLabel: text("moment_label"),
    location: text("location").notNull().default(""),
    attendeeUserIds: text("attendee_user_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** "workshop", "meeting", "committee", "focus-time" or "crisis-call". */
    kind: text("kind").notNull(),
    /** True when two entries overlap, which is part of the Today state. */
    hasConflict: integer("has_conflict", { mode: "boolean" }).notNull().default(false),
    conflictWithId: text("conflict_with_id"),
    /** The linked meeting simulation, when one exists. */
    meetingId: text("meeting_id"),
    /** Preparation status. In the Today view this is manual work. */
    preparationStatus: text("preparation_status").notNull().default("not-started"),
    agenda: text("agenda").notNull().default(""),
  },
  (table) => [index("cal_run_role_idx").on(table.runId, table.roleId, table.startsAt)],
);

export const meetings = sqliteTable(
  "meetings",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    titleDe: text("title_de").notNull().default(""),
    /** "rcsa-workshop", "supplier-challenge", "crisis-call" or "committee". */
    kind: text("kind").notNull(),
    momentLabel: text("moment_label").notNull(),
    scheduledFor: text("scheduled_for").notNull(),
    /** Participant user identifiers, in seating order. */
    participantUserIds: text("participant_user_ids", { mode: "json" }).$type<string[]>().notNull(),
    objective: text("objective").notNull(),
    /** The preparation pack the assistant assembled. */
    preparationSummary: text("preparation_summary").notNull().default(""),
    evidenceDocumentIds: text("evidence_document_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** Challenge questions prepared for the user, as drafts they may edit. */
    preparedQuestions: text("prepared_questions", { mode: "json" }).$type<string[]>().notNull(),
    /** "not-started", "in-progress" or "concluded". */
    status: text("status").notNull().default("not-started"),
    /** The outcome the human recorded. */
    outcome: text("outcome").notNull().default(""),
    concludedAt: text("concluded_at"),
    /** Whether this meeting supports live voice when a realtime model exists. */
    supportsVoice: integer("supports_voice", { mode: "boolean" }).notNull().default(false),
    /** The subject of the meeting, for example the control under challenge. */
    subjectKind: text("subject_kind"),
    subjectId: text("subject_id"),
  },
  (table) => [index("meet_run_role_idx").on(table.runId, table.roleId)],
);

/**
 * A turn in a meeting simulation.
 *
 * Seeded turns drive the deterministic script in presenter safe and offline
 * mode. Live mode adds model generated turns for the role played participants
 * while keeping the seeded beats as anchors.
 */
export const meetingMessages = sqliteTable(
  "meeting_messages",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    meetingId: text("meeting_id").notNull(),
    sortOrder: integer("sort_order").notNull(),
    /** Null for the assistant. */
    speakerUserId: text("speaker_user_id"),
    speakerLabel: text("speaker_label").notNull(),
    /** "participant", "assistant", "user" or "system". */
    speakerKind: text("speaker_kind").notNull(),
    atMoment: text("at_moment").notNull(),
    content: text("content").notNull(),
    provenance: text("provenance").$type<ProvenanceKind>().notNull(),
    /**
     * Set when the assistant detects that this statement conflicts with
     * evidence. This drives the contradiction flag visual moment.
     */
    contradictsEvidenceId: text("contradicts_evidence_id"),
    contradictionNote: text("contradiction_note").notNull().default(""),
    /** True when this turn is a seeded anchor that must appear in safe mode. */
    isScriptedAnchor: integer("is_scripted_anchor", { mode: "boolean" }).notNull().default(true),
    /** True when a human dismissed the contradiction flag on this turn. */
    flagDismissed: integer("flag_dismissed", { mode: "boolean" }).notNull().default(false),
    /** True when the human recorded a factual correction against this turn. */
    correctionRecorded: integer("correction_recorded", { mode: "boolean" }).notNull().default(false),
    correctionText: text("correction_text").notNull().default(""),
  },
  (table) => [index("meetmsg_idx").on(table.runId, table.meetingId, table.sortOrder)],
);

/** Simulated outbound collaboration messages. These never leave the machine. */
export const collaborationMessages = sqliteTable(
  "collaboration_messages",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    fromRoleId: text("from_role_id").$type<RoleId>().notNull(),
    toUserIds: text("to_user_ids", { mode: "json" }).$type<string[]>().notNull(),
    channelName: text("channel_name").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    sentAtMoment: text("sent_at_moment").notNull(),
    sentAt: text("sent_at").notNull(),
    /** Always true. Recorded explicitly so the trust page can prove it. */
    simulatedOnly: integer("simulated_only", { mode: "boolean" }).notNull().default(true),
    relatedObjectKind: text("related_object_kind"),
    relatedObjectId: text("related_object_id"),
    decisionId: text("decision_id"),
    /** A seeded reply, so asynchronous validation feels real. */
    replyBody: text("reply_body").notNull().default(""),
    replyFromUserId: text("reply_from_user_id"),
    replyAtMoment: text("reply_at_moment"),
  },
  (table) => [index("collab_run_idx").on(table.runId, table.fromRoleId)],
);

/**
 * The synthetic evidence corpus.
 *
 * Every AI supported conclusion in the product cites rows from this table by
 * identifier. There is no unsourced conclusion anywhere in the interface.
 */
export const evidenceDocuments = sqliteTable(
  "evidence_documents",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    titleDe: text("title_de").notNull().default(""),
    /**
     * "policy", "control-description", "rcsa-extract", "kri-report",
     * "control-test-report", "supplier-due-diligence", "contract-clause",
     * "subprocessor-list", "bcm-test", "incident-notification", "process-map",
     * "meeting-minutes", "remediation-update", "committee-extract",
     * "regulatory-publication", "telemetry-extract" or "transaction-log".
     */
    sourceType: text("source_type").notNull(),
    /** The system of record this came from. */
    sourceSystem: text("source_system").notNull(),
    authorLabel: text("author_label").notNull(),
    authorUserId: text("author_user_id"),
    documentDate: text("document_date").notNull(),
    /** When this document entered the corpus. */
    ingestedAt: text("ingested_at").notNull(),
    entityIds: text("entity_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** "public", "internal", "confidential" or "strictly-confidential". */
    dataClassification: text("data_classification").notNull(),
    /** "current", "superseded", "draft", "requested" or "missing". */
    status: text("status").notNull(),
    /** Set when the document was requested but has not arrived. */
    requestedFromLabel: text("requested_from_label"),
    requestedOn: text("requested_on"),
    /** True when the content is older than the policy freshness requirement. */
    isStale: integer("is_stale", { mode: "boolean" }).notNull().default(false),
    stalenessNote: text("staleness_note").notNull().default(""),
    provenance: text("provenance").$type<ProvenanceKind>().notNull(),
    /** Full synthetic body text. Retrieval chunks are derived from this. */
    body: text("body").notNull(),
    summary: text("summary").notNull(),
    /** Object identifiers this document evidences. */
    relatedObjectIds: text("related_object_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** Page or section count, shown in the evidence drawer. */
    pageCount: integer("page_count").notNull().default(1),
    /** True when only visible after the 14:05 event. */
    fromSharedEvent: integer("from_shared_event", { mode: "boolean" }).notNull().default(false),
    revealedAtMoment: text("revealed_at_moment").notNull().default("07:45"),
  },
  (table) => [
    index("evdoc_run_idx").on(table.runId),
    index("evdoc_type_idx").on(table.runId, table.sourceType),
  ],
);

/**
 * Retrieval chunks with cached embeddings.
 *
 * Lexical retrieval uses a SQLite full text index over this table. Semantic
 * retrieval uses `embedding`, populated in live mode and cached so repeated
 * runs do not re-embed the corpus.
 */
export const evidenceChunks = sqliteTable(
  "evidence_chunks",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    documentId: text("document_id").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    /** Section or paragraph label, cited in the interface. */
    locator: text("locator").notNull(),
    content: text("content").notNull(),
    /** JSON array of floats. Null until embedded in live mode. */
    embedding: text("embedding", { mode: "json" }).$type<number[]>(),
    embeddingModel: text("embedding_model"),
    embeddedAt: text("embedded_at"),
    tokenEstimate: integer("token_estimate").notNull().default(0),
  },
  (table) => [index("evchunk_doc_idx").on(table.runId, table.documentId, table.chunkIndex)],
);
