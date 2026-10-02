/**
 * RCSA Cycle Assistant, V3.
 *
 * Renders the eight-stage RCSA process page for the Operational Risk Partner
 * role. The stage stepper is navigated via query param "?stage=<id>". The
 * current stage is determined from the seeded run. Completed stages are all
 * stages with a lower sequence number than the current one.
 *
 * Decision integration: for the selected stage, any open decisions whose
 * judgmentKind matches a decisionKind in the stage are shown as a compact
 * summary below the stage detail. The full decision flow is on the decisions
 * page; this surfaces only the headline and a link.
 *
 * No em dashes. No umlauts. No Tailwind. Server component.
 * Synthetic institution and data.
 */

import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { getScenarioState } from "@/scenario/engine/state";
import { getDecisions } from "@/db/repositories/workday";
import { NotSeeded } from "@/components/shell/WorkdayShell";
import { ProcessMap } from "@/components/workday-v3/ProcessMap";
import { ProcessStageDetail } from "@/components/workday-v3/ProcessStageDetail";
import {
  RCSA_CYCLE_PROCESS,
  RCSA_PAYMENTS_Q4_RUN,
} from "@/role-apps/rcsa/definition";
import type { Language } from "@/i18n/labels";
import type { RouteQuery } from "@/workday/dispatch";

const BASE_PATH = "/workday/rcsa/processes/rcsa-cycle";

const COPY = {
  title: { en: "RCSA Cycle Assistant", de: "RCSA-Zyklus-Assistent" },
  subtitle: {
    en: "Payments Execution Q4 -- Arcadia Bank AG DE",
    de: "Zahlungsausfuehrung Q4 -- Arcadia Bank AG DE",
  },
  openDecision: { en: "Open decision", de: "Offene Entscheidung" },
  viewDecision: { en: "View decision", de: "Entscheidung anzeigen" },
  noRun: {
    en: "No active RCSA run. Seed the database to see the Payments Execution Q4 scenario.",
    de: "Kein aktiver RCSA-Durchlauf. Datenbank befuellen, um das Szenario Zahlungsausfuehrung Q4 zu sehen.",
  },
  synthetic: { en: "Synthetic institution and data", de: "Synthetische Institution und Daten" },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

/** All stages whose sequence is strictly less than the current stage sequence. */
function getCompletedStageIds(
  stages: typeof RCSA_CYCLE_PROCESS.stages,
  currentStageId: string,
): string[] {
  const current = stages.find((s) => s.id === currentStageId);
  if (!current) return [];
  return stages.filter((s) => s.sequence < current.sequence).map((s) => s.id);
}

export const dynamic = "force-dynamic";

export default async function RcsaCycleV3({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams?: RouteQuery;
}) {
  const { role } = await params;

  // Only the rcsa role has this process.
  if (role !== "rcsa") notFound();

  const dbReady = isDatabaseReady();
  const state = getScenarioState();

  if (!dbReady || !state) {
    return (
      <div className="wd-main-inner">
        <h1 className="wd-page-title">{COPY.title.en}</h1>
        <p
          style={{
            marginTop: "var(--wd-4)",
            fontSize: "var(--wd-text-sm)",
            color: "var(--wd-text-muted)",
          }}
        >
          {COPY.noRun.en}
        </p>
        <span
          style={{
            display: "block",
            marginTop: "var(--wd-8)",
            fontSize: 12,
            color: "var(--wd-text-muted)",
          }}
        >
          {COPY.synthetic.en}
        </span>
      </div>
    );
  }

  const language = state.language as Language;
  const run = RCSA_PAYMENTS_Q4_RUN;
  const stages = RCSA_CYCLE_PROCESS.stages;

  const currentStage = stages.find((s) => s.id === run.currentStageId);
  if (!currentStage) notFound();

  const completedStageIds = getCompletedStageIds(stages, run.currentStageId);

  // Determine selected stage from query or default to current.
  const rawStage = Array.isArray(searchParams?.stage)
    ? searchParams.stage[0]
    : searchParams?.stage;
  const selectedStageId =
    rawStage && stages.some((s) => s.id === rawStage) ? rawStage : run.currentStageId;

  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? currentStage;
  const isCurrentStage = selectedStageId === run.currentStageId;

  // Load decisions for the selected stage: filter by judgmentKind intersection.
  const allDecisions = getDecisions("rcsa", state.currentMoment);
  const stageDecisionKinds = new Set(selectedStage.decisionKinds);
  const stageDecisions = allDecisions.filter(
    (entry) =>
      entry.decision.status === "open" &&
      stageDecisionKinds.has(entry.decision.judgmentKind),
  );

  return (
    <div className="wd-main-inner">
      {/* Page header */}
      <h1 className="wd-page-title">{pick(COPY.title, language)}</h1>
      <p
        className="wd-context-line"
        style={{ marginTop: "var(--wd-1)" }}
      >
        {pick(COPY.subtitle, language)}
      </p>

      {/* Stage stepper */}
      <div style={{ marginTop: "var(--wd-6)" }}>
        <ProcessMap
          stages={stages}
          currentStageId={run.currentStageId}
          completedStageIds={completedStageIds}
          language={language}
          basePath={BASE_PATH}
          selectedStageId={selectedStageId}
        />
      </div>

      {/* Stage detail */}
      <ProcessStageDetail
        stage={selectedStage}
        run={run}
        language={language}
        isCurrentStage={isCurrentStage}
      />

      {/* Decisions for this stage */}
      {stageDecisions.length > 0 ? (
        <section
          className="wd-section"
          aria-label={pick(COPY.openDecision, language)}
          style={{ marginTop: "var(--wd-8)" }}
        >
          <h3
            style={{
              fontSize: "var(--wd-text-sm)",
              fontWeight: "var(--wd-weight-strong)" as unknown as number,
              color: "var(--wd-text)",
              marginBottom: "var(--wd-3)",
            }}
          >
            {pick(COPY.openDecision, language)}
          </h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--wd-2)",
            }}
          >
            {stageDecisions.map((entry) => {
              const title =
                language === "de" && entry.decision.titleDe.length > 0
                  ? entry.decision.titleDe
                  : entry.decision.title;
              const decisionHref = `/workday/rcsa/decisions#${entry.decision.id}`;
              return (
                <div
                  key={entry.decision.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--wd-4)",
                    padding: "var(--wd-3) var(--wd-4)",
                    background: "var(--wd-surface-subtle)",
                    border: "1px solid var(--wd-border)",
                    borderRadius: "var(--wd-radius)",
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: "var(--wd-text-xs)",
                        color: "var(--wd-text-muted)",
                        marginBottom: "var(--wd-1)",
                      }}
                    >
                      {entry.decision.reference}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--wd-text-base)",
                        fontWeight: "var(--wd-weight-medium)" as unknown as number,
                        color: "var(--wd-text)",
                      }}
                    >
                      {title}
                    </span>
                  </div>
                  <a
                    href={decisionHref}
                    className="wd-btn wd-btn-sm"
                    style={{
                      flexShrink: 0,
                      fontSize: "var(--wd-text-sm)",
                      padding: "var(--wd-1) var(--wd-3)",
                      border: "1px solid var(--wd-border)",
                      borderRadius: "var(--wd-radius)",
                      background: "var(--wd-surface)",
                      color: "var(--wd-text)",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {pick(COPY.viewDecision, language)}
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Synthetic data disclosure */}
      <span
        style={{
          display: "block",
          marginTop: "var(--wd-10)",
          fontSize: 12,
          color: "var(--wd-text-muted)",
        }}
      >
        {pick(COPY.synthetic, language)}
      </span>
    </div>
  );
}
