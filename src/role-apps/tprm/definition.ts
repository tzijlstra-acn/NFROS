/**
 * TPRM Third-Party Onboarding process definition.
 *
 * Defines the eight-stage onboarding process, the role-app metadata and the
 * seeded run for the Third-Party Risk Manager workday. The seeded run places
 * Stefan Brunner (P-002) in Stage 4 (Nachweispruefung) with Veridian Document
 * Systems GmbH (TP-0099).
 *
 * Pattern follows src/role-apps/rcsa/definition.ts exactly. Stage sequence
 * numbers are one-based to match the RCSA precedent.
 *
 * Synthetic institution and data. All figures are scenario figures.
 */

import type {
  RoleAppDefinition,
  RoleAppRun,
  RoleProcessDefinition,
} from "@/role-apps/contracts";

/* ---------------------------------------------------------------------------
   The Third-Party Onboarding process definition
   --------------------------------------------------------------------------- */

export const TPRM_ONBOARDING_PROCESS: RoleProcessDefinition = {
  id: "tprm-third-party-onboarding",
  roleId: "tprm",
  name: "Third-Party Onboarding",
  nameDe: "Drittparteien-Onboarding",
  description:
    "The eight-stage structured process through which the Third-Party Risk Manager brings a new supplier into scope, from the initial business request through classification, tailored due diligence and evidence review, to specialist reviews, contract negotiation, governance approval and the handover of ongoing monitoring. Each stage ends with a recorded human decision before the next opens.",
  stages: [
    {
      id: "request-and-intake",
      sequence: 1,
      name: "Request and Intake",
      nameDe: "Antrag und Aufnahme",
      outcome:
        "The supplier candidate is registered in the third-party register with a procurement reference, a relationship owner and a validated intake form.",
      humanResponsibility:
        "Confirm that the intake request is complete and that the procurement reference is correctly assigned. An incomplete intake form at Stage 1 generates multiple correction loops in later stages.",
      relatedObjectKinds: ["supplier", "evidence"],
      decisionKinds: ["agenda"],
    },
    {
      id: "classification-and-criticality",
      sequence: 2,
      name: "Classification and Criticality",
      nameDe: "Einstufung und Kritikalitaet",
      outcome:
        "The regulatory classification (outsourcing or ICT service), the proposed criticality rating and the contracting entities are recorded with rationale and visible to the business owner.",
      humanResponsibility:
        "Determine the regulatory classification. Whether the arrangement is a regulated outsourcing or an ICT service changes which due diligence template applies and which authority must approve the onboarding. The business owner's proposal is an input, not the answer.",
      relatedObjectKinds: ["supplier", "service", "decision"],
      decisionKinds: ["classification"],
    },
    {
      id: "tailored-due-diligence",
      sequence: 3,
      name: "Tailored Due Diligence",
      nameDe: "Massgeschneiderte Sorgfaltspruefung",
      outcome:
        "A due diligence questionnaire and evidence request list tailored to the classification and criticality have been dispatched and supplier responses received. Completeness is assessed.",
      humanResponsibility:
        "Approve the tailored questionnaire before dispatch. The scope of questions determines what gaps are visible at Stage 4. A questionnaire that is too narrow cannot be corrected without restarting the supplier engagement.",
      relatedObjectKinds: ["supplier", "evidence", "decision"],
      decisionKinds: ["agenda"],
    },
    {
      id: "evidence-review",
      sequence: 4,
      name: "Evidence Review",
      nameDe: "Nachweispruefung",
      outcome:
        "Every requested evidence item is either accepted, rejected with a documented reason, or recorded as outstanding with a chase date. No unreviewed item remains.",
      humanResponsibility:
        "Decide whether to pass the stage gate with outstanding items or hold the file. A conditional gate pass records the condition and the expected receipt date. The risk of an incorrect conditional pass is that the item, when it arrives, contradicts the specialist review already underway.",
      relatedObjectKinds: ["supplier", "evidence", "decision"],
      decisionKinds: ["evidence-adequacy"],
    },
    {
      id: "specialist-reviews",
      sequence: 5,
      name: "Specialist Reviews",
      nameDe: "Fachpruefungen",
      outcome:
        "IT Security, Privacy and Legal have each returned a signed opinion or a formally recorded set of conditions. No review is in an unknown state.",
      humanResponsibility:
        "Agree or challenge the conditions each specialist function has set. A condition that cannot be met in the contract negotiation must be escalated now rather than discovered at the contract stage.",
      relatedObjectKinds: ["supplier", "evidence", "decision"],
      decisionKinds: ["specialist-opinion"],
    },
    {
      id: "contract-and-conditions",
      sequence: 6,
      name: "Contract and Conditions",
      nameDe: "Vertrag und Bedingungen",
      outcome:
        "A final contract draft reviewed by Group Legal, with all specialist conditions either reflected as obligations or formally waived, is approved by the business owner and procurement.",
      humanResponsibility:
        "Confirm that every open specialist condition is reflected in the contract or formally waived with a documented rationale. A condition that is left unresolved at this stage becomes an untested obligation from the first day of the arrangement.",
      relatedObjectKinds: ["supplier", "contract", "decision"],
      decisionKinds: ["contract-approval"],
    },
    {
      id: "decision-and-onboarding",
      sequence: 7,
      name: "Decision and Onboarding",
      nameDe: "Entscheidung und Onboarding",
      outcome:
        "Governance approval is recorded, the contract is signed and the supplier status is changed to active in the register.",
      humanResponsibility:
        "Present the onboarding file to the appropriate committee and record the approval decision with rationale. For an important supplier the Non-Financial Risk Committee must approve; no other approval body satisfies the policy.",
      relatedObjectKinds: ["supplier", "decision", "action"],
      decisionKinds: ["approval"],
    },
    {
      id: "handover-to-monitoring",
      sequence: 8,
      name: "Handover to Monitoring",
      nameDe: "Uebergabe an Monitoring",
      outcome:
        "The monitoring plan is created with the correct frequency for the supplier's criticality, the next assessment date is set and the onboarding case is closed.",
      humanResponsibility:
        "Set the monitoring frequency and confirm the next assessment date. An important supplier under annual monitoring with a twelve-month gap before the first check is effectively unmonitored for that period. The date is a professional judgment, not a default.",
      relatedObjectKinds: ["supplier", "action"],
      decisionKinds: ["monitoring-plan"],
    },
  ],
};

