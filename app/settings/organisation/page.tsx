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
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

const LANGUAGE: Language = "en";

export default function OrganisationSettingsPage() {
  const config = getProductConfig();
  const organisation = config.organisation;
  const terminology = config.terminology;
  const allTerminologyProfiles = listTerminologyProfiles();
  const overridden = overriddenKeys(terminology);

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead
        eyebrow="Administrator area"
        title="Organisation"
        lede="Which institution this deployment is configured for, which legal entities it covers, and the conventions the interface follows when it prints a date, a time or the name of a concept."
      />

      {config.configured ? null : (
        <Notice tone="warning">
          No active product configuration was found. The values below are the documented fallbacks,
          not a configuration. Run the database migration and seed, then reload.
        </Notice>
      )}

      <SettingsSection title="Institution">
        <FieldList label="Institution">
          <Field label="Name" value={organisation.name} />
          <Field label="Short name" value={organisation.shortName} />
          <Field
            label="Profile identifier"
            value={<ObjectRef id={organisation.id} label="Organisation profile" />}
          />
          <Field
            label="Countries"
            value={
              organisation.countries.length > 0 ? organisation.countries.join(", ") : "None declared"
            }
          />
          <Field
            label="Configuration version"
            value={config.updatedAt ?? "Not configured"}
            note={
              config.updatedBy
                ? `Last written by ${config.updatedBy}. Every resolver caches against this value, so a change takes effect on the next render.`
                : undefined
            }
            mono
          />
        </FieldList>
      </SettingsSection>

      <SettingsSection title="Legal entities" count={organisation.legalEntities.length}>
        <List label="Legal entities">
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
                  <ObjectRef id={entity.id} label="Legal entity" />
                  <span className="app-meta">
                    Regulatory bloc <Data>{entity.regulatoryBloc}</Data>
                  </span>
                </span>
              }
            >
              <span style={{ marginTop: "var(--app-2)", display: "block" }}>
                <RegulatorContext items={entity.regulatorContext} language={LANGUAGE} />
              </span>
            </Item>
          ))}
        </List>

        {organisation.legalEntities.length === 0 ? (
          <Notice tone="warning">
            The organisation profile names no legal entities that resolve against the scenario
            database. Seed the scenario before reading this screen.
          </Notice>
        ) : (
          <Notice>
            Regulatory context is derived from each entity regulatory bloc, not stored per entity.
            An EU reference therefore cannot be attached to the Swiss entity by a configuration
            mistake: the Swiss entity has no column that could carry one.
          </Notice>
        )}
      </SettingsSection>

      <SettingsSection title="Locale, time and calendar">
        <FieldList label="Locale and calendar">
          <Field label="Default locale" value={organisation.defaultLocale} mono />
          <Field
            label="Supported locales"
            value={organisation.supportedLocales.join(", ")}
            note="The product has English and German interface copy. Separate Austrian and Swiss German variants are not claimed, and the German copy is written to serve all three countries."
            mono
          />
          <Field label="Timezone" value={organisation.timezone} mono />
          <Field label="Date format" value={organisation.dateFormat} mono />
          <Field
            label="Time format"
            value={organisation.timeFormat}
            note="The workday prints a 24 hour clock throughout, which is the DACH convention and the one the scenario timeline uses."
            mono
          />
          <Field
            label="Working calendar"
            value={`${organisation.workingDayStart} to ${organisation.workingDayEnd}`}
            note="Used by the focus queue when it describes how overdue something is. A due time outside the working day is described in working hours, not in elapsed hours."
            mono
          />
        </FieldList>
      </SettingsSection>

      <SettingsSection
        title="Terminology in force"
        trailing={<Data>{terminology.id}</Data>}
      >
        <FieldList label="Terminology profile">
          <Field label="Profile" value={terminology.name} />
          <Field label="Description" value={terminology.description} />
          <Field
            label="Terms overridden"
            value={
              overridden.length === 0
                ? "None. Every term is the product default."
                : `${overridden.length} of ${TERMINOLOGY_KEYS.length}`
            }
            note="A stored profile holds only the terms it changes. The rest come from the product default, so adding a terminology key does not leave existing profiles with a gap."
          />
          <Field
            label="Profiles defined"
            value={allTerminologyProfiles.map((profile) => profile.name).join(", ") || "None"}
          />
        </FieldList>

        <div style={{ marginTop: "var(--app-4)" }}>
          <List label="Terms">
            {TERMINOLOGY_KEYS.map((key) => (
              <Item
                key={key}
                title={
                  <span className="app-row app-row-wrap">
                    <span>{termFrom(terminology.terms, key, "en")}</span>
                    <span className="app-muted">
                      {termFrom(terminology.terms, key, "de")}
                    </span>
                  </span>
                }
                subtitle={
                  <span className="app-row app-row-wrap">
                    <Data>{key}</Data>
                    <span className="app-meta">
                      plural {termFrom(terminology.terms, key, "en", { plural: true })} /{" "}
                      {termFrom(terminology.terms, key, "de", { plural: true })}
                    </span>
                  </span>
                }
                trailing={
                  overridden.includes(key) ? <Chip tone="info">Configured</Chip> : <Chip>Default</Chip>
                }
              />
            ))}
          </List>
        </div>

        <div style={{ marginTop: "var(--app-3)" }}>
          <Notice>
            Terminology is a typed key map, not a text replacement. A replacement pass would also
            rewrite the word inside the seeded evidence corpus and the quoted passages of a supplier
            attestation, which would show a source document saying something it does not say. The
            product renames concepts; it never edits evidence.
          </Notice>
        </div>
      </SettingsSection>

      <SettingsSection title="Profiles this organisation points at">
        <FieldList label="Profile pointers">
          <Field label="Brand profile" value={organisation.brandProfileId} mono />
          <Field label="Terminology profile" value={organisation.terminologyProfileId} mono />
          <Field label="Entitlement profile" value={organisation.entitlementProfileId} mono />
          <Field label="Deployment profile" value={organisation.deploymentProfileId} mono />
        </FieldList>
      </SettingsSection>
    </div>
  );
}
