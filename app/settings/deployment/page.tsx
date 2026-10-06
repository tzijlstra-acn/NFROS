/**
 * Deployment settings.
 *
 * The active profile, and all four defined profiles with the one that this
 * build actually runs marked as such.
 *
 * The screen reads `implementedHere` from the row rather than describing
 * readiness in prose. A capability claim written in prose drifts from the build
 * within a sprint and the first person to notice is the client who tried it; a
 * claim held in a column that the screen renders and a test asserts moves with
 * the build or fails.
 *
 * The version on this screen is the deployment profile's own version, not the
 * product release, and it is labelled so. The product release is in the
 * release registry and shown on the settings index and the operations
 * console. The prose statement of what the prototype runs was corrected in
 * this release: it said there was no backup, and backup and restore scripts
 * have existed since 4.0.0.
 */

import { deploymentHonesty, getProductConfig, listDeploymentProfiles } from "@/product";
import { DEPLOYMENT_KIND_LABELS } from "@/product";
import { DEPLOYMENT_KINDS } from "@/db/schema/product";
import {
  Field,
  FieldList,
  ImplementedMark,
  OutstandingWork,
  SettingsHead,
  SettingsSection,
} from "@/components/settings/primitives";
import { Chip, Data, Notice, ObjectRef } from "@/components/workday-v2/primitives";
import { readAdminLanguage } from "@/product/status/sources";
import { pick } from "@/workday/contracts";

export const dynamic = "force-dynamic";

type Pair = { en: string; de: string };

