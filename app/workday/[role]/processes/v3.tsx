/**
 * Processes, V3.4.
 *
 * The landing page for role-specific process work. For flagship roles (rcsa,
 * tprm) this surfaces the installed process apps with the status of their
 * active run, read from the process engine. A role with no run says so; no
 * card is filled in from a constant.
 *
 * A second sub-view lists the AI Routines (?view=routines). When
 * ?routine=<id> is set, the routine's own row is shown above the list: its
 * trigger, status and run times. The page does not compose a summary of what
 * a routine found, because that would be a static account of live work.
 *
 * Synthetic institution and data.
 */

import { notFound } from "next/navigation";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { isDatabaseReady } from "@/db/client";
import { getScenarioState } from "@/scenario/engine/state";
import { getRoutines } from "@/db/repositories/role-app-runtime";
import { AIRoutinesList } from "@/components/workday-v3/AIRoutinesList";
import { buildProcessCards } from "@/features/process/view";
import { readRoleAppAvailability } from "@/role-apps/enablement";
import type { Language } from "@/i18n/labels";
import type { RouteQuery } from "@/workday/dispatch";

const LABELS = {
  title: { en: "Processes", de: "Prozesse" },
  processApps: { en: "Active processes", de: "Aktive Prozesse" },
  aiRoutines: { en: "AI Routines", de: "KI-Routinen" },
  noApps: { en: "No process apps installed", de: "Keine Prozess-Apps installiert" },
  open: { en: "Open", de: "Oeffnen" },
  synthetic: { en: "Synthetic institution and data", de: "Synthetische Institution und Daten" },
  routinesDesc: {
    en: "Routines run automatically on behalf of your role. They read data, draft outputs and flag signals according to their trigger configuration.",
    de: "Routinen laufen automatisch im Namen Ihrer Rolle. Sie lesen Daten, erstellen Entwuerfe und markieren Signale gemaess ihrer Ausloeserkonfiguration.",
  },
  lastRun: { en: "Last run", de: "Zuletzt ausgefuehrt" },
  nextRun: { en: "Next run", de: "Naechste Ausfuehrung" },
  never: { en: "Not recorded", de: "Nicht erfasst" },
  authority: { en: "Authority class", de: "Berechtigungsklasse" },
  disabled: { en: "Disabled", de: "Gesperrt" },
  retired: { en: "Retired", de: "Ausser Betrieb" },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

function stamp(iso: string | null, language: Language): string {
  if (!iso) return pick(LABELS.never, language);
  return iso.length >= 16 ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : iso;
}

/** Compact sub-view tab row. */
function ProcessesTabRow({ roleId, activeView, language }: { roleId: string; activeView: "processes" | "routines"; language: Language }) {
  const tabs = [
    { id: "processes" as const, label: pick(LABELS.processApps, language), href: `/workday/${roleId}/processes` },
    { id: "routines" as const, label: pick(LABELS.aiRoutines, language), href: `/workday/${roleId}/processes?view=routines` },
  ];
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--wd-border)", marginBottom: "var(--wd-6)" }}>
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
              borderBottom: isActive ? "2px solid var(--wd-accent)" : "2px solid transparent",
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

/**
 * One process app card with status and Open button. A Role App the product
 * owner disabled or retired keeps its card, says so, and has no Open button
 * (the check is `readRoleAppAvailability`, src/role-apps/enablement.ts).
 */
function ProcessAppCard({
  name,
  statusLine,
  href,
  openLabel,
  disabled,
}: {
  name: string;
  statusLine: string;
  href: string;
  openLabel: string;
  disabled?: { label: string; reason: string };
}) {
  if (disabled) {
    return (
      <div
        data-testid="process-app-card"
        data-disabled="true"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--wd-4)",
          padding: "var(--wd-4)",
          background: "var(--wd-surface)",
          border: "1px solid var(--wd-border)",
          borderRadius: "var(--wd-radius-lg)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "var(--wd-text-base)", fontWeight: 600, color: "var(--wd-text)", margin: 0 }}>{name}</p>
          <p style={{ fontSize: "var(--wd-text-sm)", color: "var(--wd-text-secondary)", margin: "var(--wd-1) 0 0", overflowWrap: "anywhere" }}>{disabled.reason}</p>
        </div>
        <span className="wd-chip" data-tone="warning" style={{ flexShrink: 0 }}>
          {disabled.label}
        </span>
      </div>
    );
  }
  return (
    <div
      data-testid="process-app-card"
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
        <p style={{ fontSize: "var(--wd-text-base)", fontWeight: 600, color: "var(--wd-text)", margin: 0 }}>{name}</p>
        <p style={{ fontSize: "var(--wd-text-sm)", color: "var(--wd-text-secondary)", margin: "var(--wd-1) 0 0", overflowWrap: "anywhere" }}>{statusLine}</p>
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
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams?: RouteQuery;
}) {
  const { role } = await params;
  const roleId = parseRole(role);

  const ready = isDatabaseReady();
  const state = ready ? getScenarioState() : null;
  const language = (state?.language ?? "en") as Language;

  const rawView = typeof searchParams?.view === "string" ? searchParams.view : undefined;
  const rawRoutine = typeof searchParams?.routine === "string" ? searchParams.routine : undefined;
  const showRoutines = rawView === "routines";

  const cards = ready && state ? buildProcessCards(roleId, language) : [];
  const routines = showRoutines && ready ? getRoutines(roleId) : [];
  const selectedRoutine = rawRoutine ? routines.find((routine) => routine.id === rawRoutine) : undefined;

  return (
    <div className="wd-main-inner" data-presentation-region="role-app-library" data-presentation-ready="true">
      <h1 className="wd-page-title">{pick(LABELS.title, language)}</h1>

      <div style={{ marginTop: "var(--wd-4)" }}>
        <ProcessesTabRow roleId={roleId} activeView={showRoutines ? "routines" : "processes"} language={language} />
      </div>

      {showRoutines ? (
        <section className="wd-section" aria-label={pick(LABELS.aiRoutines, language)}>
          <p style={{ fontSize: "var(--wd-text-sm)", color: "var(--wd-text-secondary)", marginBottom: "var(--wd-5)" }}>
            {pick(LABELS.routinesDesc, language)}
          </p>
          {selectedRoutine ? (
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
              <p style={{ fontSize: "var(--wd-text-base)", fontWeight: 600, color: "var(--wd-text)", margin: "0 0 var(--wd-3)" }}>{selectedRoutine.name}</p>
              <p style={{ fontSize: "var(--wd-text-sm)", color: "var(--wd-text-secondary)", margin: 0 }}>
                {pick(LABELS.lastRun, language)}: {stamp(selectedRoutine.lastRunAt, language)}. {pick(LABELS.nextRun, language)}: {stamp(selectedRoutine.nextRunAt, language)}.{" "}
                {pick(LABELS.authority, language)}: {selectedRoutine.authorityClass}.
              </p>
            </div>
          ) : null}
          <AIRoutinesList routines={routines} language={language} activeRoutineId={rawRoutine ?? null} roleId={roleId} />
        </section>
      ) : (
        <section className="wd-section" aria-label={pick(LABELS.processApps, language)}>
          {cards.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--wd-3)" }}>
              {cards.map((card) => {
                const availability = readRoleAppAvailability(card.appId);
                return (
                  <ProcessAppCard
                    key={card.appId}
                    name={card.name}
                    statusLine={card.statusLine}
                    href={card.href}
                    openLabel={pick(LABELS.open, language)}
                    {...(availability.runnable
                      ? {}
                      : { disabled: { label: pick(availability.state === "retired" ? LABELS.retired : LABELS.disabled, language), reason: pick(availability.reason, language) } })}
                  />
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: "var(--wd-text-sm)", color: "var(--wd-text-muted)" }}>{pick(LABELS.noApps, language)}</p>
          )}
        </section>
      )}

      <span style={{ display: "block", marginTop: "var(--wd-8)", fontSize: 12, color: "var(--wd-text-muted)" }}>{pick(LABELS.synthetic, language)}</span>
    </div>
  );
}
