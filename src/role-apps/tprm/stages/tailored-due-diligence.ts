/**
 * TPRM Stage 3, Tailored Due Diligence.
 *
 * Registered under the keys the stage contract names:
 *
 *   one preparer           reusable evidence, the tailored request, the
 *                          questions removed as irrelevant, the missing
 *                          evidence and the reason each part is required
 *   one task form          the request scope: each template part requested
 *                          with a due date, reused, or removed with a reason;
 *                          additional questions; blockers
 *   decision rules         no dispatch with a blocker or with nothing to ask
 *   two payload builders   the request action and its GRC record
 *   one artifact builder   the evidence request list; Stage 4 reads which
 *                          documents were removed from scope
 *
 * The due diligence template is the group's standard request pack, held
 * here as data. Each part names the documents that satisfy it (matched on
 * the document title) and the rule that makes it relevant. The rules are
 * stated in the requirement rationale, so the person sees why each part is
 * asked for before approving the dispatch.
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
  type TaskFormRow,
} from "@/features/process/registry";
import type { SourceRecord, StageContext } from "@/features/process/types";
import type { StagePreparationOutput } from "@/features/process/preparation-schema";
import {
  addDays,
  decisionSummary,
  decisionTaskId,
  formatDate,
  isIsoDate,
  lineageOf,
  localResultId,
  PROCESS_ID,
  preparationSummary,
  recordedInput,
  recordsOf,
  servicesOf,
  supplierName,
  supplierRow,
  toIsoDate,
  toolSummary,
  type Sources,
} from "./shared";
import { entitiesInScope } from "./sources";

const STAGE_ID = "tailored-due-diligence";

/* ==========================================================================
   The due diligence template
   ========================================================================== */

interface Profile {
  outsourcing: boolean;
  criticality: string;
  depth: string;
  swiss: boolean;
  payments: boolean;
}

interface TemplatePart {
  id: string;
  label: Bilingual;
  /** Matches the title of a document that satisfies the part. */
  match: RegExp;
  relevant(profile: Profile): boolean;
  why: (profile: Profile) => Bilingual;
}

const TEMPLATE: TemplatePart[] = [
  {
    id: "questionnaire",
    label: { en: "Vendor information questionnaire", de: "Lieferanteninformationsfragebogen" },
    match: /Vendor Information Questionnaire/i,
    relevant: () => true,
    why: () => ({ en: "Required for every supplier.", de: "Fuer jeden Lieferanten erforderlich." }),
  },
  {
    id: "certification",
    label: { en: "Information security certification", de: "Zertifizierung der Informationssicherheit" },
    match: /ISO 27001/i,
    relevant: () => true,
    why: () => ({ en: "Required for every supplier that holds client data.", de: "Fuer jeden Lieferanten mit Kundendaten erforderlich." }),
  },
  {
    id: "assurance",
    label: { en: "Independent assurance report", de: "Unabhaengiger Pruefbericht" },
    match: /ISAE 3402|SOC 2/i,
    relevant: () => true,
    why: () => ({ en: "Required for every supplier that holds client data.", de: "Fuer jeden Lieferanten mit Kundendaten erforderlich." }),
  },
  {
    id: "continuity",
    label: { en: "Business continuity plan and test", de: "Notfallplan und Notfalltest" },
    match: /Business Continuity/i,
    relevant: () => true,
    why: () => ({ en: "Required for every supplier; the test must be less than twelve months old.", de: "Fuer jeden Lieferanten erforderlich; der Test darf hoechstens zwoelf Monate alt sein." }),
  },
  {
    id: "penetration-test",
    label: { en: "Penetration test", de: "Penetrationstest" },
    match: /Penetration Test/i,
    relevant: (profile) => profile.depth === "full",
    why: () => ({ en: "Required at full review depth.", de: "Bei vollstaendiger Pruefungstiefe erforderlich." }),
  },
  {
    id: "exit-plan",
    label: { en: "Exit and transition plan", de: "Ausstiegs- und Uebergangsplan" },
    match: /Exit and Transition/i,
    relevant: (profile) => profile.outsourcing || profile.criticality !== "standard",
    why: (profile) =>
      profile.outsourcing
        ? { en: "Required because the arrangement is classified as an outsourcing.", de: "Erforderlich, weil die Vereinbarung als Auslagerung eingestuft ist." }
        : { en: "Required because the supplier is important.", de: "Erforderlich, weil der Lieferant wichtig ist." },
  },
  {
    id: "data-location",
    label: { en: "Data location statement", de: "Erklaerung zum Datenstandort" },
    match: /Data Location/i,
    relevant: (profile) => profile.swiss,
    why: () => ({ en: "Required because ARC-CH is in scope.", de: "Erforderlich, weil ARC-CH im Umfang ist." }),
  },
  {
    id: "financials",
    label: { en: "Audited financial statements", de: "Gepruefter Jahresabschluss" },
    match: /Financial Statements/i,
    relevant: () => true,
    why: () => ({ en: "Required for every supplier.", de: "Fuer jeden Lieferanten erforderlich." }),
  },
  {
    id: "payment-data",
    label: { en: "Payment data handling questionnaire", de: "Fragebogen zur Verarbeitung von Zahlungsdaten" },
    match: /Payment Data Handling/i,
    relevant: (profile) => profile.payments,
    why: (profile) =>
      profile.payments
        ? { en: "Required because the service processes payment data.", de: "Erforderlich, weil die Leistung Zahlungsdaten verarbeitet." }
        : { en: "Not relevant: the service executes no payments and holds no payment instructions.", de: "Nicht relevant: Die Leistung fuehrt keine Zahlungen aus und haelt keine Zahlungsauftraege." },
  },
];

