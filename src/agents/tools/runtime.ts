/**
 * The tool runtime.
 *
 * Every tool call in the product passes through `executeTool`. The sequence is
 * fixed and there is no bypass:
 *
 *   authority gate  ->  handler  ->  audit event  ->  observability record
 *
 * A denial short circuits before the handler runs and still writes an audit
 * event, so a refusal is evidence rather than silence.
 *
 * The model receives the result of this function, never a database handle.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { approvals as approvalsTable, toolCalls } from "@/db/schema/decisions";
import type { AutonomyLevel, RoleId } from "@/db/schema/core";
import {
  evaluateAuthority,
  fingerprintPayload,
  TOOL_REGISTRY,
  type ApprovalContext,
  type AuthorityDenialCode,
  type ToolDefinition,
} from "@/server/security/authority";
import { recordAuditEvent, recordBlockedAttempt } from "@/server/security/audit";
import { createLogger } from "@/server/logging/redact";

const log = createLogger("tool-runtime");

/** Ambient context for a tool call. Assembled server side, never client sent. */
export interface ToolContext {
  runId: string;
  roleId: RoleId;
  autonomyLevel: AutonomyLevel;
  actingUserId: string;
  /** Current scenario clock, for example "11:45". */
  atMoment: string;
  sessionId: string;
  /** "human", "manager-agent" or "specialist-agent". */
  actorKind: string;
  /** Set when the call belongs to a specific agent run. */
  agentRunId?: string | null;
  language: "en" | "de";
  /**
   * The object the call is about, when the caller names one. Passed to the
   * gate with the approval, which refuses an approval granted for another
   * object (`approval-target-mismatch`).
   */
  target?: { kind: string; id: string } | null;
}

/** What a handler returns. */
export interface ToolHandlerResult {
  /** Short human readable summary written to the audit event. */
  summary: string;
  /** Data returned to the caller. Must be JSON serialisable. */
  data: unknown;
  /** Evidence identifiers supporting the result, for the citation chain. */
  evidenceIds?: string[];
  /** Object the call concerned, for audit. */
  objectKind?: string;
  objectId?: string;
  /** Receipt lines, when the tool performed a material change. */
  receiptStatements?: string[];
}

export type ToolHandler = (
  payload: Record<string, unknown>,
  context: ToolContext,
) => ToolHandlerResult | Promise<ToolHandlerResult>;

/** Registered handlers, populated by the tool modules. */
const handlers = new Map<string, ToolHandler>();

/**
 * Registers a handler for a tool that already exists in the registry.
 *
 * Registering a handler for an unknown tool throws at module load rather than
 * at call time, so a typo cannot create an ungoverned tool.
 */
export function registerToolHandler(toolName: string, handler: ToolHandler): void {
  if (!TOOL_REGISTRY[toolName]) {
    throw new Error(
      `Cannot register a handler for "${toolName}" because it is not in the authority registry.`,
    );
  }
  if (handlers.has(toolName)) {
    throw new Error(`A handler for "${toolName}" is already registered.`);
  }
  handlers.set(toolName, handler);
}

export function hasToolHandler(toolName: string): boolean {
  return handlers.has(toolName);
}

export function registeredToolNames(): string[] {
  return Array.from(handlers.keys()).sort();
}

export type ToolOutcome = "executed" | "proposed" | "blocked" | "failed";

export interface ToolCallResult {
  toolName: string;
  outcome: ToolOutcome;
  /** Present when the call executed. */
  data?: unknown;
  summary: string;
  evidenceIds: string[];
  /** Present when the call was refused or needs approval. */
  denialCode?: AuthorityDenialCode;
  /** Set when the action is available but awaiting a human approval. */
  proposedAction?: {
    toolName: string;
    description: string;
    payload: Record<string, unknown>;
    /** The approval the human must grant to allow execution. */
    payloadFingerprint: string;
    requiredScopes: readonly string[];
    reversible: boolean;
    material: boolean;
  };
  auditEventId?: string;
  receiptStatements?: string[];
  durationMs: number;
}

let callSequence = 0;

function nextToolCallId(): string {
  callSequence += 1;
  return `TCL-${Date.now().toString(36)}-${callSequence.toString().padStart(4, "0")}`;
}

