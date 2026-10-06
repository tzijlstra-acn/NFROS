/**
 * ToolExecution: lifecycle step 10, execute governed tools.
 *
 * Two channels, both governed by the same authority gate:
 *
 *   local    `executeTool` in the tool runtime: gate, handler, audit row,
 *            tool call record. The approval is consumed on use.
 *
 *   outbox   `dispatchCommand` in the integration runtime: the command is
 *            written to `integration_commands` before anything is sent, the
 *            gate runs, the connector is attempted, and only an
 *            acknowledgement produces a receipt. This is the only way the
 *            process engine changes an external system.
 *
 * Idempotency. A local tool that executed is never executed again for the
 * same stage run. An outbox command carries the key `stage-tool:<stage run>:
 * <tool>`, so a duplicate submission finds the same command row: if it was
 * acknowledged, nothing is sent; if it is still queued or failed, the same
 * command is attempted again under the approval already granted.
 */

import { getSqlite } from "@/db/client";
import { ensureStageTask, updateStageTask } from "@/db/repositories/role-app-runtime";
import { evaluateAuthority, fingerprintPayload, TOOL_REGISTRY } from "@/server/security/authority";
import { executeTool } from "@/agents/tools/runtime";
import "@/agents/tools/mutations";
import { dispatchCommand } from "@/integrations/runtime/IntegrationRuntime";
import { publishOsEvent } from "@/features/events/backbone";
import { ApprovalRefused, grantStageApproval } from "./approvals";
import { done, guardOpenStage, processOf, refused, stageToolContextFor, subjectOf, toolContextFor, type CommandResult } from "./common";
import { findTask, parseTaskOutput, type ToolTaskOutput } from "./derive";
import { eventKey, outboxKey, taskKey } from "./keys";
import { getPayloadBuilder } from "./registry";
import type { StageContext, ToolTaskState } from "./types";

export interface ExecuteToolInput {
  toolKey: string;
  rationale: string;
  rationaleConfirmed: boolean;
}

/** Whether a tool needs a person's approval at the current autonomy level. */
export function toolNeedsApproval(context: StageContext, toolName: string): { needed: boolean; refusal: string | null } {
  const decision = evaluateAuthority({
    toolName,
    roleId: context.roleId,
    autonomyLevel: context.state.autonomyLevel,
    payload: {},
    approval: null,
    actingUserId: context.actingUserId,
  });
  if (decision.allowed) return { needed: false, refusal: null };
  if (decision.code === "approval-missing") return { needed: true, refusal: null };
  return { needed: true, refusal: decision.reason };
}

/**
 * Executes every proposed tool of the stage, in contract order, under one
 * confirmation.
 *
 * One confirmation, one approval per tool. Each approval is bound to its own
 * payload, exactly as the decision engine grants one approval per declared
 * consequence: approving the condition action does not silently authorise the
 * external command that travels with it. The context is rebuilt between
 * tools, so a later payload can cite what an earlier tool created.
 */
export async function executeProposedTools(
  rebuild: () => StageContext,
  input: { rationale: string; rationaleConfirmed: boolean },
): Promise<CommandResult> {
  let context = rebuild();
  const pending = context.stage.tools.filter((spec) => {
    const state = context.tools.find((tool) => tool.key === spec.key);
    return state !== undefined && !state.satisfied && state.state !== "not-applicable";
  });
  if (pending.length === 0) {
    return done({ en: "There is nothing to execute.", de: "Es gibt nichts auszufuehren." }, true);
  }

  const messages: CommandResult[] = [];
  for (const spec of pending) {
    const result = await executeStageTool(context, { toolKey: spec.key, ...input });
    messages.push(result);
    if (!result.ok) {
      return refused(result.message, messages.map((message) => message.message));
    }
    context = rebuild();
  }
  return done(
    { en: `${pending.length} change(s) executed under your approval.`, de: `${pending.length} Aenderung(en) mit Ihrer Genehmigung ausgefuehrt.` },
  );
}

