"use client";

/**
 * Presentation primitives.
 *
 * Everything a scene needs that is not specific to one scene: the reveal
 * state wrapper, the stage fitter, the mandatory number and label components,
 * the background work reveal, and the never blank failure path.
 *
 * Two rules are encoded here rather than remembered.
 *
 * 1. A reveal is a state, not an animation. `Reveal` renders
 *    `data-shown="true|false"` from the scene's reveal step counter and lets
 *    CSS transition between the two. Any step can be jumped to directly and
 *    the painted result is identical, which is what makes presenter safe mode
 *    and the export capture deterministic.
 *
 * 2. A number carries its basis. `Metric` cannot render a value without the
 *    basis label from NUMBER_BASIS_LABELS, because the basis is part of the
 *    number rather than a footnote to it.
 */

import * as React from "react";
import {
  FACT_CLASS_LABELS,
  NUMBER_BASIS_LABELS,
  REGULATORY_LABEL,
  type BackgroundReveal,
  type FactClass,
  type NumberBasis,
  type StoryMetric,
  type StoryScene,
} from "@/scenario/data/story";
import { Chip, ProvenanceBadge } from "@/components/evidence/primitives";

/* ==========================================================================
   Scene contract
   ========================================================================== */

/** What every scene component receives. */
export interface SceneRenderProps<TContent> {
  content: TContent;
  /** The scene frame, for the title, the clock and the mandatory labels. */
  scene: StoryScene;
  /** Current reveal step, 0 based. Safe mode passes the final step. */
  step: number;
  /** True when motion must resolve immediately: safe, export or reduced. */
  immediate: boolean;
  /** Presenter toggle for the background work reveal, where a scene has one. */
  backgroundOpen: boolean;
}

/** How many reveal steps a scene declares. Used by the deck for auto reveal. */
export type SceneStepCount = number;

/* ==========================================================================
   Reveal
   ========================================================================== */

export type RevealVariant =
  | "up"
  | "flat"
  | "left"
  | "right"
  | "rise"
  | "scale"
  | "fade"
  | "travel";

const VARIANT_CLASS: Record<RevealVariant, string> = {
  up: "rv",
  flat: "rv rv-flat",
  left: "rv rv-left",
  right: "rv rv-right",
  rise: "rv rv-rise",
  scale: "rv rv-scale",
  fade: "rv-fade",
  travel: "rv-travel",
};

export interface RevealProps {
  /** The step at or after which this element is shown. */
  at: number;
  /** The scene's current step. */
  step: number;
  variant?: RevealVariant;
  /** Stagger, in milliseconds. Zero in safe mode, because CSS collapses it. */
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: "div" | "li" | "section" | "p" | "span" | "aside" | "header";
  children?: React.ReactNode;
  /** Set true to hide the element again once a later step is reached. */
  until?: number;
  title?: string;
}

/**
 * A single element whose visibility is a function of the reveal step.
 *
 * `until` is what makes a morph possible: the outgoing layer is shown from
 * step `at` and hidden from step `until`, so two states of one object can
 * cross fade without either of them being conditionally unmounted. Unmounting
 * would lose the transition and would make the scene non seekable.
 */
export function Reveal({
  at,
  step,
  variant = "up",
  delay = 0,
  className,
  style,
  as = "div",
  children,
  until,
  title,
}: RevealProps) {
  const shown = step >= at && (until === undefined || step < until);
  const Tag = as as React.ElementType;
  return (
    <Tag
      className={[VARIANT_CLASS[variant], className].filter(Boolean).join(" ")}
      data-shown={shown ? "true" : "false"}
      style={{ ...style, ["--rv-delay" as string]: `${delay}ms` }}
      title={title}
    >
      {children}
    </Tag>
  );
}

/* ==========================================================================
   Stage fit
   ========================================================================== */

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * Measures a container against the natural height of its content and returns
 * the scale factor that makes the content fit.
 *
 * `scrollHeight` and `scrollWidth` report layout size, which is unaffected by
 * the measured element's own transform. That is what keeps the measurement
 * from feeding back into itself, and it is why the scale is stable rather
 * than oscillating.
 */
