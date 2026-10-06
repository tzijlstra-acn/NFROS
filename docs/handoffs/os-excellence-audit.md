# NFROS OS Product Excellence: browser-level baseline audit (before state)

Workstream: `os-audit`. Audited commit: `f5a1ffb` ("chore: V2.4 export metadata from the release commit"). Dates: 05.10.2026 to 06.10.2026.

This is the browser-level audit that section 2 of `docs/OS_PRODUCT_EXCELLENCE_PLAN.md` asks for before implementation. It records the product exactly as it was at `f5a1ffb`. Every file and line reference below is at that commit, not the working tree, which other workstreams are now changing.

Severity scale:
- **Critical:** a client or analyst sees invented state as real work, or a governed rule is bypassed.
- **High:** a core journey fails, contradicts itself, or a release claim is untrue.
- **Medium:** visible incoherence or a partial capability that a design partner will notice.
- **Low:** polish, wording or documentation.

---

## 0. How the audit was produced

### Frozen before-stack
- The worktree is at `<scratchpad>\nfr-before`, created with `git worktree add ... f5a1ffb`.
- `node_modules` is a junction to the main repo's `node_modules`.
- The database is `<scratchpad>\os-audit.db`. Migrations and seed ran on it: 94 tables, 2,724 rows across 53 tables. The shared `data/nfr-workos.db` was never touched, and nothing was clicked on port 3000.
- The server ran as `next dev --webpack -p 3101` with `NFR_DB_PATH` set to that database, `NFR_DIST_DIR=.next-os-audit` and `NFR_DEMO_MODE=safe`.
  - **Deviation from the brief:** Turbopack refuses to start when `node_modules` is a junction that points outside the project root ("Symlink [project]/node_modules is invalid, it points out of the filesystem root"). The server was therefore started with the `--webpack` flag. This changes the bundler only, not application behaviour.
- Two operational notes on the stack itself:
  - The 3101 server hit its two-hour background limit twice and was restarted against the same database and dist directory.
  - Before the last restart, the `node_modules` junction in the worktree had disappeared. `npx` then fetched next@16.3.8 into the worktree, and Next began installing TypeScript there. That server was stopped, the partial folder was deleted, and the junction was recreated before any further capture.
  - The main repo's `node_modules` was checked and is unchanged: 222 entries, next 16.3.7, last written 30.09.2026.
  - Every capture and journey in this report ran on Next 16.3.7.
- The worktree is not next to `RealAIInfrastructure`, so no key was resolved. The stack ran in presenter safe mode with no live calls. No OpenAI call was possible or made.

### Language
- The interface language is one global column, `scenario_runs.language` (`src/scenario/engine/state.ts:233-236`). It is written by `actionSetLanguage` (`app/actions.ts:68-71`).
- The V3.3 shell has **no language control.** The only switches are the V1 `LanguageToggle` (`src/components/shell/controls.tsx:304-336`) and the V2 DemoMenu (`src/components/workday-v2/DemoMenu.tsx:111-126`).
- For the German pass, the audit set that column on its own database only.

### Tools
- Playwright 1.63 Chromium, driven by scratch scripts kept outside the repo.
- `@axe-core/playwright` is **not** in `node_modules`. `axe-core` 4.13.0 is, so it was injected with `addScriptTag`, which is how the repo's own `tests/e2e/accessibility.spec.ts` runs it. Tags: wcag2a, wcag2aa, wcag21a, wcag21aa.

### Coverage
- Both flagship roles (`rcsa`, `tprm`), English and German, at 1920x1080, 1440x900 and 1366x768.
- Routes:
  - `/`, `/workday`, `/workday/<role>`;
  - Work: Agenda, Meetings, Actions, Inbox;
  - `/processes`, both process apps at all eight stages, `/decisions`;
  - every `/settings/*` page, `/ops`, `/control-room`, `/trust`, `/value`, `/roadmap`, `/setup`.
- 216 route captures plus 48 stage captures, with bottom-of-page captures wherever the main region scrolls.

### Journeys
- The write journeys ran last, on the own stack only:
  - record a decision for each role;
  - complete process stages;
  - open the inbox, the meetings and the minutes;
  - use the AI Partner chat.
- Their screenshots are named `<role>-journey-*`.

### Screenshots
- Location: `docs/screenshots/os-excellence/audit/`.
- Naming: `<role>-<route>-<lang>-<viewport>.png`, where the role is `rcsa`, `tprm` or `global`. A `-bottom-` infix marks the scrolled bottom of the main region.

### Timing caveat
- Load times were measured in `next dev` (webpack, unoptimised) on a machine that was also running three other Next servers and a type check for other workstreams.
- They are an upper bound and useful only for relative comparison. See section 7.4.

---

## 1. Executive summary

The source-level diagnosis in the plan is confirmed in the browser, and the browser adds failures that a source reading does not show.

**Overall picture**
- The V3.3 shell renders cleanly:
  - no horizontal overflow, no umlauts, no em or en dashes, and no stuck loading state on any of 264 captures;
  - Home, Work, Processes and Decisions use no developer vocabulary.
- Underneath, most of the work surfaces either describe work they cannot perform, or show state the database does not hold.
- 102 defects are recorded: 9 critical, 39 high, 43 medium and 11 low.

**Governed rules are bypassed in two places**
- **A TPRM decision is recorded but nothing it implies happens (J20).**
  - Recording a decision as the Third-Party Risk Manager in V3.3 writes the decision as `decided`.
  - The authority gate then refuses every consequence, because the scenario's acting role is still `rcsa`.
  - The approvals are attributed to Marlene Aigner, the Operational Risk Partner.
  - The analyst is shown no receipt and no failure.
- **Process stages complete with no criteria (J13).** All eight RCSA stages completed in under a minute, with empty optional notes, while two of the stage decisions were still open and before the challenge workshop had taken place. The TPRM gate note is pre-filled with the recommended position (J16), and TPRM then dead-ends at stage 5 (J15).

**Truth before theatre fails on every primary screen**
- Home:
  - Partner Pulse is hard-coded prose that contradicts the data (T01);
  - the action and inbox counts fall back to fixed numbers (T02, T03);
  - the Decisions badge counts decisions scheduled for later in the day (T07);
  - the header always says "1 suggestion" (T06).
- Both process apps render inline English "AI prepared" text and static artifacts that contradict the seeded run (T14 to T16):
  - a workshop date of 10.10 against the real 06.10;
  - a control id that does not exist;
  - the user's own real name, which is not part of the synthetic institution (T28).
- The context drawer says "Nothing selected" next to the selected item, on every screen and every tab (T05).
- Seeded meeting minutes exist in the database, but no screen shows them, and their references point at objects that do not exist (T11, T20).

**Daily work is mostly description**
- Work Hub rows cannot be selected, and every row control returns to a list (J07, J08).
- There is no meeting or minutes journey (J10).
- Actions and Inbox cannot be updated, completed or converted (J11, J12).
- Search, Ctrl+K and Updates do nothing in V3.3 (J28).
- Home does not change after a decision is recorded or a process is completed (J05).
- AI Partner dispositions are not stored and there is no feedback capture (J24).

**The product does not tell one story about itself**
- Seven different version claims: 1.0.0, 4.0.0, V3.3, V3.1, V4, V2.4 and "Design Partner Release" (R01).
- Five product names (R02).
- Two model families for the same configuration (R03).
- Safe mode is labelled five ways (R04).
- Planned and Demo roles are fully interactive on every route except Home (R08).

**The client entry is a developer console (D01)**
- The entry page shows a runtime panel with key state, a global mode selector, a reset control and setup commands.
- It also asserts that a key was resolved when none was (T21).

**Product-owner surfaces are read-only or missing**
- Only branding and four integration controls write anything (section 6).
- `/ops` is visually broken at every viewport (U02).
- There is no Product Owner Console (P13).

**Quality**
- Every Home, Work, Processes and Decisions page fails WCAG AA contrast because of one muted text token (U01).
- German is incomplete across the role selector, the entry page, Work chips, process text and all settings pages (U03).

**Recommendation**
- Wave 0 (truth and release coherence) should take items 6, 7, 12 to 20, 28, 29, 34, 35, 38, 39 and 41 of the checklist in section 9.
- J20 and J13 should be fixed before any further demonstration of the TPRM decision path or the process apps. They are the two places where the product's central claim, that material judgments stay human and governed, is not true in the browser today.

---

## 2. Counts per severity

| Area | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| 3. Truth defects (T) | 4 | 14 | 10 | 2 | 30 |
| 4. Release and status (R) | 0 | 6 | 6 | 1 | 13 |
| 5. Journey gaps (J) | 3 | 11 | 13 | 2 | 29 |
| 6. Product-owner surfaces (P) | 0 | 5 | 6 | 2 | 13 |
| 7. Usability and quality (U) | 1 | 2 | 5 | 3 | 11 |
| 8. Developer content (D) | 1 | 1 | 3 | 1 | 6 |
| **Total** | **9** | **39** | **43** | **11** | **102** |

---

## 3. Truth defects (plan 1, 4.3 to 4.9, 9.2, 13.2)

Each row says what renders, whether the seeded database holds the real data, and where it appears.

