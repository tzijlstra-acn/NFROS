"use client";

/**
 * StoryDeck: the cinematic presentation surface.
 *
 * This is a first class product surface. It is shown live to CROs and COOs,
 * and it is the thing that gets captured into the PDF and the PowerPoint, so
 * three properties matter more than any visual decision in it.
 *
 * ---------------------------------------------------------------------------
 * 1. Determinism
 * ---------------------------------------------------------------------------
 * With `?safe=1` or `?export=1` on the URL, every scene's reveal step counter
 * is pinned to its final value on the first render, the auto reveal never
 * starts, and `data-safe="true"` on the deck root collapses every transition
 * and animation duration to one millisecond. A screenshot taken at any moment
 * after mount is therefore identical to one taken a minute later. Nothing in
 * the deck is stochastic: the scattered fragment positions on scene 1 and the
 * collapse offsets on scene 3 come from an integer hash of the item index,
 * not from Math.random.
 *
 * The same two layer treatment fires for `prefers-reduced-motion: reduce` and
 * for the in product motion pause. That is the pattern the source findings
 * prescribe: CSS neutralises the transitions, and the JavaScript layer jumps
 * the timeline to its end state rather than showing nothing.
 *
 * ---------------------------------------------------------------------------
 * 2. No vertical overflow, ever
 * ---------------------------------------------------------------------------
 * The deck is 100dvh with clipped overflow. Each scene is a 100dvh section
 * with a three row grid whose middle row is minmax(0, 1fr), and the stage
 * inside it carries `contain: layout paint size`. Where a composition is
 * taller than its stage, the stage scales it down. Nothing scrolls, because a
 * scrollbar on a projected slide hides half the composition and the audience
 * cannot tell that it is doing so.
 *
 * ---------------------------------------------------------------------------
 * 3. Motion that argues
 * ---------------------------------------------------------------------------
 * Every effect is driven by a per scene reveal step counter and explains one
 * of: flow, dependency, state change, evidence, uncertainty, propagation,
 * decision consequence, or work removed. There are two loops in the entire
 * deck and each marks something unresolved. There are no animated counters,
 * no particles, no glow and no floating shapes.
 */

import * as React from "react";
import Link from "next/link";
import {
  STORY_COPY_RULES,
  SYNTHETIC_DATA_LABEL,
  type ChapterId,
  type StoryChapter,
  type StoryScene,
} from "@/scenario/data/story";
import { Chip } from "@/components/evidence/primitives";
import {
  STEP_COUNTS,
  SceneView,
  collectCrossSceneContent,
  hasBackgroundReveal,
} from "./SceneView";

/* ==========================================================================
   The keyboard map, declared once
   ========================================================================== */

/**
 * One source of truth for the key bindings and for the on screen help.
 *
 * The help overlay is generated from this list, so a binding cannot exist
 * without being documented and cannot be documented without existing.
 */
const KEY_MAP: ReadonlyArray<{ keys: readonly string[]; action: string }> = [
  { keys: ["Right", "Space", "PageDown"], action: "Next scene" },
  { keys: ["Left", "PageUp"], action: "Previous scene" },
  { keys: ["Home"], action: "First scene" },
  { keys: ["End"], action: "Last scene" },
  { keys: ["Down"], action: "Advance the reveal one step, and take manual control" },
  { keys: ["Up"], action: "Rewind the reveal one step" },
  { keys: ["R"], action: "Replay this scene's reveal from the start" },
  { keys: ["A"], action: "Auto reveal on or off" },
  { keys: ["M"], action: "Pause or resume motion" },
  { keys: ["P"], action: "Presenter notes panel" },
  { keys: ["B"], action: "Background work reveal, on the scenes that carry one" },
  { keys: ["F"], action: "Full screen" },
  { keys: ["Esc"], action: "Close the overlay, then leave full screen" },
  { keys: ["1", "to", "5"], action: "Jump to chapter I to V" },
  { keys: ["?"], action: "This help overlay" },
];

/* ==========================================================================
   Hooks
   ========================================================================== */

