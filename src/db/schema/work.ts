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

/**
 * What an inbox message became (migration 0008), as the Inbox's lineage
 * (`src/features/work/modules/inbox/lineage.ts`) names it.
 *
 * The first five are work: an action, a decision input, an evidence
 * document, a process stage input or a delegation. `dismissed` is a person
 * closing the message as noise, and it is recorded only while the message has
 * become no work: a later conversion to work replaces it.
 */
export const INBOX_CONVERSION_KINDS = ["action", "decision", "evidence", "process", "delegated", "dismissed"] as const;
export type InboxConversionKind = (typeof INBOX_CONVERSION_KINDS)[number];

/** The conversion kinds that are work. "Message converted to work" counts only these. */
export const INBOX_WORK_CONVERSION_KINDS: readonly InboxConversionKind[] = ["action", "decision", "evidence", "process", "delegated"];

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
    /**
     * What the message became, who made it so and when (0006 added who and
     * when; 0008 added the kind and widened the definition). Home's Partner
     * update, the Inbox's Converted and Handled places and the "Message
     * converted to work" measure read these.
     *
     * The rule, kept by `recordInboxConversion`
     * (src/db/repositories/inbox-conversion.ts): the first conversion to work
     * of any kind in `INBOX_WORK_CONVERSION_KINDS` is recorded once and never
     * replaced; a dismissal is recorded only while there is no conversion to
     * work, and a conversion to work replaces it. All three stay null until a
     * person acts. The migrations fill them from the backbone's
     * `inbox-converted:<message>:<kind>:` events and the standing noise
     * triage, and leave who and when null where no event records them.
     */
    conversionKind: text("conversion_kind").$type<InboxConversionKind>(),
    convertedByUserId: text("converted_by_user_id"),
    convertedAt: text("converted_at"),
    /**
     * Who confirmed the current classification (`confirmed_triage`), when and
     * why (migration 0008). From the person's own triage, or from the first
     * conversion when converting the message is what confirmed it. The reason
     * is the person's, required when they departed from the AI's proposal.
     */
    triageConfirmedByUserId: text("triage_confirmed_by_user_id"),
    triageConfirmedAt: text("triage_confirmed_at"),
    triageReason: text("triage_reason"),
    /** The evidence document the message was filed as (migration 0008). */
    linkedEvidenceDocumentId: text("linked_evidence_document_id"),
    /** The internal colleague the message was delegated to (migration 0008). */
    delegatedToUserId: text("delegated_to_user_id"),
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
    /** The person who recorded the meeting as held, and when on the scenario day. */
    heldByUserId: text("held_by_user_id"),
    heldAt: text("held_at"),
    /**
     * The process run and stage whose deadline depends on this meeting.
     *
     * Recorded rather than inferred at read time. Migration 0005 and the seed
     * write it with the rule the Work Hub used to apply on every read (a
     * running process whose scope holds the meeting's subject, at the stage
     * the role's configuration says this kind of meeting serves), so a link
     * shown anywhere in the product is one a reader can find in the row.
     */
    processRunId: text("process_run_id"),
    stageId: text("stage_id"),
  },
  (table) => [
    index("meet_run_role_idx").on(table.runId, table.roleId),
    index("meet_process_idx").on(table.runId, table.processRunId, table.stageId),
  ],
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

/**
 * What a simulated collaboration message is (migration 0008).
 *
 * Until 0008 a reader told a delegation from a reply by its channel name,
 * which is display text. The kind is the fact; the channel stays the label.
 *
 *   message                an ordinary simulated message, the default
 *   delegation             an inbox message handed to a colleague
 *   reply                  an answer to an inbox message's sender
 *   minutes-distribution   confirmed minutes sent to the attendees
 *   validation-request     a request for factual validation
 *   follow-up              an action follow-up sent to its owner
 */
export const COLLABORATION_MESSAGE_KINDS = [
  "message",
  "delegation",
  "reply",
  "minutes-distribution",
  "validation-request",
  "follow-up",
] as const;
export type CollaborationMessageKind = (typeof COLLABORATION_MESSAGE_KINDS)[number];

/** Simulated outbound collaboration messages. These never leave the machine. */
export const collaborationMessages = sqliteTable(
  "collaboration_messages",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    fromRoleId: text("from_role_id").$type<RoleId>().notNull(),
    toUserIds: text("to_user_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** See `COLLABORATION_MESSAGE_KINDS`. A writer that sets none records "message". */
    kind: text("kind").$type<CollaborationMessageKind>().notNull().default("message"),
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
    /** Lineage: the confirmed minutes this document is the record of. */
    sourceMinutesId: text("source_minutes_id"),
    /** Lineage: the inbox message this document was filed from. */
    sourceMessageId: text("source_message_id"),
  },
  (table) => [
    index("evdoc_run_idx").on(table.runId),
    index("evdoc_type_idx").on(table.runId, table.sourceType),
    index("evdoc_minutes_idx").on(table.runId, table.sourceMinutesId),
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
