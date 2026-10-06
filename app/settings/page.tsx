/**
 * The settings index.
 *
 * The product release first, read from the release registry, then every
 * administrator area with the value an administrator most often comes to
 * check. Where a summary is a count or a state it is read from the resolved
 * configuration or the connector registry; where this page does not read the
 * area it carries a purpose instead, because asserting a state for a surface
 * this page does not read would be a guess.
 */

import Link from "next/link";
import {
  BRAND_MODE_LABELS,
  SETTINGS_AREAS,
  getProductConfig,
  listProductConfigChanges,
} from "@/product";
import { SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Item, List, Notice } from "@/components/workday-v2/primitives";
import { statusLabel } from "@/product/status";
import { readAdminLanguage, readConnectorStatusCounts } from "@/product/status/sources";
import { pick } from "@/workday/contracts";
import { ReleasePanel } from "./_components/ReleasePanel";

export const dynamic = "force-dynamic";

const COPY = {
  eyebrow: { en: "Administrator area", de: "Administrationsbereich" },
  title: { en: "Product configuration", de: "Produktkonfiguration" },
  lede: {
    en: "Everything a second institution would otherwise need a code fork to change. Changing anything here changes no decision, no approval and no audit event: the domain record and the product configuration are separate stores, and that separation is what makes this a product rather than one bank application.",
    de: "Alles, wofuer eine zweite Institution sonst eine Abspaltung des Codes braeuchte. Eine Aenderung hier aendert keine Entscheidung, keine Genehmigung und kein Audit-Ereignis: Fachdaten und Produktkonfiguration sind getrennt gespeichert, und diese Trennung macht dies zu einem Produkt statt zu einer einzelnen Bankanwendung.",
  },
  notConfigured: {
    en: "No active product configuration was found. The screens below are showing documented fallbacks rather than a configuration. Run the database migration and seed, then reload.",
    de: "Es wurde keine aktive Produktkonfiguration gefunden. Die folgenden Seiten zeigen dokumentierte Standardwerte statt einer Konfiguration. Fuehren Sie Migration und Seed der Datenbank aus und laden Sie neu.",
  },
  areas: { en: "Settings areas", de: "Einstellungsbereiche" },
  changes: { en: "Recent configuration changes", de: "Letzte Konfigurationsaenderungen" },
  changesNote: {
    en: "Recorded separately from the domain audit trail",
    de: "Getrennt vom fachlichen Audit-Trail erfasst",
  },
  noChanges: {
    en: "No product configuration changes are recorded. The seeded configuration is the only state so far.",
    de: "Es sind keine Aenderungen der Produktkonfiguration erfasst. Die eingespielte Konfiguration ist bisher der einzige Stand.",
  },
  by: { en: "by", de: "von" },
  documented: { en: "What is documented", de: "Was dokumentiert ist" },
  footer: {
    en: "This area is for administrators. It is not reachable from the workday navigation, because a practitioner handling an incident has no reason to see a configuration screen.",
    de: "Dieser Bereich ist fuer Administratoren. Er ist aus der Navigation des Arbeitstags nicht erreichbar, denn wer einen Vorfall bearbeitet, braucht keine Konfigurationsseite.",
  },
  returnLink: { en: "Return to the workday", de: "Zurueck zum Arbeitstag" },
} as const;

