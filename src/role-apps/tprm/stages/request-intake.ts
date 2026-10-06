/**
 * TPRM Stage 1, Request and Intake.
 *
 * Registered under the keys the stage contract names:
 *
 *   one preparer           the request summary, the owner, the service, the
 *                          data categories, the legal entities and the
 *                          duplicate supplier check, read from the
 *                          procurement request and the register
 *   one task form          the business context: each part of the request
 *                          confirmed or corrected, in the person's words
 *   decision rules         no proceed before the review, and no proceed on
 *                          a recorded duplicate
 *   one payload builder    the candidate record in the GRC third-party
 *                          register, through the outbox
 *   one artifact builder   the intake record, which later stages read for
 *                          the corrected entities and data categories
 *
 * The comparisons are narrow and stated: the entities in the form against
 * the entities the scope note names, a named person against a function, the
 * category name "account statements" against the data it carries. Each fires
 * only on the specific text, and each is offered as something to confirm.
 *
 * Synthetic institution and data.
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
import type { SourceRecord, StageContext } from "@/features/process/types";
import type { StagePreparationOutput } from "@/features/process/preparation-schema";
import {
  decisionSummary,
  decisionTaskId,
  fact,
  joinList,
  orderEntities,
  PROCESS_ID,
  preparationSummary,
  recordedInput,
  recordsOf,
  supplierName,
  toolSummary,
  type Sources,
} from "./shared";

const STAGE_ID = "request-and-intake";
const ENTITY_ID = /\bARC-(?:DE|AT|CH)\b/g;

/* ==========================================================================
   Reading the sources
   ========================================================================== */

function requestRecord(sources: Sources): SourceRecord | undefined {
  return recordsOf(sources, "procurement-request")[0];
}

function registerCheck(sources: Sources) {
  const records = recordsOf(sources, "third-party-register");
  return {
    check: records.find((record) => record.id === "REGISTER-CHECK"),
    duplicates: records.filter((record) => record.facts?.relation === "duplicate" || record.facts?.relation === "subprocessor-match"),
    overlap: records.filter((record) => record.facts?.relation === "service-overlap"),
  };
}

function ids(text: string): string[] {
  return orderEntities(text.match(ENTITY_ID) ?? []);
}

/** What the request says and what it leaves open, read once for the preparer and the form. */
function readIntake(sources: Sources) {
  const request = requestRecord(sources);
  const formEntities = ids(fact(request, "entities"));
  const scopeEntities = ids(fact(request, "scopeEntities"));
  const missingEntities = scopeEntities.filter((id) => !formEntities.includes(id));
  const owner = fact(request, "owner");
  const ownerNamed = /\(P-\d{3}\)/.test(owner);
  const data = fact(request, "data");
  const statements = /account statement/i.test(data);
  const { check, duplicates, overlap } = registerCheck(sources);
  return { request, formEntities, scopeEntities, missingEntities, owner, ownerNamed, data, statements, check, duplicates, overlap };
}

/* ==========================================================================
   The preparer
   ========================================================================== */

const ROWS = ["owner", "service", "data", "entities", "duplicate"] as const;
type RowId = (typeof ROWS)[number];