function useFitScale(
  outerRef: React.RefObject<HTMLDivElement | null>,
  innerRef: React.RefObject<HTMLDivElement | null>,
  minScale: number,
  dependency: unknown,
): number {
  const [fit, setFit] = React.useState(1);

  useIsomorphicLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (outer === null || inner === null) return;

    let frame = 0;

    const measure = () => {
      const boxH = outer.clientHeight;
      const boxW = outer.clientWidth;
      const contentH = inner.scrollHeight;
      const contentW = inner.scrollWidth;
      if (boxH <= 0 || contentH <= 0) return;

      let next = 1;
      if (contentH > boxH) next = boxH / contentH;
      if (contentW > boxW && boxW > 0) next = Math.min(next, boxW / contentW);
      next = Math.max(minScale, Math.min(1, next));
      // Three decimals, so sub pixel noise cannot cause an observer loop.
      const rounded = Math.round(next * 1000) / 1000;
      setFit((current) => (Math.abs(current - rounded) < 0.002 ? current : rounded));
    };

    const schedule = () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    measure();

    const observer = new ResizeObserver(schedule);
    observer.observe(outer);
    observer.observe(inner);

    // SVG scenes measure text, so a font swap changes the natural height.
    let cancelled = false;
    if (typeof document !== "undefined" && "fonts" in document) {
      void document.fonts.ready.then(() => {
        if (!cancelled) schedule();
      });
    }

    return () => {
      cancelled = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [outerRef, innerRef, minScale, dependency]);

  return fit;
}