const COPY = {
  eyebrow: { en: "Administrator area", de: "Administrationsbereich" },
  title: { en: "Deployment", de: "Betrieb" },
  lede: {
    en: "Four deployment shapes are designed. One of them is what this build runs. Each profile states what it assumes about identity, data residency, model endpoints, retention, observability and the audit boundary.",
    de: "Vier Betriebsformen sind entworfen. Eine davon fuehrt dieser Build aus. Jedes Profil legt fest, was es zu Identitaet, Datenresidenz, Modellendpunkten, Aufbewahrung, Beobachtbarkeit und Audit-Grenze annimmt.",
  },
  activeIs: { en: "The active profile is", de: "Das aktive Profil ist" },
  active: { en: "Active profile", de: "Aktives Profil" },
  activeChip: { en: "Active", de: "Aktiv" },
  kind: { en: "Kind", de: "Art" },
  name: { en: "Name", de: "Name" },
  description: { en: "Description", de: "Beschreibung" },
  region: { en: "Region and residency", de: "Region und Residenz" },
  identity: { en: "Identity", de: "Identitaet" },
  endpoints: { en: "Model endpoints", de: "Modellendpunkte" },
  retention: { en: "Data retention", de: "Aufbewahrung" },
  observability: { en: "Observability and audit boundary", de: "Beobachtbarkeit und Audit-Grenze" },
  environment: { en: "Environment", de: "Umgebung" },
  profileVersion: { en: "Profile version", de: "Profilversion" },
  profileVersionNote: {
    en: "The version of this deployment profile. The product release is shown on the operations console.",
    de: "Die Version dieses Betriebsprofils. Das Produkt-Release zeigt die Betriebskonsole.",
  },
  runs: { en: "What this prototype actually runs", de: "Was dieser Prototyp tatsaechlich ausfuehrt" },
  runsNotice: {
    en: "One process on one machine, holding a synthetic institution in a local SQLite file. In demonstration mode there is no authentication: the acting role is scenario state, so switching role is a demonstration control and not an identity change. Design-partner mode signs in named pilot accounts from a static list, with no single sign-on. There is no tenancy, no data residency guarantee beyond the machine the file sits on, and no external telemetry. Backup and restore are command line scripts. Model calls, when the live mode is enabled, go to an endpoint the operator supplies through the environment.",
    de: "Ein Prozess auf einem Rechner mit einer synthetischen Institution in einer lokalen SQLite-Datei. Im Demonstrationsmodus gibt es keine Anmeldung: die handelnde Rolle ist Teil des Szenariozustands, ein Rollenwechsel ist daher eine Demonstrationssteuerung und kein Identitaetswechsel. Der Designpartner-Modus meldet benannte Pilotkonten aus einer festen Liste an, ohne Single Sign-on. Es gibt keine Mandantentrennung, keine Datenresidenz ueber den Rechner hinaus, auf dem die Datei liegt, und keine externe Telemetrie. Sicherung und Wiederherstellung sind Kommandozeilenskripte. Modellaufrufe gehen im Live-Modus an einen Endpunkt, den der Betreiber ueber die Umgebung vorgibt.",
  },
  runsNote: {
    en: "Stated here rather than only in the documentation because this is the screen an operator opens to find out what they are running. {implemented} of {total} defined profiles are implemented in this build.",
    de: "Hier und nicht nur in der Dokumentation, weil Betreiber diese Seite oeffnen, um zu erfahren, was sie betreiben. {implemented} von {total} definierten Profilen sind in diesem Build umgesetzt.",
  },
  all: { en: "All defined profiles", de: "Alle definierten Profile" },
  none: {
    en: "No deployment profiles are defined. Run the product configuration seed. The product is architected for {kinds} deployment kinds.",
    de: "Es sind keine Betriebsprofile definiert. Fuehren Sie den Seed der Produktkonfiguration aus. Das Produkt ist fuer {kinds} Betriebsarten ausgelegt.",
  },
} as const;

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export default function DeploymentSettingsPage() {
  const language = readAdminLanguage();
  const say = (pair: Pair) => pick(pair, language);
  const config = getProductConfig();
  const active = config.deployment;
  const profiles = listDeploymentProfiles();
  const activeHonesty = deploymentHonesty(active);
  const implementedCount = profiles.filter((profile) => profile.implementedHere).length;

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead eyebrow={say(COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />

      <Notice tone={activeHonesty.implementedHere ? "info" : "warning"}>
        {say(COPY.activeIs)} {active.name}. {pick(activeHonesty.claim, language)}
      </Notice>

      <SettingsSection title={say(COPY.active)} trailing={<Data>{active.id}</Data>}>
        <FieldList label={say(COPY.active)}>
          <Field
            label={say(COPY.kind)}
            value={
              <span className="app-row app-row-wrap">
                <Chip>{pick(DEPLOYMENT_KIND_LABELS[active.kind], language)}</Chip>
                <ImplementedMark implemented={active.implementedHere} language={language} />
              </span>
            }
          />
          <Field label={say(COPY.name)} value={active.name} />
          <Field label={say(COPY.description)} value={active.description} />
          <Field label={say(COPY.region)} value={active.region} />
          <Field label={say(COPY.identity)} value={active.identityMode} />
          <Field label={say(COPY.endpoints)} value={active.modelEndpointProfile} />
          <Field label={say(COPY.retention)} value={active.dataRetentionProfile} />
          <Field label={say(COPY.observability)} value={active.observabilityProfile} />
          <Field label={say(COPY.environment)} value={active.environment} mono />
          <Field
            label={say(COPY.profileVersion)}
            value={active.version}
            note={say(COPY.profileVersionNote)}
            mono
          />
        </FieldList>
      </SettingsSection>

      <SettingsSection title={say(COPY.runs)}>
        <div className="app-stack app-stack-3">
          <Notice tone="warning">{say(COPY.runsNotice)}</Notice>
          <span className="app-meta" style={{ maxWidth: "80ch" }}>
            {fill(say(COPY.runsNote), { implemented: implementedCount, total: profiles.length })}
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.all)} count={profiles.length}>
        <div className="app-stack app-stack-5">
          {profiles.map((profile) => {
            const honesty = deploymentHonesty(profile);
            return (
              <section
                key={profile.id}
                className="app-stack app-stack-3"
                style={{
                  paddingTop: "var(--app-4)",
                  borderTop: "1px solid var(--app-border)",
                }}
              >
                <div className="app-row app-row-wrap app-between">
                  <div className="app-stack app-stack-1">
                    <span className="app-object-title">{profile.name}</span>
                    <span className="app-row app-row-wrap">
                      <ObjectRef id={profile.id} label="Deployment profile" />
                      <span className="app-meta">
                        {pick(DEPLOYMENT_KIND_LABELS[profile.kind], language)} / {profile.kind}
                      </span>
                    </span>
                  </div>
                  <div className="app-row app-row-wrap">
                    {profile.id === active.id ? <Chip tone="ai">{say(COPY.activeChip)}</Chip> : null}
                    <Chip title={say(COPY.profileVersion)}>
                      <Data>{profile.version}</Data>
                    </Chip>
                    <ImplementedMark implemented={profile.implementedHere} language={language} />
                  </div>
                </div>

                <p
                  className="app-secondary"
                  style={{ fontSize: "var(--app-text-sm)", maxWidth: "80ch" }}
                >
                  {profile.description}
                </p>

                <FieldList label={profile.name}>
                  <Field label={say(COPY.region)} value={profile.region} />
                  <Field label={say(COPY.identity)} value={profile.identityMode} />
                  <Field label={say(COPY.endpoints)} value={profile.modelEndpointProfile} />
                  <Field label={say(COPY.retention)} value={profile.dataRetentionProfile} />
                  <Field label={say(COPY.observability)} value={profile.observabilityProfile} />
                  <Field label={say(COPY.environment)} value={profile.environment} mono />
                </FieldList>

                <span className="app-meta" style={{ maxWidth: "80ch" }}>
                  {pick(honesty.claim, language)}
                </span>

                <OutstandingWork items={honesty.outstandingWork} language={language} />
              </section>
            );
          })}
        </div>

        {profiles.length === 0 ? (
          <Notice tone="warning">{fill(say(COPY.none), { kinds: DEPLOYMENT_KINDS.length })}</Notice>
        ) : null}
      </SettingsSection>
    </div>
  );
}
