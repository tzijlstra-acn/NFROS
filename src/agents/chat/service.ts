/**
 * The persistent contextual chat service.
 *
 * The security property this module exists to hold is narrow and absolute: a
 * natural language request must never bypass connector capabilities, role
 * permissions, authority policy, human approval, idempotency, audit or
 * external acknowledgement.
 *
 * It is held structurally rather than by instruction. When the input asks for
 * an action, `detectRequestedTool` maps it to a name in the authority
 * registry and the request goes through `executeTool`, which is the same
 * runtime the agents and the interface use: gate, then handler, then audit,
 * then observability, with no bypass. The refusal the user reads is the
 * gate's own `reason` and the part carries the gate's `denialCode`, so a test
 * can assert that the refusal came from the gate and not from a sentence in a
 * prompt. There is deliberately no privileged path here, and no tool name
 * that this module can reach and the rest of the server cannot.
 *
 * Note the ordering in `postChatTurn`: tool intent is resolved before the text
 * guardrails run. That looks backwards and is deliberate. The guardrails are a
 * hygiene layer that matches patterns in free text, and if they refused first
 * then the product's evidence that the gate works would be a regular
 * expression. Letting the request reach the gate produces a refusal that is
 * attributable to the authority model, which is the thing worth demonstrating.
 *
 * Conversation continuity reuses `src/agents/sessions/session.ts` rather than
 * inventing a second mechanism. The important consequence is that almost
 * nothing the afternoon depends on lives in the transcript: approved
 * decisions, ratings, actions and evidence status are read back as structured
 * state, so compaction can discard old turns without losing the thread.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { chatThreads, chatTurns, workdayLiveEvents, workdayLiveEventReads } from "@/db/schema/live";
import { requireScenarioState } from "@/scenario/engine/state";
import {
  getDecision,
  getDecisions,
  getEvidenceDocuments,
  getRole,
} from "@/db/repositories/workday";
import {
  assembleContext,
  appendMessage,
  compactSession,
  getOrCreateSession,
} from "@/agents/sessions/session";
import { applyInputGuardrails } from "@/agents/guardrails";
import { executeTool, type ToolContext } from "@/agents/tools/runtime";
import { TOOL_REGISTRY } from "@/server/security/authority";
import { getResolvedDemoMode } from "@/server/config/runtime";
import { getOpenAIClient, probeModelAvailability } from "@/server/openai/client";
import { getResolvedModels } from "@/server/config/models";
import { createLogger, redactString } from "@/server/logging/redact";
import { PRODUCT_IDENTITY } from "@/product/release/identity";
import {
  buildWorkdayContext,
  findValidatedSuggestion,
  resolveEvidenceSet,
} from "@/agents/suggestions/generate";
import { computeStateDigest } from "@/agents/suggestions/digest";
import { recordActivity, recordToolCallActivity } from "@/agents/activity/record";
import type { WorkdaySelection } from "@/workday/contracts";
import {
  answerPart,
  blockedPart,
  approvalRequestPart,
  enforceNeutralCopy,
  executionReceiptPart,
  followUpPart,
  normaliseChatCopy,
  partsToPlainText,
  proposedActionPart,
  sourceStatusPart,
  textToParts,
  type ChatTurnPart,
} from "./parts";
import { CHAT_PROMPT, renderChatContext } from "./prompt";
import { matchSeededChatAnswer, seededChatDecline } from "./seeded";

const log = createLogger("workday-chat");
const db = () => getDb();

/** Role to holder. Resolved server side, so a client cannot impersonate. */
const ROLE_HOLDERS: Record<RoleId, string> = {
  tprm: "P-002",
  rcsa: "P-003",
  "control-assurance": "P-004",
  "incident-resilience": "P-005",
  "regulatory-change": "P-006",
  "nfr-governance": "P-001",
};

/* ==========================================================================
   Threads
   ========================================================================== */

export interface ChatTurnView {
  id: string;
  author: "user" | "partner";
  parts: ChatTurnPart[];
  atMoment: string;
  contextObjectId: string;
  source: "live" | "cache" | "seeded";
}

let threadSequence = 0;

function nextThreadId(roleId: RoleId): string {
  threadSequence += 1;
  return `CHT-${roleId}-${Date.now().toString(36).toUpperCase()}-${threadSequence}`;
}

