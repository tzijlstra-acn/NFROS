/**
 * The outbound pipeline.
 *
 * Ten steps, in this order:
 *
 *   1. begin as a proposed command
 *   2. pass the authority gate
 *   3. receive approval where required
 *   4. enter the outbox
 *   5. execute through the target connector
 *   6. receive an acknowledgement
 *   7. persist an external receipt
 *   8. update the local projection
 *   9. create an audit event
 *  10. appear in the activity stream
 *
 * Two properties of this module are worth stating because a naive reading
 * suggests otherwise.
 *
 * First, step two calls `evaluateAuthority` from
 * `src/server/security/authority.ts`. It does not reimplement any part of it,
 * and there is no separate authority path for integration actions. An external
 * write is the highest consequence action this product can take, so if it had
 * its own gate then the gate the trust page documents would no longer be the
 * gate that matters. The tool name on the command is a real registry entry and
 * the fingerprint is the registry's own fingerprint over the same payload.
 *
 * Second, nothing between steps five and seven marks the change complete. The
 * connector either returns a `ConnectorAcknowledgement` or throws. On a throw,
 * the command is failed or dead lettered, no receipt row is written, and the
 * human decision behind it is left exactly as it was. The optimistic version
 * of this, writing the receipt when the request was sent, is what makes an
 * integration layer lie, and it is the specific thing the schema comment on
 * `external_execution_receipts` forbids.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { integrationCommands } from "@/db/schema/integration";
import { approvals as approvalsTable } from "@/db/schema/decisions";
import { aiActivityEntries } from "@/db/schema/live";
import type { AutonomyLevel, RoleId } from "@/db/schema/core";
import {
  evaluateAuthority,
  fingerprintPayload,
  TOOL_REGISTRY,
  type ApprovalContext,
} from "@/server/security/authority";
import { recordAuditEvent, recordBlockedAttempt } from "@/server/security/audit";
import { createLogger } from "@/server/logging/redact";
import {
  createConnectorContext,
  noJitter,
  systemClock,
  type IntegrationClock,
  type JitterSource,
} from "@/integrations/core/ConnectorContext";
import { declaresCapability, type ConnectorAcknowledgement } from "@/integrations/core/Connector";
import {
  isOperableMode,
  requireConnectorInstance,
  resolveConnector,
} from "@/integrations/core/ConnectorRegistry";
import { ConnectorError, toConnectorError } from "@/integrations/core/errors";
import { digestPayload, upsertExternalReference } from "@/integrations/mappings/CanonicalMapper";
import { writeReceiptFromAcknowledgement } from "@/integrations/receipts/ExternalExecutionReceipt";
import { canonicalTypeForObjectKind, ensureSyncState } from "./SyncCoordinator";
import { enterDeadLetter, resolveDeadLetter } from "./DeadLetterStore";
import {
  buildIdempotencyKey,
  findCommandById,
  isAlreadyAcknowledged,
  reserveCommand,
  type CommandRow,
} from "./IdempotencyStore";
import {
  enqueue,
  markAcknowledged,
  markExecuting,
  markFailed,
  requeueFromDeadLetter,
} from "./Outbox";
import { DEFAULT_RETRY_POLICY, runAttempt, shouldRetry, type RetryPolicy } from "./RetryPolicy";
import { isWritePaused } from "./WritePause";

const log = createLogger("integration-outbound");

/* ==========================================================================
   Input and result
   ========================================================================== */

export interface DispatchCommandInput {
  runId: string;
  connectorInstanceId: string;
  /** For example "updateAssessment" or "createAction". Free text, for display. */
  commandKind: string;
  /** A real entry in TOOL_REGISTRY. The gate refuses anything else. */
  toolName: string;
  actingUserId: string;
  roleId: RoleId;
  /** "human", "manager-agent", "specialist-agent" or "system". */
  actorKind: string;
  autonomyLevel: AutonomyLevel;
  approvalId?: string | null;
  decisionId?: string | null;
  sourceCanonicalType: string;
  sourceCanonicalId: string;
  targetExternalType: string;
  targetExternalId?: string | null;
  expectedVersion?: string | null;
  payload: Record<string, unknown>;
  /** Plain language, shown to the approver and used in the receipt. */
  intentStatement: string;
  atMoment: string;
  sequence?: number;
  language?: "en" | "de";
  /** Provided only to keep a replay of the same change on the same key. */
  idempotencyKey?: string;
  correlationId?: string;
  traceId?: string;
}

export interface DispatchOptions {
  clock?: IntegrationClock;
  jitter?: JitterSource;
  retry?: RetryPolicy;
  signal?: AbortSignal;
  /**
   * `exhaust` attempts until success or the attempt bound, computing and
   * persisting the backoff schedule without blocking on it. `single` makes one
   * attempt and leaves the command due at its scheduled time, which is what
   * the outbox drain and the manual retry button use.
   */
  attemptPolicy?: "single" | "exhaust";
}

