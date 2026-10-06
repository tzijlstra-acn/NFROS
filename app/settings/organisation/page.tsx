/**
 * Organisation settings.
 *
 * The institution, its legal entities, the locale and calendar conventions, and
 * the terminology profile in force. Read only in this build: every value here
 * comes from the organisation profile row, and the point of the screen is that
 * a second institution changes these values rather than the code.
 *
 * The regulatory disclosure appears with every entity, because every entity row
 * names a regulatory framework and the product never names one without it.
 *
 * The screen follows the scenario language. Values read from the profile, such
 * as entity names and regulatory references, are shown as stored.
 */

import { getProductConfig, listTerminologyProfiles, overriddenKeys, termFrom } from "@/product";
import { TERMINOLOGY_KEYS } from "@/db/schema/product";
import {
  Field,
  FieldList,
  RegulatorContext,
  SettingsHead,
  SettingsSection,
} from "@/components/settings/primitives";
import { Chip, Data, Item, List, Notice, ObjectRef } from "@/components/workday-v2/primitives";
import { readAdminLanguage } from "@/product/status/sources";
import { pick } from "@/workday/contracts";

export const dynamic = "force-dynamic";

type Pair = { en: string; de: string };

const COPY = {
  eyebrow: { en: "Administrator area", de: "Administrationsbereich" },
  title: { en: "Organisation", de: "Organisation" },
  lede: {
    en: "Which institution this deployment is configured for, which legal entities it covers, and the conventions the interface follows when it prints a date, a time or the name of a concept.",
    de: "Fuer welche Institution diese Installation konfiguriert ist, welche Rechtseinheiten sie umfasst und welchen Konventionen die Oberflaeche beim Anzeigen von Datum, Uhrzeit oder Begriffen folgt.",
  },
  notConfigured: {
    en: "No active product configuration was found. The values below are the documented fallbacks, not a configuration. Run the database migration and seed, then reload.",
    de: "Es wurde keine aktive Produktkonfiguration gefunden. Die folgenden Werte sind dokumentierte Standardwerte, keine Konfiguration. Fuehren Sie Migration und Seed der Datenbank aus und laden Sie neu.",
  },
  institution: { en: "Institution", de: "Institution" },
  name: { en: "Name", de: "Name" },
  shortName: { en: "Short name", de: "Kurzname" },
  profileId: { en: "Profile identifier", de: "Profilkennung" },
  countries: { en: "Countries", de: "Laender" },
  noneDeclared: { en: "None declared", de: "Keine angegeben" },
  configVersion: { en: "Configuration version", de: "Konfigurationsstand" },
  notConfiguredValue: { en: "Not configured", de: "Nicht konfiguriert" },
  lastWritten: {
    en: "Last written by {by}. Every resolver caches against this value, so a change takes effect on the next render.",
    de: "Zuletzt geschrieben von {by}. Jede Aufloesung speichert gegen diesen Wert zwischen, eine Aenderung wirkt daher bei der naechsten Darstellung.",
  },
  entities: { en: "Legal entities", de: "Rechtseinheiten" },
  bloc: { en: "Regulatory bloc", de: "Regulatorischer Block" },
  noEntities: {
    en: "The organisation profile names no legal entities that resolve against the scenario database. Seed the scenario before reading this screen.",
    de: "Das Organisationsprofil nennt keine Rechtseinheiten, die sich in der Szenariodatenbank aufloesen lassen. Spielen Sie das Szenario ein, bevor Sie diese Seite lesen.",
  },
  derived: {
    en: "Regulatory context is derived from each entity regulatory bloc, not stored per entity. An EU reference therefore cannot be attached to the Swiss entity by a configuration mistake: the Swiss entity has no column that could carry one.",
    de: "Der regulatorische Kontext wird aus dem regulatorischen Block jeder Einheit abgeleitet und nicht je Einheit gespeichert. Ein EU-Bezug kann der Schweizer Einheit daher nicht durch einen Konfigurationsfehler zugeordnet werden: die Schweizer Einheit hat keine Spalte, die ihn tragen koennte.",
  },
  locale: { en: "Locale, time and calendar", de: "Sprache, Zeit und Kalender" },
  defaultLocale: { en: "Default locale", de: "Standardsprache" },
  supportedLocales: { en: "Supported locales", de: "Unterstuetzte Sprachen" },
  supportedNote: {
    en: "The product has English and German interface copy. Separate Austrian and Swiss German variants are not claimed, and the German copy is written to serve all three countries.",
    de: "Das Produkt hat englische und deutsche Oberflaechentexte. Eigene oesterreichische und schweizerische Varianten werden nicht behauptet; die deutschen Texte sind fuer alle drei Laender geschrieben.",
  },
  timezone: { en: "Timezone", de: "Zeitzone" },
  dateFormat: { en: "Date format", de: "Datumsformat" },
  timeFormat: { en: "Time format", de: "Zeitformat" },
  timeNote: {
    en: "The workday prints a 24 hour clock throughout, which is the DACH convention and the one the scenario timeline uses.",
    de: "Der Arbeitstag zeigt durchgehend eine 24-Stunden-Uhr, die Konvention im DACH-Raum und die der Szenariozeitleiste.",
  },
  calendar: { en: "Working calendar", de: "Arbeitskalender" },
  calendarValue: { en: "{start} to {end}", de: "{start} bis {end}" },
  calendarNote: {
    en: "Used by the focus queue when it describes how overdue something is. A due time outside the working day is described in working hours, not in elapsed hours.",
    de: "Wird von der Fokusliste genutzt, wenn sie beschreibt, wie ueberfaellig etwas ist. Eine Faelligkeit ausserhalb des Arbeitstags wird in Arbeitsstunden beschrieben, nicht in vergangenen Stunden.",
  },
  terminology: { en: "Terminology in force", de: "Geltende Terminologie" },
  profile: { en: "Profile", de: "Profil" },
  description: { en: "Description", de: "Beschreibung" },
  overridden: { en: "Terms overridden", de: "Ueberschriebene Begriffe" },
  noneOverridden: {
    en: "None. Every term is the product default.",
    de: "Keine. Jeder Begriff ist der Produktstandard.",
  },
  ofTotal: { en: "{count} of {total}", de: "{count} von {total}" },
  overriddenNote: {
    en: "A stored profile holds only the terms it changes. The rest come from the product default, so adding a terminology key does not leave existing profiles with a gap.",
    de: "Ein gespeichertes Profil enthaelt nur die Begriffe, die es aendert. Der Rest kommt aus dem Produktstandard, ein neuer Begriffsschluessel hinterlaesst daher keine Luecke in bestehenden Profilen.",
  },
  profilesDefined: { en: "Profiles defined", de: "Definierte Profile" },
  none: { en: "None", de: "Keine" },
  terms: { en: "Terms", de: "Begriffe" },
  plural: { en: "plural", de: "Plural" },
  configured: { en: "Configured", de: "Konfiguriert" },
  defaultChip: { en: "Default", de: "Standard" },
  typedMap: {
    en: "Terminology is a typed key map, not a text replacement. A replacement pass would also rewrite the word inside the seeded evidence corpus and the quoted passages of a supplier attestation, which would show a source document saying something it does not say. The product renames concepts; it never edits evidence.",
    de: "Terminologie ist eine typisierte Schluesseltabelle, keine Textersetzung. Eine Ersetzung wuerde das Wort auch im eingespielten Nachweiskorpus und in zitierten Passagen einer Lieferantenbestaetigung aendern, ein Quelldokument saehe dann aus, als sage es etwas, das es nicht sagt. Das Produkt benennt Begriffe um; es veraendert nie Nachweise.",
  },
  pointers: { en: "Profiles this organisation points at", de: "Profile, auf die diese Organisation verweist" },
  brandProfile: { en: "Brand profile", de: "Markenprofil" },
  terminologyProfile: { en: "Terminology profile", de: "Terminologieprofil" },
  entitlementProfile: { en: "Entitlement profile", de: "Berechtigungsprofil" },
  deploymentProfile: { en: "Deployment profile", de: "Betriebsprofil" },
} as const;

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export default function OrganisationSettingsPage() {
  const language = readAdminLanguage();
  const say = (pair: Pair) => pick(pair, language);
  const config = getProductConfig();
  const organisation = config.organisation;
  const terminology = config.terminology;
  const allTerminologyProfiles = listTerminologyProfiles();
  const overridden = overriddenKeys(terminology);

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead eyebrow={say(COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />

      {config.configured ? null : <Notice tone="warning">{say(COPY.notConfigured)}</Notice>}

      <SettingsSection title={say(COPY.institution)}>
        <FieldList label={say(COPY.institution)}>
          <Field label={say(COPY.name)} value={organisation.name} />
          <Field label={say(COPY.shortName)} value={organisation.shortName} />
          <Field
            label={say(COPY.profileId)}
            value={<ObjectRef id={organisation.id} label={say(COPY.profileId)} />}
          />
          <Field
            label={say(COPY.countries)}
            value={
              organisation.countries.length > 0
                ? organisation.countries.join(", ")
                : say(COPY.noneDeclared)
            }
          />
          <Field
            label={say(COPY.configVersion)}
            value={config.updatedAt ?? say(COPY.notConfiguredValue)}
            note={config.updatedBy ? fill(say(COPY.lastWritten), { by: config.updatedBy }) : undefined}
            mono
          />
        </FieldList>
      </SettingsSection>

      <SettingsSection title={say(COPY.entities)} count={organisation.legalEntities.length}>
        <List label={say(COPY.entities)}>
          {organisation.legalEntities.map((entity) => (
            <Item
              key={entity.id}
              large
              title={
                <span className="app-row app-row-wrap">
                  {entity.name}
                  <Chip>{entity.country}</Chip>
                  <Chip>{entity.currency}</Chip>
                </span>
              }
              subtitle={
                <span className="app-row app-row-wrap">
                  <ObjectRef id={entity.id} label={say(COPY.entities)} />
                  <span className="app-meta">
                    {say(COPY.bloc)} <Data>{entity.regulatoryBloc}</Data>
                  </span>
                </span>
              }
            >
              <span style={{ marginTop: "var(--app-2)", display: "block" }}>
                <RegulatorContext items={entity.regulatorContext} language={language} />
              </span>
            </Item>
          ))}
        </List>

        {organisation.legalEntities.length === 0 ? (
          <Notice tone="warning">{say(COPY.noEntities)}</Notice>
        ) : (
          <Notice>{say(COPY.derived)}</Notice>
        )}
      </SettingsSection>

      <SettingsSection title={say(COPY.locale)}>
        <FieldList label={say(COPY.locale)}>
          <Field label={say(COPY.defaultLocale)} value={organisation.defaultLocale} mono />
          <Field
            label={say(COPY.supportedLocales)}
            value={organisation.supportedLocales.join(", ")}
            note={say(COPY.supportedNote)}
            mono
          />
          <Field label={say(COPY.timezone)} value={organisation.timezone} mono />
          <Field label={say(COPY.dateFormat)} value={organisation.dateFormat} mono />
          <Field
            label={say(COPY.timeFormat)}
            value={organisation.timeFormat}
            note={say(COPY.timeNote)}
            mono
          />
          <Field
            label={say(COPY.calendar)}
            value={fill(say(COPY.calendarValue), {
              start: organisation.workingDayStart,
              end: organisation.workingDayEnd,
            })}
            note={say(COPY.calendarNote)}
            mono
          />
        </FieldList>
      </SettingsSection>

      <SettingsSection title={say(COPY.terminology)} trailing={<Data>{terminology.id}</Data>}>
        <FieldList label={say(COPY.terminology)}>
          <Field label={say(COPY.profile)} value={terminology.name} />
          <Field label={say(COPY.description)} value={terminology.description} />
          <Field
            label={say(COPY.overridden)}
            value={
              overridden.length === 0
                ? say(COPY.noneOverridden)
                : fill(say(COPY.ofTotal), { count: overridden.length, total: TERMINOLOGY_KEYS.length })
            }
            note={say(COPY.overriddenNote)}
          />
          <Field
            label={say(COPY.profilesDefined)}
            value={allTerminologyProfiles.map((profile) => profile.name).join(", ") || say(COPY.none)}
          />
        </FieldList>

        <div style={{ marginTop: "var(--app-4)" }}>
          <List label={say(COPY.terms)}>
            {TERMINOLOGY_KEYS.map((key) => (
              <Item
                key={key}
                title={
                  <span className="app-row app-row-wrap">
                    <span>{termFrom(terminology.terms, key, language)}</span>
                    <span className="app-muted">
                      {termFrom(terminology.terms, key, language === "de" ? "en" : "de")}
                    </span>
                  </span>
                }
                subtitle={
                  <span className="app-row app-row-wrap">
                    <Data>{key}</Data>
                    <span className="app-meta">
                      {say(COPY.plural)} {termFrom(terminology.terms, key, "en", { plural: true })} /{" "}
                      {termFrom(terminology.terms, key, "de", { plural: true })}
                    </span>
                  </span>
                }
                trailing={
                  overridden.includes(key) ? (
                    <Chip tone="info">{say(COPY.configured)}</Chip>
                  ) : (
                    <Chip>{say(COPY.defaultChip)}</Chip>
                  )
                }
              />
            ))}
          </List>
        </div>

        <div style={{ marginTop: "var(--app-3)" }}>
          <Notice>{say(COPY.typedMap)}</Notice>
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.pointers)}>
        <FieldList label={say(COPY.pointers)}>
          <Field label={say(COPY.brandProfile)} value={organisation.brandProfileId} mono />
          <Field label={say(COPY.terminologyProfile)} value={organisation.terminologyProfileId} mono />
          <Field label={say(COPY.entitlementProfile)} value={organisation.entitlementProfileId} mono />
          <Field label={say(COPY.deploymentProfile)} value={organisation.deploymentProfileId} mono />
        </FieldList>
      </SettingsSection>
    </div>
  );
}
