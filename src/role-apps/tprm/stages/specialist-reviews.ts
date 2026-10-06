/**
 * TPRM Stage 5, Specialist Reviews.
 *
 * Registered under the keys the stage contract names:
 *
 *   one preparer           routing (which function must review, and whether
 *                          it has), consolidation (one list of the conditions
 *                          the functions set), disagreement (where two
 *                          functions' positions cannot both hold) and due
 *                          dates, read from the specialists' own documents
 *                          and the specialist review huddle
 *   one task form          each condition agreed or challenged with a date,
 *                          each conflict resolved or escalated, each pending
 *                          review dated, and the huddle record stated
 *   decision rules         no agreement while a condition is challenged or
 *                          a conflict is escalated; no escalation without one
 *   one payload builder    the escalation item on the NFR committee agenda
 *   one artifact builder   the consolidated opinions, which Stage 6 compares
 *                          clause by clause against the contract
 *
 * The huddle comes from the meeting lifecycle: whether the meeting was held
 * and whether its minutes are confirmed is read from what the Work Hub
 * recorded (`readSpecialistHuddles` in `./sources.ts`). A person may rely on
 * confirmed minutes; draft minutes are not a record, so the form refuses
 * "minutes confirmed" until they are.
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
import { getWorkRoleConfig } from "@/features/work/roles";
import { revealedEvidence, type EvidenceRow } from "@/role-apps/stage-support";
import {
  addDays,
  decisionSummary,
  decisionTaskId,
  formatDate,
  ILLUSTRATIVE,
  isIsoDate,
  joinList,
  PROCESS_ID,
  preparationSummary,
  recordedInput,
  recordsOf,
  supplierName,
  toIsoDate,
  toolSummary,
  withRegulatoryNote,
  type Sources,
} from "./shared";
import { entitiesInScope, procurementRequestDoc } from "./sources";

const STAGE_ID = "specialist-reviews";

/* ==========================================================================
   Reading the specialists' documents
   ========================================================================== */

const CONDITION = /^(?:CONDITION|Condition noted|Condition \([^)]*\)):\s*(.+)$/m;
const SIGN_OFF = /(?:Estimated sign-off date:|sign-off (?:is )?expected by)\s*(\d{2}\.\d{2}\.\d{4})/i;

interface Specialist {
  record: SourceRecord;
  doc: EvidenceRow | undefined;
  status: string;
  condition: string | null;
}

interface Item {
  id: string;
  kind: "condition" | "conflict" | "pending" | "huddle";
  label: Bilingual;
  detail: Bilingual;
  dueOn: string | null;
  evidenceIds: string[];
  /** For a conflict, the two functions whose positions differ. */
  sides?: [string, string];
}

function firstSentence(text: string): string {
  const sentence = /^(.+?\.)(\s|$)/.exec(text.trim())?.[1] ?? text.trim();
  return sentence.length > 260 ? `${sentence.slice(0, 257)}...` : sentence;
}

function readSpecialists(context: StageContext, sources: Sources): Specialist[] {
  const records = recordsOf(sources, "specialist-status");
  const docs = revealedEvidence(context.runId, context.state);
  return records.map((record) => {
    const doc = docs.find((candidate) => candidate.id === record.id);
    const match = doc ? CONDITION.exec(doc.body) : null;
    return { record, doc, status: String(record.facts?.status ?? record.value), condition: match?.[1] ? firstSentence(match[1]) : null };
  });
}

/** The date a condition is due by, from what it says it must precede. */
function conditionDue(context: StageContext, specialists: Specialist[], text: string): string {
  const signOff = specialists.map((specialist) => (specialist.doc ? SIGN_OFF.exec(`${specialist.doc.body}\n${specialist.doc.summary}`)?.[1] : undefined)).find(Boolean);
  if (/contract signature/i.test(text) && signOff) return toIsoDate(signOff);
  if (/ARC-CH joins|Arcadia Bank Schweiz AG/i.test(text)) {
    const request = procurementRequestDoc(context);
    const year = request ? /second quarter of (\d{4})/i.exec(request.body)?.[1] : undefined;
    if (year) return `${year}-03-31`;
  }
  return addDays(context.state.scenarioDate, 14);
}

