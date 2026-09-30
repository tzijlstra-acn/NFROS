"use client";

/**
 * The scene frame and the visual router.
 *
 * The frame is layers one to three of the geometry contract carried from
 * docs/handoffs/source-visual-findings.md: a 100dvh section, a centred inner
 * measure, and a three row grid of header, stage and footer where the middle
 * row is minmax(0, 1fr). Layer four, the stage, belongs to the visual, which
 * renders it through StageFit or StageLayers. That split is deliberate: a
 * visual that needs two cross faded compositions still owns exactly one
 * stage, so the no overflow guarantee holds for every scene without the frame
 * needing to know which kind of visual it is showing.
 *
 * The router switches on `visualKind`, which narrows `content` to the payload
 * that kind consumes. The switch is exhaustive against the sixteen kinds in
 * the story contract, so adding a kind there is a compile error here rather
 * than a blank stage in front of an audience.
 */

import * as React from "react";
import type { StoryChapter, StoryScene, VisualKind } from "@/scenario/data/story";
import { Chip, SyntheticLabel } from "@/components/evidence/primitives";
import { SceneBoundary, StaticSceneFallback } from "./parts";
import {
  CoverScene,
  DecisionCardCollapseScene,
  SignalClutterScene,
  CLUTTER_STEPS,
  COVER_STEPS,
  DECISION_COLLAPSE_STEPS,
} from "./scenes-chapter-1";
import {
  LensSwitcherScene,
  WorkLaneLadderScene,
  LANE_LADDER_STEPS,
  LENS_STEPS,
} from "./scenes-chapter-2";
import {
  CycleChangeScene,
  DecisionQueueScene,
  DualPositionMatrixScene,
  RoleMorphScene,
  SupplierExposureScene,
  WorkshopTableScene,
  CYCLE_CHANGE_STEPS,
  DECISION_QUEUE_STEPS,
  DUAL_MATRIX_STEPS,
  ROLE_MORPH_STEPS,
  SUPPLIER_GRAPH_STEPS,
  WORKSHOP_STEPS,
} from "./scenes-chapter-3";
import {
  EventFanOutScene,
  PortfolioThreadScene,
  SixLensGridScene,
  EVENT_FAN_OUT_STEPS,
  PORTFOLIO_THREAD_STEPS,
  SIX_LENS_STEPS,
} from "./scenes-chapter-4";
import {
  AuthorityLadderScene,
  PhaseRoadmapScene,
  AUTHORITY_LADDER_STEPS,
  PHASE_ROADMAP_STEPS,
} from "./scenes-chapter-5";

/* ==========================================================================
   Reveal step counts and chrome, per visual kind
   ========================================================================== */

/**
 * How many reveal steps each visual declares.
 *
 * The deck uses these for the auto reveal, for the progress indicator and for
 * the presenter safe jump to the final state. A visual and its step count are
 * therefore never out of sync, because the count is exported from the same
 * module as the component that consumes it.
 */
export const STEP_COUNTS: Record<VisualKind, number> = {
  "convergence-hero": COVER_STEPS,
  "signal-clutter-board": CLUTTER_STEPS,
  "decision-card-collapse": DECISION_COLLAPSE_STEPS,
  "work-lane-ladder": LANE_LADDER_STEPS,
  "lens-switcher": LENS_STEPS,
  "decision-queue": DECISION_QUEUE_STEPS,
  "supplier-exposure-graph": SUPPLIER_GRAPH_STEPS,
  "role-morph-transition": ROLE_MORPH_STEPS,
  "change-since-last-cycle": CYCLE_CHANGE_STEPS,
  "workshop-table": WORKSHOP_STEPS,
  "dual-position-matrix": DUAL_MATRIX_STEPS,
  "event-fan-out": EVENT_FAN_OUT_STEPS,
  "six-lens-grid": SIX_LENS_STEPS,
  "portfolio-decision-thread": PORTFOLIO_THREAD_STEPS,
  "authority-ladder": AUTHORITY_LADDER_STEPS,
  "phase-roadmap": PHASE_ROADMAP_STEPS,
};

/**
 * Chrome budget per visual kind.
 *
 * `bare` moves the subtitle into the presenter notes and gives the stage the
 * space, and it is used only where the whole content of the scene is a
 * drawing. A drawing painted small is a drawing nobody at the back of the
 * room can read, and that costs more than a subtitle does.
 */
const CHROME: Partial<Record<VisualKind, "full" | "lean" | "bare">> = {
  "work-lane-ladder": "lean",
  "decision-queue": "lean",
  "supplier-exposure-graph": "bare",
  "role-morph-transition": "bare",
  "change-since-last-cycle": "lean",
  "workshop-table": "lean",
  "dual-position-matrix": "lean",
  "event-fan-out": "lean",
  "six-lens-grid": "lean",
  "portfolio-decision-thread": "lean",
  "authority-ladder": "lean",
  "phase-roadmap": "lean",
};

