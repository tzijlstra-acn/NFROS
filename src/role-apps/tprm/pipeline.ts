/**
 * The onboarding pipeline: every Third-Party Onboarding file of the role, read
 * from the database.
 *
 * The Third-Party Risk Manager has more than one supplier in onboarding at a
 * time, so the onboarding page shows the pipeline above the stage map and
 * lets the person open each file. It is also the portfolio's onboarding
 * view: for each file the stage it is at, the conditions still open on the
 * supplier, and whether monitoring is active. Every number is counted from
 * rows; a file with nothing open says nothing is open.
 *
 * It is also the run switcher. Without `?run=` the page opens the engine's
 * active run, the most recently started one, which is the same run Home, the
 * Processes card, the landing page and the role selector name. In the seeded
 * day that is the Veridian file (started 15.09.2026), the one the day's story
 * is told around; the Elbmarsch file started earlier (08.09.2026), so working
 * on it does not move the default. Every other file opens from here with
 * `?run=` in the address.
 *
 * Reads only. Completing a stage changes the rows this reads (the run's
 * stage, the actions, the monitoring activations), and the process actions
 * revalidate the workday, so the pipeline moves with the work.
 *
 * Synthetic institution and data.
 */

import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { getRunsForApp } from "@/db/repositories/role-app-runtime";
import type { Language } from "@/i18n/labels";
import { THIRD_PARTY_ONBOARDING_APP, TPRM_ONBOARDING_PROCESS } from "./definition";
import { monitoringFor, openActionsFor, supplierRow } from "./stages/shared";

export interface OnboardingPipelineRow {
  processRunId: string;
  supplierId: string;
  supplierName: string;
  stage: string;
  status: "completed" | "in-progress";
  statusLabel: string;
  openConditions: number;
  monitoring: string;
  href: string;
  selected: boolean;
}

export interface OnboardingPipelineView {
  title: string;
  summary: string;
  /** Which file is on screen and how to open another, or null when none of the rows is. */
  showing: string | null;
  headers: { supplier: string; stage: string; conditions: string; monitoring: string; status: string };
  rows: OnboardingPipelineRow[];
}

const COPY = {
  title: { en: "Onboarding pipeline", de: "Onboarding-Pipeline" },
  supplier: { en: "Supplier", de: "Lieferant" },
  stage: { en: "Stage", de: "Stufe" },
  conditions: { en: "Open conditions", de: "Offene Bedingungen" },
  monitoring: { en: "Monitoring", de: "Ueberwachung" },
  status: { en: "Status", de: "Status" },
  inProgress: { en: "In progress", de: "In Bearbeitung" },
  completed: { en: "Completed", de: "Abgeschlossen" },
  notActive: { en: "Not active", de: "Nicht aktiv" },
} as const;

function say(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

const FREQUENCY_DE: Record<string, string> = {
  weekly: "woechentlich",
  monthly: "monatlich",
  quarterly: "quartalsweise",
  "semi-annual": "halbjaehrlich",
};

export function buildOnboardingPipeline(params: {
  language: Language;
  selectedRunId: string | null;
  basePath: string;
  runId?: string;
}): OnboardingPipelineView {
  const runId = params.runId ?? DEFAULT_RUN_ID;
  const language = params.language;
  const runs = getRunsForApp(THIRD_PARTY_ONBOARDING_APP.roleId, THIRD_PARTY_ONBOARDING_APP.id, runId);

  const rows = runs.map((run): OnboardingPipelineRow => {
    const stage = TPRM_ONBOARDING_PROCESS.stages.find((candidate) => candidate.id === run.currentStageId);
    const supplier = supplierRow(runId, run.subjectId);
    const monitoring = monitoringFor(runId, run.subjectId);
    const latest = monitoring.at(-1);
    const completed = run.status === "completed";
    return {
      processRunId: run.id,
      supplierId: run.subjectId,
      supplierName: supplier?.name ?? run.subjectId,
      stage: completed
        ? say(COPY.completed, language)
        : `${stage?.sequence ?? ""} ${language === "de" ? (stage?.nameDe ?? run.currentStageId) : (stage?.name ?? run.currentStageId)}`.trim(),
      status: completed ? "completed" : "in-progress",
      statusLabel: say(completed ? COPY.completed : COPY.inProgress, language),
      openConditions: openActionsFor(runId, run.subjectId).length,
      monitoring: latest ? (language === "de" ? (FREQUENCY_DE[latest.reviewFrequency] ?? latest.reviewFrequency) : latest.reviewFrequency) : say(COPY.notActive, language),
      href: `${params.basePath}?run=${encodeURIComponent(run.id)}`,
      selected: run.id === params.selectedRunId,
    };
  });

  const open = rows.filter((row) => row.status === "in-progress").length;
  const conditions = rows.reduce((total, row) => total + row.openConditions, 0);
  const summary =
    language === "de"
      ? `${open} Akten im Onboarding, ${rows.length - open} abgeschlossen; ${conditions} offene Bedingungen auf diesen Lieferanten.`
      : `${open} file(s) in onboarding, ${rows.length - open} completed; ${conditions} open condition(s) on these suppliers.`;

  const onScreen = rows.find((row) => row.selected);
  const showing = onScreen
    ? language === "de"
      ? `Angezeigt: ${onScreen.supplierName}. Waehlen Sie einen anderen Lieferanten, um dessen Akte zu oeffnen.`
      : `Showing ${onScreen.supplierName}. Select another supplier to open its file.`
    : null;

  return {
    title: say(COPY.title, language),
    summary,
    showing,
    headers: {
      supplier: say(COPY.supplier, language),
      stage: say(COPY.stage, language),
      conditions: say(COPY.conditions, language),
      monitoring: say(COPY.monitoring, language),
      status: say(COPY.status, language),
    },
    rows,
  };
}
