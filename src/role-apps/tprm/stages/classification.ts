/**
 * TPRM Stage 2, Classification and Criticality.
 *
 * Registered under the keys the stage contract names:
 *
 *   one preparer           the outsourcing and ICT classification, the
 *                          criticality, the important-service dependency and
 *                          the rationale, from the arrangement profile, the
 *                          register precedent and the regulatory framing of
 *                          each entity in scope
 *   one task form          the four judgments, each with a reason
 *   decision rules         the classification on record must be the one the
 *                          four judgments describe
 *   one payload builder    the criticality on the supplier record
 *   one artifact builder   the classification memo, which Stage 3 reads to
 *                          tailor the due diligence
 *
 * The proposal applies two stated rules and is labelled as an inference:
 * a supplier that takes over a service another supplier provides today is
 * classified like that supplier unless there is a reason not to, and an
 * arrangement serving an important business service is at least important.
 * Neither rule is a legal assessment; the person records the classification.
 *
 * Synthetic institution and data. Illustrative regulatory context, not legal
 * advice.
 */

import { z } from "zod";
import type { Bilingual } from "@/role-apps/contracts";
import {
  registerArtifactBuilder,
  registerDecisionRules,
  registerPayloadBuilder,
  registerPreparer,
  registerTaskForm,
} from "@/features/process/registry";
import type { StageContext } from "@/features/process/types";
import type { StagePreparationOutput } from "@/features/process/preparation-schema";
import {
  decisionSummary,
  decisionTaskId,
  entityRefs,
  ILLUSTRATIVE,
  joinList,
  PROCESS_ID,
  preparationSummary,
  recordedInput,
  recordsOf,
  regulatoryContext,
  supplierName,
  toolSummary,
  type EntityRef,
  type Sources,
} from "./shared";

const STAGE_ID = "classification-and-criticality";
const ROWS = ["classification", "materiality", "criticality", "review-depth"] as const;
type RowId = (typeof ROWS)[number];

const VALUES: Record<RowId, readonly string[]> = {
  classification: ["outsourcing", "ict-service", "other"],
  materiality: ["material", "not-material"],
  criticality: ["critical", "important", "standard"],
  "review-depth": ["full", "standard", "reduced"],
};

const VALUE_LABELS: Record<string, Bilingual> = {
  outsourcing: { en: "Regulated outsourcing", de: "Regulierte Auslagerung" },
  "ict-service": { en: "ICT service, not an outsourcing", de: "IKT-Leistung, keine Auslagerung" },
  other: { en: "Other purchase, not an outsourcing", de: "Sonstiger Einkauf, keine Auslagerung" },
  material: { en: "Material", de: "Wesentlich" },
  "not-material": { en: "Not material", de: "Nicht wesentlich" },
  critical: { en: "Critical", de: "Kritisch" },
  important: { en: "Important", de: "Wichtig" },
  standard: { en: "Standard", de: "Standard" },
  full: { en: "Full", de: "Vollstaendig" },
  reduced: { en: "Reduced", de: "Verringert" },
};

const ROW_LABELS: Record<RowId, Bilingual> = {
  classification: { en: "Regulatory classification", de: "Regulatorische Einstufung" },
  materiality: { en: "Materiality", de: "Wesentlichkeit" },
  criticality: { en: "Criticality", de: "Kritikalitaet" },
  "review-depth": { en: "Review depth", de: "Pruefungstiefe" },
};

function valueLabel(value: string, language: "en" | "de"): string {
  const label = VALUE_LABELS[value];
  return label ? (language === "de" ? label.de : label.en) : value;
}

/* ==========================================================================
   Reading the profile
   ========================================================================== */

function readProfile(context: StageContext, sources: Sources) {
  const profile = recordsOf(sources, "arrangement-profile");
  const service = profile.find((record) => record.facts?.kind === "service");
  const supported = profile.find((record) => record.facts?.kind === "supported");
  const entityIds = profile.filter((record) => record.facts?.kind === "entity").map((record) => record.id);
  const entities: EntityRef[] = entityRefs(context.runId, entityIds);
  const data = profile.find((record) => record.facts?.kind === "data");
  const proposalRecord = profile.find((record) => record.facts?.kind === "proposal");
  const precedent = recordsOf(sources, "third-party-register").find((record) => record.facts?.relation === "service-overlap");
  const supplier = recordsOf(sources, "supplier-record")[0];
  return { profile, service, supported, entities, data, proposalRecord, precedent, supplier };
}

