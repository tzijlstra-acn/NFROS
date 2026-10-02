/**
 * RCSA Cycle Assistant process definition.
 *
 * Defines the eight-stage Risk and Control Self-Assessment lifecycle and the
 * role-app metadata for the Operational Risk Partner workday. The seeded run
 * places Anna Weber (P-003) in Stage 2 (Evidence Refresh) for the
 * Payments Execution Q4 assessment (RCSA-ARC-DE-PAYOPS-2026-Q4).
 *
 * Data references trace back to the seeded scenario objects. Every object ID
 * in this file must resolve to a seeded row. An ID that does not resolve makes
 * the process page load against data that does not exist.
 *
 *   Assessment: RCSA-ARC-DE-PAYOPS-2026-Q4
 *   Process:    PRC-0041 (Payment repair and manual override, PAY.03.02)
 *   Key risk:   RSK-0211 (Erroneous or unauthorised payment release)
 *   Key control: CTL-PAY-014 (Four-eyes independent review)
 *   KRI in breach: KRI-PAY-007 (Override rate)
 *   Control test: TST-2026-0318
 *
 * Consequence kinds referenced below match the switch in
 * src/scenario/engine/decide.ts. A kind not in that switch does not execute.
 *
 * Synthetic institution and data. All figures are scenario figures.
 */

import type {
  RoleAppDefinition,
  RoleAppRun,
  RoleProcessDefinition,
} from "@/role-apps/contracts";

/* ---------------------------------------------------------------------------
   The RCSA Cycle process definition
   --------------------------------------------------------------------------- */

export const RCSA_CYCLE_PROCESS: RoleProcessDefinition = {
  id: "rcsa-cycle",
  roleId: "rcsa",
  name: "RCSA Cycle",
  nameDe: "RCSA-Zyklus",
  description:
    "The eight-stage structured process through which the Operational Risk Partner conducts, challenges and closes a Risk and Control Self-Assessment for one process scope. The process runs from the initial scope confirmation through evidence gathering, first-line input, the second-line challenge workshop, residual rating, action approval and the ongoing monitoring plan. Each stage ends with a recorded human decision before the next opens.",
  stages: [
    {
      id: "scope-trigger",
      sequence: 1,
      name: "Scope and Trigger",
      nameDe: "Umfang und Ausloesungsgrund",
      outcome:
        "The assessment scope is confirmed: one or more processes, the legal entities in scope, the cycle quarter and the trigger reason are recorded and visible to all participants.",
      humanResponsibility:
        "Confirm the scope and trigger. A scope that is too narrow misses a risk; a scope that is too wide produces a report nobody reads.",
      relatedObjectKinds: ["assessment", "process", "risk", "decision"],
      decisionKinds: ["agenda"],
    },
    {
      id: "evidence-refresh",
      sequence: 2,
      name: "Evidence Refresh",
      nameDe: "Nachweisauffrischung",
      outcome:
        "All KRI readings, control test results, incident records and audit findings from the period are retrieved, classified and loaded into the assessment evidence corpus. Gaps are formally requested.",
      humanResponsibility:
        "Decide the investigation strategy: three separate indicator explanations following the escalation rule, or one causal investigation that names the mechanism. The choice determines whether the committee sees one problem or three.",
      relatedObjectKinds: ["kri", "evidence", "control", "assessment", "decision"],
      decisionKinds: ["escalation"],
    },
    {
      id: "risk-control-change",
      sequence: 3,
      name: "Risk and Control Change",
      nameDe: "Risiko- und Kontrollaenderung",
      outcome:
        "Every risk and control in scope has been compared against the prior assessment version. Changes to inherent position, control effectiveness and appetite position are recorded with a source reference for each change.",
      humanResponsibility:
        "Determine what the evidence says about risk likelihood. Zero recorded losses and no detected errors produce different conclusions about likelihood depending on whether the detection controls can actually see the outcome. The inference step is a human judgment.",
      relatedObjectKinds: ["risk", "control", "assessment", "kri", "evidence", "decision"],
      decisionKinds: ["residual-risk"],
    },
    {
      id: "first-line-input",
      sequence: 4,
      name: "First-line Input",
      nameDe: "Erstlinien-Eingabe",
      outcome:
        "First-line control owners have submitted their effectiveness positions. Gaps between first-line and second-line positions are surfaced with source citations. The challenge workshop agenda is set.",
      humanResponsibility:
        "Set the workshop agenda. The order in which contested items are heard determines whether the room arrives at a disputed rating with momentum or with fatigue. Facilitation sequence is a professional instrument, not an administrative choice.",
      relatedObjectKinds: ["assessment", "control", "risk", "decision"],
      decisionKinds: ["agenda"],
    },
    {
      id: "challenge-workshop",
      sequence: 5,
      name: "Challenge Workshop",
      nameDe: "Herausforderungs-Workshop",
      outcome:
        "Every risk and control rating has been discussed. Agreed positions are recorded in the assessment. Disputed positions carry a recorded second-line dissent with the rationale and the evidence cited.",
      humanResponsibility:
        "Challenge the first-line position on the contested control and record the second-line conclusion. The authority gate requires a confirmed rationale that is the professional's own, not a summary of what the AI prepared.",
      relatedObjectKinds: ["control", "risk", "assessment", "decision"],
      decisionKinds: ["control-effectiveness"],
    },
    {
      id: "rating-appetite",
      sequence: 6,
      name: "Rating and Appetite",
      nameDe: "Bewertung und Risikobereitschaft",
      outcome:
        "Every residual position is computed from the agreed control effectiveness using the group methodology. Each risk is classified as within appetite, at limit or outside appetite. Risks outside appetite have an active remediation plan or a documented Risikoakzeptanz.",
      humanResponsibility:
        "Ratify the residual rating for RSK-0211. The score of 12 is outside appetite and triggers either a committed remediation plan or a Risikoakzeptanz signed by the entity Chief Operating Officer. Which path applies is a judgment about the control environment and the timeline.",
      relatedObjectKinds: ["risk", "assessment", "control", "action", "decision"],
      decisionKinds: ["residual-risk"],
    },
    {
      id: "actions-approval",
      sequence: 7,
      name: "Actions and Approval",
      nameDe: "Massnahmen und Genehmigung",
      outcome:
        "All remediation actions from the assessment are recorded with an owner, a due date and a success criterion. The assessment is versioned and submitted for sign-off. The committee paper is drafted.",
      humanResponsibility:
        "Approve the assessment version and confirm the recorded rationale is your own. An assessment that changes a rating outside appetite cannot be submitted without the named professional's confirmation. Also decide whether to revise the recorded reasoning when the mechanism is now known to differ from the stated argument.",
      relatedObjectKinds: ["assessment", "action", "decision", "evidence"],
      decisionKinds: ["residual-risk", "assurance-conclusion"],
    },
    {
      id: "monitoring-reassessment",
      sequence: 8,
      name: "Monitoring and Reassessment",
      nameDe: "Ueberwachung und Neubewertung",
      outcome:
        "KRI alert thresholds are confirmed for the post-cycle monitoring period. The next cycle trigger date is set. The assessment is closed and the process returns to continuous monitoring.",
      humanResponsibility:
        "Confirm the monitoring plan. Enhanced monitoring of KRI-PAY-007 (override rate) and KRI-RES-005 (tested fallback arrangements) applies until the remediation actions close. The professional signs off the frequency and the escalation threshold.",
      relatedObjectKinds: ["kri", "action", "assessment", "process"],
      decisionKinds: ["risk-acceptance"],
    },
  ],
};

