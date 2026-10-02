/**
 * The settings index.
 *
 * It lists the seven areas and, for the four this module owns, the current
 * value an administrator most often comes to check. The three areas owned
 * elsewhere are listed with their purpose and no state, because asserting a
 * state for a surface this page does not read would be a guess.
 */

import Link from "next/link";
import { SETTINGS_AREAS, getProductConfig, listProductConfigChanges } from "@/product";
import { SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Item, List, Notice } from "@/components/workday-v2/primitives";
import { BRAND_MODE_LABELS } from "@/product";

export const dynamic = "force-dynamic";

export default function SettingsIndexPage() {
  const config = getProductConfig();
  const changes = listProductConfigChanges(4);

  /*
   * One summary line per area, read from the resolved configuration. The three
   * areas owned by the integration layer carry a purpose instead, which is
   * honest about what this page knows.
   */
  const summary: Record<string, string> = {
    "/settings/organisation": `${config.organisation.name}, ${config.organisation.legalEntities.length} legal entities, ${config.organisation.timezone}`,
    "/settings/branding": `${BRAND_MODE_LABELS[config.identity.mode].en}, ${config.identity.productName}`,
    "/settings/integrations": "Connector packs, instances, credential state and freshness",
    "/settings/mappings": "Source to canonical object mapping and conflict policy",
    "/settings/role-packs": `${config.functionPacks.filter((pack) => pack.granted).length} of ${config.functionPacks.length} function packs granted`,
    "/settings/authority": "Tool authority classes, role scopes and approval requirements",
    "/settings/deployment": `${config.deployment.name}, version ${config.deployment.version}`,
  };

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead
        eyebrow="Administrator area"
        title="Product configuration"
        lede="Everything a second institution would otherwise need a code fork to change. Changing anything here changes no decision, no approval and no audit event: the domain record and the product configuration are separate stores, and that separation is what makes this a product rather than one bank application."
      />

      {config.configured ? null : (
        <Notice tone="warning">
          No active product configuration was found. The screens below are showing documented
          fallbacks rather than a configuration. Run the database migration and seed, then reload.
        </Notice>
      )}

      <SettingsSection title="Settings areas" count={SETTINGS_AREAS.length}>
        <List label="Settings areas">
          {SETTINGS_AREAS.map((area) => (
            <Item
              key={area.href}
              href={area.href}
              title={area.label.en}
              subtitle={summary[area.href] ?? ""}
              trailing={<Data>{area.href}</Data>}
            />
          ))}
        </List>
      </SettingsSection>

      <SettingsSection
        title="Recent configuration changes"
        count={changes.length}
        trailing={
          <span className="app-meta">
            Recorded separately from the domain audit trail
          </span>
        }
      >
        {changes.length === 0 ? (
          <Notice>
            No product configuration changes are recorded. The seeded configuration is the only
            state so far.
          </Notice>
        ) : (
          <List label="Recent configuration changes">
            {changes.map((change) => (
              <Item
                key={change.id}
                title={change.summary}
                subtitle={
                  <span className="app-row app-row-wrap">
                    <Chip>{change.area}</Chip>
                    <Data>{change.at}</Data>
                    <span className="app-meta">by {change.changedBy}</span>
                  </span>
                }
              />
            ))}
          </List>
        )}
      </SettingsSection>

      <SettingsSection title="What is documented">
        <List label="Documentation">
          <Item
            title="Product architecture"
            subtitle="The packaging model, what is in Core, and the configuration-not-fork mechanism"
            trailing={<Data>docs/PRODUCT_ARCHITECTURE.md</Data>}
          />
          <Item
            title="White label and packaging"
            subtitle="The three branding modes, where operator identity may appear, and the entitlement model"
            trailing={<Data>docs/WHITE_LABEL_AND_PACKAGING.md</Data>}
          />
          <Item
            title="Deployment profiles"
            subtitle="The four profiles and an honest statement of what this prototype runs"
            trailing={<Data>docs/DEPLOYMENT_PROFILES.md</Data>}
          />
        </List>
      </SettingsSection>

      <p className="app-meta" style={{ maxWidth: "76ch" }}>
        This area is for administrators. It is not reachable from the workday navigation, because a
        practitioner handling an incident has no reason to see a configuration screen, and the
        settings a practitioner would need are the ones that belong in the workday itself.{" "}
        <Link href="/workday" className="app-source-link">
          Return to the workday
        </Link>
        .
      </p>
    </div>
  );
}
