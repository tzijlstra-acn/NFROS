"use client";

/**
 * Chapter III: One professional day. Scenes 6 to 11.
 *
 * This is eleven minutes of the thirty and it is the chapter the audience
 * should want. The emotional peak is scene 11, not scene 12, so the motion
 * budget is spent here on four things and nothing else:
 *
 *   Scene 7    the chain drawn outward, then the encoding changed in place
 *   Scene 8    node positions held while labels and edges change meaning
 *   Scene 9    a trail that pauses as it crosses the appetite line, and
 *              evidence beams from a contested conclusion to its sources
 *   Scene 11   a human rating decision changing downstream objects, and a
 *              node that refuses to move when evidence arrives
 *
 * Composition note that applies to the whole chapter. Panels are swapped in
 * place rather than stacked down the stage. Stacking is what forces a stage
 * to scale its content down, and a scaled composition makes every word on the
 * slide smaller to accommodate one dense panel. Swapping is also better
 * presentation: the room looks at one thing, and the transition says that the
 * second panel is what the first one resolves into.
 */

import * as React from "react";
import type {
  ChangeSinceLastCycleContent,
  DecisionQueueContent,
  DualPositionMatrixContent,
  LensSwitcherContent,
  RoleMorphTransitionContent,
  SupplierExposureGraphContent,
  WorkshopTableContent,
} from "@/scenario/data/story";
import { Chip, ObjectId } from "@/components/evidence/primitives";
import { SupplierConstellation } from "@/components/visualisations/SupplierConstellation";
import { RiskControlGraph } from "@/components/visualisations/RiskControlGraph";
import {
  BackgroundRevealPanel,
  EvidenceRefs,
  FitBox,
  FactClassChip,
  Metric,
  PanelTitle,
  RegulatoryLine,
  Reveal,
  RuleList,
  StageFit,
  SwapPane,
  SwapRegion,
  type SceneRenderProps,
} from "./parts";
import { constellationProps, riskControlProps } from "./hero-adapters";
import { Grid5 } from "./Grid5";

/* ==========================================================================
   Scene 6. The TPRM manager opens three decisions, not five systems.
   ========================================================================== */

export const DECISION_QUEUE_STEPS = 7;

export function DecisionQueueScene({
  content,
  scene,
  step,
  backgroundOpen,
}: SceneRenderProps<DecisionQueueContent>) {
  const alt = [
    `${content.decisions.length} decisions for ${content.person}, ${content.roleLabel}, at ${content.clockLabel}.`,
    "Each carries a prepared position, its limitation and a deadline.",
    `${content.systemsNotOpened.length} systems are not opened: ${content.systemsNotOpened.join("; ")}.`,
  ].join(" ");

  // Steps 1 to 3 open the three decisions in turn.
  const focused = step <= 1 ? 0 : Math.min(content.decisions.length - 1, step - 1);

  return (
    <StageFit size="full" minScale={0.55}>
      <p className="scene-alt">{alt}</p>

      <div className="stack stack-3">
        <Reveal at={0} step={step} variant="flat" className="row row-3 row-wrap row-between">
          <span className="row row-3 row-wrap">
            <Chip tone="cyan" glyph>
              {content.clockLabel}
            </Chip>
            <span className="strong-text">{content.person}</span>
            <span className="story-body-dim clamp-1">{content.roleLabel}</span>
          </span>
          {scene.regulatoryNote !== undefined ? (
            <RegulatoryLine scope={scene.regulatoryScope} />
          ) : null}
        </Reveal>

        {/* All three stay on screen, because the claim is that he opens three
            decisions rather than five systems. One carries its detail at a
            time, because that is the one the presenter is reading. */}
        <div className="queue-list">
          {content.decisions.map((decision, index) => {
            const open = index === focused;
            return (
              <Reveal
                at={1}
                step={step}
                variant="flat"
                delay={index * 380}
                key={decision.id}
                className="queue-row"
              >
                <div className="stack stack-2" data-focus={open ? "on" : "off"}>
                  <p className="queue-headline clamp-3">{decision.headline}</p>
                  <span className="focus-detail">
                    <EvidenceRefs refs={decision.evidenceRefs} />
                  </span>
                </div>

                <div className="stack stack-2" data-focus={open ? "on" : "off"}>
                  <div className="focus-detail stack stack-1">
                    <PanelTitle>Prepared position</PanelTitle>
                    <p className="story-body clamp-4">{decision.preparedPosition}</p>
                  </div>
                  <div className="focus-detail stack stack-1">
                    <PanelTitle>Limitation</PanelTitle>
                    <p className="story-body clamp-3" style={{ color: "var(--human)" }}>
                      {decision.limitation}
                    </p>
                  </div>
                </div>

                <div className="stack stack-2" data-focus={open ? "on" : "off"}>
                  <div className="stack stack-1">
                    <Chip tone="red" glyph>
                      Deadline
                    </Chip>
                    <span className="story-body clamp-3">{decision.deadline}</span>
                  </div>
                  {decision.blockedBy !== undefined ? (
                    <div className="focus-detail stack stack-1">
                      <Chip tone="pink" glyph>
                        Blocked by
                      </Chip>
                      <span className="story-body-dim clamp-3">{decision.blockedBy}</span>
                    </div>
                  ) : null}
                  {decision.blocking !== undefined ? (
                    <div className="stack stack-1">
                      <Chip tone="pink" glyph>
                        Blocking
                      </Chip>
                      <span className="story-body-dim clamp-2">{decision.blocking}</span>
                      {/*
                        A connector that leaves the frame. The dependency is on
                        a person who is not in this view, and an edge that
                        exits the composition says that better than a sentence
                        does.
                      */}
                      <svg
                        viewBox="0 0 120 12"
                        style={{ width: 120, height: 12 }}
                        aria-hidden="true"
                        className="focus-detail"
                      >
                        <line
                          x1="0"
                          y1="6"
                          x2="112"
                          y2="6"
                          stroke="var(--gap)"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                          className="rv-draw"
                          data-shown={step >= 1 ? "true" : "false"}
                          pathLength={1}
                        />
                        <polygon points="112,2 120,6 112,10" fill="var(--gap)" />
                      </svg>
                    </div>
                  ) : null}
                </div>
              </Reveal>
            );
          })}
        </div>

        <SwapRegion height="26cqh">
          <SwapPane shown={step < 4} label="Systems no longer opened">
            <div className="prov-strip">
              <span className="story-panel-title" style={{ margin: 0 }}>
                {`${content.systemsNotOpened.length} systems he does not open`}
              </span>
              {content.systemsNotOpened.map((system, index) => (
                <span
                  key={system}
                  className="story-struck"
                  data-shown={step >= 3 ? "true" : "false"}
                  style={{ ["--rv-delay" as string]: `${index * 180}ms` }}
                >
                  {system}
                </span>
              ))}
            </div>
          </SwapPane>

          <SwapPane shown={step === 4} label="Today, the same morning">
            <div className="story-panel" data-tone="neutral">
              <PanelTitle>Today, the same morning</PanelTitle>
              <p className="story-body" style={{ fontSize: "var(--text-md)" }}>
                {content.todayComparison}
              </p>
            </div>
          </SwapPane>

          <SwapPane shown={step >= 5} label="Work completed in the background before this moment">
            <BackgroundRevealPanel
              reveal={content.backgroundReveal}
              open={backgroundOpen}
              step={step}
              at={5}
            />
          </SwapPane>
        </SwapRegion>
      </div>
    </StageFit>
  );
}

