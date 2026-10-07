/**
 * The console Overview (plan 7.1), quiet by default (plan 9.1).
 *
 * One material alert at the top, if there is one; the ten figures; then the
 * four questions, each with its first three answers and the rest behind
 * "View all". Every figure and answer comes from `readOverview`, which reads
 * real sources; a figure that cannot be read says Unavailable.
 *
 * Server component.
 */

import Link from "next/link";
import { SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Dot, Empty, List, Notice } from "@/components/workday-v2/primitives";
import { StatusBadge, statusLabel } from "@/product/status";
import type { Language } from "@/i18n/labels";
import type { Bilingual } from "../permissions";
import { CONSOLE_COPY } from "../shell/copy";
import { consoleFigureGridStyle, consoleWrapStyle } from "../shell/styles";
import { readOverview, type OverviewItem } from "./model";

const COPY = {
  title: { en: "Overview", de: "Ueberblick" },
  lede: {
    en: "The product as it stands now: release, roles and Role Apps, live work, failures, quality, connectors and the pilot. Every figure is read on this request.",
    de: "Das Produkt im aktuellen Stand: Release, Rollen und Rollen-Apps, laufende Arbeit, Fehler, Qualitaet, Konnektoren und Pilot. Jede Zahl wird bei dieser Anfrage gelesen.",
  },
  figures: { en: "At a glance", de: "Auf einen Blick" },
  release: { en: "Current release", de: "Aktuelles Release" },
  deployed: { en: "deployed record", de: "Bereitstellungsdatensatz" },
  notDeployed: { en: "not deployed through the console", de: "nicht ueber die Konsole bereitgestellt" },
  roles: { en: "Available roles", de: "Verfuegbare Rollen" },
  apps: { en: "Installed Role Apps", de: "Installierte Rollen-Apps" },
  enabled: { en: "enabled", de: "freigeschaltet" },
  notRunnable: { en: "Disabled or retired", de: "Gesperrt oder ausser Betrieb" },
  users: { en: "Active users", de: "Aktive Benutzer" },
  usersValue: { en: "demonstration personas", de: "Demonstrationspersonas" },
  usersNote: {
    en: "No named users in this build: role holders and product-owner personas are demonstration personas.",
    de: "In diesem Build gibt es keine benannten Benutzer: Rolleninhaber und Product-Owner-Personas sind Demonstrationspersonas.",
  },
  runs: { en: "Active process runs", de: "Aktive Prozesslaeufe" },
  decisions: { en: "Decisions waiting", de: "Wartende Entscheidungen" },
  decisionsNote: { en: "Open, presented by now, Available roles", de: "Offen, bis jetzt vorgelegt, verfuegbare Rollen" },
  failures: { en: "Process failures", de: "Prozessfehler" },
  failuresNote: { en: "failed jobs, failed preparations, blocked runs", de: "fehlgeschlagene Auftraege, fehlgeschlagene Vorbereitungen, blockierte Laeufe" },
  ai: { en: "AI quality status", de: "Status der KI-Qualitaet" },
  connectors: { en: "Connector health", de: "Zustand der Konnektoren" },
  pilot: { en: "Pilot status", de: "Pilotstatus" },
  noPilot: { en: "No pilot programme is recorded.", de: "Es ist kein Pilotprogramm erfasst." },
  baselines: { en: "baselines not measured", de: "Ausgangswerte nicht gemessen" },
  changed: { en: "What changed since the previous release?", de: "Was hat sich seit dem vorherigen Release geaendert?" },
  changedNote: {
    en: "From this version's CHANGELOG entry, as written there, and the console's own records.",
    de: "Aus dem CHANGELOG-Eintrag dieser Version, wie dort geschrieben, und aus den eigenen Datensaetzen der Konsole.",
  },
  consoleRecords: { en: "release and Role App changes recorded in the console", de: "in der Konsole erfasste Release- und Rollen-App-Aenderungen" },
  attention: { en: "What needs attention?", de: "Was braucht Aufmerksamkeit?" },
  blocked: { en: "What is blocked?", de: "Was ist blockiert?" },
  well: { en: "What is performing well?", de: "Was laeuft gut?" },
  nothingAttention: { en: "Nothing needs attention from the readings on this page.", de: "Nach den Werten auf dieser Seite braucht nichts Aufmerksamkeit." },
  nothingBlocked: { en: "Nothing is blocked.", de: "Nichts ist blockiert." },
  nothingWell: {
    en: "Nothing is reported as performing well until a check or a measure shows it.",
    de: "Nichts wird als gut laufend gemeldet, solange keine Pruefung oder Messung es zeigt.",
  },
  unavailable: { en: "Unavailable", de: "Nicht verfuegbar" },
  open: { en: "Open", de: "Oeffnen" },
} as const;

