/**
 * The frame every pilot page shares: heading, status, the pilot's own
 * navigation, and the honest states for "no pilot" and "not your area".
 *
 * Server component. The console layout (`app/product/layout.tsx`) already
 * renders the administrator frame and the acting persona strip; this adds
 * only what the pilot pages have in common.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { SettingsHead } from "@/components/settings/primitives";
import { Chip, Notice } from "@/components/workday-v2/primitives";
import type { Language } from "@/i18n/labels";
import { CONSOLE_COPY } from "@/features/product/shell/copy";
import { PILOT_STATUS_LABELS } from "../changes";
import type { PilotPage } from "../access";

type Pair = { en: string; de: string };

const TABS: ReadonlyArray<{ id: PilotPage; href: string; label: Pair }> = [
  { id: "overview", href: "/product/pilot", label: { en: "Overview and readiness", de: "Ueberblick und Bereitschaft" } },
  { id: "setup", href: "/product/pilot/setup", label: { en: "Setup", de: "Einrichtung" } },
  { id: "baseline", href: "/product/pilot/baseline", label: { en: "Baseline", de: "Ausgangslage" } },
  { id: "weekly", href: "/product/pilot/weekly", label: { en: "Weekly view", de: "Wochenansicht" } },
  { id: "exit", href: "/product/pilot/exit", label: { en: "Exit decision", de: "Abschlussentscheidung" } },
];

const COPY = {
  title: { en: "Pilot", de: "Pilot" },
  lede: {
    en: "The design-partner pilot: its setup, the partner's own baseline, the weekly view and the exit decision. Every change is checked against your authority and recorded in the audit trail.",
    de: "Der Designpartner-Pilot: Einrichtung, die eigene Ausgangslage des Partners, die Wochenansicht und die Abschlussentscheidung. Jede Aenderung wird gegen Ihre Befugnis geprueft und im Audit-Trail erfasst.",
  },
  pilotNav: { en: "Pilot sections", de: "Pilotbereiche" },
  readOnly: {
    en: "Read only for the Platform Product Owner. Pilot actions are the Pilot Lead's.",
    de: "Fuer den Platform Product Owner nur lesend. Pilotaktionen sind Sache der Pilotleitung.",
  },
  restricted: {
    en: "The pilot workspace is open to the Pilot Lead. The overview, weekly view and exit decisions are also open, read only, to the Platform Product Owner. Choose one of those personas at the top of the console.",
    de: "Der Pilotbereich steht der Pilotleitung offen. Ueberblick, Wochenansicht und Abschlussentscheidungen sind zusaetzlich fuer den Platform Product Owner lesbar. Waehlen Sie oben in der Konsole eine dieser Personas.",
  },
  restrictedPage: {
    en: "This page is the Pilot Lead's: it holds the cohort, the support contacts and the design partner's own figures.",
    de: "Diese Seite gehoert der Pilotleitung: Sie enthaelt die Kohorte, die Supportkontakte und die eigenen Werte des Designpartners.",
  },
  readiness: { en: "Pilot readiness settings", de: "Einstellungen Pilotbereitschaft" },
  noPilot: {
    en: "No pilot programme is configured. A reseed of the product state writes the design-partner pilot in setup.",
    de: "Es ist kein Pilotprogramm eingerichtet. Ein erneutes Einspielen des Produktzustands schreibt den Designpartner-Piloten in Einrichtung.",
  },
} as const;

export function say(pair: Pair, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

export function PilotFrame({
  language,
  current,
  status,
  name,
  readOnly,
  children,
}: {
  language: Language;
  current: PilotPage;
  status: string | null;
  name: Pair | null;
  readOnly: boolean;
  children: ReactNode;
}) {
  return (
    <div className="app-stack app-stack-5" data-testid="pilot-workspace" data-pilot-page={current}>
      <SettingsHead eyebrow={say(CONSOLE_COPY.eyebrow, language)} title={say(COPY.title, language)} lede={say(COPY.lede, language)} />
      {name ? (
        <div className="app-row app-row-wrap" style={{ rowGap: "var(--app-2)" }}>
          <span className="app-strong" style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
            {say(name, language)}
          </span>
          {status ? (
            <Chip tone={status === "running" ? "success" : status === "closed" ? "neutral" : "info"}>
              <span data-testid="pilot-status" data-status={status}>
                {say(PILOT_STATUS_LABELS[status] ?? { en: status, de: status }, language)}
              </span>
            </Chip>
          ) : null}
        </div>
      ) : null}
      <nav aria-label={say(COPY.pilotNav, language)}>
        <ul className="app-row app-row-wrap" style={{ listStyle: "none", margin: 0, padding: 0, gap: "var(--app-2)" }}>
          {TABS.map((tab) => (
            <li key={tab.id}>
              <Link
                href={tab.href}
                className={`app-btn app-btn-sm ${tab.id === current ? "app-btn-secondary" : "app-btn-quiet"}`}
                {...(tab.id === current ? { "aria-current": "page" as const } : {})}
                data-testid={`pilot-tab-${tab.id}`}
              >
                {say(tab.label, language)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {readOnly ? <Notice tone="info">{say(COPY.readOnly, language)}</Notice> : null}
      {children}
    </div>
  );
}

/** "Not your area": the reason, and who can open it. */
export function PilotRestricted({ language, page }: { language: Language; page: PilotPage }) {
  return (
    <div className="app-stack app-stack-3" data-testid="pilot-restricted">
      <Notice tone="warning">{say(page === "setup" || page === "baseline" ? COPY.restrictedPage : COPY.restricted, language)}</Notice>
      <span className="app-meta">
        <Link href="/settings/pilot" className="app-source-link">
          {say(COPY.readiness, language)}
        </Link>
      </span>
    </div>
  );
}

export function NoPilot({ language }: { language: Language }) {
  return (
    <Notice tone="warning">
      <span data-testid="pilot-none">{say(COPY.noPilot, language)}</span>
    </Notice>
  );
}

/** Wrapping secondary text. */
export function Wrap({ children }: { children: ReactNode }) {
  return (
    <span className="app-meta" style={{ display: "block", whiteSpace: "normal", maxWidth: "110ch", overflowWrap: "anywhere" }}>
      {children}
    </span>
  );
}

export function formatDate(iso: string | null | undefined, language: Language): string {
  if (!iso) return language === "de" ? "nicht vereinbart" : "not agreed";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const [date, time] = iso.split("T");
  const [year, month, day] = (date ?? "").split("-");
  return `${day}.${month}.${year} ${(time ?? "").slice(0, 5)}`;
}
