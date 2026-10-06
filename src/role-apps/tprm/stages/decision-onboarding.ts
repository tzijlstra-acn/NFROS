/**
 * TPRM Stage 7, Decision and Onboarding.
 *
 * Registered under the keys the stage contract names:
 *
 *   one preparer           the options with what each implies, the evidence
 *                          the file rests on, the uncertainty, the rationale
 *                          and the list of target systems an approval writes
 *   decision rules         no unconditional approval while a condition is
 *                          open; no conditional approval without one
 *   six payload builders   on approval: the supplier assessment that makes
 *                          the supplier active, the supplier and service
 *                          records in the GRC platform (through the outbox),
 *                          and the monitoring record from activation; on
 *                          escalation, the committee agenda item; on
 *                          rejection, the notice to the business
 *   one artifact builder   the approval record, with every target system's
 *                          receipt
 *
 * The decision is the person's and it is material. Each consequence is a
 * governed tool with its own approval bound to its own payload, granted by
 * the holder of the run's role, so approving the onboarding does not
 * silently authorise the register write that travels with it. The two GRC
 * writes count only when the platform acknowledges them.
 *
 * Synthetic institution and data.
 */

import type { Bilingual } from "@/role-apps/contracts";
import {
  registerArtifactBuilder,
  registerDecisionRules,
  registerPayloadBuilder,
  registerPreparer,
} from "@/features/process/registry";
import type { SourceRecord, StageContext } from "@/features/process/types";
import type { StagePreparationOutput } from "@/features/process/preparation-schema";
import { getWorkRoleConfig } from "@/features/work/roles";
import {
  addDays,
  decisionSummary,
  decisionTaskId,
  formatDate,
  joinList,
  localResultId,
  PROCESS_ID,
  preparationSummary,
  recordsOf,
  servicesOf,
  stageRecord,
  supplierName,
  supplierRow,
  toolSummary,
  type Sources,
} from "./shared";
import { entitiesInScope } from "./sources";

const STAGE_ID = "decision-and-onboarding";
const DECISION = "onboarding-approval";

/* ==========================================================================
   Reading the file
   ========================================================================== */

function readFile(context: StageContext, sources: Sources) {
  const file = recordsOf(sources, "onboarding-file");
  const stages = file.filter((record) => record.facts?.kind === "stage");
  const conditions = file.filter((record) => record.facts?.kind === "condition");
  const monitoring = file.filter((record) => record.facts?.kind === "monitoring");
  const supplier = supplierRow(context.runId, context.run.subjectId);
  const memo = stageRecord(context.runId, context.run.id, "classification-and-criticality", "classification-memo");
  const judgment = (memo?.judgment ?? null) as Record<string, string> | null;
  const evidence = recordsOf(sources, "due-diligence-evidence");
  const received = evidence.filter((record) => record.facts?.received === true);
  const outstanding = evidence.filter((record) => record.facts?.received !== true);
  const openClauses = recordsOf(sources, "contract-conditions").filter((record) => record.facts?.outstanding === true);
  const criticality = judgment?.criticality ?? supplier?.criticality ?? "standard";
  const outsourcing = judgment ? judgment.classification === "outsourcing" : supplier?.isOutsourcing === true;
  return { stages, conditions, monitoring, supplier, judgment, evidence, received, outstanding, openClauses, criticality, outsourcing };
}

function conditionList(conditions: SourceRecord[]): string {
  return conditions.map((record) => `${record.id}${record.facts?.dueOn ? ` (due ${formatDate(String(record.facts.dueOn))})` : ""}`).join(", ");
}

/* ==========================================================================
   The preparer
   ========================================================================== */