/**
 * Returns the role's open thread, creating one if there is none.
 *
 * One open thread per role rather than per object. The chat has to survive
 * navigation between work objects, and a thread per object would reset the
 * conversation every time the user clicked something, which is the behaviour
 * the persistence requirement exists to prevent. Each turn records the object
 * it was asked about instead, so the thread still reads correctly later.
 */
export function getOrCreateThread(params: {
  roleId: RoleId;
  runId?: string;
  threadId?: string | null;
}): typeof chatThreads.$inferSelect {
  const runId = params.runId ?? DEFAULT_RUN_ID;
  const state = requireScenarioState(runId);

  if (params.threadId) {
    const existing = db().select().from(chatThreads).where(eq(chatThreads.id, params.threadId)).get();
    // A thread from another role or another run is not reachable by naming it.
    if (existing && existing.runId === runId && existing.roleId === params.roleId) return existing;
  }

  const open = db()
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.runId, runId), eq(chatThreads.roleId, params.roleId)))
    .orderBy(desc(chatThreads.lastActiveAtMoment))
    .all()
    .find((row) => row.closedAt === null);
  if (open) return open;

  const id = nextThreadId(params.roleId);
  const now = new Date().toISOString();
  const session = getOrCreateSession(ROLE_HOLDERS[params.roleId], params.roleId, runId);

  db()
    .insert(chatThreads)
    .values({
      id,
      runId,
      roleId: params.roleId,
      title: "",
      startedAtMoment: state.currentMoment,
      lastActiveAtMoment: state.currentMoment,
      agentSessionId: session.id,
      createdAt: now,
      closedAt: null,
    })
    .run();

  const created = db().select().from(chatThreads).where(eq(chatThreads.id, id)).get();
  if (!created) throw new Error(`The chat thread ${id} was not written.`);
  return created;
}

export function getThreadTurns(params: {
  roleId: RoleId;
  threadId: string;
  runId?: string;
}): ChatTurnView[] {
  const runId = params.runId ?? DEFAULT_RUN_ID;
  const thread = db().select().from(chatThreads).where(eq(chatThreads.id, params.threadId)).get();
  if (!thread || thread.runId !== runId || thread.roleId !== params.roleId) return [];

  return db()
    .select()
    .from(chatTurns)
    .where(and(eq(chatTurns.runId, runId), eq(chatTurns.threadId, params.threadId)))
    .orderBy(asc(chatTurns.sequence))
    .all()
    .map((row) => ({
      id: row.id,
      author: row.author,
      parts: row.parts,
      atMoment: row.atMoment,
      contextObjectId: row.contextObjectId,
      source: row.source,
    }));
}

function nextTurnSequence(threadId: string): number {
  const row = db()
    .select({ sequence: chatTurns.sequence })
    .from(chatTurns)
    .where(eq(chatTurns.threadId, threadId))
    .orderBy(desc(chatTurns.sequence))
    .limit(1)
    .get();
  return (row?.sequence ?? 0) + 1;
}

function writeTurn(params: {
  threadId: string;
  runId: string;
  author: "user" | "partner";
  atMoment: string;
  selection: WorkdaySelection | null;
  decisionId: string | null;
  eventId: string | null;
  parts: ChatTurnPart[];
  source: "live" | "cache" | "seeded";
  model: string;
  durationMs: number;
}): typeof chatTurns.$inferSelect {
  const sequence = nextTurnSequence(params.threadId);
  const id = `${params.threadId}-T${String(sequence).padStart(3, "0")}`;

  db()
    .insert(chatTurns)
    .values({
      id,
      threadId: params.threadId,
      runId: params.runId,
      sequence,
      author: params.author,
      atMoment: params.atMoment,
      contextObjectType: params.selection?.objectType ?? "",
      contextObjectId: params.selection?.objectId ?? "",
      contextEventId: params.eventId,
      contextDecisionId: params.decisionId,
      parts: params.parts,
      plainText: partsToPlainText(params.parts),
      source: params.source,
      agentRunId: null,
      model: params.model,
      durationMs: params.durationMs,
      createdAt: new Date().toISOString(),
    })
    .run();

  db()
    .update(chatThreads)
    .set({ lastActiveAtMoment: params.atMoment })
    .where(eq(chatThreads.id, params.threadId))
    .run();

  const written = db().select().from(chatTurns).where(eq(chatTurns.id, id)).get();
  if (!written) throw new Error(`The chat turn ${id} was not written.`);
  return written;
}

