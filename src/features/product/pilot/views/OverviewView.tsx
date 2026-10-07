/**
 * The pilot overview: where the pilot stands, its readiness read from the
 * actual controls, and the evidence pack.
 *
 * Server component. The readiness section reads the same computed checks as
 * `/settings/pilot` (`runReadinessChecks`) and the Wave 5 controls beside
 * them (`readiness.ts`). Nothing on this page is asserted.
 */

import Link from "next/link";
import { Field, FieldList, SettingsSection } from "@/components/settings/primitives";
import { Notice } from "@/components/workday-v2/primitives";
import { StatusBadge } from "@/product/status";
import type { Language } from "@/i18n/labels";
import { StatusList, StatusRow, WrappingDetail } from "@app/settings/_components/StatusRows";
import { EXIT_OUTCOME_LABELS } from "../changes";
import type { PilotReadiness } from "../readiness";
import type { PilotWorkspace } from "../workspace";
import { formatDate, formatDateTime, say, Wrap } from "./PilotFrame";

const COPY = {
  where: { en: "Where the pilot stands", de: "Stand des Piloten" },
  window: { en: "Window", de: "Zeitraum" },
  cohort: { en: "Cohort", de: "Kohorte" },
  accounts: { en: "accounts", de: "Konten" },
  scope: { en: "Scope", de: "Umfang" },
  baseline: { en: "Baseline", de: "Ausgangslage" },
  recorded: { en: "recorded by the Pilot Lead", de: "von der Pilotleitung erfasst" },
  open: { en: "Open issues, risks and decisions", de: "Offene Themen, Risiken und Entscheidungen" },
  decision: { en: "Exit decision", de: "Abschlussentscheidung" },
  noDecision: { en: "None recorded", de: "Keine erfasst" },
  readiness: { en: "Pilot readiness", de: "Pilotbereitschaft" },
  readinessNote: {
    en: "Computed on this request from the controls themselves. The product checks are the ones on the pilot readiness settings page; the controls are the Wave 5 exit criteria.",
    de: "Bei dieser Anfrage aus den Kontrollen selbst berechnet. Die Produktpruefungen sind die der Einstellungsseite zur Pilotbereitschaft; die Kontrollen sind die Austrittskriterien der Welle 5.",
  },
  summary: { en: "{verified} of {total} verified.", de: "{verified} von {total} verifiziert." },
  productChecks: { en: "Product checks", de: "Produktpruefungen" },
  controls: { en: "Design-partner controls", de: "Kontrollen fuer den Designpartner" },
  source: { en: "Source", de: "Quelle" },
  settings: { en: "Pilot readiness settings", de: "Einstellungen Pilotbereitschaft" },
  pack: { en: "Pilot evidence pack", de: "Pilot-Nachweispaket" },
  packNote: {
    en: "One JSON file, built on the server when you download it: setup, baseline, measures and readings, readiness as computed now, control measures, known limitations from the release registry and the exit decisions. It contains no credentials, no session data, no environment values and no personal data, and it is checked for credential shapes before it is offered.",
    de: "Eine JSON-Datei, beim Herunterladen auf dem Server erzeugt: Einrichtung, Ausgangslage, Kennzahlen und Werte, Bereitschaft nach aktuellem Stand, Kontrollkennzahlen, bekannte Einschraenkungen aus dem Release-Verzeichnis und die Abschlussentscheidungen. Sie enthaelt keine Zugangsdaten, keine Sitzungsdaten, keine Umgebungswerte und keine personenbezogenen Daten und wird vor dem Angebot auf Muster von Zugangsdaten geprueft.",
  },
  download: { en: "Download the evidence pack", de: "Nachweispaket herunterladen" },
  notPermitted: { en: "Your persona cannot generate the evidence pack.", de: "Ihre Persona kann das Nachweispaket nicht erzeugen." },
} as const;

