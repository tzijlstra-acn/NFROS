/**
 * Read helpers shared by the Third-Party Onboarding stages.
 *
 * The eight stages read one another's records: classification reads what
 * intake corrected, due diligence reads the classification, evidence review
 * reads what due diligence removed, and the decision and the handover read
 * the whole file. These helpers are the one place that reading is written,
 * so two stages cannot disagree about what an earlier stage recorded.
 *
 * Everything here reads. Nothing writes; writing is the engine's, through
 * the governed tools and the completion handler.
 *
 * The regulatory framing is also here, because it is a rule rather than a
 * phrase: DORA and the EBA outsourcing guidelines are named for the EU
 * entities (ARC-DE, ARC-AT) only, the FINMA framework for the Swiss entity
 * (ARC-CH) only, and every statement that names a framework carries
 * "Illustrative regulatory context, not legal advice". A stage that wants
 * regulatory context asks `regulatoryContext` and cannot phrase it itself.
 *
 * Synthetic institution and data.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { legalEntities } from "@/db/schema/core";
import { services, suppliers } from "@/db/schema/domain";
import { actions, monitoringActivations } from "@/db/schema/decisions";
import { getLatestArtifact, getStageRuns } from "@/db/repositories/role-app-runtime";
import type { Bilingual } from "@/role-apps/contracts";
import type { SourceLoadResult, SourceRecord, StageContext } from "@/features/process/types";
import { findTask, parseTaskOutput, type ToolTaskOutput } from "@/features/process/derive";
import { taskKey } from "@/features/process/keys";
import { recordedTaskOutput } from "@/features/process/tasks";
import { formatDate, unique } from "@/role-apps/stage-support";

export const PROCESS_ID = "tprm-third-party-onboarding";

export type Sources = StageContext["sources"];

/* ==========================================================================
   Source results
   ========================================================================== */

export function recordsOf(sources: Sources, key: string): SourceRecord[] {
  return sources.find((source) => source.spec.key === key)?.result.records ?? [];
}

export function sourceResult(records: SourceRecord[], extra: Partial<SourceLoadResult> = {}): SourceLoadResult {
  return {
    status: records.length === 0 ? "empty" : "loaded",
    records,
    evidenceIds: unique(records.flatMap((record) => record.evidenceIds)),
    asOf: null,
    note: null,
    ...extra,
  };
}

export function fact(record: SourceRecord | undefined, key: string): string {
  const value = record?.facts?.[key];
  return value === null || value === undefined ? "" : String(value);
}

/* ==========================================================================
   Text
   ========================================================================== */

/** "a, b and c", or "a, b und c". */
export function joinList(items: readonly string[], conjunction: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
}

/** "09.10.2026" to "2026-10-09"; an ISO date passes through. */
export function toIsoDate(value: string): string {
  const german = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  return german ? `${german[3]}-${german[2]}-${german[1]}` : value.trim();
}

