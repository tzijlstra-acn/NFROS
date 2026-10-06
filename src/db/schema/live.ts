/**
 * The live day schema.
 *
 * Three tables, each answering one question the interactive workday asks
 * constantly: what happened, what has the AI done about it, and what does it
 * suggest.
 *
 * `workday_live_events` is a projection, not a second scenario. Every row is
 * derived at seed time from content that already exists: the ten timeline
 * moments, the seeded background actions, the inbox, the meetings, the open
 * decisions and the inbound integration events. Nothing here invents a beat
 * the scenario does not have. That constraint matters because the product's
 * whole claim is that one institution and one day are shared across six
 * functions, and a parallel event source would quietly break it.
 *
 * Read state is a separate table keyed by role. The same 14:05 event is unread
 * for the third party risk lead and for the resilience lead independently,
 * which is what makes "three new" mean something after a role switch.
 */

import { sqliteTable, text, integer, index, unique } from "drizzle-orm/sqlite-core";
import type { AuthorityClass } from "./decisions";
import type { RoleId } from "./core";

/**
 * What kind of thing arrived.
 *
 * `shared-event` is distinct from `signal` because the 14:05 event is the one
 * beat every role sees, and the interface treats it differently.
 */
export const LIVE_EVENT_TYPES = [
  "signal",
  "message",
  "meeting",
  "evidence",
  "agent-action",
  "decision-required",
  "execution",
  "shared-event",
] as const;
export type LiveEventType = (typeof LIVE_EVENT_TYPES)[number];

export const LIVE_EVENT_SEVERITIES = [
  "critical",
  "high",
  "medium",
  "low",
  "informational",
] as const;
export type LiveEventSeverity = (typeof LIVE_EVENT_SEVERITIES)[number];

/** The observable processing stages of one AI preparation. */
export const AI_GENERATION_STATES = [
  "idle",
  "queued",
  "retrieving",
  "reconciling",
  "analysing",
  "drafting",
  "validating",
  "ready",
  "blocked",
  "error",
] as const;
export type AIGenerationStateName = (typeof AI_GENERATION_STATES)[number];

export const SUGGESTION_STATUSES = [
  "monitoring",
  "checking",
  "ready",
  "needs-user",
  "executing",
  "completed",
  "dismissed",
] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

/**
 * What the person did with a suggestion (plan section 4.11, suggestion lifecycle).
 *
 * Separate from `status`, which is the preparation pipeline (monitoring,
 * checking, ready, ...) and is read by Home, the dock and the focus queue.
 * The disposition is the human answer to a prepared suggestion, and it is
 * what product quality and pilot analytics count as accepted, modified and
 * rejected:
 *
 *   new        prepared, not yet looked at
 *   reviewed   opened and read, no answer yet
 *   accepted   taken as prepared
 *   modified   taken with changes the person made (recorded in the history)
 *   rejected   declined by the person
 *   executed   the accepted or modified change ran through the authority gate
 *   expired    no longer applicable, for example its decision was recorded elsewhere
 *
 * The current value lives on the suggestion row so every reader can rely on
 * it; every change is also appended to `ai_suggestion_dispositions` with who,
 * when, from, to and the modification.
 */
export const SUGGESTION_DISPOSITIONS = [
  "new",
  "reviewed",
  "accepted",
  "modified",
  "rejected",
  "executed",
  "expired",
] as const;
export type SuggestionDisposition = (typeof SUGGESTION_DISPOSITIONS)[number];

export const workdayLiveEvents = sqliteTable(
  "workday_live_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    /** Scenario clock, for example "14:05". */
    atMoment: text("at_moment").notNull(),
    /** Ordering within the same moment. */
    sortOrder: integer("sort_order").notNull(),
    type: text("type").$type<LiveEventType>().notNull(),
    /** Which roles this event is visible to. Empty means every role. */
    roleIds: text("role_ids", { mode: "json" }).$type<RoleId[]>().notNull(),
    severity: text("severity").$type<LiveEventSeverity>().notNull(),
    title: text("title").notNull(),
    titleDe: text("title_de").notNull(),
    summary: text("summary").notNull(),
    summaryDe: text("summary_de").notNull(),
    objectType: text("object_type").notNull(),
    objectId: text("object_id").notNull(),
    evidenceIds: text("evidence_ids", { mode: "json" }).$type<string[]>().notNull(),
    requiresDecision: integer("requires_decision", { mode: "boolean" }).notNull(),
    /** True when the live player must stop here rather than roll past. */
    autoPause: integer("auto_pause", { mode: "boolean" }).notNull(),
    /** The decision this event puts in front of a human, when there is one. */
    decisionId: text("decision_id"),
    /**
     * Where this projection came from, so a reader can verify that no event
     * was invented: "timeline", "background-action", "inbox", "meeting",
     * "decision", "integration".
     */
    derivedFrom: text("derived_from").notNull(),
    derivedFromId: text("derived_from_id").notNull().default(""),
    /** Set when an inbound connector event produced this. */
    integrationEventId: text("integration_event_id"),
    /** Connector instances whose data this event depends on. */
    sourceConnectorIds: text("source_connector_ids", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("wle_run_moment_idx").on(table.runId, table.atMoment, table.sortOrder),
    index("wle_decision_idx").on(table.decisionId),
  ],
);

