/**
 * TPRM Stage 6, Contract and Conditions.
 *
 * Registered under the keys the stage contract names:
 *
 *   one preparer           the clause comparison (each carried condition
 *                          against the draft clauses), the missing rights
 *                          (the clause categories the draft does not cover),
 *                          the subprocessor requirements, the conditions and
 *                          the negotiation points
 *   one task form          each item reflected in a clause, kept open for
 *                          negotiation with a date, tracked as a condition
 *                          outside the contract, or waived with a rationale
 *   decision rules         "sufficient" only when everything is reflected;
 *                          a trade-off only when something is open or waived
 *   two payload builders   the contract condition action (with its process
 *                          lineage) and its GRC record
 *   one artifact builder   the contract conditions record, which Stage 7
 *                          reads into the onboarding file
 *
 * The carried conditions are the ones Stage 5 recorded as agreed, with their
 * dates. The clause comparison is a stated keyword reading of the clause
 * text and labelled as such: it says which clause appears to address a
 * condition, and the person confirms it.
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
import type { SourceRecord, StageContext } from "@/features/process/types";
import type { StagePreparationOutput } from "@/features/process/preparation-schema";
import { revealedEvidence } from "@/role-apps/stage-support";
import {
  addDays,
  decisionSummary,
  decisionTaskId,
  entityRefs,
  formatDate,
  ILLUSTRATIVE,
  isIsoDate,
  lineageOf,
  localResultId,
  PROCESS_ID,
  preparationSummary,
  recordedInput,
  recordsOf,
  regulatoryContext,
  stageRecord,
  supplierName,
  toIsoDate,
  toolSummary,
  withRegulatoryNote,
  type Sources,
} from "./shared";
import { entitiesInScope } from "./sources";

const STAGE_ID = "contract-and-conditions";

/* ==========================================================================
   What the contract is expected to cover
   ========================================================================== */

const REQUIRED: Array<{ category: string; label: Bilingual; fundamental: boolean }> = [
  { category: "audit", label: { en: "Audit and access rights", de: "Pruef- und Zugangsrechte" }, fundamental: true },
  { category: "exit", label: { en: "Termination and exit rights", de: "Kuendigungs- und Ausstiegsrechte" }, fundamental: true },
  { category: "subprocessor", label: { en: "Subcontracting terms", de: "Regelungen zu Unterauftragnehmern" }, fundamental: false },
  { category: "security", label: { en: "Data location and security", de: "Datenstandort und Sicherheit" }, fundamental: false },
  { category: "reporting", label: { en: "Incident notification", de: "Meldung von Vorfaellen" }, fundamental: false },
  { category: "resilience", label: { en: "Business continuity terms", de: "Regelungen zur Betriebskontinuitaet" }, fundamental: false },
];

/**
 * Which clause appears to address a condition, by its words. `clause`
 * returning false for every clause marks a condition that is met outside
 * the contract (a document before signature, an internal register entry).
 */
const MATCHERS: Array<{ test: RegExp; clause: (record: SourceRecord) => boolean; outside?: boolean }> = [
  { test: /SFTP|PGP|encrypt/i, clause: (record) => /SFTP|PGP|encrypt/i.test(String(record.facts?.text ?? "")) },
  { test: /Netherlands/i, clause: (record) => /within Germany and Austria|residency/i.test(`${record.label} ${String(record.facts?.text ?? "")}`) },
  { test: /processed in Switzerland|transfer basis/i, clause: (record) => /Switzerland|Swiss|ARC-CH/i.test(String(record.facts?.text ?? "")) },
  { test: /subcontract|subprocessor/i, clause: (record) => record.facts?.category === "subprocessor" },
  { test: /penetration test|FINMA|inventory of outsourced|review pending|sign-off/i, clause: () => false, outside: true },
];

type ItemKind = "condition" | "missing-right" | "open-clause" | "subprocessor";
type Comparison = "reflected" | "drafted-not-agreed" | "not-reflected" | "outside-contract";

interface Item {
  id: string;
  kind: ItemKind;
  label: Bilingual;
  text: string;
  comparison: Comparison;
  clause: SourceRecord | null;
  dueOn: string | null;
  evidenceIds: string[];
  fundamental: boolean;
}

