/**
 * The Releases section of the Product Owner Console (plan 7.9).
 *
 * One release view: the release this build carries and what the console has
 * recorded about it, the release gate with a row per check, the evidence
 * pack, the three material release actions, and then, on demand, the
 * migrations, the versions in force, the AI configurations and model
 * profiles, connector state and the known limitations.
 *
 * Deploy and Roll back are Simulated in this environment and carry the word
 * wherever they appear. The release identity comes from the registry; the
 * page decides nothing.
 *
 * Server component.
 */

import Link from "next/link";
import { Field, FieldList, SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Empty, Item, List, Notice } from "@/components/workday-v2/primitives";
import { AI_CONFIGURATION_REGISTRY, MODEL_PROFILES } from "@/ai/prompt-registry";
import { listCurrentRoleAppVersions } from "@/db/repositories/role-app-release";
import { KNOWN_LIMITATIONS, LIMITATION_STATUS_LABELS, RELEASE_STAGE_LABELS, getProductReleaseRegistry } from "@/product/release";
import { StatusBadge } from "@/product/status";
import { readConnectorStatusCounts } from "@/product/status/sources";
import type { Language } from "@/i18n/labels";
import type { Bilingual } from "../permissions";
import { readActingConsoleIdentity } from "../persona/acting";
import { ConsoleActionForm } from "../forms/ConsoleActionForm";
import { formGate } from "../forms/gate";
import { CONSOLE_COPY } from "../shell/copy";
import { consoleWrapStyle } from "../shell/styles";
import { LIFECYCLE_STATE_LABELS } from "../role-apps/labels";
import {
  actionApprovePilotRelease,
  actionDeployRelease,
  actionGenerateEvidencePack,
  actionRollBackRelease,
  actionRunReleaseGate,
} from "./actions";
import { readMigrationState } from "./migrations";
import { gateRunInProgress, proposeApprovePilotRelease, proposeDeploy, proposeReleaseRollBack, readReleaseView, rollbackPlan } from "./release";
import { GateRunFollow } from "./GateRunFollow";