/** The operating system reduced motion preference, watched for changes. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Full screen on one element, with the browser as the source of truth. */
function useFullscreen(target: React.RefObject<HTMLDivElement | null>) {
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const enter = React.useCallback(() => {
    const element = target.current;
    if (element === null) return;
    if (document.fullscreenElement === null) {
      void element.requestFullscreen?.().catch(() => undefined);
    }
  }, [target]);

  const exit = React.useCallback(() => {
    if (document.fullscreenElement !== null) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  }, []);

  const toggle = React.useCallback(() => {
    if (document.fullscreenElement === null) enter();
    else exit();
  }, [enter, exit]);

  return { active, enter, exit, toggle };
}

/* ==========================================================================
   Props
   ========================================================================== */

export interface StoryDeckProps {
  scenes: StoryScene[];
  chapters: readonly StoryChapter[];
  /** One based scene number to open on. Used by the export capture. */
  initialSceneNumber?: number;
  /**
   * Zero based reveal step to resolve to in presenter safe or export mode.
   *
   * This exists because of a real defect in the deck export. A multi pane
   * scene shows one pane per step, and three scenes gate a pane on an EXACT
   * step rather than on a step range. Presenter safe and export mode both
   * resolve immediately to the FINAL step, so those intermediate panes were
   * never rendered: the export of scene 12 omitted four of its five panes,
   * including the service dependency map, and scene 14 omitted three,
   * including the portfolio decision thread. The exported deck therefore had
   * sixteen pages and was missing eight panes of content.
   *
   * With this set, the capture can ask for one frame per pane. Unset, the
   * behaviour is exactly as before: resolve to the final step.
   */
  initialStep?: number;
  /** Presenter safe mode: every reveal resolves immediately to its end state. */
  safeMode?: boolean;
  /** Export mode. Implies presenter safe mode, and hides the tap affordances. */
  exportMode?: boolean;
  /** Shows the scene error tag on a failed scene. Driven by ?debug=1. */
  debug?: boolean;
  /** Where the back link points. */
  entryHref?: string;
  /** Total speaking time, formatted by the story module. */
  durationLabel?: string;
}

/* ==========================================================================
   The deck
   ========================================================================== */