/* ==========================================================================
   Tool intent

   Deterministic, keyword based, and mapped onto registry names. This is not
   a classifier and must not become one: its job is to get an action request
   in front of the gate, and a model deciding which tool a sentence means
   would put a model between the user and the authority model.

   A phrase that matches nothing is treated as a question, which is the safe
   default: a question cannot change a record.
   ========================================================================== */

interface ToolIntent {
  toolName: string;
  /** The payload the gate will fingerprint. Derived from the input only. */
  payload: Record<string, unknown>;
  /** What the user appeared to ask for, echoed back in the part. */
  requestSummary: string;
}

const TOOL_INTENTS: Array<{ patterns: RegExp[]; toolName: string }> = [
  /* ---- Prohibited. Present so the refusal is explicit and testable. ---- */
  {
    toolName: "sendExternalEmail",
    patterns: [
      /\b(?:send|email|mail|write)\b[^.?!]{0,50}\b(?:(?:to )?the supplier|(?:to )?novalink|(?:to )?the vendor|externally|outside the bank)\b/i,
      /\bsend\b[^.?!]{0,30}\bexternal\b[^.?!]{0,20}\b(?:email|mail|message|communication)\b/i,
    ],
  },
  {
    toolName: "notifySupervisor",
    patterns: [
      /\b(?:notify|report|inform|contact|file with|tell)\b[^.?!]{0,50}\b(?:finma|bafin|the regulator|the supervisor|the supervisory authority|ecb)\b/i,
      /\b(?:submit|lodge|file)\b[^.?!]{0,30}\b(?:regulatory|supervisory)\s+(?:report|notification)\b/i,
    ],
  },
  {
    toolName: "writeDatabaseDirectly",
    patterns: [
      /\b(?:write|update|insert|delete|run)\b[^.?!]{0,40}\b(?:sql|database|the db|directly in the database)\b/i,
    ],
  },
  {
    toolName: "readLocalSecrets",
    patterns: [
      /\b(?:show|print|reveal|give me|what is|read|display|echo)\b[^.?!]{0,40}\b(?:api key|openai key|the key|secret|credential|token|password|env(?:ironment)? variable)\b/i,
    ],
  },
  {
    toolName: "modifyAuditTrail",
    patterns: [
      /\b(?:delete|remove|edit|alter|modify|clean up|rewrite)\b[^.?!]{0,40}\b(?:audit (?:trail|log|event)|the audit)\b/i,
    ],
  },
  {
    toolName: "approveOwnProposal",
    patterns: [
      /\b(?:approve|authorise|authorize|sign off)\b[^.?!]{0,40}\b(?:it yourself|your own|this yourself|on your own authority|without me)\b/i,
      /\bjust\s+approve\s+(?:it|this)\b/i,
    ],
  },

  /* ---- Material changes. Reach the gate and come back as proposals. ---- */
  {
    toolName: "updateControlRating",
    patterns: [
      /\b(?:change|update|set|record|downgrade|upgrade)\b[^.?!]{0,40}\b(?:control (?:rating|effectiveness)|ctl-pay-014 (?:rating|effectiveness))\b/i,
    ],
  },
  {
    toolName: "setSupplierCriticality",
    patterns: [/\b(?:change|set|update|record)\b[^.?!]{0,40}\bsupplier criticality\b/i],
  },
  {
    toolName: "applySupplierRestriction",
    patterns: [
      /\b(?:restrict|suspend|block|apply a restriction to)\b[^.?!]{0,30}\b(?:the supplier|novalink|tp-0042)\b/i,
    ],
  },
  {
    toolName: "activateMonitoring",
    patterns: [/\b(?:activate|turn on|enable|start)\b[^.?!]{0,30}\b(?:enhanced )?monitoring\b/i],
  },
  {
    toolName: "createAction",
    patterns: [
      /\b(?:create|raise|open|log)\b[^.?!]{0,30}\b(?:an? )?(?:remediation |follow[\s-]?up )?action\b/i,
    ],
  },
  {
    toolName: "createIssue",
    patterns: [/\b(?:create|raise|open|log)\b[^.?!]{0,30}\b(?:an? )?issue\b/i],
  },
  {
    toolName: "escalateIncident",
    patterns: [/\bescalate\b[^.?!]{0,30}\b(?:the )?incident\b/i],
  },
  {
    toolName: "classifyIncident",
    patterns: [/\b(?:classify|set the severity of|record the severity of)\b[^.?!]{0,30}\b(?:the )?incident\b/i],
  },
  {
    toolName: "recordTestConclusion",
    patterns: [
      /\b(?:record|conclude|sign off)\b[^.?!]{0,40}\b(?:the )?(?:assurance )?conclusion\b/i,
    ],
  },
  {
    toolName: "addCommitteeAgendaItem",
    patterns: [/\b(?:add|put)\b[^.?!]{0,30}\b(?:to the )?(?:committee )?agenda\b/i],
  },

  /* ---- Policy bound. Low risk and reversible, still gated. ---- */
  {
    toolName: "requestEvidenceDocument",
    patterns: [
      /\b(?:request|chase|ask for)\b[^.?!]{0,40}\b(?:the )?(?:evidence|document|report|configuration|tenant config)\b/i,
    ],
  },
  {
    toolName: "requestFactualValidation",
    patterns: [
      /\b(?:ask|request)\b[^.?!]{0,40}\b(?:first line|the control owner|payment operations)\b[^.?!]{0,30}\b(?:to confirm|to validate|for confirmation)\b/i,
    ],
  },
];