/* ==========================================================================
   Reading the file
   ========================================================================== */

function readProfile(context: StageContext, sources: Sources): Profile {
  const classification = recordsOf(sources, "classification-record");
  const value = (key: string) => String(classification.find((record) => record.facts?.key === key)?.facts?.value ?? "");
  const supplier = supplierRow(context.runId, context.run.subjectId);
  const criticality = value("criticality") || supplier?.criticality || "standard";
  const outsourcing = (value("classification") || (supplier?.isOutsourcing ? "outsourcing" : "")) === "outsourcing";
  const depth = value("review-depth") || (criticality === "standard" ? "standard" : "full");
  const text = [supplier?.description ?? "", ...servicesOf(context.runId, context.run.subjectId).map((service) => service.description)].join(" ");
  const payments = /payment (data|instruction|confirmation)/i.test(text) && !/executes no payments|no payment instruction/i.test(text);
  return { outsourcing, criticality, depth, swiss: entitiesInScope(context).includes("ARC-CH"), payments };
}

type PartState = "reusable" | "stale" | "requested" | "missing" | "irrelevant";

interface PartView {
  part: TemplatePart;
  relevant: boolean;
  state: PartState;
  docs: SourceRecord[];
  expectedBy: string | null;
}

function readParts(context: StageContext, sources: Sources): { profile: Profile; parts: PartView[]; unmatched: SourceRecord[] } {
  const profile = readProfile(context, sources);
  const evidence = recordsOf(sources, "due-diligence-evidence");
  const used = new Set<string>();
  const parts = TEMPLATE.map((part): PartView => {
    const docs = evidence.filter((record) => part.match.test(record.label));
    for (const doc of docs) used.add(doc.id);
    const relevant = part.relevant(profile);
    const received = docs.filter((doc) => doc.facts?.received === true);
    const current = received.filter((doc) => doc.facts?.isStale !== true);
    const requested = docs.find((doc) => doc.facts?.received !== true);
    const state: PartState = !relevant
      ? "irrelevant"
      : current.length > 0
        ? "reusable"
        : received.length > 0
          ? "stale"
          : requested
            ? "requested"
            : "missing";
    const expected = requested?.facts?.expectedBy ? toIsoDate(String(requested.facts.expectedBy)) : null;
    return { part, relevant, state, docs, expectedBy: expected };
  });
  return { profile, parts, unmatched: evidence.filter((record) => !used.has(record.id)) };
}