| ID | Sev | What renders | Source at f5a1ffb | Does the seeded DB hold the real data? | Screen and evidence | Plan |
|---|---|---|---|---|---|---|
| T01 | Critical | Partner Pulse sentences per role, hard-coded:<br>- rcsa: "Scanned calendar and prepared RCSA Challenge Workshop brief, followed up 2 overdue actions on Q4 evidence refresh, and triaged 4 inbox items."<br>- tprm: "Checked Veridian evidence request status ... identified 1 supplier monitoring signal."<br>It renders whenever any routine exists, which is always after seeding. German forms are hard-coded too. | `app/workday/[role]/v3.tsx:212-223` (guard 208, 422-428) | Yes. `ai_activity_entries` (165 rows), `ai_routines` (9) and `background_actions` (165) are seeded. The sentence contradicts them: rcsa has 1 overdue action, not 2, and no routine run triaged 4 items. None of it has lineage. | Home, bottom strip, both roles. `rcsa-home-bottom-en-1366x768.png`, `tprm-home-bottom-de-1366x768.png` | 4.3, 9.2 |
| T02 | High | "Open actions" falls back to 4 (rcsa) or 3 (tprm) when the real count is 0, so the honest "0" can never render. The real count also leaves out `overdue`: rcsa shows 5 while 6 are not complete. | `v3.tsx:393-398` | Yes, `actions` (`raised_by_role_id`). Seeded rcsa: 1 open, 4 in progress, 1 overdue, 1 completed. | Home, "Your day". `rcsa-home-en-1440x900.png` | 4.3, 4.7 |
| T03 | High | Inbox tile falls back to "2 need attention" when the count is 0, so "All reviewed" can never render. | `v3.tsx:400-405` | Yes, `inbox_messages`. | Home, "Your day" | 4.3, 4.8 |
| T04 | Medium | "Next meeting" is the first calendar row of the day, whatever the scenario time, and includes focus blocks. At 07:45 tprm shows "07:30, Morning decision brief", which has already started. | `v3.tsx:382-391`, `getCalendar` without a moment filter (`src/db/repositories/workday.ts:118-125`) | Yes, `calendar_events` has `starts_at` and `kind`. | Home. `tprm-home-bottom-de-1366x768.png` | 4.3, 4.5 |
| T05 | Critical | The context drawer always shows "Nothing selected. Select a row in the list to see the evidence and details behind it." This applies on all four tabs (Evidence, Details, Activity, Audit), on every screen. The Evidence button on the Home Now card, and "Evidence 6" on the Decisions Understand step, both open this empty drawer next to the item that is plainly selected. | `src/components/workday-v3/WorkdayPanels.tsx:97-106`. There is no content slot. | Yes. `evidence_documents` (187) and `evidence_chunks` (683) are seeded, and the decision carries 6 evidence ids. | Home and Decisions. `rcsa-journey-home-evidence-drawer-en-1440x900.png` | 4.4 (acceptance: never "Nothing selected" after a selection) |
| T06 | High | The header AI control reads "1 suggestion" for any number of ready suggestions. The ready state is counted without a moment or validation filter. | `src/components/workday-v3/WorkdayHeaderClientActions.tsx:72`; `src/db/repositories/header.ts:119-138` | Yes, `ai_suggestions` | Header, every analyst route | 9.2, 4.11 |
| T07 | High | The Decisions badge shows 5 (rcsa) and 6 (tprm), but the queue shows "3 open". The badge counts decisions that are presented later in the day (11:45 and 15:00). | `src/db/repositories/header.ts:141-154` has no `presented_at_moment` filter; the queue filters on it (`workday.ts:185-186`) | Yes, `decisions.presented_at_moment` | Rail on every route. `rcsa-decisions-en-1440x900.png` | 4.10, 9.2 |
| T08 | High | Work Hub static day: `RCSA_/TPRM_STATIC_EVENTS`, `_UPCOMING`, `_ARCHIVE`, `_ACTIONS` and `_INBOX`. They render when a role has no rows, and also whenever the database is not ready. In that case Work renders a fabricated day instead of `NotSeeded`. Every non-rcsa role receives the TPRM set. The rows contradict the seeded day (for example "Request BCM plan, due 2026-10-07, Overdue" on 06.10.2026). | `app/workday/[role]/work/v3.tsx:359-427, 681-763, 955-1019, 1185-1237`; selection at 1271, 1294, 1330-1331, 1356, 1384 | Yes for rcsa and tprm, so they are hidden in the seeded state. They surface for an empty role or a partly reset database. | Work, all tabs | 4.4 to 4.8 |
| T09 | High | The Work context line is hard-coded: "RCSA-ARC-DE-PAYOPS-2026-Q4: Q4 cycle in progress" for rcsa, and "Third-party onboarding: Veridian Document Systems GmbH" for every other role, demo and planned roles included. | `work/v3.tsx:46-53, 1265-1268` | Yes, `role_app_runs` and `suppliers` | Work header. `rcsa-work-agenda-en-1440x900.png` | 4.4 |
| T10 | High | The same meeting shows two preparation states. In Meetings, the 10:30 challenge workshop shows "Ready" (any non-empty preparation summary). In Agenda, the same event shows "Not prepared" (`calendar_events.preparation_status = not-started`). | `work/v3.tsx:462-465` against 238-246 | Yes, but in two tables that disagree | `rcsa-work-meetings-en-1440x900.png` against `rcsa-work-agenda-en-1440x900.png` | 4.5, 4.6 |
| T11 | High | The minutes archive says "No minutes in the archive." It reads `meetings.status = concluded`, and no seeded meeting is concluded. The two seeded `meeting_minutes` rows (one confirmed for rcsa, one draft for tprm) never appear anywhere. `getMeetingMinutes`, `getMinutesArchive` and `confirmMeetingMinutes` have no callers. | `work/v3.tsx:1317-1325`; `src/db/repositories/role-app-runtime.ts:298-344` | Yes, `meeting_minutes` (2) | Work, Meetings, both roles. `tprm-work-meetings-en-1366x768.png` | 4.6 |
| T12 | Medium | Agenda shows an "AI preparing" badge, in AI tone, derived from the status string `in-progress`. This asserts live AI activity that nothing is performing. | `work/v3.tsx:238-246` | No AI job exists. The status is static seed. | Agenda, 09:30 row | 9.2 |
| T13 | Medium | Inbox "AI: Decision" and "AI: Information" badges present the seeded `proposed_triage` as AI output, with no rationale. `confirmed_triage` is ignored. | `work/v3.tsx:1155` | Seeded field, not an AI result | Work, Inbox. `rcsa-work-inbox-en-1440x900.png` | 4.8 |
| T14 | Critical | RCSA "AI prepared" text for all eight stages is inline English in the route file. It contradicts the database. The "Your task" text also overrides the definition. Details are listed under the table. | `app/workday/[role]/processes/rcsa-cycle/v3.tsx:59-107` | Partly. `role_app_stage_runs.ai_output_id` is null and `role_app_stage_tasks` has 0 rows. The facts it contradicts are seeded. | RCSA app, every stage. `rcsa-process-rcsa-cycle-en-1440x900.png` | 4.9, 5.1 |
| T15 | High | RCSA static artifacts, always used: "Workshop placeholder ... scheduled 2026-10-10 10:30" and "Evidence pack: 4 of 6 sources loaded. Gap list: Q3 KRI data, Control test BCA-CTRL-142." | `rcsa-cycle/v3.tsx:113-128, 298-312` | No. `role_app_artifacts` has 0 rows and `createArtifact` has no caller. | RCSA app, stages 1 and 2 | 4.9 (no static artifact when a run exists) |
| T16 | Critical | TPRM "AI prepared" text is inline English. It contradicts the database and its own screen. Details are listed under the table. | `app/workday/[role]/processes/third-party-onboarding/v3.tsx:90-104` | No AI output exists | TPRM app. `tprm-process-third-party-onboarding-en-1440x900.png`, `tprm-journey-process-after-stage4-submit-en-1440x900.png` | 4.9, 5.2 |
| T17 | High | Several TPRM and Processes values are hard-coded:<br>- procurement reference "PRQ-2026-0087";<br>- "as at 06.10.2026";<br>- the supplier name on the Processes list;<br>- "Stage locked: complete Stage 4 first" on every locked stage;<br>- the "In progress, Stage N" prefix, which ignores `run.status`. A completed run still says "In progress". | `third-party-onboarding/v3.tsx:59-62, 362, 572`; `app/workday/[role]/processes/v3.tsx:470, 491-492` | Yes, `role_app_runs.status` and `suppliers` | Processes and the TPRM app | 4.9 |
| T18 | High | The "Morning Brief" AI routine output is static prose. It claims "today 07:45 ... Actions: 4 open, 1 overdue ... Inbox: 2 items ... SOC 2 Type II Report expires in 45 days" (rcsa), with a TPRM equivalent. The seeded routine ran at 07:00, and the counts differ from the database. | `processes/v3.tsx:196-418` | No routine output table exists. The facts live in `actions`, `inbox_messages` and `evidence_documents`. | Processes, AI Routines, Morning brief. `rcsa-journey-processes-morning-brief-en-1440x900.png` | 4.3 (Partner update), 9.2 |
| T19 | Medium | One state, two labels. TPRM stage 4 shows "In Progress", while RCSA stage 2, in the same seeded state (`waiting-for-input`), shows "Waiting for input". | TPRM `resolveStageStatus` `third-party-onboarding/v3.tsx:121-129` ignores the database status | Yes | Both apps | 9.2 |
| T20 | High | Seeded minutes point at objects that do not exist. Details are listed under the table. | `src/db/seed/role-app-runtime.ts:280-337` | Dangling references | Not rendered today (see T11), but it blocks any minutes lineage | 4.6, 13.21 |
| T21 | High | The entry page always prints "A usable key was resolved from the local source ... Run npm run smoke:live to verify." It does so next to "Live AI configured: false" and "no key was resolved". | `src/server/config/runtime.ts:103-104` via `app/page.tsx:179-181` | n/a | `/`. `global-landing-en-1440x900.png` | 1.5, 4.1 |
| T22 | Medium | AI Partner receipts are always "Recorded in this workspace", with `targetSystem: null` and `status: local`. | `src/components/workday-v2/PartnerSlot.tsx:60-77` | `execution_receipt_lines` exists | AI Partner dock | 4.10, 4.11 |
| T23 | Medium | The role selector shows "Event-driven reassessment" and "Periodic reassessment" as process chips next to the live processes. Both are `preview` with no route. | `src/product/release/role-release.ts:33, 43`; `src/role-apps/registry.ts:30, 74` | n/a | `/workday`. `global-role-selector-en-1440x900.png` | 4.2 |
| T24 | Medium | AI quality evaluation status is the literal "Not yet evaluated: run eval:structural to generate results." The configurations beside it are marked "Released". | `app/settings/ai-quality/page.tsx:136-156` | `evals/results/latest.json` is written by the runner but never read | `/settings/ai-quality` | 6.2, 7.5 |
| T25 | Medium | The Ops "Release" block is hard-coded: "4.0.0", "NFROS Design Partner Release", "91+ tables". The database has 94 tables. | `app/ops/page.tsx:325-327` | n/a | `/ops` | 1.5, 7.9 |
| T26 | Low | Two dead Home links:<br>- "Ask" in Partner Pulse links to `#partner`, which matches no element;<br>- "Review preparation" always goes to `/decisions`, never to the suggestion's own decision. | `v3.tsx:291, 371` | n/a | Home | 4.3 |
| T27 | Medium | The inbox shows Mail, Teams and GRC items with source badges. The integrations page says Microsoft Graph has "Never synced successfully" and 0 inbound events were received. The inbox rows are seed data with no "Simulated" label. | `work/v3.tsx:1049-1058`; `/settings/integrations` | Seeded `inbox_messages` | Inbox against Integrations. `global-settings-integrations-en-1440x900.png` | 7.6, 9.2 |
| T28 | High | Synthetic-data integrity. The AI-prepared text names "Thomas Zijlstra" as the RCSA participant and as the TPRM business owner. The rcsa text also names "Anna Mueller" and "Max Weber", and the seeded minutes name "Anna Weber". None of these people is in the synthetic institution (18 users; the rcsa holder is Marlene Aigner, P-003; the TPRM business owner is Andreas Kellner, P-007). The entry page states that every person is invented. | `rcsa-cycle/v3.tsx:62`; `third-party-onboarding/v3.tsx:92`; `src/db/seed/role-app-runtime.ts` (minutes summary) | No | RCSA stage 1, TPRM stage 1. `rcsa-process-rcsa-cycle-s1-scope-trigger-de-1366x768.png` | 9.2, copy rules |
| T29 | Medium | The AI Routines list shows "Pre-Meeting Preparation, Last run 2026-10-06 10:00" while the scenario clock is 07:45. A routine appears to have run in the future. | `ai_routines.last_run_at` rendered without a moment check (`src/components/workday-v3/AIRoutinesList.tsx`) | The seed holds a future value | Processes, AI Routines. `rcsa-journey-processes-routines-en-1440x900.png` | 9.2 |
| T30 | Low | Process events and health checks use the wall clock, not the scenario clock. After the stage 4 submit, TPRM "Recent activity" reads "2026-10-06 08:06 stage completed" against a 07:45 scenario. `/ops` reads "Checked at 2026-10-05T10:02". | `new Date()` in `rcsa-cycle/actions.ts:39` and `third-party-onboarding/actions.ts`; `src/health/service.ts` | n/a | `tprm-journey-process-after-stage4-submit-en-1440x900.png` | 9.2 |

