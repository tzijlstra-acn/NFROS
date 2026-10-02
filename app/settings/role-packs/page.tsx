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

export const dynamic = "force-dynamic";

export default function RolePacksSettingsPage() {
  const config = getProductConfig();
  const packs = config.functionPacks;
  const entitlements = config.entitlements;
  const profiles = listEntitlementProfiles();
  const grantedCount = packs.filter((pack) => pack.granted).length;

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead
        eyebrow="Administrator area"
        title="Role packs"
        lede="A function pack is one professional function: its domain objects, its roles, its governed tools, its screens, its evaluations and the connector packs it needs to be useful. Packs are how the product is licensed and how a deployment is scoped."
      />

      {config.configured ? null : (
        <Notice tone="warning">
          No active product configuration was found. The grants below come from the documented
          fallback, which grants everything this build contains. Run the migration and seed to see a
          real entitlement profile.
        </Notice>
      )}

      <SettingsSection title="Active entitlement profile">
        <FieldList label="Active entitlement profile">
          <Field label="Profile" value={entitlements.name} />
          <Field label="Identifier" value={<ObjectRef id={entitlements.id} />} />
          <Field
            label="Function packs granted"
            value={`${grantedCount} of ${packs.length}`}
            note={
              grantedCount === packs.length
                ? undefined
                : "A pack that is defined but not granted is absent from the product, not hidden behind a prompt."
            }
          />
          <Field
            label="Connector packs granted"
            value={
              entitlements.connectorPacks.length > 0 ? (
                <IdentifierList items={entitlements.connectorPacks} label="Connector packs" />
              ) : (
                "None"
              )
            }
          />
          <Field
            label="AI capabilities"
            value={
              <span className="app-row app-row-wrap">
                {AI_FEATURE_IDS.map((feature) => (
                  <Chip key={feature} tone={hasAiFeature(entitlements, feature) ? "ai" : "neutral"}>
                    {feature}
                  </Chip>
                ))}
              </span>
            }
            note="Capabilities, never model names. A deployment without autonomous execution has no path to a policy bound autonomous action regardless of its autonomy level, so the entitlement layer and the authority layer agree rather than compete."
          />
          <Field
            label="Administrator capabilities"
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

      <SettingsSection title="Function packs" count={packs.length}>
        <div className="app-stack app-stack-5">
          {packs.map((pack) => (
            <section key={pack.id} className="app-stack app-stack-3">
              <div className="app-row app-row-wrap app-between">
                <div className="app-stack app-stack-1">
                  <span className="app-object-title">{pack.name}</span>
                  <span className="app-row app-row-wrap">
                    <ObjectRef id={pack.id} label="Function pack" />
                    <span className="app-meta">{pack.nameDe}</span>
                  </span>
                </div>
                <div className="app-row app-row-wrap">
                  <Chip title="Pack version">
                    <Data>{pack.version}</Data>
                  </Chip>
                  {pack.enabled ? null : <Chip tone="warning">Disabled</Chip>}
                  <GrantMark granted={pack.granted} language="en" />
                </div>
              </div>

              <p className="app-secondary" style={{ fontSize: "var(--app-text-sm)", maxWidth: "80ch" }}>
                {pack.description}
              </p>

              <FieldList label={`${pack.name} contents`}>
                <Field label="Primary role" value={<Data>{pack.primaryRoleId}</Data>} />
                <Field label="Roles served" value={<IdentifierList items={pack.roles} label="Roles" />} />
                <Field
                  label="Domain objects"
                  value={<IdentifierList items={pack.domainObjects} label="Domain objects" />}
                />
                <Field
                  label="Governed tools"
                  value={<IdentifierList items={pack.tools} label="Tools" />}
                  note="Every name is a key in the tool registry. The registry, not the prompt, is the security boundary, so a pack cannot list a tool the product does not have."
                />
                <Field
                  label="Screens"
                  value={<IdentifierList items={pack.screens} label="Screens" />}
                />
                <Field
                  label="Evaluations"
                  value={<IdentifierList items={pack.evaluations} label="Evaluations" />}
                  note="The evaluation cases that must pass for this pack. A pack whose evaluations are not run is a pack whose behaviour nobody is checking."
                />
                <Field
                  label="Connector dependencies"
                  value={
                    <IdentifierList
                      items={pack.connectorDependencies}
                      label="Connector dependencies"
                    />
                  }
                  {...(pack.missingConnectorPacks.length > 0
                    ? {
                        note: `Not granted by the active profile: ${pack.missingConnectorPacks.join(", ")}. The pack is licensed and degraded, which is a different state from unlicensed.`,
                      }
                    : {})}
                />
                <Field
                  label="Granted by"
                  value={
                    profiles
                      .filter((profile) => profile.functionPacks.includes(pack.id))
                      .map((profile) => profile.name)
                      .join("; ") || "No defined entitlement profile grants this pack."
                  }
                />
              </FieldList>
            </section>
          ))}
        </div>

        {packs.length === 0 ? (
          <Notice tone="warning">
            No function packs are defined. Run the product configuration seed.
          </Notice>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Entitlement profiles defined" count={profiles.length}>
        <List label="Entitlement profiles">
          {profiles.map((profile) => (
            <Item
              key={profile.id}
              title={
                <span className="app-row app-row-wrap">
                  {profile.name}
                  {profile.id === entitlements.id ? <Chip tone="ai">Active</Chip> : null}
                </span>
              }
              subtitle={
                <span className="app-row app-row-wrap">
                  <ObjectRef id={profile.id} />
                  <span className="app-meta">
                    {profile.functionPacks.length} function packs,{" "}
                    {profile.connectorPacks.length} connector packs,{" "}
                    {profile.aiFeatures.length} AI capabilities
                  </span>
                </span>
              }
            />
          ))}
        </List>
        <div style={{ marginTop: "var(--app-3)" }}>
          <Notice>
            Two profiles are defined so the entitlement model can be seen denying something. The
            pilot profile grants two function packs, three connector packs and no autonomous
            execution, which is what a first phase in a DACH institution looks like in practice.
          </Notice>
        </div>
      </SettingsSection>
    </div>
  );
}
