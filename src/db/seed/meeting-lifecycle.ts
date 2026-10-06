/**
 * Seed data for the meeting lifecycle.
 *
 * Writes, inside the seed transaction and after the role-app runs exist:
 *
 *   The two meetings the seeded minutes record (audit T20). The RCSA scope
 *   confirmation of 01.10.2026 and the Veridian evidence triage call of the
 *   same day are held meetings with their participants, their pack and the
 *   process stage they served, so every reference the seeded minutes make
 *   resolves to a row.
 *
 *   The recorded links migration 0005 introduced, by the rules the Work Hub
 *   used to apply on every read: a meeting's process run and stage, and an
 *   action's meeting, minutes and process lineage where its minutes list it.
 *
 *   The confirmed RCSA minutes as an evidence document, because confirmed
 *   minutes are evidence; and the structured draft of the TPRM minutes.
 *
 *   The safe mode cache of the AI layer: the validated preparation of every
 *   meeting of the two flagship roles, captured from exactly the records the
 *   page later checks it against, and the validated minutes drafts of the two
 *   journey meetings (the RCSA challenge workshop and the TPRM supplier
 *   challenge), in English and German, keyed to their full recorded
 *   conversation. A draft that does not validate is refused here, so safe
 *   mode can never serve what offline mode would reject.
 *
 * Deterministic: no clock, no random values. Synthetic institution and data.
 */

import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, roles, type RoleId } from "@/db/schema/core";
import { actions, decisions } from "@/db/schema/decisions";
import { meetingMinutes, roleAppStageRuns } from "@/db/schema/role-app-runtime";
import { evidenceChunks, evidenceDocuments, meetings } from "@/db/schema/work";
import { getEvidenceByIds, getProcessScopes } from "@/db/repositories/work-hub";
import { getMeetingTranscript, getRecordedContradictions } from "@/db/repositories/meetings";
import { getWorkRoleConfig } from "@/features/work/roles";
import { loadWorkShared } from "@/features/work/hub-data";
import { personName } from "@/features/work/shared";
import { deriveMeetingProcessLink } from "@/features/work/modules/meeting-facts";
import {
  MINUTES_DRAFT_SCHEMA_VERSION,
  validateMinutesDraft,
  type MinutesDraft,
  type MinutesValidationContext,
} from "@/features/work/modules/meetings/ai-schema";
import { captureMeetingPreparation, captureMinutesDraft, digestOf } from "@/features/work/modules/meetings/ai";
import { renderMinutesText } from "@/features/work/modules/meetings/compose";
import { draftOfMinutes, evidenceIdForMinutes, outcomeLabel } from "@/features/work/modules/meetings/lifecycle";
import { evidenceNamedBy, preparationInputFor, stageSnapshotFor } from "@/features/work/modules/meetings/load";

const db = () => getDb();

/** When the safe mode outputs count as captured: before the day starts. */
const CAPTURED_AT = "2026-10-06T07:40:00.000Z";

/* ==========================================================================
   The meetings the seeded minutes record
   ========================================================================== */

export const lifecycleMeetingsData: Array<typeof meetings.$inferInsert> = [
  {
    id: "MTG-RCSA-PAYOPS-Q4-2026-SCOPE",
    runId: DEFAULT_RUN_ID,
    roleId: "rcsa",
    reference: "RCSA-SCOPE-ARC-DE-PAYOPS-2026-Q4",
    title: "RCSA scope confirmation: Payments Execution Q4 2026",
    titleDe: "Bestaetigung des RCSA-Umfangs: Payments Execution Q4 2026",
    kind: "scope-confirmation",
    momentLabel: "09:30",
    scheduledFor: "2026-10-01T09:30:00.000Z",
    participantUserIds: ["P-003", "P-007"],
    objective:
      "Confirm the process in scope, the trigger and the assessment period of the Q4 RCSA for Payments Execution, and agree the date of the challenge workshop.",
    preparationSummary:
      "The KRI-PAY-007 override rate has been in amber breach for three consecutive months. The override log extract for September and the TST-2026-0318 control test report are the evidence the scope rests on.",
    evidenceDocumentIds: ["EVD-2026-41805", "EVD-2026-41850", "EVD-2026-41202"],
    preparedQuestions: [],
    status: "concluded",
    outcome:
      "Scope confirmed as PRC-0041 (Payment repair and manual override), triggered by the KRI-PAY-007 amber breach. Assessment period 01.07.2026 to 30.09.2026. Challenge workshop set for 06.10.2026 at 10:30.",
    concludedAt: "2026-10-01T10:00:00.000Z",
    supportsVoice: false,
    subjectKind: "rcsa",
    subjectId: "RCSA-ARC-DE-PAYOPS-2026-Q4",
    heldByUserId: "P-003",
    heldAt: "2026-10-01T10:00:00.000Z",
    processRunId: "RUN-RCSA-PAYOPS-Q4-2026",
    stageId: "scope-trigger",
  },
  {
    id: "MTG-TPRM-VERIDIAN-TRIAGE-2026",
    runId: DEFAULT_RUN_ID,
    roleId: "tprm",
    reference: "TPRM-TRIAGE-TP-0099-20261001",
    title: "Veridian evidence triage: Stage 4 review call",
    titleDe: "Veridian Nachweissichtung: Abstimmung zu Stufe 4",
    kind: "one-to-one",
    momentLabel: "11:00",
    scheduledFor: "2026-10-01T11:00:00.000Z",
    participantUserIds: ["P-002", "P-005"],
    objective:
      "Agree the position on the outstanding onboarding evidence for Veridian Document Systems GmbH before the Stage 4 gate, with the specialist reviews that depend on it.",
    preparationSummary:
      "Four of six requested items are accepted. The full penetration test report and the BCM plan and test report are outstanding. Group Information Security requires the full report before contract signature.",
    evidenceDocumentIds: ["EVD-OB-0099-02", "EVD-OB-0099-05", "EVD-OB-0099-06", "EVD-OB-0099-08"],
    preparedQuestions: [],
    status: "concluded",
    outcome:
      "A conditional gate pass to Stage 5 is appropriate if the penetration test report and the BCM plan are received by 09.10.2026. Draft minutes pending confirmation.",
    concludedAt: "2026-10-01T11:45:00.000Z",
    supportsVoice: false,
    subjectKind: "supplier",
    subjectId: "TP-0099",
    heldByUserId: "P-002",
    heldAt: "2026-10-01T11:45:00.000Z",
    processRunId: "RUN-TPRM-VERIDIAN-2026",
    stageId: "evidence-review",
  },
];