**T14 detail: RCSA stage text**
- It contradicts the database:
  - "Workshop placeholder created: 2026-10-10", but the calendar and the minutes say 06.10.2026 10:30;
  - "Previous cycle: Q1-2026", but the database holds Q3 and Q2 2026 assessments;
  - "Trigger: Scheduled quarterly cycle", but the minutes give the KRI-PAY-007 breach as the trigger;
  - "Control test BCA-CTRL-142", a control id that does not exist; the database uses CTL-PAY-*.
- The stage 2 "Your task" ("waive missing items or escalate") overrides the definition's responsibility (`src/role-apps/rcsa/definition.ts:63-64`, investigation strategy).

**T16 detail: TPRM stage text**
- "Business owner: Thomas Zijlstra" contradicts the seed (Andreas Kellner, P-007).
- "4 of 7 evidence items" sits above a list of 8 documents and a summary of "4 accepted, 2 missing".
- After stage 4 completes, stage 5 is badged "In Progress" and still says "Stage locked. Complete Stage 4 evidence sufficiency decision first."

**T20 detail: dangling minutes references**
- `MINUTES-RCSA-SCOPE-WORKSHOP-2026` points at meeting `MTG-RCSA-PAYOPS-Q4-2026-SCOPE`, decision `DEC-RCSA-SCOPE-2026-Q4`, action `ACT-RCSA-PAYOPS-Q4-001` and evidence `EVD-KRI-PAY-007-Q3` and `EVD-CTL-PAY-014-TST-2026`. All are absent from the database.
- `MINUTES-TPRM-EVIDENCE-TRIAGE-2026` points at meeting `MTG-TPRM-VERIDIAN-TRIAGE-2026` and actions `ACT-TPRM-OB-0099-PENTEST-CHASE` and `-BCM-CHASE`. All are absent.
- The RCSA summary says "Anna Weber confirmed the scope". The confirmer is `P-003`, Marlene Aigner.

Positive truth findings:
- The decision queue, the Now/Next focus queue, the agenda, meeting, action and inbox rows, the evidence list on TPRM stage 4, and the AI Partner suggestions and activity are all database-driven in the seeded state.
- No umlaut, em dash or en dash rendered on any captured page, in either language.

---

## 4. Release and status incoherence (plan 1.5, 3.3, 7.9, 9.2, Wave 0)

| ID | Sev | Contradiction | Evidence at f5a1ffb | Plan |
|---|---|---|---|---|
| R01 | High | Seven different "current version" claims. Details are listed under the table. | `package.json:3`, `CHANGELOG.md:7,19,54,100`, `app/ops/page.tsx:325`, `src/workday/contracts.ts:78,87`, `README.md:95,101`, `scripts/release-package.ts:13-14`, `scripts/sbom.ts:56` | 1.5, 7.9 |
| R02 | High | Five product names:<br>- "WorkOS" in the V3.3 header (brand `shortName`, `src/db/repositories/header.ts:189`);<br>- "NFR WorkOS" in the streaming header fallback (`WorkdayHeaderFallback.tsx:30`, so the name flips during load), the role selector (`RoleSelector.tsx:62`), the entry page, settings and setup;<br>- "NFROS" on ops and story, which is also the plan's name;<br>- "NFR OS" and "NFR Operating System" in the decks;<br>- export files named both `NFROS_*` and `NFR_WorkOS_*`. | as cited | 1.5, 4.1 |
| R03 | High | Three model families for the same configuration. `/settings/ai-quality` lists `gpt-4o-mini` and `gpt-4o` (`src/ai/prompt-registry.ts`). `/control-room` and `/trust` resolve `gpt-5.1`, `gpt-5.1-mini` and fallbacks `gpt-5`, `gpt-4.1`, `gpt-4o`. | `global-settings-ai-quality-en-1440x900.png`, `global-control-room-bottom-en-1440x900.png` | 7.5 |
| R04 | High | Safe mode is written five ways:<br>- "Presenter Safe" (`src/i18n/labels.ts:203`, `demo-mode.ts:88`);<br>- "Presenter safe" (`src/components/ai-partner/labels.ts:56`);<br>- raw `safe` (`ModeSelector.tsx:56`, `app/page.tsx:131`, `control-room:80`, `trust:1192`);<br>- "Praesentationssicher";<br>- README "Presenter safe (default)".<br>"Live" means AI mode, connector mode and freshness. The plan's vocabulary words "Safe", "Verified" and "Not verified" are never rendered as labels. | `src/workday/contracts.ts:524-540` | 9.2 |
| R05 | High | One audit-chain state has three labels: `/settings/audit-integrity` says "Empty" (`:47`), `/ops` says "NOT-CONFIGURED" (`src/health/service.ts:87-88`), and `/settings/pilot` says "Pass, Audit chain: initialised", even with zero records (`:130-138`). Valid is labelled "Valid" and "HEALTHY". | as cited | 9.2, 7.7 |
| R06 | Medium | The no-key state is described three ways:<br>- `/ops`: "No API key configured", then a spaced double hyphen, then "offline mode only". The double hyphen breaks the copy rules, and the claim is wrong, because the effective mode is safe, not offline. `/ops` also reads `process.env` only (`service.ts:63-74`).<br>- `/` and `/control-room`: "Presenter safe mode is running entirely from cached and seeded outputs because no key was resolved".<br>- `/`, the line after that: "A usable key was resolved" (T21). | `global-ops-en-1440x900.png` | 9.2 |
| R07 | Medium | Role-app status vocabulary:<br>- the registry says `preview` and its chip "Preview";<br>- the role-apps lede and summary row say "Demo or concept";<br>- the role selector says "Demo";<br>- planned roles' function packs carry versions 1.1.0 to 1.4.0 (`src/product/seed.ts:470-587`);<br>- role apps reference `nfr-operational-risk` and `nfr-third-party-risk`, while the seeded packs are `rcsa-operational-risk` and `third-party-risk`. | `app/settings/role-apps/page.tsx:44-94` | 3.3, 7.2 |
| R08 | High | The release gate exists on the role Home only:<br>- Planned and Demo roles serve full V3 Work, Processes and Decisions pages (measured: `/workday/regulatory-change/decisions` 200 "Entscheidungen", `/workday/nfr-governance/processes` 200, `/workday/control-assurance/work` 200 "Arbeit");<br>- `?ui=v2` serves the whole V2 shell for them. | `app/workday/[role]/v3.tsx:327-330` is the only check | 3.3, 4.2 (Planned roles remain non-interactive) |
| R09 | Medium | Old interfaces remain live:<br>- V1 and V2 are reachable with `?ui=v1` and `?ui=v2`, and the choice persists for 30 days in the `nfr-workday-ui` cookie (`middleware.ts:115-120`);<br>- the V3.3 "Previous interface" menu item points to `?ui=current`, which resolves to V3.3, the same interface (`WorkdayHeaderClientActions.tsx:198`, `contracts.ts:87,91`);<br>- the README says V1 "is not a supported variant". | `rcsa-journey-previous-interface-en-1440x900.png` | 1.5 |
| R10 | Medium | Evaluation claims disagree:<br>- README: "14 structural evaluations" (`:480`) and "No automated grounding evaluation suite" (`:565`);<br>- CHANGELOG: "60+ evaluation cases" (`:62`);<br>- `package.json` has `eval:grounding`;<br>- AI quality says "Released" by "system" on 2026-10-02 and "Not yet evaluated" side by side, and points to `scripts/evaluate.ts` when `eval:structural` runs `scripts/eval-runner.ts`. | as cited | 7.5 |
| R11 | Medium | Readiness and health use their own words outside the plan's set:<br>- Pass, Warn and Error (pilot);<br>- HEALTHY and NOT-VERIFIED in raw uppercase ids (ops);<br>- "Sandbox ready", "Responding" and "Never synced successfully" on one connector at once (integrations);<br>- Production-shaped, Installed and Enabled (role apps). | screenshots of each page | 9.2 |
| R12 | Medium | The institution has three names: "Arcadia Savings Bank" (`app/settings/pilot/page.tsx:264`, `/setup`), "Arcadia Banking Group" (seed, README, entry page) and "Arcadia Bank AG" (the header entity). | as cited | 9.2 |
| R13 | Low | Documentation drift:<br>- the README TPRM route `/workday/tprm/process/tprm-third-party-onboarding` does not exist;<br>- README "40 tables" against 94 in the database;<br>- README says "ESLint was not added" while `npm run lint` runs eslint;<br>- CHANGELOG "meetings->meetings" against `next.config.ts:40`;<br>- CHANGELOG 4.x headings use a spaced double hyphen as punctuation;<br>- `/setup` lists 4 roles named "RCSA" and "TPRM". | as cited | 13.21 |

