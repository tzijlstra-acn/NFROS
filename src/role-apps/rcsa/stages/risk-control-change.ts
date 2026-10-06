/**
 * RCSA Stage 3, Risk and Control Change.
 *
 * The AI prepares four things from the register, the prior version, the
 * indicators, the tests and the loss record: a line by line comparison with
 * the prior cycle, the conflicts between the recorded effectiveness, the test
 * and the first line, the change candidates, and the questions the challenge
 * has to put. It decides none of them.
 *
 * The person decides relevance and materiality of each change candidate (the
 * change review), and the causal interpretation of the loss record, which is
 * the seeded decision DEC-2026-0744 recorded through the governed decision
 * path, with its consequences executed under their own approvals.
 *
 * At completion the stage writes the change log: every candidate, its prior
 * and current position, the person's classification and the decision.
 *
 * Synthetic institution and data.
 */

import { z } from "zod";
import type { Bilingual } from "@/role-apps/contracts";
import { unique } from "@/role-apps/stage-support";
import { registerArtifactBuilder, registerPreparer, registerTaskForm, type PreparerInput } from "@/features/process/registry";
import type { SourceRecord, StageContext } from "@/features/process/types";
import type { StagePreparationOutput } from "@/features/process/preparation-schema";
import { recordedTaskOutput } from "@/features/process/tasks";
import { appetiteLabel, boundDecisionId, decisionOf, effectivenessLabel, fact, factNumber, list, ratingLabel, recordsOf, sourceOf, RCSA_PROCESS_ID } from "./shared";

const STAGE_ID = "risk-control-change";
/** The decision the contract names: the Q4 cycle's. A later run binds its own copy. */
const DECISION_ID = "DEC-2026-0744";

const EFFECTIVENESS_RANK: Record<string, number> = {
  "not-effective": 0,
  "partially-effective": 1,
  "largely-effective": 2,
  "fully-effective": 3,
};

/* ==========================================================================
   Change candidates
   ========================================================================== */

interface ChangeCandidate {
  lineId: string;
  riskId: string;
  record: SourceRecord;
  prior: SourceRecord | undefined;
  effectivenessMoved: boolean;
  ratingMoved: boolean;
  appetiteMoved: boolean;
  movedOutside: boolean;
  /**
   * The assessment's position on the key control (the second line's draft)
   * and the first line's own rating disagree. The control register's recorded
   * effectiveness can lag both, so it is reported but does not decide this.
   */
  conflict: boolean;
}

function candidatesOf(sources: StageContext["sources"]): ChangeCandidate[] {
  const prior = recordsOf(sources, "prior-assessment");
  return recordsOf(sources, "risk-control-register")
    .map((record): ChangeCandidate => {
      const before = prior.find((candidate) => fact(candidate, "riskId") === fact(record, "riskId"));
      const effectivenessMoved = before !== undefined && fact(before, "controlEffectiveness") !== fact(record, "effectiveness");
      const ratingMoved = before !== undefined && fact(before, "residualRating") !== fact(record, "residualRating");
      const appetiteMoved = before !== undefined && fact(before, "appetitePosition") !== fact(record, "appetitePosition");
      const firstLine = fact(record, "firstLine");
      const assessed = fact(record, "effectiveness");
      return {
        lineId: record.id,
        riskId: fact(record, "riskId"),
        record,
        prior: before,
        effectivenessMoved,
        ratingMoved,
        appetiteMoved,
        movedOutside: appetiteMoved && fact(record, "appetitePosition") === "outside",
        conflict: firstLine.length > 0 && assessed.length > 0 && firstLine !== assessed,
      };
    })
    .filter((candidate) => candidate.prior === undefined || candidate.effectivenessMoved || candidate.ratingMoved || candidate.appetiteMoved || candidate.conflict);
}

function positionOf(record: SourceRecord | undefined, language: "en" | "de"): string {
  if (!record) return language === "de" ? "keine Vorposition" : "no prior position";
  const effectiveness = fact(record, "effectiveness") || fact(record, "controlEffectiveness");
  return `${effectivenessLabel(effectiveness, language).toLowerCase()}, ${ratingLabel(fact(record, "residualRating"), language)}, ${appetiteLabel(fact(record, "appetitePosition"), language)}`;
}