/** Resolves an action request onto a registry tool, or null for a question. */
export function detectRequestedTool(input: string): ToolIntent | null {
  for (const candidate of TOOL_INTENTS) {
    const matched = candidate.patterns.find((pattern) => pattern.test(input));
    if (!matched) continue;
    return {
      toolName: candidate.toolName,
      /*
       * The payload carries only the request text and nothing the model or
       * the browser invented. The gate fingerprints it, so an approval a
       * person grants is bound to this exact request rather than to a tool
       * name that could later be reused with different arguments.
       */
      payload: { requestedVia: "workday-chat", request: input.slice(0, 400) },
      requestSummary: input.slice(0, 200),
    };
  }
  return null;
}

/* ==========================================================================
   Posting a turn
   ========================================================================== */

export interface PostChatTurnRequest {
  roleId: RoleId;
  threadId?: string | null;
  input: string;
  selection?: WorkdaySelection | null;
  runId?: string;
}

export interface PostChatTurnResult {
  threadId: string;
  turn: {
    id: string;
    author: "partner";
    parts: ChatTurnPart[];
    source: "live" | "cache" | "seeded";
    atMoment: string;
  };
  blocked?: string;
  details?: { model: string; durationMs: number };
}

export async function postChatTurn(request: PostChatTurnRequest): Promise<PostChatTurnResult> {
  const runId = request.runId ?? DEFAULT_RUN_ID;
  const startedMs = Date.now();
  const state = requireScenarioState(runId);

  const thread = getOrCreateThread({
    roleId: request.roleId,
    runId,
    threadId: request.threadId ?? null,
  });

  const selection = request.selection ?? null;
  const context = buildWorkdayContext({
    roleId: request.roleId,
    runId,
    ...(selection ? { objectType: selection.objectType, objectId: selection.objectId } : {}),
  });
  const language = context.language;
  const mode = getResolvedDemoMode().mode;

  const openDecisions = getDecisions(request.roleId, context.viewedMoment, runId).filter(
    (entry) => entry.decision.status === "open",
  );
  const decisionId =
    openDecisions.find(
      (entry) => selection !== null && entry.decision.relatedObjectId === selection.objectId,
    )?.decision.id ?? null;

  /* ---- The user turn is recorded before anything is attempted ---- */
  writeTurn({
    threadId: thread.id,
    runId,
    author: "user",
    atMoment: state.currentMoment,
    selection,
    decisionId,
    eventId: null,
    parts: [answerPart(normaliseChatCopy(request.input))],
    source: "seeded",
    model: "",
    durationMs: 0,
  });

  const session = getOrCreateSession(ROLE_HOLDERS[request.roleId], request.roleId, runId);
  appendMessage(session.id, "user", request.input, runId);

  const toolContext: ToolContext = {
    runId,
    roleId: request.roleId,
    // Read from the run. A client that claims a higher level changes nothing.
    autonomyLevel: state.autonomyLevel,
    actingUserId: ROLE_HOLDERS[request.roleId],
    atMoment: state.currentMoment,
    sessionId: session.id,
    actorKind: "manager-agent",
    language,
  };

  /* ---- An action request goes to the gate, not to a prompt ---- */
  const intent = detectRequestedTool(request.input);
  if (intent !== null) {
    const parts = await runGatedAction({
      intent,
      toolContext,
      language,
      selection,
      suggestionHeadline: null,
    });

    const turn = writeTurn({
      threadId: thread.id,
      runId,
      author: "partner",
      atMoment: state.currentMoment,
      selection,
      decisionId,
      eventId: null,
      parts: parts.parts,
      source: "seeded",
      model: "",
      durationMs: Date.now() - startedMs,
    });

    appendMessage(session.id, "assistant", partsToPlainText(parts.parts), runId);

    const result: PostChatTurnResult = {
      threadId: thread.id,
      turn: {
        id: turn.id,
        author: "partner",
        parts: turn.parts,
        source: turn.source,
        atMoment: turn.atMoment,
      },
    };
    if (parts.blocked !== null) result.blocked = parts.blocked;
    return result;
  }

  /* ---- Text hygiene, for questions rather than actions ---- */
  const guardrail = applyInputGuardrails(request.input);
  if (!guardrail.allowed) {
    const parts = [
      blockedPart({
        text: guardrail.message,
        toolName: "",
        denialCode: "input-guardrail",
      }),
    ];
    const turn = writeTurn({
      threadId: thread.id,
      runId,
      author: "partner",
      atMoment: state.currentMoment,
      selection,
      decisionId,
      eventId: null,
      parts,
      source: "seeded",
      model: "",
      durationMs: Date.now() - startedMs,
    });

    return {
      threadId: thread.id,
      turn: {
        id: turn.id,
        author: "partner",
        parts: turn.parts,
        source: turn.source,
        atMoment: turn.atMoment,
      },
      blocked: guardrail.reason,
    };
  }

  /* ---- Answer the question ---- */
  const answer = await produceAnswer({
    request,
    runId,
    context,
    openDecisions: openDecisions.map((entry) => ({
      id: entry.decision.id,
      title: entry.decision.title,
      judgmentKind: entry.decision.judgmentKind,
      requiredAuthority: entry.decision.requiredAuthority,
    })),
    sessionId: session.id,
    mode,
  });

  const neutral = enforceNeutralCopy(answer.parts, language);
  if (neutral.replaced > 0) {
    log.warn("Chat copy named processing metadata and was replaced.", {
      replaced: neutral.replaced,
    });
  }

  const turn = writeTurn({
    threadId: thread.id,
    runId,
    author: "partner",
    atMoment: state.currentMoment,
    selection,
    decisionId,
    eventId: null,
    parts: neutral.parts,
    source: answer.source,
    model: answer.model,
    durationMs: Date.now() - startedMs,
  });

  appendMessage(session.id, "assistant", partsToPlainText(neutral.parts), runId);
  compactSession(session.id, request.roleId, runId);

  recordActivity({
    runId,
    roleId: request.roleId,
    atMoment: state.currentMoment,
    kind: "analysed",
    label: "Answered a question in the work partner chat",
    labelDe: "Eine Frage im Arbeitspartner-Chat beantwortet",
    detail: `Assembled context server side from the scenario run and answered from ${answer.source} content. ${context.evidenceIds.length} evidence document(s) were in scope.`,
    objectType: selection?.objectType ?? "",
    objectId: selection?.objectId ?? "",
    durationMs: Date.now() - startedMs,
    outcome: answer.source,
    authorityClass: "READ",
    evidenceIds: context.evidenceIds.slice(0, 12),
  });

  const result: PostChatTurnResult = {
    threadId: thread.id,
    turn: {
      id: turn.id,
      author: "partner",
      parts: turn.parts,
      source: turn.source,
      atMoment: turn.atMoment,
    },
  };

  /*
   * `details` is separated from the turn on purpose.
   *
   * The workday interface is neutral. Model and duration are available only
   * inside this object, which the interface shows behind an explicit
   * disclosure, and never inside the parts a reader sees by default.
   */
  if (answer.model.length > 0) {
    result.details = { model: answer.model, durationMs: Date.now() - startedMs };
  }
  return result;
}

