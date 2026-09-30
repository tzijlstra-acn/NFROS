/**
 * Deterministic risk calculators.
 *
 * These are not language model agents. A residual risk position, a matrix
 * placement and an impact tolerance countdown are arithmetic against a policy,
 * and a model must never be the thing that computes them. The model may
 * explain a result and may argue that an input is wrong; it does not decide
 * what five by four means on the group scale.
 */

/** The group five by five scale. Index one to five in both dimensions. */
export const SCALE_MIN = 1;
export const SCALE_MAX = 5;

export const LIKELIHOOD_LABELS: Record<number, { en: string; de: string }> = {
  1: { en: "Rare", de: "Selten" },
  2: { en: "Unlikely", de: "Unwahrscheinlich" },
  3: { en: "Possible", de: "Moeglich" },
  4: { en: "Likely", de: "Wahrscheinlich" },
  5: { en: "Almost certain", de: "Nahezu sicher" },
};

export const IMPACT_LABELS: Record<number, { en: string; de: string }> = {
  1: { en: "Insignificant", de: "Unbedeutend" },
  2: { en: "Minor", de: "Gering" },
  3: { en: "Moderate", de: "Mittel" },
  4: { en: "Major", de: "Erheblich" },
  5: { en: "Severe", de: "Schwerwiegend" },
};

export const RISK_RATINGS = ["low", "medium", "high", "critical"] as const;
export type RiskRating = (typeof RISK_RATINGS)[number];

export const RISK_RATING_LABELS: Record<RiskRating, { en: string; de: string }> = {
  low: { en: "Low", de: "Niedrig" },
  medium: { en: "Medium", de: "Mittel" },
  high: { en: "High", de: "Hoch" },
  critical: { en: "Critical", de: "Kritisch" },
};

/**
 * Control effectiveness, as recorded in the internal control system.
 *
 * The ordering matters: it drives how much the control is allowed to reduce
 * the inherent position.
 */
export const CONTROL_EFFECTIVENESS = [
  "not-effective",
  "partially-effective",
  "largely-effective",
  "fully-effective",
  "not-assessed",
] as const;

export type ControlEffectiveness = (typeof CONTROL_EFFECTIVENESS)[number];

export const CONTROL_EFFECTIVENESS_LABELS: Record<
  ControlEffectiveness,
  { en: string; de: string }
> = {
  "not-effective": { en: "Not effective", de: "Nicht wirksam" },
  "partially-effective": { en: "Partially effective", de: "Teilweise wirksam" },
  "largely-effective": { en: "Largely effective", de: "Weitgehend wirksam" },
  "fully-effective": { en: "Fully effective", de: "Vollstaendig wirksam" },
  "not-assessed": { en: "Not assessed", de: "Nicht beurteilt" },
};

/**
 * Likelihood reduction the group methodology permits per effectiveness band.
 *
 * This is a policy parameter, stated here in one place so the interface can
 * cite it rather than appearing to invent a number.
 */
const LIKELIHOOD_REDUCTION: Record<ControlEffectiveness, number> = {
  "fully-effective": 2,
  "largely-effective": 1,
  "partially-effective": 0,
  "not-effective": 0,
  "not-assessed": 0,
};

/**
 * Impact reduction permitted per effectiveness band. Controls in this taxonomy
 * mostly reduce likelihood; only a fully effective control is credited with
 * reducing impact, and then by one band.
 */
const IMPACT_REDUCTION: Record<ControlEffectiveness, number> = {
  "fully-effective": 1,
  "largely-effective": 0,
  "partially-effective": 0,
  "not-effective": 0,
  "not-assessed": 0,
};

function clampToScale(value: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(value)));
}

/**
 * The group risk matrix. Returns the rating for a likelihood and impact pair.
 *
 * The matrix is written out explicitly rather than derived from a product,
 * because a real bank's matrix is not symmetric and the asymmetry is the
 * methodology.
 */
const MATRIX: ReadonlyArray<ReadonlyArray<RiskRating>> = [
  //  impact 1        2          3          4           5
  ["low", "low", "low", "medium", "medium"], // likelihood 1
  ["low", "low", "medium", "medium", "high"], // likelihood 2
  ["low", "medium", "medium", "high", "high"], // likelihood 3
  ["medium", "medium", "high", "high", "critical"], // likelihood 4
  ["medium", "high", "high", "critical", "critical"], // likelihood 5
];

export function ratingFor(likelihood: number, impact: number): RiskRating {
  const l = clampToScale(likelihood);
  const i = clampToScale(impact);
  const row = MATRIX[l - 1];
  if (!row) return "medium";
  return row[i - 1] ?? "medium";
}

export interface MatrixPosition {
  inherentLikelihood: number;
  inherentImpact: number;
  inherentRating: RiskRating;
  controlEffectiveness: ControlEffectiveness;
  residualLikelihood: number;
  residualImpact: number;
  residualRating: RiskRating;
  /** The methodology statement that produced this result. */
  methodologyNote: string;
  /** How many bands the control reduced each dimension. */
  likelihoodReduction: number;
  impactReduction: number;
}

