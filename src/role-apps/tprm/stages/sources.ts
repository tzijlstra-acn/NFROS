/**
 * Source loaders shared by several Third-Party Onboarding stages.
 *
 * The four loaders the reference stage registered (due diligence evidence,
 * the supplier record, the contract conditions and the specialist status)
 * live in `./evidence-review.ts`. These are the others:
 *
 *   tprm.procurement-request    the procurement request in the evidence
 *                               corpus, read field by field
 *   tprm.third-party-register   the register (suppliers and subprocessors):
 *                               the duplicate check and the service overlap
 *   tprm.arrangement-profile    the service, the business service it
 *                               supports, the entities in scope and the data
 *   tprm.classification-record  what Stage 2 recorded, or the supplier record
 *                               for a file classified before the engine
 *   tprm.specialist-huddle      the specialist review huddle and its minutes
 *   tprm.onboarding-file        the stage records, open conditions and
 *                               monitoring of the whole file
 *
 * Each reads the database and nothing else, returns records with ids, labels
 * and values a reader can check, and says "empty" with a note where nothing
 * is a finding rather than a gap.
 *
 * Synthetic institution and data.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { services, subprocessors, suppliers } from "@/db/schema/domain";
import { meetings } from "@/db/schema/work";
import { meetingMinutes } from "@/db/schema/role-app-runtime";
import { registerSourceLoader, type SourceLoaderContext } from "@/features/process/registry";
import { isConfirmedMinutes } from "@/features/work/modules/meetings/lifecycle";
import { getWorkRoleConfig } from "@/features/work/roles";
import type { SourceRecord } from "@/features/process/types";
import { revealedEvidence, type EvidenceRow } from "@/role-apps/stage-support";
import { TPRM_ONBOARDING_PROCESS } from "../definition";
import {
  bodyField,
  completedStages,
  entityRefs,
  formatDate,
  monitoringFor,
  openActionsFor,
  orderEntities,
  servicesOf,
  sourceResult,
  stageRecord,
  supplierRow,
} from "./shared";

/* ==========================================================================
   The procurement request
   ========================================================================== */

/** The latest procurement request held for the supplier, or null. */
export function procurementRequestDoc(context: Pick<SourceLoaderContext, "runId" | "state" | "run">): EvidenceRow | null {
  const docs = revealedEvidence(context.runId, context.state).filter(
    (doc) => doc.relatedObjectIds.includes(context.run.subjectId) && doc.sourceType === "procurement-request",
  );
  return docs.sort((a, b) => b.documentDate.localeCompare(a.documentDate))[0] ?? null;
}

const ENTITY_ID = /\bARC-(?:DE|AT|CH)\b/g;

/** The request's fields, read from its labelled lines. */
export function requestFields(doc: EvidenceRow) {
  const scopeNote = /SCOPE NOTE\s*\n+([\s\S]*?)(?:\n\s*\n[A-Z ]{4,}\n|$)/.exec(doc.body)?.[1]?.trim() ?? "";
  const entities = bodyField(doc.body, "Legal entities");
  return {
    reference: bodyField(doc.body, "Request reference") || doc.reference,
    revision: bodyField(doc.body, "Revision"),
    requestedBy: bodyField(doc.body, "Requested by"),
    owner: bodyField(doc.body, "Business owner"),
    candidate: bodyField(doc.body, "Supplier candidate"),
    register: bodyField(doc.body, "Commercial register"),
    service: bodyField(doc.body, "Service requested"),
    replaces: bodyField(doc.body, "Replaces"),
    supports: bodyField(doc.body, "Supports"),
    entities,
    entityIds: [...new Set(entities.match(ENTITY_ID) ?? [])],
    scopeEntityIds: [...new Set(scopeNote.match(ENTITY_ID) ?? [])],
    data: bodyField(doc.body, "Data categories"),
    start: bodyField(doc.body, "Planned start"),
    spend: bodyField(doc.body, "Annual spend"),
    proposal: bodyField(doc.body, "Business owner proposal"),
    scopeNote,
  };
}