/* ==========================================================================
   The gated action path
   ========================================================================== */

/**
 * Runs an action request through the existing tool runtime.
 *
 * Four outcomes, four part kinds, and none of them is written by this
 * function's own judgment about whether the action was reasonable:
 *
 *   blocked   the gate refused. The part carries the gate's denial code.
 *   proposed  the gate held it for approval. The part is an approval request
 *             bound to the payload fingerprint the gate computed.
 *   executed  something really changed. The part is a receipt carrying the
 *             audit event identifier the runtime wrote.
 *   failed    the handler threw. Reported as a failure, never as a success.
 */
async function runGatedAction(params: {
  intent: ToolIntent;
  toolContext: ToolContext;
  language: "en" | "de";
  selection: WorkdaySelection | null;
  suggestionHeadline: string | null;
}): Promise<{ parts: ChatTurnPart[]; blocked: string | null }> {
  const { intent, toolContext, language } = params;
  const tool = TOOL_REGISTRY[intent.toolName];

  const result = await executeTool(intent.toolName, intent.payload, toolContext, null);

  recordToolCallActivity({
    runId: toolContext.runId,
    roleId: toolContext.roleId,
    atMoment: toolContext.atMoment,
    result,
    label: `Chat requested ${intent.toolName} and the authority gate decided`,
    labelDe: `Chat forderte ${intent.toolName} an, die Berechtigungspruefung entschied`,
    detail: result.summary,
    objectType: params.selection?.objectType ?? "",
    objectId: params.selection?.objectId ?? "",
  });

  const parts: ChatTurnPart[] = [];

  if (result.outcome === "blocked") {
    parts.push(
      answerPart(
        language === "de"
          ? "Diese Anforderung wurde nicht ausgefuehrt. Die Entscheidung traf die deterministische Berechtigungspruefung, nicht ich."
          : "That request was not carried out. The decision was made by the deterministic authority gate rather than by me.",
      ),
    );
    parts.push(
      blockedPart({
        text: result.summary,
        toolName: intent.toolName,
        denialCode: result.denialCode ?? "blocked",
        authorityClass: tool?.authorityClass ?? "",
      }),
    );
    parts.push(
      answerPart(
        language === "de"
          ? "Was ich stattdessen tun kann: den Sachverhalt belegt aufbereiten, die betroffenen Datensaetze nennen und eine Empfehlung mit Alternativen vorlegen, die eine benannte Person entscheidet."
          : "What I can do instead: set out the matter with its citations, name the records involved, and prepare a recommendation with alternatives for a named person to decide.",
      ),
    );
    return { parts, blocked: result.denialCode ?? "blocked" };
  }

  if (result.outcome === "proposed" && result.proposedAction) {
    const proposal = result.proposedAction;
    parts.push(
      answerPart(
        language === "de"
          ? "Ich habe die Aenderung vorbereitet und nicht ausgefuehrt. Sie veraendert einen Datensatz und erfordert daher die Genehmigung einer benannten Person."
          : "I have prepared the change and not carried it out. It alters a record, so it requires an approval from a named person.",
      ),
    );
    parts.push(
      proposedActionPart({
        text: proposal.description,
        toolName: proposal.toolName,
        authorityClass: tool?.authorityClass ?? "",
        payloadFingerprint: proposal.payloadFingerprint,
        reversible: proposal.reversible,
        material: proposal.material,
      }),
    );
    parts.push(
      approvalRequestPart({
        text:
          language === "de"
            ? "Genehmigen Sie diese vorbereitete Aenderung, nachdem Sie die Begruendung als Ihre eigene bestaetigt haben. Die Genehmigung ist einmalig und an genau diese Nutzlast gebunden."
            : "Approve this prepared change once you have confirmed the rationale as your own. The approval is single use and bound to this exact payload.",
        toolName: proposal.toolName,
        requiredScopes: proposal.requiredScopes,
        payloadFingerprint: proposal.payloadFingerprint,
      }),
    );
    parts.push(
      sourceStatusPart({
        state: "prepared-locally",
        sourceSystem: PRODUCT_IDENTITY.name,
        detail:
          language === "de"
            ? "Nichts wurde an ein Zielsystem gesendet."
            : "Nothing has been sent to a target system.",
        language,
      }),
    );
    return { parts, blocked: null };
  }

  if (result.outcome === "executed") {
    parts.push(
      answerPart(
        language === "de"
          ? "Die Aktion wurde ausgefuehrt und im Pruefpfad erfasst."
          : "The action executed and was recorded in the audit trail.",
      ),
    );
    for (const statement of result.receiptStatements ?? [result.summary]) {
      parts.push(
        executionReceiptPart({
          text: statement,
          toolName: intent.toolName,
          auditEventId: result.auditEventId ?? null,
        }),
      );
    }
    parts.push(
      sourceStatusPart({
        state: "read-from-source",
        sourceSystem: PRODUCT_IDENTITY.name,
        detail:
          language === "de"
            ? "Die Aenderung ist lokal erfasst. Eine externe Bestaetigung liegt nur vor, wenn ein Zielsystem sie quittiert hat."
            : "The change is recorded locally. An external acknowledgement exists only where a target system has confirmed it.",
        language,
      }),
    );
    return { parts, blocked: null };
  }

  parts.push(
    answerPart(
      language === "de"
        ? "Die Aktion ist fehlgeschlagen und hat nichts veraendert."
        : "The action failed and changed nothing.",
    ),
  );
  parts.push(
    sourceStatusPart({
      state: "failed-externally",
      sourceSystem: PRODUCT_IDENTITY.name,
      detail: result.summary,
      language,
    }),
  );
  return { parts, blocked: "failed" };
}

