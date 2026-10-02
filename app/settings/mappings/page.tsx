/**
 * Source mapping settings.
 *
 * Source object to canonical object, field by field, with the risk and control
 * taxonomy, the severity and rating values, the ownership and legal entity
 * mappings, and the conflict policy per mapping.
 *
 * The conflict policy column is the one worth reading carefully, and the
 * screen says why next to it. A control rating from the GRC platform is
 * `source-of-record-wins` because the rating is a recorded human conclusion. A
 * process intelligence observation about the same control is
 * `escalate-to-human` because the mining platform is entitled to disagree and
 * the disagreement is the finding. Ownership and legal entity are
 * `never-overwrite`, because which entity holds an arrangement determines
 * which supervisory framework applies to it, and no directory read should be
 * able to move that quietly.
 *
 * Read only in this build, and the screen says so rather than offering an edit
 * control that would not work.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { externalReferences, sourceMappings } from "@/db/schema/integration";
import { CONFLICT_POLICIES, type ConflictPolicy } from "@/db/schema/integration";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { getScenarioState } from "@/scenario/engine/state";
import {
  listConnectors,
  CONFLICT_POLICY_DESCRIPTIONS,
  CONFLICT_POLICY_LABELS,
} from "@/integrations/runtime/IntegrationRuntime";
import { SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Empty, Item, List, Notice } from "@/components/workday-v2/primitives";
import { CANONICAL_TYPES, pick } from "@/workday/contracts";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

/** Canonical fields that carry ownership or legal entity attribution. */
const ATTRIBUTION_FIELDS = new Set(["ownerId", "ownerLabel", "legalEntityId", "legalEntityIds"]);

/** Taxonomy dimensions that are a rating or a severity rather than a label. */
const RATING_DIMENSIONS = new Set([
  "effectiveness",
  "severity",
  "residualRating",
  "criticality",
  "appetitePosition",
  "outcome",
  "operationalStatus",
]);

const POLICY_TONE: Record<ConflictPolicy, "success" | "info" | "warning" | "neutral"> = {
  "source-of-record-wins": "success",
  "most-recent-wins": "info",
  "escalate-to-human": "warning",
  "never-overwrite": "neutral",
};