export type DispatchStepName =
  | "propose-command"
  | "authority-gate"
  | "receive-approval"
  | "enter-outbox"
  | "execute-through-connector"
  | "receive-acknowledgement"
  | "persist-external-receipt"
  | "update-local-projection"
  | "create-audit-event"
  | "append-activity-stream";

export interface DispatchStep {
  step: number;
  name: DispatchStepName;
  outcome: "ok" | "skipped" | "stopped" | "failed";
  detail: string;
}

export interface DispatchResult {
  commandId: string | null;
  status: string;
  /** False when an identical command already existed. The replay guarantee. */
  created: boolean;
  acknowledged: boolean;
  receiptId: string | null;
  externalId: string | null;
  attempts: number;
  blocked: boolean;
  denialCode: string | null;
  deadLettered: boolean;
  auditEventId: string | null;
  /** Plain language. Shown wherever the command is shown. */
  message: string;
  steps: DispatchStep[];
}

let commandSequence = 0;
let activitySequence = 0;

function nextCommandId(clock: IntegrationClock): string {
  commandSequence += 1;
  return `ICM-${clock.nowMs().toString(36).toUpperCase()}-${String(commandSequence).padStart(5, "0")}`;
}

function nextActivityId(clock: IntegrationClock): string {
  activitySequence += 1;
  return `AAE-INT-${clock.nowMs().toString(36).toUpperCase()}-${String(activitySequence).padStart(4, "0")}`;
}

/** Loads an approval row and converts it to the shape the gate expects. */
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
  };
}

/* ==========================================================================
   The pipeline
   ========================================================================== */

/**
 * Proposes, authorises, queues and attempts one external change.
 *
 * Returns rather than throws for every expected outcome. A refused command, a
 * queued command and a dead lettered command are all legitimate results that
 * the interface has to render, and making the caller catch to discover which
 * one happened would put the error path in the caller's hands at exactly the
 * point where it must not be.
 */