/* ==========================================================================
   The structured TPRM draft
   ========================================================================== */

const VERIDIAN_TRIAGE_DRAFT: MinutesDraft = {
  schemaVersion: MINUTES_DRAFT_SCHEMA_VERSION,
  language: "en",
  summary:
    "Stefan Brunner reviewed the outstanding evidence position for Veridian Document Systems GmbH (TP-0099) with Group Information Security and Group Operational Resilience. Four evidence items are accepted; the full penetration test report and the BCM plan and test report are outstanding. A conditional gate pass to Stage 5 is appropriate if both are received by 09.10.2026.",
  facts: [
    { key: "F-01", text: "Supplier: Veridian Document Systems GmbH (TP-0099), procurement request PRQ-2026-0087.", evidenceIds: [], turnIds: [], origin: "ai" },
    { key: "F-02", text: "Stage 4 evidence: four items accepted, two outstanding.", evidenceIds: [], turnIds: [], origin: "ai" },
    { key: "F-03", text: "EVD-OB-0099-05, the penetration test report, has not been received and is expected by 09.10.2026.", evidenceIds: ["EVD-OB-0099-05"], turnIds: [], origin: "ai" },
    { key: "F-04", text: "EVD-OB-0099-06, the BCM plan and test report, has not been received and the supplier has not confirmed a date.", evidenceIds: ["EVD-OB-0099-06"], turnIds: [], origin: "ai" },
    { key: "F-05", text: "Group Information Security requires the full penetration test report before contract signature.", evidenceIds: ["EVD-OB-0099-02"], turnIds: [], origin: "ai" },
    { key: "F-06", text: "The legal review is pending and expected by 20.10.2026.", evidenceIds: [], turnIds: [], origin: "ai" },
  ],
  decisions: [],
  actions: [
    {
      key: "A-01",
      title: "Chase the full penetration test report from Veridian",
      existingActionId: null,
      ownerUserId: "P-002",
      ownerLabel: "Veridian Document Systems GmbH, Vendor Relations",
      dueOn: "2026-10-09",
      kind: "evidence-request",
      completionCondition: "Closed when the full penetration test report is received, reviewed by Group Information Security and filed as EVD-OB-0099-05.",
      evidenceIds: ["EVD-OB-0099-05"],
      turnIds: [],
      origin: "ai",
    },
    {
      key: "A-02",
      title: "Chase the BCM plan and test report from Veridian",
      existingActionId: null,
      ownerUserId: "P-002",
      ownerLabel: "Veridian Document Systems GmbH, Vendor Relations",
      dueOn: "2026-10-09",
      kind: "evidence-request",
      completionCondition: "Closed when the BCM plan and its latest test report are received, reviewed by Group Operational Resilience and filed as EVD-OB-0099-06.",
      evidenceIds: ["EVD-OB-0099-06"],
      turnIds: [],
      origin: "ai",
    },
  ],
  unresolved: [
    { key: "U-01", text: "Netherlands backup data residency confirmation from the supplier.", turnIds: [], origin: "ai" },
    { key: "U-02", text: "Subprocessor consent model: prior consent, or notice and objection.", turnIds: [], origin: "ai" },
  ],
  evidenceIds: ["EVD-OB-0099-02", "EVD-OB-0099-05", "EVD-OB-0099-06", "EVD-OB-0099-08"],
  distribution: ["P-002", "P-005"],
};

/* ==========================================================================
   The safe mode minutes drafts of the two journey meetings
   ========================================================================== */

const RCSA_WORKSHOP = "MTG-2026-0005";
const TPRM_CHALLENGE = "MTG-2026-0002";

function turns(meeting: string, ...numbers: number[]): string[] {
  return numbers.map((n) => `MTM-${meeting.replace(/^MTG-/, "")}-${String(n).padStart(2, "0")}`);
}

const rcsa = (n: number[]) => turns(RCSA_WORKSHOP, ...n);
const tprm = (n: number[]) => turns(TPRM_CHALLENGE, ...n);

