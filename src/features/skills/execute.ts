/**
 * Runs a checked skill spec over the role's records. Read only.
 *
 * The scope is the same one Search applies (`src/features/search/read.ts`):
 * the role's legal entity, and only what has been revealed by the current
 * scenario moment. A skill cannot widen it; the spec names fields, never a
 * role, an entity or a run. Every row is read through the workday
 * repositories or a plain select, and nothing here writes.
 *
 * Callers reach this through the `runSkill` tool (`tools.ts`), so the
 * authority gate decides and audits each run.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { contractObligations, contracts } from "@/db/schema/domain";
import {
  getAllEvidenceDocuments,
  getEntity,
  getIncidents,
  getKris,
  getRole,
  getSuppliers,
} from "@/db/repositories/workday";
import { momentToMinutes } from "@/domain/nfr/calculators";
import type { Language } from "@/i18n/labels";
import { SCENARIO_DATE } from "@/scenario/data/contract";
import { SKILL_CATALOG, skillField, type SkillField, type SkillSource } from "./catalog";
import type { SkillFilter, SkillSpec } from "./schema";
import { displayDay } from "./describe";

/** Group-wide indicators apply to every entity. */
const GROUP_ENTITY = "ARC-GROUP";

type Cell = string | number | boolean | null;

interface SkillRecord {
  id: string;
  /** What a reader cites: the record's own reference. */
  ref: string;
  values: Record<string, Cell>;
  /** Shown after a number, for example the indicator's unit. */
  unit?: string;
}

export interface SkillScope {
  runId: string;
  roleId: RoleId;
  atMoment: string;
  language: Language;
  /** The scenario day the windows count from. */
  today?: string;
}

export interface SkillRunResult {
  source: SkillSource;
  columns: Array<{ id: string; label: string }>;
  rows: Array<{ id: string; ref: string; cells: string[] }>;
  /** Records the role may read in this source. */
  inScope: number;
  /** Records that pass every filter. */
  matched: number;
  entityId: string | null;
  entityName: string;
  atMoment: string;
  today: string;
}

const db = () => getDb();

/** An incident detected later on the scenario day has not happened yet. */
function detectedBy(detectedAt: string, atMoment: string, today: string): boolean {
  if (detectedAt.slice(0, 10) !== today) return detectedAt.slice(0, 10) < today;
  return momentToMinutes(detectedAt.slice(11, 16)) <= momentToMinutes(atMoment);
}

function loadRecords(source: SkillSource, scope: Required<SkillScope>, entityId: string | null): SkillRecord[] {
  const inEntity = (ids: readonly string[] | null | undefined) => entityId === null || (ids ?? []).includes(entityId);
  const german = scope.language === "de";
  const runId = scope.runId;
  const suppliers = getSuppliers(runId);
  const supplierName = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));

  switch (source) {
    case "suppliers":
      return suppliers
        .filter((supplier) => inEntity(supplier.contractingEntityIds))
        .map((supplier) => ({
          id: supplier.id,
          ref: supplier.id,
          values: {
            name: supplier.name,
            criticality: supplier.criticality,
            status: supplier.status,
            nextAssessmentDue: supplier.nextAssessmentDue,
            lastAssessmentDate: supplier.lastAssessmentDate,
            isOutsourcing: supplier.isOutsourcing,
          },
        }));

    case "evidence":
      /* The repository already keeps out what arrives after the current moment. */
      return getAllEvidenceDocuments(scope.atMoment, runId)
        .filter((document) => inEntity(document.entityIds))
        .map((document) => ({
          id: document.id,
          ref: document.id,
          values: {
            title: german && document.titleDe ? document.titleDe : document.title,
            sourceType: document.sourceType,
            status: document.status,
            isStale: document.isStale,
            documentDate: document.documentDate,
          },
        }));

    case "obligations": {
      const contractRows = db().select().from(contracts).where(eq(contracts.runId, runId)).all();
      const contractById = new Map(contractRows.map((contract) => [contract.id, contract]));
      return db()
        .select()
        .from(contractObligations)
        .where(eq(contractObligations.runId, runId))
        .all()
        .flatMap((obligation) => {
          const contract = contractById.get(obligation.contractId);
          if (!contract || (entityId !== null && contract.entityId !== entityId)) return [];
          return [
            {
              id: obligation.id,
              ref: contract.reference,
              values: {
                supplierName: supplierName.get(contract.supplierId) ?? contract.supplierId,
                clauseReference: obligation.clauseReference,
                category: obligation.category,
                evidenceStatus: obligation.evidenceStatus,
                obligationText: obligation.obligationText,
              },
            },
          ];
        });
    }

    case "incidents":
      return getIncidents(runId)
        .filter((incident) => inEntity(incident.entityIds) && detectedBy(incident.detectedAt, scope.atMoment, scope.today))
        .map((incident) => ({
          id: incident.id,
          ref: incident.reference,
          values: {
            title: german ? incident.titleDe : incident.title,
            supplierName: incident.supplierIds.map((id) => supplierName.get(id) ?? id).join(", "),
            kind: incident.kind,
            status: incident.status,
            severity: incident.severity ?? "unclassified",
            detectedAt: incident.detectedAt,
          },
        }));

    case "kris":
      return getKris(runId)
        .filter((kri) => entityId === null || kri.entityId === entityId || kri.entityId === GROUP_ENTITY)
        .map((kri) => ({
          id: kri.id,
          ref: kri.reference,
          unit: kri.unit,
          values: {
            name: german ? kri.nameDe : kri.name,
            currentStatus: kri.currentStatus,
            currentValue: kri.currentValue,
          },
        }));
  }
}

