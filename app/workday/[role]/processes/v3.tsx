/**
 * Processes, V3.3.
 *
 * The landing page for role-specific process work. For flagship roles (rcsa,
 * tprm) this surfaces the installed process apps with their current status and
 * a direct link to the active run. The two sections are rendered inline rather
 * than behind a client-side tab switcher, because the content is reference
 * material a professional scrolls rather than a wizard they step through.
 *
 * V3.3 adds a second sub-view: AI Routines. A compact tab row at the top of
 * the page switches between "Active processes" (default) and "AI Routines"
 * (?view=routines). The routines view shows the full routine list and, when
 * ?routine=<id> is also set, an expanded detail panel for that routine.
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
import { getActiveRun, getStageRuns, getRoutines } from "@/db/repositories/role-app-runtime";
import { AIRoutinesList } from "@/components/workday-v3/AIRoutinesList";
import type { Language } from "@/i18n/labels";
import type { RouteQuery } from "@/workday/dispatch";

const LABELS = {
  title: { en: "Processes", de: "Prozesse" },
  processApps: { en: "Active processes", de: "Aktive Prozesse" },
  aiRoutines: { en: "AI Routines", de: "KI-Routinen" },
  noApps: { en: "No process apps installed", de: "Keine Prozess-Apps installiert" },
  open: { en: "Open", de: "Oeffnen" },
  inProgress: { en: "In progress", de: "In Bearbeitung" },
  stage: { en: "Stage", de: "Stufe" },
  synthetic: { en: "Synthetic institution and data", de: "Synthetische Institution und Daten" },
  routinesTitle: { en: "AI Routines", de: "KI-Routinen" },
  routinesDesc: {
    en: "Routines run automatically on behalf of your role. They read data, draft outputs and flag signals according to their trigger configuration.",
    de: "Routinen laufen automatisch im Namen Ihrer Rolle. Sie lesen Daten, erstellen Entwuerfe und markieren Signale gemaess ihrer Ausloeserkonfiguration.",
  },
  morningBriefTitle: { en: "Morning Brief", de: "Morgenbriefing" },
  morningBriefTime: { en: "Today 07:45", de: "Heute 07:45" },
  regulatoryNote: {
    en: "Illustrative regulatory context, not legal advice.",
    de: "Nur illustrativer regulatorischer Kontext, keine Rechtsberatung.",
  },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

/** Compact sub-view tab row. */
function ProcessesTabRow({
  roleId,
  activeView,
  language,
}: {
  roleId: string;
  activeView: "processes" | "routines";
  language: Language;
}) {
  const tabs = [
    {
      id: "processes" as const,
      label: pick(LABELS.processApps, language),
      href: `/workday/${roleId}/processes`,
    },
    {
      id: "routines" as const,
      label: pick(LABELS.aiRoutines, language),
      href: `/workday/${roleId}/processes?view=routines`,
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--wd-border)",
        marginBottom: "var(--wd-6)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeView;
        return (
          <a
            key={tab.id}
            href={tab.href}
            style={{
              padding: "var(--wd-2) var(--wd-4)",
              fontSize: "var(--wd-text-sm)",
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--wd-accent)" : "var(--wd-text-secondary)",
              textDecoration: "none",
              borderBottom: isActive
                ? "2px solid var(--wd-accent)"
                : "2px solid transparent",
              marginBottom: -1,
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </a>
        );
      })}
    </div>
  );
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

/* ---------------------------------------------------------------------------
   Morning brief detail panels (static, seeded content)
   --------------------------------------------------------------------------- */

