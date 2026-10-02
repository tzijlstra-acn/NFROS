/**
 * Mapping an external record onto a canonical object, and keeping the external
 * identity alongside it.
 *
 * The second half of that sentence is the part that matters. Normalising a
 * GRC assessment into a canonical `Assessment` is easy; the hard requirement
 * is that the normalised object never loses the ability to be opened in the
 * system that owns it. So every mapped record writes a row in
 * `external_references` carrying the connector, the external type, the
 * external identifier, the external version and the source timestamp, keyed so
 * that re-reading the same record updates one row rather than accumulating
 * duplicates.
 *
 * A projection that cannot be traced back to its source is a copy, and a copy
 * is what makes an integration layer into a second system of record. That is
 * the thing this product must not become.
 */

import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "@/db/client";
import { externalReferences, sourceMappings, type FreshnessState } from "@/db/schema/integration";
import { CANONICAL_TYPES, type CanonicalType } from "@/workday/contracts";
import { systemClock, type IntegrationClock } from "@/integrations/core/ConnectorContext";
import type { ExternalRecord } from "@/integrations/core/Connector";
import { ConnectorError } from "@/integrations/core/errors";
import { resolveConflict, selectConflictPolicy } from "./ConflictPolicy";

export type ExternalReferenceRow = typeof externalReferences.$inferSelect;
export type SourceMappingRow = typeof sourceMappings.$inferSelect;

/* ==========================================================================
   Deep links
   ========================================================================== */

/**
 * Builds the "open in source system" link.
 *
 * Returns null when there is no template, and the interface then omits the
 * link entirely rather than rendering a dead one. The encoding is not
 * decoration: external identifiers in this domain contain dots and slashes,
 * for example the subprocessor identifiers in the supplier story, and an
 * unencoded one produces a link to the wrong record.
 */
export function buildDeepLink(template: string | null, externalId: string): string | null {
  if (!template || template.trim().length === 0) return null;
  if (!template.includes("{externalId}")) return template;
  return template.replace("{externalId}", encodeURIComponent(externalId));
}

/* ==========================================================================
   Freshness
   ========================================================================== */

/**
 * Computes whether projected data is current.
 *
 * `live` is reserved for a source that pushes changes, which in practice
 * means a connector with webhooks whose last sync is inside the threshold.
 * Everything else that is inside the threshold is `fresh`. Outside it, the
 * data is `stale` and the interface says "Last known" rather than pretending
 * to be current.
 *
 * `unknown` is returned when there is no sync timestamp at all, and it is
 * deliberately not folded into `stale`. "Never read" and "read four hours ago"
 * are different situations for a person deciding whether to trust a number.
 */
export function computeFreshness(params: {
  lastSyncAt: string | null;
  stalenessThresholdMinutes: number;
  pushBased?: boolean;
  clock?: IntegrationClock;
}): FreshnessState {
  if (!params.lastSyncAt) return "unknown";
  const clock = params.clock ?? systemClock;
  const syncedMs = Date.parse(params.lastSyncAt);
  if (Number.isNaN(syncedMs)) return "unknown";

  const ageMinutes = (clock.nowMs() - syncedMs) / 60_000;
  /*
   * A negative age means the source timestamp is ahead of our clock. That
   * happens with clock skew between systems and it must not be reported as
   * impossibly fresh, so it is clamped rather than trusted.
   */
  const age = Math.max(0, ageMinutes);

  if (age > params.stalenessThresholdMinutes) return "stale";
  return params.pushBased ? "live" : "fresh";
}

/** Minutes between a sync and now, for the "last updated" tooltip. */
export function ageInMinutes(lastSyncAt: string | null, clock: IntegrationClock = systemClock): number | null {
  if (!lastSyncAt) return null;
  const ms = Date.parse(lastSyncAt);
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.round((clock.nowMs() - ms) / 60_000));
}

/* ==========================================================================
   Field and taxonomy mapping
   ========================================================================== */