**R01 detail: version claims**
- `package.json` says 1.0.0.
- CHANGELOG has `[2.3.0]` and `[2.2.0]` at the top. They are presentation releases, numbered as product versions and undated, and they sit above `[4.0.0]`. There is no 2.4.0 entry, although V2.4 is HEAD.
- `/ops` hard-codes 4.0.0, "NFROS Design Partner Release".
- `scripts/release-package.ts` says 4.0.0, but `sbom.ts` and `evidence-pack.ts` emit 1.0.0.
- The UI version constant is `v3.3`. `role-release.ts` says "V3.3 release".
- The README says "V3.1 is the current default" and documents `?ui=v3.1`. There is no `v3.2` alias.

---

## 5. Journey gaps by area (plan section 4, 5.1, 5.2)

The journeys below were walked end to end on the own stack. A journey is classed as one of three:
- **Works:** it completes and persists.
- **Description only:** the screen describes the work, but no control performs it.
- **Fails or bypasses:** it completes in a way that breaks a rule or loses the result.

### 5.1 Summary per area

| Area (plan) | Works end to end | Description only | Fails or bypasses rules |
|---|---|---|---|
| Entry (4.1) | Links to the presentation and the workday | Proposition text | Developer runtime panel, global mode selector and reset on the client entry (D01). "Design partner workspace" links to a missing route (J02). |
| Role selection (4.2) | Opening the two Available roles | Process chips and summaries, from static definitions | Planned and Demo roles are fully interactive beyond Home (R08). "View demo" opens a page saying there is no demo (J04). |
| Home (4.3) | Now and Next come from the focus queue in the database | Partner Pulse (T01) | Fallback counts (T02, T03). It does not update after a decision or a completed process (J05). The Evidence drawer is always empty (T05). |
| Work Hub (4.4) | Tab switching with `?view=` and the action filters | Everything on a row | No selection, no detail and no master-detail. Every row control loops back to a list (J07, J08). |
| Agenda (4.5) | Lists the seeded events | Preparation chips, "AI preparing" | Conflicts stored in the database are not shown. "Join" appears on focus blocks. No process or object links (J09). |
| Meetings and minutes (4.6) | Lists upcoming meetings | "Ready" chips | No meeting workspace. Seeded minutes are invisible and minutes cannot be confirmed (J10, T11). |
| Actions (4.7) | Filters: Needs me, Waiting on others, Overdue, Completed | Kind and status chips | No detail, update, complete, reopen or evidence. The filters overlap (J11). |
| Inbox (4.8) | Lists messages with a proposed triage | "AI: Decision" chips | No triage change, no conversion to an action, evidence or process, no lineage (J12). |
| Processes (4.9) | The stepper and seeded stage state. A reload preserves the stage. | "AI prepared" text, artifacts, the morning brief (T14 to T18) | Stages complete with no criteria (J13). A preselected "proceed" and a pre-written position (J16). TPRM dead-ends at stage 5 (J15). Not idempotent (J17). |
| Decisions (4.10) | The rcsa decision records and executes, with a receipt | Consequence labels | The TPRM decision records while every consequence is refused, under the wrong approver, with no visible failure (J20). The receipt vanishes after refresh (J21). |
| AI Partner (4.11) | Opens in about 1 s once compiled. Suggestions, Activity and Chat tabs. The chat thread survives a reload. | Activity is a flat list of 60 entries at 07:45 | No disposition and no feedback (J24). Context is never the selection (J25). The safe-mode answer is contradictory and shown twice (J26). |
| Search (4.12) | Nothing | The button and the Ctrl+K hint | The button does nothing and Ctrl+K does nothing. The Updates bell toggles state that nothing renders (J28). |

### 5.2 Journey defects

