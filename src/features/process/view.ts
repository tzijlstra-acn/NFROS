/**
 * The process page view model.
 *
 * Projects the engine's state onto what the workspace renders: strings in the
 * reader's language, statuses in the product vocabulary, and every rule
 * already decided. The workspace component and the route files therefore hold
 * no business rule at all; the only thing they decide is layout.
 *
 * Reads only. Building a view never writes, so rendering the page is free of
 * side effects; the one write on page load is the resume action the page
 * calls from the browser.
 */

import type { Language } from "@/i18n/labels";
import type { RoleId } from "@/db/schema/core";
import { TOOL_REGISTRY } from "@/server/security/authority";
import { findOsEvent, listOsEvents } from "@/features/events/backbone";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { assessments } from "@/db/schema/practice";
import { getSupplier, getUser } from "@/db/repositories/workday";
import { getRun } from "@/db/repositories/role-app-runtime";
import { readArtifact } from "./artifacts";
import { buildStageContext, StageContextError } from "./context";
import {
  EVENT_TYPE_LABELS,
  MODE_LABELS,
  PREPARATION_SOURCE_NOTES,
  PREPARATION_STATE_LABELS,
  PROCESS_COPY as C,
  say,
  sourceBadge,
  STAGE_STATUS_LABELS,
  TOOL_STATE_LABELS,
} from "./copy";
import { findTask, parseTaskOutput, stageIsExecutable } from "./derive";
import { eventKey, taskKey } from "./keys";
import { getPayloadBuilder, getTaskForm, type TaskFormLayout } from "./registry";
import { recordedTaskOutput } from "./tasks";
import { toolNeedsApproval } from "./tools";
import { validateStage } from "./validator";
import type { StageContext } from "./types";
import { findActiveProcessRun } from "./orchestrator";
import { getInstalledRoleApps } from "@/role-apps/registry";

export type StageStatusKey = "completed" | "in-progress" | "waiting-for-input" | "blocked" | "ready" | "locked";

export interface SourceView {
  key: string;
  label: string;
  necessity: string;
  badge: string;
  badgeTone: "ok" | "muted" | "warning" | "danger";
  count: number;
  detail: string | null;
  records: Array<{ id: string; label: string; value: string }>;
}

/** A record a person attached to the stage, as the workspace lists it beside the sources. */
export interface StageInputView {
  id: string;
  kind: string;
  sourceId: string;
  title: string;
  /** "from <sender>", when the record names one. */
  from: string | null;
  /** Who attached it and when, in the reader's language. */
  added: string;
}

export interface PreparationView {
  state: string;
  stateKey: string;
  modeLabel: string | null;
  sourceNote: string | null;
  reason: string | null;
  canStart: boolean;
  startLabel: string;
  prepares: string[];
  summary: string | null;
  findings: Array<{ text: string; evidenceIds: string[] }>;
  inferences: Array<{ text: string; uncertainty: string; evidenceIds: string[] }>;
  contradictions: Array<{ text: string; evidenceIds: string[] }>;
  gaps: Array<{ text: string; severity: string; evidenceIds: string[] }>;
  limitations: string[];
  completedAt: string | null;
}

export interface TaskView {
  key: string;
  label: string;
  instruction: string;
  status: "pending" | "recorded";
  recordedSummary: string[];
  canRecord: boolean;
  layout: TaskFormLayout | null;
}

export interface DecisionView {
  key: string;
  label: string;
  question: string;
  binding: "seeded-decision" | "stage-decision";
  decisionId: string | null;
  status: "pending" | "recorded";
  chosenLabel: string | null;
  rationale: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  outcome: string | null;
  preparedPosition: string | null;
  uncertainty: string | null;
  options: Array<{ id: string; label: string; description: string; consequences: string[]; recommended: boolean }>;
  canRecord: boolean;
  revisable: boolean;
  decisionsHref: string;
}

export interface ToolView {
  key: string;
  label: string;
  state: string;
  stateKey: string;
  channel: string;
  authorityClass: string;
  needsApproval: boolean;
  intent: string | null;
  unavailable: string | null;
  summary: string | null;
  externalId: string | null;
  commandId: string | null;
}

