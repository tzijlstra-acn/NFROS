/**
 * RCSA Stage 6, Rating and Appetite.
 *
 * The AI prepares four things, and the first is not the AI's at all: the
 * risk-matrix consequences are computed by `../matrix.ts` (the group
 * calculators), for the draft position and for each alternative control
 * effectiveness. The AI adds the alternative positions in plain language, a
 * rationale draft labelled as such, and the governance effect the appetite
 * statement attaches to each position.
 *
 * The person decides every judgment explicitly, in the rating judgment: the
 * control effectiveness, the residual likelihood, the residual impact, and the
 * residual rating and appetite position they give. The last two are checked
 * against the matrix: a rating no stated methodology produces is refused, and
 * a residual that departs from the methodology result needs a stated reason.
 * The stage decision then ratifies the position and chooses the path (a
 * remediation plan, a risk acceptance, monitoring, or back to the workshop),
 * and only paths the recorded position allows are accepted.
 *
 * The governed change records the ratified residual on the assessment line,
 * under its own approval. At completion the stage writes the rating record.
 *
 * Synthetic institution and data.
 */

import { z } from "zod";
import type { Bilingual } from "@/role-apps/contracts";
import { unique } from "@/role-apps/stage-support";
import { CONTROL_EFFECTIVENESS_LABELS, IMPACT_LABELS, LIKELIHOOD_LABELS, type ControlEffectiveness } from "@/domain/nfr/calculators";
import {
  registerArtifactBuilder,
  registerDecisionRules,
  registerPayloadBuilder,
  registerPreparer,
  registerTaskForm,
  type PreparerInput,
} from "@/features/process/registry";
import type { SourceRecord, StageContext } from "@/features/process/types";
import type { StagePreparationOutput } from "@/features/process/preparation-schema";
import { recordedTaskOutput } from "@/features/process/tasks";
import { consequenceFor, governanceEffect, isControlEffectiveness, positionText, type AppetitePosition } from "../matrix";
import { appetiteLabel, decisionOf, effectivenessLabel, fact, factNumber, list, ratingLabel, recordsOf, RCSA_PROCESS_ID } from "./shared";

const STAGE_ID = "rating-appetite";
const RATIFY = ["rating-remediation", "rating-acceptance", "rating-monitor"];
const LEVELS: ControlEffectiveness[] = ["not-effective", "partially-effective", "largely-effective", "fully-effective"];
const RANK: Record<string, number> = { "not-effective": 0, "partially-effective": 1, "largely-effective": 2, "fully-effective": 3 };

/* ==========================================================================
   The key line and the agreed position
   ========================================================================== */

/**
 * The workshop's challenge conclusion among the run's decisions: the one
 * bound to the challenge workshop stage (DEC-2026-0772 for the Q4 cycle, the
 * run's own copy of it for a later run).
 */
function workshopConclusionOf(sources: StageContext["sources"]): SourceRecord | undefined {
  return recordsOf(sources, "cycle-decisions").find((record) => fact(record, "stageId") === "challenge-workshop");
}

/**
 * The line the rating turns on. First, the line whose key control is the one
 * the workshop's challenge conclusion was about (DEC-2026-0772 names
 * CTL-PAY-014). Failing that, the line whose key control the first line rates
 * higher than the assessment, with the highest inherent score; else the first
 * line of the assessment. In the seeded cycle that is RSK-0211 on CTL-PAY-014
 * whichever rule applies, but the first is the one that survives a new
 * assessment version recomputing the other lines.
 */
export function keyLineOf(sources: StageContext["sources"]): SourceRecord | undefined {
  const register = recordsOf(sources, "risk-control-register")
    .slice()
    .sort((a, b) => factNumber(a, "sortOrder") - factNumber(b, "sortOrder"));
  const challenged = fact(workshopConclusionOf(sources), "relatedObjectId");
  const byChallenge = challenged ? register.find((record) => fact(record, "keyControlId") === challenged) : undefined;
  if (byChallenge) return byChallenge;
  const score = (record: SourceRecord) => factNumber(record, "inherentLikelihood") * factNumber(record, "inherentImpact");
  const contested = register.filter((record) => (RANK[fact(record, "firstLine")] ?? -1) > (RANK[fact(record, "effectiveness")] ?? -1));
  return contested.sort((a, b) => score(b) - score(a) || factNumber(a, "sortOrder") - factNumber(b, "sortOrder"))[0] ?? register[0];
}

/**
 * The effectiveness the workshop left the rating with. The challenge
 * conclusion's first option (DEC-2026-0772 option one for the Q4 cycle)
 * carries the first line's rating (fully effective) and its third records
 * partially effective; a dissent or a deferral leaves the draft. The option
 * is read by its position, which a run's own copy of the decision keeps.
 */
