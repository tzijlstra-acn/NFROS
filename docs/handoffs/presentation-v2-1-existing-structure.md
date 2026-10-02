# Presentation V2.1 Existing Structure

Audited at commit `bc17e0e`. This document is the reference for Wave 2 implementation agents. It lists every file that belongs to the presentation surface, what each file does, and the recommended disposition.

---

## Route

| Path | What it does | Disposition |
|---|---|---|
| `app/story/page.tsx` | Server component. Reads `?scene`, `?safe`, `?export`, `?step`, `?debug` query params. Publishes `[data-story-scenes]` export contract JSON. Renders StoryDeck. Imports `@/styles/presentation.css`. Single deck, no `?deck=` routing. | Keep. V2.1 will extend this file to also import `presentation-v2-1-tokens.css` and pass any new V2.1 props to StoryDeck. |

---

## Presentation components

All files live in `src/components/presentation/`.

| File | What it does | Disposition |
|---|---|---|
| `StoryDeck.tsx` | Client component. Owns the full deck surface: keyboard map (14 bindings), auto reveal timer, fullscreen API, presenter notes panel, help overlay, chapter rail, progress indicator, tap zones, scene counter. Accepts `scenes`, `chapters`, `initialSceneNumber`, `initialStep`, `safeMode`, `exportMode`, `debug`, `entryHref`, `durationLabel`. Determinism switch: `immediate = safeMode || exportMode || reducedMotion`. | Keep. V2.1 may add a new prop (e.g. a token profile name) but the component structure should not be rewritten. |
| `SceneView.tsx` | Client component. Scene frame (100dvh geometry contract: scene -> inner -> screen -> stage). Visual router: switches on `visualKind` exhaustively across all 16 visual kinds. Imports all chapter scene components and all step-count constants. Exports `STEP_COUNTS`, `collectCrossSceneContent`, `hasBackgroundReveal`. | Keep. Adding a new scene kind requires adding its component to the switch here. |
| `parts.tsx` | Client component. Presentation primitives: `Reveal` (data-shown based state wrapper), `StageFit` (scales content that exceeds its container), `Metric` (value + mandatory basis label), `SceneBoundary` (error boundary), `StaticSceneFallback` (never-blank failure path), `clockSpan` (time arithmetic), `BackgroundRevealPanel`. | Keep. These primitives are used by every scene component. |
| `Grid5.tsx` | Client component. The 5x5 group risk matrix, shared by scenes 9 and 11. Renders two positions joined by a bracket when they disagree. Appetite boundary computed from scale product (stepping cell edges), not drawn by eye. No node position transitions. | Keep. Shared between two scene components. |
| `hero-adapters.ts` | Pure module. Adapters from `StoryScene` content payloads to the prop shapes of the six hero visualisation components. Functions: `constellationProps` (scene 7/8), `riskControlProps` (scene 8 morph target), `dependencyProps` (scene 12), `portfolioThreadProps` (scene 14), `extractObjectRefs`, `supplierNameMap`. Does not invent data -- where story data is absent, props are left unset. | Keep. Any new scene that reuses a hero visualisation should add its adapter here. |
| `scenes-chapter-1.tsx` | Client component. Scene components for chapter I (scenes 1, 2, 3): `CoverScene`, `SignalClutterScene`, `DecisionCardCollapseScene`. Exports step counts: `COVER_STEPS`, `CLUTTER_STEPS`, `DECISION_COLLAPSE_STEPS`. | Keep. |
| `scenes-chapter-2.tsx` | Client component. Scene components for chapter II (scenes 4, 5): `WorkLaneLadderScene`, `LensSwitcherScene`. Exports: `LANE_LADDER_STEPS`, `LENS_STEPS`. | Keep. |
| `scenes-chapter-3.tsx` | Client component. Scene components for chapter III (scenes 6, 7, 8, 9, 10, 11): `SupplierExposureScene`, `RoleMorphScene`, `DualPositionMatrixScene`, `DecisionQueueScene`, `WorkshopTableScene`, `CycleChangeScene`. Exports step counts for each. | Keep. |
| `scenes-chapter-4.tsx` | Client component. Scene components for chapter IV (scenes 12, 13, 14): `EventFanOutScene`, `SixLensGridScene`, `PortfolioThreadScene`. Exports: `EVENT_FAN_OUT_STEPS`, `SIX_LENS_STEPS`, `PORTFOLIO_THREAD_STEPS`. | Keep. |
| `scenes-chapter-5.tsx` | Client component. Scene components for chapter V (scenes 15, 16): `AuthorityLadderScene`, `PhaseRoadmapScene`. Exports: `AUTHORITY_LADDER_STEPS`, `PHASE_ROADMAP_STEPS`. | Keep. |

---

## Stylesheets

All files live in `src/styles/`.