export interface ArtifactView {
  id: string;
  label: string;
  version: number;
  producedBy: string;
  mode: string | null;
  createdAt: string;
  lines: string[];
}

export interface StageView {
  processRunId: string;
  stageId: string;
  stageRunId: string | null;
  roleId: RoleId;
  region: string;
  sourcesRegion: string | null;
  name: string;
  sequence: number;
  statusKey: StageStatusKey;
  statusLabel: string;
  responsibility: string;
  outcome: string;
  executable: boolean;
  notExecutableReason: string | null;
  isCurrent: boolean;
  isOpen: boolean;
  isCompleted: boolean;
  sources: SourceView[];
  /** What people attached to the stage as input (inbox messages, minutes, documents). */
  inputs: StageInputView[];
  preparation: PreparationView;
  tasks: TaskView[];
  decisions: DecisionView[];
  tools: ToolView[];
  toolsNeedApproval: boolean;
  canExecuteTools: boolean;
  artifacts: ArtifactView[];
  criteria: Array<{ label: string; met: boolean; reason: string | null }>;
  blocking: Array<{ label: string; detail: string | null }>;
  canComplete: boolean;
  completeReasons: string[];
  completion: { completedAt: string | null; completedBy: string | null; rationale: string | null } | null;
  events: Array<{ id: string; type: string; summary: string; at: string; actor: string }>;
  needsSync: boolean;
  polling: boolean;
}

export interface ProcessPageView {
  appName: string;
  subtitle: string;
  statusLine: string;
  basePath: string;
  processRunId: string;
  stages: StageContext["process"]["stages"];
  currentStageId: string;
  completedStageIds: string[];
  selectedStageId: string;
  stage: StageView;
}

function personName(userId: string | null): string | null {
  if (!userId) return null;
  try {
    const user = getUser(userId);
    return user ? `${user.name} (${userId})` : userId;
  } catch {
    return userId;
  }
}

function stageStatus(context: StageContext, blocked: boolean): StageStatusKey {
  const row = context.stageRun;
  if (!row) return "locked";
  if (row.status === "completed") return "completed";
  if (blocked) return "blocked";
  if (context.preparation.state === "completed") return "waiting-for-input";
  if (row.status === "ready" || context.preparation.state === "queued") return "ready";
  return "in-progress";
}

function artifactLines(content: Record<string, unknown>, language: Language): string[] {
  const lines: string[] = [];
  const output = (content.output ?? null) as { summary?: { en: string; de: string } } | null;
  if (output?.summary) lines.push(say(output.summary, language));
  /* A stage record may state its own outcome in plain language, both languages. */
  const recordLines = content.recordLines as Array<{ en: string; de: string }> | undefined;
  for (const line of Array.isArray(recordLines) ? recordLines : []) lines.push(say(line, language));
  const sufficiency = content.sufficiency as { summary?: Array<{ en: string; de: string }> } | null | undefined;
  for (const line of sufficiency?.summary ?? []) lines.push(say(line, language));
  const decision = content.decision as { optionId?: string | null; rationale?: string | null } | null | undefined;
  if (decision?.optionId) lines.push(`${say(C.decision, language)}: ${decision.optionId}${decision.rationale ? `. ${decision.rationale}` : ""}`);
  const dispositions = content.dispositions as Array<{ itemId: string; disposition: string; chaseDate?: string }> | undefined;
  for (const item of dispositions ?? []) {
    lines.push(`${item.itemId}: ${item.disposition}${item.chaseDate ? ` (${item.chaseDate})` : ""}`);
  }
  const conditions = content.conditions as { localActionId?: string | null; externalId?: string | null } | undefined;
  if (conditions?.localActionId) lines.push(`${conditions.localActionId}${conditions.externalId ? `, ${conditions.externalId}` : ""}`);
  const investigation = content.investigation as { externalId?: string | null; commandId?: string | null } | null | undefined;
  if (investigation?.externalId) lines.push(`${investigation.externalId} (${investigation.commandId ?? ""})`);
  return lines.slice(0, 12);
}

