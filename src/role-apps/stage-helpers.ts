/**
 * Small constructors for stage contracts.
 *
 * The two installed processes declare sixteen stage contracts between them.
 * These helpers keep the repeated parts (the entry criterion on the previous
 * stage, the standard blocking conditions, the completion approval) identical
 * across all sixteen, so a difference between two stages is always a
 * deliberate one.
 *
 * Connector instance identifiers are the seeded ones from
 * `src/integrations/seed.ts`. They are repeated here as literals rather than
 * imported so that a Role App definition does not pull the integration seed
 * into every bundle that reads a stage name.
 */

import type {
  Bilingual,
  StageApprovalSpec,
  StageBlockingCondition,
  StageCriterion,
  StageImplementationStatus,
} from "./contracts";

/** The GRC platform simulator: risks, controls, assessments, findings, actions, suppliers, services. */
export const CONNECTOR_GRC = "CI-GRC-SIM";
/** The process intelligence simulator: processes and mined cases. Read only. */
export const CONNECTOR_PROCESS_INTELLIGENCE = "CI-PI-SIM";
/** The document repository simulator: the evidence corpus. */
export const CONNECTOR_DOCUMENTS = "CI-DMS-SIM";

export function t(en: string, de: string): Bilingual {
  return { en, de };
}

export function previousStageCompleted(stageId: string, sequence: number, nameEn: string, nameDe: string): StageCriterion {
  return {
    kind: "stage-completed",
    stageId,
    label: t(`Stage ${sequence} ${nameEn} is completed`, `Stufe ${sequence} ${nameDe} ist abgeschlossen`),
  };
}

export const SOURCES_RESOLVED: StageCriterion = {
  kind: "sources-resolved",
  label: t("Every required source is readable", "Jede erforderliche Quelle ist lesbar"),
};

export function aiJobCompleted(jobKey: string): StageCriterion {
  return {
    kind: "ai-job-completed",
    jobKey,
    label: t("The AI preparation is completed and validated", "Die KI-Vorbereitung ist abgeschlossen und geprueft"),
  };
}

export function preparationStored(artifactKey: string): StageCriterion {
  return {
    kind: "artifact-stored",
    artifactKey,
    label: t("The validated preparation is stored", "Die gepruefte Vorbereitung ist gespeichert"),
  };
}

/** The blocking conditions every stage carries. */
export function standardBlocking(jobKey: string): StageBlockingCondition[] {
  return [
    {
      kind: "stage-not-implemented",
      label: t("This stage is not executable in this build", "Diese Stufe ist in diesem Build nicht ausfuehrbar"),
    },
    {
      kind: "required-source-unavailable",
      label: t("A required source is unavailable", "Eine erforderliche Quelle ist nicht verfuegbar"),
    },
    {
      kind: "ai-job-failed",
      jobKey,
      label: t("The AI preparation failed", "Die KI-Vorbereitung ist fehlgeschlagen"),
    },
  ];
}

/** The approval every stage completion needs, through the app's completion tool. */
export function completionApproval(toolName: string): StageApprovalSpec {
  return {
    key: "stage-completion",
    label: t(
      "Approve the stage outcome and confirm the rationale is your own",
      "Stufenergebnis genehmigen und bestaetigen, dass die Begruendung Ihre eigene ist",
    ),
    covers: { kind: "stage-completion" },
    toolName,
    material: true,
  };
}

export const IMPLEMENTED: StageImplementationStatus = { implemented: true, reason: null, owner: null };

export function notImplemented(owner: string, reason: Bilingual): StageImplementationStatus {
  return { implemented: false, reason, owner };
}