export interface MappedCanonicalObject {
  canonicalType: CanonicalType;
  canonicalId: string;
  /** Canonical field names to values, after field and taxonomy mapping. */
  fields: Record<string, unknown>;
  /** Fields the mapping did not cover. Surfaced, never silently dropped. */
  unmappedFields: string[];
  /** Taxonomy values the mapping did not cover. */
  unmappedTaxonomyValues: Array<{ dimension: string; externalValue: string }>;
}

function isCanonicalType(value: string): value is CanonicalType {
  return (CANONICAL_TYPES as readonly string[]).includes(value);
}

/**
 * Applies a source mapping to one external record.
 *
 * Unmapped fields are reported rather than dropped. The failure this prevents
 * is the quiet one: a connector starts returning a new field, no mapping row
 * covers it, and the projection looks complete while a value the assessment
 * depends on never arrives. Reporting it lets the mappings screen show that a
 * source is sending more than the configuration understands.
 */
export function mapExternalRecord(
  record: ExternalRecord,
  mapping: SourceMappingRow | null,
): MappedCanonicalObject {
  const canonicalTypeName = mapping?.canonicalType ?? record.canonicalType;
  if (!isCanonicalType(canonicalTypeName)) {
    throw new ConnectorError(
      "validation-failed",
      `The mapping for "${record.externalType}" names a canonical type "${canonicalTypeName}" that is not in CANONICAL_TYPES.`,
      { detail: `unknown canonical type ${canonicalTypeName}` },
    );
  }

  if (!mapping) {
    // No mapping row: the connector's own projection stands, and every field
    // is reported as unmapped so the gap is visible on the mappings screen.
    return {
      canonicalType: canonicalTypeName,
      canonicalId: record.canonicalId,
      fields: { ...record.fields },
      unmappedFields: Object.keys(record.fields),
      unmappedTaxonomyValues: [],
    };
  }

  const fields: Record<string, unknown> = {};
  const covered = new Set<string>();

  for (const fieldMapping of mapping.fieldMappings) {
    covered.add(fieldMapping.externalField);
    if (!(fieldMapping.externalField in record.fields)) continue;
    const raw = record.fields[fieldMapping.externalField];
    fields[fieldMapping.canonicalField] = applyTransform(raw, fieldMapping.transform);
  }

  const unmappedTaxonomyValues: Array<{ dimension: string; externalValue: string }> = [];

  for (const taxonomy of mapping.taxonomyMappings) {
    const current = fields[taxonomy.dimension];
    if (current === undefined) continue;
    if (String(current) === taxonomy.externalValue) {
      fields[taxonomy.dimension] = taxonomy.canonicalValue;
    }
  }

  // A taxonomy dimension present in the record but matching no declared
  // external value is a gap worth naming, for the same reason as a field gap.
  const declaredDimensions = new Set(mapping.taxonomyMappings.map((entry) => entry.dimension));
  for (const dimension of declaredDimensions) {
    const value = fields[dimension];
    if (value === undefined) continue;
    const matched = mapping.taxonomyMappings.some(
      (entry) => entry.dimension === dimension && entry.canonicalValue === String(value),
    );
    if (!matched) unmappedTaxonomyValues.push({ dimension, externalValue: String(value) });
  }

  return {
    canonicalType: canonicalTypeName,
    canonicalId: record.canonicalId,
    fields,
    unmappedFields: Object.keys(record.fields).filter((key) => !covered.has(key)),
    unmappedTaxonomyValues,
  };
}

/**
 * The declared transforms.
 *
 * Deliberately a closed list rather than an expression evaluator. A mapping
 * row is configuration, and configuration that can execute arbitrary code is
 * an injection surface reachable by anyone who can write a mapping.
 */