const RCSA_WORKSHOP_DRAFTS: Record<"en" | "de", MinutesDraft> = {
  en: {
    schemaVersion: MINUTES_DRAFT_SCHEMA_VERSION,
    language: "en",
    summary:
      "RCSA challenge workshop on RSK-0211, 06.10.2026, 10:30 to 11:58. The Q4 residual rating was not agreed: the first line holds 9 of 25 (Medium) and the second line proposes 12 of 25 (Medium-High). The control owner withdrew the lag explanation for EXC-TST-2026-0318-02. A formal second line dissent goes to the Group NFR Committee with both positions and the assessment owner's contingency. Scenario figures.",
    facts: [
      { key: "F-01", text: "Control test TST-2026-0318: 1,204 overrides in the population, a sample of 60, 54 clean, 4 exceptions and 2 items that could not be concluded. The deviation rate is 6.67 percent on exceptions alone and 10.00 percent if the unconcluded items count as deviations. Scenario figures.", evidenceIds: ["EVD-2026-41850", "EVD-2026-41304"], turnIds: rcsa([6]), origin: "ai" },
      { key: "F-02", text: "On EXC-TST-2026-0318-02 the release at 16:47:12 and the secondary review at 16:58:31 come from the same RepairDesk audit log, so the review followed the release. The control owner accepted this in the session.", evidenceIds: ["EVD-2026-41852"], turnIds: rcsa([7, 8, 9]), origin: "ai" },
      { key: "F-03", text: "EXC-TST-2026-0318-04 has no secondary review record and secondaryReviewRequired is false. The rule evaluation trace records waiver code BCP-THROUGHPUT while fallback route mode was active on 27.08.2026.", evidenceIds: ["EVD-2026-41852"], turnIds: rcsa([9, 11, 12]), origin: "ai" },
      { key: "F-04", text: "None of the six flagged items was detected by CTL-PAY-021; all six came from second line fieldwork three to six weeks after the event. CTL-PAY-029 reconciles payment value, not authorisation.", evidenceIds: ["EVD-2026-41850"], turnIds: rcsa([13, 14]), origin: "ai" },
      { key: "F-05", text: "Reviewer capacity has been at 75 percent since 01.08.2026. Position PR-SR-02 has no offer and no start date, and MSN-2026-0166 is six days overdue. Scenario figures.", evidenceIds: ["EVD-2026-41822"], turnIds: rcsa([16, 17]), origin: "ai" },
      { key: "F-06", text: "Three of the six flagged items are first line execution failures; two are caused by supplier side design and cannot be remediated by the control owner alone.", evidenceIds: ["EVD-2026-41850"], turnIds: rcsa([4, 5, 20, 21]), origin: "ai" },
    ],
    decisions: [
      { key: "D-01", text: "The Q4 residual rating for RSK-0211 was not agreed: first line 9 of 25, second line 12 of 25. A formal second line dissent under the RCSA dissent clause goes to CMT-NFR-2026-10 with both positions and the contingency. The decision is recorded on Decisions by its owner.", decisionId: "DEC-2026-0772", outcome: "not-agreed", turnIds: rcsa([18, 19, 22, 23]), origin: "ai" },
      { key: "D-02", text: "The assessment owner will move the rating himself if the RepairDesk tenant configuration confirms a rule that waives secondary review.", decisionId: null, outcome: "agreed", turnIds: rcsa([19, 21]), origin: "ai" },
    ],
    actions: [
      { key: "A-01", title: "Obtain the RepairDesk tenant configuration and the rule definition behind waiver code BCP-THROUGHPUT under CTR-2023-0117-A4 clause 2.1", existingActionId: null, ownerUserId: "P-002", ownerLabel: "", dueOn: "2026-10-07", kind: "evidence-request", completionCondition: "Closed when the tenant configuration and the rule definition are received and filed with their document reference.", evidenceIds: ["EVD-2026-41852"], turnIds: rcsa([12, 21, 22, 23]), origin: "ai" },
      { key: "A-02", title: "Provide comment text for the ten remaining risk lines of the Q4 assessment", existingActionId: null, ownerUserId: "P-007", ownerLabel: "", dueOn: "2026-10-13", kind: "validation-request", completionCondition: "Closed when each of the ten risk lines carries comment text confirmed by its line owner.", evidenceIds: [], turnIds: rcsa([22, 23]), origin: "ai" },
      { key: "A-03", title: "Recruit to secondary reviewer position PR-SR-02", existingActionId: "MSN-2026-0166", ownerUserId: "P-007", ownerLabel: "", dueOn: "2026-09-30", kind: "remediation", completionCondition: "Discussed in the workshop: no offer and no start date are recorded, so the residual rating cannot rely on the seat being filled.", evidenceIds: ["EVD-2026-41822"], turnIds: rcsa([16, 17]), origin: "ai" },
    ],
    unresolved: [
      { key: "U-01", text: "Whether a configured rule can set secondaryReviewRequired to false on a route substitution override, and so whether the control description in EVD-2026-41908 describes the control the system implements.", turnIds: rcsa([12]), origin: "ai" },
      { key: "U-02", text: "The classification of EXC-TST-2026-0318-04: a control bypass, a system design gap or a permitted waiver.", turnIds: rcsa([20, 21]), origin: "ai" },
      { key: "U-03", text: "The Q4 residual rating for RSK-0211, pending the tenant configuration and the committee.", turnIds: rcsa([19, 23]), origin: "ai" },
    ],
    evidenceIds: ["EVD-2026-41850", "EVD-2026-41304", "EVD-2026-41852", "EVD-2026-41822", "EVD-2026-41908", "EVD-2026-41200"],
    distribution: ["P-003", "P-007", "P-008", "P-004"],
  },
  de: {
    schemaVersion: MINUTES_DRAFT_SCHEMA_VERSION,
    language: "de",
    summary:
      "RCSA Challenge-Workshop zu RSK-0211 am 06.10.2026, 10:30 bis 11:58. Die Restrisikobewertung fuer Q4 wurde nicht vereinbart: Die erste Linie haelt 9 von 25 (Mittel), die zweite Linie schlaegt 12 von 25 (Mittel-Hoch) vor. Die Kontrollverantwortliche hat die Erklaerung einer Systemverzoegerung fuer EXC-TST-2026-0318-02 zurueckgenommen. Ein formeller Dissens der zweiten Linie geht mit beiden Positionen und der Bedingung des Bewertungsverantwortlichen an den Konzern NFR-Ausschuss. Szenariowerte.",
    facts: [
      { key: "F-01", text: "Kontrolltest TST-2026-0318: 1.204 Overrides in der Grundgesamtheit, eine Stichprobe von 60, 54 ohne Befund, 4 Ausnahmen und 2 nicht beurteilbare Faelle. Die Abweichungsquote betraegt 6,67 Prozent allein aus den Ausnahmen und 10,00 Prozent, wenn die nicht beurteilbaren Faelle als Abweichungen zaehlen. Szenariowerte.", evidenceIds: ["EVD-2026-41850", "EVD-2026-41304"], turnIds: rcsa([6]), origin: "ai" },
      { key: "F-02", text: "Bei EXC-TST-2026-0318-02 stammen die Freigabe um 16:47:12 und die Zweitpruefung um 16:58:31 aus demselben RepairDesk-Protokoll; die Pruefung folgte also der Freigabe. Die Kontrollverantwortliche hat dies in der Sitzung anerkannt.", evidenceIds: ["EVD-2026-41852"], turnIds: rcsa([7, 8, 9]), origin: "ai" },
      { key: "F-03", text: "EXC-TST-2026-0318-04 hat keinen Nachweis einer Zweitpruefung, und secondaryReviewRequired ist false. Der Regelauswertungsnachweis zeigt den Verzichtscode BCP-THROUGHPUT bei aktivem Ausweichrouting am 27.08.2026.", evidenceIds: ["EVD-2026-41852"], turnIds: rcsa([9, 11, 12]), origin: "ai" },
      { key: "F-04", text: "Keiner der sechs markierten Faelle wurde von CTL-PAY-021 entdeckt; alle sechs stammen aus der Feldarbeit der zweiten Linie, drei bis sechs Wochen nach dem Ereignis. CTL-PAY-029 gleicht Zahlungsbetraege ab, nicht die Autorisierung.", evidenceIds: ["EVD-2026-41850"], turnIds: rcsa([13, 14]), origin: "ai" },
      { key: "F-05", text: "Die Pruefkapazitaet liegt seit dem 01.08.2026 bei 75 Prozent. Fuer die Stelle PR-SR-02 gibt es weder Angebot noch Eintrittsdatum, und MSN-2026-0166 ist sechs Tage ueberfaellig. Szenariowerte.", evidenceIds: ["EVD-2026-41822"], turnIds: rcsa([16, 17]), origin: "ai" },
      { key: "F-06", text: "Drei der sechs markierten Faelle sind Ausfuehrungsfehler der ersten Linie; zwei gehen auf Gestaltungsentscheidungen des Lieferanten zurueck und koennen von der Kontrollverantwortlichen nicht allein behoben werden.", evidenceIds: ["EVD-2026-41850"], turnIds: rcsa([4, 5, 20, 21]), origin: "ai" },
    ],
    decisions: [
      { key: "D-01", text: "Die Restrisikobewertung fuer RSK-0211 in Q4 wurde nicht vereinbart: erste Linie 9 von 25, zweite Linie 12 von 25. Ein formeller Dissens der zweiten Linie nach der RCSA-Dissensklausel geht mit beiden Positionen und der Bedingung an CMT-NFR-2026-10. Die Entscheidung erfasst ihre verantwortliche Person unter Entscheidungen.", decisionId: "DEC-2026-0772", outcome: "not-agreed", turnIds: rcsa([18, 19, 22, 23]), origin: "ai" },
      { key: "D-02", text: "Der Bewertungsverantwortliche passt die Bewertung selbst an, wenn die RepairDesk-Mandantenkonfiguration eine Regel bestaetigt, die auf die Zweitpruefung verzichtet.", decisionId: null, outcome: "agreed", turnIds: rcsa([19, 21]), origin: "ai" },
    ],
    actions: [
      { key: "A-01", title: "RepairDesk-Mandantenkonfiguration und Regeldefinition zum Verzichtscode BCP-THROUGHPUT nach CTR-2023-0117-A4 Klausel 2.1 einholen", existingActionId: null, ownerUserId: "P-002", ownerLabel: "", dueOn: "2026-10-07", kind: "evidence-request", completionCondition: "Abgeschlossen, wenn Mandantenkonfiguration und Regeldefinition eingegangen und mit Dokumentreferenz abgelegt sind.", evidenceIds: ["EVD-2026-41852"], turnIds: rcsa([12, 21, 22, 23]), origin: "ai" },
      { key: "A-02", title: "Kommentartexte fuer die zehn weiteren Risikozeilen der Q4-Bewertung liefern", existingActionId: null, ownerUserId: "P-007", ownerLabel: "", dueOn: "2026-10-13", kind: "validation-request", completionCondition: "Abgeschlossen, wenn jede der zehn Risikozeilen einen von ihrer Zeilenverantwortung bestaetigten Kommentar traegt.", evidenceIds: [], turnIds: rcsa([22, 23]), origin: "ai" },
      { key: "A-03", title: "Stelle PR-SR-02 fuer die Zweitpruefung besetzen", existingActionId: "MSN-2026-0166", ownerUserId: "P-007", ownerLabel: "", dueOn: "2026-09-30", kind: "remediation", completionCondition: "Im Workshop eroertert: Weder Angebot noch Eintrittsdatum sind erfasst, daher kann sich die Restrisikobewertung nicht auf die Besetzung stuetzen.", evidenceIds: ["EVD-2026-41822"], turnIds: rcsa([16, 17]), origin: "ai" },
    ],
    unresolved: [
      { key: "U-01", text: "Ob eine konfigurierte Regel secondaryReviewRequired bei einem Routenersatz-Override auf false setzen kann, und damit, ob die Kontrollbeschreibung in EVD-2026-41908 die Kontrolle beschreibt, die das System umsetzt.", turnIds: rcsa([12]), origin: "ai" },
      { key: "U-02", text: "Die Einordnung von EXC-TST-2026-0318-04: Umgehung der Kontrolle, Gestaltungsluecke im System oder zulaessiger Verzicht.", turnIds: rcsa([20, 21]), origin: "ai" },
      { key: "U-03", text: "Die Restrisikobewertung fuer RSK-0211 in Q4, bis die Mandantenkonfiguration vorliegt und der Ausschuss entschieden hat.", turnIds: rcsa([19, 23]), origin: "ai" },
    ],
    evidenceIds: ["EVD-2026-41850", "EVD-2026-41304", "EVD-2026-41852", "EVD-2026-41822", "EVD-2026-41908", "EVD-2026-41200"],
    distribution: ["P-003", "P-007", "P-008", "P-004"],
  },
};