const COPY = {
  title: { en: "Releases", de: "Releases" },
  lede: {
    en: "The release this build carries, its gate, its evidence and its rollout. Version, name and limitations come from the release registry; the console records what happened to the release. No release while a mandatory gate fails.",
    de: "Das Release dieses Builds, seine Pruefung, seine Nachweise und seine Einfuehrung. Version, Name und Einschraenkungen stammen aus dem Release-Verzeichnis; die Konsole erfasst, was mit dem Release geschah. Kein Release, solange eine Pflichtpruefung fehlschlaegt.",
  },
  release: { en: "Current and candidate release", de: "Aktuelles und Kandidaten-Release" },
  build: { en: "This build", de: "Dieser Build" },
  candidate: { en: "Candidate release", de: "Kandidaten-Release" },
  noCandidate: { en: "None: the build is released.", de: "Keines: Der Build ist freigegeben." },
  deployed: { en: "Deployed (console record)", de: "Bereitgestellt (Konsolendatensatz)" },
  notDeployed: { en: "No release has been deployed through the console.", de: "Ueber die Konsole wurde noch kein Release bereitgestellt." },
  rollout: { en: "Rollout status", de: "Stand der Einfuehrung" },
  rollbackPlan: { en: "Rollback plan", de: "Rueckfallplan" },
  simulatedNote: {
    en: "Deployment is Simulated in this environment: it has no deployment target, so Deploy and Roll back are recorded and change no system.",
    de: "Die Bereitstellung ist in dieser Umgebung simuliert: Es gibt kein Bereitstellungsziel, Bereitstellen und Zuruecksetzen werden daher erfasst und veraendern kein System.",
  },
  gate: { en: "Release gate", de: "Release-Pruefung" },
  runGate: { en: "Run release gate", de: "Release-Pruefung ausfuehren" },
  gateNote: {
    en: "Runs every check now, against this build and this database. The copy and secret scans run the repository's own scripts; only their exit code is kept.",
    de: "Fuehrt jede Pruefung jetzt aus, gegen diesen Build und diese Datenbank. Die Text- und Geheimnispruefungen nutzen die Skripte des Repositorys; nur ihr Rueckgabewert wird gespeichert.",
  },
  noGate: { en: "No gate run is recorded for this version.", de: "Fuer diese Version ist keine Pruefung erfasst." },
  running: { en: "Running", de: "Laeuft" },
  interrupted: {
    en: "The last gate run did not complete: the server stopped while it ran. It does not count as a pass. Run the gate again.",
    de: "Die letzte Pruefung wurde nicht abgeschlossen: Der Server wurde waehrend des Laufs beendet. Sie gilt nicht als bestanden. Fuehren Sie die Pruefung erneut aus.",
  },
  check: { en: "Check", de: "Pruefung" },
  mandatory: { en: "mandatory", de: "Pflicht" },
  optional: { en: "not mandatory", de: "keine Pflicht" },
  passed: { en: "Passed", de: "Bestanden" },
  failed: { en: "Failed", de: "Fehlgeschlagen" },
  notRun: { en: "Not run", de: "Nicht ausgefuehrt" },
  skipped: { en: "Skipped", de: "Uebersprungen" },
  ranAt: { en: "Run", de: "Ausgefuehrt" },
  by: { en: "by", de: "von" },
  earlierRuns: { en: "earlier runs", de: "fruehere Laeufe" },
  evidence: { en: "Evidence pack", de: "Nachweispaket" },
  generate: { en: "Generate evidence pack", de: "Nachweispaket erzeugen" },
  evidenceNote: {
    en: "Runs scripts/release-package.ts and writes a pack that references it, with the latest gate run, the readiness checks, the migrations, the Role App versions in force and the known limitations. No credential, personal data or document text is included.",
    de: "Fuehrt scripts/release-package.ts aus und schreibt ein Paket, das darauf verweist, mit der letzten Pruefung, den Bereitschaftspruefungen, den Migrationen, den geltenden Rollen-App-Versionen und den bekannten Einschraenkungen. Es enthaelt keine Zugangsdaten, personenbezogenen Daten oder Dokumenttexte.",
  },
  noEvidence: { en: "No evidence pack is recorded for this version.", de: "Fuer diese Version ist kein Nachweispaket erfasst." },
  actions: { en: "Release actions", de: "Release-Aktionen" },
  approvePilot: { en: "Approve pilot release", de: "Pilot-Release freigeben" },
  deploy: { en: "Deploy (Simulated)", de: "Bereitstellen (simuliert)" },
  rollBack: { en: "Roll back (Simulated)", de: "Zuruecksetzen (simuliert)" },
  details: { en: "Release contents", de: "Inhalt des Releases" },
  migrations: { en: "Database migrations", de: "Datenbankmigrationen" },
  applied: { en: "applied", de: "angewendet" },
  pending: { en: "pending", de: "ausstehend" },
  appVersions: { en: "Role App versions in force", de: "Geltende Rollen-App-Versionen" },
  prompts: { en: "Prompt versions and model profiles", de: "Prompt-Versionen und Modellprofile" },
  connectors: { en: "Connector state", de: "Zustand der Konnektoren" },
  instances: { en: "instances", de: "Instanzen" },
  openIntegrations: { en: "Integrations", de: "Integrationen" },
  limitations: { en: "Known limitations", de: "Bekannte Einschraenkungen" },
  history: { en: "Release history", de: "Release-Verlauf" },
  noHistory: { en: "Nothing has been recorded for this release yet.", de: "Fuer dieses Release wurde noch nichts erfasst." },
  unavailable: {
    en: "The release records could not be read. Run npm run db:migrate.",
    de: "Die Release-Datensaetze konnten nicht gelesen werden. Fuehren Sie npm run db:migrate aus.",
  },
} as const;

const EVENT_LABELS: Record<string, Bilingual> = {
  "candidate-declared": { en: "Candidate declared", de: "Kandidat erklaert" },
  "gate-run-recorded": { en: "Gate run recorded", de: "Pruefung erfasst" },
  "evidence-pack-generated": { en: "Evidence pack generated", de: "Nachweispaket erzeugt" },
  "pilot-release-approved": { en: "Pilot release approved", de: "Pilot-Release freigegeben" },
  deployed: { en: "Deployed (Simulated)", de: "Bereitgestellt (simuliert)" },
  "rollout-updated": { en: "Rollout updated", de: "Einfuehrung aktualisiert" },
  "rolled-back": { en: "Rolled back (Simulated)", de: "Zurueckgesetzt (simuliert)" },
};

