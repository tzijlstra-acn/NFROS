/**
 * The RCSA portfolio: every run of the RCSA Cycle Assistant, read from the
 * database.
 *
 * The Operational Risk Partner's cycle is not one run. Stage 8 can decide
 * that a material change needs an off-cycle reassessment, and completing it
 * starts a new run of the same app on the new assessment. The process page
 * then follows the new run, so this view sits above the stage map and keeps
 * every run reachable: the assessment, what triggered it, the stage it is at,
 * the residual position of its key risk, and the actions it raised that are
 * still open. Every value is read from rows; nothing is filled in.
 *
 * The residual position is the one Stage 6 recorded for the run. A run that
 * has not reached Stage 6 shows the draft position of its first line, and
 * says it is the draft.
 *
 * Reads only. Completing a stage changes the rows this reads (the run, its
 * stage records, the actions with its lineage), and the process actions
 * revalidate the workday, so the portfolio moves with the work.
 *
 * Synthetic institution and data.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { actions } from "@/db/schema/decisions";
import { assessments } from "@/db/schema/practice";
import { getArtifacts, getRunsForApp } from "@/db/repositories/role-app-runtime";
import { findOsEvent } from "@/features/events/backbone";
import type { Language } from "@/i18n/labels";
import { RCSA_CYCLE_ASSISTANT, RCSA_CYCLE_PROCESS } from "./definition";
import { appetiteLabel, assessmentScope, ratingLabel } from "./stages/shared";

export interface RcsaPortfolioRow {
  processRunId: string;
  assessmentId: string;
  assessmentTitle: string;
  currentVersionId: string;
  trigger: string;
  stage: string;
  status: "completed" | "in-progress";
  statusLabel: string;
  position: string;
  openActions: number;
  href: string;
  selected: boolean;
}

export interface RcsaPortfolioView {
  title: string;
  summary: string;
  headers: { assessment: string; trigger: string; stage: string; position: string; actions: string; status: string };
  rows: RcsaPortfolioRow[];
}

const COPY = {
  title: { en: "RCSA assessments", de: "RCSA-Bewertungen" },
  assessment: { en: "Assessment", de: "Bewertung" },
  trigger: { en: "Trigger", de: "Ausloeser" },
  stage: { en: "Stage", de: "Stufe" },
  position: { en: "Key risk position", de: "Position des Schluesselrisikos" },
  actions: { en: "Open actions", de: "Offene Massnahmen" },
  status: { en: "Status", de: "Status" },
  inProgress: { en: "In progress", de: "In Bearbeitung" },
  completed: { en: "Completed", de: "Abgeschlossen" },
  draft: { en: "draft", de: "Entwurf" },
  noLines: { en: "No lines yet", de: "Noch keine Zeilen" },
} as const;

function say(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

interface RatingFacts {
  keyRiskId?: string;
  residualLikelihood?: number;
  residualImpact?: number;
  score?: number;
  rating?: string;
  appetite?: string;
}

/** The rating record Stage 6 wrote for a run, if it reached it. */
function ratingOf(processRunId: string, runId: string): RatingFacts | null {
  const artifact = getArtifacts(processRunId, "rating-appetite", runId)
    .filter((row) => row.artifactKey === "rating-record")
    .at(-1);
  if (!artifact) return null;
  try {
    const content = JSON.parse(artifact.content ?? "{}") as { facts?: RatingFacts };
    return content.facts ?? null;
  } catch {
    return null;
  }
}

export function buildRcsaPortfolio(params: { language: Language; selectedRunId: string | null; basePath: string; runId?: string }): RcsaPortfolioView {
  const runId = params.runId ?? DEFAULT_RUN_ID;
  const language = params.language;
  const runs = getRunsForApp(RCSA_CYCLE_ASSISTANT.roleId, RCSA_CYCLE_ASSISTANT.id, runId);
  const actionRows = getDb().select().from(actions).where(eq(actions.runId, runId)).all();

  const rows = runs.map((run): RcsaPortfolioRow => {
    const completed = run.status === "completed";
    const stage = RCSA_CYCLE_PROCESS.stages.find((candidate) => candidate.id === run.currentStageId);
    const subject = getDb()
      .select()
      .from(assessments)
      .where(and(eq(assessments.runId, runId), eq(assessments.id, run.subjectId)))
      .get();
    let scope: ReturnType<typeof assessmentScope> | null = null;
    try {
      scope = assessmentScope(runId, run.subjectId);
    } catch {
      scope = null;
    }

    const started = findOsEvent(`process-run-started:${run.id}`, runId);
    const sourceRun = ((started?.payload ?? {}) as { sourceProcessRunId?: string | null }).sourceProcessRunId ?? null;
    const trigger = scope?.offCycle
      ? language === "de"
        ? `Ereignisgesteuert${sourceRun ? `, aus ${sourceRun}` : ""}`
        : `Event-driven${sourceRun ? `, from ${sourceRun}` : ""}`
      : language === "de"
        ? `Planmaessiger Zyklus ${subject?.cycle ?? ""}`.trim()
        : `Scheduled cycle ${subject?.cycle ?? ""}`.trim();

    const rated = ratingOf(run.id, runId);
    const firstLine = scope?.lines[0];
    const position = rated?.keyRiskId
      ? `${rated.keyRiskId}: ${rated.residualLikelihood ?? ""} x ${rated.residualImpact ?? ""} = ${rated.score ?? ""} ${language === "de" ? "von" : "of"} 25, ${ratingLabel(String(rated.rating ?? ""), language)}, ${appetiteLabel(String(rated.appetite ?? ""), language)}`
      : firstLine
        ? `${firstLine.riskId}: ${ratingLabel(firstLine.residualRating, language)}, ${appetiteLabel(firstLine.appetitePosition, language)} (${say(COPY.draft, language)})`
        : say(COPY.noLines, language);

    return {
      processRunId: run.id,
      assessmentId: run.subjectId,
      assessmentTitle: subject?.title ?? run.subjectId,
      currentVersionId: scope?.assessmentId ?? run.subjectId,
      trigger,
      stage: completed ? say(COPY.completed, language) : `${stage?.sequence ?? ""} ${language === "de" ? (stage?.nameDe ?? run.currentStageId) : (stage?.name ?? run.currentStageId)}`.trim(),
      status: completed ? "completed" : "in-progress",
      statusLabel: say(completed ? COPY.completed : COPY.inProgress, language),
      position,
      openActions: actionRows.filter((action) => action.sourceProcessRunId === run.id && action.status !== "completed" && action.status !== "cancelled").length,
      href: `${params.basePath}?run=${encodeURIComponent(run.id)}`,
      selected: run.id === params.selectedRunId,
    };
  });

  const open = rows.filter((row) => row.status === "in-progress").length;
  const raised = rows.reduce((total, row) => total + row.openActions, 0);
  const summary =
    language === "de"
      ? `${rows.length} Bewertungsdurchlaeufe: ${open} in Bearbeitung, ${rows.length - open} abgeschlossen; ${raised} offene Massnahmen aus diesen Durchlaeufen.`
      : `${rows.length} assessment run(s): ${open} in progress, ${rows.length - open} completed; ${raised} open action(s) raised by these runs.`;

  return {
    title: say(COPY.title, language),
    summary,
    headers: {
      assessment: say(COPY.assessment, language),
      trigger: say(COPY.trigger, language),
      stage: say(COPY.stage, language),
      position: say(COPY.position, language),
      actions: say(COPY.actions, language),
      status: say(COPY.status, language),
    },
    rows,
  };
}