const NOVALINK = "Novalink client service, M. Falk";

const TPRM_CHALLENGE_DRAFTS: Record<"en" | "de", MinutesDraft> = {
  en: {
    schemaVersion: MINUTES_DRAFT_SCHEMA_VERSION,
    language: "en",
    summary:
      "Supplier challenge with Novalink Payment Services GmbH (TP-0042) on 06.10.2026, 10:30 to 11:28, for the 2026 annual reassessment. No reassessment item was accepted as closed: R04, R07, R11 and R19 remain open. Five written requests go to the supplier today, and the subprocessor notice point goes to Group Legal for an opinion on the binding notice mechanism.",
    facts: [
      { key: "F-01", text: "The disaster recovery report of 22.05.2026 covers Frankfurt and Amsterdam only. The Swiss instance hosted by Helvetia CloudWorks is not in it, so ARC-CH holds SVC-0042-02 with no recovery evidence.", evidenceIds: ["EVD-2026-40118"], turnIds: tprm([3, 4, 5]), origin: "ai" },
      { key: "F-02", text: "The same report shows recovery in 3 hours 40 minutes against the 2 hour objective in Appendix A1 version 3.0. No remediation plan exists, and no remedy attaches to the objective as drafted.", evidenceIds: ["EVD-2026-40118", "EVD-2026-41425"], turnIds: tprm([8, 9, 11]), origin: "ai" },
      { key: "F-03", text: "Subprocessor register version 6.1 of 03.08.2026 lists Meridian Operations Support, onboarded 01.05.2026, which binding Appendix A3 version 4.2 does not. Clause 3.4 requires 60 days prior written notice; the supplier relies on portal publication.", evidenceIds: ["EVD-2026-41405", "EVD-2026-41410"], turnIds: tprm([12, 13, 14]), origin: "ai" },
      { key: "F-04", text: "Appendix A6 version 2.0 assumes an internal payment repair tool that Arcadia does not have. The exit test MSN-2026-0177 is not started and is an unmet condition of the RSK-0184 risk acceptance.", evidenceIds: ["EVD-2026-41435"], turnIds: tprm([18, 19, 20]), origin: "ai" },
      { key: "F-05", text: "NOVA-GATE availability in September 2026 was 99.62 percent against the contracted 99.7 percent. Arcadia found this by its own calculation, not by a supplier notification. Scenario figures.", evidenceIds: ["EVD-2026-41810"], turnIds: tprm([21, 22, 23]), origin: "ai" },
    ],
    decisions: [
      { key: "D-01", text: "The recovery time gap was put to the supplier, who has no explanation and no remediation plan. The materiality decision stays with its owner, who records it on Decisions.", decisionId: "DEC-2026-0741", outcome: "referred", turnIds: tprm([8, 9, 10, 11]), origin: "ai" },
      { key: "D-02", text: "No item in R04, R07, R11 or R19 is accepted as closed on a verbal assurance.", decisionId: null, outcome: "agreed", turnIds: tprm([1, 26]), origin: "ai" },
    ],
    actions: [
      { key: "A-01", title: "Obtain and assess disaster recovery evidence for the RepairDesk Swiss instance", existingActionId: "MSN-2026-0188", ownerUserId: "P-002", ownerLabel: "", dueOn: "2026-10-20", kind: "evidence-request", completionCondition: "A written request for a recovery test result covering the Zurich instance, with a date, goes to the supplier today.", evidenceIds: ["EVD-2026-40118"], turnIds: tprm([26, 27]), origin: "ai" },
      { key: "A-02", title: "Obtain a penetration test scope statement confirming coverage of the override APIs", existingActionId: "MSN-2026-0184", ownerUserId: "P-002", ownerLabel: NOVALINK, dueOn: "2026-10-16", kind: "evidence-request", completionCondition: "The supplier will revert on the scope extract this week; no date was committed.", evidenceIds: ["EVD-2026-40233"], turnIds: tprm([24, 25, 27]), origin: "ai" },
      { key: "A-03", title: "Reconcile the binding subprocessor appendix against the supplier register", existingActionId: "MSN-2026-0191", ownerUserId: "P-002", ownerLabel: "", dueOn: "2026-11-13", kind: "remediation", completionCondition: "Updated to record the supplier's stated position that portal publication constitutes notice.", evidenceIds: ["EVD-2026-41410"], turnIds: tprm([13, 27]), origin: "ai" },
      { key: "A-04", title: "Obtain a written region topology statement per service and per entity from Novalink", existingActionId: null, ownerUserId: "P-002", ownerLabel: NOVALINK, dueOn: "2026-10-16", kind: "evidence-request", completionCondition: "Closed when the statement names the recovery region of every Arcadia facing RepairDesk and NOVA-GATE instance, Zurich included, and is filed.", evidenceIds: [], turnIds: tprm([15, 16, 17, 26]), origin: "ai" },
      { key: "A-05", title: "Obtain Novalink's explanation of the gap between the recovery time objective and the tested recovery", existingActionId: null, ownerUserId: "P-002", ownerLabel: NOVALINK, dueOn: "2026-10-16", kind: "evidence-request", completionCondition: "Closed when a written explanation, or written confirmation that there is none, is filed with the reassessment.", evidenceIds: ["EVD-2026-40118"], turnIds: tprm([8, 9, 26]), origin: "ai" },
      { key: "A-06", title: "Obtain a Group Legal opinion on whether portal publication can satisfy the notice obligation in Appendix A3 clause 3.4", existingActionId: null, ownerUserId: "P-016", ownerLabel: "", dueOn: "2026-10-20", kind: "evidence-request", completionCondition: "Closed when the opinion is filed and states whether notice for Meridian and the Amsterdam region was given under the contract.", evidenceIds: ["EVD-2026-41410"], turnIds: tprm([14, 27]), origin: "ai" },
    ],
    unresolved: [
      { key: "U-01", text: "Which region each Arcadia facing RepairDesk and NOVA-GATE instance recovers into, and whether the Zurich instance has any recovery target at all.", turnIds: tprm([15, 16, 17]), origin: "ai" },
      { key: "U-02", text: "Whether portal publication can satisfy clause 3.4 of Appendix A3 at all.", turnIds: tprm([13, 14]), origin: "ai" },
      { key: "U-03", text: "When the penetration test scope extract arrives; the supplier committed no date.", turnIds: tprm([25]), origin: "ai" },
    ],
    evidenceIds: ["EVD-2026-40118", "EVD-2026-40233", "EVD-2026-41405", "EVD-2026-41410", "EVD-2026-41425", "EVD-2026-41435", "EVD-2026-41810"],
    distribution: ["P-002", "P-010", "P-005"],
  },
  de: {
    schemaVersion: MINUTES_DRAFT_SCHEMA_VERSION,
    language: "de",
    summary:
      "Lieferantengespraech mit Novalink Payment Services GmbH (TP-0042) am 06.10.2026, 10:30 bis 11:28, zur jaehrlichen Neubewertung 2026. Kein Punkt der Neubewertung wurde als geschlossen anerkannt: R04, R07, R11 und R19 bleiben offen. Fuenf schriftliche Anforderungen gehen heute an den Lieferanten, und die Frage der Subunternehmer-Mitteilung geht zur Stellungnahme zum verbindlichen Mitteilungsweg an Group Legal.",
    facts: [
      { key: "F-01", text: "Der Bericht zum Notfalltest vom 22.05.2026 deckt nur Frankfurt und Amsterdam ab. Die Schweizer Instanz bei Helvetia CloudWorks kommt darin nicht vor; ARC-CH haelt SVC-0042-02 damit ohne Wiederherstellungsnachweis.", evidenceIds: ["EVD-2026-40118"], turnIds: tprm([3, 4, 5]), origin: "ai" },
      { key: "F-02", text: "Derselbe Bericht zeigt eine Wiederherstellung in 3 Stunden 40 Minuten gegenueber dem Ziel von 2 Stunden in Anhang A1 Version 3.0. Es gibt keinen Massnahmenplan, und an das Ziel ist in der vorliegenden Fassung keine Rechtsfolge geknuepft.", evidenceIds: ["EVD-2026-40118", "EVD-2026-41425"], turnIds: tprm([8, 9, 11]), origin: "ai" },
      { key: "F-03", text: "Das Subunternehmerverzeichnis Version 6.1 vom 03.08.2026 nennt Meridian Operations Support, aufgenommen am 01.05.2026, das der verbindliche Anhang A3 Version 4.2 nicht enthaelt. Klausel 3.4 verlangt 60 Tage vorherige schriftliche Mitteilung; der Lieferant stuetzt sich auf die Veroeffentlichung im Portal.", evidenceIds: ["EVD-2026-41405", "EVD-2026-41410"], turnIds: tprm([12, 13, 14]), origin: "ai" },
      { key: "F-04", text: "Anhang A6 Version 2.0 setzt ein internes Werkzeug fuer die Zahlungsreparatur voraus, das Arcadia nicht hat. Der Exit-Test MSN-2026-0177 ist nicht begonnen und ist eine offene Bedingung der Risikoakzeptanz zu RSK-0184.", evidenceIds: ["EVD-2026-41435"], turnIds: tprm([18, 19, 20]), origin: "ai" },
      { key: "F-05", text: "Die Verfuegbarkeit von NOVA-GATE lag im September 2026 bei 99,62 Prozent gegenueber vertraglich 99,7 Prozent. Arcadia hat dies selbst berechnet, nicht durch eine Mitteilung des Lieferanten erfahren. Szenariowerte.", evidenceIds: ["EVD-2026-41810"], turnIds: tprm([21, 22, 23]), origin: "ai" },
    ],
    decisions: [
      { key: "D-01", text: "Die Luecke bei der Wiederherstellungszeit wurde dem Lieferanten vorgelegt; er hat weder eine Erklaerung noch einen Massnahmenplan. Die Entscheidung zur Wesentlichkeit bleibt bei ihrer verantwortlichen Person, die sie unter Entscheidungen erfasst.", decisionId: "DEC-2026-0741", outcome: "referred", turnIds: tprm([8, 9, 10, 11]), origin: "ai" },
      { key: "D-02", text: "Kein Punkt in R04, R07, R11 oder R19 wird auf eine muendliche Zusicherung hin als geschlossen anerkannt.", decisionId: null, outcome: "agreed", turnIds: tprm([1, 26]), origin: "ai" },
    ],
    actions: [
      { key: "A-01", title: "Notfallnachweise fuer die Schweizer RepairDesk-Instanz einholen und bewerten", existingActionId: "MSN-2026-0188", ownerUserId: "P-002", ownerLabel: "", dueOn: "2026-10-20", kind: "evidence-request", completionCondition: "Eine schriftliche Anforderung eines Wiederherstellungstests fuer die Instanz in Zuerich, mit Datum, geht heute an den Lieferanten.", evidenceIds: ["EVD-2026-40118"], turnIds: tprm([26, 27]), origin: "ai" },
      { key: "A-02", title: "Umfangserklaerung zum Penetrationstest mit Abdeckung der Override-Schnittstellen einholen", existingActionId: "MSN-2026-0184", ownerUserId: "P-002", ownerLabel: NOVALINK, dueOn: "2026-10-16", kind: "evidence-request", completionCondition: "Der Lieferant meldet sich diese Woche zum Umfangsauszug; ein Datum wurde nicht zugesagt.", evidenceIds: ["EVD-2026-40233"], turnIds: tprm([24, 25, 27]), origin: "ai" },
      { key: "A-03", title: "Verbindlichen Subunternehmeranhang mit dem Verzeichnis des Lieferanten abgleichen", existingActionId: "MSN-2026-0191", ownerUserId: "P-002", ownerLabel: "", dueOn: "2026-11-13", kind: "remediation", completionCondition: "Aktualisiert um die Position des Lieferanten, dass die Veroeffentlichung im Portal als Mitteilung gilt.", evidenceIds: ["EVD-2026-41410"], turnIds: tprm([13, 27]), origin: "ai" },
      { key: "A-04", title: "Schriftliche Erklaerung zur Regionstopologie je Dienst und Gesellschaft von Novalink einholen", existingActionId: null, ownerUserId: "P-002", ownerLabel: NOVALINK, dueOn: "2026-10-16", kind: "evidence-request", completionCondition: "Abgeschlossen, wenn die Erklaerung die Wiederherstellungsregion jeder fuer Arcadia betriebenen RepairDesk- und NOVA-GATE-Instanz einschliesslich Zuerich nennt und abgelegt ist.", evidenceIds: [], turnIds: tprm([15, 16, 17, 26]), origin: "ai" },
      { key: "A-05", title: "Erklaerung von Novalink zur Luecke zwischen Wiederherstellungsziel und getesteter Wiederherstellung einholen", existingActionId: null, ownerUserId: "P-002", ownerLabel: NOVALINK, dueOn: "2026-10-16", kind: "evidence-request", completionCondition: "Abgeschlossen, wenn eine schriftliche Erklaerung oder die schriftliche Bestaetigung, dass es keine gibt, bei der Neubewertung abgelegt ist.", evidenceIds: ["EVD-2026-40118"], turnIds: tprm([8, 9, 26]), origin: "ai" },
      { key: "A-06", title: "Stellungnahme von Group Legal einholen, ob die Veroeffentlichung im Portal die Mitteilungspflicht nach Anhang A3 Klausel 3.4 erfuellen kann", existingActionId: null, ownerUserId: "P-016", ownerLabel: "", dueOn: "2026-10-20", kind: "evidence-request", completionCondition: "Abgeschlossen, wenn die Stellungnahme abgelegt ist und sagt, ob fuer Meridian und die Region Amsterdam vertragsgemaess mitgeteilt wurde.", evidenceIds: ["EVD-2026-41410"], turnIds: tprm([14, 27]), origin: "ai" },
    ],
    unresolved: [
      { key: "U-01", text: "In welche Region jede fuer Arcadia betriebene RepairDesk- und NOVA-GATE-Instanz wiederhergestellt wird, und ob die Instanz in Zuerich ueberhaupt ein Wiederherstellungsziel hat.", turnIds: tprm([15, 16, 17]), origin: "ai" },
      { key: "U-02", text: "Ob die Veroeffentlichung im Portal Klausel 3.4 von Anhang A3 ueberhaupt erfuellen kann.", turnIds: tprm([13, 14]), origin: "ai" },
      { key: "U-03", text: "Wann der Umfangsauszug zum Penetrationstest eintrifft; der Lieferant hat kein Datum zugesagt.", turnIds: tprm([25]), origin: "ai" },
    ],
    evidenceIds: ["EVD-2026-40118", "EVD-2026-40233", "EVD-2026-41405", "EVD-2026-41410", "EVD-2026-41425", "EVD-2026-41435", "EVD-2026-41810"],
    distribution: ["P-002", "P-010", "P-005"],
  },
};

