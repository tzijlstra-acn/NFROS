/**
 * The analytics dataset: what an analysis may read, read once per analysis.
 *
 * Server only. Two layers, joined here and nowhere else:
 *
 *   the operational records of the day, read through the same repositories
 *   the workday uses and scoped to the current scenario moment exactly as
 *   Search and Skills scope them (an incident detected later on the scenario
 *   day has not happened yet; a document revealed later has not arrived);
 *
 *   the portfolio register and its history (migration 0010), which carries
 *   the breadth and time the day does not.
 *
 * Every table involved holds tens or hundreds of rows, so one read per
 * analysis and plain array work is both the simplest and the fastest shape.
 * Nothing here writes.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  controlTestResults,
  kriHistory,
  portfolioProviderLinks,
  portfolioThirdParties,
  riskAcceptances,
  serviceResilienceTests,
  thirdPartyMonthlyMetrics,
} from "@/db/schema/portfolio";
import { policies } from "@/db/schema/practice";
import {
  getActions,
  getAllEvidenceDocuments,
  getAllSubprocessors,
  getControls,
  getDecisions,
  getIncidents,
  getIssues,
  getKris,
  getObligations,
  getRegulatoryPublications,
  getRisks,
  getServiceDependencies,
  getServices,
  getSuppliers,
  getUsers,
} from "@/db/repositories/workday";
import { kriReadings } from "@/db/schema/domain";
import type { RoleId } from "@/db/schema/core";
import { momentToMinutes } from "@/domain/nfr/calculators";
import { providerKeyForName, PROVIDERS } from "@/scenario/data/portfolio";

export interface AnalysisScope {
  runId: string;
  roleId: RoleId;
  atMoment: string;
  /** The scenario day, "2026-10-06". */
  today: string;
  language: "en" | "de";
}

/** A third party, operational or register, in one shape. */
export interface ThirdParty {
  id: string;
  name: string;
  criticality: string;
  status: string;
  category: string;
  domicile: string;
  entityIds: string[];
  ownerUserId: string | null;
  /** True for the eight suppliers of the day, false for the register. */
  operational: boolean;
}

/** One dependency of a third party on an underlying provider, for one service. */
export interface ProviderDependency {
  thirdPartyId: string;
  providerKey: string;
  providerName: string;
  serviceId: string;
  supportsCriticalFunction: boolean;
  declared: boolean;
  /** Where the link is recorded: the operational subprocessor list or the register. */
  source: "operational" | "register";
}

function detectedBy(detectedAt: string, atMoment: string, today: string): boolean {
  if (detectedAt.slice(0, 10) !== today) return detectedAt.slice(0, 10) < today;
  return momentToMinutes(detectedAt.slice(11, 16)) <= momentToMinutes(atMoment);
}

