/**
 * Decision, execution and agent schema.
 *
 * Lanes 4 and 5 of the work model live here, plus the agent observability
 * tables that the control room reads.
 *
 * The important structural rule: a decision row records the human judgment, an
 * approval row records the authority under which a mutation was permitted, and
 * an execution receipt line records what actually changed in the database. A
 * proposal that was never approved leaves a decision row and no receipt lines,
 * which is exactly what an auditor would want to see.
 */

import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import type { AutonomyLevel, RoleId } from "./core";

/** Authority classification carried by every tool in the system. */
export const AUTHORITY_CLASSES = [
  "READ",
  "DRAFT",
  "PROPOSE",
  "APPROVAL_REQUIRED",
  "POLICY_BOUND_AUTONOMOUS",
  "PROHIBITED",
] as const;

export type AuthorityClass = (typeof AUTHORITY_CLASSES)[number];

export const issues = sqliteTable(
  "issues",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    titleDe: text("title_de").notNull().default(""),
    description: text("description").notNull(),
    /** "control-gap", "supplier-gap", "finding", "resilience-gap" or "obligation-gap". */
    kind: text("kind").notNull(),
    raisedByUserId: text("raised_by_user_id").notNull(),
    raisedOn: text("raised_on").notNull(),
    entityId: text("entity_id").notNull(),
    /** Human owned severity. */
    severity: text("severity").notNull(),
    /** "open", "in-remediation", "closed" or "accepted". */
    status: text("status").notNull(),
    ownerUserId: text("owner_user_id"),
    dueOn: text("due_on"),
    relatedObjectKind: text("related_object_kind"),
    relatedObjectId: text("related_object_id"),
    controlIds: text("control_ids", { mode: "json" }).$type<string[]>().notNull(),
    supplierIds: text("supplier_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** True when this issue was created during this session. */
    createdBySession: integer("created_by_session", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("issues_run_idx").on(table.runId, table.status)],
);

export const actions = sqliteTable(
  "actions",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    titleDe: text("title_de").notNull().default(""),
    description: text("description").notNull(),
    /**
     * "remediation" (Massnahme), "evidence-request", "validation-request",
     * "monitoring", "reassessment", "exercise-action" or "communication".
     */
    kind: text("kind").notNull(),
    issueId: text("issue_id"),
    /** Which role owns follow-up. */
    raisedByRoleId: text("raised_by_role_id").$type<RoleId>(),
    ownerUserId: text("owner_user_id"),
    /** External owner label when the owner is a supplier contact. */
    ownerLabel: text("owner_label").notNull().default(""),
    entityId: text("entity_id").notNull(),
    createdOn: text("created_on").notNull(),
    dueOn: text("due_on"),
    completedOn: text("completed_on"),
    /** "open", "in-progress", "overdue", "completed" or "cancelled". */
    status: text("status").notNull(),
    priority: text("priority").notNull().default("medium"),
    /** True when the action has no assigned owner, which governance surfaces. */
    isUnowned: integer("is_unowned", { mode: "boolean" }).notNull().default(false),
    relatedObjectKind: text("related_object_kind"),
    relatedObjectId: text("related_object_id"),
    /** The decision that created this action, when applicable. */
    sourceDecisionId: text("source_decision_id"),
    createdBySession: integer("created_by_session", { mode: "boolean" }).notNull().default(false),
    progressNote: text("progress_note").notNull().default(""),
    /**
     * The measurable condition that closes the action, as a person agreed it.
     * Null until one is agreed. The agreeing entry is still appended to
     * `action_updates`, so the history shows who agreed it and when; this
     * column is the current value every reader can rely on.
     */
    completionCondition: text("completion_condition"),
    completionConditionBy: text("completion_condition_by"),
    completionConditionAt: text("completion_condition_at"),
    /**
     * The structured blocked state. Set, with the person's statement of what
     * blocks the action, by the entry that records the blocker, and cleared by
     * the entry that lifts it. `status` is left alone, so every reader of the
     * status words is unaffected; a blocked action is still open.
     */
    blockedReason: text("blocked_reason"),
    blockedSince: text("blocked_since"),
    /** Lineage: the meeting, and the confirmed minutes, the action was raised in. */
    sourceMeetingId: text("source_meeting_id"),
    sourceMinutesId: text("source_minutes_id"),
    /** Lineage: the process run and stage the action was raised from. */
    sourceProcessRunId: text("source_process_run_id"),
    sourceStageId: text("source_stage_id"),
    sourceStageRunId: text("source_stage_run_id"),
    /** Lineage: the inbox message the action was converted from. */
    sourceMessageId: text("source_message_id"),
  },
  (table) => [
    index("actions_run_idx").on(table.runId, table.status),
    index("actions_role_idx").on(table.runId, table.raisedByRoleId),
    index("actions_source_meeting_idx").on(table.runId, table.sourceMeetingId),
    index("actions_source_process_idx").on(table.runId, table.sourceProcessRunId),
  ],
);

