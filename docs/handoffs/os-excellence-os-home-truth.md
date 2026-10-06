# Handoff: os-home-truth (Wave 0, plan section 4.3)

Outcome: Home is state driven. It shows no fabricated count, no fallback event or action, and no hard coded Partner Pulse. Every region is read from rows by one read model, `readHomeView` in `src/features/home`. A region with nothing to say states that in words (Empty), and a source the database cannot answer is reported as Unavailable.

## What changed

### Removed (file and line at the starting commit `f5a1ffb`)

| Audit row | What it was | Where |
|---|---|---|
| T01 (critical) | Partner Pulse: two hard coded sentences per role (rcsa "Scanned calendar and prepared RCSA Challenge Workshop brief, followed up 2 overdue actions ... triaged 4 inbox items"; tprm "Checked Veridian evidence request status ..."). Any role other than tprm fell back to the rcsa text. It rendered whenever any routine row was `active`, whatever the routines had done. | `app/workday/[role]/v3.tsx:199-311` (component), `:212-221` (`summaryText`), `:223` (`?? summaryText["rcsa"]`), `:208` and `:422-428` (guard), `:444-448` (render) |
| T02 | "Open actions" fell back to 4 (rcsa) or 3 (tprm) when the count was 0, and the count left out `overdue`. | `v3.tsx:393-398` |
| T03 | Inbox fell back to "2 need attention" when the count was 0. "All reviewed" (a claim the data did not support) was the only zero text. | `v3.tsx:400-405`, `:108` |
| T04 | "Next meeting" was the first calendar row of the day, whatever the clock, including focus time. | `v3.tsx:382-391` |
| T26 | Dead links: Partner Pulse "Ask" to `#partner`, "Review" to the inbox. | `v3.tsx:274-306` (removed with the component) |
| J06 | The Now card did not answer "By when?". | `src/components/workday-v3/RoleHome.tsx:240-247` |
| (Done) | Done counted grouped rows (5) rather than units of work, and listed decisions the person made under "Handled automatically". | `RoleHome.tsx:155`, `:375-398` |
| J05 (Home part) | After a decision was recorded, the suggestion that prepared it returned to Now as "Review and accept or change it", and the inline AI line kept offering it. A suggestion whose decision is no longer open is now spent: it leaves the queue and the inline line, and stays in the Partner update as history linked to the decision. | `src/db/repositories/focus.ts`, `suggestionCandidates`; `src/features/home/read.ts` |
| (Empty Now) | The empty Now card repeated the context line directly above it. It now says what would appear there. | `RoleHome.tsx` |

Grep evidence (code, comments excluded) is asserted by `tests/unit/home-read-model.test.ts` ("the Home source files contain no fallback count, fallback list or hard coded partner summary"): no `fallback`, `PartnerPulse`, `summaryText`, either Pulse sentence, a `> 0 ? raw` substitution or a per-role number substitution in `v3.tsx`, `RoleHome.tsx`, the two Home components or the read model.

### Added

- `src/features/home/` (new):
  - `types.ts`: the Home view model (Now, Next, Your day, Partner update, Done) with `present`, `empty` and `unavailable` states and `LineageRef`.
  - `assemble.ts`: pure rules, tested without a database (Your day, Partner update statements with lineage, Done, the working-day window, what changed).
  - `read.ts`: `readHomeView(roleId, state)`, the only call the route makes. Every source is read through a guard; a source that throws becomes Unavailable rather than breaking Home or passing as empty.
  - `lineage.ts`: one link builder per destination. Personal work uses the Work Hub's own `itemHref`, decisions use the Decisions anchor, stages use the process page with `?stage=`.
  - `sources.ts`: `HOME_DATA_SOURCES`, the tables Home reads and the change kinds that reach them.
  - `copy.ts`: bilingual copy, ASCII German.
- `src/workday/revalidate.ts` (new): the shared freshness helper (API below).
- `src/components/workday-v3/home/HomeYourDay.tsx` and `HomePartnerUpdate.tsx` (new, Home only).
- `app/workday/[role]/v3.tsx`: now 69 lines (was 451); it gates demo and planned roles, checks the seed, and renders `RoleHome` with `readHomeView`.
- `src/components/workday-v3/RoleHome.tsx`: renders the view model. The information budget is documented at the top.