interface CarriedCondition {
  id: string;
  text: string;
  dueOn: string | null;
  evidenceIds: string[];
}

/** The conditions Stage 5 agreed or carried, with their dates. */
function carriedConditions(context: StageContext): CarriedCondition[] {
  const record = stageRecord(context.runId, context.run.id, "specialist-reviews", "specialist-opinions");
  const items = Array.isArray(record?.items) ? (record.items as Array<Record<string, unknown>>) : [];
  return items
    .filter((item) => (item.kind === "condition" && item.choice === "agree") || (item.kind === "pending" && item.choice === "carry"))
    .map((item) => ({
      id: String(item.id),
      text: item.kind === "pending" ? `Review pending: ${String(item.text)}` : String(item.text),
      dueOn: typeof item.dueOn === "string" ? item.dueOn : null,
      evidenceIds: Array.isArray(item.evidenceIds) ? (item.evidenceIds as string[]) : [],
    }));
}

/** Subcontractors a supplier document names as operating part of the service, which the questionnaire does not list. */
function unlistedSubcontractors(context: StageContext, sources: Sources): Array<{ name: string; evidenceIds: string[] }> {
  const evidence = recordsOf(sources, "due-diligence-evidence").map((record) => record.id);
  const docs = revealedEvidence(context.runId, context.state).filter((doc) => evidence.includes(doc.id));
  const questionnaire = docs.find((doc) => /SECTION 5: SUBPROCESSORS/.test(doc.body));
  const section = questionnaire?.body.split(/SECTION 5: SUBPROCESSORS/)[1]?.split(/SECTION 6/)[0] ?? "";
  if (!questionnaire || section.length === 0) return [];
  const found = new Map<string, string[]>();
  for (const doc of docs) {
    if (doc.id === questionnaire.id) continue;
    for (const match of doc.body.matchAll(/operated by ([A-Z][A-Za-z ]+?(?:Ltd|GmbH|AG))\b/g)) {
      const name = match[1];
      if (name && !section.includes(name)) found.set(name, [questionnaire.id, doc.id]);
    }
  }
  return [...found].map(([name, evidenceIds]) => ({ name, evidenceIds }));
}

function readItems(context: StageContext, sources: Sources): { items: Item[]; clauses: SourceRecord[] } {
  const clauses = recordsOf(sources, "contract-conditions");
  const items: Item[] = [];

  for (const condition of carriedConditions(context)) {
    const matcher = MATCHERS.find((candidate) => candidate.test.test(condition.text));
    const clause = matcher && !matcher.outside ? (clauses.find((record) => matcher.clause(record)) ?? null) : null;
    const comparison: Comparison = matcher?.outside
      ? "outside-contract"
      : clause
        ? clause.facts?.outstanding === true
          ? "drafted-not-agreed"
          : "reflected"
        : "not-reflected";
    items.push({
      id: condition.id,
      kind: "condition",
      label: condition.id.startsWith("pending-")
        ? { en: `Pending review ${condition.id.replace(/^pending-/, "")}`, de: `Ausstehende Pruefung ${condition.id.replace(/^pending-/, "")}` }
        : { en: `Condition ${condition.id.replace(/^cond-/, "")}`, de: `Bedingung ${condition.id.replace(/^cond-/, "")}` },
      text: condition.text,
      comparison,
      clause,
      dueOn: condition.dueOn,
      evidenceIds: condition.evidenceIds,
      fundamental: false,
    });
  }

  /* Draft clauses still open, unless a carried condition already brings them in. */
  for (const clause of clauses.filter((record) => record.facts?.outstanding === true)) {
    if (items.some((item) => item.clause?.id === clause.id)) continue;
    items.push({
      id: `clause-${clause.id}`,
      kind: "open-clause",
      label: { en: clause.label, de: clause.label },
      text: String(clause.facts?.text ?? ""),
      comparison: "drafted-not-agreed",
      clause,
      dueOn: addDays(context.state.scenarioDate, 14),
      evidenceIds: clause.evidenceIds,
      fundamental: false,
    });
  }

  /* Missing rights: a required clause category the draft does not cover at all. */
  const present = new Set(clauses.map((record) => String(record.facts?.category ?? "")));
  for (const required of REQUIRED.filter((candidate) => !present.has(candidate.category))) {
    items.push({
      id: `missing-${required.category}`,
      kind: "missing-right",
      label: { en: `Missing right: ${required.label.en}`, de: `Fehlendes Recht: ${required.label.de}` },
      text: required.label.en,
      comparison: "not-reflected",
      clause: null,
      dueOn: addDays(context.state.scenarioDate, 14),
      evidenceIds: [],
      fundamental: required.fundamental,
    });
  }

  /* Subprocessor requirements: a subcontractor operating part of the service must be named in the schedule. */
  for (const unlisted of unlistedSubcontractors(context, sources)) {
    items.push({
      id: `subprocessor-${unlisted.name.replace(/[^A-Za-z]/g, "").slice(0, 40)}`,
      kind: "subprocessor",
      label: { en: `Subprocessor schedule: ${unlisted.name}`, de: `Liste der Unterauftragnehmer: ${unlisted.name}` },
      text: `${unlisted.name} operates part of the service and is not named in the supplier's subprocessor list.`,
      comparison: "not-reflected",
      clause: clauses.find((record) => record.facts?.category === "subprocessor") ?? null,
      dueOn: addDays(context.state.scenarioDate, 14),
      evidenceIds: unlisted.evidenceIds,
      fundamental: false,
    });
  }

  return { items, clauses };
}

