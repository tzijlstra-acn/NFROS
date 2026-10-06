# OS Product Excellence: os-process-engine (Wave 2 foundation)

One process orchestrator for both installed Role Apps, an explicit stage contract on all sixteen stages, validated and transactional stage completion through the authority gate, a durable AI preparation job, one event backbone, a generic stage workspace, and two reference stages that run end to end: RCSA Stage 2 (Evidence Refresh) and TPRM Stage 4 (Evidence Review).

Plan references: sections 4.9, 5.1, 5.2, 8.1, 8.2, 8.3 and Wave 2 of section 10.

## 1. What changed

### Architecture

```text
app/workday/[role]/processes/rcsa-cycle/v3.tsx            thin route: role + ?stage=, renders ProcessRunPage
app/workday/[role]/processes/third-party-onboarding/v3.tsx thin route: same
app/workday/[role]/processes/v3.tsx                        landing: cards from the engine, no static fallbacks

src/features/process/                                      the engine
  orchestrator.ts     ProcessOrchestrator     the only entry point; composes the lifecycle; syncStage (resume)
  context.ts          StageContextBuilder     everything about one stage, read from the database, writes nothing
  sources.ts          SourceLoader            runs registered loaders; loaded / empty / stale / unavailable
  preparation.ts      AIStagePreparation      durable job; live / safe / offline branch; persist in one transaction
  preparation-schema.ts                       the structured output (Zod) and its content validator
  tasks.ts            HumanTaskService        records human input through the stage's registered form
  decisions.ts        DecisionGate            seeded decisions via recordDecisionAndExecute; stage decisions on the stage
  approvals.ts        ApprovalGate            payload bound approval rows, granted by the run role holder
  tools.ts            ToolExecution           local tools via executeTool; external commands via dispatchCommand (outbox)
  artifacts.ts        ArtifactService         versioned, digested artifacts; persisted rows only
  validator.ts        CompletionValidator     pure: entry criteria, completion criteria, blocking conditions
  transition.ts       StageTransition         openStage; the gated, transactional completion handler
  derive.ts                                   state readers (job states, decision and tool states)
  registry.ts                                 the stage implementation registry (loaders, preparers, forms, builders)
  keys.ts                                     task, job, event and outbox identity conventions
  view.ts, copy.ts                            the page view model and the bilingual copy
  actions.ts                                  thin server actions ("use server")
  StageActionForm.tsx, StageSync.tsx          the two client islands (submit with result; bounded resume and follow)
  ProcessRunPage.tsx                          the shared process page
  implementations.ts                          imports every app's stage index

src/features/events/backbone.ts                            ProcessEventPublisher: the OS event backbone
src/components/workday-v3/StageWorkspace.tsx               the generic, contract-driven stage renderer

src/role-apps/contracts.ts                                 StageContract and its parts; RoleProcessStage extends it
src/role-apps/stage-helpers.ts, stage-support.ts           shared constructors and read helpers
src/role-apps/rcsa/definition.ts, tprm/definition.ts       all sixteen stages migrated to the full contract
src/role-apps/rcsa/stages/evidence-refresh.ts              reference implementation, RCSA Stage 2
src/role-apps/tprm/stages/evidence-review.ts               reference implementation, TPRM Stage 4
src/role-apps/{rcsa,tprm}/stages/index.ts                  one import per implemented stage
```

### Shared files edited surgically

