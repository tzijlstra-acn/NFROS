/**
 * The presentation route.
 *
 * A server component whose only work is to read the presenter flags off the
 * URL, hand the story data to the deck, and publish the scene metadata the
 * export pipeline reads.
 *
 * Three query parameters form the contract with `scripts/export-deck.ts`:
 *
 *   ?safe=1     presenter safe mode. Every reveal resolves immediately to its
 *               final state, so nothing on screen is mid transition.
 *   ?export=1   implies safe mode, and additionally suppresses the tap zones
 *               so a captured frame carries no interaction affordances.
 *   ?scene=N    opens on scene N, which is how the capture walks the deck one
 *               screenshot at a time.
 *
 * A fourth, ?debug=1, surfaces the scene error tag on a failed scene. It is
 * for rehearsal rather than for a room.
 *
 * The `[data-story-scenes]` element carries the same sixteen scenes as JSON.
 * The export script reads it to build the PowerPoint speaker notes and the
 * separate script document, so the deck and the exported notes cannot drift:
 * both come from `src/scenario/data/story.ts`.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  STORY_CHAPTERS,
  STORY_SCENES,
  SYNTHETIC_DATA_LABEL,
  REGULATORY_LABEL,
  storyDurationLabel,
} from "@/scenario/data/story";
import { StoryDeck } from "@/components/presentation/StoryDeck";
import { PresentationV21 } from "@/presentation-v2-1/components/PresentationV21";
import { PresentationV22 } from "@/presentation-v2-2/components/PresentationV22";
import "@/styles/presentation.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live the NFR Day: presentation",
  description:
    "NFROS Risk Audience Presentation V2.2. Synthetic institution and data. Illustrative regulatory context, not legal advice.",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

/** The first value of a query parameter, which may arrive repeated. */
function firstValue(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function isOn(params: SearchParams, key: string): boolean {
  const value = firstValue(params, key);
  return value === "1" || value === "true";
}

export default async function StoryPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};

  const exportMode = isOn(params, "export");

  // Deck version routing.
  //
  // Route matrix:
  //   No param, ?deck=current, ?deck=v2.2  -> PresentationV22 (current default)
  //   ?deck=v2.1                            -> PresentationV21 (V2.1 design system)
  //   ?deck=legacy, ?deck=v1, ?deck=v2      -> original 16-scene StoryDeck
  const deckVersion = firstValue(params, "deck") ?? "current";

  if (deckVersion === "v2.2" || deckVersion === "current") {
    // V2.2 URL scheme: core=N (1-based), appendix=app-XX, from=slide-XX
    // Backward compat: slide=N still works (used by export scripts)
    const coreParam = firstValue(params, "core") ?? firstValue(params, "slide") ?? "1";
    const initialCoreSlide = Math.max(1, Math.floor(Number(coreParam)));
    const initialAppendixId = firstValue(params, "appendix") ?? null;
    const initialFrom = firstValue(params, "from") ?? null;
    return (
      <PresentationV22
        initialCoreSlide={initialCoreSlide}
        initialAppendixId={initialAppendixId}
        initialFrom={initialFrom}
        exportMode={exportMode}
      />
    );
  }

  if (deckVersion === "v2.1") {
    const initialSlide = Math.max(
      1,
      Math.floor(Number(firstValue(params, "slide") ?? "1"))
    );
    return <PresentationV21 initialSlide={initialSlide} exportMode={exportMode} />;
  }

  // Export mode implies presenter safe mode. A capture of a scene that is
  // still animating is not a slide, it is a frame of a video.
  const safeMode = exportMode || isOn(params, "safe");
  const debug = isOn(params, "debug");

  /*
   * The reveal step, for the export capture only.
   *
   * Absent means "resolve to the final step", which is the behaviour every
   * other caller wants. The export asks for one frame per pane so a scene
   * that shows a pane at a single intermediate step is not dropped from the
   * deck. See the note on `initialStep` in `StoryDeck`.
   */
  const requestedStep = firstValue(params, "step");
  const stepNumber =
    requestedStep !== undefined && requestedStep !== null && Number.isFinite(Number(requestedStep))
      ? Math.max(0, Math.floor(Number(requestedStep)))
      : undefined;

  const requested = Number(firstValue(params, "scene") ?? "1");
  const sceneNumber =
    Number.isFinite(requested) && requested >= 1 && requested <= STORY_SCENES.length
      ? Math.floor(requested)
      : 1;

  /*
   * The metadata the export pipeline consumes. Deliberately the presenter
   * facing fields only: the visual content is captured as an image, because
   * the visualisations are SVG and CSS and a native PowerPoint rebuild would
   * lose fidelity and drift from the live deck.
   */
  const exportMeta = STORY_SCENES.map((scene) => ({
    sceneNumber: scene.sceneNumber,
    id: scene.id,
    title: scene.title,
    subtitle: scene.subtitle,
    chapter: scene.chapter,
    keyMessage: scene.keyMessage,
    presenterNotes: [...scene.presenterNotes],
    durationSeconds: scene.durationSeconds,
  }));

  return (
    <main id="main">
      <StoryDeck
        scenes={STORY_SCENES}
        chapters={STORY_CHAPTERS}
        initialSceneNumber={sceneNumber}
        {...(stepNumber === undefined ? {} : { initialStep: stepNumber })}
        safeMode={safeMode}
        exportMode={exportMode}
        debug={debug}
        entryHref="/"
        durationLabel={storyDurationLabel()}
      />

      {/* The export contract. Hidden, and it adds no height to the deck. */}
      <div data-story-scenes={JSON.stringify(exportMeta)} hidden aria-hidden="true" />

      {/*
        The mandatory labels and the way back, in a form that survives a
        failure of the deck itself. Every scene also renders the synthetic
        data label in its own footer, and every regulatory reference carries
        its label at the point of display rather than here.
      */}
      <div className="sr-only">
        <p>{SYNTHETIC_DATA_LABEL}</p>
        <p>{REGULATORY_LABEL}</p>
        <Link href="/">Back to the entry screen</Link>
      </div>

      <noscript>
        <div style={{ padding: "var(--space-8)", maxWidth: 900, margin: "0 auto" }}>
          <p className="synthetic-label">{SYNTHETIC_DATA_LABEL}</p>
          <h1 style={{ marginTop: "var(--space-4)" }}>Live the NFR day.</h1>
          <p style={{ marginTop: "var(--space-2)" }}>
            {`Sixteen scenes across five chapters, ${storyDurationLabel()} of speaking time. The
            presentation needs scripting enabled for its reveals and its keyboard navigation. The
            scene list follows.`}
          </p>
          <ol style={{ marginTop: "var(--space-4)" }}>
            {STORY_SCENES.map((scene) => (
              <li key={scene.id} style={{ marginBottom: "var(--space-3)" }}>
                <strong>{`${scene.sceneNumber}. ${scene.title}`}</strong>
                <br />
                {scene.subtitle}
              </li>
            ))}
          </ol>
          <p style={{ marginTop: "var(--space-4)" }}>{REGULATORY_LABEL}</p>
          <p style={{ marginTop: "var(--space-4)" }}>
            <Link href="/">Back to the entry screen</Link>
          </p>
        </div>
      </noscript>
    </main>
  );
}