type Say = (pair: Bilingual) => string;

const TONE_LABELS: Record<OverviewItem["tone"], Bilingual> = {
  danger: { en: "Material", de: "Wesentlich" },
  warning: { en: "Attention", de: "Aufmerksamkeit" },
  info: { en: "Information", de: "Information" },
  success: { en: "Measured", de: "Gemessen" },
};

function Figure({ label, children, note, testId }: { label: string; children: React.ReactNode; note?: string; testId: string }) {
  return (
    <div className="app-stack-1" style={{ minWidth: 0, padding: "var(--app-2) 0", borderTop: "1px solid var(--app-border)" }} data-testid={testId}>
      <span className="app-meta">{label}</span>
      <span className="app-row app-row-wrap" style={{ fontSize: "var(--app-text-sm)" }}>
        {children}
      </span>
      {note ? (
        <span className="app-meta" style={consoleWrapStyle}>
          {note}
        </span>
      ) : null}
    </div>
  );
}

function Answers({ items, empty, say, testId, viewAll }: { items: OverviewItem[]; empty: string; say: Say; testId: string; viewAll: string }) {
  if (items.length === 0) return <Empty title={empty} />;
  const row = (item: OverviewItem, index: number) => (
    <div
      key={`${testId}-${index}`}
      className="app-row app-row-top"
      style={{ padding: "var(--app-2) 0", gap: "var(--app-3)", justifyContent: "space-between" }}
    >
      <span className="app-row app-row-top" style={{ minWidth: 0, gap: "var(--app-2)" }}>
        <span style={{ marginTop: 6 }}>
          <Dot tone={item.tone} label={say(TONE_LABELS[item.tone])} />
        </span>
        <span className="app-secondary" style={{ ...consoleWrapStyle, fontSize: "var(--app-text-sm)" }}>
          {say(item.text)}
        </span>
      </span>
      <Link href={item.href} className="app-source-link" style={{ flexShrink: 0 }}>
        {say(CONSOLE_COPY.open)}
      </Link>
    </div>
  );
  return (
    <div className="app-stack-1" data-testid={testId}>
      <List>{items.slice(0, 3).map(row)}</List>
      {items.length > 3 ? (
        <details>
          <summary className="app-meta" style={{ cursor: "pointer" }}>
            {viewAll} <Data>{items.length}</Data>
          </summary>
          <List>{items.slice(3).map((item, index) => row(item, index + 3))}</List>
        </details>
      ) : null}
    </div>
  );
}

