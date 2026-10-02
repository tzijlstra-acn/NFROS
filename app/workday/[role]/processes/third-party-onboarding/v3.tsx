/**
 * Third-Party Onboarding, V3.2.
 *
 * Renders the full eight-stage onboarding process page for the TPRM role.
 * The seeded demo case is Veridian Document Systems GmbH (TP-0099) at Stage 4
 * Evidence Review, procurement reference PRQ-2026-0087.
 *
 * Synthetic institution and data.
 */

import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { getScenarioState } from "@/scenario/engine/state";
import { NotSeeded } from "@/components/shell/WorkdayShell";
import { getSupplier } from "@/db/repositories/workday";
import {
  TPRM_ONBOARDING_PROCESS,
  TPRM_VERIDIAN_ONBOARDING_RUN,
} from "@/role-apps/tprm/definition";
import { ProcessMap } from "@/components/workday-v3/ProcessMap";
import { ProcessStageDetail } from "@/components/workday-v3/ProcessStageDetail";
import type { Language } from "@/i18n/labels";
import type { RouteQuery } from "@/workday/dispatch";

const LABELS = {
  title: { en: "Third-Party Onboarding", de: "Drittanbieter-Onboarding" },
  stageOf: { en: "Stage", de: "Stufe" },
  of: { en: "of", de: "von" },
  inProgress: { en: "in progress", de: "in Bearbeitung" },
  evidenceStatus: { en: "Evidence status", de: "Nachweisstand" },
  synthetic: { en: "Synthetic institution and data", de: "Synthetische Institution und Daten" },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

/**
 * Evidence items for the Veridian case, Stage 4 Evidence Review.
 * Shown only when the evidence-review stage is selected.
 */
const EVIDENCE_ITEMS: Array<{
  id: string;
  label: string;
  status: "accepted" | "accepted-with-condition" | "missing" | "pending";
}> = [
  {
    id: "EVD-OB-0099-01",
    label: "Vendor Information Questionnaire",
    status: "accepted",
  },
  {
    id: "EVD-OB-0099-02",
    label: "IT Security Assessment",
    status: "accepted-with-condition",
  },
  {
    id: "EVD-OB-0099-03",
    label: "Privacy Impact Assessment",
    status: "accepted",
  },
  {
    id: "EVD-OB-0099-04",
    label: "SOC 2 Type II Report 2025",
    status: "accepted",
  },
  {
    id: "EVD-OB-0099-05",
    label: "Penetration Test Report (full)",
    status: "missing",
  },
  {
    id: "EVD-OB-0099-06",
    label: "Business Continuity Plan and Test Report",
    status: "missing",
  },
  {
    id: "EVD-OB-0099-07",
    label: "Legal Review Status Note",
    status: "pending",
  },
];

function evidenceStatusStyle(
  status: "accepted" | "accepted-with-condition" | "missing" | "pending",
): React.CSSProperties {
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

function evidenceStatusLabel(
  status: "accepted" | "accepted-with-condition" | "missing" | "pending",
  language: Language,
): string {
  switch (status) {
    case "accepted":
      return language === "de" ? "Akzeptiert" : "Accepted";
    case "accepted-with-condition":
      return language === "de" ? "Akzeptiert mit Bedingung" : "Accepted with condition";
    case "missing":
      return language === "de" ? "Fehlend -- angefordert" : "Missing -- requested";
    case "pending":
      return language === "de" ? "Ausstehend (Entwurf)" : "Pending (draft)";
  }
}

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

  // Use the in-memory seeded run.
  const run = TPRM_VERIDIAN_ONBOARDING_RUN;
  const process = TPRM_ONBOARDING_PROCESS;

  // Resolve selected stage from query param or run's current stage.
  const selectedStageId =
    typeof searchParams?.stage === "string" ? searchParams.stage : run.currentStageId;

  const selectedStageRaw =
    process.stages.find((s) => s.id === selectedStageId) ??
    process.stages.find((s) => s.id === run.currentStageId) ??
    process.stages[0];

  // The process definition always has stages; this guard satisfies the type checker.
  if (!selectedStageRaw) return <NotSeeded />;
  const selectedStage = selectedStageRaw;

  const currentStage = process.stages.find((s) => s.id === run.currentStageId);
  const currentSequence = currentStage?.sequence ?? 1;

  const completedStageIds = process.stages
    .filter((s) => s.sequence < currentSequence)
    .map((s) => s.id);

  const basePath = `/workday/${role}/processes/third-party-onboarding`;

  // Supplier data from DB; fall back to static if not available.
  let supplierName = "Veridian Document Systems GmbH";
  try {
    const supplierRow = getSupplier(run.subjectId);
    if (supplierRow?.name) supplierName = supplierRow.name;
  } catch {
    // DB not seeded; use static fallback above.
  }

  const procRef = "PRQ-2026-0087";

  // Status line: "Stage 4 of 8: Evidence Review -- in progress"
  const stageLabel = language === "de" ? (currentStage?.nameDe ?? "") : (currentStage?.name ?? "");
  const statusLine = `${pick(LABELS.stageOf, language)} ${currentSequence} ${pick(LABELS.of, language)} ${process.stages.length}: ${stageLabel} -- ${pick(LABELS.inProgress, language)}`;

  // Evidence counts for Stage 4 summary.
  const acceptedCount = EVIDENCE_ITEMS.filter(
    (e) => e.status === "accepted" || e.status === "accepted-with-condition",
  ).length;
  const missingCount = EVIDENCE_ITEMS.filter((e) => e.status === "missing").length;

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

      <ProcessMap
        stages={process.stages}
        currentStageId={run.currentStageId}
        completedStageIds={completedStageIds}
        language={language}
        basePath={basePath}
        selectedStageId={selectedStage.id}
      />

      <ProcessStageDetail
        stage={selectedStage}
        run={run}
        language={language}
        isCurrentStage={selectedStage.id === run.currentStageId}
      />

      {/* Evidence status section -- shown for evidence-review stage */}
      {selectedStage.id === "evidence-review" && (
        <section
          className="wd-section"
          aria-label={pick(LABELS.evidenceStatus, language)}
          style={{ marginTop: "var(--wd-8)" }}
        >
          <h2
            style={{
              fontSize: "var(--wd-text-sm)",
              fontWeight: 600,
              color: "var(--wd-text)",
              marginBottom: "var(--wd-1)",
            }}
          >
            {pick(LABELS.evidenceStatus, language)}
          </h2>
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
            {EVIDENCE_ITEMS.map((item) => (
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