function composeOnboarding(input: { context: StageContext; sources: Sources }): StagePreparationOutput {
  const { context, sources } = input;
  const file = readFile(context, sources);
  const name = supplierName(context);
  const services = servicesOf(context.runId, context.run.subjectId);
  const entities = entitiesInScope(context);
  const important = file.criticality === "important" || file.criticality === "critical";

  const findings: StagePreparationOutput["findings"] = file.stages.map((record) => ({
    sourceKey: "onboarding-file",
    statement: {
      en: `${record.label}: ${record.value}.`,
      de: `Stufe ${record.facts?.sequence} ${String(record.facts?.nameDe ?? "")}: abgeschlossen am ${formatDate(String(record.facts?.completedAt ?? ""))}${record.facts?.stored ? ", Protokoll gespeichert" : ", vor der Prozess-Engine"}.`,
    },
    evidenceIds: [],
    basis: "approved-record" as const,
  }));
  findings.push({
    sourceKey: "onboarding-file",
    statement:
      file.conditions.length === 0
        ? { en: "No condition is open on the file.", de: "Auf der Akte ist keine Bedingung offen." }
        : {
            en: `${file.conditions.length} condition action(s) open: ${conditionList(file.conditions)}.`,
            de: `${file.conditions.length} Bedingungsmassnahmen offen: ${file.conditions.map((record) => `${record.id}${record.facts?.dueOn ? ` (faellig ${formatDate(String(record.facts.dueOn))})` : ""}`).join(", ")}.`,
          },
    evidenceIds: [],
    basis: "approved-record",
  });
  if (file.evidence.length > 0) {
    findings.push({
      sourceKey: "due-diligence-evidence",
      statement: {
        en: `Evidence: ${file.received.length} of ${file.evidence.length} requested item(s) received${file.outstanding.length > 0 ? `; outstanding ${file.outstanding.map((record) => record.id).join(", ")}` : ""}.`,
        de: `Nachweise: ${file.received.length} von ${file.evidence.length} angeforderten eingegangen${file.outstanding.length > 0 ? `; ausstehend ${file.outstanding.map((record) => record.id).join(", ")}` : ""}.`,
      },
      evidenceIds: file.evidence.map((record) => record.id).slice(0, 16),
      basis: "approved-record",
    });
  }
  findings.push({
    sourceKey: "supplier-record",
    statement: {
      en: `Target systems on approval: the supplier assessment and active status on ${context.run.subjectId} in this product; supplier record ${context.run.subjectId}${services[0] ? ` and service record ${services[0].id}` : ""} in the GRC platform, through the outbox; a monitoring record from activation.`,
      de: `Zielsysteme bei Genehmigung: Lieferantenbewertung und aktiver Status zu ${context.run.subjectId} in diesem Produkt; Lieferantendatensatz ${context.run.subjectId}${services[0] ? ` und Leistungsdatensatz ${services[0].id}` : ""} im GRC-System ueber den Postausgang; ein Ueberwachungsdatensatz ab Aktivierung.`,
    },
    evidenceIds: [],
    basis: "approved-record",
  });

  const inferences: StagePreparationOutput["inferences"] = [
    {
      statement: {
        en: file.conditions.length > 0
          ? `Approve with conditions: ${name} becomes active with ${file.conditions.length} condition action(s) open, each with an owner and a date.`
          : `Approve: ${name} becomes active with no condition open.`,
        de: file.conditions.length > 0
          ? `Mit Bedingungen genehmigen: ${name} wird mit ${file.conditions.length} offenen Bedingungsmassnahmen aktiv, jede mit Verantwortung und Termin.`
          : `Genehmigen: ${name} wird ohne offene Bedingung aktiv.`,
      },
      evidenceIds: [],
      uncertainty: {
        en: file.outstanding.length > 0 ? `Outstanding evidence (${file.outstanding.map((record) => record.id).join(", ")}) may, when it arrives, change a specialist position.` : "No requested evidence is outstanding.",
        de: file.outstanding.length > 0 ? `Ausstehende Nachweise (${file.outstanding.map((record) => record.id).join(", ")}) koennen bei Eingang eine Fachposition aendern.` : "Kein angeforderter Nachweis steht aus.",
      },
    },
    {
      statement: {
        en: `Escalate: the onboarding goes to the ${getWorkRoleConfig("tprm")?.professionalActions.escalation?.committeeName ?? "NFR committee"} and the file is held until it decides.`,
        de: `Eskalieren: Das Onboarding geht an das ${getWorkRoleConfig("tprm")?.professionalActions.escalation?.committeeName ?? "NFR-Komitee"}, und die Akte wird bis zu dessen Entscheidung gehalten.`,
      },
      evidenceIds: [],
      uncertainty: important
        ? { en: "For an important supplier the policy requires the Non-Financial Risk Committee's approval.", de: "Fuer einen wichtigen Lieferanten verlangt die Richtlinie die Genehmigung des Komitees fuer nichtfinanzielle Risiken." }
        : { en: "Not required for a standard supplier; available when the residual exposure warrants it.", de: "Fuer einen Standardlieferanten nicht erforderlich; moeglich, wenn die Restexposition es rechtfertigt." },
    },
    {
      statement: {
        en: `Reject: the file closes without onboarding; ${file.supplier?.status === "onboarding" ? "the candidate stays out of the register as an active supplier" : "the supplier record is not changed"}, and the business is told.`,
        de: `Ablehnen: Die Akte schliesst ohne Onboarding; ${file.supplier?.status === "onboarding" ? "der Kandidat wird nicht als aktiver Lieferant gefuehrt" : "der Lieferantendatensatz wird nicht geaendert"}, und die Fachseite wird informiert.`,
      },
      evidenceIds: [],
      uncertainty: { en: "Rejection leaves the business need open.", de: "Eine Ablehnung laesst den fachlichen Bedarf offen." },
    },
  ];

  const gaps: StagePreparationOutput["gaps"] = file.openClauses.map((record) => ({
    key: `open-clause-${record.id}`,
    statement: {
      en: `${record.label} is still open in the draft; it is tracked as a condition, not agreed.`,
      de: `${record.id} ist im Entwurf noch offen; die Klausel wird als Bedingung verfolgt, nicht als vereinbart.`,
    },
    evidenceIds: record.evidenceIds.slice(0, 16),
    severity: "material" as const,
  }));

  const limitations: StagePreparationOutput["limitations"] = [
    {
      en: `${important ? `${name} is ${file.criticality}: record the Non-Financial Risk Committee's approval in your rationale.` : `${name} is ${file.criticality}: the approval sits within delegated authority.`} Entities: ${joinList(entities, "and")}.`,
      de: `${important ? `${name} ist ${file.criticality === "critical" ? "kritisch" : "wichtig"}: Halten Sie die Genehmigung des Komitees in Ihrer Begruendung fest.` : `${name} ist Standard: die Genehmigung liegt im Rahmen der Delegation.`} Gesellschaften: ${joinList(entities, "und")}.`,
    },
  ];

  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `The onboarding file for ${name} is recorded through Stage 6 with ${file.conditions.length} condition action(s) open. ${file.conditions.length > 0 ? "Approval with conditions is the option the file supports" : "The file supports an approval"}; the decision is yours and is material. An approval writes the supplier and service records to the GRC platform and opens monitoring.`,
      de: `Die Onboarding-Akte zu ${name} ist bis Stufe 6 erfasst, ${file.conditions.length} Bedingungsmassnahmen sind offen. ${file.conditions.length > 0 ? "Die Akte traegt eine Genehmigung mit Bedingungen" : "Die Akte traegt eine Genehmigung"}; die Entscheidung ist Ihre und wesentlich. Eine Genehmigung schreibt Lieferanten- und Leistungsdatensatz in das GRC-System und eroeffnet die Ueberwachung.`,
    },
    findings,
    inferences,
    contradictions: [],
    gaps,
    itemAssessments: [],
    proposals: [
      { toolKey: "record-onboarding-assessment", rationale: { en: "Records the conclusion and makes the supplier active.", de: "Erfasst das Ergebnis und aktiviert den Lieferanten." } },
      { toolKey: "register-supplier", rationale: { en: "The GRC third-party register is the system of record for suppliers.", de: "Das GRC-Drittparteienregister ist das fuehrende System fuer Lieferanten." } },
      { toolKey: "register-service", rationale: { en: "The service record links the supplier to the business service it supports.", de: "Der Leistungsdatensatz verbindet den Lieferanten mit der unterstuetzten Geschaeftsleistung." } },
      { toolKey: "start-monitoring", rationale: { en: "Monitoring starts on activation, so there is no unmonitored gap before the handover.", de: "Die Ueberwachung beginnt mit der Aktivierung, damit vor der Uebergabe keine Luecke entsteht." } },
    ],
    recommendedOptionId: file.conditions.length > 0 ? "onboarding-conditional" : "onboarding-approve",
    limitations,
  };
}