/**
 * Computes a residual position from an inherent position and a control
 * effectiveness rating.
 *
 * Note what this deliberately does not do: it does not decide the control
 * effectiveness. That is a human judgment, and it arrives here as an input.
 */
export function calculateRiskMatrixPosition(params: {
  inherentLikelihood: number;
  inherentImpact: number;
  controlEffectiveness: ControlEffectiveness;
}): MatrixPosition {
  const inherentLikelihood = clampToScale(params.inherentLikelihood);
  const inherentImpact = clampToScale(params.inherentImpact);
  const likelihoodReduction = LIKELIHOOD_REDUCTION[params.controlEffectiveness];
  const impactReduction = IMPACT_REDUCTION[params.controlEffectiveness];

  const residualLikelihood = clampToScale(inherentLikelihood - likelihoodReduction);
  const residualImpact = clampToScale(inherentImpact - impactReduction);

  return {
    inherentLikelihood,
    inherentImpact,
    inherentRating: ratingFor(inherentLikelihood, inherentImpact),
    controlEffectiveness: params.controlEffectiveness,
    residualLikelihood,
    residualImpact,
    residualRating: ratingFor(residualLikelihood, residualImpact),
    likelihoodReduction,
    impactReduction,
    methodologyNote:
      `Group methodology: a ${CONTROL_EFFECTIVENESS_LABELS[params.controlEffectiveness].en.toLowerCase()} ` +
      `control reduces likelihood by ${likelihoodReduction} band(s) and impact by ${impactReduction} band(s).`,
  };
}

/** Appetite position for a residual rating against a stated tolerance. */
export function appetitePositionFor(
  residualRating: RiskRating,
  appetiteCeiling: RiskRating,
): "within" | "at-limit" | "outside" {
  const order = RISK_RATINGS.indexOf(residualRating);
  const ceiling = RISK_RATINGS.indexOf(appetiteCeiling);
  if (order < ceiling) return "within";
  if (order === ceiling) return "at-limit";
  return "outside";
}

/* ==========================================================================
   Impact tolerance
   ========================================================================== */

export interface ToleranceStatus {
  serviceId: string;
  metric: string;
  thresholdMinutes: number;
  consumedMinutes: number;
  remainingMinutes: number;
  /** Proportion of the tolerance consumed, zero to one, clamped. */
  consumedFraction: number;
  /** "within", "approaching", "at-threshold" or "breached". */
  state: "within" | "approaching" | "at-threshold" | "breached";
  /** True once consumption passes the approaching band. */
  requiresEscalationConsideration: boolean;
  statement: string;
}

/** Fraction at which a tolerance is treated as approaching its threshold. */
export const TOLERANCE_APPROACHING_FRACTION = 0.7;

/**
 * Computes remaining impact tolerance headroom.
 *
 * Breach is a human determination in this product: this function reports that
 * the threshold has been passed, and the Incident and Resilience Lead decides
 * whether that constitutes a breach requiring escalation.
 */
export function calculateToleranceRemaining(params: {
  serviceId: string;
  metric: string;
  thresholdMinutes: number;
  consumedMinutes: number;
  statement: string;
}): ToleranceStatus {
  const threshold = Math.max(1, params.thresholdMinutes);
  const consumed = Math.max(0, params.consumedMinutes);
  const remaining = threshold - consumed;
  const fraction = Math.min(1, consumed / threshold);

  let state: ToleranceStatus["state"];
  if (consumed >= threshold) state = "breached";
  else if (remaining === 0) state = "at-threshold";
  else if (fraction >= TOLERANCE_APPROACHING_FRACTION) state = "approaching";
  else state = "within";

  return {
    serviceId: params.serviceId,
    metric: params.metric,
    thresholdMinutes: threshold,
    consumedMinutes: consumed,
    remainingMinutes: remaining,
    consumedFraction: fraction,
    state,
    requiresEscalationConsideration: state !== "within",
    statement: params.statement,
  };
}

/* ==========================================================================
   Scenario clock helpers
   ========================================================================== */

/** Converts "14:05" to minutes since midnight. */
export function momentToMinutes(moment: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(moment.trim());
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

/** Converts minutes since midnight to a 24 hour label. */
export function minutesToMoment(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** True when `moment` is at or before `now` on the scenario clock. */
export function isRevealed(moment: string, now: string): boolean {
  return momentToMinutes(moment) <= momentToMinutes(now);
}

/** Formats an ISO date as DD.MM.YYYY, the DACH convention. */
export function formatDateDach(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getUTCFullYear()}`;
}

/** Formats a minor-unit amount with its currency, DACH number formatting. */
export function formatAmount(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  const formatted = major.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currency}`;
}
