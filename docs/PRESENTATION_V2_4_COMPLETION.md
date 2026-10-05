# Presentation V2.4 completion

Release record for the NFROS Risk Audience Presentation, V2.4. V2.4 was completed in place: same thirteen-slide core, same consulting storyline and exhibits, same light Accenture style. No V2.5 was created and no slide was redesigned into a different deck.

Starting point: commit `6c2cf46` on `main`. The before state is recorded in `docs/handoffs/presentation-v2-4-completion-audit.md` with screenshots in `docs/screenshots/presentation-v2-4-before/`.

## Where it runs

| URL | Opens |
| --- | --- |
| `http://localhost:3000/story` | V2.4, slide 1 |
| `/story?deck=current`, `/story?deck=v2.4` | V2.4 |
| `/story?deck=v2.4&core=N` | Core slide N (1 to 14 in play order) |
| `/story?deck=v2.4&appendix=app-XX&from=core-N` | Appendix topic with a return to core slide N |
| `/story?deck=v2.4&view=appendix-index` | Appendix index |
| `/story?deck=v2.3` | V2.3 comparison deck, unchanged |
| `/story?deck=v2.2`, `v2.1`, `legacy` | Earlier releases |

## Final play order

| # | Section | Title | Product proof |
| --- | --- | --- | --- |
| 1 | Opening | AI can return NFR capacity to judgment | |
| 2 | Opening | Agenda | |
| 3 | Complication | Fragmented work consumes capacity before judgment begins | |
| 4 | Complication | The burden between systems slows decisions and weakens continuity | |
| 5 | Answer | NFROS creates one engagement layer across existing risk platforms | |
| 6 | Proof | The workday starts with the next decision, already prepared | `or-home` |
| 7 | Proof | A shared core adapts to each risk role | `or-home`, `tprm-home` |
| 8 | Proof | Role Apps turn complete risk processes into reusable products | `tprm-onboarding-stage` |
| 9 | Proof | Automation expands capacity without shifting accountability | |
| 10 | Control | Trust is engineered into every material step | `evidence-review`, `decision-approval` |
| 11 | Value | The value case spans capacity, quality, control and continuity | |
| 12 | Scale | A modular service model scales through Function Packs and Role Apps | |
| 13 | Action | Start with two roles, prove the outcomes, then scale | |
| Close | | Questions and discussion | |

Trust (10) now precedes Value (11). Slides 3 and 4 remain separate. Every speaker note ends with a transition into the next slide; the full chain is in `docs/PRESENTATION_V2_4_FLIP_MAP.md`. Eight compact insights (at most 30 words, never repeating the title or subtitle) were added to slides 1, 3, 7, 8, 9, 10, 11 and 13; `docs/handoffs/presentation-v2-4-story-flow.md` records why the other slides have none.

## What changed

**Routing and metadata.** `/story` and `deck=current` open V2.4. The URL carries the full view state, so refresh, browser back and direct links work. Page metadata, the README and the download names describe V2.4.

**Real product proof.** Illustrative product panels were replaced with captures of the running Role Operating Systems (V3.3 light interface, synthetic demo day, read-only capture). The typed registry in `src/presentation-v2-4/product-proof/asset-registry.ts` drives capture, filenames, rendering, verification and export. The assets live in `public/presentation-assets/v2.4-final/`. Details: `docs/PRESENTATION_V2_4_PRODUCT_PROOF.md`.

| Asset | Route | Used on |
| --- | --- | --- |
| `or-home` | `/workday/rcsa` | Slides 6 and 7 |
| `tprm-home` | `/workday/tprm` | Slide 7 |
| `rcsa-process-stage` | `/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh` | Appendix A03 |
| `tprm-onboarding-stage` | `/workday/tprm/processes/third-party-onboarding?stage=evidence-review` | Slide 8 |
| `evidence-review` | same onboarding route, evidence status region | Slide 10 |
| `decision-approval` | `/workday/rcsa/decisions` | Slide 10 |
| `ai-partner` | AI Partner dock on `/workday/rcsa` | Appendix A06 |
| `meeting-preparation`, `actions`, `inbox-conversion`, `role-app-library` | Work Hub and process library | Registered, not placed on a slide |

**Accuracy.** Content that did not match the product was corrected:
- invented app names and roles on slides 5, 8, 12 and 13;
- the stage names on slide 8;
- "immutable" and "sealed" audit wording on slide 10;
- "every action" gate claims on slides 5 and 9.

The appendix states what is implemented, partial, demo or planned, including:
- Role App stage completion is not authority gated;
- segregation of duties is not enforced;
- sign-in sessions are not checked on routes;
- the audit hash chain covers seeded events only.