/* ==========================================================================
   Answering a question
   ========================================================================== */

async function produceAnswer(params: {
  request: PostChatTurnRequest;
  runId: string;
  context: ReturnType<typeof buildWorkdayContext>;
  openDecisions: Array<{ id: string; title: string; judgmentKind: string; requiredAuthority: string }>;
  sessionId: string;
  mode: "live" | "safe" | "offline";
}): Promise<{ parts: ChatTurnPart[]; source: "live" | "cache" | "seeded"; model: string }> {
  const { context, request, runId } = params;
  const language = context.language;
  const role = getRole(request.roleId, runId);

  /* ---- Live, when the mode permits it and a client exists ---- */
  let liveFailure: string | null = null;
  /*
   * Presenter safe mode attempts a live answer here, which looks inconsistent
   * with the suggestion path and is not. The rule the product already holds
   * to is that safe mode serves the scripted critical beats from cache and
   * may answer an optional free question live. A typed chat question is
   * exactly that optional free question, so withholding the live path here
   * would make safe mode less capable than it is entitled to be. Offline
   * makes no network call at all.
   */
  if (params.mode !== "offline") {
    const live = await attemptLiveAnswer({
      context,
      request,
      runId,
      openDecisions: params.openDecisions,
      sessionId: params.sessionId,
    });
    if ("parts" in live) return { parts: live.parts, source: "live", model: live.model };
    liveFailure = live.error;
  }

  /* ---- A prepared, cited answer for a question the day provokes ---- */
  const seeded = matchSeededChatAnswer(request.input, request.roleId);
  if (seeded) {
    const parts = language === "de" ? [...seeded.de] : [...seeded.en];

    /*
     * The suggestion currently on screen is appended as context rather than
     * restated, so the chat and the card cannot disagree about what was
     * prepared for this object.
     */
    const selection = request.selection ?? null;
    if (selection) {
      const digestRow = findValidatedSuggestionForSelection(request.roleId, selection, runId);
      if (digestRow) {
        parts.push(
          followUpPart(
            language === "de"
              ? `Der Vorschlag zu ${selection.objectId} auf Ihrem Bildschirm sagt: ${digestRow}`
              : `The suggestion on screen for ${selection.objectId} says: ${digestRow}`,
          ),
        );
      }
    }

    // Authored content, so the label is "seeded" rather than "cache". The
    // cache label is reserved for a row that genuinely came out of
    // `cached_ai_outputs`, and blurring the two would make the provenance
    // indicator in the interface meaningless.
    return { parts, source: "seeded", model: "" };
  }

  /* ---- The decline ---- */
  return {
    parts: seededChatDecline({
      language,
      mode: params.mode,
      input: request.input,
      roleTitle: role?.title ?? request.roleId,
      liveFailureReason: liveFailure,
    }),
    source: "seeded",
    model: "",
  };
}

