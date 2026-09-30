"use client";

/**
 * Chapter I: Two mornings. Scenes 1, 2 and 3.
 *
 * The chapter's job is recognition, then relief. Scene 2 must be recognised as
 * the audience's own Tuesday, and scene 3 must turn it. So the motion in this
 * chapter carries two specific arguments and nothing else:
 *
 *   Scene 1   eight fragments travel to one converged decision object
 *   Scene 2   nothing connects to anything, and the reveal order is irregular
 *   Scene 3   the same eight notifications collapse into three decisions
 *
 * Scene 2 deliberately draws no line between any two cards. The absence of
 * connection is the content, and drawing it would both give away scene 3 and
 * imply the bank's systems already do it.
 */

import type {
  ClutterSignal,
  CoverContent,
  DecisionCardCollapseContent,
  SignalClutterContent,
} from "@/scenario/data/story";
import { Chip } from "@/components/evidence/primitives";
import {
  BackgroundRevealPanel,
  EvidenceRefs,
  Metric,
  MetricInline,
  PanelTitle,
  Reveal,
  RuleList,
  StageFit,
  SwapPane,
  SwapRegion,
  scatter,
  type SceneRenderProps,
} from "./parts";

/* ==========================================================================
   Scene 1. Live the NFR day.
   ========================================================================== */

export const COVER_STEPS = 4;

/**
 * Converged resting positions for the eight fragments, as percentages of the
 * stage. They form a loose ring around the centre card and they are fixed
 * values rather than a layout computation, because the composition is a
 * composed frame and not a chart.
 */
const COVER_SEATS: ReadonlyArray<{ left: number; top: number }> = [
  { left: 4, top: 6 },
  { left: 74, top: 4 },
  { left: 2, top: 38 },
  { left: 77, top: 34 },
  { left: 6, top: 70 },
  { left: 72, top: 68 },
  { left: 34, top: 2 },
  { left: 40, top: 84 },
];

export function CoverScene({ content, step }: SceneRenderProps<CoverContent>) {
  const converged = step >= 1;
  const alt = [
    `${content.fragments.length} signal fragments, each from a named source, converging on one decision object.`,
    `The object asks: ${content.converged.decisionQuestion}`,
    `Owner: ${content.converged.owner}. Authority basis: ${content.converged.authorityBasis}.`,
    `Stated unknown: ${content.converged.statedUnknown}`,
  ].join(" ");

  return (
    <StageFit size="full" minScale={0.6}>
      <div className="conv-field" style={{ height: "min(84cqh, 640px)" }}>
        <p className="scene-alt">{alt}</p>

        {content.fragments.map((fragment, index) => {
          const seat = COVER_SEATS[index % COVER_SEATS.length] ?? { left: 8, top: 8 };
          // The scatter is the offset the fragment travels in from, applied as
          // a transform on top of its converged seat. Deterministic, so the
          // export capture is reproducible frame for frame.
          const dx = scatter(index + 1, 150);
          const dy = scatter(index + 11, 96);
          return (
            <div
              key={fragment.label}
              className="conv-fragment"
              data-entered={step >= 0 ? "true" : "false"}
              data-converged={converged ? "true" : "false"}
              style={{
                left: `${seat.left}%`,
                top: `${seat.top}%`,
                ["--from-x" as string]: `${dx}px`,
                ["--from-y" as string]: `${dy}px`,
                ["--rv-delay" as string]: `${index * 110}ms`,
              }}
            >
              <span className="conv-fragment-label">{fragment.label}</span>
              <span className="conv-fragment-source">{fragment.source}</span>
              <span className="conv-fragment-source">{`Lands as: ${fragment.landsAs}`}</span>
            </div>
          );
        })}

        <Reveal at={2} step={step} variant="scale" className="conv-card">
          <PanelTitle>{content.converged.objectLabel}</PanelTitle>
          <p className="conv-question">{content.converged.decisionQuestion}</p>
          <div className="row row-3 row-wrap">
            <Chip tone="amber">
              {content.converged.owner}
            </Chip>
            <Chip tone="neutral">{content.converged.authorityBasis}</Chip>
          </div>
          <Reveal at={3} step={step} variant="fade" className="conv-unknown story-breath">
            {content.converged.statedUnknown}
          </Reveal>
        </Reveal>
      </div>

      <Reveal at={3} step={step} variant="flat" className="row row-4 row-wrap row-between">
        <span className="story-body-dim">{content.dateLine}</span>
        <span className="story-body-dim">{content.closingLine}</span>
      </Reveal>
    </StageFit>
  );
}