function agreedEffectiveness(sources: StageContext["sources"], key: SourceRecord | undefined): { value: string; basis: Bilingual } {
  const workshop = workshopConclusionOf(sources);
  const id = workshop?.id ?? "";
  const position = fact(workshop, "chosenOptionPosition");
  if (position === "1") return { value: "fully-effective", basis: { en: `the workshop carried the first-line position (${id})`, de: `der Workshop hat die Position der ersten Linie uebernommen (${id})` } };
  if (position === "3") return { value: "partially-effective", basis: { en: `the workshop recorded partially effective (${id})`, de: `der Workshop hat teilweise wirksam erfasst (${id})` } };
  if (position.length > 0) return { value: fact(key, "effectiveness"), basis: { en: `the workshop left the rating unagreed, so the draft stands (${id})`, de: `der Workshop hat die Bewertung offen gelassen; der Entwurf gilt (${id})` } };
  return { value: fact(key, "effectiveness"), basis: { en: "the assessment draft", de: "der Bewertungsentwurf" } };
}

function outsideFromOf(sources: StageContext["sources"], riskId: string): number {
  const statement = recordsOf(sources, "appetite-statements").find((record) => record.id === riskId);
  return factNumber(statement, "outsideFromScore") || 10;
}

function methodologyFor(key: SourceRecord, effectiveness: ControlEffectiveness, outsideFrom: number) {
  return consequenceFor({
    inherentLikelihood: factNumber(key, "inherentLikelihood"),
    inherentImpact: factNumber(key, "inherentImpact"),
    controlEffectiveness: effectiveness,
    outsideFrom,
  });
}

function alternativesText(key: SourceRecord, outsideFrom: number, language: "en" | "de"): string {
  return LEVELS.map((level) => {
    const consequence = methodologyFor(key, level, outsideFrom);
    return `${effectivenessLabel(level, language)}: ${positionText(consequence, language)}, ${appetiteLabel(consequence.appetite, language)}`;
  }).join("; ");
}

/* ==========================================================================
   The preparer
   ========================================================================== */

function itemIdsFor(sources: StageContext["sources"]): string[] {
  const key = keyLineOf(sources);
  return [
    "effectiveness",
    "likelihood",
    "impact",
    "rating",
    "appetite",
    ...recordsOf(sources, "risk-control-register").filter((record) => record.id !== key?.id).map((record) => `line:${record.id}`),
  ];
}