/** Builds the stage view from a stage context. */
export function buildStageView(context: StageContext, language: Language, decisionsBasePath: string): StageView {
  const validation = validateStage(context);
  const activeBlocking = validation.blocking.filter((result) => result.active);
  const executable = stageIsExecutable(context.stage);
  const isOpen = context.stageRun !== null && context.stageRun.status !== "completed";
  const isCompleted = context.stageRun?.status === "completed";
  const statusKey = stageStatus(context, isOpen && activeBlocking.some((result) => result.kind !== "stage-not-implemented"));
  const preparationOutput = context.preparation.output;

  /* Sources. */
  const sources: SourceView[] = context.sources.map((source) => {
    const badge = sourceBadge(source.status, source.connectorMode);
    return {
      key: source.spec.key,
      label: say(source.spec.label, language),
      necessity: say(source.necessity === "required" ? C.required : C.helpful, language),
      badge: say(badge, language),
      badgeTone: source.status === "unavailable" ? "danger" : source.status === "stale" ? "warning" : source.status === "empty" ? "muted" : "ok",
      count: source.result.records.length,
      detail: source.unavailableReason ? say(source.unavailableReason, language) : source.result.note ? say(source.result.note, language) : null,
      records: source.result.records.slice(0, 12).map((record) => ({ id: record.id, label: record.label, value: record.value })),
    };
  });

  /* Stage inputs: what people attached to the stage, read by the context builder. */
  const inputs: StageInputView[] = context.inputs.map((input) => ({
    id: input.id,
    kind: say(C.stageInputKinds[input.sourceKind], language),
    sourceId: input.sourceId,
    title: input.label ? say(input.label, language) : say(C.stageInputMissing, language),
    from: input.from ? say(C.stageInputFrom, language).replace("{from}", input.from) : null,
    added: say(C.stageInputAdded, language)
      .replace("{person}", personName(input.addedByUserId) ?? say(C.unknownPerson, language))
      .replace("{when}", input.addedAtMoment),
  }));

  /* Preparation. */
  const prepState = context.preparation.state;
  const preparation: PreparationView = {
    state: say(PREPARATION_STATE_LABELS[prepState], language),
    stateKey: prepState,
    modeLabel: context.preparation.mode ? say(MODE_LABELS[context.preparation.mode] ?? { en: context.preparation.mode, de: context.preparation.mode }, language) : null,
    sourceNote: context.preparation.source ? say(PREPARATION_SOURCE_NOTES[context.preparation.source] ?? { en: "", de: "" }, language) : null,
    reason: context.preparation.reason,
    canStart: isOpen && executable && ["waiting-for-approval", "waiting-for-source", "failed", "not-started"].includes(prepState),
    startLabel: say(prepState === "failed" ? C.tryAgain : C.startPreparation, language),
    prepares: context.stage.aiJobs.flatMap((job) => job.prepares.map((item) => say(item, language))),
    summary: preparationOutput ? say(preparationOutput.summary, language) : null,
    findings: (preparationOutput?.findings ?? []).map((finding) => ({ text: say(finding.statement, language), evidenceIds: finding.evidenceIds })),
    inferences: (preparationOutput?.inferences ?? []).map((inference) => ({
      text: say(inference.statement, language),
      uncertainty: say(inference.uncertainty, language),
      evidenceIds: inference.evidenceIds,
    })),
    contradictions: (preparationOutput?.contradictions ?? []).map((item) => ({ text: say(item.statement, language), evidenceIds: item.evidenceIds })),
    gaps: (preparationOutput?.gaps ?? []).map((gap) => ({ text: say(gap.statement, language), severity: gap.severity, evidenceIds: gap.evidenceIds })),
    limitations: (preparationOutput?.limitations ?? []).map((item) => say(item, language)),
    completedAt: context.preparation.completedAt,
  };

  /* Human tasks. */
  const tasks: TaskView[] = context.stage.humanTasks.map((spec) => {
    const recorded = recordedTaskOutput(context, spec.key);
    const form = getTaskForm(spec.form);
    /*
     * The form is filled from what the person recorded, never from the AI's
     * proposals. The proposals are shown beside each row as help; choosing is
     * the person's work, so nothing is preselected for them.
     */
    const current = recorded?.input ?? null;
    return {
      key: spec.key,
      label: say(spec.label, language),
      instruction: say(spec.instruction, language),
      status: recorded ? "recorded" : "pending",
      recordedSummary: (recorded?.summary ?? []).map((line) => say(line, language)),
      canRecord: isOpen && executable && prepState === "completed",
      layout: form && isOpen && executable ? form.fields(context, language, current ?? null) : null,
    };
  });

  /* Decisions. */
  const decisions: DecisionView[] = context.decisions.map((state) => {
    const chosen = state.options.find((option) => option.id === state.chosenOptionId);
    return {
      key: state.spec.key,
      label: say(state.spec.label, language),
      question: say(state.spec.question, language),
      binding: state.spec.binding.kind,
      decisionId: state.spec.binding.kind === "seeded-decision" && state.spec.binding.decisionId ? state.spec.binding.decisionId : null,
      status: state.status,
      chosenLabel: chosen ? say(chosen.label, language) : null,
      rationale: state.rationale,
      decidedBy: personName(state.decidedByUserId),
      decidedAt: state.decidedAt,
      outcome: state.outcome,
      preparedPosition: state.preparedPosition ? say(state.preparedPosition, language) : null,
      uncertainty: state.uncertainty && state.uncertainty.en.length > 0 ? say(state.uncertainty, language) : null,
      options: state.options.map((option) => ({
        id: option.id,
        label: say(option.label, language),
        description: say(option.description, language),
        consequences: option.consequences.map((line) => say(line, language)),
        recommended: option.isRecommended,
      })),
      /* A run with no decision of its own for the stage yet has nothing to choose from (`buildStageContext`). */
      canRecord: isOpen && executable && prepState === "completed" && (state.status === "pending" || state.revisable) && state.options.length > 0,
      revisable: state.revisable,
      decisionsHref: `${decisionsBasePath}${state.spec.binding.kind === "seeded-decision" && state.spec.binding.decisionId ? `#${state.spec.binding.decisionId}` : ""}`,
    };
  });

  /* Tools. */
  const tools: ToolView[] = context.stage.tools
    .map((spec): ToolView | null => {
      const state = context.tools.find((tool) => tool.key === spec.key);
      if (!state || state.state === "not-applicable") return null;
      const builder = getPayloadBuilder(spec.payloadBuilder);
      const built = state.state === "proposed" || state.state === "failed" ? builder?.(context) : undefined;
      const authority = toolNeedsApproval(context, spec.toolName);
      return {
        key: spec.key,
        label: say(spec.label, language),
        state: say(TOOL_STATE_LABELS[state.state], language),
        stateKey: state.state,
        channel: say(spec.channel === "outbox" ? C.externalSystem : C.localRecord, language),
        authorityClass: TOOL_REGISTRY[spec.toolName]?.authorityClass ?? "",
        needsApproval: authority.needed,
        intent: built && !("unavailable" in built) ? say(built.intentStatement, language) : null,
        unavailable: built && "unavailable" in built ? say(built.unavailable, language) : authority.refusal,
        summary: state.summary,
        externalId: state.externalId,
        commandId: state.commandId,
      };
    })
    .filter((tool): tool is ToolView => tool !== null);

  const pendingTools = tools.filter((tool) => tool.stateKey === "proposed" || tool.stateKey === "failed" || tool.stateKey === "queued");

  /* Artifacts: persisted rows only. */
  const artifacts: ArtifactView[] = context.artifacts
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((artifact) => {
      const read = readArtifact(artifact);
      return {
        id: artifact.id,
        label: read ? say(read.label, language) : artifact.label,
        version: artifact.version,
        producedBy: artifact.producedBy ?? "",
        mode: artifact.mode ? say(MODE_LABELS[artifact.mode] ?? { en: artifact.mode, de: artifact.mode }, language) : null,
        createdAt: artifact.createdAt,
        lines: read ? artifactLines(read.content, language) : [],
      };
    });

  /* Completion. */
  const completionTool = context.app.stageCompletionToolName;
  const completionAuthority = completionTool ? toolNeedsApproval(context, completionTool) : null;
  const completeReasons = validation.reasons.map((reason) => say(reason, language));
  if (completionAuthority?.refusal) completeReasons.unshift(completionAuthority.refusal);

  /* Events: this stage, newest first. */
  const events = listOsEvents({ runId: context.runId, processRunId: context.run.id, stageId: context.stage.id, language, order: "desc", limit: 8 }).map((event) => ({
    id: event.id,
    type: say(EVENT_TYPE_LABELS[event.type] ?? { en: event.type, de: event.type }, language),
    summary: event.summary,
    at: event.occurredAt,
    actor: event.actorKind,
  }));

  /* Whether the page should ask the server to bring the stage up to date. */
  const stageRun = context.stageRun;
  const seededNeedsEvent = context.decisions.some(
    (state) =>
      state.spec.binding.kind === "seeded-decision" &&
      state.status === "recorded" &&
      !findOsEvent(eventKey.seededDecisionRecorded(state.spec.binding.decisionId), context.runId),
  );
  const completionUnannounced =
    stageRun !== null && validation.canComplete && !findTask(context.tasks, taskKey.completion);
  const needsSync =
    isOpen && (prepState === "queued" || prepState === "retrying" || seededNeedsEvent || completionUnannounced);

  const completionOutput = parseTaskOutput<{ rationale?: string }>(findTask(context.tasks, taskKey.completion));

  return {
    processRunId: context.run.id,
    stageId: context.stage.id,
    stageRunId: stageRun?.id ?? null,
    roleId: context.roleId,
    region: context.app.workspaceRegion ?? `${context.roleId}-stage-workspace`,
    sourcesRegion: context.roleId === "tprm" ? "tprm-evidence-status" : null,
    name: language === "de" ? context.stage.nameDe : context.stage.name,
    sequence: context.stage.sequence,
    statusKey,
    statusLabel: say(STAGE_STATUS_LABELS[statusKey] ?? { en: statusKey, de: statusKey }, language),
    responsibility: language === "de" ? (context.stage.humanResponsibilityDe ?? context.stage.humanResponsibility) : context.stage.humanResponsibility,
    outcome: language === "de" ? (context.stage.outcomeDe ?? context.stage.outcome) : context.stage.outcome,
    executable,
    notExecutableReason: executable ? null : (context.stage.implementation.reason ? say(context.stage.implementation.reason, language) : say(C.notExecutable, language)),
    isCurrent: context.run.currentStageId === context.stage.id,
    isOpen,
    isCompleted,
    sources,
    inputs,
    preparation,
    tasks,
    decisions,
    tools,
    toolsNeedApproval: pendingTools.some((tool) => tool.needsApproval),
    canExecuteTools: isOpen && pendingTools.some((tool) => tool.unavailable === null && tool.stateKey !== "queued"),
    artifacts,
    criteria: validation.completion
      .filter((result) => result.applies)
      .map((result) => ({ label: say(result.label, language), met: result.met, reason: result.reason ? say(result.reason, language) : null })),
    blocking: activeBlocking.map((result) => ({ label: say(result.label, language), detail: result.detail ? say(result.detail, language) : null })),
    canComplete: isOpen && validation.canComplete && !completionAuthority?.refusal,
    completeReasons,
    completion: isCompleted
      ? {
          completedAt: stageRun?.completedAt ?? null,
          completedBy: personName(stageRun?.completedByUserId ?? null),
          rationale: stageRun?.completionRationale ?? completionOutput?.rationale ?? null,
        }
      : null,
    events,
    needsSync,
    polling: isOpen && prepState === "running",
  };
}

