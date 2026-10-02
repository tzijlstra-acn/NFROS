/**
 * Third-Party Onboarding, V3.3.
 *
 * Operational workspace for the eight-stage TPRM onboarding process.
 *
 * Layout:
 *   Region 1: ProcessMap -- stage stepper, already works.
 *   Region 2: Stage workspace -- AI preparation, human task, evidence (stage 4
 *             only), artifacts, and stage action for the current stage.
 *   Region 3: Compact event log -- last three audit events.
 *
 * Stage 4 (evidence-review) is the active operational stage: it shows a
 * form that records the evidence sufficiency decision and advances the run
 * to stage 5 (specialist-reviews) on submit.
 *
 * All DB reads are synchronous (better-sqlite3). No Tailwind. No em dashes.
 * No umlauts. CSS vars (var(--wd-*)) only. TypeScript strict.
 *
 * Synthetic institution and data. All figures are scenario figures.
 */

import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { getScenarioState } from "@/scenario/engine/state";
import { NotSeeded } from "@/components/shell/WorkdayShell";
import { getSupplier } from "@/db/repositories/workday";
import {
  getActiveRun,
  getEvidenceDocumentsForSubject,
  getStageRuns,
  getArtifacts,
  getEvents,
} from "@/db/repositories/role-app-runtime";
import {
  TPRM_ONBOARDING_PROCESS,
  TPRM_VERIDIAN_ONBOARDING_RUN,
} from "@/role-apps/tprm/definition";
import type { RoleAppRun } from "@/role-apps/contracts";
import { ProcessMap } from "@/components/workday-v3/ProcessMap";
import type { Language } from "@/i18n/labels";
import type { RouteQuery } from "@/workday/dispatch";
import { submitStageDecision } from "./actions";

/* ---------------------------------------------------------------------------
   Labels
   --------------------------------------------------------------------------- */

