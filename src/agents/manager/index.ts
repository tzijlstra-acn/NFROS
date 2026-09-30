/**
 * The manager and specialist orchestration.
 *
 * A controlled manager pattern: one Personal NFR Work Agent that owns the
 * conversation, with specialists exposed to it as tools rather than as
 * handoffs. Handoff is reserved for the case where a specialist should
 * temporarily own the whole conversation, which in this product means a live
 * meeting role play.
 *
 * Specialists are tools rather than handoffs for a practical reason: the
 * manager needs to combine several specialist outputs without any of them
 * taking over, and a handoff makes that awkward. The one place where taking
 * over is correct is the workshop simulation, and that is the one place
 * handoff is used.
 *
 * Mode behaviour, which matters more than the model wiring:
 *   offline   no network calls at all; seeded and cached content only
 *   safe      cached known good output for the critical beats, live only for
 *             optional free questions
 *   live      real calls
 */

import { Agent, run } from "@openai/agents";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { agentRuns, cachedAiOutputs } from "@/db/schema/decisions";
import type { RoleId } from "@/db/schema/core";
import { getOpenAIClient, probeModelAvailability } from "@/server/openai/client";
import { getResolvedModels, estimateCostUsd } from "@/server/config/models";
import { getResolvedDemoMode } from "@/server/config/runtime";
import { requiresCachedCriticalBeats } from "@/server/config/demo-mode";
import { createLogger, redactString } from "@/server/logging/redact";
import { buildSdkTools } from "@/agents/tools/sdk-tools";
import type { ToolContext } from "@/agents/tools/runtime";
import {
  MANAGER_PROMPT,
  ROLE_SPECIALIST,
  SPECIALIST_LABELS,
  SPECIALIST_PROMPTS,
} from "@/agents/prompts/system";
import {
  appendMessage,
  assembleContext,
  compactSession,
  getOrCreateSession,
  recordUsage,
} from "@/agents/sessions/session";
import { applyInputGuardrails, applyOutputGuardrails } from "@/agents/guardrails";

const log = createLogger("manager");
const db = () => getDb();

let runSequence = 0;
function nextRunId(): string {
  runSequence += 1;
  return `AGR-${Date.now().toString(36).toUpperCase()}-${String(runSequence).padStart(3, "0")}`;
}

export interface AgentTurnResult {
  /** The text shown to the user. */
  output: string;
  /** "live", "cache" or "seeded". */
  source: "live" | "cache" | "seeded";
  agentRunId: string;
  model: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  /** Specialists the manager delegated to during this turn. */
  specialistsUsed: string[];
  /** Tools that were refused or held, surfaced to the interface. */
  refusals: string[];
  proposals: string[];
  guardrailNote: string | null;
  compaction: { compacted: boolean; turnsFolded: number } | null;
}

function writeAgentRun(params: {
  id: string;
  context: ToolContext;
  sessionId: string;
  agentName: string;
  agentKind: string;
  parentRunId: string | null;
  model: string;
  sourceMode: string;
  fromCache: boolean;
  startedAt: string;
  task: string;
}): void {
  db()
    .insert(agentRuns)
    .values({
      id: params.id,
      runId: params.context.runId,
      sessionId: params.sessionId,
      agentName: params.agentName,
      agentKind: params.agentKind,
      parentRunId: params.parentRunId,
      model: params.model,
      sourceMode: params.sourceMode,
      fromCache: params.fromCache,
      startedAt: params.startedAt,
      status: "running",
      task: params.task,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      guardrailTriggered: false,
    })
    .run();
}

function completeAgentRun(
  id: string,
  updates: {
    status: string;
    durationMs: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    errorSummary?: string | null;
    guardrailTriggered?: boolean;
    guardrailNote?: string | null;
  },
): void {
  db()
    .update(agentRuns)
    .set({
      completedAt: new Date().toISOString(),
      status: updates.status,
      durationMs: updates.durationMs,
      inputTokens: updates.inputTokens,
      outputTokens: updates.outputTokens,
      estimatedCostUsd: updates.estimatedCostUsd,
      errorSummary: updates.errorSummary ?? null,
      guardrailTriggered: updates.guardrailTriggered ?? false,
      guardrailNote: updates.guardrailNote ?? null,
    })
    .where(eq(agentRuns.id, id))
    .run();
}

