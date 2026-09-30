"use client";

/**
 * Chapter IV: One event, six questions. Scenes 12, 13 and 14.
 *
 * Scene 12 has to land tension without spectacle, and its honesty is the
 * interval: arrivals dock at delays proportional to the real time gaps
 * between them, so 14:41 to 14:48 feels fast and 15:09 to 15:38 feels slow
 * and the audience experiences the waiting rather than being told about it.
 * The scene has no loop, on purpose. Tension comes from interval.
 *
 * The spine persists across the whole chapter. In scene 12 the arrivals dock
 * on it; in scene 13 it reduces to the centre column and six panels connect
 * to six different points on it; in scene 14 it condenses into one thread.
 * That persistence is the structural claim of the chapter: one event, six
 * readings, one thread.
 *
 * Scene 13 has exactly one loop: the unresolved conflict breathes, because it
 * is the one question the day does not close.
 *
 * Scene 14 is where the CRO and the COO decide whether any of this matters.
 * The two inferred links are drawn at the same speed as the four evidenced
 * ones and in a visibly weaker stroke. Presenting the chain as established
 * would be more persuasive and less defensible.
 */

import * as React from "react";
import type {
  EventArrival,
  EventFanOutContent,
  LensSwitcherContent,
  PortfolioDecisionThreadContent,
  SixLensGridContent,
  SupplierExposureGraphContent,
} from "@/scenario/data/story";
import { Chip, ObjectId } from "@/components/evidence/primitives";
import { ServiceDependencyMap } from "@/components/visualisations/ServiceDependencyMap";
import type { PortfolioThreadProps } from "@/components/visualisations/PortfolioThread";
import {
  FactClassChip,
  FitBox,
  FitLayer,
  Metric,
  PanelTitle,
  RegulatoryLine,
  Reveal,
  RuleList,
  StageFit,
  StageLayers,
  clockMinutes,
  clockSpan,
  type SceneRenderProps,
} from "./parts";
import { dependencyProps, portfolioThreadProps, supplierNameMap } from "./hero-adapters";

/* ==========================================================================
   Scene 12. One event reaches every NFR function.
   ========================================================================== */

export const EVENT_FAN_OUT_STEPS = 10;

/** Arrival groups of at most three, so the spine never outgrows its stage. */
const ARRIVAL_GROUP_SIZE = 3;

function groupOf(arrivals: readonly EventArrival[], arrival: EventArrival): number {
  const position = arrivals.findIndex((candidate) => candidate.id === arrival.id);
  return Math.floor(Math.max(0, position) / ARRIVAL_GROUP_SIZE) + 1;
}

/**
 * Contradiction detection, stated as a rule rather than hand annotated.
 *
 * Two stakeholder statements that touch the same object within fifteen
 * minutes of each other are a contradiction candidate. In this event that
 * picks out the control owner at 14:41 and the supplier at 14:48, both
 * speaking about CTL-PAY-014, which is the conflict the day turns on. Nothing
 * on this scene is marked as contradictory by hand.
 */
function findContradiction(
  arrivals: readonly EventArrival[],
): { first: EventArrival; second: EventArrival; objectRef: string } | null {
  const statements = arrivals.filter((arrival) => arrival.factClass === "SS");
  for (let i = 0; i < statements.length; i += 1) {
    for (let j = i + 1; j < statements.length; j += 1) {
      const first = statements[i];
      const second = statements[j];
      if (first === undefined || second === undefined) continue;
      const gap = clockSpan(first.timeLabel, second.timeLabel);
      if (gap === null || gap < 0 || gap > 15) continue;
      const shared = first.objectsTouched.find((objectRef) =>
        second.objectsTouched.includes(objectRef),
      );
      if (shared !== undefined) return { first, second, objectRef: shared };
    }
  }
  return null;
}

function ArrivalCard({
  arrival,
  delay,
  contradicts,
  side,
}: {
  arrival: EventArrival;
  delay: number;
  contradicts: boolean;
  side: "left" | "right";
}) {
  return (
    <div
      className={`arrival rv rv-${side}`}
      data-shown="true"
      data-class={arrival.factClass}
      style={{ ["--rv-delay" as string]: `${delay}ms` }}
    >
      <span className="row row-3 row-wrap">
        <span className="arrival-time">{arrival.timeLabel}</span>
        <FactClassChip factClass={arrival.factClass} />
        <ObjectId id={arrival.id} />
      </span>
      <span className="story-body-dim clamp-2">{arrival.source}</span>
      <span className="story-body clamp-4">{arrival.content}</span>
      {arrival.inferenceLimit !== undefined ? (
        <span className="inference-limit clamp-3">
          {`Why this inference could be wrong. ${arrival.inferenceLimit}`}
        </span>
      ) : null}
      {/* Reclassification shows both states. History is added, never
          overwritten, so a fact that was an inference stays visible as one. */}
      {arrival.reclassifiedTo !== undefined ? (
        <span className="reclass">
          <s>{arrival.factClass}</s>
          <span aria-hidden="true">{"->"}</span>
          <b>{arrival.reclassifiedTo.factClass}</b>
          <span>{`at ${arrival.reclassifiedTo.timeLabel}, by ${arrival.reclassifiedTo.byArrival}. Both states kept.`}</span>
        </span>
      ) : null}
      {contradicts ? (
        <span className="contradiction-flag">
          <span aria-hidden="true">!</span>
          Contradiction raised on the bridge
        </span>
      ) : null}
    </div>
  );
}