function composeRating(input: PreparerInput): StagePreparationOutput {
  const { sources } = input;
  const key = keyLineOf(sources);
  const findings: StagePreparationOutput["findings"] = [];
  const inferences: StagePreparationOutput["inferences"] = [];
  const gaps: StagePreparationOutput["gaps"] = [];
  const limitations: StagePreparationOutput["limitations"] = [];
  const itemAssessments: StagePreparationOutput["itemAssessments"] = [];
  if (!key) {
    return {
      schemaVersion: "stage-preparation-v1",
      summary: { en: "No line is in scope, so there is nothing to rate.", de: "Keine Zeile ist im Umfang; es gibt nichts zu bewerten." },
      findings: [],
      inferences: [],
      contradictions: [],
      gaps: [{ key: "gap-no-lines", statement: { en: "The assessment has no lines.", de: "Die Bewertung hat keine Zeilen." }, evidenceIds: [], severity: "blocking" }],
      itemAssessments: [],
      proposals: [],
      recommendedOptionId: null,
      limitations: [],
    };
  }
  const riskId = fact(key, "riskId");
  const controlId = fact(key, "keyControlId");
  const outsideFrom = outsideFromOf(sources, riskId);
  const agreed = agreedEffectiveness(sources, key);
  const agreedLevel: ControlEffectiveness = isControlEffectiveness(agreed.value) ? agreed.value : "partially-effective";
  const position = methodologyFor(key, agreedLevel, outsideFrom);
  const statement = recordsOf(sources, "appetite-statements").find((record) => record.id === riskId);

  /* The deterministic consequences, for the agreed position and every alternative. */
  findings.push({
    sourceKey: "risk-control-register",
    statement: {
      en: `${riskId} has an inherent position of ${factNumber(key, "inherentLikelihood")} x ${factNumber(key, "inherentImpact")}. On the group matrix: ${alternativesText(key, outsideFrom, "en")}.`,
      de: `${riskId} hat eine inhaerente Position von ${factNumber(key, "inherentLikelihood")} x ${factNumber(key, "inherentImpact")}. In der Konzernmatrix: ${alternativesText(key, outsideFrom, "de")}.`,
    },
    evidenceIds: key.evidenceIds.slice(0, 2),
    basis: "verified-fact",
  });
  findings.push({
    sourceKey: "cycle-decisions",
    statement: {
      en: `The rating starts from ${effectivenessLabel(agreedLevel, "en").toLowerCase()} on ${controlId}, because ${agreed.basis.en}. That gives ${positionText(position, "en")}, ${appetiteLabel(position.appetite, "en")}.`,
      de: `Die Bewertung geht von ${effectivenessLabel(agreedLevel, "de").toLowerCase()} fuer ${controlId} aus, weil ${agreed.basis.de}. Das ergibt ${positionText(position, "de")}, ${appetiteLabel(position.appetite, "de")}.`,
    },
    evidenceIds: workshopConclusionOf(sources)?.evidenceIds.slice(0, 2) ?? [],
    basis: "approved-record",
  });
  if (statement) {
    findings.push({
      sourceKey: "appetite-statements",
      statement: {
        en: `The appetite statement for ${riskId} places a residual score of ${outsideFrom} or above outside appetite. ${governanceEffect(position.appetite).en}`,
        de: `Die Aussage zur Risikobereitschaft fuer ${riskId} setzt eine Restbewertung ab ${outsideFrom} ausserhalb der Risikobereitschaft. ${governanceEffect(position.appetite).de}`,
      },
      evidenceIds: statement.evidenceIds.slice(0, 2),
      basis: "approved-record",
    });
  } else {
    gaps.push({
      key: "gap-appetite-statement",
      statement: { en: `No appetite statement is recorded for ${riskId}; the group boundary of 10 is used.`, de: `Fuer ${riskId} ist keine Aussage zur Risikobereitschaft erfasst; die Konzerngrenze 10 wird verwendet.` },
      evidenceIds: [],
      severity: "minor",
    });
  }
  const prior = recordsOf(sources, "prior-assessment").find((record) => fact(record, "riskId") === riskId);
  if (prior) {
    findings.push({
      sourceKey: "prior-assessment",
      statement: {
        en: `In ${fact(prior, "cycle")} ${riskId} was rated ${ratingLabel(fact(prior, "residualRating"), "en")} with ${effectivenessLabel(fact(prior, "controlEffectiveness"), "en").toLowerCase()}, ${appetiteLabel(fact(prior, "appetitePosition"), "en")}.`,
        de: `In ${fact(prior, "cycle")} wurde ${riskId} mit ${ratingLabel(fact(prior, "residualRating"), "de")} bei ${effectivenessLabel(fact(prior, "controlEffectiveness"), "de").toLowerCase()} bewertet, ${appetiteLabel(fact(prior, "appetitePosition"), "de")}.`,
      },
      evidenceIds: prior.evidenceIds.slice(0, 2),
      basis: "approved-record",
    });
  }

  /* The other lines, carried as drafted unless the person says otherwise. */
  const others = recordsOf(sources, "risk-control-register").filter((record) => record.id !== key.id);
  if (others.length > 0) {
    findings.push({
      sourceKey: "risk-control-register",
      statement: {
        en: `Draft positions of the other lines: ${others.map((record) => `${fact(record, "riskId")} ${ratingLabel(fact(record, "residualRating"), "en")}, ${appetiteLabel(fact(record, "appetitePosition"), "en")}`).join("; ")}.`,
        de: `Entwurfspositionen der uebrigen Zeilen: ${others.map((record) => `${fact(record, "riskId")} ${ratingLabel(fact(record, "residualRating"), "de")}, ${appetiteLabel(fact(record, "appetitePosition"), "de")}`).join("; ")}.`,
      },
      evidenceIds: unique(others.flatMap((record) => record.evidenceIds)).slice(0, 3),
      basis: "approved-record",
    });
  }

  /* The control register can lag the rating; say so rather than change it here. */
  if (fact(key, "secondLine") && fact(key, "secondLine") !== agreedLevel) {
    gaps.push({
      key: "gap-control-register",
      statement: {
        en: `The control register still records ${effectivenessLabel(fact(key, "secondLine"), "en").toLowerCase()} for ${controlId}. This stage records the residual on the assessment line; it does not change the control register.`,
        de: `Das Kontrollregister erfasst fuer ${controlId} noch ${effectivenessLabel(fact(key, "secondLine"), "de").toLowerCase()}. Diese Stufe erfasst das Restrisiko in der Bewertungszeile; das Kontrollregister aendert sie nicht.`,
      },
      evidenceIds: key.evidenceIds.slice(0, 1),
      severity: "minor",
    });
  }

  /* A rationale draft, labelled as an inference, for the person to rewrite. */
  inferences.push({
    statement: {
      en: `Rationale draft: ${riskId} is rated on ${effectivenessLabel(agreedLevel, "en").toLowerCase()} for ${controlId}, the only preventive control on the line. Under the group methodology that gives ${positionText(position, "en")}, ${appetiteLabel(position.appetite, "en")}. ${governanceEffect(position.appetite).en}`,
      de: `Begruendungsentwurf: ${riskId} wird auf Basis von ${effectivenessLabel(agreedLevel, "de").toLowerCase()} fuer ${controlId} bewertet, der einzigen vorbeugenden Kontrolle der Zeile. Nach der Konzernmethodik ergibt das ${positionText(position, "de")}, ${appetiteLabel(position.appetite, "de")}. ${governanceEffect(position.appetite).de}`,
    },
    evidenceIds: key.evidenceIds.slice(0, 2),
    uncertainty: {
      en: "A draft is not a rationale. The rating rationale must be your own, and the only preventive control claim rests on the line's control set as recorded.",
      de: "Ein Entwurf ist keine Begruendung. Die Begruendung der Bewertung muss Ihre eigene sein; die Aussage zur einzigen vorbeugenden Kontrolle beruht auf dem erfassten Kontrollsatz der Zeile.",
    },
  });
  if (recordsOf(sources, "cycle-decisions").length === 0) {
    limitations.push({ en: "No decision of this cycle could be read, so the starting position is the assessment draft.", de: "Keine Entscheidung dieses Zyklus war lesbar; Ausgangspunkt ist der Bewertungsentwurf." });
  }

  /* Proposals per row: the methodology result, never preselected. */
  const note = (en: string, de: string) => ({ en, de });
  itemAssessments.push(
    { itemId: "effectiveness", proposedDisposition: "accept", note: note(`${effectivenessLabel(agreedLevel, "en")}, because ${agreed.basis.en}.`, `${effectivenessLabel(agreedLevel, "de")}, weil ${agreed.basis.de}.`) },
    { itemId: "likelihood", proposedDisposition: "accept", note: note(`${position.residualLikelihood}, the methodology result.`, `${position.residualLikelihood}, das Ergebnis der Methodik.`) },
    { itemId: "impact", proposedDisposition: "accept", note: note(`${position.residualImpact}, the methodology result.`, `${position.residualImpact}, das Ergebnis der Methodik.`) },
    { itemId: "rating", proposedDisposition: "accept", note: note(`${ratingLabel(position.rating, "en")} (${position.score} of 25).`, `${ratingLabel(position.rating, "de")} (${position.score} von 25).`) },
    { itemId: "appetite", proposedDisposition: "accept", note: note(`${appetiteLabel(position.appetite, "en")}.`, `${appetiteLabel(position.appetite, "de")}.`) },
  );
  for (const record of others) {
    itemAssessments.push({
      itemId: `line:${record.id}`,
      proposedDisposition: "accept",
      note: note("The draft position stands unless the workshop left it open.", "Die Entwurfsposition bleibt, sofern der Workshop sie nicht offen gelassen hat."),
    });
  }

  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `${riskId}: with ${controlId} ${effectivenessLabel(agreedLevel, "en").toLowerCase()}, the group matrix gives ${positionText(position, "en")}, ${appetiteLabel(position.appetite, "en")}. ${position.appetite === "outside" ? "A remediation plan with committed dates or a Risikoakzeptanz is required." : "No plan or acceptance is required by the appetite statement."}`,
      de: `${riskId}: bei ${controlId} ${effectivenessLabel(agreedLevel, "de").toLowerCase()} ergibt die Konzernmatrix ${positionText(position, "de")}, ${appetiteLabel(position.appetite, "de")}. ${position.appetite === "outside" ? "Ein Massnahmenplan mit verbindlichen Terminen oder eine Risikoakzeptanz ist erforderlich." : "Die Aussage zur Risikobereitschaft verlangt weder Plan noch Akzeptanz."}`,
    },
    findings,
    inferences,
    contradictions: [],
    gaps,
    itemAssessments,
    proposals: [
      {
        toolKey: "record-residual",
        rationale: {
          en: "Once the position is ratified, record it on the assessment line so the register shows the rating the cycle agreed.",
          de: "Sobald die Position ratifiziert ist, in der Bewertungszeile erfassen, damit das Register die vereinbarte Bewertung zeigt.",
        },
      },
    ],
    recommendedOptionId: position.appetite === "within" ? "rating-monitor" : null,
    limitations,
  };
}