| ID | Sev | Area | Finding (observed) | Evidence | Plan |
|---|---|---|---|---|---|
| J01 | Medium | Entry | The entry page is "Live the NFR day." with two buttons and a dark presenter theme. The product it leads to is light. There is no preview of either flagship role. Apart from three proposition lines, everything is English in German mode. | `app/page.tsx:72-115`. `global-landing-en-1440x900.png`, `global-landing-de-1440x900.png` | 4.1 |
| J02 | Medium | Entry | With `PRODUCT_MODE=design-partner`, "Design partner workspace" links to `/pilot`, which returns 404 (measured). | `app/page.tsx:99-103` | 4.1, 7.7 |
| J03 | Medium | Role selection | There is no live professional signal (focus, active process, next meeting). The selector is built from static definitions and is English only; `summaryDe` is never used. | `src/components/workday-v3/RoleSelector.tsx:9-11, 103-118`. `global-role-selector-de-1440x900.png` | 4.2 |
| J04 | Medium | Role selection | "View demo" on a Demo role opens a page that says "This role is not part of the current two-role interactive release". No demo is behind the link. | `RoleSelector.tsx:356`, `PreviewRolePage.tsx:67-80` | 3.3, 4.2 |
| J05 | High | Home | Home does not move after work is done. After DEC-2026-0771 was recorded and all eight RCSA stages were completed:<br>- Home still says "3 need your judgment" and shows the same three Next items;<br>- the Now card re-presents the decided question as an AI suggestion ("Review and accept or change it: Three Red indicators on one process look like one causal chain");<br>- there is no Done summary and no sign of the completed run.<br>The Decisions badge went from 5 to 4. | `rcsa-journey-home-after-decision-en-1440x900.png`, `rcsa-journey-home-after-process-run-en-1440x900.png`, `tprm-journey-home-after-stage4-en-1440x900.png` | 4.3 (Home updates immediately), 13.3 |
| J06 | Low | Home | The Now card does not answer "By when?". The Next items show the presented time (07:45 for all three), not a deadline or materiality order. | `rcsa-home-en-1440x900.png` | 4.3 |
| J07 | High | Work Hub | There is no selection model:<br>- clicking an action row changes nothing (the URL is unchanged);<br>- there is no detail pane or drawer for any row;<br>- the AI Partner cannot bind to a row.<br>`work/v3.tsx` is one 1,455-line server component holding tab logic, labels, static data, mapping and rendering. The acceptance target is under 300 lines. | `rcsa-journey-action-row-click-en-1440x900.png`; `work/v3.tsx` | 4.4 |
| J08 | High | Work Hub | Every row-level control loops back to a list:<br>- Agenda "Open preparation" goes to `?view=meetings` with no meeting selected;<br>- "Join" goes back to `?view=agenda`;<br>- Meetings "Open" and Inbox "Review" reload the same tab;<br>- action ids are plain text. | `work/v3.tsx:326-331, 543, 1159, 919-920`. `rcsa-journey-agenda-open-preparation-en-1440x900.png`, `rcsa-journey-meeting-open-en-1440x900.png`, `rcsa-journey-inbox-review-en-1440x900.png` | 4.4 to 4.8 |
| J09 | Medium | Agenda | `calendar_events.has_conflict` is set for rcsa 10:30 and 11:45 and tprm 10:30 and 11:00, but the Agenda shows no conflict. Other gaps:<br>- no Day or Week view;<br>- no linked process or object;<br>- "Join" is offered on focus blocks;<br>- the RCSA challenge workshop is today at 10:30 while the RCSA run is at stage 2 of 8 and stage 5 is locked. | `rcsa-work-agenda-en-1440x900.png`, `rcsa-process-rcsa-cycle-s5-challenge-workshop-de-1366x768.png` | 4.5 |
| J10 | Critical | Meetings and minutes | There is no meeting journey: nothing for before, during or after a meeting, and no transcript, capture or confirm control. The seeded TPRM draft minutes (`MINUTES-TPRM-EVIDENCE-TRIAGE-2026`) cannot be found or confirmed anywhere in the UI. `confirmMeetingMinutes` and `createMeetingMinutes` have no caller. The minutes archive is always empty in the seeded state (T11). | `tprm-journey-meetings-en-1440x900.png`, `tprm-journey-meeting-open-en-1440x900.png`; `role-app-runtime.ts:298-344` | 4.6, 13.4 |
| J11 | High | Actions | The actions list is read-only:<br>- there is no detail and no assign, change date, add update, complete with evidence, reopen or escalate;<br>- `action_updates` has 0 rows and `appendActionUpdate` has no caller;<br>- "Needs me" and "Waiting on others" overlap: any open row with an owner label appears in both (`work/v3.tsx:1021-1034`);<br>- the Overdue filter shows MSN-2026-0166, which Home leaves out of "Open actions". | `rcsa-journey-actions-filter-overdue-en-1440x900.png`, `rcsa-journey-actions-filter-waiting-on-others-en-1440x900.png` | 4.7, 13.4 |
| J12 | High | Inbox | The inbox is display only:<br>- there is no confirm or change triage, no classification rationale, and no create action, link as evidence, add to process, delegate, draft reply or dismiss;<br>- `linkedActionId` and `linkedDecisionId` exist in the schema but are never rendered or written;<br>- "Review" reloads the tab. | `rcsa-journey-inbox-review-en-1440x900.png`; `src/db/schema/work.ts:41,46-47` | 4.8, 13.4 |
| J13 | Critical | Processes | Stage completion has no criteria. All eight RCSA stages were completed in under a minute by clicking "Submit evidence decision" with an empty optional note:<br>- open decisions RCSA-D2 and RCSA-D3 were still listed under stages 3, 4, 6 and 7 when those stages completed;<br>- the challenge-workshop stage completed although the 10:30 workshop had not happened;<br>- the server action does not check tasks, decisions, approvals, artifacts, the stage's real status or the role;<br>- it records no user (`completeStageRun(stageRunId, null)`).<br>The run is now `completed`. | `rcsa-journey-process-after-stage2-submit-en-1440x900.png`, `rcsa-journey-process-loop-0..4-en-1440x900.png`, `rcsa-journey-process-after-run-en-1440x900.png`; `app/workday/[role]/processes/rcsa-cycle/actions.ts:28-101` | 1.2, 4.9 (Continue does not bypass criteria), 9.5, 13.5 |
| J14 | High | Processes | Every RCSA stage gets the same generic form and the label "Submit evidence decision". No stage captures its own human judgment, for example:<br>- "Rating and Appetite" asks to "Ratify the residual rating for RSK-0211" but offers no rating input;<br>- "Actions and Approval" asks to "Approve the assessment version" but has no approval step.<br>Stage outputs are not stored anywhere; `role_app_artifacts` is still 0 rows after the run. | `rcsa-journey-process-loop-2-en-1440x900.png`, `-loop-3-` | 5.1 |
| J15 | High | Processes | TPRM dead-ends at stage 5. After the stage 4 submit:<br>- stage 5 "Specialist Reviews" is badged "In Progress";<br>- it has no form (`formsOnNextStage=0`), because the form is hard-wired to `evidence-review` and no stage run is created;<br>- its AI text still says "Stage locked. Complete Stage 4 evidence sufficiency decision first."<br>The process cannot be continued from the UI. | `tprm-journey-process-after-stage4-submit-en-1440x900.png`; `third-party-onboarding/v3.tsx:727-730`, `third-party-onboarding/actions.ts:25-81` | 5.2, 13.5 |
| J16 | High | Processes | Two positions are preselected:<br>- the TPRM stage-gate note is pre-filled with the recommended position, "Proceed with available evidence. Escalate missing penetration test and BCM plan." Submitting without typing records an AI-authored position as the human's note;<br>- the RCSA form posts a hidden `decision=proceed`, so the user cannot choose waive or escalate. The server ignores the field. | `third-party-onboarding/v3.tsx:778`; `rcsa-cycle/v3.tsx:362`. `tprm-process-third-party-onboarding-bottom-en-1366x768.png` | 4.10 (no option preselected), 9.5 |
| J17 | Medium | Processes | Stage completion is neither idempotent nor transactional. A double-click on the stage 3 submit wrote `stage-completed` (risk-control-change) and `stage-entered` (first-line-input) twice. Event ids are derived from the clock. There is no transaction. | `rcsa-journey-process-after-stage3-dblclick-en-1440x900.png`; `role_app_events` rows | 4.9 (duplicate submission idempotent), 8.2 |
| J18 | Medium | Processes | After the RCSA run reached `status = completed`, the Processes list still says "In progress, Stage 8: Monitoring and Reassessment". `getActiveRun` has no status filter. | `rcsa-journey-processes-after-run-en-1440x900.png`; `processes/v3.tsx:470`, `role-app-runtime.ts:62-85` | 4.9 |
| J19 | Medium | Processes | Stage events are written to `role_app_events` only. They reach neither `audit_events`, Home, Work, Decisions nor the AI Partner Activity. Completing the run created no artifact, action or evidence. | DB after the run; J05 screenshots | 4.9 lifecycle step 15 |
| J20 | Critical | Decisions | A TPRM decision recorded in V3.3 is marked done but changes nothing, under the wrong approver, and the user is not told:<br>- the active role stays `rcsa`, because V3 never calls `actionSwitchRole`;<br>- DEC-2026-0741 was written as `status = decided`;<br>- every consequence (createIssue, requestEvidenceDocument, activateMonitoring) was refused by the authority gate: "The approval was granted under a different role than the one now acting";<br>- the approvals are recorded as granted by **P-003 Marlene Aigner, the Operational Risk Partner**, for a third-party decision;<br>- the analyst sees no receipt and no failure: the panel collapses to "2 open, 1 recorded today".<br>The source comment says that in this case "the decision cannot be recorded at all"; in the browser it is recorded. | `tprm-journey-decision-receipt-en-1440x900.png`; `audit_events`; `src/scenario/engine/decide.ts:350-366` (grants as `state.activeRoleId`) against `:539` (acts as `decision.roleId`) and `:545-556` (decision written before execution) | 4.10, 9.5, 13.6, 13.7, 13.8 |
| J21 | High | Decisions | The rcsa receipt ("Decision recorded. 3 change(s) executed", with three lines) disappears within seconds, when `router.refresh()` unmounts the active decision. Afterwards only "Recorded today 1" remains, and it holds no receipt. The count includes the pseudo line "Decision rationale recorded against DEC-2026-0771", so "N change(s) executed" can never be 0. The success icon is shown even when the result is not ok. | `rcsa-journey-decision-5-receipt-en-1440x900.png` against `rcsa-journey-decision-6-after-refresh-en-1440x900.png`; `DecisionQueue.tsx:284, 404-412`; `decide.ts:587, 650-656` | 4.10 (receipt shows success and failure separately), 13.8 |
| J22 | Medium | Decisions | Decision workspace gaps:<br>- it has four steps (Understand, Compare, Explain, Confirm) instead of the five-part workspace;<br>- it does not link to the process or meeting;<br>- target systems are not shown, only generic consequence labels;<br>- one checkbox approves every payload;<br>- the 20-character rationale minimum is client-side only (the server accepts 1 character, `app/actions.ts:76`);<br>- nothing stops a decided item from being re-recorded.<br>**Positive:** no option is preselected (all `aria-checked=false`), Next is disabled until a choice and a rationale exist, and Confirm is disabled until the ownership box is ticked. | `rcsa-journey-decision-2-compare-en-1440x900.png`, `-3-explain-`, `-4-confirm-` | 4.10 |
| J23 | Medium | Decisions | Deep links of the form `/decisions#DEC-...` (from the RCSA app "View decision" and Partner Approve or Review) only scroll; they do not select. The page always opens on the first row. | `src/features/decisions/queue.ts:284` | 4.4 cross-object linking |
| J24 | High | AI Partner | Suggestion lifecycle and feedback are not stored:<br>- the card offers only "Approve", which navigates to Decisions;<br>- Dismiss and Snooze POSTs are stripped by the route schema;<br>- `ai_suggestions.dismissed_at` and `snoozed_until_moment` are never written;<br>- there are no Useful, Not useful or Wrong source controls and no feedback table. | `rcsa-journey-dock-suggestions-en-1440x900.png`; `src/components/workday-v2/PartnerClient.tsx:212-226`; `app/api/workday/suggestion/route.ts:33-49` | 4.11, 13.11 |
| J25 | Medium | AI Partner | The chat context is "Asking about the day of this role" on every screen. The dock fetches `/api/workday/partner` without a selection, although the route supports one. | `rcsa-journey-dock-chat-en-1440x900.png`; `WorkdayPartnerDock.tsx:148-150` | 4.11 (selection updates context) |
| J26 | Medium | AI Partner | In safe mode the chat answer begins: "A live call was attempted and failed, so this answer was not produced by a model. Reported reason: Live calls are not permitted in the current mode." This is contradictory, and it uses internal terms ("live call", "model", "seeded scenario"). The question and answer are rendered twice in the transcript. | `rcsa-journey-dock-chat-reply-en-1440x900.png` | 9.6, 4.11 |
| J27 | Low | AI Partner | While the dock is open, its scrim blocks the navigation rail; the rail cannot be clicked until the dock is closed. Activity is a flat list of 60 entries, all at 07:45, with no notification budget. **Positive:** the chat thread survived a full reload (persisted in `chat_threads`). | `rcsa-journey-dock-activity-en-1440x900.png` | 4.11 |
| J28 | High | Search | The header Search button and Ctrl+K open nothing in V3.3: `CommandPalette` is mounted only in the V2 `ShellFrame`. The Updates bell toggles `updatesOpen`, which nothing renders. Both are dead controls in the primary shell. | `rcsa-journey-search-click-en-1440x900.png`, `rcsa-journey-updates-en-1440x900.png`; `WorkdayHeaderClientActions.tsx:84, 96` | 4.12, 3.2 |
| J29 | Medium | Shell | The V3.3 shell has no language control. Language is one global database column, so switching it (only possible from V1 or V2) changes the language for every viewer of the same database. | `src/scenario/engine/state.ts:233-236`; `src/db/repositories/header.ts:42` | 8.5, 13 |

---

## 6. Product-owner surfaces (plan 6.2 and 7)

Reachability:
- From the analyst shell, the Account menu links to Trust, Control room and Settings. Settings lands on `/settings/organisation`, not the index.
- `/ops`, `/setup` and `/settings/audit-integrity` are not linked from anywhere.
- No route is protected:
  - the middleware matcher covers `/workday` only;
  - `requireAdministrator` (`src/identity/access.ts:33`) is never called;
  - `/ops` says "open in demonstration mode".
- The settings index says it "is not reachable from the workday navigation" (`app/settings/page.tsx:120-122`). That is false.
- All settings pages are English only. The layout fixes the language to "en" (`app/settings/layout.tsx:43`).
- There is no Product Owner Console (`/product` or `/settings/product`, plan 7). The control room is a presenter trace, not a product overview.