- `src/server/security/authority.ts`: two registry entries, `completeRcsaStage` (scope `rcsa.rate`) and `completeOnboardingStage` (scope `supplier.assess`), both APPROVAL_REQUIRED and material. Nothing else.
- `src/db/repositories/background-jobs.ts`: additive `leaseJobById`, `parkJob`, `unparkJob`, `getJobById`.
- `src/db/schema/index.ts`: one export line for `os-events`.
- `src/db/seed/run.ts`: `os_events` in the cleared tables (replacing `role_app_events`), and one call to `seedProcessRuntime` after the integration projection.
- `scripts/worker.ts`: "ai-preparation" jobs with a stage payload run the real handler.
- `scripts/test-migration.ts`: `os_events` replaces `role_app_events` in the expected tables.
- `tsconfig.json`: no net change (Next added my build directory's include; I removed it).
- `src/identity/local-demo.ts` (audit T28): the demonstration personas no longer carry real names. `rcsa-analyst` is Marlene Aigner (P-003), `tprm-analyst` is Stefan Brunner (P-002), both with their seeded addresses; `administrator` is "Demonstration administrator" and names no person. User ids, role ids and flags are unchanged.
- `src/db/seed/role-app-runtime.ts` (audit T28, T20 detail): the RCSA scope minutes summary said "Anna Weber confirmed the scope"; it now names Marlene Aigner (P-003), the confirmer the audit identifies. One sentence; the dangling minutes references (T20) are the meetings workstream's.

### Removed

- `app/workday/[role]/processes/rcsa-cycle/actions.ts` and `.../third-party-onboarding/actions.ts` (route-local stage completion that advanced without validation and without the gate).
- `RCSA_PAYMENTS_Q4_RUN` and `TPRM_VERIDIAN_ONBOARDING_RUN` (static run fallbacks), `recordEvent` and `getEvents` (replaced by the backbone), the `role_app_events` table (migrated onto `os_events`).
- The inline AI preparation strings, the static artifact fallbacks, the route-local stage status rules and the hard-coded morning brief counts on the Processes page.

## 2. The stage contract

Defined in `src/role-apps/contracts.ts`. `RoleProcessStage extends StageContract`, so every stage carries all of it.

```ts
interface StageContract {
  entryCriteria: StageCriterion[];          // e.g. previous stage completed
  requiredSources: StageSourceSpec[];       // unavailable => preparation waits, completion blocked
  helpfulSources: StageSourceSpec[];        // unavailable => preparation limited
  aiJobs: StageAIJobSpec[];                 // preparer key, configuration id, output schema, what it prepares
  humanTasks: StageHumanTaskSpec[];         // review / input, with a registered form key
  decisions: StageDecisionSpec[];           // judgmentKind; binding: seeded-decision | stage-decision (options, outcome advance|hold)
  approvalRequirements: StageApprovalSpec[];// covers stage-completion or a tool; always payload bound
  tools: StageToolSpec[];                   // registry tool, channel local|outbox, payload builder, proposeWhen, deliveredWhen
  artifacts: StageArtifactSpec[];           // produced by ai-preparation or stage-completion
  completionCriteria: StageCriterion[];     // evaluated by the CompletionValidator
  nextStageId: string | null;
  blockingConditions: StageBlockingCondition[];
  implementation: { implemented: boolean; reason: Bilingual | null; owner: string | null };
}

type StageCriterion =
  | { kind: "stage-completed"; stageId }      | { kind: "sources-resolved" }
  | { kind: "ai-job-completed"; jobKey }      | { kind: "human-task-completed"; taskKey }
  | { kind: "decision-recorded"; decisionKey }| { kind: "tool-executed"; toolKey }
  | { kind: "artifact-stored"; artifactKey }
  // every criterion takes label: Bilingual and an optional when: { decisionKey, optionIds } (empty = any option)

type StageBlockingCondition =
  | "required-source-unavailable" | "ai-job-failed" | "decision-held"
  | "external-command-failed" | "stage-not-implemented"      // each with label and its key
```

`RoleAppDefinition` gained `stageCompletionToolName` and `workspaceRegion`.

### Implementation status of the sixteen stages

| App | Stage | Status | Reason recorded in data |
|---|---|---|---|
| RCSA | 1 Scope and Trigger | not implemented | completed in the seed; preparation, scope form and record not built |
| RCSA | 2 Evidence Refresh | **implemented** | reference stage |
| RCSA | 3 Risk and Control Change | not implemented | register loader, change preparation and review form |
| RCSA | 4 First-line Input | not implemented | first-line submissions not modelled as a source |
| RCSA | 5 Challenge Workshop | not implemented | not yet connected to meetings and minutes |
| RCSA | 6 Rating and Appetite | not implemented | appetite source and rating preparation (matrix calculator exists) |
| RCSA | 7 Actions and Approval | not implemented | action preparation and assessment versioning chain |
| RCSA | 8 Monitoring and Reassessment | not implemented | monitoring activation; event-driven reassessment needs a run factory |
| TPRM | 1 Request and Intake | not implemented | completed in the seed; procurement request not a source |
| TPRM | 2 Classification and Criticality | not implemented | completed in the seed; arrangement profile and criticality chain |
| TPRM | 3 Tailored Due Diligence | not implemented | completed in the seed; dispatch through the outbox |
| TPRM | 4 Evidence Review | **implemented** | reference stage |
| TPRM | 5 Specialist Reviews | not implemented | preparation, form, meetings |
| TPRM | 6 Contract and Conditions | not implemented | clause comparison |
| TPRM | 7 Decision and Onboarding | not implemented | onboarding file, activation of supplier, service and monitoring records |
| TPRM | 8 Handover to Monitoring | not implemented | handover preparation, monitoring activation |

Seeded decisions bound to RCSA stages: DEC-2026-0771 (Stage 2), DEC-2026-0744 (3), DEC-2026-0745 (4), DEC-2026-0772 (5), DEC-2026-0782 (7). Every other stage decision is a stage decision with its options declared in the contract.

A stage that is not implemented still opens when its predecessor completes, shows its contract, sources and what the AI would prepare, states the reason, and refuses completion (`stage-not-implemented` blocks).

## 3. The lifecycle (plan 4.9, steps 1 to 15)

| Step | Where |
|---|---|
| 1 Validate entry criteria | `validator.ts` (entry criteria are part of `canComplete` and shown) |
| 2 Load required sources | `sources.ts`, inside the job and on every context build |
| 3 Show source status | `StageWorkspace` "Sources" / "Evidence status" |
| 4 Start AI preparation | `openStage` queues a durable job; `syncStage` or the worker runs it |
| 5 Validate structured output | `preparation-schema.ts`, after the mode branch, for every mode |
| 6 Create human tasks | `openStage` creates one task row per contract item and publishes `human-task-created` |
| 7 Create proposed actions | tools whose `proposeWhen` holds are proposed; `approval-requested` published |
| 8 Wait for human input | `tasks.ts`, `decisions.ts` |
| 9 Request approval where needed | `approvals.ts`, payload bound, per tool and for completion |
| 10 Execute governed tools | `tools.ts`: `executeTool` (local) and `dispatchCommand` (outbox) |
| 11 Store artifacts | preparation artifact in the job transaction; stage record in the completion transaction |
| 12 Verify completion criteria | `validateStage`, again inside the completion handler |
| 13 Complete stage | the `completeRcsaStage` / `completeOnboardingStage` handler, one transaction |
| 14 Open next stage | `openStage` inside the same transaction; next preparation queued |
| 15 Update Home, Work, Decisions, Activity, Audit | backbone events with audit and activity projections; `revalidateWorkday(roleId)` |

Durable preparation states (plan 8.2): Queued, Running, Waiting for source, Waiting for approval, Retrying, Completed, Failed (plus Not started and Unavailable for a stage with no preparer). Derived from the `background_jobs` row in `derive.ts`. A lease that expired (a restart) is shown as Retrying and released on the next resume. The page follows a running job for at most fifteen refreshes, then says "Still running. Refresh to check again." There is no permanent spinner.

AI modes: live calls the model with a strict JSON schema derived from the Zod schema (never reached in safe or offline mode; tested only with an injected fake model); safe serves the validated preparation captured at seed time from `cached_ai_outputs`, but only while the sources it was captured from are unchanged (digest check), otherwise it composes and says so; offline composes from the loaded sources. All three pass the same validator, which rejects an evidence id no loaded source returned, an unknown source, tool, option or item, an em dash, an en dash, a double hyphen, an umlaut in German, and internal technology terms.

## 4. How to implement a stage (for the RCSA and TPRM stage workstreams)

Copy `src/role-apps/tprm/stages/evidence-review.ts` (or the RCSA one). Each step names the file you touch; only the follow-on workstream for that app edits its files, so the two can run in parallel.

1. **Complete the contract** in `src/role-apps/<app>/definition.ts` for your stage. Check the sources, AI job, tasks, decisions (seeded or stage), tools, artifacts, completion criteria and blocking conditions. Keep keys stable; the engine, tasks and events are keyed on them.
2. **Create** `src/role-apps/<app>/stages/<stage-id>.ts` and register, under the keys the contract names:
   - `registerSourceLoader(key, ctx => SourceLoadResult)` for every source. Read the database only. Return `records` with ids, labels, values and `evidenceIds`, plus `facts` your preparer uses. Return `status: "empty"` with a note when nothing is a finding, not a gap.
   - `registerPreparer(key, { compose, prompt, itemIds })`. `compose` is the offline output and must be grounded only in the loaded sources; `prompt` is the live instructions and input; `itemIds` lists items your output may assess.
   - `registerTaskForm(key, { schema, fields, fromFormData, validate, defaults, summarise })` for every human task. `fields` describes rows (choice, note, date) the generic workspace renders; prefill only from what the person recorded, never from the AI.
   - `registerDecisionRules(processId, stageId, { validateOption, consequences })` when options depend on recorded input.
   - `registerPayloadBuilder(key, ctx => ToolPayload | { unavailable })` for every tool. The payload is what the approval binds to.
   - `registerArtifactBuilder(key, ctx => { label, content })` for every stage-completion artifact. Deterministic, no timestamps: its digest is bound into the completion approval.
3. **Add the import** to `src/role-apps/<app>/stages/index.ts`.
4. **Flip** `implementation` to `IMPLEMENTED` on the stage. `missingImplementations(stage)` must return `[]`; the unit test "implements exactly the two reference stages" must be updated to your set.
5. **Seed** only if the stage is a seeded current stage: `seedProcessRuntime` opens current stages and captures the safe mode cache automatically. A stage that opens later needs nothing.
6. **Test**: extend `tests/integration/process-engine.test.ts` with your journey (prepare in safe and offline, record, decide, execute tools, complete, assert idempotency) and `tests/e2e/os-process-engine.spec.ts` with the browser journey.
7. **Do not** add rules to route files, write to stage tables outside the engine, or add a static fallback for a run, a preparation or an artifact.

## 5. The event backbone API

`src/features/events/backbone.ts`, table `os_events` (`src/db/schema/os-events.ts`).

Types: the plan's fourteen (`work-arrived`, `source-changed`, `ai-preparation-started`, `ai-preparation-completed`, `human-task-created`, `decision-requested`, `approval-requested`, `tool-executed`, `external-command-acknowledged`, `stage-completed`, `process-completed`, `routine-completed`, `meeting-completed`, `action-updated`) plus six process lifecycle facts (`stage-opened`, `ai-preparation-held`, `ai-preparation-failed`, `human-task-completed`, `decision-recorded`, `approval-granted`).

```ts
publishOsEvent({
  type, roleId, atMoment, actorKind: "human" | "ai" | "system" | "connector", actorUserId?,
  subject?: { kind, id }, process?: { runId, stageId? }, correlationId?,
  summary: { en, de }, payload?, idempotencyKey,          // one key, one event, forever
  audit?: { category, action, objectKind, objectId, ... } // writes the audit row in the same transaction
  auditEventId?,                                          // or links one a governed path already wrote
  activity?: { kind, label, durationMs, ... },            // writes the AI activity row, for AI work only
}): { event, created }

listOsEvents({ roleId?, types?, processRunId?, stageId?, subject?, correlationId?, sinceSequence?,
               limit?, order?: "asc" | "desc", language?, includeArrivals?: { upToMoment } }): OsEventView[]
latestOsEventSequence(runId?): number      // for incremental readers ("since sequence n")
findOsEvent(idempotencyKey, runId?)        // did it happen?
linkOsEventAudit(eventId, auditEventId)    // set once, used when executeTool audits after the handler
```

How it unifies what existed, without a second account of anything:
- `role_app_events` is retired; migration 0004 moved its rows onto `os_events`.
- `audit_events` stays the tamper-evident authority record. A backbone event references its audit row by id; the governed paths (`executeTool`, `dispatchCommand`) keep writing their own rows and the backbone links them.
- `ai_activity_entries` stays the measured AI work record; AI events write their activity row in the same call and link it.
- `workday_live_events` (the seeded arrivals) is read through `listOsEvents({ includeArrivals })` as `work-arrived`, not copied.
- Key convention shared with the decisions engine: `decision-recorded:<decisionId>`. If the Decisions workstream publishes decision events, using that key makes one account whoever publishes first.

Consumers (Home, Work, AI Partner, Activity, Audit, analytics): read by role and `sinceSequence` for "what changed"; by `processRunId` for a process timeline; follow `auditEventId` / `activityEntryId` for detail.

## 6. The migration and what the user must run

One migration: `src/db/migrations/0004_process_engine.sql` (snapshot `meta/0004_snapshot.json`, journal entry `0004_process_engine`). It:
- creates `os_events` with its indexes (unique on run and idempotency key);
- adds columns to `role_app_stage_runs` (`preparation_job_id`, `completion_approval_id`, `completion_rationale`), `role_app_stage_tasks` (`task_key`, `created_at`, `completed_by_user_id`, `approval_id`, `status_reason`) and `role_app_artifacts` (`stage_run_id`, `artifact_key`, `version`, `content_digest`, `produced_by`, `mode`, `created_by_user_id`);
- de-duplicates stage runs, then adds a unique index on run and stage; keys existing tasks, then adds a unique index on stage run and task key;
- copies any `role_app_events` rows onto `os_events`, then drops `role_app_events`.

It was generated in two non-interactive phases (drizzle-kit needs a TTY for a drop-and-create diff) and merged into one migration; `drizzle-kit generate` afterwards finds no schema change. Tested: fresh migrate, the 0003 to 0004 upgrade with legacy rows and a duplicate stage run, `db:seed`, and `demo:reset` on my database.

**The user must run, against the shared database, with the dev server stopped:**

```text
npm run db:migrate
npm run demo:reset
```

Until then, the process pages on the shared server on port 3000 will fail, because the code expects `os_events` and the new columns.

## 7. Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| Route files define no business rules | Met | Both process routes are about 40 lines: role check, `?stage=`, `<ProcessRunPage>`. The landing reads `buildProcessCards`. |
| No inline AI preparation string is the live source of truth | Met | Preparation is a validated artifact from the job; the only AI text on the page is the stored output. `STAGE_CONTENT` / `AI_PREP_CONTENT` removed. |
| No static artifact when a seeded run exists | Met | Artifacts are persisted rows only; empty says "Nothing is stored for this stage yet". Static run constants removed. |
| Continue does not bypass criteria | Met | Button disabled with reasons; the action and the handler re-validate. Tests: "refuses to complete a stage whose criteria are not met, and writes nothing", "refuses a completion whose rationale is not confirmed"; Playwright asserts the disabled button and its reasons. |
| Completion is transactional and idempotent | Met | One transaction in the completion handler; "commits completion atomically: a payload that no longer matches is refused and nothing is written"; "is idempotent: every repeated submission writes nothing the second time". |
| Material stage outcomes pass the authority gate and approvals | Met | `completeRcsaStage` / `completeOnboardingStage` via `executeTool`; "refuses a completion without an approval at the authority gate" (`approval-missing`); "refuses a material completion the autonomy level cannot reach". |
| External commands use the outbox | Met | `dispatchCommand` with key `stage-tool:<stage run>:<tool>`; one acknowledged `integration_commands` row and a receipt asserted in the TPRM test; Playwright sees "Confirmed by the target system GRC-000001". |
| State survives refresh and restart | Met | Playwright reloads after completion. Restart proof on port 3106: recorded dispositions and decision, stopped the server process, restarted, the state was intact and the stage completed; the RCSA preparation queued before the restart ran after it (`restart-1-before-stop.png`, `restart-2-after-restart.png`). Integration test: an interrupted lease after `closeDb()` shows Retrying and completes on resume. |
| Safe and offline modes complete both reference stages | Met | Test "complete both reference stages in safe mode" and "in offline mode". Live follows the same path (fake model test) and is never called. |
| Durable AI job with the plan's states, no permanent spinner | Met | Tests for Waiting for source (and its resume with `source-changed`), Waiting for approval (Assist level, human start), Retrying after a lost lease, live fallback. `StageSync` bounds following to fifteen refreshes. |
| Shared event backbone | Met | `os_events` plus the API above; tests for once-only publishing, audit and activity projections, sequence, arrivals read-through, the full lifecycle of a completed stage. |
| Shared stage workspace, contract driven, V3.3 look, regions kept | Met | `StageWorkspace.tsx` renders any stage from the view; `rcsa-stage-workspace`, `tprm-stage-workspace`, `tprm-evidence-status` and `role-app-library` regions kept. |
| Two reference stages executable end to end | Met | Integration and Playwright journeys for RCSA Stage 2 and TPRM Stage 4. |
| tsc clean | Met for all source | `npx tsc --noEmit -p tsconfig.json`: no error in any source file. At the final run it reported 4 errors, all inside other workstreams' generated build directories (`.next-os-home-truth/dev/types`, `.next-os-workhub/dev/types`: a route type clash over the new `/ops` layout); they disappear when those directories are removed. |
| vitest for orchestrator, validator, transitions, idempotency, event model | Met | `tests/unit/process-engine.test.ts` (20) and `tests/integration/process-engine.test.ts` (30, including the two audit tests for J13). |
| Playwright for the two journeys on my port | Met | `tests/e2e/os-process-engine.spec.ts`: 2 passed on http://localhost:3106. |
| check:copy and scan:secrets pass | Met | `npm run check:copy` passed; `npm run scan:secrets` passed. `check-no-emdash`: clean for my files (see limitations for other workstreams' files). |
| `npm run test:integration` still passes | Met | 13 files, 326 tests passed (including other workstreams' new tests). Unit suite: 28 files, 840 tests passed. |
| Screenshots | Met | `docs/screenshots/os-excellence/os-process-engine/` (section 9). |

### Baseline audit items in scope (`docs/handoffs/os-excellence-audit.md`)

| Item | Status | Evidence |
|---|---|---|
| J13 (critical): stage completion had no criteria and recorded no user (`rcsa-cycle/actions.ts:28-101`) | Closed | The route action is deleted. The only completion path is `completeStage` (`src/features/process/transition.ts`): `validateStage` refuses before anything is written (no approval, no event), the approval is bound to a digest of the stage, and `completeRcsaStage` / `completeOnboardingStage` run through `executeTool`, whose handler re-validates inside one transaction. Each completion records the acting user and role four times: `role_app_stage_runs.completed_by_user_id`, `completion_approval_id` and `completion_rationale`; the `approvals` row (`approved_by_user_id`, `role_id`); the mutation `audit_events` row (`actor_user_id`, `role_id`); the `stage-completed` event (`actor_user_id`, `role_id`). The acting role is the run's role and the user is its seeded holder (P-003 for RCSA, P-002 for TPRM). As defence in depth, a request that names a role other than the run's own is now refused before anything is written (`routeRoleRefusal`, called by every write action); the acting person is not yet bound to a signed-in session (section 10). Stages 3 to 8 of RCSA and 1 to 3 and 5 to 8 of TPRM are not executable and cannot be completed at all. Tests: "refuses to complete a stage whose criteria are not met, and writes nothing", "records the acting user and role on every completion record" (P-002 / tprm), the RCSA journey (P-003 / rcsa), "refuses a request whose workday role does not own the run", the hold, rationale, autonomy and gate refusals. |
| T14 (critical): inline RCSA "AI prepared" text (`rcsa-cycle/v3.tsx:59-107`) contradicting the seeded run | Closed | `STAGE_CONTENT`, `AI_PREP_CONTENT` and the static artifacts are gone; the route renders `ProcessRunPage` only. Preparation is a validated artifact composed from the loaded seeded sources (KRI readings, incidents, losses, control tests, actions, the prior assessment, process telemetry and control evidence), in English and German, and it cites only ids that exist. A grep of `src/`, `app/` and `messages/` finds no "BCA-CTRL", "2026-10-10" workshop date, "Q1-2026" or "Scheduled quarterly" in any product surface. The stage 2 task comes from the contract (investigation strategy, DEC-2026-0771), not from route text. |
| T16 (critical): inline TPRM "AI prepared" text (`third-party-onboarding/v3.tsx:90-104`) | Closed | Same route rewrite. "Business owner: Thomas Zijlstra", "4 of 7 evidence items" and "Stage locked" no longer exist in `src/` or `app/`. A stage that is not open shows its stage-run status and, where not executable, the contract's reason (`stage-not-executable`); never a "Stage locked" preparation. |
| T28 (high): real names in synthetic content | Closed in `src/` and `app/` | The inline route text (which named Thomas Zijlstra, Anna Mueller and Max Weber) is deleted. A grep of `src/` and `app/` for "Zijlstra", "Anna Mueller", "Max Weber" and "Anna Weber" now finds only `src/presentation-v2-4/**` (the presenter on the cover and the capture registry), which is out of scope. Two further occurrences were fixed surgically: the demonstration personas in `src/identity/local-demo.ts` and the minutes summary in `src/db/seed/role-app-runtime.ts`. Remaining outside `src/` and `app/`: the test fixture `tests/unit/support/work-fixtures.ts` and `tests/unit/work-actions.test.ts` use "Anna Weber" for P-003 (Work Hub workstream's files, not edited), and older handoff documents quote the names historically. `src/ai/offline-responses.ts` still holds the old contradicting envelope text ("BCA-CTRL-142", "4 of 7"); no screen or engine path reads it, only `tests/unit/ai-contracts.test.ts`. |
| J16 (high): TPRM gate note pre-filled (`third-party-onboarding/v3.tsx:778`), RCSA hidden `decision=proceed` (`rcsa-cycle/v3.tsx:362`) | Closed | Both removed with the route rewrite. In `StageWorkspace.tsx` every decision radio is unchecked and has no default, every rationale textarea is empty (`ConfirmFields` is never given a default), and form fields are filled only from the person's own recorded input. The AI's disposition proposals and notes appear as labelled hints ("AI proposal: ..."), never as values. Only the chase date of an item not received starts from the supplier's stated expected date; it is a visible, editable date, recorded only when the person chooses "Outstanding". The server refuses a decision without an option ("Choose an option") and a rationale not confirmed as the person's own. Playwright asserts that no disposition radio is checked on load. |
| J15 (high): TPRM dead-ends at stage 5 | Closed for the engine; stages 5 to 8 belong to the TPRM stages workstream | Completing stage 4 opens stage 5 inside the same transaction: a `role_app_stage_runs` row (`SR-RUN-TPRM-VERIDIAN-2026-specialist-reviews`, status `ready`), its contracted tasks (each carrying the not-executable reason), the `stage-opened` and `human-task-created` events, and the run's current stage. The workspace renders it from the contract: its sources, tasks, decisions and criteria, and the reason it is not yet executable, with Continue disabled and the reasons listed. Integration: `next.stage.id === "specialist-reviews"`, `next.stageRun?.status === "ready"`, `validateStage(next).canComplete === false`; screenshot `next-tprm-stage5-not-executable-1920-1.png`. The audit's own acceptance ("all eight TPRM stages can be executed in the UI") needs stages 5 to 8 implemented on this contract (section 4). |

## 8. Tests run

| Command | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | no source errors (4 in other workstreams' generated `.next-os-*` type directories at the final run) |
| `npx vitest run tests/unit` | 28 files, 840 passed (again after the audit follow-up; a first run started alongside the integration suite had one transient failure, the rerun on its own passed in full) |
| `npx vitest run tests/integration` | 13 files, 326 passed; after the audit follow-up 15 files, 356 passed |
| `npx vitest run tests/unit/process-engine.test.ts tests/integration/process-engine.test.ts` | 48 passed; after the audit follow-up, with `tests/unit/identity.test.ts`, 3 files and 76 tests passed |
| `NFR_BASE_URL=http://localhost:3106 npx playwright test tests/e2e/os-process-engine.spec.ts --project=desktop-1920` | 2 passed |
| `npm run check:copy` | passed |
| `npm run scan:secrets` | passed |
| `node scripts/check-no-emdash.mjs` | no finding in my files; 3 findings in other workstreams' test files at the first run, passed at the audit follow-up run |
| `drizzle-kit generate` after the merge | no schema change |
| migrate, seed, `demo:reset` on `<scratchpad>\os-process-engine.db` | all succeeded |

## 9. Screenshots

`docs/screenshots/os-excellence/os-process-engine/`:
- `before-*-v2.4-capture.png`: the old pages, from the released V2.4 product-proof captures (static AI text, static artifact, route-local completion form).
- `after-tprm-stage4-1920-{1..4}.png`, `after-tprm-stage4-1366-{1,2}.png`, `after-rcsa-stage2-1920-{1..4}.png`, `after-rcsa-stage2-1366-{1,2}.png`: the seeded day on the engine (scrolled segments of the main region).
- `after-tprm-stage4-de-1920-*.png`, `after-rcsa-stage2-de-1366-*.png`: German.
- `after-processes-landing-{1920,1366}-1.png`: the landing cards.
- `completed-tprm-stage4-1920-*.png`, `completed-rcsa-stage2-1366-*.png`: completed stages with their recorded work and artifacts.
- `next-tprm-stage5-not-executable-1920-1.png`: the next stage opened, honest about not being executable.
- `restart-1-before-stop.png`, `restart-2-after-restart.png`: the restart proof.

No horizontal overflow at 1920x1080 or 1366x768 (main region `scrollWidth == clientWidth` in every capture).

## 10. Known limitations

- Fourteen of sixteen stages are contracted but not executable; they say so in data and on screen. This is the follow-on workstreams' scope.
- Stage decisions (for example the TPRM Stage 4 gate) live on the stage, not in the `decisions` table, so the Decisions queue does not list them; the backbone publishes `decision-requested` and `decision-recorded` for it. Materialising stage decisions into the Decisions surface is a decision for the Decisions owner.
- A seeded decision recorded inline is refused while the shell acts as another role, because `grantApproval` uses the active role (the defect described in `src/scenario/engine/decide.ts`). Stage approvals are granted by the run role holder instead.
- Waiving an unavailable required source is not implemented; the stage waits for the source to return (or a person restarts the preparation).
- `humanResponsibility` and `outcome` on the stage definitions, and seeded decision prose, are English only, so German pages show those lines in English.
- The released deck captures (`src/presentation-v2-4/product-proof/asset-registry.ts`) expect the removed inline strings ("Retrieved 4 of 6 required evidence sources", "Submit evidence decision"). The released assets are unaffected; re-running the capture script would fail its expected text.
- `npm run lint` cannot parse TypeScript in this repository (every `.ts` file fails with "Unexpected token" on `import type`, including untouched files); lint is not a usable signal until the eslint config gets a TypeScript parser.
- `check-no-emdash` reported literal em dash characters in `tests/integration/home-read-model.test.ts`, `tests/unit/home-read-model.test.ts` and `tests/unit/work-shell.test.ts` (other workstreams); at the audit follow-up run it passed.
- The process pages act as the run's role holder, because the workday has no per-person session. The engine refuses a request from another role's workday (`routeRoleRefusal`), but it does not read the demonstration identity session; aligning the acting person with a signed-in session is the identity owner's decision.
- The worker (`npm run worker`) runs stage preparations, but the dev server does not need it: the page resumes queued jobs through a server action, and completion runs the next preparation after the response.

## 11. What the user must run

1. Stop the dev server on port 3000.
2. `npm run db:migrate`
3. `npm run demo:reset`
4. Start the dev server again. The seeded day opens with RCSA at Stage 2 and TPRM at Stage 4, each preparation Queued; opening the page runs it.