/* ==========================================================================
   The preparer
   ========================================================================== */

function composeChange(input: PreparerInput): StagePreparationOutput {
  const { sources } = input;
  const register = recordsOf(sources, "risk-control-register");
  const prior = recordsOf(sources, "prior-assessment");
  const priorCycle = fact(prior[0], "cycle");
  const candidates = candidatesOf(sources);
  const findings: StagePreparationOutput["findings"] = [];
  const contradictions: StagePreparationOutput["contradictions"] = [];
  const gaps: StagePreparationOutput["gaps"] = [];
  const inferences: StagePreparationOutput["inferences"] = [];
  const limitations: StagePreparationOutput["limitations"] = [];
  const itemAssessments: StagePreparationOutput["itemAssessments"] = [];

  /* Prior-cycle comparison, line by line. */
  for (const candidate of candidates) {
    findings.push({
      sourceKey: "risk-control-register",
      statement: {
        en: `${candidate.riskId} on ${fact(candidate.record, "keyControlId")}: ${positionOf(candidate.prior, "en")} in ${priorCycle || "the prior version"}, now ${positionOf(candidate.record, "en")}.`,
        de: `${candidate.riskId} zu ${fact(candidate.record, "keyControlId")}: ${positionOf(candidate.prior, "de")} in ${priorCycle || "der Vorversion"}, jetzt ${positionOf(candidate.record, "de")}.`,
      },
      evidenceIds: unique([...candidate.record.evidenceIds.slice(0, 2), ...(candidate.prior?.evidenceIds.slice(0, 1) ?? [])]),
      basis: "approved-record",
    });
  }
  const unchanged = register.filter((record) => !candidates.some((candidate) => candidate.lineId === record.id));
  if (unchanged.length > 0) {
    findings.push({
      sourceKey: "prior-assessment",
      statement: {
        en: `${list(unchanged.map((record) => fact(record, "riskId")), "en")} did not move against ${priorCycle || "the prior version"}, and the first and second line agree on their key control.`,
        de: `${list(unchanged.map((record) => fact(record, "riskId")), "de")} haben sich gegenueber ${priorCycle || "der Vorversion"} nicht bewegt, und erste und zweite Linie sind sich bei der Schluesselkontrolle einig.`,
      },
      evidenceIds: unique(unchanged.flatMap((record) => record.evidenceIds)).slice(0, 2),
      basis: "approved-record",
    });
  }

  /* Indicators behind the moves. */
  const red = recordsOf(sources, "kri-readings").filter((record) => fact(record, "status") === "red");
  if (red.length > 0) {
    findings.push({
      sourceKey: "kri-readings",
      statement: {
        en: `${list(red.map((record) => record.id), "en")} are Red on the scope; the register moves are consistent with them, but an indicator is evidence of pressure, not of control operation.`,
        de: `${list(red.map((record) => record.id), "de")} sind im Umfang rot; die Bewegungen im Register passen dazu, doch ein Indikator belegt Druck, nicht die Wirksamkeit einer Kontrolle.`,
      },
      evidenceIds: unique(red.flatMap((record) => record.evidenceIds)).slice(0, 3),
      basis: "verified-fact",
    });
  }

  /* Conflict analysis: recorded effectiveness against the test and the first line. */
  const tests = recordsOf(sources, "control-tests").filter((record) => !fact(record, "gapFor"));
  for (const candidate of candidates.filter((item) => item.conflict)) {
    const controlId = fact(candidate.record, "keyControlId");
    const test = tests.find((record) => fact(record, "controlId") === controlId && factNumber(record, "exceptions") > 0);
    const evidence = unique([...candidate.record.evidenceIds, ...(test?.evidenceIds ?? [])]).slice(0, 4);
    if (evidence.length >= 2) {
      const registerNote = fact(candidate.record, "secondLine") && fact(candidate.record, "secondLine") !== fact(candidate.record, "effectiveness");
      contradictions.push({
        statement: {
          en: `${controlId}: the assessment draft records ${effectivenessLabel(fact(candidate.record, "effectiveness"), "en").toLowerCase()} and the first line ${effectivenessLabel(fact(candidate.record, "firstLine"), "en").toLowerCase()}${test ? `, while ${test.id} found ${factNumber(test, "exceptions")} exception(s)` : ""}.${registerNote ? ` The control register still shows ${effectivenessLabel(fact(candidate.record, "secondLine"), "en").toLowerCase()}.` : ""}`,
          de: `${controlId}: der Bewertungsentwurf erfasst ${effectivenessLabel(fact(candidate.record, "effectiveness"), "de").toLowerCase()}, die erste Linie ${effectivenessLabel(fact(candidate.record, "firstLine"), "de").toLowerCase()}${test ? `, waehrend ${test.id} ${factNumber(test, "exceptions")} Ausnahmen festgestellt hat` : ""}.${registerNote ? ` Das Kontrollregister zeigt noch ${effectivenessLabel(fact(candidate.record, "secondLine"), "de").toLowerCase()}.` : ""}`,
        },
        evidenceIds: evidence,
      });
    }
  }

  /* Challenge questions, as open points the evidence does not settle. */
  for (const candidate of candidates.filter((item) => item.conflict)) {
    const controlId = fact(candidate.record, "keyControlId");
    const higher = (EFFECTIVENESS_RANK[fact(candidate.record, "firstLine")] ?? 0) > (EFFECTIVENESS_RANK[fact(candidate.record, "effectiveness")] ?? 0);
    gaps.push({
      key: `question-${candidate.lineId}`,
      statement: higher
        ? {
            en: `Question for the first line on ${controlId}: what would have to be true for ${effectivenessLabel(fact(candidate.record, "firstLine"), "en").toLowerCase()} to hold, and which record shows it?`,
            de: `Frage an die erste Linie zu ${controlId}: was muesste zutreffen, damit ${effectivenessLabel(fact(candidate.record, "firstLine"), "de").toLowerCase()} haelt, und welcher Datensatz zeigt es?`,
          }
        : {
            en: `Question for the second line on ${controlId}: the first line rates the control lower than the assessment draft. Is the draft rating out of date?`,
            de: `Frage an die zweite Linie zu ${controlId}: die erste Linie bewertet die Kontrolle niedriger als der Bewertungsentwurf. Ist die Entwurfsbewertung veraltet?`,
          },
      evidenceIds: candidate.record.evidenceIds.slice(0, 2),
      severity: "material",
    });
  }
  for (const candidate of candidates.filter((item) => item.movedOutside)) {
    gaps.push({
      key: `question-appetite-${candidate.lineId}`,
      statement: {
        en: `Question for the workshop on ${candidate.riskId}: the line moved outside appetite. Is the control change the only reason, or did the inherent position or the indicators change too?`,
        de: `Frage fuer den Workshop zu ${candidate.riskId}: die Zeile liegt jetzt ausserhalb der Risikobereitschaft. Ist die Kontrollaenderung der einzige Grund, oder haben sich auch die inhaerente Position oder die Indikatoren veraendert?`,
      },
      evidenceIds: candidate.record.evidenceIds.slice(0, 1),
      severity: "material",
    });
  }

  /* The loss record and the inference it invites, labelled as an inference. */
  const losses = sourceOf(sources, "losses");
  if (losses && losses.status !== "unavailable" && losses.result.records.length === 0) {
    const key = candidates.find((item) => item.conflict) ?? candidates[0];
    inferences.push({
      statement: {
        en: "Zero recorded losses on the process is a fact about the loss record. Read as low likelihood, it assumes the detective controls would see an unauthorised release at correct value; the change review should not lean on it until that is settled.",
        de: "Null erfasste Verluste im Prozess sind eine Aussage ueber die Verlusterfassung. Als geringe Eintrittswahrscheinlichkeit gelesen, unterstellt sie, dass die aufdeckenden Kontrollen eine unautorisierte Freigabe mit korrektem Betrag erkennen wuerden; die Aenderungspruefung sollte sich erst darauf stuetzen, wenn das geklaert ist.",
      },
      evidenceIds: key ? key.record.evidenceIds.slice(0, 2) : [],
      uncertainty: {
        en: "Whether the reconciliation compares beneficiary identifiers is not stated in the records loaded here; that is the question DEC-2026-0744 decides.",
        de: "Ob die Abstimmung auch Empfaengerkennungen vergleicht, steht nicht in den hier geladenen Datensaetzen; genau das entscheidet DEC-2026-0744.",
      },
    });
  } else if (losses?.status === "unavailable") {
    limitations.push({ en: "The loss record was unavailable, so the loss history is not part of this comparison.", de: "Die Verlusterfassung war nicht verfuegbar; die Verlusthistorie fehlt in diesem Vergleich." });
  }
  if (sourceOf(sources, "control-tests")?.status === "unavailable") {
    limitations.push({ en: "Control test results were unavailable, so the conflict analysis rests on the register alone.", de: "Kontrolltests waren nicht verfuegbar; die Konfliktanalyse stuetzt sich nur auf das Register." });
  }

  /* Proposals per candidate. */
  for (const candidate of candidates) {
    const material = candidate.appetiteMoved || (candidate.effectivenessMoved && (EFFECTIVENESS_RANK[fact(candidate.record, "effectiveness")] ?? 0) < (EFFECTIVENESS_RANK[fact(candidate.prior, "controlEffectiveness")] ?? 0));
    itemAssessments.push({
      itemId: candidate.lineId,
      proposedDisposition: material ? "accept" : candidate.conflict ? "outstanding" : "accept-with-condition",
      note: material
        ? { en: "Relevant and material: the move changes the appetite position or lowers the control credit.", de: "Relevant und wesentlich: die Bewegung aendert die Position zur Risikobereitschaft oder senkt die Kontrollwirkung." }
        : candidate.conflict
          ? { en: "Relevant; materiality depends on the first-line input and the workshop.", de: "Relevant; die Wesentlichkeit haengt von der Eingabe der ersten Linie und dem Workshop ab." }
          : { en: "Relevant, not material: the move stays inside the same appetite band.", de: "Relevant, nicht wesentlich: die Bewegung bleibt im selben Band der Risikobereitschaft." },
    });
  }

  const movedOutside = candidates.filter((item) => item.movedOutside).map((item) => item.riskId);
  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `${candidates.length} of ${register.length} line(s) are change candidates against ${priorCycle || "the prior version"}${movedOutside.length > 0 ? `; ${list(movedOutside, "en")} moved outside appetite` : ""}. ${contradictions.length} conflict(s) between the record, the test and the first line need the challenge.`,
      de: `${candidates.length} von ${register.length} Zeilen sind Aenderungskandidaten gegenueber ${priorCycle || "der Vorversion"}${movedOutside.length > 0 ? `; ${list(movedOutside, "de")} liegen jetzt ausserhalb der Risikobereitschaft` : ""}. ${contradictions.length} Konflikte zwischen Datensatz, Test und erster Linie brauchen die Herausforderung.`,
    },
    findings,
    inferences,
    contradictions,
    gaps,
    itemAssessments,
    proposals: [],
    recommendedOptionId: null,
    limitations,
  };
}

