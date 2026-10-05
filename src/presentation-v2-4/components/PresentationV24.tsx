"use client";

import "../styles/presentation-v2-4.css";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import CoreSlide24Dispatcher from "./CoreSlide24Dispatcher";
import { AppendixSlide24 } from "./AppendixSlide24";
import { AppendixIndex24 } from "./AppendixIndex24";
import { DownloadMenu24 } from "./DownloadMenu24";
import { HelpOverlay24, NotesPanel24, PausePill24 } from "./DeckOverlays24";
import { SlideNavPanel24 } from "./SlideNavPanel24";
import { DeckNavContext, type DeckNavValue } from "./DeckNav";
import { DeckMotionProvider } from "../motion/DeckMotion";
import {
  AGENDA_POSITION,
  APPENDIX_ORDER,
  CORE_COUNT,
  INDEX_SPEAKER_NOTES,
  buildManifest,
  coreNumberOf,
  findAppendix,
  parseViewFromSearch,
  playSlide,
  resolveInitialView,
  sameView,
  stepView,
  viewKey,
  viewTitle,
  viewUrl,
  type DeckView,
} from "./deckModel";

interface PresentationV24Props {
  initialCoreSlide?: number;
  initialAppendixId?: string | null;
  initialFrom?: number | null;
  initialView?: "core" | "appendix" | "appendix-index";
  exportMode?: boolean;
  safeMode?: boolean;
}

type Overlays = { help: boolean; downloads: boolean; notes: boolean };
const NO_OVERLAYS: Overlays = { help: false, downloads: false, notes: false };

function preservedFromProps(exportMode: boolean, safeMode: boolean): URLSearchParams {
  const p = new URLSearchParams();
  if (exportMode) p.set("export", "1");
  else if (safeMode) p.set("safe", "1");
  return p;
}

function preservedFromLocation(): URLSearchParams {
  const current = new URLSearchParams(window.location.search);
  const p = new URLSearchParams();
  for (const key of ["export", "safe"]) {
    const value = current.get(key);
    if (value !== null) p.set(key, value);
  }
  return p;
}

function announcementFor(view: DeckView): string {
  const title = viewTitle(view);
  if (view.kind === "core") {
    const n = coreNumberOf(view.position);
    return n !== null ? `Slide ${n} of ${CORE_COUNT}: ${title}` : `Closing slide: ${title}`;
  }
  if (view.kind === "appendix-index") return title;
  const i = APPENDIX_ORDER.findIndex((s) => s.id === view.id) + 1;
  return `Appendix ${i} of ${APPENDIX_ORDER.length}: ${title}`;
}

function notesFor(view: DeckView): string {
  if (view.kind === "core") return playSlide(view.position)?.speakerNotes ?? "";
  if (view.kind === "appendix-index") return INDEX_SPEAKER_NOTES;
  return findAppendix(view.id)?.speakerNotes ?? "";
}

function isTypingTarget(el: Element | null): boolean {
  return !!el?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']");
}

function isActivationTarget(el: Element | null): boolean {
  return !!el?.closest("button, a[href], summary, [role='button'], [role='link'], [role='menuitem']");
}

