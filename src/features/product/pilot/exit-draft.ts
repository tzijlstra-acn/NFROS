/**
 * What the exit decision form starts from.
 *
 * Server only. The Pilot Lead decides; the product only gathers what the
 * decision should rest on, so nothing has to be remembered or retyped:
 *
 *   evidence               the evidence pack's digest, the readiness result,
 *                          every recorded reading and every issue, each as a
 *                          reference the decision will cite
 *   unresolved conditions  open issues, risks and decisions required, and
 *                          every readiness control that is not verified
 *   control findings       the control measures computed from the product's
 *                          own records, as they read now
 *
 * Every line is editable before review. The outcome, the rationale, the
 * commercial implication and the next-wave recommendation are left empty:
 * those are the person's judgment and the product proposes none of them.
 */

import { readControlMeasures } from "@/features/product/value/measures";
import { evidenceDigest } from "./evidence-pack";
import { readPilotReadiness, type PilotReadiness } from "./readiness";
import type { ExitEvidenceRef } from "./rules";
import type { PilotWorkspace } from "./workspace";

export interface ExitDraft {
  evidence: ExitEvidenceRef[];
  unresolvedConditions: string[];
  controlFindings: string[];
  readiness: PilotReadiness;
}

export function buildExitDraft(workspace: PilotWorkspace, language: "en" | "de"): ExitDraft {
  const say = (pair: { en: string; de: string }) => (language === "de" ? pair.de : pair.en);
  const readiness = readPilotReadiness();

  const evidence: ExitEvidenceRef[] = [
    {
      kind: "evidence-pack",
      ref: evidenceDigest(workspace, readiness),
      label: language === "de" ? "Pilot-Nachweispaket, Stand dieser Pruefung" : "Pilot evidence pack, as of this review",
    },
    {
      kind: "readiness",
      ref: `${readiness.verified}/${readiness.total}`,
      label:
        language === "de"
          ? `Pilotbereitschaft: ${readiness.verified} von ${readiness.total} verifiziert`
          : `Pilot readiness: ${readiness.verified} of ${readiness.total} verified`,
    },
    ...workspace.readings.map((entry) => {
      const measure = workspace.measures.find((candidate) => candidate.measure.id === entry.measureId);
      return {
        kind: "measure-reading",
        ref: entry.id,
        label: `${measure ? say(measure.label) : entry.measureId}, ${entry.weekStarting}`,
      };
    }),
    ...workspace.issues.map((issue) => ({ kind: "pilot-issue", ref: issue.id, label: issue.title })),
  ];

  const unresolvedConditions = [
    ...workspace.issues
      .filter((issue) => issue.status === "open")
      .map((issue) => `${issue.title} (${issue.kind}, ${issue.severity})`),
    ...readiness.controls
      .filter((control) => control.reading.status !== "verified")
      .map((control) => `${say(control.label)}: ${say(control.reading.detail)}`),
  ];

  const controlFindings = readControlMeasures().map(
    (measure) => `${say(measure.label)}: ${measure.value ? say(measure.value) : say(measure.reading.detail)}`,
  );

  return { evidence, unresolvedConditions, controlFindings, readiness };
}
