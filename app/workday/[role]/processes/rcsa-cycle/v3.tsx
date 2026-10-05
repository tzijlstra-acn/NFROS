/**
 * RCSA Cycle Assistant, V3.3.
 *
 * Renders the eight-stage RCSA process page for the Operational Risk Partner
 * role. The stage stepper is navigated via query param "?stage=<id>". The
 * current stage is determined from the seeded run.
 *
 * V3.3 additions over V3.2:
 *   - ProcessStageDetail replaced by StageWorkspace (Region 2).
 *   - AI preparation content seeded inline per stage (offline mode).
 *   - Stage action button for the in-progress stage (evidence-refresh).
 *   - Server action `submitStageDecision` completes and advances the run.
 *   - Artifacts shown per stage (DB read + static fallback).
 *   - Recent events (last 3 for this run) shown in collapsible audit section.
 *
 * No em dashes. No umlauts. No Tailwind. Server component.
 * Synthetic institution and data.
 */

import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { getScenarioState } from "@/scenario/engine/state";
import { getDecisions } from "@/db/repositories/workday";
import {
  getActiveRun,
  getStageRuns,
  getArtifacts,
  getEvents,
} from "@/db/repositories/role-app-runtime";
import { ProcessMap } from "@/components/workday-v3/ProcessMap";
import {
  StageWorkspace,
  type StageStatusKind,
  type StageArtifact,
  type StageEvent,
} from "@/components/workday-v3/StageWorkspace";
import {
  RCSA_CYCLE_PROCESS,
  RCSA_PAYMENTS_Q4_RUN,
} from "@/role-apps/rcsa/definition";
import type { RoleAppRun } from "@/role-apps/contracts";
import type { Language } from "@/i18n/labels";
import type { RouteQuery } from "@/workday/dispatch";
import { submitStageDecision } from "./actions";

const BASE_PATH = "/workday/rcsa/processes/rcsa-cycle";

/* ---------------------------------------------------------------------------
   Offline AI preparation content and human tasks, per stage.
   In a live deployment these come from the AI preparation DB output.
   In offline / demo mode they are seeded inline here.
   --------------------------------------------------------------------------- */

interface StageContent {
  aiPreparation: string;
  humanTask: string;
}

const STAGE_CONTENT: Record<string, StageContent> = {
  "scope-trigger": {
    aiPreparation:
      "Scope confirmed as ARC-DE Payments Operations (PAYOPS-2026). Trigger: Scheduled quarterly cycle. Previous cycle: Q1-2026. Proposed participants: Risk Ops (Thomas Zijlstra), Finance (Anna Mueller), Compliance (Max Weber). Workshop placeholder created: 2026-10-10.",
    humanTask: "Scope confirmed, trigger classified as scheduled.",
  },
  "evidence-refresh": {
    aiPreparation:
      "Retrieved 4 of 6 required evidence sources. Missing: Q3 KRI data (requested 2026-10-01), Control test BCA-CTRL-142 (overdue). Available: Incident log (5 events, 1 P2), Process telemetry (within tolerance), Prior assessment (Q1-2026, rated Moderate). Evidence gap: 2 items require escalation decision.",
    humanTask:
      "Decide evidence sufficiency. Either waive missing items or escalate. This determines whether to proceed to Stage 3 or request a two-week hold.",
  },
  "risk-control-change": {
    aiPreparation:
      "Evidence corpus accepted. Risk and control delta analysis in progress. Changes against Q1-2026 assessment will be surfaced here once stage is entered.",
    humanTask:
      "Determine what the evidence says about risk likelihood. Zero recorded losses and no detected errors produce different conclusions depending on whether the detection controls can actually see the outcome.",
  },
  "first-line-input": {
    aiPreparation:
      "Awaiting first-line control owner submissions. Agenda for challenge workshop will be prepared once risk and control changes are confirmed.",
    humanTask:
      "Set the workshop agenda. The order in which contested items are heard determines whether the room arrives at a disputed rating with momentum or with fatigue.",
  },
  "challenge-workshop": {
    aiPreparation:
      "Challenge workshop preparation pending. Meeting preparation will be loaded 30 minutes before the workshop.",
    humanTask:
      "Challenge the first-line position on the contested control and record the second-line conclusion.",
  },
  "rating-appetite": {
    aiPreparation:
      "Residual ratings will be computed from agreed control effectiveness after the challenge workshop is concluded.",
    humanTask:
      "Ratify the residual rating for RSK-0211. The score of 12 is outside appetite and triggers either a committed remediation plan or a Risikoakzeptanz signed by the entity Chief Operating Officer.",
  },
  "actions-approval": {
    aiPreparation:
      "Remediation action plan will be drafted once residual ratings are approved.",
    humanTask:
      "Approve the assessment version and confirm the recorded rationale is your own.",
  },
  "monitoring-reassessment": {
    aiPreparation:
      "Monitoring plan will be configured after actions and approval stage is complete.",
    humanTask:
      "Confirm the monitoring plan. Enhanced monitoring of KRI-PAY-007 (override rate) and KRI-RES-005 (tested fallback arrangements) applies until the remediation actions close.",
  },
};