export const workdayLiveEventReads = sqliteTable(
  "workday_live_event_reads",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    eventId: text("event_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    readAt: text("read_at"),
    acknowledgedAt: text("acknowledged_at"),
    /** True once the guided catch up has walked the user through it. */
    reviewedInCatchUp: integer("reviewed_in_catch_up", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [
    unique("wler_event_role_unq").on(table.eventId, table.roleId),
    index("wler_run_role_idx").on(table.runId, table.roleId),
  ],
);

/**
 * One prepared AI suggestion.
 *
 * `stateDigest` is the deduplication key for automatic generation. It is a
 * hash of everything the suggestion depends on: role, object, event, moment,
 * autonomy level and evidence set. A second request for an unchanged state
 * finds this row instead of calling the model again, which is the acceptance
 * criterion about cached output not producing duplicate requests.
 */
export const aiSuggestions = sqliteTable(
  "ai_suggestions",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    eventId: text("event_id"),
    objectType: text("object_type").notNull(),
    objectId: text("object_id").notNull(),
    atMoment: text("at_moment").notNull(),
    status: text("status").$type<SuggestionStatus>().notNull(),
    priority: text("priority").$type<"critical" | "high" | "medium" | "low">().notNull(),

    headline: text("headline").notNull(),
    changeSummary: text("change_summary").notNull(),
    whyItMatters: text("why_it_matters").notNull(),
    checksCompleted: text("checks_completed", { mode: "json" }).$type<string[]>().notNull(),
    actionsCompleted: text("actions_completed", { mode: "json" }).$type<string[]>().notNull(),
    recommendedAction: text("recommended_action"),
    alternatives: text("alternatives", { mode: "json" }).$type<string[]>().notNull(),
    evidenceIds: text("evidence_ids", { mode: "json" }).$type<string[]>().notNull(),
    confidence: integer("confidence").notNull(),
    uncertainty: text("uncertainty", { mode: "json" }).$type<string[]>().notNull(),
    decisionRequired: integer("decision_required", { mode: "boolean" }).notNull(),
    authorityClass: text("authority_class").$type<AuthorityClass>().notNull(),
    decisionId: text("decision_id"),

    /* ---- provenance and honesty ---- */
    /** "live", "cache" or "seeded". Shown discreetly, never hidden. */
    source: text("source").$type<"live" | "cache" | "seeded">().notNull(),
    /**
     * True when a required source was unavailable and the output is therefore
     * deliberately constrained. The card says so rather than presenting a
     * confident recommendation built on a gap.
     */
    constrained: integer("constrained", { mode: "boolean" }).notNull().default(false),
    missingRequiredSources: text("missing_required_sources", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    /** The connector instances this suggestion actually read from. */
    sourceConnectorIds: text("source_connector_ids", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    /** Stage transitions as they happened, for replay in safe mode. */
    stages: text("stages", { mode: "json" })
      .$type<Array<{ state: AIGenerationStateName; label: string; labelDe: string; atMs: number }>>()
      .notNull(),
    /** Deduplication key over the inputs. */
    stateDigest: text("state_digest").notNull(),
    agentRunId: text("agent_run_id"),
    model: text("model").notNull().default(""),
    durationMs: integer("duration_ms").notNull().default(0),
    validatedAt: text("validated_at"),
    createdAt: text("created_at").notNull(),
    dismissedAt: text("dismissed_at"),
    snoozedUntilMoment: text("snoozed_until_moment"),

    /* ---- the person's disposition (migration 0006) ---- */
    /**
     * The current disposition, see `SUGGESTION_DISPOSITIONS`. Written only
     * together with a row in `ai_suggestion_dispositions`, by
     * `recordSuggestionDisposition` in `src/db/repositories/suggestion-dispositions.ts`.
     */
    disposition: text("disposition").$type<SuggestionDisposition>().notNull().default("new"),
    dispositionAt: text("disposition_at"),
    /** Null for a system change, such as expiry. */
    dispositionByUserId: text("disposition_by_user_id"),
  },
  (table) => [
    index("ais_run_role_idx").on(table.runId, table.roleId, table.atMoment),
    index("ais_event_idx").on(table.eventId),
    index("ais_digest_idx").on(table.stateDigest),
    index("ais_object_idx").on(table.objectType, table.objectId),
  ],
);

/**
 * The activity stream: what the partner did, in order, with real timings.
 *
 * Every row must correspond to something that happened. A tool call, a
 * reconciliation, a connector read, a mutation, an escalation. The compact
 * view shows the label and the time; expanding shows the object, the tool, the
 * authority class and the audit reference.
 */
export const aiActivityEntries = sqliteTable(
  "ai_activity_entries",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    atMoment: text("at_moment").notNull(),
    sequence: integer("sequence").notNull(),
    kind: text("kind")
      .$type<
        | "observed"
        | "retrieved"
        | "reconciled"
        | "analysed"
        | "drafted"
        | "completed"
        | "escalated"
        | "blocked"
        | "executed"
        | "waiting"
      >()
      .notNull(),
    label: text("label").notNull(),
    labelDe: text("label_de").notNull(),
    detail: text("detail").notNull().default(""),
    objectType: text("object_type").notNull().default(""),
    objectId: text("object_id").notNull().default(""),
    toolName: text("tool_name").notNull().default(""),
    durationMs: integer("duration_ms").notNull().default(0),
    outcome: text("outcome").notNull().default(""),
    authorityClass: text("authority_class").$type<AuthorityClass | "">().notNull().default(""),
    auditEventId: text("audit_event_id"),
    toolCallId: text("tool_call_id"),
    evidenceIds: text("evidence_ids", { mode: "json" }).$type<string[]>().notNull(),
    suggestionId: text("suggestion_id"),
    eventId: text("event_id"),
    /** Connector instance, when this entry was a read from or write to one. */
    connectorInstanceId: text("connector_instance_id"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("aae_run_role_seq_idx").on(table.runId, table.roleId, table.sequence),
    index("aae_suggestion_idx").on(table.suggestionId),
    index("aae_moment_idx").on(table.runId, table.atMoment),
  ],
);

/**
 * Persistent contextual chat threads.
 *
 * Separate from `agent_sessions`, which holds the deeper assistant route
 * conversation. The workday chat has to survive navigation between work
 * objects and record which object each turn was asked about, so that the
 * thread reads correctly when the user comes back to it.
 */
export const chatThreads = sqliteTable(
  "chat_threads",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    title: text("title").notNull().default(""),
    startedAtMoment: text("started_at_moment").notNull(),
    lastActiveAtMoment: text("last_active_at_moment").notNull(),
    agentSessionId: text("agent_session_id"),
    createdAt: text("created_at").notNull(),
    closedAt: text("closed_at"),
  },
  (table) => [index("ct_run_role_idx").on(table.runId, table.roleId)],
);

export const chatTurns = sqliteTable(
  "chat_turns",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull(),
    runId: text("run_id").notNull(),
    sequence: integer("sequence").notNull(),
    author: text("author").$type<"user" | "partner">().notNull(),
    atMoment: text("at_moment").notNull(),
    /** What the user had selected when the turn was taken. */
    contextObjectType: text("context_object_type").notNull().default(""),
    contextObjectId: text("context_object_id").notNull().default(""),
    contextEventId: text("context_event_id"),
    contextDecisionId: text("context_decision_id"),
    /**
     * Typed response parts rather than one blob of text, so the interface can
     * render evidence, a proposed action and an approval request differently
     * from prose. The discriminator is `kind`.
     */
    parts: text("parts", { mode: "json" })
      .$type<
        Array<{
          kind:
            | "answer"
            | "evidence"
            | "uncertainty"
            | "recommendation"
            | "alternative"
            | "proposed-action"
            | "approval-request"
            | "execution-receipt"
            | "blocked"
            | "follow-up"
            | "source-status";
          text: string;
          refs?: string[];
          meta?: Record<string, unknown>;
        }>
      >()
      .notNull(),
    /** Plain text mirror of the answer parts, for search and evaluation. */
    plainText: text("plain_text").notNull().default(""),
    source: text("source").$type<"live" | "cache" | "seeded">().notNull().default("seeded"),
    agentRunId: text("agent_run_id"),
    model: text("model").notNull().default(""),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("ctn_thread_seq_idx").on(table.threadId, table.sequence),
    index("ctn_run_idx").on(table.runId),
  ],
);

/**
 * Live player state, persisted so a reload does not lose the user's position.
 *
 * `viewedMoment` is distinct from the run's `currentMoment`. The run holds
 * live time; this holds the time the user is looking at. Keeping them separate
 * is what lets the interface say "Viewing 10:30, live at 14:05" truthfully.
 */
export const livePlayerState = sqliteTable("live_player_state", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  playing: integer("playing", { mode: "boolean" }).notNull().default(false),
  speed: integer("speed").notNull().default(1),
  viewedMoment: text("viewed_moment").notNull(),
  /** Set when the player stopped itself at a material human decision. */
  pausedByDecisionId: text("paused_by_decision_id"),
  pausedReason: text("paused_reason").notNull().default(""),
  catchUpActive: integer("catch_up_active", { mode: "boolean" }).notNull().default(false),
  catchUpIndex: integer("catch_up_index").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});