function composeIntake(input: { context: StageContext; sources: Sources }): StagePreparationOutput {
  const { context, sources } = input;
  const intake = readIntake(sources);
  const name = supplierName(context);
  const request = intake.request;

  if (!request) {
    return {
      schemaVersion: "stage-preparation-v1",
      summary: {
        en: `No procurement request for ${name} is held in the evidence corpus, so there is nothing to take in. Return the file to the business owner for a request.`,
        de: `Fuer ${name} liegt kein Beschaffungsantrag im Nachweisbestand, daher gibt es nichts aufzunehmen. Geben Sie die Akte zur Antragstellung an die fachliche Verantwortung zurueck.`,
      },
      findings: [],
      inferences: [],
      contradictions: [],
      gaps: [
        {
          key: "no-request",
          statement: { en: "There is no procurement request on file.", de: "Es liegt kein Beschaffungsantrag vor." },
          evidenceIds: [],
          severity: "blocking",
        },
      ],
      itemAssessments: [],
      proposals: [],
      recommendedOptionId: "intake-return",
      limitations: [],
    };
  }

  const cite = [request.id];
  const reference = fact(request, "reference");
  const revision = fact(request, "revision").split(".")[0] ?? "";
  const findings: StagePreparationOutput["findings"] = [
    {
      sourceKey: "procurement-request",
      statement: {
        en: `${reference} (${revision}) from ${fact(request, "requestedBy")}: ${fact(request, "service")}, from ${fact(request, "candidate")}. Planned start ${fact(request, "start")}; annual spend ${fact(request, "spend")}.`,
        de: `${reference} (${revision.replace("Revision", "Fassung").replace("resubmitted", "erneut eingereicht")}) von ${fact(request, "requestedBy")}: ${fact(request, "service")}, durch ${fact(request, "candidate")}. Geplanter Beginn ${fact(request, "start")}; jaehrliche Kosten ${fact(request, "spend").replace("scenario figure", "Szenariowert")}.`,
      },
      evidenceIds: cite,
      basis: "stakeholder-statement",
    },
    {
      sourceKey: "procurement-request",
      statement: {
        en: `Owner: the request names "${intake.owner}" as business owner.`,
        de: `Verantwortung: Der Antrag nennt "${intake.owner}" als fachliche Verantwortung.`,
      },
      evidenceIds: cite,
      basis: "stakeholder-statement",
    },
    {
      sourceKey: "procurement-request",
      statement: {
        en: `Service: ${fact(request, "service")}. It replaces ${fact(request, "replaces")} and supports ${fact(request, "supports")}.`,
        de: `Leistung: ${fact(request, "service")}. Sie ersetzt ${fact(request, "replaces")} und unterstuetzt ${fact(request, "supports")}.`,
      },
      evidenceIds: cite,
      basis: "stakeholder-statement",
    },
    {
      sourceKey: "procurement-request",
      statement: { en: `Data categories as stated: ${intake.data}.`, de: `Datenkategorien laut Antrag: ${intake.data}.` },
      evidenceIds: cite,
      basis: "stakeholder-statement",
    },
    {
      sourceKey: "procurement-request",
      statement: {
        en: `Legal entities in the form: ${joinList(intake.formEntities, "and") || "none named"}.`,
        de: `Gesellschaften im Formular: ${joinList(intake.formEntities, "und") || "keine genannt"}.`,
      },
      evidenceIds: cite,
      basis: "stakeholder-statement",
    },
  ];

  const check = intake.check;
  findings.push({
    sourceKey: "third-party-register",
    statement:
      intake.duplicates.length === 0
        ? {
            en: `Duplicate supplier check: no supplier among ${fact(check, "suppliers")} and no subprocessor among ${fact(check, "subprocessors")} in the register matches ${name} by name${fact(check, "registerNumber") ? ` or commercial register number ${fact(check, "registerNumber")}` : ""}.`,
            de: `Dublettenpruefung: Kein Lieferant unter ${fact(check, "suppliers")} und kein Unterauftragnehmer unter ${fact(check, "subprocessors")} im Register entspricht ${name} nach Name${fact(check, "registerNumber") ? ` oder Handelsregisternummer ${fact(check, "registerNumber")}` : ""}.`,
          }
        : {
            en: `Duplicate supplier check: ${intake.duplicates.map((record) => `${record.id} ${record.label}`).join("; ")} may be the same company as ${name}.`,
            de: `Dublettenpruefung: ${intake.duplicates.map((record) => `${record.id} ${record.label}`).join("; ")} koennte dasselbe Unternehmen wie ${name} sein.`,
          },
    evidenceIds: check?.evidenceIds ?? [],
    basis: "approved-record",
  });
  for (const record of intake.overlap) {
    findings.push({
      sourceKey: "third-party-register",
      statement: {
        en: `Service overlap: ${record.id} ${record.label} already ${record.facts?.serviceId ? `serves ${record.facts.serviceId}` : "provides this service"} and is recorded as ${record.facts?.status}. The request ${record.facts?.replaced ? "replaces it" : "overlaps it"}, which is a transition, not a duplicate.`,
        de: `Ueberschneidung: ${record.id} ${record.label} ${record.facts?.serviceId ? `bedient bereits ${record.facts.serviceId}` : "erbringt diese Leistung bereits"} und ist als ${record.facts?.status === "exit-planned" ? "Ausstieg geplant" : record.facts?.status} erfasst. Der Antrag ${record.facts?.replaced ? "ersetzt ihn" : "ueberschneidet sich damit"}; das ist ein Uebergang, keine Dublette.`,
      },
      evidenceIds: [],
      basis: "approved-record",
    });
  }

  const gaps: StagePreparationOutput["gaps"] = [];
  if (intake.missingEntities.length > 0) {
    gaps.push({
      key: "entities-incomplete",
      statement: {
        en: `The legal entities field names ${joinList(intake.formEntities, "and")}, while the scope note adds ${joinList(intake.missingEntities, "and")}. Confirm whether ${joinList(intake.missingEntities, "and")} is in scope: it changes the regulatory framing and the due diligence.`,
        de: `Das Feld Gesellschaften nennt ${joinList(intake.formEntities, "und")}, die Umfangsbeschreibung ergaenzt ${joinList(intake.missingEntities, "und")}. Bestaetigen Sie, ob ${joinList(intake.missingEntities, "und")} im Umfang ist: das aendert den regulatorischen Rahmen und die Sorgfaltspruefung.`,
      },
      evidenceIds: cite,
      severity: "material",
    });
  }
  if (!intake.ownerNamed) {
    gaps.push({
      key: "owner-not-named",
      statement: {
        en: `The business owner is a function ("${intake.owner}"), not a named person. The register needs a named relationship owner.`,
        de: `Die fachliche Verantwortung ist eine Funktion ("${intake.owner}"), keine benannte Person. Das Register braucht eine benannte Verantwortung fuer die Beziehung.`,
      },
      evidenceIds: cite,
      severity: "minor",
    });
  }

  const inferences: StagePreparationOutput["inferences"] = intake.statements
    ? [
        {
          statement: {
            en: "Account statements carry account numbers, balances and transaction details, so the arrangement processes client financial data as well as names and addresses.",
            de: "Kontoauszuege enthalten Kontonummern, Salden und Umsaetze; die Vereinbarung verarbeitet daher neben Namen und Anschriften auch Finanzdaten von Kunden.",
          },
          evidenceIds: cite,
          uncertainty: {
            en: "Read from the category name. The form does not list account data separately.",
            de: "Aus der Bezeichnung der Kategorie abgeleitet. Das Formular fuehrt Kontodaten nicht gesondert auf.",
          },
        },
      ]
    : [];

  const proposal = (row: RowId): { disposition: "accept" | "outstanding"; note: Bilingual } => {
    switch (row) {
      case "owner":
        return intake.ownerNamed
          ? { disposition: "accept", note: { en: "Confirm the named owner.", de: "Benannte Verantwortung bestaetigen." } }
          : { disposition: "outstanding", note: { en: "Correct: name the person who owns the relationship.", de: "Korrigieren: die Person benennen, die die Beziehung verantwortet." } };
      case "service":
        return { disposition: "accept", note: { en: "Confirm the service as stated.", de: "Leistung wie angegeben bestaetigen." } };
      case "data":
        return intake.statements
          ? { disposition: "outstanding", note: { en: "Correct: add account and transaction data to the categories.", de: "Korrigieren: Konto- und Umsatzdaten zu den Kategorien ergaenzen." } }
          : { disposition: "accept", note: { en: "Confirm the categories as stated.", de: "Kategorien wie angegeben bestaetigen." } };
      case "entities":
        return intake.missingEntities.length > 0
          ? {
              disposition: "outstanding",
              note: {
                en: `Correct if ${joinList(intake.missingEntities, "and")} is in scope: ${joinList([...intake.formEntities, ...intake.missingEntities], "and")}.`,
                de: `Korrigieren, falls ${joinList(intake.missingEntities, "und")} im Umfang ist: ${joinList([...intake.formEntities, ...intake.missingEntities], "und")}.`,
              },
            }
          : { disposition: "accept", note: { en: "Confirm the entities as stated.", de: "Gesellschaften wie angegeben bestaetigen." } };
      case "duplicate":
        return intake.duplicates.length === 0
          ? { disposition: "accept", note: { en: "Confirm: no duplicate in the register.", de: "Bestaetigen: keine Dublette im Register." } }
          : { disposition: "outstanding", note: { en: "Check the possible duplicate before proceeding.", de: "Moegliche Dublette vor dem Fortfahren pruefen." } };
    }
  };

  const corrections = ROWS.filter((row) => proposal(row).disposition === "outstanding").length;
  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `${reference} asks for ${fact(request, "service").toLowerCase()} from ${name}, replacing ${fact(request, "replaces").split(",")[0]}. ${corrections === 0 ? "The intake reads as complete." : `${corrections} part(s) of the request need your confirmation or correction before the file proceeds${intake.missingEntities.length > 0 ? `, most importantly whether ${joinList(intake.missingEntities, "and")} is in scope` : ""}.`} ${intake.duplicates.length === 0 ? "The register holds no duplicate of the candidate." : `The register holds ${intake.duplicates.length} possible duplicate(s).`}`,
      de: `${reference} beantragt ${fact(request, "service")} durch ${name} als Ersatz fuer ${fact(request, "replaces").split(",")[0]}. ${corrections === 0 ? "Die Aufnahme ist vollstaendig." : `${corrections} Teile des Antrags brauchen Ihre Bestaetigung oder Korrektur, bevor die Akte weitergeht${intake.missingEntities.length > 0 ? `, vor allem ob ${joinList(intake.missingEntities, "und")} im Umfang ist` : ""}.`} ${intake.duplicates.length === 0 ? "Das Register enthaelt keine Dublette des Kandidaten." : `Das Register enthaelt ${intake.duplicates.length} moegliche Dubletten.`}`,
    },
    findings,
    inferences,
    contradictions: [],
    gaps,
    itemAssessments: ROWS.map((row) => {
      const proposed = proposal(row);
      return { itemId: row, proposedDisposition: proposed.disposition, note: proposed.note };
    }),
    proposals: [
      {
        toolKey: "register-candidate",
        rationale: {
          en: "Once you proceed, the candidate is recorded in the GRC third-party register under its procurement reference.",
          de: "Wenn Sie fortfahren, wird der Kandidat unter seiner Beschaffungsreferenz im GRC-Drittparteienregister erfasst.",
        },
      },
    ],
    recommendedOptionId: intake.duplicates.length === 0 ? "intake-proceed" : "intake-return",
    limitations: [
      {
        en: "The duplicate check compares names and commercial register numbers in the register; it does not search external company registers.",
        de: "Die Dublettenpruefung vergleicht Namen und Handelsregisternummern im Register; externe Handelsregister werden nicht durchsucht.",
      },
    ],
  };
}

