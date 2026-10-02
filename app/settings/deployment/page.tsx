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

export const dynamic = "force-dynamic";

export default function DeploymentSettingsPage() {
  const config = getProductConfig();
  const active = config.deployment;
  const profiles = listDeploymentProfiles();
  const activeHonesty = deploymentHonesty(active);
  const implementedCount = profiles.filter((profile) => profile.implementedHere).length;

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead
        eyebrow="Administrator area"
        title="Deployment"
        lede="Four deployment shapes are designed. One of them is what this build runs. Each profile states what it assumes about identity, data residency, model endpoints, retention, observability and the audit boundary."
      />

      <Notice tone={activeHonesty.implementedHere ? "info" : "warning"}>
        The active profile is {active.name}. {activeHonesty.claim.en}
      </Notice>

      <SettingsSection title="Active profile" trailing={<Data>{active.id}</Data>}>
        <FieldList label="Active deployment profile">
          <Field
            label="Kind"
            value={
              <span className="app-row app-row-wrap">
                <Chip>{DEPLOYMENT_KIND_LABELS[active.kind].en}</Chip>
                <ImplementedMark implemented={active.implementedHere} language="en" />
              </span>
            }
          />
          <Field label="Name" value={active.name} />
          <Field label="Description" value={active.description} />
          <Field label="Region and residency" value={active.region} />
          <Field label="Identity" value={active.identityMode} />
          <Field label="Model endpoints" value={active.modelEndpointProfile} />
          <Field label="Data retention" value={active.dataRetentionProfile} />
          <Field label="Observability and audit boundary" value={active.observabilityProfile} />
          <Field label="Environment" value={active.environment} mono />
          <Field label="Version" value={active.version} mono />
        </FieldList>
      </SettingsSection>

      <SettingsSection title="What this prototype actually runs">
        <div className="app-stack app-stack-3">
          <Notice tone="warning">
            One process on one machine, holding a synthetic institution in a local SQLite file.
            There is no authentication: the acting role is scenario state, so switching role is a
            demonstration control and not an identity change. There is no tenancy, no backup, no
            data residency guarantee beyond the machine the file sits on, and no external telemetry.
            Model calls, when the live mode is enabled, go to an endpoint the operator supplies
            through the environment.
          </Notice>
          <span className="app-meta" style={{ maxWidth: "80ch" }}>
            Stated here rather than only in the documentation because this is the screen an operator
            opens to find out what they are running. {implementedCount} of {profiles.length}{" "}
            defined profiles are implemented in this build.
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title="All defined profiles" count={profiles.length}>
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
                        {DEPLOYMENT_KIND_LABELS[profile.kind].en} / {profile.kind}
                      </span>
                    </span>
                  </div>
                  <div className="app-row app-row-wrap">
                    {profile.id === active.id ? <Chip tone="ai">Active</Chip> : null}
                    <Chip title="Profile version">
                      <Data>{profile.version}</Data>
                    </Chip>
                    <ImplementedMark implemented={profile.implementedHere} language="en" />
                  </div>
                </div>

                <p
                  className="app-secondary"
                  style={{ fontSize: "var(--app-text-sm)", maxWidth: "80ch" }}
                >
                  {profile.description}
                </p>

                <FieldList label={`${profile.name} assumptions`}>
                  <Field label="Region and residency" value={profile.region} />
                  <Field label="Identity" value={profile.identityMode} />
                  <Field label="Model endpoints" value={profile.modelEndpointProfile} />
                  <Field label="Data retention" value={profile.dataRetentionProfile} />
                  <Field
                    label="Observability and audit boundary"
                    value={profile.observabilityProfile}
                  />
                  <Field label="Environment" value={profile.environment} mono />
                </FieldList>

                <span className="app-meta" style={{ maxWidth: "80ch" }}>
                  {honesty.claim.en}
                </span>

                <OutstandingWork items={honesty.outstandingWork} language="en" />
              </section>
            );
          })}
        </div>

        {profiles.length === 0 ? (
          <Notice tone="warning">
            No deployment profiles are defined. Run the product configuration seed. The product is
            architected for {DEPLOYMENT_KINDS.length} deployment kinds.
          </Notice>
        ) : null}
      </SettingsSection>
    </div>
  );
}