function applyTransform(value: unknown, transform: string | undefined): unknown {
  if (!transform) return value;
  switch (transform) {
    case "trim":
      return typeof value === "string" ? value.trim() : value;
    case "lowercase":
      return typeof value === "string" ? value.toLowerCase() : value;
    case "uppercase":
      return typeof value === "string" ? value.toUpperCase() : value;
    case "number":
      return typeof value === "number" ? value : Number(value);
    case "boolean":
      return value === true || value === "true" || value === 1 || value === "1";
    case "iso-date":
      return typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : value;
    case "percent-to-ratio":
      return typeof value === "number" ? value / 100 : value;
    default:
      // An unknown transform passes the value through unchanged rather than
      // throwing. A typo in configuration should degrade one field, not stop
      // the whole sync.
      return value;
  }
}

/** The mapping row for a connector and external type, or null. */
export function findSourceMapping(
  connectorInstanceId: string,
  externalType: string,
): SourceMappingRow | null {
  return (
    getDb()
      .select()
      .from(sourceMappings)
      .where(
        and(
          eq(sourceMappings.connectorInstanceId, connectorInstanceId),
          eq(sourceMappings.externalType, externalType),
        ),
      )
      .get() ?? null
  );
}

/* ==========================================================================
   External references
   ========================================================================== */

let referenceSequence = 0;

function nextReferenceId(clock: IntegrationClock): string {
  referenceSequence += 1;
  return `XRF-${clock.nowMs().toString(36).toUpperCase()}-${String(referenceSequence).padStart(5, "0")}`;
}

/** Digest of a payload, for change detection without storing the payload. */
export function digestPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 32);
}

export interface UpsertReferenceResult {
  reference: ExternalReferenceRow;
  /** True when this identity had never been seen before. */
  created: boolean;
  /** True when the source reported a different version than last time. */
  changed: boolean;
  conflicted: boolean;
  conflictNote: string;
}

/**
 * Writes or updates the external identity of one record.
 *
 * Keyed on connector plus external type plus external identifier, matching
 * `er_identity_unq`. The conflict check runs against any reference already
 * pointing at the same canonical object from a different connector, which is
 * where a disagreement between two systems of record actually shows up.
 */