/** The authored drafts, by meeting. */
const SAFE_MINUTES_DRAFTS: Record<string, Record<"en" | "de", MinutesDraft>> = {
  [RCSA_WORKSHOP]: RCSA_WORKSHOP_DRAFTS,
  [TPRM_CHALLENGE]: TPRM_CHALLENGE_DRAFTS,
};

/* ==========================================================================
   Writing it
   ========================================================================== */

const FLAGSHIP_ROLES: RoleId[] = ["rcsa", "tprm"];

/** The links migration 0005 introduced, by the rules the Work Hub used to apply on every read. */
function recordLinks(runId: string): number {
  let written = 0;
  for (const roleId of FLAGSHIP_ROLES) {
    const config = getWorkRoleConfig(roleId);
    if (!config) continue;
    const scopes = getProcessScopes(roleId, runId);
    const rows = db()
      .select()
      .from(meetings)
      .where(and(eq(meetings.runId, runId), eq(meetings.roleId, roleId), isNull(meetings.processRunId)))
      .all();
    for (const meeting of rows) {
      const link = deriveMeetingProcessLink(meeting, scopes, config);
      if (!link) continue;
      db()
        .update(meetings)
        .set({ processRunId: link.processRunId, stageId: link.stageId })
        .where(and(eq(meetings.runId, runId), eq(meetings.id, meeting.id)))
        .run();
      written += 1;
    }
  }

  /* An action listed by minutes was raised in that meeting, at the stage the meeting served. */
  for (const minutes of db().select().from(meetingMinutes).where(eq(meetingMinutes.runId, runId)).all()) {
    if (minutes.actionIds.length === 0) continue;
    const meeting = db().select().from(meetings).where(and(eq(meetings.runId, runId), eq(meetings.id, minutes.meetingId))).get();
    const stageRun =
      meeting?.processRunId && meeting.stageId
        ? db()
            .select()
            .from(roleAppStageRuns)
            .where(and(eq(roleAppStageRuns.runId, runId), eq(roleAppStageRuns.roleAppRunId, meeting.processRunId), eq(roleAppStageRuns.stageId, meeting.stageId)))
            .get()
        : undefined;
    db()
      .update(actions)
      .set({
        sourceMinutesId: minutes.id,
        sourceMeetingId: meeting ? meeting.id : null,
        sourceProcessRunId: meeting?.processRunId ?? null,
        sourceStageId: meeting?.stageId ?? null,
        sourceStageRunId: stageRun?.id ?? null,
      })
      .where(and(eq(actions.runId, runId), inArray(actions.id, minutes.actionIds), isNull(actions.sourceMinutesId)))
      .run();
    written += minutes.actionIds.length;
  }
  return written;
}