export type RequestFields = ReturnType<typeof requestFields>;

registerSourceLoader("tprm.procurement-request", (context) => {
  const doc = procurementRequestDoc(context);
  if (!doc) {
    return sourceResult([], {
      note: {
        en: "No procurement request for this supplier is held in the evidence corpus. A file opened before the process engine references its request from the supplier record.",
        de: "Fuer diesen Lieferanten liegt kein Beschaffungsantrag im Nachweisbestand. Eine vor der Prozess-Engine eroeffnete Akte verweist ueber den Lieferantendatensatz auf ihren Antrag.",
      },
    });
  }
  const fields = requestFields(doc);
  return sourceResult(
    [
      {
        id: doc.id,
        label: doc.title,
        value: `${fields.revision ? `revision ${fields.revision.split(",")[0]?.trim() ?? ""}, ` : ""}${formatDate(doc.documentDate)}`,
        evidenceIds: [doc.id],
        facts: {
          reference: fields.reference,
          revision: fields.revision,
          requestedBy: fields.requestedBy,
          owner: fields.owner,
          candidate: fields.candidate,
          register: fields.register,
          service: fields.service,
          replaces: fields.replaces,
          supports: fields.supports,
          entities: fields.entityIds.join(", "),
          scopeEntities: fields.scopeEntityIds.join(", "),
          data: fields.data,
          start: fields.start,
          spend: fields.spend,
          proposal: fields.proposal,
          scopeNote: fields.scopeNote,
          documentDate: doc.documentDate,
        },
      },
    ],
    { asOf: doc.documentDate },
  );
});

/* ==========================================================================
   The third-party register
   ========================================================================== */

const LEGAL_FORMS = /\b(gmbh|ag|se|ltd|b\.?v\.?|s\.?r\.?o\.?|pvt|plc|sa|kg)\b/g;