export async function dispatchCommand(
  input: DispatchCommandInput,
  options: DispatchOptions = {},
): Promise<DispatchResult> {
  const clock = options.clock ?? systemClock;
  const jitter = options.jitter ?? noJitter;
  const policy = options.retry ?? DEFAULT_RETRY_POLICY;
  const attemptPolicy = options.attemptPolicy ?? "exhaust";

  const steps: DispatchStep[] = [];
  const add = (
    step: number,
    name: DispatchStepName,
    outcome: DispatchStep["outcome"],
    detail: string,
  ): void => {
    steps.push({ step, name, outcome, detail });
  };

  const blank: DispatchResult = {
    commandId: null,
    status: "proposed",
    created: false,
    acknowledged: false,
    receiptId: null,
    externalId: null,
    attempts: 0,
    blocked: false,
    denialCode: null,
    deadLettered: false,
    auditEventId: null,
    message: "",
    steps,
  };

  const instance = requireConnectorInstance(input.connectorInstanceId);

  /* ---- 2a. The runtime's own refusals, before the gate ----
   *
   * These are placed before the authority gate deliberately. A write to a
   * planned adapter, or to an object type a connector never declared, is not
   * a question of who is allowed to do it: there is nothing there to write
   * to. Recording it as an authority denial would misattribute a
   * configuration problem to the acting role.
   */
  if (!isOperableMode(instance.mode)) {
    const message = `${instance.displayName} is a planned adapter. No command was created because there is nothing to send to.`;
    add(1, "propose-command", "stopped", message);
    return { ...blank, blocked: true, denialCode: "connector-not-implemented", message };
  }

  if (!declaresCapability(instance.capabilities, "write", input.targetExternalType)) {
    const refusal = new ConnectorError(
      "capability-not-declared",
      `${instance.displayName} does not declare a write capability for "${input.targetExternalType}". The runtime refused the command before the connector was called.`,
      { connectorInstanceId: instance.id },
    );
    add(1, "propose-command", "stopped", refusal.message);
    return {
      ...blank,
      blocked: true,
      denialCode: "capability-not-declared",
      message: refusal.message,
    };
  }

  if (!instance.writeEnabled) {
    const message = `Writing is not enabled on ${instance.displayName}. An administrator must enable it before an external change can be sent.`;
    add(1, "propose-command", "stopped", message);
    return { ...blank, blocked: true, denialCode: "write-not-enabled", message };
  }

  /* ---- 1. Begin as a proposed command ---- */
  const fingerprint = fingerprintPayload(input.toolName, input.payload);
  const idempotencyKey =
    input.idempotencyKey ??
    buildIdempotencyKey({
      runId: input.runId,
      commandKind: input.commandKind,
      connectorInstanceId: instance.id,
      targetExternalType: input.targetExternalType,
      targetExternalId: input.targetExternalId ?? null,
      payloadFingerprint: fingerprint,
      decisionId: input.decisionId ?? null,
    });

  const tool = TOOL_REGISTRY[input.toolName];
  const context = createConnectorContext({
    runId: input.runId,
    connectorInstanceId: instance.id,
    atMoment: input.atMoment,
    clock,
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    ...(input.traceId ? { traceId: input.traceId } : {}),
    ...(input.language ? { language: input.language } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  const reservation = reserveCommand({
    id: nextCommandId(clock),
    runId: input.runId,
    connectorInstanceId: instance.id,
    commandKind: input.commandKind,
    idempotencyKey,
    actingUserId: input.actingUserId,
    roleId: input.roleId,
    actorKind: input.actorKind,
    authorityClass: tool?.authorityClass ?? "PROHIBITED",
    approvalId: input.approvalId ?? null,
    decisionId: input.decisionId ?? null,
    toolName: input.toolName,
    sourceCanonicalType: input.sourceCanonicalType,
    sourceCanonicalId: input.sourceCanonicalId,
    targetExternalType: input.targetExternalType,
    targetExternalId: input.targetExternalId ?? null,
    expectedVersion: input.expectedVersion ?? null,
    payload: input.payload,
    payloadDigest: fingerprint,
    intentStatement: input.intentStatement,
    status: "proposed",
    attempts: 0,
    maxAttempts: policy.maxAttempts,
    nextAttemptAt: null,
    lastError: "",
    correlationId: context.correlationId,
    traceId: context.traceId,
    atMoment: input.atMoment,
    createdAt: clock.nowIso(),
    queuedAt: null,
    executedAt: null,
    acknowledgedAt: null,
    sequence: input.sequence ?? 0,
  });

  const command = reservation.command;

  add(
    1,
    "propose-command",
    "ok",
    reservation.created
      ? `${command.id} proposed with idempotency key digest ${fingerprint}.`
      : `An identical command already exists as ${command.id} with status "${command.status}". No second external object will be created.`,
  );

  /*
   * The replay path. An already acknowledged command returns its existing
   * receipt rather than attempting anything, which is the behaviour the
   * idempotency requirement describes: a replay finds the existing row.
   */
  if (!reservation.created && isAlreadyAcknowledged(command)) {
    add(5, "execute-through-connector", "skipped", "Already acknowledged. Nothing was sent.");
    return {
      ...blank,
      commandId: command.id,
      status: command.status,
      created: false,
      acknowledged: true,
      externalId: command.targetExternalId,
      attempts: command.attempts,
      message: `${command.id} was already acknowledged by ${instance.sourceSystem}. The replay created no second external object.`,
    };
  }

  /* ---- 2. Pass the authority gate ---- */
  const approval = input.approvalId ? loadApproval(input.runId, input.approvalId) : null;
  const decision = evaluateAuthority({
    toolName: input.toolName,
    roleId: input.roleId,
    autonomyLevel: input.autonomyLevel,
    payload: input.payload,
    approval,
    actingUserId: input.actingUserId,
  });

  if (!decision.allowed) {
    const awaitingApproval = decision.code === "approval-missing";

    getDb()
      .update(integrationCommands)
      .set({
        status: awaitingApproval ? "awaiting-approval" : "cancelled",
        lastError: decision.reason,
      })
      .where(eq(integrationCommands.id, command.id))
      .run();

    const auditEventId = awaitingApproval
      ? recordAuditEvent({
          runId: input.runId,
          atMoment: input.atMoment,
          category: "tool-call",
          action: input.toolName,
          objectKind: "integration-command",
          objectId: command.id,
          summary: `An external change to ${instance.sourceSystem} was prepared and held for human approval: ${input.intentStatement}.`,
          actorUserId: input.actingUserId,
          actorKind: input.actorKind,
          roleId: input.roleId,
          authorityClass: decision.tool?.authorityClass ?? null,
          decisionId: input.decisionId ?? null,
          reversible: true,
          detail: { connectorInstanceId: instance.id, fingerprint: decision.fingerprint },
        })
      : recordBlockedAttempt({
          runId: input.runId,
          atMoment: input.atMoment,
          toolName: input.toolName,
          reason: decision.reason,
          code: decision.code,
          roleId: input.roleId,
          actorUserId: input.actingUserId,
          actorKind: input.actorKind,
          authorityClass: decision.tool?.authorityClass ?? null,
          objectKind: "integration-command",
          objectId: command.id,
          decisionId: input.decisionId ?? null,
        });

    add(
      2,
      "authority-gate",
      "stopped",
      `${decision.code}: ${decision.reason}`,
    );
    add(
      3,
      "receive-approval",
      awaitingApproval ? "stopped" : "skipped",
      awaitingApproval
        ? "The command is held awaiting a human approval bound to this exact payload."
        : "Not reached.",
    );

    return {
      ...blank,
      commandId: command.id,
      status: awaitingApproval ? "awaiting-approval" : "cancelled",
      created: reservation.created,
      blocked: true,
      denialCode: decision.code,
      auditEventId,
      message: decision.reason,
    };
  }

  add(
    2,
    "authority-gate",
    "ok",
    `${decision.tool.authorityClass} permitted for ${input.roleId} at autonomy "${input.autonomyLevel}".`,
  );

  /* ---- 3. Receive approval where required ---- */
  add(
    3,
    "receive-approval",
    decision.requiresApproval ? "ok" : "skipped",
    decision.requiresApproval
      ? `Approval ${input.approvalId} is bound to payload fingerprint ${decision.fingerprint}.`
      : "This authority class does not require an approval at the current autonomy level.",
  );

  /*
   * The approval is deliberately NOT consumed here, which differs from the
   * local tool runtime and is worth justifying.
   *
   * Locally, consuming the approval is what prevents replay. Here the replay
   * guard is the unique index on `integration_commands.idempotency_key`: a
   * second attempt at the same change finds the same command row, and a
   * second DIFFERENT change produces a different payload fingerprint and
   * therefore fails the gate's payload binding. Single use is preserved
   * structurally either way.
   *
   * Consuming it would break the behaviour that matters more. A transport
   * failure would leave the operator holding a dead letter whose approval had
   * already been spent, so pressing retry would require a person to approve
   * again a decision they already took. That would teach the user that a
   * recorded decision is provisional until the network cooperates, which is
   * both false and corrosive to the accountability this product is about.
   */

  /*
   * The approval reference is written onto the command here, not only at
   * creation.
   *
   * A command proposed without an approval and then approved resolves to the
   * same row, because the idempotency key is a function of the payload and not
   * of the approval. Leaving `approval_id` null on that row would mean the
   * reviewer asking "who allowed this external change" found nothing, which is
   * the single question this column exists to answer.
   */
  getDb()
    .update(integrationCommands)
    .set({
      status: "approved",
      lastError: "",
      ...(input.approvalId ? { approvalId: input.approvalId } : {}),
    })
    .where(eq(integrationCommands.id, command.id))
    .run();

  /* ---- 4. Enter the outbox ---- */
  enqueue(command.id, clock);
  add(4, "enter-outbox", "ok", "Queued. The durable record of intent exists before anything is sent.");

  /* ---- 5 to 10. Attempt, acknowledge, receipt, projection, audit, activity ---- */
  return attemptCommand(command.id, {
    steps,
    add,
    clock,
    jitter,
    policy,
    attemptPolicy,
    created: reservation.created,
    autonomyLevel: input.autonomyLevel,
    ...(options.signal ? { signal: options.signal } : {}),
  });
}

/* ==========================================================================
   Attempting a queued command
   ========================================================================== */

interface AttemptContext {
  steps: DispatchStep[];
  add: (
    step: number,
    name: DispatchStepName,
    outcome: DispatchStep["outcome"],
    detail: string,
  ) => void;
  clock: IntegrationClock;
  jitter: JitterSource;
  policy: RetryPolicy;
  attemptPolicy: "single" | "exhaust";
  created: boolean;
  autonomyLevel: AutonomyLevel;
  signal?: AbortSignal;
}

/**
 * Makes attempts against the target until it acknowledges or the bound is hit.
 *
 * The loop does not sleep. The backoff schedule is computed and persisted on
 * `next_attempt_at`, which is what the outbox drain and the interface read,
 * but a request thread that blocked for the real delay would make the failure
 * proof take a minute and would hold a server action open for the same. The
 * honest statement of that trade is in docs/PRODUCTIZATION_GAPS.md: a real
 * deployment needs a worker, not a loop inside the request.
 */
async function attemptCommand(
  commandId: string,
  attemptContext: AttemptContext,
): Promise<DispatchResult> {
  const { add, clock, jitter, policy, attemptPolicy } = attemptContext;

  const loaded = findCommandById(commandId);
  if (!loaded) throw new Error(`The command ${commandId} disappeared between steps.`);
  /*
   * Annotated rather than inferred. The loop below reassigns `command` from a
   * nullable read and the envelope is built inside a closure, so without the
   * annotation the compiler widens the narrowed type back to nullable and
   * every field access in the envelope becomes an error.
   */
  let command: CommandRow = loaded;

  const instance = requireConnectorInstance(command.connectorInstanceId);

  /*
   * Paused writes (src/integrations/runtime/WritePause.ts). The command stays
   * in the outbox exactly as it is and the connector is not called. This is
   * the one place every attempt passes through, the first dispatch, the
   * drain and a manual retry alike, so a pause cannot be bypassed by
   * whichever path happens to run next. The decision and its approval are
   * untouched; delivery waits for the resume.
   */
  if (isWritePaused(instance.id)) {
    const message = `Writes to ${instance.sourceSystem} are paused. ${command.id} stays queued and nothing was sent; it is delivered when writes resume.`;
    add(5, "execute-through-connector", "stopped", message);
    return {
      commandId: command.id,
      status: command.status,
      created: attemptContext.created,
      acknowledged: false,
      receiptId: null,
      externalId: null,
      attempts: command.attempts,
      blocked: false,
      denialCode: null,
      deadLettered: false,
      auditEventId: null,
      message,
      steps: attemptContext.steps,
    };
  }

  const { connector } = resolveConnector(instance.id);

  const context = createConnectorContext({
    runId: command.runId,
    connectorInstanceId: instance.id,
    atMoment: command.atMoment,
    correlationId: command.correlationId,
    traceId: command.traceId,
    clock,
    ...(attemptContext.signal ? { signal: attemptContext.signal } : {}),
  });

  let attempt = command.attempts;
  let lastError: ConnectorError | null = null;

  while (attempt < policy.maxAttempts) {
    attempt += 1;
    markExecuting(command.id, attempt, clock);

    try {
      const acknowledgement = await runAttempt(
        (signal) =>
          connector.execute(
            {
              commandId: command.id,
              idempotencyKey: command.idempotencyKey,
              commandKind: command.commandKind,
              actingUserId: command.actingUserId,
              roleId: command.roleId,
              actorKind: command.actorKind,
              authorityClass: command.authorityClass,
              payloadFingerprint: command.payloadDigest,
              approvalId: command.approvalId,
              decisionId: command.decisionId,
              toolName: command.toolName,
              sourceCanonicalType: command.sourceCanonicalType,
              sourceCanonicalId: command.sourceCanonicalId,
              targetExternalType: command.targetExternalType,
              targetExternalId: command.targetExternalId,
              expectedVersion: command.expectedVersion,
              payload: command.payload,
              intentStatement: command.intentStatement,
              correlationId: command.correlationId,
              traceId: command.traceId,
              atMoment: command.atMoment,
              attempt,
            },
            { ...context, signal },
          ),
        policy,
        { connectorInstanceId: instance.id },
      );

      add(
        5,
        "execute-through-connector",
        "ok",
        `Attempt ${attempt} reached ${instance.sourceSystem}.`,
      );

      return completeAcknowledged({
        command,
        acknowledgement,
        instance,
        attemptContext,
        attempt,
      });
    } catch (error) {
      lastError = toConnectorError(error, { connectorInstanceId: instance.id });

      const retryDecision = shouldRetry(lastError, attempt, policy, clock, jitter);
      markFailed(command.id, {
        lastError: `${lastError.code}: ${lastError.detail}`,
        nextAttemptAt: retryDecision.nextAttemptAt,
        attempts: attempt,
      });

      add(
        5,
        "execute-through-connector",
        "failed",
        `Attempt ${attempt} failed: ${lastError.code}. ${retryDecision.reason}`,
      );

      log.warn("An external command attempt failed.", {
        commandId: command.id,
        connectorInstanceId: instance.id,
        attempt,
        code: lastError.code,
      });

      if (!retryDecision.retry) break;
      if (attemptPolicy === "single") {
        // Left due at its scheduled time for the drain or a manual retry.
        return {
          commandId: command.id,
          status: "failed",
          created: attemptContext.created,
          acknowledged: false,
          receiptId: null,
          externalId: null,
          attempts: attempt,
          blocked: false,
          denialCode: null,
          deadLettered: false,
          auditEventId: null,
          message: `${command.id} failed and is scheduled for a further attempt. The approved decision is unchanged.`,
          steps: attemptContext.steps,
        };
      }

      command = findCommandById(command.id) ?? command;
    }
  }

  /* ---- Exhausted. Dead letter, and leave the decision alone. ---- */
  const error = lastError ?? new ConnectorError("unknown", "No attempt was made.");
  enterDeadLetter(
    {
      runId: command.runId,
      commandId: command.id,
      connectorInstanceId: instance.id,
      reason: `Delivery to ${instance.sourceSystem} did not succeed after ${attempt} attempt(s).`,
      lastError: `${error.code}: ${error.detail}`,
      attempts: attempt,
      payloadDigest: command.payloadDigest,
      atMoment: command.atMoment,
      retryable: error.retryable,
    },
    clock,
  );

  const auditEventId = recordAuditEvent({
    runId: command.runId,
    atMoment: command.atMoment,
    category: "system",
    action: "integrationCommandDeadLettered",
    objectKind: "integration-command",
    objectId: command.id,
    summary: `The external change to ${instance.sourceSystem} was not confirmed after ${attempt} attempt(s). The approved decision and its rationale are unchanged; the delivery needs a retry.`,
    actorUserId: command.actingUserId,
    actorKind: "system",
    roleId: command.roleId as RoleId,
    authorityClass: command.authorityClass,
    decisionId: command.decisionId,
    approvalId: command.approvalId,
    reversible: true,
    detail: { connectorInstanceId: instance.id, errorCode: error.code, attempts: attempt },
  });

  add(6, "receive-acknowledgement", "stopped", "No acknowledgement was received.");
  add(
    7,
    "persist-external-receipt",
    "skipped",
    "No receipt row was written. A receipt line may only be written from an acknowledgement.",
  );
  add(8, "update-local-projection", "skipped", "The projection was not changed.");
  add(9, "create-audit-event", "ok", `${auditEventId} records the dead letter.`);
  add(10, "append-activity-stream", "ok", "The activity stream shows the delivery as needing retry.");

  writeActivityEntry({
    command,
    instance,
    kind: "blocked",
    label: `External change to ${instance.sourceSystem} needs a retry`,
    labelDe: `Externe Aenderung an ${instance.sourceSystem} erfordert eine Wiederholung`,
    outcome: `dead-letter after ${attempt} attempt(s)`,
    auditEventId,
    clock,
  });

  return {
    commandId: command.id,
    status: "dead-letter",
    created: attemptContext.created,
    acknowledged: false,
    receiptId: null,
    externalId: null,
    attempts: attempt,
    blocked: false,
    denialCode: error.code,
    deadLettered: true,
    auditEventId,
    message: `${instance.sourceSystem} did not confirm the change after ${attempt} attempt(s). The decision stands and the delivery can be retried.`,
    steps: attemptContext.steps,
  };
}

/* ==========================================================================
   Steps 6 to 10
   ========================================================================== */

function completeAcknowledged(params: {
  command: CommandRow;
  acknowledgement: ConnectorAcknowledgement;
  instance: ReturnType<typeof requireConnectorInstance>;
  attemptContext: AttemptContext;
  attempt: number;
}): DispatchResult {
  const { command, acknowledgement, instance, attemptContext, attempt } = params;
  const { add, clock } = attemptContext;

  /* ---- 6. Receive an acknowledgement ---- */
  markAcknowledged(
    command.id,
    { externalId: acknowledgement.externalId, externalVersion: acknowledgement.externalVersion },
    clock,
  );
  const acknowledged = findCommandById(command.id);
  if (!acknowledged) throw new Error(`The command ${command.id} could not be read back.`);

  add(
    6,
    "receive-acknowledgement",
    acknowledgement.outcome === "partial" ? "ok" : "ok",
    acknowledgement.outcome === "partial"
      ? `${instance.sourceSystem} applied part of the change and declined: ${acknowledgement.notApplied.join("; ")}.`
      : `${instance.sourceSystem} confirmed ${acknowledgement.externalType}:${acknowledgement.externalId}.`,
  );

  /* ---- 9. Create an audit event (before the receipt, so the receipt can cite it) ---- */
  const auditEventId = recordAuditEvent({
    runId: command.runId,
    atMoment: command.atMoment,
    category: "mutation",
    action: command.toolName,
    objectKind: "integration-command",
    objectId: command.id,
    summary: `${acknowledgement.statement} Confirmed by ${instance.sourceSystem} as ${acknowledgement.externalType}:${acknowledgement.externalId}.`,
    actorUserId: command.actingUserId,
    actorKind: command.actorKind,
    roleId: command.roleId as RoleId,
    authorityClass: command.authorityClass,
    decisionId: command.decisionId,
    approvalId: command.approvalId,
    reversible: false,
    detail: {
      connectorInstanceId: instance.id,
      externalType: acknowledgement.externalType,
      externalId: acknowledgement.externalId,
      attempts: attempt,
      outcome: acknowledgement.outcome,
    },
  });

  /* ---- 7. Persist an external receipt ---- */
  const receipt = writeReceiptFromAcknowledgement({
    command: acknowledged,
    acknowledgement,
    targetSystem: instance.sourceSystem,
    auditEventId,
    clock,
  });
  add(7, "persist-external-receipt", "ok", `${receipt.id} written from the acknowledgement.`);

  /* ---- 8. Update the local projection ----
   *
   * The external identity the target returned becomes a row in
   * `external_references`, so the object the product now shows can be opened
   * in the system that owns it. Without this step an acknowledged write would
   * leave the projection pointing at nothing.
   */
  const syncState = ensureSyncState({
    runId: command.runId,
    connectorInstanceId: instance.id,
    objectType: acknowledgement.externalType,
  });

  const canonicalType =
    command.sourceCanonicalType.length > 0
      ? command.sourceCanonicalType
      : canonicalTypeForObjectKind(command.targetExternalType);

  upsertExternalReference({
    runId: command.runId,
    connectorInstanceId: instance.id,
    sourceSystem: instance.sourceSystem,
    record: {
      externalType: acknowledgement.externalType,
      externalId: acknowledgement.externalId,
      externalUrl: acknowledgement.externalUrl,
      externalVersion: acknowledgement.externalVersion,
      sourceUpdatedAt: acknowledgement.acknowledgedAt,
      canonicalType: canonicalType as never,
      canonicalId: command.sourceCanonicalId,
      title: command.intentStatement,
      summary: acknowledgement.statement,
      fields: { digest: digestPayload(command.payload) },
    },
    canonical: {
      canonicalType: canonicalType as never,
      canonicalId: command.sourceCanonicalId,
      fields: {},
      unmappedFields: [],
      unmappedTaxonomyValues: [],
    },
    deepLinkTemplate: instance.deepLinkTemplate,
    stalenessThresholdMinutes: syncState.stalenessThresholdMinutes,
    pushBased: instance.capabilities.webhooks,
    clock,
  });
  add(
    8,
    "update-local-projection",
    "ok",
    `${canonicalType} ${command.sourceCanonicalId} now carries the external identity ${acknowledgement.externalId}.`,
  );

  add(9, "create-audit-event", "ok", auditEventId);

  /* ---- 10. Appear in the activity stream ---- */
  writeActivityEntry({
    command: acknowledged,
    instance,
    kind: "executed",
    label: acknowledgement.statement,
    labelDe: acknowledgement.statementDe,
    outcome: acknowledgement.outcome,
    auditEventId,
    clock,
  });
  add(10, "append-activity-stream", "ok", "The activity stream shows the confirmed external change.");

  /* A dead letter that later succeeded is closed, so the worklist is honest. */
  resolveDeadLetter(command.id, `Completed on attempt ${attempt}.`, clock);

  return {
    commandId: command.id,
    status: "acknowledged",
    created: attemptContext.created,
    acknowledged: true,
    receiptId: receipt.id,
    externalId: acknowledgement.externalId,
    attempts: attempt,
    blocked: false,
    denialCode: null,
    deadLettered: false,
    auditEventId,
    message: acknowledgement.statement,
    steps: attemptContext.steps,
  };
}

/**
 * Appends one row to the activity stream.
 *
 * `aiActivityEntries` is owned by the live day layer; this module writes rows
 * into it rather than keeping a separate integration log, because the
 * requirement is that an external change appears in the same activity stream
 * as everything else the partner did. Two streams would mean the user has to
 * know which one to look in.
 */
function writeActivityEntry(params: {
  command: CommandRow;
  instance: ReturnType<typeof requireConnectorInstance>;
  kind: "executed" | "blocked" | "waiting";
  label: string;
  labelDe: string;
  outcome: string;
  auditEventId: string | null;
  clock: IntegrationClock;
}): void {
  const { command, instance, clock } = params;

  const existing = getDb()
    .select({ sequence: aiActivityEntries.sequence })
    .from(aiActivityEntries)
    .where(eq(aiActivityEntries.runId, command.runId))
    .all();
  const sequence = existing.reduce((max, row) => Math.max(max, row.sequence), 0) + 1;

  getDb()
    .insert(aiActivityEntries)
    .values({
      id: nextActivityId(clock),
      runId: command.runId,
      roleId: command.roleId as RoleId,
      atMoment: command.atMoment,
      sequence,
      kind: params.kind,
      label: params.label,
      labelDe: params.labelDe.length > 0 ? params.labelDe : params.label,
      detail: `${instance.sourceSystem}. ${command.intentStatement}`,
      objectType: command.sourceCanonicalType,
      objectId: command.sourceCanonicalId,
      toolName: command.toolName,
      durationMs: 0,
      outcome: params.outcome,
      authorityClass: command.authorityClass,
      auditEventId: params.auditEventId,
      toolCallId: null,
      evidenceIds: [],
      suggestionId: null,
      eventId: null,
      connectorInstanceId: instance.id,
      createdAt: clock.nowIso(),
    })
    .run();
}

/* ==========================================================================
   Retry and drain
   ========================================================================== */

/**
 * Retries one command. The action behind the retry button.
 *
 * It does not create a new command and it does not re-ask for approval: the
 * approval the human already granted covers this exact payload, and asking
 * again would teach the user that a transport failure invalidates their
 * decision. The attempt counter is reset so the bounded retry starts again,
 * which is what the operator pressing the button is asking for.
 */
export async function retryCommand(
  commandId: string,
  options: DispatchOptions & { autonomyLevel?: AutonomyLevel } = {},
): Promise<DispatchResult> {
  const clock = options.clock ?? systemClock;
  const policy = options.retry ?? DEFAULT_RETRY_POLICY;
  const steps: DispatchStep[] = [];
  const add = (
    step: number,
    name: DispatchStepName,
    outcome: DispatchStep["outcome"],
    detail: string,
  ): void => {
    steps.push({ step, name, outcome, detail });
  };

  const command = findCommandById(commandId);
  if (!command) {
    return {
      commandId: null,
      status: "unknown",
      created: false,
      acknowledged: false,
      receiptId: null,
      externalId: null,
      attempts: 0,
      blocked: true,
      denialCode: "not-found",
      deadLettered: false,
      auditEventId: null,
      message: `There is no integration command ${commandId}.`,
      steps,
    };
  }

  if (isAlreadyAcknowledged(command)) {
    add(5, "execute-through-connector", "skipped", "Already acknowledged. Nothing was sent.");
    return {
      commandId: command.id,
      status: command.status,
      created: false,
      acknowledged: true,
      receiptId: null,
      externalId: command.targetExternalId,
      attempts: command.attempts,
      blocked: false,
      denialCode: null,
      deadLettered: false,
      auditEventId: null,
      message:
        "This command was already acknowledged. The retry created no second external object.",
      steps,
    };
  }

  /*
   * A retry while writes are paused changes nothing: the dead letter stays
   * open and the command keeps its state, so the worklist still shows what
   * needs delivering once writes resume.
   */
  if (isWritePaused(command.connectorInstanceId)) {
    return {
      commandId: command.id,
      status: command.status,
      created: false,
      acknowledged: false,
      receiptId: null,
      externalId: null,
      attempts: command.attempts,
      blocked: true,
      denialCode: "writes-paused",
      deadLettered: command.status === "dead-letter",
      auditEventId: null,
      message: `Writes to this connector are paused. ${command.id} was not retried; resume writes first.`,
      steps,
    };
  }

  /*
   * The attempt counter resets to zero so the bound applies to this retry
   * rather than to the lifetime of the command. The identifier and the
   * idempotency key do not change, which is what keeps the retry from
   * creating a duplicate.
   */
  getDb()
    .update(integrationCommands)
    .set({ attempts: 0, lastError: "" })
    .where(eq(integrationCommands.id, command.id))
    .run();
  requeueFromDeadLetter(command.id, clock);

  add(4, "enter-outbox", "ok", `${command.id} requeued on its original idempotency key.`);

  return attemptCommand(command.id, {
    steps,
    add,
    clock,
    jitter: options.jitter ?? noJitter,
    policy,
    attemptPolicy: options.attemptPolicy ?? "exhaust",
    created: false,
    autonomyLevel: options.autonomyLevel ?? "act-with-approval",
    ...(options.signal ? { signal: options.signal } : {}),
  });
}

/**
 * Attempts every command currently due. One pass, no loop. With a connector
 * named, only that connector's commands: what resuming its writes delivers.
 */
export async function drainOutbox(
  runId: string,
  options: DispatchOptions & { connectorInstanceId?: string } = {},
): Promise<DispatchResult[]> {
  const clock = options.clock ?? systemClock;
  const { claimDue } = await import("./Outbox");
  const due = claimDue(runId, clock).filter(
    (command) => !options.connectorInstanceId || command.connectorInstanceId === options.connectorInstanceId,
  );
  const results: DispatchResult[] = [];

  for (const command of due) {
    const steps: DispatchStep[] = [];
    results.push(
      await attemptCommand(command.id, {
        steps,
        add: (step, name, outcome, detail) => steps.push({ step, name, outcome, detail }),
        clock,
        jitter: options.jitter ?? noJitter,
        policy: options.retry ?? DEFAULT_RETRY_POLICY,
        attemptPolicy: options.attemptPolicy ?? "single",
        created: false,
        autonomyLevel: "act-with-approval",
        ...(options.signal ? { signal: options.signal } : {}),
      }),
    );
  }

  return results;
}

/** Cancels a command without touching the decision behind it. */
export function cancelCommand(commandId: string, reason: string): void {
  getDb()
    .update(integrationCommands)
    .set({ status: "cancelled", lastError: reason, nextAttemptAt: null })
    .where(eq(integrationCommands.id, commandId))
    .run();
}