/** Which scenes carry a background work reveal, for the B key affordance. */
export function hasBackgroundReveal(scene: StoryScene): boolean {
  return scene.visualKind === "decision-card-collapse" || scene.visualKind === "decision-queue";
}

/* ==========================================================================
   Cross scene content
   ========================================================================== */

type SceneOfKind<K extends VisualKind> = Extract<StoryScene, { visualKind: K }>;

/** The one scene of a given visual kind, or undefined where none exists. */
export function sceneOfKind<K extends VisualKind>(
  scenes: readonly StoryScene[],
  kind: K,
): SceneOfKind<K> | undefined {
  return scenes.find((scene): scene is SceneOfKind<K> => scene.visualKind === kind);
}

/**
 * Content a scene needs that belongs to another scene.
 *
 * Four scenes genuinely depend on an object another scene owns, and pretending
 * otherwise would mean duplicating scenario data into two places where it
 * could drift. Scene 3 shows that nothing new arrived between 07:42 and 07:45,
 * so it needs scene 2's signals. Scenes 8 and 9 render the receiving role's
 * risk, which scene 11 owns. Scene 14 shows the six readings of scene 13
 * consolidating. Scene 16 returns the object scene 1 opened with.
 */
export interface CrossSceneContent {
  cover: SceneOfKind<"convergence-hero">["content"] | undefined;
  clutter: SceneOfKind<"signal-clutter-board">["content"] | undefined;
  lenses: SceneOfKind<"lens-switcher">["content"] | undefined;
  supplier: SceneOfKind<"supplier-exposure-graph">["content"] | undefined;
  cycle: SceneOfKind<"change-since-last-cycle">["content"] | undefined;
  workshop: SceneOfKind<"workshop-table">["content"] | undefined;
  matrix: SceneOfKind<"dual-position-matrix">["content"] | undefined;
  grid: SceneOfKind<"six-lens-grid">["content"] | undefined;
}

export function collectCrossSceneContent(scenes: readonly StoryScene[]): CrossSceneContent {
  return {
    cover: sceneOfKind(scenes, "convergence-hero")?.content,
    clutter: sceneOfKind(scenes, "signal-clutter-board")?.content,
    lenses: sceneOfKind(scenes, "lens-switcher")?.content,
    supplier: sceneOfKind(scenes, "supplier-exposure-graph")?.content,
    cycle: sceneOfKind(scenes, "change-since-last-cycle")?.content,
    workshop: sceneOfKind(scenes, "workshop-table")?.content,
    matrix: sceneOfKind(scenes, "dual-position-matrix")?.content,
    grid: sceneOfKind(scenes, "six-lens-grid")?.content,
  };
}

/* ==========================================================================
   The router
   ========================================================================== */

interface RouterProps {
  scene: StoryScene;
  step: number;
  immediate: boolean;
  backgroundOpen: boolean;
  shared: CrossSceneContent;
}

/**
 * The reason a scene cannot render, when a cross scene dependency is missing.
 *
 * This is the first link in the never blank chain. A missing dependency is a
 * data problem rather than a thrown error, so it resolves to the static
 * composition without waiting for the boundary to catch anything.
 */
function MissingDependency({ scene, what }: { scene: StoryScene; what: string }) {
  return <StaticSceneFallback scene={scene} reason={`missing dependency: ${what}`} debug={false} />;
}