export function StoryDeck({
  scenes,
  chapters,
  initialSceneNumber = 1,
  initialStep,
  safeMode = false,
  exportMode = false,
  debug = false,
  entryHref = "/",
  durationLabel,
}: StoryDeckProps) {
  const deckRef = React.useRef<HTMLDivElement | null>(null);
  const helpCloseRef = React.useRef<HTMLButtonElement | null>(null);
  const reducedMotion = useReducedMotion();
  const fullscreen = useFullscreen(deckRef);

  const shared = React.useMemo(() => collectCrossSceneContent(scenes), [scenes]);

  const startIndex = Math.max(
    0,
    Math.min(scenes.length - 1, scenes.findIndex((scene) => scene.sceneNumber === initialSceneNumber)),
  );

  const [index, setIndex] = React.useState(startIndex < 0 ? 0 : startIndex);
  const [step, setStep] = React.useState(0);
  const [autoReveal, setAutoReveal] = React.useState(true);
  const [motionPaused, setMotionPaused] = React.useState(false);
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [backgroundOpen, setBackgroundOpen] = React.useState(false);

  const scene = scenes[index];
  const stepCount = scene === undefined ? 1 : STEP_COUNTS[scene.visualKind];
  const finalStep = stepCount - 1;

  /*
   * The single switch that makes the deck deterministic. Presenter safe mode,
   * export mode and the operating system reduced motion preference all resolve
   * to the same behaviour: the reveal is already finished.
   */
  const immediate = safeMode || exportMode || reducedMotion;

  /*
   * In immediate mode the reveal resolves at once. To WHICH step is the
   * question: the final one by default, or a requested one when the caller
   * names it, which is how the export captures a pane that is only shown at
   * an intermediate step. Clamped, because the value arrives from a URL.
   */
  const requestedStep =
    initialStep === undefined ? null : Math.max(0, Math.min(finalStep, Math.floor(initialStep)));
  const effectiveStep = immediate ? (requestedStep ?? finalStep) : step;

  const chapter = React.useMemo(
    () => (scene === undefined ? undefined : chapters.find((entry) => entry.id === scene.chapter)),
    [chapters, scene],
  );

  /* ---- Navigation ---- */

  const goToIndex = React.useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(scenes.length - 1, next));
      setIndex(clamped);
      setStep(0);
      setBackgroundOpen(false);
      // A scene change restarts the reveal, which is what a presenter expects
      // when they arrive on a new slide.
      setAutoReveal(true);
    },
    [scenes.length],
  );

  const next = React.useCallback(() => goToIndex(index + 1), [goToIndex, index]);
  const previous = React.useCallback(() => goToIndex(index - 1), [goToIndex, index]);

  const goToChapter = React.useCallback(
    (chapterId: ChapterId) => {
      const target = scenes.findIndex((entry) => entry.chapter === chapterId);
      if (target >= 0) goToIndex(target);
    },
    [goToIndex, scenes],
  );

  const replay = React.useCallback(() => {
    setStep(0);
    setAutoReveal(true);
    setMotionPaused(false);
  }, []);

  const stepForward = React.useCallback(() => {
    setAutoReveal(false);
    setStep((current) => Math.min(finalStep, current + 1));
  }, [finalStep]);

  const stepBack = React.useCallback(() => {
    setAutoReveal(false);
    setStep((current) => Math.max(0, current - 1));
  }, []);

  /* ---- Auto reveal ---- */

  /*
   * The interval is derived from the step count so that the whole reveal
   * lands inside the motion budget the storyboard sets: no scene timeline
   * exceeds 12,000 ms, and the two that exceed the 7,000 ms standard limit are
   * the two the storyboard justifies. It is a timer rather than an animation
   * because every step is also reachable by hand, which is what makes the
   * scene seek safe.
   */
  React.useEffect(() => {
    if (immediate || !autoReveal || motionPaused) return;
    if (step >= finalStep) return;
    const interval = Math.max(600, Math.min(1200, Math.round(9000 / Math.max(1, stepCount))));
    const timer = window.setTimeout(() => {
      setStep((current) => Math.min(finalStep, current + 1));
    }, interval);
    return () => window.clearTimeout(timer);
  }, [autoReveal, finalStep, immediate, motionPaused, step, stepCount]);

  /* ---- Keyboard ---- */

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case "ArrowRight":
        case " ":
        case "Spacebar":
        case "PageDown":
          event.preventDefault();
          next();
          return;
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          previous();
          return;
        case "Home":
          event.preventDefault();
          goToIndex(0);
          return;
        case "End":
          event.preventDefault();
          goToIndex(scenes.length - 1);
          return;
        case "ArrowDown":
          event.preventDefault();
          stepForward();
          return;
        case "ArrowUp":
          event.preventDefault();
          stepBack();
          return;
        case "Escape":
          event.preventDefault();
          if (helpOpen) setHelpOpen(false);
          else if (fullscreen.active) fullscreen.exit();
          else if (notesOpen) setNotesOpen(false);
          return;
        case "?":
          event.preventDefault();
          setHelpOpen((open) => !open);
          return;
        default:
          break;
      }

      const key = event.key.toLowerCase();
      if (key === "f") {
        event.preventDefault();
        fullscreen.toggle();
        return;
      }
      if (key === "p") {
        event.preventDefault();
        setNotesOpen((open) => !open);
        return;
      }
      if (key === "m") {
        event.preventDefault();
        setMotionPaused((paused) => !paused);
        return;
      }
      if (key === "r") {
        event.preventDefault();
        replay();
        return;
      }
      if (key === "a") {
        event.preventDefault();
        setAutoReveal((on) => !on);
        return;
      }
      if (key === "b") {
        event.preventDefault();
        setBackgroundOpen((open) => !open);
        return;
      }
      if (/^[1-9]$/.test(key)) {
        const ordinal = Number(key);
        const targetChapter = chapters[ordinal - 1];
        if (targetChapter !== undefined) {
          event.preventDefault();
          goToChapter(targetChapter.id);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    chapters,
    fullscreen,
    goToChapter,
    goToIndex,
    helpOpen,
    next,
    notesOpen,
    previous,
    replay,
    scenes.length,
    stepBack,
    stepForward,
  ]);

  React.useEffect(() => {
    if (helpOpen) helpCloseRef.current?.focus();
  }, [helpOpen]);

  /* ---- Mouse and tap zones ---- */

  /*
   * Delegated, and it yields to any real control.
   *
   * A tap zone laid over the stage would swallow clicks meant for a lens
   * button or a toggle, and in front of an audience a swallowed click reads as
   * a broken product. Checking the event target for an interactive ancestor
   * means the zones can cover the whole frame and still never take a click
   * that belonged to something else.
   */
  const onFrameClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (exportMode) return;
      const target = event.target;
      if (target instanceof Element) {
        if (target.closest("button, a, input, select, textarea, [role='button'], [data-no-nav]")) {
          return;
        }
      }
      const bounds = event.currentTarget.getBoundingClientRect();
      if (bounds.width <= 0) return;
      const position = (event.clientX - bounds.left) / bounds.width;
      if (position < 1 / 3) previous();
      else if (position > 2 / 3) next();
    },
    [exportMode, next, previous],
  );

  if (scene === undefined) {
    return (
      <div className="story-deck">
        <div className="story-frame">
          <p className="story-body">No scenes are available.</p>
        </div>
      </div>
    );
  }

  /* ---- Progress ---- */

  const sceneProgress = finalStep <= 0 ? 100 : (effectiveStep / finalStep) * 100;
  const chapterDurations = chapters.map((entry) => ({
    chapter: entry,
    seconds: scenes
      .filter((candidate) => candidate.chapter === entry.id)
      .reduce((total, candidate) => total + candidate.durationSeconds, 0),
  }));
  const totalSeconds = chapterDurations.reduce((total, entry) => total + entry.seconds, 0) || 1;

  const scenesBefore = scenes.filter(
    (candidate) => candidate.chapter === scene.chapter && candidate.sceneNumber < scene.sceneNumber,
  ).length;
  const chapterSceneCount = scenes.filter((candidate) => candidate.chapter === scene.chapter).length;
  const withinChapter = ((scenesBefore + effectiveStep / Math.max(1, finalStep + 1)) /
    Math.max(1, chapterSceneCount)) *
    100;

  const chapterIndex = chapters.findIndex((entry) => entry.id === scene.chapter);
  const backgroundAvailable = hasBackgroundReveal(scene);

  return (
    <div
      className="story-deck"
      ref={deckRef}
      role="region"
      aria-label={`NFR WorkOS presentation. Scene ${scene.sceneNumber} of ${scenes.length}.`}
      data-safe={immediate ? "true" : "false"}
      data-motion={motionPaused ? "paused" : "running"}
      data-notes={notesOpen ? "open" : "closed"}
      data-export={exportMode ? "true" : "false"}
    >
      <div className="story-frame" onClick={onFrameClick}>
        {/* ---- Chapter and counter bar ---- */}
        <header className="story-chapterbar">
          <span className="story-chapter-ordinal">{chapter?.ordinal ?? ""}</span>
          <span className="story-chapter-name">{chapter?.name ?? ""}</span>

          <nav className="story-chapter-rail" aria-label="Chapters">
            {chapterDurations.map((entry, entryIndex) => {
              const state =
                entryIndex < chapterIndex ? "done" : entryIndex === chapterIndex ? "current" : "ahead";
              return (
                <button
                  type="button"
                  key={entry.chapter.id}
                  className="story-chapter-seg"
                  data-state={state}
                  aria-label={`Chapter ${entry.chapter.ordinal}, ${entry.chapter.name}. Press ${entryIndex + 1}.`}
                  aria-current={state === "current" ? "step" : undefined}
                  title={`${entry.chapter.ordinal}. ${entry.chapter.name}. ${entry.chapter.intent}`}
                  onClick={() => goToChapter(entry.chapter.id)}
                  style={{
                    flex: `${(entry.seconds / totalSeconds) * 100} 1 0%`,
                    ["--seg-progress" as string]: `${Math.max(0, Math.min(100, withinChapter))}%`,
                  }}
                />
              );
            })}
          </nav>

          {scene.scenarioClock !== undefined ? (
            <span className="story-clock">{scene.scenarioClock}</span>
          ) : null}
          <span className="story-counter">
            scene <b>{scene.sceneNumber}</b> of <b>{scenes.length}</b>
          </span>
        </header>

        {/* ---- Progress indicator, per scene reveal ---- */}
        <div
          className="story-progress"
          role="progressbar"
          aria-label="Reveal progress within this scene"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(sceneProgress)}
        >
          <div
            className="story-progress-fill"
            style={{ ["--progress" as string]: `${sceneProgress}%` }}
          />
        </div>

        {/* ---- Tap affordances. Navigation is delegated on the frame. ---- */}
        {exportMode ? null : (
          <>
            <div className="story-zone" data-side="prev" aria-hidden="true">
              {"<"}
            </div>
            <div className="story-zone" data-side="next" aria-hidden="true">
              {">"}
            </div>
          </>
        )}

        {/* ---- The scene ---- */}
        <SceneView
          scene={scene}
          chapter={chapter}
          step={effectiveStep}
          immediate={immediate}
          backgroundOpen={backgroundOpen}
          shared={shared}
          debug={debug}
        />

        {/* ---- The announcement. One polite region, updated on scene change. ---- */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {`Scene ${scene.sceneNumber} of ${scenes.length}. Chapter ${chapter?.ordinal ?? ""}, ${chapter?.name ?? ""}. ${scene.title} ${scene.subtitle} ${scene.keyMessage}`}
        </div>

        {/* ---- Control bar ---- */}
        <nav className="story-controlbar" aria-label="Presentation controls" data-no-nav>
          <div className="story-control-group">
            <button
              type="button"
              className="btn"
              onClick={previous}
              disabled={index === 0}
              aria-label="Previous scene"
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={next}
              disabled={index === scenes.length - 1}
              aria-label="Next scene"
            >
              Next
            </button>
            <button type="button" className="btn btn-quiet" onClick={replay} aria-label="Replay this scene's reveal">
              Replay
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => setAutoReveal((on) => !on)}
              aria-pressed={autoReveal}
              aria-label={autoReveal ? "Pause the auto reveal" : "Resume the auto reveal"}
            >
              {autoReveal ? "Pause reveal" : "Auto reveal"}
            </button>
            <span className="story-step-readout">
              {`reveal ${Math.min(effectiveStep + 1, stepCount)} of ${stepCount}`}
            </span>
          </div>

          <span className="story-control-spacer" />

          <div className="story-control-group">
            {backgroundAvailable ? (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => setBackgroundOpen((open) => !open)}
                aria-pressed={backgroundOpen}
                aria-label="Background work reveal"
              >
                Background work
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => setMotionPaused((paused) => !paused)}
              aria-pressed={motionPaused}
              aria-label={motionPaused ? "Resume motion" : "Pause motion"}
            >
              {motionPaused ? "Motion paused" : "Pause motion"}
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => setNotesOpen((open) => !open)}
              aria-pressed={notesOpen}
              aria-label="Presenter notes"
            >
              Notes
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={fullscreen.toggle}
              aria-pressed={fullscreen.active}
              aria-label="Full screen"
            >
              Full screen
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => setHelpOpen(true)}
              aria-label="Keyboard help"
            >
              ?
            </button>
            <Link href={entryHref} className="btn btn-quiet" aria-label="Back to the entry screen">
              Exit
            </Link>
          </div>
        </nav>
      </div>

      {/* ---- Presenter notes ---- */}
      <aside className="story-notes" aria-label="Presenter notes" data-no-nav>
        <div className="story-notes-head">
          <span className="story-panel-title" style={{ margin: 0 }}>
            {`Presenter notes. Scene ${scene.sceneNumber}. ${scene.durationSeconds} s.`}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setNotesOpen(false)}
            aria-label="Close the presenter notes"
          >
            Close
          </button>
        </div>

        <div className="story-notes-body">
          <div className="stack stack-2">
            <span className="story-notes-section-title">Key message</span>
            <p className="story-body">{scene.keyMessage}</p>
          </div>

          <div className="stack stack-2">
            <span className="story-notes-section-title">Speaking points</span>
            <div className="story-notes-list">
              {scene.presenterNotes.map((note, noteIndex) => (
                <p className="story-note" key={note}>
                  <span className="story-note-index" aria-hidden="true">
                    {noteIndex + 1}
                  </span>
                  <span>{note}</span>
                </p>
              ))}
            </div>
          </div>

          <div className="stack stack-2">
            <span className="story-notes-section-title">On the stage</span>
            <p className="story-body-dim">{scene.stageNote}</p>
            <span className="story-notes-section-title">Transition out</span>
            <p className="story-body-dim">{scene.transitionOut}</p>
          </div>

          <div className="stack stack-2">
            <span className="story-notes-section-title">
              {`Questions this scene provokes, and the honest answer (${scene.audienceQuestions.length})`}
            </span>
            {scene.audienceQuestions.map((entry) => (
              <div className="story-qa" key={entry.question}>
                <span className="story-qa-q">{entry.question}</span>
                <span className="story-qa-a">{entry.answer}</span>
              </div>
            ))}
          </div>

          {scene.regulatoryNote !== undefined ? (
            <div className="stack stack-2">
              <span className="story-notes-section-title">Regulatory discipline</span>
              <p className="story-body-dim">
                {`${scene.regulatoryNote} The EU lane and the Swiss lane are shown separately and no flow crosses between them.`}
              </p>
            </div>
          ) : null}
        </div>

        <div className="story-notes-foot">
          <span className="story-step-readout">
            {durationLabel === undefined
              ? `${scene.durationSeconds} s on this scene`
              : `${scene.durationSeconds} s on this scene. ${durationLabel} in total.`}
          </span>
        </div>
      </aside>

      {/* ---- Help overlay ---- */}
      {helpOpen ? (
        <div
          className="story-help-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard and mouse controls"
          data-no-nav
          onClick={(event) => {
            if (event.target === event.currentTarget) setHelpOpen(false);
          }}
        >
          <div className="story-help">
            <div className="story-notes-head">
              <span className="story-panel-title" style={{ margin: 0 }}>
                Keyboard and mouse controls
              </span>
              <button
                type="button"
                className="btn btn-sm"
                ref={helpCloseRef}
                onClick={() => setHelpOpen(false)}
                aria-label="Close the help overlay"
              >
                Close
              </button>
            </div>

            <div className="story-help-body">
              <div className="story-keymap">
                {KEY_MAP.map((entry) => (
                  <div className="story-keyrow" key={entry.action}>
                    <span className="story-keyrow-keys">
                      {entry.keys.map((key) =>
                        key === "to" ? (
                          <span className="story-step-readout" key={key}>
                            to
                          </span>
                        ) : (
                          <kbd key={key}>{key}</kbd>
                        ),
                      )}
                    </span>
                    <span>{entry.action}</span>
                  </div>
                ))}
              </div>

              <div className="stack stack-2" style={{ marginTop: "var(--space-5)" }}>
                <span className="story-notes-section-title">Mouse and touch</span>
                <p className="story-body-dim">
                  Click or tap the left third of the frame to go back and the right third to go
                  forward. The middle third does nothing, and a click on any control, link or
                  toggle always reaches that control rather than the navigation.
                </p>
                <span className="story-notes-section-title">Presenter safe and export</span>
                <p className="story-body-dim">
                  Add <kbd>?safe=1</kbd> or <kbd>?export=1</kbd> to the address to pin every reveal
                  to its final state. The deck then paints the finished scene on the first frame,
                  which is what the PDF and PowerPoint capture depends on. The same happens
                  automatically when the operating system asks for reduced motion.
                </p>
                <span className="story-notes-section-title">Copy discipline on these slides</span>
                <p className="story-body-dim">
                  {`Titles are held to ${STORY_COPY_RULES.maxTitleWords} words and subtitles to ${STORY_COPY_RULES.maxSubtitleWords}, with ${STORY_COPY_RULES.knownExceptions.length} recorded exception. Every quantity on screen carries its basis. ${SYNTHETIC_DATA_LABEL}`}
                </p>
              </div>
            </div>

            <div className="story-notes-foot row row-3 row-between row-wrap">
              <Chip tone="neutral">{`${scenes.length} scenes, ${chapters.length} chapters`}</Chip>
              {durationLabel !== undefined ? <Chip tone="neutral">{durationLabel}</Chip> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default StoryDeck;