/** The proposal, by the two stated rules. */
function propose(context: StageContext, sources: Sources): Record<RowId, string> & { reasons: Record<RowId, Bilingual> } {
  const read = readProfile(context, sources);
  const ownerOutsourcing = read.proposalRecord?.facts?.outsourcing === true;
  const ownerCriticality = String(read.proposalRecord?.facts?.criticality ?? "standard");
  const precedentOutsourcing = read.precedent?.facts?.isOutsourcing === true;
  const supportsImportant = read.supported?.facts?.important === true || read.service?.facts?.important === true;

  const classification = read.precedent ? (precedentOutsourcing ? "outsourcing" : "ict-service") : ownerOutsourcing ? "outsourcing" : "ict-service";
  const criticality = supportsImportant || ownerCriticality === "important" || ownerCriticality === "critical" ? (ownerCriticality === "critical" ? "critical" : "important") : "standard";
  const materiality = classification === "outsourcing" && criticality !== "standard" ? "material" : "not-material";
  const blocs = new Set(read.entities.map((entity) => entity.bloc));
  const reviewDepth = criticality !== "standard" || materiality === "material" || blocs.size > 1 ? "full" : "standard";

  const precedentName = read.precedent ? `${read.precedent.id} ${read.precedent.label}` : "";
  return {
    classification,
    materiality,
    criticality,
    "review-depth": reviewDepth,
    reasons: {
      classification: read.precedent
        ? {
            en: `${precedentName} provides the same service today and is recorded as ${precedentOutsourcing ? "a regulated outsourcing" : "not an outsourcing"}.`,
            de: `${precedentName} erbringt dieselbe Leistung heute und ist als ${precedentOutsourcing ? "regulierte Auslagerung" : "keine Auslagerung"} erfasst.`,
          }
        : {
            en: `No register precedent; the business owner proposes ${ownerOutsourcing ? "an outsourcing" : "not an outsourcing"}.`,
            de: `Kein Vorbild im Register; die fachliche Verantwortung schlaegt ${ownerOutsourcing ? "eine Auslagerung" : "keine Auslagerung"} vor.`,
          },
      materiality:
        materiality === "material"
          ? { en: "An outsourcing above standard criticality.", de: "Eine Auslagerung oberhalb der Standardkritikalitaet." }
          : { en: "Standard criticality, or not an outsourcing.", de: "Standardkritikalitaet oder keine Auslagerung." },
      criticality: supportsImportant
        ? { en: "The arrangement supports an important business service.", de: "Die Vereinbarung unterstuetzt eine wichtige Geschaeftsleistung." }
        : {
            en: `No important business service depends on it; the business owner proposes ${ownerCriticality}.`,
            de: `Keine wichtige Geschaeftsleistung haengt davon ab; die fachliche Verantwortung schlaegt ${valueLabel(ownerCriticality, "de")} vor.`,
          },
      "review-depth":
        reviewDepth === "full"
          ? blocs.size > 1
            ? { en: "Two regulatory regimes are in scope (EU and Switzerland).", de: "Zwei regulatorische Rahmen sind im Umfang (EU und Schweiz)." }
            : { en: "Important or material arrangements get the full review.", de: "Wichtige oder wesentliche Vereinbarungen erhalten die vollstaendige Pruefung." }
          : { en: "Standard criticality in one regulatory regime.", de: "Standardkritikalitaet in einem regulatorischen Rahmen." },
    },
  };
}

/** The decision option the four judgments describe. */
function optionFor(judgment: Record<RowId, string>): string {
  if (judgment.classification === "outsourcing") return judgment.materiality === "material" ? "class-outsourcing-material" : "class-outsourcing";
  return judgment.criticality === "standard" ? "class-ict-standard" : "class-ict-important";
}

/* ==========================================================================
   The preparer
   ========================================================================== */