export function PresentationV24({
  initialCoreSlide = 1,
  initialAppendixId = null,
  initialFrom = null,
  initialView = "core",
  exportMode = false,
  safeMode = false,
}: PresentationV24Props) {
  const [view, setView] = useState<DeckView>(() =>
    resolveInitialView({ initialCoreSlide, initialAppendixId, initialFrom, initialView }),
  );
  const [replayKey, setReplayKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [enteredPaused, setEnteredPaused] = useState(false);
  const [overlays, setOverlays] = useState<Overlays>(NO_OVERLAYS);
  const [downloadTrigger, setDownloadTrigger] = useState<HTMLElement | null>(null);
  const [scale, setScale] = useState<number>(1);
  // Slides read the reduced-motion preference, which the server cannot know. Rendering them
  // only after mount (export mode skips motion on both sides) avoids a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [preserved, setPreserved] = useState<URLSearchParams>(() => preservedFromProps(exportMode, safeMode));

  const rootRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<DeckView>(view);
  const pausedRef = useRef(paused);
  const overlaysRef = useRef<Overlays>(overlays);

  useLayoutEffect(() => {
    viewRef.current = view;
    pausedRef.current = paused;
    overlaysRef.current = overlays;
  });

  useEffect(() => {
    setMounted(true);
    setPreserved(preservedFromLocation());
  }, []);

  // Scale the 1920x1080 slide canvas to fit the viewport
  useEffect(() => {
    const updateScale = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // ---------------------------------------------------------------------------
  // Navigation: one history entry per move, restored from the URL on Back and Forward
  // ---------------------------------------------------------------------------

  const applyView = useCallback((next: DeckView) => {
    setEnteredPaused(pausedRef.current);
    viewRef.current = next;
    setView(next);
  }, []);

  const navigate = useCallback(
    (next: DeckView) => {
      if (sameView(viewRef.current, next)) return;
      applyView(next);
      window.history.pushState(null, "", viewUrl(next, true, preservedFromLocation()));
    },
    [applyView],
  );

  useEffect(() => {
    const onPopState = () => applyView(parseViewFromSearch(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyView]);

  const openDownloads = useCallback((trigger?: HTMLElement | null) => {
    setDownloadTrigger(trigger ?? null);
    setOverlays((o) => ({ ...o, help: false, downloads: true }));
  }, []);

  const closeOverlays = useCallback(() => setOverlays(NO_OVERLAYS), []);

  const replay = useCallback(() => {
    setPaused(false);
    setEnteredPaused(false);
    setReplayKey((k) => k + 1);
  }, []);

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (isTypingTarget(target)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const current = viewRef.current;
      // Export captures carry no presenter chrome, so its toggles stay off
      if (exportMode && ["m", "d", "p", "f", "?"].includes(key)) return;

      if (key === "Escape") {
        const o = overlaysRef.current;
        if (o.help || o.downloads || o.notes) {
          e.preventDefault();
          setOverlays(NO_OVERLAYS);
        }
        return;
      }
      if ((key === " " || key === "Enter") && isActivationTarget(target)) return;

      // A modal dialog keeps the keyboard apart from its own toggle
      const modalOpen = document.querySelector(".pv24-dialog[aria-modal='true']") !== null;
      if (modalOpen) {
        if (key === "?") setOverlays((o) => ({ ...o, help: !o.help }));
        if (key === "d") setOverlays((o) => ({ ...o, downloads: false }));
        return;
      }

      const step = (delta: 1 | -1) => {
        const next = stepView(current, delta);
        if (next) navigate(next);
      };

      switch (key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault();
          step(1);
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          step(-1);
          break;
        case "Home":
          e.preventDefault();
          navigate({ kind: "core", position: 1 });
          break;
        case "End":
          e.preventDefault();
          navigate({ kind: "core", position: CORE_COUNT });
          break;
        case "a":
          e.preventDefault();
          if (current.kind === "core") navigate({ kind: "core", position: AGENDA_POSITION });
          else navigate({ kind: "appendix-index", from: current.from });
          break;
        case "c":
          if (current.kind !== "core") {
            e.preventDefault();
            navigate({ kind: "core", position: current.from });
          }
          break;
        case "r":
          e.preventDefault();
          replay();
          break;
        case "m":
          e.preventDefault();
          setPaused((p) => !p);
          break;
        case "d":
          e.preventDefault();
          openDownloads(null);
          break;
        case "f":
          e.preventDefault();
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
          else void rootRef.current?.requestFullscreen().catch(() => undefined);
          break;
        case "p":
          e.preventDefault();
          setOverlays((o) => ({ ...o, notes: !o.notes }));
          break;
        case "?":
          e.preventDefault();
          setOverlays((o) => ({ ...o, help: true }));
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exportMode, navigate, openDownloads, replay]);

  // ---------------------------------------------------------------------------
  // Announcements and export readiness
  // ---------------------------------------------------------------------------

  const key = viewKey(view);

  useEffect(() => {
    setAnnouncement(announcementFor(view));
  }, [view]);

  const firstPauseRender = useRef(true);
  useEffect(() => {
    if (firstPauseRender.current) {
      firstPauseRender.current = false;
      return;
    }
    setAnnouncement(paused ? "Motion paused" : "Motion resumed");
  }, [paused]);

  const renderSlides = mounted || exportMode;
  const instanceKey = `${key}:${replayKey}`;

  useEffect(() => {
    if (!renderSlides) return;
    let cancelled = false;
    setReadyKey(null);
    const waitForImages = async () => {
      const slide = slideRef.current;
      if (!slide) return;
      const pending = Array.from(slide.querySelectorAll("img")).filter((img) => !img.complete);
      await Promise.all(
        pending.map(
          (img) =>
            new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }),
        ),
      );
    };
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    void (async () => {
      try {
        await document.fonts.ready;
      } catch {
        // fonts.ready only rejects when the document is torn down
      }
      await waitForImages();
      await nextFrame();
      await nextFrame();
      // A failed image swaps to its pending frame; wait for that render too
      await waitForImages();
      if (!cancelled) setReadyKey(instanceKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [instanceKey, renderSlides]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const manifestJson = useMemo(() => JSON.stringify(buildManifest()).replace(/</g, "\\u003c"), []);

  const navValue = useMemo<DeckNavValue>(
    () => ({
      exportMode,
      navigate,
      hrefFor: (v: DeckView) => viewUrl(v, true, preserved),
      openDownloads,
    }),
    [exportMode, navigate, openDownloads, preserved],
  );

  const staticMotion = exportMode || safeMode || enteredPaused;
  const title = viewTitle(view);
  const nextView = stepView(view, 1);
  const showChrome = !exportMode;

  let content: ReactNode = null;
  if (view.kind === "core") {
    const slide = playSlide(view.position);
    if (slide) content = <CoreSlide24Dispatcher slide={slide} position={view.position} exportMode={exportMode} staticMotion={staticMotion} />;
  } else if (view.kind === "appendix") {
    const slide = findAppendix(view.id);
    if (slide) content = <AppendixSlide24 slide={slide} from={view.from} exportMode={exportMode} staticMotion={staticMotion} />;
  } else {
    content = <AppendixIndex24 from={view.from} exportMode={exportMode} staticMotion={staticMotion} />;
  }

  return (
    <DeckNavContext.Provider value={navValue}>
      <DeckMotionProvider paused={paused} rootRef={slideRef}>
        <div
          ref={rootRef}
          className={exportMode ? "pv24-deck pv24-deck--export" : "pv24-deck"}
          data-deck="v2.4"
          data-view={view.kind}
          data-motion-state={paused ? "paused" : "running"}
        >
          <script
            type="application/json"
            data-presentation-slides=""
            dangerouslySetInnerHTML={{ __html: manifestJson }}
          />

          {showChrome ? <SlideNavPanel24 view={view} onNavigate={navigate} onOpenDownloads={openDownloads} /> : null}

          {/* The layout's skip link targets #main; the slide is the page's main content */}
          <main id="main" className="pv24-main">
          <div
            ref={slideRef}
            className="pv24-slide"
            role="region"
            aria-roledescription="slide"
            aria-label={title}
            data-slide-key={key}
            data-slide-ready={readyKey === instanceKey ? "true" : "false"}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              top: `calc(50vh - ${540 * scale}px)`,
              left: `calc(50vw - ${960 * scale}px)`,
            }}
          >
            {renderSlides ? (
              <div key={instanceKey} className="pv24-slide-content">
                {content}
              </div>
            ) : null}
          </div>
          </main>

          <div className="pv24-sr-only" aria-live="polite" aria-atomic="true">
            {announcement}
          </div>

          {showChrome && paused ? <PausePill24 /> : null}
          {showChrome && overlays.notes ? (
            <NotesPanel24
              title={title}
              notes={notesFor(view)}
              nextTitle={nextView ? viewTitle(nextView) : null}
              onClose={() => setOverlays((o) => ({ ...o, notes: false }))}
            />
          ) : null}
          {showChrome && overlays.help ? <HelpOverlay24 onClose={() => setOverlays((o) => ({ ...o, help: false }))} /> : null}
          {showChrome && overlays.downloads ? (
            <DownloadMenu24 onClose={() => setOverlays((o) => ({ ...o, downloads: false }))} returnTo={downloadTrigger} />
          ) : null}
        </div>
      </DeckMotionProvider>
    </DeckNavContext.Provider>
  );
}