/** Confirmed minutes are evidence. Files the seeded confirmed minutes as one, with lineage. */
function fileConfirmedMinutes(runId: string): number {
  let written = 0;
  const confirmed = db()
    .select()
    .from(meetingMinutes)
    .where(and(eq(meetingMinutes.runId, runId), inArray(meetingMinutes.status, ["confirmed", "distributed"]), isNull(meetingMinutes.evidenceDocumentId)))
    .all();
  for (const minutes of confirmed) {
    const meeting = db().select().from(meetings).where(and(eq(meetings.runId, runId), eq(meetings.id, minutes.meetingId))).get();
    const shared = loadWorkShared(minutes.roleId as RoleId);
    if (!meeting || !shared) continue;
    const draft = draftOfMinutes(minutes, "en");
    const id = evidenceIdForMinutes(minutes.id);
    const body = renderMinutesText({
      title: minutes.title,
      reference: meeting.reference,
      when: `${meeting.scheduledFor.slice(8, 10)}.${meeting.scheduledFor.slice(5, 7)}.${meeting.scheduledFor.slice(0, 4)}, ${meeting.scheduledFor.slice(11, 16)}`,
      participants: meeting.participantUserIds.map((person) => personName(shared, person) ?? person),
      draft,
      personName: (person) => personName(shared, person) ?? "",
      decisionTitle: () => "",
      actionIds: new Map(),
      outcomeLabel: (outcome) => outcomeLabel(outcome, "en"),
    });
    const confirmer = minutes.confirmedByUserId;
    const entityId =
      db().select({ entityId: roles.entityId }).from(roles).where(and(eq(roles.runId, runId), eq(roles.id, minutes.roleId as RoleId))).get()?.entityId ??
      "ARC-DE";
    db()
      .insert(evidenceDocuments)
      .values({
        id,
        runId,
        reference: minutes.id,
        title: minutes.title,
        titleDe: minutes.title,
        sourceType: "meeting-minutes",
        sourceSystem: "Work Hub minutes",
        authorLabel: confirmer ? `${personName(shared, confirmer) ?? confirmer} (${confirmer})` : "Meeting record",
        authorUserId: confirmer,
        documentDate: (minutes.confirmedAt ?? minutes.createdAt).slice(0, 10),
        ingestedAt: minutes.confirmedAt ?? minutes.createdAt,
        entityIds: [entityId],
        dataClassification: "internal",
        status: "current",
        requestedFromLabel: null,
        requestedOn: null,
        isStale: false,
        stalenessNote: "",
        provenance: "approved-record",
        body,
        summary: minutes.summary.slice(0, 400),
        relatedObjectIds: [
          ...new Set([meeting.id, minutes.id, ...(meeting.subjectId ? [meeting.subjectId] : []), ...minutes.actionIds, ...(meeting.processRunId ? [meeting.processRunId] : [])]),
        ],
        pageCount: 1,
        fromSharedEvent: false,
        revealedAtMoment: "07:45",
        sourceMinutesId: minutes.id,
        sourceMessageId: null,
      })
      .run();
    db()
      .insert(evidenceChunks)
      .values({
        id: `${id}-C00`,
        runId,
        documentId: id,
        chunkIndex: 0,
        locator: "Section 1",
        content: body,
        embedding: null,
        embeddingModel: null,
        embeddedAt: null,
        tokenEstimate: Math.ceil(body.length / 4),
      })
      .run();
    db()
      .update(meetingMinutes)
      .set({ evidenceDocumentId: id, draft: draft as unknown as Record<string, unknown>, contentDigest: digestOf(draft) })
      .where(and(eq(meetingMinutes.runId, runId), eq(meetingMinutes.id, minutes.id)))
      .run();
    written += 2;
  }
  return written;
}