/** Loads an approval row and converts it to a gate context. */
function loadApproval(runId: string, approvalId: string): ApprovalContext | null {
  const row = getDb()
    .select()
    .from(approvalsTable)
    .where(eq(approvalsTable.id, approvalId))
    .get();

  if (!row || row.runId !== runId) return null;

  return {
    approvedBy: row.approvedByUserId,
    decisionId: row.decisionId ?? "",
    approvedAt: row.approvedAt,
    rationaleConfirmed: row.rationaleConfirmed,
    role: row.roleId,
    authorityScope: row.authorityScope,
    payloadFingerprint: row.payloadFingerprint,
    consumedAt: row.consumedAt,
    target: row.targetKind && row.targetId ? { kind: row.targetKind, id: row.targetId } : null,
  };
}

/** Marks an approval as used, so it cannot authorise a second change. */
function consumeApproval(approvalId: string): void {
  getDb()
    .update(approvalsTable)
    .set({ consumedAt: new Date().toISOString() })
    .where(eq(approvalsTable.id, approvalId))
    .run();
}

function writeToolCallRecord(params: {
  id: string;
  context: ToolContext;
  tool: ToolDefinition | null;
  toolName: string;
  outcome: ToolOutcome;
  startedAt: string;
  durationMs: number;
  argumentSummary: string;
  resultSummary: string;
  evidenceIds: string[];
  blockedReason?: string | null;
  approvalId?: string | null;
  decisionId?: string | null;
}): void {
  getDb()
    .insert(toolCalls)
    .values({
      id: params.id,
      runId: params.context.runId,
      agentRunId: params.context.agentRunId ?? null,
      sessionId: params.context.sessionId,
      toolName: params.toolName,
      authorityClass: params.tool?.authorityClass ?? "PROHIBITED",
      requestedAt: params.startedAt,
      completedAt: new Date().toISOString(),
      durationMs: params.durationMs,
      argumentSummary: params.argumentSummary,
      outcome: params.outcome,
      blockedReason: params.blockedReason ?? null,
      approvalId: params.approvalId ?? null,
      decisionId: params.decisionId ?? null,
      autonomyLevel: params.context.autonomyLevel,
      resultSummary: params.resultSummary,
      evidenceIds: params.evidenceIds,
    })
    .run();
}

/**
 * Produces a short, non sensitive summary of the arguments for the audit
 * record. Long free text is truncated; nothing is stored verbatim beyond a
 * bounded length.
 */
function summariseArguments(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) continue;
    let rendered: string;
    if (typeof value === "string") {
      rendered = value.length > 60 ? `${value.slice(0, 57)}...` : value;
    } else if (Array.isArray(value)) {
      rendered = `${value.length} items`;
    } else if (typeof value === "object") {
      rendered = "object";
    } else {
      rendered = String(value);
    }
    parts.push(`${key}=${rendered}`);
  }
  return parts.length > 0 ? parts.join("; ") : "no arguments";
}

/**
 * Executes a tool under the authority gate.
 *
 * `approvalId` is supplied only when a person has already approved this exact
 * payload. Without it, a material tool returns a proposed action.
 */
