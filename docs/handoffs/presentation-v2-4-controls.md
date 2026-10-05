# Handoff: V2.4 navigation, presenter controls and appendix

Status: implemented and verified. Not committed.

## Files

New:

- `src/presentation-v2-4/components/deckModel.ts`: views, URL parsing and building, appendix
  order, canonical origin, export manifest.
- `src/presentation-v2-4/components/DeckNav.tsx`: navigation context and `DeckLink` (real
  href plus client navigation, `data-link-target`).
- `src/presentation-v2-4/components/SlideStage.tsx`: the shared 1920 x 780 stage.
- `src/presentation-v2-4/components/SlideFooter.tsx`: footer band (links, source, insight,
  synthetic data label, counter).
- `src/presentation-v2-4/components/AppendixSlide24.tsx`, `AppendixVisual24.tsx`,
  `AppendixIndex24.tsx`, `StatusBadge24.tsx`: appendix renderer, all eleven visual types,
  index and status badge.
- `src/presentation-v2-4/components/DownloadMenu24.tsx`, `DeckOverlays24.tsx`,
  `SlideNavPanel24.tsx`, `useDialogFocus.ts`: download menu, help, notes, pause pill, hover
  menu, dialog focus handling.
- `src/presentation-v2-4/motion/DeckMotion.tsx`: motion pause and `useDeckMotion()`.
- `tests/e2e/presentation-v2-4-navigation.spec.ts`.

Changed: `PresentationV24.tsx`, `CoreSlide24Dispatcher.tsx`, `SlideHeader.tsx` (optional
`aside` on the section label row), `SlideSource.tsx` (ref chips as links),
`styles/presentation-v2-4.css`, `exhibits/ValueTreeExhibit.tsx` and
`exhibits/EngagementLayerExhibit.tsx` (timers hold while paused),
`app/api/downloads/[filename]/route.ts` (V2.4 file names on the whitelist).

## URL state

State is a `DeckView`: core position, appendix id plus origin, or index plus origin. The
initial view comes from the page props. Every move calls `history.pushState` with the
canonical URL; a `popstate` listener parses `location.search` back into a view, so Back,
Forward and refresh all work. See `docs/PRESENTATION_V2_4_APPENDIX_NAVIGATION.md`.

## Motion pause (M)

`DeckMotionProvider` scopes the pause to the slide element:

1. `MotionGlobalConfig.useManualTiming = true` with `frameData.timestamp` frozen, so motion's
   JS animations hold.
2. Every WAAPI and CSS keyframe animation on the slide is paused (`Animation.pause()`); a
   frame-throttled `MutationObserver` plus a 250 ms sweep pauses anything created while
   paused. CSS transitions are left alone so hover feedback never sticks.
3. `svg.pauseAnimations()` on every SVG on the slide holds the SMIL particles.
4. `useDeckMotion()` returns `{ paused }`; the value tree count-up and the engagement layer
   boot timers keep their elapsed time and stop while paused.

Resume reverses each step. WAAPI, SMIL and the two timer-driven exhibits resume where they
stopped. Motion's JS animations return to the real clock and catch up: an offset clock is not
possible because motion sets each new WAAPI animation's `startTime` from its own clock. A
slide entered while paused renders its final state; R replays it (and resumes motion).

## Footer geometry (slide pixels)

- Exhibit area ends at y 968 (`AREA_BOTTOM` unchanged at 112).
- Footer rule at y 970. Top line y 976: ref chips (or return and index links) and the top of
  the insight box. Bottom line y 1056 (24 px margin): source note, insight box at most, and
  the counter.
- Columns: links and source x 64 to 1640 (to 944 when an insight is shown, chip icons
  hidden), insight x 960 to 1640 sized to its text (18 px, at most three lines, 80 px max),
  synthetic data label and counter x 1656 to 1856.

## Known limits

- `ServiceFactoryExhibit` drives its block counter with `setTimeout` and is outside this
  change; its count keeps stepping while motion is paused.
- Motion's JS animations jump forward on resume, as described above.
