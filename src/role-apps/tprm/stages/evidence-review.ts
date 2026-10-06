/**
 * TPRM Stage 4, Evidence Review: the reference implementation.
 *
 * The pattern the remaining onboarding stages copy. Registered under the keys
 * the stage contract names:
 *
 *   four source loaders    the requested due diligence evidence, the
 *                          supplier and service record, the draft contract
 *                          conditions, and the specialist review status
 *                          (the supplier meetings linked to the stage are
 *                          read by `tprm.stage-meetings` in `./sources.ts`)
 *   one preparer           extraction, comparison, stale evidence,
 *                          contradictions, requirement mapping and gap
 *                          statements, composed from the loaded documents
 *   one task form          the evidence dispositions: no item unreviewed
 *   decision rules         a pass needs nothing outstanding; a conditional
 *                          pass needs something to condition
 *   two payload builders   the local condition action and its GRC record
 *   one artifact builder   the Stage 4 evidence review record
 *
 * The comparison rules read the documents' own text. They are deliberately
 * narrow: each one fires only on a specific, checkable statement in a loaded
 * document, and cites both documents it compares. They are a deterministic
 * reading of the evidence, labelled as such, not a judgment about it.
 *
 * Synthetic institution and data.
 */

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { contractObligations, contracts, services, suppliers } from "@/db/schema/domain";
import type { Bilingual } from "@/role-apps/contracts";
import { formatDate, revealedEvidence, unique, type EvidenceRow } from "@/role-apps/stage-support";
import {
  registerArtifactBuilder,
  registerDecisionRules,
  registerPayloadBuilder,
  registerPreparer,
  registerSourceLoader,
  registerTaskForm,
  type SourceLoaderContext,
} from "@/features/process/registry";
import type { SourceLoadResult, SourceRecord, StageContext } from "@/features/process/types";
import type { StagePreparationOutput } from "@/features/process/preparation-schema";
import { recordedTaskOutput } from "@/features/process/tasks";
import { findTask, parseTaskOutput, type ToolTaskOutput } from "@/features/process/derive";
import { taskKey } from "@/features/process/keys";
import { lineageOf, stageRecord } from "./shared";

const PROCESS_ID = "tprm-third-party-onboarding";
const STAGE_ID = "evidence-review";
const EVIDENCE_TYPES = ["supplier-due-diligence", "bcm-test"];

/* ==========================================================================
   Source loaders
   ========================================================================== */

/**
 * The requested evidence items for the supplier: due diligence documents that
 * are not working drafts.
 *
 * After Stage 3, a document whose template part the person removed as not
 * relevant is withdrawn from the review: the tailored request said it is not
 * asked for, so it is not an item to disposition. Stage 3 itself still sees
 * it, because removing it is the decision Stage 3 records.
 */
function evidenceItems(context: SourceLoaderContext): EvidenceRow[] {
  const tailoring = context.stage.sequence > 3 ? stageRecord(context.runId, context.run.id, "tailored-due-diligence", "evidence-request-list") : null;
  const withdrawn = new Set(Array.isArray(tailoring?.removedDocumentIds) ? (tailoring.removedDocumentIds as string[]) : []);
  return revealedEvidence(context.runId, context.state).filter(
    (doc) =>
      doc.relatedObjectIds.includes(context.run.subjectId) &&
      EVIDENCE_TYPES.includes(doc.sourceType) &&
      doc.status !== "draft" &&
      !withdrawn.has(doc.id),
  );
}

function result(records: SourceRecord[], extra: Partial<SourceLoadResult> = {}): SourceLoadResult {
  return {
    status: records.length === 0 ? "empty" : "loaded",
    records,
    evidenceIds: unique(records.flatMap((record) => record.evidenceIds)),
    asOf: null,
    note: null,
    ...extra,
  };
}

/** "APPROVED WITH CONDITION" in an authored summary marks a conditional acceptance. */
function hasCondition(doc: EvidenceRow): boolean {
  const text = doc.summary.toUpperCase();
  return text.includes("WITH CONDITION") || text.includes("APPROVED WITH");
}

const EXPECTED = /Expected by (\d{2}\.\d{2}\.\d{4})/;
const CHASED = /[Cc]hase(?:d| message sent) (?:on )?(\d{2}\.\d{2}\.\d{4})/;

registerSourceLoader("tprm.due-diligence-evidence", (context) => {
  const records = evidenceItems(context).map((doc): SourceRecord => {
    const received = doc.status === "current";
    return {
      id: doc.id,
      label: doc.title,
      value: received ? (hasCondition(doc) ? "received, condition" : "received") : doc.status,
      evidenceIds: [doc.id],
      facts: {
        status: doc.status,
        titleDe: doc.titleDe,
        received,
        condition: received && hasCondition(doc),
        provenance: doc.provenance,
        documentDate: doc.documentDate,
        ingestedAt: doc.ingestedAt.slice(0, 10),
        requestedOn: doc.requestedOn,
        requestedFrom: doc.requestedFromLabel,
        expectedBy: EXPECTED.exec(doc.body)?.[1] ?? null,
        chasedOn: CHASED.exec(doc.body)?.[1] ?? null,
        isStale: doc.isStale,
        stalenessNote: doc.stalenessNote,
      },
    };
  });
  const latest = records.map((record) => String(record.facts?.ingestedAt ?? "")).sort().at(-1) ?? null;
  return result(records, { asOf: latest });
});

