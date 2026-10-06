# Handoff: os-shell

Workstream `os-shell` in the NFROS OS Product Excellence program. Scope: header truth (audit T06, T07), the release gate on every route (R08), global search, the command palette and Updates (J28, plan section 4.12), accessibility contrast (U01) and the runtime key statement (T21), under plan sections 9.1 and 9.2.

Isolated stack: port 3108, database `<scratchpad>\os-shell.db` (migrated to 0005 and seeded), dist directory `.next-os-shell`, `NFR_DEMO_MODE=safe`. Nothing was written to `data/nfr-workos.db` and nothing was clicked on port 3000.

---

## 1. What changed

### 1.1 Header truth (T06, T07)

Every count in the header and the rail is now read through the function its destination reads, in `src/db/repositories/header.ts`:

| Count | Before | After | Destination it matches |
|---|---|---|---|
| Decisions rail badge | Every `open` row in `decisions` (5 for rcsa, 6 for tprm at 07:45) | `countOpenDecisions(role, atMoment)`: `getDecisions` filtered to `open`, the read `buildDecisionQueueView` uses, so it filters on `presentedAtMoment` (3 and 3 at 07:45) | The Decisions queue's "N open" |
| AI Partner control | "1 suggestion" for any number | `countSuggestionsNeedingYou`: `getActiveSuggestions` (moment, snooze and validation filters) with the dock's own "needs you" rule; "1 suggestion needs you", "N suggestions need you", or Monitoring | The dock's Suggestions tab |
| Updates bell and bottom bar | Unread seeded arrivals, a list no V3.3 surface displayed | `readUpdates(role).raised.length`, after the notification budget; the bell shows the number, not just a dot | The Updates panel, which opens on exactly those rows |
| Home rail item | The same unread arrival count | No count | Home's only number ("N need your judgment") comes from the focus queue, which the frame must not build |

The header model now also carries the role's release state, and a gated role counts nothing. The dead "Previous interface" menu item (it linked to `?ui=current`, the same interface, audit R09) is removed rather than repointed; whether earlier interfaces stay reachable is a release decision.

### 1.2 The release gate on every route (R08)

`src/workday/role-gate.ts` holds the one rule, from the release registry (`getRoleRelease`, `rolesWithReleaseStatus`):

- **Available** (rcsa, tprm): every route opens as before.
- **Demo** (control-assurance, incident-resilience): every route shows the role's release page inside the frame, in the current interface, whatever `?ui=` asks for. The header shows the Demo chip beside the role and offers no Search, Updates or AI Partner control; the rail carries no count.
- **Planned** (regulatory-change, nfr-governance): no route can be entered. The request is redirected (307) to `/workday?unavailable=<role>`, and the role selector says "Regulatory Change Manager is Planned. It is not part of this release, so it cannot be opened." The parameter is checked against the registry, never echoed.

It is applied in two places that both import the rule:

- `middleware.ts` (primary): the redirect for Planned roles, and pinning Demo roles to `v3.3` so `?ui=v1` and `?ui=v2` can no longer serve the interactive earlier shells.
- `src/workday/dispatch.tsx` (second line): every workday page is built by `createWorkdayPage`, which now redirects a Planned role and returns the release page for a Demo role before any interface is chosen. This covers a page reached without the middleware.

`PreviewRolePage` is now bilingual, reads the status word from the registry, uses V3.3 tokens instead of its own failing grey, and states only what is true: the role's purpose, that it is not part of this release, and which roles are. The API routes for search and Updates refuse a gated role (403).

### 1.3 Global search, the command palette and Updates (J28, plan 4.12)

Read models:

- `src/features/search/`: `types.ts`, `copy.ts`, `match.ts` (pure matcher and grouping), `stored.ts` (recent and pinned, pure), `commands.ts` (the eight commands, pure), `routes.ts` (where an object opens), `read.ts` (server: the role's scope), `index.ts` (client-safe surface).
- `src/features/updates/`: `types.ts`, `copy.ts`, `classify.ts` (what is material and what settles it, pure), `budget.ts` (the notification budget, pure), `read.ts` (server), `actions.ts` (the one write: mark an arrival read), `index.ts`.
- Thin routes: `app/api/workday/search/route.ts`, `app/api/workday/updates/route.ts`.
- Shell components: `src/components/shell/CommandPalette.tsx`, `UpdatesPanel.tsx`, `ShellOverlays.tsx`, `shell.css`, mounted by `WorkdayAppFrame` inside the one chrome provider.

**Search.** The palette fetches the role's scope once per opening (about 260 entries for rcsa) and filters locally, so typing is instant and nothing about the database reaches the browser.

- *Kinds:* risks, controls, assessments, suppliers, services, contracts, evidence, meetings, minutes, actions, decisions and process runs, grouped under their professional names in both languages, in the role's order (work first, then the role's own registers: assessments, risks, controls for the Operational Risk Partner; suppliers, services, contracts for the Third-Party Risk Manager). A group holding an exact reference match leads.
- *Scope:* the role's own work (its meetings and minutes, the actions on its desk by the Work Hub's rule, its decisions as the Decisions page shows them now, its running processes) and the registers of the role's legal entity only. Evidence that has not arrived on the scenario clock is not in the list. The palette states the scope: "Searching Operational Risk Partner work and records for Arcadia Bank AG."
- *Matching:* every word of the query must appear in the entry (label, reference, identifier, detail or keywords), not a subsequence of letters (the V2 matcher's defect). German letters typed with umlauts match the ASCII forms.
- *Where a result opens:* a work item in the Work Hub with it selected; a decision on Decisions; a process at its current stage; a register object in the running process that covers it, else the Work Hub filtered to its work (the convention `related.ts` set); evidence in the covering process, else at the decision citing it, else its subject's work.
- *Recent and pinned:* kept in local storage per role, because the product has no table for them and this workstream does not change the schema. The palette says "Recent and pinned items are kept in this browser only." Both lists are reconciled against the scope on every opening, so storage can never surface an object out of scope or route somewhere stale.
- *Keyboard:* ARIA combobox and listbox. Arrow keys move (wrapping), Home and End jump, Enter runs, Escape steps out of a narrowed search and then closes, Backspace on an empty query widens it, Tab stays inside the dialog, focus returns to the trigger. Results are announced politely.

**Commands** (plan order): Open current work, Open next meeting (the role selector's own rule, `selectNextMeeting`), Find supplier, Find control, Open current process, Review decisions (with the badge's count), Ask AI (closes the palette and calls the chrome's existing `toggleDock`; nothing in the dock changed), Open evidence (the selected Work item's evidence in the context drawer, else evidence search). A command with nothing to open is listed disabled with its reason ("No further meeting today", "No active process"). No command writes anything.

**Updates.** Driven by `listOsEvents` with the seeded arrivals read through it. Six material categories, in priority order: execution failed, process blocked, your input is needed, deadline, material change, new work from a routine.

- *States, not messages:* a stage task, decision, approval or held preparation stays listed until the later backbone event that ends it (task completed, decision recorded, approval granted, preparation started again, stage completed). A decision the scenario put in front of the role stays until it is taken. These cannot be dismissed, because dismissing them would hide work.
- *Messages:* high or critical arrivals and prepared work from background routines can be marked read (`actionMarkUpdateRead`, which names the route's role rather than the scenario's acting role).
- *Deadlines:* the backbone has no deadline event, so actions due today or tomorrow, or overdue, are read from the action register on the scenario date. This is stated in the code and below.
- *The notification budget:* one update per thing (two events about one decision raise one update), at most five raised, at most three per kind. What the budget holds back is listed behind a disclosure that says how many and why. The badge counts only what is raised.

At 07:45 on the seeded day the Operational Risk Partner has three updates (the DEC-2026-0771 decision, the Stage 2 evidence sufficiency task, the overdue PR-SR-02 action) and the Third-Party Risk Manager four.

### 1.4 Contrast (U01)

Tokens in `src/styles/workday-v3-tokens.css` (the V3.3 token file; `workday-v3.css` holds component rules and no colour tokens):

| Token | Theme | Before | After | Worst surface ratio after |
|---|---|---|---|---|
| `--wd-text-muted` | light | `#7b8494` (3.77:1 on white, 3.49:1 on the canvas) | `#5a6372` (6.07:1 on white, 5.61:1 on the canvas) | 5.22:1 on the accent tint |
| `--wd-text-disabled` | light | `#a0a8b5` (2.40:1 on white) | `#636c7c` (5.29:1 on white, 4.90:1 on the canvas) | 4.56:1 on the accent tint |
| `--wd-text-muted` | dark | `#8d96a5` (passed, 4.91:1 worst) | `#9aa3b2` | 5.75:1 |
| `--wd-text-disabled` | dark | `#6a7382` (3.06:1 worst) | `#8d96a5` | 4.91:1 |
| `--wd-on-accent` (new) | light / dark | white literal | `#ffffff` / `#171c24` | 5.46:1 / 7.37:1 on the accent |
| `--wd-accent-hover` (new) | light / dark | `#4c40e0` literal | `#4c40e0` / `#bdb7ff` | 6.74:1 / 9.27:1 with on-accent text |

Placeholders read `--wd-text-disabled` (decision rationale) or `--wd-text-muted` (palette), so both now pass. `.wd-btn-primary` reads the two new tokens instead of literals (the only rule touched in `workday-v3.css`). The role selector's Planned rows dropped an `opacity: 0.6` that took muted text to 2.59:1 (surgical edit).

### 1.5 The runtime key statement (T21)

`liveAiConfiguredMeaning` in `src/server/config/runtime.ts` is now `describeKeyResolution(configured, verified)`, one of four fixed sentences: no key resolved; a key in the expected form resolved and not verified; a key resolved and a live call accepted; a key resolved and the last live call rejected. None interpolates anything, so none can carry the key, a prefix, a suffix or a length. The control room still shows it only when a key is resolved, so it is now true wherever it appears, and the health endpoint is true in every case.

### 1.6 Shell defects found while testing

- **A closed AI Partner dock stayed on screen.** The dock is hidden with the `hidden` attribute so its conversation survives, and `.wd-panel { display: flex }` outranked it. `shell.css` adds `.wd-panel[hidden] { display: none }`. `workday-v3-a11y.spec.ts` "Escape closes an open panel" failed on this and now passes. The dock's own code is untouched.
- **Closing the dock dropped keyboard focus.** `toggleDock` in `ChromeContext.tsx` now remembers what opened it, as `openDrawer` already did; "Ask AI" passes the control that opened the palette.
- **Two identical skip links.** The root layout and the frame both rendered "Skip to main content". The frame's copy is removed; the root layout's remains first in every document.
- **The header spec tested a rail that no longer exists.** `tests/e2e/workday-v3-header.spec.ts` listed the eight V3.1 segments (`/my-work` answered 404) and iterated all six roles. It now lists the V3.3 rail (Home, Work, Processes, Decisions) and skips Planned roles, which have no frame.

---

## 2. Acceptance criteria

| Criterion | Met | Evidence |
|---|---|---|
| Header counts match their destinations | Yes | `tests/integration/os-shell.test.ts`: the Decisions badge equals `buildDecisionQueueView(...).rows.length` for both roles at 07:45, 11:45, 15:00 and 16:30, and is 3 where the table holds 5 and 6 open rows; the AI count equals the dock's needs-you count and follows dismissal and the clock; the Updates count equals `readUpdates(...).raised.length` at all four moments. Browser: `os-shell.spec.ts` "the Decisions badge is the queue's open count" (rail aria-label equals the queue's "N open"), "the Updates count is the number of updates the panel opens on" (bell `data-count` equals the panel rows and the bottom bar), "the AI Partner control states the number", at 1920, 1440 and 1366. Screenshots `after-decisions-badge-rcsa-*`, `after-home-rcsa-*`. |
| Planned and Demo roles gated on every route, with tests | Yes | Unit `tests/unit/os-shell-gate.test.ts`: the rule for all six registry roles on six segments; the middleware called with real requests (307 to `/workday?unavailable=...` for Planned under `?ui=v1` and `?ui=v2`; Demo pinned to `v3.3`; Available untouched); the dispatcher with mocked request APIs (Planned redirected and Demo given the release page from V1, V2 and V3.3). Browser: four Planned paths and five Demo paths (including `?ui=v1`, `?ui=v2`) at three viewports. Screenshots `after-demo-role-decisions-*`, `after-planned-role-refused-*`. |
| Search groups by professional object type | Yes | Unit "grouping by professional object type" (role kind order, bilingual group names, five per group with the rest counted, an exact reference leads); browser "states its scope, groups results by object type" (one group per type). |
| Search uses the role and legal-entity scope | Yes | Integration "covers all twelve object types", "keeps registers to the role's legal entity" (TP-0023, the AT and CH assessments and every non-ARC-DE document absent), "keeps work to the role, and decisions and evidence to what the day has shown" (DEC-2026-0772 absent at 07:45 and present at 11:45; tprm decisions and meetings absent for rcsa). Browser "never shows an object outside the legal entity". |
| A result opens in the correct product surface | Yes | Integration "opens every result on a workday surface of the same role" (process run and the supplier under onboarding open at the current stage; another supplier opens its linked work; decision, action and meeting open on Decisions and the Work Hub item). Browser: CTL-PAY-014 by keyboard lands on the RCSA process or its linked work; Find supplier, Veridian, Enter lands on the onboarding stage. |
| Recent and pinned objects | Yes, client side | Kept in local storage per role, as the brief allows when no storage exists; the palette says so. Unit tests for order, limits, malformed storage and reconciliation; browser "remembers recent objects and pins" survives a reload. |
| Keyboard navigation | Yes | Browser "moves with the keyboard and keeps focus in the dialog" (ArrowDown, ArrowUp wrapping, `aria-activedescendant`, Tab trapped, Escape closes, focus returns to Search); Control K opens and closes; Enter runs the active option. |
| Command palette: the eight commands | Yes | Unit "lists the plan's commands in the plan's order", "marks a command with nothing to open as unavailable"; integration "builds the commands from the day"; browser: order, Find supplier, Review decisions, Open current process, Open next meeting, Ask AI opens the dock through `toggleDock`, Open evidence narrows to evidence with nothing selected. |
| Updates: a real list from the backbone, material only, under a budget | Yes | Unit `os-shell-updates.test.ts` (each category, each settling event, arrivals, deadlines, recency, the budget); integration "Updates on the seeded day" (the seeded task, the decision raised once, the overdue action; a taken decision drops; a high arrival raised until read, only arrivals readable; never more than the budget, nothing duplicated). Browser "lists only material updates, each opening on its surface", "an update opens the work it names", "an arrival can be marked read and the count follows" (run with the isolated clock at 16:30). Screenshots `after-updates-*`, `after-updates-1630-*`. |
| Contrast passes axe on the four main pages for both roles | Yes | Browser `os-shell.spec.ts` axe block: no serious or critical violation and no `color-contrast` on Home, Work, Processes and Decisions for rcsa and tprm, at three viewports; the same sweep in German and in the dark theme. With the old two tokens injected, the same pages report 3 to 20 contrast nodes each. `workday-v3-a11y.spec.ts` and `accessibility.spec.ts` axe tests pass. |
| T21 truthful | Yes | Unit "the runtime key statement": never claims a key when none was resolved, distinguishes not verified, accepted and rejected, four fixed sentences with no key detail. `/api/health/ai` on this machine reports the resolved, not verified sentence. |
| EN and DE; no overflow at three viewports | Yes | Every capture measured `scrollWidth - clientWidth = 0` and no palette, panel, header or bar clipped, at 1920, 1440 and 1366 in English and 1920 and 1366 in German (`capture-*.json` in scratch). German screenshots `after-*-de-*`. |
| tsc clean | Yes | `npx tsc --noEmit -p tsconfig.json` exited 0 at the final run. (Earlier runs showed errors only in other workstreams' in-flight files.) |
| vitest | Yes | See section 3. |
| Playwright for search, palette, Updates and gating on my port | Yes | `tests/e2e/os-shell.spec.ts`, see section 3. |
| check:copy, check-no-emdash for my files, scan:secrets | Yes | `npm run check:copy` passed; `check-no-emdash` finds nothing in my files (its one error is `tests/unit/rcsa-stages.test.ts:162`, another workstream's); `npm run scan:secrets` passed. Every file I wrote is pure ASCII. |
| Screenshots | Yes | `docs/screenshots/os-excellence/os-shell/`, section 4. |
| Handoff | Yes | This file. |

Product rules held: no flagship role or installed Role App added; release states unchanged (read, never written); analyst navigation still Home, Work, Processes, Decisions with AI Partner, Search and Updates in the shell; no command or update writes anything material, and the only write (an arrival's read mark) is per role and refuses a gated role; no schema change; the "Synthetic institution and data" label stays in the bottom bar and on the role selector.

---

## 3. Tests run

| Command | Result |
|---|---|
| `npx vitest run tests/unit/os-shell-search.test.ts tests/unit/os-shell-updates.test.ts tests/unit/os-shell-gate.test.ts tests/integration/os-shell.test.ts` | 4 files, 69 tests passed (last run, after the final edits to these files) |
| `npx vitest run tests/unit` | 31 files, 893 tests passed |
| `npx vitest run tests/integration` | 19 files, 439 tests passed |
| `npx playwright test tests/e2e/os-shell.spec.ts` on port 3108, all three projects (105 tests) | 100 passed, 5 skipped, 0 failed (19.8 min). The skips were the two Updates journeys that checked before the panel had loaded and found nothing to act on; the spec now waits for the loaded state (next row). |
| `os-shell.spec.ts` Updates journeys with the isolated clock at 16:30, 1440 | 6 passed; then, with the wait added, "an update opens the work it names" and "an arrival can be marked read and the count follows": 2 passed |
| `accessibility.spec.ts` on port 3108, 1440 | 8 passed (Entry, Role selector, and Home, Decisions and Processes for both roles) |
| `workday-v3-a11y.spec.ts` on port 3108, 1440 | All 12 axe tests passed, including the Demo and Planned role routes. "The skip link" and "Escape closes an open panel" failed first (two skip links; a closed dock stayed visible) and passed after the fixes in 1.6. "Visible focus", "context drawer focus return" and "collapsed rail dot" passed before the last edits. |
| `workday-v3-header.spec.ts` on port 3108, 1440 | Before the spec update: "exactly one application header on every segment" passed for all four framed roles, "loading skeleton" and "held open" passed; the failures were the stale V3.1 segments (`/my-work` 404) and three tests that predate V3.3 (the error boundary test relies on a V2 `matchMedia` crash, the degraded header test documents that no request can reach it). |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 at the final run |
| `npm run check:copy` | passed |
| `node scripts/check-no-emdash.mjs` | clean for my files |
| `npm run scan:secrets` | passed |
| Scripted axe sweep (scratch), 8 pages, EN and DE, light and dark | 0 serious or critical and 0 contrast in light EN and DE; dark: one node on `/processes`, see limitations |

Playwright ran with a scratch copy of the config that drops `webServer`: the repo config starts `npm run start` on port 3000 when nothing listens there, which would serve the shared database. Port 3000 was not listening during this work; the first run of my spec used the repo config and Playwright attempted that start before running against 3108. No test reached port 3000 and nothing was written to the shared database, but use `--config` with a copy that has no `webServer` (or keep the dev server on 3000 running) when testing an isolated port.

---

## 4. Screenshots

`docs/screenshots/os-excellence/os-shell/` (local; `docs/screenshots/` is ignored by git):

- Before, copied from the audit's frozen before-stack: `before-rcsa-journey-search-click-en-1440x900.png` (Search opens nothing), `before-rcsa-journey-updates-en-1440x900.png` (the bell opens nothing), `before-rcsa-decisions-en-1920x1080.png` and `-1366x768.png` (badge 5 beside "3 open"), `before-rcsa-home-en-1440x900.png`, `before-global-role-selector-en-1440x900.png`.
- After, English at 1920x1080, 1440x900 and 1366x768: `after-home-rcsa-*`, `after-palette-rcsa-*` (the eight commands), `after-palette-query-rcsa-*` (grouped results), `after-palette-find-supplier-tprm-*`, `after-updates-rcsa-*`, `after-updates-tprm-*`, `after-decisions-badge-rcsa-*`, `after-demo-role-decisions-*` (`/workday/control-assurance/decisions?ui=v2`), `after-planned-role-refused-*` (`/workday/regulatory-change/decisions`).
- After, English at 16:30 on the isolated clock: `after-updates-1630-rcsa-*`, `after-updates-1630-tprm-*` (five raised, five held back, a readable material change).
- After, German at 1920x1080 and 1366x768: the same scenes as `after-*-de-*`.

---

## 5. Known limitations

- **Three last edits are not browser verified.** The isolated server reached the two-hour background limit twice; the second time it stopped part way through the final regression run and was not restarted. Covered by tsc and the unit, integration and earlier browser runs, but not re-run in a browser after the edit: `toggleDock` remembering its opener (the a11y spec "closing the AI partner dock returns focus"), Control K closing the palette through the same path as Escape, and the updated segment list in `workday-v3-header.spec.ts`. Run `NFR_BASE_URL=<isolated> npx playwright test tests/e2e/os-shell.spec.ts tests/e2e/workday-v3-a11y.spec.ts tests/e2e/workday-v3-header.spec.ts` with a config that has no `webServer`.
- **Messages in search come from another workstream.** While this work was in progress the Work Hub inbox work added a thirteenth kind, `message`, to `src/features/search` (`types.ts`, `copy.ts`, `read.ts`, through `readInboxSearchEntries`). My unit and integration tests pass with it; the browser runs above predate it.
- **Recent and pinned are per browser.** Local storage, per role; clearing the browser clears them, and they do not follow the person. A table would be the fix and is a schema change.
- **Deadlines are read from the action register.** The backbone has no deadline event and nothing publishes one, so "Deadline" reads actions due today or tomorrow, or overdue, on the scenario date. A deadline event, if one is ever published, should replace this source.
- **Routine work.** No code publishes `routine-completed` yet. The rule is defined (`createdCount`, or a non-empty `createdWork`, `createdIds` or `created` in the payload) and tested; today the only routine source is the seeded background-work arrivals.
- **Header counts follow revalidation.** The frame is a layout, so its counts refresh when a server action revalidates the workday (every write path does) or the route refreshes. The Updates panel reads the list fresh on every opening and refreshes the route when the two disagree, so the bell catches up the moment it is opened. A clock advanced in another tab is not pushed to this one.
- **The Home rail item carries no count.** The only number Home shows comes from the focus queue, which the frame must not build.
- **Demo roles keep the rail.** Every rail item of a Demo role opens the same release page; the header names the Demo state on every route.
- **Search payload size.** About 125 KB per opening for rcsa, mostly evidence titles. Fine for the synthetic corpus; a real corpus needs the same matcher run server side (it is pure and can move).
- **Stored values stay English in German.** Risk taxonomy, supplier names, contract titles, stage event summaries and the registry's release labels are stored in English.
- **Dark theme.** The light theme is the default and passes. In the dark theme the "Open" link on the Processes cards (`app/workday/[role]/processes/v3.tsx`, inline `#fff` on the accent) measures 2.32:1; the tokens cannot reach an inline literal. `--wd-on-accent` exists for that owner to use.
- **Older specs that enter gated roles.** `tests/e2e/workday-v2.spec.ts:722` (records a decision as nfr-governance), `workday-v2-live-day.spec.ts` (control-assurance, incident-resilience and planned roles) and `journeys.spec.ts:349` (incident-resilience timeline) exercise Demo and Planned roles interactively under the V2 interface, the behaviour R08 removes. They were not changed; they need to move to an Available role or assert the gate.
- **Remaining header items from the audit.** The Account menu still links to Trust, Control room and Settings, and Display and demo still offers Demo mode and Presentation (D02, D03); the bottom bar's demo-mode "Play the day" link still points at `?ui=current` (R09); the V3.3 shell still has no language control (J29); `<html lang>` is fixed to `en` in `app/layout.tsx` (U08). The palette and the panel set `lang` on themselves. These are release and layout decisions outside this brief.
- **Next 16 middleware warning.** The dev server warns that the `middleware` file convention is deprecated in favour of `proxy`. The gate works as is; renaming is a separate change.
- **Route-level gates remain.** `app/workday/[role]/v3.tsx` and `work/v3.tsx` still check the release state themselves. They are now unreachable for gated roles (the dispatcher returns first) and harmless.

---

## 6. What the user must run

Nothing. No schema change, no migration, no seed change. The dev server picks up the middleware and the shell on reload.

---

## 7. Files changed

Owned by this workstream:

- `src/db/repositories/header.ts`
- `src/components/workday-v3/WorkdayHeader.tsx`, `WorkdayHeaderClientActions.tsx`, `WorkdayUpdatesBar.tsx`, `WorkdayAppFrame.tsx`, `ChromeContext.tsx` (`toggleDock` only), `PreviewRolePage.tsx` (the release page)
- New: `src/components/shell/CommandPalette.tsx`, `UpdatesPanel.tsx`, `ShellOverlays.tsx`, `shell.css`
- `middleware.ts`; `src/workday/dispatch.tsx` (gate); new `src/workday/role-gate.ts`
- New: `src/features/search/` (`types.ts`, `copy.ts`, `match.ts`, `stored.ts`, `commands.ts`, `routes.ts`, `read.ts`, `index.ts`) and `src/features/updates/` (`types.ts`, `copy.ts`, `classify.ts`, `budget.ts`, `read.ts`, `actions.ts`, `index.ts`)
- New: `app/api/workday/search/route.ts`, `app/api/workday/updates/route.ts`
- `src/styles/workday-v3-tokens.css` (colour tokens); `src/styles/workday-v3.css` (`.wd-btn-primary` reads the two new tokens; nothing else)
- `src/server/config/runtime.ts` (T21 wording only)
- New tests: `tests/unit/os-shell-search.test.ts`, `tests/unit/os-shell-updates.test.ts`, `tests/unit/os-shell-gate.test.ts`, `tests/integration/os-shell.test.ts`, `tests/e2e/os-shell.spec.ts`

Surgical edits outside the brief:

- `app/workday/page.tsx` and `src/components/workday-v3/RoleSelector.tsx` (os-landing): the refused-role note for the Planned redirect, and the Planned rows' opacity that failed contrast.
- `tests/e2e/workday-v3-header.spec.ts`: the V3.3 rail segments, and Planned roles skipped.
- `CHANGELOG.md`: entries under 4.1.0.

---

## 8. For other workstreams

- `os-decisions`: the rail badge is `countOpenDecisions` in `header.ts`, which reads `getDecisions` exactly as `buildDecisionQueueView` does, and `tests/integration/os-shell.test.ts` pins the two together. If the queue starts listing stage decisions or changes its visibility rule, change `countOpenDecisions` with it. Search and Updates link decisions as `/workday/<role>/decisions#<id>`, the convention `related.ts` uses; if the queue adopts a selecting parameter, `routes.ts` and `read.ts` are the places to change.
- `os-process-engine`: Updates reads `human-task-created`, `decision-requested`, `approval-requested`, `ai-preparation-held`, `ai-preparation-failed`, `tool-executed` (failed outcomes), `source-changed`, `routine-completed` and `stage-opened` (not executable), and is settled by `human-task-completed`, `decision-recorded`, `approval-granted` (by tool name, and the app's `stageCompletionToolName` for completion), `ai-preparation-started` and `-completed`, and `stage-completed`, all by correlation id (the stage run). Keep the payload keys `taskKey`, `decisionKey`, `toolName`, `toolKey`, `state` and `outcome` stable. A routine that wants to raise "new work" should put `createdCount` or `createdWork` in its payload. The Processes card's inline `#fff` fails contrast in the dark theme; `var(--wd-on-accent)` is the token for it.
- `os-workhub`: search and Updates open Work items with `itemHref` and `workHref` from `src/features/work/url.ts`, and register objects with `?view=actions&object=<id>`. "Open evidence" reads `useBoundContext(role).evidence` and opens the drawer through `openDrawer("evidence")`.
- AI Partner wave: the palette opens the dock with `chrome.toggleDock(trigger)` only. The `.wd-panel[hidden]` rule in `shell.css` is what keeps a closed dock hidden; if the dock gets its own stylesheet, move the rule there.
- Release manager: the gate reads `getRoleRelease`; changing a role's state in `role-release.ts` changes every route, the header, search and Updates together.