function validationAtSeed(roleId: RoleId, runId: string, meetingId: string, cited: readonly string[]): MinutesValidationContext {
  const shared = loadWorkShared(roleId);
  if (!shared) throw new Error(`The role ${roleId} has no Work Hub, so its minutes cannot be validated.`);
  const transcript = getMeetingTranscript(meetingId, runId);
  return {
    knownEvidenceIds: new Set(getEvidenceByIds(cited, runId).keys()),
    knownTurnIds: new Set(transcript.map((turn) => turn.id)),
    /* Every decision of the role, including those presented later in the day. The page checks visibility again. */
    knownDecisionIds: new Set(
      db().select({ id: decisions.id }).from(decisions).where(and(eq(decisions.runId, runId), eq(decisions.roleId, roleId))).all().map((row) => row.id),
    ),
    openActionIds: new Set(shared.actions.filter((action) => action.status !== "completed" && action.status !== "cancelled").map((action) => action.id)),
    internalPeople: new Set(shared.assignable.map((person) => person.id)),
    actionKinds: new Set(Object.keys(shared.config.actionKinds)),
    scenarioDate: shared.scenarioDate,
    author: "ai",
  };
}

function citedBy(draft: MinutesDraft): string[] {
  return [...new Set([...draft.evidenceIds, ...draft.facts.flatMap((fact) => fact.evidenceIds), ...draft.actions.flatMap((action) => action.evidenceIds)])];
}