/** The distinctive words of a company name: no legal form, no punctuation. */
function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(LEGAL_FORMS, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

/** A register entry whose distinctive name words include the candidate's first one, or the reverse. */
function sameName(a: string, b: string): boolean {
  const left = nameTokens(a);
  const right = nameTokens(b);
  const first = left[0];
  const otherFirst = right[0];
  return (first !== undefined && right.includes(first)) || (otherFirst !== undefined && left.includes(otherFirst));
}

registerSourceLoader("tprm.third-party-register", (context) => {
  const subjectId = context.run.subjectId;
  const subject = supplierRow(context.runId, subjectId);
  const supplierRows = getDb().select().from(suppliers).where(eq(suppliers.runId, context.runId)).all();
  const subprocessorRows = getDb().select().from(subprocessors).where(eq(subprocessors.runId, context.runId)).all();
  const doc = procurementRequestDoc(context);
  const fields = doc ? requestFields(doc) : null;
  const candidateName = subject?.name ?? fields?.candidate ?? subjectId;
  const registerNumber = fields?.register.split(",")[0]?.trim() ?? "";

  const others = supplierRows.filter((row) => row.id !== subjectId);
  const supplierMatches = others.filter(
    (row) => sameName(candidateName, row.name) || (registerNumber.length > 0 && row.description.includes(registerNumber)),
  );
  const subprocessorMatches = subprocessorRows.filter((row) => sameName(candidateName, row.name));

  const records: SourceRecord[] = [
    {
      id: "REGISTER-CHECK",
      label: candidateName,
      value:
        supplierMatches.length + subprocessorMatches.length === 0
          ? `no match among ${others.length} suppliers and ${subprocessorRows.length} subprocessors`
          : `${supplierMatches.length + subprocessorMatches.length} possible match(es)`,
      evidenceIds: doc ? [doc.id] : [],
      facts: {
        suppliers: others.length,
        subprocessors: subprocessorRows.length,
        matches: supplierMatches.length + subprocessorMatches.length,
        registerNumber,
      },
    },
    ...supplierMatches.map(
      (row): SourceRecord => ({
        id: row.id,
        label: row.name,
        value: "possible duplicate supplier",
        evidenceIds: [],
        facts: { relation: "duplicate", status: row.status, criticality: row.criticality, isOutsourcing: row.isOutsourcing },
      }),
    ),
    ...subprocessorMatches.map(
      (row): SourceRecord => ({
        id: row.id,
        label: row.name,
        value: `possible match, subprocessor of ${row.supplierId}`,
        evidenceIds: [],
        facts: { relation: "subprocessor-match", supplierId: row.supplierId },
      }),
    ),
  ];

  /* The supplier the request replaces, and every supplier of the business service it supports. */
  const replacedId = /\bTP-\d{4}\b/.exec(fields?.replaces ?? "")?.[0] ?? null;
  const supportedId = /\bIBS-\d{4}\b/.exec(fields?.supports ?? "")?.[0] ?? null;
  const supported = supportedId
    ? getDb().select().from(services).where(and(eq(services.runId, context.runId), eq(services.id, supportedId))).get()
    : undefined;
  const overlapIds = new Set<string>([...(replacedId ? [replacedId] : []), ...(supported?.supplierIds ?? [])]);
  for (const row of others.filter((candidate) => overlapIds.has(candidate.id))) {
    records.push({
      id: row.id,
      label: row.name,
      value: `${supported ? `serves ${supported.id}` : "service overlap"}, ${row.status}`,
      evidenceIds: [],
      facts: {
        relation: "service-overlap",
        replaced: row.id === replacedId,
        status: row.status,
        criticality: row.criticality,
        isOutsourcing: row.isOutsourcing,
        serviceId: supported?.id ?? null,
      },
    });
  }

  return sourceResult(records);
});

/* ==========================================================================
   The arrangement profile
   ========================================================================== */

/** The entities the file is in scope for: the supplier record, widened by what intake recorded. */
export function entitiesInScope(context: Pick<SourceLoaderContext, "runId" | "run">): string[] {
  const supplier = supplierRow(context.runId, context.run.subjectId);
  const intake = stageRecord(context.runId, context.run.id, "request-and-intake", "intake-record");
  const recorded = Array.isArray(intake?.entitiesInScope) ? (intake.entitiesInScope as string[]) : [];
  return orderEntities([...(supplier?.contractingEntityIds ?? []), ...recorded]);
}

registerSourceLoader("tprm.arrangement-profile", (context) => {
  const supplier = supplierRow(context.runId, context.run.subjectId);
  if (!supplier) return sourceResult([]);
  const doc = procurementRequestDoc(context);
  const fields = doc ? requestFields(doc) : null;
  const intake = stageRecord(context.runId, context.run.id, "request-and-intake", "intake-record");
  const records: SourceRecord[] = [];
  const evidence = doc ? [doc.id] : [];

  for (const service of servicesOf(context.runId, supplier.id)) {
    records.push({
      id: service.id,
      label: service.name,
      value: service.isImportantBusinessService ? "important business service" : "supporting service",
      evidenceIds: [],
      facts: { kind: "service", important: service.isImportantBusinessService, nameDe: service.nameDe, domain: service.domain },
    });
  }

  /* The business service the arrangement supports, from the request or the service description. */
  const supportedId =
    /\bIBS-\d{4}\b/.exec(fields?.supports ?? "")?.[0] ??
    /\bIBS-\d{4}\b/.exec(servicesOf(context.runId, supplier.id).map((service) => service.description).join(" "))?.[0] ??
    null;
  const supported = supportedId
    ? getDb().select().from(services).where(and(eq(services.runId, context.runId), eq(services.id, supportedId))).get()
    : undefined;
  if (supported) {
    records.push({
      id: supported.id,
      label: supported.name,
      value: supported.isImportantBusinessService ? "important business service" : "not an important business service",
      evidenceIds: evidence,
      facts: { kind: "supported", important: supported.isImportantBusinessService, nameDe: supported.nameDe },
    });
  }

  for (const entity of entityRefs(context.runId, entitiesInScope(context))) {
    records.push({
      id: entity.id,
      label: entity.name,
      value: entity.bloc === "ch" ? "Switzerland" : "European Union",
      evidenceIds: [],
      facts: { kind: "entity", bloc: entity.bloc },
    });
  }

  const data = typeof intake?.dataCategories === "string" && intake.dataCategories.length > 0 ? intake.dataCategories : (fields?.data ?? "");
  if (data.length > 0) {
    records.push({ id: "DATA-CATEGORIES", label: "Data categories", value: data, evidenceIds: evidence, facts: { kind: "data", text: data } });
  }

  records.push({
    id: "OWNER-PROPOSAL",
    label: "Business owner proposal",
    value: fields?.proposal || `${supplier.isOutsourcing ? "outsourcing" : "not an outsourcing"}; ${supplier.criticality} criticality`,
    evidenceIds: evidence,
    facts: {
      kind: "proposal",
      outsourcing: fields?.proposal ? !/not an outsourcing/i.test(fields.proposal) : supplier.isOutsourcing,
      criticality: /(critical|important|standard) criticality/i.exec(fields?.proposal ?? "")?.[1]?.toLowerCase() ?? supplier.criticality,
      fromRecord: !fields?.proposal,
    },
  });

  return sourceResult(records);
});

/* ==========================================================================
   The classification on record
   ========================================================================== */

registerSourceLoader("tprm.classification-record", (context) => {
  const memo = stageRecord(context.runId, context.run.id, "classification-and-criticality", "classification-memo");
  const judgment = (memo?.judgment ?? null) as Record<string, string> | null;
  if (judgment) {
    return sourceResult(
      ["classification", "materiality", "criticality", "review-depth"].map((key) => ({
        id: key.toUpperCase(),
        label: key,
        value: judgment[key] ?? "",
        evidenceIds: [],
        facts: { key, value: judgment[key] ?? "", recorded: true },
      })),
    );
  }
  const supplier = supplierRow(context.runId, context.run.subjectId);
  if (!supplier) return sourceResult([]);
  return sourceResult(
    [
      { id: "CLASSIFICATION", label: "classification", value: supplier.isOutsourcing ? "outsourcing" : "ict-service", evidenceIds: [], facts: { key: "classification", value: supplier.isOutsourcing ? "outsourcing" : "ict-service", recorded: false } },
      { id: "CRITICALITY", label: "criticality", value: supplier.criticality, evidenceIds: [], facts: { key: "criticality", value: supplier.criticality, recorded: false } },
    ],
    {
      note: {
        en: "This file was classified before the process engine recorded classifications. The supplier record holds the result.",
        de: "Diese Akte wurde eingestuft, bevor die Prozess-Engine Einstufungen erfasste. Der Lieferantendatensatz haelt das Ergebnis.",
      },
    },
  );
});

/* ==========================================================================
   The specialist review huddle
   ========================================================================== */

export interface HuddleRecord {
  meetingId: string;
  reference: string;
  title: string;
  titleDe: string;
  scheduledFor: string;
  held: boolean;
  heldAt: string | null;
  outcome: string;
  minutes: {
    id: string;
    status: string;
    summary: string;
    facts: string[];
    unresolved: string[];
    evidenceIds: string[];
    evidenceDocumentId: string | null;
  } | null;
}

/**
 * The meetings a stage of an onboarding file depends on, with their minutes.
 *
 * A clearly named read against `meetings` and `meeting_minutes`. The meeting
 * lifecycle of the Work Hub (`src/features/work/modules/meetings/`) owns
 * holding a meeting and confirming its minutes, and after a confirmation it
 * brings the stage the meeting serves up to date through the engine's
 * `syncStage`. Its own reads (`workingMinutes`, `loadMeetingLifecycle`) take
 * the whole hub's shared data, which a stage source has no reason to load,
 * so this reads the two rows it needs and uses the lifecycle's
 * `isConfirmedMinutes` for what "confirmed" means.
 *
 * A meeting belongs to the stage when the lifecycle linked it to this run and
 * stage (`process_run_id`, `stage_id`, from migration 0005). A meeting linked
 * to nothing counts when it is on the supplier and of a kind the role's Work
 * Hub configuration says serves this stage (for the Third-Party Risk Manager,
 * a supplier challenge or call for Evidence Review, a specialist review
 * huddle for Specialist Reviews). A meeting linked to another stage never
 * counts here. Latest first.
 */
export function readStageMeetings(params: {
  runId: string;
  processRunId: string;
  stageId: string;
  roleId: string;
  subjectId: string;
}): HuddleRecord[] {
  const config = getWorkRoleConfig(params.roleId as typeof meetings.$inferSelect.roleId);
  const kinds = Object.entries(config?.meetingTypes ?? {})
    .filter(([, type]) => type.processStageId === params.stageId)
    .map(([kind]) => kind);
  const rows = getDb()
    .select()
    .from(meetings)
    .where(and(eq(meetings.runId, params.runId), eq(meetings.roleId, params.roleId as typeof meetings.$inferSelect.roleId)))
    .all()
    .filter(
      (row) =>
        (row.processRunId === params.processRunId && row.stageId === params.stageId) ||
        (row.processRunId === null && row.subjectId === params.subjectId && kinds.includes(row.kind)),
    )
    .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));
  return rows.map((row) => {
    const minutes = getDb()
      .select()
      .from(meetingMinutes)
      .where(and(eq(meetingMinutes.runId, params.runId), eq(meetingMinutes.meetingId, row.id)))
      .all()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return {
      meetingId: row.id,
      reference: row.reference,
      title: row.title,
      titleDe: row.titleDe || row.title,
      scheduledFor: row.scheduledFor,
      held: row.status === "concluded",
      heldAt: row.heldAt ?? row.concludedAt ?? null,
      outcome: row.outcome,
      minutes: minutes
        ? {
            id: minutes.id,
            status: minutes.status,
            summary: minutes.summary,
            facts: minutes.factItems,
            unresolved: minutes.unresolvedItems,
            evidenceIds: minutes.evidenceIds,
            evidenceDocumentId: minutes.evidenceDocumentId ?? null,
          }
        : null,
    };
  });
}