const PROMPT = `You prepare Stage 3 (Risk and Control Change) of a Risk and Control Self-Assessment for a second-line Operational Risk Partner at a synthetic bank.
Use only the source records provided. Compare every line with the prior cycle, analyse conflicts between the recorded effectiveness, the control tests and the first line, list the change candidates in itemAssessments (accept = relevant and material, accept-with-condition = relevant and not material, outstanding = depends on first-line input), and put the challenge questions as gaps with keys starting "question-".
Do not decide relevance, materiality or the causal interpretation of the loss record; they are human decisions.
Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("rcsa.risk-control-change", {
  compose: (input) => composeChange(input),
  prompt: ({ context, sources }) => ({
    instructions: PROMPT,
    input: JSON.stringify({
      assessment: context.run.subjectId,
      stage: context.stage.name,
      candidates: candidatesOf(sources).map((candidate) => candidate.lineId),
      sources: sources.map((source) => ({
        key: source.spec.key,
        status: source.status,
        records: source.result.records.map((record) => ({ id: record.id, label: record.label, value: record.value, evidenceIds: record.evidenceIds, facts: record.facts })),
      })),
    }),
  }),
  itemIds: ({ sources }) => candidatesOf(sources).map((candidate) => candidate.lineId),
});

/* ==========================================================================
   The change review form
   ========================================================================== */

const reviewSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        classification: z.enum(["material", "relevant", "not-relevant"], { message: "Classify every change candidate." }),
        note: z.string().max(600),
      }),
    )
    .min(1),
  overall: z.string().max(1200),
});
type ReviewInput = z.infer<typeof reviewSchema>;

const CLASSIFICATION_LABELS: Record<string, Bilingual> = {
  material: { en: "Relevant and material", de: "Relevant und wesentlich" },
  relevant: { en: "Relevant, not material", de: "Relevant, nicht wesentlich" },
  "not-relevant": { en: "Not relevant", de: "Nicht relevant" },
};

const PROPOSAL_LABELS: Record<string, Bilingual> = {
  accept: CLASSIFICATION_LABELS.material!,
  "accept-with-condition": CLASSIFICATION_LABELS.relevant!,
  outstanding: { en: "Depends on first-line input", de: "Haengt von der Eingabe der ersten Linie ab" },
  reject: CLASSIFICATION_LABELS["not-relevant"]!,
};

registerTaskForm<ReviewInput>("rcsa.change-review", {
  schema: reviewSchema,
  fields: (context, language, current) => {
    const de = language === "de";
    return {
      rows: candidatesOf(context.sources).map((candidate) => {
        const entry = current?.lines.find((line) => line.lineId === candidate.lineId);
        const proposal = context.preparation.output?.itemAssessments.find((item) => item.itemId === candidate.lineId);
        const proposalLabel = proposal ? PROPOSAL_LABELS[proposal.proposedDisposition] : undefined;
        return {
          id: candidate.lineId,
          label: `${candidate.riskId} ${candidate.record.label.replace(candidate.riskId, "").trim()}`,
          detail: `${de ? "Vorher" : "Before"}: ${positionOf(candidate.prior, language)}. ${de ? "Jetzt" : "Now"}: ${positionOf(candidate.record, language)}.${candidate.conflict ? ` ${de ? "Erste und zweite Linie sind uneinig." : "First and second line disagree."}` : ""}${proposal && proposalLabel ? ` ${de ? "KI-Hinweis" : "AI note"}: ${de ? proposal.note.de : proposal.note.en}` : ""}`,
          choice: {
            name: `classification:${candidate.lineId}`,
            options: Object.entries(CLASSIFICATION_LABELS).map(([value, label]) => ({ value, label: de ? label.de : label.en })),
            value: entry?.classification ?? "",
          },
          note: { name: `note:${candidate.lineId}`, value: entry?.note ?? "", placeholder: de ? "Begruendung, besonders wenn nicht relevant" : "Reason, especially if not relevant" },
          date: null,
        };
      }),
      overall: { name: "overall", value: current?.overall ?? "", label: de ? "Gesamtbild der Aenderungen (optional)" : "Overall view of the changes (optional)" },
    };
  },
  fromFormData: (data, context) => ({
    lines: candidatesOf(context.sources).map((candidate) => ({
      lineId: candidate.lineId,
      classification: String(data.get(`classification:${candidate.lineId}`) ?? ""),
      note: String(data.get(`note:${candidate.lineId}`) ?? "").trim(),
    })),
    overall: String(data.get("overall") ?? "").trim(),
  }),
  validate: (context, input) => {
    const problems: Bilingual[] = [];
    const candidates = candidatesOf(context.sources);
    for (const candidate of candidates) {
      const entry = input.lines.find((line) => line.lineId === candidate.lineId);
      if (!entry) {
        problems.push({ en: `${candidate.riskId} has no classification.`, de: `${candidate.riskId} ist nicht eingeordnet.` });
        continue;
      }
      if (entry.classification === "not-relevant" && entry.note.length < 10) {
        problems.push({ en: `Say why the change on ${candidate.riskId} is not relevant.`, de: `Begruenden Sie, warum die Aenderung zu ${candidate.riskId} nicht relevant ist.` });
      }
      if (entry.classification === "not-relevant" && candidate.movedOutside) {
        problems.push({
          en: `${candidate.riskId} moved outside appetite, so the change is relevant whatever its cause. Record it as material or not material.`,
          de: `${candidate.riskId} liegt jetzt ausserhalb der Risikobereitschaft; die Aenderung ist daher relevant, gleich aus welchem Grund. Erfassen Sie sie als wesentlich oder nicht wesentlich.`,
        });
      }
    }
    return problems;
  },
  defaults: (context) => {
    const output = context.preparation.output;
    if (!output) return null;
    return {
      lines: candidatesOf(context.sources).map((candidate) => {
        const proposal = output.itemAssessments.find((item) => item.itemId === candidate.lineId)?.proposedDisposition;
        return {
          lineId: candidate.lineId,
          classification: proposal === "accept" ? ("material" as const) : ("relevant" as const),
          note: "",
        };
      }),
      overall: "",
    };
  },
  summarise: (context, input) =>
    input.lines.map((line) => {
      const candidate = candidatesOf(context.sources).find((item) => item.lineId === line.lineId);
      const label = CLASSIFICATION_LABELS[line.classification] ?? { en: line.classification, de: line.classification };
      const riskId = candidate?.riskId ?? line.lineId;
      return {
        en: `${riskId}: ${label.en}${line.note ? `. ${line.note}` : ""}`,
        de: `${riskId}: ${label.de}${line.note ? `. ${line.note}` : ""}`,
      };
    }),
});

/* ==========================================================================
   The change log, written at completion
   ========================================================================== */

registerArtifactBuilder("rcsa.change-log", (context) => {
  const review = recordedTaskOutput(context, "change-review");
  const input = (review?.input ?? null) as ReviewInput | null;
  const decision = decisionOf(context, "likelihood-inference");
  const option = decision?.options.find((candidate) => candidate.id === decision.chosenOptionId);
  const candidates = candidatesOf(context.sources);
  const material = (input?.lines ?? []).filter((line) => line.classification === "material").map((line) => candidates.find((item) => item.lineId === line.lineId)?.riskId ?? line.lineId);
  const decisionId = boundDecisionId(context, "likelihood-inference", DECISION_ID);
  return {
    label: { en: "Risk and control change log", de: "Aenderungsprotokoll Risiken und Kontrollen" },
    content: {
      assessmentId: context.run.subjectId,
      recordLines: [
        ...(review?.summary ?? []),
        {
          en: `Material changes: ${material.length > 0 ? list(material, "en") : "none"}.`,
          de: `Wesentliche Aenderungen: ${material.length > 0 ? list(material, "de") : "keine"}.`,
        },
        option
          ? { en: `${decisionId}: ${option.label.en}.`, de: `${decisionId}: ${option.label.de}.` }
          : { en: `${decisionId} is not recorded.`, de: `${decisionId} ist nicht erfasst.` },
      ],
      changes: candidates.map((candidate) => ({
        lineId: candidate.lineId,
        riskId: candidate.riskId,
        before: candidate.prior ? { id: candidate.prior.id, value: candidate.prior.value } : null,
        now: { id: candidate.record.id, value: candidate.record.value },
        evidenceIds: candidate.record.evidenceIds,
        classification: input?.lines.find((line) => line.lineId === candidate.lineId) ?? null,
      })),
      inference: decision ? { decisionId, optionId: decision.chosenOptionId, rationale: decision.rationale, decidedBy: decision.decidedByUserId } : null,
      facts: { materialChanges: material.join(","), decisionOption: decision?.chosenOptionId ?? null },
      preparation: { artifactId: context.preparation.artifactId, mode: context.preparation.mode, source: context.preparation.source },
    },
  };
});

export const RCSA_RISK_CONTROL_CHANGE = { processId: RCSA_PROCESS_ID, stageId: STAGE_ID } as const;