/**
 * A decision presented to the human, and the judgment they recorded.
 *
 * Decisions are ranked for the morning brief. A decision is never auto
 * resolved: `chosenOptionId` stays null until a person chooses.
 */
export const decisions = sqliteTable(
  "decisions",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    reference: text("reference").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    entityId: text("entity_id").notNull(),
    title: text("title").notNull(),
    titleDe: text("title_de").notNull().default(""),
    /** The professional question, phrased as the practitioner would ask it. */
    question: text("question").notNull(),
    /**
     * The category of judgment, which determines required authority:
     * "materiality", "control-effectiveness", "residual-risk", "severity",
     * "criticality", "applicability", "assurance-conclusion",
     * "conditional-approval", "escalation", "agenda" or "risk-acceptance".
     */
    judgmentKind: text("judgment_kind").notNull(),
    /** Scenario moment at which this decision is presented. */
    presentedAtMoment: text("presented_at_moment").notNull(),
    /** Priority rank for the morning brief. Lower sorts first. */
    priorityRank: integer("priority_rank").notNull(),
    /** Why this matters, in the professional's terms. */
    whyThisMatters: text("why_this_matters").notNull(),
    /** What the AI prepared, cited to evidence. */
    preparedPosition: text("prepared_position").notNull(),
    /** Evidence supporting the prepared position. */
    supportingEvidenceIds: text("supporting_evidence_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** Evidence that opposes it. Never hidden. */
    opposingEvidenceIds: text("opposing_evidence_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** Stated uncertainty, always visible before the human chooses. */
    uncertaintyNote: text("uncertainty_note").notNull(),
    /** Confidence in the prepared position, zero to one. */
    confidence: real("confidence").notNull(),
    /** The authority scope a person needs to take this decision. */
    requiredAuthority: text("required_authority").notNull(),
    /** "open", "decided", "deferred" or "escalated". */
    status: text("status").notNull().default("open"),
    /** The option the human chose. Null while open. */
    chosenOptionId: text("chosen_option_id"),
    /** The rationale the human recorded or confirmed. */
    recordedRationale: text("recorded_rationale").notNull().default(""),
    decidedByUserId: text("decided_by_user_id"),
    decidedAtMoment: text("decided_at_moment"),
    decidedAt: text("decided_at"),
    relatedObjectKind: text("related_object_kind"),
    relatedObjectId: text("related_object_id"),
    /** True when this decision exists because of the 14:05 event. */
    fromSharedEvent: integer("from_shared_event", { mode: "boolean" }).notNull().default(false),
    /** Identifier of the same underlying matter seen by another role. */
    sharedThreadId: text("shared_thread_id"),
    /**
     * By when the judgment is needed, ISO, as the decision's own record states
     * it (migration 0006). Null when the record states no time, and then no
     * time is invented: `deadlineFor` in `src/features/decisions/queue.ts`
     * falls back to a response time on the subject's inbox, and the Home Now
     * card says "No due time recorded". The seed sets it only where the
     * decision text names the moment it must be taken by.
     */
    dueAt: text("due_at"),
    /**
     * The process run and stage this decision belongs to (migration 0007).
     *
     * A stage contract binds a seeded decision by id, so before this column a
     * second run of the same Role App (an event-driven reassessment) could not
     * have judgments of its own: it found the Q4 cycle's. A decision created
     * for a run names the run here, and the stage that waits for it. Null for
     * a decision no process waits on. The seed and the migration link the
     * five Q4 RCSA decisions the RCSA stage contract binds to the Q4 run;
     * `createDecisionForRun` (src/db/repositories/process-decisions.ts) is
     * how a later run gets its own.
     */
    processRunId: text("process_run_id"),
    processStageId: text("process_stage_id"),
  },
  (table) => [
    index("dec_run_role_idx").on(table.runId, table.roleId, table.priorityRank),
    index("dec_thread_idx").on(table.runId, table.sharedThreadId),
    index("dec_status_idx").on(table.runId, table.status),
    index("dec_process_idx").on(table.runId, table.processRunId, table.processStageId),
  ],
);

/**
 * One option on a decision, with its stated consequences.
 *
 * Options carry the downstream consequences explicitly, so the execution
 * receipt is derived from the chosen option rather than improvised by a model.
 */
export const decisionOptions = sqliteTable(
  "decision_options",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    decisionId: text("decision_id").notNull(),
    label: text("label").notNull(),
    labelDe: text("label_de").notNull().default(""),
    description: text("description").notNull(),
    /** True for the option the specialist recommends. Never auto selected. */
    isRecommended: integer("is_recommended", { mode: "boolean" }).notNull().default(false),
    recommendationBasis: text("recommendation_basis").notNull().default(""),
    /** Plain statement of what this option means for the risk position. */
    riskImplication: text("risk_implication").notNull().default(""),
    /**
     * The deterministic consequences of choosing this option, executed by the
     * scenario engine through typed tools after approval.
     */
    consequences: text("consequences", { mode: "json" })
      .$type<Array<{ kind: string; targetId: string; value?: string; note?: string }>>()
      .notNull(),
    /** Whether choosing this option needs a separate approval step. */
    requiresApproval: integer("requires_approval", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [index("decopt_idx").on(table.runId, table.decisionId, table.sortOrder)],
);

/**
 * An approval record. Material state changing tools cannot execute without a
 * row here whose fields satisfy the authority gate.
 */
export const approvals = sqliteTable(
  "approvals",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    /** The decision the approval belongs to, when it belongs to one. */
    decisionId: text("decision_id"),
    /**
     * What the approval is about, whatever kind of object that is: a
     * decision, an action, a meeting, a set of minutes. An approval for a
     * Work Hub change names its object here rather than leaving
     * `decisionId` empty with nothing in its place. When both are set on a
     * request and on the approval, the authority gate refuses an approval
     * whose target is not the request's.
     */
    targetKind: text("target_kind"),
    targetId: text("target_id"),
    /** The tool the approval authorises. */
    toolName: text("tool_name").notNull(),
    authorityClass: text("authority_class").$type<AuthorityClass>().notNull(),
    approvedByUserId: text("approved_by_user_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    /** Authority scopes the approver holds at the time of approval. */
    authorityScope: text("authority_scope", { mode: "json" }).$type<string[]>().notNull(),
    approvedAt: text("approved_at").notNull(),
    approvedAtMoment: text("approved_at_moment").notNull(),
    /** The human must confirm they own the rationale, not merely click accept. */
    rationaleConfirmed: integer("rationale_confirmed", { mode: "boolean" }).notNull(),
    rationale: text("rationale").notNull(),
    /** Autonomy level in force when the approval was granted. */
    autonomyLevel: text("autonomy_level").$type<AutonomyLevel>().notNull(),
    /** Single use: set once the approval has been consumed by an execution. */
    consumedAt: text("consumed_at"),
    /** Payload hash, binding the approval to a specific proposed change. */
    payloadFingerprint: text("payload_fingerprint").notNull(),
  },
  (table) => [
    index("appr_run_idx").on(table.runId, table.decisionId),
    index("appr_target_idx").on(table.runId, table.targetKind, table.targetId),
  ],
);

/** One line of a real execution receipt, written after a mutation succeeds. */
export const executionReceiptLines = sqliteTable(
  "execution_receipt_lines",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    decisionId: text("decision_id").notNull(),
    approvalId: text("approval_id"),
    sortOrder: integer("sort_order").notNull(),
    /** Plain statement of what changed, for example "RCSA version created". */
    statement: text("statement").notNull(),
    statementDe: text("statement_de").notNull().default(""),
    objectKind: text("object_kind").notNull(),
    objectId: text("object_id").notNull(),
    /** "created", "updated", "versioned", "activated" or "sent". */
    changeKind: text("change_kind").notNull(),
    auditEventId: text("audit_event_id"),
    executedAt: text("executed_at").notNull(),
    executedAtMoment: text("executed_at_moment").notNull(),
    reversible: integer("reversible", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("receipt_idx").on(table.runId, table.decisionId, table.sortOrder)],
);

export const committeeItems = sqliteTable(
  "committee_items",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    /** The committee meeting this item belongs to. */
    committeeRef: text("committee_ref").notNull(),
    committeeName: text("committee_name").notNull(),
    meetingDate: text("meeting_date").notNull(),
    entityId: text("entity_id").notNull(),
    title: text("title").notNull(),
    titleDe: text("title_de").notNull().default(""),
    /** "decision", "escalation", "information" or "noting". */
    itemType: text("item_type").notNull(),
    raisedByRoleId: text("raised_by_role_id").$type<RoleId>(),
    summary: text("summary").notNull(),
    /** Agenda position, set by the portfolio lead. */
    agendaPosition: integer("agenda_position"),
    /** True when the portfolio lead has prioritised this item onto the agenda. */
    onAgenda: integer("on_agenda", { mode: "boolean" }).notNull().default(false),
    relatedObjectKind: text("related_object_kind"),
    relatedObjectId: text("related_object_id"),
    sourceDecisionId: text("source_decision_id"),
    createdBySession: integer("created_by_session", { mode: "boolean" }).notNull().default(false),
    /** Cross function theme this item contributes to. */
    themeId: text("theme_id"),
  },
  (table) => [index("comm_run_idx").on(table.runId, table.committeeRef)],
);

/**
 * Monitoring that a human activated. Distinct from seeded monitoring, so the
 * trust page can show what this session actually turned on.
 */
export const monitoringActivations = sqliteTable(
  "monitoring_activations",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    subjectKind: text("subject_kind").notNull(),
    subjectId: text("subject_id").notNull(),
    /** "enhanced-supplier-monitoring", "kri-watch" or "control-surveillance". */
    kind: text("kind").notNull(),
    description: text("description").notNull(),
    activatedByUserId: text("activated_by_user_id").notNull(),
    activatedAtMoment: text("activated_at_moment").notNull(),
    activatedAt: text("activated_at").notNull(),
    reviewFrequency: text("review_frequency").notNull(),
    nextReviewOn: text("next_review_on"),
    sourceDecisionId: text("source_decision_id"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [index("mon_run_idx").on(table.runId, table.subjectId)],
);

/* ==========================================================================
   Agent observability and durable context
   ========================================================================== */

export const agentSessions = sqliteTable(
  "agent_sessions",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    /** One session per user, role and scenario run. */
    userId: text("user_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    createdAt: text("created_at").notNull(),
    lastActiveAt: text("last_active_at").notNull(),
    /** Rolling summary that survives compaction. */
    rollingSummary: text("rolling_summary").notNull().default(""),
    /** Explicit working memory, kept outside the chat history. */
    workingMemory: text("working_memory", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    /** Number of compaction events so far. */
    compactionCount: integer("compaction_count").notNull().default(0),
    lastCompactedAt: text("last_compacted_at"),
    /** Running totals for the cost meter. */
    totalInputTokens: integer("total_input_tokens").notNull().default(0),
    totalOutputTokens: integer("total_output_tokens").notNull().default(0),
    totalCostUsd: real("total_cost_usd").notNull().default(0),
    turnCount: integer("turn_count").notNull().default(0),
  },
  (table) => [index("sess_run_idx").on(table.runId, table.userId, table.roleId)],
);

/** A single turn in a session's conversation history. */
export const agentMessages = sqliteTable(
  "agent_messages",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    sessionId: text("session_id").notNull(),
    sortOrder: integer("sort_order").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull(),
    /** True once this turn has been folded into the rolling summary. */
    compacted: integer("compacted", { mode: "boolean" }).notNull().default(false),
    tokenEstimate: integer("token_estimate").notNull().default(0),
  },
  (table) => [index("agmsg_idx").on(table.runId, table.sessionId, table.sortOrder)],
);

/** One manager or specialist invocation. Read by the control room. */
export const agentRuns = sqliteTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    sessionId: text("session_id").notNull(),
    /** "manager" or the specialist identifier. */
    agentName: text("agent_name").notNull(),
    agentKind: text("agent_kind").notNull(),
    /** Set when this run was delegated by the manager. */
    parentRunId: text("parent_run_id"),
    model: text("model").notNull(),
    /** "live", "safe" or "offline". */
    sourceMode: text("source_mode").notNull(),
    /** True when the output came from cache rather than a live call. */
    fromCache: integer("from_cache", { mode: "boolean" }).notNull().default(false),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    durationMs: integer("duration_ms"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostUsd: real("estimated_cost_usd").notNull().default(0),
    /** "running", "completed", "failed" or "interrupted-for-approval". */
    status: text("status").notNull(),
    /** Short description of the task, no secret content. */
    task: text("task").notNull(),
    /** Structured output schema name, when the run produced one. */
    outputSchema: text("output_schema"),
    errorSummary: text("error_summary"),
    /** True when a guardrail stopped this run. */
    guardrailTriggered: integer("guardrail_triggered", { mode: "boolean" }).notNull().default(false),
    guardrailNote: text("guardrail_note"),
  },
  (table) => [index("agrun_idx").on(table.runId, table.sessionId, table.startedAt)],
);

/** One tool call. Every mutation in the product passes through one of these. */
export const toolCalls = sqliteTable(
  "tool_calls",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    agentRunId: text("agent_run_id"),
    sessionId: text("session_id").notNull(),
    toolName: text("tool_name").notNull(),
    authorityClass: text("authority_class").$type<AuthorityClass>().notNull(),
    requestedAt: text("requested_at").notNull(),
    completedAt: text("completed_at"),
    durationMs: integer("duration_ms"),
    /** Redacted argument summary. Never raw credentials. */
    argumentSummary: text("argument_summary").notNull(),
    /** "executed", "proposed", "blocked" or "failed". */
    outcome: text("outcome").notNull(),
    /** Set when the authority gate refused the call. */
    blockedReason: text("blocked_reason"),
    approvalId: text("approval_id"),
    decisionId: text("decision_id"),
    autonomyLevel: text("autonomy_level").$type<AutonomyLevel>().notNull(),
    resultSummary: text("result_summary").notNull().default(""),
    /** Evidence identifiers the tool returned, for the citation chain. */
    evidenceIds: text("evidence_ids", { mode: "json" }).$type<string[]>().notNull(),
  },
  (table) => [
    index("tool_run_idx").on(table.runId, table.sessionId, table.requestedAt),
    index("tool_outcome_idx").on(table.runId, table.outcome),
  ],
);