function MorningBriefRCSA({ language }: { language: Language }) {
  const isDE = language === "de";
  const title = isDE ? "Morgenbriefing, heute 07:45" : "Morning Brief, today 07:45";
  return (
    <div
      style={{
        padding: "var(--wd-5)",
        background: "var(--wd-surface)",
        border: "1px solid var(--wd-accent)",
        borderRadius: "var(--wd-radius-lg)",
        boxShadow: "var(--wd-shadow-sm)",
        marginBottom: "var(--wd-6)",
      }}
    >
      <p
        style={{
          fontSize: "var(--wd-text-base)",
          fontWeight: 600,
          color: "var(--wd-text)",
          margin: "0 0 var(--wd-4)",
        }}
      >
        {title}
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--wd-2)",
          fontSize: "var(--wd-text-sm)",
          color: "var(--wd-text-secondary)",
        }}
      >
        {isDE ? (
          <>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Geprueft:</strong>{" "}
              Q4 RCSA-Zyklus (Stufe 2, Nachweis-Aktualisierung, 2 Punkte offen)
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Kalender:</strong>{" "}
              RCSA Challenge Workshop um 10:30 Uhr vorbereitet
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Massnahmen:</strong>{" "}
              4 offen, 1 ueberfaellig (Q3 KRI-Daten, faellig 10.10.2026)
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Posteingang:</strong>{" "}
              2 Punkte benoetigen Aufmerksamkeit
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Nachweis:</strong>{" "}
              SOC 2 Type II Bericht laeuft in 45 Tagen ab
            </p>
            <p
              style={{
                margin: "var(--wd-3) 0 0",
                fontWeight: 600,
                color: "var(--wd-text)",
              }}
            >
              Empfohlener Fokus: Nachweisluecken-Entscheidung vor dem Workshop um 10:30 Uhr.
            </p>
          </>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Reviewed:</strong>{" "}
              Q4 RCSA Cycle (Stage 2, Evidence Refresh, 2 items outstanding)
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Calendar:</strong>{" "}
              RCSA Challenge Workshop at 10:30 prepared
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Actions:</strong>{" "}
              4 open, 1 overdue (Q3 KRI data, due 2026-10-10)
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Inbox:</strong>{" "}
              2 items requiring attention
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Evidence:</strong>{" "}
              SOC 2 Type II Report expires in 45 days
            </p>
            <p
              style={{
                margin: "var(--wd-3) 0 0",
                fontWeight: 600,
                color: "var(--wd-text)",
              }}
            >
              Suggested focus: Evidence gap decision before the 10:30 workshop.
            </p>
          </>
        )}
      </div>
      <p
        style={{
          marginTop: "var(--wd-4)",
          fontSize: 11,
          color: "var(--wd-text-muted)",
        }}
      >
        {pick(LABELS.regulatoryNote, language)}
      </p>
    </div>
  );
}

function MorningBriefTPRM({ language }: { language: Language }) {
  const isDE = language === "de";
  const title = isDE ? "Morgenbriefing, heute 07:45" : "Morning Brief, today 07:45";
  return (
    <div
      style={{
        padding: "var(--wd-5)",
        background: "var(--wd-surface)",
        border: "1px solid var(--wd-accent)",
        borderRadius: "var(--wd-radius-lg)",
        boxShadow: "var(--wd-shadow-sm)",
        marginBottom: "var(--wd-6)",
      }}
    >
      <p
        style={{
          fontSize: "var(--wd-text-base)",
          fontWeight: 600,
          color: "var(--wd-text)",
          margin: "0 0 var(--wd-4)",
        }}
      >
        {title}
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--wd-2)",
          fontSize: "var(--wd-text-sm)",
          color: "var(--wd-text-secondary)",
        }}
      >
        {isDE ? (
          <>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Geprueft:</strong>{" "}
              Veridian-Onboarding (Stufe 4, Nachweisprufung, 2 Punkte offen)
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Kalender:</strong>{" "}
              Lieferanten-Challenge-Call um 10:30 Uhr vorbereitet
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Massnahmen:</strong>{" "}
              3 offen, 1 ueberfaellig (BCM-Plan, faellig 07.10.2026)
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Posteingang:</strong>{" "}
              2 Punkte benoetigen Aufmerksamkeit
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Nachweis:</strong>{" "}
              Penetrationstest-Bericht fehlt noch, faellig 09.10.2026
            </p>
            <p
              style={{
                margin: "var(--wd-3) 0 0",
                fontWeight: 600,
                color: "var(--wd-text)",
              }}
            >
              Empfohlener Fokus: Nachweis-Hinlaenglichkeitsentscheidung einreichen, bevor Spezialistenpruefungen beginnen koennen.
            </p>
          </>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Reviewed:</strong>{" "}
              Veridian Onboarding (Stage 4, Evidence Review, 2 items outstanding)
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Calendar:</strong>{" "}
              Supplier Challenge Call at 10:30 prepared
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Actions:</strong>{" "}
              3 open, 1 overdue (BCM plan, due 2026-10-07)
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Inbox:</strong>{" "}
              2 items requiring attention
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--wd-text)" }}>Evidence:</strong>{" "}
              Penetration test report still missing, due 2026-10-09
            </p>
            <p
              style={{
                margin: "var(--wd-3) 0 0",
                fontWeight: 600,
                color: "var(--wd-text)",
              }}
            >
              Suggested focus: Submit evidence sufficiency decision before specialist reviews can begin.
            </p>
          </>
        )}
      </div>
      <p
        style={{
          marginTop: "var(--wd-4)",
          fontSize: 11,
          color: "var(--wd-text-muted)",
        }}
      >
        {pick(LABELS.regulatoryNote, language)}
      </p>
    </div>
  );
}