const PROMPT = `You prepare Stage 6 (Rating and Appetite) of a Risk and Control Self-Assessment for a second-line Operational Risk Partner at a synthetic bank.
Use only the source records provided. The risk-matrix consequences are given in the records as computed by the group methodology; restate them, never compute your own. Present the alternative positions, a rationale draft clearly labelled as a draft, and the governance effect of the appetite position.
For each judgment row give the methodology result in itemAssessments. Do not decide the control effectiveness, the likelihood, the impact, the residual rating or the appetite path; they are human decisions.
Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("rcsa.rating-appetite", {
  compose: (input) => composeRating(input),
  prompt: ({ context, sources }) => {
    const key = keyLineOf(sources);
    const outsideFrom = key ? outsideFromOf(sources, fact(key, "riskId")) : 10;
    return {
      instructions: PROMPT,
      input: JSON.stringify({
        assessment: context.run.subjectId,
        stage: context.stage.name,
        items: itemIdsFor(sources),
        matrix: key ? LEVELS.map((level) => ({ effectiveness: level, ...methodologyFor(key, level, outsideFrom) })) : [],
        sources: sources.map((source) => ({
          key: source.spec.key,
          status: source.status,
          records: source.result.records.map((record) => ({ id: record.id, label: record.label, value: record.value, evidenceIds: record.evidenceIds, facts: record.facts })),
        })),
      }),
    };
  },
  itemIds: ({ sources }) => itemIdsFor(sources),
});

/* ==========================================================================
   The rating judgment form
   ========================================================================== */

const scale = z.coerce.number().int().min(1, "Choose a value from 1 to 5.").max(5, "Choose a value from 1 to 5.");
const judgmentSchema = z.object({
  effectiveness: z.enum(["not-effective", "partially-effective", "largely-effective", "fully-effective"], { message: "Record the control effectiveness." }),
  likelihood: scale,
  likelihoodNote: z.string().max(600),
  impact: scale,
  impactNote: z.string().max(600),
  rating: z.enum(["low", "medium", "high", "critical"], { message: "Record the residual rating." }),
  appetite: z.enum(["within", "at-limit", "outside"], { message: "Record the appetite position." }),
  lines: z.array(z.object({ lineId: z.string().min(1), choice: z.enum(["stands", "return"], { message: "Say for every other line whether its draft position stands." }) })),
});
type JudgmentInput = z.infer<typeof judgmentSchema>;

function hint(context: StageContext, itemId: string, language: "en" | "de"): string {
  const proposal = context.preparation.output?.itemAssessments.find((item) => item.itemId === itemId);
  return proposal ? ` ${language === "de" ? "KI-Hinweis" : "AI note"}: ${language === "de" ? proposal.note.de : proposal.note.en}` : "";
}

/** The deterministic consequence of a recorded judgment. Shared with the decision rules and the stage record. */
export function judgedConsequence(context: StageContext, input: JudgmentInput) {
  const key = keyLineOf(context.sources);
  if (!key) return null;
  return consequenceFor({
    inherentLikelihood: factNumber(key, "inherentLikelihood"),
    inherentImpact: factNumber(key, "inherentImpact"),
    controlEffectiveness: input.effectiveness,
    residualLikelihood: input.likelihood,
    residualImpact: input.impact,
    outsideFrom: outsideFromOf(context.sources, fact(key, "riskId")),
  });
}

registerTaskForm<JudgmentInput>("rcsa.rating-judgment", {
  schema: judgmentSchema,
  fields: (context, language, current) => {
    const de = language === "de";
    const key = keyLineOf(context.sources);
    const riskId = fact(key, "riskId");
    const controlId = fact(key, "keyControlId");
    const outsideFrom = key ? outsideFromOf(context.sources, riskId) : 10;
    const scaleOptions = (labels: Record<number, Bilingual>) =>
      [1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `${value} ${de ? labels[value]?.de ?? "" : labels[value]?.en ?? ""}`.trim() }));
    const others = recordsOf(context.sources, "risk-control-register").filter((record) => record.id !== key?.id);
    return {
      rows: [
        {
          id: "effectiveness",
          label: de ? `Kontrollwirksamkeit ${controlId} fuer ${riskId}` : `Control effectiveness of ${controlId} for ${riskId}`,
          detail: `${de ? "Entwurf" : "Draft"}: ${effectivenessLabel(fact(key, "effectiveness"), language).toLowerCase()}. ${de ? "Erste Linie" : "First line"}: ${effectivenessLabel(fact(key, "firstLine"), language).toLowerCase()}.${hint(context, "effectiveness", language)}`,
          choice: {
            name: "effectiveness",
            options: LEVELS.map((level) => ({ value: level, label: de ? CONTROL_EFFECTIVENESS_LABELS[level].de : CONTROL_EFFECTIVENESS_LABELS[level].en })),
            value: current?.effectiveness ?? "",
          },
          note: null,
          date: null,
        },
        {
          id: "likelihood",
          label: de ? `Rest-Eintrittswahrscheinlichkeit (inhaerent ${factNumber(key, "inherentLikelihood")})` : `Residual likelihood (inherent ${factNumber(key, "inherentLikelihood")})`,
          detail: `${key ? alternativesText(key, outsideFrom, language) : ""}.${hint(context, "likelihood", language)}`,
          choice: { name: "likelihood", options: scaleOptions(LIKELIHOOD_LABELS), value: current ? String(current.likelihood) : "" },
          note: { name: "likelihood-note", value: current?.likelihoodNote ?? "", placeholder: de ? "Warum, wenn Sie von der Methodik abweichen" : "Why, if you depart from the methodology" },
          date: null,
        },
        {
          id: "impact",
          label: de ? `Rest-Auswirkung (inhaerent ${factNumber(key, "inherentImpact")})` : `Residual impact (inherent ${factNumber(key, "inherentImpact")})`,
          detail: `${de ? "Nur eine vollstaendig wirksame Kontrolle senkt die Auswirkung um eine Stufe." : "Only a fully effective control lowers impact, by one band."}${hint(context, "impact", language)}`,
          choice: { name: "impact", options: scaleOptions(IMPACT_LABELS), value: current ? String(current.impact) : "" },
          note: { name: "impact-note", value: current?.impactNote ?? "", placeholder: de ? "Warum, wenn Sie von der Methodik abweichen" : "Why, if you depart from the methodology" },
          date: null,
        },
        {
          id: "rating",
          label: de ? "Restbewertung" : "Residual rating",
          detail: `${de ? "Die Konzernmatrix bestimmt sie aus Ihrer Eintrittswahrscheinlichkeit und Auswirkung; eine abweichende Angabe wird abgelehnt." : "The group matrix sets it from your likelihood and impact; a rating it does not produce is refused."}${hint(context, "rating", language)}`,
          choice: {
            name: "rating",
            options: ["low", "medium", "high", "critical"].map((value) => ({ value, label: ratingLabel(value, language) })),
            value: current?.rating ?? "",
          },
          note: null,
          date: null,
        },
        {
          id: "appetite",
          label: de ? "Position zur Risikobereitschaft" : "Appetite position",
          detail: `${de ? `Ab einer Restbewertung von ${outsideFrom} ausserhalb der Risikobereitschaft.` : `A residual score of ${outsideFrom} or above is outside appetite.`}${hint(context, "appetite", language)}`,
          choice: {
            name: "appetite",
            options: (["within", "at-limit", "outside"] as const).map((value) => ({ value, label: appetiteLabel(value, language) })),
            value: current?.appetite ?? "",
          },
          note: null,
          date: null,
        },
        ...others.map((record) => ({
          id: `line:${record.id}`,
          label: `${fact(record, "riskId")} ${record.label.replace(fact(record, "riskId"), "").trim()}`,
          detail: `${de ? "Entwurf" : "Draft"}: ${effectivenessLabel(fact(record, "effectiveness"), language).toLowerCase()}, ${factNumber(record, "residualLikelihood")} x ${factNumber(record, "residualImpact")}, ${ratingLabel(fact(record, "residualRating"), language)}, ${appetiteLabel(fact(record, "appetitePosition"), language)}.${hint(context, `line:${record.id}`, language)}`,
          choice: {
            name: `line:${record.id}`,
            options: [
              { value: "stands", label: de ? "Entwurfsposition bleibt" : "Draft position stands" },
              { value: "return", label: de ? "Zurueck in den Workshop" : "Return to the workshop" },
            ],
            value: current?.lines.find((line) => line.lineId === record.id)?.choice ?? "",
          },
          note: null,
          date: null,
        })),
      ],
      overall: null,
    };
  },
  fromFormData: (data, context) => {
    const key = keyLineOf(context.sources);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    return {
      effectiveness: text("effectiveness"),
      likelihood: text("likelihood"),
      likelihoodNote: text("likelihood-note"),
      impact: text("impact"),
      impactNote: text("impact-note"),
      rating: text("rating"),
      appetite: text("appetite"),
      lines: recordsOf(context.sources, "risk-control-register")
        .filter((record) => record.id !== key?.id)
        .map((record) => ({ lineId: record.id, choice: text(`line:${record.id}`) })),
    };
  },
  validate: (context, input) => {
    const problems: Bilingual[] = [];
    const consequence = judgedConsequence(context, input);
    if (!consequence) return [{ en: "No line is in scope to rate.", de: "Keine Zeile ist zu bewerten." }];
    if (consequence.departsFromMethodology && `${input.likelihoodNote} ${input.impactNote}`.trim().length < 10) {
      problems.push({
        en: `Your residual ${input.likelihood} x ${input.impact} departs from the methodology result ${consequence.methodology.residualLikelihood} x ${consequence.methodology.residualImpact} for ${effectivenessLabel(input.effectiveness, "en").toLowerCase()}. Say why.`,
        de: `Ihr Restrisiko ${input.likelihood} x ${input.impact} weicht vom Ergebnis der Methodik ${consequence.methodology.residualLikelihood} x ${consequence.methodology.residualImpact} bei ${effectivenessLabel(input.effectiveness, "de").toLowerCase()} ab. Begruenden Sie die Abweichung.`,
      });
    }
    if (input.rating !== consequence.rating) {
      problems.push({
        en: `The group matrix rates ${input.likelihood} x ${input.impact} as ${ratingLabel(consequence.rating, "en")}. Record ${ratingLabel(consequence.rating, "en")}, or change the likelihood or impact.`,
        de: `Die Konzernmatrix bewertet ${input.likelihood} x ${input.impact} mit ${ratingLabel(consequence.rating, "de")}. Erfassen Sie ${ratingLabel(consequence.rating, "de")} oder aendern Sie Eintrittswahrscheinlichkeit oder Auswirkung.`,
      });
    }
    if (input.appetite !== consequence.appetite) {
      problems.push({
        en: `${positionText(consequence, "en")} is ${appetiteLabel(consequence.appetite, "en")}. Record that position, or change the inputs.`,
        de: `${positionText(consequence, "de")} liegt ${appetiteLabel(consequence.appetite, "de")}. Erfassen Sie diese Position oder aendern Sie die Eingaben.`,
      });
    }
    return problems;
  },
  defaults: (context) => {
    const key = keyLineOf(context.sources);
    if (!key) return null;
    const agreed = agreedEffectiveness(context.sources, key);
    const level: ControlEffectiveness = isControlEffectiveness(agreed.value) ? agreed.value : "partially-effective";
    const consequence = methodologyFor(key, level, outsideFromOf(context.sources, fact(key, "riskId")));
    return {
      effectiveness: level as JudgmentInput["effectiveness"],
      likelihood: consequence.residualLikelihood,
      likelihoodNote: "",
      impact: consequence.residualImpact,
      impactNote: "",
      rating: consequence.rating,
      appetite: consequence.appetite,
      lines: recordsOf(context.sources, "risk-control-register").filter((record) => record.id !== key.id).map((record) => ({ lineId: record.id, choice: "stands" as const })),
    };
  },
  summarise: (context, input) => {
    const key = keyLineOf(context.sources);
    const consequence = judgedConsequence(context, input);
    const returned = input.lines.filter((line) => line.choice === "return").map((line) => line.lineId);
    return [
      {
        en: `${fact(key, "riskId")}: ${fact(key, "keyControlId")} ${effectivenessLabel(input.effectiveness, "en").toLowerCase()}; residual ${consequence ? positionText(consequence, "en") : ""}, ${appetiteLabel(input.appetite, "en")}.`,
        de: `${fact(key, "riskId")}: ${fact(key, "keyControlId")} ${effectivenessLabel(input.effectiveness, "de").toLowerCase()}; Restrisiko ${consequence ? positionText(consequence, "de") : ""}, ${appetiteLabel(input.appetite, "de")}.`,
      },
      ...(consequence?.departsFromMethodology
        ? [{ en: `Departure from the methodology: ${`${input.likelihoodNote} ${input.impactNote}`.trim()}`, de: `Abweichung von der Methodik: ${`${input.likelihoodNote} ${input.impactNote}`.trim()}` }]
        : []),
      returned.length > 0
        ? { en: `Returned to the workshop: ${list(returned, "en")}.`, de: `Zurueck in den Workshop: ${list(returned, "de")}.` }
        : { en: "Every other line's draft position stands.", de: "Die Entwurfspositionen aller uebrigen Zeilen bleiben." },
    ];
  },
});

/* ==========================================================================
   Decision rules: only the paths the recorded position allows
   ========================================================================== */

function recordedJudgment(context: StageContext): JudgmentInput | null {
  return (recordedTaskOutput(context, "rating-judgment")?.input ?? null) as JudgmentInput | null;
}

registerDecisionRules(RCSA_PROCESS_ID, STAGE_ID, {
  validateOption: (context, _decisionKey, optionId) => {
    const judgment = recordedJudgment(context);
    if (!judgment) {
      return { en: "Record the rating judgment before ratifying the residual.", de: "Erfassen Sie die Bewertung, bevor Sie das Restrisiko ratifizieren." };
    }
    if (optionId === "rating-return") return null;
    if (judgment.lines.some((line) => line.choice === "return")) {
      return {
        en: "You returned a line to the workshop, so the rating cannot be ratified yet. Choose Return to the workshop.",
        de: "Sie haben eine Zeile in den Workshop zurueckgegeben; die Bewertung kann noch nicht ratifiziert werden. Waehlen Sie Zurueck in den Workshop.",
      };
    }
    const appetite: AppetitePosition = judgment.appetite;
    if (optionId === "rating-acceptance" && appetite !== "outside") {
      return { en: "A risk acceptance is for a position outside appetite. This position is not.", de: "Eine Risikoakzeptanz gilt fuer eine Position ausserhalb der Risikobereitschaft. Diese Position liegt nicht dort." };
    }
    if (optionId === "rating-monitor" && appetite === "outside") {
      return {
        en: "Outside appetite, monitoring alone does not discharge the requirement. Choose a remediation plan or a risk acceptance.",
        de: "Ausserhalb der Risikobereitschaft genuegt Ueberwachung allein nicht. Waehlen Sie einen Massnahmenplan oder eine Risikoakzeptanz.",
      };
    }
    return null;
  },
  consequences: (context, _decisionKey, optionId) => {
    const judgment = recordedJudgment(context);
    const consequence = judgment ? judgedConsequence(context, judgment) : null;
    const key = keyLineOf(context.sources);
    const recorded: Bilingual[] = consequence
      ? [{ en: `Records ${positionText(consequence, "en")} on ${key?.id ?? "the assessment line"}`, de: `Erfasst ${positionText(consequence, "de")} in ${key?.id ?? "der Bewertungszeile"}` }]
      : [];
    switch (optionId) {
      case "rating-remediation":
        return [...recorded, { en: "Stage 7 prepares the remediation action with committed dates", de: "Stufe 7 bereitet die Massnahme mit verbindlichen Terminen vor" }];
      case "rating-acceptance":
        return [...recorded, { en: "Stage 7 prepares the Risikoakzeptanz request for the entity Chief Operating Officer, to be noted by the Group NFR Committee", de: "Stufe 7 bereitet den Antrag auf Risikoakzeptanz fuer den Chief Operating Officer vor, zur Kenntnisnahme durch das Group NFR Committee" }];
      case "rating-monitor":
        return [...recorded, { en: "No plan or acceptance; Stage 8 sets the monitoring", de: "Weder Plan noch Akzeptanz; Stufe 8 legt die Ueberwachung fest" }];
      default:
        return [{ en: "The stage is held until the rating is revised", de: "Die Stufe bleibt angehalten, bis die Bewertung ueberarbeitet ist" }];
    }
  },
});

/* ==========================================================================
   The residual position on the assessment line, under approval
   ========================================================================== */

registerPayloadBuilder("rcsa.record-residual", (context) => {
  const judgment = recordedJudgment(context);
  const decision = decisionOf(context, "residual-and-appetite");
  const key = keyLineOf(context.sources);
  if (!judgment || !key || decision?.status !== "recorded" || !RATIFY.includes(decision.chosenOptionId ?? "")) {
    return {
      unavailable: {
        en: "Record the rating judgment and ratify the residual before it is written to the assessment line.",
        de: "Erfassen Sie die Bewertung und ratifizieren Sie das Restrisiko, bevor es in die Bewertungszeile geschrieben wird.",
      },
    };
  }
  const consequence = judgedConsequence(context, judgment);
  const position = consequence ? positionText(consequence, "en") : `${judgment.likelihood} x ${judgment.impact}`;
  return {
    payload: {
      assessmentLineId: key.id,
      residualLikelihood: judgment.likelihood,
      residualImpact: judgment.impact,
      commentary: `Ratified in Stage 6 by ${context.actingUserId}: ${fact(key, "keyControlId")} ${judgment.effectiveness}, residual ${position}, ${judgment.appetite}. ${decision.rationale ?? ""}`.trim(),
      decisionId: decision.recordId,
    },
    intentStatement: {
      en: `Record the ratified residual ${position} on ${key.id} (${fact(key, "riskId")}).`,
      de: `Das ratifizierte Restrisiko ${consequence ? positionText(consequence, "de") : position} in ${key.id} (${fact(key, "riskId")}) erfassen.`,
    },
    sourceCanonicalType: "AssessmentLine",
    sourceCanonicalId: key.id,
    decisionId: decision.recordId,
  };
});

/* ==========================================================================
   The rating record, written at completion
   ========================================================================== */

registerArtifactBuilder("rcsa.rating-record", (context) => {
  const recorded = recordedTaskOutput(context, "rating-judgment");
  const judgment = (recorded?.input ?? null) as JudgmentInput | null;
  const decision = decisionOf(context, "residual-and-appetite");
  const option = decision?.options.find((candidate) => candidate.id === decision.chosenOptionId);
  const key = keyLineOf(context.sources);
  const consequence = judgment ? judgedConsequence(context, judgment) : null;
  const tool = context.tools.find((state) => state.key === "record-residual");
  return {
    label: { en: "Rating and appetite record", de: "Protokoll zu Bewertung und Risikobereitschaft" },
    content: {
      assessmentId: context.run.subjectId,
      recordLines: [
        ...(recorded?.summary ?? []),
        option ? { en: `Path: ${option.label.en}.`, de: `Weg: ${option.label.de}.` } : { en: "No path recorded.", de: "Kein Weg erfasst." },
        ...(consequence ? [consequence.governance] : []),
      ],
      judgment,
      consequence: consequence
        ? {
            methodology: { likelihood: consequence.methodology.residualLikelihood, impact: consequence.methodology.residualImpact, rating: consequence.methodology.residualRating },
            likelihood: consequence.residualLikelihood,
            impact: consequence.residualImpact,
            score: consequence.score,
            rating: consequence.rating,
            appetite: consequence.appetite,
            departsFromMethodology: consequence.departsFromMethodology,
          }
        : null,
      ratification: decision ? { optionId: decision.chosenOptionId, rationale: decision.rationale, decidedBy: decision.decidedByUserId } : null,
      residualRecord: tool ? { state: tool.state, auditEventId: tool.auditEventId } : null,
      facts: {
        keyLineId: key?.id ?? null,
        keyRiskId: fact(key, "riskId") || null,
        keyControlId: fact(key, "keyControlId") || null,
        effectiveness: judgment?.effectiveness ?? null,
        residualLikelihood: consequence?.residualLikelihood ?? null,
        residualImpact: consequence?.residualImpact ?? null,
        score: consequence?.score ?? null,
        rating: consequence?.rating ?? null,
        appetite: consequence?.appetite ?? null,
        path: decision?.chosenOptionId ?? null,
      },
      preparation: { artifactId: context.preparation.artifactId, mode: context.preparation.mode, source: context.preparation.source },
    },
  };
});

export const RCSA_RATING_APPETITE = { processId: RCSA_PROCESS_ID, stageId: STAGE_ID } as const;