/* ==========================================================================
   Scene 2. The day begins by reconstructing the work.
   ========================================================================== */

export const CLUTTER_STEPS = 4;

/**
 * The reveal order, and it is not 1 to 8.
 *
 * A predictable reveal reads as organised. This morning is not organised, so
 * the eye is not allowed to predict where the next card lands. The order is
 * fixed rather than shuffled at runtime, because the export capture and the
 * rehearsal both have to be identical.
 */
const CLUTTER_ORDER = [4, 0, 7, 2, 6, 1, 5, 3];

/** The four cards that turn out to be one story told four times. */
const CLUTTER_LINKED = new Set(["sig-overdue", "sig-duplicate-evidence", "sig-dashboard", "sig-overnight"]);

const KIND_GLYPH: Record<ClutterSignal["kind"], string> = {
  "unread-mail": "mail",
  "calendar-conflict": "calendar",
  "overdue-grc-work": "overdue",
  "duplicate-evidence-request": "duplicate",
  "disconnected-dashboard": "dashboard",
  "status-request": "status",
  "upcoming-workshop": "workshop",
  "overnight-signal": "overnight",
};

const NUDGE = ["a", "c", "b", "a", "b", "a", "c", "b"] as const;

export function SignalClutterScene({ content, step }: SceneRenderProps<SignalClutterContent>) {
  const alt = [
    `${content.signals.length} unconnected signals across ${content.systemsOpened.length} systems, at ${content.clockLabel}.`,
    `No card connects to another. ${content.elapsedBeforeAnythingIsKnown.value} ${content.elapsedBeforeAnythingIsKnown.label}.`,
    `The connection none of these surfaces makes: ${content.hiddenConnection}`,
  ].join(" ");

  return (
    <StageFit size="full" minScale={0.55}>
      <p className="scene-alt">{alt}</p>

      <div className="stack stack-3">
        <Reveal at={0} step={step} variant="flat" className="row row-4 row-wrap row-between">
          <span className="row row-3 row-wrap">
            <Chip tone="cyan" glyph>
              {content.clockLabel}
            </Chip>
            <span className="story-body-dim">{content.placeLabel}</span>
          </span>
          <Reveal at={2} step={step} variant="flat">
            <Metric metric={content.elapsedBeforeAnythingIsKnown} scale="sm" />
          </Reveal>
        </Reveal>

        <div className="clutter-grid">
          {content.signals.map((signal, index) => {
            const order = CLUTTER_ORDER.indexOf(index);
            const linked = CLUTTER_LINKED.has(signal.id);
            return (
              <div
                key={signal.id}
                className="clutter-card rv"
                data-shown={step >= 1 ? "true" : "false"}
                data-linked={linked && step >= 3 ? "true" : "false"}
                data-nudge={NUDGE[index] ?? "a"}
                style={{
                  ["--rv-delay" as string]: `${Math.max(0, order) * 260}ms`,
                }}
              >
                <span className="clutter-label clamp-2">{signal.label}</span>
                <span className="row row-2 row-wrap">
                  <span className="clutter-kind">{KIND_GLYPH[signal.kind]}</span>
                  <span className="prov-chip clamp-1">{signal.source}</span>
                </span>
                <span className="clutter-detail clamp-2">{signal.detail}</span>
                {signal.metric !== undefined ? <MetricInline metric={signal.metric} /> : null}
                <span className="clutter-carried clamp-1">{signal.carriedBy}</span>
              </div>
            );
          })}
        </div>

        {/*
          Two beats in one region. What the assembly costs, itemised per
          signal, and then the connection none of these surfaces makes. They
          swap rather than stack, because the room is looking at one of them.
        */}
        {/*
          28 and not 24 percent of the stage. The itemised cost pane needs the
          extra four percent to state all eight items inside its own box at
          1366 by 768, and a region that is smaller than the pane it holds
          does not swap, it truncates.
        */}
        <SwapRegion height="28cqh">
          <SwapPane
            shown={step < 3}
            label="What handling each signal costs, and the systems opened to do it"
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)",
                gap: "var(--space-3)",
                alignItems: "start",
              }}
            >
              <div className="story-panel" data-tone="neutral">
                <PanelTitle>
                  What handling each of these costs, and none of it is professional output
                </PanelTitle>
                {/*
                  Two columns, because eight stacked rows are two and a half
                  times the height this region declares and the tail of the
                  list was being clipped off the bottom of the stage. Paired
                  columns halve the height without shrinking the type.
                */}
                <div className="clutter-cost-list">
                  {content.signals.map((signal, index) => (
                    <Reveal
                      at={2}
                      step={step}
                      variant="flat"
                      delay={index * 110}
                      key={`cost-${signal.id}`}
                      className="row row-2 row-wrap row-baseline"
                    >
                      <span className="prov-chip">{KIND_GLYPH[signal.kind]}</span>
                      <span className="story-body-dim clamp-1">{signal.costOfHandling}</span>
                    </Reveal>
                  ))}
                </div>
              </div>

              <Reveal at={2} step={step} variant="flat" className="prov-strip" style={{ alignSelf: "start" }}>
                <span className="story-panel-title" style={{ margin: 0 }}>
                  {`${content.systemsOpened.length} systems opened before anything is known`}
                </span>
                {content.systemsOpened.map((system) => (
                  <span className="prov-chip" key={system}>
                    {system}
                  </span>
                ))}
              </Reveal>
            </div>
          </SwapPane>

          <SwapPane shown={step >= 3} label="The connection no surface in the bank draws">
            <div className="clutter-connection">
              <PanelTitle>The connection no surface in the bank draws</PanelTitle>
              <span style={{ fontSize: "var(--text-md)", lineHeight: 1.45 }}>
                {content.hiddenConnection}
              </span>
            </div>
          </SwapPane>
        </SwapRegion>
      </div>
    </StageFit>
  );
}