/* ==========================================================================
   The preparer
   ========================================================================== */

const STATE_TEXT: Record<PartState, Bilingual> = {
  reusable: { en: "evidence held and current; reuse it", de: "Nachweis vorhanden und aktuell; wiederverwenden" },
  stale: { en: "evidence held but stale; request a current one", de: "Nachweis vorhanden, aber veraltet; aktuellen anfordern" },
  requested: { en: "requested, not received", de: "angefordert, nicht eingegangen" },
  missing: { en: "nothing held; request it", de: "nichts vorhanden; anfordern" },
  irrelevant: { en: "not relevant to this arrangement; remove it", de: "fuer diese Vereinbarung nicht relevant; entfernen" },
};

function proposalFor(view: PartView): "reuse" | "request" | "remove" {
  if (view.state === "irrelevant") return "remove";
  return view.state === "reusable" ? "reuse" : "request";
}

function composeDueDiligence(input: { context: StageContext; sources: Sources }): StagePreparationOutput {
  const { context, sources } = input;
  const { profile, parts } = readParts(context, sources);
  const name = supplierName(context);

  const findings: StagePreparationOutput["findings"] = parts.map((view) => ({
    sourceKey: "due-diligence-evidence",
    statement: {
      en: `${view.part.label.en}: ${STATE_TEXT[view.state].en}${view.docs.length > 0 ? ` (${view.docs.map((doc) => doc.id).join(", ")})` : ""}.`,
      de: `${view.part.label.de}: ${STATE_TEXT[view.state].de}${view.docs.length > 0 ? ` (${view.docs.map((doc) => doc.id).join(", ")})` : ""}.`,
    },
    evidenceIds: view.docs.map((doc) => doc.id).slice(0, 16),
    basis: view.state === "reusable" ? "approved-record" : "stakeholder-statement",
  }));

  const gaps: StagePreparationOutput["gaps"] = [];
  for (const view of parts) {
    if (view.state === "stale") {
      gaps.push({
        key: `stale-${view.part.id}`,
        statement: {
          en: `${view.part.label.en}: ${view.docs.map((doc) => doc.id).join(", ")} is older than the group standard allows. Request a current one.`,
          de: `${view.part.label.de}: ${view.docs.map((doc) => doc.id).join(", ")} ist aelter, als der Konzernstandard erlaubt. Fordern Sie einen aktuellen an.`,
        },
        evidenceIds: view.docs.map((doc) => doc.id),
        severity: "material",
      });
    } else if (view.state === "missing") {
      gaps.push({
        key: `missing-${view.part.id}`,
        statement: {
          en: `${view.part.label.en}: nothing is held or requested. ${view.part.why(profile).en}`,
          de: `${view.part.label.de}: nichts vorhanden oder angefordert. ${view.part.why(profile).de}`,
        },
        evidenceIds: [],
        severity: "material",
      });
    } else if (view.state === "requested" && view.expectedBy && view.expectedBy < context.state.scenarioDate) {
      gaps.push({
        key: `overdue-${view.part.id}`,
        statement: {
          en: `${view.part.label.en}: requested and overdue since ${formatDate(view.expectedBy)}.`,
          de: `${view.part.label.de}: angefordert und seit ${formatDate(view.expectedBy)} ueberfaellig.`,
        },
        evidenceIds: view.docs.map((doc) => doc.id),
        severity: "minor",
      });
    }
  }

  const removed = parts.filter((view) => view.state === "irrelevant");
  const inferences: StagePreparationOutput["inferences"] = removed.map((view) => ({
    statement: {
      en: `Removed as irrelevant: ${view.part.label.en}. ${view.part.why(profile).en}${view.docs.length > 0 ? ` The open request ${view.docs.map((doc) => doc.id).join(", ")} would be withdrawn.` : ""}`,
      de: `Als irrelevant entfernt: ${view.part.label.de}. ${view.part.why(profile).de}${view.docs.length > 0 ? ` Die offene Anforderung ${view.docs.map((doc) => doc.id).join(", ")} wuerde zurueckgezogen.` : ""}`,
    },
    evidenceIds: view.docs.map((doc) => doc.id),
    uncertainty: {
      en: "Read from the service description on record. If the service scope changes, the part becomes relevant again.",
      de: "Aus der erfassten Leistungsbeschreibung abgeleitet. Aendert sich der Leistungsumfang, wird der Teil wieder relevant.",
    },
  }));

  const reuse = parts.filter((view) => view.state === "reusable");
  const request = parts.filter((view) => view.state === "stale" || view.state === "requested" || view.state === "missing");
  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `Tailored request for ${name} at ${profile.depth} review depth${profile.outsourcing ? " as an outsourcing" : ""}${profile.swiss ? ", with ARC-CH in scope" : ""}: reuse ${reuse.length} part(s) already held, request ${request.length}, and remove ${removed.length} as not relevant. Each part states why it is required.`,
      de: `Massgeschneiderte Anforderung fuer ${name} mit Pruefungstiefe ${profile.depth === "full" ? "vollstaendig" : profile.depth === "reduced" ? "verringert" : "Standard"}${profile.outsourcing ? " als Auslagerung" : ""}${profile.swiss ? ", mit ARC-CH im Umfang" : ""}: ${reuse.length} vorhandene Teile wiederverwenden, ${request.length} anfordern und ${removed.length} als nicht relevant entfernen. Jeder Teil nennt seine Begruendung.`,
    },
    findings,
    inferences: inferences.slice(0, 6),
    contradictions: [],
    gaps,
    itemAssessments: parts.map((view) => {
      const proposed = proposalFor(view);
      return {
        itemId: view.part.id,
        proposedDisposition: proposed === "reuse" ? "accept" : proposed === "remove" ? "reject" : "outstanding",
        note: {
          en: `${proposed === "reuse" ? "Reuse" : proposed === "remove" ? "Remove" : "Request"}. ${view.part.why(profile).en}`,
          de: `${proposed === "reuse" ? "Wiederverwenden" : proposed === "remove" ? "Entfernen" : "Anfordern"}. ${view.part.why(profile).de}`,
        },
      };
    }),
    proposals: [
      {
        toolKey: "record-request",
        rationale: { en: "The tailored request becomes one action with its due date, owned by you.", de: "Die Anforderung wird eine Massnahme mit Termin in Ihrer Verantwortung." },
      },
      {
        toolKey: "dispatch-request",
        rationale: { en: "The GRC platform is the system of record for supplier requests.", de: "Das GRC-System ist das fuehrende System fuer Lieferantenanforderungen." },
      },
    ],
    recommendedOptionId: "dispatch-approve",
    limitations: [
      {
        en: "Documents are matched to template parts by their titles. A document filed under another title is not counted.",
        de: "Dokumente werden den Teilen der Vorlage ueber ihren Titel zugeordnet. Ein anders benanntes Dokument wird nicht erkannt.",
      },
    ],
  };
}

