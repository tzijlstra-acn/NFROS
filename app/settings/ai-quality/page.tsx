/**
 * AI quality settings.
 *
 * The released AI configurations, their model profiles, the recorded
 * evaluation run and the source completeness display labels.
 *
 * The evaluation status used to be a sentence typed into this file that
 * stayed the same whether or not a run existed. It is now
 * read from `evals/results/latest.json` through
 * `src/product/status/sources.ts`, and the reading is honest about what the
 * run proves: a structural run grades synthetic envelopes built from each
 * case, so it is Simulated for the harness and Not verified for model output,
 * however many cases pass.
 *
 * Read only. Promoting a candidate configuration is a build pipeline step, not
 * a runtime action, and this screen offers no control for it.
 *
 * Illustrative regulatory context, not legal advice.
 */

import { AI_CONFIGURATION_REGISTRY, MODEL_PROFILES } from "@/ai/prompt-registry";
import type { AIConfigurationVersion, ModelProfile } from "@/ai/prompt-registry";
import { getDisplayStatus } from "@/ai/source-status";
import type { SourceCompletenessStatus } from "@/ai/source-status";
import {
  Field,
  FieldList,
  SettingsHead,
  SettingsSection,
} from "@/components/settings/primitives";
import { Chip, Data, Notice, ObjectRef } from "@/components/workday-v2/primitives";
import { StatusBadge } from "@/product/status";
import {
  evaluationReadingsForRole,
  readAdminLanguage,
  readEvaluationEvidence,
  type EvaluationEvidence,
} from "@/product/status/sources";
import { getRoleRelease } from "@/product/release";
import { pick } from "@/workday/contracts";
import type { Language } from "@/i18n/labels";
import { StatusList, StatusRow } from "../_components/StatusRows";

export const dynamic = "force-dynamic";

type Pair = { en: string; de: string };

