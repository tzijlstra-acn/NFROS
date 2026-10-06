/**
 * Data access for integration operations: incidents and data quality issues.
 *
 * Detection stays where it is (connector health, dead letters, rejected
 * events, conflicted references); these records hold what those cannot: an
 * incident's impact and recovery, and a data quality issue's review and
 * resolution. The console decides when to open, resolve or accept one.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import {
  dataQualityIssues,
  integrationIncidents,
  type DataQualityIssueKind,
} from "@/db/schema/product-console";

const db = () => getDb();

export type IntegrationIncident = typeof integrationIncidents.$inferSelect;
/** A new incident. `runId` defaults to the active scenario run. */
export type NewIntegrationIncident = Omit<typeof integrationIncidents.$inferInsert, "runId"> & { runId?: string };
export type DataQualityIssue = typeof dataQualityIssues.$inferSelect;
/** A new issue. `runId` defaults to the active scenario run. */
export type NewDataQualityIssue = Omit<typeof dataQualityIssues.$inferInsert, "runId"> & { runId?: string };

function definedOnly<T extends Record<string, unknown>>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/* ==========================================================================
   Incidents
   ========================================================================== */

export function openIntegrationIncident(incident: NewIntegrationIncident): IntegrationIncident {
  db().insert(integrationIncidents).values({ ...incident, runId: incident.runId ?? DEFAULT_RUN_ID }).run();
  const written = getIntegrationIncident(incident.id);
  if (!written) throw new Error(`Integration incident ${incident.id} was not written.`);
  return written;
}

export function getIntegrationIncident(id: string): IntegrationIncident | undefined {
  return db().select().from(integrationIncidents).where(eq(integrationIncidents.id, id)).get();
}

export function updateIntegrationIncident(
  id: string,
  patch: Partial<Omit<NewIntegrationIncident, "id" | "runId" | "openedAt" | "openedAtMoment" | "openedByLabel">>,
): IntegrationIncident | undefined {
  const set = definedOnly(patch);
  if (Object.keys(set).length > 0) db().update(integrationIncidents).set(set).where(eq(integrationIncidents.id, id)).run();
  return getIntegrationIncident(id);
}

export interface IncidentFilter {
  statuses?: ReadonlyArray<IntegrationIncident["status"]>;
  connectorInstanceId?: string;
  runId?: string;
}

/** Incidents, newest first. */
export function listIntegrationIncidents(filter: IncidentFilter = {}): IntegrationIncident[] {
  return db()
    .select()
    .from(integrationIncidents)
    .where(
      and(
        eq(integrationIncidents.runId, filter.runId ?? DEFAULT_RUN_ID),
        filter.statuses && filter.statuses.length > 0 ? inArray(integrationIncidents.status, [...filter.statuses]) : undefined,
        filter.connectorInstanceId ? eq(integrationIncidents.connectorInstanceId, filter.connectorInstanceId) : undefined,
      ),
    )
    .orderBy(desc(integrationIncidents.openedAt), desc(integrationIncidents.id))
    .all();
}

/* ==========================================================================
   Data quality issues
   ========================================================================== */

export function recordDataQualityIssue(issue: NewDataQualityIssue): DataQualityIssue {
  db().insert(dataQualityIssues).values({ ...issue, runId: issue.runId ?? DEFAULT_RUN_ID }).run();
  const written = getDataQualityIssue(issue.id);
  if (!written) throw new Error(`Data quality issue ${issue.id} was not written.`);
  return written;
}

export function getDataQualityIssue(id: string): DataQualityIssue | undefined {
  return db().select().from(dataQualityIssues).where(eq(dataQualityIssues.id, id)).get();
}

export function updateDataQualityIssue(
  id: string,
  patch: Partial<Omit<NewDataQualityIssue, "id" | "runId" | "detectedAt" | "detectedAtMoment" | "detectedBy">>,
): DataQualityIssue | undefined {
  const set = definedOnly(patch);
  if (Object.keys(set).length > 0) db().update(dataQualityIssues).set(set).where(eq(dataQualityIssues.id, id)).run();
  return getDataQualityIssue(id);
}

export interface DataQualityFilter {
  statuses?: ReadonlyArray<DataQualityIssue["status"]>;
  kinds?: readonly DataQualityIssueKind[];
  connectorInstanceId?: string;
  runId?: string;
}

/** Issues, newest first. */
export function listDataQualityIssues(filter: DataQualityFilter = {}): DataQualityIssue[] {
  return db()
    .select()
    .from(dataQualityIssues)
    .where(
      and(
        eq(dataQualityIssues.runId, filter.runId ?? DEFAULT_RUN_ID),
        filter.statuses && filter.statuses.length > 0 ? inArray(dataQualityIssues.status, [...filter.statuses]) : undefined,
        filter.kinds && filter.kinds.length > 0 ? inArray(dataQualityIssues.kind, [...filter.kinds]) : undefined,
        filter.connectorInstanceId ? eq(dataQualityIssues.connectorInstanceId, filter.connectorInstanceId) : undefined,
      ),
    )
    .orderBy(desc(dataQualityIssues.detectedAt), desc(dataQualityIssues.id))
    .all();
}
