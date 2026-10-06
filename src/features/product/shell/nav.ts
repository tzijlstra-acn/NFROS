/**
 * The Product Owner Console navigation (plan 7).
 *
 * Nine primary sections, in the plan's order, plus the feedback inbox (7.8)
 * as a secondary entry, and the deep links into the existing settings and
 * operations pages, which stay where they are (plan 7: "Existing settings
 * remain available as deep links").
 *
 * Every section is listed from the first build, including those another
 * workstream is still building. A section with no page yet renders the
 * honest "In preparation" page (`InPreparation.tsx`), never a page that
 * looks finished. `owner` records which workstream builds the section, so
 * the placeholder can say so and so the handoff can name it.
 *
 * Pure and server safe: a plain array, no React, so a server layout, a
 * client navigation and a test can all import it. Icons are resolved from a
 * key in the client navigation, because a component type cannot cross the
 * server to client boundary as a prop.
 */

import type { Bilingual } from "@/product/release";

export type ConsoleSectionId =
  | "overview"
  | "role-apps"
  | "experience"
  | "quality"
  | "value"
  | "integrations"
  | "releases"
  | "pilot"
  | "operations"
  | "feedback";

export type ConsoleSectionIcon =
  | "overview"
  | "role-apps"
  | "experience"
  | "quality"
  | "value"
  | "integrations"
  | "releases"
  | "pilot"
  | "operations"
  | "feedback"
  | "settings"
  | "audit"
  | "ops";

export interface ConsoleSection {
  id: ConsoleSectionId;
  href: string;
  label: Bilingual;
  /** One line, shown on the Overview and on the "In preparation" page. */
  purpose: Bilingual;
  /** The plan section the page implements. */
  planSection: string;
  /** The workstream that builds the page. */
  owner: "os-console-core" | "os-console-quality" | "os-pilot";
  icon: ConsoleSectionIcon;
  /** Primary sections are the plan's nine; secondary entries follow them. */
  tier: "primary" | "secondary";
}

