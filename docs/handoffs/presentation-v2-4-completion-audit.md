# Presentation V2.4 completion audit

Audit of the checkout before the V2.4 completion work started. Screenshots of every slide at 1920 x 1080, 1440 x 900 and 1366 x 768 are in `docs/screenshots/presentation-v2-4-before/` (14 slides per viewport, captured after animations settled; zero console or page errors).

## Checkout

| Item | Value |
| --- | --- |
| Branch | `main` |
| Commit | `6c2cf46` (feat: V2.4 cover, agenda and Q&A bookends with reinvented core slides) |
| Server | `next dev -p 3000` from this repository |
| AI mode | `safe` (default `NFR_DEMO_MODE`) |

## Routing and metadata

| Item | Before |
| --- | --- |
| Default deck at `/story` | V2.3 (`PresentationV23`) |
| `?deck=current` | V2.3 |
| `?deck=v2.4` | V2.4, reading only `core` and `export` |
| `?deck=v2.3`, `v2.2`, `v2.1` | Their own decks |
| `?deck=legacy`, `v1`, `v2` | Original StoryDeck |
| `?core=abc` on V2.4 | Blank page (NaN slide index) |
| `appendix`, `from`, `safe` on V2.4 | Ignored |
| Page metadata | Title "Live the NFR Day: presentation"; description still named V2.3 |

## Slide order and copy

Fourteen slides played in this order. The Q&A close was counted as a core slide, which conflicts with the thirteen-slide core.

| # | Section | Title | Subtitle |
| --- | --- | --- | --- |
| 1 | Opening | AI can return NFR capacity to judgment | A role-based operating system connects daily work, complete processes and governed execution |
| 2 | Opening | Agenda | Five questions take us from the case for change to the path to scale |
| 3 | Complication | Fragmented work consumes capacity before judgment begins | Signals, evidence, meetings and actions sit across disconnected systems |
| 4 | Complication | The burden between systems slows decisions and weakens continuity | Search, reconciliation, coordination and rework create four recurring points of friction |
| 5 | Answer | NFROS creates one engagement layer across existing risk platforms | The operating system coordinates daily work, process execution and control without replacing systems of record |
| 6 | Proof | The workday starts with the next decision, already prepared | Now, Next and Done focus attention while the AI Partner handles routine coordination |
| 7 | Proof | A shared core adapts to each risk role | Operational Risk and TPRM use common services while retaining distinct methods and judgments |
| 8 | Proof | Role Apps turn complete risk processes into reusable products | Each app links required sources, AI preparation, human gates, execution and monitoring |
| 9 | Proof | Automation expands capacity without shifting accountability | AI runs repeatable work; professionals retain interpretation, challenge and approval |
| 10 | Value | The value case spans capacity, quality, control and continuity | Benefits should be measured against the bank's own baseline, not generic benchmarks |
| 11 | Control | Trust is engineered into every material step | Evidence, permissions, approvals, execution receipts and audit remain linked by design |
| 12 | Scale | A modular service model scales through Function Packs and Role Apps | The core platform is reused while the App Factory adds and improves complete processes |
| 13 | Action | Start with two roles, prove the outcomes, then scale | A three-step design-partner journey creates an evidence-based decision to proceed |
| 14 | Close | Questions and discussion | Three questions to shape the next step together |

Findings:

- Value (10) played before Trust (11); the authority question raised on slide 9 was answered one slide late.
- Slide 2 is titled "Agenda" and slide 1 is a visual cover, both at the presenter's explicit request after this prompt's title list was written. Both are kept; see "Decisions" below.
- No core slide carried a supporting insight, and no speaker note ended with a transition into the next slide.

## Appendix

- Data: 18 slides in `src/presentation-v2-4/data/appendix.ts` (app-01 to app-11, app-13 to app-17, app-20, app-22). Ids app-12, 18, 19 and 21 do not exist.
- Renderer: none. Nothing in the app imported `APPENDIX_SLIDES_V24`.
- Index: none.
- References: 24 core references, all resolving to an existing appendix id. In the UI all 24 were effectively broken: a chip click only toggled a "Back to core" button and never changed the slide.
- Duplicates: app-02 and app-05 list the same Demo apps; app-01, app-02 and app-22 overlap on scope; app-07 repeats app-11 on evaluation and app-20 on data handling; app-15 nearly repeats core slide 13; app-09 repeats the core authority matrix; app-13 overlaps core slide 12.
- Missing topics against the required list: identity and entitlements, audit, operations and recovery, integration architecture, App Factory, evidence and provenance, DACH context.

