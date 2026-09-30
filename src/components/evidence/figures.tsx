/**
 * Figures with a mandatory basis label.
 *
 * The product brief sets one hard rule about numbers: every figure shown to a
 * reader must declare where it came from. Relying on an author to remember
 * that rule is the failure mode, so the rule is encoded in the type instead.
 * `basis` and `derivation` are required props. A figure cannot be rendered
 * without stating what kind of number it is and how it was obtained.
 *
 * Three bases exist and there is no fourth:
 *   measured        counted or summed from the rows in this scenario database
 *   illustrative    a modelled or indicative figure, not an observation
 *   client-input    the bank must supply this; the prototype does not know it
 *
 * There is deliberately no basis meaning "external benchmark", because this
 * prototype has none.
 */

import { Chip, type Tone } from "./primitives";

export type FigureBasis = "measured" | "illustrative" | "client-input";

/** The three permitted labels, verbatim. These strings are the contract. */
export const FIGURE_BASIS_LABEL: Record<FigureBasis, string> = {
  measured: "measured in this simulation",
  illustrative: "illustrative",
  "client-input": "client input required",
};

const BASIS_TONE: Record<FigureBasis, Tone> = {
  measured: "green",
  illustrative: "cyan",
  "client-input": "amber",
};

const BASIS_TITLE: Record<FigureBasis, string> = {
  measured:
    "Counted or summed from rows in this scenario database. It describes this simulation and nothing outside it.",
  illustrative:
    "A modelled or indicative figure. It is not an observation and it is not an external benchmark.",
  "client-input":
    "The prototype cannot know this figure. It has to come from the bank's own measurement.",
};

/** The basis label on its own. Used inline and inside every figure component. */
export function BasisLabel({ basis }: { basis: FigureBasis }) {
  return (
    <Chip tone={BASIS_TONE[basis]} title={BASIS_TITLE[basis]}>
      {FIGURE_BASIS_LABEL[basis]}
    </Chip>
  );
}

/**
 * An inline figure inside a sentence, with its basis attached.
 *
 * The basis travels with the number rather than sitting in a caption, because
 * a caption is the first thing that is lost when a screen is photographed.
 */
export function Figure({
  value,
  basis,
  unit,
}: {
  value: string | number;
  basis: FigureBasis;
  unit?: string;
}) {
  return (
    <span className="row row-2" style={{ display: "inline-flex", verticalAlign: "middle" }}>
      <span className="mono strong-text">
        {typeof value === "number" ? value.toLocaleString("en-GB") : value}
        {unit ? <span className="muted"> {unit}</span> : null}
      </span>
      <BasisLabel basis={basis} />
    </span>
  );
}

export interface ValueMetricProps {
  /** What is being counted, in the practitioner's words. */
  label: string;
  /** The figure itself. Pass a string when there is no number to show. */
  value: string | number;
  /** Mandatory. There is no default and no way to omit it. */
  basis: FigureBasis;
  /** Mandatory. States how the figure was obtained, or what would produce it. */
  derivation: string;
  unit?: string;
  /** Optional professional interpretation. Never a claim of saving. */
  note?: string;
  tone?: Tone;
}

/**
 * One metric, rendered as a card.
 *
 * The value is large, the basis label sits directly under it, and the
 * derivation is always present. A reader can therefore check any number on
 * this page against the database without asking anyone what it means.
 */
export function ValueMetric({
  label,
  value,
  basis,
  derivation,
  unit,
  note,
  tone,
}: ValueMetricProps) {
  const edgeTone: Tone = tone ?? BASIS_TONE[basis];
  return (
    <div className="card card-edge" data-tone={edgeTone}>
      <div className="stack stack-2">
        <span className="label">{label}</span>
        <div className="row row-2 row-baseline row-wrap">
          <span
            className="display strong-text"
            style={{ fontSize: "var(--text-lg)", fontVariantNumeric: "tabular-nums" }}
          >
            {typeof value === "number" ? value.toLocaleString("en-GB") : value}
          </span>
          {unit ? <span className="meta">{unit}</span> : null}
        </div>
        <BasisLabel basis={basis} />
        <p className="meta" style={{ lineHeight: 1.5, whiteSpace: "normal" }}>
          {derivation}
        </p>
        {note ? (
          <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
            {note}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** A group of metrics with a heading and an explanation of the group. */
export function MetricGroup({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">{title}</span>
      </div>
      <div className="panel-body stack stack-4">
        <p className="dim" style={{ fontSize: "var(--text-sm)", maxWidth: "88ch" }}>
          {intro}
        </p>
        <div className="grid grid-3">{children}</div>
      </div>
    </section>
  );
}