/** The headline of the validated suggestion for the current selection. */
function findValidatedSuggestionForSelection(
  roleId: RoleId,
  selection: WorkdaySelection,
  runId: string,
): string | null {
  const state = requireScenarioState(runId);
  const evidenceIds = resolveEvidenceSet({
    roleId,
    runId,
    viewedMoment: state.currentMoment,
    objectType: selection.objectType,
    objectId: selection.objectId,
  });
  if (evidenceIds.length === 0) return null;

  // Reuses the digest so the chat finds exactly the card the panel shows.
  const row = findValidatedSuggestion(
    computeDigestForSelection({
      roleId,
      selection,
      state,
      evidenceIds,
    }),
    runId,
  );
  return row?.headline ?? null;
}

function computeDigestForSelection(params: {
  roleId: RoleId;
  selection: WorkdaySelection;
  state: ReturnType<typeof requireScenarioState>;
  evidenceIds: string[];
}): string {
  /*
   * The digest is computed by the one function that defines it.
   *
   * Reimplementing the hash here would make the chat look up a key the
   * generator never wrote, and the two would drift apart silently: the chat
   * would simply stop finding the card on screen, with no error anywhere.
   */
  return computeStateDigest({
    roleId: params.roleId,
    objectType: params.selection.objectType,
    objectId: params.selection.objectId,
    eventId: null,
    viewedMoment: params.state.currentMoment,
    autonomyLevel: params.state.autonomyLevel,
    worldView: params.state.worldView,
    language: params.state.language,
    evidenceIds: params.evidenceIds,
  });
}

