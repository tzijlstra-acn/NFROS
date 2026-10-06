/**
 * Rating and appetite consequences: deterministic code, never a model.
 *
 * Stage 6 asks a person for the judgments (control effectiveness, residual
 * likelihood, residual impact) and shows what they mean. What they mean is
 * arithmetic against the group methodology, so it is computed here, by the
 * calculators in `src/domain/nfr/calculators.ts`, and the AI preparation, the
 * task form, the decision rules and the stage record all read the same
 * function. The AI may explain a result; it does not produce one.
 *
 * Two policy parameters are read rather than invented:
 *
 *   the appetite boundary, from the risk's own appetite statement ("a
 *   residual score of 10 or above is outside appetite", or "a residual score
 *   ceiling of 9"), defaulting to the Group Operational Risk Policy boundary
 *   of 10 that the seeded assessment lines are computed against;
 *
 *   the rating ceiling, medium: on the group matrix every position scoring 10
 *   or more rates high or critical and every position scoring 9 or less rates
 *   medium or low, so "outside from 10" and "above a medium ceiling" are the
 *   same rule. `consequenceFor` checks that they agree and says so if a
 *   statement ever sets a boundary the matrix does not.
 */

import {
  appetitePositionFor,
  calculateRiskMatrixPosition,
  CONTROL_EFFECTIVENESS,
  ratingFor,
  type ControlEffectiveness,
  type MatrixPosition,
  type RiskRating,
} from "@/domain/nfr/calculators";
import type { Bilingual } from "@/role-apps/contracts";

/** The group default: a residual score of 10 or above is outside appetite. */
export const GROUP_OUTSIDE_FROM_SCORE = 10;

/** The rating ceiling the group matrix implies for that boundary. */
export const APPETITE_CEILING: RiskRating = "medium";

export type AppetitePosition = "within" | "at-limit" | "outside";

/** The score from which a statement places a residual outside appetite. */
export function outsideFromScore(statement: string): number {
  const orAbove = /residual score of (\d+) or above/i.exec(statement);
  if (orAbove?.[1]) return Number(orAbove[1]);
  const ceiling = /residual score ceiling of (\d+)/i.exec(statement);
  if (ceiling?.[1]) return Number(ceiling[1]) + 1;
  return GROUP_OUTSIDE_FROM_SCORE;
}

export function isControlEffectiveness(value: string): value is ControlEffectiveness {
  return (CONTROL_EFFECTIVENESS as readonly string[]).includes(value) && value !== "not-assessed";
}

export interface RatingInput {
  inherentLikelihood: number;
  inherentImpact: number;
  controlEffectiveness: ControlEffectiveness;
  /** The person's residual judgment. Defaults to the methodology result. */
  residualLikelihood?: number;
  residualImpact?: number;
  /** From the appetite statement. */
  outsideFrom?: number;
}

export interface RatingConsequence {
  /** What the methodology gives for the inherent position and the effectiveness. */
  methodology: MatrixPosition;
  residualLikelihood: number;
  residualImpact: number;
  score: number;
  rating: RiskRating;
  appetite: AppetitePosition;
  /** True when the person's residual differs from the methodology result. */
  departsFromMethodology: boolean;
  /** True when the statement's boundary and the matrix ceiling disagree for this score. */
  boundaryMismatch: boolean;
  governance: Bilingual;
}

/** The plain-language governance effect of an appetite position. Policy text, not judgment. */
export function governanceEffect(appetite: AppetitePosition): Bilingual {
  switch (appetite) {
    case "outside":
      return {
        en: "Outside appetite: an approved remediation plan with committed dates, or a documented Risikoakzeptanz approved by the entity Chief Operating Officer and noted by the Group NFR Committee, is required. Monitoring alone does not discharge it.",
        de: "Ausserhalb der Risikobereitschaft: erforderlich ist ein genehmigter Massnahmenplan mit verbindlichen Terminen oder eine dokumentierte Risikoakzeptanz, genehmigt vom Chief Operating Officer der Gesellschaft und vom Group NFR Committee zur Kenntnis genommen. Ueberwachung allein genuegt nicht.",
      };
    case "at-limit":
      return {
        en: "At the limit of appetite: the appetite statement requires neither a remediation plan nor a risk acceptance; the position is reported with the assessment.",
        de: "An der Grenze der Risikobereitschaft: die Aussage zur Risikobereitschaft verlangt weder Massnahmenplan noch Risikoakzeptanz; die Position wird mit der Bewertung berichtet.",
      };
    default:
      return {
        en: "Within appetite: the appetite statement requires no further step; monitoring continues.",
        de: "Innerhalb der Risikobereitschaft: die Aussage zur Risikobereitschaft verlangt keinen weiteren Schritt; die Ueberwachung laeuft weiter.",
      };
  }
}

export function consequenceFor(input: RatingInput): RatingConsequence {
  const methodology = calculateRiskMatrixPosition({
    inherentLikelihood: input.inherentLikelihood,
    inherentImpact: input.inherentImpact,
    controlEffectiveness: input.controlEffectiveness,
  });
  const residualLikelihood = clamp(input.residualLikelihood ?? methodology.residualLikelihood);
  const residualImpact = clamp(input.residualImpact ?? methodology.residualImpact);
  const rating = ratingFor(residualLikelihood, residualImpact);
  const score = residualLikelihood * residualImpact;
  const appetite = appetitePositionFor(rating, APPETITE_CEILING);
  const outsideFrom = input.outsideFrom ?? GROUP_OUTSIDE_FROM_SCORE;
  return {
    methodology,
    residualLikelihood,
    residualImpact,
    score,
    rating,
    appetite,
    departsFromMethodology:
      residualLikelihood !== methodology.residualLikelihood || residualImpact !== methodology.residualImpact,
    boundaryMismatch: (score >= outsideFrom) !== (appetite === "outside"),
    governance: governanceEffect(appetite),
  };
}

function clamp(value: number): number {
  return Math.min(5, Math.max(1, Math.round(value)));
}

/** "3 x 4 = 12 of 25, High", in the reader's language. */
export function positionText(consequence: Pick<RatingConsequence, "residualLikelihood" | "residualImpact" | "score" | "rating">, language: "en" | "de"): string {
  const ratings: Record<RiskRating, Bilingual> = {
    low: { en: "Low", de: "Niedrig" },
    medium: { en: "Medium", de: "Mittel" },
    high: { en: "High", de: "Hoch" },
    critical: { en: "Critical", de: "Kritisch" },
  };
  const label = language === "de" ? ratings[consequence.rating].de : ratings[consequence.rating].en;
  return language === "de"
    ? `${consequence.residualLikelihood} x ${consequence.residualImpact} = ${consequence.score} von 25, ${label}`
    : `${consequence.residualLikelihood} x ${consequence.residualImpact} = ${consequence.score} of 25, ${label}`;
}