/** The specialist review huddles of the file: the meetings its Stage 5 depends on. */
export function readSpecialistHuddles(runId: string, processRunId: string, roleId: string, supplierId: string): HuddleRecord[] {
  return readStageMeetings({ runId, processRunId, stageId: "specialist-reviews", roleId, subjectId: supplierId });
}

/** Source records for meetings: one for the meeting, one for its minutes when there are any. */
function meetingRecords(huddles: readonly HuddleRecord[]): SourceRecord[] {
  const records: SourceRecord[] = [];
  for (const huddle of huddles) {
    records.push({
      id: huddle.meetingId,
      label: huddle.title,
      value: huddle.held ? `held ${formatDate(huddle.heldAt ?? huddle.scheduledFor)}` : `scheduled ${formatDate(huddle.scheduledFor)}`,
      evidenceIds: [],
      facts: { kind: "meeting", held: huddle.held, scheduledFor: huddle.scheduledFor, titleDe: huddle.titleDe, outcome: huddle.outcome },
    });
    if (huddle.minutes) {
      /* "Confirmed" means what the meeting lifecycle means by it: confirmed or distributed. */
      const confirmed = isConfirmedMinutes(huddle.minutes);
      records.push({
        id: huddle.minutes.id,
        label: "Minutes",
        value: confirmed ? huddle.minutes.status : `${huddle.minutes.status}, not confirmed`,
        evidenceIds: huddle.minutes.evidenceDocumentId ? [huddle.minutes.evidenceDocumentId] : [],
        facts: {
          kind: "minutes",
          meetingId: huddle.meetingId,
          status: huddle.minutes.status,
          confirmed,
          unresolved: huddle.minutes.unresolved.join("; "),
        },
      });
    }
  }
  return records;
}