/** Looks up a cached known good output for a critical beat. */
export function getCachedBeat(
  beatKey: string,
  runId: string,
): { payload: Record<string, unknown>; latencyMs: number } | null {
  const row = db()
    .select()
    .from(cachedAiOutputs)
    .where(and(eq(cachedAiOutputs.runId, runId), eq(cachedAiOutputs.beatKey, beatKey)))
    .get();
  if (!row) return null;
  return { payload: row.payload, latencyMs: row.simulatedLatencyMs };
}

/** Builds the specialist agents for a context. */
function buildSpecialists(context: ToolContext): Map<string, Agent> {
  const models = getResolvedModels();
  const tools = buildSdkTools(context);
  const specialists = new Map<string, Agent>();

  for (const [name, instructions] of Object.entries(SPECIALIST_PROMPTS)) {
    // The role player has no tools: it is acting a person, and a participant
    // in a meeting does not query the risk platform mid-sentence.
    const isRolePlayer = name === "meeting-roleplayer-specialist";
    specialists.set(
      name,
      new Agent({
        name: SPECIALIST_LABELS[name] ?? name,
        instructions,
        model: isRolePlayer ? models.fast : models.primary,
        tools: isRolePlayer ? [] : tools,
      }),
    );
  }

  return specialists;
}

/**
 * Builds the manager, with specialists attached as tools.
 *
 * `asTool` is used where available so the SDK records the delegation; the
 * fallback wraps the specialist in an explicit tool so the manager pattern
 * still holds if the helper is not present in this SDK version.
 */
function buildManager(context: ToolContext): { manager: Agent; specialistNames: string[] } {
  const models = getResolvedModels();
  const specialists = buildSpecialists(context);
  const baseTools = buildSdkTools(context);

  const specialistTools = [];
  const specialistNames: string[] = [];

  for (const [name, agent] of specialists.entries()) {
    if (name === "meeting-roleplayer-specialist") continue;
    specialistNames.push(name);

    const asTool = (agent as unknown as { asTool?: (options: Record<string, unknown>) => unknown })
      .asTool;

    /*
     * Fail loudly rather than silently.
     *
     * An earlier version skipped a specialist when the helper was missing,
     * which meant that on an SDK version without `asTool` the manager would be
     * constructed with zero specialists and would answer every function
     * specific question itself, badly, with no signal that anything was wrong.
     * A manager with no specialists is not a degraded product, it is a
     * different and worse one, so it should not be reachable by accident.
     */
    if (typeof asTool !== "function") {
      throw new Error(
        `The installed Agents SDK does not expose Agent.asTool, so the specialist "${name}" cannot be attached to the manager. The controlled manager pattern requires it. Pin @openai/agents to a version that provides asTool, or replace buildManager with an explicit tool wrapper per specialist.`,
      );
    }

    specialistTools.push(
      asTool.call(agent, {
        toolName: name.replace(/-/g, "_"),
        toolDescription: `Delegate function-specific work to the ${SPECIALIST_LABELS[name] ?? name}. Provide the full question and the relevant object identifiers.`,
      }),
    );
  }

  if (specialistTools.length === 0) {
    throw new Error(
      "No specialists were attached to the manager. The controlled manager pattern requires at least one.",
    );
  }

  const manager = new Agent({
    name: "Personal NFR Work Agent",
    instructions: MANAGER_PROMPT,
    model: models.primary,
    tools: [...baseTools, ...(specialistTools as never[])],
  });

  return { manager, specialistNames };
}

/**
 * Runs one turn of the manager agent.
 *
 * `beatKey` marks a critical story beat. In presenter safe and offline mode a
 * beat with a cached output is served from cache with its recorded latency, so
 * the demonstration is deterministic. A free question has no beat key and is
 * answered live when the mode permits it.
 */
