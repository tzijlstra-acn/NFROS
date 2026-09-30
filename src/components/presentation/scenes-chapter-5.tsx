"use client";

/**
 * Chapter V: Authority and adoption. Scenes 15 and 16.
 *
 * Scene 15 answers the governance question with a mechanism rather than a
 * reassurance, and the mechanism is made visible by dimming: when a band is
 * selected, the authority classes it can reach light and the classes above it
 * dim. Reach is bounded, and the boundary moves with the level. That is an
 * autonomy change altering the available actions, drawn rather than described.
 *
 * Scene 16 closes the loop by returning the converged object from scene 1.
 * The same object that opened as a promise closes as a request, and it is the
 * only repeated image in the deck.
 */

import * as React from "react";
import type {
  AuthorityLadderContent,
  CoverContent,
  PhaseRoadmapContent,
} from "@/scenario/data/story";
import { Chip } from "@/components/evidence/primitives";
import {
  FitLayer,
  Metric,
  PanelTitle,
  Reveal,
  RuleList,
  StageFit,
  StageLayers,
  SwapPane,
  SwapRegion,
  type SceneRenderProps,
} from "./parts";

/* ==========================================================================
   Scene 15. Autonomy is earned action by action.
   ========================================================================== */

export const AUTHORITY_LADDER_STEPS = 8;

/**
 * Every authority class the ladder can reach, in ascending order.
 *
 * Derived from the steps themselves rather than declared separately, so a
 * class cannot appear on the slide that no level reaches, and a level cannot
 * reach a class the slide does not show. That is the refusal the storyboard
 * records for this scene, enforced by construction.
 */
function allClasses(content: AuthorityLadderContent): string[] {
  const seen: string[] = [];
  for (const step of content.steps) {
    for (const authorityClass of step.reachableClasses) {
      if (!seen.includes(authorityClass)) seen.push(authorityClass);
    }
  }
  return seen;
}