function SceneVisual({ scene, step, immediate, backgroundOpen, shared }: RouterProps) {
  const base = { scene, step, immediate, backgroundOpen };

  switch (scene.visualKind) {
    case "convergence-hero":
      return <CoverScene {...base} content={scene.content} />;

    case "signal-clutter-board":
      return <SignalClutterScene {...base} content={scene.content} />;

    case "decision-card-collapse":
      if (shared.clutter === undefined) {
        return <MissingDependency scene={scene} what="signal clutter board" />;
      }
      return (
        <DecisionCardCollapseScene
          {...base}
          content={scene.content}
          priorSignals={shared.clutter.signals}
        />
      );

    case "work-lane-ladder":
      return <WorkLaneLadderScene {...base} content={scene.content} />;

    case "lens-switcher":
      return <LensSwitcherScene {...base} content={scene.content} />;

    case "decision-queue":
      return <DecisionQueueScene {...base} content={scene.content} />;

    case "supplier-exposure-graph":
      return <SupplierExposureScene {...base} content={scene.content} />;

    case "role-morph-transition":
      if (
        shared.matrix === undefined ||
        shared.workshop === undefined ||
        shared.cycle === undefined ||
        shared.lenses === undefined ||
        shared.supplier === undefined
      ) {
        return <MissingDependency scene={scene} what="risk, control and supplier content" />;
      }
      return (
        <RoleMorphScene
          {...base}
          content={scene.content}
          matrix={shared.matrix}
          workshop={shared.workshop}
          cycle={shared.cycle}
          lenses={shared.lenses}
          supplier={shared.supplier}
        />
      );

    case "change-since-last-cycle":
      if (shared.matrix === undefined) {
        return <MissingDependency scene={scene} what="dual position matrix" />;
      }
      return <CycleChangeScene {...base} content={scene.content} matrix={shared.matrix} />;

    case "workshop-table":
      return <WorkshopTableScene {...base} content={scene.content} />;

    case "dual-position-matrix":
      return <DualPositionMatrixScene {...base} content={scene.content} />;

    case "event-fan-out":
      if (shared.supplier === undefined) {
        return <MissingDependency scene={scene} what="supplier chain names" />;
      }
      return <EventFanOutScene {...base} content={scene.content} supplier={shared.supplier} />;

    case "six-lens-grid":
      if (shared.lenses === undefined) {
        return <MissingDependency scene={scene} what="lens switcher role labels" />;
      }
      return <SixLensGridScene {...base} content={scene.content} lenses={shared.lenses} />;

    case "portfolio-decision-thread":
      if (shared.grid === undefined || shared.lenses === undefined) {
        return <MissingDependency scene={scene} what="six lens grid" />;
      }
      return (
        <PortfolioThreadScene
          {...base}
          content={scene.content}
          grid={shared.grid}
          lenses={shared.lenses}
        />
      );

    case "authority-ladder":
      return <AuthorityLadderScene {...base} content={scene.content} />;

    case "phase-roadmap":
      if (shared.cover === undefined) {
        return <MissingDependency scene={scene} what="cover content" />;
      }
      return <PhaseRoadmapScene {...base} content={scene.content} cover={shared.cover} />;

    default: {
      // Exhaustiveness guard. Adding a visual kind to the story contract
      // without adding a case here is a compile error.
      const unreachable: never = scene;
      return <StaticSceneFallback scene={unreachable} reason="unknown visual kind" debug />;
    }
  }
}

/* ==========================================================================
   The frame
   ========================================================================== */

const ROLE_LABEL: Record<string, string> = {
  tprm: "Third-Party Risk Manager",
  rcsa: "Operational Risk Partner",
  "control-assurance": "Control Assurance Specialist",
  "incident-resilience": "Incident and Resilience Lead",
  "regulatory-change": "Regulatory Change Manager",
  "nfr-governance": "NFR Portfolio Lead",
};

export function SceneView({
  scene,
  chapter,
  step,
  immediate,
  backgroundOpen,
  shared,
  debug = false,
}: {
  scene: StoryScene;
  chapter: StoryChapter | undefined;
  step: number;
  immediate: boolean;
  backgroundOpen: boolean;
  shared: CrossSceneContent;
  debug?: boolean;
}) {
  const titleId = `story-title-${scene.id}`;
  const chrome = CHROME[scene.visualKind] ?? "full";

  return (
    <section
      className="story-scene"
      data-slide
      data-scene={scene.id}
      data-scene-number={scene.sceneNumber}
      data-chapter={scene.chapter}
      data-chrome={chrome}
      aria-labelledby={titleId}
    >
      <div className="story-inner scene-screen">
        <div className="screen-hdr">
          <div className="screen-hdr-row">
            <span className="scene-eyebrow">
              {chapter === undefined ? "" : `${chapter.ordinal}. ${chapter.name}`}
            </span>
            {scene.scenarioClock !== undefined ? (
              <Chip tone="cyan" glyph>
                {scene.scenarioClock}
              </Chip>
            ) : null}
            {scene.momentId !== undefined ? <Chip tone="neutral">{scene.momentId}</Chip> : null}
            {scene.roleFocus !== undefined ? (
              <Chip tone="accent" glyph>
                {ROLE_LABEL[scene.roleFocus] ?? scene.roleFocus}
              </Chip>
            ) : null}
          </div>
          <h2 className="scene-title" id={titleId}>
            {scene.title}
          </h2>
          <p className="scene-subtitle">{scene.subtitle}</p>
        </div>

        {/*
          The never blank chain. A thrown visual resolves to the static
          composition for this scene, with its title, its key message and its
          stage note still on screen, so the presenter keeps the room.
        */}
        <SceneBoundary scene={scene} debug={debug}>
          <SceneVisual
            scene={scene}
            step={step}
            immediate={immediate}
            backgroundOpen={backgroundOpen}
            shared={shared}
          />
        </SceneBoundary>

        <div className="scene-footer">
          <p className="scene-footer-key">{scene.keyMessage}</p>
          <div className="scene-footer-meta">
            {chrome === "bare" ? (
              <span className="story-body-dim" style={{ maxWidth: "52ch" }}>
                {scene.subtitle}
              </span>
            ) : null}
            {scene.showsSyntheticDataLabel ? <SyntheticLabel /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
