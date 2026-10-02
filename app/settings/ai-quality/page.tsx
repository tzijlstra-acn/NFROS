/**
 * AI quality settings.
 *
 * An administrator surface showing the released AI configurations, model
 * profiles, evaluation suite status and source completeness display labels.
 *
 * This page is read-only. It shows what is configured and what the evaluation
 * suite status is. It does not provide controls to change configurations or
 * promote candidates: those operations belong in a build pipeline, not in a
 * runtime settings screen.
 *
 * Illustrative regulatory context -- not legal advice.
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

export const dynamic = "force-dynamic";

/* ---------------------------------------------------------------------------
   Display helpers
   --------------------------------------------------------------------------- */

const SOURCE_COMPLETENESS_STATUSES: SourceCompletenessStatus[] = [
  "evidence-complete",
  "evidence-incomplete",
  "sources-conflict",
  "source-stale",
  "judgment-required",
];

function statusTone(
  status: "released" | "candidate" | "draft" | "retired"
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

function roleLabel(roleId: string): string {
  switch (roleId) {
    case "rcsa":
      return "Operational Risk Partner";
    case "tprm":
      return "Third-Party Risk Manager";
    default:
      return roleId;
  }
}

/* ---------------------------------------------------------------------------
   Derived data
   --------------------------------------------------------------------------- */

const releasedConfigs = AI_CONFIGURATION_REGISTRY.filter((c) => c.status === "released");
const allConfigs = AI_CONFIGURATION_REGISTRY;

function modelProfileById(id: string): ModelProfile | undefined {
  return MODEL_PROFILES.find((p) => p.id === id);
}

/* ---------------------------------------------------------------------------
   Page
   --------------------------------------------------------------------------- */

export default function AIQualitySettingsPage() {
  return (
    <div className="app-stack app-stack-6">
      <SettingsHead
        eyebrow="Administrator area"
        title="AI quality"
        lede="This page shows the released AI configurations, model profiles, and evaluation suite status for this deployment. Configurations are code-versioned: promoting a candidate to released requires a build pipeline step, not a runtime action. Illustrative regulatory context, not legal advice."
      />

      <SettingsSection title="Registry summary">
        <FieldList label="Registry summary">
          <Field label="Total configurations" value={String(allConfigs.length)} />
          <Field label="Released" value={String(releasedConfigs.length)} />
          <Field
            label="Draft or candidate"
            value={String(allConfigs.filter((c) => c.status !== "released" && c.status !== "retired").length)}
          />
          <Field
            label="Schema version"
            value={<Data>envelope-v1</Data>}
            note="All released configurations write to the same typed response envelope."
          />
        </FieldList>
      </SettingsSection>

      <SettingsSection title="Released configurations" count={releasedConfigs.length}>
        <div className="app-stack app-stack-5">
          {releasedConfigs.map((config) => (
            <ConfigRow key={config.id} config={config} />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Model profiles" count={MODEL_PROFILES.length}>
        <div className="app-stack app-stack-5">
          {MODEL_PROFILES.map((profile) => (
            <ModelProfileRow key={profile.id} profile={profile} />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Evaluation suite status">
        <FieldList label="Evaluation suite status">
          <Field
            label="EVAL-RCSA-001"
            value={
              <span className="app-stack app-stack-1">
                <span className="app-meta">
                  Not yet evaluated: run eval:structural to generate results.
                </span>
              </span>
            }
          />
          <Field
            label="EVAL-TPRM-001"
            value={
              <span className="app-stack app-stack-1">
                <span className="app-meta">
                  Not yet evaluated: run eval:structural to generate results.
                </span>
              </span>
            }
          />
        </FieldList>
        <div
          style={{
            marginTop: "var(--app-4)",
            padding: "var(--app-4)",
            background: "var(--app-surface-subtle, rgba(255,255,255,0.04))",
            borderRadius: 6,
            fontSize: "var(--app-text-sm)",
          }}
        >
          <span className="app-secondary">
            Evaluation suites are run offline against seeded offline responses and golden
            datasets. They do not consume live model calls. See{" "}
            <code style={{ fontFamily: "var(--app-font-mono, monospace)" }}>
              scripts/evaluate.ts
            </code>{" "}
            for the runner.
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title="Source completeness display labels">
        <FieldList label="Source completeness statuses">
          {SOURCE_COMPLETENESS_STATUSES.map((status) => (
            <Field
              key={status}
              label={status}
              value={getDisplayStatus(status)}
            />
          ))}
        </FieldList>
        <div
          style={{
            marginTop: "var(--app-4)",
            padding: "var(--app-4)",
            background: "var(--app-surface-subtle, rgba(255,255,255,0.04))",
            borderRadius: 6,
            fontSize: "var(--app-text-sm)",
          }}
        >
          <span className="app-secondary">
            Source completeness is a categorical label, not a percentage. Displaying a
            numerical confidence figure would suggest precision the model does not have.
            These five labels are the only display states permitted. The computation runs
            in{" "}
            <code style={{ fontFamily: "var(--app-font-mono, monospace)" }}>
              src/ai/source-status.ts
            </code>
            .
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title="Regulatory context">
        <Notice tone="warning">
          Illustrative regulatory context only -- not legal advice. The AI quality
          controls shown here support demonstrability under operational risk frameworks
          (e.g. DORA, EBA guidelines on ICT risk) but do not constitute a compliance
          opinion. Engage your compliance function before using these controls as
          evidence in a regulatory submission.
        </Notice>
      </SettingsSection>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Sub-components
   --------------------------------------------------------------------------- */

function ConfigRow({ config }: { config: AIConfigurationVersion }) {
  const profile = modelProfileById(config.modelProfileId);

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
          <Chip title="Prompt version">
            <Data>{config.promptVersion}</Data>
          </Chip>
          <Chip tone={statusTone(config.status)}>
            {config.status.charAt(0).toUpperCase() + config.status.slice(1)}
          </Chip>
        </div>
      </div>

      <FieldList label={`${config.name} configuration`}>
        <Field label="Role" value={roleLabel(config.roleId)} />
        <Field label="Task kind" value={<Data>{config.taskKind}</Data>} />
        <Field label="Output schema" value={<Data>{config.outputSchemaVersion}</Data>} />
        <Field label="Model profile" value={<ObjectRef id={config.modelProfileId} label="Model profile" />} />
        <Field label="Evaluation suite" value={<Data>{config.evaluationSuiteId}</Data>} />
        <Field label="Released at" value={<Data>{config.releasedAt}</Data>} />
        <Field label="Released by" value={config.releasedBy} />
        {profile ? (
          <Field
            label="Model"
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

function ModelProfileRow({ profile }: { profile: ModelProfile }) {
  return (
    <section className="app-stack app-stack-3">
      <div className="app-row app-row-wrap app-between">
        <div className="app-stack app-stack-1">
          <span className="app-object-title">
            <Data size="sm">{profile.modelId}</Data>
          </span>
          <ObjectRef id={profile.id} label="Model profile" />
        </div>
        <Chip tone="neutral">{providerLabel(profile.provider)}</Chip>
      </div>

      <p className="app-secondary" style={{ fontSize: "var(--app-text-sm)", maxWidth: "80ch" }}>
        {profile.purpose}
      </p>

      <FieldList label={`${profile.id} model profile`}>
        <Field label="Model ID" value={<Data>{profile.modelId}</Data>} />
        <Field label="Provider" value={providerLabel(profile.provider)} />
        <Field label="Max tokens" value={<Data>{String(profile.maxTokens)}</Data>} />
        <Field label="Temperature" value={<Data>{String(profile.temperature)}</Data>} />
      </FieldList>
    </section>
  );
}
