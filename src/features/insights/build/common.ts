/**
 * What every analysis builder shares: language, links, evidence, actions.
 *
 * A builder reads the analytics dataset and returns an insight response. It
 * computes every number from rows; the words around the numbers are fixed
 * templates in both languages. A builder never invents a figure, and it
 * never writes: a proposed action is a payload for the authority gate, run
 * only when a person approves it in the review dialog.
 */

import type { RoleId } from "@/db/schema/core";
import { ROLE_AUTHORITY_SCOPES, TOOL_REGISTRY } from "@/server/security/authority";
import type { AnalyticsData } from "../data";
import { formatDate } from "../data";
import type {
  InsightEvidence,
  InsightResponseInput,
  ProposedInsightAction,
  Tone,
} from "../schema";

export type Language = "en" | "de";

/** Picks the language. Every user-facing sentence in a builder goes through this. */
export function tx(language: Language, en: string, de: string): string {
  return language === "de" ? de : en;
}

export interface BuildContext {
  data: AnalyticsData;
  question: string;
  roleId: RoleId;
  language: Language;
  /** "06.10.2026, 07:45". */
  dataAsOf: string;
  /** The case or object the question was asked about. */
  context: { kind: string; id: string } | null;
}

export type Builder = (context: BuildContext) => InsightResponseInput;

/* ---- links ---------------------------------------------------------------- */

/** Where an operational object opens: the Work Hub filtered to the work linked to it. */
export function workHref(roleId: string, objectId: string): string {
  return `/workday/${roleId}/work?view=actions&object=${encodeURIComponent(objectId)}`;
}

/** Where a register record opens: Insights, Records, with the record selected. */
export function recordHref(roleId: string, source: string, recordId: string): string {
  return `/workday/${roleId}/insights/records?source=${encodeURIComponent(source)}&record=${encodeURIComponent(recordId)}`;
}

export function decisionsHref(roleId: string, decisionId?: string): string {
  return decisionId ? `/workday/${roleId}/decisions?decision=${encodeURIComponent(decisionId)}` : `/workday/${roleId}/decisions`;
}

/** A third party opens in the Work Hub when it is one of the day's suppliers, else in Records. */
export function thirdPartyHref(context: BuildContext, thirdPartyId: string): string {
  const party = context.data.thirdPartyById.get(thirdPartyId);
  return party?.operational ? workHref(context.roleId, thirdPartyId) : recordHref(context.roleId, "third-parties", thirdPartyId);
}

/* ---- evidence ------------------------------------------------------------- */

export function registerEvidence(
  idValue: string,
  sourceName: string,
  recordId: string,
  observedAt: string,
  excerpt: string,
  options: { field?: string; freshness?: InsightEvidence["freshness"]; href?: string; sourceType?: string } = {},
): InsightEvidence {
  return {
    id: idValue,
    sourceType: options.sourceType ?? "Portfolio register",
    sourceName,
    recordId,
    observedAt,
    freshness: options.freshness ?? "current",
    excerpt: excerpt.slice(0, 400),
    ...(options.field ? { field: options.field } : {}),
    ...(options.href ? { href: options.href } : {}),
  };
}

/** Evidence from an evidence document of the day, with its own staleness. */
export function documentEvidence(context: BuildContext, documentId: string): InsightEvidence | null {
  const document = context.data.evidence.find((entry) => entry.id === documentId);
  if (!document) return null;
  return {
    id: `doc-${document.id}`,
    sourceType: "Evidence document",
    sourceName: context.language === "de" && document.titleDe ? document.titleDe : document.title,
    recordId: document.reference ?? document.id,
    observedAt: formatDate(document.documentDate),
    freshness: document.isStale ? "stale" : "current",
    excerpt: (document.summary ?? "").slice(0, 400),
    href: workHref(context.roleId, document.id),
  };
}

/* ---- governed actions ----------------------------------------------------- */

export interface ActionPermission {
  allowed: boolean;
  requiredScopes: string[];
  missingScopes: string[];
  authorityClass: string;
  approvalRequired: boolean;
}