### The regions

- **Now**: the focus queue's Now item and `buildNowDetail`. The card answers, in order: what changed (from the suggestion that prepared the item, the live event that brought it, or the background action that escalated it; left out when no row records it), why it matters, what to do (the primary button), and by when ("Due 10:30", or "No due time recorded, arrived 2 h ago"; decisions carry no due time in the schema, so none is invented).
- **Next**: up to three items in an explicit attention order, `ATTENTION_ORDER` in `focus.ts`: materiality (severity), deadline (due time, earlier first), dependency (waiting on the person before prepared for review), readiness (finished preparation before preparation in hand), then age and identifier. Before this, the queue ordered by section first, so a critical item prepared for review ranked below a medium open decision.
- **Your day**: next meeting (first non focus-time entry on the scenario day at or after the clock, the same rule as the landing page's role signals, via `selectNextMeeting` from `src/features/role-signals`), open actions, inbox needing attention (revealed, unread, triaged to a decision or action, not yet converted). Zero states: "No open actions", "Nothing needs attention", "No meeting scheduled today" or "No further meeting today".
  - **Actions are classified exactly as the Work Hub classifies them.** Home reads the same desk (`getWorkActions(roleId, holderUserId)`: actions the role raised plus actions its holder owns) and applies os-workhub's `classifyAction` (`src/features/work/modules/actions/policy.ts`, imported, not edited) to each row and its `action_updates` history. So overdue includes a passed due date whatever the stored status says, and blocked comes from the history (it has no status column). The cell reads, for example, "6 open, 1 overdue, 1 blocked"; overdue or blocked takes the warning tone. Asserted by the unit test (inputs built with `classifyAction`) and by the integration test, which recomputes the Work Hub's counts independently and inserts a blocking history entry.
- **Partner update** (replaces Partner Pulse): statements from rows only: changes recorded after a decision (receipt lines), messages converted into work (inbox links), suggestions prepared (validated, not dismissed, not the one already shown inline), stage preparations and routine runs (backbone events `ai-preparation-completed` and `routine-completed`), items requested, escalations and contradictions (background actions), and outcome entries in the activity stream (drafted, completed, executed, escalated, held, waiting). Checks (observed, retrieved, reconciled) are not statements; they are counted under Done. Every statement links to the first thing it created or touched and lists all its references beneath; a statement with no linkable reference is dropped. An activity entry a backbone event already accounts for is not repeated. Three statements show; the rest sit behind "n more". Empty state: "Nothing to report yet. When the AI Partner prepares work, follows something up or turns a message into work, it is listed here with a link to what it created."
- **Done**: collapsed, "Done today 65: 63 handled automatically, 2 completed by you". Automatic is units of work (background rows of the handled kinds plus completed suggestions); "completed by you" is decisions recorded, stage decisions, stages completed, actions completed and meetings concluded today. "Today" is the scenario clock, the scenario date, or a live write after the day was seeded. Nothing completed: "Done today: nothing completed yet".

## Revalidation helper API (for Work and the process engine)

`src/workday/revalidate.ts`

```ts
revalidateWorkday(roleId?: RoleId | null, change?: WorkdayChange): boolean
workdayRevalidationTargets(roleId?: RoleId | null): RevalidationTarget[]
type WorkdayChange = "decision" | "approval" | "action" | "meeting" | "minutes" | "inbox"
  | "process-stage" | "suggestion" | "activity" | "routine" | "scenario";
```

- With a role it calls `revalidatePath("/workday/<role>", "layout")`, which covers that role's Home, Work, Processes and Decisions and the header counts. Without a role it revalidates `/workday` as a layout and `/control-room`.
- Call it in a server action after the write and before any `redirect`. In a server action the current page re-renders in the response and the client router discards its cached workday pages, so Home is fresh both in place and on the next visit.
- In a route handler it only marks the path; the client that called the handler must also call `router.refresh()`. The AI Partner dock (later wave) talks to route handlers, so it needs both.
- Outside a request (scripts, the worker, tests) it is a no-op and returns `false` instead of throwing. A genuine misuse, such as calling it during render, still throws.
- The tables that need it are listed in `HOME_DATA_SOURCES` (`src/features/home/sources.ts`).

Adoption so far: `src/features/process/actions.ts` (process engine) and `app/workday/[role]/work/actions.ts` (Work Hub) already call it for every write. `app/actions.ts` (decisions, approvals, clock, language, reset) revalidates `/workday` as a layout, which is a superset, and was left unchanged.

## Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| No static fallback count | Met | T02 and T03 removed; unit tests "states no open actions instead of a seeded count", "... nothing in the inbox needs attention ..."; source scan test; integration "Home for a role with no data" |
| No static fallback action or event | Met | T04 removed; next meeting from the clock; Done and Partner update built only from rows; empty-day unit tests |
| No hard coded Partner Pulse | Met | T01 removed; source scan test; `HomePartnerUpdate` renders `assemblePartnerUpdate` output only |
| Every Partner update statement has lineage | Met | `statement()` drops any statement without a linkable reference; unit `expectLineage` on every statement test; integration "states only what rows record, each statement linked to a real row" |
| Empty states honest and useful | Met | Integration test empties actions, inbox, calendar, suggestions, activity, background work and decisions for each role on a temporary database and asserts the empty sentences (EN and DE); screenshots `after-*-emptied` |
| Home updates after a meeting, decision, process stage or action | Met, with a note on the stage step | Browser journey `tests/e2e/home-freshness.spec.ts` (decision and action through the UI, stage written as the engine records it); server test `tests/integration/home-freshness.test.ts` (all four, plus the server action modules call the helper) |
| EN and DE | Met | Every string is a pair; German integration tests; DE screenshots |
| No overflow at 1920x1080, 1440x900, 1366x768 | Met | Capture script overflow check on every after screenshot |
| Information budget at 1366x768 | Met | Done is inside the opening viewport again (it was pushed below the fold by the Your day strip before); `before-rcsa-en-1366x768.png` against `after-rcsa-en-1366x768.png` |

## Tests run

All on the isolated stack (port 3104, `os-home-truth.db` in the scratchpad) or on temporary databases. Nothing wrote to the shared database or to port 3000.

| Run | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | No error in any source file. The only errors are in generated route types of other workstreams' dev folders (`.next-os-shell/dev/types/validator.ts`, earlier `.next-verify` against the new `app/ops/layout.tsx`). |
| `vitest tests/unit/home-read-model.test.ts` (new) | 32 passed |
| `vitest tests/unit/attention-order.test.ts` (new) | passed (with the next two: 83 passed across 4 files) |
| `vitest tests/unit/workday-revalidate.test.ts` (new) | passed |
| `vitest tests/unit/focus-queue.test.ts` (existing) | passed, unchanged |
| `vitest tests/integration/home-read-model.test.ts` (new) | 25 passed |
| `vitest tests/integration/home-freshness.test.ts` (new) | 7 passed |
| `vitest tests/integration/focus-queue-flows.test.ts`, `role-signals.test.ts` (existing) | passed (45 with the freshness file); `decision-queue-v3.test.ts` and `tests/unit/role-signals.test.ts` also passed after the ordering change |
| `playwright tests/e2e/home-freshness.spec.ts --project=desktop-1366` on 3104 (new) | 1 passed (2.0 min): decision through Decisions, action through the Work Hub, stage, each reflected on Home with no reload between the change and Home |
| `playwright tests/e2e/workday-v3-density.spec.ts` (rcsa, tprm) on 3104 | "does not scroll sideways": passed at 1920x1080, 1440x900 and 1366x768 for both roles. "opening viewport stays inside the budget" (1366): not passed. The run that executed rendered the workspace error page because my isolated database lacked os-workhub's new migration `0005_work_lineage` (`actions.completion_condition`); after migrating, the re-run could not reach the server, which had reached its two-hour background limit. The budget is evidenced by the 1366x768 screenshots instead. Recommended: re-run on a migrated stack. |
| `npm run check:copy` | passed |
| `node scripts/check-no-emdash.mjs` | passed; no finding in any Home file (findings listed are pre-existing elsewhere) |
| `npm run scan:secrets` | passed |

## Screenshots

`docs/screenshots/os-excellence/os-home-truth/`:

- `before-{rcsa,tprm}-{en,de}-{1920x1080,1366x768}.png`: the starting state.
- `before-rcsa-en-1920x1080-emptied.png`: rcsa with its actions and inbox deleted, showing the fallbacks ("Open actions 4", "2 need attention", next meeting 07:45 focus time) and the hard coded Partner Pulse.
- `after-{rcsa,tprm}-en-{1920x1080,1440x900,1366x768}.png` and `after-{rcsa,tprm}-de-{1920x1080,1366x768}.png`: the seeded morning.
- `after-{rcsa,tprm}-{en,de}-{1920x1080,1366x768}-emptied.png`: both roles with their desk, inbox, calendar, suggestions, activity, background work and decisions deleted on the isolated database.
- `after-rcsa-en-1920x1080-journey.png`: Home after the freshness journey. "2 need your judgment" (was 3), the decided question is not re-presented, Done "66: 63 handled automatically, 3 completed by you", "5 open, 1 overdue" (was 6), and the Partner update leads with "Recorded 2 changes after your decision on Three indicator explanations or one causal investigation", linked to DEC-2026-0771 and KRI-PAY-007.

Every after screenshot was checked for horizontal overflow of the document, `.wd-frame`, `.wd-body`, `main` and `.wd-header`: none. At 1366x768 the opening viewport holds the title, one Now card, one AI line, three Next rows and the collapsed Done, for both roles in both languages.

## Known limitations and gaps

- **Routine runs.** There is no record of what a routine run produced. `ai_routines.last_run_at` is a seeded timestamp with no output or lineage, so it is not used. Home reads `routine-completed` events from the OS event backbone and will state them when the routine runner (a later wave) publishes them; today that source is empty.
- **Deadlines on decisions.** `decisions` has no due field, so the Now card says "No due time recorded" for decisions. A due time would need a schema change (not made).
- **Meeting preparation.** `meetings.preparation_summary` is populated while `calendar_events.preparation_status` says not started for the same meeting (audit T10). Neither is used as a Partner statement until the two agree; the pre-meeting routine run would be the honest source.
- **Who converted a message.** `inbox_messages` records the linked action or decision but not who linked it, so the statement is phrased without an actor ("1 message converted into work").
- **Stage step in the browser.** Stage preparation is now a durable job and `scripts/worker.ts` does not yet handle it, and completing a stage needs the full stage contract. The browser journey therefore writes the completed stage run on the isolated database as the engine records it; the server test covers the engine's revalidating action. When the engine's completion is clickable end to end, replace that write with the clicks.
- **Next ordering changed.** At equal materiality and deadline the old order is kept. The visible change: on the seeded rcsa morning the high-severity escalation now precedes two medium decisions in Next.
- **Content language.** Decision and suggestion bodies are English in the seed, so a German Home shows English body text where only English exists (pre-existing; titles are bilingual).
- **Shared queue quirk, not changed.** `dedupeFocusItems` keys on object, so two background items about the same supplier (tprm escalation and contradiction on TP-0042) collapse to one, keeping whichever came first. That is contract code outside this workstream.

## What the user must run

- No schema change and no migration from this workstream. No reseed is needed for Home.
- Home reads tables other workstreams have migrated (`0004_process_engine`, `0005_work_lineage`). The shared database needs those migrations, as listed in their handoffs; until `0005` is applied, every page that reads actions (Home included) fails on `actions.completion_condition`.
- The density budget test should be re-run once on a migrated stack (see Tests run).
- Shared files touched minimally: `src/components/workday-v3/WorkdayDisclosure.tsx` (optional `summary` prop, additive), `tests/e2e/workday-v3-density.spec.ts` (the Done finder also matches "Done today"), and `src/db/repositories/focus.ts` (attention order, plus skipping a suggestion whose decision is made).
- To run the browser journey on an isolated stack: see the header of `tests/e2e/home-freshness.spec.ts` (it refuses port 3000 and needs `NFR_HOME_FRESHNESS_DB`).