/* ==========================================================================
   The preparer
   ========================================================================== */

const COMPARISON_TEXT: Record<Comparison, Bilingual> = {
  reflected: { en: "reflected", de: "abgebildet" },
  "drafted-not-agreed": { en: "drafted, not yet agreed", de: "entworfen, noch nicht vereinbart" },
  "not-reflected": { en: "not reflected in the draft", de: "im Entwurf nicht abgebildet" },
  "outside-contract": { en: "met outside the contract; track it as a condition", de: "ausserhalb des Vertrags zu erfuellen; als Bedingung verfolgen" },
};

/** An item's text in the reader's language: the disclaimer, where it names a framework, in that language. */
function textOf(item: Item, language: "en" | "de"): string {
  return withRegulatoryNote(item.text.replace(` ${ILLUSTRATIVE.en}`, "").replace(ILLUSTRATIVE.en, "").trim(), language);
}

function proposalFor(item: Item): "reflected" | "negotiate" | "track" {
  if (item.comparison === "reflected") return "reflected";
  if (item.comparison === "outside-contract") return "track";
  return "negotiate";
}

function composeContract(input: { context: StageContext; sources: Sources }): StagePreparationOutput {
  const { context, sources } = input;
  const { items, clauses } = readItems(context, sources);
  const name = supplierName(context);
  const entities = entityRefs(context.runId, entitiesInScope(context));

  const findings: StagePreparationOutput["findings"] = items
    .filter((item) => item.kind === "condition")
    .map((item) => ({
      sourceKey: "contract-conditions",
      statement: {
        en: `Clause comparison: "${textOf(item, "en")}" is ${COMPARISON_TEXT[item.comparison].en}${item.clause ? ` (${item.clause.label})` : ""}.`,
        de: `Klauselvergleich: "${textOf(item, "de")}" ist ${COMPARISON_TEXT[item.comparison].de}${item.clause ? ` (${item.clause.id})` : ""}.`,
      },
      evidenceIds: [...item.evidenceIds, ...(item.clause?.evidenceIds ?? [])].slice(0, 16),
      basis: "approved-record",
    }));
  for (const clause of clauses) {
    findings.push({
      sourceKey: "contract-conditions",
      statement: {
        en: `${clause.label}: ${clause.facts?.outstanding ? "open in negotiation" : "agreed in the draft"}.`,
        de: `${clause.id}: ${clause.facts?.outstanding ? "in Verhandlung offen" : "im Entwurf vereinbart"}.`,
      },
      evidenceIds: clause.evidenceIds,
      basis: "approved-record",
    });
  }
  for (const statement of regulatoryContext(entities, "contract")) {
    findings.push({ sourceKey: "contract-conditions", statement, evidenceIds: [], basis: "approved-record" });
  }

  const missing = items.filter((item) => item.kind === "missing-right");
  const gaps: StagePreparationOutput["gaps"] = [
    ...missing.map((item) => ({
      key: item.id,
      statement: {
        en: `${item.label.en}: the draft has no clause in this category.${item.fundamental ? " This is a fundamental right; the contract should not be signed without it." : ""}`,
        de: `${item.label.de}: Der Entwurf enthaelt keine Klausel dieser Kategorie.${item.fundamental ? " Dies ist ein grundlegendes Recht; der Vertrag sollte ohne es nicht unterzeichnet werden." : ""}`,
      },
      evidenceIds: [],
      severity: item.fundamental ? ("blocking" as const) : ("material" as const),
    })),
    ...items
      .filter((item) => item.kind === "condition" && item.comparison === "not-reflected")
      .map((item) => ({
        key: `not-reflected-${item.id}`,
        statement: { en: `No clause reflects the condition "${textOf(item, "en")}".`, de: `Keine Klausel bildet die Bedingung "${textOf(item, "de")}" ab.` },
        evidenceIds: item.evidenceIds,
        severity: "material" as const,
      })),
  ];

  const subprocessors = items.filter((item) => item.kind === "subprocessor");
  const contradictions: StagePreparationOutput["contradictions"] = subprocessors
    .filter((item) => item.evidenceIds.length >= 2)
    .map((item) => ({
      statement: {
        en: `Subprocessor requirement: ${item.text} The subcontracting clause and its schedule should name it.`,
        de: `Anforderung an Unterauftragnehmer: ${item.label.de.replace("Liste der Unterauftragnehmer: ", "")} betreibt einen Teil der Leistung und fehlt in der Liste des Lieferanten. Die Klausel zu Unterauftragnehmern und ihre Anlage sollten ihn nennen.`,
      },
      evidenceIds: item.evidenceIds,
    }));

  const negotiation = items.filter((item) => proposalFor(item) === "negotiate");
  const tracked = items.filter((item) => proposalFor(item) === "track");
  const fundamentalMissing = missing.some((item) => item.fundamental);

  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `Draft contract for ${name}: ${items.filter((item) => item.comparison === "reflected").length} carried condition(s) reflected, ${negotiation.length} negotiation point(s) and ${tracked.length} condition(s) met outside the contract. ${missing.length > 0 ? `The draft has no clause for ${missing.map((item) => item.text.toLowerCase()).join(", ")}.` : "Every required clause category is present."}`,
      de: `Vertragsentwurf fuer ${name}: ${items.filter((item) => item.comparison === "reflected").length} uebernommene Bedingungen abgebildet, ${negotiation.length} Verhandlungspunkte und ${tracked.length} Bedingungen ausserhalb des Vertrags. ${missing.length > 0 ? `Der Entwurf enthaelt keine Klausel zu ${missing.map((item) => item.label.de.replace("Fehlendes Recht: ", "")).join(", ")}.` : "Jede erforderliche Klauselkategorie ist vorhanden."}`,
    },
    findings: findings.slice(0, 24),
    inferences: negotiation.length > 0
      ? [
          {
            statement: {
              en: `Negotiation points: ${negotiation.map((item) => item.label.en).join("; ")}.`,
              de: `Verhandlungspunkte: ${negotiation.map((item) => item.label.de).join("; ")}.`,
            },
            evidenceIds: negotiation.flatMap((item) => item.evidenceIds).slice(0, 16),
            uncertainty: {
              en: "The comparison reads the clause wording for the condition's key terms. A clause that addresses a condition in other words is not found.",
              de: "Der Vergleich liest den Klauseltext auf die Schluesselbegriffe der Bedingung. Eine Klausel, die die Bedingung anders formuliert, wird nicht erkannt.",
            },
          },
        ]
      : [],
    contradictions,
    gaps,
    itemAssessments: items.map((item) => {
      const proposed = proposalFor(item);
      return {
        itemId: item.id,
        proposedDisposition: proposed === "reflected" ? "accept" : proposed === "track" ? "accept-with-condition" : "outstanding",
        note:
          proposed === "reflected"
            ? { en: `Reflected in ${item.clause?.label ?? "the draft"}.`, de: `Abgebildet in ${item.clause?.id ?? "dem Entwurf"}.` }
            : proposed === "track"
              ? { en: `Track as a condition, due ${formatDate(item.dueOn)}.`, de: `Als Bedingung verfolgen, faellig ${formatDate(item.dueOn)}.` }
              : { en: `Negotiate, due ${formatDate(item.dueOn)}.`, de: `Verhandeln, faellig ${formatDate(item.dueOn)}.` },
      };
    }),
    proposals:
      negotiation.length + tracked.length > 0
        ? [
            {
              toolKey: "record-contract-conditions",
              rationale: {
                en: "A trade-off turns the open points into one dated condition action, owned by you.",
                de: "Ein Kompromiss macht die offenen Punkte zu einer datierten Bedingungsmassnahme in Ihrer Verantwortung.",
              },
            },
            {
              toolKey: "register-contract-conditions",
              rationale: { en: "The GRC platform is the system of record for onboarding conditions.", de: "Das GRC-System ist das fuehrende System fuer Onboarding-Bedingungen." },
            },
          ]
        : [],
    recommendedOptionId: fundamentalMissing ? "contract-renegotiate" : negotiation.length + tracked.length > 0 ? "contract-trade-off" : "contract-sufficient",
    limitations: [
      {
        en: "Group Legal decides whether a clause is sufficient. This comparison is a reading of the draft, not a legal review.",
        de: "Ob eine Klausel ausreicht, entscheidet Group Legal. Dieser Vergleich ist eine Lesart des Entwurfs, keine Rechtspruefung.",
      },
    ],
  };
}