/** The ISO date `days` after an ISO date. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

/** One labelled field from an authored document body: "Business owner: ...". */
export function bodyField(body: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}:\\s*(.+)$`, "m").exec(body)?.[1]?.trim() ?? "";
}

export { formatDate };

/* ==========================================================================
   The supplier, its services and the entities
   ========================================================================== */

export type SupplierRow = typeof suppliers.$inferSelect;
export type ServiceRow = typeof services.$inferSelect;

export function supplierRow(runId: string, supplierId: string): SupplierRow | undefined {
  return getDb()
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.runId, runId), eq(suppliers.id, supplierId)))
    .get();
}

export function servicesOf(runId: string, supplierId: string): ServiceRow[] {
  return getDb()
    .select()
    .from(services)
    .where(eq(services.runId, runId))
    .all()
    .filter((service) => service.supplierIds.includes(supplierId));
}

export interface EntityRef {
  id: string;
  name: string;
  /** "eu" or "ch", from the legal entity record. */
  bloc: string;
}

/** The group's own order of its entities: the German parent, then Austria, then Switzerland. */
const ENTITY_ORDER = ["ARC-DE", "ARC-AT", "ARC-CH"];

function entityRank(id: string): number {
  return ENTITY_ORDER.includes(id) ? ENTITY_ORDER.indexOf(id) : ENTITY_ORDER.length;
}

/** Entity identifiers, de-duplicated, in the group's order. */
export function orderEntities(ids: readonly string[]): string[] {
  return unique(ids).sort((a, b) => entityRank(a) - entityRank(b) || a.localeCompare(b));
}

export function entityRefs(runId: string, ids: readonly string[]): EntityRef[] {
  const rows = getDb().select().from(legalEntities).where(eq(legalEntities.runId, runId)).all();
  const rank = entityRank;
  return unique(ids)
    .map((id) => {
      const row = rows.find((candidate) => candidate.id === id);
      return { id, name: row?.name ?? id, bloc: row?.regulatoryBloc ?? (id === "ARC-CH" ? "ch" : "eu") };
    })
    .sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}

/* ==========================================================================
   Regulatory framing
   ========================================================================== */

export const ILLUSTRATIVE: Bilingual = {
  en: "Illustrative regulatory context, not legal advice.",
  de: "Nur illustrativer regulatorischer Kontext, keine Rechtsberatung.",
};

const FRAMEWORK = /\b(DORA|EBA|FINMA)\b/;

/**
 * A text read from a document, with the disclaimer added when it names a
 * regulatory framework and does not already carry it. Used for conditions
 * quoted from a specialist's document, which a stage shows in its own rows.
 */
export function withRegulatoryNote(text: string, language: "en" | "de"): string {
  if (!FRAMEWORK.test(text)) return text;
  const note = language === "de" ? ILLUSTRATIVE.de : ILLUSTRATIVE.en;
  return text.includes(ILLUSTRATIVE.en) || text.includes(ILLUSTRATIVE.de) ? text : `${text} ${note}`;
}

export type RegulatoryTopic = "classification" | "contract" | "monitoring";

/**
 * The regulatory context for the entities in scope, one statement per
 * regulatory bloc, each carrying the disclaimer.
 *
 * DORA and the EBA guidelines are named for EU entities only. The Swiss
 * entity is framed under FINMA only, and the statement says that the EU
 * framework is not the one applied to it, which is the opposite of the error
 * the product must never make.
 */
export function regulatoryContext(entities: readonly EntityRef[], topic: RegulatoryTopic): Bilingual[] {
  const eu = entities.filter((entity) => entity.bloc === "eu").map((entity) => entity.id);
  const ch = entities.filter((entity) => entity.bloc === "ch").map((entity) => entity.id);
  const out: Bilingual[] = [];
  const euEn = joinList(eu, "and");
  const euDe = joinList(eu, "und");

  if (eu.length > 0) {
    const text: Record<RegulatoryTopic, Bilingual> = {
      classification: {
        en: `For ${euEn}, the outsourcing question follows the EBA Guidelines on outsourcing arrangements, and an ICT service is also in scope of the DORA framework for ICT third-party risk.`,
        de: `Fuer ${euDe} folgt die Auslagerungsfrage den EBA-Leitlinien zu Auslagerungen, und eine IKT-Leistung faellt zusaetzlich unter den DORA-Rahmen fuer IKT-Drittparteienrisiken.`,
      },
      contract: {
        en: `For ${euEn}, the EBA outsourcing guidelines and the DORA provisions on ICT contracts expect audit and access rights, termination and exit rights, subcontracting terms, a data location, incident notification and business continuity terms.`,
        de: `Fuer ${euDe} erwarten die EBA-Leitlinien zu Auslagerungen und die DORA-Vorgaben fuer IKT-Vertraege Pruef- und Zugangsrechte, Kuendigungs- und Ausstiegsrechte, Regelungen zu Unterauftragnehmern, einen Datenstandort, Meldung von Vorfaellen und Regelungen zur Betriebskontinuitaet.`,
      },
      monitoring: {
        en: `For ${euEn}, DORA expects ongoing monitoring of ICT third-party arrangements and a current register of information.`,
        de: `Fuer ${euDe} erwartet DORA eine laufende Ueberwachung von IKT-Drittparteienvereinbarungen und ein aktuelles Informationsregister.`,
      },
    };
    out.push({ en: `${text[topic].en} ${ILLUSTRATIVE.en}`, de: `${text[topic].de} ${ILLUSTRATIVE.de}` });
  }

  if (ch.length > 0) {
    const chEn = joinList(ch, "and");
    const text: Record<RegulatoryTopic, Bilingual> = {
      classification: {
        en: `For ${chEn}, the outsourcing question follows the FINMA outsourcing framework. The EU framework (EBA guidelines, DORA) is not the one applied to ${chEn}.`,
        de: `Fuer ${chEn} folgt die Auslagerungsfrage dem FINMA-Rahmen fuer Auslagerungen. Der EU-Rahmen (EBA-Leitlinien, DORA) wird auf ${chEn} nicht angewendet.`,
      },
      contract: {
        en: `For ${chEn}, the FINMA outsourcing framework expects audit and supervisory access and a defined data location in the contract.`,
        de: `Fuer ${chEn} erwartet der FINMA-Rahmen fuer Auslagerungen Pruef- und Aufsichtszugang sowie einen festgelegten Datenstandort im Vertrag.`,
      },
      monitoring: {
        en: `For ${chEn}, the FINMA outsourcing framework expects the outsourcing to be monitored and kept in the inventory of outsourced functions.`,
        de: `Fuer ${chEn} erwartet der FINMA-Rahmen fuer Auslagerungen, dass die Auslagerung ueberwacht und im Inventar der ausgelagerten Funktionen gefuehrt wird.`,
      },
    };
    out.push({ en: `${text[topic].en} ${ILLUSTRATIVE.en}`, de: `${text[topic].de} ${ILLUSTRATIVE.de}` });
  }

  return out;
}

/* ==========================================================================
   Records earlier stages of the same run wrote
   ========================================================================== */

/** The content of the latest stage record an earlier stage of this run stored, or null. */
export function stageRecord(runId: string, processRunId: string, stageId: string, artifactKey: string): Record<string, unknown> | null {
  const artifact = getLatestArtifact(processRunId, stageId, artifactKey, runId);
  if (!artifact?.content) return null;
  try {
    return JSON.parse(artifact.content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** The run's completed stages, in order, with when they completed. */
export function completedStages(runId: string, processRunId: string): Array<{ stageRunId: string; stageId: string; completedAt: string | null }> {
  return getStageRuns(processRunId, runId)
    .filter((row) => row.status === "completed")
    .map((row) => ({ stageRunId: row.id, stageId: row.stageId, completedAt: row.completedAt }));
}

/* ==========================================================================
   The file's open work
   ========================================================================== */

export type ActionRow = typeof actions.$inferSelect;

/** Open actions on the supplier: the conditions and requests still to be met. */
export function openActionsFor(runId: string, supplierId: string): ActionRow[] {
  return getDb()
    .select()
    .from(actions)
    .where(and(eq(actions.runId, runId), eq(actions.relatedObjectId, supplierId)))
    .all()
    .filter((row) => row.status !== "completed" && row.status !== "cancelled")
    .sort((a, b) => (a.dueOn ?? "9999-12-31").localeCompare(b.dueOn ?? "9999-12-31") || a.id.localeCompare(b.id));
}

export function monitoringFor(runId: string, supplierId: string) {
  return getDb()
    .select()
    .from(monitoringActivations)
    .where(and(eq(monitoringActivations.runId, runId), eq(monitoringActivations.subjectId, supplierId)))
    .all()
    .filter((row) => row.active)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/* ==========================================================================
   Stage state: recorded input, decisions, tool results
   ========================================================================== */

/** The recorded input of a human task, parsed by its schema, or null. */
export function recordedInput<T>(context: StageContext, key: string, schema: { safeParse(value: unknown): { success: boolean; data?: T } }): T | null {
  const output = recordedTaskOutput(context, key);
  const parsed = output ? schema.safeParse(output.input) : null;
  return parsed?.success ? (parsed.data as T) : null;
}

/** The decision task id, which tools cite as the decision they execute. */
export function decisionTaskId(context: StageContext, decisionKey: string): string | null {
  return findTask(context.tasks, taskKey.decision(decisionKey))?.id ?? null;
}

export function chosenOption(context: StageContext, decisionKey: string): string | null {
  return context.decisions.find((state) => state.spec.key === decisionKey)?.chosenOptionId ?? null;
}

/** What a local tool of this stage created, from its recorded result. */
export function localResultId(context: StageContext, toolKey: string, field: string): string | null {
  const output = parseTaskOutput<ToolTaskOutput>(findTask(context.tasks, taskKey.tool(toolKey)));
  const data = output?.resultData as Record<string, unknown> | null | undefined;
  const value = data?.[field];
  return typeof value === "string" ? value : null;
}

/** The decision record of a stage decision, for the stage record. */
export function decisionSummary(context: StageContext, decisionKey: string) {
  const decision = context.decisions.find((state) => state.spec.key === decisionKey);
  return decision
    ? { optionId: decision.chosenOptionId, outcome: decision.outcome, rationale: decision.rationale, decidedBy: decision.decidedByUserId }
    : null;
}

/** The state of every tool of the stage, for the stage record. */
export function toolSummary(context: StageContext) {
  return context.tools.map((tool) => ({
    key: tool.key,
    state: tool.state,
    commandId: tool.commandId,
    externalId: tool.externalId,
    approvalId: tool.approvalId,
  }));
}

export function preparationSummary(context: StageContext) {
  return { artifactId: context.preparation.artifactId, mode: context.preparation.mode, source: context.preparation.source };
}

/**
 * The lineage an action created by a stage carries (migration 0005): the
 * process run, the stage and the stage run it was raised from, so the Work
 * Hub shows where a condition came from.
 */
export function lineageOf(context: StageContext): { sourceProcessRunId: string; sourceStageId: string; sourceStageRunId: string | null } {
  return { sourceProcessRunId: context.run.id, sourceStageId: context.stage.id, sourceStageRunId: context.stageRun?.id ?? null };
}

/** A short supplier name for copy: the record's name, or its identifier. */
export function supplierName(context: Pick<StageContext, "runId" | "run">): string {
  return supplierRow(context.runId, context.run.subjectId)?.name ?? context.run.subjectId;
}