export function AuthorityLadderScene({ content, step }: SceneRenderProps<AuthorityLadderContent>) {
  const classes = React.useMemo(() => allClasses(content), [content]);

  // Hand back is the sixth position and it renders as a rail rather than a
  // step, because it is available from every one of the other five.
  const bands = content.steps.filter((entry) => entry.id !== "hand-back-to-human");
  const handBack = content.steps.find((entry) => entry.id === "hand-back-to-human");

  // The reveal walks the ladder bottom to top. Selection defaults to the
  // highest band revealed so far, and a click overrides it until the step
  // moves, which is how a presenter answers "and if we only allowed the first
  // two".
  const revealed = Math.min(bands.length, Math.max(1, step + 1));
  const [override, setOverride] = React.useState<number | null>(null);
  React.useEffect(() => {
    setOverride(null);
  }, [step]);
  const selectedOrder = override ?? revealed;
  const selected = bands.find((band) => band.order === selectedOrder) ?? bands[0];
  const reachable = new Set(selected?.reachableClasses ?? []);

  return (
    <StageFit size="full" minScale={0.55}>
      <div className="stack stack-3">
        <div className="row row-3 row-wrap row-between">
          <span className="row row-3 row-wrap">
            <span className="story-panel-title" style={{ margin: 0 }}>
              Authority classes reachable at the selected level
            </span>
            {classes.map((authorityClass) => (
              <span
                className="class-chip"
                key={authorityClass}
                data-reachable={reachable.has(authorityClass) ? "true" : "false"}
              >
                {authorityClass}
              </span>
            ))}
          </span>
          <Chip tone="amber" glyph>
            {selected === undefined ? "Level" : `Level ${selected.order}. ${selected.label}`}
          </Chip>
        </div>

        <div className="ladder">
          {/* The hand back rail, drawn last and across all five bands. */}
          <Reveal at={5} step={step} variant="flat" className="ladder-rail">
            <span className="ladder-rail-text">
              {handBack === undefined
                ? "Hand back to human"
                : `${handBack.label}. Available from every level.`}
            </span>
          </Reveal>

          <div className="ladder-bands">
            {bands.map((band) => (
              <button
                type="button"
                key={band.id}
                className="ladder-band"
                data-shown={step >= band.order - 1 ? "true" : "false"}
                data-selected={band.order === selectedOrder}
                data-focus={band.order === selectedOrder ? "on" : "off"}
                aria-pressed={band.order === selectedOrder}
                aria-label={`Select autonomy level ${band.order}, ${band.label}`}
                onClick={() => setOverride(band.order)}
                style={{
                  opacity: step >= band.order - 1 ? undefined : 0,
                  ["--rv-delay" as string]: `${(band.order - 1) * 520}ms`,
                }}
              >
                <span className="stack stack-1">
                  <span className="row row-2 row-baseline">
                    <span className="mono" style={{ color: "var(--text-4)" }}>
                      {band.order}
                    </span>
                    <span className="lane-label clamp-1">{band.label}</span>
                  </span>
                  <span className="story-body-dim clamp-1">{band.labelDe}</span>
                </span>
                <span className="stack stack-1">
                  <PanelTitle>Permits</PanelTitle>
                  <span className="lane-col-body clamp-2">{band.permits}</span>
                </span>
                <span className="stack stack-1 focus-detail">
                  <PanelTitle>Withholds</PanelTitle>
                  <span className="lane-col-body clamp-3" style={{ color: "var(--human)" }}>
                    {band.withholds}
                  </span>
                </span>
                <span className="stack stack-1">
                  <span className="focus-detail stack stack-1">
                    <PanelTitle>On 06.10.2026</PanelTitle>
                    <span className="lane-col-body clamp-3">{band.scenarioExample}</span>
                  </span>
                  {/* Reach is bounded, and the boundary moves with the level.
                      Dimming is the mechanism made visible. */}
                  <span className="row row-2 row-wrap" style={{ marginTop: 4 }}>
                    {band.reachableClasses.map((authorityClass) => (
                      <span
                        className="class-chip"
                        key={authorityClass}
                        data-reachable={
                          band.order === selectedOrder && reachable.has(authorityClass)
                            ? "true"
                            : "false"
                        }
                      >
                        {authorityClass}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <SwapRegion height="54cqh">
            <SwapPane shown={step < 6} label="Hand back to human, the sixth position">
              {handBack === undefined ? null : (
                <div className="story-panel" data-tone="human">
                  <PanelTitle>{`${handBack.label}. ${handBack.labelDe}`}</PanelTitle>
                  <p className="story-body clamp-4">{handBack.permits}</p>
                  <p className="story-body clamp-3" style={{ color: "var(--human)" }}>
                    {handBack.withholds}
                  </p>
                  <p className="story-body-dim clamp-4" style={{ marginTop: "var(--space-2)" }}>
                    {handBack.scenarioExample}
                  </p>
                </div>
              )}
              <div className="story-panel" data-tone="neutral">
                <PanelTitle>How a level is reached</PanelTitle>
                <p className="story-body clamp-4">{content.earnedNote}</p>
              </div>
            </SwapPane>

            <SwapPane shown={step === 6} label="Conditions that hold at every level">
              <div className="story-panel" data-tone="ai" style={{ minHeight: 0, overflow: "clip" }}>
                <RuleList
                  items={content.invariants}
                  tone="ai"
                  label="Conditions that hold at every level, including the most permissive"
                />
              </div>
            </SwapPane>

            {/* Refused by design, so the refusal is explicit and testable
                rather than assumed. Each item takes a strike. */}
            <SwapPane shown={step >= 7} label="Actions refused by design">
              <div className="story-panel" data-tone="risk">
                <PanelTitle>Refused by design</PanelTitle>
                <div className="stack stack-2">
                  {content.refusedByDesign.map((item, index) => (
                    <Reveal
                      at={7}
                      step={step}
                      variant="flat"
                      delay={index * 140}
                      key={item}
                      className="refused-item"
                    >
                      {item}
                    </Reveal>
                  ))}
                </div>
              </div>
            </SwapPane>
          </SwapRegion>
        </div>

        <Reveal at={6} step={step} variant="flat" className="prov-strip">
          <span className="story-panel-title" style={{ margin: 0 }}>
            {`Every write carries ${content.mandatoryWriteAttributes.length} attributes, or it is rejected`}
          </span>
          {content.mandatoryWriteAttributes.map((attribute) => (
            <span className="prov-chip" key={attribute}>
              {attribute}
            </span>
          ))}
        </Reveal>
      </div>
    </StageFit>
  );
}

/* ==========================================================================
   Scene 16. Prove one working day. Then scale the work environment.
   ========================================================================== */

export const PHASE_ROADMAP_STEPS = 8;

export function PhaseRoadmapScene({
  content,
  step,
  cover,
}: SceneRenderProps<PhaseRoadmapContent> & { cover: CoverContent }) {
  // From step 6 the phases recede and the cover object returns. The return is
  // the only repeated image in the deck, and repeating it closes the loop: the
  // same object that opened as a promise closes as a request.
  const closing = step >= 6;

  return (
    <StageLayers>
      <FitLayer shown={!closing} minScale={0.55} label="Six phases, the first two writing nothing">
        <div
          className="phase-rail"
          style={{ gridTemplateRows: "auto minmax(0, 1fr)", alignItems: "start" }}
        >
          {/* Drawn early, at the second step, because removing the largest
              objection early is worth more than saving it. */}
          <Reveal
            at={1}
            step={step}
            variant="flat"
            className="readonly-bracket"
            style={{ gridColumn: "1 / 3", gridRow: 1 }}
          >
            Phases one and two write nothing to any system of record
          </Reveal>

          {content.phases.map((phase) => (
            <div
              className="phase rv rv-flat"
              key={phase.phaseNumber}
              data-shown={step >= phase.phaseNumber - 1 ? "true" : "false"}
              style={{
                gridColumn: phase.phaseNumber,
                gridRow: 2,
                ["--rv-delay" as string]: `${(phase.phaseNumber - 1) * 480}ms`,
              }}
            >
              <span className="phase-number">{`Phase ${phase.phaseNumber}`}</span>
              <span className="phase-name clamp-2">{phase.name}</span>
              <span className="lane-col-body clamp-5">{phase.outcome}</span>
              <span className="stack stack-1">
                <PanelTitle>Proof point</PanelTitle>
                <span className="lane-col-body clamp-4" style={{ color: "var(--evidence)" }}>
                  {phase.proofPoint}
                </span>
              </span>
              <span className="stack stack-1">
                <PanelTitle>Prerequisite</PanelTitle>
                <span className="lane-col-body clamp-3">{phase.prerequisite}</span>
              </span>
              <span className="prov-strip">
                {phase.lanes.map((lane) => (
                  <span className="prov-chip" key={lane}>
                    {lane}
                  </span>
                ))}
              </span>
              {/* Duration is a client planning input. No phase shows a number,
                  because we do not have one. */}
              <Metric metric={phase.indicativeDuration} scale="sm" />
              <span className="lane-col-body clamp-4" style={{ color: "var(--human)" }}>
                {`Risk: ${phase.risk}`}
              </span>
            </div>
          ))}
        </div>
      </FitLayer>

      <FitLayer
        shown={closing}
        minScale={0.55}
        label="The converged decision object returning to carry the single ask"
      >
        <div className="stack stack-4">
          {/* The converged object from scene 1, returning to carry the ask. */}
          <Reveal at={6} step={step} variant="scale" className="story-panel" data-tone="accent">
            <PanelTitle>{cover.converged.objectLabel}</PanelTitle>
            <p className="closing-ask">{content.ask}</p>
            <div className="row row-3 row-wrap" style={{ marginTop: "var(--space-3)" }}>
              <Chip tone="amber" glyph>
                {cover.converged.owner}
              </Chip>
              <Chip tone="neutral">{cover.converged.authorityBasis}</Chip>
            </div>
          </Reveal>

          <Reveal at={6} step={step} variant="flat" className="story-equal-pair" delay={300}>
            <div className="story-panel" data-tone="evidence">
              <RuleList
                items={content.proofDefinition}
                tone="evidence"
                label="What one working day means concretely"
              />
            </div>
            <div className="story-panel" data-tone="human">
              <RuleList items={content.notClaimed} tone="human" label="What is not claimed" />
            </div>
          </Reveal>

          <Reveal at={7} step={step} variant="flat" className="story-body-dim">
            {cover.closingLine}
          </Reveal>
        </div>
      </FitLayer>
    </StageLayers>
  );
}