/* ---------------------------------------------------------------------------
   The Third-Party Onboarding role-app
   --------------------------------------------------------------------------- */

export const THIRD_PARTY_ONBOARDING_APP: RoleAppDefinition = {
  id: "tprm-third-party-onboarding",
  roleId: "tprm",
  functionPackId: "nfr-third-party-risk",
  name: "Third-Party Onboarding",
  nameDe: "Drittparteien-Onboarding",
  summary:
    "Guides the Third-Party Risk Manager through the eight-stage process of bringing a new supplier into scope, from intake to active monitoring.",
  summaryDe:
    "Begleitet den Third-Party Risk Manager durch den achtstufigen Prozess zur Aufnahme eines neuen Lieferanten, von der Antragstellung bis zur aktiven Ueberwachung.",
  status: "installed",
  maturity: "production-shaped",
  version: "1.0.0",
  entryRoute: "/workday/tprm/processes/third-party-onboarding",
  processId: "tprm-third-party-onboarding",
  coveredStageIds: [
    "request-and-intake",
    "classification-and-criticality",
    "tailored-due-diligence",
    "evidence-review",
    "specialist-reviews",
    "contract-and-conditions",
    "decision-and-onboarding",
    "handover-to-monitoring",
  ],
  requiredConnectorPackIds: ["third-party-register", "procurement-portal", "evidence-vault"],
  humanDecisionKinds: [
    "classification",
    "evidence-adequacy",
    "specialist-opinion",
    "contract-approval",
    "approval",
    "monitoring-plan",
  ],
};

/* ---------------------------------------------------------------------------
   The seeded run for the Veridian Document Systems GmbH onboarding case
   --------------------------------------------------------------------------- */

/**
 * The in-progress TPRM onboarding run at the start of the demo day.
 *
 * Veridian Document Systems GmbH (TP-0099) is at Stage 4 Evidence Review.
 * Four evidence items have been accepted. Two are outstanding: the full
 * penetration test report (EVD-OB-0099-05) and the business continuity plan
 * (EVD-OB-0099-06). IT Security and Privacy have signed off, each with one
 * condition. Legal is reviewing draft contract CTR-OB-2026-0087 v0.3.
 *
 * Procurement reference: PRQ-2026-0087
 * Business owner: P-007 Andreas Kellner, Head of Payment Operations
 * Contracting entities: ARC-DE, ARC-AT
 */
export const TPRM_VERIDIAN_ONBOARDING_RUN: RoleAppRun = {
  id: "run-tprm-onboarding-tp0099-2026",
  roleAppId: "tprm-third-party-onboarding",
  roleId: "tprm",
  subjectKind: "supplier",
  subjectId: "TP-0099",
  currentStageId: "evidence-review",
  status: "in-progress",
  startedAt: "2026-08-22T08:00:00.000Z",
  updatedAt: "2026-10-06T07:45:00.000Z",
  completedAt: null,
};
