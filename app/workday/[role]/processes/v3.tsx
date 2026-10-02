/**
 * Processes, V3.1.
 *
 * The landing page for role-specific process work. For flagship roles (rcsa,
 * tprm) this surfaces the installed process apps with their current status and
 * a direct link to the active run. The two sections are rendered inline rather
 * than behind a client-side tab switcher, because the content is reference
 * material a professional scrolls rather than a wizard they step through.
 *
 * Synthetic institution and data.
 */

import { notFound } from "next/navigation";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { getScenarioState } from "@/scenario/engine/state";
import {
  RCSA_CYCLE_PROCESS,
  RCSA_PAYMENTS_Q4_RUN,
} from "@/role-apps/rcsa/definition";
import {
  TPRM_ONBOARDING_PROCESS,
  TPRM_VERIDIAN_ONBOARDING_RUN,
} from "@/role-apps/tprm/definition";
import type { Language } from "@/i18n/labels";
import type { RouteQuery } from "@/workday/dispatch";

const LABELS = {
  title: { en: "Processes", de: "Prozesse" },
  processApps: { en: "Process apps", de: "Prozess-Apps" },
  noApps: { en: "No process apps installed", de: "Keine Prozess-Apps installiert" },
  open: { en: "Open", de: "Oeffnen" },
  inProgress: { en: "In progress", de: "In Bearbeitung" },
  stage: { en: "Stage", de: "Stufe" },
  synthetic: { en: "Synthetic institution and data", de: "Synthetische Institution und Daten" },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

/** One process app card with status and Open button. */
function ProcessAppCard({
  name,
  statusLine,
  href,
  openLabel,
}: {
  name: string;
  statusLine: string;
  href: string;
  openLabel: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--wd-4)",
        padding: "var(--wd-4)",
        background: "var(--wd-surface)",
        border: "1px solid var(--wd-border)",
        borderRadius: "var(--wd-radius-lg)",
        boxShadow: "var(--wd-shadow-sm)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: "var(--wd-text-base)",
            fontWeight: 600,
            color: "var(--wd-text)",
            margin: 0,
          }}
        >
          {name}
        </p>
        <p
          style={{
            fontSize: "var(--wd-text-sm)",
            color: "var(--wd-text-secondary)",
            margin: "var(--wd-1) 0 0",
          }}
        >
          {statusLine}
        </p>
      </div>
      <a
        href={href}
        style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          padding: "var(--wd-2) var(--wd-4)",
          background: "var(--wd-accent)",
          color: "#fff",
          fontSize: "var(--wd-text-sm)",
          fontWeight: 500,
          borderRadius: "var(--wd-radius)",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        {openLabel}
      </a>
    </div>
  );
}

export default async function ProcessesV3({
  params,
}: {
  params: Promise<{ role: string }>;
  searchParams?: RouteQuery;
}) {
  const { role } = await params;
  const roleId = parseRole(role);

  const state = getScenarioState();
  const language = (state?.language ?? "en") as Language;

  const openLabel = pick(LABELS.open, language);

  // Build the process app cards for each flagship role.
  let cards: React.ReactNode = null;

  if (roleId === "rcsa") {
    const run = RCSA_PAYMENTS_Q4_RUN;
    const process = RCSA_CYCLE_PROCESS;
    const currentStage = process.stages.find((s) => s.id === run.currentStageId);
    const stageName = language === "de" ? (currentStage?.nameDe ?? "") : (currentStage?.name ?? "");
    const stageLine = `${pick(LABELS.inProgress, language)}, ${pick(LABELS.stage, language)} ${currentStage?.sequence ?? ""}: ${stageName}`;
    const appName = language === "de" ? "RCSA-Zyklus-Assistent" : "RCSA Cycle Assistant";
    cards = (
      <ProcessAppCard
        name={appName}
        statusLine={stageLine}
        href={`/workday/${roleId}/processes/rcsa-cycle`}
        openLabel={openLabel}
      />
    );
  } else if (roleId === "tprm") {
    const run = TPRM_VERIDIAN_ONBOARDING_RUN;
    const process = TPRM_ONBOARDING_PROCESS;
    const currentStage = process.stages.find((s) => s.id === run.currentStageId);
    const stageName = language === "de" ? (currentStage?.nameDe ?? "") : (currentStage?.name ?? "");
    // Supplier name from stable seed data (no DB query needed on landing page).
    const supplierName = "Veridian Document Systems GmbH";
    const stageLine = `${pick(LABELS.inProgress, language)}, ${pick(LABELS.stage, language)} ${currentStage?.sequence ?? ""}: ${stageName} -- ${supplierName}`;
    const appName = language === "de" ? "Drittanbieter-Onboarding" : "Third-Party Onboarding";
    cards = (
      <ProcessAppCard
        name={appName}
        statusLine={stageLine}
        href={`/workday/${roleId}/processes/third-party-onboarding`}
        openLabel={openLabel}
      />
    );
  }

  return (
    <div className="wd-main-inner">
      <h1 className="wd-page-title">{pick(LABELS.title, language)}</h1>

      <section
        className="wd-section"
        aria-label={pick(LABELS.processApps, language)}
        style={{ marginTop: "var(--wd-6)" }}
      >
        <h2
          style={{
            fontSize: "var(--wd-text-sm)",
            fontWeight: 600,
            color: "var(--wd-text)",
            marginBottom: "var(--wd-3)",
          }}
        >
          {pick(LABELS.processApps, language)}
        </h2>

        {cards != null ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--wd-3)",
            }}
          >
            {cards}
          </div>
        ) : (
          <p
            style={{
              fontSize: "var(--wd-text-sm)",
              color: "var(--wd-text-muted)",
            }}
          >
            {pick(LABELS.noApps, language)}
          </p>
        )}
      </section>

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