/** The structured draft of the seeded TPRM minutes, validated and digested. */
function writeSeededDraft(runId: string): number {
  const validation = validationAtSeed("tprm", runId, "MTG-TPRM-VERIDIAN-TRIAGE-2026", citedBy(VERIDIAN_TRIAGE_DRAFT));
  const checked = validateMinutesDraft(VERIDIAN_TRIAGE_DRAFT, validation);
  if (!checked.ok) {
    throw new Error(`The seeded Veridian minutes draft does not validate: ${checked.failures.map((failure) => `${failure.path} ${failure.message.en}`).join("; ")}`);
  }
  db()
    .update(meetingMinutes)
    .set({ draft: checked.output as unknown as Record<string, unknown>, contentDigest: digestOf(checked.output), version: 1 })
    .where(and(eq(meetingMinutes.runId, runId), eq(meetingMinutes.id, "MINUTES-TPRM-EVIDENCE-TRIAGE-2026")))
    .run();
  return 1;
}

/** The safe mode cache: every flagship meeting's preparation, and the two journey meetings' minutes drafts. */
function captureSafeOutputs(runId: string): number {
  let written = 0;
  for (const roleId of FLAGSHIP_ROLES) {
    const shared = loadWorkShared(roleId);
    if (!shared) continue;
    const contradictions = getRecordedContradictions(roleId, runId);
    for (const meeting of shared.meetings) {
      const transcript = getMeetingTranscript(meeting.id, runId);
      const minutes = [...shared.minutes].reverse().find((entry) => entry.meetingId === meeting.id) ?? null;
      const evidence = getEvidenceByIds(evidenceNamedBy(meeting, transcript, contradictions, minutes, "en"), runId);
      const stage = stageSnapshotFor(meeting, shared);
      captureMeetingPreparation(preparationInputFor(shared, meeting, evidence, stage, contradictions), new Set(evidence.keys()), {
        runId,
        roleId,
        capturedAt: CAPTURED_AT,
      });
      written += 1;

      const drafts = SAFE_MINUTES_DRAFTS[meeting.id];
      if (drafts) {
        const cited = [...new Set([...citedBy(drafts.en), ...citedBy(drafts.de)])];
        captureMinutesDraft(meeting, transcript, drafts, validationAtSeed(roleId, runId, meeting.id, cited), { runId, roleId, capturedAt: CAPTURED_AT });
        written += 1;
      }
    }
  }
  return written;
}

/**
 * Writes the meeting records of the seeded day: the held meetings the seeded
 * minutes record, the recorded links, the structured TPRM draft and the
 * confirmed minutes as evidence. Runs inside the seed transaction, after the
 * role-app runs, the minutes and the evidence corpus exist, and before the
 * process engine captures its own safe outputs, so the engine's digests are
 * taken over the corpus this adds to.
 *
 * Returns the number of rows written, for the seed summary.
 */
export function seedMeetingRecords(runId: string = DEFAULT_RUN_ID): number {
  let written = 0;
  for (const meeting of lifecycleMeetingsData) {
    db().insert(meetings).values({ ...meeting, runId }).run();
    written += 1;
  }
  written += recordLinks(runId);
  written += writeSeededDraft(runId);
  written += fileConfirmedMinutes(runId);
  return written;
}

/**
 * Captures the safe mode outputs of the meeting lifecycle. Runs last in the
 * seed transaction, so every meeting seeded by any layer (the onboarding
 * stages add their own specialist huddles) is linked and covered.
 */
export function seedMeetingSafeOutputs(runId: string = DEFAULT_RUN_ID): number {
  return recordLinks(runId) + captureSafeOutputs(runId);
}
