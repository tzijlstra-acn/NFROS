# Handoff: os-rcsa-stages (plan section 5.1)

Outcome: all eight stages of the RCSA Cycle Assistant are executable end to end on the process engine. Each stage loads real sources, prepares through the durable AI job (safe and offline modes on the same validated path; live mode is the same path and was never called), asks the person for the material judgments as recorded inputs and decisions (nothing preselected), executes its governed changes under payload-bound approval, refuses completion until its criteria pass, and writes a stage record. The challenge workshop waits for its meeting and reads the minutes confirmation from Meetings. The rating consequences are computed by deterministic code. Stage 7 creates the plan action through the Work Hub's governed tools with process lineage. Stage 8 can decide an off-cycle reassessment, and completing it starts a new run of the same app at Stage 1, scoped as event-driven. A new RCSA portfolio view above the stage map lists every run.

Synthetic institution and data. No schema change. No new Role App; Event-Driven Reassessment stays a preview app.

## What changed

### RCSA (owned)

| File | What |
|---|---|
| `src/role-apps/rcsa/definition.ts` | All eight stage contracts, `implemented: true`. New sources: owners and participants, trigger and schedule, decisions recorded in this cycle, actions on the scope (CI-GRC-SIM), records of the earlier stages, enhanced monitoring in force, risk appetite statements, first-line submissions, risks and controls in scope, workshop meeting and transcript. |
| `src/role-apps/rcsa/matrix.ts` (new) | Rating and appetite consequences on the group matrix (`consequenceFor`, `outsideFromScore`, `governanceEffect`, `positionText`). Calls `src/domain/nfr/calculators.ts`; no model involved. |
| `src/role-apps/rcsa/portfolio.ts` (new) | `buildRcsaPortfolio`: every run of the app, read from rows (assessment, trigger, stage, key risk position from the Stage 6 record or the draft, open actions with the run's lineage, status). |
| `src/features/process/rcsa/RcsaPortfolio.tsx` (new) | The portfolio table, rendered through `ProcessRunPage`'s header slot. |
| `app/workday/[role]/processes/rcsa-cycle/v3.tsx` | Thin route: passes `?run=` and the portfolio header, as the onboarding route does. |
| `src/role-apps/rcsa/stages/shared.ts` (new) | The scope every stage reads: current version through `supersededBy`, the baseline lines of an off-cycle assessment, the prior cycle, `cycleDecisionsApply`. |
| `src/role-apps/rcsa/stages/sources.ts` (new) | The source loaders listed above. |
| `src/role-apps/rcsa/stages/checks.ts` (new) | Completion check `rcsa.cycle-decisions` (entry criterion of Stages 2, 3, 4, 5 and 7). |
| `src/role-apps/rcsa/stages/scope-trigger.ts` (new) | Stage 1. |
| `src/role-apps/rcsa/stages/evidence-refresh.ts` | Stage 2 (reference): now reads the shared scope; effectiveness and rating shown as words, not enum values. |
| `src/role-apps/rcsa/stages/risk-control-change.ts` (new) | Stage 3. |
| `src/role-apps/rcsa/stages/first-line-input.ts` (new) | Stage 4. |
| `src/role-apps/rcsa/stages/challenge-workshop.ts` (new) | Stage 5, including the workshop record loader and `workshopMinutesConfirmation`. |
| `src/role-apps/rcsa/stages/rating-appetite.ts` (new) | Stage 6. |
| `src/role-apps/rcsa/stages/actions-approval.ts` (new) | Stage 7. |
| `src/role-apps/rcsa/stages/monitoring-reassessment.ts` (new) | Stage 8, including the completion hook that starts the reassessment run. |
| `src/role-apps/rcsa/stages/index.ts` | Imports the modules above. |
| `src/db/seed/rcsa-stages.ts` (new) | Three first-line submissions (EVD-2026-RCSA-1L-01 to 03) with chunks, so Stage 4 has a position on every key control in scope. |
| `src/db/seed/run.ts` | One import and one call (`seedRcsaStageSources`, before `seedProcessRuntime`). |
| `tests/unit/rcsa-stages.test.ts`, `tests/integration/rcsa-stages.test.ts`, `tests/e2e/os-rcsa-stages.spec.ts` (new) | The tests below. |

`tsconfig.json`: `next dev` with `NFR_DIST_DIR=.next-os-rcsa-stages` added two `include` lines for that folder; they were removed again, and the folder was deleted.

### Engine extensions (generic, minimal; for the process engine owner)

All additive. No existing behaviour changes for a stage that does not use them.

| File | Extension |
|---|---|
| `src/role-apps/contracts.ts` | Criterion kind `{ kind: "check"; checkKey; label; when? }`: a fact another module owns, read by a registered pure check of the stage context. Optional `outcomeDe` and `humanResponsibilityDe` on `RoleProcessStage` (the English shows where they are missing, so TPRM is unchanged until it adds them). |
| `src/features/process/registry.ts` | `registerCompletionCheck` / `getCompletionCheck`; `registerCompletionHook(processId, stageId, hook)` / `getCompletionHook`; `missingImplementations` reports a missing check. |
| `src/features/process/validator.ts` | Evaluates `check` criteria (a missing or throwing check is not met, with a reason). |
| `src/features/process/transition.ts` | Inside the completion transaction, after the next stage opens or the run completes, calls the stage's completion hook if one is registered; its summary and receipt line join the completion receipt. |
| `src/features/process/runs.ts` (new) | `startProcessRun`: starts a run of an installed app, idempotent by run id, publishes `work-arrived` (`process-run-started:<runId>`) and opens the first stage. |
| `src/features/process/view.ts` | `artifactLines` renders `content.recordLines` (bilingual) of a stage record; the stage responsibility and outcome use the German fields in German. |
| `src/features/process/sources.ts` | An unavailable source carries the loader's own note as its reason. |

`StageWorkspace.tsx` was not changed.

## The eight stages

Every stage has the full contract: entry criteria, required and helpful sources, one AI job (schema validated; safe serves a captured preparation where one exists and otherwise composes, offline composes, live uses the same prompt and the same validator and was not called), required human tasks, decisions, approvals, tools (outbox where external), artifacts, completion criteria and blocking conditions. Every completion is the `completeRcsaStage` tool through the authority gate with a payload-bound approval and a confirmed rationale.

| # | Stage | AI prepares (validated, cited) | Human judgment (recorded, never preselected) | Governed change | Tangible output (stage record) |
|---|---|---|---|---|---|
| 1 | Scope and Trigger | Prior-scope comparison, process changes from telemetry, trigger summary (schedule and confirmed scope minutes, or the event and the monitoring plan that opened the run), owners and participants | Task "Scope confirmation": each process and entity in or out (the subject cannot be out), the period (cannot end after the scenario day), each participant (the process owner must be required). Decision: scheduled scope, off-cycle scope (refused without a Red indicator or an event-driven trigger), or revise (hold) | None | Scope and trigger record |
| 2 | Evidence Refresh | Unchanged reference stage (KRI, incidents, losses, tests, open actions, prior version, telemetry, evidence freshness) | Evidence sufficiency; DEC-2026-0771 investigation strategy | Investigation registered in the GRC platform (outbox, acknowledged) | Evidence pack |
| 3 | Risk and Control Change | Prior-cycle comparison per line, conflict analysis (line, register, first line and test), change candidates, challenge questions, the loss-record inference labelled as inference | Task "Change relevance and materiality" per candidate (refused: not relevant without a reason, or not relevant for a line that moved outside appetite). Decision DEC-2026-0744 (causal interpretation) | The seeded decision's consequences, each under its own approval | Risk and control change log |
| 4 | First-line Input | Targeted questions per author, response comparison (self-assessments and management responses), unsupported assertions (approved records on the same items), open disagreements | Task "Factual corrections and challenges" per position (correction or challenge needs a note; accepting a contradicted position needs a reason). Decision DEC-2026-0745 (workshop sequencing) | Challenge pack sent to the first-line authors (simulated message, approval) | Workshop agenda (order from the decision, contested items) |
| 5 | Challenge Workshop | Agenda as run, evidence pack, contradictions flagged in the conversation (turn and document), actions captured from the conversation, what the minutes should record | Minutes drafted, edited and confirmed in Meetings (os-meetings, not duplicated). Task "Actions and unresolved issues" (refused until the minutes are confirmed). Decision DEC-2026-0772 (challenge conclusion) | Confirming the minutes creates their actions (Meetings); the decision's consequences | Workshop outcome record (minutes id, version, confirmer, evidence document, conclusion) |
| 6 | Rating and Appetite | Deterministic matrix consequences for every effectiveness band, alternatives, rationale draft, governance effect, draft positions of the other lines | Task "Control effectiveness, residual position and appetite": effectiveness, residual likelihood and impact (a departure from the methodology needs a reason), the rating and appetite they give (a rating or appetite the matrix does not produce is refused), whether every other line's draft stands. Decision: remediation, risk acceptance (only outside appetite), monitor (not outside), or return to the workshop (hold) | Residual position recorded on the assessment line (`proposeAndRecordResidualRisk`, approval) | Rating and appetite record |
| 7 | Actions and Approval | Measurable wording (completion condition), duplicates and overlaps with existing actions, ownership candidates, proposed due date, target-system change | Task "Action sufficiency, owner and date" (owner must own the risk or the control; a committed date cannot be before the scenario day). Decisions DEC-2026-0782 (reasoning revision) and the plan approval (approve, or rework = hold; approve needs a committed date) | `createAction` in the Work Hub with `sourceProcessRunId`, `sourceStageId`, `sourceStageRunId`; `addActionUpdate` (CC) writes the agreed completion condition; the action registered in the GRC platform (outbox, acknowledged) | Assessment version for sign-off |
| 8 | Monitoring and Reassessment | Monitoring routine on the indicator a cycle decision names, event links (open incidents detected on the day), committee delta, reassessment proposal | Task "Monitoring routine, material change and escalation" (material change and escalation need a note). Decision: confirm monitoring, open an off-cycle reassessment (needs a material change), or escalate (hold) | `activateMonitoring`; `initiateReassessment` (off-cycle); on completion the hook starts a new run of the RCSA Cycle Assistant at Stage 1, scoped event-driven | Monitoring plan (names the new assessment and run) |

Stage 1 of the Q4 cycle was completed by the seed on 01.10.2026, before this build, so it shows no preparation and no record. Stage 1 is executed end to end on the event-driven run Stage 8 starts.

## Acceptance criteria

| Criterion (plan 5.1 and the brief) | Status | Evidence |
|---|---|---|
| All eight stages executable | Met | Unit "implements all eight stages, in order, with every key they name registered" (`missingImplementations` empty for each); integration "are executable on all eight stages"; browser journey through Stages 2 to 8 and Stage 1 of the reassessment |
| Each stage creates a tangible output | Met | Integration asserts the seven stage records of the Q4 run (`evidence-pack`, `change-log`, `workshop-agenda`, `workshop-minutes`, `rating-record`, `assessment-submission`, `monitoring-plan`) and the `scope-record` of the reassessment; isolated database after the safe journey: all eight Q4 stage runs completed, seven records |
| Every material judgment is explicit and human | Met | Every human task is required and in the completion criteria; the material decisions of 5.1 are marked material (unit); nothing is preselected (browser: no checked radio before the person acts, on every task and decision); the defaults exist only for tests |
| AI jobs schema validated in safe and offline modes | Met | Every preparation goes through the engine's `validatePreparation` (evidence ids from loaded sources, known items, decision options); integration journey in both modes; browser journey in both modes. Live mode is the same prompt and validator and was never called |
| Rating consequences are deterministic code | Met | `src/role-apps/rcsa/matrix.ts`; unit "computes the residual ... on the group matrix" (3 x 4 partially = 12 High outside; largely = 8 Medium at the limit; fully = 3 Low within), departure and clamp, boundary mismatch; integration refusals of a rating or appetite the matrix does not produce |
| Workshop uses os-meetings' minutes confirmation (public API, not duplicated) | Met | `getConfirmedMinutesForStage` and the lifecycle helpers; completion check `rcsa.workshop-minutes-confirmed`; browser: minutes drafted and confirmed in the Work Hub Meetings view, then Stage 5 criterion met; integration both orders (confirmed while Stage 5 is open, and before it opens) |
| Actions via Work Hub governed tools with process lineage | Met | `createAction` with `sourceProcessRunId`, `sourceStageId`, `sourceStageRunId`; `addActionUpdate` CC writes `completion_condition`; GRC registration acknowledged. Database after the safe journey: `MSN-...` "Restore CTL-PAY-014 to effective preventive operation for RSK-0211", P-007, 31.12.2026, `source_stage_id = actions-approval`, `source_stage_run_id = SR-RUN-RCSA-PAYOPS-Q4-2026-actions-approval`, completion condition set |
| Event-driven reassessment starts a new run | Met | Stage 8 off-cycle: `initiateReassessment`, then the completion hook `startProcessRun` (`work-arrived`, `process-run-started:<run>`); integration and browser: new run at Stage 1, active run, Stage 1 completes on it. Event-Driven Reassessment stays a preview app; no Role App added |
| No stage completes without its criteria | Met | Integration "refuses every stage before its criteria are met, and writes nothing", Stage 6 and Stage 8 refusals, idempotent completion; browser: Continue disabled with reasons on every stage until the criteria pass |
| Completion updates the RCSA portfolio and Home | Met | New portfolio (`buildRcsaPortfolio`), integration asserts both runs, positions and open actions; browser asserts the rows after Stage 8. Home: engine events and `revalidateWorkday` (engine actions); Home after the journey shows the stages in Done and the Partner update |
| Full journey in safe and offline mode, restart in the middle, state survives | Met | Browser journey run twice on port 3110, once with the server in safe mode and once in offline mode; in each the server was stopped and started between "Stages 2 to 5" and "Stages 5 to 8", and the second half starts by reading Stage 5 of 8 and the Stage 4 record; integration closes the database connection in the middle |
| Seeded source data resolves | Met | `src/db/seed/rcsa-stages.ts` (three submissions with chunks); every cited evidence id in a preparation is from a loaded source (validator) |
| Bilingual copy, ASCII German | Met | Every stage string is a pair (unit walks the contracts: no umlaut, no en or em dash, no double hyphen); German stage responsibility and outcome added; German captures of Stages 6 and 7; the browser asserts no umlaut renders |
| Screens do not overflow at 1920x1080, 1440x900 and 1366x768 | Met | The capture asserts no horizontal overflow at 1920 and 1366 for every capture; the read-only layout test checks every stage of the completed cycle, with the portfolio, at all three sizes |

## Tests run

All on the isolated stack (port 3110, `os-rcsa-stages.db` in the scratchpad, `NFR_DIST_DIR=.next-os-rcsa-stages`) or on temporary databases. Nothing wrote to the shared database or to port 3000. The isolated database was migrated again when `0005_work_lineage` and later `0006_data_model` appeared, and reseeded.

| Run | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | No error in any file of this workstream (clean overall at two earlier runs). At the last run the only errors were in other workstreams' in-progress files: `src/db/repositories/release-management.ts`, `tests/integration/data-model-repositories.test.ts`, `tests/integration/data-model-seed.test.ts`. |
| `vitest tests/unit/rcsa-stages.test.ts` (new) | 21 passed: contracts (all eight implemented and registered, tasks, decisions, holds, outbox, checks and hook, cycle decisions, German responsibility and outcome, copy rules), matrix consequences, period rules, captured actions, clipping, due dates |
| `vitest tests/unit/process-engine.test.ts` (shared) | 21 passed, unchanged (the TPRM workstream had already made the "reference stages" assertion generic) |
| `vitest tests/integration/rcsa-stages.test.ts` (new) | 9 passed: contracts; the journey in safe and in offline mode (Stages 2 to 8, Stage 5 waiting at 07:45, minutes confirmed through `meetings/operations`, a closed connection in the middle, the rating facts, lineage and completion condition, GRC acknowledged, monitoring on KRI-PAY-007, the original run completed, the new run at Stage 1 and active, its Stage 1 completed, its Stage 2 refused with the reason, the portfolio rows); minutes confirmed before Stage 5 opens; the standard closure path; criteria refusals; matrix refusals; Stage 8 rules; idempotent completion |
| `npm run test:integration` (full, after `0006`) | 22 files, 474 tests passed (one vitest pool warning about terminating a worker after `work-hub-operations.test.ts`, which passed) |
| `playwright tests/e2e/os-rcsa-stages.spec.ts` on 3110, safe mode (before `0006`) | "Stages 2 to 5" passed (58 s); server stopped and started; "Stages 5 to 8" passed (2.5 min, with captures) |
| the same, offline mode (after `0006`, fresh seed) | "Stages 2 to 5" passed (50 s); server stopped and started; "Stages 5 to 8" passed (2.8 min) |
| `playwright ... -g "fits 1920, 1440 and 1366"` (read only) | passed: every stage of the completed cycle, no horizontal overflow of the document, the main region or the portfolio at 1920x1080, 1440x900 and 1366x768 |
| `playwright tests/e2e/os-process-engine.spec.ts -g "RCSA Stage 2"` on 3110 (engine's journey, after a reseed) | passed |
| `npm run check:copy` | passed |
| `node scripts/check-no-emdash.mjs` | passed |
| `npm run scan:secrets` | passed |

Two environment notes from the runs: while another workstream's `decisions.due_at` column was in the schema before its migration existed, every page reading decisions failed on the isolated stack ("no such column: due_at"); after `0006_data_model` landed the database was migrated, reseeded and the offline journey rerun from the start. And once, a fast restart of `next dev` on a reused `.next-os-rcsa-stages` folder served 404 for every process route; clearing the folder fixed it.

## Screenshots

`docs/screenshots/os-excellence/os-rcsa-stages/`, captured by the browser journey on port 3110 in safe mode (`NFR_CAPTURE_DIR`), each view at 1920x1080 and 1366x768 in up to four scroll segments (`<name>-<width>-<segment>.png`). The capture asserts no horizontal overflow of the document or the main scroller at either size. Viewed: every stage at 1920 and the portfolio, the reassessment and both German stages at 1366.

| Name | What it shows |
|---|---|
| `stage1-scope-trigger-seeded` | Q4 Stage 1 as the seed left it (completed, no preparation), the portfolio with one run |
| `stage2-evidence-refresh` | Stage 2, safe mode, served from the captured preparation |
| `stage3-risk-control-change` | Change candidates, the CTL-PAY-014 conflict, challenge questions, the loss inference |
| `stage4-first-line-input` | Six first-line positions, three unsupported assertions, the targeted questions |
| `stage5-challenge-workshop-waiting` | 07:45: preparation "Waiting for source", Continue disabled with the meeting time |
| `stage5-challenge-workshop` | 12:00, minutes confirmed in Meetings: contradictions with turns and documents, captured actions, the met minutes criterion |
| `stage6-rating-appetite`, `stage6-rating-appetite-de` | The matrix consequences for every band, the judgment form; German |
| `stage7-actions-approval`, `stage7-actions-approval-de` | The planned action, measurable wording, owners, duplicates and overlaps; German |
| `stage8-monitoring-reassessment` | Monitoring routine, INC-2026-0412 as a candidate material change, the reassessment proposal |
| `stage1-scope-trigger-reassessment` | The event-driven run at Stage 1; the portfolio with both runs |
| `stage2-reassessment-stops` | The reassessment's Stage 2, Continue refused with the Q4-cycle reason |
| `completed-cycle` | The Q4 run reached through the portfolio: "Completed, all 8 stages", the monitoring plan |
| `home-after-journey` | Home after the journey (Done today, Partner update lines for the stages) |

## Schema needs (reported, not made)

1. **Decisions per run.** Stages 2, 3, 4, 5 and 7 bind seeded decisions by identifier (DEC-2026-0771, 0744, 0745, 0772, 0782). They are the Q4 cycle's judgments on `RCSA-ARC-DE-PAYOPS-2026-Q4`; a second run of the app cannot have its own. To run Stages 2 to 8 on an event-driven reassessment, a decision needs a run: `decisions.process_run_id` (nullable, indexed) plus a way to instantiate a decision for a run (a decision template id on the stage contract, copied with its options when the stage opens), or the stage contracts move those judgments to stage decisions. Until then the entry check `rcsa.cycle-decisions` stops the reassessment run at Stage 2 and says why ("DEC-2026-0771 is a decision of the Q4 2026 cycle on RCSA-ARC-DE-PAYOPS-2026-Q4, not of RCSA-OFFCYCLE-..., ... this build does not create decisions for a new run").
2. **Appetite position on the line.** `proposeAndRecordResidualRisk` (`src/agents/tools/mutations.ts`) writes residual likelihood, impact and rating but not `assessment_lines.appetite_position`, so after Stage 6 the line can carry a stale appetite position. The Stage 6 rating record carries the ratified one, and Stage 7, Stage 8 and the portfolio read the record. No column is missing; the tool would need to write the existing column (decisions domain, not changed here).
3. **No other schema change is needed.** Every other value the stages need is in existing columns (`actions.source_process_run_id`, `source_stage_id`, `source_stage_run_id`, `completion_condition` from 0005; `meetings.process_run_id` and `stage_id`; `meeting_minutes` status and version).

## Known limitations

- **The reassessment run stops at Stage 2** (schema need 1). Its Stage 2 decision panel still shows DEC-2026-0771 as recorded, because the binding is by identifier; the completion refusal states that the decision belongs to the Q4 cycle.
- **Q4 Stage 1 is seeded complete** (by `src/db/seed/role-app-runtime.ts`, not this workstream) with no preparation and no record. A seeded preparation for it would claim work that did not happen, so none was added.
- **Safe mode beyond Stage 2.** Only the seeded current stage has a captured preparation; later stages in safe mode compose from the loaded sources and say so on screen ("No cached preparation exists for this stage, so it was composed from the loaded sources").
- **The process page follows the newest active run.** After Stage 8 opens the reassessment, the page shows it; the completed cycle is reached from the portfolio (`?run=RUN-RCSA-PAYOPS-Q4-2026`).
- **Existing actions are not changed by Stage 7.** "Fold into the plan" is recorded as the person's relation; closing the duplicate with the plan action as evidence stays a person's act in the Work Hub (the AI may not close a material action).
- **Source content in English.** Assessment titles, transcripts, test working papers and stakeholder documents exist only in English; German views show them as they are, and quoted passages in German preparations are marked "im Original englisch".
- **Home's Next** still lists three focus items (indicator breach, two contradictions) that the cycle's decisions addressed; they are focus queue rows owned by Home, not decisions, and are not cleared by stage completion. Home's Done and Partner update do reflect the stages ("Done today 81: 63 handled automatically, 18 completed by you"; "Monitoring and Reassessment prepared and validated").
- **Stage 6 responsibility text** names RSK-0211 and a score of 12; it is contract text written for the Q4 cycle and reads as such on a reassessment run.

## What the user must run

- **No schema change and no migration from this workstream.** The stages read migration `0005_work_lineage` (os-meetings), and the current schema also expects `0006_data_model` (another workstream): the shared database needs `npm run db:migrate` (server stopped) if it has not had them.
- **Reseed** the shared database once, with the server on port 3000 stopped, so it has the three first-line submissions of `src/db/seed/rcsa-stages.ts`: `npm run demo:reset` (or `npm run db:seed`). Without them Stage 4 has one position to review instead of six.
- To run the browser journey on an isolated stack (it refuses port 3000 and needs a database outside the repository):

  ```
  $env:NFR_DB_PATH="<scratch>\rcsa.db"; npx tsx scripts/migrate.ts; npx tsx scripts/seed.ts
  $env:NFR_DIST_DIR=".next-rcsa"; $env:NFR_DEMO_MODE="safe"; npx next dev -p <port>
  $env:NFR_BASE_URL="http://localhost:<port>"; npx playwright test tests/e2e/os-rcsa-stages.spec.ts --project=desktop-1920 -g "Stages 2 to 5"
  (restart the server)
  npx playwright test tests/e2e/os-rcsa-stages.spec.ts --project=desktop-1920 -g "Stages 5 to 8"
  ```

  Note: the repository's `playwright.config.ts` has a `webServer` that starts `npm run start` on port 3000 when nothing answers there. The first run of this journey triggered it once (it failed to start because of the standalone output and wrote nothing); later runs used a scratch config without the `webServer` block.

### For the process engine owner (coordination)

- The engine extensions listed above are additive; please keep `check` criteria, completion checks and completion hooks, `startProcessRun`, `recordLines` and the optional `outcomeDe` / `humanResponsibilityDe` when refactoring.
- `src/features/process/preparation.ts` writes the safe-mode note "No cached preparation exists for this stage, so it was composed from the loaded sources." in English only; it shows in German views.
- Stage approvals bound to their stage run (`grantStageApproval`, `stageToolContextFor`): the RCSA stage code never calls `executeTool` itself; every governed change goes through the engine's tool and completion paths, so nothing in `src/role-apps/rcsa/**` needed to change.

### For os-meetings (coordination)

- Stage 5 uses the public read seam only: `getConfirmedMinutesForStage`, `getMeetingTranscript`, `getMinutesForMeeting` and the pure lifecycle helpers (`meetingClock`, `meetingEnd`, `heardTurns`, `isConfirmedMinutes`, `draftOfMinutes`). The minutes are drafted, edited and confirmed in Meetings; confirmed before Stage 5 opens, they are its record when it opens (integration test "reads minutes confirmed in Meetings before the challenge workshop stage opens").
- The offline minutes draft of `MTG-2026-0005` leaves the tenant configuration action without a due date, so the person has to date it in the editor before confirming; the safe draft dates it. The browser journey does that in offline mode.