/**
 * One live chat turn.
 *
 * Correct by construction and provably falling back, because no usable
 * credential exists in this environment. Every failure returns an error and
 * the caller moves on to the prepared answer.
 */
async function attemptLiveAnswer(params: {
  context: ReturnType<typeof buildWorkdayContext>;
  request: PostChatTurnRequest;
  runId: string;
  openDecisions: Array<{ id: string; title: string; judgmentKind: string; requiredAuthority: string }>;
  sessionId: string;
}): Promise<{ parts: ChatTurnPart[]; model: string } | { error: string }> {
  const client = getOpenAIClient();
  if (client === null) return { error: "Live calls are not permitted in the current mode." };

  const { context, request, runId } = params;

  try {
    await probeModelAvailability();
    const models = getResolvedModels();

    const evidence = getEvidenceDocuments(context.evidenceIds, runId).map((document) => ({
      id: document.id,
      reference: document.reference,
      title: document.title,
      status: document.status,
      isStale: document.isStale,
    }));

    const unreadEvents = readUnreadEvents(request.roleId, runId, context.viewedMoment);

    const recentDecisions = context.recentDecisionIds
      .map((id) => getDecision(id, runId))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .map((entry) => ({
        id: entry.decision.id,
        title: entry.decision.title,
        chosen: entry.decision.chosenOptionId ?? "not recorded",
        rationale: entry.decision.recordedRationale,
      }));

    // The session machinery supplies the rolling summary and the recent turns
    // within the context budget. No second mechanism is invented here.
    const assembled = assembleContext(params.sessionId, request.roleId, runId);

    const response = await client.responses.create({
      model: models.primary,
      instructions: CHAT_PROMPT,
      input: [
        renderChatContext(context, {
          selectionLabel: request.selection?.label ?? null,
          openDecisions: params.openDecisions,
          unreadEvents,
          evidence,
          recentDecisions,
          activeSuggestionHeadline: null,
          sourceStatus: [],
          conversationState: [
            assembled.system,
            assembled.transcript.map((turn) => `${turn.role}: ${turn.content}`).join("\n"),
          ]
            .filter((value) => value.length > 0)
            .join("\n\n")
            .slice(0, 8_000),
        }),
        "",
        `Question from the ${context.roleTitle}: ${request.input}`,
      ].join("\n"),
      max_output_tokens: 1_600,
    });

    const text = response.output_text;
    if (typeof text !== "string" || text.trim().length === 0) {
      return { error: "The model returned no content." };
    }

    const parts = textToParts(text);
    if (parts.length === 0) return { error: "The model output contained no usable parts." };

    return { parts, model: models.primary };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Unknown error";
    // Redacted, because a rejected key is echoed back in a masked form that
    // still discloses its tail and its length, and this reaches the browser.
    return { error: redactString(raw) };
  }
}

/** Live events visible to the role and not yet read. */
function readUnreadEvents(
  roleId: RoleId,
  runId: string,
  viewedMoment: string,
): Array<{ id: string; atMoment: string; title: string; severity: string }> {
  const events = db()
    .select()
    .from(workdayLiveEvents)
    .where(eq(workdayLiveEvents.runId, runId))
    .orderBy(asc(workdayLiveEvents.sortOrder))
    .all()
    .filter(
      (row) =>
        (row.roleIds.length === 0 || row.roleIds.includes(roleId)) && row.atMoment <= viewedMoment,
    );
  if (events.length === 0) return [];

  const reads = new Set(
    db()
      .select()
      .from(workdayLiveEventReads)
      .where(and(eq(workdayLiveEventReads.runId, runId), eq(workdayLiveEventReads.roleId, roleId)))
      .all()
      .filter((row) => row.readAt !== null)
      .map((row) => row.eventId),
  );

  return events
    .filter((row) => !reads.has(row.id))
    .map((row) => ({
      id: row.id,
      atMoment: row.atMoment,
      title: row.title,
      severity: row.severity,
    }));
}