| ID | Sev | Page | What it shows | Read-only or working | Non-functional or missing against 6.2 and 7 | Evidence |
|---|---|---|---|---|---|---|
| P01 | High | `/settings/role-apps` | Static `ROLE_APP_REGISTRY`: 7 apps, of which 2 are installed at v1.0.0 "Production-shaped" and 5 are preview at v0.1.0. Shows route, stages, connector packs and decision kinds. | Read-only | The "Enabled" chip is a placeholder titled "Enabled for analysts (non-functional in this build)" (`page.tsx:144-152`). Missing: enable or disable, stage release, compare versions, cohort, dependencies, usage, stage performance, feedback, retire. `role_app_runs` and `role_app_stage_runs` exist but are not read. | `global-settings-role-apps-en-1440x900.png` |
| P02 | High | `/settings/ai-quality` | Static `AI_CONFIGURATION_REGISTRY` and `MODEL_PROFILES`: 2 released configurations, model ids, temperature and token limits. | Read-only by design | Evaluation status is static text (T24). Missing: run evaluation, inspect failures, compare candidate with released, approve, roll back, user modification and rejection. There is no feedback table; suggestion dismiss and snooze are not stored (J-AI). | `global-settings-ai-quality-en-1440x900.png` |
| P03 | High | `/settings/pilot` | Six computed readiness checks (5 of 6 pass; PRODUCT_MODE warns). Static pilot accounts, a DORA/EBA scope chip, and evidence-pack instructions with `npm run`. | Read-only | "Download evidence pack (API)" links to `/api/pilot/evidence`, which returns 404. "Audit chain: initialised" passes with zero records. Missing: cohort, baseline, goals, success criteria, issues, feedback, weekly adoption, outcomes, go or stop decision. | `global-settings-pilot-en-1440x900.png` |
| P04 | High | `/ops` | Health summary, job queue, failed jobs (last 5), AI provider, audit chain, static release block | Read-only | Visually broken at every viewport: sections overlap and the headings are almost invisible (h1 contrast 1.08:1, U02). Nothing can be done with a failed job, although `cancelJob` exists. Error detail is not shown. Missing: affected role, process or users, recovery, a product status, a release decision. Unlinked. | `global-ops-en-1440x900.png`, `global-ops-en-1366x768.png` |
| P05 | Medium | `/settings/integrations` | Database-driven: 17 connectors grouped by mode, health, write state, credential state, last sync, outbox queue, sync state | **Working:** Retry, Run a sync, Send an event, Set unavailable / Recover (`src/components/integrations/queue.tsx:167-322`) | Missing: test connection, pause writes, resolve mapping, diagnostic bundle (CLI only). Dead letters are merged into queue rows with no action. Freshness is not computed. | `global-settings-integrations-en-1440x900.png` |
| P06 | Medium | `/settings/mappings`, `/organisation`, `/authority`, `/deployment`, `/role-packs` | Database-backed or registry-backed configuration views | Read-only. Mappings says "Read only in this build". Authority says "nothing on this page can be changed". | No resolve-mapping action. Organisation and terminology cannot be edited. | `global-settings-*-en-1440x900.png` |
| P07 | Info (not counted) | `/settings/branding` | Brand profiles and change log | **Working:** switch profile, clear override (`src/product/actions.ts:58-167`) | None against plan scope | `global-settings-branding-en-1440x900.png` |
| P08 | Medium | `/settings/audit-integrity` (unlinked) | Hash-chain verification, computed on every render | Read-only | Shows `npm run audit:verify-chain`, `npm run db:seed` and "Planned - will be available at /api/audit/export", which returns 404. Not in the settings navigation. | `global-settings-audit-integrity-en-1440x900.png` |
| P09 | Medium | `/control-room` | Runtime mode, key resolution, model resolution, and full trace sections from observability | **Working:** mode selector (live, safe, offline), which writes global demo mode | Developer content one click from the analyst shell (D02). Not a product overview (7.1). | `global-control-room-en-1440x900.png` |
| P10 | Low | `/settings` index | Area list, recent configuration changes, documentation pointers | Read-only | Role apps, AI quality and pilot have empty subtitles. Stale "seven areas" text. Audit integrity is not listed. | `global-settings-en-1440x900.png` |
| P11 | Low | `/setup` | Five-step orientation wizard | Display only | Static organisation values. Names "Arcadia Savings Bank". Lists 4 roles. Shows PRODUCT_MODE. | `global-setup-en-1440x900.png` |
| P12 | Medium | `/value`, `/trust`, `/roadmap` | Counted scenario figures, trust Q&A, static roadmap phases | Read-only | Trust shows model ids and key resolution. Value is honest about modelled against counted figures (positive). | `global-trust-en-1440x900.png` |
| P13 | High | Product Owner Console (plan 7) | Does not exist | n/a | There is no product overview, Role App performance, experience analytics, feedback inbox or release view. The data for overview and performance already exists (`role_app_runs`, `role_app_stage_runs`, `decisions`, `ai_activity_entries`, `background_jobs`). There is no feedback table. | n/a |
| P14 | Medium | Access to every product-owner page | All pages answer without a session | n/a | The middleware matcher covers `/workday` only. `requireAdministrator` (`src/identity/access.ts:33`) is never called. `/ops` says "open in demonstration mode". | `global-ops-en-1440x900.png` |

Coverage against plan 7, at f5a1ffb:

| Plan 7 area | State |
|---|---|
| 7.1 Product overview | Absent |
| 7.2 Role App lifecycle | Read-only catalogue only |
| 7.3 Role App performance | Absent. The data exists in `role_app_runs`. |
| 7.4 Experience analytics | Absent |
| 7.5 AI quality | Descriptive only |
| 7.6 Integrations | Partly working (sync, retry, outage switch) |
| 7.7 Pilot | Readiness checks only |
| 7.8 Feedback | Absent. No table exists. |
| 7.9 Release | A static block on `/ops` |

---

## 7. Usability and quality (plan 13.18, 13.19, 9.6)

### 7.1 Measured across all captures

These figures cover 216 route captures and 48 stage captures, EN and DE, at 1920x1080, 1440x900 and 1366x768.

- Horizontal page overflow: **0** pages.
- Visible elements extending past the right edge of the viewport: **0**.
- Umlaut characters rendered: **0**.
- Em dashes rendered: **0**.
- En dashes rendered: **0**.
- Spaced double hyphens rendered: **6**, all on `/ops` (2 per viewport).
- Loading, `aria-busy`, progressbar or skeleton states still present after settle: **0**. The AI Partner dock shows "Opening the partner" for about 1 s on first open, then resolves.
- Console errors or page errors: **0**.

### 7.2 Defects

| ID | Sev | Finding | Viewports and languages | Evidence | Plan |
|---|---|---|---|---|---|
| U01 | High | The muted text token `#7b8494` fails WCAG AA contrast on every V3 page: 3.76:1 on white and 3.48:1 on `#f5f6f8`. It is used for the header entity, meta lines, item subtitles, the synthetic label and stepper labels. Locked stage labels use `#a0a8b5` at 2.21:1. axe reports `color-contrast` (serious) on 15 of 16 scanned pages (table 7.3). | All | `audit-results/axe.json` (scratch); `rcsa-process-rcsa-cycle-en-1440x900.png` | 13.18 |
| U02 | Critical | `/ops` is visually broken at every viewport. "JOB QUEUE", "Pending jobs" and "FAILED JOBS (LAST 5)" are drawn over the System health rows. The h1 "Operations Console" has 1.08:1 contrast and the component names and release values are close to invisible: dark blue on near-black, because a light-theme token is used on a dark page. axe finds 26 contrast failures. | All, EN and DE | `global-ops-en-1440x900.png`, `global-ops-en-1366x768.png`, `global-ops-en-1920x1080.png` | 6.2, 13.18 |
| U03 | High | German is incomplete. Details are listed under the table. | DE, all viewports | `global-role-selector-de-1440x900.png`, `rcsa-home-de-1440x900.png`, `rcsa-work-agenda-de-1440x900.png`, `rcsa-work-actions-de-1366x768.png`, `tprm-work-inbox-de-1440x900.png`, `tprm-process-third-party-onboarding-s5-specialist-reviews-de-1366x768.png`, `global-settings-pilot-de-1440x900.png` | 13, copy rules |
| U04 | Medium | Raw ISO timestamps appear in analyst views: Meetings shows "2026-10-06T09:30:00.000Z, 2 participants" and Inbox shows "2026-10-05T06:00:00.000Z". The trailing "Z" states UTC while the Agenda shows the same meeting at a local 09:30. German due dates read "Faellig 2026-11-02" instead of 02.11.2026. | All | `rcsa-work-meetings-en-1440x900.png`, `tprm-work-inbox-de-1440x900.png`; `work/v3.tsx:534, 1151` | 9.6 |
| U05 | Medium | On the entry page at 1366x768 and 1440x900, the right column is cut by the viewport: "Demonstration mode" scrolls inside a fixed `100dvh` shell, with no visible affordance. | 1366, 1440 | `global-landing-en-1366x768.png`, `global-landing-bottom-en-1366x768.png` | 4.1 |
| U06 | Medium | Single-line ellipsis hides content that has no other place to be read:<br>- Partner Pulse is cut at every width (`white-space: nowrap`);<br>- action titles and inbox subjects are cut at 1366x768, and more so in German;<br>- TPRM decision rows are cut in German ("Luecke bei der Wiederherstellungszeit von RepairDesk, 137 Tage ni..."). | All, worst at 1366 DE | `rcsa-home-bottom-en-1366x768.png`, `rcsa-work-actions-de-1366x768.png`, `tprm-decisions-de-1440x900.png` | 9.1, 13.18 |
| U07 | Medium | RCSA stage order is wrong. The submit control sits above the stage's open decision, so the user meets "Submit" before the decision it depends on. At 1440x900 and 1366x768 the button is below the fold. "Recent events" is an empty heading with no empty-state text. | 1440, 1366 | `rcsa-process-rcsa-cycle-bottom-en-1440x900.png` | 9.4 (action first, then reason) |
| U08 | Medium | `<html lang="en" data-theme="dark">` is fixed for every page and language. Screen readers announce German as English. | DE | `app/layout.tsx:45` | 13.18 |
| U09 | Low | German terminology is inconsistent: "Manager Drittparteienrisiko" sits beside "Drittanbieter-Onboarding", and "Work Hub oeffnen" keeps an English product term. | DE | `tprm-process-third-party-onboarding-de-1366x768.png`, `rcsa-home-de-1440x900.png` | 9.3 |
| U10 | Low | No route is slow enough to block in development, but Work and Processes have the highest time to first byte, about 2 to 2.5 s (table 7.4). They build their whole model, including static fallbacks, on every request. Performance must be re-measured on a production build before the plan's performance gate. | EN 1440 | `audit-results/timing.json` (scratch) | 13.19 |
| U11 | Low | axe `scrollable-region-focusable` (serious) on `/settings/role-apps`: `#main` scrolls but cannot be focused. | All | axe | 13.18 |