registerSourceLoader("tprm.supplier-record", (context) => {
  const supplier = getDb()
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.runId, context.runId), eq(suppliers.id, context.run.subjectId)))
    .get();
  if (!supplier) return result([]);
  const serviceRows = getDb()
    .select()
    .from(services)
    .where(eq(services.runId, context.runId))
    .all()
    .filter((service) => service.supplierIds.includes(supplier.id));
  return result([
    {
      id: supplier.id,
      label: supplier.name,
      value: `${supplier.criticality}, ${supplier.isOutsourcing ? "outsourcing" : "ICT service"} proposed`,
      evidenceIds: [],
      facts: {
        criticality: supplier.criticality,
        isOutsourcing: supplier.isOutsourcing,
        entities: supplier.contractingEntityIds.join(", "),
        status: supplier.status,
      },
    },
    ...serviceRows.map(
      (service): SourceRecord => ({
        id: service.id,
        label: service.name,
        value: service.isImportantBusinessService ? "important business service" : "supporting service",
        evidenceIds: [],
        facts: { important: service.isImportantBusinessService, nameDe: service.nameDe },
      }),
    ),
  ]);
});

registerSourceLoader("tprm.contract-conditions", (context) => {
  const contract = getDb()
    .select()
    .from(contracts)
    .where(and(eq(contracts.runId, context.runId), eq(contracts.supplierId, context.run.subjectId)))
    .get();
  if (!contract) return result([]);
  const obligations = getDb()
    .select()
    .from(contractObligations)
    .where(and(eq(contractObligations.runId, context.runId), eq(contractObligations.contractId, contract.id)))
    .all();
  return result(
    obligations.map(
      (obligation): SourceRecord => ({
        id: obligation.id,
        label: obligation.clauseReference,
        value: obligation.note.toUpperCase().includes("CONDITION OUTSTANDING") ? "condition outstanding" : obligation.evidenceStatus,
        evidenceIds: obligation.evidenceDocumentIds,
        facts: {
          contractId: contract.id,
          category: obligation.category,
          evidenceStatus: obligation.evidenceStatus,
          outstanding: obligation.note.toUpperCase().includes("CONDITION OUTSTANDING"),
          text: obligation.obligationText,
        },
      }),
    ),
  );
});

registerSourceLoader("tprm.specialist-status", (context) => {
  const docs = revealedEvidence(context.runId, context.state).filter(
    (doc) => doc.relatedObjectIds.includes(context.run.subjectId) && doc.authorLabel.startsWith("Group"),
  );
  return result(
    docs.map((doc): SourceRecord => {
      const text = doc.summary.toUpperCase();
      const status = doc.status === "draft" || text.includes("PENDING") ? "pending" : hasCondition(doc) ? "approved with condition" : text.includes("APPROVED") ? "approved" : doc.status;
      return {
        id: doc.id,
        label: doc.authorLabel,
        value: status,
        evidenceIds: [doc.id],
        facts: { status, function: doc.authorLabel },
      };
    }),
  );
});

/* ==========================================================================
   The preparer
   ========================================================================== */

type Sources = StageContext["sources"];

function recordsOf(sources: Sources, key: string): SourceRecord[] {
  return sources.find((source) => source.spec.key === key)?.result.records ?? [];
}

function docBodies(context: StageContext, ids: readonly string[]): EvidenceRow[] {
  const wanted = new Set(ids);
  return revealedEvidence(context.runId, context.state).filter((doc) => wanted.has(doc.id));
}

function joinIds(ids: readonly string[], conjunction: string): string {
  if (ids.length <= 1) return ids.join("");
  return `${ids.slice(0, -1).join(", ")} ${conjunction} ${ids[ids.length - 1]}`;
}

const MONTHS: Record<string, string> = {
  January: "01", February: "02", March: "03", April: "04", May: "05", June: "06",
  July: "07", August: "08", September: "09", October: "10", November: "11", December: "12",
};