const PROMPT = `You prepare Stage 7 (Decision and Onboarding) of a third-party onboarding for a Third-Party Risk Manager at a synthetic bank.
Use only the source records provided. Set out the options (approve, approve with conditions, reject, escalate) with what each implies; the evidence the file rests on; the uncertainty; a rationale; and the target systems an approval writes to.
Never decide the onboarding. Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("tprm.decision-onboarding", {
  compose: (input) => composeOnboarding(input),
  prompt: ({ context, sources }) => ({
    instructions: PROMPT,
    input: JSON.stringify({
      supplier: context.run.subjectId,
      stage: context.stage.name,
      sources: sources.map((source) => ({ key: source.spec.key, status: source.status, records: source.result.records })),
      decisionOptions: ["onboarding-approve", "onboarding-conditional", "onboarding-reject", "onboarding-escalate"],
      tools: context.stage.tools.map((tool) => tool.key),
    }),
  }),
  itemIds: () => [],
});

/* ==========================================================================
   Decision rules
   ========================================================================== */

registerDecisionRules(PROCESS_ID, STAGE_ID, {
  validateOption: (context, decisionKey, optionId) => {
    if (decisionKey !== DECISION) return null;
    const file = readFile(context, context.sources);
    if (optionId === "onboarding-approve" && file.conditions.length > 0) {
      return {
        en: `${file.conditions.length} condition action(s) are open (${file.conditions.map((record) => record.id).join(", ")}). Approve with conditions, or close them first.`,
        de: `${file.conditions.length} Bedingungsmassnahmen sind offen (${file.conditions.map((record) => record.id).join(", ")}). Genehmigen Sie mit Bedingungen oder schliessen Sie sie zuerst.`,
      };
    }
    if (optionId === "onboarding-conditional" && file.conditions.length === 0) {
      return {
        en: "No condition is open on the file, so there is nothing to condition. Approve instead.",
        de: "Auf der Akte ist keine Bedingung offen, daher gibt es nichts zu bedingen. Genehmigen Sie stattdessen.",
      };
    }
    return null;
  },
  consequences: (context, decisionKey, optionId) => {
    if (decisionKey !== DECISION) return [];
    const name = supplierName(context);
    const services = servicesOf(context.runId, context.run.subjectId);
    switch (optionId) {
      case "onboarding-approve":
      case "onboarding-conditional":
        return [
          { en: `Record the supplier assessment and make ${name} active, under your approval`, de: `Die Lieferantenbewertung erfassen und ${name} aktivieren, mit Ihrer Genehmigung` },
          { en: `Write the supplier record ${context.run.subjectId} to the GRC third-party register through the outbox`, de: `Den Lieferantendatensatz ${context.run.subjectId} ueber den Postausgang in das GRC-Drittparteienregister schreiben` },
          ...(services[0] ? [{ en: `Write the service record ${services[0].id} to the GRC platform through the outbox`, de: `Den Leistungsdatensatz ${services[0].id} ueber den Postausgang in das GRC-System schreiben` }] : []),
          { en: "Open the monitoring record from activation, with a monthly check until the handover sets the plan", de: "Den Ueberwachungsdatensatz ab Aktivierung eroeffnen, mit monatlicher Pruefung bis zur Festlegung des Plans" },
          ...(optionId === "onboarding-conditional" ? [{ en: "Keep the open condition actions open, with their owners and dates", de: "Die offenen Bedingungsmassnahmen mit Verantwortung und Termin offen halten" }] : []),
          { en: "Allow the stage to complete and open the Handover to Monitoring", de: "Den Abschluss der Stufe erlauben und die Uebergabe an das Monitoring oeffnen" },
        ];
      case "onboarding-reject":
        return [
          { en: "Tell the business owner and procurement that the onboarding is rejected", de: "Fachverantwortung und Einkauf ueber die Ablehnung informieren" },
          { en: "Leave the supplier record unchanged and allow the stage to complete; the handover closes the file", de: "Den Lieferantendatensatz unveraendert lassen und den Abschluss erlauben; die Uebergabe schliesst die Akte" },
        ];
      case "onboarding-escalate":
        return [
          { en: "Put the onboarding on the NFR committee agenda, under your approval", de: "Das Onboarding mit Ihrer Genehmigung auf die Agenda des NFR-Komitees setzen" },
          { en: "Hold the file at Stage 7 until the committee decides", de: "Die Akte in Stufe 7 halten, bis das Komitee entscheidet" },
        ];
      default:
        return [];
    }
  },
});

/* ==========================================================================
   Payload builders: the consequences of the decision
   ========================================================================== */

function decided(context: StageContext) {
  const decision = context.decisions.find((state) => state.spec.key === DECISION);
  return { optionId: decision?.chosenOptionId ?? null, rationale: decision?.rationale ?? "", decisionId: decisionTaskId(context, DECISION) };
}

function entityOf(context: StageContext): string {
  return supplierRow(context.runId, context.run.subjectId)?.contractingEntityIds[0] ?? "ARC-DE";
}

registerPayloadBuilder("tprm.record-onboarding-assessment", (context) => {
  const decision = decided(context);
  if (decision.optionId !== "onboarding-approve" && decision.optionId !== "onboarding-conditional") {
    return { unavailable: { en: "The onboarding is not approved.", de: "Das Onboarding ist nicht genehmigt." } };
  }
  const file = readFile(context, context.sources);
  const name = supplierName(context);
  const conclusion =
    decision.optionId === "onboarding-conditional"
      ? `Onboarding approved with conditions: ${file.conditions.map((record) => record.id).join(", ")}`
      : "Onboarding approved";
  return {
    payload: {
      decisionId: decision.decisionId,
      entityId: entityOf(context),
      supplierId: context.run.subjectId,
      conclusion,
      rationale: decision.rationale,
      residualRisk: decision.optionId === "onboarding-conditional" ? "medium" : "low",
      supplierStatus: "active",
    },
    intentStatement: {
      en: `Record the onboarding conclusion for ${name} and make the supplier active.`,
      de: `Das Onboarding-Ergebnis fuer ${name} erfassen und den Lieferanten aktivieren.`,
    },
    sourceCanonicalType: "Supplier",
    sourceCanonicalId: context.run.subjectId,
    decisionId: decision.decisionId,
  };
});

registerPayloadBuilder("tprm.register-supplier", (context) => {
  const decision = decided(context);
  const assessmentId = localResultId(context, "record-onboarding-assessment", "assessmentId");
  if (!assessmentId) {
    return { unavailable: { en: "Record the onboarding assessment first; the register record cites it.", de: "Erfassen Sie zuerst die Onboarding-Bewertung; der Registereintrag verweist darauf." } };
  }
  const file = readFile(context, context.sources);
  const name = supplierName(context);
  return {
    payload: {
      decisionId: decision.decisionId,
      supplierId: context.run.subjectId,
      name,
      status: "active",
      criticality: file.criticality,
      outsourcing: file.outsourcing,
      entities: entitiesInScope(context),
      assessmentId,
      conditionActionIds: file.conditions.map((record) => record.id),
      processRunId: context.run.id,
    },
    intentStatement: {
      en: `Write ${name} to the GRC third-party register as an active ${file.criticality} supplier, citing ${assessmentId}.`,
      de: `${name} als aktiven Lieferanten (${file.criticality}) in das GRC-Drittparteienregister schreiben, mit Verweis auf ${assessmentId}.`,
    },
    sourceCanonicalType: "Supplier",
    sourceCanonicalId: context.run.subjectId,
    targetExternalId: context.run.subjectId,
    decisionId: decision.decisionId,
  };
});

registerPayloadBuilder("tprm.register-service", (context) => {
  const decision = decided(context);
  const service = servicesOf(context.runId, context.run.subjectId)[0];
  if (!service) {
    return { unavailable: { en: "No service is recorded for this supplier.", de: "Fuer diesen Lieferanten ist keine Leistung erfasst." } };
  }
  if (!localResultId(context, "record-onboarding-assessment", "assessmentId")) {
    return { unavailable: { en: "Record the onboarding assessment first.", de: "Erfassen Sie zuerst die Onboarding-Bewertung." } };
  }
  const supports = /\bIBS-\d{4}\b/.exec(service.description)?.[0] ?? null;
  return {
    payload: {
      decisionId: decision.decisionId,
      serviceId: service.id,
      name: service.name,
      supplierId: context.run.subjectId,
      entities: entitiesInScope(context),
      supports,
      status: "contracted",
    },
    intentStatement: {
      en: `Write the service record ${service.id} ${service.name} to the GRC platform, linked to ${context.run.subjectId}${supports ? ` and ${supports}` : ""}.`,
      de: `Den Leistungsdatensatz ${service.id} ${service.nameDe || service.name} in das GRC-System schreiben, verknuepft mit ${context.run.subjectId}${supports ? ` und ${supports}` : ""}.`,
    },
    sourceCanonicalType: "Service",
    sourceCanonicalId: service.id,
    targetExternalId: service.id,
    decisionId: decision.decisionId,
  };
});

registerPayloadBuilder("tprm.start-monitoring", (context) => {
  const decision = decided(context);
  if (decision.optionId !== "onboarding-approve" && decision.optionId !== "onboarding-conditional") {
    return { unavailable: { en: "The onboarding is not approved.", de: "Das Onboarding ist nicht genehmigt." } };
  }
  const file = readFile(context, context.sources);
  const name = supplierName(context);
  const nextReviewOn = addDays(context.state.scenarioDate, 30);
  return {
    payload: {
      decisionId: decision.decisionId,
      entityId: entityOf(context),
      subjectId: context.run.subjectId,
      subjectKind: "supplier",
      kind: "onboarding-monitoring",
      description: `Monitoring of ${name} from activation until the handover sets the plan.${file.conditions.length > 0 ? ` Open conditions: ${file.conditions.map((record) => record.id).join(", ")}.` : ""}`,
      reviewFrequency: "monthly",
      nextReviewOn,
    },
    intentStatement: {
      en: `Open the monitoring record for ${name} from activation, first check ${formatDate(nextReviewOn)}.`,
      de: `Den Ueberwachungsdatensatz fuer ${name} ab Aktivierung eroeffnen, erste Pruefung ${formatDate(nextReviewOn)}.`,
    },
    sourceCanonicalType: "Supplier",
    sourceCanonicalId: context.run.subjectId,
    decisionId: decision.decisionId,
  };
});

registerPayloadBuilder("tprm.escalate-onboarding", (context) => {
  const decision = decided(context);
  const name = supplierName(context);
  const route = getWorkRoleConfig("tprm")?.professionalActions.escalation;
  return {
    payload: {
      decisionId: decision.decisionId,
      entityId: entityOf(context),
      title: `Onboarding decision: ${name}`,
      summary: decision.rationale || `The onboarding of ${name} is escalated for the committee's decision.`,
      itemType: "decision",
      relatedObjectKind: "supplier",
      relatedObjectId: context.run.subjectId,
      ...(route ? { committeeRef: route.committeeRef, committeeName: route.committeeName, meetingDate: route.meetingDate } : {}),
    },
    intentStatement: {
      en: `Put the onboarding of ${name} on the ${route?.committeeName ?? "NFR committee"} agenda for decision.`,
      de: `Das Onboarding von ${name} zur Entscheidung auf die Agenda von ${route?.committeeName ?? "NFR-Komitee"} setzen.`,
    },
    sourceCanonicalType: "Supplier",
    sourceCanonicalId: context.run.subjectId,
    decisionId: decision.decisionId,
  };
});