| File | What it does | Disposition |
|---|---|---|
| `presentation.css` | Main presentation stylesheet. Owns the four-layer scene geometry contract (100dvh, inner, screen, stage). Defines all `.story-*` classes used by StoryDeck and SceneView. Defines `.scene-*`, `.reveal-*` and all motion / transition rules. Includes `[data-safe="true"]` overrides that collapse durations to 1ms. | Keep as the V1 active stylesheet. V2.1 should import `presentation-v2-1-tokens.css` alongside it rather than modifying it, unless a geometry defect is found. |
| `presentation-v2-1-tokens.css` | V2.1 design token set. IBM Plex Sans (400, 500, 600) and IBM Plex Mono (400), self-hosted in `public/fonts/`. All custom properties use the `--pv21-` prefix, fully isolated from product tokens. @font-face declarations for offline rendering. NOT yet imported by `app/story/page.tsx`. | Extend. This file is ready. Wave 2 must add `import "@/styles/presentation-v2-1-tokens.css"` to the story page alongside the existing presentation.css import. Do not rename or move it. |

Other stylesheets in `src/styles/` (`globals.css`, `tokens.css`, `workday-v2.css`, `workday-v3.css`, etc.) belong to the interactive workday surface and must not be modified as part of presentation work.

---

## Data source

| Path | What it does | Disposition |
|---|---|---|
| `src/scenario/data/story.ts` | Single source of truth for all 16 scenes and 5 chapters. Exports: `STORY_SCENES` (StoryScene[]), `STORY_CHAPTERS` (StoryChapter[]), `STORY_COPY_RULES`, `SYNTHETIC_DATA_LABEL`, `REGULATORY_LABEL`, `storyDurationLabel()`, `getSceneByNumber()`, all content payload types and the `VisualKind` union. ~3,300 lines. | Do not change scene count or IDs without updating the export pipeline, the chapter rail, and every scene component that references a hard-coded scene number. V2.1 may add new fields to `StoryScene` but must not remove or rename existing ones. |

---

## Scripts

| Path | npm script | What it does | Disposition |
|---|---|---|---|
| `scripts/export-deck.ts` | `npm run export:deck` | Playwright-driven capture. Starts the dev server if not running. Walks all 16 scenes, captures per-step frames at 1920x1080 with `?export=1`. Assembles PDF and PowerPoint via PptxGenJS. Reads `[data-story-scenes]` JSON from the page for speaker notes. Outputs to `exports/`. | Keep. V2.1 should verify the export still produces correct artefacts after any token or layout change. |
| `scripts/capture-screens.mjs` | `npm run capture:v1`, `npm run capture:v2` | Screen capture for the interactive workday (not the presentation deck). | Not related to presentation. Do not confuse with export-deck. |

---

## Existing exported artefacts

These are build outputs in `exports/`, not source files. They are produced by `npm run export:deck` and should be regenerated after any V2.1 change.

| File | Description |
|---|---|
| `exports/NFR_WorkOS_DACH_Banking.pdf` | Current deck export as PDF |
| `exports/NFR_WorkOS_DACH_Banking.pptx` | Current deck export as PowerPoint |
| `exports/NFR_WorkOS_Speaker_Script.md` | Speaker script extracted from presenter notes |
| `exports/scenes/` | Per-scene captured frame images |

---

## Self-hosted fonts

| File | Used by |
|---|---|
| `public/fonts/ibm-plex-sans-400.woff2` | presentation-v2-1-tokens.css |
| `public/fonts/ibm-plex-sans-500.woff2` | presentation-v2-1-tokens.css |
| `public/fonts/ibm-plex-sans-600.woff2` | presentation-v2-1-tokens.css |
| `public/fonts/ibm-plex-mono-400.woff2` | presentation-v2-1-tokens.css |
| `public/fonts/geist-sans.woff2` | Product workday surfaces |
| `public/fonts/geist-mono.woff2` | Product workday surfaces |
| `public/fonts/inter.woff2` | Product workday surfaces |
| `public/fonts/jetbrains-mono.woff2` | Product workday surfaces |
| `public/fonts/space-grotesk.woff2` | Product workday surfaces |

The IBM Plex fonts are already present. No font download step is needed before enabling presentation-v2-1-tokens.css.

---

## Files that do NOT exist yet (to be created in Wave 2)

Wave 2 agents must create these. They do not exist at the audited commit.

| File to create | Purpose |
|---|---|
| No files are known to be missing for the import activation -- only the import statement in `app/story/page.tsx` needs adding | Activate V2.1 tokens |

If Wave 2 requires new scene components, new hero visualisations, or a new CSS layer, each should be placed in the directories established by this structure: scene components in `src/components/presentation/`, hero visualisations in `src/components/visualisations/`, CSS in `src/styles/`. Do not create parallel directories.
