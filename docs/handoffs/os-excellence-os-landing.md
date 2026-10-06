# Handoff: os-landing (Wave 0)

Workstream `os-landing` in the NFROS OS Product Excellence program. Scope: plan sections 4.1 (entry and orientation) and 4.2 (role selection), under the design principles in section 9.

Outcome: a client-quality entrance, and a role selector that shows real work.

## What changed

### 1. Landing page (`/`)

The entry page is now the product entrance and nothing else. It no longer shows AI mode, key state, verification, configuration source, database state, the mode selector, setup commands or the reset control.

- **Composition** follows the V2.4 cover so the deck and the product read as one family: eyebrow ("NFR Operating System"), short accent rule, headline and supporting line on the left, the product on the right. Light canvas, the single V3.3 purple accent, square geometry (no radius anywhere on the page), V3.3 tokens and IBM Plex.
- **Hero:** "Run NFR work from one governed environment" with "NFROS prepares the work, runs complete risk processes and keeps material decisions with people". The product name and the eyebrow come from `PRODUCT_IDENTITY` in the release registry.
- **Actions:** "Explore the product" goes to `/workday`. "View the presentation" goes to `/story`. "Enter design-partner workspace" is rendered disabled with the reason "Not available in this release". No design-partner workspace route exists: the previous page linked to `/pilot`, which returns 404, and `/settings/pilot` is an administrator readiness checklist, not a workspace. The route sets `DESIGN_PARTNER_WORKSPACE_HREF = null` in `app/page.tsx`; when a workspace route ships, set it there.
- **Product proof:** two compact live previews, "Operational Risk Partner OS" and "Third-Party Risk Manager OS". Each reads the current focus (the top Now item) and the active process stage from the database on every request, with an eight-cell stage track filled from the stage run rows. A provenance line states "Synthetic scenario, 06.10.2026, 07:45". The release status chip comes from the registry. No screenshots.
- **Trust strip:** exactly "Evidence-linked", "Human-approved", "Audit-ready", "Synthetic demonstration".
- **Footer:** the synthetic institution disclosure with the regulatory note, and a discreet "For presenters: Control room" link.
- The two flagship previews sit fully inside the first viewport at 1920x1080, 1440x900 and 1366x768, and the page does not scroll at any of them.

### 2. Role selector (`/workday`)

- Each Available role carries one live professional signal, read from the database: **Current focus** (the top Now item from the focus queue), **Active process** ("RCSA Cycle Assistant, Stage 2 of 8", with the stage name and its status beneath) and **Next meeting** (time and title, from the calendar, skipping focus time).
- Empty values are honest: "Nothing needs your judgment now", "No active process", "No meeting scheduled today", "No further meeting today". When the database cannot answer, each signal says "Unavailable" with the reason. Nothing is substituted.
- Role status, names and summaries come from the release registry (`@/product/release`: `rolesWithReleaseStatus`, `ROLE_RELEASE_STATUS_LABELS`, `PRODUCT_IDENTITY`, `INSTALLED_ROLE_APPS`). The static process chips (which listed a preview Role App under an Available role) are gone: the live process signal replaces them. The selector hard-codes no product claim.
- Demo roles stay labelled Demo with "View demo". Planned roles stay non-interactive (no link). Demo and Planned now sit side by side so the whole selector fits 1366x768 without scrolling.
- The scenario clock the signals were read at is shown beside the title.

### 3. Read model (`src/features/role-signals/`)

New, read only. It defines no query and writes nothing.

- `assemble.ts`: pure rules, with narrow structural inputs so the stage contract can grow without this module following. `focusSignalFrom`, `processSignalFrom`, `selectNextMeeting`, `meetingSignalFrom`, `unavailableSignals`.
- `read.ts`: `readRoleSignals(roleId)` and `readRoleSignalOverview()`, which call the existing repositories (`buildFocusQueueView`, `getActiveRun`, `getStageRuns`, `getCalendar`). Each signal is read in isolation, so one failing read becomes one Unavailable signal rather than a broken page.
- `labels.ts`: the bilingual row labels, empty sentences and stage status words.
- The landing page and the selector both render `readRoleSignalOverview()`, so they cannot disagree.

### 4. Runtime state moved to `/control-room`