**Appendix.** Twenty-two slides cover all twenty topics. Each has an action title, an evidence subtitle, one visual, an implementation status and its evidence basis. They are grouped in the index under Product, Processes, Controls, Technology, and Service and rollout. Twenty-eight appendix references on the core slides each open their exact target. Details: `docs/PRESENTATION_V2_4_APPENDIX_NAVIGATION.md`.

**Presenter controls.**

| Key | Action |
| --- | --- |
| Left / Right | Previous / next slide |
| Home / End | First / last slide |
| A | Appendix index |
| C | Return to the core slide you came from |
| R | Replay the current slide only |
| M | Pause and resume motion |
| D | Downloads |
| F | Full screen |
| P | Speaker notes |
| ? | Help |

Every reveal completes within 4 seconds. Export, safe and reduced-motion modes render the final state.

**Downloads and exports.** The download menu offers:
- Core PDF;
- Full PDF;
- PowerPoint;
- Speaker notes.

The exporter reads the deck's own slide manifest at `deck=v2.4&export=1&safe=1`, waits for each slide's ready signal, and keeps appendix references clickable in the full PDF and the PowerPoint. It fails when product proof is missing. Details: `docs/PRESENTATION_V2_4_EXPORTS.md`.

**Copy.** No em dash and no double hyphen used as punctuation remain in human-facing content. That includes the Role OS product copy, the product seed data and the legacy V2.1 deck, which previously used a spaced double hyphen as an internal separator.

## Verification

Run on 5 October 2026 against the dev server on port 3000.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` (full unit suite) | 870 of 870 in 27 files |
| `tests/unit/presentation-v2-4-copy.test.ts` | 38 of 38 |
| Playwright: routes and all `presentation-v2-4-*` specs, 1920 and 1366 | 296 of 296. The full run passed 294; the two slide-counter tests that failed were fixed and passed on re-run with the navigation and accessibility specs (60 of 60) |
| Motion | Every core slide settles within 4 s; export, safe and reduced-motion modes render the final state; R replays only the current slide; M pauses and resumes |
| Accessibility (axe) | No serious or critical violations; the skip link now targets `<main id="main">` |
| `npm run check:copy` | Passes; no em dash or double-hyphen punctuation |
| `node scripts/check-no-emdash.mjs` | Passes |
| `npm run check:presentation-headlines` | 0 errors, 0 warnings |
| `npm run check:accenture-brand` | Passes in development mode (brand assets not configured) |
| `npm run scan:secrets` | Passes: source, bundles and exports |
| `scripts/verify-presentation-assets-v2-4.ts` | Passes: 6 core assets |
| `npm run export:presentation-v2-4` | 41 of 41 export checks |
| Layout audit (scratch tool), 14 slides, export 1920 and 1366, motion 1920, reduced 1440 | No overflow, clipping or occlusion; remaining flags are intentional (agenda badges on card edges, cover signal lines, closing orbits bleeding off the frame, timeline arrowheads) |

**Exports**, published to `public/downloads/` for the download menu:

| File | Content |
| --- | --- |
| `exports/NFROS_Risk_Audience_V24_Core.pdf` | 14 pages: the core and the close |
| `exports/NFROS_Risk_Audience_V24_Core_and_Appendix.pdf` | 37 pages, 95 internal links |
| `exports/NFROS_Risk_Audience_V24_Core_and_Appendix.pptx` | 37 slides with speaker notes, 95 internal links |
| `exports/NFROS_Risk_Audience_V24_Speaker_Notes.md` | All 37 slides in order |

The 95 links are:
- 28 appendix chips;
- 22 return controls;
- 22 index entries;
- 22 links back to the index;
- 1 link from the index back to the agenda.

**Screenshots and montages.**
- Before: `docs/screenshots/presentation-v2-4-before/`.
- Final: `docs/screenshots/presentation-v2-4-final/` (14 slides at 1920 x 1080, 1440 x 900 and 1366 x 768, plus `montage-core.png` and `montage-appendix.png`).

## Acceptance criteria

| # | Criterion | Status |
| --- | --- | --- |
| 1 | `/story` opens V2.4 | Met |
| 2 | `deck=current` opens V2.4 | Met |
| 3 | V2.3 remains accessible | Met (`deck=v2.3`) |
| 4 | Thirteen core slides remain | Met, plus the Q&A close outside the core |
| 5 | Trust appears before Value | Met (10 and 11) |
| 6 | Slides 3 and 4 remain distinct | Met |
| 7 | Flip map complete | Met |
| 8 | Transitions in speaker notes | Met, asserted by test |
| 9 | Insights compact and non-duplicative | Met, asserted by test (8 insights) |
| 10 | Real RCSA (Operational Risk) Home proof | Met: slides 6 and 7 |
| 11 | Real TPRM Home proof | Met: slide 7 |
| 12 | Real RCSA process proof | Met: appendix A03 (slide 8 gives its space to the TPRM stage so product text stays legible) |
| 13 | Real TPRM process proof | Met: slide 8 |
| 14 | Real evidence proof | Met: slide 10, from the onboarding evidence status (the V3 evidence drawer is an empty state) |
| 15 | Real decision and approval proof | Met: slide 10 |
| 16 | Real execution receipt proof | **Not met.** The seeded day has no executed decision, so no receipt exists to capture. See limitations |
| 17 | No core placeholder asset remains | Met: no missing-capture element on any slide; the exporter fails otherwise |
| 18 | Every appendix reference opens the exact target | Met: 28 of 28 |
| 19 | Return to origin works | Met |
| 20 | Browser back works | Met |
| 21 | Direct appendix URL works | Met |
| 22 | R replays the current slide | Met |
| 23 | M controls motion | Met |
| 24 | D opens downloads | Met |
| 25 | A opens the appendix index | Met |
| 26 | C returns to origin | Met |
| 27 | Core PDF succeeds | Met |
| 28 | Full PDF succeeds | Met |
| 29 | PowerPoint succeeds | Met |
| 30 | Speaker notes succeed | Met |
| 31 | PDF internal links work | Met: 95 links verified |
| 32 | PowerPoint internal links work | Met: 95 links verified |
| 33 | Exports use current V2.4 data | Met: live-deck cross-check |
| 34 | Exports use the light background | Met |
| 35 | Product proof appears in exports | Met |
| 36 | Metadata is current | Met |
| 37 | Copy checks pass | Met |
| 38 | Brand preflight passes | Met in development mode; client-facing mode needs the brand assets (see limitations) |
| 39 | Accessibility tests pass | Met |
| 40 | Visual tests pass | Met |
| 41 | Core montage approved | Reviewed; awaiting owner sign-off |
| 42 | Appendix montage approved | Reviewed; awaiting owner sign-off |
| 43 | Role Operating Systems not redesigned | Met: product changes are copy punctuation, one relative-time label fix, and capture region attributes |
| 44 | No client outcome invented | Met: value figures are labelled illustrative simulation targets |
| 45 | No production or compliance claim added | Met |
| 46 | No secret in assets or exports | Met: secret scan and export check |
| 47 | Human-facing em dashes absent | Met |
| 48 | Human-facing double-hyphen punctuation absent | Met, including product copy, seed data and V2.1 |
| 49 | V2.4 current only after manual review | Every slide reviewed at 1920 and 1366; owner review pending |
| 50 | Corrected presentation left running | Met: `http://localhost:3000/story` |

