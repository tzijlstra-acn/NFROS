/**
 * Work Hub configuration for the Third-Party Risk Manager.
 *
 * The vocabulary is the practitioner's: supplier, service, arrangement,
 * evidence, specialist review, conditions and monitoring. A meeting with a
 * supplier is a supplier challenge call, a session with specialists is a
 * specialist review huddle, and a reminder goes to a supplier contact rather
 * than to a colleague, which changes what it should say.
 *
 * Evidence is required to close every evidence request, remediation and
 * reassessment, because a supplier position accepted on a verbal assurance is
 * the failure the reassessment cycle is meant to catch.
 */

import type { WorkRoleConfig } from "./types";

export const THIRD_PARTY_RISK_WORK: WorkRoleConfig = {
  roleId: "tprm",

  agendaLabels: {
    "focus-time": { en: "Focus block", de: "Fokuszeit" },
    meeting: { en: "Meeting", de: "Besprechung" },
    workshop: { en: "Workshop", de: "Workshop" },
    committee: { en: "Approval forum", de: "Genehmigungsgremium" },
    "crisis-call": { en: "Supplier incident call", de: "Lieferantenvorfall" },
  },

  meetingTypes: {
    "supplier-challenge": {
      label: { en: "Supplier challenge call", de: "Lieferantengespraech" },
      processStageId: "evidence-review",
    },
    "supplier-call": {
      label: { en: "Supplier call", de: "Lieferantentelefonat" },
      processStageId: "evidence-review",
    },
    "one-to-one": {
      label: { en: "Specialist review huddle", de: "Abstimmung mit Fachspezialisten" },
      processStageId: "specialist-reviews",
    },
    meeting: {
      label: { en: "Contract review", de: "Vertragspruefung" },
      processStageId: "contract-and-conditions",
    },
    committee: {
      label: { en: "Approval forum", de: "Genehmigungsgremium" },
      processStageId: "decision-and-onboarding",
    },
  },

  actionKinds: {
    "evidence-request": {
      label: { en: "Supplier evidence request", de: "Nachweisanforderung an Lieferanten" },
      evidenceRequired: true,
      completionTemplate: {
        en: "Closed when {object} provides the requested document, it is reviewed against the obligation and accepted with its reference recorded, by {due}.",
        de: "Abgeschlossen, wenn {object} das angeforderte Dokument liefert, es gegen die Pflicht geprueft und mit Referenz akzeptiert ist, bis {due}.",
      },
    },
    remediation: {
      label: { en: "Remediation", de: "Massnahme" },
      evidenceRequired: true,
      completionTemplate: {
        en: "Closed when the gap on {object} is remedied in the arrangement or the contract, the change is evidenced and accepted, by {due}.",
        de: "Abgeschlossen, wenn die Luecke zu {object} in der Vereinbarung oder im Vertrag behoben, belegt und akzeptiert ist, bis {due}.",
      },
    },
    reassessment: {
      label: { en: "Reassessment", de: "Neubewertung" },
      evidenceRequired: true,
      completionTemplate: {
        en: "Closed when the reassessment of {object} is concluded with every open question answered or recorded as a condition, by {due}.",
        de: "Abgeschlossen, wenn die Neubewertung zu {object} abgeschlossen ist und jede offene Frage beantwortet oder als Auflage erfasst ist, bis {due}.",
      },
    },
    "exercise-action": {
      label: { en: "Exit or resilience test", de: "Ausstiegs- oder Resilienztest" },
      evidenceRequired: true,
      completionTemplate: {
        en: "Closed when the test on {object} is run, the report is filed and any failed step carries an owned condition, by {due}.",
        de: "Abgeschlossen, wenn der Test zu {object} durchgefuehrt, der Bericht abgelegt und jeder fehlgeschlagene Schritt mit einer Auflage versehen ist, bis {due}.",
      },
    },
    monitoring: {
      label: { en: "Monitoring", de: "Ueberwachung" },
      evidenceRequired: true,
      completionTemplate: {
        en: "Closed when the monitoring review of {object} is recorded with the service levels it relied on, by {due}.",
        de: "Abgeschlossen, wenn die Ueberwachungspruefung zu {object} mit den zugrunde liegenden Service Levels erfasst ist, bis {due}.",
      },
    },
    "validation-request": {
      label: { en: "Specialist review", de: "Fachpruefung" },
      evidenceRequired: true,
      completionTemplate: {
        en: "Closed when the specialist review of {object} is returned in writing with its conclusion, by {due}.",
        de: "Abgeschlossen, wenn die Fachpruefung zu {object} schriftlich mit Ergebnis vorliegt, bis {due}.",
      },
    },
    communication: {
      label: { en: "Supplier communication", de: "Lieferantenkommunikation" },
      evidenceRequired: false,
      completionTemplate: {
        en: "Closed when the communication on {object} is issued to the named supplier contact, by {due}.",
        de: "Abgeschlossen, wenn die Kommunikation zu {object} an den genannten Lieferantenkontakt versendet ist, bis {due}.",
      },
    },
  },

  materialActionKinds: ["remediation", "reassessment", "exercise-action"],

  inboxClassifications: {
    decision: {
      label: { en: "Decision", de: "Entscheidung" },
      tone: "danger",
      primaryAction: { en: "Open the decision", de: "Entscheidung oeffnen" },
    },
    action: {
      label: { en: "Action", de: "Massnahme" },
      tone: "warning",
      primaryAction: { en: "Turn into a supplier action", de: "In eine Lieferantenmassnahme ueberfuehren" },
    },
    evidence: {
      label: { en: "Evidence", de: "Nachweis" },
      tone: "success",
      primaryAction: { en: "Link to the supplier file", de: "Mit der Lieferantenakte verknuepfen" },
    },
    information: {
      label: { en: "Information", de: "Information" },
      tone: "info",
      primaryAction: { en: "Note and file", de: "Zur Kenntnis nehmen und ablegen" },
    },
    delegate: {
      label: { en: "Delegate", de: "Delegieren" },
      tone: "accent",
      primaryAction: { en: "Delegate to the specialist", de: "An die Fachstelle delegieren" },
    },
    noise: {
      label: { en: "Noise", de: "Ohne Relevanz" },
      tone: "neutral",
      primaryAction: { en: "Dismiss", de: "Verwerfen" },
    },
  },

  relatedObjectTypes: {
    supplier: { en: "Supplier", de: "Lieferant" },
    subprocessor: { en: "Subprocessor", de: "Unterauftragnehmer" },
    service: { en: "Service", de: "Dienstleistung" },
    contract: { en: "Arrangement", de: "Vereinbarung" },
    "contract-appendix": { en: "Contract appendix", de: "Vertragsanlage" },
    kri: { en: "Indicator", de: "Indikator" },
    risk: { en: "Risk", de: "Risiko" },
    control: { en: "Control", de: "Kontrolle" },
    process: { en: "Process", de: "Prozess" },
    "committee-item": { en: "Committee item", de: "Ausschusspunkt" },
    "regulatory-change": { en: "Regulatory change", de: "Regulatorische Aenderung" },
    "evidence-document": { en: "Evidence", de: "Nachweis" },
    decision: { en: "Decision", de: "Entscheidung" },
    action: { en: "Action", de: "Massnahme" },
    assessment: { en: "Supplier assessment", de: "Lieferantenbewertung" },
  },

  professionalActions: {
    prepareMeeting: { en: "Open the supplier pack", de: "Lieferantenpaket oeffnen" },
    reminderRecipient: { en: "the supplier contact or specialist", de: "den Lieferantenkontakt oder die Fachstelle" },
    reminderSubject: {
      en: "Outstanding item {reference}, due {due}",
      de: "Offener Punkt {reference}, faellig am {due}",
    },
    reminderTemplate: {
      en: "Dear {owner},\n\nWe are still waiting on {reference}, \"{title}\", which is due on {due}. The item is closed when: {condition}\n\nPlease send the document itself rather than a summary, or tell us the date on which you will. A verbal assurance cannot be accepted in place of the evidence.\n\nKind regards.",
      de: "Guten Tag {owner},\n\nwir warten weiterhin auf {reference}, \"{title}\", faellig am {due}. Der Punkt ist abgeschlossen, wenn: {condition}\n\nBitte senden Sie das Dokument selbst und keine Zusammenfassung, oder nennen Sie uns das Datum, an dem Sie es senden. Eine muendliche Zusicherung kann den Nachweis nicht ersetzen.\n\nFreundliche Gruesse.",
    },
    requestEvidenceHint: {
      en: "For example the full test report, the scope statement or the signed register extract.",
      de: "Zum Beispiel den vollstaendigen Testbericht, die Umfangserklaerung oder den unterzeichneten Registerauszug.",
    },
    escalation: {
      committeeRef: "CMT-NFR-2026-10",
      committeeName: "Group Non-Financial Risk Committee",
      meetingDate: "2026-10-13",
      label: { en: "Group NFR Committee, 13.10.2026", de: "Konzern NFR-Ausschuss, 13.10.2026" },
    },
    reserveFocus: {
      en: "Protect time to read the supplier pack before {title}",
      de: "Zeit zum Lesen des Lieferantenpakets vor {title} schuetzen",
    },
  },
};