/**
 * The whole process page for a role's installed app.
 *
 * Returns null when there is no run, so the page can say so honestly rather
 * than render a static stand-in.
 */
export function buildProcessPageView(params: {
  roleId: RoleId;
  roleAppId: string;
  stageParam: string | undefined;
  language: Language;
  basePath: string;
  /**
   * A run of the same app and role, chosen with `?run=`. An app can have
   * several runs at once (two suppliers in onboarding); without the parameter
   * the page shows the active run, as before. A run of another app or role is
   * ignored rather than shown.
   */
  runParam?: string;
}): ProcessPageView | null {
  const chosen = params.runParam ? getRun(params.runParam) : undefined;
  const selected = chosen && chosen.roleId === params.roleId && chosen.roleAppId === params.roleAppId ? chosen : null;
  const run = selected ?? findActiveProcessRun(params.roleId, params.roleAppId);
  if (!run) return null;
  const basePath = selected ? `${params.basePath}?run=${encodeURIComponent(selected.id)}` : params.basePath;

  let context: StageContext;
  try {
    const current = buildStageContext({ processRunId: run.id });
    const selected =
      params.stageParam && current.process.stages.some((stage) => stage.id === params.stageParam)
        ? params.stageParam
        : run.currentStageId;
    context = selected === current.stage.id ? current : buildStageContext({ processRunId: run.id, stageId: selected });
  } catch (error) {
    if (error instanceof StageContextError) return null;
    throw error;
  }

  const language = params.language;
  const current = context.process.stages.find((stage) => stage.id === run.currentStageId);
  const completedCount = context.completedStageIds.length;
  const total = context.process.stages.length;
  const subjectLabel = subjectName(context);
  const statusLine =
    run.status === "completed"
      ? say({ en: `Completed, all ${total} stages`, de: `Abgeschlossen, alle ${total} Stufen` }, language)
      : `${say(C.stage, language)} ${current?.sequence ?? ""} ${say(C.of, language)} ${total}: ${language === "de" ? (current?.nameDe ?? "") : (current?.name ?? "")} (${completedCount} ${language === "de" ? "abgeschlossen" : "completed"})`;

  return {
    appName: language === "de" ? context.app.nameDe : context.app.name,
    subtitle: subjectLabel,
    statusLine,
    basePath,
    processRunId: run.id,
    stages: context.process.stages,
    currentStageId: run.currentStageId,
    completedStageIds: context.completedStageIds,
    selectedStageId: context.stage.id,
    stage: buildStageView(context, language, `/workday/${params.roleId}/decisions`),
  };
}

