/**
 * AI Partner schema (migration 0006, plan section 4.11 and Wave 3).
 *
 * Six tables, each the record behind one behaviour of the AI Partner that
 * until now had nowhere to be written:
 *
 *   ai_routine_runs, ai_routine_run_outputs
 *       what a routine run did and which objects it produced. The Home
 *       Partner update states routine work only from these rows (audit T01:
 *       the hard coded Partner Pulse), and the dock's activity links each
 *       statement to what the run created.
 *   ai_suggestion_dispositions
 *       the history of what the person did with a suggestion. The current
 *       value is `ai_suggestions.disposition`.
 *   ai_feedback
 *       structured feedback on one AI output, linked to the configuration,
 *       prompt version and model profile that produced it.
 *   partner_contexts
 *       the durable working context, kept outside the chat transcript, so the
 *       Partner survives navigation and a selection updates it.
 *   notifications
 *       the notification budget's ledger: what was raised, when, and whether
 *       it was read.
 *
 * Every table carries `runId` and is cleared by `demo:reset`, because every
 * row refers to work in the scenario run (a suggestion, a message, a decision,
 * a stage). Nothing here is an account of an event: the event itself stays on
 * the backbone (`os_events`), and rows here reference it by id.
 */

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { RoleId } from "./core";
import type { SuggestionDisposition } from "./live";
import type { FreshnessState } from "./integration";

/* ==========================================================================
   Routine runs
   ========================================================================== */

/** The run's own state. The durable job behind it, when there is one, keeps its own. */
export const ROUTINE_RUN_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const;
export type RoutineRunStatus = (typeof ROUTINE_RUN_STATUSES)[number];

/**
 * What the run amounted to, set when it completes.
 *
 * `no-change` is a real outcome and is recorded: a routine that checked and
 * found nothing ran, and saying so is how Home avoids implying work that did
 * not happen. It is also never a notification (plan 4.11: do not notify for
 * every background check).
 */
export const ROUTINE_RUN_OUTCOMES = [
  "created-work",
  "updated-work",
  "no-change",
  "needs-human",
  "failed",
] as const;
export type RoutineRunOutcome = (typeof ROUTINE_RUN_OUTCOMES)[number];

/** What fired the run. Mirrors `ai_routines.trigger_type`, plus a person starting it. */
export const ROUTINE_TRIGGER_KINDS = ["schedule", "event", "before-meeting", "after-meeting", "manual"] as const;
export type RoutineTriggerKind = (typeof ROUTINE_TRIGGER_KINDS)[number];

/**
 * One run of one AI routine (`ai_routines`).
 *
 * Serves the Home Partner update ("Prepared the challenge workshop brief at
 * 07:15", linked to what it prepared) and the routine lineage the Wave 3 exit
 * criteria ask for. `idempotency_key` is unique per run, so a routine fired
 * twice for the same trigger finds its first run instead of preparing twice
 * (Wave 3 exit criterion: no duplicate request). When the run completes, the
 * runner publishes `routine-completed` on the backbone and stores the event id
 * here; Updates reads that event, Home reads this row.
 */
export const aiRoutineRuns = sqliteTable(
  "ai_routine_runs",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    routineId: text("routine_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    triggerKind: text("trigger_kind").$type<RoutineTriggerKind>().notNull(),
    /** The meeting, event or object that fired it, when one did. */
    triggerRef: text("trigger_ref"),
    status: text("status").$type<RoutineRunStatus>().notNull(),
    /** Null until the run completes or fails. */
    outcome: text("outcome").$type<RoutineRunOutcome>(),
    /** One plain sentence for Home, in both languages. Empty until the run completes. */
    summary: text("summary").notNull().default(""),
    summaryDe: text("summary_de").notNull().default(""),
    /** "live" | "safe" | "offline", the AI mode the run prepared in. */
    mode: text("mode").$type<"live" | "safe" | "offline">().notNull(),
    /** The released AI configuration it ran under, from `src/ai/prompt-registry.ts`. */
    configurationId: text("configuration_id"),
    /** The durable background job that executed it, when it ran as one. */
    jobId: text("job_id"),
    /** The `routine-completed` backbone event, once published. */
    osEventId: text("os_event_id"),
    /** Scenario clock, for example "07:15". */
    atMoment: text("at_moment").notNull(),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    /** Redacted failure reason. Never a credential, never raw model output. */
    errorRedacted: text("error_redacted"),
    /** One trigger, one run. */
    idempotencyKey: text("idempotency_key").notNull(),
  },
  (table) => [
    uniqueIndex("arr_idempotency_unq").on(table.runId, table.idempotencyKey),
    index("arr_role_idx").on(table.runId, table.roleId, table.startedAt),
    index("arr_routine_idx").on(table.runId, table.routineId, table.startedAt),
  ],
);