export function upsertExternalReference(params: {
  runId: string;
  connectorInstanceId: string;
  sourceSystem: string;
  record: ExternalRecord;
  canonical: MappedCanonicalObject;
  deepLinkTemplate: string | null;
  stalenessThresholdMinutes: number;
  pushBased: boolean;
  systemOfRecordInstanceId?: string | null;
  clock?: IntegrationClock;
}): UpsertReferenceResult {
  const clock = params.clock ?? systemClock;
  const now = clock.nowIso();

  const existingSame = getDb()
    .select()
    .from(externalReferences)
    .where(
      and(
        eq(externalReferences.connectorInstanceId, params.connectorInstanceId),
        eq(externalReferences.externalType, params.record.externalType),
        eq(externalReferences.externalId, params.record.externalId),
      ),
    )
    .get();

  /*
   * A reference from a different connector pointing at the same canonical
   * object is the only genuine conflict candidate. Looked up before the write
   * so the policy sees the state the incoming record is actually competing
   * with.
   */
  const otherSources = getDb()
    .select()
    .from(externalReferences)
    .where(
      and(
        eq(externalReferences.runId, params.runId),
        eq(externalReferences.canonicalType, params.canonical.canonicalType),
        eq(externalReferences.canonicalId, params.canonical.canonicalId),
      ),
    )
    .all()
    .filter((row) => row.connectorInstanceId !== params.connectorInstanceId);

  const competitor = otherSources[0] ?? null;
  const policy = selectConflictPolicy({
    connectorInstanceId: params.connectorInstanceId,
    externalType: params.record.externalType,
  });

  const resolution = resolveConflict({
    policy,
    incomingConnectorInstanceId: params.connectorInstanceId,
    incomingSourceUpdatedAt: params.record.sourceUpdatedAt,
    incomingVersion: params.record.externalVersion,
    existing: competitor
      ? {
          connectorInstanceId: competitor.connectorInstanceId,
          sourceUpdatedAt: competitor.sourceUpdatedAt,
          externalVersion: competitor.externalVersion,
        }
      : null,
    systemOfRecordInstanceId: params.systemOfRecordInstanceId ?? null,
  });

  const freshness = computeFreshness({
    lastSyncAt: now,
    stalenessThresholdMinutes: params.stalenessThresholdMinutes,
    pushBased: params.pushBased,
    clock,
  });

  const externalUrl =
    params.record.externalUrl ?? buildDeepLink(params.deepLinkTemplate, params.record.externalId);

  const values = {
    id: existingSame?.id ?? nextReferenceId(clock),
    runId: params.runId,
    connectorInstanceId: params.connectorInstanceId,
    sourceSystem: params.sourceSystem,
    externalType: params.record.externalType,
    externalId: params.record.externalId,
    externalUrl,
    externalVersion: params.record.externalVersion,
    sourceUpdatedAt: params.record.sourceUpdatedAt,
    syncedAt: now,
    freshnessStatus: freshness,
    canonicalType: params.canonical.canonicalType,
    canonicalId: params.canonical.canonicalId,
    conflicted: resolution.conflicted,
    conflictNote: resolution.note,
  } satisfies typeof externalReferences.$inferInsert;

  getDb()
    .insert(externalReferences)
    .values(values)
    .onConflictDoUpdate({
      target: [
        externalReferences.connectorInstanceId,
        externalReferences.externalType,
        externalReferences.externalId,
      ],
      set: {
        externalUrl: values.externalUrl,
        externalVersion: values.externalVersion,
        sourceUpdatedAt: values.sourceUpdatedAt,
        syncedAt: values.syncedAt,
        freshnessStatus: values.freshnessStatus,
        canonicalType: values.canonicalType,
        canonicalId: values.canonicalId,
        conflicted: values.conflicted,
        conflictNote: values.conflictNote,
      },
    })
    .run();

  /*
   * When the policy flags a conflict, the competing reference is flagged too.
   * Otherwise the interface would show the disagreement under one source and
   * not the other, and a user looking at the GRC row would have no indication
   * that the process intelligence row disputes it.
   */
  if (resolution.conflicted && competitor) {
    getDb()
      .update(externalReferences)
      .set({ conflicted: true, conflictNote: resolution.note })
      .where(eq(externalReferences.id, competitor.id))
      .run();
  }

  const reference = getDb()
    .select()
    .from(externalReferences)
    .where(
      and(
        eq(externalReferences.connectorInstanceId, params.connectorInstanceId),
        eq(externalReferences.externalType, params.record.externalType),
        eq(externalReferences.externalId, params.record.externalId),
      ),
    )
    .get();

  if (!reference) {
    throw new Error(
      `The external reference for ${params.record.externalType}:${params.record.externalId} could not be read back.`,
    );
  }

  return {
    reference,
    created: !existingSame,
    changed:
      !existingSame ||
      existingSame.externalVersion !== params.record.externalVersion ||
      existingSame.sourceUpdatedAt !== params.record.sourceUpdatedAt,
    conflicted: resolution.conflicted,
    conflictNote: resolution.note,
  };
}

/** Every external reference for one canonical object. */
export function referencesForCanonicalObject(
  runId: string,
  canonicalType: string,
  canonicalId: string,
): ExternalReferenceRow[] {
  return getDb()
    .select()
    .from(externalReferences)
    .where(
      and(
        eq(externalReferences.runId, runId),
        eq(externalReferences.canonicalType, canonicalType),
        eq(externalReferences.canonicalId, canonicalId),
      ),
    )
    .all();
}

/** Every external reference a connector instance owns. */
export function referencesForConnector(
  runId: string,
  connectorInstanceId: string,
): ExternalReferenceRow[] {
  return getDb()
    .select()
    .from(externalReferences)
    .where(
      and(
        eq(externalReferences.runId, runId),
        eq(externalReferences.connectorInstanceId, connectorInstanceId),
      ),
    )
    .all();
}