export function EventFanOutScene({
  content,
  scene,
  step,
  supplier,
}: SceneRenderProps<EventFanOutContent> & { supplier: SupplierExposureGraphContent }) {
  const arrivals = content.arrivals;
  const contradiction = React.useMemo(() => findContradiction(arrivals), [arrivals]);
  const resolvingArrival = React.useMemo(
    () => arrivals.find((arrival) => arrival.reclassifiedTo !== undefined),
    [arrivals],
  );

  const groupCount = Math.ceil(arrivals.length / ARRIVAL_GROUP_SIZE);
  // Steps 1 to groupCount walk the spine. The later steps carry the tolerance
  // lanes, the dependency map, and then the rule and the repeat.
  const activeGroup = Math.max(1, Math.min(groupCount, step));
  const spineVisible = step >= 1 && step <= groupCount;
  const lanesStep = groupCount + 1;
  const dependencyStep = groupCount + 2;
  const ruleStep = groupCount + 3;

  const firstMinutes = clockMinutes(arrivals[0]?.timeLabel ?? "14:05") ?? 0;
  const lastMinutes = clockMinutes(arrivals[arrivals.length - 1]?.timeLabel ?? "16:19") ?? 0;
  const spanMinutes = Math.max(1, lastMinutes - firstMinutes);

  // The scene cursor: the clock of the latest arrival the presenter has
  // reached. The tolerance lanes consume against this rather than against the
  // end of the day, so the pressure builds as the scene runs.
  const cursorClock = React.useMemo(() => {
    const reached = arrivals.filter((arrival) => groupOf(arrivals, arrival) <= Math.max(1, step));
    const last = reached[reached.length - 1];
    return last?.timeLabel ?? arrivals[0]?.timeLabel ?? "14:05";
  }, [arrivals, step]);

  const names = React.useMemo(() => supplierNameMap(supplier), [supplier]);
  const dependency = React.useMemo(
    () => dependencyProps(content, cursorClock, names),
    [content, cursorClock, names],
  );

  const regulatory =
    scene.regulatoryNote !== undefined ? <RegulatoryLine scope={scene.regulatoryScope} /> : null;

  const identity = (
    <div className="row row-3 row-wrap row-between">
      <span className="row row-3 row-wrap">
        <ObjectId id={content.incidentId} />
        <Chip tone="cyan" glyph>
          {`Scene cursor ${cursorClock}`}
        </Chip>
      </span>
      {regulatory}
    </div>
  );

  return (
    <StageLayers>
      {/* Pane one. How the day found out, and what the notification omitted. */}
      <FitLayer
        shown={step <= 0}
        minScale={0.55}
        label="How the event was detected, and the first notification verbatim"
      >
        <div className="stack stack-4">
          <div className="row row-3 row-wrap row-between">
            <span className="row row-3 row-wrap">
              <ObjectId id={content.incidentId} />
              <span className="story-body-dim clamp-2" style={{ maxWidth: "74ch" }}>
                {content.incidentTitle}
              </span>
            </span>
            {regulatory}
          </div>

          <div className="row row-6 row-wrap">
            <span className="stack stack-1">
              <PanelTitle>Technical start</PanelTitle>
              <span className="story-body">{content.technicalStart}</span>
            </span>
            <span className="stack stack-1">
              <PanelTitle>Supplier notified</PanelTitle>
              <span className="story-body">{content.supplierNotifiedAt}</span>
            </span>
            <span className="stack stack-1">
              <PanelTitle>Arcadia detected</PanelTitle>
              <span className="story-body">{content.arcadiaDetectedAt}</span>
            </span>
            <Metric metric={content.detectionGap} scale="lg" />
          </div>

          <div className="story-panel" data-tone="human">
            <PanelTitle>The first notification, verbatim</PanelTitle>
            <p className="story-body" style={{ fontSize: "var(--text-md)" }}>
              {`"${content.firstNotification.quote}"`}
            </p>
            <p className="story-body-dim" style={{ marginTop: "var(--space-2)" }}>
              {content.firstNotification.missingFields}
            </p>
            <span className="prov-chip">{content.firstNotification.evidenceRef}</span>
          </div>

          <div className="prov-strip">
            <span className="story-panel-title" style={{ margin: 0 }}>
              Severity path
            </span>
            {content.severityPath.map((entry) => (
              <span className="prov-chip" key={entry}>
                {entry}
              </span>
            ))}
          </div>
        </div>
      </FitLayer>

      {/* Pane two. The spine. The whole time line is always present as a
          ruler; the arrivals of the current group are expanded beside it. */}
      <FitLayer shown={spineVisible} minScale={0.5} label="Event time spine and information arrivals">
        <div className="stack stack-2">
          {identity}

          <div className="spine-wrap">
            <div
              aria-hidden="true"
              className="spine-rail"
              style={{ gridColumn: 2, gridRow: `1 / span ${arrivals.length}` }}
            >
              <span className="spine-line" />
            </div>

            {arrivals.map((arrival, index) => {
              const group = groupOf(arrivals, arrival);
              const reached = group <= activeGroup;
              const expanded = group === activeGroup;
              const minutes = clockMinutes(arrival.timeLabel) ?? firstMinutes;
              // Proportional to the real gap, so the waiting is felt.
              const delay = Math.round(((minutes - firstMinutes) / spanMinutes) * 2400);
              const side: "left" | "right" = index % 2 === 0 ? "left" : "right";
              const contradicts =
                contradiction !== null &&
                (arrival.id === contradiction.first.id || arrival.id === contradiction.second.id);

              return (
                <React.Fragment key={arrival.id}>
                  <div
                    className="spine-tick rv rv-flat"
                    data-shown={reached ? "true" : "false"}
                    style={{
                      gridColumn: 2,
                      gridRow: index + 1,
                      ["--rv-delay" as string]: `${delay}ms`,
                    }}
                  >
                    <span className="spine-dot" data-class={arrival.factClass} />
                    <span>{arrival.timeLabel}</span>
                  </div>

                  <div
                    style={{
                      gridColumn: side === "left" ? 1 : 3,
                      gridRow: index + 1,
                      minWidth: 0,
                      paddingBlock: expanded ? 4 : 0,
                    }}
                  >
                    {expanded ? (
                      <ArrivalCard
                        arrival={arrival}
                        delay={delay}
                        contradicts={contradicts}
                        side={side}
                      />
                    ) : (
                      <div
                        className="rv rv-flat"
                        data-shown={reached ? "true" : "false"}
                        style={{
                          textAlign: side === "left" ? "right" : "left",
                          ["--rv-delay" as string]: `${delay}ms`,
                          opacity: reached ? 0.62 : 0,
                        }}
                      >
                        <span className="story-body-dim clamp-1">
                          {`${arrival.factClass}. ${arrival.source}`}
                        </span>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* The contradiction, as an object with a resolution and a time. */}
          {contradiction !== null ? (
            <div
              className="story-panel rv rv-flat"
              data-tone="risk"
              data-shown={
                groupOf(arrivals, contradiction.second) <= activeGroup ? "true" : "false"
              }
            >
              <PanelTitle>
                {`Two statements on the bridge, both about ${contradiction.objectRef}`}
              </PanelTitle>
              <div className="story-equal-pair">
                <span className="stack stack-1">
                  <span className="arrival-time">{contradiction.first.timeLabel}</span>
                  <span className="story-body clamp-2">{contradiction.first.source}</span>
                </span>
                <span className="stack stack-1">
                  <span className="arrival-time">{contradiction.second.timeLabel}</span>
                  <span className="story-body clamp-2">{contradiction.second.source}</span>
                </span>
              </div>
              {resolvingArrival?.reclassifiedTo !== undefined ? (
                <p
                  className="story-body-dim rv rv-flat clamp-2"
                  data-shown={
                    groupOf(arrivals, resolvingArrival) <= activeGroup ? "true" : "false"
                  }
                  style={{ marginTop: "var(--space-2)" }}
                >
                  {`Resolved at ${resolvingArrival.reclassifiedTo.timeLabel} by ${resolvingArrival.reclassifiedTo.byArrival}. ${resolvingArrival.id} is reclassified from ${resolvingArrival.factClass} to ${resolvingArrival.reclassifiedTo.factClass}, and both states stay in the history.`}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </FitLayer>

      {/* Pane three. One lane per entity, under tolerance pressure. */}
      <FitLayer
        shown={step === lanesStep}
        minScale={0.55}
        label="Consumed impact tolerance, one lane per entity"
      >
        <div className="stack stack-4">
          {identity}
          {content.entityLanes.map((lane, index) => {
            const threshold = clockSpan(lane.disruptionStart, lane.toleranceLimit) ?? 1;
            const elapsed = Math.max(0, clockSpan(lane.disruptionStart, cursorClock) ?? 0);
            const consumedPct = Math.min(100, (elapsed / Math.max(1, threshold)) * 100);
            const cutMinutes =
              lane.cutOff === undefined ? null : clockSpan(lane.disruptionStart, lane.cutOff);
            const cutPct = cutMinutes === null ? null : Math.min(100, (cutMinutes / threshold) * 100);
            const leadMatch = /(\d+)\s*minute/.exec(lane.fallbackLeadTime);
            const leadMinutes = leadMatch === null ? null : Number(leadMatch[1]);
            const leadPct =
              leadMinutes === null ? null : Math.min(100, (leadMinutes / threshold) * 100);
            const state =
              elapsed > threshold
                ? "breached"
                : threshold - elapsed <= threshold * 0.05
                  ? "at-threshold"
                  : "within";
            return (
              <Reveal
                at={lanesStep}
                step={step}
                variant="flat"
                delay={index * 200}
                key={`${lane.entityCode}-${lane.toleranceId}`}
                className="tolerance-lane"
              >
                <span className="stack stack-1">
                  <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                    {lane.entityLabel}
                  </span>
                  <ObjectId id={lane.toleranceId} label={lane.entityCode} />
                  {/* The framework badge belongs to the entity. The Swiss lane
                      carries only its own framework, and no flow crosses
                      between the two jurisdiction lanes. */}
                  <span className="tolerance-legend clamp-2">{lane.frameworkContext}</span>
                </span>
                <span className="stack stack-1" style={{ minWidth: 0 }}>
                  <span className="tolerance-track">
                    <span
                      className="tolerance-consumed"
                      data-state={state}
                      style={{ ["--consumed" as string]: `${consumedPct}%` }}
                    />
                    {cutPct !== null ? (
                      <span
                        className="tolerance-cutoff"
                        style={{ ["--at" as string]: `${cutPct}%` }}
                        title={`Same day cut off ${lane.cutOff ?? ""}`}
                      />
                    ) : null}
                    {/* Drawn at its true lead time and positioned where it
                        would have to start. Where it is longer than the
                        runway, the geometry says so without a sentence. */}
                    {leadPct !== null ? (
                      <span
                        className="tolerance-fallback"
                        style={{
                          ["--at" as string]: `${Math.max(0, consumedPct)}%`,
                          ["--len" as string]: `${leadPct}%`,
                        }}
                        title={lane.fallbackLeadTime}
                      />
                    ) : null}
                  </span>
                  <span className="tolerance-legend clamp-2">
                    {`${lane.toleranceStatement} Disruption from ${lane.disruptionStart}, limit ${lane.toleranceLimit}.`}
                    {lane.runway !== undefined ? ` Runway ${lane.runway}.` : ""}
                  </span>
                  <span className="tolerance-legend clamp-2">
                    {`Fallback: ${lane.fallbackOption} ${lane.fallbackLeadTime}`}
                  </span>
                </span>
              </Reveal>
            );
          })}
        </div>
      </FitLayer>

      {/* Pane four. The dependency the event actually reached. */}
      <FitLayer
        shown={step === dependencyStep}
        minScale={0.5}
        label="The dependency the event reached, classified by object type"
      >
        <div className="stack stack-2">
          {identity}
          <FitBox height="86cqh">
            <div className="story-hero" style={{ ["--hero-ar" as string]: "2.6" }}>
              {/*
                Without the figure's own tolerance bars. Pane three of this
                scene already states the tolerance position properly, one lane
                per entity, and the second copy inside this figure made it
                2310px tall against a 467px box at 1366 by 768: past what the
                stage can scale, so its tail was clipped off the slide. The
                measures remain in the figure's accessible description.
              */}
              <ServiceDependencyMap {...dependency} showTolerancePressure={false} />
            </div>
          </FitBox>
        </div>
      </FitLayer>

      {/* Pane five. The rule, and the fact that it is a repeat. */}
      <FitLayer
        shown={step >= ruleStep}
        minScale={0.55}
        label="The configuration rule at the centre of the event, and its history"
      >
        <div className="stack stack-4">
          {identity}
          <Reveal at={ruleStep} step={step} variant="flat" className="story-panel" data-tone="risk">
            <PanelTitle>The rule at the centre of the event</PanelTitle>
            <p className="story-body" style={{ fontSize: "var(--text-md)" }}>
              {content.ruleStatement}
            </p>
          </Reveal>
          <Reveal
            at={ruleStep + 1}
            step={step}
            variant="flat"
            className="story-panel"
            data-tone="human"
          >
            <PanelTitle>And it is a repeat, not a surprise</PanelTitle>
            <p className="story-body" style={{ fontSize: "var(--text-md)" }}>
              {content.repeatStatement}
            </p>
          </Reveal>
        </div>
      </FitLayer>
    </StageLayers>
  );
}

/* ==========================================================================
   Scene 13. Same event. Different professional question.
   ========================================================================== */

export const SIX_LENS_STEPS = 4;

export function SixLensGridScene({
  content,
  scene,
  step,
  lenses,
}: SceneRenderProps<SixLensGridContent> & { lenses: LensSwitcherContent }) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const roleTitle = React.useMemo(
    () => new Map(lenses.lenses.map((lens) => [lens.roleSlug, lens.roleLabel])),
    [lenses.lenses],
  );

  const left = content.lenses.slice(0, 3);
  const right = content.lenses.slice(3, 6);

  const panel = (
    lens: SixLensGridContent["lenses"][number],
    column: 1 | 3,
    rowIndex: number,
    order: number,
  ) => (
    <button
      type="button"
      key={lens.roleSlug}
      className="lens-panel"
      data-selected={expanded === lens.roleSlug}
      aria-pressed={expanded === lens.roleSlug}
      aria-label={`Expand the ${roleTitle.get(lens.roleSlug) ?? lens.roleSlug} reading of this event`}
      onClick={() => setExpanded(expanded === lens.roleSlug ? null : lens.roleSlug)}
      style={{
        gridColumn: column,
        gridRow: rowIndex + 1,
        opacity: step >= 1 ? 1 : 0,
        ["--rv-delay" as string]: `${order * 620}ms`,
      }}
    >
      <span className="row row-2 row-wrap">
        <span className="strong-text clamp-1" style={{ fontSize: "var(--text-sm)" }}>
          {roleTitle.get(lens.roleSlug) ?? lens.roleSlug}
        </span>
        <span className="story-body-dim">{lens.person}</span>
      </span>
      <span className="story-body-dim clamp-1">{`Reads first: ${lens.firstArrival}`}</span>
      <span className="story-body strong-text clamp-2">{lens.question}</span>
      <span className={expanded === lens.roleSlug ? "story-body clamp-5" : "story-body clamp-2"}>
        {lens.output}
      </span>
      {/* Present in all six panels, and the same size in each, so none of the
          six is presented as the hero. */}
      <span className="uncomfortable clamp-3">{lens.ownUncomfortableFinding}</span>
    </button>
  );

  return (
    <StageFit size="full" minScale={0.5}>
      <div className="stack stack-3">
        <div className="row row-3 row-wrap row-between">
          <span className="story-body-dim clamp-1" style={{ maxWidth: "88ch" }}>
            {content.sharedEvent}
          </span>
          {scene.regulatoryNote !== undefined ? (
            <RegulatoryLine scope={scene.regulatoryScope} />
          ) : null}
        </div>

        <div
          className="lens-grid"
          style={{ gridTemplateRows: "repeat(3, minmax(0, 1fr))", height: "58cqh" }}
        >
          {left.map((lens, index) => panel(lens, 1, index, index))}

          {/* The spine persists, reduced, and each panel connects to the
              specific arrival it reads first. Six connectors to six different
              points on one spine is the argument, drawn. */}
          <div style={{ gridColumn: 2, gridRow: "1 / -1", minHeight: 0 }} aria-hidden="true">
            <svg
              viewBox="0 0 120 300"
              preserveAspectRatio="none"
              style={{ width: "100%", height: "100%" }}
            >
              <line x1="60" y1="8" x2="60" y2="292" stroke="var(--border-2)" strokeWidth="2" />
              {[46, 146, 246].map((y, index) => (
                <g key={`l-${y}`}>
                  <line
                    x1="60"
                    y1={y}
                    x2="4"
                    y2={y}
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                    className="rv-draw"
                    data-shown={step >= 1 ? "true" : "false"}
                    pathLength={1}
                    style={{ ["--rv-delay" as string]: `${index * 620}ms` }}
                  />
                  <circle cx="60" cy={y} r="4" fill="var(--accent)" />
                </g>
              ))}
              {[54, 154, 254].map((y, index) => (
                <g key={`r-${y}`}>
                  <line
                    x1="60"
                    y1={y}
                    x2="116"
                    y2={y}
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                    className="rv-draw"
                    data-shown={step >= 1 ? "true" : "false"}
                    pathLength={1}
                    style={{ ["--rv-delay" as string]: `${(index + 3) * 620}ms` }}
                  />
                  <circle cx="60" cy={y} r="4" fill="var(--accent)" />
                </g>
              ))}
            </svg>
          </div>

          {right.map((lens, index) => panel(lens, 3, index, index + 3))}
        </div>

        <div
          className="grid"
          style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "var(--space-4)" }}
        >
          <Reveal at={2} step={step} variant="flat" className="story-panel" data-tone="evidence">
            <PanelTitle>
              {`${content.conflictsResolved.length} conflicts resolved, each on evidence and at a stated time`}
            </PanelTitle>
            <ul className="story-rule-list" data-tone="evidence">
              {content.conflictsResolved.map((conflict, index) => (
                <Reveal at={2} step={step} variant="flat" delay={index * 200} as="li" key={conflict}>
                  <span className="clamp-2">{conflict}</span>
                </Reveal>
              ))}
            </ul>
          </Reveal>

          {/*
            The one thing the day does not close, and the one loop in the
            scene. The breath is not decoration: it marks an open question with
            a named owner and a dated destination.
          */}
          <Reveal at={3} step={step} variant="flat" className="conflict-open story-breath">
            <PanelTitle>{`${content.conflictUnresolved.id}. Unresolved, on purpose`}</PanelTitle>
            <p className="story-body strong-text clamp-3">{content.conflictUnresolved.subject}</p>
            <div className="row row-3 row-wrap" style={{ marginTop: "var(--space-2)" }}>
              <Chip tone="amber">
                {content.conflictUnresolved.owner}
              </Chip>
              <Chip tone="neutral">{content.conflictUnresolved.destination}</Chip>
            </div>
            <p className="story-body-dim clamp-2" style={{ marginTop: "var(--space-2)" }}>
              {content.conflictUnresolved.whyItStaysOpen}
            </p>
          </Reveal>
        </div>
      </div>
    </StageFit>
  );
}

/* ==========================================================================
   Scene 14. Leadership sees one decision thread, not six reports.
   ========================================================================== */

export const PORTFOLIO_THREAD_STEPS = 6;

/* --------------------------------------------------------------------------
   Six lenses consolidating into one thread
   --------------------------------------------------------------------------

   Built for a 16:9 stage rather than reusing PortfolioThread.

   PortfolioThread was measured first and is not usable here. Its figure runs
   to 2,299px tall when painted 1,302px wide, because it carries its own per
   lens detail list beneath two drawings, and the stage on a 1920 by 1080
   projection is 804px. To fit, the figure would have to be painted about
   455px wide, which puts its 11 unit viewBox labels at roughly 5px. The
   component is right for a tall surface such as the workday rail and wrong
   for a slide, so this scene draws the same consolidation at the stage's own
   aspect. It is fed from `portfolioThreadProps`, so the adapter stays the one
   place where story content meets that view model.

   The beams carry the argument: six separate readings, each with its own
   owner and its own record, converging on one thread with one question. The
   one lens whose position is still open keeps an amber beam, because the day
   does not close it. */

const LENS_W = 340;
const LENS_H = 106;
const LENS_ROW = 116;
const HUB_X = 560;
const HUB_W = 280;

function wrapUnits(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current.length > 0) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current.length > 0) lines.push(current);
  const last = lines[maxLines - 1];
  if (lines.length === maxLines && last !== undefined && lines.join(" ").length < text.length) {
    lines[maxLines - 1] = `${last.slice(0, Math.max(0, maxChars - 3))}...`;
  }
  return lines;
}

function LensConsolidation({
  view,
  step,
}: {
  view: PortfolioThreadProps;
  step: number;
}) {
  const lenses = view.lenses;
  const alt = [
    `${lenses.length} professional readings of ${view.matter.title}, consolidating into one thread.`,
    `Today the same matter would be covered by ${view.matter.duplicateReportCount ?? lenses.length} separate reports.`,
    `Portfolio materiality is ${view.matter.materiality === null || view.matter.materiality === undefined ? "not recorded, because no scene in this scenario records a human deciding it" : view.matter.materiality}.`,
    ...lenses.map(
      (lens) =>
        `${lens.roleTitle}, ${lens.holderLabel ?? "unassigned"}. Question: ${lens.question} Position: ${lens.position}`,
    ),
  ].join(" ");

  return (
    <svg
      viewBox="0 0 1400 424"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "auto" }}
      role="img"
      aria-label={alt}
    >
      {lenses.map((lens, index) => {
        const side = index < Math.ceil(lenses.length / 2) ? "left" : "right";
        const slot = side === "left" ? index : index - Math.ceil(lenses.length / 2);
        const x = side === "left" ? 10 : 1400 - 10 - LENS_W;
        const y = 10 + slot * LENS_ROW;
        const open = lens.positionStatus === "open";
        const edgeX = side === "left" ? x + LENS_W : x;
        const hubX = side === "left" ? HUB_X : HUB_X + HUB_W;
        const control = side === "left" ? edgeX + 110 : edgeX - 110;

        return (
          <g key={lens.roleId}>
            {/* The beam. Amber where the position is still open, because that
                is the one reading the thread cannot close. */}
            <path
              className="beam rv-draw"
              data-kind={open ? "inferred" : "evidenced"}
              data-shown={step >= 0 ? "true" : "false"}
              d={`M ${edgeX} ${y + LENS_H / 2} C ${control} ${y + LENS_H / 2}, ${hubX} 200, ${hubX} 200`}
              pathLength={1}
              style={{ ["--rv-delay" as string]: `${index * 180}ms` }}
            />

            <rect
              x={x}
              y={y}
              width={LENS_W}
              height={LENS_H}
              rx="4"
              fill="var(--surface-1)"
              stroke={open ? "var(--amber-edge)" : "var(--border-1)"}
            />
            <text
              x={x + 12}
              y={y + 24}
              fontSize="16"
              fill="var(--text-1)"
              fontFamily="var(--font-body)"
              fontWeight="600"
            >
              {lens.roleTitle}
            </text>
            <text
              x={x + 12}
              y={y + 43}
              fontSize="15"
              fill="var(--text-4)"
              fontFamily="var(--font-mono)"
            >
              {`${lens.holderLabel ?? ""}. ${open ? "position open" : "position decided"}`}
            </text>
            {wrapUnits(lens.position, 46, 3).map((line, lineIndex) => (
              <text
                key={line}
                x={x + 12}
                y={y + 63 + lineIndex * 16}
                fontSize="15"
                fill="var(--text-2)"
                fontFamily="var(--font-body)"
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}

      {/* The hub: one matter, and the number of reports it would take today. */}
      <rect
        x={HUB_X}
        y="150"
        width={HUB_W}
        height="100"
        rx="4"
        fill="var(--accent-tint)"
        stroke="var(--accent)"
      />
      <text
        x={HUB_X + HUB_W / 2}
        y="178"
        textAnchor="middle"
        fontSize="16"
        fill="var(--text-1)"
        fontFamily="var(--font-body)"
        fontWeight="600"
      >
        One matter
      </text>
      {wrapUnits(view.matter.title, 34, 3).map((line, index) => (
        <text
          key={line}
          x={HUB_X + HUB_W / 2}
          y={198 + index * 16}
          textAnchor="middle"
          fontSize="15"
          fill="var(--text-2)"
          fontFamily="var(--font-body)"
        >
          {line}
        </text>
      ))}

      <line
        x1={HUB_X + HUB_W / 2}
        y1="250"
        x2={HUB_X + HUB_W / 2}
        y2="300"
        stroke="var(--accent)"
        strokeWidth="2.5"
        className="rv-draw"
        data-shown={step >= 0 ? "true" : "false"}
        pathLength={1}
        style={{ ["--rv-delay" as string]: "1200ms" }}
      />

      <rect
        x={HUB_X - 30}
        y="300"
        width={HUB_W + 60}
        height="66"
        rx="4"
        fill="var(--surface-2)"
        stroke="var(--border-strong)"
      />
      <text
        x={HUB_X + HUB_W / 2}
        y="324"
        textAnchor="middle"
        fontSize="16"
        fill="var(--text-1)"
        fontFamily="var(--font-mono)"
      >
        {(view.threadDecisionIds ?? []).join(", ")}
      </text>
      <text
        x={HUB_X + HUB_W / 2}
        y="346"
        textAnchor="middle"
        fontSize="15"
        fill="var(--text-4)"
        fontFamily="var(--font-body)"
      >
        {`One thread, in place of ${view.matter.duplicateReportCount ?? lenses.length} separate reports`}
      </text>

      <text
        x="700"
        y="410"
        textAnchor="middle"
        fontSize="15"
        fill="var(--human)"
        fontFamily="var(--font-body)"
      >
        Portfolio materiality is left for a person. No scene records one.
      </text>
    </svg>
  );
}


/** Position on an eight day strip starting 06.10.2026, from a date in prose. */
function timelinePosition(text: string): number | null {
  const match = /(\d{2})\.(\d{2})\.(\d{4})/.exec(text);
  if (match === null) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (Number.isNaN(day) || Number.isNaN(month) || month !== 10) return null;
  const timeMatch = /(\d{2}):(\d{2})/.exec(text);
  const hours = timeMatch === null ? 9 : Number(timeMatch[1]);
  const dayOffset = day - 6 + hours / 24;
  return Math.max(2, Math.min(96, (dayOffset / 8) * 100));
}

export function PortfolioThreadScene({
  content,
  scene,
  step,
  grid,
  lenses,
}: SceneRenderProps<PortfolioDecisionThreadContent> & {
  grid: SixLensGridContent;
  lenses: LensSwitcherContent;
}) {
  const [hideInferred, setHideInferred] = React.useState(false);
  const threadProps = React.useMemo(
    () => portfolioThreadProps(grid, content, lenses),
    [grid, content, lenses],
  );

  const papersAt = timelinePosition(content.constraint.papersClose);
  const reportAt = timelinePosition(content.constraint.supplierReportDue);
  const committeeAt = timelinePosition(content.constraint.committeeDate);

  const regulatory =
    scene.regulatoryNote !== undefined ? <RegulatoryLine scope={scene.regulatoryScope} /> : null;

  return (
    <StageLayers>
      {/* Pane one. Six readings, about to consolidate. */}
      <FitLayer
        shown={step <= 0}
        minScale={0.5}
        label="Six professional readings of one matter, consolidating into one thread"
      >
        <div className="stack stack-2">
          <div className="row row-3 row-wrap row-between">
            <span className="row row-3 row-wrap">
              <Chip tone="accent">
                {content.person}
              </Chip>
              <span className="story-body-dim">{content.roleLabel}</span>
              <Chip tone="cyan" glyph>
                {content.clockLabel}
              </Chip>
            </span>
            {regulatory}
          </div>
          <LensConsolidation view={threadProps} step={step} />
        </div>
      </FitLayer>

      {/* Pane two. Seven nodes, six links, four solid and two dashed. */}
      <FitLayer
        shown={step >= 1 && step <= 2}
        minScale={0.5}
        label="One causal thread of seven nodes, four evidenced links and two inferred"
      >
        <div className="stack stack-3">
          <div className="row row-3 row-wrap row-between">
            <span className="row row-4 row-wrap">
              <Metric metric={content.evidencedLinks} scale="sm" />
              <Metric metric={content.inferredLinks} scale="sm" />
            </span>
            <span className="row row-3 row-wrap">
              <button
                type="button"
                className="btn btn-sm"
                aria-pressed={hideInferred}
                onClick={() => setHideInferred(!hideInferred)}
              >
                {hideInferred ? "Show the two inferred links" : "Hide the two inferred links"}
              </button>
              {regulatory}
            </span>
          </div>

          {/* Drawn left to right at the same speed for every link. The
              inferred links are visibly weaker without being dismissed. */}
          <div className="thread-rail">
            {content.thread.map((node, index) => {
              const inferred = node.linkBasis === "inferred";
              const hidden = inferred && hideInferred;
              return (
                <div
                  key={node.objectRef}
                  className="thread-node rv rv-flat"
                  data-basis={node.linkBasis}
                  data-shown={step >= 1 && !hidden ? "true" : "false"}
                  style={{ ["--rv-delay" as string]: `${index * 620}ms` }}
                >
                  <span className="row row-2 row-wrap">
                    <span className="mono" style={{ color: "var(--text-4)" }}>
                      {node.order}
                    </span>
                    <Chip tone={inferred ? "amber" : "green"} glyph>
                      {inferred ? "Inferred" : "Evidenced"}
                    </Chip>
                  </span>
                  <span className="story-body clamp-4">{node.label}</span>
                  <span className="prov-chip clamp-2">{node.objectRef}</span>
                  {node.confirmationNeeded !== undefined ? (
                    <Reveal at={2} step={step} variant="flat" className="inference-limit clamp-5">
                      {`What would confirm it. ${node.confirmationNeeded}`}
                    </Reveal>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </FitLayer>

      {/* Pane three. The deadline, and why it is the problem. */}
      <FitLayer
        shown={step === 3}
        minScale={0.55}
        label="Committee readiness, with the fact arrival marker after the papers deadline"
      >
        <div className="stack stack-4">
          <div className="row row-3 row-wrap row-between">
            <span className="story-panel-title" style={{ margin: 0 }}>
              Committee readiness, 06.10.2026 to 14.10.2026
            </span>
            {regulatory}
          </div>

          <div className="readiness" style={{ height: 92 }}>
            {papersAt !== null ? (
              <>
                <span
                  className="readiness-mark"
                  data-kind="papers"
                  style={{ ["--at" as string]: `${papersAt}%` }}
                />
                <span
                  className="readiness-label"
                  style={{ ["--at" as string]: `${papersAt}%`, top: 6 }}
                >
                  {content.constraint.papersClose}
                </span>
              </>
            ) : null}
            {/* Lands last, after the papers deadline rule, which is the moment
                the constraint becomes visible rather than described. */}
            {reportAt !== null ? (
              <Reveal at={3} step={step} variant="flat" delay={900}>
                <span
                  className="readiness-mark"
                  data-kind="arrival"
                  style={{ ["--at" as string]: `${reportAt}%` }}
                />
                <span
                  className="readiness-label"
                  style={{ ["--at" as string]: `${reportAt}%`, top: 34, maxWidth: 180 }}
                >
                  {content.constraint.supplierReportDue}
                </span>
              </Reveal>
            ) : null}
            {committeeAt !== null ? (
              <>
                <span
                  className="readiness-mark"
                  data-kind="committee"
                  style={{ ["--at" as string]: `${committeeAt}%` }}
                />
                <span
                  className="readiness-label"
                  style={{ ["--at" as string]: `${committeeAt}%`, top: 66, maxWidth: 180 }}
                >
                  {content.constraint.committeeDate}
                </span>
              </>
            ) : null}
          </div>

          <div className="story-panel" data-tone="human">
            <PanelTitle>The problem, stated</PanelTitle>
            <p className="story-body" style={{ fontSize: "var(--text-md)" }}>
              {content.constraint.problem}
            </p>
          </div>
        </div>
      </FitLayer>

      {/* Pane four. The reframed question, and what she owns about her own
          machinery. */}
      <FitLayer
        shown={step >= 4}
        minScale={0.5}
        label="The recorded decision, the reframed committee question, and the framework defects owned here"
      >
        <div className="stack stack-3">
          <Reveal at={4} step={step} variant="flat" className="story-panel" data-tone="accent">
            <span className="row row-3 row-wrap">
              <ObjectId id={content.decision.id} />
              <Chip tone="cyan" glyph>
                {content.decision.timeLabel}
              </Chip>
            </span>
            <p className="story-body clamp-3" style={{ marginTop: "var(--space-2)" }}>
              {content.decision.statement}
            </p>
            <p className="committee-question" style={{ marginTop: "var(--space-3)" }}>
              {content.decision.committeeQuestion}
            </p>
            <p className="story-body-dim clamp-3" style={{ marginTop: "var(--space-2)" }}>
              {content.decision.whyItHolds}
            </p>
          </Reveal>

          <Reveal at={5} step={step} variant="flat" className="story-equal-pair">
            <div className="story-panel" data-tone="human">
              <RuleList
                items={content.frameworkDefectsOwnedHere}
                tone="human"
                label="Framework defects owned at this level"
              />
            </div>
            <div className="story-panel" data-tone="neutral">
              <PanelTitle>Today, the same 16:30</PanelTitle>
              <p className="story-body-dim clamp-5">{content.todayComparison}</p>
            </div>
          </Reveal>
        </div>
      </FitLayer>
    </StageLayers>
  );
}