registerSourceLoader("tprm.specialist-huddle", (context) => {
  const huddles = readSpecialistHuddles(context.runId, context.run.id, context.run.roleId, context.run.subjectId);
  if (huddles.length === 0) {
    return sourceResult([], {
      note: {
        en: "No specialist review huddle is scheduled or held for this supplier. Positions come from the written opinions.",
        de: "Fuer diesen Lieferanten ist keine Fachabstimmung geplant oder abgehalten. Die Positionen stammen aus den schriftlichen Stellungnahmen.",
      },
    });
  }
  return sourceResult(meetingRecords(huddles));
});

/** The supplier meetings the current stage depends on, for example the evidence calls of Stage 4. */
registerSourceLoader("tprm.stage-meetings", (context) => {
  const held = readStageMeetings({ runId: context.runId, processRunId: context.run.id, stageId: context.stage.id, roleId: context.run.roleId, subjectId: context.run.subjectId });
  if (held.length === 0) {
    return sourceResult([], {
      note: {
        en: "No supplier meeting is linked to this stage.",
        de: "Mit dieser Stufe ist keine Lieferantenbesprechung verknuepft.",
      },
    });
  }
  return sourceResult(meetingRecords(held));
});

/* ==========================================================================
   The onboarding file
   ========================================================================== */