const PROMPT = `You prepare Stage 1 (Request and Intake) of a third-party onboarding for a Third-Party Risk Manager at a synthetic bank.
Use only the source records provided. Summarise the request; state the owner, the service, the data categories and the legal entities as the request gives them; flag where the request contradicts itself; report the duplicate supplier check against the register. For each of owner, service, data, entities and duplicate propose "accept" (confirm) or "outstanding" (correct) with a short note; the person decides.
Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("tprm.request-intake", {
  compose: (input) => composeIntake(input),
  prompt: ({ context, sources }) => ({
    instructions: PROMPT,
    input: JSON.stringify({
      supplier: context.run.subjectId,
      stage: context.stage.name,
      sources: sources.map((source) => ({ key: source.spec.key, status: source.status, records: source.result.records })),
      decisionOptions: ["intake-proceed", "intake-return"],
      tools: context.stage.tools.map((tool) => tool.key),
      items: ROWS,
    }),
  }),
  itemIds: () => [...ROWS],
});

/* ==========================================================================
   The business context task form
   ========================================================================== */

const VERDICTS: Record<RowId, readonly string[]> = {
  owner: ["confirm", "correct"],
  service: ["confirm", "correct"],
  data: ["confirm", "correct"],
  entities: ["confirm", "correct"],
  duplicate: ["no-duplicate", "duplicate"],
};

const reviewSchema = z.object({
  rows: z
    .array(
      z.object({
        id: z.enum(ROWS),
        verdict: z.string().min(1, { message: "Every part of the request needs a confirmation or a correction." }),
        note: z.string().max(600),
      }),
    )
    .length(ROWS.length),
  context: z.string().max(1200),
});
type ReviewInput = z.infer<typeof reviewSchema>;

const ROW_LABELS: Record<RowId, Bilingual> = {
  owner: { en: "Business owner", de: "Fachliche Verantwortung" },
  service: { en: "Service", de: "Leistung" },
  data: { en: "Data categories", de: "Datenkategorien" },
  entities: { en: "Legal entities", de: "Gesellschaften" },
  duplicate: { en: "Duplicate supplier check", de: "Dublettenpruefung" },
};

const CHOICES: Record<string, Bilingual> = {
  confirm: { en: "Confirmed as stated", de: "Wie angegeben bestaetigt" },
  correct: { en: "Corrected", de: "Korrigiert" },
  "no-duplicate": { en: "No duplicate", de: "Keine Dublette" },
  duplicate: { en: "Duplicate or related record", de: "Dublette oder verbundener Datensatz" },
};

function stated(sources: Sources, row: RowId, language: "en" | "de"): string {
  const intake = readIntake(sources);
  const request = intake.request;
  switch (row) {
    case "owner":
      return intake.owner;
    case "service":
      return fact(request, "service");
    case "data":
      return intake.data;
    case "entities":
      return joinList(intake.formEntities, language === "de" ? "und" : "and");
    case "duplicate":
      return intake.duplicates.length === 0
        ? language === "de"
          ? "Keine Uebereinstimmung im Register"
          : "No match in the register"
        : intake.duplicates.map((record) => record.id).join(", ");
  }
}

registerTaskForm<ReviewInput>("tprm.intake-review", {
  schema: reviewSchema,
  fields: (context, language, current) => {
    const proposals = context.preparation.output?.itemAssessments ?? [];
    return {
      rows: ROWS.map((row) => {
        const entry = current?.rows.find((item) => item.id === row);
        const proposal = proposals.find((item) => item.itemId === row);
        const hint = proposal ? (language === "de" ? proposal.note.de : proposal.note.en) : null;
        const value = stated(context.sources, row, language);
        const detail = `${language === "de" ? "Laut Antrag" : "As requested"}: ${value || (language === "de" ? "nicht angegeben" : "not stated")}`;
        return {
          id: row,
          label: language === "de" ? ROW_LABELS[row].de : ROW_LABELS[row].en,
          detail: hint ? `${detail}. ${language === "de" ? "KI-Vorschlag" : "AI proposal"}: ${hint}` : detail,
          choice: {
            name: `intake:${row}`,
            options: VERDICTS[row].map((verdict) => ({ value: verdict, label: language === "de" ? (CHOICES[verdict]?.de ?? verdict) : (CHOICES[verdict]?.en ?? verdict) })),
            value: entry?.verdict ?? "",
          },
          note: {
            name: `note:${row}`,
            value: entry?.note ?? "",
            placeholder: language === "de" ? "Korrektur in Ihren Worten" : "The correction, in your words",
          },
          date: null,
        };
      }),
      overall: {
        name: "context",
        value: current?.context ?? "",
        label: language === "de" ? "Fachlicher Kontext (optional)" : "Business context (optional)",
      },
    };
  },
  fromFormData: (data) => ({
    rows: ROWS.map((row) => ({
      id: row,
      verdict: String(data.get(`intake:${row}`) ?? ""),
      note: String(data.get(`note:${row}`) ?? "").trim(),
    })),
    context: String(data.get("context") ?? "").trim(),
  }),
  validate: (_context, input) => {
    const problems: Bilingual[] = [];
    for (const row of input.rows) {
      const label = ROW_LABELS[row.id];
      if (!VERDICTS[row.id].includes(row.verdict)) {
        problems.push({ en: `${label.en} needs a confirmation or a correction.`, de: `${label.de} braucht eine Bestaetigung oder Korrektur.` });
        continue;
      }
      if ((row.verdict === "correct" || row.verdict === "duplicate") && row.note.length < 10) {
        problems.push({ en: `Write the correction for ${label.en.toLowerCase()}.`, de: `Schreiben Sie die Korrektur zu ${label.de}.` });
      }
      if (row.id === "entities" && row.verdict === "correct" && ids(row.note).length === 0) {
        problems.push({
          en: "Name the legal entities in scope in the correction, for example ARC-DE, ARC-AT, ARC-CH.",
          de: "Nennen Sie die Gesellschaften im Umfang in der Korrektur, zum Beispiel ARC-DE, ARC-AT, ARC-CH.",
        });
      }
    }
    return problems;
  },
  defaults: (context) => {
    const output = context.preparation.output;
    if (!output) return null;
    const intake = readIntake(context.sources);
    return {
      rows: ROWS.map((row) => {
        const proposal = output.itemAssessments.find((item) => item.itemId === row);
        const correct = proposal?.proposedDisposition === "outstanding";
        const verdict = row === "duplicate" ? (correct ? "duplicate" : "no-duplicate") : correct ? "correct" : "confirm";
        const note =
          !correct
            ? ""
            : row === "entities"
              ? [...intake.formEntities, ...intake.missingEntities].join(", ")
              : row === "owner"
                ? "Relationship owner named as Stefan Brunner (P-002) until Retail Operations names a person."
                : row === "data"
                  ? "Add account numbers, balances and transaction details."
                  : "Checked against the register.";
        return { id: row, verdict, note };
      }),
      context: "",
    };
  },
  summarise: (_context, input) =>
    input.rows.map((row) => {
      const label = ROW_LABELS[row.id];
      const choice = CHOICES[row.verdict] ?? { en: row.verdict, de: row.verdict };
      return {
        en: `${label.en}: ${choice.en.toLowerCase()}${row.note ? ` (${row.note})` : ""}`,
        de: `${label.de}: ${choice.de.toLowerCase()}${row.note ? ` (${row.note})` : ""}`,
      };
    }),
});

function recordedReview(context: StageContext): ReviewInput | null {
  return recordedInput(context, "intake-review", reviewSchema);
}

/** The entities and data categories the intake leaves on record. */
function intakeOutcome(context: StageContext) {
  const review = recordedReview(context);
  const intake = readIntake(context.sources);
  const entitiesRow = review?.rows.find((row) => row.id === "entities");
  const dataRow = review?.rows.find((row) => row.id === "data");
  const ownerRow = review?.rows.find((row) => row.id === "owner");
  const entitiesInScope = entitiesRow?.verdict === "correct" ? ids(entitiesRow.note) : intake.formEntities;
  const dataCategories = dataRow?.verdict === "correct" ? `${intake.data}; ${dataRow.note}` : intake.data;
  const owner = ownerRow?.verdict === "correct" ? ownerRow.note : intake.owner;
  return { review, intake, entitiesInScope, dataCategories, owner };
}

/* ==========================================================================
   Decision rules
   ========================================================================== */

registerDecisionRules(PROCESS_ID, STAGE_ID, {
  validateOption: (context, decisionKey, optionId) => {
    if (decisionKey !== "intake-proceed") return null;
    const review = recordedReview(context);
    if (optionId === "intake-proceed" && !review) {
      return {
        en: "Record the business context before proceeding.",
        de: "Erfassen Sie den fachlichen Kontext, bevor Sie fortfahren.",
      };
    }
    if (optionId === "intake-proceed" && review?.rows.some((row) => row.id === "duplicate" && row.verdict === "duplicate")) {
      return {
        en: "A duplicate or related record is recorded. Resolve it with the business owner before proceeding: return the request.",
        de: "Eine Dublette oder ein verbundener Datensatz ist erfasst. Klaeren Sie das mit der fachlichen Verantwortung, bevor Sie fortfahren: geben Sie den Antrag zurueck.",
      };
    }
    return null;
  },
  consequences: (_context, decisionKey, optionId) => {
    if (decisionKey !== "intake-proceed") return [];
    return optionId === "intake-proceed"
      ? [
          { en: "Record the candidate in the GRC third-party register through the outbox, under your approval", de: "Den Kandidaten ueber den Postausgang im GRC-Drittparteienregister erfassen, mit Ihrer Genehmigung" },
          { en: "Store the intake record with the corrected business context", de: "Das Aufnahmeprotokoll mit dem korrigierten fachlichen Kontext speichern" },
          { en: "Allow the stage to complete and open Classification and Criticality", de: "Den Abschluss der Stufe erlauben und Einstufung und Kritikalitaet oeffnen" },
        ]
      : [{ en: "Hold the file at Stage 1 until the business owner corrects the request", de: "Die Akte in Stufe 1 halten, bis die fachliche Verantwortung den Antrag korrigiert" }];
  },
});

/* ==========================================================================
   The candidate record in the register
   ========================================================================== */

registerPayloadBuilder("tprm.register-candidate", (context) => {
  const outcome = intakeOutcome(context);
  if (!outcome.review) {
    return { unavailable: { en: "Record the business context first.", de: "Erfassen Sie zuerst den fachlichen Kontext." } };
  }
  const name = supplierName(context);
  const reference = fact(outcome.intake.request, "reference") || context.run.subjectId;
  return {
    payload: {
      decisionId: decisionTaskId(context, "intake-proceed"),
      supplierId: context.run.subjectId,
      name,
      status: "onboarding",
      procurementReference: reference,
      entities: outcome.entitiesInScope,
      relationshipOwner: outcome.owner,
      processRunId: context.run.id,
    },
    intentStatement: {
      en: `Record ${name} as an onboarding candidate in the GRC third-party register under ${reference}, for ${joinList(outcome.entitiesInScope, "and")}.`,
      de: `${name} als Onboarding-Kandidat im GRC-Drittparteienregister unter ${reference} erfassen, fuer ${joinList(outcome.entitiesInScope, "und")}.`,
    },
    sourceCanonicalType: "Supplier",
    sourceCanonicalId: context.run.subjectId,
    targetExternalId: context.run.subjectId,
    decisionId: decisionTaskId(context, "intake-proceed"),
  };
});

/* ==========================================================================
   The intake record
   ========================================================================== */

registerArtifactBuilder("tprm.intake-record", (context) => {
  const outcome = intakeOutcome(context);
  const decision = decisionSummary(context, "intake-proceed");
  const registration = context.tools.find((tool) => tool.key === "register-candidate");
  const lines: Bilingual[] = [
    {
      en: `Entities in scope: ${joinList(outcome.entitiesInScope, "and")}`,
      de: `Gesellschaften im Umfang: ${joinList(outcome.entitiesInScope, "und")}`,
    },
    { en: `Business owner: ${outcome.owner}`, de: `Fachliche Verantwortung: ${outcome.owner}` },
    { en: `Data categories: ${outcome.dataCategories}`, de: `Datenkategorien: ${outcome.dataCategories}` },
  ];
  if (registration?.externalId) {
    lines.push({ en: `Register record: ${registration.externalId}`, de: `Registereintrag: ${registration.externalId}` });
  }
  return {
    label: { en: "Intake record", de: "Aufnahmeprotokoll" },
    content: {
      supplierId: context.run.subjectId,
      request: { evidenceId: outcome.intake.request?.id ?? null, reference: fact(outcome.intake.request, "reference") },
      review: outcome.review?.rows ?? [],
      businessContext: outcome.review?.context ?? "",
      entitiesInScope: outcome.entitiesInScope,
      dataCategories: outcome.dataCategories,
      owner: outcome.owner,
      decision,
      tools: toolSummary(context),
      preparation: preparationSummary(context),
      recordLines: lines,
    },
  };
});

export const TPRM_REQUEST_INTAKE = { processId: PROCESS_ID, stageId: STAGE_ID } as const;