const LABELS = {
  title: { en: "Third-Party Onboarding", de: "Drittanbieter-Onboarding" },
  stageOf: { en: "Stage", de: "Stufe" },
  of: { en: "of", de: "von" },
  inProgress: { en: "in progress", de: "in Bearbeitung" },
  evidenceStatus: { en: "Evidence status", de: "Nachweisstand" },
  aiPrepared: { en: "AI prepared", de: "KI vorbereitet" },
  yourResponsibility: { en: "Your responsibility", de: "Ihre Verantwortung" },
  artifacts: { en: "Artifacts", de: "Artefakte" },
  stageCompleted: { en: "Stage completed", de: "Stufe abgeschlossen" },
  stageLocked: {
    en: "Stage locked -- complete Stage 4 first",
    de: "Stufe gesperrt -- zuerst Stufe 4 abschliessen",
  },
  decisionNote: { en: "Decision note", de: "Entscheidungsnotiz" },
  submitDecision: {
    en: "Submit evidence sufficiency decision",
    de: "Nachweisausreichlichkeitsentscheidung einreichen",
  },
  recentActivity: { en: "Recent activity", de: "Letzte Aktivitaet" },
  synthetic: { en: "Synthetic institution and data", de: "Synthetische Institution und Daten" },
  accepted: { en: "Accepted", de: "Akzeptiert" },
  acceptedWithCondition: {
    en: "Accepted with condition",
    de: "Akzeptiert mit Bedingung",
  },
  missingRequested: {
    en: "Missing -- requested",
    de: "Fehlend -- angefordert",
  },
  pendingDraft: { en: "Pending (draft)", de: "Ausstehend (Entwurf)" },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

/* ---------------------------------------------------------------------------
   Offline AI preparation text per stage
   --------------------------------------------------------------------------- */

const AI_PREP_CONTENT: Record<string, string> = {
  "request-and-intake":
    "Procurement request PRQ-2026-0087 retrieved. Business owner: Thomas Zijlstra (ARC-DE). Service: Cloud document processing and payment data reconciliation. Data categories: Payment data (PII + financial). Legal entities: ARC-DE, ARC-AT. No duplicate supplier found. Onboarding case initialised.",
  "classification-and-criticality":
    "ICT classification: Outsourcing (material). Criticality: Important service (payment data processing). DORA applicability: ARC-DE and ARC-AT (EU entities). Jurisdiction: Germany and Austria. Proposed review depth: Full specialist review. Rationale: payment data criticality triggers full due diligence requirement.",
  "tailored-due-diligence":
    "7 evidence items requested, tailored to criticality and jurisdiction. Reused: VIQ template v4. New: Penetration test scope extended to payment infrastructure. Evidence request sent 2026-09-18. Due date: 2026-10-08.",
  "evidence-review":
    "4 of 7 evidence items received and assessed. Accepted: VIQ, IT Security Assessment (condition), PIA, SOC 2 Type II. Outstanding: Penetration test report (full scope), BCM plan and test report. Pending: Legal review status note. Recommendation: Proceed with specialist reviews for available evidence. Escalation required for missing items before Stage 6.",
  "specialist-reviews":
    "Stage locked. Complete Stage 4 evidence sufficiency decision first.",
  "contract-and-conditions": "Stage locked.",
  "decision-and-onboarding": "Stage locked.",
  "handover-to-monitoring": "Stage locked.",
};

/* ---------------------------------------------------------------------------
   Helper: route
   --------------------------------------------------------------------------- */

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

/* ---------------------------------------------------------------------------
   Helper: stage status
   --------------------------------------------------------------------------- */

type StageStatus = "completed" | "in-progress" | "locked" | "ready";

function resolveStageStatus(
  stageId: string,
  currentStageId: string,
  completedStageIds: string[],
): StageStatus {
  if (completedStageIds.includes(stageId)) return "completed";
  if (stageId === currentStageId) return "in-progress";
  return "locked";
}

/* ---------------------------------------------------------------------------
   Helper: stage status badge (inline JSX helper)
   --------------------------------------------------------------------------- */

function StageBadge({ status }: { status: StageStatus }) {
  type BadgeConfig = { background: string; color: string; border: string; label: string };

  const configs: Record<StageStatus, BadgeConfig> = {
    completed: {
      background: "var(--wd-success-soft)",
      color: "var(--wd-success)",
      border: "1px solid var(--wd-success)",
      label: "Completed",
    },
    "in-progress": {
      background: "var(--wd-accent-soft)",
      color: "var(--wd-accent)",
      border: "1px solid var(--wd-accent-border)",
      label: "In Progress",
    },
    locked: {
      background: "var(--wd-surface-subtle)",
      color: "var(--wd-text-muted)",
      border: "1px solid var(--wd-border)",
      label: "Locked",
    },
    ready: {
      background: "var(--wd-surface)",
      color: "var(--wd-text-secondary)",
      border: "1px solid var(--wd-border)",
      label: "Ready",
    },
  };

  const cfg = configs[status];

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px var(--wd-2)",
        borderRadius: "var(--wd-radius-pill)",
        fontSize: "var(--wd-text-xs)",
        fontWeight: 500,
        background: cfg.background,
        color: cfg.color,
        border: cfg.border,
        lineHeight: "1.4",
      }}
    >
      {cfg.label}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Helper: evidence display status
   --------------------------------------------------------------------------- */

type EvidenceDisplayStatus = "accepted" | "accepted-with-condition" | "missing" | "pending";

function deriveEvidenceStatus(doc: { status: string; summary: string }): EvidenceDisplayStatus {
  if (doc.status === "requested" || doc.status === "missing") return "missing";
  if (doc.status === "draft") return "pending";
  const upper = doc.summary.toUpperCase();
  if (upper.includes("WITH CONDITION") || upper.includes("APPROVED WITH")) {
    return "accepted-with-condition";
  }
  return "accepted";
}

function evidenceStatusStyle(status: EvidenceDisplayStatus): React.CSSProperties {
  switch (status) {
    case "accepted":
      return {
        color: "var(--wd-success)",
        background: "var(--wd-success-soft)",
        border: "1px solid var(--wd-success)",
      };
    case "accepted-with-condition":
      return {
        color: "var(--wd-warning)",
        background: "var(--wd-warning-soft)",
        border: "1px solid var(--wd-warning)",
      };
    case "missing":
      return {
        color: "var(--wd-danger)",
        background: "var(--wd-danger-soft)",
        border: "1px solid var(--wd-danger)",
      };
    case "pending":
      return {
        color: "var(--wd-text-secondary)",
        background: "var(--wd-surface-subtle)",
        border: "1px solid var(--wd-border)",
      };
  }
}