const PROMPT = `You prepare Stage 3 (Tailored Due Diligence) of a third-party onboarding for a Third-Party Risk Manager at a synthetic bank.
Use only the source records provided. For each part of the due diligence template, say whether the evidence already held can be reused, must be requested, or is not relevant and can be removed, and give the reason it is required. Cite the documents.
The person approves the request. Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("tprm.tailored-due-diligence", {
  compose: (input) => composeDueDiligence(input),
  prompt: ({ context, sources }) => ({
    instructions: PROMPT,
    input: JSON.stringify({
      supplier: context.run.subjectId,
      stage: context.stage.name,
      template: TEMPLATE.map((part) => ({ id: part.id, label: part.label.en })),
      sources: sources.map((source) => ({ key: source.spec.key, status: source.status, records: source.result.records })),
      decisionOptions: ["dispatch-approve", "dispatch-revise"],
      tools: context.stage.tools.map((tool) => tool.key),
    }),
  }),
  itemIds: () => TEMPLATE.map((part) => part.id),
});

/* ==========================================================================
   The request scope form
   ========================================================================== */

const CHOICES = ["request", "reuse", "remove"] as const;
const CHOICE_LABELS: Record<(typeof CHOICES)[number], Bilingual> = {
  request: { en: "Request", de: "Anfordern" },
  reuse: { en: "Reuse held evidence", de: "Vorhandenes wiederverwenden" },
  remove: { en: "Remove, not relevant", de: "Entfernen, nicht relevant" },
};
const BLOCKER_LABELS: Record<string, Bilingual> = {
  none: { en: "No blocker", de: "Kein Hindernis" },
  blocker: { en: "Blocker to dispatch", de: "Hindernis fuer den Versand" },
};

const scopeSchema = z.object({
  parts: z
    .array(
      z.object({
        partId: z.string().min(1),
        choice: z.enum(CHOICES, { message: "Every part of the template needs a choice." }),
        note: z.string().max(600),
        dueOn: z.string().max(10),
      }),
    )
    .min(1),
  blocker: z.enum(["none", "blocker"], { message: "State whether anything blocks the dispatch." }),
  blockerNote: z.string().max(600),
  additional: z.string().max(1200),
});
type ScopeInput = z.infer<typeof scopeSchema>;

registerTaskForm<ScopeInput>("tprm.request-scope", {
  schema: scopeSchema,
  fields: (context, language, current) => {
    const { parts } = readParts(context, context.sources);
    const proposals = context.preparation.output?.itemAssessments ?? [];
    const rows: TaskFormRow[] = parts.map((view) => {
      const entry = current?.parts.find((item) => item.partId === view.part.id);
      const proposal = proposals.find((item) => item.itemId === view.part.id);
      const held = view.docs.length > 0 ? view.docs.map((doc) => doc.id).join(", ") : language === "de" ? "nichts vorhanden" : "nothing held";
      const hint = proposal ? (language === "de" ? proposal.note.de : proposal.note.en) : null;
      return {
        id: view.part.id,
        label: language === "de" ? view.part.label.de : view.part.label.en,
        detail: `${language === "de" ? "Bestand" : "On file"}: ${held}.${hint ? ` ${language === "de" ? "KI-Vorschlag" : "AI proposal"}: ${hint}` : ""}`,
        choice: {
          name: `scope:${view.part.id}`,
          options: CHOICES.map((choice) => ({ value: choice, label: language === "de" ? CHOICE_LABELS[choice].de : CHOICE_LABELS[choice].en })),
          value: entry?.choice ?? "",
        },
        note: { name: `note:${view.part.id}`, value: entry?.note ?? "", placeholder: language === "de" ? "Begruendung oder Zusatz" : "Reason or detail" },
        date: {
          name: `due:${view.part.id}`,
          value: entry?.dueOn ?? (view.expectedBy && view.expectedBy >= context.state.scenarioDate ? view.expectedBy : addDays(context.state.scenarioDate, 10)),
          label: language === "de" ? "Faellig am" : "Due by",
        },
      };
    });
    rows.push({
      id: "blockers",
      label: language === "de" ? "Hindernisse fuer den Versand" : "Blockers to dispatch",
      detail: language === "de" ? "Etwas, das den Versand verhindert, zum Beispiel ein offener Vertragsentwurf." : "Anything that stops the dispatch, for example an unagreed confidentiality term.",
      choice: {
        name: "blocker",
        options: Object.entries(BLOCKER_LABELS).map(([value, label]) => ({ value, label: language === "de" ? label.de : label.en })),
        value: current?.blocker ?? "",
      },
      note: { name: "blocker-note", value: current?.blockerNote ?? "", placeholder: language === "de" ? "Hindernis beschreiben" : "Describe the blocker" },
      date: null,
    });
    return {
      rows,
      overall: { name: "additional", value: current?.additional ?? "", label: language === "de" ? "Zusatzfragen an den Lieferanten (optional)" : "Additional questions for the supplier (optional)" },
    };
  },
  fromFormData: (data) => ({
    parts: TEMPLATE.map((part) => ({
      partId: part.id,
      choice: String(data.get(`scope:${part.id}`) ?? ""),
      note: String(data.get(`note:${part.id}`) ?? "").trim(),
      dueOn: toIsoDate(String(data.get(`due:${part.id}`) ?? "")),
    })),
    blocker: String(data.get("blocker") ?? ""),
    blockerNote: String(data.get("blocker-note") ?? "").trim(),
    additional: String(data.get("additional") ?? "").trim(),
  }),
  validate: (context, input) => {
    const problems: Bilingual[] = [];
    const { parts } = readParts(context, context.sources);
    for (const entry of input.parts) {
      const view = parts.find((candidate) => candidate.part.id === entry.partId);
      if (!view) continue;
      const label = view.part.label;
      if (entry.choice === "request") {
        if (!isIsoDate(entry.dueOn)) problems.push({ en: `${label.en} is requested and needs a due date.`, de: `${label.de} ist angefordert und braucht einen Termin.` });
        else if (entry.dueOn < context.state.scenarioDate) problems.push({ en: `The due date for ${label.en} is in the past.`, de: `Der Termin fuer ${label.de} liegt in der Vergangenheit.` });
      }
      if (entry.choice === "reuse" && view.state !== "reusable") {
        problems.push({ en: `There is no current document on file to reuse for ${label.en}.`, de: `Fuer ${label.de} liegt kein aktuelles Dokument zur Wiederverwendung vor.` });
      }
      if (entry.choice === "remove" && entry.note.length < 10) {
        problems.push({ en: `Write why ${label.en} is not relevant.`, de: `Schreiben Sie, warum ${label.de} nicht relevant ist.` });
      }
    }
    if (input.blocker === "blocker" && input.blockerNote.length < 10) {
      problems.push({ en: "Describe the blocker to dispatch.", de: "Beschreiben Sie das Hindernis fuer den Versand." });
    }
    return problems;
  },
  defaults: (context) => {
    if (!context.preparation.output) return null;
    const { parts } = readParts(context, context.sources);
    return {
      parts: parts.map((view) => {
        const choice = proposalFor(view);
        return {
          partId: view.part.id,
          choice,
          note: choice === "remove" ? "The service executes no payments; the questionnaire does not apply." : "",
          dueOn: choice === "request" ? (view.expectedBy && view.expectedBy >= context.state.scenarioDate ? view.expectedBy : addDays(context.state.scenarioDate, 10)) : "",
        };
      }),
      blocker: "none",
      blockerNote: "",
      additional: "",
    };
  },
  summarise: (_context, input) => [
    ...input.parts.map((entry) => {
      const part = TEMPLATE.find((candidate) => candidate.id === entry.partId);
      const label = part?.label ?? { en: entry.partId, de: entry.partId };
      const choice = CHOICE_LABELS[entry.choice];
      const due = entry.choice === "request" ? ` (${formatDate(entry.dueOn)})` : "";
      return { en: `${label.en}: ${choice.en.toLowerCase()}${due}`, de: `${label.de}: ${choice.de.toLowerCase()}${due}` };
    }),
    ...(input.additional ? [{ en: `Additional questions: ${input.additional}`, de: `Zusatzfragen: ${input.additional}` }] : []),
    ...(input.blocker === "blocker" ? [{ en: `Blocker: ${input.blockerNote}`, de: `Hindernis: ${input.blockerNote}` }] : []),
  ],
});

function recordedScope(context: StageContext): ScopeInput | null {
  return recordedInput(context, "request-scope", scopeSchema);
}

/** The requested parts with their dates, earliest first, and the documents removed from scope. */
function requestOutcome(context: StageContext) {
  const scope = recordedScope(context);
  const { parts } = readParts(context, context.sources);
  const requested = (scope?.parts ?? [])
    .filter((entry) => entry.choice === "request")
    .map((entry) => ({ ...entry, label: TEMPLATE.find((part) => part.id === entry.partId)?.label ?? { en: entry.partId, de: entry.partId } }))
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const removedParts = (scope?.parts ?? []).filter((entry) => entry.choice === "remove").map((entry) => entry.partId);
  const removedDocumentIds = parts.filter((view) => removedParts.includes(view.part.id)).flatMap((view) => view.docs.map((doc) => doc.id));
  return { scope, requested, removedParts, removedDocumentIds };
}

/* ==========================================================================
   Decision rules
   ========================================================================== */

registerDecisionRules(PROCESS_ID, STAGE_ID, {
  validateOption: (context, decisionKey, optionId) => {
    if (decisionKey !== "questionnaire-dispatch" || optionId !== "dispatch-approve") return null;
    const outcome = requestOutcome(context);
    if (!outcome.scope) return { en: "Record the request scope before the dispatch.", de: "Erfassen Sie den Anforderungsumfang vor dem Versand." };
    if (outcome.scope.blocker === "blocker") {
      return { en: "A blocker to dispatch is recorded. Resolve it, or revise the scope first.", de: "Ein Hindernis fuer den Versand ist erfasst. Loesen Sie es oder ueberarbeiten Sie zuerst den Umfang." };
    }
    if (outcome.requested.length === 0 && outcome.scope.additional.length === 0) {
      return {
        en: "Nothing is requested from the supplier. Request at least one part or add a question, or revise the scope.",
        de: "Vom Lieferanten wird nichts angefordert. Fordern Sie mindestens einen Teil an oder ergaenzen Sie eine Frage, oder ueberarbeiten Sie den Umfang.",
      };
    }
    return null;
  },
  consequences: (context, decisionKey, optionId) => {
    if (decisionKey !== "questionnaire-dispatch") return [];
    if (optionId === "dispatch-revise") return [{ en: "Keep the file at Stage 3 until the scope is revised", de: "Die Akte in Stufe 3 halten, bis der Umfang ueberarbeitet ist" }];
    const outcome = requestOutcome(context);
    return [
      { en: `Create one action for the ${outcome.requested.length} requested part(s), owned by you`, de: `Eine Massnahme fuer die ${outcome.requested.length} angeforderten Teile anlegen, in Ihrer Verantwortung` },
      { en: "Dispatch the request through the GRC platform, through the outbox", de: "Die Anforderung ueber den Postausgang an das GRC-System senden" },
      ...(outcome.removedDocumentIds.length > 0
        ? [{ en: `Withdraw ${outcome.removedDocumentIds.join(", ")} from the evidence review`, de: `${outcome.removedDocumentIds.join(", ")} aus der Nachweispruefung zurueckziehen` }]
        : []),
      { en: "Allow the stage to complete and open Evidence Review", de: "Den Abschluss der Stufe erlauben und die Nachweispruefung oeffnen" },
    ];
  },
});

/* ==========================================================================
   The request action and its GRC record
   ========================================================================== */

function requestDescription(outcome: ReturnType<typeof requestOutcome>): string {
  const parts = outcome.requested.map((entry) => `${entry.label.en}, due ${formatDate(entry.dueOn)}${entry.note ? ` (${entry.note})` : ""}`);
  const extra = outcome.scope?.additional ? [`Additional questions: ${outcome.scope.additional}`] : [];
  return [...parts, ...extra].join("; ");
}

registerPayloadBuilder("tprm.record-request", (context) => {
  const outcome = requestOutcome(context);
  const first = outcome.requested[0];
  if (!outcome.scope || (!first && !outcome.scope.additional)) {
    return { unavailable: { en: "Nothing is requested from the supplier.", de: "Vom Lieferanten wird nichts angefordert." } };
  }
  const name = supplierName(context);
  const dueOn = first?.dueOn ?? addDays(context.state.scenarioDate, 10);
  return {
    payload: {
      decisionId: decisionTaskId(context, "questionnaire-dispatch"),
      entityId: "ARC-DE",
      title: `Tailored due diligence request for ${name}: ${outcome.requested.length} part(s)`,
      description: requestDescription(outcome),
      relatedObjectId: context.run.subjectId,
      relatedObjectKind: "supplier",
      kind: "evidence-request",
      dueOn,
      ownerUserId: context.actingUserId,
      priority: "medium",
      ...lineageOf(context),
    },
    intentStatement: {
      en: `Create an action for the tailored request to ${name}: ${outcome.requested.length} part(s), first due ${formatDate(dueOn)}.`,
      de: `Eine Massnahme fuer die Anforderung an ${name} anlegen: ${outcome.requested.length} Teile, erster Termin ${formatDate(dueOn)}.`,
    },
    sourceCanonicalType: "Supplier",
    sourceCanonicalId: context.run.subjectId,
    decisionId: decisionTaskId(context, "questionnaire-dispatch"),
  };
});

registerPayloadBuilder("tprm.dispatch-request", (context) => {
  const outcome = requestOutcome(context);
  const localActionId = localResultId(context, "record-request", "actionId");
  if (!outcome.scope) return { unavailable: { en: "Record the request scope first.", de: "Erfassen Sie zuerst den Anforderungsumfang." } };
  if (!localActionId) {
    return { unavailable: { en: "Record the request as an action first; the GRC record cites it.", de: "Erfassen Sie die Anforderung zuerst als Massnahme; der GRC-Datensatz verweist darauf." } };
  }
  const name = supplierName(context);
  const first = outcome.requested[0];
  return {
    payload: {
      decisionId: decisionTaskId(context, "questionnaire-dispatch"),
      entityId: "ARC-DE",
      title: `Due diligence request for ${name}`,
      description: requestDescription(outcome),
      relatedObjectId: context.run.subjectId,
      relatedObjectKind: "supplier",
      kind: "evidence-request",
      dueOn: first?.dueOn ?? addDays(context.state.scenarioDate, 10),
      localActionId,
    },
    intentStatement: {
      en: `Dispatch the tailored due diligence request for ${name} through the GRC platform, citing ${localActionId}.`,
      de: `Die massgeschneiderte Anforderung fuer ${name} ueber das GRC-System versenden, mit Verweis auf ${localActionId}.`,
    },
    sourceCanonicalType: "Action",
    sourceCanonicalId: localActionId,
    decisionId: decisionTaskId(context, "questionnaire-dispatch"),
  };
});

/* ==========================================================================
   The evidence request list
   ========================================================================== */

registerArtifactBuilder("tprm.evidence-request-list", (context) => {
  const outcome = requestOutcome(context);
  const { profile, parts } = readParts(context, context.sources);
  const lines: Bilingual[] = [
    {
      en: `${outcome.requested.length} part(s) requested, ${outcome.scope?.parts.filter((entry) => entry.choice === "reuse").length ?? 0} reused, ${outcome.removedParts.length} removed`,
      de: `${outcome.requested.length} Teile angefordert, ${outcome.scope?.parts.filter((entry) => entry.choice === "reuse").length ?? 0} wiederverwendet, ${outcome.removedParts.length} entfernt`,
    },
    ...(outcome.removedDocumentIds.length > 0
      ? [{ en: `Withdrawn from the evidence review: ${outcome.removedDocumentIds.join(", ")}`, de: `Aus der Nachweispruefung zurueckgezogen: ${outcome.removedDocumentIds.join(", ")}` }]
      : []),
  ];
  return {
    label: { en: "Evidence request list", de: "Liste der Nachweisanforderungen" },
    content: {
      supplierId: context.run.subjectId,
      profile,
      scope: outcome.scope?.parts.map((entry) => ({
        ...entry,
        documentIds: parts.find((view) => view.part.id === entry.partId)?.docs.map((doc) => doc.id) ?? [],
      })) ?? [],
      additionalQuestions: outcome.scope?.additional ?? "",
      removedDocumentIds: outcome.removedDocumentIds,
      requestActionId: localResultId(context, "record-request", "actionId"),
      decision: decisionSummary(context, "questionnaire-dispatch"),
      tools: toolSummary(context),
      preparation: preparationSummary(context),
      recordLines: lines,
    },
  };
});

export const TPRM_TAILORED_DUE_DILIGENCE = { processId: PROCESS_ID, stageId: STAGE_ID } as const;