/** The comparison rules. Each returns nothing unless its specific statements are present. */
function compareDocuments(context: StageContext, sources: Sources): {
  contradictions: StagePreparationOutput["contradictions"];
  gaps: StagePreparationOutput["gaps"];
} {
  const contradictions: StagePreparationOutput["contradictions"] = [];
  const gaps: StagePreparationOutput["gaps"] = [];
  const evidence = recordsOf(sources, "due-diligence-evidence");
  const docs = docBodies(context, evidence.map((record) => record.id));

  /* Data residency: a clause limited to two countries against a backup site elsewhere. */
  const residency = recordsOf(sources, "contract-conditions").find((record) =>
    /within Germany and Austria/i.test(String(record.facts?.text ?? "")),
  );
  const netherlands = docs.filter((doc) => /Netherlands/.test(doc.body));
  if (residency && netherlands.length >= 2) {
    contradictions.push({
      statement: {
        en: `The draft residency clause (${residency.label}) limits processing to Germany and Austria, while ${joinIds(netherlands.map((doc) => doc.id), "and")} describe a backup facility in the Netherlands.`,
        de: `Die Entwurfsklausel zur Datenlokalisierung (${residency.id}) begrenzt die Verarbeitung auf Deutschland und Oesterreich, waehrend ${joinIds(netherlands.map((doc) => doc.id), "und")} einen Sicherungsstandort in den Niederlanden beschreiben.`,
      },
      evidenceIds: netherlands.map((doc) => doc.id).slice(0, 4),
    });
  }

  /* Subprocessors: an operator of the backup infrastructure that the list does not name. */
  const questionnaire = docs.find((doc) => /SECTION 5: SUBPROCESSORS/.test(doc.body));
  const section = questionnaire?.body.split(/SECTION 5: SUBPROCESSORS/)[1]?.split(/SECTION 6/)[0] ?? "";
  if (questionnaire && section.length > 0) {
    const unlisted = new Map<string, string>();
    for (const doc of docs) {
      if (doc.id === questionnaire.id) continue;
      for (const match of doc.body.matchAll(/operated by ([A-Z][A-Za-z ]+?(?:Ltd|GmbH|AG))\b/g)) {
        const operator = match[1];
        if (operator && !section.includes(operator) && !unlisted.has(operator)) unlisted.set(operator, doc.id);
      }
    }
    for (const [operator, sourceId] of unlisted) {
      contradictions.push({
        statement: {
          en: `${questionnaire.id} lists the subprocessors with access to Arcadia data and does not name ${operator}, while ${sourceId} states that ${operator} operates part of the infrastructure.`,
          de: `${questionnaire.id} fuehrt die Unterauftragnehmer mit Zugriff auf Arcadia-Daten auf und nennt ${operator} nicht, waehrend ${sourceId} angibt, dass ${operator} einen Teil der Infrastruktur betreibt.`,
        },
        evidenceIds: [questionnaire.id, sourceId],
      });
    }
  }

  /* Report dating: an attestation dated before the end of the period it covers. */
  for (const doc of docs) {
    const period = /Reporting period: (\d{2}) (\w+) (\d{4}) to (\d{2}) (\w+) (\d{4})/.exec(doc.body);
    if (!period) continue;
    const end = `${period[6]}-${MONTHS[period[5] ?? ""] ?? "00"}-${period[4]}`;
    if (doc.documentDate < end) {
      gaps.push({
        key: `dating-${doc.id}`,
        statement: {
          en: `${doc.id} is dated ${formatDate(doc.documentDate)}, before the end of the period it reports on (${formatDate(end)}). Ask the supplier to confirm the report date before relying on its period.`,
          de: `${doc.id} ist auf den ${formatDate(doc.documentDate)} datiert, vor dem Ende des berichteten Zeitraums (${formatDate(end)}). Lassen Sie das Berichtsdatum vom Lieferanten bestaetigen, bevor Sie sich auf den Zeitraum stuetzen.`,
        },
        evidenceIds: [doc.id],
        severity: "minor",
      });
    }
  }

  return { contradictions, gaps };
}