**U03 detail: German gaps**
- **English-only pages:** the role selector, the entry page (all but three proposition lines), all of `/settings/*`, `/ops`, `/control-room`, `/trust`, `/value`, `/roadmap`, `/setup` and the 404 page.
- **English labels in German Work Hub views:**
  - agenda kinds "Focus", "Meeting" and "Workshop";
  - preparation chips "Not prepared" and "AI preparing";
  - ", N participants";
  - triage chips "AI: Action" and "AI: Decision";
  - inbox channels "Alert" and "GRC Queue";
  - action kinds "Monitoring", "Validation request", "Communication" and "Evidence request";
  - statuses "In progress" and "Open" (`work/v3.tsx:226-246, 535, 1049-1078`).
- **English text in other German views:**
  - the Home Now body and "AI prepared" line;
  - the third Next title, "Escalation route for three Red indicators", which has no `titleDe`;
  - the Decisions Understand text;
  - all process "AI prepared" text, tasks and artifacts;
  - the TPRM badges "In Progress" and "Locked";
  - the pre-filled TPRM note;
  - seeded inbox subjects.

### 7.3 axe-core results (EN, 1440x900, WCAG 2.0 and 2.1 A and AA)

| Page | Violations (impact, rule, nodes) |
|---|---|
| rcsa Home | serious, color-contrast, 14 |
| rcsa Work (Agenda) | serious, color-contrast, 4 |
| rcsa Work (Inbox) | serious, color-contrast, 12 |
| rcsa Processes | serious, color-contrast, 4 |
| rcsa RCSA app | serious, color-contrast, 14 |
| rcsa Decisions | serious, color-contrast, 14 |
| tprm Home | serious, color-contrast, 14 |
| tprm Work (Agenda) | serious, color-contrast, 4 |
| tprm Work (Inbox) | serious, color-contrast, 18 |
| tprm Processes | serious, color-contrast, 4 |
| tprm TPRM app | serious, color-contrast, 19 |
| tprm Decisions | serious, color-contrast, 14 |
| Entry `/` | none |
| Role selector `/workday` | serious, color-contrast, 20 |
| `/ops` | serious, color-contrast, 26 (h1 at 1.08:1) |
| `/settings/role-apps` | serious, color-contrast, 2; serious, scrollable-region-focusable, 1 |

No critical-impact violation was found. Every Home, Work, Processes and Decisions page fails AA contrast for both roles.

### 7.4 Page load times

Medians of three loads at 1440x900 on a warm `next dev` (webpack) server, in milliseconds. Each route was compiled first. Treat these as development upper bounds (see the caveat in section 0).

| Route | Time to first byte | DOM content loaded | Load event |
|---|---|---|---|
| `/` | 176 | 242 | 3,186 |
| `/workday` | 274 | 422 | 3,118 |
| `/workday/rcsa` | 662 | 745 | 2,590 |
| `/workday/rcsa/work?view=agenda` | 1,940 | 2,201 | 5,443 |
| `/workday/rcsa/processes` | 2,547 | 2,630 | 7,911 |
| `/workday/rcsa/processes/rcsa-cycle` | 717 | 854 | 3,453 |
| `/workday/rcsa/decisions` | 676 | 974 | 5,915 |
| `/workday/tprm` | 1,337 | 1,487 | 4,702 |
| `/workday/tprm/work?view=inbox` | 2,196 | 2,332 | 4,210 |
| `/workday/tprm/processes/third-party-onboarding` | 2,198 | 2,511 | 6,296 |
| `/workday/tprm/decisions` | 880 | 982 | 3,348 |
| `/settings/integrations` | 1,209 | 1,373 | 2,967 |
| `/control-room` | 561 | 722 | 2,586 |
| `/ops` | 198 | 295 | 2,815 |

The load event includes development-only client chunks and the HMR client, so it is not a product figure. Time to first byte is the useful signal: Work and Processes are about three times slower than Home and Decisions. The first compile of a route in development took 10 to 120 s. That is irrelevant to production, but it matters to anyone demonstrating from `npm run dev`.

---

## 8. Developer-facing content in client and analyst paths (plan 4.1, 9.3, 9.6)

| ID | Sev | Where | What is exposed | Evidence |
|---|---|---|---|---|
| D01 | Critical | `/`, the client and executive entry page | "Runtime status" panel:<br>- AI mode, "Live AI configured false", "Live AI verified not yet attempted", "Configuration source not found", "Voice typed fallback only", "Scenario seeded true";<br>- three paragraphs about key handling, including "Run npm run smoke:live to verify";<br>- a live, safe and offline mode selector that writes global demo state;<br>- "Reset the day" in the footer;<br>- when the database is unseeded, the setup commands `npm run db:migrate` and `npm run db:seed`.<br>Plan 4.1 acceptance criteria 1 to 3 all fail. | `app/page.tsx:117-229, 196, 224, 253`. `global-landing-en-1440x900.png`, `global-landing-en-1366x768.png` |
| D02 | High | Analyst Account menu, then Control room and Trust | Key resolved, "File that supplied the key", `REAL_AI_INFRA_PATH`, model ids per role, "Scenario seeded", illustrative cost in USD, and a mode selector that changes global state | `WorkdayHeaderClientActions.tsx:229-240`. `rcsa-journey-account-menu-en-1440x900.png`, `global-control-room-en-1440x900.png` |
| D03 | Medium | Analyst header, "Display and demo" menu | "Demo mode" toggle, "Presentation" and "Previous interface" (a dead loop, R09). These are presenter controls in the analyst header. | `WorkdayHeaderClientActions.tsx:135-203`. `rcsa-journey-display-menu-en-1440x900.png` |
| D04 | Medium | Settings pages, reachable from the analyst Account menu | `npm run pilot:evidence-pack`, `npm run audit:verify-chain`, `npm run db:seed`, `PRODUCT_MODE`, file paths (`src/ai/source-status.ts`, `docs/PRODUCTIZATION_GAPS.md`, `release/pilot-evidence.json`), model ids and providers, "Last written by seed" | Section 6 rows |
| D05 | Medium | `/ops`, unauthenticated | "No API key configured", component ids, raw health ids | `global-ops-en-1440x900.png` |
| D06 | Low | Analyst empty states | RCSA app "No active RCSA run. Seed the database ..." (`rcsa-cycle/v3.tsx:143`). Work context line shows the internal id "RCSA-ARC-DE-PAYOPS-2026-Q4". Settings "Run the database migration and seed". | as cited |

The V3.3 analyst routes themselves (Home, Work, Processes, Decisions) showed no API-key, model, setup-command or seed text in any language or viewport. Developer content reaches the analyst through the Account and Display menus, and through the entry page.

---

## 9. Prioritised defect list (implementation checklist)

This list is ordered by risk to a design-partner pilot. The wave column uses the plan's section 10 waves:
- **W0:** truth and release coherence;
- **W1:** daily Role OS;
- **W2:** process engine;
- **W3:** AI Partner;
- **W4:** Product Owner Console;
- **W5:** design-partner readiness.

Tick an item only when its "Done when" is demonstrated in the browser on a freshly seeded database, in both languages.

### 9.1 Critical and high (48 items, fix in this order)