registerSourceLoader("tprm.onboarding-file", (context) => {
  const records: SourceRecord[] = [];
  for (const row of completedStages(context.runId, context.run.id)) {
    const stage = TPRM_ONBOARDING_PROCESS.stages.find((candidate) => candidate.id === row.stageId);
    if (!stage) continue;
    const recordKey = stage.artifacts.find((artifact) => artifact.producedBy === "stage-completion")?.key ?? "";
    const stored = recordKey ? stageRecord(context.runId, context.run.id, stage.id, recordKey) !== null : false;
    records.push({
      id: `STAGE-${stage.sequence}`,
      label: `Stage ${stage.sequence} ${stage.name}`,
      value: `completed ${formatDate(row.completedAt)}${stored ? ", record stored" : ", before the process engine"}`,
      evidenceIds: [],
      facts: { kind: "stage", stageId: stage.id, sequence: stage.sequence, stored, completedAt: row.completedAt, nameDe: stage.nameDe },
    });
  }
  for (const action of openActionsFor(context.runId, context.run.subjectId)) {
    records.push({
      id: action.id,
      label: action.title,
      value: `${action.status}${action.dueOn ? `, due ${formatDate(action.dueOn)}` : ""}`,
      evidenceIds: [],
      facts: { kind: "condition", status: action.status, dueOn: action.dueOn, actionKind: action.kind, sourceStageId: action.sourceStageId ?? null },
    });
  }
  for (const monitoring of monitoringFor(context.runId, context.run.subjectId)) {
    records.push({
      id: monitoring.id,
      label: monitoring.description,
      value: `active, ${monitoring.reviewFrequency}${monitoring.nextReviewOn ? `, next ${formatDate(monitoring.nextReviewOn)}` : ""}`,
      evidenceIds: [],
      facts: { kind: "monitoring", frequency: monitoring.reviewFrequency, nextReviewOn: monitoring.nextReviewOn, monitoringKind: monitoring.kind },
    });
  }
  return sourceResult(records);
});