export const ROUTINE_OUTPUT_EFFECTS = ["created", "updated"] as const;
export type RoutineOutputEffect = (typeof ROUTINE_OUTPUT_EFFECTS)[number];

/**
 * An object a routine run produced or changed.
 *
 * The lineage behind every Partner update statement about routine work: the
 * statement links to the first output and lists the rest. Indexed by object
 * as well, so a Work item, an action or a meeting preparation can answer
 * "which run prepared this?".
 */
export const aiRoutineRunOutputs = sqliteTable(
  "ai_routine_run_outputs",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    routineRunId: text("routine_run_id").notNull(),
    /** For example "action", "meeting-preparation", "inbox-message", "artifact". */
    objectKind: text("object_kind").notNull(),
    objectId: text("object_id").notNull(),
    effect: text("effect").$type<RoutineOutputEffect>().notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("arro_output_unq").on(table.routineRunId, table.objectKind, table.objectId),
    index("arro_object_idx").on(table.runId, table.objectKind, table.objectId),
  ],
);

/* ==========================================================================
   Suggestion dispositions
   ========================================================================== */

/**
 * One change of a suggestion's disposition (plan 4.11: record user disposition).
 *
 * Append only. Serves the dock (what you did with this suggestion and when),
 * Role App performance (7.3: AI suggestion acceptance, modification and
 * rejection, as aggregates) and AI quality (7.5: user rejection and
 * modification). `sequence` counts per suggestion and is unique with it, so
 * two writers recording at once cannot both become the same step.
 *
 * `modification` holds what the person changed when the disposition is
 * `modified`: the fields, their prepared value and the person's value. It is
 * the person's edit, recorded because it is the most useful signal the
 * product has about where its preparation was wrong.
 */
export const aiSuggestionDispositions = sqliteTable(
  "ai_suggestion_dispositions",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    suggestionId: text("suggestion_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    sequence: integer("sequence").notNull(),
    fromDisposition: text("from_disposition").$type<SuggestionDisposition>().notNull(),
    toDisposition: text("to_disposition").$type<SuggestionDisposition>().notNull(),
    actorKind: text("actor_kind").$type<"human" | "system">().notNull(),
    /** The person. Null for a system change such as expiry. */
    actorUserId: text("actor_user_id"),
    at: text("at").notNull(),
    atMoment: text("at_moment").notNull(),
    modification: text("modification", { mode: "json" }).$type<{
      summary: string;
      fields: Array<{ field: string; prepared: string; recorded: string }>;
    }>(),
    /** The person's reason, for a rejection or a modification. */
    reason: text("reason").notNull().default(""),
    /** What the answer led to, for example "decision" / "DEC-2026-0771" or "tool-call" / an id. */
    resultKind: text("result_kind"),
    resultId: text("result_id"),
  },
  (table) => [
    uniqueIndex("asd_sequence_unq").on(table.suggestionId, table.sequence),
    index("asd_run_role_idx").on(table.runId, table.roleId, table.at),
  ],
);

/* ==========================================================================
   AI feedback
   ========================================================================== */

/** The six kinds of feedback the Partner offers (plan 4.11), in its order. */
export const AI_FEEDBACK_KINDS = [
  "useful",
  "not-useful",
  "wrong-source",
  "wrong-interpretation",
  "missing-context",
  "too-verbose",
] as const;
export type AIFeedbackKind = (typeof AI_FEEDBACK_KINDS)[number];