## Remaining limitations

- **Execution receipt.** A receipt exists only after "Confirm and execute". Capturing one needs a deliberate write to the demo database:
  1. back up the database;
  2. execute one decision through the real interface;
  3. capture the receipt;
  4. run `npm run demo:reset`.

  The owner approved this step, but the session's tool permissions blocked database writes, so it still has to be run by hand or with that permission granted. The confirm-result panel carries `data-presentation-region="decision-result"`, so the capture can target it like every other asset. Then:
  1. register the asset;
  2. set `assetId: "execution-receipt"` on the Receipt step of slide 10;
  3. re-export.

  Until then, slide 10 describes Execution, Receipt and Audit as thread steps, with no mock screenshot.
- **Brand mode.** Exports are marked "Development only". The approved Accenture logo, Greater Than symbol and Graphik font are not on this machine and must come from the Accenture brand team. Point `ACCENTURE_BRAND_ASSET_DIR` at a local folder holding them, outside the repository, then run `npm run export:presentation-v2-4 -- --client-facing`. That mode fails by design until the assets are present.
- **Export provenance.** The release commit is `e38f3ec`. The exports were regenerated from that clean tree, so their metadata and hash name it.
- **Fresh clones.** PDFs, PowerPoint and screenshots are gitignored. On a fresh clone the download menu shows "Not yet exported" until `npm run export:presentation-v2-4` runs. The product captures in `public/presentation-assets/v2.4-final/` are tracked, so the deck itself needs no capture step.
- **Capture side effect.** Opening the AI Partner dock during capture writes two activity rows each time; 22 rows have accumulated since the last reset. `npm run demo:reset` clears them, and also applies the corrected seed titles to the running database.
- **Pause.** Motion's JavaScript animations catch up on resume. Browser, SVG and timer-driven animations resume in place.
- **Legibility at 1366 x 768.** Text inside the product captures renders at roughly 9 screen pixels on slides 6 and 10. The callouts carry the message.
- **Not captured.** `operations-status` (the `/ops` console renders in the older dark style with overlapping sections) and `meeting-minutes` (the archive is empty in the seeded day).
- **Product note outside the deck.** The Work Hub meetings view shows raw ISO timestamps. It is not used on any slide.