export const CONSOLE_SECTIONS: readonly ConsoleSection[] = [
  {
    id: "overview",
    href: "/product",
    label: { en: "Overview", de: "Ueberblick" },
    purpose: {
      en: "The release, the roles and Role Apps, live work, failures and what needs attention.",
      de: "Release, Rollen und Rollen-Apps, laufende Arbeit, Fehler und was Aufmerksamkeit braucht.",
    },
    planSection: "7.1",
    owner: "os-console-core",
    icon: "overview",
    tier: "primary",
  },
  {
    id: "role-apps",
    href: "/product/role-apps",
    label: { en: "Role Apps", de: "Rollen-Apps" },
    purpose: {
      en: "Lifecycle, versions, enablement and process performance of each Role App.",
      de: "Lebenszyklus, Versionen, Freischaltung und Prozessleistung jeder Rollen-App.",
    },
    planSection: "7.2, 7.3",
    owner: "os-console-core",
    icon: "role-apps",
    tier: "primary",
  },
  {
    id: "experience",
    href: "/product/experience",
    label: { en: "Experience", de: "Nutzungserlebnis" },
    purpose: {
      en: "How the working day is used, in aggregate: first action, evidence, minutes, actions and decisions.",
      de: "Wie der Arbeitstag genutzt wird, nur aggregiert: erste Handlung, Nachweise, Protokolle, Massnahmen und Entscheidungen.",
    },
    planSection: "7.4",
    owner: "os-console-core",
    icon: "experience",
    tier: "primary",
  },
  {
    id: "quality",
    href: "/product/quality",
    label: { en: "Quality", de: "Qualitaet" },
    purpose: {
      en: "AI configurations, evaluation runs, failed cases and candidate approval.",
      de: "KI-Konfigurationen, Evaluationslaeufe, fehlgeschlagene Faelle und Freigabe von Kandidaten.",
    },
    planSection: "7.5",
    owner: "os-console-quality",
    icon: "quality",
    tier: "primary",
  },
  {
    id: "value",
    href: "/product/value",
    label: { en: "Value", de: "Nutzen" },
    purpose: {
      en: "Measured value against the agreed baseline, never calculated from synthetic data.",
      de: "Gemessener Nutzen gegenueber der vereinbarten Ausgangslage, nie aus synthetischen Daten berechnet.",
    },
    planSection: "12",
    owner: "os-pilot",
    icon: "value",
    tier: "primary",
  },
  {
    id: "integrations",
    href: "/product/integrations",
    label: { en: "Integrations", de: "Integrationen" },
    purpose: {
      en: "Connector status, freshness, queued and failed commands, dead letters and mapping issues.",
      de: "Konnektorstatus, Aktualitaet, wartende und fehlgeschlagene Befehle, unzustellbare Nachrichten und Zuordnungsprobleme.",
    },
    planSection: "7.6",
    owner: "os-console-quality",
    icon: "integrations",
    tier: "primary",
  },
  {
    id: "releases",
    href: "/product/releases",
    label: { en: "Releases", de: "Releases" },
    purpose: {
      en: "Current and candidate release, migrations, the release gate, evidence pack and rollback plan.",
      de: "Aktuelles und Kandidaten-Release, Migrationen, Release-Pruefung, Nachweispaket und Rueckfallplan.",
    },
    planSection: "7.9",
    owner: "os-console-core",
    icon: "releases",
    tier: "primary",
  },
  {
    id: "pilot",
    href: "/product/pilot",
    label: { en: "Pilot", de: "Pilot" },
    purpose: {
      en: "Pilot setup, baseline, weekly view and the exit decision.",
      de: "Pilot-Einrichtung, Ausgangslage, Wochenansicht und Abschlussentscheidung.",
    },
    planSection: "7.7",
    owner: "os-pilot",
    icon: "pilot",
    tier: "primary",
  },
  {
    id: "operations",
    href: "/product/operations",
    label: { en: "Operations", de: "Betrieb" },
    purpose: {
      en: "A summary of the operations console: health, worker, job queue and incidents.",
      de: "Eine Zusammenfassung der Betriebskonsole: Zustand, Worker, Auftragswarteschlange und Vorfaelle.",
    },
    planSection: "6.1, 6.2",
    owner: "os-console-core",
    icon: "operations",
    tier: "primary",
  },
  {
    id: "feedback",
    href: "/product/feedback",
    label: { en: "Feedback", de: "Rueckmeldungen" },
    purpose: {
      en: "The structured feedback inbox: triage, links to Role App and stage, owner and severity.",
      de: "Der strukturierte Eingang fuer Rueckmeldungen: Sichtung, Verknuepfung mit Rollen-App und Phase, Verantwortung und Schweregrad.",
    },
    planSection: "7.8",
    owner: "os-console-quality",
    icon: "feedback",
    tier: "secondary",
  },
];

/** The existing administrator pages, reachable from the console unchanged. */
export const CONSOLE_DEEP_LINKS: readonly {
  href: string;
  label: Bilingual;
  icon: ConsoleSectionIcon;
}[] = [
  { href: "/settings", label: { en: "Settings", de: "Einstellungen" }, icon: "settings" },
  { href: "/ops", label: { en: "Operations console", de: "Betriebskonsole" }, icon: "ops" },
  {
    href: "/settings/audit-integrity",
    label: { en: "Audit integrity", de: "Audit-Integritaet" },
    icon: "audit",
  },
];

export function consoleSection(id: ConsoleSectionId): ConsoleSection {
  const section = CONSOLE_SECTIONS.find((entry) => entry.id === id);
  if (!section) throw new Error(`Unknown console section: ${id}`);
  return section;
}

/**
 * Whether a path belongs to a section. The Overview matches only `/product`
 * itself, because every other section is below it.
 */
export function isSectionCurrent(section: { href: string }, pathname: string): boolean {
  if (section.href === "/product") return pathname === "/product";
  return pathname === section.href || pathname.startsWith(`${section.href}/`);
}
