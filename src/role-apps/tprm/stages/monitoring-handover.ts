/**
 * TPRM Stage 8, Handover to Monitoring.
 *
 * Registered under the keys the stage contract names:
 *
 *   one preparer           the remaining conditions, the proposed monitoring
 *                          intensity and first check, the next reassessment,
 *                          the handover message and the register update
 *   one task form          the monitoring owner, the first check and the
 *                          reassessment dates, and for every open condition
 *                          whether it is carried into monitoring or must
 *                          close before the handover
 *   decision rules         the intensity must fit the first check date; a
 *                          condition that must close first blocks the plan
 *                          while it is open; closing without monitoring only
 *                          for a rejected onboarding
 *   four payload builders  the monitoring plan, the register update in the
 *                          GRC platform (through the outbox), the handover
 *                          message and the closure message
 *   one artifact builder   the monitoring plan record, the last record of
 *                          the file
 *
 * Completing this stage completes the process: the engine closes the run
 * and publishes "process completed" to the event backbone, which Home and
 * the onboarding pipeline read.
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
import {
  addDays,
  decisionSummary,
  decisionTaskId,
  entityRefs,
  formatDate,
  isIsoDate,
  joinList,
  localResultId,
  openActionsFor,
  PROCESS_ID,
  preparationSummary,
  recordedInput,
  recordsOf,
  regulatoryContext,
  stageRecord,
  supplierName,
  supplierRow,
  toIsoDate,
  toolSummary,
  type Sources,
} from "./shared";
import { entitiesInScope } from "./sources";

const STAGE_ID = "handover-to-monitoring";
const DECISION = "monitoring-intensity";

/** The people who may own the monitoring of a supplier in this scenario. */
const OWNERS: Array<{ id: string; label: Bilingual }> = [
  { id: "P-002", label: { en: "Stefan Brunner, Third-Party Risk Manager", de: "Stefan Brunner, Third-Party Risk Manager" } },
  { id: "P-010", label: { en: "Lukas Wiesinger, Group Procurement", de: "Lukas Wiesinger, Konzerneinkauf" } },
];

/* ==========================================================================
   Reading the file
   ========================================================================== */

function approvalOf(context: StageContext): string | null {
  const record = stageRecord(context.runId, context.run.id, "decision-and-onboarding", "approval-record");
  const decision = (record?.decision ?? null) as { optionId?: string | null } | null;
  return decision?.optionId ?? null;
}

function readFile(context: StageContext, sources: Sources) {
  const file = recordsOf(sources, "onboarding-file");
  const conditions = file.filter((record) => record.facts?.kind === "condition");
  const monitoring = file.filter((record) => record.facts?.kind === "monitoring");
  const supplier = supplierRow(context.runId, context.run.subjectId);
  const memo = stageRecord(context.runId, context.run.id, "classification-and-criticality", "classification-memo");
  const criticality = ((memo?.judgment ?? null) as Record<string, string> | null)?.criticality ?? supplier?.criticality ?? "standard";
  const approval = approvalOf(context);
  const rejected = approval === "onboarding-reject";
  const intensity = criticality === "standard" ? "monitoring-semiannual" : "monitoring-quarterly";
  const months = intensity === "monitoring-quarterly" ? 3 : 6;
  const earliestCondition = conditions.map((record) => String(record.facts?.dueOn ?? "")).filter(isIsoDate).sort()[0] ?? null;
  const cycle = addDays(context.state.scenarioDate, months === 3 ? 90 : 180);
  const firstCheck = earliestCondition && earliestCondition < cycle ? earliestCondition : cycle;
  const reassessment = addDays(context.state.scenarioDate, criticality === "standard" ? 730 : 365);
  return { conditions, monitoring, supplier, criticality, approval, rejected, intensity, months, firstCheck, reassessment };
}

/* ==========================================================================
   The preparer
   ========================================================================== */