/* ==========================================================================
   Scene 3. The future starts with decisions, not notifications.
   ========================================================================== */

export const DECISION_COLLAPSE_STEPS = 7;

/**
 * Scene 3 receives the eight signals from scene 2, so the audience can see
 * that nothing new arrived between 07:42 and 07:45. The deck supplies them,
 * because they belong to scene 2 and the story type for scene 3 does not
 * carry them.
 *
 * The three cards stay on screen throughout, so the audience keeps the whole
 * morning. One card carries its detail at a time, which is what the presenter
 * notes ask for: read one card in full, including the not known block.
 */
export function DecisionCardCollapseScene({
  content,
  step,
  backgroundOpen,
  priorSignals,
}: SceneRenderProps<DecisionCardCollapseContent> & {
  priorSignals: readonly ClutterSignal[];
}) {
  const collapsed = step >= 1;
  // Steps 1 to 3 open card 1, 2 and 3 in turn. Card 1 additionally splits its
  // two lists across two steps, which is where the pause lives.
  const focused = step <= 1 ? 0 : Math.min(content.cards.length - 1, step - 1);
  const alt = [
    `${content.cards.length} decisions for ${content.person}, ${content.roleLabel}, at ${content.clockLabel}.`,
    "Each carries what is known, what is not known, an owner, an authority basis and a destination record.",
    content.readOnlyStatement,
  ].join(" ");

  return (
    <StageFit size="full" minScale={0.55}>
      <p className="scene-alt">{alt}</p>

      <div className="stack stack-3" style={{ position: "relative" }}>
        <div className="row row-3 row-wrap row-between">
          <span className="row row-3 row-wrap">
            <Chip tone="cyan" glyph>
              {content.clockLabel}
            </Chip>
            <span className="strong-text">{content.person}</span>
            <span className="story-body-dim clamp-1">{content.roleLabel}</span>
          </span>
          <Reveal at={5} step={step} variant="flat" className="read-only-badge">
            <span aria-hidden="true">{"○"}</span>
            Read only. This brief writes nothing.
          </Reveal>
        </div>

        <Reveal at={1} step={step} variant="flat" className="decision-row">
          {content.cards.map((card, cardIndex) => {
            const open = cardIndex === focused;
            return (
              <div
                className="decision-card"
                key={card.id}
                data-focus={open ? "on" : "off"}
                aria-current={open ? "true" : undefined}
              >
                <p className="decision-question clamp-3">{card.question}</p>

                <div className="focus-detail stack stack-3" style={{ minWidth: 0 }}>
                  {/*
                    The two lists arrive on two different reveal steps for the
                    first card. The pause between them is the most important
                    piece of timing in the deck: it stops the scene reading as
                    a confidence display and makes the limitation feel like
                    part of the product rather than a disclaimer. A step
                    rather than a delay, so the presenter can hold it for as
                    long as the room needs.
                  */}
                  <Reveal at={cardIndex === 0 ? 1 : 0} step={step} variant="flat">
                    <RuleList items={card.whatIsKnown} tone="evidence" label="What is known" />
                  </Reveal>
                  <Reveal at={cardIndex === 0 ? 2 : 0} step={step} variant="flat">
                    <RuleList
                      items={card.whatIsNotKnown}
                      tone="human"
                      label="What is not known"
                    />
                  </Reveal>
                </div>

                <div className="decision-foot">
                  <span className="row row-2 row-wrap">
                    <Chip tone="amber" glyph>
                      {card.owner}
                    </Chip>
                    <Chip tone={card.reversible ? "green" : "red"}>
                      {card.reversible ? "Reversible" : "Not reversible"}
                    </Chip>
                  </span>
                  <span className="focus-detail story-body-dim clamp-1">{card.authorityBasis}</span>
                  <span className="focus-detail story-body-dim clamp-2">{card.destination}</span>
                  <span className="focus-detail">
                    <EvidenceRefs refs={card.evidenceRefs} />
                  </span>
                </div>
              </div>
            );
          })}
        </Reveal>

        {/*
          The collapse. The chips are laid out in the strip that is their
          destination, and offset back out to where they were scattered on the
          previous scene. At step 0 they sit over the card area; from step 1
          they are provenance, in one row, and nothing new has arrived.
        */}
        <SwapRegion height="31cqh">
          <SwapPane shown={step < 5} label="The same eight surfaces, now provenance">
            <div className="prov-strip" style={{ position: "relative", minHeight: 30 }}>
              <span className="story-panel-title" style={{ margin: 0 }}>
                The same eight surfaces, now provenance. Nothing new has arrived.
              </span>
              {priorSignals.map((signal, index) => (
                <span
                  key={signal.id}
                  className="prov-chip collapse-chip"
                  data-collapsed={collapsed ? "true" : "false"}
                  title={`${signal.label}. ${signal.source}`}
                  style={{
                    ["--sx" as string]: `${scatter(index + 3, 420)}px`,
                    ["--sy" as string]: `${scatter(index + 17, 150) - 210}px`,
                    ["--rv-delay" as string]: `${index * 70}ms`,
                  }}
                >
                  {signal.label}
                </span>
              ))}
            </div>
          </SwapPane>

          <SwapPane shown={step >= 5} label="What the brief withholds, and the background work">
            <div
              className="grid"
              style={{
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "var(--space-3)",
                alignItems: "start",
              }}
            >
              <Reveal at={5} step={step} variant="flat" className="story-panel" data-tone="human">
                <PanelTitle>Withheld on purpose</PanelTitle>
                <ul className="story-rule-list" data-tone="human">
                  {content.withheld.map((item) => (
                    <li className="clamp-2" key={item}>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="story-body-dim clamp-3" style={{ marginTop: "var(--space-2)" }}>
                  {content.readOnlyStatement}
                </p>
              </Reveal>

              <BackgroundRevealPanel
                reveal={content.backgroundReveal}
                open={backgroundOpen}
                step={step}
                at={6}
              />
            </div>
          </SwapPane>
        </SwapRegion>
      </div>
    </StageFit>
  );
}