const FUNCTIONS: Array<{ id: string; match: RegExp; label: Bilingual; required: (swiss: boolean) => boolean }> = [
  { id: "security", match: /Information Security|IT Security/i, label: { en: "Information Security", de: "Informationssicherheit" }, required: () => true },
  { id: "privacy", match: /Data Protection|Privacy/i, label: { en: "Data Protection", de: "Datenschutz" }, required: () => true },
  { id: "legal", match: /Legal/i, label: { en: "Legal", de: "Recht" }, required: () => true },
  { id: "compliance-ch", match: /Compliance/i, label: { en: "Compliance for ARC-CH", de: "Compliance fuer ARC-CH" }, required: (swiss) => swiss },
];

/** "1 Konflikt", "2 Konflikte". */
function count(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function statusDe(status: string): string {
  return status === "pending" ? "ausstehend" : status === "approved with condition" ? "genehmigt mit Bedingung" : status === "approved" ? "genehmigt" : status;
}

function huddleState(sources: Sources) {
  const records = recordsOf(sources, "specialist-huddle");
  const meeting = records.find((record) => record.facts?.kind === "meeting");
  const minutes = records.find((record) => record.facts?.kind === "minutes" && record.facts?.meetingId === meeting?.id);
  return { meeting, minutes, confirmed: minutes?.facts?.confirmed === true };
}

/** Every item the person must settle, in a stable order. */
function readItems(context: StageContext, sources: Sources): { specialists: Specialist[]; items: Item[]; swiss: boolean } {
  const specialists = readSpecialists(context, sources);
  const swiss = entitiesInScope(context).includes("ARC-CH");
  const items: Item[] = [];

  for (const specialist of specialists) {
    if (specialist.condition && specialist.status !== "pending") {
      items.push({
        id: `cond-${specialist.record.id}`,
        kind: "condition",
        label: { en: `${specialist.record.label}: condition`, de: `${specialist.record.label}: Bedingung` },
        detail: { en: withRegulatoryNote(specialist.condition, "en"), de: withRegulatoryNote(specialist.condition, "de") },
        dueOn: conditionDue(context, specialists, specialist.condition),
        evidenceIds: [specialist.record.id],
      });
    }
  }

  /* Disagreement: a site approved for all three entities against a requirement to process in Switzerland. */
  const allEntities = specialists.find((specialist) => specialist.doc && /approved for correspondence of all three entities|approved for all three entities/i.test(specialist.doc.body));
  const swissOnly = specialists.find((specialist) => specialist.doc && specialist !== allEntities && /processed in Switzerland/i.test(specialist.doc.body));
  if (allEntities && swissOnly) {
    items.push({
      id: "conflict-location",
      kind: "conflict",
      label: { en: "Conflict: where Swiss correspondence is processed", de: "Konflikt: wo Schweizer Korrespondenz verarbeitet wird" },
      detail: {
        en: `${allEntities.record.label} approves the supplier's site for all three entities; ${swissOnly.record.label} requires ARC-CH correspondence to be processed in Switzerland or a documented transfer basis.`,
        de: `${allEntities.record.label} genehmigt den Standort des Lieferanten fuer alle drei Gesellschaften; ${swissOnly.record.label} verlangt die Verarbeitung der ARC-CH-Korrespondenz in der Schweiz oder eine dokumentierte Uebermittlungsgrundlage.`,
      },
      dueOn: null,
      evidenceIds: [allEntities.record.id, swissOnly.record.id],
      sides: [allEntities.record.label, swissOnly.record.label],
    });
  }

  for (const specialist of specialists.filter((candidate) => candidate.status === "pending")) {
    const signOff = specialist.doc ? SIGN_OFF.exec(`${specialist.doc.body}\n${specialist.doc.summary}`)?.[1] : undefined;
    items.push({
      id: `pending-${specialist.record.id}`,
      kind: "pending",
      label: { en: `${specialist.record.label}: review pending`, de: `${specialist.record.label}: Pruefung ausstehend` },
      detail: {
        en: signOff ? `Sign-off expected by ${signOff}.` : "No sign-off date is stated.",
        de: signOff ? `Freigabe erwartet bis ${signOff}.` : "Kein Freigabetermin genannt.",
      },
      dueOn: signOff ? toIsoDate(signOff) : addDays(context.state.scenarioDate, 14),
      evidenceIds: [specialist.record.id],
    });
  }

  const huddle = huddleState(sources);
  items.push({
    id: "huddle",
    kind: "huddle",
    label: { en: "Specialist review huddle record", de: "Grundlage der Fachabstimmung" },
    detail: huddle.meeting
      ? {
          en: `${huddle.meeting.id} ${huddle.meeting.value}; minutes ${huddle.minutes ? huddle.minutes.value : "not drafted"}.`,
          de: `${huddle.meeting.id} ${huddle.meeting.facts?.held ? "abgehalten" : "geplant"}; Protokoll ${huddle.minutes ? (huddle.confirmed ? "bestaetigt" : "Entwurf, nicht bestaetigt") : "nicht erstellt"}.`,
        }
      : { en: "No huddle is on record.", de: "Keine Fachabstimmung erfasst." },
    dueOn: null,
    evidenceIds: [],
  });

  return { specialists, items, swiss };
}

/* ==========================================================================
   The preparer
   ========================================================================== */

function composeSpecialists(input: { context: StageContext; sources: Sources }): StagePreparationOutput {
  const { context, sources } = input;
  const { specialists, items, swiss } = readItems(context, sources);
  const name = supplierName(context);
  const huddle = huddleState(sources);

  const findings: StagePreparationOutput["findings"] = specialists.map((specialist) => ({
    sourceKey: "specialist-status",
    statement: {
      en: `${specialist.record.label}: ${specialist.status}${specialist.condition ? `. Condition: ${withRegulatoryNote(specialist.condition, "en")}` : "."}`,
      de: `${specialist.record.label}: ${statusDe(specialist.status)}${specialist.condition ? `. Bedingung laut Dokument: "${specialist.condition}"${/\b(DORA|EBA|FINMA)\b/.test(specialist.condition) ? ` ${ILLUSTRATIVE.de}` : ""}` : "."}`,
    },
    evidenceIds: [specialist.record.id],
    basis: specialist.status === "pending" ? "stakeholder-statement" : "approved-record",
  }));

  /* Routing: every function the arrangement needs, and whether it has reviewed. */
  const routed = FUNCTIONS.filter((fn) => fn.required(swiss)).map((fn) => ({ fn, specialist: specialists.find((specialist) => fn.match.test(specialist.record.label)) }));
  findings.push({
    sourceKey: "specialist-status",
    statement: {
      en: `Routing: ${routed.map((entry) => `${entry.fn.label.en} ${entry.specialist ? `(${entry.specialist.status})` : "(not routed)"}`).join(", ")}.`,
      de: `Weiterleitung: ${routed.map((entry) => `${entry.fn.label.de} ${entry.specialist ? `(${statusDe(entry.specialist.status)})` : "(nicht weitergeleitet)"}`).join(", ")}.`,
    },
    evidenceIds: routed.flatMap((entry) => (entry.specialist ? [entry.specialist.record.id] : [])).slice(0, 16),
    basis: "approved-record",
  });

  if (huddle.meeting) {
    findings.push({
      sourceKey: "specialist-huddle",
      statement: {
        en: `Huddle ${huddle.meeting.id} ${huddle.meeting.value}. Minutes ${huddle.minutes ? huddle.minutes.value : "not drafted"}.`,
        de: `Fachabstimmung ${huddle.meeting.id} ${huddle.meeting.facts?.held ? "abgehalten" : "geplant"}. Protokoll ${huddle.minutes ? (huddle.confirmed ? "bestaetigt" : "Entwurf, nicht bestaetigt") : "nicht erstellt"}.`,
      },
      evidenceIds: huddle.minutes?.evidenceIds ?? [],
      basis: huddle.confirmed ? "approved-record" : "stakeholder-statement",
    });
  }

  const gaps: StagePreparationOutput["gaps"] = routed
    .filter((entry) => !entry.specialist)
    .map((entry) => ({
      key: `not-routed-${entry.fn.id}`,
      statement: {
        en: `No ${entry.fn.label.en} review is on file. Route the file to ${entry.fn.label.en} before the contract stage.`,
        de: `Es liegt keine Pruefung ${entry.fn.label.de} vor. Leiten Sie die Akte vor der Vertragsstufe an ${entry.fn.label.de} weiter.`,
      },
      evidenceIds: [],
      severity: "material" as const,
    }));
  for (const item of items.filter((candidate) => candidate.kind === "pending")) {
    gaps.push({
      key: item.id,
      statement: {
        en: `${item.label.en}. ${item.detail.en} The contract stage cannot close it until the review returns.`,
        de: `${item.label.de}. ${item.detail.de} Die Vertragsstufe kann den Punkt erst nach Rueckkehr der Pruefung schliessen.`,
      },
      evidenceIds: item.evidenceIds,
      severity: "material",
    });
  }

  const conflicts = items.filter((item) => item.kind === "conflict");
  const contradictions: StagePreparationOutput["contradictions"] = conflicts.map((item) => ({ statement: item.detail, evidenceIds: item.evidenceIds }));

  const conditions = items.filter((item) => item.kind === "condition");
  const inferences: StagePreparationOutput["inferences"] = conditions.length > 0
    ? [
        {
          statement: {
            en: `Due dates: ${conditions.map((item) => `${item.label.en.replace(": condition", "")} by ${formatDate(item.dueOn)}`).join("; ")}.`,
            de: `Termine: ${conditions.map((item) => `${item.label.de.replace(": Bedingung", "")} bis ${formatDate(item.dueOn)}`).join("; ")}.`,
          },
          evidenceIds: conditions.flatMap((item) => item.evidenceIds).slice(0, 16),
          uncertainty: {
            en: "A condition due before contract signature takes the legal sign-off date; one due before ARC-CH joins takes the end of the quarter before it joins. Both are proposals.",
            de: "Eine Bedingung vor Vertragsunterzeichnung erhaelt den Termin der rechtlichen Freigabe; eine vor dem Beitritt von ARC-CH das Quartalsende davor. Beides sind Vorschlaege.",
          },
        },
      ]
    : [];

  const limitations: StagePreparationOutput["limitations"] = [
    {
      en: "Specialist conclusions are read from their own documents. This preparation does not substitute for any specialist review.",
      de: "Ergebnisse der Fachbereiche werden aus deren Dokumenten gelesen. Diese Vorbereitung ersetzt keine Fachpruefung.",
    },
  ];
  if (huddle.minutes && !huddle.confirmed) {
    limitations.push({
      en: `The huddle minutes ${huddle.minutes.id} are a draft. Positions in them are not a record until the minutes are confirmed in Meetings.`,
      de: `Das Protokoll ${huddle.minutes.id} ist ein Entwurf. Positionen darin sind erst nach Bestaetigung in den Besprechungen ein Datensatz.`,
    });
  }
  if (conflicts.length > 0) {
    limitations.push({
      en: "The conflict between specialist positions is yours to resolve or escalate, so no outcome is recommended.",
      de: "Den Konflikt zwischen den Positionen loesen oder eskalieren Sie, daher wird kein Ergebnis empfohlen.",
    });
  }

  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `${specialists.length} specialist function(s) on file for ${name}: ${conditions.length} condition(s) to agree, ${conflicts.length} conflict(s) between positions and ${items.filter((item) => item.kind === "pending").length} review(s) pending. ${huddle.meeting ? `The huddle ${huddle.meeting.facts?.held ? "was held" : "is scheduled"}; its minutes are ${huddle.confirmed ? "confirmed" : "not confirmed"}.` : "No huddle is on record."}`,
      de: `${count(specialists.length, "Fachbereich", "Fachbereiche")} zu ${name} erfasst: ${count(conditions.length, "Bedingung", "Bedingungen")} zu vereinbaren, ${count(conflicts.length, "Konflikt", "Konflikte")} zwischen Positionen und ${count(items.filter((item) => item.kind === "pending").length, "ausstehende Pruefung", "ausstehende Pruefungen")}. ${huddle.meeting ? `Die Fachabstimmung ${huddle.meeting.facts?.held ? "fand statt" : "ist geplant"}; das Protokoll ist ${huddle.confirmed ? "bestaetigt" : "nicht bestaetigt"}.` : "Keine Fachabstimmung erfasst."}`,
    },
    findings,
    inferences,
    contradictions,
    gaps,
    itemAssessments: items.map((item) => ({
      itemId: item.id,
      proposedDisposition: item.kind === "conflict" ? "outstanding" : item.kind === "pending" ? "outstanding" : "accept",
      note:
        item.kind === "condition"
          ? { en: `Agree, due ${formatDate(item.dueOn)}.`, de: `Zustimmen, faellig ${formatDate(item.dueOn)}.` }
          : item.kind === "conflict"
            ? { en: "Resolve: choose the position the contract follows, or escalate.", de: "Loesen: die Position waehlen, der der Vertrag folgt, oder eskalieren." }
            : item.kind === "pending"
              ? { en: `Carry into the contract stage, due ${formatDate(item.dueOn)}.`, de: `In die Vertragsstufe uebernehmen, faellig ${formatDate(item.dueOn)}.` }
              : huddle.confirmed
                ? { en: "Minutes confirmed.", de: "Protokoll bestaetigt." }
                : { en: "Rely on the written opinions; the minutes are not confirmed.", de: "Auf die schriftlichen Stellungnahmen stuetzen; das Protokoll ist nicht bestaetigt." },
    })),
    proposals: [],
    recommendedOptionId: conflicts.length > 0 ? null : "specialist-agree",
    limitations,
  };
}