function composeClassification(input: { context: StageContext; sources: Sources }): StagePreparationOutput {
  const { context, sources } = input;
  const read = readProfile(context, sources);
  const proposal = propose(context, sources);
  const name = supplierName(context);
  const ownerOutsourcing = read.proposalRecord?.facts?.outsourcing === true;

  const findings: StagePreparationOutput["findings"] = [];
  if (read.service) {
    findings.push({
      sourceKey: "arrangement-profile",
      statement: {
        en: `Service ${read.service.id} ${read.service.label}: ${read.service.value}.`,
        de: `Leistung ${read.service.id} ${String(read.service.facts?.nameDe || read.service.label)}: ${read.service.facts?.important ? "wichtige Geschaeftsleistung" : "unterstuetzende Leistung"}.`,
      },
      evidenceIds: [],
      basis: "approved-record",
    });
  }
  if (read.supported) {
    findings.push({
      sourceKey: "arrangement-profile",
      statement: {
        en: `Important-service dependency: the arrangement supports ${read.supported.id} ${read.supported.label}, which is ${read.supported.facts?.important ? "an important business service" : "not an important business service"}.`,
        de: `Abhaengigkeit wichtiger Leistungen: Die Vereinbarung unterstuetzt ${read.supported.id} ${String(read.supported.facts?.nameDe || read.supported.label)}, ${read.supported.facts?.important ? "eine wichtige Geschaeftsleistung" : "keine wichtige Geschaeftsleistung"}.`,
      },
      evidenceIds: read.supported.evidenceIds,
      basis: "approved-record",
    });
  }
  findings.push({
    sourceKey: "arrangement-profile",
    statement: {
      en: `Entities in scope: ${read.entities.map((entity) => `${entity.id} (${entity.bloc === "ch" ? "Switzerland" : "EU"})`).join(", ")}.`,
      de: `Gesellschaften im Umfang: ${read.entities.map((entity) => `${entity.id} (${entity.bloc === "ch" ? "Schweiz" : "EU"})`).join(", ")}.`,
    },
    evidenceIds: [],
    basis: "approved-record",
  });
  if (read.data) {
    findings.push({
      sourceKey: "arrangement-profile",
      statement: { en: `Data categories on record: ${read.data.value}.`, de: `Erfasste Datenkategorien: ${read.data.value}.` },
      evidenceIds: read.data.evidenceIds,
      basis: "stakeholder-statement",
    });
  }
  if (read.proposalRecord) {
    findings.push({
      sourceKey: "arrangement-profile",
      statement: {
        en: `Business owner proposal: ${read.proposalRecord.value}.`,
        de: `Vorschlag der fachlichen Verantwortung: ${ownerOutsourcing ? "Auslagerung" : "keine Auslagerung"}, Kritikalitaet ${valueLabel(String(read.proposalRecord.facts?.criticality ?? ""), "de")}.`,
      },
      evidenceIds: read.proposalRecord.evidenceIds,
      basis: "stakeholder-statement",
    });
  }
  if (read.precedent) {
    findings.push({
      sourceKey: "third-party-register",
      statement: {
        en: `Register precedent: ${read.precedent.id} ${read.precedent.label}, which provides this service today, is recorded as ${read.precedent.facts?.isOutsourcing ? "a regulated outsourcing" : "not an outsourcing"} with ${read.precedent.facts?.criticality} criticality.`,
        de: `Vorbild im Register: ${read.precedent.id} ${read.precedent.label}, das diese Leistung heute erbringt, ist als ${read.precedent.facts?.isOutsourcing ? "regulierte Auslagerung" : "keine Auslagerung"} mit Kritikalitaet ${valueLabel(String(read.precedent.facts?.criticality ?? ""), "de")} erfasst.`,
      },
      evidenceIds: [],
      basis: "approved-record",
    });
  }
  for (const statement of regulatoryContext(read.entities, "classification")) {
    findings.push({ sourceKey: "arrangement-profile", statement, evidenceIds: [], basis: "approved-record" });
  }

  const gaps: StagePreparationOutput["gaps"] = [];
  if (read.precedent && (read.precedent.facts?.isOutsourcing === true) !== ownerOutsourcing) {
    gaps.push({
      key: "precedent-differs",
      statement: {
        en: `The business owner proposes ${ownerOutsourcing ? "an outsourcing" : "not an outsourcing"}, while ${read.precedent.id}, which provides the same service today, is recorded as ${read.precedent.facts?.isOutsourcing ? "a regulated outsourcing" : "not an outsourcing"}. A classification that departs from the precedent needs its reason on record.`,
        de: `Die fachliche Verantwortung schlaegt ${ownerOutsourcing ? "eine Auslagerung" : "keine Auslagerung"} vor, waehrend ${read.precedent.id}, das dieselbe Leistung heute erbringt, als ${read.precedent.facts?.isOutsourcing ? "regulierte Auslagerung" : "keine Auslagerung"} erfasst ist. Eine Einstufung, die vom Vorbild abweicht, braucht eine erfasste Begruendung.`,
      },
      evidenceIds: read.proposalRecord?.evidenceIds ?? [],
      severity: "material",
    });
  }

  /* German keeps the labels' own capitals ("Standard" is a noun); English reads them in lower case. */
  const value = (row: RowId, language: "en" | "de") => (language === "de" ? valueLabel(proposal[row], "de") : valueLabel(proposal[row], "en").toLowerCase());
  const describe = (language: "en" | "de") =>
    `${valueLabel(proposal.classification, language)}, ${language === "de" ? "Wesentlichkeit" : "materiality"} ${value("materiality", language)}, ${language === "de" ? "Kritikalitaet" : "criticality"} ${value("criticality", language)}, ${language === "de" ? "Pruefungstiefe" : "review depth"} ${value("review-depth", language)}`;

  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `Proposed classification for ${name}: ${describe("en")}. ${read.precedent ? `The proposal follows the register precedent ${read.precedent.id}` : "There is no register precedent for this service"}${gaps.length > 0 ? ", which differs from the business owner's proposal" : ""}. ${ILLUSTRATIVE.en}`,
      de: `Vorgeschlagene Einstufung fuer ${name}: ${describe("de")}. ${read.precedent ? `Der Vorschlag folgt dem Vorbild ${read.precedent.id} im Register` : "Fuer diese Leistung gibt es kein Vorbild im Register"}${gaps.length > 0 ? ", das vom Vorschlag der fachlichen Verantwortung abweicht" : ""}. ${ILLUSTRATIVE.de}`,
    },
    findings,
    inferences: [
      {
        statement: {
          en: `Classification rationale: ${proposal.reasons.classification.en} ${proposal.reasons.criticality.en} ${proposal.reasons["review-depth"].en}`,
          de: `Begruendung der Einstufung: ${proposal.reasons.classification.de} ${proposal.reasons.criticality.de} ${proposal.reasons["review-depth"].de}`,
        },
        evidenceIds: read.proposalRecord?.evidenceIds ?? [],
        uncertainty: {
          en: "The rules read the register and the service profile. Whether the function is one the bank would otherwise perform itself is your judgment, and it decides the outsourcing question.",
          de: "Die Regeln lesen das Register und das Leistungsprofil. Ob die Bank die Funktion sonst selbst erbringen wuerde, ist Ihre Beurteilung, und sie entscheidet die Auslagerungsfrage.",
        },
      },
    ],
    contradictions: [],
    gaps,
    itemAssessments: ROWS.map((row) => ({
      itemId: row,
      proposedDisposition: "accept" as const,
      note: {
        en: `${valueLabel(proposal[row], "en")}. ${proposal.reasons[row].en}`,
        de: `${valueLabel(proposal[row], "de")}. ${proposal.reasons[row].de}`,
      },
    })),
    proposals: [
      {
        toolKey: "record-criticality",
        rationale: {
          en: "The criticality you record is written to the supplier record, under your approval.",
          de: "Die erfasste Kritikalitaet wird mit Ihrer Genehmigung in den Lieferantendatensatz geschrieben.",
        },
      },
    ],
    recommendedOptionId: optionFor(proposal),
    limitations: [
      {
        en: `The proposal is not a legal assessment of the outsourcing question. ${ILLUSTRATIVE.en}`,
        de: `Der Vorschlag ist keine rechtliche Beurteilung der Auslagerungsfrage. ${ILLUSTRATIVE.de}`,
      },
    ],
  };
}