function dayNumber(value: string): number {
  return Math.floor(Date.parse(`${value.slice(0, 10)}T00:00:00Z`) / 86_400_000);
}

function passes(record: SkillRecord, filter: SkillFilter, today: number): boolean {
  const cell = record.values[filter.field] ?? null;
  switch (filter.operator) {
    case "is-any-of":
      return cell !== null && filter.values.includes(String(cell));
    case "is":
      return Boolean(cell) === (filter.values[0] === "true");
    case "contains":
      return cell !== null && String(cell).toLowerCase().includes((filter.values[0] ?? "").toLowerCase());
    default: {
      if (typeof cell !== "string" || cell.length < 10) return false;
      const offset = dayNumber(cell) - today;
      const days = filter.days ?? 0;
      if (filter.operator === "within-next-days") return offset >= 0 && offset <= days;
      if (filter.operator === "within-last-days") return offset <= 0 && offset >= -days;
      if (filter.operator === "older-than-days") return offset < -days;
      return offset < 0;
    }
  }
}

function compare(field: SkillField | undefined, left: Cell, right: Cell): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (field?.kind === "enum") {
    const order = (field.values ?? []).map((value) => value.id);
    return order.indexOf(String(left)) - order.indexOf(String(right));
  }
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right));
}

function display(field: SkillField | undefined, record: SkillRecord, language: Language): string {
  const cell = record.values[field?.id ?? ""] ?? null;
  if (cell === null || cell === "") return language === "de" ? "Nicht erfasst" : "Not recorded";
  if (!field) return String(cell);
  switch (field.kind) {
    case "enum": {
      const value = field.values?.find((entry) => entry.id === String(cell));
      return value ? (language === "de" ? value.label.de : value.label.en) : String(cell);
    }
    case "date":
      return typeof cell === "string" ? displayDay(cell) : String(cell);
    case "boolean":
      return cell ? (language === "de" ? "Ja" : "Yes") : language === "de" ? "Nein" : "No";
    case "number":
      return record.unit ? `${String(cell)} ${record.unit}` : String(cell);
    default:
      return String(cell);
  }
}

/** Runs a spec that has already passed `checkSkillSpec`. */
export function runSkillSpec(spec: SkillSpec, input: SkillScope): SkillRunResult {
  const scope: Required<SkillScope> = { ...input, runId: input.runId || DEFAULT_RUN_ID, today: input.today ?? SCENARIO_DATE };
  const role = getRole(scope.roleId, scope.runId);
  const entityId = role?.entityId ?? null;
  const entity = entityId ? getEntity(entityId, scope.runId) : undefined;

  const records = loadRecords(spec.source, scope, entityId);
  const today = dayNumber(scope.today);
  const matched = records.filter((record) => spec.filters.every((filter) => passes(record, filter, today)));

  const sortField = skillField(spec.source, spec.sort.field);
  const sign = spec.sort.direction === "asc" ? 1 : -1;
  matched.sort((left, right) => {
    const order = compare(sortField, left.values[spec.sort.field] ?? null, right.values[spec.sort.field] ?? null);
    return order !== 0 ? order * sign : left.ref.localeCompare(right.ref);
  });

  const fields = spec.columns.map((column) => skillField(spec.source, column));
  return {
    source: spec.source,
    columns: spec.columns.map((column, index) => {
      const field = fields[index];
      return { id: column, label: field ? (scope.language === "de" ? field.label.de : field.label.en) : column };
    }),
    rows: matched.slice(0, spec.limit).map((record) => ({
      id: record.id,
      ref: record.ref,
      cells: fields.map((field) => display(field, record, scope.language)),
    })),
    inScope: records.length,
    matched: matched.length,
    entityId,
    entityName: entity?.name ?? (scope.language === "de" ? "Alle Gesellschaften" : "All entities"),
    atMoment: scope.atMoment,
    today: scope.today,
  };
}

/** The in-scope supplier names, so a request can narrow by name without quoting it. */
export function knownSupplierNames(roleId: RoleId, runId: string = DEFAULT_RUN_ID): string[] {
  const entityId = getRole(roleId, runId)?.entityId ?? null;
  return getSuppliers(runId)
    .filter((supplier) => entityId === null || supplier.contractingEntityIds.includes(entityId))
    .map((supplier) => supplier.name);
}

/** The source label in the reader's language, for summaries. */
export function sourceLabel(source: SkillSource, language: Language): string {
  const label = SKILL_CATALOG[source].label;
  return language === "de" ? label.de : label.en;
}