export interface ProcessCardView {
  appId: string;
  name: string;
  statusLine: string;
  href: string;
  hasRun: boolean;
}

/**
 * One card per installed app of the role, for the Processes landing page.
 *
 * The status line is read from the run and the engine's view of its current
 * stage. A role with no run says so; nothing is filled in from a constant.
 */
export function buildProcessCards(roleId: RoleId, language: Language): ProcessCardView[] {
  return getInstalledRoleApps(roleId).map((app) => {
    const href = app.entryRoute ?? `/workday/${roleId}/processes`;
    const name = language === "de" ? app.nameDe : app.name;
    const run = findActiveProcessRun(roleId, app.id);
    if (!run) {
      return { appId: app.id, name, statusLine: say(C.noRun, language), href, hasRun: false };
    }
    if (run.status === "completed") {
      return { appId: app.id, name, statusLine: say({ en: "Completed", de: "Abgeschlossen" }, language), href, hasRun: true };
    }
    try {
      const context = buildStageContext({ processRunId: run.id });
      const view = buildStageView(context, language, `/workday/${roleId}/decisions`);
      const next =
        view.preparation.stateKey !== "completed"
          ? `${say(C.aiPrepared, language)}: ${view.preparation.state}`
          : view.canComplete
            ? say({ en: "Ready to complete", de: "Bereit zum Abschluss" }, language)
            : view.statusLabel;
      const statusLine = `${say(C.stage, language)} ${context.stage.sequence} ${say(C.of, language)} ${context.process.stages.length}: ${view.name}, ${subjectName(context)}. ${next}.`;
      return { appId: app.id, name, statusLine, href, hasRun: true };
    } catch (error) {
      if (error instanceof StageContextError) {
        return { appId: app.id, name, statusLine: say(C.noRun, language), href, hasRun: false };
      }
      throw error;
    }
  });
}

/** A plain name for the run's subject, read from its own record. */
function subjectName(context: StageContext): string {
  const id = context.run.subjectId;
  if (context.run.subjectKind === "supplier") {
    const supplier = getSupplier(id, context.runId);
    return supplier ? `${supplier.name} (${id})` : id;
  }
  if (context.run.subjectKind === "assessment") {
    const assessment = getDb()
      .select()
      .from(assessments)
      .where(and(eq(assessments.runId, context.runId), eq(assessments.id, id)))
      .get();
    return assessment ? `${assessment.title} (${id})` : id;
  }
  return id;
}