const PROMPT = `You prepare Stage 6 (Contract and Conditions) of a third-party onboarding for a Third-Party Risk Manager at a synthetic bank.
Use only the source records provided. Compare each condition carried from the specialist reviews with the draft clauses; name the required clause categories the draft does not cover; state the subprocessor requirements; list the negotiation points. DORA and the EBA guidelines may be named only for ARC-DE and ARC-AT; FINMA only for ARC-CH. Every statement that names a framework ends with "Illustrative regulatory context, not legal advice."
The person decides sufficiency and residual exposure. Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("tprm.contract-conditions", {
  compose: (input) => composeContract(input),
  prompt: ({ context, sources }) => ({
    instructions: PROMPT,
    input: JSON.stringify({
      supplier: context.run.subjectId,
      stage: context.stage.name,
      carriedConditions: carriedConditions(context),
      sources: sources.map((source) => ({ key: source.spec.key, status: source.status, records: source.result.records })),
      decisionOptions: ["contract-sufficient", "contract-trade-off", "contract-renegotiate"],
      tools: context.stage.tools.map((tool) => tool.key),
      items: readItems(context, sources).items.map((item) => item.id),
    }),
  }),
  itemIds: ({ context, sources }) => readItems(context, sources).items.map((item) => item.id),
});

/* ==========================================================================
   The contract review form
   ========================================================================== */

const CHOICES = ["reflected", "negotiate", "track", "waive"] as const;
type Choice = (typeof CHOICES)[number];
const CHOICE_LABELS: Record<Choice, Bilingual> = {
  reflected: { en: "Reflected in a clause", de: "In einer Klausel abgebildet" },
  negotiate: { en: "Negotiate", de: "Verhandeln" },
  track: { en: "Track as a condition", de: "Als Bedingung verfolgen" },
  waive: { en: "Waive with rationale", de: "Mit Begruendung verzichten" },
};

const reviewSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        choice: z.enum(CHOICES, { message: "Every condition and missing right needs a choice." }),
        note: z.string().max(600),
        dueOn: z.string().max(10),
      }),
    )
    .min(1),
});
type ReviewInput = z.infer<typeof reviewSchema>;

registerTaskForm<ReviewInput>("tprm.contract-review", {
  schema: reviewSchema,
  fields: (context, language, current) => {
    const { items } = readItems(context, context.sources);
    const proposals = context.preparation.output?.itemAssessments ?? [];
    return {
      rows: items.map((item) => {
        const entry = current?.items.find((candidate) => candidate.itemId === item.id);
        const proposal = proposals.find((candidate) => candidate.itemId === item.id);
        const comparison = language === "de" ? COMPARISON_TEXT[item.comparison].de : COMPARISON_TEXT[item.comparison].en;
        const hint = proposal ? `${language === "de" ? "KI-Vorschlag" : "AI proposal"}: ${language === "de" ? proposal.note.de : proposal.note.en}` : "";
        return {
          id: item.id,
          label: language === "de" ? item.label.de : item.label.en,
          detail: `${textOf(item, language)} (${comparison}). ${hint}`.trim(),
          choice: {
            name: `contract:${item.id}`,
            options: CHOICES.map((choice) => ({ value: choice, label: language === "de" ? CHOICE_LABELS[choice].de : CHOICE_LABELS[choice].en })),
            value: entry?.choice ?? "",
          },
          note: { name: `note:${item.id}`, value: entry?.note ?? "", placeholder: language === "de" ? "Klausel, Begruendung oder Verhandlungsziel" : "Clause, rationale or negotiation aim" },
          date: { name: `due:${item.id}`, value: entry?.dueOn ?? item.dueOn ?? "", label: language === "de" ? "Faellig am" : "Due by" },
        };
      }),
      overall: null,
    };
  },
  fromFormData: (data, context) => ({
    items: readItems(context, context.sources).items.map((item) => ({
      itemId: item.id,
      choice: String(data.get(`contract:${item.id}`) ?? ""),
      note: String(data.get(`note:${item.id}`) ?? "").trim(),
      dueOn: toIsoDate(String(data.get(`due:${item.id}`) ?? "")),
    })),
  }),
  validate: (context, input) => {
    const problems: Bilingual[] = [];
    const { items } = readItems(context, context.sources);
    for (const entry of input.items) {
      const item = items.find((candidate) => candidate.id === entry.itemId);
      if (!item) continue;
      if (entry.choice === "waive" && entry.note.length < 10) {
        problems.push({ en: `Write the rationale for waiving ${item.label.en}.`, de: `Schreiben Sie die Begruendung fuer den Verzicht auf ${item.label.de}.` });
      }
      if ((entry.choice === "negotiate" || entry.choice === "track") && !isIsoDate(entry.dueOn)) {
        problems.push({ en: `${item.label.en} needs a due date.`, de: `${item.label.de} braucht einen Termin.` });
      } else if ((entry.choice === "negotiate" || entry.choice === "track") && entry.dueOn < context.state.scenarioDate) {
        problems.push({ en: `The due date for ${item.label.en} is in the past.`, de: `Der Termin fuer ${item.label.de} liegt in der Vergangenheit.` });
      }
      if (entry.choice === "reflected" && item.comparison !== "reflected" && entry.note.length < 5) {
        problems.push({
          en: `No agreed clause was found for ${item.label.en}. Name the clause that reflects it.`,
          de: `Fuer ${item.label.de} wurde keine vereinbarte Klausel gefunden. Nennen Sie die Klausel, die sie abbildet.`,
        });
      }
    }
    return problems;
  },
  defaults: (context) => {
    if (!context.preparation.output) return null;
    const { items } = readItems(context, context.sources);
    return { items: items.map((item) => ({ itemId: item.id, choice: proposalFor(item), note: "", dueOn: proposalFor(item) === "reflected" ? "" : (item.dueOn ?? "") })) };
  },
  summarise: (context, input) => {
    const { items } = readItems(context, context.sources);
    return input.items.map((entry) => {
      const item = items.find((candidate) => candidate.id === entry.itemId);
      const label = item?.label ?? { en: entry.itemId, de: entry.itemId };
      const due = entry.choice === "negotiate" || entry.choice === "track" ? ` (${formatDate(entry.dueOn)})` : "";
      return { en: `${label.en}: ${CHOICE_LABELS[entry.choice].en.toLowerCase()}${due}`, de: `${label.de}: ${CHOICE_LABELS[entry.choice].de.toLowerCase()}${due}` };
    });
  },
});

function recordedReview(context: StageContext): ReviewInput | null {
  return recordedInput(context, "contract-review", reviewSchema);
}

/** The open points, earliest first, and the waived ones. */
function reviewOutcome(context: StageContext) {
  const review = recordedReview(context);
  const { items } = readItems(context, context.sources);
  const label = (id: string) => items.find((item) => item.id === id)?.label.en ?? id;
  const open = (review?.items ?? [])
    .filter((entry) => entry.choice === "negotiate" || entry.choice === "track")
    .map((entry) => ({ ...entry, label: label(entry.itemId) }))
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const waived = (review?.items ?? []).filter((entry) => entry.choice === "waive").map((entry) => ({ ...entry, label: label(entry.itemId) }));
  return { review, open, waived };
}

/* ==========================================================================
   Decision rules
   ========================================================================== */

registerDecisionRules(PROCESS_ID, STAGE_ID, {
  validateOption: (context, decisionKey, optionId) => {
    if (decisionKey !== "contract-sufficiency") return null;
    const outcome = reviewOutcome(context);
    if (!outcome.review) return { en: "Place every condition against the contract before deciding.", de: "Ordnen Sie jede Bedingung dem Vertrag zu, bevor Sie entscheiden." };
    if (optionId === "contract-sufficient" && (outcome.open.length > 0 || outcome.waived.length > 0)) {
      return {
        en: "The contract is not sufficient as drafted while points are open or waived. Accept a documented trade-off or renegotiate.",
        de: "Der Vertrag ist nicht angemessen, solange Punkte offen oder verzichtet sind. Akzeptieren Sie einen dokumentierten Kompromiss oder verhandeln Sie nach.",
      };
    }
    if (optionId === "contract-trade-off" && outcome.open.length === 0 && outcome.waived.length === 0) {
      return {
        en: "Every point is reflected, so there is no trade-off to accept. Record the contract as sufficient.",
        de: "Jeder Punkt ist abgebildet, es gibt keinen Kompromiss. Erfassen Sie den Vertrag als angemessen.",
      };
    }
    return null;
  },
  consequences: (context, decisionKey, optionId) => {
    if (decisionKey !== "contract-sufficiency") return [];
    const outcome = reviewOutcome(context);
    switch (optionId) {
      case "contract-trade-off":
        return [
          {
            en: `Create one condition action for ${outcome.open.length} open point(s)${outcome.waived.length > 0 ? ` and ${outcome.waived.length} residual exposure(s)` : ""}, owned by you, with its process lineage`,
            de: `Eine Bedingungsmassnahme fuer ${outcome.open.length} offene Punkte${outcome.waived.length > 0 ? ` und ${outcome.waived.length} Restexpositionen` : ""} anlegen, in Ihrer Verantwortung, mit Prozessherkunft`,
          },
          { en: "Register the conditions in the GRC platform through the outbox", de: "Die Bedingungen ueber den Postausgang im GRC-System registrieren" },
          { en: "Allow the stage to complete and open Decision and Onboarding", de: "Den Abschluss der Stufe erlauben und Entscheidung und Onboarding oeffnen" },
        ];
      case "contract-sufficient":
        return [{ en: "Allow the stage to complete and open Decision and Onboarding", de: "Den Abschluss der Stufe erlauben und Entscheidung und Onboarding oeffnen" }];
      case "contract-renegotiate":
        return [{ en: "Hold the file at Stage 6 until the open clauses are resolved", de: "Die Akte in Stufe 6 halten, bis die offenen Klauseln geloest sind" }];
      default:
        return [];
    }
  },
});

/* ==========================================================================
   The contract condition action and its GRC record
   ========================================================================== */

function description(outcome: ReturnType<typeof reviewOutcome>): string {
  return [
    ...outcome.open.map((entry) => `${entry.label}: ${entry.choice === "track" ? "condition" : "negotiate"}, due ${formatDate(entry.dueOn)}${entry.note ? ` (${entry.note})` : ""}`),
    ...outcome.waived.map((entry) => `${entry.label}: waived as residual exposure (${entry.note})`),
  ].join("; ");
}

registerPayloadBuilder("tprm.record-contract-conditions", (context) => {
  const outcome = reviewOutcome(context);
  if (!outcome.review || outcome.open.length + outcome.waived.length === 0) {
    return { unavailable: { en: "There is no open or waived point to record.", de: "Es gibt keinen offenen oder verzichteten Punkt." } };
  }
  const name = supplierName(context);
  const dueOn = outcome.open[0]?.dueOn ?? addDays(context.state.scenarioDate, 30);
  return {
    payload: {
      decisionId: decisionTaskId(context, "contract-sufficiency"),
      entityId: "ARC-DE",
      title: `Contract conditions for ${name}: ${outcome.open.length} open, ${outcome.waived.length} accepted as residual exposure`,
      description: description(outcome),
      relatedObjectId: context.run.subjectId,
      relatedObjectKind: "supplier",
      kind: "remediation",
      dueOn,
      ownerUserId: context.actingUserId,
      priority: "high",
      ...lineageOf(context),
    },
    intentStatement: {
      en: `Create a condition action for ${name}: ${outcome.open.length} open point(s), first due ${formatDate(dueOn)}.`,
      de: `Eine Bedingungsmassnahme fuer ${name} anlegen: ${outcome.open.length} offene Punkte, erster Termin ${formatDate(dueOn)}.`,
    },
    sourceCanonicalType: "Supplier",
    sourceCanonicalId: context.run.subjectId,
    decisionId: decisionTaskId(context, "contract-sufficiency"),
  };
});

registerPayloadBuilder("tprm.register-contract-conditions", (context) => {
  const outcome = reviewOutcome(context);
  const localActionId = localResultId(context, "record-contract-conditions", "actionId");
  if (!outcome.review) return { unavailable: { en: "Place the conditions against the contract first.", de: "Ordnen Sie zuerst die Bedingungen dem Vertrag zu." } };
  if (!localActionId) {
    return { unavailable: { en: "Record the conditions as an action first; the GRC record cites it.", de: "Erfassen Sie die Bedingungen zuerst als Massnahme; der GRC-Datensatz verweist darauf." } };
  }
  const name = supplierName(context);
  return {
    payload: {
      decisionId: decisionTaskId(context, "contract-sufficiency"),
      entityId: "ARC-DE",
      title: `Contract conditions for ${name}`,
      description: description(outcome),
      relatedObjectId: context.run.subjectId,
      relatedObjectKind: "supplier",
      kind: "remediation",
      dueOn: outcome.open[0]?.dueOn ?? addDays(context.state.scenarioDate, 30),
      localActionId,
    },
    intentStatement: {
      en: `Register the contract conditions for ${name} in the GRC platform, citing ${localActionId}.`,
      de: `Die Vertragsbedingungen fuer ${name} im GRC-System registrieren, mit Verweis auf ${localActionId}.`,
    },
    sourceCanonicalType: "Action",
    sourceCanonicalId: localActionId,
    decisionId: decisionTaskId(context, "contract-sufficiency"),
  };
});

/* ==========================================================================
   The contract conditions record
   ========================================================================== */

registerArtifactBuilder("tprm.contract-record", (context) => {
  const outcome = reviewOutcome(context);
  const { items } = readItems(context, context.sources);
  return {
    label: { en: "Contract conditions record", de: "Protokoll der Vertragsbedingungen" },
    content: {
      supplierId: context.run.subjectId,
      items: items.map((item) => {
        const entry = outcome.review?.items.find((candidate) => candidate.itemId === item.id);
        return { id: item.id, kind: item.kind, text: item.text, comparison: item.comparison, clauseId: item.clause?.id ?? null, choice: entry?.choice ?? null, note: entry?.note ?? "", dueOn: entry?.dueOn ?? null };
      }),
      conditionActionId: localResultId(context, "record-contract-conditions", "actionId"),
      decision: decisionSummary(context, "contract-sufficiency"),
      tools: toolSummary(context),
      preparation: preparationSummary(context),
      recordLines: [
        {
          en: `${outcome.open.length} open point(s), ${outcome.waived.length} waived, ${(outcome.review?.items.length ?? 0) - outcome.open.length - outcome.waived.length} reflected`,
          de: `${outcome.open.length} offene Punkte, ${outcome.waived.length} verzichtet, ${(outcome.review?.items.length ?? 0) - outcome.open.length - outcome.waived.length} abgebildet`,
        },
      ],
    },
  };
});

export const TPRM_CONTRACT_CONDITIONS = { processId: PROCESS_ID, stageId: STAGE_ID } as const;