const ROLLOUT_LABELS: Record<string, Bilingual> = {
  "not-started": { en: "Not started", de: "Nicht begonnen" },
  pilot: { en: "Pilot cohort", de: "Pilotkohorte" },
  partial: { en: "Partial", de: "Teilweise" },
  complete: { en: "Complete", de: "Vollstaendig" },
  "rolled-back": { en: "Rolled back", de: "Zurueckgesetzt" },
};

export async function ReleasesConsole({ language }: { language: Language }) {
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  const view = readReleaseView();
  const identity = await readActingConsoleIdentity();
  const registry = getProductReleaseRegistry();
  const migrations = readMigrationState();
  const approve = proposeApprovePilotRelease(view);
  const deploy = proposeDeploy(view);
  const rollBack = proposeReleaseRollBack(view);
  const plan = rollbackPlan(view);
  const gate = view.latestGate;
  const connectors = readConnectorStatusCounts();
  let versions: ReturnType<typeof listCurrentRoleAppVersions> = [];
  try {
    versions = listCurrentRoleAppVersions();
  } catch {
    versions = [];
  }
  const statusWord = (status: string) =>
    status === "passed" ? say(COPY.passed) : status === "failed" ? say(COPY.failed) : status === "skipped" ? say(COPY.skipped) : say(COPY.notRun);

  return (
    <div className="app-stack-6" data-testid="console-releases">
      <SettingsHead eyebrow={say(CONSOLE_COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />
      {!view.available ? <Notice tone="warning">{say(COPY.unavailable)}</Notice> : null}

      <SettingsSection title={say(COPY.release)} trailing={<Chip tone="ai">{say(RELEASE_STAGE_LABELS[view.stage])}</Chip>}>
        <FieldList label={say(COPY.release)}>
          <Field
            label={say(COPY.build)}
            value={
              <span className="app-row app-row-wrap">
                <Data size="sm">{registry.release.version}</Data>
                <span>{say(registry.release.name)}</span>
                <Data>{registry.release.date}</Data>
              </span>
            }
          />
          <Field label={say(COPY.candidate)} value={view.stage === "candidate" ? <Data size="sm">{view.version}</Data> : say(COPY.noCandidate)} />
          <Field
            label={say(COPY.deployed)}
            value={
              view.deployed ? (
                <span className="app-row app-row-wrap" data-testid="release-deployed">
                  <Data size="sm">{view.deployed.releaseVersion}</Data>
                  <StatusBadge status="simulated" language={language} detail={say(COPY.simulatedNote)} />
                  <Data>{view.deployed.deployedAt.slice(0, 16).replace("T", " ")}</Data>
                </span>
              ) : (
                say(COPY.notDeployed)
              )
            }
          />
          <Field
            label={say(COPY.rollout)}
            value={view.deployed?.rolloutStatus ? say(ROLLOUT_LABELS[view.deployed.rolloutStatus] ?? { en: view.deployed.rolloutStatus, de: view.deployed.rolloutStatus }) : say(ROLLOUT_LABELS["not-started"]!)}
          />
          <Field label={say(COPY.rollbackPlan)} value={<span style={consoleWrapStyle}>{say(plan)}</span>} />
        </FieldList>
      </SettingsSection>

      <SettingsSection
        title={say(COPY.gate)}
        trailing={
          gate ? (
            <span data-testid="release-gate-status" data-status={gate.status}>
              {gate.status === "running" ? (
                <Chip tone="info">{say(COPY.running)}</Chip>
              ) : (
                <Chip tone={gate.status === "passed" ? "success" : "danger"}>
                  {gate.status === "passed" ? say(COPY.passed) : say(COPY.failed)} {gate.mandatoryTotal - gate.mandatoryFailed}/{gate.mandatoryTotal}
                </Chip>
              )}
            </span>
          ) : undefined
        }
      >
        <div className="app-stack-3">
          <span className="app-meta" style={consoleWrapStyle}>{say(COPY.gateNote)}</span>
          <ConsoleActionForm
            action={actionRunReleaseGate}
            language={language}
            label={say(COPY.runGate)}
            {...formGate(identity.scopes, "release.run-gate", language)}
            tone="primary"
            testId="release-run-gate"
          />
          {gate && gateRunInProgress(gate) ? (
            <div className="app-row app-row-wrap" data-testid="release-gate-running">
              <Chip tone="info">{say(COPY.running)}</Chip>
              <span className="app-meta">
                {say(COPY.ranAt)} <Data>{gate.startedAt.slice(0, 16).replace("T", " ")}</Data> {say(COPY.by)} {gate.triggeredByLabel}.
              </span>
              <GateRunFollow language={language} />
            </div>
          ) : gate && gate.status === "running" ? (
            <Notice tone="warning">{say(COPY.interrupted)}</Notice>
          ) : gate ? (
            <div className="app-stack-2" data-testid="release-gate-results">
              <span className="app-meta">
                {say(COPY.ranAt)} <Data>{(gate.completedAt ?? gate.startedAt).slice(0, 16).replace("T", " ")}</Data> {say(COPY.by)} {gate.triggeredByLabel}.{" "}
                {view.gateRuns.length > 1 ? `${view.gateRuns.length - 1} ${say(COPY.earlierRuns)}.` : ""}
              </span>
              <List label={say(COPY.gate)}>
                {gate.results.map((entry) => (
                  <Item
                    key={entry.gateKey}
                    title={
                      <span className="app-row app-row-wrap" data-testid={`release-gate-check-${entry.gateKey}`} data-status={entry.status}>
                        <Chip tone={entry.status === "passed" ? "success" : entry.status === "failed" ? "danger" : "neutral"}>{statusWord(entry.status)}</Chip>
                        <span>{entry.label}</span>
                        <span className="app-faint">{entry.mandatory ? say(COPY.mandatory) : say(COPY.optional)}</span>
                      </span>
                    }
                    trailing={entry.durationMs !== null ? <Data>{`${entry.durationMs} ms`}</Data> : undefined}
                  >
                    <span className="app-meta" style={consoleWrapStyle}>
                      {entry.detail}
                    </span>
                  </Item>
                ))}
              </List>
            </div>
          ) : (
            <Empty title={say(COPY.noGate)} />
          )}
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.evidence)}>
        <div className="app-stack-3">
          <span className="app-meta" style={consoleWrapStyle}>{say(COPY.evidenceNote)}</span>
          <ConsoleActionForm
            action={actionGenerateEvidencePack}
            language={language}
            label={say(COPY.generate)}
            {...formGate(identity.scopes, "release.generate-evidence-pack", language)}
            testId="release-evidence-pack"
          />
          {view.latestEvidence ? (
            <span className="app-row app-row-wrap" data-testid="release-evidence-latest">
              <span className="app-oid">{view.latestEvidence.evidencePackRef}</span>
              <span className="app-meta">sha256</span>
              <span className="app-oid">{(view.latestEvidence.evidencePackDigest ?? "").slice(0, 16)}</span>
              <Data>{view.latestEvidence.at.slice(0, 16).replace("T", " ")}</Data>
            </span>
          ) : (
            <Empty title={say(COPY.noEvidence)} />
          )}
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.actions)}>
        <div className="app-stack-3">
          <span className="app-meta" style={consoleWrapStyle}>{say(COPY.simulatedNote)}</span>
          <div className="app-row app-row-wrap app-row-top" style={{ gap: "var(--app-3)" }}>
            <ConsoleActionForm
              action={actionApprovePilotRelease}
              language={language}
              label={say(COPY.approvePilot)}
              {...formGate(identity.scopes, "release.approve-pilot", language, approve.blocked)}
              approval={{ lines: approve.lines.map(say), fingerprint: approve.fingerprint }}
              tone="primary"
              testId="release-approve-pilot"
            />
            <ConsoleActionForm
              action={actionDeployRelease}
              language={language}
              label={say(COPY.deploy)}
              {...formGate(identity.scopes, "release.deploy", language, deploy.blocked)}
              approval={{ lines: deploy.lines.map(say), fingerprint: deploy.fingerprint }}
              testId="release-deploy"
            />
            <ConsoleActionForm
              action={actionRollBackRelease}
              language={language}
              label={say(COPY.rollBack)}
              {...formGate(identity.scopes, "release.roll-back", language, rollBack.blocked)}
              approval={{ lines: rollBack.lines.map(say), fingerprint: rollBack.fingerprint }}
              tone="danger"
              testId="release-roll-back"
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.details)}>
        <div className="app-stack-3">
          <details>
            <summary className="app-meta" style={{ cursor: "pointer" }} data-testid="release-migrations-toggle">
              {say(COPY.migrations)}: <Data>{migrations.appliedCount}</Data> / <Data>{migrations.entries.length}</Data> {say(COPY.applied)}
              {migrations.pending.length > 0 ? `, ${migrations.pending.length} ${say(COPY.pending)}` : ""}
            </summary>
            <List label={say(COPY.migrations)}>
              {migrations.entries.map((entry) => (
                <Item
                  key={entry.tag}
                  title={<span className="app-oid">{entry.tag}</span>}
                  trailing={<Chip tone={entry.applied ? "success" : "warning"}>{entry.applied ? say(COPY.applied) : say(COPY.pending)}</Chip>}
                />
              ))}
            </List>
          </details>
          <details>
            <summary className="app-meta" style={{ cursor: "pointer" }}>
              {say(COPY.appVersions)}: <Data>{versions.length}</Data>
            </summary>
            <List label={say(COPY.appVersions)}>
              {versions.map((version) => (
                <Item
                  key={version.id}
                  title={
                    <span className="app-row app-row-wrap">
                      <span className="app-oid">{version.roleAppId}</span>
                      <Chip>{say(LIFECYCLE_STATE_LABELS[version.lifecycleState])}</Chip>
                    </span>
                  }
                  trailing={<Data>{version.version}</Data>}
                />
              ))}
            </List>
          </details>
          <details>
            <summary className="app-meta" style={{ cursor: "pointer" }}>
              {say(COPY.prompts)}: <Data>{AI_CONFIGURATION_REGISTRY.length}</Data> / <Data>{MODEL_PROFILES.length}</Data>
            </summary>
            <List label={say(COPY.prompts)}>
              {AI_CONFIGURATION_REGISTRY.map((configuration) => (
                <Item
                  key={configuration.id}
                  title={<span className="app-oid">{configuration.id}</span>}
                  trailing={
                    <span className="app-row app-row-wrap">
                      <Data>{configuration.promptVersion}</Data>
                      <span className="app-oid">{configuration.modelProfileId}</span>
                      <Chip>{configuration.status}</Chip>
                    </span>
                  }
                />
              ))}
            </List>
          </details>
          <details>
            <summary className="app-meta" style={{ cursor: "pointer" }}>
              {say(COPY.connectors)}
            </summary>
            <div className="app-row app-row-wrap" style={{ marginTop: "var(--app-2)" }}>
              {connectors === null ? (
                <StatusBadge status="unavailable" language={language} />
              ) : (
                connectors.map((entry) => (
                  <span key={entry.status} className="app-row">
                    <StatusBadge status={entry.status} language={language} />
                    <Data>{entry.count}</Data>
                    <span className="app-faint">{say(COPY.instances)}</span>
                  </span>
                ))
              )}
              <Link href="/product/integrations" className="app-source-link">
                {say(COPY.openIntegrations)}
              </Link>
            </div>
          </details>
          <details>
            <summary className="app-meta" style={{ cursor: "pointer" }}>
              {say(COPY.limitations)}: <Data>{KNOWN_LIMITATIONS.length}</Data>
            </summary>
            <List label={say(COPY.limitations)}>
              {KNOWN_LIMITATIONS.map((limitation) => (
                <Item
                  key={limitation.id}
                  title={
                    <span className="app-row app-row-wrap">
                      <span>{say(limitation.title)}</span>
                      <Chip tone={limitation.status === "open" ? "warning" : "neutral"}>{say(LIMITATION_STATUS_LABELS[limitation.status])}</Chip>
                    </span>
                  }
                >
                  <span className="app-meta" style={consoleWrapStyle}>
                    {say(limitation.detail)}
                  </span>
                </Item>
              ))}
            </List>
          </details>
          <details>
            <summary className="app-meta" style={{ cursor: "pointer" }}>
              {say(COPY.history)}: <Data>{view.events.length}</Data>
            </summary>
            {view.events.length === 0 ? (
              <Empty title={say(COPY.noHistory)} />
            ) : (
              <List label={say(COPY.history)}>
                {[...view.events].reverse().map((event) => (
                  <Item
                    key={event.id}
                    title={say(EVENT_LABELS[event.kind] ?? { en: event.kind, de: event.kind })}
                    trailing={<Data>{event.at.slice(0, 16).replace("T", " ")}</Data>}
                  >
                    <span className="app-meta" style={consoleWrapStyle}>
                      {event.actorLabel}
                      {event.note ? `: ${event.note}` : ""}
                    </span>
                  </Item>
                ))}
              </List>
            )}
          </details>
        </div>
      </SettingsSection>
    </div>
  );
}
