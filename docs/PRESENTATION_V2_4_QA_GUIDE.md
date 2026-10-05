# NFROS Presentation V2.4: QA guide

How the V2.4 deck (`/story?deck=v2.4`) is tested, what each automated check means, and how to read a failure. Results of the latest run are in `docs/handoffs/presentation-v2-4-qa.md`.

## 1. Running the suite

The specs reuse the server on `http://localhost:3000` (start it with `npm run dev` if nothing is listening).

```bash
# Everything V2.4, at projector resolution
npx playwright test tests/e2e/presentation-v2-4-*.spec.ts --project=desktop-1920

# Viewport-sensitive specs at the smallest supported projector size
npx playwright test tests/e2e/presentation-v2-4-accessibility.spec.ts tests/e2e/presentation-v2-4-brand.spec.ts tests/e2e/presentation-v2-4-typography.spec.ts --project=desktop-1366

# Type check (the specs are part of the TypeScript project)
npx tsc --noEmit -p tsconfig.json
```

Single specs also have npm scripts: `test:presentation-exhibits`, `test:presentation-product-proof`, `test:presentation-typography`, `test:presentation-motion`.

When several people or agents run Playwright at once, give each run its own output folder (`--output=<folder>`). The default `test-results/` is cleared at the start of every run, which deletes another run's traces and fails it with an `ENOENT` on a trace file.

## 2. URLs the specs use

| URL | Shows |
| --- | --- |
| `/story?deck=v2.4&core=N` | Play position N, 1 to 14 (13 core slides, then the closing Q&A) |
| `/story?deck=v2.4&appendix=app-XX` | One appendix slide |
| `/story?deck=v2.4&view=appendix-index` | The appendix index |
| add `&export=1&safe=1` | Export mode: final state at once, no presenter chrome |

## 3. What each spec checks

| Spec | Slides | Mode | Fails when |
| --- | --- | --- | --- |
| `presentation-v2-4-accessibility` | Cover, core 3, core 9, closing, first appendix slide in the manifest, appendix index, help overlay (key `?`) on core 3 | Reduced motion, settled | axe-core (default rule set: WCAG 2.x A and AA plus best practice) reports a serious or critical violation. Moderate and minor violations and "needs review" results are printed and attached as annotations. |
| `presentation-v2-4-brand` | Core 1 to 14, then every appendix entry and the index from `script[data-presentation-slides]` | Reduced motion, settled | Visible text (text nodes and `::before`/`::after` content) contains an em dash, en dash, spaced double hyphen, an arrow glyph, an angle quote or triangle used as a marker, or ">" used as a marker; "Synthetic institution and data" is not visible; a standard slide is not light; the cover or closing slide is not brand purple. The appendix test is skipped, with a reason, if the manifest is missing. |
| `presentation-v2-4-typography` | Core 1 to 14 | Reduced motion, settled | Any visible text run renders below 12 px in slide pixels; a text line extends outside an ancestor that clips overflow; the `.pv24-title` size differs between standard slides (2 to 13). |
| `presentation-v2-4-exhibits` | Core 1 to 14 | Live after the reveal, and export mode | No exhibit frame or no visible exhibit text; the placeholder still renders; text or a painted box leaves the visible frame; two text runs overlap anywhere on the slide; any console error or uncaught page error. |
| `presentation-v2-4-motion` | Core 1 to 14 plus key tests on core 3 | Live, export, reduced motion | At 4.2 s after the slide mounts a finite animation is unfinished or an element is still fading in; in export or reduced motion anything is still animating or moving 300 ms after mount; `R` changes the slide or does not restart the reveal; `M` leaves animations running or elements moving, or a second `M` does not resume. |
| `presentation-v2-4-product-proof` | Core 6, 7, 8, 10 | Reduced motion | No `[data-product-capture]` figure, or any figure marked `data-capture-missing="true"`; no `<img>` from `/presentation-assets/v2.4-final/` with `naturalWidth > 0`; any image path contains "placeholder"; any referenced image file does not return HTTP 200. Optimiser URLs (`/_next/image?url=`) are unwrapped first. |

## 4. Measurement rules

- **Slide pixels.** The slide is a 1920 x 1080 canvas scaled to the viewport. Sizes are computed font size times the cumulative transform scale (SVG text uses its screen CTM, which includes the viewBox), divided by the slide scale (`slide width / 1920`). Results are the same at every viewport.
- **Visible text.** Not `display: none`, not `visibility: hidden`, not inside a clipped screen-reader-only element, and cumulative opacity of at least 0.05.
- **Clipping tolerance.** 2 px horizontally; at the top 15% of the font size (the empty band above cap height inside a line box), at the bottom 5%.
- **Exhibit frame.** `.pv24-exhibit` intersected with `.pv24-exhibit-area`. A clipping container that covers the whole frame (an exhibit root, a 16:9 ratio box) does not count as a bound, so content it cuts at the frame edge is reported. On the full-bleed cover and closing slides the frame is the slide and decorative SVG geometry may bleed off the edge.
- **Overlap.** Each text line is reduced to its glyph band (line box minus 20% at top and bottom); two bands from different text runs may not intersect by more than 4 square slide pixels.
- **Background.** A screenshot of `.pv24-slide` is decoded in the test. Standard slides need a median luminance of at least 0.75 and at least 60% light pixels. Full-bleed slides need a median luminance of at most 0.2 and a purple mean colour (red and blue well above green).
- **Reveal complete.** At 4.2 s after the slide content mounts, `document.getAnimations()` holds no finite animation that is not `finished`, and no element whose opacity is below 1 then rises and holds steady over the next 1.8 s.

## 5. Intentional loops

Infinite animations (particles, pulses, SMIL `repeatCount="indefinite"`) never count against the reveal. A loop built from repeated finite animations, for example a timer that restarts a sequence, does count unless its subtree carries the `data-pv24-loop` attribute. Mark only true loops; the first pass of the story the presenter talks to must still complete within 4 seconds.

## 6. Reading a failure

Each assertion message names the slide and lists the offending elements with their text and slide-pixel position, so the owner can find the element without a trace. Owners:

| Failure | Owner area |
| --- | --- |
| Exhibit content, overlap, clipping, reveal timing on one slide | That slide's exhibit in `src/presentation-v2-4/exhibits/` |
| Header, footer, counter, synthetic label, keys, overlays, manifest | Navigation, `src/presentation-v2-4/components/` |
| Appendix slides and index | Appendix data and components |
| Product images | Product captures, `public/presentation-assets/v2.4-final/` |

## 7. Manual checks the suite does not cover

- [ ] Projected on the room's screen, the smallest text reads from the back row.
- [ ] `F` enters and leaves full screen (browsers block this in automation).
- [ ] The download menu (`D`) files open and match the live deck.
- [ ] Presenter notes (`P`) show the right notes for the slide and do not cover slide content on the presenter screen.
- [ ] Each reveal reads in the order the presenter speaks to it.