export interface StageFitProps {
  /** Aspect budget for the drawing area, as in the source geometry contract. */
  size?: "compact" | "standard" | "wide" | "full";
  /** Floor on the scale factor. Below this the content is unreadable anyway. */
  minScale?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Layer four of the geometry contract, plus the no scroll rule.
 *
 * The stage takes its size from the grid row and nothing else, because
 * `contain: layout paint size` removes its content from its own sizing. This
 * component then measures the stage box against the natural, pre transform
 * height of the content and scales the content down to fit.
 *
 * Scaling rather than scrolling is deliberate. A scrollbar on a projected
 * slide is a defect: half the composition is off screen and the audience
 * cannot see that it is. A composition drawn a little smaller is still the
 * whole composition, and it still reads from the back of the room.
 */
export function StageFit({
  size = "standard",
  minScale = 0.5,
  className,
  children,
}: StageFitProps) {
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const fit = useFitScale(stageRef, rootRef, minScale, children);

  return (
    <div className="scene-stage" ref={stageRef}>
      <div className="scene-fit">
        <div
          className={["scene-root", className].filter(Boolean).join(" ")}
          data-size={size}
          data-fit={fit < 1 ? "scaled" : "natural"}
          ref={rootRef}
          style={{ ["--fit" as string]: String(fit) }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * A stage that holds more than one composition.
 *
 * Scenes 12 and 14 each carry two compositions that are too dense to stack
 * into one frame: the spine and then the tolerance lanes, the six lenses and
 * then the one thread. Rendering them as cross faded layers keeps the scene
 * inside one stage and inside the no scroll rule, and it keeps the transition
 * between them meaningful: the second composition is what the first one
 * resolves into.
 */
export function StageLayers({ children }: { children?: React.ReactNode }) {
  return <div className="scene-stage">{children}</div>;
}

/**
 * One composition inside a multi layer stage. Measures itself against the
 * stage box and scales its own content to fit, exactly as StageFit does.
 */
export function FitLayer({
  shown,
  size = "full",
  minScale = 0.5,
  label,
  children,
}: {
  shown: boolean;
  size?: "compact" | "standard" | "wide" | "full";
  minScale?: number;
  label: string;
  children?: React.ReactNode;
}) {
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const fit = useFitScale(boxRef, innerRef, minScale, children);

  return (
    <div
      className="scene-fit rv-fade"
      data-shown={shown ? "true" : "false"}
      aria-hidden={shown ? "false" : "true"}
      aria-label={label}
      ref={boxRef}
      style={{ pointerEvents: shown ? "auto" : "none" }}
    >
      <div
        className="scene-root"
        data-size={size}
        ref={innerRef}
        style={{ ["--fit" as string]: String(fit) }}
      >
        {children}
      </div>
    </div>
  );
}

/* ==========================================================================
   Swap regions
   ========================================================================== */

/**
 * A fixed height region that holds several panes and shows one at a time.
 *
 * The height is given in container query height units against the stage, so
 * the region is always a stated fraction of the drawing space rather than a
 * consequence of whichever pane happens to be longest. That is what keeps a
 * dense scene from forcing the whole stage to scale down.
 */
export function SwapRegion({
  height,
  className,
  children,
}: {
  /** Stage height fraction, in container query height units. */
  height: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={["swap-region", className].filter(Boolean).join(" ")}
      style={{ height, flex: "0 0 auto" }}
    >
      {children}
    </div>
  );
}

/**
 * A fixed height box that scales its own content to fit.
 *
 * This is the containment boundary for a reused hero visualisation. Those
 * components are width driven SVG plus a caption, a legend and a notes block,
 * and at a 16:9 stage height they are taller than the space available. Without
 * a local boundary their overflow drags the whole stage's scale down, which
 * makes every HTML word on the slide smaller to accommodate one drawing.
 *
 * With the boundary, the drawing absorbs its own overflow and the slide's text
 * stays at the deck's 14px floor. The cost is that the drawing's own viewBox
 * unit labels shrink, which is the one documented type exception in the deck,
 * and it is the right trade: the labels are also carried at full size in the
 * figure's legend and in the scene's accessible summary.
 */
export function FitBox({
  height,
  minScale = 0.42,
  className,
  children,
}: {
  /** Box height, normally in container query height units against the stage. */
  height: string;
  minScale?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const fit = useFitScale(boxRef, innerRef, minScale, children);

  return (
    <div className={["fit-box", className].filter(Boolean).join(" ")} style={{ height }} ref={boxRef}>
      <div
        className="fit-inner"
        ref={innerRef}
        style={{ ["--fit" as string]: String(fit) }}
        data-fit={fit < 1 ? "scaled" : "natural"}
      >
        {children}
      </div>
    </div>
  );
}

/** One pane inside a swap region. Cross fades rather than unmounting. */
export function SwapPane({
  shown,
  label,
  className,
  children,
}: {
  shown: boolean;
  label: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={["swap-pane rv-fade", className].filter(Boolean).join(" ")}
      data-shown={shown ? "true" : "false"}
      aria-hidden={shown ? "false" : "true"}
      aria-label={label}
    >
      {children}
    </div>
  );
}

/* ==========================================================================
   Numbers and their basis
   ========================================================================== */

export function Basis({ basis, note }: { basis: NumberBasis; note?: string }) {
  return (
    <span className="story-basis" data-basis={basis}>
      {NUMBER_BASIS_LABELS[basis]}
      {note !== undefined && note.length > 0 ? `. ${note}` : ""}
    </span>
  );
}

/**
 * A quantity with its basis attached. There is no variant of this component
 * that omits the basis, which is the point of it existing.
 */
export function Metric({
  metric,
  scale = "md",
  showNote = true,
}: {
  metric: StoryMetric;
  scale?: "sm" | "md" | "lg";
  showNote?: boolean;
}) {
  return (
    <span className="story-metric" data-scale={scale}>
      <span className="story-metric-value">{metric.value}</span>
      <span className="story-metric-label">{metric.label}</span>
      <Basis basis={metric.basis} {...(showNote && metric.note ? { note: metric.note } : {})} />
    </span>
  );
}

/** Inline form, for a metric that sits inside a sentence or a dense row. */
export function MetricInline({ metric }: { metric: StoryMetric }) {
  return (
    <span className="row row-2 row-wrap row-baseline">
      <b className="mono" style={{ color: "var(--text-1)", fontSize: "var(--text-sm)" }}>
        {metric.value}
      </b>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>{metric.label}</span>
      <Basis basis={metric.basis} {...(metric.note ? { note: metric.note } : {})} />
    </span>
  );
}

/* ==========================================================================
   Classification
   ========================================================================== */

/** VF, SS and TI carry the product's provenance styling, not a bespoke one. */
const FACT_CLASS_KIND: Record<FactClass, string> = {
  VF: "verified-fact",
  SS: "stakeholder-statement",
  TI: "telemetry",
};

export function FactClassChip({ factClass }: { factClass: FactClass }) {
  return (
    <span className="row row-2" style={{ gap: 6 }}>
      <ProvenanceBadge kind={FACT_CLASS_KIND[factClass]} showLabel={false} />
      <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
        {factClass}. {FACT_CLASS_LABELS[factClass]}
      </span>
    </span>
  );
}

/* ==========================================================================
   Mandatory labels
   ========================================================================== */

/**
 * The regulatory label, rendered at the point of display.
 *
 * The scene data types the field as the exact constant, so a scene cannot
 * show a regulatory reference under a paraphrase. This component renders that
 * constant and nothing else.
 */
export function RegulatoryLine({ scope }: { scope?: StoryScene["regulatoryScope"] }) {
  const scopeText =
    scope === "eu-entities"
      ? "EU entities"
      : scope === "swiss-entity"
        ? "Swiss entity"
        : scope === "both-lanes-separately"
          ? "EU lane and Swiss lane shown separately"
          : undefined;
  return (
    <span className="story-reg">
      <span aria-hidden="true">{"§"}</span>
      <span>
        {REGULATORY_LABEL}
        {scopeText !== undefined ? ` Scope: ${scopeText}.` : ""}
      </span>
    </span>
  );
}

/* ==========================================================================
   Small shared blocks
   ========================================================================== */

export function PanelTitle({ children }: { children: React.ReactNode }) {
  return <span className="story-panel-title">{children}</span>;
}

/** A bulleted list against a coloured rule. The rule carries the meaning. */
export function RuleList({
  items,
  tone,
  label,
}: {
  items: readonly string[];
  tone: "evidence" | "human" | "ai" | "risk";
  label?: string;
}) {
  return (
    <div className="stack stack-1" style={{ minWidth: 0 }}>
      {label !== undefined ? <PanelTitle>{label}</PanelTitle> : null}
      <ul className="story-rule-list" data-tone={tone}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Evidence references, as monospaced provenance chips. */
export function EvidenceRefs({
  refs,
  label = "Evidence",
}: {
  refs: readonly string[];
  label?: string;
}) {
  if (refs.length === 0) return null;
  return (
    <div className="prov-strip">
      <span className="story-panel-title" style={{ margin: 0 }}>
        {label}
      </span>
      {refs.map((ref) => (
        <span className="prov-chip" key={ref} title={ref}>
          {ref}
        </span>
      ))}
    </div>
  );
}

/* ==========================================================================
   Background work reveal
   ========================================================================== */

/**
 * The reveal behind a working scene.
 *
 * Three properties are structural rather than cosmetic. Lane four is not
 * rendered as a column, because it is zero by design and a zero column reads
 * as a missing value. The awaiting release figure sits beside the completed
 * figure and never after it, because an execute row with no named releaser
 * has not executed. And the drill down note is part of the number: a count
 * without its list is a claim.
 */
export function BackgroundRevealPanel({
  reveal,
  open,
  step,
  at,
}: {
  reveal: BackgroundReveal;
  open: boolean;
  step: number;
  at: number;
}) {
  const shown = step >= at;
  return (
    <Reveal at={at} step={step} variant="flat" className="story-background">
      <div className="row row-3 row-between row-wrap">
        <PanelTitle>Work completed in the background, before this moment</PanelTitle>
        <Chip tone={open ? "accent" : "neutral"} glyph>
          {open ? "Expanded" : "Press B to expand"}
        </Chip>
      </div>

      <div className="story-background-lanes">
        <span className="story-lane-count">
          <b>{reveal.organise}</b>
          <span>1. Organise</span>
        </span>
        <span className="story-lane-count">
          <b>{reveal.understand}</b>
          <span>2. Understand</span>
        </span>
        <span className="story-lane-count">
          <b>{reveal.execute}</b>
          <span>5. Execute</span>
        </span>
        <span className="divider-v" aria-hidden="true" />
        <Metric metric={reveal.total} scale="sm" showNote={open} />
        <span className="divider-v" aria-hidden="true" />
        <span className="story-lane-count" data-zero={reveal.awaitingRelease === 0 ? "true" : "false"}>
          <b>{reveal.awaitingRelease}</b>
          <span>Awaiting release</span>
        </span>
        <span className="story-lane-count">
          <b>{reveal.draftsPrepared}</b>
          <span>Drafts prepared</span>
        </span>
      </div>

      {open && shown ? (
        <div className="stack stack-2">
          <p className="story-body-dim">
            Lane 4 Decide is not shown as a column. It is zero by design and the action ledger
            rejects a lane 4 row, so a zero column would read as a missing value rather than as a
            property.
          </p>
          <div className="row row-4 row-wrap">
            <span className="story-lane-count">
              <b>{reveal.artefactsTouched}</b>
              <span>Artefacts touched</span>
            </span>
            <span className="story-lane-count">
              <b>{reveal.artefactsExternal}</b>
              <span>Of which external</span>
            </span>
          </div>
          <p className="story-body-dim">{reveal.drillDownNote}</p>
        </div>
      ) : null}
    </Reveal>
  );
}

/* ==========================================================================
   Never blank on failure
   ========================================================================== */

/**
 * The static composition a scene falls back to.
 *
 * Carried from the source findings: renderError, then renderStatic, then a
 * static drawing. The presenter keeps their place because the title, the key
 * message and the stage note are all still on screen, and the frame is drawn
 * rather than empty.
 */
export function StaticSceneFallback({
  scene,
  reason,
  debug = false,
}: {
  scene: StoryScene;
  reason?: string;
  debug?: boolean;
}) {
  return (
    <div className="scene-fallback">
      <svg
        viewBox="0 0 640 180"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "min(640px, 100%)", height: "auto", margin: "0 auto" }}
        role="img"
        aria-label={`Static fallback frame for scene ${scene.sceneNumber}, ${scene.title}`}
      >
        <rect
          x="1"
          y="1"
          width="638"
          height="178"
          rx="8"
          fill="var(--surface-1)"
          stroke="var(--border-2)"
        />
        <line x1="40" y1="92" x2="600" y2="92" stroke="var(--border-2)" strokeWidth="1" />
        <circle cx="180" cy="92" r="9" fill="var(--surface-3)" stroke="var(--border-strong)" />
        <circle cx="320" cy="92" r="9" fill="var(--surface-3)" stroke="var(--border-strong)" />
        <circle cx="460" cy="92" r="9" fill="var(--surface-3)" stroke="var(--border-strong)" />
        <text
          x="320"
          y="46"
          textAnchor="middle"
          fill="var(--text-3)"
          fontSize="15"
          fontFamily="var(--font-mono)"
        >
          {`Scene ${scene.sceneNumber} of 16`}
        </text>
        <text
          x="320"
          y="146"
          textAnchor="middle"
          fill="var(--text-4)"
          fontSize="14"
          fontFamily="var(--font-mono)"
        >
          Static composition
        </text>
      </svg>

      <p className="story-body" style={{ maxWidth: "76ch", margin: "0 auto" }}>
        {scene.keyMessage}
      </p>
      <p className="scene-fallback-note" style={{ maxWidth: "88ch", margin: "0 auto" }}>
        {scene.stageNote}
      </p>
      {debug && reason !== undefined ? (
        <span className="scene-error-tag">{`scene-error: ${scene.id}. ${reason}`}</span>
      ) : null}
    </div>
  );
}

interface BoundaryProps {
  scene: StoryScene;
  debug?: boolean;
  children?: React.ReactNode;
}

interface BoundaryState {
  reason: string | null;
}

/**
 * One boundary per scene.
 *
 * A thrown scene must never cost the presenter the room. The boundary swaps
 * in the static composition for that scene and leaves every other scene
 * untouched, so navigating forward recovers.
 */
export class SceneBoundary extends React.Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { reason: null };
  }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { reason: error instanceof Error ? error.message : "render failed" };
  }

  override componentDidUpdate(previous: BoundaryProps): void {
    if (previous.scene.id !== this.props.scene.id && this.state.reason !== null) {
      this.setState({ reason: null });
    }
  }

  override render(): React.ReactNode {
    if (this.state.reason !== null) {
      return (
        <StaticSceneFallback
          scene={this.props.scene}
          reason={this.state.reason}
          debug={this.props.debug ?? false}
        />
      );
    }
    return this.props.children;
  }
}

/* ==========================================================================
   Clock arithmetic
   ========================================================================== */

/** Minutes past midnight for a label such as "14:05" or "14:05:12 CET". */
export function clockMinutes(label: string): number | null {
  const match = /(\d{1,2}):(\d{2})/.exec(label);
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/** Elapsed minutes between two clock labels, or null where either is absent. */
export function clockSpan(from: string, to: string): number | null {
  const a = clockMinutes(from);
  const b = clockMinutes(to);
  if (a === null || b === null) return null;
  return b - a;
}

/** A deterministic scatter offset, so a "random" layout is reproducible. */
export function scatter(index: number, spread: number): number {
  // A fixed integer hash, not Math.random. The export capture has to be
  // byte comparable across runs, so nothing in the deck may be stochastic.
  const hashed = (index * 2654435761) % 1000;
  return ((hashed / 1000) * 2 - 1) * spread;
}