function composeEvidenceReview(input: { context: StageContext; sources: Sources }): StagePreparationOutput {
  const { context, sources } = input;
  const items = recordsOf(sources, "due-diligence-evidence");
  const supplier = recordsOf(sources, "supplier-record")[0];
  const supplierName = supplier?.label ?? context.run.subjectId;

  const received = items.filter((item) => item.facts?.received === true);
  const outstanding = items.filter((item) => item.facts?.received !== true);
  const conditional = received.filter((item) => item.facts?.condition === true);

  const findings: StagePreparationOutput["findings"] = items.map((item) => {
    const facts = item.facts ?? {};
    const titleDe = String(facts.titleDe || item.label);
    if (facts.received) {
      const basis = facts.provenance === "approved-record" ? "approved-record" : "stakeholder-statement";
      return {
        sourceKey: "due-diligence-evidence",
        statement: {
          en: `${item.id} ${item.label}: received ${formatDate(String(facts.ingestedAt))} as ${basis === "approved-record" ? "an approved record" : "a supplier statement"}${facts.condition ? ", with a specialist condition attached" : ""}.`,
          de: `${item.id} ${titleDe}: eingegangen am ${formatDate(String(facts.ingestedAt))} als ${basis === "approved-record" ? "genehmigter Datensatz" : "Aussage des Lieferanten"}${facts.condition ? ", mit einer Bedingung des Fachbereichs" : ""}.`,
        },
        evidenceIds: [item.id],
        basis,
      };
    }
    return {
      sourceKey: "due-diligence-evidence",
      statement: {
        en: `${item.id} ${item.label}: ${facts.status} on ${formatDate(String(facts.requestedOn ?? ""))}${facts.requestedFrom ? ` from ${facts.requestedFrom}` : ""}, not received.`,
        de: `${item.id} ${titleDe}: am ${formatDate(String(facts.requestedOn ?? ""))} angefordert${facts.requestedFrom ? ` bei ${facts.requestedFrom}` : ""}, nicht eingegangen.`,
      },
      evidenceIds: [item.id],
      basis: "stakeholder-statement",
    };
  });

  for (const specialist of recordsOf(sources, "specialist-status")) {
    const status = String(specialist.facts?.status ?? "");
    const statusDe = status === "pending" ? "ausstehend" : status === "approved with condition" ? "genehmigt mit Bedingung" : status === "approved" ? "genehmigt" : status;
    findings.push({
      sourceKey: "specialist-status",
      statement: {
        en: `${specialist.label}: ${status}.`,
        de: `${specialist.label}: ${statusDe}.`,
      },
      evidenceIds: specialist.evidenceIds,
      basis: status === "pending" ? "stakeholder-statement" : "approved-record",
    });
  }

  /* Supplier meetings the stage depends on, from the meeting lifecycle's record. */
  const meetingRows = recordsOf(sources, "stage-meetings");
  for (const meeting of meetingRows.filter((record) => record.facts?.kind === "meeting")) {
    const minutes = meetingRows.find((record) => record.facts?.kind === "minutes" && record.facts?.meetingId === meeting.id);
    const held = meeting.facts?.held === true;
    findings.push({
      sourceKey: "stage-meetings",
      statement: {
        en: `Meeting ${meeting.id} ${meeting.label}: ${meeting.value}; minutes ${minutes ? minutes.value : "not drafted"}.`,
        de: `Besprechung ${meeting.id} ${String(meeting.facts?.titleDe || meeting.label)}: ${held ? "abgehalten" : "geplant"}; Protokoll ${minutes ? (minutes.facts?.confirmed ? "bestaetigt" : "Entwurf, nicht bestaetigt") : "nicht erstellt"}.`,
      },
      evidenceIds: minutes?.evidenceIds ?? [],
      basis: minutes?.facts?.confirmed ? "approved-record" : "stakeholder-statement",
    });
  }

  const openConditions = recordsOf(sources, "contract-conditions").filter((record) => record.facts?.outstanding === true);
  if (openConditions.length > 0) {
    findings.push({
      sourceKey: "contract-conditions",
      statement: {
        en: `The draft contract has ${openConditions.length} condition(s) outstanding: ${openConditions.map((record) => record.label).join("; ")}.`,
        de: `Der Vertragsentwurf hat ${openConditions.length} offene Bedingungen: ${openConditions.map((record) => record.id).join(", ")}.`,
      },
      evidenceIds: unique(openConditions.flatMap((record) => record.evidenceIds)).slice(0, 4),
      basis: "approved-record",
    });
  }

  const compared = compareDocuments(context, sources);
  const gaps: StagePreparationOutput["gaps"] = [
    ...outstanding.map((item) => {
      const facts = item.facts ?? {};
      const expected = facts.expectedBy ? String(facts.expectedBy) : null;
      const chased = facts.chasedOn ? String(facts.chasedOn) : null;
      return {
        key: `outstanding-${item.id}`,
        statement: {
          en: `${item.id} is outstanding${expected ? `, expected by ${expected}` : ""}${chased ? `, last chased ${chased}` : ""}. The gate cannot pass without it unless it becomes a dated condition.`,
          de: `${item.id} steht aus${expected ? `, erwartet bis ${expected}` : ""}${chased ? `, zuletzt nachgefasst am ${chased}` : ""}. Das Tor kann ohne diesen Nachweis nur mit einer datierten Bedingung passiert werden.`,
        },
        evidenceIds: [item.id],
        severity: "material" as const,
      };
    }),
    ...compared.gaps,
    /* Stale evidence: received, but older than the standard allows. */
    ...received
      .filter((item) => item.facts?.isStale === true)
      .map((item) => ({
        key: `stale-${item.id}`,
        statement: {
          en: `${item.id} is received but stale: ${String(item.facts?.stalenessNote || "older than the group standard allows")}. Accept it only with a condition for a current one.`,
          de: `${item.id} ist eingegangen, aber veraltet: aelter, als der Konzernstandard erlaubt. Akzeptieren Sie es nur mit der Bedingung eines aktuellen Nachweises.`,
        },
        evidenceIds: [item.id],
        severity: "material" as const,
      })),
    /* What a supplier meeting left unresolved, as its minutes record it. */
    ...recordsOf(sources, "stage-meetings")
      .filter((record) => record.facts?.kind === "minutes" && String(record.facts?.unresolved ?? "").length > 0)
      .map((record) => ({
        key: `unresolved-${record.id}`,
        statement: {
          en: `Unresolved at ${String(record.facts?.meetingId)}: ${String(record.facts?.unresolved)}.`,
          de: `Offen aus ${String(record.facts?.meetingId)} (Wortlaut des Protokolls): ${String(record.facts?.unresolved)}.`,
        },
        evidenceIds: record.evidenceIds,
        severity: "minor" as const,
      })),
  ];

  const pending = recordsOf(sources, "specialist-status").filter((record) => record.facts?.status === "pending");
  const limitations: StagePreparationOutput["limitations"] = [
    {
      en: "Specialist conclusions are read from their own status notes. This preparation does not substitute for any specialist review.",
      de: "Ergebnisse der Fachbereiche werden aus deren Statusvermerken gelesen. Diese Vorbereitung ersetzt keine Fachpruefung.",
    },
  ];
  if (pending.length > 0) {
    limitations.push({
      en: `${pending.map((record) => record.label).join(", ")} is still pending, so its conditions are not yet known.`,
      de: `${pending.map((record) => record.label).join(", ")} steht noch aus; die Bedingungen sind noch nicht bekannt.`,
    });
  }

  const itemAssessments: StagePreparationOutput["itemAssessments"] = items.map((item) => {
    const facts = item.facts ?? {};
    if (!facts.received) {
      return {
        itemId: item.id,
        proposedDisposition: "outstanding",
        note: {
          en: `Record as outstanding${facts.expectedBy ? ` with a chase date of ${facts.expectedBy}` : ""}.`,
          de: `Als ausstehend erfassen${facts.expectedBy ? `, Nachfasstermin ${facts.expectedBy}` : ""}.`,
        },
      };
    }
    if (facts.condition) {
      return {
        itemId: item.id,
        proposedDisposition: "accept-with-condition",
        note: { en: "Accept with the specialist condition recorded on the item.", de: "Mit der Bedingung des Fachbereichs akzeptieren." },
      };
    }
    if (facts.isStale) {
      return {
        itemId: item.id,
        proposedDisposition: "accept-with-condition",
        note: { en: "Accept with a condition: a current version is requested.", de: "Mit Bedingung akzeptieren: eine aktuelle Fassung wird angefordert." },
      };
    }
    return {
      itemId: item.id,
      proposedDisposition: "accept",
      note: { en: "Accept; the document is current.", de: "Akzeptieren; das Dokument ist aktuell." },
    };
  });

  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `${received.length} of ${items.length} requested evidence items for ${supplierName} are received and ${outstanding.length} are outstanding${outstanding.length > 0 ? ` (${outstanding.map((item) => item.id).join(", ")})` : ""}. ${conditional.length} received item(s) carry a specialist condition, and ${compared.contradictions.length} contradiction(s) between documents need a view before the gate.`,
      de: `${received.length} von ${items.length} angeforderten Nachweisen zu ${supplierName} sind eingegangen, ${outstanding.length} stehen aus${outstanding.length > 0 ? ` (${outstanding.map((item) => item.id).join(", ")})` : ""}. ${conditional.length} eingegangene Nachweise tragen eine Bedingung, und ${compared.contradictions.length} Widersprueche zwischen Dokumenten brauchen vor dem Tor eine Einschaetzung.`,
    },
    findings,
    inferences: [],
    contradictions: compared.contradictions,
    gaps,
    itemAssessments,
    proposals:
      outstanding.length > 0
        ? [
            {
              toolKey: "record-conditions",
              rationale: {
                en: "A conditional pass needs each outstanding item recorded as a dated condition with an owner.",
                de: "Ein bedingtes Passieren braucht jeden ausstehenden Nachweis als datierte Bedingung mit Verantwortung.",
              },
            },
            {
              toolKey: "register-conditions",
              rationale: {
                en: "The GRC platform is the system of record for onboarding conditions.",
                de: "Das GRC-System ist das fuehrende System fuer Onboarding-Bedingungen.",
              },
            },
          ]
        : [],
    recommendedOptionId: outstanding.length > 0 ? "gate-conditional" : "gate-pass",
    limitations,
  };
}

