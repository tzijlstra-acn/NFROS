# Handoff: os-ai-partner (Wave 3, plan sections 3.5, 4.11, 8.1, 8.2)

The AI Partner becomes an operating partner whose context and outputs come from real product state: routines that actually run on the durable job queue, a durable working context, typed outputs, a stored suggestion lifecycle, a proactive notification budget and structured feedback. Synthetic institution and data.

Isolated stack: port 3114, database `<scratchpad>\os-ai-partner.db` (migrated through 0008, seeded, reset after the seed change), dist directory `.next-os-ai-partner`, `NFR_DEMO_MODE=safe`. Nothing was written to `data/nfr-workos.db` and nothing was clicked on port 3000.

## 1. The routine runner

```text
scenario clock -> scheduleDueRoutines (src/features/routines/runner.ts)
               -> background_jobs ("ai-routine", payload "routine-run",
                  idempotency key = routine:<id>:<day>:<window>)
               -> leased by id, by the worker poll (scripts/worker.ts) or by the workday
                  frame's sync (/api/workday/partner/sync -> runDueRoutines)
               -> processRoutineJob:
   1. startRoutineRun (ai_routine_runs, unique key: a second caller stops)
   2. one governed step through executeTool -> authority gate -> audit (src/features/routines/tools.ts)
   3. compose the suggestion(s) (prepare.ts) -> validateRoutineOutput (schema.ts), every mode
   4. one transaction: persistSuggestion (ai_suggestions, validated) + completeRoutineRun with
      outputs (ai_routine_run_outputs) + publishOsEvent("routine-completed", createdCount, subject,
      activity row) + recordRoutineNotification (ledger, daily budget) + ai_routines.last_run_at
      on the scenario clock + completeJob
```

