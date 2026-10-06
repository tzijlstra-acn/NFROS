/**
 * /ops, the operations console.
 *
 * Component health, the AI mode, connector state, the recorded evaluation
 * run, the job queue and the product release. Every status on this page is
 * computed on this request by `src/product/status/sources.ts` and shown in
 * the product status vocabulary; the page decides nothing itself. The release
 * comes from the release registry, not from literals here; the old version,
 * release name and table count lines were all typed into this file.
 *
 * No content, secrets or personal data is shown. The AI section reports
 * whether a key was resolved and never anything about the key.
 *
 * IMPORTANT: In production this page must be protected by administrator
 * authentication. In demonstration mode it is open, and the page says so.
 */

import Link from "next/link";
import { SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Empty, Item, List, Notice } from "@/components/workday-v2/primitives";
import { StatusBadge, statusLabel } from "@/product/status";
import {
  readAdminLanguage,
  readAiMode,
  readConnectorStatusCounts,
  readEvaluationEvidence,
  readJobQueue,
  readSystemHealth,
} from "@/product/status/sources";
import { CONNECTOR_MODE_LABELS, pick } from "@/workday/contracts";
import { ReleasePanel } from "@app/settings/_components/ReleasePanel";
import { StatusList, StatusRow } from "@app/settings/_components/StatusRows";

export const dynamic = "force-dynamic";

const COPY = {
  eyebrow: { en: "Administrator area", de: "Administrationsbereich" },
  title: { en: "Operations console", de: "Betriebskonsole" },
  lede: {
    en: "Component health, the AI mode, connector state, the recorded evaluation run, the job queue and the product release. Every status is computed on this request. Administrator access is required in production; in demonstration mode this page is open.",
    de: "Zustand der Komponenten, KI-Modus, Konnektorzustand, der erfasste Evaluationslauf, die Auftragswarteschlange und das Produkt-Release. Jeder Status wird bei dieser Anfrage berechnet. Im Produktivbetrieb ist ein Administratorzugang erforderlich; im Demonstrationsmodus ist diese Seite offen.",
  },
  health: { en: "System health", de: "Systemzustand" },
  overall: { en: "Overall", de: "Gesamt" },
  checkedAt: { en: "Checked at", de: "Geprueft um" },
  overallNote: {
    en: "Verified only when every component is Verified. A component that nothing checks keeps the overall reading at Not verified.",
    de: "Nur verifiziert, wenn jede Komponente verifiziert ist. Eine Komponente, die nichts prueft, haelt die Gesamtbewertung bei Nicht verifiziert.",
  },
  ai: { en: "AI", de: "KI" },
  aiMode: { en: "Mode", de: "Modus" },
  aiProvider: { en: "Provider", de: "Anbieter" },
  keyResolved: { en: "Key resolved", de: "Schluessel gefunden" },
  keyNotResolved: { en: "No key resolved", de: "Kein Schluessel gefunden" },
  requested: { en: "requested", de: "angefordert" },
  integrations: { en: "Integrations", de: "Integrationen" },
  integrationsNote: {
    en: "Connector instances counted by status, read from the connector registry. The integrations page shows every instance with its mode.",
    de: "Konnektorinstanzen nach Status gezaehlt, aus dem Konnektorverzeichnis gelesen. Die Seite Integrationen zeigt jede Instanz mit ihrem Modus.",
  },
  integrationsUnavailable: {
    en: "The connector registry could not be read.",
    de: "Das Konnektorverzeichnis konnte nicht gelesen werden.",
  },
  openIntegrations: { en: "Open integrations", de: "Integrationen oeffnen" },
  evaluation: { en: "AI evaluation", de: "KI-Evaluation" },
  harness: { en: "Evaluation harness", de: "Evaluationsumgebung" },
  modelOutput: { en: "Model output quality", de: "Qualitaet der Modellausgaben" },
  openAiQuality: { en: "Open AI quality", de: "KI-Qualitaet oeffnen" },
  recordedAt: { en: "Recorded", de: "Erfasst" },
  jobs: { en: "Job queue", de: "Auftragswarteschlange" },
  pending: { en: "Pending jobs", de: "Offene Auftraege" },
  failed: { en: "Failed jobs, last five", de: "Fehlgeschlagene Auftraege, die letzten fuenf" },
  noFailed: { en: "No failed jobs are recorded", de: "Es sind keine fehlgeschlagenen Auftraege erfasst" },
  jobFailed: { en: "Failed", de: "Fehlgeschlagen" },
  jobsUnavailable: {
    en: "The background job tables are not present, so the queue cannot be read.",
    de: "Die Tabellen fuer Hintergrundauftraege sind nicht vorhanden, die Warteschlange kann daher nicht gelesen werden.",
  },
  instances: { en: "instances", de: "Instanzen" },
} as const;