export async function executeTool(
  toolName: string,
  payload: Record<string, unknown>,
  context: ToolContext,
  approvalId?: string | null,
): Promise<ToolCallResult> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const callId = nextToolCallId();
  const argumentSummary = summariseArguments(payload);

  const approval = approvalId ? loadApproval(context.runId, approvalId) : null;

  const decision = evaluateAuthority({
    toolName,
    roleId: context.roleId,
    autonomyLevel: context.autonomyLevel,
    payload,
    approval,
    actingUserId: context.actingUserId,
    target: context.target ?? null,
  });

  /* ---- Denied ---- */
  if (!decision.allowed) {
    const durationMs = Date.now() - startedMs;
    const tool = decision.tool;

    // "approval-missing" is not a failure. It is the system working: the
    // action is returned as a proposal for a person to approve.
    const isProposal = decision.code === "approval-missing" && tool !== null;
    const outcome: ToolOutcome = isProposal ? "proposed" : "blocked";

    const auditEventId = isProposal
      ? recordAuditEvent({
          runId: context.runId,
          atMoment: context.atMoment,
          category: "tool-call",
          action: toolName,
          objectKind: "proposed-action",
          objectId: toolName,
          summary: `Action prepared and held for human approval: ${tool?.description ?? toolName}`,
          actorUserId: context.actingUserId,
          actorKind: context.actorKind,
          roleId: context.roleId,
          authorityClass: tool?.authorityClass ?? null,
          reversible: true,
          detail: { arguments: argumentSummary, fingerprint: decision.fingerprint },
        })
      : recordBlockedAttempt({
          runId: context.runId,
          atMoment: context.atMoment,
          toolName,
          reason: decision.reason,
          code: decision.code,
          roleId: context.roleId,
          actorUserId: context.actingUserId,
          actorKind: context.actorKind,
          authorityClass: tool?.authorityClass ?? null,
        });

    writeToolCallRecord({
      id: callId,
      context,
      tool,
      toolName,
      outcome,
      startedAt,
      durationMs,
      argumentSummary,
      resultSummary: decision.reason,
      evidenceIds: [],
      blockedReason: isProposal ? null : `${decision.code}: ${decision.reason}`,
      approvalId,
    });

    log.info("Tool call not executed.", { toolName, outcome, code: decision.code });

    const result: ToolCallResult = {
      toolName,
      outcome,
      summary: decision.reason,
      evidenceIds: [],
      denialCode: decision.code,
      auditEventId,
      durationMs,
    };

    if (isProposal && tool) {
      result.proposedAction = {
        toolName,
        description: tool.description,
        payload,
        payloadFingerprint: decision.fingerprint,
        requiredScopes: tool.requiredScopes,
        reversible: tool.reversible,
        material: tool.material,
      };
    }

    return result;
  }

  /* ---- Allowed ---- */
  const handler = handlers.get(toolName);
  if (!handler) {
    const durationMs = Date.now() - startedMs;
    const reason = `The tool "${toolName}" is permitted but has no handler registered in this build.`;
    writeToolCallRecord({
      id: callId,
      context,
      tool: decision.tool,
      toolName,
      outcome: "failed",
      startedAt,
      durationMs,
      argumentSummary,
      resultSummary: reason,
      evidenceIds: [],
      blockedReason: reason,
      approvalId,
    });
    return { toolName, outcome: "failed", summary: reason, evidenceIds: [], durationMs };
  }

  try {
    const handlerResult = await handler(payload, context);
    const durationMs = Date.now() - startedMs;
    const tool = decision.tool;

    // A material change consumes its approval, preventing replay.
    if (decision.requiresApproval && approvalId) consumeApproval(approvalId);

    const auditEventId = recordAuditEvent({
      runId: context.runId,
      atMoment: context.atMoment,
      category: tool.mutates ? "mutation" : "tool-call",
      action: toolName,
      objectKind: handlerResult.objectKind ?? "tool",
      objectId: handlerResult.objectId ?? toolName,
      summary: handlerResult.summary,
      actorUserId: context.actingUserId,
      actorKind: context.actorKind,
      roleId: context.roleId,
      authorityClass: tool.authorityClass,
      approvalId: approvalId ?? null,
      reversible: tool.reversible,
      detail: { arguments: argumentSummary },
    });

    writeToolCallRecord({
      id: callId,
      context,
      tool,
      toolName,
      outcome: "executed",
      startedAt,
      durationMs,
      argumentSummary,
      resultSummary: handlerResult.summary,
      evidenceIds: handlerResult.evidenceIds ?? [],
      approvalId,
    });

    return {
      toolName,
      outcome: "executed",
      data: handlerResult.data,
      summary: handlerResult.summary,
      evidenceIds: handlerResult.evidenceIds ?? [],
      auditEventId,
      receiptStatements: handlerResult.receiptStatements,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startedMs;
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("Tool handler failed.", { toolName, error });

    writeToolCallRecord({
      id: callId,
      context,
      tool: decision.tool,
      toolName,
      outcome: "failed",
      startedAt,
      durationMs,
      argumentSummary,
      resultSummary: `The tool failed: ${message}`,
      evidenceIds: [],
      blockedReason: message,
      approvalId,
    });

    return {
      toolName,
      outcome: "failed",
      summary: `The tool failed: ${message}`,
      evidenceIds: [],
      durationMs,
    };
  }
}