- **Windows** (`src/features/routines/windows.ts`, pure): meeting preparation from start plus `offsetMinutes` (seeded -30) until the meeting starts, never after; action follow-up daily at `time` (09:00); inbox triage once per arrival batch the clock revealed; event monitoring hourly. A run is idempotent per routine, day and window, and an object an earlier run prepared is left out of later windows (lineage lookup). Asking twice, from the worker and from two tabs, finds the same run.
- **Modes**: safe serves what the Meetings and Inbox AI layers captured before the day while their records are unchanged; offline composes from the records; live follows the same path and is never called (no routine is connected to a model; a live configuration is served as safe and the run says so).
- **Authority**: every step is one registry tool: `prepareChallengeQuestions` (DRAFT), `draftActionReminder` (DRAFT, the Work Hub's own handler), `proposeInboxTriage` (PROPOSE, new) and `monitorWorkEvents` (READ, new). None mutates a record. At Assist a draft is refused, at Prepare a proposal is refused; the refusal is audited (`tool_calls` blocked, `audit_events`), the run is recorded as "needs-human" and nothing is created.
- **Failure**: a step that throws is retried by the job (three attempts) and recorded as failed once exhausted, with a redacted reason.

### What each routine produces

| Routine (seeded rows) | Trigger | Gated step | Produces (lineage kind) | Suggestion in the dock |
|---|---|---|---|---|
| Pre-Meeting Preparation (`pre-meeting-prep-rcsa`, `-tprm`) | 30 minutes before each meeting of the day | `prepareChallengeQuestions` | `meeting-preparation:<meeting>` | "Brief prepared for <meeting> at 10:30": the Meetings module's validated preparation (questions with evidence, open decisions, contradictions, what to watch), DRAFT |
| Action Follow-up (`action-follow-up-rcsa`, new) and Evidence-Request Follow-up (`evidence-request-followup`) | daily at 09:00 | `draftActionReminder` | `action-reminder-draft:<action>` | "Reminder drafted for <owner>": the Work Hub's own reminder text, for actions owned by someone else that are overdue or due within two days. Nothing is sent |
| Inbox Triage (`inbox-triage-rcsa`, `-tprm`, new) | on arrival | `proposeInboxTriage` | `inbox-triage-proposal:<message>` each | "N messages proposed for triage": the Inbox AI layer's classification and reason per message. Nothing is classified until a person confirms |
| KRI and Control Watch (`kri-control-watch`), Supplier Monitoring Watch (`supplier-monitoring-watch`, now hourly) | hourly | `monitorWorkEvents` | `material-change:<event>` | "Material change at 14:05": the role's view of the change, the open decisions it names, the later meetings and the running stage. A watch that finds nothing is recorded as "no change" and is never a notification |

Morning Brief, Calendar Scan and Evidence Freshness Check have no runner in this release and never run; their rows no longer carry a seeded "last run".

Each run publishes `routine-completed` with `routineRunId`, `routineKind`, `outcome`, `createdCount` and `createdIds`; its subject is the first object prepared (a meeting, an action, a message, a decision), and its activity row is the dock's Activity entry.

## 2. Persistent context, typed outputs, lifecycle, budget, feedback

- **Context** (`src/features/partner/context.ts`, `focus.ts`): the frame reads what is on screen from the workday's own addresses (Home `?select=`, the Work Hub's bound item, `/processes/<process>?stage=`, the Decisions hash, re-read after every click because Decisions rewrites it without a navigation) and posts it to `/api/workday/partner/sync`. The server checks every identifier and keeps the complete context in `partner_contexts`: role, legal entity, selected object, process run and stage, meeting, action, inbox item, decision, chat thread, source freshness, prior human decisions and user edits. The chat panel shows it as one line, and a chat question with nothing selected is asked about the object the context holds. The dock lives in the workday layout, so the conversation survives navigation; the duplicate rendering of a restored thread (audit J26) is fixed.
- **Typed outputs** (`AIResponseParts.tsx`, `labels.ts`): the nine kinds render under the plan's own names (Answer, Evidence, Uncertainty, Recommendation, Proposed action, Approval request, Execution receipt, Blocked action, Follow-up question), plus alternative and source status. The dock itself was not redesigned.
- **Lifecycle** (`src/features/partner/lifecycle.ts`, `rules.ts`, `/api/workday/partner/suggestion`): New, Reviewed, Accepted, Modified, Rejected, Executed, Expired, every change through `recordSuggestionDisposition` with who, when, the reason and, for Modified, the person's wording. Accept on a material suggestion records the acceptance and opens the decision record; it executes nothing. When the decision is recorded through the governed path, the next sync records the suggestion as Executed; a decision recorded without the suggestion being accepted makes it Expired. Reject and Modify need a reason. Snooze holds a suggestion back an hour on the scenario clock. Answered suggestions leave the open list, Home's inline line, the focus queue and the header count at the same moment, and are listed under Handled in the dock with their state.
- **Regeneration keeps the answer** (coordinator request; `persistSuggestion` in `src/agents/suggestions/generate.ts`): an unchanged suggestion keeps its disposition, snooze and dismissal; a materially changed one under the same id records Expired then New in the history; a newly validated suggestion for the same matter (role, object, event and decision) supersedes open earlier ones as Expired, pointing at it.
- **Header count equals the dock**: one rule, `suggestionNeedsYou`, used by `countSuggestionsNeedingYou` (header) and the dock; a newly prepared suggestion refreshes the route so the header counts it too.
- **Notification budget** (`src/features/partner/notifications.ts`): only a run that created work is a notification, in the shell's "new work from a routine" category. At most five are raised per role and day (the shell's at-once total); the rest are recorded as held back with the reason, and a person with the `quiet` preference has them all held back. Updates reads the ledger: held back goes behind its disclosure, read is gone, raised can be marked read (the read mark is the ledger's).
- **Feedback** (`src/features/partner/feedback.ts`, `/api/workday/partner/feedback`): the six kinds on suggestions, chat answers and routine runs, as toggles; Useful and Not useful exclude each other. Each row in `ai_feedback` carries the target, task kind, configuration, prompt version, model profile, sources, role and person. The console reads it through `listAIFeedback` and `countAIFeedbackByKind`.
- **Clean-up**: `src/ai/offline-responses.ts` is deleted (nothing read it; "BCA-CTRL-142" and "4 of 7" contradicted the day) and `tests/unit/ai-contracts.test.ts` now tests a limited envelope and asserts the text is gone. The safe mode chat decline no longer says "a live call was attempted and failed" (audit J26).

## 3. Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| No hard-coded AI summary anywhere | Met | Routine statements, run summaries and suggestions are composed from the rows each step read and validated (`schema.ts`). `src/ai/offline-responses.ts` is deleted; `ai-contracts.test.ts` asserts "BCA-CTRL-142" and "4 of 7" are gone from `src/ai`. Seeded routine run times removed (T29). |
| Routine lineage visible on Home and in Updates | Met | Integration "states the run on Home with its outputs, and raises it in Updates within the ledger"; browser journey: Home Partner update statements link the meeting, the action and the messages each run prepared, plus the run's event; Updates lists "New work from a routine" with Mark as read. Screenshots `after-home-routines-*`, `after-updates-routines-*`. |
| User dispositions stored | Met | `ai_suggestion_dispositions` via `recordSuggestionDisposition`; integration tests for accept, reject with reason, settle to executed, regeneration; browser "rejects a suggestion with a reason" asserts the row. |
| Feedback stored and readable by the console | Met | `ai_feedback` rows with target, task kind, prompt version, sources, role and person; read with `listAIFeedback`; integration and browser tests. |
| No duplicate requests | Met | Integration "runs each due routine once per window and object, however often it is asked" (runs, jobs and suggestions unchanged on a second pass), triage lineage covers every message, so a later batch never re-proposes one; the job queue and the run table both enforce the key. |
| Authority always enforced | Met | Every routine step runs through `executeTool`; integration "lets the authority gate refuse a draft at the Assist level, creating nothing" (blocked `tool_calls` row, run "needs-human", no output); accepting a material suggestion writes no approval and leaves the decision open until the governed path records it. |
| Chat survives navigation, selection updates context | Met | Integration "keeps the context outside the transcript, and a selection updates it" (meeting, stage, decision, version, thread); browser: context row follows the Work Hub meeting and the Decisions hash, and the transcript keeps its turns across the navigation. |
| Proactive updates within the budget | Met | Ledger: at most five routine notifications raised per role and day, the rest held back with the reason, `quiet` holds all back; Updates honours held back and read. Integration asserts at most five raised; browser asserts at most five raised rows. |
| Clock forward on the stack, outputs on Home, Updates and the dock, with lineage | Met | `tests/e2e/os-ai-partner.spec.ts` on port 3114 sets the clock to 10:05 and finds the routines' work on Home, in Updates, and in the dock (suggestions "Prepared by", Activity "Routine runs today" with output links). |
| Header suggestion count equals the dock | Met | One rule (`suggestionNeedsYou`) for both; unit test; browser asserts the header's `data-count` equals the dock's `data-needs-you`. |
| EN and DE, no overflow at three viewports | Met | Every string bilingual and ASCII; German screenshot; browser overflow check at 1920, 1440 and 1366 with the dock open. |
| tsc, vitest, Playwright, check:copy, check-no-emdash, scan:secrets | Met | Section 4. |

## 4. Tests run

| Command | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | exit 0 (final run, after the last edits) |
| `npx vitest run tests/unit tests/integration` (final full pass) | 73 files, 1672 tests passed (the machine was heavily loaded; three workers took long to terminate, none failed) |
| `npx vitest run tests/unit/ai-partner-wave3.test.ts tests/integration/ai-partner-routines.test.ts` plus Home, Updates, os-shell and ai-partner-flows | 7 files, 167 passed |
| New `tests/unit/ai-partner-wave3.test.ts` | vocabularies equal the schema, the nine part names, lifecycle transitions, header and dock count rule, routine windows, focus from addresses, links, the routine output validator and the composers in EN and DE |
| New `tests/integration/ai-partner-routines.test.ts` | no faked run time; once per window and object; workshop brief with lineage and event; reminders drafted only; triage proposes without classifying; Home and Updates with the ledger and mark read; the 14:05 change raised; later triage covers only new arrivals; the gate refuses at Assist; accept then decision then executed; reject needs a reason; regeneration keeps the answer; feedback with links and refused for another role; context follows the selection and the chat reads it |
| `NFR_BASE_URL=http://localhost:3114 npx playwright test tests/e2e/os-ai-partner.spec.ts` | 8 passed, 10 skipped by design (the write journey runs once at 1920; the overflow and screenshot test runs at 1920, 1440 and 1366), 14.8 min |
| `npm run check:copy` | passed |
| `node scripts/check-no-emdash.mjs` | passed (its percentage warnings are pre-existing seed text) |
| `npm run scan:secrets` | passed (8331 files) |

## 5. Screenshots

`docs/screenshots/os-excellence/os-ai-partner/` (local; `docs/screenshots/` is ignored by git):

- Before (copied from the audit's frozen stack): `before-rcsa-journey-dock-suggestions-en-1440x900.png` (one card, Approve only, nothing stored), `before-rcsa-journey-dock-activity-en-1440x900.png` (a flat list, no routine runs), `before-rcsa-journey-dock-chat-reply-en-1440x900.png` (the contradictory safe mode answer, J26).
- After, English 1920x1080: `after-home-routines-rcsa-en-1920x1080.png` (Partner update states the three routine runs with their lineage), `after-updates-routines-rcsa-en-1920x1080.png` (new work from routines, Mark as read, one held back by the budget), `after-dock-suggestions-rcsa-en-1920x1080.png` (lifecycle chip, "Prepared by", Accept), `after-dock-routine-runs-rcsa-en-1920x1080.png` (routine runs with outputs and feedback), `after-dock-chat-context-rcsa-en-1920x1080.png` (working context line, the plain-language decline, the transcript kept across navigation).
- After, 1366x768 and 1440x900 English: `after-home-routines-rcsa-en-1366x768.png`, `after-dock-tprm-en-1366x768.png`, `after-dock-tprm-en-1440x900.png`.
- After, German 1920x1080: `after-dock-tprm-de-1920x1080.png`.

Every capture passed the horizontal overflow check (`scrollWidth - clientWidth <= 0`).

## 6. Known limitations

- **Partner task kinds have no released configuration in the registry.** `src/ai/prompt-registry.ts` (read by os-console-quality) holds stage preparation only, so feedback on Partner outputs stores the prompt version and task kind, with configuration and model profile null rather than invented. When the console workstream registers configurations for `suggestion`, `chat-answer`, `meeting-preparation`, `action-follow-up`, `inbox-triage` and `event-monitoring`, feedback picks them up through `getReleasedConfig` with no change here.
- **Suggestion text is stored in one language**, the scenario language when the routine ran (the suggestion table has one text column per field); the run summary is bilingual.
- **Executed is settled from decisions only.** A reminder that was accepted and then sent from the action stays Accepted; linking the send to the suggestion is a small follow-up in the actions module.
- **No per-person session.** The acting person is the role's holder, as everywhere in this build.
- **Without a worker**, routines run when the workday frame syncs: on navigation and once a minute while a page is visible.
- **Shared files edited surgically** (section 7): os-shell's Updates read and mark-read action, Home's read model and lineage, the focus queue's suggestion filter, the header count, the PartnerClient bridge, the authority registry and the routine seed rows.

## 7. Files

New: `src/features/partner/` (`rules.ts`, `tasks.ts`, `links.ts`, `focus.ts`, `context.ts`, `lifecycle.ts`, `feedback.ts`, `notifications.ts`, `view.ts`, `sync.ts`), `src/features/routines/` (`registry.ts`, `windows.ts`, `schema.ts`, `tools.ts`, `prepare.ts`, `runner.ts`), `app/api/workday/partner/{sync,suggestion,feedback}/route.ts`, `src/components/ai-partner/AIFeedbackControl.tsx`, `AIRoutineRuns.tsx`, tests `tests/unit/ai-partner-wave3.test.ts`, `tests/integration/ai-partner-routines.test.ts`, `tests/e2e/os-ai-partner.spec.ts`.

Changed (owned): `src/agents/suggestions/generate.ts` (persistence keeps the answer, supersede), `src/agents/chat/service.ts` and `seeded.ts` (J26, durable context), `src/components/ai-partner/AIPartnerDock.tsx`, `AISuggestionCard.tsx`, `AIChatPanel.tsx`, `labels.ts`, `src/components/workday-v3/WorkdayPartnerDock.tsx`, `app/api/workday/partner/route.ts`, `scripts/worker.ts` (routine parts), `tests/unit/ai-contracts.test.ts`, `tests/unit/suggestions.test.ts`, `tests/integration/ai-partner-flows.test.ts`; deleted `src/ai/offline-responses.ts`.

Changed (surgical, other owners): `src/components/workday-v2/PartnerClient.tsx` (lifecycle and feedback wiring), `src/db/repositories/partner.ts` (active means unanswered; `getAnsweredSuggestions`), `src/db/repositories/header.ts` (shared rule), `src/db/repositories/focus.ts` (one filter), `src/workday/contracts.ts` (optional `disposition`), `src/features/home/read.ts`, `assemble.ts`, `lineage.ts` (routine outputs as lineage; a meeting and a message open in the Work Hub), `src/features/updates/read.ts`, `actions.ts` (ledger), `src/server/security/authority.ts` (two tools), `src/db/seed/role-app-runtime.ts` (routine rows).

## 8. What the user must run

No schema change and no migration (0006 to 0008 are used as they are). The seed changed (three routine rows added, seeded run times removed, the supplier watch hourly), so against the shared database, with the dev server on port 3000 stopped:

```text
npm run demo:reset
```

Then start the dev server again (the runtime registers the new tool handlers once per process). Optionally run `npm run worker` beside it; without it, the workday frame runs due routines itself.