/* ==========================================================================
   Scene 7. AI prepares the risk position. The professional challenges.
   ========================================================================== */

export const SUPPLIER_GRAPH_STEPS = 5;

export function SupplierExposureScene({
  content,
  scene,
  step,
}: SceneRenderProps<SupplierExposureGraphContent>) {
  const props = React.useMemo(() => constellationProps(content), [content]);
  const divergent = content.nodes.filter((node) => node.divergence !== undefined);

  return (
    <StageFit size="full" minScale={0.55}>
      <div className="stack stack-2">
        {/* The supplier identity and its recorded criticality are carried by
            the hero's own caption, so the header adds only what that caption
            does not: the charge with its basis, and the meeting this hour
            prepares. */}
        <Reveal at={0} step={step} variant="flat" className="row row-4 row-wrap row-between">
          <Metric metric={content.annualSpend} scale="sm" />
          <span className="story-body-dim clamp-1" style={{ maxWidth: "64ch" }}>
            {content.meetingLabel}
          </span>
          {scene.regulatoryNote !== undefined ? (
            <RegulatoryLine scope={scene.regulatoryScope} />
          ) : null}
        </Reveal>

        <div
          className="grid"
          style={{
            gridTemplateColumns: "minmax(0, 1.08fr) minmax(0, 1fr)",
            gap: "var(--space-4)",
            alignItems: "start",
          }}
        >
          {/* The chain, drawn outward from the centre. Dependency depth is
              discovered rather than designed, so the draw starts at the
              supplier and works out to the fourth party. */}
          <FitBox height="96cqh">
            <div
              className="story-hero rv-fade"
              data-shown={step >= 0 ? "true" : "false"}
              style={{ ["--hero-ar" as string]: "1.34" }}
            >
              <SupplierConstellation {...props} />
            </div>
          </FitBox>

          {/* One region, five panes. The graph never re-renders and never
              moves: only the reading beside it changes. */}
          <SwapRegion height="92cqh">
            <SwapPane shown={step <= 0} label="Concentration position">
              <div className="story-panel" data-tone="risk">
                <PanelTitle>Concentration</PanelTitle>
                <p className="story-body" style={{ fontSize: "var(--text-md)" }}>
                  {content.concentrationStatement}
                </p>
              </div>
            </SwapPane>

            {/* Phase two. The badges resolve, and the two divergent nodes are
                named with the fact that makes each a divergence rather than
                an opinion. */}
            <SwapPane shown={step === 1} label="Chain participants that do not reconcile">
              <div className="story-panel" data-tone="gap">
                <PanelTitle>
                  {`In the binding appendix, against the supplier current register. ${divergent.length} of ${content.nodes.length} do not reconcile.`}
                </PanelTitle>
                <ul className="story-rule-list" data-tone="risk">
                  {divergent.map((node, index) => (
                    <Reveal at={1} step={step} variant="flat" delay={index * 340} as="li" key={node.id}>
                      <b>{`${node.id} ${node.name}, ${node.jurisdiction}. `}</b>
                      {node.divergence}
                    </Reveal>
                  ))}
                </ul>
              </div>
            </SwapPane>

            {/* Phase three. The encoding changes and the geometry does not,
                which is what makes the two readings comparable. */}
            <SwapPane shown={step === 2} label="Asserted against observed, five pairs">
              <div className="story-panel" data-tone="data" style={{ minHeight: 0, overflow: "clip" }}>
                <PanelTitle>Asserted, against observed</PanelTitle>
                <div className="stack stack-2">
                  {content.assertionDeltas.map((delta, index) => (
                    <Reveal at={2} step={step} variant="flat" delay={index * 160} key={delta.subject}>
                      <span className="strong-text clamp-1" style={{ fontSize: "var(--text-sm)" }}>
                        {delta.subject}
                      </span>
                      <div className="delta-row">
                        <span className="delta-side" data-side="asserted">
                          <span className="story-body clamp-2">{delta.asserted}</span>
                        </span>
                        <span className="delta-side" data-side="observed">
                          <span className="story-body clamp-2">{delta.observed}</span>
                        </span>
                      </div>
                      <span className="story-body-dim clamp-2">{delta.significance}</span>
                    </Reveal>
                  ))}
                </div>
              </div>
            </SwapPane>

            {/* Phase four. The four asks, in negotiation order. */}
            <SwapPane shown={step === 3} label="The challenge sequence in negotiation order">
              <div className="story-panel" data-tone="ai">
                <PanelTitle>The challenge sequence, in the order it is put</PanelTitle>
                <div className="stack stack-2">
                  {content.challengeSequence.map((ask, index) => (
                    <Reveal
                      at={3}
                      step={step}
                      variant="left"
                      delay={index * 400}
                      key={ask.order}
                      className="challenge-ask"
                    >
                      <span className="challenge-order">{ask.order}</span>
                      <span className="stack stack-1">
                        <span className="story-body clamp-2">{ask.question}</span>
                        <Chip tone="green" glyph>
                          {ask.ask}
                        </Chip>
                        <span className="story-body-dim clamp-2">{ask.sequencingReason}</span>
                      </span>
                    </Reveal>
                  ))}
                </div>
              </div>
            </SwapPane>

            <SwapPane shown={step >= 4} label="The human judgment, and the uncertainty disclosed">
              <div className="story-panel" data-tone="human">
                <PanelTitle>The judgment that is his alone</PanelTitle>
                <p className="story-body">{content.humanChoice}</p>
              </div>
              <div className="story-panel" data-tone="neutral" style={{ minHeight: 0, overflow: "clip" }}>
                <PanelTitle>Uncertainty disclosed at the point of use</PanelTitle>
                <ul className="story-rule-list" data-tone="human">
                  {content.uncertaintyDisclosed.map((item) => (
                    <li className="clamp-4" key={item}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </SwapPane>
          </SwapRegion>
        </div>
      </div>
    </StageFit>
  );
}

/* ==========================================================================
   Scene 8. Switch the role. Keep the environment.
   ========================================================================== */

export const ROLE_MORPH_STEPS = 5;

/**
 * Fixed node seats for the morph.
 *
 * The seats are a constellation: one centre, four around it, one further out.
 * They do not change between the two states, and that is the whole scene. The
 * labels change, the edge set changes, the legend changes. The geometry is
 * what carries across, and the geometry is what the environment is.
 */
const MORPH_SEATS: ReadonlyArray<readonly [number, number]> = [
  [452, 212],
  [452, 56],
  [676, 132],
  [676, 292],
  [452, 368],
  [868, 66],
];

/** Edge pairs in the receiving role's reading, by seat index. */
const MORPH_RCSA_EDGES: ReadonlyArray<readonly [number, number]> = [
  [1, 2],
  [3, 2],
  [5, 2],
  [4, 2],
  [0, 3],
];

export function RoleMorphScene({
  content,
  step,
  matrix,
  workshop,
  cycle,
  lenses,
  supplier,
}: SceneRenderProps<RoleMorphTransitionContent> & {
  matrix: DualPositionMatrixContent;
  workshop: WorkshopTableContent;
  cycle: ChangeSinceLastCycleContent;
  lenses: LensSwitcherContent;
  supplier: SupplierExposureGraphContent;
}) {
  const graph = React.useMemo(
    () => riskControlProps(matrix, workshop, cycle, lenses),
    [matrix, workshop, cycle, lenses],
  );

  // The outgoing labels are the supplier chain's own nodes, in ring order, so
  // the morph starts from exactly what scene 7 left on screen.
  const fromLabels = React.useMemo(() => {
    const ordered = [...supplier.nodes].sort((a, b) => a.ring - b.ring || a.id.localeCompare(b.id));
    return ordered.map((node) => `${node.id} ${node.name}`);
  }, [supplier.nodes]);

  // The incoming labels are the receiving role's objects. The centre seat is
  // the shared object: a service under a contract to one role, and the system
  // dependency of a control to the other.
  const toLabels = React.useMemo(() => {
    const controls = graph.controls.map((control) => `${control.reference} ${control.title}`);
    const process = graph.processes[0];
    const risk = graph.risks[0];
    const indicator = (graph.indicators ?? [])[0];
    return [
      "SYS-0014 Repair workbench",
      process === undefined ? "Process" : `${process.code ?? process.id} ${process.label}`,
      risk === undefined ? "Risk" : `${risk.id} ${risk.label}`,
      controls[0] ?? "Key control",
      indicator === undefined ? "Indicator" : `${indicator.reference} ${indicator.name}`,
      controls[1] ?? "Detective control",
    ];
  }, [graph]);

  const morphed = step >= 1;
  const handedOver = step >= 2;

  return (
    <StageFit size="full" minScale={0.55}>
      <div className="stack stack-3">
        <div className="row row-3 row-wrap row-between">
          <span className="row row-3 row-wrap">
            <Chip tone={morphed ? "neutral" : "accent"} glyph>
              {`${content.fromRole.person}. ${content.fromRole.visual}`}
            </Chip>
            <span className="mono" aria-hidden="true" style={{ color: "var(--text-4)" }}>
              {"->"}
            </span>
            <Chip tone={morphed ? "accent" : "neutral"} glyph>
              {`${content.toRole.person}. ${content.toRole.visual}`}
            </Chip>
          </span>
          <span className="prov-chip">{content.auditNote}</span>
        </div>

        <div className="morph-stack" style={{ height: "min(56cqh, 470px)" }}>
          {/* The morph itself. One SVG, two states, positions held. */}
          <div
            className="morph-layer rv-fade"
            data-shown={handedOver ? "false" : "true"}
            aria-hidden={handedOver ? "true" : "false"}
          >
            <svg
              className="morph-svg"
              viewBox="0 0 1000 420"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={`The supplier chain reshaping into the process, risk and control graph. ${content.sharedObject}`}
            >
              {/* Outgoing edge set: the chain radiating from the supplier. */}
              <g className="rv-fade" data-shown={morphed ? "false" : "true"}>
                {MORPH_SEATS.map((seat, index) => {
                  if (index === 0) return null;
                  const centre = MORPH_SEATS[0];
                  const from = index === 5 ? MORPH_SEATS[3] : centre;
                  if (centre === undefined || from === undefined) return null;
                  return (
                    <line
                      key={`from-${index}`}
                      x1={from[0]}
                      y1={from[1]}
                      x2={seat[0]}
                      y2={seat[1]}
                      stroke="var(--cyan)"
                      strokeWidth={index === 5 ? 1 : 2}
                      strokeDasharray={index === 5 ? "4 4" : undefined}
                      className="rv-draw"
                      data-shown={step >= 0 ? "true" : "false"}
                      pathLength={1}
                      style={{ ["--rv-delay" as string]: `${index * 120}ms` }}
                    />
                  );
                })}
              </g>

              {/* Incoming edge set: process exposes risk, controls mitigate it,
                  the indicator reports on it, and the shared system is the
                  dependency of the key control. */}
              <g className="rv-fade" data-shown={morphed ? "true" : "false"}>
                {MORPH_RCSA_EDGES.map(([a, b], index) => {
                  const from = MORPH_SEATS[a];
                  const to = MORPH_SEATS[b];
                  if (from === undefined || to === undefined) return null;
                  return (
                    <line
                      key={`to-${a}-${b}`}
                      x1={from[0]}
                      y1={from[1]}
                      x2={to[0]}
                      y2={to[1]}
                      stroke={a === 0 ? "var(--accent)" : "var(--green)"}
                      strokeWidth="2"
                      className="rv-draw"
                      data-shown={morphed ? "true" : "false"}
                      pathLength={1}
                      style={{ ["--rv-delay" as string]: `${index * 140}ms` }}
                    />
                  );
                })}
              </g>

              {/* The nodes. One seat, two meanings. */}
              {MORPH_SEATS.map((seat, index) => {
                const from = fromLabels[index] ?? "";
                const to = toLabels[index] ?? "";
                return (
                  <g className="morph-node" key={`seat-${index}`}>
                    <rect
                      x={seat[0] - 96}
                      y={seat[1] - 20}
                      width="192"
                      height="40"
                      rx="4"
                      fill={index === 0 ? "var(--accent-tint)" : "var(--surface-2)"}
                      stroke={index === 0 ? "var(--accent)" : "var(--border-strong)"}
                    />
                    <g className="rv-fade" data-shown={morphed ? "false" : "true"}>
                      <text
                        x={seat[0]}
                        y={seat[1] + 5}
                        textAnchor="middle"
                        fontSize="14"
                        fill="var(--text-1)"
                        fontFamily="var(--font-mono)"
                      >
                        {from.length > 30 ? `${from.slice(0, 29)}...` : from}
                      </text>
                    </g>
                    <g className="rv-fade" data-shown={morphed ? "true" : "false"}>
                      <text
                        x={seat[0]}
                        y={seat[1] + 5}
                        textAnchor="middle"
                        fontSize="14"
                        fill="var(--text-1)"
                        fontFamily="var(--font-mono)"
                      >
                        {to.length > 30 ? `${to.slice(0, 29)}...` : to}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* The legend swaps with the meaning. */}
              <g className="rv-fade" data-shown={morphed ? "false" : "true"}>
                <text x="16" y="404" fontSize="14" fill="var(--cyan)" fontFamily="var(--font-mono)">
                  Legend: supplier, subprocessors, one fourth party
                </text>
              </g>
              <g className="rv-fade" data-shown={morphed ? "true" : "false"}>
                <text x="16" y="404" fontSize="14" fill="var(--green)" fontFamily="var(--font-mono)">
                  Legend: process exposes risk, control mitigates, indicator reports
                </text>
              </g>
            </svg>
          </div>

          {/* The destination view, properly laid out, once the morph lands. */}
          <div
            className="morph-layer rv-fade"
            data-shown={handedOver ? "true" : "false"}
            aria-hidden={handedOver ? "false" : "true"}
          >
            <FitBox height="100%">
              <div className="story-hero" style={{ ["--hero-ar" as string]: "2.4" }}>
                <RiskControlGraph {...graph} />
              </div>
            </FitBox>
          </div>
        </div>

        <div
          className="grid"
          style={{
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.9fr)",
            gap: "var(--space-3)",
            alignItems: "start",
          }}
        >
          <Reveal at={0} step={step} variant="left" className="story-panel" data-tone="evidence">
            <PanelTitle>Retained across the switch</PanelTitle>
            <ul className="story-rule-list" data-tone="evidence">
              {content.retained.map((item, index) => (
                <Reveal at={0} step={step} variant="flat" delay={index * 140} as="li" key={item}>
                  <span className="clamp-2">{item}</span>
                </Reveal>
              ))}
            </ul>
          </Reveal>

          {/*
            The changed column reveals only after the morph completes. That
            ordering is the argument in sequence: first what survives, then
            what moved.
          */}
          <Reveal at={3} step={step} variant="right" className="story-panel" data-tone="ai">
            <PanelTitle>Changed by the switch</PanelTitle>
            <ul className="story-rule-list" data-tone="ai">
              {content.changed.map((item, index) => (
                <Reveal at={3} step={step} variant="flat" delay={index * 140} as="li" key={item}>
                  <span className="clamp-2">{item}</span>
                </Reveal>
              ))}
            </ul>
          </Reveal>

          <Reveal at={4} step={step} variant="flat" className="story-panel" data-tone="accent">
            <PanelTitle>One object, two readings</PanelTitle>
            <p className="story-body clamp-5">{content.sharedObject}</p>
          </Reveal>
        </div>
      </div>
    </StageFit>
  );
}

/* ==========================================================================
   Scene 9. The RCSA starts with what changed.
   ========================================================================== */

export const CYCLE_CHANGE_STEPS = 6;

/**
 * Evidence beams.
 *
 * A contested conclusion, and the recorded changes it rests on, joined by
 * drawn beams rather than by a footnote. A verified fact draws a solid beam
 * and a telemetry inference draws a dashed one, so the audience can see at a
 * glance how much of the conclusion is recorded and how much is inferred.
 * Presenting the inferred beam as solid would be more persuasive and less
 * defensible.
 */
function EvidenceBeamPanel({
  changes,
  conclusion,
  shown,
}: {
  changes: ChangeSinceLastCycleContent["changes"];
  conclusion: string;
  shown: boolean;
}) {
  const width = 1000;
  const height = 168;
  const slot = width / Math.max(1, changes.length);
  const conclusionX = width / 2;
  const conclusionY = height - 24;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      /* Capped at its own viewBox width. Painted wider, the 15 unit labels
         scale past the boxes that hold them. */
      style={{ width: "min(100%, 1000px)", height: "auto", margin: "0 auto" }}
      role="img"
      aria-label={`${changes.length} recorded changes joined to one contested conclusion. ${changes.filter((change) => change.factClass === "TI").length} of the beams are telemetry inference and are drawn dashed.`}
    >
      {changes.map((change, index) => {
        const x = slot * index + slot / 2;
        const inferred = change.factClass === "TI";
        return (
          <g key={change.id}>
            <path
              className="beam rv-draw"
              data-kind={inferred ? "inferred" : "evidenced"}
              data-shown={shown ? "true" : "false"}
              d={`M ${x} 54 C ${x} ${conclusionY - 40}, ${conclusionX} ${conclusionY - 70}, ${conclusionX} ${conclusionY - 16}`}
              pathLength={1}
              style={{ ["--rv-delay" as string]: `${index * 150}ms` }}
            />
            <rect
              x={x - slot / 2 + 8}
              y="10"
              width={slot - 16}
              height="38"
              rx="3"
              fill="var(--surface-1)"
              stroke={inferred ? "var(--amber-edge)" : "var(--green-edge)"}
            />
            <text
              x={x}
              y="26"
              textAnchor="middle"
              fontSize="15"
              fill="var(--text-2)"
              fontFamily="var(--font-mono)"
            >
              {change.factClass}
            </text>
            <text
              x={x}
              y="42"
              textAnchor="middle"
              fontSize="14"
              fill="var(--text-4)"
              fontFamily="var(--font-mono)"
            >
              {change.evidenceRef.length > 21
                ? `${change.evidenceRef.slice(0, 20)}...`
                : change.evidenceRef}
            </text>
          </g>
        );
      })}

      <rect
        x={conclusionX - 250}
        y={conclusionY - 16}
        width="500"
        height="36"
        rx="3"
        fill="var(--amber-tint)"
        stroke="var(--amber-edge)"
      />
      <text
        x={conclusionX}
        y={conclusionY + 8}
        textAnchor="middle"
        fontSize="16"
        fill="var(--text-1)"
        fontFamily="var(--font-mono)"
      >
        {conclusion}
      </text>
    </svg>
  );
}

export function CycleChangeScene({
  content,
  step,
  matrix,
}: SceneRenderProps<ChangeSinceLastCycleContent> & { matrix: DualPositionMatrixContent }) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const unchangedRows = 10;

  return (
    <StageFit size="full" minScale={0.55}>
      <div className="stack stack-3">
        <div className="row row-3 row-wrap row-between">
          <span className="row row-3 row-wrap">
            <ObjectId id={content.assessmentId} />
            <span className="story-body-dim clamp-1">{content.assessmentLabel}</span>
          </span>
          <span className="row row-3 row-wrap">
            <Chip tone="neutral">{content.cycleLabel}</Chip>
            <Chip tone="accent">
              {content.facilitator}
            </Chip>
          </span>
        </div>

        <div
          className="grid"
          style={{
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.05fr)",
            gap: "var(--space-4)",
            alignItems: "start",
          }}
        >
          <div className="stack stack-2" style={{ minWidth: 0 }}>
            {/* Ten unchanged rows, revealed fast, because that is what they
                should cost the room: almost nothing. */}
            <div className="delta-list">
              {Array.from({ length: unchangedRows }).map((_, index) => (
                <span
                  className="delta-unchanged rv rv-flat"
                  key={`unchanged-${index}`}
                  data-shown={step >= 0 ? "true" : "false"}
                  style={{ ["--rv-delay" as string]: `${index * 90}ms` }}
                >
                  <span className="mono">No material change</span>
                  <span style={{ color: "var(--text-disabled)" }}>
                    Checked against its own drivers
                  </span>
                </span>
              ))}
            </div>
            <Reveal at={0} step={step} variant="flat" delay={unchangedRows * 90}>
              <Metric metric={content.unchangedCount} scale="sm" />
            </Reveal>
            <Reveal at={5} step={step} variant="flat" className="story-panel" data-tone="human">
              <PanelTitle>The cell the system leaves empty</PanelTitle>
              <p className="story-body clamp-4">{content.blankCellStatement}</p>
            </Reveal>
          </div>

          <div className="stack stack-2" style={{ minWidth: 0 }}>
            <div style={{ width: "min(100%, 62cqh)", margin: "0 auto" }}>
              <Grid5
                inherent={matrix.inherent}
                positions={matrix.positions}
                appetiteThreshold={matrix.appetiteBoundary.threshold}
                showGrid={step >= 2}
                showAppetite={step >= 2}
                trailSegments={step >= 3 ? matrix.positions.length : 0}
                showVectors={step >= 4}
              />
            </div>
            <Reveal at={2} step={step} variant="flat" className="story-body-dim clamp-2">
              {matrix.appetiteBoundary.policySentence}
            </Reveal>
          </div>
        </div>

        {/* One region, two panes: the five movements, then what the contested
            position rests on. */}
        <SwapRegion height="34cqh">
          <SwapPane shown={step < 5} label="The five recorded changes and their drivers">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${content.changes.length}, minmax(0, 1fr))`,
                gap: "var(--space-2)",
                alignItems: "start",
              }}
            >
              {content.changes.map((change, index) => (
                <Reveal
                  at={1}
                  step={step}
                  variant="rise"
                  delay={index * 320}
                  key={change.id}
                  className="change-entry"
                >
                  <button
                    type="button"
                    data-selected={selected === change.id}
                    aria-pressed={selected === change.id}
                    aria-label={`Open the driver object behind ${change.subject}`}
                    onClick={() => setSelected(selected === change.id ? null : change.id)}
                    style={{ background: "none", border: "none", padding: 0, textAlign: "left" }}
                  >
                    <span className="strong-text clamp-2" style={{ fontSize: "var(--text-sm)" }}>
                      {change.subject}
                    </span>
                  </button>
                  <div className="change-state">
                    <span className="clamp-2" style={{ color: "var(--text-4)" }}>
                      {change.previousState}
                    </span>
                    <span className="change-arrow" aria-hidden="true">
                      {"->"}
                    </span>
                    <span className="clamp-2" style={{ color: "var(--text-1)" }}>
                      {change.currentState}
                    </span>
                  </div>
                  <span className="story-body-dim clamp-3">{`Driver: ${change.driver}`}</span>
                  <FactClassChip factClass={change.factClass} />
                  {change.inferenceLimit !== undefined ? (
                    <span className="inference-limit clamp-3">{change.inferenceLimit}</span>
                  ) : null}
                </Reveal>
              ))}
            </div>
          </SwapPane>

          <SwapPane shown={step >= 5} label="What the contested position rests on">
            <div className="story-panel" data-tone="evidence">
              <PanelTitle>What the contested position rests on</PanelTitle>
              <EvidenceBeamPanel
                changes={content.changes}
                conclusion={`${matrix.riskId} residual: unagreed at 9 against 12`}
                shown={step >= 5}
              />
            </div>
            <p className="story-body-dim clamp-2">{content.todayComparison}</p>
          </SwapPane>
        </SwapRegion>
      </div>
    </StageFit>
  );
}

/* ==========================================================================
   Scene 10. The meeting is for judgment, not evidence exchange.
   ========================================================================== */

export const WORKSHOP_STEPS = 6;

export function WorkshopTableScene({ content, step }: SceneRenderProps<WorkshopTableContent>) {
  return (
    <StageFit size="full" minScale={0.55}>
      <div className="stack stack-3">
        <div className="row row-3 row-wrap row-between">
          <span className="row row-3 row-wrap">
            <ObjectId id={content.meetingLabel} />
            <Chip tone="cyan" glyph>
              {content.timeLabel}
            </Chip>
          </span>
          <span className="prov-strip">
            {content.attendees.map((attendee) => (
              <span className="prov-chip" key={attendee}>
                {attendee}
              </span>
            ))}
          </span>
        </div>

        {/* The four facts land flat. Flat is the semantic: settled, and no
            longer in play. */}
        <div className="table-plane">
          {content.establishedFacts.map((fact, index) => (
            <Reveal
              at={1}
              step={step}
              variant="scale"
              delay={index * 350}
              key={fact.evidenceRef + String(index)}
              className="fact-card"
            >
              <FactClassChip factClass={fact.factClass} />
              <span className="story-body clamp-4">{fact.statement}</span>
              <span className="prov-chip clamp-1">{fact.evidenceRef}</span>
            </Reveal>
          ))}
        </div>

        <Reveal at={2} step={step} variant="flat">
          <p className="contested-question">{content.contestedQuestion}</p>
        </Reveal>

        {/*
          Both columns rise at the same step, with no stagger and to the same
          height. A staggered rise would imply precedence, and an unequal
          height would pick a winner. The refusal is the composition.
        */}
        <div className="story-equal-pair">
          {content.positions.map((position) => (
            <Reveal
              at={3}
              step={step}
              variant="rise"
              delay={0}
              key={position.holder}
              className="position-column"
            >
              <div className="row row-2 row-wrap">
                <Chip tone={position.line === "1LoD" ? "cyan" : "accent"} glyph>
                  {position.line}
                </Chip>
                <span className="strong-text clamp-1" style={{ fontSize: "var(--text-sm)" }}>
                  {position.holder}
                </span>
                <Reveal at={4} step={step} variant="flat">
                  <span className="contradiction-flag">
                    <span aria-hidden="true">!</span>
                    Internally consistent, incompatible with the other column
                  </span>
                </Reveal>
              </div>
              <p className="story-body strong-text clamp-2">{position.position}</p>
              <RuleList
                items={position.reasoning}
                tone={position.line === "1LoD" ? "evidence" : "ai"}
                label="Reasoning, in its strongest form"
              />
            </Reveal>
          ))}
        </div>

        <SwapRegion height="19cqh">
          <SwapPane shown={step < 5} label="What the system states it cannot resolve">
            <Reveal at={4} step={step} variant="flat" className="cannot-resolve">
              <PanelTitle>What the system states it cannot resolve</PanelTitle>
              {content.systemCannotResolve}
            </Reveal>
          </SwapPane>

          <SwapPane shown={step >= 5} label="Today, the same workshop, and what the minute buys">
            <div className="story-equal-pair">
              <div className="story-panel" data-tone="neutral">
                <PanelTitle>Today, the same workshop</PanelTitle>
                <p className="story-body-dim clamp-4">{content.todayComparison}</p>
              </div>
              <div className="story-panel" data-tone="evidence">
                <PanelTitle>The minute, and what it buys</PanelTitle>
                <p className="story-body-dim clamp-4">{content.minutesNote}</p>
              </div>
            </div>
          </SwapPane>
        </SwapRegion>
      </div>
    </StageFit>
  );
}

/* ==========================================================================
   Scene 11. The human owns the rating.
   ========================================================================== */

export const DUAL_MATRIX_STEPS = 7;

export function DualPositionMatrixScene({
  content,
  step,
}: SceneRenderProps<DualPositionMatrixContent>) {
  // The bracket joins the two contested Q4 positions, which are the last two
  // in the list. It never joins a position to an average, because there is no
  // average for it to join.
  const bracket: readonly [number, number] | undefined =
    content.positions.length >= 3
      ? [content.positions.length - 2, content.positions.length - 1]
      : undefined;
  const outsidePosition = content.positions.find(
    (position) => position.appetitePosition === "outside-appetite",
  );
  const decided = step >= 5;

  return (
    <StageFit size="full" minScale={0.55}>
      <div className="stack stack-3">
        <div className="row row-3 row-wrap row-between">
          <span className="row row-3 row-wrap">
            <ObjectId id={content.riskId} label={content.riskLabel} />
            <span className="story-body-dim">{content.riskLabelDe}</span>
          </span>
          <Chip tone="amber" glyph>
            {content.appetiteBoundary.entityAuthority}
          </Chip>
        </div>

        <div
          className="grid"
          style={{
            gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr) minmax(0, 1fr)",
            gap: "var(--space-3)",
            alignItems: "start",
          }}
        >
          <div className="stack stack-2" style={{ minWidth: 0 }}>
            <div style={{ width: "min(100%, 56cqh)", margin: "0 auto" }}>
              <Grid5
                inherent={content.inherent}
                positions={content.positions}
                appetiteThreshold={content.appetiteBoundary.threshold}
                showGrid={step >= 0}
                showAppetite={step >= 2}
                trailSegments={step >= 0 ? content.positions.length : 0}
                showVectors={step >= 3}
                {...(bracket !== undefined ? { bracket } : {})}
                showBracket={step >= 1}
                supersededBy={
                  outsidePosition === undefined
                    ? undefined
                    : {
                        label: "Superseded at 16:41",
                        impact: outsidePosition.impact,
                        likelihood: outsidePosition.likelihood,
                      }
                }
                showSuperseded={step >= 6}
              />
            </div>
            <Reveal at={2} step={step} variant="flat" className="story-body-dim clamp-3">
              {`Appetite boundary at ${content.appetiteBoundary.threshold}. ${content.appetiteBoundary.policySentence}`}
            </Reveal>
          </div>

          {/*
            Two panels, side by side, of equal size. The equal sizing is the
            composition's whole claim: what the system did, and what it refused
            to do, are the same size on the slide because they are the same
            size in the argument.
          */}
          <Reveal at={3} step={step} variant="flat" className="story-panel" data-tone="ai">
            <PanelTitle>What the system prepared</PanelTitle>
            <ul className="story-rule-list" data-tone="ai">
              {content.systemPrepared.map((item, index) => (
                <Reveal at={3} step={step} variant="flat" delay={index * 140} as="li" key={item}>
                  <span className="clamp-3">{item}</span>
                </Reveal>
              ))}
            </ul>
          </Reveal>

          {/* The still moment. Nothing moves between the two panels, and that
              silence is what makes the refusal read as deliberate. */}
          <Reveal at={4} step={step} variant="flat" className="story-panel" data-tone="human">
            <PanelTitle>What the system declined to do</PanelTitle>
            <ul className="story-rule-list" data-tone="human">
              {content.systemDeclined.map((item, index) => (
                <Reveal at={4} step={step} variant="flat" delay={index * 140} as="li" key={item}>
                  <span className="clamp-3">{item}</span>
                </Reveal>
              ))}
            </ul>
          </Reveal>
        </div>

        {/*
          The human decision, and the downstream objects it changes. Before the
          decision they read as pending. The moment the rating decision is
          recorded they change state, which is decision consequence rendered as
          a state change rather than described as one.
        */}
        <SwapRegion height="27cqh">
          <SwapPane shown={step < 6} label="The recorded outcome and the objects it changes">
            <Reveal at={5} step={step} variant="flat" className="story-panel" data-tone="accent">
              <span className="row row-3 row-wrap">
                <ObjectId id={content.outcome.decisionId} />
                <Chip tone="cyan" glyph>
                  {content.outcome.timeLabel}
                </Chip>
                {content.outcome.signedBy.map((signatory) => (
                  <Chip tone="neutral" key={signatory}>
                    {signatory}
                  </Chip>
                ))}
              </span>
              <p className="story-body strong-text clamp-3" style={{ marginTop: "var(--space-2)" }}>
                {content.outcome.statement}
              </p>
              <div className="row row-2 row-wrap" style={{ marginTop: "var(--space-2)" }}>
                <span className="story-panel-title" style={{ margin: 0 }}>
                  Downstream objects changed by this decision
                </span>
                {[
                  outsidePosition?.consequence ?? "Consequence of the outside appetite position",
                  content.appetiteBoundary.entityAuthority,
                  "Escalated to the Group Non-Financial Risk Committee",
                ].map((label, index) => (
                  <Chip tone={decided ? "amber" : "neutral"} glyph key={label} title={label}>
                    {`${index + 1}. ${label}`}
                  </Chip>
                ))}
              </div>
            </Reveal>
          </SwapPane>

          <SwapPane shown={step >= 6} label="Supersession with history, and the audit record">
            <div
              className="grid"
              style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "var(--space-3)" }}
            >
              <div className="story-panel" data-tone="data">
                <PanelTitle>Supersession, with history</PanelTitle>
                <p className="story-body clamp-5">
                  {content.outcome.supersedes ??
                    "No later record supersedes this decision in this scenario."}
                </p>
              </div>
              <div className="story-panel" data-tone="evidence">
                <RuleList
                  items={content.recordedAttributes}
                  tone="evidence"
                  label="Written to the audit trail with this decision"
                />
              </div>
            </div>
          </SwapPane>
        </SwapRegion>
      </div>
    </StageFit>
  );
}