const PROMPT = `You prepare Stage 5 (Specialist Reviews) of a third-party onboarding for a Third-Party Risk Manager at a synthetic bank.
Use only the source records provided. Route the file to each specialist function it needs and say which have returned; consolidate the conditions they set into one list with due dates; state where two functions' positions cannot both hold, citing both; read the huddle and whether its minutes are confirmed.
Never resolve a conflict between specialists. Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("tprm.specialist-reviews", {
  compose: (input) => composeSpecialists(input),
  prompt: ({ context, sources }) => ({
    instructions: PROMPT,
    input: JSON.stringify({
      supplier: context.run.subjectId,
      stage: context.stage.name,
      sources: sources.map((source) => ({ key: source.spec.key, status: source.status, records: source.result.records })),
      decisionOptions: ["specialist-agree", "specialist-escalate"],
      tools: context.stage.tools.map((tool) => tool.key),
      items: readItems(context, sources).items.map((item) => item.id),
    }),
  }),
  itemIds: ({ context, sources }) => readItems(context, sources).items.map((item) => item.id),
});

/* ==========================================================================
   The specialist conditions form
   ========================================================================== */

const CHOICES: Record<Item["kind"], readonly string[]> = {
  condition: ["agree", "challenge"],
  conflict: ["follow-a", "follow-b", "escalate"],
  pending: ["carry", "escalate"],
  huddle: ["minutes-confirmed", "written-opinions"],
};

const CHOICE_LABELS: Record<string, Bilingual> = {
  agree: { en: "Agree", de: "Zustimmen" },
  challenge: { en: "Challenge", de: "Widersprechen" },
  escalate: { en: "Escalate", de: "Eskalieren" },
  carry: { en: "Carry into the contract stage", de: "In die Vertragsstufe uebernehmen" },
  "minutes-confirmed": { en: "Minutes confirmed", de: "Protokoll bestaetigt" },
  "written-opinions": { en: "Positions from the written opinions", de: "Positionen aus den schriftlichen Stellungnahmen" },
};

function choiceLabel(item: Item, value: string, language: "en" | "de"): string {
  if (value === "follow-a" || value === "follow-b") {
    const side = item.sides?.[value === "follow-a" ? 0 : 1] ?? value;
    return language === "de" ? `${side} folgen` : `Follow ${side}`;
  }
  const label = CHOICE_LABELS[value];
  return label ? (language === "de" ? label.de : label.en) : value;
}

const conditionsSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        choice: z.string().min(1, { message: "Every specialist item needs a choice." }),
        note: z.string().max(600),
        dueOn: z.string().max(10),
      }),
    )
    .min(1),
});
type ConditionsInput = z.infer<typeof conditionsSchema>;

registerTaskForm<ConditionsInput>("tprm.specialist-conditions", {
  schema: conditionsSchema,
  fields: (context, language, current) => {
    const { items } = readItems(context, context.sources);
    const proposals = context.preparation.output?.itemAssessments ?? [];
    return {
      rows: items.map((item) => {
        const entry = current?.items.find((candidate) => candidate.itemId === item.id);
        const proposal = proposals.find((candidate) => candidate.itemId === item.id);
        const detail = language === "de" ? item.detail.de : item.detail.en;
        const hint = proposal ? (language === "de" ? proposal.note.de : proposal.note.en) : null;
        return {
          id: item.id,
          label: language === "de" ? item.label.de : item.label.en,
          detail: hint ? `${detail} ${language === "de" ? "KI-Vorschlag" : "AI proposal"}: ${hint}` : detail,
          choice: {
            name: `spec:${item.id}`,
            options: CHOICES[item.kind].map((value) => ({ value, label: choiceLabel(item, value, language) })),
            value: entry?.choice ?? "",
          },
          note: { name: `note:${item.id}`, value: entry?.note ?? "", placeholder: language === "de" ? "Begruendung" : "Reason" },
          date:
            item.kind === "condition" || item.kind === "pending"
              ? { name: `due:${item.id}`, value: entry?.dueOn ?? item.dueOn ?? "", label: language === "de" ? "Faellig am" : "Due by" }
              : null,
        };
      }),
      overall: null,
    };
  },
  fromFormData: (data, context) => ({
    items: readItems(context, context.sources).items.map((item) => ({
      itemId: item.id,
      choice: String(data.get(`spec:${item.id}`) ?? ""),
      note: String(data.get(`note:${item.id}`) ?? "").trim(),
      dueOn: toIsoDate(String(data.get(`due:${item.id}`) ?? "")),
    })),
  }),
  validate: (context, input) => {
    const problems: Bilingual[] = [];
    const { items } = readItems(context, context.sources);
    const huddle = huddleState(context.sources);
    for (const item of items) {
      const entry = input.items.find((candidate) => candidate.itemId === item.id);
      if (!entry || !CHOICES[item.kind].includes(entry.choice)) {
        problems.push({ en: `${item.label.en} needs a choice.`, de: `${item.label.de} braucht eine Auswahl.` });
        continue;
      }
      if ((item.kind === "condition" && entry.choice === "agree") || (item.kind === "pending" && entry.choice === "carry")) {
        if (!isIsoDate(entry.dueOn)) problems.push({ en: `${item.label.en} needs a due date.`, de: `${item.label.de} braucht einen Termin.` });
        else if (entry.dueOn < context.state.scenarioDate) problems.push({ en: `The due date for ${item.label.en} is in the past.`, de: `Der Termin fuer ${item.label.de} liegt in der Vergangenheit.` });
      }
      if ((entry.choice === "challenge" || item.kind === "conflict" || entry.choice === "escalate") && entry.note.length < 10) {
        problems.push({ en: `Write the reason for ${item.label.en.toLowerCase()}.`, de: `Schreiben Sie die Begruendung zu ${item.label.de}.` });
      }
      if (item.kind === "huddle" && entry.choice === "minutes-confirmed" && !huddle.confirmed) {
        problems.push({
          en: "The huddle minutes are not confirmed. Confirm them in Meetings first, or rely on the written opinions.",
          de: "Das Protokoll der Fachabstimmung ist nicht bestaetigt. Bestaetigen Sie es zuerst in den Besprechungen, oder stuetzen Sie sich auf die schriftlichen Stellungnahmen.",
        });
      }
    }
    return problems;
  },
  defaults: (context) => {
    if (!context.preparation.output) return null;
    const { items } = readItems(context, context.sources);
    const huddle = huddleState(context.sources);
    return {
      items: items.map((item) => ({
        itemId: item.id,
        choice:
          item.kind === "condition" ? "agree" : item.kind === "conflict" ? "follow-b" : item.kind === "pending" ? "carry" : huddle.confirmed ? "minutes-confirmed" : "written-opinions",
        note: item.kind === "conflict" ? "Swiss correspondence stays in Switzerland until a transfer basis is documented." : "",
        dueOn: item.dueOn ?? "",
      })),
    };
  },
  summarise: (context, input) => {
    const { items } = readItems(context, context.sources);
    return input.items.map((entry) => {
      const item = items.find((candidate) => candidate.id === entry.itemId);
      const label = item?.label ?? { en: entry.itemId, de: entry.itemId };
      const choice = item ? { en: choiceLabel(item, entry.choice, "en"), de: choiceLabel(item, entry.choice, "de") } : { en: entry.choice, de: entry.choice };
      const due = entry.dueOn && (entry.choice === "agree" || entry.choice === "carry") ? ` (${formatDate(entry.dueOn)})` : "";
      return { en: `${label.en}: ${choice.en.toLowerCase()}${due}`, de: `${label.de}: ${choice.de.toLowerCase()}${due}` };
    });
  },
});

function recordedConditions(context: StageContext): ConditionsInput | null {
  return recordedInput(context, "specialist-conditions", conditionsSchema);
}

function openItems(context: StageContext) {
  const recorded = recordedConditions(context);
  return (recorded?.items ?? []).filter((entry) => entry.choice === "challenge" || entry.choice === "escalate");
}

/* ==========================================================================
   Decision rules
   ========================================================================== */

registerDecisionRules(PROCESS_ID, STAGE_ID, {
  validateOption: (context, decisionKey, optionId) => {
    if (decisionKey !== "specialist-escalation") return null;
    if (!recordedConditions(context)) {
      return { en: "Record the specialist conditions before the decision.", de: "Erfassen Sie die Bedingungen der Fachbereiche vor der Entscheidung." };
    }
    const open = openItems(context);
    if (optionId === "specialist-agree" && open.length > 0) {
      return {
        en: `The conditions cannot be agreed while ${open.map((entry) => entry.itemId).join(", ")} is challenged or escalated. Escalate instead.`,
        de: `Die Bedingungen koennen nicht vereinbart werden, solange ${open.map((entry) => entry.itemId).join(", ")} bestritten oder eskaliert ist. Eskalieren Sie stattdessen.`,
      };
    }
    if (optionId === "specialist-escalate" && open.length === 0) {
      return {
        en: "Nothing is challenged or escalated, so there is nothing to escalate. Agree the conditions instead.",
        de: "Nichts ist bestritten oder eskaliert, daher gibt es nichts zu eskalieren. Vereinbaren Sie die Bedingungen.",
      };
    }
    return null;
  },
  consequences: (_context, decisionKey, optionId) => {
    if (decisionKey !== "specialist-escalation") return [];
    return optionId === "specialist-agree"
      ? [
          { en: "Carry every agreed condition, with its due date, into the contract stage", de: "Jede vereinbarte Bedingung mit Termin in die Vertragsstufe uebernehmen" },
          { en: "Store the consolidated specialist opinions", de: "Die zusammengefuehrten Fachstellungnahmen speichern" },
          { en: "Allow the stage to complete and open Contract and Conditions", de: "Den Abschluss der Stufe erlauben und Vertrag und Bedingungen oeffnen" },
        ]
      : [
          { en: "Put the challenged condition on the NFR committee agenda, under your approval", de: "Die bestrittene Bedingung mit Ihrer Genehmigung auf die Agenda des NFR-Komitees setzen" },
          { en: "Hold the file at Stage 5 until the escalation is answered", de: "Die Akte in Stufe 5 halten, bis die Eskalation beantwortet ist" },
        ];
  },
});

/* ==========================================================================
   The escalation
   ========================================================================== */

registerPayloadBuilder("tprm.escalate-condition", (context) => {
  const open = openItems(context);
  if (open.length === 0) {
    return { unavailable: { en: "Nothing is challenged or escalated.", de: "Nichts ist bestritten oder eskaliert." } };
  }
  const name = supplierName(context);
  const route = getWorkRoleConfig("tprm")?.professionalActions.escalation;
  return {
    payload: {
      decisionId: decisionTaskId(context, "specialist-escalation"),
      entityId: "ARC-DE",
      title: `Escalation: specialist condition on ${name}`,
      summary: open.map((entry) => `${entry.itemId}: ${entry.note}`).join("; "),
      itemType: "escalation",
      relatedObjectKind: "supplier",
      relatedObjectId: context.run.subjectId,
      ...(route ? { committeeRef: route.committeeRef, committeeName: route.committeeName, meetingDate: route.meetingDate } : {}),
    },
    intentStatement: {
      en: `Put ${open.length} challenged specialist item(s) on ${name} on the ${route?.committeeName ?? "NFR committee"} agenda.`,
      de: `${open.length} bestrittene Punkte der Fachbereiche zu ${name} auf die Agenda von ${route?.committeeName ?? "NFR-Komitee"} setzen.`,
    },
    sourceCanonicalType: "Supplier",
    sourceCanonicalId: context.run.subjectId,
    decisionId: decisionTaskId(context, "specialist-escalation"),
  };
});

/* ==========================================================================
   The consolidated opinions
   ========================================================================== */

registerArtifactBuilder("tprm.specialist-opinions", (context) => {
  const { specialists, items } = readItems(context, context.sources);
  const recorded = recordedConditions(context);
  const huddle = huddleState(context.sources);
  const resolved = items.map((item) => {
    const entry = recorded?.items.find((candidate) => candidate.itemId === item.id);
    return {
      id: item.id,
      kind: item.kind,
      text: item.detail.en,
      evidenceIds: item.evidenceIds,
      choice: entry?.choice ?? null,
      note: entry?.note ?? "",
      dueOn: entry && (entry.choice === "agree" || entry.choice === "carry") ? entry.dueOn : null,
      sides: item.sides ?? null,
    };
  });
  const agreed = resolved.filter((entry) => entry.choice === "agree" || entry.choice === "carry" || entry.choice === "follow-a" || entry.choice === "follow-b");
  return {
    label: { en: "Consolidated specialist opinions", de: "Zusammengefuehrte Fachstellungnahmen" },
    content: {
      supplierId: context.run.subjectId,
      specialists: specialists.map((specialist) => ({ id: specialist.record.id, function: specialist.record.label, status: specialist.status, condition: specialist.condition })),
      items: resolved,
      huddle: huddle.meeting
        ? { meetingId: huddle.meeting.id, held: huddle.meeting.facts?.held === true, minutesId: huddle.minutes?.id ?? null, minutesConfirmed: huddle.confirmed }
        : null,
      decision: decisionSummary(context, "specialist-escalation"),
      tools: toolSummary(context),
      preparation: preparationSummary(context),
      recordLines: [
        {
          en: `${agreed.length} of ${resolved.filter((entry) => entry.kind !== "huddle").length} item(s) agreed or resolved: ${joinList(agreed.map((entry) => entry.id), "and")}`,
          de: `${agreed.length} von ${resolved.filter((entry) => entry.kind !== "huddle").length} Punkten vereinbart oder geloest: ${joinList(agreed.map((entry) => entry.id), "und")}`,
        },
        huddle.meeting
          ? { en: `Huddle ${huddle.meeting.id}: minutes ${huddle.confirmed ? "confirmed" : "not confirmed"}`, de: `Fachabstimmung ${huddle.meeting.id}: Protokoll ${huddle.confirmed ? "bestaetigt" : "nicht bestaetigt"}` }
          : { en: "No huddle on record", de: "Keine Fachabstimmung erfasst" },
      ],
    },
  };
});

export const TPRM_SPECIALIST_REVIEWS = { processId: PROCESS_ID, stageId: STAGE_ID } as const;