/**
 * The AI outputs feedback can be given on.
 *
 * A suggestion card, a Partner chat answer (`chat_turns`), a stage
 * preparation artifact (`role_app_artifacts`) and a routine run's statement.
 */
export const AI_FEEDBACK_TARGET_KINDS = ["suggestion", "chat-turn", "stage-preparation", "routine-run"] as const;
export type AIFeedbackTargetKind = (typeof AI_FEEDBACK_TARGET_KINDS)[number];

/**
 * Structured feedback on one AI output.
 *
 * Serves the Partner's feedback control and, through `product_feedback_id`,
 * the Product Owner Console's feedback inbox (Wave 3 exit criterion: feedback
 * reaches the product owner). The configuration, prompt version and model
 * profile are copied from the output at the time feedback is given, because
 * the code registry moves on and the question "which configuration was this
 * about" must still have an answer after a release. The sources are the
 * evidence or source keys the output rested on.
 *
 * One row per person, output and kind: giving the same feedback twice finds
 * the first row.
 */
export const aiFeedback = sqliteTable(
  "ai_feedback",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    userId: text("user_id").notNull(),
    kind: text("kind").$type<AIFeedbackKind>().notNull(),
    targetKind: text("target_kind").$type<AIFeedbackTargetKind>().notNull(),
    targetId: text("target_id").notNull(),
    /** For example "stage-preparation", "suggestion", "chat-answer", "meeting-preparation". */
    taskKind: text("task_kind").notNull(),
    configurationId: text("configuration_id"),
    promptVersion: text("prompt_version"),
    modelProfileId: text("model_profile_id"),
    /** Evidence ids or source keys the output cited. */
    sourceRefs: text("source_refs", { mode: "json" }).$type<string[]>().notNull(),
    /** Set when the output belongs to a process stage, so feedback links to the Role App stage. */
    processRunId: text("process_run_id"),
    stageId: text("stage_id"),
    /** An optional short note in the person's words. Structured kind first; the note is never the record. */
    comment: text("comment").notNull().default(""),
    atMoment: text("at_moment").notNull(),
    createdAt: text("created_at").notNull(),
    /** The product feedback item this was forwarded to, once triaged into the inbox. */
    productFeedbackId: text("product_feedback_id"),
  },
  (table) => [
    uniqueIndex("aif_once_unq").on(table.runId, table.userId, table.targetKind, table.targetId, table.kind),
    index("aif_target_idx").on(table.runId, table.targetKind, table.targetId),
    index("aif_config_idx").on(table.configurationId, table.kind),
  ],
);

/* ==========================================================================
   Partner context
   ========================================================================== */

/** The freshness of one source the context rests on. */
export interface PartnerSourceFreshness {
  /** A stage source key, a connector instance or an evidence document. */
  sourceKey: string;
  connectorInstanceId: string | null;
  state: FreshnessState | "unavailable";
  /** ISO time the source was last read, when known. */
  asOf: string | null;
}

/** A record the person edited that the Partner should treat as theirs, not its own. */
export interface PartnerUserEdit {
  objectKind: string;
  objectId: string;
  /** The version the person produced, for a versioned record such as minutes. */
  version: number | null;
  at: string;
}

/**
 * The AI Partner's durable working context for one person in one role.
 *
 * Plan 4.11, persistent context: role, legal entity, selected object, active
 * process and stage, current meeting, open action, inbox item, decision,
 * source freshness, prior human decisions and user edits, stored outside the
 * chat transcript. Serves the dock (it opens on the context the person left)
 * and every Partner answer, which reads its context from here rather than
 * reconstructing it from the transcript. One row per person and role,
 * replaced on each selection; `version` rises with every write.
 *
 * The lists hold references only. A decision, an edit or a source is read
 * from its own table when the Partner needs its content.
 */