## Presenter controls (before)

| Key | Behaviour before | Defect |
| --- | --- | --- |
| Right, Space | Next slide | None |
| Left | Previous slide | None |
| R | Jumped to slide 1 | Must replay the current slide |
| M | Toggled an unused state | Did not affect motion |
| D | No-op | No download menu existed |
| A, C | Toggled the "Back to core" button | No agenda, no appendix index, no return to origin |
| Home, End, F, P, ? , Escape | Not handled | Missing |
| URL | Never updated | No browser back, no hard refresh |

## Downloads and exports

- No download menu in V2.4.
- `package.json` scripts pointed at files that did not exist: `export:presentation-v2-4` (`scripts/export-presentation-v2-4.ts`), `verify:presentation-exports` (`scripts/verify-presentation-exports-v2-4.ts`), and four Playwright specs (`presentation-v2-4-exhibits`, `-product-proof`, `-typography`, `-motion`).
- The V2.3 exporter imports V2.2 data and its PDF link positions are hard-coded estimates; it is not reusable for V2.4 as is.
- Stale exports: `exports/` and `public/downloads/` held V2.1 output (metadata `deckVersion "v2.1"`, commit `bc17e0e`).

## Product proof

- No V2.4 exhibit rendered a product image; `WorkdayProductExhibit` ignored its data and hard-coded an illustrative product panel.
- Illustrative product panels on slides that claim to show the product: slide 6 (workday home), slide 7 (role pods), slide 8 (process stage cards and form fill), slide 11 (evidence, approval and receipt cards).
- Placeholder images: all ten PNGs in `public/presentation-assets/v2.3/` are identical 8,563-byte placeholders (`placeholder: true`); `public/presentation-assets/v2.2/` holds only a README.
- The V2.3 capture script sets `presentationCapture=1&mode=safe` flags that the app never reads, establishes no session, and points several assets (decision, receipt, evidence, AI Partner) at the work hub rather than the real screens.
- Product facts relevant to capture: no login is needed; the V3 evidence drawer is an empty state, so current-UI evidence proof comes from the onboarding evidence-review stage; the live demo database had drifted from the seeded day (RCSA showed "2 open, 1 recorded today"). A consistent backup was taken before any reset.

## Punctuation

- V2.4 source: no em dash, en dash or spaced double hyphen.
- Repository: 50 em or en dashes in 14 files (older V2.2 and V2.3 slide comments, capture script messages, the dash constants inside three checker scripts, and five handoff documents). All were replaced during this work; the checker constants now use escape sequences.
- `scripts/check-no-emdash.mjs` also reports an "unsupported-percentage" rule across scenario data and V2.3 typography tokens. Those are product data and older deck files outside this scope; they are recorded, not changed.

## Visual defects

From the layout audit (clipping, overflowing, covered or overlapping text, contrast, rendered size under 12 px) on all slides in animated, reduced-motion and export modes: no high or medium defects. Remaining minor items:

- Slide 5 console used a ">" character as a row marker, which reads as the Greater Than symbol used as an arrow.
- Slide 13 sub-bullets used a "›" marker.
- Export mode still rendered the hover slide strip and the "Back to core" button.

## Tests (before)

| Check | Result |
| --- | --- |
| `tests/unit/presentation-v2-4-copy.test.ts` | Passed (33), but asserted 14 core slides and the old Value before Control order |
| `tests/e2e/presentation-routes.spec.ts` | 1 failure: expected `/story` to render the V2.1 container |
| Missing spec files referenced by `package.json` | 4 |
| `scripts/check-accenture-brand.ts` | Passed with warnings, but scanned only V2.2 and V2.1 folders, not V2.4 |
| `scripts/check-no-emdash.mjs` | Failed (dashes above plus the pre-existing percentage rule) |
| Accessibility | No axe test covered `/story` |

## Decisions taken for the completion

- Keep the thirteen-slide core. The Q&A slide becomes a separate closing slide (`CLOSING_SLIDE_V24`) that plays after slide 13 and is not counted in the core.
- Keep the visual cover as slide 1 (its title is the slide 1 title from the brief) and keep the agenda titled "Agenda", both explicit presenter requests that postdate the brief's title list.
- Move Trust (now slide 10) before Value (now slide 11); slide ids follow the play order.
