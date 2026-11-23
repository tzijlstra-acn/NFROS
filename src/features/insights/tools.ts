/**
 * The governed step of an analysis: `analyseQuestion` (READ).
 *
 * Every analysis, from the Ask bar, a case, the Insights page or the AI
 * Partner, goes through `executeTool("analyseQuestion", ...)`, so the
 * authority gate decides whether it may run and the call is audited and
 * recorded either way. The handler takes the role, the moment and the
 * language from the tool context rather than the payload, builds the
 * response from the records and validates it against the schema. An answer
 * that does not validate is returned as a refusal with its issues, never
 * shown as if it were sound.
 *
 * Registered once per process, as the other tool modules do.
 */

import { hasToolHandler, registerToolHandler, type ToolHandlerResult } from "@/agents/tools/runtime";
import { requireScenarioState } from "@/scenario/engine/state";
import { loadAnalyticsData } from "./data";
import { getIntent, routeQuestion } from "./intents";
import { validateInsight, type InsightResponse } from "./schema";

export const ANALYSE_QUESTION_TOOL = "analyseQuestion";

export type AnalysisToolData =
  | { ok: true; response: InsightResponse }
  | { ok: false; reason: "no-intent" | "invalid"; issues: string[] };

function formatMoment(date: string, moment: string): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}, ${moment}`;
}

function register(): void {
  if (hasToolHandler(ANALYSE_QUESTION_TOOL)) return;
  registerToolHandler(ANALYSE_QUESTION_TOOL, (payload, context): ToolHandlerResult => {
    const question = typeof payload["question"] === "string" ? payload["question"].trim().slice(0, 600) : "";
    const caseContext =
      payload["context"] && typeof payload["context"] === "object"
        ? (payload["context"] as { kind?: unknown; id?: unknown })
        : null;
    const subject =
      caseContext && typeof caseContext.kind === "string" && typeof caseContext.id === "string"
        ? { kind: caseContext.kind, id: caseContext.id }
        : null;
    const requested = typeof payload["intentId"] === "string" ? getIntent(payload["intentId"]) : undefined;
    const intent = requested ?? routeQuestion(question, subject)?.intent;
    if (!intent || question.length === 0) {
      const data: AnalysisToolData = { ok: false, reason: "no-intent", issues: [] };
      return { summary: "No analysis matches the question; nothing was read beyond the routing.", data, objectKind: "insight", objectId: "none" };
    }
    const state = requireScenarioState(context.runId);
    const dataset = loadAnalyticsData({
      runId: context.runId,
      roleId: context.roleId,
      atMoment: context.atMoment,
      today: state.scenarioDate,
      language: context.language,
    });
    /* A builder that cannot work with the records it finds refuses; it never fails the tool call. */
    let built: unknown;
    try {
      built = intent.build({
        data: dataset,
        question,
        roleId: context.roleId,
        language: context.language,
        dataAsOf: formatMoment(state.scenarioDate, context.atMoment),
        context: subject,
      });
    } catch (error) {
      const data: AnalysisToolData = { ok: false, reason: "invalid", issues: [error instanceof Error ? error.message : String(error)] };
      return { summary: `The ${intent.id} analysis could not be built from the records and was not shown.`, data, objectKind: "insight", objectId: intent.id };
    }
    const checked = validateInsight(built);
    if (!checked.ok) {
      const data: AnalysisToolData = { ok: false, reason: "invalid", issues: checked.issues };
      return { summary: `The ${intent.id} analysis did not pass its schema and was not shown.`, data, objectKind: "insight", objectId: intent.id };
    }
    const data: AnalysisToolData = { ok: true, response: checked.response };
    return {
      summary: `Analysed "${question.slice(0, 80)}" as ${intent.id}: ${checked.response.metrics.length} figures, ${checked.response.visualisations.length} visuals, ${checked.response.evidence.length} evidence items. Nothing was changed.`,
      data,
      objectKind: "insight",
      objectId: intent.id,
      evidenceIds: checked.response.evidence.map((item) => item.recordId).slice(0, 24),
    };
  });
}

register();