export const partnerContexts = sqliteTable(
  "partner_contexts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    userId: text("user_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    legalEntityId: text("legal_entity_id"),
    selectedObjectKind: text("selected_object_kind"),
    selectedObjectId: text("selected_object_id"),
    processRunId: text("process_run_id"),
    stageId: text("stage_id"),
    meetingId: text("meeting_id"),
    actionId: text("action_id"),
    inboxMessageId: text("inbox_message_id"),
    decisionId: text("decision_id"),
    /** The Partner chat thread the context belongs to, when one is open. */
    chatThreadId: text("chat_thread_id"),
    sourceFreshness: text("source_freshness", { mode: "json" }).$type<PartnerSourceFreshness[]>().notNull(),
    /** Decisions the person recorded that bear on the current context. */
    priorDecisionIds: text("prior_decision_ids", { mode: "json" }).$type<string[]>().notNull(),
    userEdits: text("user_edits", { mode: "json" }).$type<PartnerUserEdit[]>().notNull(),
    version: integer("version").notNull().default(1),
    updatedAt: text("updated_at").notNull(),
    updatedAtMoment: text("updated_at_moment").notNull(),
  },
  (table) => [uniqueIndex("pctx_person_role_unq").on(table.runId, table.userId, table.roleId)],
);

/* ==========================================================================
   Notifications
   ========================================================================== */

/**
 * The six material categories, in the budget's priority order.
 *
 * Kept equal to `UPDATE_CATEGORIES` in `src/features/updates/types.ts` by a
 * unit test, so the ledger and the Updates panel can never disagree about
 * what a category is.
 */
export const NOTIFICATION_CATEGORIES = [
  "execution-failed",
  "process-blocked",
  "human-input-required",
  "deadline-approaching",
  "material-change",
  "routine-created-work",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/**
 * Where a notification was raised from. Matches `UpdateOrigin` in
 * `src/features/updates/types.ts`.
 */
export const NOTIFICATION_SOURCE_KINDS = ["backbone", "live-event", "action-register"] as const;
export type NotificationSourceKind = (typeof NOTIFICATION_SOURCE_KINDS)[number];

/**
 * The notification budget's ledger (plan 4.11: proactive updates stay within
 * a notification budget).
 *
 * os-shell's Updates panel computes the budget on each read and persists
 * nothing but the read mark of a seeded arrival. The proactive Partner needs
 * more: what it raised, when, and whether the person read it, so that a thing
 * already raised is not raised again and the budget can hold across a day.
 * One row per role and thing (`dedupe_key`, the Updates item key), written the
 * first time it is raised or held back.
 *
 * Read state, without a second account of it:
 *   - for a `live-event` source the read mark stays in
 *     `workday_live_event_reads`, which os-shell's mark-as-read already
 *     writes; `read_at` here stays null and the repository's list joins the
 *     existing mark;
 *   - for a `backbone` source (for example a routine's new work) `read_at` is
 *     the read mark.
 * A state (a task, a decision, a held preparation) is never marked read: it
 * clears when its work is done, and `settled_at` records when it did.
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    /** The person it was raised to. Null means the role's holder. */
    userId: text("user_id"),
    category: text("category").$type<NotificationCategory>().notNull(),
    /** The Updates item key: one notification per thing. */
    dedupeKey: text("dedupe_key").notNull(),
    sourceKind: text("source_kind").$type<NotificationSourceKind>().notNull(),
    /** The backbone event, arrival or action it was raised from. */
    sourceId: text("source_id").notNull(),
    subjectKind: text("subject_kind"),
    subjectId: text("subject_id"),
    /** "raised" counts against the budget; "held-back" is listed behind the disclosure. */
    budgetOutcome: text("budget_outcome").$type<"raised" | "held-back">().notNull(),
    heldBackReason: text("held_back_reason"),
    raisedAt: text("raised_at").notNull(),
    raisedAtMoment: text("raised_at_moment").notNull(),
    readAt: text("read_at"),
    readByUserId: text("read_by_user_id"),
    /** When the state that raised it cleared, and the backbone event that cleared it. */
    settledAt: text("settled_at"),
    settledByEventId: text("settled_by_event_id"),
  },
  (table) => [
    uniqueIndex("ntf_thing_unq").on(table.runId, table.roleId, table.dedupeKey),
    index("ntf_role_raised_idx").on(table.runId, table.roleId, table.raisedAt),
  ],
);