function composeHandover(input: { context: StageContext; sources: Sources }): StagePreparationOutput {
  const { context, sources } = input;
  const file = readFile(context, sources);
  const name = supplierName(context);
  const entities = entityRefs(context.runId, entitiesInScope(context));

  if (file.rejected) {
    return {
      schemaVersion: "stage-preparation-v1",
      summary: {
        en: `The onboarding of ${name} was rejected at Stage 7. There is nothing to hand over: close the file and tell the business.`,
        de: `Das Onboarding von ${name} wurde in Stufe 7 abgelehnt. Es gibt nichts zu uebergeben: Schliessen Sie die Akte und informieren Sie die Fachseite.`,
      },
      findings: [],
      inferences: [],
      contradictions: [],
      gaps: [],
      itemAssessments: [],
      proposals: [{ toolKey: "send-closure-note", rationale: { en: "The business is told the file is closed.", de: "Die Fachseite erfaehrt, dass die Akte geschlossen ist." } }],
      recommendedOptionId: "monitoring-close",
      limitations: [],
    };
  }

  const findings: StagePreparationOutput["findings"] = [
    {
      sourceKey: "supplier-record",
      statement: {
        en: `${name} is recorded as ${file.supplier?.status ?? "unknown"} with ${file.criticality} criticality.`,
        de: `${name} ist als ${file.supplier?.status === "active" ? "aktiv" : (file.supplier?.status ?? "unbekannt")} mit Kritikalitaet ${file.criticality === "standard" ? "Standard" : file.criticality === "important" ? "wichtig" : "kritisch"} erfasst.`,
      },
      evidenceIds: [],
      basis: "approved-record",
    },
    ...file.conditions.map((record) => ({
      sourceKey: "onboarding-file",
      statement: {
        en: `Remaining condition ${record.id}: ${record.label}, ${record.value}.`,
        de: `Offene Bedingung ${record.id}: ${record.label}, ${record.facts?.dueOn ? `faellig ${formatDate(String(record.facts.dueOn))}` : "ohne Termin"}.`,
      },
      evidenceIds: [],
      basis: "approved-record" as const,
    })),
    ...file.monitoring.map((record) => ({
      sourceKey: "onboarding-file",
      statement: { en: `Monitoring on record: ${record.id}, ${record.value}.`, de: `Erfasste Ueberwachung: ${record.id}, ${String(record.facts?.frequency ?? "")}.` },
      evidenceIds: [],
      basis: "approved-record" as const,
    })),
  ];
  for (const statement of regulatoryContext(entities, "monitoring")) {
    findings.push({ sourceKey: "supplier-record", statement, evidenceIds: [], basis: "approved-record" });
  }

  const inferences: StagePreparationOutput["inferences"] = [
    {
      statement: {
        en: `Monitoring: ${file.months === 3 ? "quarterly" : "semi-annual"} for a ${file.criticality} supplier, first check ${formatDate(file.firstCheck)}${file.conditions.length > 0 ? ", no later than the earliest condition date" : ""}. Reassessment: ${formatDate(file.reassessment)}.`,
        de: `Ueberwachung: ${file.months === 3 ? "quartalsweise" : "halbjaehrlich"} fuer einen Lieferanten mit Kritikalitaet ${file.criticality === "standard" ? "Standard" : file.criticality === "important" ? "wichtig" : "kritisch"}, erste Pruefung ${formatDate(file.firstCheck)}${file.conditions.length > 0 ? ", spaetestens zum fruehesten Bedingungstermin" : ""}. Neubewertung: ${formatDate(file.reassessment)}.`,
      },
      evidenceIds: [],
      uncertainty: {
        en: "The intensity follows the criticality on record; the first check date is a professional judgment, not a default.",
        de: "Die Intensitaet folgt der erfassten Kritikalitaet; der Termin der ersten Pruefung ist eine fachliche Beurteilung, kein Standardwert.",
      },
    },
    {
      statement: {
        en: `Communications: tell the monitoring owner and Group Procurement that ${name} is active, which conditions remain and when the first check is. Register update: next assessment ${formatDate(file.reassessment)} and the monitoring plan on the GRC supplier record.`,
        de: `Kommunikation: Die Ueberwachungsverantwortung und den Konzerneinkauf informieren, dass ${name} aktiv ist, welche Bedingungen offen sind und wann die erste Pruefung stattfindet. Registeraktualisierung: naechste Bewertung ${formatDate(file.reassessment)} und der Ueberwachungsplan im GRC-Lieferantendatensatz.`,
      },
      evidenceIds: [],
      uncertainty: { en: "The message is drafted from the file; you approve it before it is sent.", de: "Die Nachricht wird aus der Akte entworfen; Sie genehmigen sie vor dem Versand." },
    },
  ];

  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `Handover of ${name} to monitoring: ${file.conditions.length} condition(s) remain open, proposed ${file.months === 3 ? "quarterly" : "semi-annual"} monitoring with a first check on ${formatDate(file.firstCheck)}, and a reassessment on ${formatDate(file.reassessment)}.`,
      de: `Uebergabe von ${name} an das Monitoring: ${file.conditions.length} Bedingungen bleiben offen, vorgeschlagen ist eine ${file.months === 3 ? "quartalsweise" : "halbjaehrliche"} Ueberwachung mit erster Pruefung am ${formatDate(file.firstCheck)} und eine Neubewertung am ${formatDate(file.reassessment)}.`,
    },
    findings,
    inferences,
    contradictions: [],
    gaps: [],
    itemAssessments: file.conditions.map((record) => ({
      itemId: record.id,
      proposedDisposition: "accept" as const,
      note: { en: "Carry into monitoring with its date.", de: "Mit Termin in die Ueberwachung uebernehmen." },
    })),
    proposals: [
      { toolKey: "activate-monitoring-plan", rationale: { en: "The plan sets the intensity, the owner and the first check.", de: "Der Plan legt Intensitaet, Verantwortung und erste Pruefung fest." } },
      { toolKey: "update-register", rationale: { en: "The register carries the next assessment and the plan.", de: "Das Register fuehrt die naechste Bewertung und den Plan." } },
      { toolKey: "send-handover-note", rationale: { en: "The owner and procurement are told what they now hold.", de: "Verantwortung und Einkauf erfahren, was sie nun halten." } },
    ],
    recommendedOptionId: file.intensity,
    limitations: [],
  };
}