export default function MappingsSettingsPage() {
  const language: Language = "en";
  const state = getScenarioState();
  const runId = state?.runId ?? DEFAULT_RUN_ID;

  const mappings = getDb().select().from(sourceMappings).all();
  const instances = listConnectors();
  const references = getDb()
    .select()
    .from(externalReferences)
    .where(eq(externalReferences.runId, runId))
    .all();

  if (mappings.length === 0) {
    return (
      <div className="app-stack app-stack-6">
        <SettingsHead
          eyebrow="Administrator area"
          title="Mappings"
          lede="Source object to canonical object, field by field, with the conflict policy that decides what happens when two systems disagree."
        />
        <Notice tone="warning">
          No source mappings are configured. Run the integration seed to populate them.
        </Notice>
      </div>
    );
  }

  const byInstance = new Map<string, typeof mappings>();
  for (const mapping of mappings) {
    const list = byInstance.get(mapping.connectorInstanceId) ?? [];
    list.push(mapping);
    byInstance.set(mapping.connectorInstanceId, list);
  }

  const attributionMappings = mappings.filter((mapping) =>
    mapping.fieldMappings.some((field) => ATTRIBUTION_FIELDS.has(field.canonicalField)),
  );

  const taxonomyEntries = mappings.flatMap((mapping) =>
    mapping.taxonomyMappings.map((entry) => ({
      connectorInstanceId: mapping.connectorInstanceId,
      externalType: mapping.externalType,
      ...entry,
    })),
  );

  const ratingEntries = taxonomyEntries.filter((entry) => RATING_DIMENSIONS.has(entry.dimension));
  const otherTaxonomy = taxonomyEntries.filter((entry) => !RATING_DIMENSIONS.has(entry.dimension));

  const conflictedReferences = references.filter((row) => row.conflicted);
  const mappedCanonicalTypes = new Set(mappings.map((mapping) => mapping.canonicalType));

  const sourceSystemFor = (instanceId: string): string =>
    instances.find((instance) => instance.id === instanceId)?.sourceSystem ?? instanceId;

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead
        eyebrow="Administrator area"
        title="Mappings"
        lede="A mapping turns one source object type into one canonical object type, field by field, and declares what happens when a second source disagrees. The canonical vocabulary is shared across the six functions, which is what lets one supplier record mean the same thing to third party risk and to operational resilience."
      />

      <Notice tone="info">
        Read only in this build. The mappings are seeded configuration and the screen shows exactly
        what the runtime uses. A real engagement needs an editor here, with validation against the
        source schema and a change history, which is recorded in docs/PRODUCTIZATION_GAPS.md.
      </Notice>

      <SettingsSection title="Coverage">
        <div className="app-grid-3">
          <Item title={<Data size="sm">{mappings.length}</Data>} subtitle="Mappings configured" />
          <Item
            title={
              <Data size="sm">
                {mappedCanonicalTypes.size} of {CANONICAL_TYPES.length}
              </Data>
            }
            subtitle="Canonical types reached by at least one mapping"
          />
          <Item
            title={<Data size="sm">{taxonomyEntries.length}</Data>}
            subtitle="Declared taxonomy value translations"
          />
          <Item
            title={<Data size="sm">{attributionMappings.length}</Data>}
            subtitle="Mappings carrying ownership or legal entity attribution"
          />
          <Item
            title={<Data size="sm">{references.length}</Data>}
            subtitle="External references currently projected"
          />
          <Item
            title={<Data size="sm">{conflictedReferences.length}</Data>}
            subtitle="References where two sources disagree"
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Conflict policies" count={CONFLICT_POLICIES.length}>
        <List label="Conflict policies">
          {CONFLICT_POLICIES.map((policy) => (
            <Item
              key={policy}
              title={
                <span className="app-row app-row-wrap">
                  <Chip tone={POLICY_TONE[policy]}>
                    {pick(CONFLICT_POLICY_LABELS[policy], language)}
                  </Chip>
                  <span className="app-oid">{policy}</span>
                </span>
              }
              subtitle={CONFLICT_POLICY_DESCRIPTIONS[policy]}
              trailing={
                <span className="app-row">
                  <Data>{mappings.filter((mapping) => mapping.conflictPolicy === policy).length}</Data>
                  <span className="app-faint">mappings</span>
                </span>
              }
            />
          ))}
        </List>
      </SettingsSection>

      {[...byInstance.entries()].map(([instanceId, group]) => (
        <SettingsSection
          key={instanceId}
          title={sourceSystemFor(instanceId)}
          count={group.length}
          trailing={<span className="app-oid">{instanceId}</span>}
        >
          <List label={`${sourceSystemFor(instanceId)} mappings`}>
            {group.map((mapping) => (
              <Item
                key={mapping.id}
                large
                title={
                  <span className="app-row app-row-wrap">
                    <span className="app-oid">{mapping.externalType}</span>
                    <span className="app-faint" aria-hidden="true">
                      to
                    </span>
                    <span className="app-strong">{mapping.canonicalType}</span>
                    <Chip tone={POLICY_TONE[mapping.conflictPolicy]} title={mapping.conflictPolicy}>
                      {pick(CONFLICT_POLICY_LABELS[mapping.conflictPolicy], language)}
                    </Chip>
                  </span>
                }
                subtitle={mapping.notes}
                trailing={
                  <span className="app-row">
                    <Data>{mapping.fieldMappings.length}</Data>
                    <span className="app-faint">fields</span>
                    <Data>{mapping.taxonomyMappings.length}</Data>
                    <span className="app-faint">values</span>
                  </span>
                }
              >
                <div className="app-stack app-stack-1" style={{ marginTop: "var(--app-2)" }}>
                  {mapping.fieldMappings.map((field) => (
                    <div key={field.externalField} className="app-row app-row-wrap">
                      <span className="app-oid">{field.externalField}</span>
                      <span className="app-faint" aria-hidden="true">
                        to
                      </span>
                      <span className="app-oid">{field.canonicalField}</span>
                      {field.transform ? (
                        <Chip tone="neutral" title="Declared transform">
                          {field.transform}
                        </Chip>
                      ) : null}
                      {ATTRIBUTION_FIELDS.has(field.canonicalField) ? (
                        <Chip
                          tone="warning"
                          title="Ownership or legal entity attribution. Entity attribution determines which supervisory framework applies."
                        >
                          Attribution
                        </Chip>
                      ) : null}
                    </div>
                  ))}
                  {mapping.fieldMappings.length === 0 ? (
                    <span className="app-faint">No field mappings declared.</span>
                  ) : null}
                </div>
              </Item>
            ))}
          </List>
        </SettingsSection>
      ))}

      <SettingsSection title="Severity and rating value mappings" count={ratingEntries.length}>
        <div className="app-stack app-stack-3">
          <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
            A rating is a human conclusion, so the translation from a source value to a canonical
            one has to be declared rather than guessed. An unmapped value is reported by the mapper
            rather than silently passed through, because a residual rating arriving as a string the
            product does not recognise would otherwise sort and filter as though it were valid.
          </p>
          {ratingEntries.length === 0 ? (
            <Empty title="No rating mappings declared" />
          ) : (
            <List label="Severity and rating mappings">
              {ratingEntries.map((entry) => (
                <Item
                  key={`${entry.connectorInstanceId}:${entry.externalType}:${entry.dimension}:${entry.externalValue}`}
                  title={
                    <span className="app-row app-row-wrap">
                      <span className="app-oid">{entry.dimension}</span>
                      <span className="app-oid">{entry.externalValue}</span>
                      <span className="app-faint" aria-hidden="true">
                        to
                      </span>
                      <span className="app-strong">{entry.canonicalValue}</span>
                    </span>
                  }
                  subtitle={
                    <span className="app-row app-row-wrap">
                      <span className="app-faint">{sourceSystemFor(entry.connectorInstanceId)}</span>
                      <span className="app-oid">{entry.externalType}</span>
                    </span>
                  }
                />
              ))}
            </List>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Risk and control taxonomy mappings" count={otherTaxonomy.length}>
        {otherTaxonomy.length === 0 ? (
          <Empty title="No further taxonomy mappings declared" />
        ) : (
          <List label="Taxonomy mappings">
            {otherTaxonomy.map((entry) => (
              <Item
                key={`${entry.connectorInstanceId}:${entry.externalType}:${entry.dimension}:${entry.externalValue}`}
                title={
                  <span className="app-row app-row-wrap">
                    <span className="app-oid">{entry.dimension}</span>
                    <span className="app-oid">{entry.externalValue}</span>
                    <span className="app-faint" aria-hidden="true">
                      to
                    </span>
                    <span className="app-strong">{entry.canonicalValue}</span>
                  </span>
                }
                subtitle={
                  <span className="app-row app-row-wrap">
                    <span className="app-faint">{sourceSystemFor(entry.connectorInstanceId)}</span>
                    <span className="app-oid">{entry.externalType}</span>
                  </span>
                }
              />
            ))}
          </List>
        )}
      </SettingsSection>

      {conflictedReferences.length > 0 ? (
        <SettingsSection title="Current disagreements" count={conflictedReferences.length}>
          <div className="app-stack app-stack-3">
            <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
              Two sources describe the same canonical object differently. The projection follows the
              declared policy and the disagreement stays visible, because reconciling it silently
              would destroy the only signal that it exists.
            </p>
            <List label="Conflicted references">
              {conflictedReferences.map((row) => (
                <Item
                  key={row.id}
                  title={
                    <span className="app-row app-row-wrap">
                      <span className="app-strong">
                        {row.canonicalType} {row.canonicalId}
                      </span>
                      <Chip tone="danger">Sources disagree</Chip>
                    </span>
                  }
                  subtitle={
                    <span className="app-stack app-stack-1">
                      <span>{row.conflictNote}</span>
                      <span className="app-row app-row-wrap">
                        <span className="app-faint">{row.sourceSystem}</span>
                        <span className="app-oid">
                          {row.externalType}:{row.externalId}
                        </span>
                      </span>
                    </span>
                  }
                />
              ))}
            </List>
          </div>
        </SettingsSection>
      ) : null}
    </div>
  );
}
