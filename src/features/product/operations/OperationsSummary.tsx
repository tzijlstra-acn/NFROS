/**
 * The Operations section of the console: a summary of `/ops`.
 *
 * The operations console (`app/ops`, os-release-truth) stays the place for
 * the detail. This reads the same status sources it does, so the two cannot
 * disagree, and adds what connects operations to the product (plan 6.2):
 * open integration incidents and the Role Apps an operator has disabled.
 *
 * Server component.
 */

import Link from "next/link";
import { SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Data, Empty, Item, List } from "@/components/workday-v2/primitives";
import { listIntegrationIncidents } from "@/db/repositories/integration-operations";
import { StatusBadge } from "@/product/status";
import { readJobQueue, readSystemHealth } from "@/product/status/sources";
import { readRoleAppAvailability } from "@/role-apps/enablement";
import { getInstalledRoleApps } from "@/role-apps/registry";
import type { Language } from "@/i18n/labels";
import type { Bilingual } from "../permissions";
import { CONSOLE_COPY } from "../shell/copy";
import { consoleWrapStyle } from "../shell/styles";

const COPY = {
  title: { en: "Operations", de: "Betrieb" },
  lede: {
    en: "A summary of the operations console. Every status is computed on this request from the same sources the operations console reads.",
    de: "Eine Zusammenfassung der Betriebskonsole. Jeder Status wird bei dieser Anfrage aus denselben Quellen berechnet, die die Betriebskonsole liest.",
  },
  open: { en: "Open the operations console", de: "Betriebskonsole oeffnen" },
  health: { en: "System health", de: "Systemzustand" },
  jobs: { en: "Job queue", de: "Auftragswarteschlange" },
  pending: { en: "pending", de: "offen" },
  failed: { en: "failed, last five", de: "fehlgeschlagen, die letzten fuenf" },
  unavailable: { en: "The job tables could not be read.", de: "Die Auftragstabellen konnten nicht gelesen werden." },
  incidents: { en: "Open integration incidents", de: "Offene Integrationsvorfaelle" },
  noIncidents: { en: "No integration incident is open.", de: "Kein Integrationsvorfall ist offen." },
  apps: { en: "Role Apps not runnable", de: "Nicht ausfuehrbare Rollen-Apps" },
  allRunnable: { en: "Every installed Role App is enabled.", de: "Jede installierte Rollen-App ist freigeschaltet." },
} as const;

export async function OperationsSummary({ language }: { language: Language }) {
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  const [health, queue] = await Promise.all([readSystemHealth(), readJobQueue()]);
  let incidents: ReturnType<typeof listIntegrationIncidents> = [];
  try {
    incidents = listIntegrationIncidents({ statuses: ["open", "monitoring"] });
  } catch {
    incidents = [];
  }
  const notRunnable = getInstalledRoleApps()
    .map((app) => ({ app, availability: readRoleAppAvailability(app.id) }))
    .filter((entry) => !entry.availability.runnable);

  return (
    <div className="app-stack-6" data-testid="console-operations">
      <SettingsHead eyebrow={say(CONSOLE_COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />
      <Link href="/ops" className="app-source-link">
        {say(COPY.open)}
      </Link>

      <SettingsSection title={say(COPY.health)} trailing={<StatusBadge status={health.overall} language={language} />}>
        <List label={say(COPY.health)}>
          {health.components.map((component) => (
            <Item
              key={component.id}
              title={
                <span className="app-row app-row-wrap">
                  <span>{say(component.label)}</span>
                  <StatusBadge status={component.reading.status} language={language} detail={say(component.reading.detail)} />
                </span>
              }
            >
              <span className="app-meta" style={consoleWrapStyle}>
                {say(component.reading.detail)}
              </span>
            </Item>
          ))}
        </List>
      </SettingsSection>

      <div className="app-grid-2">
        <SettingsSection title={say(COPY.jobs)}>
          {queue.available ? (
            <span className="app-meta">
              <Data>{queue.pending}</Data> {say(COPY.pending)}, <Data>{queue.failed.length}</Data> {say(COPY.failed)}
            </span>
          ) : (
            <StatusBadge status="unavailable" language={language} detail={say(COPY.unavailable)} />
          )}
        </SettingsSection>
        <SettingsSection title={say(COPY.incidents)} count={incidents.length}>
          {incidents.length === 0 ? (
            <Empty title={say(COPY.noIncidents)} />
          ) : (
            <List label={say(COPY.incidents)}>
              {incidents.map((incident) => (
                <Item key={incident.id} title={incident.title} trailing={<Data>{incident.severity}</Data>} />
              ))}
            </List>
          )}
        </SettingsSection>
      </div>

      <SettingsSection title={say(COPY.apps)} count={notRunnable.length}>
        {notRunnable.length === 0 ? (
          <Empty title={say(COPY.allRunnable)} />
        ) : (
          <List label={say(COPY.apps)}>
            {notRunnable.map(({ app, availability }) => (
              <Item key={app.id} title={language === "de" ? app.nameDe : app.name} href="/product/role-apps">
                <span className="app-meta" style={consoleWrapStyle}>
                  {say(availability.reason)}
                </span>
              </Item>
            ))}
          </List>
        )}
      </SettingsSection>
    </div>
  );
}