/**
 * Cached known good model outputs, keyed by a deterministic beat identifier.
 *
 * Presenter safe mode serves the critical story beats from here so the
 * demonstration has deterministic timing and content.
 */
export const cachedAiOutputs = sqliteTable(
  "cached_ai_outputs",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    /** Stable beat key, for example "brief:rcsa:07:45". */
    beatKey: text("beat_key").notNull(),
    roleId: text("role_id").$type<RoleId>(),
    /** The structured output schema this payload validates against. */
    schemaName: text("schema_name").notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    /** Which model produced it, when it was captured live. */
    capturedFromModel: text("captured_from_model"),
    capturedAt: text("captured_at").notNull(),
    /** True for outputs authored as part of the seed rather than captured. */
    seeded: integer("seeded", { mode: "boolean" }).notNull().default(true),
    /** Simulated latency so safe mode feels like live mode. */
    simulatedLatencyMs: integer("simulated_latency_ms").notNull().default(700),
  },
  (table) => [index("cache_beat_idx").on(table.runId, table.beatKey)],
);

/**
 * Background work the agents completed before the professional arrived.
 *
 * The "What happened in the background?" reveal counts rows in this table. The
 * numbers are therefore derived from seeded actions rather than decorative.
 */
export const backgroundActions = sqliteTable(
  "background_actions",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    roleId: text("role_id").$type<RoleId>().notNull(),
    /**
     * "system-checked", "record-reconciled", "document-classified",
     * "item-requested", "contradiction-identified", "routine-update" or
     * "escalated-to-human".
     */
    kind: text("kind").notNull(),
    /** What the action touched, cited so the count is inspectable. */
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    targetLabel: text("target_label").notNull(),
    description: text("description").notNull(),
    performedAtMoment: text("performed_at_moment").notNull(),
    performedAt: text("performed_at").notNull(),
    /** The authority class under which this was permitted. */
    authorityClass: text("authority_class").$type<AuthorityClass>().notNull(),
    /** True when this action required no human approval by policy. */
    autonomous: integer("autonomous", { mode: "boolean" }).notNull().default(true),
    evidenceIds: text("evidence_ids", { mode: "json" }).$type<string[]>().notNull(),
  },
  (table) => [index("bgact_idx").on(table.runId, table.roleId, table.kind)],
);

/** Cross function themes, used by the portfolio lens. */
export const portfolioThemes = sqliteTable(
  "portfolio_themes",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    title: text("title").notNull(),
    titleDe: text("title_de").notNull().default(""),
    description: text("description").notNull(),
    /** The roles that contribute evidence to this theme. */
    contributingRoleIds: text("contributing_role_ids", { mode: "json" }).$type<RoleId[]>().notNull(),
    /** Decision identifiers that form the single decision thread. */
    decisionIds: text("decision_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** How many separate reports would cover this today. */
    duplicateReportCount: integer("duplicate_report_count").notNull().default(0),
    /** Portfolio materiality, a human decision. */
    materiality: text("materiality"),
    materialityDecidedBy: text("materiality_decided_by"),
    confidence: real("confidence").notNull().default(0.7),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [index("theme_run_idx").on(table.runId, table.sortOrder)],
);
