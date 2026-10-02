/**
 * Seeded offline response envelopes.
 *
 * These are valid AssistantResponseEnvelope values used when the AI pipeline
 * is unavailable (offline mode) or when a demo run does not reach a live
 * model. Each envelope is a realistic, scenario-coherent response that shows
 * the full evidence situation including gaps, inferences and limitations.
 *
 * The envelopes are also used in integration tests to verify that the
 * rendering contract handles isLimited responses correctly.
 */

import type { AssistantResponseEnvelope } from "./contracts";

/* ==========================================================================
   RCSA: evidence refresh for ARC DE PayOps Q4 2026
   ========================================================================== */

export const RCSA_EVIDENCE_REFRESH_OFFLINE_RESPONSE: AssistantResponseEnvelope = {
  responseId: "RESP-RCSA-EVID-OFFLINE-001",
  mode: "offline",
  context: {
    roleId: "rcsa",
    subjectKind: "assessment",
    subjectId: "RCSA-ARC-DE-PAYOPS-2026-Q4",
    processRunId: "RUN-RCSA-PAYOPS-Q4-2026",
    stageRunId: "STAGERUN-RCSA-2",
  },
  parts: [
    {
      type: "answer",
      text: "Evidence refresh for RCSA-ARC-DE-PAYOPS-2026-Q4 is partially complete. Four of six required evidence items are available. Two items require escalation before proceeding.",
      lang: "en",
    },
    {
      type: "fact",
      claim:
        "Incident log contains 5 events in the review period, including 1 Priority 2 payment processing failure on 2026-09-14.",
      sourceIds: ["EVD-INC-2026-Q3"],
      confidence: "verified",
    },
    {
      type: "inference",
      claim:
        "The Priority 2 incident may indicate a control weakness in payment reconciliation. This should be challenged in the workshop.",
      supportingSourceIds: ["EVD-INC-2026-Q3"],
      uncertainty: "Causal relationship not yet confirmed by first line.",
      label: "AI inference -- not an approved record",
    },
    {
      type: "uncertainty",
      description:
        "Q3 KRI data has not been received from Risk Operations. The assessment cannot confirm KRI trend direction without this source.",
      requiredForCompletion: true,
    },
    {
      type: "recommendation",
      text: "Proceed to first-line input with available evidence. Escalate Q3 KRI and BCA-CTRL-142 test result as blocking items.",
      basis: ["EVD-INC-2026-Q3", "EVD-PROC-TELEM-Q3"],
      limitations:
        "Q3 KRI data and control test result are unavailable. This recommendation is based on incomplete evidence.",
      isLimited: true,
    },
  ],
  sourceIds: ["EVD-INC-2026-Q3", "EVD-PROC-TELEM-Q3"],
  requiredSourceStatus: [
    { sourceKind: "kri-data", sourceId: "KRI-PAYOPS-Q3", status: "unavailable" },
    { sourceKind: "control-test", sourceId: "BCA-CTRL-142", status: "unavailable" },
    { sourceKind: "incident-log", sourceId: "EVD-INC-2026-Q3", status: "loaded" },
    { sourceKind: "process-telemetry", sourceId: "EVD-PROC-TELEM-Q3", status: "loaded" },
  ],
  isLimited: true,
  generatedAt: "2026-10-02T07:45:00Z",
};

/* ==========================================================================
   TPRM: evidence review for Veridian Document Systems GmbH (TP-0099)
   ========================================================================== */

export const TPRM_EVIDENCE_REVIEW_OFFLINE_RESPONSE: AssistantResponseEnvelope = {
  responseId: "RESP-TPRM-EVID-OFFLINE-001",
  mode: "offline",
  context: {
    roleId: "tprm",
    subjectKind: "supplier",
    subjectId: "TP-0099",
    processRunId: "RUN-TPRM-VERIDIAN-2026",
    stageRunId: "STAGERUN-TPRM-4",
  },
  parts: [
    {
      type: "answer",
      text: "Evidence review for Veridian Document Systems GmbH (TP-0099) shows 4 of 7 items assessed. Two blocking items remain outstanding.",
      lang: "en",
    },
    {
      type: "fact",
      claim:
        "SOC 2 Type II Report covers the period ending 2025-12-31. The report is current and covers the payment data processing service.",
      sourceIds: ["EVD-OB-0099-04"],
      confidence: "verified",
    },
    {
      type: "fact",
      claim:
        "IT Security Assessment (EVD-OB-0099-02) was accepted with condition: full penetration test covering payment infrastructure is required within 90 days.",
      sourceIds: ["EVD-OB-0099-02"],
      confidence: "verified",
    },
    {
      type: "uncertainty",
      description:
        "Penetration Test Report (full scope) has not been received. This is a required evidence item for payment infrastructure outsourcing.",
      requiredForCompletion: true,
    },
    {
      type: "recommendation",
      text: "Proceed to specialist reviews for available evidence. Issue formal escalation for missing penetration test report and BCM plan.",
      basis: ["EVD-OB-0099-01", "EVD-OB-0099-02", "EVD-OB-0099-03", "EVD-OB-0099-04"],
      limitations:
        "Penetration test report and BCM plan are outstanding. Final onboarding decision cannot be made without these items.",
      isLimited: true,
    },
  ],
  sourceIds: ["EVD-OB-0099-01", "EVD-OB-0099-02", "EVD-OB-0099-03", "EVD-OB-0099-04"],
  requiredSourceStatus: [
    { sourceKind: "penetration-test", sourceId: "EVD-OB-0099-05", status: "unavailable" },
    { sourceKind: "bcm-plan", sourceId: "EVD-OB-0099-06", status: "unavailable" },
    { sourceKind: "vendor-questionnaire", sourceId: "EVD-OB-0099-01", status: "loaded" },
    { sourceKind: "security-assessment", sourceId: "EVD-OB-0099-02", status: "loaded" },
    { sourceKind: "privacy-assessment", sourceId: "EVD-OB-0099-03", status: "loaded" },
    { sourceKind: "soc2-report", sourceId: "EVD-OB-0099-04", status: "loaded" },
  ],
  isLimited: true,
  generatedAt: "2026-10-02T07:45:00Z",
};