export async function runManagerTurn(options: {
  context: ToolContext;
  userInput: string;
  beatKey?: string;
  /** Force a specialist rather than letting the manager choose. */
  preferSpecialist?: string;
}): Promise<AgentTurnResult> {
  const { context, userInput } = options;
  const mode = getResolvedDemoMode();
  const session = getOrCreateSession(context.actingUserId, context.roleId, context.runId);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const agentRunId = nextRunId();

  /* ---- Input guardrails ---- */
  const inputCheck = applyInputGuardrails(userInput);
  if (!inputCheck.allowed) {
    writeAgentRun({
      id: agentRunId,
      context,
      sessionId: session.id,
      agentName: "Personal NFR Work Agent",
      agentKind: "manager",
      parentRunId: null,
      model: "none",
      sourceMode: mode.mode,
      fromCache: false,
      startedAt,
      task: "Input refused by a guardrail.",
    });
    completeAgentRun(agentRunId, {
      status: "completed",
      durationMs: Date.now() - startedMs,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      guardrailTriggered: true,
      guardrailNote: inputCheck.reason,
    });

    return {
      output: inputCheck.message,
      source: "seeded",
      agentRunId,
      model: "none",
      durationMs: Date.now() - startedMs,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      specialistsUsed: [],
      refusals: [inputCheck.reason],
      proposals: [],
      guardrailNote: inputCheck.reason,
      compaction: null,
    };
  }

  /* ---- Cached critical beat ---- */
  if (options.beatKey && requiresCachedCriticalBeats(mode.mode)) {
    const cached = getCachedBeat(options.beatKey, context.runId);
    if (cached) {
      writeAgentRun({
        id: agentRunId,
        context,
        sessionId: session.id,
        agentName: "Personal NFR Work Agent",
        agentKind: "manager",
        parentRunId: null,
        model: "cached",
        sourceMode: mode.mode,
        fromCache: true,
        startedAt,
        task: `Cached beat ${options.beatKey}`,
      });

      // The recorded latency is honoured so safe mode paces like live mode.
      await new Promise((resolve) => setTimeout(resolve, Math.min(cached.latencyMs, 2500)));

      const output =
        typeof cached.payload.text === "string"
          ? cached.payload.text
          : JSON.stringify(cached.payload, null, 2);

      appendMessage(session.id, "user", userInput, context.runId);
      appendMessage(session.id, "assistant", output, context.runId);

      completeAgentRun(agentRunId, {
        status: "completed",
        durationMs: Date.now() - startedMs,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
      });

      return {
        output,
        source: "cache",
        agentRunId,
        model: "cached",
        durationMs: Date.now() - startedMs,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        specialistsUsed: [ROLE_SPECIALIST[context.roleId]],
        refusals: [],
        proposals: [],
        guardrailNote: null,
        compaction: null,
      };
    }
  }

  /* ---- Offline ---- */
  const client = getOpenAIClient();
  if (mode.mode === "offline" || client === null) {
    const output = offlineFallback(context.roleId, userInput, mode.mode);

    writeAgentRun({
      id: agentRunId,
      context,
      sessionId: session.id,
      agentName: "Personal NFR Work Agent",
      agentKind: "manager",
      parentRunId: null,
      model: "none",
      sourceMode: mode.mode,
      fromCache: true,
      startedAt,
      task: "Seeded response, no model call.",
    });
    completeAgentRun(agentRunId, {
      status: "completed",
      durationMs: Date.now() - startedMs,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    });

    appendMessage(session.id, "user", userInput, context.runId);
    appendMessage(session.id, "assistant", output, context.runId);

    return {
      output,
      source: "seeded",
      agentRunId,
      model: "none",
      durationMs: Date.now() - startedMs,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      specialistsUsed: [],
      refusals: [],
      proposals: [],
      guardrailNote: null,
      compaction: null,
    };
  }

  /* ---- Live ---- */
  await probeModelAvailability();
  const models = getResolvedModels();
  const { manager, specialistNames } = buildManager(context);
  const assembled = assembleContext(session.id, context.roleId, context.runId);

  writeAgentRun({
    id: agentRunId,
    context,
    sessionId: session.id,
    agentName: "Personal NFR Work Agent",
    agentKind: "manager",
    parentRunId: null,
    model: models.primary,
    sourceMode: mode.mode,
    fromCache: false,
    startedAt,
    task: userInput.slice(0, 180),
  });

  appendMessage(session.id, "user", userInput, context.runId);

  try {
    const prompt = [
      assembled.system.length > 0 ? `Current state:\n${assembled.system}` : "",
      assembled.transcript
        .map((turn) => `${turn.role}: ${turn.content}`)
        .join("\n")
        .slice(0, 8000),
      options.preferSpecialist
        ? `Delegate this to the ${SPECIALIST_LABELS[options.preferSpecialist] ?? options.preferSpecialist}.`
        : "",
      `Question from ${context.roleId}: ${userInput}`,
    ]
      .filter((part) => part.length > 0)
      .join("\n\n");

    const result = await run(manager, prompt, { maxTurns: 12 });

    const rawOutput =
      typeof result.finalOutput === "string"
        ? result.finalOutput
        : JSON.stringify(result.finalOutput ?? "", null, 2);

    const outputCheck = applyOutputGuardrails(rawOutput);
    const output = outputCheck.text;

    // Usage is not uniformly exposed across SDK versions, so it is read
    // defensively and reported as zero rather than guessed at.
    const usage = (result as unknown as {
      rawResponses?: Array<{ usage?: { inputTokens?: number; outputTokens?: number } }>;
    }).rawResponses;
    const inputTokens =
      usage?.reduce((sum, response) => sum + (response.usage?.inputTokens ?? 0), 0) ??
      assembled.tokenEstimate;
    const outputTokens =
      usage?.reduce((sum, response) => sum + (response.usage?.outputTokens ?? 0), 0) ??
      Math.ceil(output.length / 4);
    const cost = estimateCostUsd(models.primary, inputTokens, outputTokens);

    appendMessage(session.id, "assistant", output, context.runId);
    recordUsage(session.id, inputTokens, outputTokens, cost);

    completeAgentRun(agentRunId, {
      status: "completed",
      durationMs: Date.now() - startedMs,
      inputTokens,
      outputTokens,
      estimatedCostUsd: cost,
      guardrailTriggered: outputCheck.modified,
      guardrailNote: outputCheck.note,
    });

    const compaction = compactSession(session.id, context.roleId, context.runId);

    return {
      output,
      source: "live",
      agentRunId,
      model: models.primary,
      durationMs: Date.now() - startedMs,
      inputTokens,
      outputTokens,
      estimatedCostUsd: cost,
      specialistsUsed: specialistNames.filter((name) => rawOutput.includes(name.split("-")[0] ?? "")),
      refusals: outputCheck.refusals,
      proposals: outputCheck.proposals,
      guardrailNote: outputCheck.note,
      compaction: { compacted: compaction.compacted, turnsFolded: compaction.turnsFolded },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.warn("The live turn failed. Falling back to a seeded response.", { error });

    completeAgentRun(agentRunId, {
      status: "failed",
      durationMs: Date.now() - startedMs,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      errorSummary: message,
    });

    /*
     * Say what actually happened.
     *
     * An earlier version reported "running in safe mode" here, which was
     * false: the mode was live and the call failed. Telling a presenter the
     * wrong reason for a fallback is worse than telling them nothing, because
     * they will look in the wrong place.
     */
    const output = liveFailureFallback(context.roleId, userInput, message);
    appendMessage(session.id, "assistant", output, context.runId);

    return {
      output,
      source: "seeded",
      agentRunId,
      model: models.primary,
      durationMs: Date.now() - startedMs,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      specialistsUsed: [],
      refusals: [`The live call failed and the application fell back to presenter safe behaviour.`],
      proposals: [],
      guardrailNote: null,
      compaction: null,
    };
  }
}

/**
 * The offline and fallback response.
 *
 * It declines rather than improvising. A seeded paragraph that sounds like an
 * answer would be the single most damaging thing this product could do,
 * because the whole claim is that a conclusion is traceable to evidence.
 */
/**
 * The fallback used when a live call was attempted and failed.
 *
 * It names the failure rather than blaming the mode, and it redacts the
 * provider message again on the way out, because this string is rendered in
 * the browser.
 */
function liveFailureFallback(roleId: RoleId, userInput: string, reason: string): string {
  return [
    "A live model call was attempted and failed, so this answer was not produced by a model.",
    "",
    `Reason reported by the provider: ${redactString(reason)}`,
    "",
    `Everything else remains usable: the decision brief, the evidence corpus, the work object for the ${roleId} role, the meeting scripts and the governed execution path all read from the seeded scenario rather than from a model.`,
    "",
    `Your question was recorded: "${userInput.slice(0, 200)}"`,
    "",
    "If the reason above mentions an incorrect or missing key, the key resolved from the local source repository is being rejected. Replace it and run npm run smoke:live to confirm.",
  ].join("\n");
}

function offlineFallback(roleId: RoleId, userInput: string, mode: string): string {
  return [
    `This question was not answered by a model. The application is running in ${mode} mode, so no live call was made.`,
    ``,
    `The interactive surfaces remain fully usable: the decision brief, the evidence corpus, the work object for the ${roleId} role, the meeting scripts and the execution path all read from the seeded scenario rather than from a model.`,
    ``,
    `Your question was recorded: "${userInput.slice(0, 200)}"`,
    ``,
    `To answer free questions, switch the mode to live on the entry screen or in the control room. A usable OpenAI key must be resolvable for that option to be offered.`,
  ].join("\n");
}

/**
 * Runs a meeting participant turn.
 *
 * This is the one place a handoff is appropriate, because a role played
 * participant should own their own turn rather than being narrated by the
 * manager.
 */
export async function runMeetingParticipantTurn(options: {
  context: ToolContext;
  participantName: string;
  participantRole: string;
  participantPosition: string;
  transcript: Array<{ speaker: string; content: string }>;
  userStatement: string;
}): Promise<{ output: string; source: "live" | "seeded"; model: string; durationMs: number }> {
  const startedMs = Date.now();
  const mode = getResolvedDemoMode();
  const client = getOpenAIClient();

  if (mode.mode !== "live" || client === null) {
    return {
      output:
        "The scripted meeting continues from the seeded transcript. Switch to live mode for a free exchange with this participant.",
      source: "seeded",
      model: "none",
      durationMs: Date.now() - startedMs,
    };
  }

  await probeModelAvailability();
  const models = getResolvedModels();

  const agent = new Agent({
    name: options.participantName,
    instructions: [
      SPECIALIST_PROMPTS["meeting-roleplayer-specialist"] ?? "",
      ``,
      `You are ${options.participantName}, ${options.participantRole}.`,
      `Your position in this meeting: ${options.participantPosition}`,
    ].join("\n"),
    model: models.fast,
    tools: [],
  });

  const prompt = [
    `Meeting so far:`,
    ...options.transcript.slice(-12).map((turn) => `${turn.speaker}: ${turn.content}`),
    ``,
    `The second line professional now says: ${options.userStatement}`,
    ``,
    `Reply in character, in two or three sentences.`,
  ].join("\n");

  try {
    const result = await run(agent, prompt, { maxTurns: 2 });
    const output =
      typeof result.finalOutput === "string"
        ? result.finalOutput
        : "I will come back to you on that point.";
    return {
      output: applyOutputGuardrails(output).text,
      source: "live",
      model: models.fast,
      durationMs: Date.now() - startedMs,
    };
  } catch (error) {
    log.warn("A meeting participant turn failed.", { error });
    return {
      output: "I do not have that to hand. Let me come back to you with the detail after this call.",
      source: "seeded",
      model: models.fast,
      durationMs: Date.now() - startedMs,
    };
  }
}
