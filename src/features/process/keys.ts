/**
 * Identity conventions for the process engine.
 *
 * Task keys, job keys and event keys are derived from what makes the thing
 * unique, never from a clock, so that every write the engine makes can be
 * repeated without effect. That is the mechanism behind "a duplicate
 * submission does nothing twice": the second write finds the row or the event
 * the first one made.
 */

/** Stage task keys, namespaced by kind so a task and a tool can share a contract key. */
export const taskKey = {
  job: (key: string) => `job:${key}`,
  human: (key: string) => `task:${key}`,
  decision: (key: string) => `decision:${key}`,
  tool: (key: string) => `tool:${key}`,
  completion: "approval:stage-completion",
} as const;

/** The background job identity for one generation of a stage preparation. */
export function preparationJobKeys(stageRunId: string, generation: number): { id: string; idempotencyKey: string } {
  return {
    id: `JOB-PREP-${stageRunId}-G${generation}`,
    idempotencyKey: `stage-preparation:${stageRunId}:g${generation}`,
  };
}

/** Backbone event keys published by the engine. */
export const eventKey = {
  stageOpened: (stageRunId: string) => `stage-opened:${stageRunId}`,
  taskCreated: (stageRunId: string, key: string) => `human-task-created:${stageRunId}:${key}`,
  preparationStarted: (jobId: string, attempt: number) => `ai-preparation-started:${jobId}:a${attempt}`,
  preparationCompleted: (jobId: string) => `ai-preparation-completed:${jobId}`,
  preparationHeld: (jobId: string, reason: string, attempt: number) => `ai-preparation-held:${jobId}:${reason}:a${attempt}`,
  preparationFailed: (jobId: string) => `ai-preparation-failed:${jobId}`,
  sourceChanged: (jobId: string, sourceKey: string) => `source-changed:${jobId}:${sourceKey}`,
  decisionRequested: (stageRunId: string, key: string) => `decision-requested:${stageRunId}:${key}`,
  /** Shared with the decisions engine: one key per seeded decision, whoever publishes first. */
  seededDecisionRecorded: (decisionId: string) => `decision-recorded:${decisionId}`,
  stageDecisionRecorded: (stageRunId: string, key: string, revision: number) =>
    `decision-recorded:${stageRunId}:${key}:r${revision}`,
  taskCompleted: (stageRunId: string, key: string, revision: number) =>
    `human-task-completed:${stageRunId}:${key}:r${revision}`,
  approvalRequested: (stageRunId: string, subject: string) => `approval-requested:${stageRunId}:${subject}`,
  approvalGranted: (approvalId: string) => `approval-granted:${approvalId}`,
  toolExecuted: (stageRunId: string, toolKey: string) => `tool-executed:${stageRunId}:${toolKey}`,
  commandAcknowledged: (commandId: string) => `external-command-acknowledged:${commandId}`,
  stageCompleted: (stageRunId: string) => `stage-completed:${stageRunId}`,
  processCompleted: (processRunId: string) => `process-completed:${processRunId}`,
} as const;

/** The outbox idempotency key of a stage tool. One command per tool per stage run. */
export function outboxKey(stageRunId: string, toolKey: string): string {
  return `stage-tool:${stageRunId}:${toolKey}`;
}