registerPayloadBuilder("tprm.notify-rejection", (context) => {
  const decision = decided(context);
  const name = supplierName(context);
  return {
    payload: {
      decisionId: decision.decisionId,
      subject: `Onboarding of ${name} rejected`,
      body: `The onboarding of ${name} was rejected at Stage 7. ${decision.rationale}`.trim(),
      toUserIds: ["P-010"],
      channelName: "Third-party onboarding",
      relatedObjectKind: "supplier",
      relatedObjectId: context.run.subjectId,
    },
    intentStatement: {
      en: `Tell Group Procurement that the onboarding of ${name} is rejected. The message stays inside this product.`,
      de: `Den Konzerneinkauf ueber die Ablehnung des Onboardings von ${name} informieren. Die Nachricht verlaesst dieses Produkt nicht.`,
    },
    sourceCanonicalType: "Supplier",
    sourceCanonicalId: context.run.subjectId,
    decisionId: decision.decisionId,
  };
});

/* ==========================================================================
   The approval record
   ========================================================================== */

registerArtifactBuilder("tprm.approval-record", (context) => {
  const decision = decisionSummary(context, DECISION);
  const file = readFile(context, context.sources);
  const tool = (key: string) => context.tools.find((candidate) => candidate.key === key);
  const supplierCommand = tool("register-supplier");
  const serviceCommand = tool("register-service");
  const assessmentId = localResultId(context, "record-onboarding-assessment", "assessmentId");
  const monitoringId = localResultId(context, "start-monitoring", "monitoringId");
  const lines: Bilingual[] = [];
  if (assessmentId) lines.push({ en: `Supplier assessment ${assessmentId}; supplier active`, de: `Lieferantenbewertung ${assessmentId}; Lieferant aktiv` });
  if (supplierCommand?.externalId) lines.push({ en: `GRC supplier record ${supplierCommand.externalId}`, de: `GRC-Lieferantendatensatz ${supplierCommand.externalId}` });
  if (serviceCommand?.externalId) lines.push({ en: `GRC service record ${serviceCommand.externalId}`, de: `GRC-Leistungsdatensatz ${serviceCommand.externalId}` });
  if (monitoringId) lines.push({ en: `Monitoring record ${monitoringId}`, de: `Ueberwachungsdatensatz ${monitoringId}` });
  return {
    label: { en: "Onboarding approval record", de: "Protokoll der Onboarding-Genehmigung" },
    content: {
      supplierId: context.run.subjectId,
      decision,
      openConditions: file.conditions.map((record) => ({ id: record.id, dueOn: record.facts?.dueOn ?? null })),
      targetSystems: {
        product: { assessmentId, monitoringId },
        grcSupplier: supplierCommand ? { state: supplierCommand.state, commandId: supplierCommand.commandId, externalId: supplierCommand.externalId, receiptId: supplierCommand.receiptId } : null,
        grcService: serviceCommand ? { state: serviceCommand.state, commandId: serviceCommand.commandId, externalId: serviceCommand.externalId, receiptId: serviceCommand.receiptId } : null,
      },
      tools: toolSummary(context),
      preparation: preparationSummary(context),
      recordLines: lines,
    },
  };
});

export const TPRM_DECISION_ONBOARDING = { processId: PROCESS_ID, stageId: STAGE_ID } as const;