const PROMPT = `You prepare Stage 4 (Evidence Review) of a third-party onboarding for a Third-Party Risk Manager at a synthetic bank.
Use only the source records provided. For every requested evidence item, propose a disposition (accept, accept-with-condition, outstanding, reject) with a short note; the person decides. Compare documents for contradictions and cite both. State gaps with dates where the records give them.
Never decide the stage gate. Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("tprm.evidence-review", {
  compose: (input) => composeEvidenceReview(input),
  prompt: ({ context, sources }) => ({
    instructions: PROMPT,
    input: JSON.stringify({
      supplier: context.run.subjectId,
      stage: context.stage.name,
      sources: sources.map((source) => ({
        key: source.spec.key,
        status: source.status,
        records: source.result.records.map((record) => ({ id: record.id, label: record.label, value: record.value, evidenceIds: record.evidenceIds, facts: record.facts })),
      })),
      decisionOptions: ["gate-pass", "gate-conditional", "gate-hold"],
      tools: context.stage.tools.map((tool) => tool.key),
    }),
  }),
  itemIds: ({ sources }) => recordsOf(sources, "due-diligence-evidence").map((record) => record.id),
});

/* ==========================================================================
   The evidence dispositions task form
   ========================================================================== */

const DISPOSITIONS = ["accept", "accept-with-condition", "outstanding", "reject"] as const;
type Disposition = (typeof DISPOSITIONS)[number];

const dispositionsSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        disposition: z.enum(DISPOSITIONS, { message: "Every evidence item needs a disposition." }),
        note: z.string().max(600),
        chaseDate: z.string().max(10),
      }),
    )
    .min(1),
});
type DispositionsInput = z.infer<typeof dispositionsSchema>;

function itemIdsInScope(context: StageContext): string[] {
  return recordsOf(context.sources, "due-diligence-evidence").map((record) => record.id);
}

const DISPOSITION_LABELS: Record<Disposition, Bilingual> = {
  accept: { en: "accepted", de: "akzeptiert" },
  "accept-with-condition": { en: "accepted with condition", de: "mit Bedingung akzeptiert" },
  outstanding: { en: "outstanding", de: "ausstehend" },
  reject: { en: "rejected", de: "abgelehnt" },
};

/** The choices as the person makes them. `DISPOSITION_LABELS` is the recorded form. */
const CHOICE_LABELS: Record<Disposition, Bilingual> = {
  accept: { en: "Accept", de: "Akzeptieren" },
  "accept-with-condition": { en: "Accept with condition", de: "Mit Bedingung akzeptieren" },
  outstanding: { en: "Outstanding", de: "Ausstehend" },
  reject: { en: "Reject", de: "Ablehnen" },
};

/**
 * The proposed chase date for an item not received: the supplier's own
 * expected date where the request log states one, and otherwise three days
 * out. A starting value in the form, never a recorded commitment.
 */
function proposedChase(context: StageContext, facts: Record<string, unknown>): string {
  if (facts.received === true) return "";
  if (facts.expectedBy) return toIsoDate(String(facts.expectedBy));
  const fallback = new Date(`${context.state.scenarioDate}T00:00:00.000Z`);
  fallback.setUTCDate(fallback.getUTCDate() + 3);
  return fallback.toISOString().slice(0, 10);
}

/** "09.10.2026" to "2026-10-09"; an ISO date passes through. */
function toIsoDate(value: string): string {
  const german = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  return german ? `${german[3]}-${german[2]}-${german[1]}` : value.trim();
}

registerTaskForm<DispositionsInput>("tprm.evidence-dispositions", {
  schema: dispositionsSchema,
  fields: (context, language, current) => {
    const proposals = context.preparation.output?.itemAssessments ?? [];
    return {
      rows: recordsOf(context.sources, "due-diligence-evidence").map((record) => {
        const entry = current?.items.find((item) => item.itemId === record.id);
        const proposal = proposals.find((assessment) => assessment.itemId === record.id);
        const facts = record.facts ?? {};
        const received = facts.received === true;
        const status = received
          ? language === "de"
            ? `Eingegangen ${formatDate(String(facts.ingestedAt))}`
            : `Received ${formatDate(String(facts.ingestedAt))}`
          : language === "de"
            ? `Angefordert ${formatDate(String(facts.requestedOn ?? ""))}, nicht eingegangen`
            : `Requested ${formatDate(String(facts.requestedOn ?? ""))}, not received`;
        const hint = proposal ? (language === "de" ? proposal.note.de : proposal.note.en) : null;
        return {
          id: record.id,
          label: `${record.id} ${language === "de" ? String(facts.titleDe || record.label) : record.label}`,
          detail: hint ? `${status}. ${language === "de" ? "KI-Vorschlag" : "AI proposal"}: ${hint}` : status,
          choice: {
            name: `disposition:${record.id}`,
            options: DISPOSITIONS.map((value) => ({ value, label: language === "de" ? CHOICE_LABELS[value].de : CHOICE_LABELS[value].en })),
            value: entry?.disposition ?? "",
          },
          note: {
            name: `note:${record.id}`,
            value: entry?.note ?? "",
            placeholder: language === "de" ? "Bedingung oder Begruendung" : "Condition or reason",
          },
          date: {
            name: `chase:${record.id}`,
            value: entry?.chaseDate ?? proposedChase(context, facts),
            label: language === "de" ? "Nachfassen am" : "Chase by",
          },
        };
      }),
      overall: null,
    };
  },
  fromFormData: (data, context) => ({
    items: itemIdsInScope(context).map((itemId) => ({
      itemId,
      disposition: String(data.get(`disposition:${itemId}`) ?? ""),
      note: String(data.get(`note:${itemId}`) ?? "").trim(),
      chaseDate: toIsoDate(String(data.get(`chase:${itemId}`) ?? "")),
    })),
  }),
  validate: (context, input) => {
    const problems: Bilingual[] = [];
    const inScope = itemIdsInScope(context);
    for (const itemId of inScope) {
      if (!input.items.some((item) => item.itemId === itemId)) {
        problems.push({ en: `${itemId} has no disposition.`, de: `${itemId} hat keine Bewertung.` });
      }
    }
    for (const item of input.items) {
      if (item.disposition === "outstanding") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(item.chaseDate)) {
          problems.push({ en: `${item.itemId} is outstanding and needs a chase date.`, de: `${item.itemId} steht aus und braucht einen Nachfasstermin.` });
        } else if (item.chaseDate < context.state.scenarioDate) {
          problems.push({ en: `The chase date for ${item.itemId} is in the past.`, de: `Der Nachfasstermin fuer ${item.itemId} liegt in der Vergangenheit.` });
        }
      }
      if ((item.disposition === "reject" || item.disposition === "accept-with-condition") && item.note.length < 10) {
        problems.push({
          en: `${item.itemId} needs ${item.disposition === "reject" ? "the reason for rejection" : "the condition"} written out.`,
          de: `Zu ${item.itemId} fehlt ${item.disposition === "reject" ? "die Begruendung der Ablehnung" : "die Bedingung"}.`,
        });
      }
    }
    return problems;
  },
  defaults: (context) => {
    const output = context.preparation.output;
    if (!output) return null;
    return {
      items: itemIdsInScope(context).map((itemId) => {
        const proposal = output.itemAssessments.find((assessment) => assessment.itemId === itemId);
        const facts = recordsOf(context.sources, "due-diligence-evidence").find((record) => record.id === itemId)?.facts ?? {};
        const disposition = (proposal?.proposedDisposition ?? "accept") as Disposition;
        return {
          itemId,
          disposition,
          // The AI's note is help text, not the person's note: it is not carried into the record.
          note: "",
          chaseDate: disposition === "outstanding" ? proposedChase(context, facts) : "",
        };
      }),
    };
  },
  summarise: (_context, input) =>
    input.items.map((item) => {
      const label = DISPOSITION_LABELS[item.disposition];
      const chase = item.disposition === "outstanding" ? ` (chase ${formatDate(item.chaseDate)})` : "";
      const chaseDe = item.disposition === "outstanding" ? ` (Nachfassen ${formatDate(item.chaseDate)})` : "";
      return { en: `${item.itemId}: ${label.en}${chase}`, de: `${item.itemId}: ${label.de}${chaseDe}` };
    }),
});

/** The recorded dispositions, or null. */
function recordedDispositions(context: StageContext): DispositionsInput | null {
  const output = recordedTaskOutput(context, "evidence-dispositions");
  const parsed = output ? dispositionsSchema.safeParse(output.input) : null;
  return parsed?.success ? parsed.data : null;
}

/* ==========================================================================
   Decision rules
   ========================================================================== */

registerDecisionRules(PROCESS_ID, STAGE_ID, {
  validateOption: (context, decisionKey, optionId) => {
    if (decisionKey !== "stage-gate") return null;
    const dispositions = recordedDispositions(context);
    if (!dispositions) {
      return {
        en: "Record the evidence dispositions before deciding the stage gate.",
        de: "Erfassen Sie die Bewertung der Nachweise, bevor Sie ueber das Stufentor entscheiden.",
      };
    }
    const open = dispositions.items.filter((item) => item.disposition === "outstanding" || item.disposition === "reject");
    if (optionId === "gate-pass" && open.length > 0) {
      return {
        en: `The gate cannot pass without conditions while ${open.map((item) => item.itemId).join(", ")} is outstanding or rejected.`,
        de: `Das Tor kann nicht ohne Bedingungen passiert werden, solange ${open.map((item) => item.itemId).join(", ")} aussteht oder abgelehnt ist.`,
      };
    }
    if (optionId === "gate-conditional" && !dispositions.items.some((item) => item.disposition === "outstanding")) {
      return {
        en: "Nothing is outstanding, so there is no condition to record. Pass the gate instead.",
        de: "Nichts steht aus, daher gibt es keine Bedingung. Passieren Sie das Tor ohne Bedingung.",
      };
    }
    return null;
  },
  consequences: (_context, decisionKey, optionId) => {
    if (decisionKey !== "stage-gate") return [];
    switch (optionId) {
      case "gate-conditional":
        return [
          { en: "Create one action recording the outstanding items as dated conditions, owned by you", de: "Eine Massnahme anlegen, die die ausstehenden Nachweise als datierte Bedingungen erfasst, in Ihrer Verantwortung" },
          { en: "Register the conditions in the GRC platform through the outbox", de: "Die Bedingungen ueber den Postausgang im GRC-System registrieren" },
          { en: "Allow the stage to complete and open Specialist Reviews", de: "Den Abschluss der Stufe erlauben und die Fachpruefungen oeffnen" },
        ];
      case "gate-pass":
        return [{ en: "Allow the stage to complete and open Specialist Reviews", de: "Den Abschluss der Stufe erlauben und die Fachpruefungen oeffnen" }];
      case "gate-hold":
        return [{ en: "Keep the file at Stage 4; completion stays disabled until the decision is revised", de: "Die Akte in Stufe 4 halten; der Abschluss bleibt gesperrt, bis die Entscheidung ueberarbeitet wird" }];
      default:
        return [];
    }
  },
});

/* ==========================================================================
   Payload builders: the condition action and its GRC record
   ========================================================================== */

function conditionsFrom(context: StageContext) {
  const dispositions = recordedDispositions(context);
  const items = recordsOf(context.sources, "due-diligence-evidence");
  const outstanding = (dispositions?.items ?? []).filter((item) => item.disposition === "outstanding");
  return outstanding
    .map((item) => ({ ...item, title: items.find((record) => record.id === item.itemId)?.label ?? item.itemId }))
    .sort((a, b) => a.chaseDate.localeCompare(b.chaseDate));
}

function decisionTaskId(context: StageContext): string | null {
  return findTask(context.tasks, taskKey.decision("stage-gate"))?.id ?? null;
}

registerPayloadBuilder("tprm.record-conditions", (context) => {
  const conditions = conditionsFrom(context);
  const first = conditions[0];
  if (!first) {
    return { unavailable: { en: "There is no outstanding item to record as a condition.", de: "Es gibt keinen ausstehenden Nachweis fuer eine Bedingung." } };
  }
  const supplier = recordsOf(context.sources, "supplier-record")[0]?.label ?? context.run.subjectId;
  return {
    payload: {
      decisionId: decisionTaskId(context),
      entityId: "ARC-DE",
      title: `Stage 4 gate conditions for ${supplier}: ${conditions.map((condition) => condition.itemId).join(", ")}`,
      description: conditions.map((condition) => `${condition.itemId} ${condition.title}, due ${formatDate(condition.chaseDate)}`).join("; "),
      relatedObjectId: context.run.subjectId,
      relatedObjectKind: "supplier",
      kind: "evidence-request",
      dueOn: first.chaseDate,
      ownerUserId: context.actingUserId,
      priority: "high",
      ...lineageOf(context),
    },
    intentStatement: {
      en: `Create an action recording ${conditions.length} gate condition(s) for ${supplier}, due ${formatDate(first.chaseDate)}.`,
      de: `Eine Massnahme mit ${conditions.length} Torbedingungen fuer ${supplier} anlegen, faellig am ${formatDate(first.chaseDate)}.`,
    },
    sourceCanonicalType: "Supplier",
    sourceCanonicalId: context.run.subjectId,
    decisionId: decisionTaskId(context),
  };
});

registerPayloadBuilder("tprm.register-conditions", (context) => {
  const conditions = conditionsFrom(context);
  const first = conditions[0];
  const local = parseTaskOutput<ToolTaskOutput>(findTask(context.tasks, taskKey.tool("record-conditions")));
  const localActionId = (local?.resultData as { actionId?: string } | null | undefined)?.actionId ?? null;
  if (!first) {
    return { unavailable: { en: "There is no outstanding item to register.", de: "Es gibt keinen ausstehenden Nachweis zum Registrieren." } };
  }
  if (!localActionId) {
    return {
      unavailable: {
        en: "Record the conditions as an action first; the GRC record cites it.",
        de: "Erfassen Sie die Bedingungen zuerst als Massnahme; der GRC-Datensatz verweist darauf.",
      },
    };
  }
  const supplier = recordsOf(context.sources, "supplier-record")[0]?.label ?? context.run.subjectId;
  return {
    payload: {
      decisionId: decisionTaskId(context),
      entityId: "ARC-DE",
      title: `Onboarding conditions for ${supplier}`,
      description: conditions.map((condition) => `${condition.itemId}, due ${formatDate(condition.chaseDate)}`).join("; "),
      relatedObjectId: context.run.subjectId,
      relatedObjectKind: "supplier",
      kind: "evidence-request",
      dueOn: first.chaseDate,
      localActionId,
    },
    intentStatement: {
      en: `Register the Stage 4 gate conditions for ${supplier} in the GRC platform, citing ${localActionId}.`,
      de: `Die Torbedingungen der Stufe 4 fuer ${supplier} im GRC-System registrieren, mit Verweis auf ${localActionId}.`,
    },
    sourceCanonicalType: "Action",
    sourceCanonicalId: localActionId,
    decisionId: decisionTaskId(context),
  };
});

/* ==========================================================================
   The Stage 4 evidence review record, written at completion
   ========================================================================== */

registerArtifactBuilder("tprm.evidence-review-record", (context) => {
  const dispositions = recordedDispositions(context);
  const decision = context.decisions.find((state) => state.spec.key === "stage-gate");
  const local = context.tools.find((tool) => tool.key === "record-conditions");
  const remote = context.tools.find((tool) => tool.key === "register-conditions");
  const localOutput = parseTaskOutput<ToolTaskOutput>(findTask(context.tasks, taskKey.tool("record-conditions")));
  return {
    label: { en: "Stage 4 evidence review record", de: "Protokoll der Nachweispruefung Stufe 4" },
    content: {
      supplierId: context.run.subjectId,
      dispositions: dispositions?.items ?? [],
      decision: decision
        ? { optionId: decision.chosenOptionId, outcome: decision.outcome, rationale: decision.rationale, decidedBy: decision.decidedByUserId }
        : null,
      conditions: {
        localActionId: (localOutput?.resultData as { actionId?: string } | null | undefined)?.actionId ?? null,
        localState: local?.state ?? null,
        commandId: remote?.commandId ?? null,
        externalId: remote?.externalId ?? null,
        remoteState: remote?.state ?? null,
      },
      specialists: recordsOf(context.sources, "specialist-status").map((record) => ({ id: record.id, function: record.label, status: record.value })),
      preparation: { artifactId: context.preparation.artifactId, mode: context.preparation.mode, source: context.preparation.source },
    },
  };
});

export const TPRM_EVIDENCE_REVIEW = { processId: PROCESS_ID, stageId: STAGE_ID } as const;