const PROMPT = `You prepare Stage 2 (Classification and Criticality) of a third-party onboarding for a Third-Party Risk Manager at a synthetic bank.
Use only the source records provided. Propose the regulatory classification (outsourcing or ICT service), the materiality, the criticality and the review depth, with a short reason each, and state the important-service dependency. DORA and the EBA guidelines may be named only for the EU entities ARC-DE and ARC-AT; FINMA only for ARC-CH. Never state that DORA applies to ARC-CH. Every statement that names a framework ends with "Illustrative regulatory context, not legal advice."
The person records the classification. Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("tprm.classification", {
  compose: (input) => composeClassification(input),
  prompt: ({ context, sources }) => ({
    instructions: PROMPT,
    input: JSON.stringify({
      supplier: context.run.subjectId,
      stage: context.stage.name,
      sources: sources.map((source) => ({ key: source.spec.key, status: source.status, records: source.result.records })),
      decisionOptions: ["class-outsourcing-material", "class-outsourcing", "class-ict-important", "class-ict-standard"],
      tools: context.stage.tools.map((tool) => tool.key),
      items: ROWS,
    }),
  }),
  itemIds: () => [...ROWS],
});

/* ==========================================================================
   The four judgments
   ========================================================================== */

const judgmentSchema = z.object({
  rows: z
    .array(
      z.object({
        id: z.enum(ROWS),
        value: z.string().min(1, { message: "Every judgment needs a choice." }),
        note: z.string().max(600),
      }),
    )
    .length(ROWS.length),
});
type JudgmentInput = z.infer<typeof judgmentSchema>;

function asJudgment(input: JudgmentInput): Record<RowId, string> {
  const out = { classification: "", materiality: "", criticality: "", "review-depth": "" } as Record<RowId, string>;
  for (const row of input.rows) out[row.id] = row.value;
  return out;
}

function recordedJudgment(context: StageContext): Record<RowId, string> | null {
  const input = recordedInput(context, "classification-judgment", judgmentSchema);
  return input ? asJudgment(input) : null;
}

registerTaskForm<JudgmentInput>("tprm.classification-judgment", {
  schema: judgmentSchema,
  fields: (context, language, current) => {
    const proposals = context.preparation.output?.itemAssessments ?? [];
    return {
      rows: ROWS.map((row) => {
        const entry = current?.rows.find((item) => item.id === row);
        const proposal = proposals.find((item) => item.itemId === row);
        return {
          id: row,
          label: language === "de" ? ROW_LABELS[row].de : ROW_LABELS[row].en,
          detail: proposal ? `${language === "de" ? "KI-Vorschlag" : "AI proposal"}: ${language === "de" ? proposal.note.de : proposal.note.en}` : null,
          choice: {
            name: `judgment:${row}`,
            options: VALUES[row].map((value) => ({ value, label: valueLabel(value, language) })),
            value: entry?.value ?? "",
          },
          note: {
            name: `note:${row}`,
            value: entry?.note ?? "",
            placeholder: row === "classification" ? (language === "de" ? "Ihre Begruendung (erforderlich)" : "Your reason (required)") : language === "de" ? "Begruendung" : "Reason",
          },
          date: null,
        };
      }),
      overall: null,
    };
  },
  fromFormData: (data) => ({
    rows: ROWS.map((row) => ({ id: row, value: String(data.get(`judgment:${row}`) ?? ""), note: String(data.get(`note:${row}`) ?? "").trim() })),
  }),
  validate: (_context, input) => {
    const problems: Bilingual[] = [];
    const judgment = asJudgment(input);
    for (const row of ROWS) {
      if (!VALUES[row].includes(judgment[row])) {
        problems.push({ en: `${ROW_LABELS[row].en} needs a choice.`, de: `${ROW_LABELS[row].de} braucht eine Auswahl.` });
      }
    }
    const reason = input.rows.find((row) => row.id === "classification")?.note ?? "";
    if (reason.length < 10) {
      problems.push({ en: "Write the reason for the regulatory classification.", de: "Schreiben Sie die Begruendung der regulatorischen Einstufung." });
    }
    if (judgment.materiality === "material" && judgment.classification !== "outsourcing") {
      problems.push({
        en: "Materiality applies to an outsourcing. For an ICT service or another purchase, record its criticality instead.",
        de: "Wesentlichkeit gilt fuer eine Auslagerung. Fuer eine IKT-Leistung oder einen sonstigen Einkauf erfassen Sie stattdessen die Kritikalitaet.",
      });
    }
    if (judgment["review-depth"] === "reduced" && judgment.criticality !== "standard") {
      problems.push({
        en: "An important or critical supplier needs at least the standard review depth.",
        de: "Ein wichtiger oder kritischer Lieferant braucht mindestens die Standardpruefungstiefe.",
      });
    }
    return problems;
  },
  defaults: (context) => {
    if (!context.preparation.output) return null;
    const proposal = propose(context, context.sources);
    return {
      rows: ROWS.map((row) => ({
        id: row,
        value: proposal[row],
        note: row === "classification" ? "The precedent and the service profile support this classification." : "",
      })),
    };
  },
  summarise: (_context, input) =>
    input.rows.map((row) => ({
      en: `${ROW_LABELS[row.id].en}: ${valueLabel(row.value, "en")}${row.note ? ` (${row.note})` : ""}`,
      de: `${ROW_LABELS[row.id].de}: ${valueLabel(row.value, "de")}${row.note ? ` (${row.note})` : ""}`,
    })),
});

/* ==========================================================================
   Decision rules
   ========================================================================== */

registerDecisionRules(PROCESS_ID, STAGE_ID, {
  validateOption: (context, decisionKey, optionId) => {
    if (decisionKey !== "classification") return null;
    const judgment = recordedJudgment(context);
    if (!judgment) {
      return { en: "Record the four judgments before the classification.", de: "Erfassen Sie die vier Beurteilungen vor der Einstufung." };
    }
    const expected = optionFor(judgment);
    if (optionId !== expected) {
      return {
        en: "This option does not match the judgments you recorded. Choose the option they describe, or record the judgments again.",
        de: "Diese Option passt nicht zu den erfassten Beurteilungen. Waehlen Sie die Option, die sie beschreiben, oder erfassen Sie die Beurteilungen neu.",
      };
    }
    return null;
  },
  consequences: (context, decisionKey) => {
    if (decisionKey !== "classification") return [];
    const judgment = recordedJudgment(context);
    const criticality = judgment?.criticality ?? "";
    const depth = judgment?.["review-depth"] ?? "";
    return [
      {
        en: `Record ${criticality ? valueLabel(criticality, "en").toLowerCase() : "the recorded"} criticality on ${context.run.subjectId}, under your approval`,
        de: `Kritikalitaet ${criticality ? valueLabel(criticality, "de").toLowerCase() : "wie erfasst"} fuer ${context.run.subjectId} erfassen, mit Ihrer Genehmigung`,
      },
      { en: "Store the classification memo", de: "Den Einstufungsvermerk speichern" },
      {
        en: `Open Tailored Due Diligence${depth ? ` at ${valueLabel(depth, "en").toLowerCase()} review depth` : ""}`,
        de: `Die massgeschneiderte Sorgfaltspruefung${depth ? ` mit Pruefungstiefe ${valueLabel(depth, "de").toLowerCase()}` : ""} oeffnen`,
      },
    ];
  },
});

/* ==========================================================================
   The criticality on the supplier record
   ========================================================================== */

registerPayloadBuilder("tprm.record-criticality", (context) => {
  const judgment = recordedJudgment(context);
  if (!judgment) {
    return { unavailable: { en: "Record the four judgments first.", de: "Erfassen Sie zuerst die vier Beurteilungen." } };
  }
  const name = supplierName(context);
  return {
    payload: {
      decisionId: decisionTaskId(context, "classification"),
      entityId: "ARC-DE",
      supplierId: context.run.subjectId,
      criticality: judgment.criticality,
    },
    intentStatement: {
      en: `Record ${valueLabel(judgment.criticality, "en").toLowerCase()} criticality for ${name} on the supplier record.`,
      de: `Kritikalitaet ${valueLabel(judgment.criticality, "de").toLowerCase()} fuer ${name} im Lieferantendatensatz erfassen.`,
    },
    sourceCanonicalType: "Supplier",
    sourceCanonicalId: context.run.subjectId,
    decisionId: decisionTaskId(context, "classification"),
  };
});

/* ==========================================================================
   The classification memo
   ========================================================================== */

registerArtifactBuilder("tprm.classification-memo", (context) => {
  const judgment = recordedJudgment(context);
  const input = recordedInput(context, "classification-judgment", judgmentSchema);
  const read = readProfile(context, context.sources);
  const lines: Bilingual[] = judgment
    ? ROWS.map((row) => ({ en: `${ROW_LABELS[row].en}: ${valueLabel(judgment[row], "en")}`, de: `${ROW_LABELS[row].de}: ${valueLabel(judgment[row], "de")}` }))
    : [];
  return {
    label: { en: "Classification memo", de: "Einstufungsvermerk" },
    content: {
      supplierId: context.run.subjectId,
      judgment,
      reasons: input?.rows.map((row) => ({ id: row.id, note: row.note })) ?? [],
      entities: read.entities.map((entity) => ({ id: entity.id, bloc: entity.bloc })),
      supportedService: read.supported ? { id: read.supported.id, important: read.supported.facts?.important === true } : null,
      precedent: read.precedent ? { id: read.precedent.id, isOutsourcing: read.precedent.facts?.isOutsourcing === true } : null,
      regulatoryContext: regulatoryContext(read.entities, "classification"),
      decision: decisionSummary(context, "classification"),
      tools: toolSummary(context),
      preparation: preparationSummary(context),
      recordLines: [...lines, ...(read.entities.length > 0 ? [{ en: `Entities: ${joinList(read.entities.map((entity) => entity.id), "and")}`, de: `Gesellschaften: ${joinList(read.entities.map((entity) => entity.id), "und")}` }] : [])],
    },
  };
});

export const TPRM_CLASSIFICATION = { processId: PROCESS_ID, stageId: STAGE_ID } as const;
