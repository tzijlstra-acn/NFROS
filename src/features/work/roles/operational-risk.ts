/**
 * Work Hub configuration for the Operational Risk Partner.
 *
 * The vocabulary is the practitioner's: assessments, risks, controls,
 * indicators, challenge, rating and appetite. Meeting types follow the RCSA
 * cycle the role runs, so a challenge workshop is named as one rather than as
 * a generic meeting, and it points at the stage of the cycle it serves.
 *
 * Evidence is required to close every action kind except a communication,
 * because an RCSA line that changed on an unrecorded basis is exactly the
 * finding the second line exists to prevent.
 */

import type { WorkRoleConfig } from "./types";

export const OPERATIONAL_RISK_WORK: WorkRoleConfig = {
  roleId: "rcsa",

  agendaLabels: {
    "focus-time": { en: "Focus block", de: "Fokuszeit" },
    meeting: { en: "Meeting", de: "Besprechung" },
    workshop: { en: "Workshop", de: "Workshop" },
    committee: { en: "Committee", de: "Ausschuss" },
    "crisis-call": { en: "Crisis call", de: "Krisengespraech" },
  },

  meetingTypes: {
    "scope-confirmation": {
      label: { en: "Scope confirmation", de: "Bestaetigung des Umfangs" },
      processStageId: "scope-trigger",
    },
    "rcsa-workshop": {
      label: { en: "RCSA challenge workshop", de: "RCSA Challenge-Workshop" },
      processStageId: "challenge-workshop",
    },
    "one-to-one": {
      label: { en: "First-line validation", de: "Validierung mit der ersten Linie" },
      processStageId: "first-line-input",
    },
    workshop: {
      label: { en: "Sign-off planning", de: "Freigabeplanung" },
      processStageId: "actions-approval",
    },
    committee: {
      label: { en: "Committee preparation", de: "Ausschussvorbereitung" },
      processStageId: null,
    },
    meeting: {
      label: { en: "Remediation review", de: "Massnahmenpruefung" },
      processStageId: null,
    },
  },

  actionKinds: {
    remediation: {
      label: { en: "Remediation", de: "Massnahme" },
      evidenceRequired: true,
      completionTemplate: {
        en: "Closed when the change on {object} is implemented, tested by the second line with a passed result, and the test reference is cited, by {due}.",
        de: "Abgeschlossen, wenn die Aenderung an {object} umgesetzt, von der zweiten Linie mit bestandenem Ergebnis getestet und die Testreferenz zitiert ist, bis {due}.",
      },
    },
    "evidence-request": {
      label: { en: "Evidence request", de: "Nachweisanforderung" },
      evidenceRequired: true,
      completionTemplate: {
        en: "Closed when the requested evidence for {object} is received, accepted as sufficient and filed with its document reference, by {due}.",
        de: "Abgeschlossen, wenn der angeforderte Nachweis zu {object} eingegangen, als ausreichend akzeptiert und mit Dokumentreferenz abgelegt ist, bis {due}.",
      },
    },
    "validation-request": {
      label: { en: "First-line validation", de: "Validierung erste Linie" },
      evidenceRequired: true,
      completionTemplate: {
        en: "Closed when the first line confirms the fact on {object} in writing and the confirmation is filed, by {due}.",
        de: "Abgeschlossen, wenn die erste Linie den Sachverhalt zu {object} schriftlich bestaetigt und die Bestaetigung abgelegt ist, bis {due}.",
      },
    },
    monitoring: {
      label: { en: "Monitoring", de: "Ueberwachung" },
      evidenceRequired: true,
      completionTemplate: {
        en: "Closed when the monitoring review of {object} is recorded with its result and the reading it is based on, by {due}.",
        de: "Abgeschlossen, wenn die Ueberwachungspruefung zu {object} mit Ergebnis und zugrunde liegendem Messwert erfasst ist, bis {due}.",
      },
    },
    reassessment: {
      label: { en: "Reassessment", de: "Neubewertung" },
      evidenceRequired: true,
      completionTemplate: {
        en: "Closed when the reassessment of {object} is approved as a new assessment version, by {due}.",
        de: "Abgeschlossen, wenn die Neubewertung zu {object} als neue Bewertungsversion genehmigt ist, bis {due}.",
      },
    },
    "exercise-action": {
      label: { en: "Exercise", de: "Uebung" },
      evidenceRequired: true,
      completionTemplate: {
        en: "Closed when the exercise on {object} is run, its report is filed and every failed step has an owned action, by {due}.",
        de: "Abgeschlossen, wenn die Uebung zu {object} durchgefuehrt, der Bericht abgelegt und jeder fehlgeschlagene Schritt einer Massnahme zugeordnet ist, bis {due}.",
      },
    },
    communication: {
      label: { en: "Communication", de: "Kommunikation" },
      evidenceRequired: false,
      completionTemplate: {
        en: "Closed when the communication on {object} is issued to its named recipients, by {due}.",
        de: "Abgeschlossen, wenn die Kommunikation zu {object} an die genannten Empfaenger versendet ist, bis {due}.",
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
      primaryAction: { en: "Turn into an action", de: "In eine Massnahme ueberfuehren" },
    },
    evidence: {
      label: { en: "Evidence", de: "Nachweis" },
      tone: "success",
      primaryAction: { en: "Link to the assessment", de: "Mit der Bewertung verknuepfen" },
    },
    information: {
      label: { en: "Information", de: "Information" },
      tone: "info",
      primaryAction: { en: "Note and file", de: "Zur Kenntnis nehmen und ablegen" },
    },
    delegate: {
      label: { en: "Delegate", de: "Delegieren" },
      tone: "accent",
      primaryAction: { en: "Delegate to the first line", de: "An die erste Linie delegieren" },
    },
    noise: {
      label: { en: "Noise", de: "Ohne Relevanz" },
      tone: "neutral",
      primaryAction: { en: "Dismiss", de: "Verwerfen" },
    },
  },

  relatedObjectTypes: {
    control: { en: "Control", de: "Kontrolle" },
    risk: { en: "Risk", de: "Risiko" },
    kri: { en: "Indicator", de: "Indikator" },
    assessment: { en: "Assessment", de: "Bewertung" },
    rcsa: { en: "Assessment", de: "Bewertung" },
    process: { en: "Process", de: "Prozess" },
    "control-test": { en: "Control test", de: "Kontrolltest" },
    "test-case": { en: "Test item", de: "Testfall" },
    "committee-item": { en: "Committee item", de: "Ausschusspunkt" },
    "evidence-document": { en: "Evidence", de: "Nachweis" },
    decision: { en: "Decision", de: "Entscheidung" },
    action: { en: "Action", de: "Massnahme" },
    "audit-report": { en: "Audit report", de: "Revisionsbericht" },
    service: { en: "Business service", de: "Geschaeftsdienst" },
    runbook: { en: "Runbook", de: "Ablaufplan" },
    supplier: { en: "Third party", de: "Drittanbieter" },
  },

  professionalActions: {
    prepareMeeting: { en: "Open the challenge pack", de: "Challenge-Paket oeffnen" },
    reminderRecipient: { en: "the accountable first-line owner", de: "die verantwortliche Person der ersten Linie" },
    reminderSubject: {
      en: "Reminder: {reference} due {due}",
      de: "Erinnerung: {reference} faellig am {due}",
    },
    reminderTemplate: {
      en: "Dear {owner},\n\nA reminder on {reference}, \"{title}\", which is due on {due}. The action closes when: {condition}\n\nPlease reply with the current position and the evidence you will rely on, so the RCSA line can be supported before sign-off.\n\nThank you.",
      de: "Guten Tag {owner},\n\neine Erinnerung zu {reference}, \"{title}\", faellig am {due}. Die Massnahme ist abgeschlossen, wenn: {condition}\n\nBitte antworten Sie mit dem aktuellen Stand und dem Nachweis, auf den Sie sich stuetzen, damit die RCSA-Zeile vor der Freigabe belegt ist.\n\nVielen Dank.",
    },
    requestEvidenceHint: {
      en: "For example the test reference, the reconciliation output or the signed first-line confirmation.",
      de: "Zum Beispiel die Testreferenz, das Abstimmungsergebnis oder die unterzeichnete Bestaetigung der ersten Linie.",
    },
    escalation: {
      committeeRef: "CMT-NFR-2026-10",
      committeeName: "Group Non-Financial Risk Committee",
      meetingDate: "2026-10-13",
      label: { en: "Group NFR Committee, 13.10.2026", de: "Konzern NFR-Ausschuss, 13.10.2026" },
    },
    reserveFocus: {
      en: "Protect time to read the challenge pack before {title}",
      de: "Zeit zum Lesen des Challenge-Pakets vor {title} schuetzen",
    },
  },
};