export default async function OpsPage() {
  const language = readAdminLanguage();
  const say = (pair: { en: string; de: string }) => pick(pair, language);

  const [health, queue] = await Promise.all([readSystemHealth(), readJobQueue()]);
  const ai = readAiMode();
  const connectors = readConnectorStatusCounts();
  const evaluation = readEvaluationEvidence();

  return (
    <div
      className="app-stack app-stack-6"
      data-presentation-region="ops-dashboard"
      data-presentation-ready="true"
    >
      <SettingsHead eyebrow={say(COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />

      <SettingsSection
        title={say(COPY.health)}
        trailing={
          <span className="app-row app-row-wrap">
            <span className="app-meta">{say(COPY.overall)}</span>
            <StatusBadge status={health.overall} language={language} detail={say(COPY.overallNote)} />
          </span>
        }
      >
        <div className="app-stack app-stack-3">
          <StatusList label={say(COPY.health)}>
            {health.components.map((component) => (
              <StatusRow
                key={component.id}
                label={say(component.label)}
                status={component.reading}
                language={language}
                {...(component.latencyMs !== null
                  ? { trailing: <Data>{`${component.latencyMs} ms`}</Data> }
                  : {})}
              />
            ))}
          </StatusList>
          <span className="app-meta">
            {say(COPY.checkedAt)} <Data>{health.checkedAt}</Data>. {say(COPY.overallNote)}
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.ai)}>
        <StatusList label={say(COPY.ai)}>
          <StatusRow
            label={say(COPY.aiMode)}
            status={ai.mode}
            language={language}
            trailing={
              ai.downgraded ? (
                <span className="app-meta">
                  {statusLabel(ai.requestedMode, language)} {say(COPY.requested)}
                </span>
              ) : undefined
            }
          />
          <StatusRow
            label={say(COPY.aiProvider)}
            status={ai.verification}
            language={language}
            trailing={
              <Chip tone={ai.keyResolved ? "info" : "neutral"}>
                {say(ai.keyResolved ? COPY.keyResolved : COPY.keyNotResolved)}
              </Chip>
            }
          />
        </StatusList>
      </SettingsSection>

      <SettingsSection
        title={say(COPY.integrations)}
        trailing={
          <Link href="/settings/integrations" className="app-source-link">
            {say(COPY.openIntegrations)}
          </Link>
        }
      >
        <div className="app-stack app-stack-3">
          {connectors === null ? (
            <Notice tone="warning">{say(COPY.integrationsUnavailable)}</Notice>
          ) : connectors.length === 0 ? (
            <Empty title={statusLabel("empty", language)} detail={say(COPY.integrationsNote)} />
          ) : (
            <List label={say(COPY.integrations)}>
              {connectors.map((entry) => (
                <Item
                  key={entry.status}
                  title={
                    <span className="app-row app-row-wrap">
                      <StatusBadge status={entry.status} language={language} />
                      <span className="app-meta">
                        {entry.modes.map((mode) => pick(CONNECTOR_MODE_LABELS[mode], language)).join(", ")}
                      </span>
                    </span>
                  }
                  trailing={
                    <span className="app-row">
                      <Data>{entry.count}</Data>
                      <span className="app-faint">{say(COPY.instances)}</span>
                    </span>
                  }
                />
              ))}
            </List>
          )}
          <span className="app-meta">{say(COPY.integrationsNote)}</span>
        </div>
      </SettingsSection>

      <SettingsSection
        title={say(COPY.evaluation)}
        trailing={
          <Link href="/settings/ai-quality" className="app-source-link">
            {say(COPY.openAiQuality)}
          </Link>
        }
      >
        <StatusList label={say(COPY.evaluation)}>
          <StatusRow
            label={say(COPY.harness)}
            status={evaluation.harness}
            language={language}
            {...(evaluation.runAt
              ? {
                  trailing: (
                    <span className="app-row">
                      <span className="app-faint">{say(COPY.recordedAt)}</span>
                      <Data>{evaluation.runAt}</Data>
                    </span>
                  ),
                }
              : {})}
          />
          <StatusRow label={say(COPY.modelOutput)} status={evaluation.modelOutput} language={language} />
        </StatusList>
      </SettingsSection>

      <SettingsSection title={say(COPY.jobs)}>
        {queue.available ? (
          <div className="app-stack app-stack-3">
            <Item
              title={say(COPY.pending)}
              trailing={<Data size="sm">{queue.pending}</Data>}
            />
            <span className="app-strong">{say(COPY.failed)}</span>
            {queue.failed.length === 0 ? (
              <Empty title={say(COPY.noFailed)} />
            ) : (
              <List label={say(COPY.failed)}>
                {queue.failed.map((job) => (
                  <Item
                    key={job.id}
                    title={
                      <span className="app-row app-row-wrap">
                        <span className="app-oid">{job.id}</span>
                        <span className="app-oid">{job.kind}</span>
                      </span>
                    }
                    subtitle={<Data>{job.createdAt}</Data>}
                    trailing={
                      <Chip tone="danger" title={job.status}>
                        {say(COPY.jobFailed)}
                      </Chip>
                    }
                  />
                ))}
              </List>
            )}
          </div>
        ) : (
          <Notice tone="warning">{say(COPY.jobsUnavailable)}</Notice>
        )}
      </SettingsSection>

      <ReleasePanel language={language} variant="full" />
    </div>
  );
}