export default function SettingsIndexPage() {
  const language = readAdminLanguage();
  const say = (pair: { en: string; de: string }) => pick(pair, language);
  const config = getProductConfig();
  const changes = listProductConfigChanges(4);
  const connectorCounts = readConnectorStatusCounts();

  const integrationsSummary =
    connectorCounts === null || connectorCounts.length === 0
      ? say({
          en: "Connector packs, instances, credential state and freshness",
          de: "Konnektorpakete, Instanzen, Anmeldestatus und Aktualitaet",
        })
      : connectorCounts
          .map((entry) => `${entry.count} ${statusLabel(entry.status, language)}`)
          .join(", ");

  /*
   * One summary line per area. Counts and states are read; the three areas
   * this page does not read carry their purpose, which is honest about what
   * this page knows.
   */
  const summary: Record<string, string> = {
    "/settings/organisation": `${config.organisation.name}, ${config.organisation.legalEntities.length} ${say({ en: "legal entities", de: "Rechtseinheiten" })}, ${config.organisation.timezone}`,
    "/settings/branding": `${pick(BRAND_MODE_LABELS[config.identity.mode], language)}, ${config.identity.productName}`,
    "/settings/integrations": integrationsSummary,
    "/settings/mappings": say({
      en: "Source to canonical object mapping and conflict policy",
      de: "Zuordnung von Quell- zu kanonischen Objekten und Konfliktregeln",
    }),
    "/settings/role-packs": `${config.functionPacks.filter((pack) => pack.granted).length} ${say({ en: "of", de: "von" })} ${config.functionPacks.length} ${say({ en: "function packs granted", de: "Funktionspaketen freigeschaltet" })}`,
    "/settings/role-apps": say({
      en: "Installed and preview Role Apps, read from the Role App registry",
      de: "Installierte und Vorschau-Rollen-Apps, aus dem Rollen-App-Verzeichnis gelesen",
    }),
    "/settings/authority": say({
      en: "Tool authority classes, role scopes and approval requirements",
      de: "Befugnisklassen der Werkzeuge, Rollenbefugnisse und Genehmigungspflichten",
    }),
    "/settings/deployment": `${config.deployment.name}, ${say({ en: "profile version", de: "Profilversion" })} ${config.deployment.version}`,
    "/settings/ai-quality": say({
      en: "Released AI configurations and the recorded evaluation run",
      de: "Freigegebene KI-Konfigurationen und der erfasste Evaluationslauf",
    }),
    "/settings/pilot": say({
      en: "Readiness checks computed on each visit, pilot accounts and regulatory scope",
      de: "Bei jedem Aufruf berechnete Bereitschaftspruefungen, Pilotkonten und regulatorischer Rahmen",
    }),
  };

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead eyebrow={say(COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />

      {config.configured ? null : <Notice tone="warning">{say(COPY.notConfigured)}</Notice>}

      <ReleasePanel language={language} variant="summary" />

      <SettingsSection title={say(COPY.areas)} count={SETTINGS_AREAS.length}>
        <List label={say(COPY.areas)}>
          {SETTINGS_AREAS.map((area) => (
            <Item
              key={area.href}
              href={area.href}
              title={pick(area.label, language)}
              subtitle={summary[area.href] ?? ""}
              trailing={<Data>{area.href}</Data>}
            />
          ))}
        </List>
      </SettingsSection>

      <SettingsSection
        title={say(COPY.changes)}
        count={changes.length}
        trailing={<span className="app-meta">{say(COPY.changesNote)}</span>}
      >
        {changes.length === 0 ? (
          <Notice>{say(COPY.noChanges)}</Notice>
        ) : (
          <List label={say(COPY.changes)}>
            {changes.map((change) => (
              <Item
                key={change.id}
                title={<span style={{ whiteSpace: "normal" }}>{change.summary}</span>}
                subtitle={
                  <span className="app-row app-row-wrap">
                    <Chip>{change.area}</Chip>
                    <Data>{change.at}</Data>
                    <span className="app-meta">
                      {say(COPY.by)} {change.changedBy}
                    </span>
                  </span>
                }
              />
            ))}
          </List>
        )}
      </SettingsSection>

      <SettingsSection title={say(COPY.documented)}>
        <List label={say(COPY.documented)}>
          <Item
            title={say({ en: "Product architecture", de: "Produktarchitektur" })}
            subtitle={say({
              en: "The packaging model, what is in Core, and the configuration-not-fork mechanism",
              de: "Das Paketmodell, der Inhalt von Core und der Mechanismus Konfiguration statt Abspaltung",
            })}
            trailing={<Data>docs/PRODUCT_ARCHITECTURE.md</Data>}
          />
          <Item
            title={say({ en: "White label and packaging", de: "White Label und Pakete" })}
            subtitle={say({
              en: "The three branding modes, where operator identity may appear, and the entitlement model",
              de: "Die drei Markenmodi, wo die Betreiberidentitaet erscheinen darf, und das Berechtigungsmodell",
            })}
            trailing={<Data>docs/WHITE_LABEL_AND_PACKAGING.md</Data>}
          />
          <Item
            title={say({ en: "Deployment profiles", de: "Betriebsprofile" })}
            subtitle={say({
              en: "The four profiles and an honest statement of what this prototype runs",
              de: "Die vier Profile und eine ehrliche Aussage, was dieser Prototyp ausfuehrt",
            })}
            trailing={<Data>docs/DEPLOYMENT_PROFILES.md</Data>}
          />
        </List>
      </SettingsSection>

      <p className="app-meta" style={{ maxWidth: "76ch" }}>
        {say(COPY.footer)}{" "}
        <Link href="/workday" className="app-source-link">
          {say(COPY.returnLink)}
        </Link>
        .
      </p>
    </div>
  );
}