/** Whether the role holds the scopes a tool requires. The gate checks again at commit. */
export function permissionFor(roleId: RoleId, toolName: string): ActionPermission {
  const tool = TOOL_REGISTRY[toolName];
  const held = new Set<string>(ROLE_AUTHORITY_SCOPES[roleId] ?? []);
  const required = tool ? [...tool.requiredScopes] : [];
  const missing = required.filter((scope) => !held.has(scope));
  return {
    allowed: Boolean(tool) && missing.length === 0 && tool?.authorityClass !== "PROHIBITED",
    requiredScopes: required,
    missingScopes: missing,
    authorityClass: tool?.authorityClass ?? "PROHIBITED",
    approvalRequired: tool?.authorityClass === "APPROVAL_REQUIRED",
  };
}

/** The role's holder, who acts and is assigned by default. */
export function holderOf(context: BuildContext): string {
  return context.data.users.find((user) => user.roleId === context.roleId)?.id ?? "";
}

/** A due date a number of days after the scenario day. */
export function dueIn(context: BuildContext, days: number): string {
  const date = new Date(`${context.data.scope.today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function createActionProposal(
  context: BuildContext,
  input: {
    id: string;
    title: string;
    description: string;
    ownerUserId: string;
    dueInDays: number;
    priority: "high" | "medium" | "low";
    relatedKind: string;
    relatedId: string;
    relatedLabel: string;
    entityId?: string;
    rationale: string;
    evidenceIds: string[];
  },
): ProposedInsightAction {
  const dueOn = dueIn(context, input.dueInDays);
  const owner = context.data.users.find((user) => user.id === input.ownerUserId)?.name ?? input.ownerUserId;
  const L = (en: string, de: string) => tx(context.language, en, de);
  return {
    id: input.id,
    actionType: "create-action",
    toolName: "createAction",
    payload: {
      title: input.title,
      description: input.description,
      ownerUserId: input.ownerUserId,
      ownerLabel: owner,
      dueOn,
      priority: input.priority,
      kind: "remediation",
      entityId: input.entityId ?? "ARC-DE",
      relatedObjectKind: input.relatedKind,
      relatedObjectId: input.relatedId,
    },
    target: { entityType: "action", entityId: "new", label: input.title, systemLabel: L("Remediation actions", "Massnahmen") },
    changes: [
      { field: L("Record", "Datensatz"), before: null, after: L("New remediation action", "Neue Massnahme") },
      { field: L("Title", "Titel"), before: null, after: input.title },
      { field: L("Owner", "Verantwortlich"), before: null, after: owner },
      { field: L("Due", "Faellig"), before: null, after: formatDate(dueOn) },
      { field: L("Priority", "Prioritaet"), before: null, after: input.priority },
      { field: L("Linked to", "Verknuepft mit"), before: null, after: `${input.relatedLabel} (${input.relatedId})` },
    ],
    rationale: input.rationale,
    evidenceIds: input.evidenceIds,
  };
}

export function requestEvidenceProposal(
  context: BuildContext,
  input: {
    id: string;
    what: string;
    fromUserId: string | null;
    fromLabel: string;
    dueInDays: number;
    relatedKind: string;
    relatedId: string;
    relatedLabel: string;
    entityId?: string;
    rationale: string;
    evidenceIds: string[];
  },
): ProposedInsightAction {
  const dueOn = dueIn(context, input.dueInDays);
  const L = (en: string, de: string) => tx(context.language, en, de);
  return {
    id: input.id,
    actionType: "request-evidence",
    toolName: "requestEvidenceDocument",
    payload: {
      documentDescription: input.what,
      ownerUserId: input.fromUserId ?? "",
      ownerLabel: input.fromLabel,
      dueOn,
      entityId: input.entityId ?? "ARC-DE",
      relatedObjectKind: input.relatedKind,
      relatedObjectId: input.relatedId,
    },
    target: { entityType: "evidence-request", entityId: "new", label: input.what, systemLabel: L("Evidence requests", "Nachweisanforderungen") },
    changes: [
      { field: L("Record", "Datensatz"), before: null, after: L("New evidence request", "Neue Nachweisanforderung") },
      { field: L("Requested", "Angefordert"), before: null, after: input.what },
      { field: L("From", "Von"), before: null, after: input.fromLabel },
      { field: L("Due", "Faellig"), before: null, after: formatDate(dueOn) },
      { field: L("Linked to", "Verknuepft mit"), before: null, after: `${input.relatedLabel} (${input.relatedId})` },
    ],
    rationale: input.rationale,
    evidenceIds: input.evidenceIds,
  };
}

export function createIssueProposal(
  context: BuildContext,
  input: {
    id: string;
    title: string;
    description: string;
    severity: "high" | "medium";
    ownerUserId: string;
    dueInDays: number;
    supplierIds?: string[];
    controlIds?: string[];
    relatedKind: string;
    relatedId: string;
    relatedLabel: string;
    rationale: string;
    evidenceIds: string[];
  },
): ProposedInsightAction {
  const dueOn = dueIn(context, input.dueInDays);
  const owner = context.data.users.find((user) => user.id === input.ownerUserId)?.name ?? input.ownerUserId;
  const L = (en: string, de: string) => tx(context.language, en, de);
  return {
    id: input.id,
    actionType: "create-issue",
    toolName: "createIssue",
    payload: {
      title: input.title,
      description: input.description,
      severity: input.severity,
      ownerUserId: input.ownerUserId,
      dueOn,
      kind: "control-gap",
      entityId: "ARC-DE",
      relatedObjectKind: input.relatedKind,
      relatedObjectId: input.relatedId,
      supplierIds: input.supplierIds ?? [],
      controlIds: input.controlIds ?? [],
    },
    target: { entityType: "issue", entityId: "new", label: input.title, systemLabel: L("Issue register", "Feststellungsregister") },
    changes: [
      { field: L("Record", "Datensatz"), before: null, after: L("New issue", "Neue Feststellung") },
      { field: L("Title", "Titel"), before: null, after: input.title },
      { field: L("Severity", "Schweregrad"), before: null, after: input.severity },
      { field: L("Owner", "Verantwortlich"), before: null, after: owner },
      { field: L("Due", "Faellig"), before: null, after: formatDate(dueOn) },
      { field: L("Linked to", "Verknuepft mit"), before: null, after: `${input.relatedLabel} (${input.relatedId})` },
    ],
    rationale: input.rationale,
    evidenceIds: input.evidenceIds,
  };
}

export function monitorProposal(
  context: BuildContext,
  input: { id: string; subjectKind: string; subjectId: string; subjectLabel: string; description: string; rationale: string; evidenceIds: string[] },
): ProposedInsightAction {
  const L = (en: string, de: string) => tx(context.language, en, de);
  return {
    id: input.id,
    actionType: "create-monitor",
    toolName: "activateMonitoring",
    payload: {
      subjectKind: input.subjectKind,
      subjectId: input.subjectId,
      kind: "enhanced-supplier-monitoring",
      description: input.description,
      reviewFrequency: "weekly",
      nextReviewOn: dueIn(context, 7),
    },
    target: { entityType: input.subjectKind, entityId: input.subjectId, label: input.subjectLabel, systemLabel: L("Monitoring", "Ueberwachung") },
    changes: [
      { field: L("Monitoring", "Ueberwachung"), before: L("Standard", "Standard"), after: L("Enhanced, weekly review", "Erweitert, woechentliche Pruefung") },
      { field: L("Subject", "Gegenstand"), before: null, after: `${input.subjectLabel} (${input.subjectId})` },
      { field: L("Next review", "Naechste Pruefung"), before: null, after: formatDate(dueIn(context, 7)) },
    ],
    rationale: input.rationale,
    evidenceIds: input.evidenceIds,
  };
}

/* ---- small numeric helpers ----------------------------------------------- */

export function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function toneForScore(score: number): Tone {
  if (score >= 65) return "critical";
  if (score >= 50) return "warning";
  if (score >= 40) return "watch";
  return "neutral";
}

export function toneForDelta(delta: number): Tone {
  if (delta >= 20) return "critical";
  if (delta >= 8) return "warning";
  if (delta <= -5) return "good";
  return "neutral";
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function joinNames(names: readonly string[], language: Language): string {
  if (names.length <= 1) return names[0] ?? "";
  const last = names[names.length - 1];
  return `${names.slice(0, -1).join(", ")} ${language === "de" ? "und" : "and"} ${last}`;
}

/** Short name for a third party, for labels: "Novalink Payment Services GmbH" becomes "Novalink". */
export function shortName(name: string): string {
  return name.split(" ")[0] ?? name;
}