const PROMPT = `You prepare Stage 8 (Handover to Monitoring) of a third-party onboarding for a Third-Party Risk Manager at a synthetic bank.
Use only the source records provided. List the remaining conditions; propose the monitoring intensity and the first check; propose the reassessment date; draft the handover communication; state the register update. DORA may be named only for ARC-DE and ARC-AT; FINMA only for ARC-CH. Every statement that names a framework ends with "Illustrative regulatory context, not legal advice."
The person decides the intensity, the owner and the remaining conditions. Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("tprm.monitoring-handover", {
  compose: (input) => composeHandover(input),
  prompt: ({ context, sources }) => ({
    instructions: PROMPT,
    input: JSON.stringify({
      supplier: context.run.subjectId,
      stage: context.stage.name,
      sources: sources.map((source) => ({ key: source.spec.key, status: source.status, records: source.result.records })),
      decisionOptions: ["monitoring-quarterly", "monitoring-semiannual", "monitoring-close"],
      tools: context.stage.tools.map((tool) => tool.key),
      items: recordsOf(sources, "onboarding-file").filter((record) => record.facts?.kind === "condition").map((record) => record.id),
    }),
  }),
  itemIds: ({ sources }) => recordsOf(sources, "onboarding-file").filter((record) => record.facts?.kind === "condition").map((record) => record.id),
});

/* ==========================================================================
   The handover plan form
   ========================================================================== */

const planSchema = z.object({
  owner: z.string().min(1, { message: "Name the monitoring owner." }),
  firstCheck: z.string().max(10),
  reassessment: z.string().max(10),
  conditions: z.array(z.object({ actionId: z.string().min(1), choice: z.enum(["carry", "close-first"], { message: "Every open condition needs a choice." }), note: z.string().max(600) })),
  note: z.string().max(1200),
});
type PlanInput = z.infer<typeof planSchema>;

function conditionRecords(context: StageContext): SourceRecord[] {
  return recordsOf(context.sources, "onboarding-file").filter((record) => record.facts?.kind === "condition");
}

registerTaskForm<PlanInput>("tprm.handover-plan", {
  schema: planSchema,
  fields: (context, language, current) => {
    const file = readFile(context, context.sources);
    const de = language === "de";
    return {
      rows: [
        {
          id: "owner",
          label: de ? "Verantwortung fuer die Ueberwachung" : "Monitoring owner",
          detail: de ? "Die Person, die die Ueberwachung verantwortet. Verantwortung kann uebertragen, nie entfernt werden." : "The person accountable for the monitoring. Accountability can be transferred, never removed.",
          choice: { name: "owner", options: OWNERS.map((owner) => ({ value: owner.id, label: de ? owner.label.de : owner.label.en })), value: current?.owner ?? "" },
          note: null,
          date: null,
        },
        {
          id: "first-check",
          label: de ? "Erste Pruefung" : "First check",
          detail: `${de ? "KI-Vorschlag" : "AI proposal"}: ${formatDate(file.firstCheck)}`,
          choice: { name: "first-check-set", options: [{ value: "set", label: de ? "Termin festgelegt" : "Date set" }], value: current ? "set" : "" },
          note: null,
          date: { name: "first-check", value: current?.firstCheck ?? "", label: de ? "Am" : "On" },
        },
        {
          id: "reassessment",
          label: de ? "Naechste Neubewertung" : "Next reassessment",
          detail: `${de ? "KI-Vorschlag" : "AI proposal"}: ${formatDate(file.reassessment)}`,
          choice: { name: "reassessment-set", options: [{ value: "set", label: de ? "Termin festgelegt" : "Date set" }], value: current ? "set" : "" },
          note: null,
          date: { name: "reassessment", value: current?.reassessment ?? "", label: de ? "Am" : "On" },
        },
        ...file.conditions.map((record) => {
          const entry = current?.conditions.find((candidate) => candidate.actionId === record.id);
          return {
            id: record.id,
            label: `${record.id} ${record.label}`,
            detail: `${record.value}. ${de ? "KI-Vorschlag: mit Termin in die Ueberwachung uebernehmen." : "AI proposal: carry into monitoring with its date."}`,
            choice: {
              name: `condition:${record.id}`,
              options: [
                { value: "carry", label: de ? "In die Ueberwachung uebernehmen" : "Carry into monitoring" },
                { value: "close-first", label: de ? "Vor der Uebergabe schliessen" : "Must close before the handover" },
              ],
              value: entry?.choice ?? "",
            },
            note: { name: `note:${record.id}`, value: entry?.note ?? "", placeholder: de ? "Begruendung" : "Reason" },
            date: null,
          };
        }),
      ],
      overall: { name: "note", value: current?.note ?? "", label: de ? "Hinweis fuer die Uebergabe (optional)" : "Note for the handover (optional)" },
    };
  },
  fromFormData: (data, context) => ({
    owner: String(data.get("owner") ?? ""),
    firstCheck: toIsoDate(String(data.get("first-check") ?? "")),
    reassessment: toIsoDate(String(data.get("reassessment") ?? "")),
    conditions: conditionRecords(context).map((record) => ({ actionId: record.id, choice: String(data.get(`condition:${record.id}`) ?? ""), note: String(data.get(`note:${record.id}`) ?? "").trim() })),
    note: String(data.get("note") ?? "").trim(),
  }),
  validate: (context, input) => {
    const problems: Bilingual[] = [];
    if (!OWNERS.some((owner) => owner.id === input.owner)) problems.push({ en: "Name the monitoring owner.", de: "Benennen Sie die Verantwortung fuer die Ueberwachung." });
    for (const [value, label] of [
      [input.firstCheck, { en: "The first check", de: "Die erste Pruefung" }],
      [input.reassessment, { en: "The next reassessment", de: "Die naechste Neubewertung" }],
    ] as const) {
      if (!isIsoDate(value)) problems.push({ en: `${label.en} needs a date.`, de: `${label.de} braucht einen Termin.` });
      else if (value <= context.state.scenarioDate) problems.push({ en: `${label.en} must be after today.`, de: `${label.de} muss nach heute liegen.` });
    }
    if (isIsoDate(input.firstCheck) && isIsoDate(input.reassessment) && input.reassessment <= input.firstCheck) {
      problems.push({ en: "The reassessment must come after the first check.", de: "Die Neubewertung muss nach der ersten Pruefung liegen." });
    }
    for (const record of conditionRecords(context)) {
      if (!input.conditions.some((entry) => entry.actionId === record.id)) {
        problems.push({ en: `${record.id} needs a choice.`, de: `${record.id} braucht eine Auswahl.` });
      }
    }
    return problems;
  },
  defaults: (context) => {
    if (!context.preparation.output) return null;
    const file = readFile(context, context.sources);
    return {
      owner: "P-002",
      firstCheck: file.firstCheck,
      reassessment: file.reassessment,
      conditions: file.conditions.map((record) => ({ actionId: record.id, choice: "carry" as const, note: "" })),
      note: "",
    };
  },
  summarise: (_context, input) => {
    const owner = OWNERS.find((candidate) => candidate.id === input.owner);
    return [
      { en: `Owner: ${owner?.label.en ?? input.owner}`, de: `Verantwortung: ${owner?.label.de ?? input.owner}` },
      { en: `First check: ${formatDate(input.firstCheck)}; reassessment: ${formatDate(input.reassessment)}`, de: `Erste Pruefung: ${formatDate(input.firstCheck)}; Neubewertung: ${formatDate(input.reassessment)}` },
      ...input.conditions.map((entry) => ({
        en: `${entry.actionId}: ${entry.choice === "carry" ? "carried into monitoring" : "must close before the handover"}`,
        de: `${entry.actionId}: ${entry.choice === "carry" ? "in die Ueberwachung uebernommen" : "vor der Uebergabe zu schliessen"}`,
      })),
    ];
  },
});

function recordedPlan(context: StageContext): PlanInput | null {
  return recordedInput(context, "handover-plan", planSchema);
}

/* ==========================================================================
   Decision rules
   ========================================================================== */

registerDecisionRules(PROCESS_ID, STAGE_ID, {
  validateOption: (context, decisionKey, optionId) => {
    if (decisionKey !== DECISION) return null;
    const file = readFile(context, context.sources);
    if (optionId === "monitoring-close") {
      return file.rejected
        ? null
        : { en: "The file can close without monitoring only when the onboarding was rejected.", de: "Die Akte kann nur ohne Ueberwachung schliessen, wenn das Onboarding abgelehnt wurde." };
    }
    if (file.rejected) {
      return { en: "The onboarding was rejected; there is nothing to monitor. Close the file.", de: "Das Onboarding wurde abgelehnt; es gibt nichts zu ueberwachen. Schliessen Sie die Akte." };
    }
    const plan = recordedPlan(context);
    if (!plan) return { en: "Record the owner, the dates and the remaining conditions first.", de: "Erfassen Sie zuerst Verantwortung, Termine und offene Bedingungen." };
    const limit = addDays(context.state.scenarioDate, optionId === "monitoring-quarterly" ? 92 : 183);
    if (plan.firstCheck > limit) {
      return {
        en: `The first check on ${formatDate(plan.firstCheck)} is later than ${optionId === "monitoring-quarterly" ? "three" : "six"} months away (${formatDate(limit)}). Bring it forward, or choose the other intensity.`,
        de: `Die erste Pruefung am ${formatDate(plan.firstCheck)} liegt spaeter als in ${optionId === "monitoring-quarterly" ? "drei" : "sechs"} Monaten (${formatDate(limit)}). Ziehen Sie sie vor oder waehlen Sie die andere Intensitaet.`,
      };
    }
    const open = new Set(openActionsFor(context.runId, context.run.subjectId).map((action) => action.id));
    const blocking = plan.conditions.filter((entry) => entry.choice === "close-first" && open.has(entry.actionId));
    if (blocking.length > 0) {
      return {
        en: `${blocking.map((entry) => entry.actionId).join(", ")} must close before the handover and is still open. Close it in Work, or carry it into monitoring.`,
        de: `${blocking.map((entry) => entry.actionId).join(", ")} muss vor der Uebergabe geschlossen sein und ist noch offen. Schliessen Sie es in der Arbeit oder uebernehmen Sie es in die Ueberwachung.`,
      };
    }
    return null;
  },
  consequences: (context, decisionKey, optionId) => {
    if (decisionKey !== DECISION) return [];
    if (optionId === "monitoring-close") {
      return [
        { en: "Tell the business the file is closed without onboarding", de: "Der Fachseite mitteilen, dass die Akte ohne Onboarding geschlossen ist" },
        { en: "Complete the process", de: "Den Prozess abschliessen" },
      ];
    }
    const plan = recordedPlan(context);
    return [
      {
        en: `Activate ${optionId === "monitoring-quarterly" ? "quarterly" : "semi-annual"} monitoring${plan ? ` with a first check on ${formatDate(plan.firstCheck)}` : ""}, under your approval`,
        de: `Eine ${optionId === "monitoring-quarterly" ? "quartalsweise" : "halbjaehrliche"} Ueberwachung${plan ? ` mit erster Pruefung am ${formatDate(plan.firstCheck)}` : ""} aktivieren, mit Ihrer Genehmigung`,
      },
      { en: "Update the supplier record in the GRC third-party register through the outbox", de: "Den Lieferantendatensatz ueber den Postausgang im GRC-Drittparteienregister aktualisieren" },
      { en: "Send the handover message to the owner and Group Procurement", de: "Die Uebergabenachricht an die Verantwortung und den Konzerneinkauf senden" },
      { en: "Complete the process and close the onboarding case", de: "Den Prozess abschliessen und den Onboarding-Fall schliessen" },
    ];
  },
});

/* ==========================================================================
   Payload builders
   ========================================================================== */

function planned(context: StageContext) {
  const plan = recordedPlan(context);
  const decision = context.decisions.find((state) => state.spec.key === DECISION);
  const frequency = decision?.chosenOptionId === "monitoring-quarterly" ? "quarterly" : "semi-annual";
  const owner = OWNERS.find((candidate) => candidate.id === plan?.owner);
  return { plan, frequency, owner, decisionId: decisionTaskId(context, DECISION) };
}

registerPayloadBuilder("tprm.activate-monitoring-plan", (context) => {
  const { plan, frequency, owner, decisionId } = planned(context);
  if (!plan) return { unavailable: { en: "Record the handover plan first.", de: "Erfassen Sie zuerst den Uebergabeplan." } };
  const name = supplierName(context);
  const carried = plan.conditions.filter((entry) => entry.choice === "carry").map((entry) => entry.actionId);
  return {
    payload: {
      decisionId,
      entityId: supplierRow(context.runId, context.run.subjectId)?.contractingEntityIds[0] ?? "ARC-DE",
      subjectId: context.run.subjectId,
      subjectKind: "supplier",
      kind: "monitoring-plan",
      description: `Monitoring plan for ${name}: ${frequency}, owned by ${owner?.label.en ?? plan.owner}. Reassessment ${formatDate(plan.reassessment)}.${carried.length > 0 ? ` Conditions carried: ${carried.join(", ")}.` : ""}`,
      reviewFrequency: frequency,
      nextReviewOn: plan.firstCheck,
    },
    intentStatement: {
      en: `Activate ${frequency} monitoring of ${name}, owned by ${owner?.label.en ?? plan.owner}, first check ${formatDate(plan.firstCheck)}.`,
      de: `Eine ${frequency === "quarterly" ? "quartalsweise" : "halbjaehrliche"} Ueberwachung von ${name} aktivieren, verantwortet von ${owner?.label.de ?? plan.owner}, erste Pruefung ${formatDate(plan.firstCheck)}.`,
    },
    sourceCanonicalType: "Supplier",
    sourceCanonicalId: context.run.subjectId,
    decisionId,
  };
});

registerPayloadBuilder("tprm.update-register", (context) => {
  const { plan, frequency, owner, decisionId } = planned(context);
  if (!plan) return { unavailable: { en: "Record the handover plan first.", de: "Erfassen Sie zuerst den Uebergabeplan." } };
  const monitoringId = localResultId(context, "activate-monitoring-plan", "monitoringId");
  if (!monitoringId) {
    return { unavailable: { en: "Activate the monitoring plan first; the register record cites it.", de: "Aktivieren Sie zuerst den Ueberwachungsplan; der Registereintrag verweist darauf." } };
  }
  const name = supplierName(context);
  return {
    payload: {
      decisionId,
      supplierId: context.run.subjectId,
      nextAssessmentDue: plan.reassessment,
      monitoringFrequency: frequency,
      monitoringOwner: owner?.id ?? plan.owner,
      firstCheck: plan.firstCheck,
      monitoringId,
      processRunId: context.run.id,
    },
    intentStatement: {
      en: `Update ${name} in the GRC third-party register: ${frequency} monitoring, next assessment ${formatDate(plan.reassessment)}, citing ${monitoringId}.`,
      de: `${name} im GRC-Drittparteienregister aktualisieren: ${frequency === "quarterly" ? "quartalsweise" : "halbjaehrliche"} Ueberwachung, naechste Bewertung ${formatDate(plan.reassessment)}, mit Verweis auf ${monitoringId}.`,
    },
    sourceCanonicalType: "Supplier",
    sourceCanonicalId: context.run.subjectId,
    targetExternalId: context.run.subjectId,
    decisionId,
  };
});

registerPayloadBuilder("tprm.send-handover-note", (context) => {
  const { plan, frequency, owner, decisionId } = planned(context);
  if (!plan) return { unavailable: { en: "Record the handover plan first.", de: "Erfassen Sie zuerst den Uebergabeplan." } };
  const name = supplierName(context);
  const carried = plan.conditions.filter((entry) => entry.choice === "carry").map((entry) => entry.actionId);
  const recipients = [...new Set([owner?.id ?? plan.owner, "P-010"])];
  return {
    payload: {
      decisionId,
      subject: `${name} handed over to monitoring`,
      body: `${name} is active. Monitoring is ${frequency}, owned by ${owner?.label.en ?? plan.owner}, with a first check on ${formatDate(plan.firstCheck)} and a reassessment on ${formatDate(plan.reassessment)}.${carried.length > 0 ? ` Open conditions carried into monitoring: ${joinList(carried, "and")}.` : " No condition remains open."}${plan.note ? ` ${plan.note}` : ""}`,
      toUserIds: recipients,
      channelName: "Third-party onboarding",
      relatedObjectKind: "supplier",
      relatedObjectId: context.run.subjectId,
    },
    intentStatement: {
      en: `Send the handover message for ${name} to ${joinList(recipients, "and")}. The message stays inside this product.`,
      de: `Die Uebergabenachricht zu ${name} an ${joinList(recipients, "und")} senden. Die Nachricht verlaesst dieses Produkt nicht.`,
    },
    sourceCanonicalType: "Supplier",
    sourceCanonicalId: context.run.subjectId,
    decisionId,
  };
});

registerPayloadBuilder("tprm.send-closure-note", (context) => {
  const name = supplierName(context);
  const decisionId = decisionTaskId(context, DECISION);
  return {
    payload: {
      decisionId,
      subject: `Onboarding file for ${name} closed`,
      body: `The onboarding of ${name} was rejected at Stage 7 and the file is closed without monitoring.`,
      toUserIds: ["P-010"],
      channelName: "Third-party onboarding",
      relatedObjectKind: "supplier",
      relatedObjectId: context.run.subjectId,
    },
    intentStatement: {
      en: `Tell Group Procurement that the onboarding file for ${name} is closed. The message stays inside this product.`,
      de: `Den Konzerneinkauf informieren, dass die Onboarding-Akte zu ${name} geschlossen ist. Die Nachricht verlaesst dieses Produkt nicht.`,
    },
    sourceCanonicalType: "Supplier",
    sourceCanonicalId: context.run.subjectId,
    decisionId,
  };
});

/* ==========================================================================
   The monitoring plan record
   ========================================================================== */

registerArtifactBuilder("tprm.monitoring-plan", (context) => {
  const { plan, frequency, owner } = planned(context);
  const decision = decisionSummary(context, DECISION);
  const register = context.tools.find((tool) => tool.key === "update-register");
  const monitoringId = localResultId(context, "activate-monitoring-plan", "monitoringId");
  const closing = decision?.optionId === "monitoring-close";
  return {
    label: { en: "Monitoring plan", de: "Ueberwachungsplan" },
    content: {
      supplierId: context.run.subjectId,
      plan: plan ? { ...plan, frequency: closing ? null : frequency } : null,
      monitoringId,
      register: register ? { state: register.state, commandId: register.commandId, externalId: register.externalId } : null,
      decision,
      tools: toolSummary(context),
      preparation: preparationSummary(context),
      recordLines: closing
        ? [{ en: "File closed without monitoring", de: "Akte ohne Ueberwachung geschlossen" }]
        : [
            { en: `${frequency === "quarterly" ? "Quarterly" : "Semi-annual"} monitoring, owner ${owner?.label.en ?? plan?.owner ?? ""}`, de: `${frequency === "quarterly" ? "Quartalsweise" : "Halbjaehrliche"} Ueberwachung, Verantwortung ${owner?.label.de ?? plan?.owner ?? ""}` },
            { en: `First check ${formatDate(plan?.firstCheck)}, reassessment ${formatDate(plan?.reassessment)}`, de: `Erste Pruefung ${formatDate(plan?.firstCheck)}, Neubewertung ${formatDate(plan?.reassessment)}` },
            ...(monitoringId ? [{ en: `Monitoring record ${monitoringId}`, de: `Ueberwachungsdatensatz ${monitoringId}` }] : []),
          ],
    },
  };
});

export const TPRM_MONITORING_HANDOVER = { processId: PROCESS_ID, stageId: STAGE_ID } as const;
