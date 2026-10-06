/**
 * Role pack settings.
 *
 * The six function packs, what each one actually contains, and which
 * entitlement profile grants it.
 *
 * There is no pricing, no purchasing flow and no messaging about what a
 * deployment could add. A pack that is not granted is reported as not granted
 * and nothing more. That restraint is the point: the moment an administrator
 * screen starts selling, the product has started treating its own users as
 * leads, and a risk professional who opens a settings screen mid incident does
 * not need a pitch.
 */

import {
  getProductConfig,
  hasAdminFeature,
  hasAiFeature,
  listEntitlementProfiles,
  ADMIN_FEATURE_IDS,
  AI_FEATURE_IDS,
} from "@/product";
import {
  Field,
  FieldList,
  GrantMark,
  IdentifierList,
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
  title: { en: "Role packs", de: "Rollenpakete" },
  lede: {
    en: "A function pack is one professional function: its domain objects, its roles, its governed tools, its screens, its evaluations and the connector packs it needs to be useful. Packs are how the product is licensed and how a deployment is scoped.",
    de: "Ein Funktionspaket ist eine Fachfunktion: ihre Fachobjekte, Rollen, gesteuerten Werkzeuge, Seiten, Evaluationen und die Konnektorpakete, die sie braucht. Pakete bestimmen die Lizenzierung und den Umfang einer Installation.",
  },
  notConfigured: {
    en: "No active product configuration was found. The grants below come from the documented fallback, which grants everything this build contains. Run the migration and seed to see a real entitlement profile.",
    de: "Es wurde keine aktive Produktkonfiguration gefunden. Die Freischaltungen unten stammen aus dem dokumentierten Standard, der alles in diesem Build freischaltet. Fuehren Sie Migration und Seed aus, um ein echtes Berechtigungsprofil zu sehen.",
  },
  activeProfile: { en: "Active entitlement profile", de: "Aktives Berechtigungsprofil" },
  profile: { en: "Profile", de: "Profil" },
  identifier: { en: "Identifier", de: "Kennung" },
  packsGranted: { en: "Function packs granted", de: "Freigeschaltete Funktionspakete" },
  ofTotal: { en: "{count} of {total}", de: "{count} von {total}" },
  absentNote: {
    en: "A pack that is defined but not granted is absent from the product, not hidden behind a prompt.",
    de: "Ein definiertes, aber nicht freigeschaltetes Paket fehlt im Produkt; es wird nicht hinter einem Hinweis versteckt.",
  },
  connectorPacks: { en: "Connector packs granted", de: "Freigeschaltete Konnektorpakete" },
  none: { en: "None", de: "Keine" },
  aiCapabilities: { en: "AI capabilities", de: "KI-Faehigkeiten" },
  aiNote: {
    en: "Capabilities, never model names. A deployment without autonomous execution has no path to a policy bound autonomous action regardless of its autonomy level, so the entitlement layer and the authority layer agree rather than compete.",
    de: "Faehigkeiten, nie Modellnamen. Eine Installation ohne autonome Ausfuehrung hat unabhaengig von der Autonomiestufe keinen Weg zu einer richtliniengebundenen autonomen Aktion; Berechtigungen und Befugnisse stimmen daher ueberein, statt zu konkurrieren.",
  },
  adminCapabilities: { en: "Administrator capabilities", de: "Administrationsfaehigkeiten" },
  functionPacks: { en: "Function packs", de: "Funktionspakete" },
  packVersion: { en: "Pack version", de: "Paketversion" },
  disabled: { en: "Disabled", de: "Deaktiviert" },
  primaryRole: { en: "Primary role", de: "Hauptrolle" },
  roles: { en: "Roles served", de: "Bediente Rollen" },
  domainObjects: { en: "Domain objects", de: "Fachobjekte" },
  tools: { en: "Governed tools", de: "Gesteuerte Werkzeuge" },
  toolsNote: {
    en: "Every name is a key in the tool registry. The registry, not the prompt, is the security boundary, so a pack cannot list a tool the product does not have.",
    de: "Jeder Name ist ein Schluessel im Werkzeugverzeichnis. Das Verzeichnis, nicht der Prompt, ist die Sicherheitsgrenze; ein Paket kann daher kein Werkzeug nennen, das das Produkt nicht hat.",
  },
  screens: { en: "Screens", de: "Seiten" },
  evaluations: { en: "Evaluations", de: "Evaluationen" },
  evaluationsNote: {
    en: "The evaluation cases that must pass for this pack. A pack whose evaluations are not run is a pack whose behaviour nobody is checking.",
    de: "Die Evaluationsfaelle, die fuer dieses Paket bestehen muessen. Ein Paket, dessen Evaluationen nicht laufen, ist ein Paket, dessen Verhalten niemand prueft.",
  },
  dependencies: { en: "Connector dependencies", de: "Konnektorabhaengigkeiten" },
  missingNote: {
    en: "Not granted by the active profile: {packs}. The pack is licensed and degraded, which is a different state from unlicensed.",
    de: "Vom aktiven Profil nicht freigeschaltet: {packs}. Das Paket ist lizenziert und eingeschraenkt, ein anderer Zustand als nicht lizenziert.",
  },
  grantedBy: { en: "Granted by", de: "Freigeschaltet durch" },
  noProfileGrants: {
    en: "No defined entitlement profile grants this pack.",
    de: "Kein definiertes Berechtigungsprofil schaltet dieses Paket frei.",
  },
  noPacks: {
    en: "No function packs are defined. Run the product configuration seed.",
    de: "Es sind keine Funktionspakete definiert. Fuehren Sie den Seed der Produktkonfiguration aus.",
  },
  profilesDefined: { en: "Entitlement profiles defined", de: "Definierte Berechtigungsprofile" },
  active: { en: "Active", de: "Aktiv" },
  profileCounts: {
    en: "{packs} function packs, {connectors} connector packs, {ai} AI capabilities",
    de: "{packs} Funktionspakete, {connectors} Konnektorpakete, {ai} KI-Faehigkeiten",
  },
  twoProfiles: {
    en: "Two profiles are defined so the entitlement model can be seen denying something. The pilot profile grants two function packs, three connector packs and no autonomous execution, which is what a first phase in a DACH institution looks like in practice.",
    de: "Zwei Profile sind definiert, damit das Berechtigungsmodell sichtbar etwas verweigert. Das Pilotprofil schaltet zwei Funktionspakete, drei Konnektorpakete und keine autonome Ausfuehrung frei, so sieht eine erste Phase in einer DACH-Institution in der Praxis aus.",
  },
} as const;

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export default function RolePacksSettingsPage() {
  const language = readAdminLanguage();
  const say = (pair: Pair) => pick(pair, language);
  const config = getProductConfig();
  const packs = config.functionPacks;
  const entitlements = config.entitlements;
  const profiles = listEntitlementProfiles();
  const grantedCount = packs.filter((pack) => pack.granted).length;

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead eyebrow={say(COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />

      {config.configured ? null : <Notice tone="warning">{say(COPY.notConfigured)}</Notice>}

      <SettingsSection title={say(COPY.activeProfile)}>
        <FieldList label={say(COPY.activeProfile)}>
          <Field label={say(COPY.profile)} value={entitlements.name} />
          <Field label={say(COPY.identifier)} value={<ObjectRef id={entitlements.id} />} />
          <Field
            label={say(COPY.packsGranted)}
            value={fill(say(COPY.ofTotal), { count: grantedCount, total: packs.length })}
            note={grantedCount === packs.length ? undefined : say(COPY.absentNote)}
          />
          <Field
            label={say(COPY.connectorPacks)}
            value={
              entitlements.connectorPacks.length > 0 ? (
                <IdentifierList items={entitlements.connectorPacks} label={say(COPY.connectorPacks)} />
              ) : (
                say(COPY.none)
              )
            }
          />
          <Field
            label={say(COPY.aiCapabilities)}
            value={
              <span className="app-row app-row-wrap">
                {AI_FEATURE_IDS.map((feature) => (
                  <Chip key={feature} tone={hasAiFeature(entitlements, feature) ? "ai" : "neutral"}>
                    {feature}
                  </Chip>
                ))}
              </span>
            }
            note={say(COPY.aiNote)}
          />
          <Field
            label={say(COPY.adminCapabilities)}
            value={
              <span className="app-row app-row-wrap">
                {ADMIN_FEATURE_IDS.map((feature) => (
                  <Chip
                    key={feature}
                    tone={hasAdminFeature(entitlements, feature) ? "info" : "neutral"}
                  >
                    {feature}
                  </Chip>
                ))}
              </span>
            }
          />
        </FieldList>
      </SettingsSection>

      <SettingsSection title={say(COPY.functionPacks)} count={packs.length}>
        <div className="app-stack app-stack-5">
          {packs.map((pack) => (
            <section key={pack.id} className="app-stack app-stack-3">
              <div className="app-row app-row-wrap app-between">
                <div className="app-stack app-stack-1">
                  <span className="app-object-title">{language === "de" ? pack.nameDe : pack.name}</span>
                  <span className="app-row app-row-wrap">
                    <ObjectRef id={pack.id} label={say(COPY.functionPacks)} />
                    <span className="app-meta">{language === "de" ? pack.name : pack.nameDe}</span>
                  </span>
                </div>
                <div className="app-row app-row-wrap">
                  <Chip title={say(COPY.packVersion)}>
                    <Data>{pack.version}</Data>
                  </Chip>
                  {pack.enabled ? null : <Chip tone="warning">{say(COPY.disabled)}</Chip>}
                  <GrantMark granted={pack.granted} language={language} />
                </div>
              </div>

              <p className="app-secondary" style={{ fontSize: "var(--app-text-sm)", maxWidth: "80ch" }}>
                {pack.description}
              </p>

              <FieldList label={language === "de" ? pack.nameDe : pack.name}>
                <Field label={say(COPY.primaryRole)} value={<Data>{pack.primaryRoleId}</Data>} />
                <Field
                  label={say(COPY.roles)}
                  value={<IdentifierList items={pack.roles} label={say(COPY.roles)} />}
                />
                <Field
                  label={say(COPY.domainObjects)}
                  value={<IdentifierList items={pack.domainObjects} label={say(COPY.domainObjects)} />}
                />
                <Field
                  label={say(COPY.tools)}
                  value={<IdentifierList items={pack.tools} label={say(COPY.tools)} />}
                  note={say(COPY.toolsNote)}
                />
                <Field
                  label={say(COPY.screens)}
                  value={<IdentifierList items={pack.screens} label={say(COPY.screens)} />}
                />
                <Field
                  label={say(COPY.evaluations)}
                  value={<IdentifierList items={pack.evaluations} label={say(COPY.evaluations)} />}
                  note={say(COPY.evaluationsNote)}
                />
                <Field
                  label={say(COPY.dependencies)}
                  value={
                    <IdentifierList
                      items={pack.connectorDependencies}
                      label={say(COPY.dependencies)}
                    />
                  }
                  {...(pack.missingConnectorPacks.length > 0
                    ? {
                        note: fill(say(COPY.missingNote), {
                          packs: pack.missingConnectorPacks.join(", "),
                        }),
                      }
                    : {})}
                />
                <Field
                  label={say(COPY.grantedBy)}
                  value={
                    profiles
                      .filter((profile) => profile.functionPacks.includes(pack.id))
                      .map((profile) => profile.name)
                      .join("; ") || say(COPY.noProfileGrants)
                  }
                />
              </FieldList>
            </section>
          ))}
        </div>

        {packs.length === 0 ? <Notice tone="warning">{say(COPY.noPacks)}</Notice> : null}
      </SettingsSection>

      <SettingsSection title={say(COPY.profilesDefined)} count={profiles.length}>
        <List label={say(COPY.profilesDefined)}>
          {profiles.map((profile) => (
            <Item
              key={profile.id}
              title={
                <span className="app-row app-row-wrap">
                  {profile.name}
                  {profile.id === entitlements.id ? <Chip tone="ai">{say(COPY.active)}</Chip> : null}
                </span>
              }
              subtitle={
                <span className="app-row app-row-wrap">
                  <ObjectRef id={profile.id} />
                  <span className="app-meta">
                    {fill(say(COPY.profileCounts), {
                      packs: profile.functionPacks.length,
                      connectors: profile.connectorPacks.length,
                      ai: profile.aiFeatures.length,
                    })}
                  </span>
                </span>
              }
            />
          ))}
        </List>
        <div style={{ marginTop: "var(--app-3)" }}>
          <Notice>{say(COPY.twoProfiles)}</Notice>
        </div>
      </SettingsSection>
    </div>
  );
}