export default async function ProcessesV3({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams?: RouteQuery;
}) {
  const { role } = await params;
  const roleId = parseRole(role);

  const state = getScenarioState();
  const language = (state?.language ?? "en") as Language;

  const rawView = typeof searchParams?.view === "string" ? searchParams.view : undefined;
  const rawRoutine = typeof searchParams?.routine === "string" ? searchParams.routine : undefined;

  const showRoutines = rawView === "routines";
  const activeView = showRoutines ? "routines" : "processes";

  const openLabel = pick(LABELS.open, language);

  // Build the process app cards for each flagship role.
  let cards: React.ReactNode = null;

  if (roleId === "rcsa") {
    let rcsaRun: { id: string; currentStageId: string } = RCSA_PAYMENTS_Q4_RUN;
    let stageStatusSuffix = "";
    try {
      const dbRun = getActiveRun("rcsa", "rcsa-cycle-assistant");
      if (dbRun) {
        rcsaRun = dbRun;
        // Read stage-level status for the current stage.
        const stageRuns = getStageRuns(dbRun.id);
        const currentStageRun = stageRuns.find((sr) => sr.stageId === dbRun.currentStageId);
        if (currentStageRun) {
          const s = currentStageRun.status;
          if (s === "waiting-for-input" || s === "waiting-for-decision") {
            stageStatusSuffix =
              language === "de" ? " (Eingabe erforderlich)" : " (waiting for input)";
          } else if (s === "in-progress" || s === "ai-preparing" || s === "ready-for-review") {
            stageStatusSuffix = language === "de" ? " (in Bearbeitung)" : " (in progress)";
          }
        }
      }
    } catch {
      // DB not ready; static fallback above.
    }
    const process = RCSA_CYCLE_PROCESS;
    const currentStage = process.stages.find((s) => s.id === rcsaRun.currentStageId);
    const stageName = language === "de" ? (currentStage?.nameDe ?? "") : (currentStage?.name ?? "");
    const stageLine = `${pick(LABELS.inProgress, language)}, ${pick(LABELS.stage, language)} ${currentStage?.sequence ?? ""}: ${stageName}${stageStatusSuffix}`;
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
    let tprmRun: { currentStageId: string } = TPRM_VERIDIAN_ONBOARDING_RUN;
    try {
      const dbRun = getActiveRun("tprm", "tprm-third-party-onboarding");
      if (dbRun) tprmRun = dbRun;
    } catch {
      // DB not ready; static fallback above.
    }
    const process = TPRM_ONBOARDING_PROCESS;
    const currentStage = process.stages.find((s) => s.id === tprmRun.currentStageId);
    const stageName = language === "de" ? (currentStage?.nameDe ?? "") : (currentStage?.name ?? "");
    const supplierName = "Veridian Document Systems GmbH";
    const stageLine = `${pick(LABELS.inProgress, language)}, ${pick(LABELS.stage, language)} ${currentStage?.sequence ?? ""}: ${stageName}, ${supplierName}`;
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

  // Fetch routines for the routines sub-view.
  let routines: Array<{
    id: string;
    name: string;
    triggerType: string;
    status: string;
    lastRunAt: string | null;
    outputKind: string;
  }> = [];
  if (showRoutines) {
    try {
      routines = getRoutines(roleId);
    } catch {
      // DB not ready; empty list is the graceful fallback.
    }
  }

  // Determine which morning brief detail to show (if any).
  const showMorningBriefRCSA =
    showRoutines && rawRoutine === "morning-brief-rcsa" && roleId === "rcsa";
  const showMorningBriefTPRM =
    showRoutines && rawRoutine === "morning-brief-tprm" && roleId === "tprm";

  return (
    <div
      className="wd-main-inner"
      data-presentation-region="role-app-library"
      data-presentation-ready="true"
    >
      <h1 className="wd-page-title">{pick(LABELS.title, language)}</h1>

      {/* Sub-view tab row */}
      <div style={{ marginTop: "var(--wd-4)" }}>
        <ProcessesTabRow roleId={roleId} activeView={activeView} language={language} />
      </div>

      {showRoutines ? (
        /* AI Routines sub-view */
        <section className="wd-section" aria-label={pick(LABELS.routinesTitle, language)}>
          <p
            style={{
              fontSize: "var(--wd-text-sm)",
              color: "var(--wd-text-secondary)",
              marginBottom: "var(--wd-5)",
            }}
          >
            {pick(LABELS.routinesDesc, language)}
          </p>

          {/* Morning brief expanded detail when ?routine= is set */}
          {showMorningBriefRCSA ? <MorningBriefRCSA language={language} /> : null}
          {showMorningBriefTPRM ? <MorningBriefTPRM language={language} /> : null}

          <AIRoutinesList
            routines={routines}
            language={language}
            activeRoutineId={rawRoutine ?? null}
            roleId={roleId}
          />
        </section>
      ) : (
        /* Active processes sub-view (default) */
        <section
          className="wd-section"
          aria-label={pick(LABELS.processApps, language)}
        >
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
      )}

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