export function ReadinessSection({ readiness, language }: { readiness: PilotReadiness; language: Language }) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  return (
    <SettingsSection
      title={t(COPY.readiness)}
      count={readiness.total}
      trailing={<StatusBadge status={readiness.overall} language={language} />}
    >
      <div className="app-stack app-stack-3" data-testid="pilot-readiness" data-overall={readiness.overall}>
        <Wrap>
          {t(COPY.readinessNote)}{" "}
          {t(COPY.summary).replace("{verified}", String(readiness.verified)).replace("{total}", String(readiness.total))}{" "}
          <Link href="/settings/pilot" className="app-source-link">
            {t(COPY.settings)}
          </Link>
        </Wrap>
        <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>{t(COPY.controls)}</span>
        <StatusList label={t(COPY.controls)}>
          {readiness.controls.map((control) => (
            <div key={control.id} data-testid={`control-${control.id}`} data-status={control.reading.status}>
              <StatusRow
                label={t(control.label)}
                status={control.reading}
                language={language}
                trailing={<span className="app-meta" style={{ whiteSpace: "normal", maxWidth: "28ch" }}>{t(control.criterion)}</span>}
              />
              <div style={{ padding: "0 var(--app-3) var(--app-2)" }}>
                <WrappingDetail>
                  {t(COPY.source)}: <span className="app-oid">{control.source}</span>
                </WrappingDetail>
              </div>
            </div>
          ))}
        </StatusList>
        <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>{t(COPY.productChecks)}</span>
        <StatusList label={t(COPY.productChecks)}>
          {readiness.productChecks.map((check) => (
            <div key={check.id} data-testid={`check-${check.id}`} data-status={check.reading.status}>
              <StatusRow label={t(check.label)} status={check.reading} language={language} />
            </div>
          ))}
        </StatusList>
      </div>
    </SettingsSection>
  );
}

export function OverviewView({
  workspace,
  readiness,
  language,
  canDownload,
}: {
  workspace: PilotWorkspace;
  readiness: PilotReadiness;
  language: Language;
  canDownload: boolean;
}) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const pilot = workspace.pilot;
  const recorded = workspace.measures.filter((entry) => entry.measure.baselineStatus !== "not-measured").length;
  const open = workspace.issues.filter((issue) => issue.status === "open");
  const latest = workspace.exitDecisions[workspace.exitDecisions.length - 1] ?? null;

  return (
    <div className="app-stack app-stack-6">
      <SettingsSection title={t(COPY.where)}>
        <FieldList label={t(COPY.where)}>
          <Field label={t(COPY.scope)} value={<Wrap>{say(workspace.businessArea, language)}</Wrap>} />
          <Field
            label={t(COPY.window)}
            value={pilot.plannedStartOn && pilot.plannedEndOn ? `${formatDate(pilot.plannedStartOn, language)} ${language === "de" ? "bis" : "to"} ${formatDate(pilot.plannedEndOn, language)}` : language === "de" ? "Nicht vereinbart" : "Not agreed"}
          />
          <Field label={t(COPY.cohort)} value={`${workspace.cohort?.userIds.length ?? 0} ${t(COPY.accounts)}`} />
          <Field
            label={t(COPY.baseline)}
            value={<span data-testid="overview-baseline">{`${recorded} / ${workspace.measures.length} ${t(COPY.recorded)}`}</span>}
          />
          <Field label={t(COPY.open)} value={String(open.length)} />
          <Field
            label={t(COPY.decision)}
            value={
              latest ? (
                <span data-testid="overview-exit-decision">
                  {t(EXIT_OUTCOME_LABELS[latest.outcome])}, {formatDateTime(latest.decidedAt)}, {latest.decidedByLabel}
                </span>
              ) : (
                t(COPY.noDecision)
              )
            }
          />
        </FieldList>
        {workspace.startConditions.length > 0 && pilot.status === "setup" ? (
          <Notice tone="warning">
            {workspace.startConditions.map((condition) => t(condition)).join(" ")}
          </Notice>
        ) : null}
      </SettingsSection>

      <ReadinessSection readiness={readiness} language={language} />

      <SettingsSection title={t(COPY.pack)}>
        <div className="app-stack app-stack-2">
          <Wrap>{t(COPY.packNote)}</Wrap>
          {canDownload ? (
            <a href="/product/pilot/evidence-pack" className="app-btn app-btn-secondary app-btn-sm" style={{ alignSelf: "flex-start" }} data-testid="pilot-evidence-pack-download" download>
              {t(COPY.download)}
            </a>
          ) : (
            <span className="app-meta">{t(COPY.notPermitted)}</span>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