export async function executeStageTool(context: StageContext, input: ExecuteToolInput): Promise<CommandResult> {
  const guard = guardOpenStage(context, { requirePreparation: true });
  if (guard) return guard;
  const stageRun = context.stageRun;
  if (!stageRun) return refused({ en: "This stage has not been opened yet.", de: "Diese Stufe wurde noch nicht geoeffnet." });

  const spec = context.stage.tools.find((tool) => tool.key === input.toolKey);
  const state = context.tools.find((tool) => tool.key === input.toolKey);
  if (!spec || !state) {
    return refused({ en: `There is no tool ${input.toolKey} on this stage.`, de: `Diese Stufe hat kein Werkzeug ${input.toolKey}.` });
  }
  if (state.satisfied) {
    return done({ en: `${spec.label.en} is already done. Nothing was sent again.`, de: `${spec.label.de} ist bereits erledigt. Es wurde nichts erneut gesendet.` }, true);
  }
  if (state.state === "not-applicable") {
    return refused({
      en: `${spec.label.en} does not apply until the decision it depends on is recorded.`,
      de: `${spec.label.de} gilt erst, wenn die zugrunde liegende Entscheidung erfasst ist.`,
    });
  }

  const tool = TOOL_REGISTRY[spec.toolName];
  if (!tool) return refused({ en: `${spec.toolName} is not a registered tool.`, de: `${spec.toolName} ist kein registriertes Werkzeug.` });

  const builder = getPayloadBuilder(spec.payloadBuilder);
  if (!builder) return refused({ en: "This tool is not available in this build.", de: "Dieses Werkzeug ist in diesem Build nicht verfuegbar." });
  const built = builder(context);
  if ("unavailable" in built) return refused(built.unavailable);

  const authority = toolNeedsApproval(context, spec.toolName);
  if (authority.refusal) {
    return refused({ en: authority.refusal, de: authority.refusal });
  }

  /*
   * A retry of a queued or failed outbox command reuses the approval already
   * granted for it. The dispatcher does not consume outbox approvals, for the
   * reason its own comment gives: a transport failure does not make a
   * recorded judgment provisional.
   */
  const previous = parseTaskOutput<ToolTaskOutput>(findTask(context.tasks, taskKey.tool(spec.key)));
  let approvalId: string | null = spec.channel === "outbox" ? (previous?.approvalId ?? null) : null;
  if (authority.needed && approvalId === null) {
    try {
      approvalId = grantStageApproval({
        context,
        toolName: spec.toolName,
        payload: built.payload,
        rationale: input.rationale,
        rationaleConfirmed: input.rationaleConfirmed,
        decisionId: built.decisionId ?? null,
        subject: built.intentStatement,
      }).approvalId;
    } catch (error) {
      if (error instanceof ApprovalRefused) return refused(error.reason);
      throw error;
    }
  }

  let output: ToolTaskOutput;
  const executedAt = new Date().toISOString();

  if (spec.channel === "local") {
    const result = await executeTool(spec.toolName, built.payload, stageToolContextFor(context), approvalId);
    const outcome: ToolTaskState =
      result.outcome === "executed" ? "executed" : result.outcome === "proposed" ? "blocked" : result.outcome === "blocked" ? "blocked" : "failed";
    output = {
      outcome,
      summary: result.summary,
      auditEventId: result.auditEventId ?? null,
      receiptStatements: result.receiptStatements ?? [],
      commandId: null,
      receiptId: null,
      externalId: null,
      approvalId,
      payloadFingerprint: fingerprintPayload(spec.toolName, built.payload),
      executedAt,
      resultData: result.data ?? null,
    };
  } else {
    if (!spec.connectorInstanceId || !spec.targetExternalType) {
      return refused({ en: "The external target of this tool is not configured.", de: "Das externe Ziel dieses Werkzeugs ist nicht eingerichtet." });
    }
    const result = await dispatchCommand(
      {
        runId: context.runId,
        connectorInstanceId: spec.connectorInstanceId,
        commandKind: spec.toolName,
        toolName: spec.toolName,
        actingUserId: context.actingUserId,
        roleId: context.roleId,
        actorKind: "human",
        autonomyLevel: context.state.autonomyLevel,
        approvalId,
        decisionId: built.decisionId ?? null,
        sourceCanonicalType: built.sourceCanonicalType,
        sourceCanonicalId: built.sourceCanonicalId,
        targetExternalType: spec.targetExternalType,
        targetExternalId: built.targetExternalId ?? null,
        payload: built.payload,
        intentStatement: built.intentStatement.en,
        atMoment: context.state.currentMoment,
        language: context.state.language,
        idempotencyKey: outboxKey(stageRun.id, spec.key),
      },
      { attemptPolicy: "single" },
    );
    const outcome: ToolTaskState = result.acknowledged
      ? "acknowledged"
      : result.blocked
        ? "blocked"
        : result.deadLettered
          ? "failed"
          : "queued";
    output = {
      outcome,
      summary: result.message,
      auditEventId: result.auditEventId,
      receiptStatements: [],
      commandId: result.commandId,
      receiptId: result.receiptId,
      externalId: result.externalId,
      approvalId,
      payloadFingerprint: fingerprintPayload(spec.toolName, built.payload),
      executedAt,
    };
  }

  getSqlite().transaction(() => {
    const { task } = ensureStageTask({
      id: `TASK-${stageRun.id}-tool-${spec.key}`,
      runId: context.runId,
      stageRunId: stageRun.id,
      taskKey: taskKey.tool(spec.key),
      taskKind: "tool-execution",
      label: spec.label.en,
      status: "pending",
      requiredForCompletion: true,
      createdAt: executedAt,
    });
    const succeeded = output.outcome === "executed" || output.outcome === "acknowledged" || output.outcome === "queued";
    updateStageTask(task.id, {
      status: output.outcome === "executed" || output.outcome === "acknowledged" ? "completed" : succeeded ? "in-progress" : "failed",
      completedAt: output.outcome === "executed" || output.outcome === "acknowledged" ? executedAt : null,
      completedByUserId: context.actingUserId,
      approvalId,
      statusReason: output.summary,
      output: JSON.stringify(output),
    });

    if (succeeded) {
      publishOsEvent({
        runId: context.runId,
        type: "tool-executed",
        roleId: context.roleId,
        atMoment: context.state.currentMoment,
        actorKind: "human",
        actorUserId: context.actingUserId,
        subject: subjectOf(context),
        process: processOf(context),
        correlationId: stageRun.id,
        summary: {
          en: spec.channel === "outbox" ? `${spec.label.en}: the command entered the outbox. ${output.summary}` : `${spec.label.en}: ${output.summary}`,
          de: spec.channel === "outbox" ? `${spec.label.de}: der Befehl liegt im Postausgang.` : `${spec.label.de}: ausgefuehrt.`,
        },
        payload: { toolKey: spec.key, toolName: spec.toolName, channel: spec.channel, outcome: output.outcome, commandId: output.commandId },
        idempotencyKey: eventKey.toolExecuted(stageRun.id, spec.key),
        auditEventId: spec.channel === "local" ? output.auditEventId : null,
      });
    }

    if (output.outcome === "acknowledged" && output.commandId) {
      publishOsEvent({
        runId: context.runId,
        type: "external-command-acknowledged",
        roleId: context.roleId,
        atMoment: context.state.currentMoment,
        actorKind: "connector",
        actorUserId: null,
        subject: subjectOf(context),
        process: processOf(context),
        correlationId: stageRun.id,
        summary: {
          en: `${built.intentStatement.en} Confirmed by the target system as ${output.externalId ?? "a new record"}.`,
          de: `${built.intentStatement.de} Vom Zielsystem als ${output.externalId ?? "neuer Datensatz"} bestaetigt.`,
        },
        payload: { toolKey: spec.key, commandId: output.commandId, receiptId: output.receiptId, externalId: output.externalId },
        idempotencyKey: eventKey.commandAcknowledged(output.commandId),
        auditEventId: output.auditEventId,
      });
    }
  })();

  if (output.outcome === "acknowledged" || output.outcome === "executed") {
    return done({ en: `${spec.label.en}: done.`, de: `${spec.label.de}: erledigt.` });
  }
  if (output.outcome === "queued") {
    return {
      ok: true,
      message: {
        en: `${spec.label.en} is in the outbox. It will be delivered when the target system confirms it.`,
        de: `${spec.label.de} liegt im Postausgang und wird zugestellt, sobald das Zielsystem bestaetigt.`,
      },
    };
  }
  return refused({ en: output.summary, de: output.summary });
}