| # | ID | Sev | Wave | Defect | Done when |
|---|---|---|---|---|---|
| 1 | J20 | Critical | W2, fix first | A TPRM decision is recorded as decided while every consequence is refused, and approvals are attributed to the rcsa holder | The acting role follows the route role, or the decision is refused before it is written. Approvals carry the correct named person. A blocked consequence is shown as not executed. |
| 2 | J13 | Critical | W2 | A stage completes with no criteria, no user and open decisions | The stage contract defines completion criteria, and the server refuses completion until they are met. The completing user is recorded. |
| 3 | T05 | Critical | W1 | The context drawer always says "Nothing selected" | The drawer renders the evidence, details, activity and audit of the selected object on Home, Work, Processes and Decisions |
| 4 | T14 | Critical | W2 | RCSA "AI prepared" text is inline and contradicts the data | Stage preparation comes from stored AI or offline outputs that are consistent with the seeded run, in EN and DE |
| 5 | T16 | Critical | W2 | TPRM "AI prepared" text is inline and contradicts the data | Same as #4. A locked or entered stage never shows "Stage locked" as preparation. |
| 6 | T01 | Critical | W0 | Partner Pulse is hard-coded | Partner Pulse is built from routine runs and activity, and each statement links to its lineage. Nothing renders when nothing ran. |
| 7 | D01 | Critical | W0 | The entry page shows runtime and key state, the mode selector, reset and setup commands | The entry page has the hero, two role previews and the trust strip only. Runtime state lives in ops, control room and settings. |
| 8 | J10 | Critical | W1 | No meeting or minutes journey; seeded minutes are invisible | One complete meeting journey per role: prepare, capture, edit, confirm. Confirmed minutes create actions and evidence with lineage. |
| 9 | U02 | Critical | W4 | `/ops` overlaps and is unreadable | No overlap at the three viewports. axe passes contrast. Ops reads as part of the product. |
| 10 | J16 | High | W2 | TPRM note is pre-filled with the AI position; RCSA posts a hidden `decision=proceed` | No pre-written human rationale. The user chooses the gate outcome explicitly. |
| 11 | J15 | High | W2 | TPRM dead-ends at stage 5 | All eight TPRM stages can be executed in the UI |
| 12 | T28 | High | W0 | The real person name "Thomas Zijlstra" and other non-institution people appear in synthetic content | Every person named in the UI exists in `users`. Running `grep` on the source finds no real names. |
| 13 | T02 | High | W0 | "Open actions" falls back to 4 or 3 and excludes overdue | The count comes from the database and includes overdue. "0" renders when there are none. |
| 14 | T03 | High | W0 | The inbox tile falls back to 2 | The count comes from the database. "All reviewed" renders at 0. |
| 15 | T07 | High | W0 | The Decisions badge counts future decisions | The badge equals the queue's open count at the current moment |
| 16 | T06 | High | W0 | The header shows "1 suggestion" for any count | The real count, filtered by moment and validation |
| 17 | R08 | High | W0 | Planned and Demo roles are interactive beyond Home | Planned roles are non-interactive on every route. Demo roles are labelled Demo on every route, under every `?ui=`. |
| 18 | R01 | High | W0 | Seven version claims | One release registry feeds package, CHANGELOG, README, ops and UI |
| 19 | R02 | High | W0 | Five product names, and the header flips during load | One product name from the brand model everywhere |
| 20 | T21 | High | W0 | The entry page says "A usable key was resolved" when none was | The key status text is computed |
| 21 | J21 | High | W2 | The decision receipt disappears after refresh and the count includes a pseudo line | The receipt persists, can be reopened from "Recorded today", and lists successful and failed consequences separately |
| 22 | J28 | High | W1 | Search, Ctrl+K and Updates are dead | Global search and the command palette work in V3.3, grouped by object and scoped to role. Updates opens a panel. |
| 23 | J12 | High | W1 | The inbox is display only | Triage is editable with a rationale. Message-to-action, message-to-evidence and message-to-process work and show lineage. |
| 24 | J11 | High | W1 | Actions have no detail, update or complete | Action detail, append-only updates and complete with evidence work. Material closure needs confirmation. |
| 25 | J07 | High | W1 | The Work Hub has no selection or master-detail; the route is 1,455 lines | Selection persists across tabs and binds the drawer and the AI Partner. The route file is under 300 lines. |
| 26 | J08 | High | W1 | Row controls loop back to lists | Every row control opens its object |
| 27 | J05 | High | W1 | Home does not update after a decision or a process | Home reflects decisions, stages, minutes and actions without a manual refresh, and has a Done summary |
| 28 | T08 | High | W0 | Static Work fallback day | Fallback arrays are removed. An empty role shows honest empty states, and an unready database shows NotSeeded. |
| 29 | T09 | High | W0 | The Work context line is hard-coded per role | The context line is derived from the active run, or omitted |
| 30 | T10 | High | W1 | "Ready" in Meetings against "Not prepared" in Agenda | One preparation state per meeting, from one source |
| 31 | T11 | High | W1 | The minutes archive ignores `meeting_minutes` | The archive lists the confirmed and draft minutes from the database |
| 32 | T20 | High | W1 | Seeded minutes reference missing meetings, decisions, actions and evidence, and name "Anna Weber" | The seed is referentially intact (checked by `verify:seed`) |
| 33 | T15 | High | W2 | RCSA artifacts are static | Artifacts are written by stages and read from `role_app_artifacts`. No static artifact while a run exists. |
| 34 | T17 | High | W0 | Hard-coded PRQ reference, "as at" date, supplier, "In progress" prefix | All are derived from the run, the supplier and the scenario date |
| 35 | T18 | High | W0 and W3 | The Morning Brief is static prose | Removed in W0; replaced by real routine output with lineage in W3 |
| 36 | J14 | High | W2 | A generic "Submit evidence decision" form on every stage | Each stage captures its own human judgment and stores an output |
| 37 | J24 | High | W3 | Suggestion disposition and feedback are not stored | Accept, modify, reject, snooze and dismiss persist. Structured feedback reaches the product owner. |
| 38 | R04 | High | W0 | Safe mode is labelled five ways; the status vocabulary is not used | Labels come from one status model using Empty, Unavailable, Simulated, Safe, Offline, Live, Verified, Not verified |
| 39 | R05 | High | W0 | One audit-chain state has three labels | One label per state across audit-integrity, ops and pilot |
| 40 | R03 | High | W3 and W4 | AI quality lists gpt-4o models while runtime resolves gpt-5.1 | One configuration source shown everywhere. Model names appear on product-owner pages only. |
| 41 | D02 | High | W0 and W5 | Control room and Trust (key, model, mode selector) are one click from the analyst | Analyst menus link to no developer surface. Mode change and reset are not reachable by analysts. |
| 42 | U01 | High | W1 | The muted text token fails AA contrast on every V3 page | axe `color-contrast` passes on Home, Work, Processes and Decisions for both roles |
| 43 | U03 | High | All waves | German is incomplete across selector, entry, Work chips, process text and settings | No English string renders in DE on analyst routes. Product-owner pages are translated or explicitly English-only by decision. |
| 44 | P13 | High | W4 | No Product Owner Console | `/product` overview with real data, per plan 7.1 |
| 45 | P01 | High | W4 | Role apps are read-only, with a non-functional "Enabled" chip | Enable, disable and lifecycle states are governed. Runs and stage performance are shown. |
| 46 | P02 | High | W4 | AI quality is descriptive and evaluation status is static | Run evaluation, inspect failures, compare, approve and roll back. Status comes from results. |
| 47 | P03 | High | W4 | Pilot readiness is narrow, with a broken evidence link | Cohort, baseline, weekly view and go or stop decision. The link works. |
| 48 | P04 | High | W4 | Ops is isolated and cannot act on failures | Incidents link to role, process and users, with recovery actions |

### 9.2 Medium (43 items)

| Wave | Items |
|---|---|
| W0 | T23 role-selector preview chips · T25 static ops release block · T27 inbox shows no "Simulated" label against the integration state · R06 no-key wording · R07 role-app status words and pack ids · R09 V1 and V2 still live, "Previous interface" loops · R11 readiness and health words · R12 three institution names · J01 entry design · J02 `/pilot` 404 · J03 no live role signal · J04 "View demo" to a non-demo page · U05 entry column clipped · D03 presenter controls in the analyst header |
| W1 | T04 next meeting ignores the clock · T12 "AI preparing" chip · T13 "AI: triage" chips without rationale · J09 agenda conflicts and links · J23 decision deep links do not select · J29 no V3.3 language control; language is global · U04 ISO timestamps and dates · U06 ellipsis hides Pulse and titles · U08 `html lang` fixed to "en" |
| W2 | T19 one state with two labels · J17 not idempotent or transactional · J18 completed run shows "In progress" · J19 stage events not in audit or Home · J22 decision workspace gaps · U07 submit above the open decision |
| W3 | T22 receipts always "local" · T29 routine "last run" in the future · J25 chat context ignores selection · J26 contradictory safe-mode answer, rendered twice |
| W4 | T24 static evaluation status · R10 evaluation claims disagree · P05 integrations missing actions · P06 read-only configuration pages · P08 audit-integrity unlinked, `/api/audit/export` 404 · P09 control room as product overview · P12 trust shows model and key state · D04 npm commands and paths on settings |
| W5 | P14 no access control on product-owner pages · D05 unauthenticated ops shows key state |

### 9.3 Low (11 items)

| Wave | Items |
|---|---|
| W0 | T26 dead "Ask" and generic "Review preparation" links · R13 README and CHANGELOG drift · D06 "Seed the database" in analyst empty states |
| W1 | J06 Now lacks "By when"; Next not ordered by materiality · U09 German terminology · U11 settings `#main` not focusable |
| W2 | T30 wall-clock timestamps |
| W3 | J27 dock scrim blocks the rail; activity flood |
| W4 | P10 settings index gaps · P11 setup page drift |
| W5 | U10 re-measure performance on a production build |

---

## Appendix A. Seeded state facts used as ground truth

### Seeded state at `f5a1ffb` (fresh migrate and seed)

**Scenario and people**
- `scenario_runs`: `run-001`, language `en`, current moment `07:45`, active role `rcsa`. The scenario date is 06.10.2026.
- Role holders:
  - rcsa: P-003 Marlene Aigner;
  - tprm: P-002 Stefan Brunner.
  - Andreas Kellner (P-007) is Head of Payment Operations.
  - The institution has 18 users. "Thomas Zijlstra", "Anna Mueller", "Max Weber" and "Anna Weber" are not among them.

**Process runs**
- `role_app_runs`:
  - `RUN-RCSA-PAYOPS-Q4-2026` at `evidence-refresh`, in progress, mode offline;
  - `RUN-TPRM-VERIDIAN-2026` at `evidence-review`, in progress.
- `role_app_stage_runs`:
  - rcsa: stage 1 completed, stage 2 `waiting-for-input`;
  - tprm: stages 1 to 3 completed, stage 4 `waiting-for-input`.
- `role_app_artifacts`, `role_app_events`, `role_app_stage_tasks` and `action_updates`: **0 rows each**.

**Meetings and minutes**
- `meeting_minutes`: 2 rows.
  - The RCSA row is confirmed and the TPRM row is a draft.
  - Their meeting, decision and action references are absent from the database (T20).
- `calendar_events`: 6 each for rcsa and tprm, today.
  - rcsa conflicts at 10:30 and 11:45.
  - tprm conflicts at 10:30 and 11:00.
- `meetings`: 3 for rcsa and 4 for tprm. None is concluded.

**Work items**
- `actions` by `raised_by_role_id`:
  - rcsa: 1 open, 4 in progress, 1 overdue, 1 completed;
  - tprm: 3 open, 7 in progress.
- `decisions`: 5 open for rcsa and 6 open for tprm. Three of each are presented at 07:45; the rest come later in the day.

**AI Partner**
- `ai_suggestions`: 1 per role, `needs-user`.
- `ai_routines`: 9.
- `ai_activity_entries`: 165.
- There is no feedback table.

**Product**
- Schema: 94 tables.

### State changes made by the journeys (own database only)

- DEC-2026-0771 (rcsa) was recorded, and its consequences executed (ISS-MUWE2OYY-001, VAL-MUWE2OZJ-002).
- DEC-2026-0741 (tprm) was recorded as `decided`. All three consequences were refused with an approval-role mismatch, and the approvals were attributed to P-003.
- The RCSA run went through all eight stages to `completed`. It has duplicate events for stage 3.
- The TPRM run went from stage 4 to stage 5 `specialist-reviews`, with no stage run created for stage 5.
- One chat thread was created for rcsa.
- The language was left at `en`.
- The database remains at `<scratchpad>\os-audit.db`.

### Scratch tooling (not committed)

- These scripts live in `<scratchpad>`:
  - `audit-capture.mjs`: route capture and per-page metrics;
  - `audit-journeys.mjs` and `audit-chat.mjs`: journeys;
  - `audit-axe-timing.mjs`: axe and timings;
  - `dbq.cjs`: read-only queries.
- Raw results are in `<scratchpad>\audit-results\`: `capture-all-*.json`, `capture-stages-en-*.json`, `axe.json`, `timing.json` and the journey logs.
- The DE stage capture JSON was lost when the first server reached its time limit. Its screenshots are complete.
