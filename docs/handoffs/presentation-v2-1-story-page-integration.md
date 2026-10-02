# Presentation V2.1 -- Story Page Integration

This note describes exactly how to wire the V2.1 deck into `app/story/page.tsx`
and into the existing export pipeline.

---

## Current state of `app/story/page.tsx`

The existing page is a Next.js server component serving the original sixteen-scene
story deck at `/story`. It supports four query parameters:

  ?safe=1       presenter safe mode -- all reveals resolve immediately
  ?export=1     export mode (implies safe mode) -- suppresses tap zones
  ?scene=N      opens on scene N (integer, 1-indexed)
  ?step=N       opens on a specific reveal step within the scene
  ?debug=1      surfaces scene error tags during rehearsal

It does NOT yet support `?deck=` routing. There is only one deck.

It imports:
  - `StoryDeck` from `@/components/presentation/StoryDeck`
  - `@/styles/presentation.css` (the original deck stylesheet)
  - `STORY_CHAPTERS`, `STORY_SCENES`, and helpers from `@/scenario/data/story`

---

## Exact diff to add `?deck=v2.1` support

Apply this diff to `app/story/page.tsx`:

```diff
--- a/app/story/page.tsx
+++ b/app/story/page.tsx
@@ -26,6 +26,8 @@ import {
   storyDurationLabel,
 } from "@/scenario/data/story";
 import { StoryDeck } from "@/components/presentation/StoryDeck";
+import { PresentationV21 } from "@/presentation-v2-1/components/PresentationV21";
 import "@/styles/presentation.css";

 export const dynamic = "force-dynamic";
@@ -60,6 +62,17 @@ export default async function StoryPage({
   const params = (await searchParams) ?? {};

   const exportMode = isOn(params, "export");
+
+  // V2.1 deck: ?deck=v2.1 routes to the new light-theme design system.
+  // Keeps all existing ?scene=N / ?safe / ?export / ?debug behaviour for
+  // the original deck when ?deck= is absent or set to anything other than
+  // "v2.1".
+  const deckParam = firstValue(params, "deck");
+  if (deckParam === "v2.1") {
+    const slideParam = firstValue(params, "slide");
+    const initialSlide =
+      slideParam != null && Number.isFinite(Number(slideParam))
+        ? Math.max(1, Math.floor(Number(slideParam)))
+        : 1;
+    return <PresentationV21 initialSlide={initialSlide} exportMode={exportMode} />;
+  }
+
   const safeMode = exportMode || isOn(params, "safe");
```

### What the diff does

- The V2.1 branch returns early. None of the original deck machinery runs.
- `PresentationV21` is a client component that manages its own keyboard
  navigation, viewport scaling, overlays, and state.
- `exportMode` from `?export=1` is forwarded. The V2.1 component hides the
  download button and download menu when `exportMode` is true.
- The `?slide=N` parameter (integer) is used instead of `?scene=N` so the
  two decks have non-colliding parameter names. The original `?scene=N`
  continues to work unchanged for the original deck.
- No stylesheet import is needed in `page.tsx` for the v2.1 branch because
  `PresentationV21.tsx` already imports `@/styles/presentation-v2-1.css`.

---

## How to make V2.1 the default after approval

Change the routing guard from `deckParam === "v2.1"` to `deckParam !== "v1"`:

```diff
-  if (deckParam === "v2.1") {
+  if (deckParam !== "v1") {
```

After that change, `/story` serves V2.1 by default. The original deck
remains available at `/story?deck=v1` for reference and regression testing.

---

## URL reference

| URL                           | Result                                   |
|-------------------------------|------------------------------------------|
| `/story`                      | Original deck (v1) -- no change          |
| `/story?deck=v2.1`            | V2.1 deck, slide 1                       |
| `/story?deck=v2.1&slide=5`    | V2.1 deck, starting at slide 5           |
| `/story?deck=v2.1&export=1`   | V2.1 export mode (no UI chrome)          |
| `/story?scene=3`              | Original deck, scene 3 (unchanged)       |

---

## Export pipeline

The existing export pipeline (`npm run export:deck`) uses Playwright and
PptxGenJS at 1920x1080 and reads `[data-story-scenes]` for metadata.

The V2.1 deck should NOT share this pipeline as-is. To add V2.1 export:

1. Create a new npm script: `export:presentation-v2-1`
2. Point it at `/story?deck=v2.1&export=1&slide=N` for each slide N
3. The export captures at 1920x1080 (the V2.1 slide is natively that size,
   scaled to fill the viewport via CSS transform -- at 1920px viewport it
   renders at exactly 1:1)
4. Speaker notes are available on `CORE_SLIDES[N].speakerNotes` and
   `APPENDIX_SLIDES[N].speakerNotes` from the data files

---

## Files introduced by V2.1

| File                                                             | Purpose                               |
|------------------------------------------------------------------|---------------------------------------|
| `src/styles/presentation-v2-1-tokens.css`                        | CSS custom properties (--pv21-*)      |
| `src/styles/presentation-v2-1.css`                               | Main stylesheet (imports tokens)      |
| `src/presentation-v2-1/components/PresentationV21.tsx`           | Root component, keyboard nav, state   |
| `src/presentation-v2-1/components/AgendaSlide.tsx`               | Slide 2 and A-key agenda overlay      |
| `src/presentation-v2-1/components/DownloadMenu.tsx`              | Download links panel                  |
| `src/presentation-v2-1/components/SlideRenderer.tsx`             | Layout-based core slide renderer      |
| `src/presentation-v2-1/components/AppendixSlideRenderer.tsx`     | Content-kind appendix renderer        |

Pre-existing data files (untouched):

| File                                                             | Purpose                               |
|------------------------------------------------------------------|---------------------------------------|
| `src/presentation-v2-1/data/core-story.ts`                       | 13 CoreSlide definitions              |
| `src/presentation-v2-1/data/appendix.ts`                         | 23 AppendixSlide definitions          |
| `src/presentation-v2-1/data/service-model.ts`                    | Service component and rollout data    |
| `src/presentation-v2-1/data/role-app-library.ts`                 | Role app catalogue and contract data  |

Files still needed before the deck ships:

| File                                                             | Purpose                               |
|------------------------------------------------------------------|---------------------------------------|
| `public/downloads/NFROS_Risk_Audience_Core_and_Appendix.pdf`     | Full deck PDF for download link       |
| `public/downloads/NFROS_Risk_Audience_Core.pdf`                  | Core-only PDF for download link       |