const COPY = {
  eyebrow: { en: "Administrator area", de: "Administrationsbereich" },
  title: { en: "AI quality", de: "KI-Qualitaet" },
  lede: {
    en: "The released AI configurations, their model profiles and the recorded evaluation run for this deployment. Configurations are code versioned: promoting a candidate to released is a build pipeline step, not a runtime action.",
    de: "Die freigegebenen KI-Konfigurationen, ihre Modellprofile und der erfasste Evaluationslauf dieser Installation. Konfigurationen sind im Code versioniert: eine Freigabe ist ein Schritt in der Build-Pipeline, keine Aktion zur Laufzeit.",
  },
  registry: { en: "Registry summary", de: "Verzeichnis im Ueberblick" },
  total: { en: "Total configurations", de: "Konfigurationen gesamt" },
  released: { en: "Released", de: "Freigegeben" },
  draftOrCandidate: { en: "Draft or candidate", de: "Entwurf oder Kandidat" },
  schema: { en: "Schema version", de: "Schemaversion" },
  schemaNote: {
    en: "All released configurations write to the same typed response envelope.",
    de: "Alle freigegebenen Konfigurationen schreiben in dieselbe typisierte Antwortstruktur.",
  },
  releasedConfigs: { en: "Released configurations", de: "Freigegebene Konfigurationen" },
  profiles: { en: "Model profiles", de: "Modellprofile" },
  evaluation: { en: "Evaluation status", de: "Evaluationsstatus" },
  harness: { en: "Evaluation harness", de: "Evaluationsumgebung" },
  modelOutput: { en: "Model output quality", de: "Qualitaet der Modellausgaben" },
  run: { en: "Recorded run", de: "Erfasster Lauf" },
  noRun: { en: "None recorded", de: "Keiner erfasst" },
  mode: { en: "Mode", de: "Modus" },
  cases: { en: "Cases", de: "Faelle" },
  tally: { en: "{passed} passed, {failed} failed, {notRun} not run", de: "{passed} bestanden, {failed} fehlgeschlagen, {notRun} nicht ausgefuehrt" },
  runner: {
    en: "The runner is scripts/eval-runner.ts and writes evals/results/latest.json. Structural runs need no API key and make no model call. Grounded and live modes currently record every case as not run.",
    de: "Der Runner ist scripts/eval-runner.ts und schreibt evals/results/latest.json. Strukturelle Laeufe brauchen keinen API-Schluessel und rufen kein Modell auf. Fundierte und Live-Modi erfassen derzeit jeden Fall als nicht ausgefuehrt.",
  },
  suite: { en: "Evaluation suite", de: "Evaluationssuite" },
  suiteNote: {
    en: "No case file is grouped under this suite identifier, so the reading covers every recorded case for this role.",
    de: "Unter dieser Suite-Kennung ist keine Falldatei gruppiert, die Bewertung umfasst daher alle erfassten Faelle dieser Rolle.",
  },
  completeness: { en: "Source completeness display labels", de: "Anzeige der Quellenvollstaendigkeit" },
  completenessNote: {
    en: "Source completeness is a categorical label, not a percentage. A numerical confidence figure would suggest precision the model does not have. These five labels are the only display states permitted, and the computation runs in src/ai/source-status.ts.",
    de: "Quellenvollstaendigkeit ist eine Kategorie, kein Prozentwert. Eine Zahl wuerde eine Genauigkeit nahelegen, die das Modell nicht hat. Nur diese fuenf Bezeichnungen sind zulaessig, die Berechnung liegt in src/ai/source-status.ts.",
  },
  regulatory: { en: "Regulatory context", de: "Regulatorischer Kontext" },
  regulatoryNote: {
    en: "Illustrative regulatory context, not legal advice. These controls support demonstrability under operational risk frameworks: for the EU entities in Germany and Austria, DORA and the EBA guidelines on ICT risk; for the Swiss entity, FINMA requirements. They are not a compliance opinion. Engage your compliance function before using them as evidence in a regulatory submission.",
    de: "Illustrativer regulatorischer Kontext, keine Rechtsberatung. Diese Kontrollen unterstuetzen die Nachweisbarkeit nach Rahmenwerken fuer operationelle Risiken: fuer die EU-Einheiten in Deutschland und Oesterreich DORA und die EBA-Leitlinien zu IKT-Risiken, fuer die Schweizer Einheit die Anforderungen der FINMA. Sie sind keine Compliance-Aussage. Beziehen Sie Ihre Compliance-Funktion ein, bevor Sie sie als Nachweis gegenueber einer Aufsicht verwenden.",
  },
  role: { en: "Role", de: "Rolle" },
  taskKind: { en: "Task kind", de: "Aufgabenart" },
  outputSchema: { en: "Output schema", de: "Ausgabeschema" },
  modelProfile: { en: "Model profile", de: "Modellprofil" },
  releasedAt: { en: "Released at", de: "Freigegeben am" },
  releasedBy: { en: "Released by", de: "Freigegeben von" },
  model: { en: "Model", de: "Modell" },
  modelId: { en: "Model ID", de: "Modell-ID" },
  provider: { en: "Provider", de: "Anbieter" },
  maxTokens: { en: "Max tokens", de: "Maximale Tokens" },
  temperature: { en: "Temperature", de: "Temperatur" },
  promptVersion: { en: "Prompt version", de: "Prompt-Version" },
} as const;

const CONFIG_STATUS_LABELS: Record<AIConfigurationVersion["status"], Pair> = {
  released: { en: "Released", de: "Freigegeben" },
  candidate: { en: "Candidate", de: "Kandidat" },
  draft: { en: "Draft", de: "Entwurf" },
  retired: { en: "Retired", de: "Ausgemustert" },
};

const SOURCE_COMPLETENESS_STATUSES: SourceCompletenessStatus[] = [
  "evidence-complete",
  "evidence-incomplete",
  "sources-conflict",
  "source-stale",
  "judgment-required",
];