/* ---------------------------------------------------------------------------
   The RCSA Cycle Assistant role-app
   --------------------------------------------------------------------------- */

export const RCSA_CYCLE_ASSISTANT: RoleAppDefinition = {
  id: "rcsa-cycle-assistant",
  roleId: "rcsa",
  functionPackId: "nfr-operational-risk",
  name: "RCSA Cycle Assistant",
  nameDe: "RCSA-Zyklus-Assistent",
  summary:
    "Guides the Operational Risk Partner through the eight-stage RCSA lifecycle from evidence refresh to monitoring plan, surfacing contested positions and preparing the challenge workshop.",
  summaryDe:
    "Begleitet den Operational Risk Partner durch den achtphasigen RCSA-Zyklus von der Nachweisauffrischung bis zum Ueberwachungsplan und bereitet den Herausforderungs-Workshop vor.",
  status: "installed",
  maturity: "production-shaped",
  version: "1.0.0",
  entryRoute: "/workday/rcsa/processes/rcsa-cycle",
  processId: "rcsa-cycle",
  coveredStageIds: [
    "scope-trigger",
    "evidence-refresh",
    "risk-control-change",
    "first-line-input",
    "challenge-workshop",
    "rating-appetite",
    "actions-approval",
    "monitoring-reassessment",
  ],
  requiredConnectorPackIds: ["risk-register", "control-register", "kri-platform"],
  humanDecisionKinds: [
    "escalation",
    "residual-risk",
    "control-effectiveness",
    "agenda",
    "assurance-conclusion",
    "risk-acceptance",
  ],
};

/* ---------------------------------------------------------------------------
   The seeded run for the Payments Execution Q4 scenario
   --------------------------------------------------------------------------- */

/**
 * The in-progress RCSA run at the start of the demo day.
 *
 * The Payments Execution Q4 assessment (RCSA-ARC-DE-PAYOPS-2026-Q4) is in
 * Stage 2 (Evidence Refresh). Three red KRI readings have arrived, the control
 * test result for TST-2026-0318 is in the evidence corpus, and the challenge
 * workshop is scheduled for 10:30 the same day. The professional has three
 * open decisions at 07:45 and the workshop decision at 11:45.
 *
 * The assessment subject is "assessment" rather than "process" because the run
 * tracks the assessment record, not the process it covers. The process
 * PRC-0041 is the scope; the assessment RCSA-ARC-DE-PAYOPS-2026-Q4 is the
 * object being produced.
 */
export const RCSA_PAYMENTS_Q4_RUN: RoleAppRun = {
  id: "run-rcsa-payops-q4-2026",
  roleAppId: "rcsa-cycle-assistant",
  roleId: "rcsa",
  subjectKind: "assessment",
  subjectId: "RCSA-ARC-DE-PAYOPS-2026-Q4",
  currentStageId: "evidence-refresh",
  status: "in-progress",
  startedAt: "2026-10-06T05:30:00.000Z",
  updatedAt: "2026-10-06T07:45:00.000Z",
  completedAt: null,
};