export function OverviewConsole({ language }: { language: Language }) {
  const say: Say = (pair) => (language === "de" ? pair.de : pair.en);
  const view = readOverview();
  const number = (value: number | null) => (value === null ? say(COPY.unavailable) : String(value));
  const material = view.attention.find((item) => item.tone === "danger") ?? view.blocked.find((item) => item.tone === "danger");

  return (
    <div className="app-stack-6" data-testid="console-overview">
      <SettingsHead eyebrow={say(CONSOLE_COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />

      {material ? (
        <Notice tone="danger">
          <span data-testid="overview-material-alert">{say(material.text)}</span>{" "}
          <Link href={material.href} className="app-source-link">
            {say(CONSOLE_COPY.open)}
          </Link>
        </Notice>
      ) : null}

      <SettingsSection title={say(COPY.figures)}>
        <div style={consoleFigureGridStyle}>
          <Figure label={say(COPY.release)} testId="overview-release" note={view.release.deployedVersion ? `${say(COPY.deployed)}: ${view.release.deployedVersion}` : say(COPY.notDeployed)}>
            <Data size="sm">{view.release.version}</Data>
            <Chip tone="ai">{say(view.release.stage)}</Chip>
          </Figure>
          <Figure label={say(COPY.roles)} testId="overview-roles" note={view.availableRoles.join(", ")}>
            <Data size="sm">{view.availableRoles.length}</Data>
          </Figure>
          <Figure
            label={say(COPY.apps)}
            testId="overview-role-apps"
            note={view.roleApps.notRunnable.length > 0 ? `${say(COPY.notRunnable)}: ${view.roleApps.notRunnable.join(", ")}` : undefined}
          >
            <Data size="sm">{view.roleApps.installed}</Data>
            <span className="app-meta">
              <Data>{view.roleApps.runnable}</Data> {say(COPY.enabled)}
            </span>
          </Figure>
          <Figure label={say(COPY.users)} testId="overview-users" note={say(COPY.usersNote)}>
            <Data size="sm">{view.personas.roleHolders + view.personas.productOwner}</Data>
            <span className="app-meta">{say(COPY.usersValue)}</span>
          </Figure>
          <Figure label={say(COPY.runs)} testId="overview-runs">
            <Data size="sm">{number(view.activeRuns)}</Data>
          </Figure>
          <Figure label={say(COPY.decisions)} testId="overview-decisions" note={say(COPY.decisionsNote)}>
            <Data size="sm">{number(view.decisionsWaiting)}</Data>
          </Figure>
          <Figure label={say(COPY.failures)} testId="overview-failures" note={say(COPY.failuresNote)}>
            <Data size="sm">{`${number(view.failures.failedJobs)} / ${number(view.failures.failedPreparations)} / ${number(view.failures.blockedRuns)}`}</Data>
          </Figure>
          <Figure label={say(COPY.ai)} testId="overview-ai" note={say(view.aiQuality.modelOutput.detail)}>
            <StatusBadge status={view.aiQuality.mode.status} language={language} detail={say(view.aiQuality.mode.detail)} />
            <StatusBadge status={view.aiQuality.harness.status} language={language} detail={say(view.aiQuality.harness.detail)} />
            <StatusBadge status={view.aiQuality.modelOutput.status} language={language} detail={say(view.aiQuality.modelOutput.detail)} />
          </Figure>
          <Figure label={say(COPY.connectors)} testId="overview-connectors">
            {view.connectors === null ? (
              <StatusBadge status="unavailable" language={language} />
            ) : (
              view.connectors.map((entry) => (
                <span key={entry.status} className="app-row" title={statusLabel(entry.status, language)}>
                  <StatusBadge status={entry.status} language={language} />
                  <Data>{entry.count}</Data>
                </span>
              ))
            )}
          </Figure>
          <Figure
            label={say(COPY.pilot)}
            testId="overview-pilot"
            note={view.pilot ? `${view.pilot.notMeasured} / ${view.pilot.measures} ${say(COPY.baselines)}` : say(COPY.noPilot)}
          >
            {view.pilot ? <Chip>{view.pilot.status}</Chip> : <StatusBadge status="empty" language={language} />}
          </Figure>
        </div>
      </SettingsSection>

      <div className="app-grid-2">
        <SettingsSection title={say(COPY.attention)} count={view.attention.length}>
          <Answers items={view.attention} empty={say(COPY.nothingAttention)} say={say} testId="overview-attention" viewAll={say(CONSOLE_COPY.viewAll)} />
        </SettingsSection>
        <SettingsSection title={say(COPY.blocked)} count={view.blocked.length}>
          <Answers items={view.blocked} empty={say(COPY.nothingBlocked)} say={say} testId="overview-blocked" viewAll={say(CONSOLE_COPY.viewAll)} />
        </SettingsSection>
        <SettingsSection title={say(COPY.well)} count={view.performingWell.length}>
          <Answers items={view.performingWell} empty={say(COPY.nothingWell)} say={say} testId="overview-well" viewAll={say(CONSOLE_COPY.viewAll)} />
        </SettingsSection>
        <SettingsSection title={say(COPY.changed)} count={view.changed.changelog.length}>
          <div className="app-stack-2" data-testid="overview-changed">
            <span className="app-meta" style={consoleWrapStyle}>{say(COPY.changedNote)}</span>
            {view.changed.changelog.length === 0 ? (
              <Empty title={say(COPY.unavailable)} />
            ) : (
              <>
                <ul className="app-stack-1" style={{ margin: 0, paddingLeft: "var(--app-4)" }}>
                  {view.changed.changelog.slice(0, 3).map((line) => (
                    <li key={line} className="app-meta" style={consoleWrapStyle} lang="en">
                      {line}
                    </li>
                  ))}
                </ul>
                {view.changed.changelog.length > 3 ? (
                  <details>
                    <summary className="app-meta" style={{ cursor: "pointer" }}>
                      {say(CONSOLE_COPY.viewAll)} <Data>{view.changed.changelog.length}</Data>
                    </summary>
                    <ul className="app-stack-1" style={{ margin: 0, paddingLeft: "var(--app-4)" }}>
                      {view.changed.changelog.slice(3).map((line) => (
                        <li key={line} className="app-meta" style={consoleWrapStyle} lang="en">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </>
            )}
            <span className="app-meta">
              <Data>{view.changed.consoleRecords}</Data> {say(COPY.consoleRecords)}
            </span>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