/* ---------------------------------------------------------------------------
   Static artifact fallbacks (offline mode; DB artifacts take precedence).
   --------------------------------------------------------------------------- */

const STATIC_ARTIFACTS: Record<string, StageArtifact[]> = {
  "scope-trigger": [
    {
      label: "Workshop placeholder",
      content:
        "RCSA-ARC-DE-PAYOPS-2026-Q4 Challenge Workshop, scheduled 2026-10-10 10:30",
    },
  ],
  "evidence-refresh": [
    {
      label: "Evidence pack",
      content:
        "4 of 6 sources loaded. Gap list: Q3 KRI data, Control test BCA-CTRL-142.",
    },
  ],
};

/* ---------------------------------------------------------------------------
   Copy
   --------------------------------------------------------------------------- */

const COPY = {
  title: { en: "RCSA Cycle Assistant", de: "RCSA-Zyklus-Assistent" },
  subtitle: {
    en: "Payments Execution Q4, Arcadia Bank AG DE",
    de: "Zahlungsausfuehrung Q4, Arcadia Bank AG DE",
  },
  openDecision: { en: "Open decision", de: "Offene Entscheidung" },
  viewDecision: { en: "View decision", de: "Entscheidung anzeigen" },
  noRun: {
    en: "No active RCSA run. Seed the database to see the Payments Execution Q4 scenario.",
    de: "Kein aktiver RCSA-Durchlauf. Datenbank befuellen, um das Szenario Zahlungsausfuehrung Q4 zu sehen.",
  },
  synthetic: { en: "Synthetic institution and data", de: "Synthetische Institution und Daten" },
  submitDecision: { en: "Submit evidence decision", de: "Nachweisentscheidung einreichen" },
  noteLabel: { en: "Note (optional)", de: "Notiz (optional)" },
  notePlaceholder: {
    en: "Record your reasoning for proceeding or escalating...",
    de: "Begruendung fuer Fortfahren oder Eskalation erfassen...",
  },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

/* ---------------------------------------------------------------------------
   Stage status helper
   --------------------------------------------------------------------------- */

function resolveStageStatus(
  stageId: string,
  stageRunStatus: string | undefined,
  isCurrent: boolean,
): StageStatusKind {
  if (stageRunStatus === undefined) {
    // No stage run row -- stage has not been entered yet.
    return "locked";
  }
  switch (stageRunStatus) {
    case "completed":
      return "completed";
    case "waiting-for-input":
    case "waiting-for-decision":
      return "waiting-for-input";
    case "in-progress":
    case "ai-preparing":
    case "ready-for-review":
      return "in-progress";
    case "ready":
      return "ready";
    default:
      return "locked";
  }
}

/* ---------------------------------------------------------------------------
   Page
   --------------------------------------------------------------------------- */

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
  const stages = RCSA_CYCLE_PROCESS.stages;

  // Read the active run from the database; fall back to the static constant if
  // the row is absent (DB seeded without the runtime tables, or reset in progress).
  const dbRun = getActiveRun("rcsa", "rcsa-cycle-assistant");
  const run: RoleAppRun = dbRun
    ? {
        id: dbRun.id,
        roleAppId: dbRun.roleAppId,
        roleId: dbRun.roleId as "rcsa" | "tprm",
        subjectKind: dbRun.subjectKind,
        subjectId: dbRun.subjectId,
        currentStageId: dbRun.currentStageId,
        status: dbRun.status as RoleAppRun["status"],
        startedAt: dbRun.startedAt,
        updatedAt: dbRun.updatedAt,
        completedAt: dbRun.completedAt ?? null,
      }
    : RCSA_PAYMENTS_Q4_RUN;

  const currentStage = stages.find((s) => s.id === run.currentStageId);
  if (!currentStage) notFound();

  // Load all stage runs and events. When dbRun is absent, use empty arrays and
  // infer state from position.
  const stageRunRows = dbRun ? getStageRuns(dbRun.id) : [];
  const stageRunMap = new Map(stageRunRows.map((sr) => [sr.stageId, sr]));

  // Completed stage IDs: authoritative from stage run records.
  const completedStageIds = stageRunRows
    .filter((sr) => sr.status === "completed")
    .map((sr) => sr.stageId);

  // When DB is absent, infer completion from sequence position.
  const effectiveCompletedStageIds =
    dbRun
      ? completedStageIds
      : stages.filter((s) => s.sequence < currentStage.sequence).map((s) => s.id);

  // Determine selected stage from query or default to current.
  const rawStage = Array.isArray(searchParams?.stage)
    ? searchParams.stage[0]
    : searchParams?.stage;
  const selectedStageId =
    rawStage && stages.some((s) => s.id === rawStage) ? rawStage : run.currentStageId;

  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? currentStage;
  const isCurrentStage = selectedStageId === run.currentStageId;

  // Resolve stage status for the selected stage.
  const selectedStageRun = stageRunMap.get(selectedStageId);
  const stageStatus: StageStatusKind = dbRun
    ? resolveStageStatus(selectedStageId, selectedStageRun?.status, isCurrentStage)
    : // Static fallback: completed if before current, waiting-for-input if current, locked otherwise.
      effectiveCompletedStageIds.includes(selectedStageId)
      ? "completed"
      : isCurrentStage
      ? "waiting-for-input"
      : "locked";

  // Load artifacts for the selected stage; fall back to static per-stage data.
  let artifacts: StageArtifact[];
  if (dbRun) {
    const dbArtifacts = getArtifacts(dbRun.id, selectedStageId);
    if (dbArtifacts.length > 0) {
      artifacts = dbArtifacts.map((a) => ({
        label: a.label,
        content: a.content ?? "",
      }));
    } else {
      artifacts = STATIC_ARTIFACTS[selectedStageId] ?? [];
    }
  } else {
    artifacts = STATIC_ARTIFACTS[selectedStageId] ?? [];
  }

  // Load recent events (last 3 for the whole run).
  let recentEvents: StageEvent[];
  if (dbRun) {
    const allEvents = getEvents(dbRun.id);
    recentEvents = allEvents
      .slice(-3)
      .reverse()
      .map((ev) => ({
        eventKind: ev.eventKind,
        at: ev.at,
        actorKind: ev.actorKind,
      }));
  } else {
    recentEvents = [];
  }

  // Inline content for the selected stage.
  const stageContent: StageContent = STAGE_CONTENT[selectedStageId] ?? {
    aiPreparation: "AI preparation pending.",
    humanTask: "",
  };

  // Build action form: only for the current, actionable stage.
  const showActionForm =
    isCurrentStage &&
    (stageStatus === "waiting-for-input" || stageStatus === "in-progress") &&
    selectedStageRun !== undefined;

  const stageRunId = selectedStageRun?.id ?? "";

  const actionForm = showActionForm ? (
    <form
      action={submitStageDecision}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--wd-4)",
        padding: "var(--wd-4)",
        background: "var(--wd-surface)",
        border: "1.5px solid var(--wd-accent-border)",
        borderRadius: "var(--wd-radius)",
      }}
    >
      {/* Hidden context fields */}
      <input type="hidden" name="stageRunId" value={stageRunId} />
      <input type="hidden" name="runId" value={run.id} />
      <input type="hidden" name="currentStageId" value={selectedStageId} />
      <input type="hidden" name="roleId" value={role} />
      <input type="hidden" name="decision" value="proceed" />

      {/* Note textarea */}
      <div>
        <label
          htmlFor="stage-decision-note"
          style={{
            display: "block",
            fontSize: "var(--wd-text-sm)",
            fontWeight: "var(--wd-weight-medium)" as unknown as number,
            color: "var(--wd-text)",
            marginBottom: "var(--wd-2)",
          }}
        >
          {pick(COPY.noteLabel, language)}
        </label>
        <textarea
          id="stage-decision-note"
          name="note"
          rows={3}
          placeholder={pick(COPY.notePlaceholder, language)}
          style={{
            width: "100%",
            padding: "var(--wd-3)",
            fontSize: "var(--wd-text-sm)",
            color: "var(--wd-text)",
            background: "var(--wd-surface-subtle)",
            border: "1px solid var(--wd-border)",
            borderRadius: "var(--wd-radius)",
            resize: "vertical",
            fontFamily: "inherit",
            lineHeight: "var(--wd-leading-normal)",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Submit button */}
      <div>
        <button
          type="submit"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "var(--wd-2) var(--wd-5)",
            background: "var(--wd-accent)",
            color: "#fff",
            fontSize: "var(--wd-text-sm)",
            fontWeight: "var(--wd-weight-medium)" as unknown as number,
            borderRadius: "var(--wd-radius)",
            border: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {pick(COPY.submitDecision, language)}
        </button>
      </div>
    </form>
  ) : null;

  // Load decisions for the selected stage.
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

      {/* Region 1: Stage stepper */}
      <div style={{ marginTop: "var(--wd-6)" }}>
        <ProcessMap
          stages={stages}
          currentStageId={run.currentStageId}
          completedStageIds={effectiveCompletedStageIds}
          language={language}
          basePath={BASE_PATH}
          selectedStageId={selectedStageId}
        />
      </div>

      {/* Region 2+3: Stage workspace (AI prep, human task, artifacts, events, action) */}
      <StageWorkspace
        stage={selectedStage}
        stageStatus={stageStatus}
        aiPreparation={stageContent.aiPreparation}
        humanTask={stageContent.humanTask}
        artifacts={artifacts}
        recentEvents={recentEvents}
        actionForm={actionForm}
        language={language}
      />

      {/* Open decisions for this stage */}
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