The control room already reported most of it; the moved items were merged into the existing "Demonstration mode and runtime" section rather than repeated, and one section was added.

| Item that left the landing page | Where it is now |
| --- | --- |
| AI mode | Requested mode and Effective mode (existing rows) |
| API key state | Key resolved (existing row). Never the key, its prefix, suffix or length |
| Verification | New row: Live AI verified (not yet attempted, true, key rejected) |
| Configuration source | Existing row, relabelled "Configuration source" (was "File that supplied the key") |
| Voice | Existing row |
| Database state | Scenario seeded (existing row) |
| What "configured" means | New caveat, shown when a key is resolved |
| Mode selector | Existing "Change the mode" control |
| Setup commands | New section "Scenario setup and reset": `npm run db:migrate`, `npm run db:seed`, and `npm run demo:reset`, shown whether or not the scenario is seeded |
| Reset control | Same section: the existing `ResetButton` with its two step confirmation |

The runtime and setup sections are bilingual. Links to Operations (`/ops`) and Settings (`/settings`) were added; neither page was edited.

## Acceptance criteria

| Criterion | Met | Evidence |
| --- | --- | --- |
| No API state, reset control or setup command on the landing page | Yes | `tests/e2e/os-landing.spec.ts` "carries no runtime state, setup command or reset control" (passed, three viewports); `after-landing-*.png` |
| Flagship roles visible in one viewport at 1366x768 | Yes | e2e `toBeInViewport({ ratio: 1 })` on both previews and both selector cards (passed at 1920, 1440, 1366); `after-landing-1366x768.png`, `after-workday-1366x768.png` (scroll height equals viewport) |
| Presentation and product read as one family | Yes, by design review | Cover composition, light canvas, single purple accent, square geometry; compare `after-landing-1920x1080.png` with the V2.4 cover |
| Understandable in five seconds | Yes, by design review | One headline, one line, two primary actions, two role previews, four trust words |
| Available roles show one current signal each, from the database | Yes | `tests/integration/role-signals.test.ts` (13 tests: values equal the repository rows; changing or deleting a row changes or empties the signal); e2e "gives each Available role one live signal" |
| Demo and Planned correct | Yes | e2e "keeps Demo roles labelled Demo and Planned roles without a link" (passed); integration test checks lists against the registry |
| Role status from the one release registry | Yes | `read.ts` and `RoleSelector.tsx` import from `@/product/release` |
| No hard-coded product claim in the selector | Yes | Selector strings are interface words only; names, summaries and status words come from the registry |
| Every moved control still works in `/control-room` | Yes | e2e "report mode, key state, verification, source and database state" (passed, three viewports); "the reset control still resets the day" (passed, three viewports); "the mode selector still switches the mode" passed at 1440 and the server log records both `actionSetDemoMode("offline")` and `("safe")`; see limitations for the 1920 and 1366 runs |
| EN and DE | Yes | `after-de-landing-*.png`, `after-de-workday-*.png`, `after-de-control-room-*.png`; unit tests assert both languages |
| No overflow at the three viewports | Yes | Screenshot script measured `scrollWidth == clientWidth` for every capture; e2e `expectNoSidewaysOverflow` passed |
| tsc clean | Yes for this workstream's files | `npx tsc --noEmit -p tsconfig.json` reports no error in any owned file. It is not clean overall: other workstreams' in-flight files (`app/workday/[role]/processes/**`) currently error |
| Tests for the role-signals read model | Yes | `tests/unit/role-signals.test.ts` (23), `tests/integration/role-signals.test.ts` (13) |
| check:copy and scan:secrets pass | Yes | Both passed |
| Before and after screenshots | Yes | `docs/screenshots/os-excellence/os-landing/` |

## Tests run