function configTone(
  status: AIConfigurationVersion["status"],
): "success" | "ai" | "neutral" | "warning" {
  switch (status) {
    case "released":
      return "success";
    case "candidate":
      return "ai";
    case "draft":
      return "neutral";
    case "retired":
      return "warning";
  }
}

function providerLabel(provider: "openai" | "anthropic" | "local"): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "local":
      return "Local";
  }
}

/** The role name from the release registry, never a second copy of it. */
function roleLabel(roleId: string): string {
  return getRoleRelease(roleId)?.releaseLabel ?? roleId;
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

const releasedConfigs = AI_CONFIGURATION_REGISTRY.filter((c) => c.status === "released");

export default function AIQualitySettingsPage() {
  const language = readAdminLanguage();
  const say = (pair: Pair) => pick(pair, language);
  const evidence = readEvaluationEvidence();

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead eyebrow={say(COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />

      <SettingsSection title={say(COPY.evaluation)}>
        <div className="app-stack app-stack-3">
          <StatusList label={say(COPY.evaluation)}>
            <StatusRow label={say(COPY.harness)} status={evidence.harness} language={language} />
            <StatusRow label={say(COPY.modelOutput)} status={evidence.modelOutput} language={language} />
          </StatusList>
          <FieldList label={say(COPY.run)}>
            <Field
              label={say(COPY.run)}
              value={evidence.runAt ? <Data>{evidence.runAt}</Data> : say(COPY.noRun)}
            />
            {evidence.recorded ? (
              <>
                <Field label={say(COPY.mode)} value={<Data>{evidence.mode ?? ""}</Data>} />
                <Field
                  label={say(COPY.cases)}
                  value={`${evidence.totals.cases}: ${fill(say(COPY.tally), {
                    passed: evidence.totals.passed,
                    failed: evidence.totals.failed,
                    notRun: evidence.totals.notRun,
                  })}`}
                />
              </>
            ) : null}
          </FieldList>
          <span className="app-meta" style={{ maxWidth: "80ch" }}>
            {say(COPY.runner)}
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.registry)}>
        <FieldList label={say(COPY.registry)}>
          <Field label={say(COPY.total)} value={String(AI_CONFIGURATION_REGISTRY.length)} />
          <Field label={say(COPY.released)} value={String(releasedConfigs.length)} />
          <Field
            label={say(COPY.draftOrCandidate)}
            value={String(
              AI_CONFIGURATION_REGISTRY.filter((c) => c.status === "candidate" || c.status === "draft").length,
            )}
          />
          <Field
            label={say(COPY.schema)}
            value={<Data>envelope-v1</Data>}
            note={say(COPY.schemaNote)}
          />
        </FieldList>
      </SettingsSection>

      <SettingsSection title={say(COPY.releasedConfigs)} count={releasedConfigs.length}>
        <div className="app-stack app-stack-5">
          {releasedConfigs.map((config) => (
            <ConfigRow key={config.id} config={config} evidence={evidence} language={language} />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.profiles)} count={MODEL_PROFILES.length}>
        <div className="app-stack app-stack-5">
          {MODEL_PROFILES.map((profile) => (
            <ModelProfileRow key={profile.id} profile={profile} language={language} />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.completeness)}>
        <div className="app-stack app-stack-3">
          <FieldList label={say(COPY.completeness)}>
            {SOURCE_COMPLETENESS_STATUSES.map((status) => (
              <Field key={status} label={status} value={getDisplayStatus(status)} />
            ))}
          </FieldList>
          <span className="app-meta" style={{ maxWidth: "80ch" }}>
            {say(COPY.completenessNote)}
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.regulatory)}>
        <Notice tone="warning">{say(COPY.regulatoryNote)}</Notice>
      </SettingsSection>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Sub-components
   --------------------------------------------------------------------------- */

function ConfigRow({
  config,
  evidence,
  language,
}: {
  config: AIConfigurationVersion;
  evidence: EvaluationEvidence;
  language: Language;
}) {
  const say = (pair: Pair) => pick(pair, language);
  const profile = MODEL_PROFILES.find((p) => p.id === config.modelProfileId);
  const forRole = evaluationReadingsForRole(evidence, config.roleId);
  const modelDetail = say(forRole.modelOutput.detail);
  const harnessDetail = say(forRole.harness.detail);

  return (
    <section className="app-stack app-stack-3">
      <div className="app-row app-row-wrap app-between">
        <div className="app-stack app-stack-1">
          <span className="app-object-title">{config.name}</span>
          <span className="app-row app-row-wrap">
            <ObjectRef id={config.id} label="Configuration" />
            <span className="app-meta">{roleLabel(config.roleId)}</span>
          </span>
        </div>
        <div className="app-row app-row-wrap">
          <Chip title={say(COPY.promptVersion)}>
            <Data>{config.promptVersion}</Data>
          </Chip>
          <Chip tone={configTone(config.status)}>{say(CONFIG_STATUS_LABELS[config.status])}</Chip>
        </div>
      </div>

      <FieldList label={`${config.name}`}>
        <Field label={say(COPY.role)} value={roleLabel(config.roleId)} />
        <Field label={say(COPY.taskKind)} value={<Data>{config.taskKind}</Data>} />
        <Field label={say(COPY.outputSchema)} value={<Data>{config.outputSchemaVersion}</Data>} />
        <Field
          label={say(COPY.modelProfile)}
          value={<ObjectRef id={config.modelProfileId} label={say(COPY.modelProfile)} />}
        />
        <Field
          label={say(COPY.suite)}
          value={
            <span className="app-row app-row-wrap">
              <Data>{config.evaluationSuiteId}</Data>
              <StatusBadge status={forRole.harness.status} language={language} detail={harnessDetail} />
              <StatusBadge status={forRole.modelOutput.status} language={language} detail={modelDetail} />
            </span>
          }
          note={`${harnessDetail} ${say(COPY.suiteNote)}`}
        />
        <Field label={say(COPY.releasedAt)} value={<Data>{config.releasedAt}</Data>} />
        <Field label={say(COPY.releasedBy)} value={config.releasedBy} />
        {profile ? (
          <Field
            label={say(COPY.model)}
            value={
              <span className="app-row app-row-wrap">
                <Data>{profile.modelId}</Data>
                <Chip tone="neutral">{providerLabel(profile.provider)}</Chip>
              </span>
            }
          />
        ) : null}
      </FieldList>
    </section>
  );
}

function ModelProfileRow({ profile, language }: { profile: ModelProfile; language: Language }) {
  const say = (pair: Pair) => pick(pair, language);
  return (
    <section className="app-stack app-stack-3">
      <div className="app-row app-row-wrap app-between">
        <div className="app-stack app-stack-1">
          <span className="app-object-title">
            <Data size="sm">{profile.modelId}</Data>
          </span>
          <ObjectRef id={profile.id} label={say(COPY.modelProfile)} />
        </div>
        <Chip tone="neutral">{providerLabel(profile.provider)}</Chip>
      </div>

      <p className="app-secondary" style={{ fontSize: "var(--app-text-sm)", maxWidth: "80ch" }}>
        {profile.purpose}
      </p>

      <FieldList label={`${profile.id}`}>
        <Field label={say(COPY.modelId)} value={<Data>{profile.modelId}</Data>} />
        <Field label={say(COPY.provider)} value={providerLabel(profile.provider)} />
        <Field label={say(COPY.maxTokens)} value={<Data>{String(profile.maxTokens)}</Data>} />
        <Field label={say(COPY.temperature)} value={<Data>{String(profile.temperature)}</Data>} />
      </FieldList>
    </section>
  );
}