function evidenceStatusLabel(status: EvidenceDisplayStatus, language: Language): string {
  switch (status) {
    case "accepted":
      return pick(LABELS.accepted, language);
    case "accepted-with-condition":
      return pick(LABELS.acceptedWithCondition, language);
    case "missing":
      return pick(LABELS.missingRequested, language);
    case "pending":
      return pick(LABELS.pendingDraft, language);
  }
}

/* ---------------------------------------------------------------------------
   Helper: format event kind for display
   --------------------------------------------------------------------------- */

function formatEventKind(kind: string): string {
  return kind.replace(/-/g, " ");
}

/* ---------------------------------------------------------------------------
   Page component
   --------------------------------------------------------------------------- */

export default async function ThirdPartyOnboardingV3({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams?: RouteQuery;
}) {
  const { role } = await params;
  const roleId = parseRole(role);

  // TPRM only. Other roles should not reach this route.
  if (roleId !== "tprm") notFound();

  if (!isDatabaseReady()) return <NotSeeded />;
  const state = getScenarioState();
  if (!state) return <NotSeeded />;

  const language = (state.language ?? "en") as Language;

  // --------------------------------------------------------------------------
  // Run
  // --------------------------------------------------------------------------

  const dbRun = getActiveRun("tprm", "tprm-third-party-onboarding");
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
    : TPRM_VERIDIAN_ONBOARDING_RUN;

  const process = TPRM_ONBOARDING_PROCESS;

  // --------------------------------------------------------------------------
  // Selected stage (from ?stage= query param or current stage)
  // --------------------------------------------------------------------------

  const selectedStageId =
    typeof searchParams?.stage === "string" ? searchParams.stage : run.currentStageId;

  const selectedStageRaw =
    process.stages.find((s) => s.id === selectedStageId) ??
    process.stages.find((s) => s.id === run.currentStageId) ??
    process.stages[0];

  if (!selectedStageRaw) return <NotSeeded />;
  const selectedStage = selectedStageRaw;

  const currentStage = process.stages.find((s) => s.id === run.currentStageId);
  const currentSequence = currentStage?.sequence ?? 1;

  // --------------------------------------------------------------------------
  // Stage run data
  // --------------------------------------------------------------------------

  let completedStageIds: string[] = [];
  let currentStageRunId: string | null = null;

  if (dbRun) {
    const stageRuns = getStageRuns(dbRun.id);
    completedStageIds = stageRuns
      .filter((sr) => sr.status === "completed")
      .map((sr) => sr.stageId);
    const currentSR = stageRuns.find((sr) => sr.stageId === run.currentStageId);
    currentStageRunId = currentSR?.id ?? null;
  } else {
    completedStageIds = process.stages
      .filter((s) => s.sequence < currentSequence)
      .map((s) => s.id);
  }

  // --------------------------------------------------------------------------
  // Artifacts for the selected stage
  // --------------------------------------------------------------------------

  const artifacts = dbRun ? getArtifacts(dbRun.id, selectedStage.id) : [];

  // --------------------------------------------------------------------------
  // Events (Region 3)
  // --------------------------------------------------------------------------

  const allEvents = dbRun ? getEvents(run.id) : [];
  const recentEvents = allEvents.slice(-3);

  // --------------------------------------------------------------------------
  // Supplier info and process status line
  // --------------------------------------------------------------------------

  const basePath = `/workday/${role}/processes/third-party-onboarding`;

  let supplierName = "Veridian Document Systems GmbH";
  try {
    const supplierRow = getSupplier(run.subjectId);
    if (supplierRow?.name) supplierName = supplierRow.name;
  } catch {
    // DB not seeded; use static fallback.
  }

  const procRef = "PRQ-2026-0087";
  const stageLabel =
    language === "de" ? (currentStage?.nameDe ?? "") : (currentStage?.name ?? "");
  const statusLine = `${pick(LABELS.stageOf, language)} ${currentSequence} ${pick(LABELS.of, language)} ${process.stages.length}: ${stageLabel} -- ${pick(LABELS.inProgress, language)}`;

  // --------------------------------------------------------------------------
  // Evidence items for Stage 4
  // --------------------------------------------------------------------------

  let evidenceItems: Array<{ id: string; label: string; status: EvidenceDisplayStatus }> = [];
  try {
    const docs = getEvidenceDocumentsForSubject(run.subjectId);
    evidenceItems = docs.map((doc) => ({
      id: doc.id,
      label: doc.title,
      status: deriveEvidenceStatus(doc),
    }));
  } catch {
    // DB not seeded or evidence not available; render empty list.
  }

  const acceptedCount = evidenceItems.filter(
    (e) => e.status === "accepted" || e.status === "accepted-with-condition",
  ).length;
  const missingCount = evidenceItems.filter((e) => e.status === "missing").length;

  // --------------------------------------------------------------------------
  // Derived state for the selected stage workspace
  // --------------------------------------------------------------------------

  const selectedStageStatus = resolveStageStatus(
    selectedStage.id,
    run.currentStageId,
    completedStageIds,
  );

  const isCurrentSelectedStage = selectedStage.id === run.currentStageId;
  const selectedStageName = language === "de" ? selectedStage.nameDe : selectedStage.name;
  const aiPrepText =
    AI_PREP_CONTENT[selectedStage.id] ??
    "No AI preparation available for this stage.";

  /* --------------------------------------------------------------------------
     Render
     -------------------------------------------------------------------------- */

  return (
    <div className="wd-main-inner">
      {/* Page header */}
      <h1 className="wd-page-title">
        {language === "de" ? "Drittanbieter-Onboarding" : "Third-Party Onboarding"}
      </h1>
      <p
        style={{
          fontSize: "var(--wd-text-base)",
          color: "var(--wd-text-secondary)",
          marginTop: "var(--wd-1)",
        }}
      >
        {supplierName} -- {procRef}
      </p>
      <p
        style={{
          fontSize: "var(--wd-text-sm)",
          color: "var(--wd-text-muted)",
          marginTop: "var(--wd-1)",
        }}
      >
        {statusLine}
      </p>

      {/* -----------------------------------------------------------------------
          Region 1: Process map
          --------------------------------------------------------------------- */}
      <ProcessMap
        stages={process.stages}
        currentStageId={run.currentStageId}
        completedStageIds={completedStageIds}
        language={language}
        basePath={basePath}
        selectedStageId={selectedStage.id}
      />

      {/* -----------------------------------------------------------------------
          Region 2: Stage workspace
          --------------------------------------------------------------------- */}
      <section
        aria-label={selectedStageName}
        style={{
          marginTop: "var(--wd-8)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--wd-6)",
        }}
      >
        {/* Stage name + status badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--wd-3)",
            flexWrap: "wrap",
          }}
        >
          <h2
            style={{
              fontSize: "var(--wd-text-xl)",
              fontWeight: "var(--wd-weight-strong)" as unknown as number,
              color: "var(--wd-text)",
              lineHeight: "var(--wd-leading-tight)",
              margin: 0,
            }}
          >
            {selectedStageName}
          </h2>
          <StageBadge status={selectedStageStatus} />
        </div>

        {/* AI preparation box */}
        <div
          style={{
            padding: "var(--wd-4)",
            background: "var(--wd-accent-soft)",
            border: "1px solid var(--wd-accent-border)",
            borderRadius: "var(--wd-radius)",
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: "var(--wd-text-xs)",
              fontWeight: "var(--wd-weight-strong)" as unknown as number,
              color: "var(--wd-accent)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "var(--wd-2)",
            }}
          >
            {pick(LABELS.aiPrepared, language)}
          </span>
          <p
            style={{
              fontSize: "var(--wd-text-sm)",
              color: "var(--wd-text-secondary)",
              lineHeight: "var(--wd-leading-normal)",
              margin: 0,
            }}
          >
            {aiPrepText}
          </p>
        </div>

        {/* Human task description */}
        <div>
          <span
            style={{
              display: "block",
              fontSize: "var(--wd-text-xs)",
              fontWeight: "var(--wd-weight-medium)" as unknown as number,
              color: "var(--wd-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "var(--wd-2)",
            }}
          >
            {pick(LABELS.yourResponsibility, language)}
          </span>
          <p
            style={{
              fontSize: "var(--wd-text-base)",
              color: isCurrentSelectedStage ? "var(--wd-text)" : "var(--wd-text-secondary)",
              fontWeight: isCurrentSelectedStage
                ? ("var(--wd-weight-medium)" as unknown as number)
                : undefined,
              lineHeight: "var(--wd-leading-snug)",
              margin: 0,
            }}
          >
            {selectedStage.humanResponsibility}
          </p>
        </div>

        {/* Evidence status section -- Stage 4 only */}
        {selectedStage.id === "evidence-review" && (
          <section aria-label={pick(LABELS.evidenceStatus, language)}>
            <h3
              style={{
                fontSize: "var(--wd-text-sm)",
                fontWeight: 600,
                color: "var(--wd-text)",
                marginBottom: "var(--wd-1)",
              }}
            >
              {pick(LABELS.evidenceStatus, language)}
            </h3>
            <p
              style={{
                fontSize: "var(--wd-text-xs)",
                color: "var(--wd-text-muted)",
                marginBottom: "var(--wd-3)",
              }}
            >
              {acceptedCount} {language === "de" ? "akzeptiert" : "accepted"},{" "}
              {missingCount} {language === "de" ? "fehlend" : "missing"} --{" "}
              {language === "de" ? "Stand 06.10.2026" : "as at 06.10.2026"}
            </p>
            {evidenceItems.length > 0 ? (
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--wd-2)",
                }}
              >
                {evidenceItems.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--wd-3)",
                      padding: "var(--wd-2) var(--wd-3)",
                      background: "var(--wd-surface)",
                      border: "1px solid var(--wd-border)",
                      borderRadius: "var(--wd-radius)",
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: "var(--wd-text-xs)",
                        color: "var(--wd-text-muted)",
                        fontFamily: "var(--wd-font-mono)",
                        minWidth: 120,
                      }}
                    >
                      {item.id}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: "var(--wd-text-sm)",
                        color: "var(--wd-text)",
                      }}
                    >
                      {item.label}
                    </span>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: "var(--wd-text-xs)",
                        fontWeight: 500,
                        padding: "2px var(--wd-2)",
                        borderRadius: "var(--wd-radius-pill)",
                        ...evidenceStatusStyle(item.status),
                      }}
                    >
                      {evidenceStatusLabel(item.status, language)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p
                style={{
                  fontSize: "var(--wd-text-sm)",
                  color: "var(--wd-text-muted)",
                  margin: 0,
                }}
              >
                {language === "de"
                  ? "Keine Nachweise verfuegbar."
                  : "No evidence items available."}
              </p>
            )}
          </section>
        )}

        {/* Artifacts */}
        {artifacts.length > 0 && (
          <section aria-label={pick(LABELS.artifacts, language)}>
            <h3
              style={{
                fontSize: "var(--wd-text-sm)",
                fontWeight: 600,
                color: "var(--wd-text)",
                marginBottom: "var(--wd-2)",
              }}
            >
              {pick(LABELS.artifacts, language)}
            </h3>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "var(--wd-2)",
              }}
            >
              {artifacts.map((artifact) => (
                <li
                  key={artifact.id}
                  style={{
                    padding: "var(--wd-2) var(--wd-3)",
                    background: "var(--wd-surface)",
                    border: "1px solid var(--wd-border)",
                    borderRadius: "var(--wd-radius)",
                    fontSize: "var(--wd-text-sm)",
                    color: "var(--wd-text-secondary)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "var(--wd-text-xs)",
                      color: "var(--wd-text-muted)",
                      fontFamily: "var(--wd-font-mono)",
                      marginRight: "var(--wd-2)",
                    }}
                  >
                    {artifact.artifactKind}
                  </span>
                  {artifact.label}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Stage action */}
        {selectedStageStatus === "completed" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--wd-2)",
              padding: "var(--wd-3) var(--wd-4)",
              background: "var(--wd-success-soft)",
              border: "1px solid var(--wd-success)",
              borderRadius: "var(--wd-radius)",
            }}
          >
            <span
              style={{
                fontSize: "var(--wd-text-sm)",
                color: "var(--wd-success)",
                fontWeight: 500,
              }}
            >
              {pick(LABELS.stageCompleted, language)}
            </span>
          </div>
        )}

        {selectedStageStatus === "in-progress" &&
          selectedStage.id === "evidence-review" &&
          dbRun !== undefined &&
          currentStageRunId !== null && (
            <section
              aria-label={pick(LABELS.submitDecision, language)}
              style={{
                padding: "var(--wd-5)",
                background: "var(--wd-surface)",
                border: "1px solid var(--wd-border)",
                borderRadius: "var(--wd-radius)",
              }}
            >
              <h3
                style={{
                  fontSize: "var(--wd-text-sm)",
                  fontWeight: 600,
                  color: "var(--wd-text)",
                  marginBottom: "var(--wd-4)",
                }}
              >
                {pick(LABELS.submitDecision, language)}
              </h3>
              <form
                action={submitStageDecision}
                style={{ display: "flex", flexDirection: "column", gap: "var(--wd-4)" }}
              >
                {/* Hidden fields */}
                <input type="hidden" name="stageRunId" value={currentStageRunId} />
                <input type="hidden" name="runId" value={run.id} />
                <input type="hidden" name="currentStageId" value={run.currentStageId} />
                <input type="hidden" name="roleId" value={roleId} />

                {/* Decision note */}
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--wd-1)" }}>
                  <label
                    htmlFor="decision-note"
                    style={{
                      fontSize: "var(--wd-text-xs)",
                      fontWeight: "var(--wd-weight-medium)" as unknown as number,
                      color: "var(--wd-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {pick(LABELS.decisionNote, language)}
                  </label>
                  <textarea
                    id="decision-note"
                    name="note"
                    rows={3}
                    defaultValue="Proceed with available evidence. Escalate missing penetration test and BCM plan."
                    style={{
                      width: "100%",
                      padding: "var(--wd-2) var(--wd-3)",
                      fontSize: "var(--wd-text-sm)",
                      color: "var(--wd-text)",
                      background: "var(--wd-surface-subtle)",
                      border: "1px solid var(--wd-border)",
                      borderRadius: "var(--wd-radius)",
                      lineHeight: "var(--wd-leading-normal)",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Submit button */}
                <div>
                  <button
                    type="submit"
                    style={{
                      padding: "var(--wd-2) var(--wd-5)",
                      fontSize: "var(--wd-text-sm)",
                      fontWeight: 500,
                      color: "var(--wd-surface)",
                      background: "var(--wd-accent)",
                      border: "none",
                      borderRadius: "var(--wd-radius)",
                      cursor: "pointer",
                    }}
                  >
                    {pick(LABELS.submitDecision, language)}
                  </button>
                </div>
              </form>
            </section>
          )}

        {selectedStageStatus === "locked" && (
          <div
            style={{
              padding: "var(--wd-3) var(--wd-4)",
              background: "var(--wd-surface-subtle)",
              border: "1px solid var(--wd-border)",
              borderRadius: "var(--wd-radius)",
            }}
          >
            <span
              style={{
                fontSize: "var(--wd-text-sm)",
                color: "var(--wd-text-muted)",
              }}
            >
              {pick(LABELS.stageLocked, language)}
            </span>
          </div>
        )}
      </section>

      {/* -----------------------------------------------------------------------
          Region 3: Compact event log (last 3 events)
          --------------------------------------------------------------------- */}
      {recentEvents.length > 0 && (
        <section
          aria-label={pick(LABELS.recentActivity, language)}
          style={{ marginTop: "var(--wd-8)" }}
        >
          <h3
            style={{
              fontSize: "var(--wd-text-sm)",
              fontWeight: 600,
              color: "var(--wd-text)",
              marginBottom: "var(--wd-3)",
            }}
          >
            {pick(LABELS.recentActivity, language)}
          </h3>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "var(--wd-2)",
            }}
          >
            {recentEvents.map((evt) => {
              const ts = evt.at.length >= 16 ? evt.at.slice(0, 16).replace("T", " ") : evt.at;
              return (
                <li
                  key={evt.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--wd-3)",
                    padding: "var(--wd-2) var(--wd-3)",
                    background: "var(--wd-surface)",
                    border: "1px solid var(--wd-border)",
                    borderRadius: "var(--wd-radius)",
                    fontSize: "var(--wd-text-xs)",
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      color: "var(--wd-text-muted)",
                      fontFamily: "var(--wd-font-mono)",
                      minWidth: 120,
                    }}
                  >
                    {ts}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      color: "var(--wd-text-secondary)",
                    }}
                  >
                    {formatEventKind(evt.eventKind)}
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      color: "var(--wd-text-muted)",
                    }}
                  >
                    {evt.actorKind}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Synthetic data notice */}
      <span
        style={{
          display: "block",
          marginTop: "var(--wd-8)",
          fontSize: 12,
          color: "var(--wd-text-muted)",
        }}
      >
        {pick(LABELS.synthetic, language)}
      </span>
    </div>
  );
}