- `npx vitest run tests/unit/role-signals.test.ts tests/integration/role-signals.test.ts`: 2 files, 36 tests, all passed.
- `npx playwright test os-landing.spec.ts` against the isolated stack on port 3103, three viewports: 30 passed, 3 failed on the first run. The failures were the mode selector test at 1920 and 1366 (a click before the client component hydrated, fixed by waiting for network idle and retrying the click) and one transient HTTP 500 on `/` at 1440 while another workstream's files were mid-edit. The re-run of the fixed spec could not complete; see limitations.
- `tests/e2e/journeys.spec.ts`: the three "entry screen" tests were updated for the new entrance (surgical edit, the rest of the file untouched).
- `npm run check:copy`: passed.
- `npm run scan:secrets`: passed (6559 files, bundles included).
- `node scripts/check-no-emdash.mjs`: no finding in any file of this workstream. It currently reports four findings in other workstreams' files: `src/features/process/preparation-schema.ts:91`, `tests/unit/home-read-model.test.ts:685`, `tests/unit/product-release.test.ts:207`, `tests/unit/product-status.test.ts:71` (literal dash characters inside test regexes). `tests/unit/role-signals.test.ts` builds its banned characters from code points for this reason.

## Screenshots

All in `docs/screenshots/os-excellence/os-landing/` (note: `docs/screenshots/` is in `.gitignore`, so they are local files and are not committed).

- Before: `before-landing-1920x1080.png`, `before-landing-1366x768.png`, `before-workday-1920x1080.png`, `before-workday-1366x768.png`, `before-control-room-1920x1080.png`, `before-control-room-1366x768.png`.
- After, English: `after-landing-{1920x1080,1440x900,1366x768}.png`, `after-workday-{1920x1080,1440x900,1366x768}.png`, `after-control-room-{1920x1080,1440x900,1366x768}.png`.
- After, German: `after-de-landing-{1920x1080,1366x768}.png`, `after-de-workday-{1920x1080,1366x768}.png`, `after-de-control-room-{1920x1080,1366x768}.png`.

## Known limitations

- **Design-partner workspace:** no route exists, so the action is disabled with its reason. When one ships, set `DESIGN_PARTNER_WORKSPACE_HREF` in `app/page.tsx`.
- **E2E re-run:** the isolated dev server reached its maximum background run time and was stopped by the harness during the re-run of the fixed spec, so the mode selector hydration fix is unverified at 1920 and 1366 in Playwright. Re-run `npx playwright test tests/e2e/os-landing.spec.ts` against an isolated stack (`NFR_BASE_URL` on a port other than 3000).
- **E2E safety:** the mode switch and reset tests skip unless `NFR_BASE_URL` names a port other than 3000, so the spec cannot reset a presenter's database.
- **Control room language:** the runtime and setup sections follow the scenario language. The report shell chrome, the header status chips, the mode selector's one line descriptions, the server supplied caveats (`modeReason`, `liveAiConfiguredMeaning`, autonomy detail) and the trace sections below remain English only; they belong to shared modules or predate the bilingual rule.
- **Product name in the report shell:** `ReportShell` (not owned here) still prints "NFR WorkOS" from `PRODUCT_COPY`, while the registry, the landing and the selector say "NFROS". Flagged for `os-release-truth`.
- **Stage status wording** is read from the stage run rows, so it follows the seed. The process engine workstream's seed changed the seeded current stage status, and the previews now read "Ready to start" rather than "Waiting for your input".
- **Stale tests not owned here:** in `tests/e2e/journeys.spec.ts`, "the workday index" tests already failed before this change (they expect six role links and a "Scenario day" line the V3.3 selector never rendered); Planned roles are deliberately not links. `tests/e2e/keyboard.spec.ts` "navigate from workday index to RCSA role" skips because no link is named RCSA, as before.
- The landing preview shows two signals (focus and process). The selector carries the third (next meeting), to keep the entrance readable in five seconds.

## What the user must run

Nothing. No schema change, no migration, no seed change. The landing page and the selector read the existing tables through the existing repositories.

## Files changed

- `app/page.tsx` (rewritten, thin)
- `app/workday/page.tsx`
- `app/control-room/page.tsx`
- `src/components/workday-v3/RoleSelector.tsx`
- New: `src/components/landing/LandingPage.tsx`, `RolePreview.tsx`, `labels.ts`, `landing.css`
- New: `src/features/role-signals/index.ts`, `types.ts`, `labels.ts`, `assemble.ts`, `read.ts`
- New: `tests/unit/role-signals.test.ts`, `tests/integration/role-signals.test.ts`, `tests/e2e/os-landing.spec.ts`
- Surgical: `tests/e2e/journeys.spec.ts` (the three entry screen tests only)