export function loadAnalyticsData(scope: AnalysisScope) {
  const db = getDb();
  const runId = scope.runId;

  const suppliers = getSuppliers(runId);
  const register = db.select().from(portfolioThirdParties).where(eq(portfolioThirdParties.runId, runId)).all();
  /* Suppliers still being onboarded have no history and no service yet. */
  const thirdParties: ThirdParty[] = [
    ...suppliers
      .filter((supplier) => supplier.status !== "onboarding")
      .map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        criticality: supplier.criticality,
        status: supplier.status,
        category: supplier.id === "TP-0042" ? "payments" : "services",
        domicile: supplier.domicile,
        entityIds: supplier.contractingEntityIds,
        ownerUserId: supplier.relationshipOwnerUserId,
        operational: true,
      })),
    ...register.map((entry) => ({
      id: entry.id,
      name: entry.name,
      criticality: entry.criticality,
      status: entry.status,
      category: entry.category,
      domicile: entry.domicile,
      entityIds: entry.entityIds,
      ownerUserId: entry.relationshipOwnerUserId,
      operational: false,
    })),
  ];

  const services = getServices(runId);
  const subprocessors = getAllSubprocessors(runId);
  const registerLinks = db.select().from(portfolioProviderLinks).where(eq(portfolioProviderLinks.runId, runId)).all();
  const knownProviders = new Set(Object.keys(PROVIDERS));

  /*
   * Operational subprocessors become provider dependencies for every
   * important business service their supplier supports. Only shared
   * providers are kept as providers; a supplier's own single-purpose
   * subprocessor is not a concentration.
   */
  const operationalDependencies: ProviderDependency[] = subprocessors.flatMap((sub) => {
    const key = providerKeyForName(sub.name);
    if (!knownProviders.has(key)) return [];
    /* The group's business services (IBS-), not a supplier's own component services. */
    const supported = services.filter((service) => service.id.startsWith("IBS-") && service.supplierIds.includes(sub.supplierId));
    return supported.map((service) => ({
      thirdPartyId: sub.supplierId,
      providerKey: key,
      providerName: PROVIDERS[key]?.name ?? sub.name,
      serviceId: service.id,
      supportsCriticalFunction: Boolean(sub.supportsCriticalFunction),
      declared: !sub.isDiscrepancy,
      source: "operational" as const,
    }));
  });
  const dependencies: ProviderDependency[] = [
    ...operationalDependencies,
    ...registerLinks.map((link) => ({
      thirdPartyId: link.thirdPartyId,
      providerKey: link.providerKey,
      providerName: link.providerName,
      serviceId: link.serviceId,
      supportsCriticalFunction: link.supportsCriticalFunction,
      declared: link.declared,
      source: "register" as const,
    })),
  ];

  const kris = getKris(runId);
  const readings2026 = db.select().from(kriReadings).where(eq(kriReadings.runId, runId)).all();
  const history = db.select().from(kriHistory).where(eq(kriHistory.runId, runId)).all();
  const kriSeries = new Map<string, Array<{ period: string; value: number; status: string }>>();
  for (const kri of kris) {
    const points = [
      ...history.filter((row) => row.kriId === kri.id).map((row) => ({ period: row.period, value: row.value, status: row.status })),
      ...readings2026
        .filter((row) => row.kriId === kri.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => ({ period: row.periodEnd.slice(0, 7), value: row.value, status: row.status })),
    ].sort((a, b) => a.period.localeCompare(b.period));
    kriSeries.set(kri.id, points);
  }

  const incidents = getIncidents(runId).filter((incident) => detectedBy(incident.detectedAt, scope.atMoment, scope.today));

  return {
    scope,
    thirdParties,
    thirdPartyById: new Map(thirdParties.map((tp) => [tp.id, tp])),
    services,
    serviceById: new Map(services.map((service) => [service.id, service])),
    dependencies,
    serviceDependencies: getServiceDependencies(runId),
    subprocessors,
    metrics: db.select().from(thirdPartyMonthlyMetrics).where(eq(thirdPartyMonthlyMetrics.runId, runId)).all(),
    controls: getControls(runId),
    controlResults: db.select().from(controlTestResults).where(eq(controlTestResults.runId, runId)).all(),
    kris,
    kriSeries,
    incidents,
    evidence: getAllEvidenceDocuments(scope.atMoment, runId),
    issues: getIssues(runId),
    actions: getActions({}, runId),
    risks: getRisks(runId),
    acceptances: db.select().from(riskAcceptances).where(eq(riskAcceptances.runId, runId)).all(),
    resilience: db.select().from(serviceResilienceTests).where(eq(serviceResilienceTests.runId, runId)).all(),
    obligations: getObligations(undefined, runId),
    publications: getRegulatoryPublications(runId),
    policies: db.select().from(policies).where(eq(policies.runId, runId)).all(),
    users: getUsers(runId),
    /* Visible at the current moment, highest priority first; the options stay with the decision surface. */
    decisions: getDecisions(scope.roleId, scope.atMoment, runId).map((entry) => entry.decision),
  };
}

export type AnalyticsData = ReturnType<typeof loadAnalyticsData>;

/** The name of a person, or the identifier when the person is not in the scenario. */
export function personName(data: AnalyticsData, userId: string | null | undefined): string {
  if (!userId) return "";
  return data.users.find((user) => user.id === userId)?.name ?? userId;
}

/** Days from one ISO date to another, positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

/** "2026-10-06" to "06.10.2026". */
export function formatDate(date: string): string {
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

/** "2026-09" to "Sep 2026" or "Sep. 2026". */
export function formatPeriod(period: string, language: "en" | "de"): string {
  const [year, month] = period.split("-").map(Number) as [number, number];
  const names =
    language === "de"
      ? ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
      : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[month - 1]} ${String(year).slice(2)}`;
}
