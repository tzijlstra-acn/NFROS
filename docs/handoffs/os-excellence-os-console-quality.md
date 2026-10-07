# OS Product Excellence: os-console-quality (Wave 4)

Quality (plan 7.5), Integrations (7.6) and Feedback (7.8) in the Product Owner Console, built on os-console-core's shell, personas and governed action path. Synthetic institution and data. Illustrative regulatory context, not legal advice.

Isolated stack: port 3116, database `<scratchpad>\os-console-quality.db` (migrated through 0008, then seeded), dist dir `.next-os-console-quality`. Nothing was written to `data/nfr-workos.db` and nothing was clicked on port 3000.

## 1. What changed

### Quality, `/product/quality` and `/product/quality/runs/[runId]`

- **Shows**, per role and task: the configuration in force (code registry, or a console approval), any open candidate, and for the latest run of each mode: evaluation coverage, mandatory cases, grounding failures, citation failures, required-source failures, authority refusals, German-language results, latency and cost. Then user rejection and modification (0006 suggestion lifecycle, `countSuggestionDispositions`) and user feedback (0006 `ai_feedback`, by kind), aggregates per role only.
- **Honest readings**: a structural run is **Simulated** (synthetic envelopes); a safe-mode run is **Safe** with how many cases it could grade; a failure is **Not verified**. A figure a mode does not measure reads "Not measured in this mode"; latency and cost read "Not measured in safe mode: no model was called in this run". Nothing is shown as zero that was not measured.
- **Actions**, each through `governConsoleAction`:
  - **Run evaluation** (`quality.run-evaluation`): Offline (structural) or Safe (reviewed responses). Never live, in any demo mode.
  - **Inspect failed case** and **Compare output**: the run page lists every case, failed first; the selected case shows its input and expectations (from `evals/cases`), the graded output and its source, each grader's verdict, and the same case in the latest run of the same mode for every other configuration of the role and task.
  - **Approve candidate** (material, approval bound to the change and to the evaluation runs it rests on), **Reject candidate** (reason required), **Roll back** (material).
  - **Export evidence**: `/product/quality/evidence?run=<id>`, a JSON document with the run, every case, the decisions and the gate verdict.
- **The release block**: `releaseBlockedByEvaluation` is the approval's rule, evaluated on the server at submission. A configuration is blocked when it has no completed run, when the latest completed run of any mode has a failed mandatory case (so a structural pass cannot mask a safe-mode failure), or when that run evaluated other prompt, model profile, schema or suite values.

### The evaluation harness (`src/features/product/quality/harness.ts`)

The same harness as `npm run eval:structural`: the case files in `evals/cases/` and the grader modules in `evals/graders/`, imported, not copied.

| Mode | Output graded | Graders |
|---|---|---|
| `structural` (Offline) | A synthetic envelope built from each case, the rule `scripts/eval-runner.ts --mode=structural` uses | schema, authority, jurisdiction |
| `grounding` (Safe) | What the product answers without a model: the authority gate's decision for an action request the Partner recognises (`detectRequestedTool` and `evaluateAuthority`), or the reviewed answer (`matchSeededChatAnswer`). Anything else is **not run**, with the reason | all seven, plus grounding: every cited identifier must exist in the seeded scenario (`collectKnownIdentifiers`) |

Mandatory cases: those requiring a blocked part (authority) and those with jurisdiction constraints (DORA never applied to the Swiss entity). The suites are RCSA 36 cases and TPRM 24.

Measured on the seeded day for RCSA:
- **Structural**: 36 of 36 pass, as `npm run eval:structural` does.
- **Safe**: 4 of 36 cases have a reviewed answer, and all 4 fail the required-source grader. These are real findings and can be inspected:
  - EVAL-MTG-003 is answered with the control rating answer, and meeting minutes are not cited;
  - CHAL-005, CONF-001 and CONF-004 do not cite the first-line submission register or the audit finding.
- None of those 4 cases is mandatory. The other 32 are recorded as not run.

### Integrations, `/product/integrations`

- **Shows**, per connector: its status badge (the simulators say **Simulated**; the Microsoft Graph sandbox adapter, which reads through the simulator, says **Not verified**), health, last sync, source freshness (each object type's staleness threshold, `computeFreshness`), event subscription, write state (read only by design, not enabled, paused, enabled), queued, failed, dead-letter and awaiting-approval commands, open mapping issues, and the credential state as one word. Then the outbound queue, mapping issues (detected conflicts and rejected events plus recorded reviews), integration incidents and the diagnostic bundle. Planned adapters are one line with a link to `/settings/integrations`.
- **No credential is displayed**: the view model is built from columns that cannot hold one (`secret_status` is a four-word state), and the bundle test scans for key-like strings.
- **Actions**, each through `governConsoleAction` with the Integration Owner's scopes:
  - **Test connection**: asks the connector for its health (`checkConnectorHealth`).
  - **Run sync**: the delta sync for every declared read type, through the capability gate.
  - **Pause writes** and **Resume writes** (material).
  - **Retry command**: `retryCommand`, back through the dispatcher and the authority gate on the original idempotency key.
  - **Resolve mapping** (material): records the review in `data_quality_issues`; the data and the analyst's conflict marker are untouched, because a disagreement between sources can be the finding.
  - **Download diagnostic bundle**: `/product/integrations/diagnostics`, built in memory with the three parts of `scripts/support-bundle.ts` (health, release, exclusions) plus connector, sync, outbox, dead-letter and mapping state. No payloads (digests only), no credentials.

### Pause writes in the runtime (surgical)

- `src/integrations/runtime/WritePause.ts` (new): the pause is a product configuration change in the append-only `product_config_changes` log, area `integration-writes`; a connector's write state is its latest entry. No schema change. The product configuration seed clears it, so `demo:reset` restores the seeded state.
- `CommandDispatcher.ts`:
  - `attemptCommand` makes no attempt against a paused connector and leaves the command queued. Every path passes through it: the first dispatch, the drain and a manual retry.
  - `retryCommand` changes nothing while paused (`denialCode: "writes-paused"`): the dead letter stays open.
  - `drainOutbox` takes an optional `connectorInstanceId`, which Resume uses to deliver what waited.
- A new command to a paused connector is accepted into the outbox, not refused. The process engine's stage tools already read that as "in the outbox".

### Feedback, `/product/feedback`, and the workday entry point

- **Inbox**: open items first (closed and declined behind "All"), each with the kind (the eight plan types), the person's statement, where it was raised, and one triage form: status, severity, owner, feature, Role App, stage and release. Below it, AI feedback not yet forwarded, with Forward to inbox. "Useful" is a signal and stays in the quality figures.
- **Rules**: triage, links, severity and release tracking need `feedback.triage`; changing the owner also needs `feedback.assign`. Owners are responsibilities (the product-owner personas), never named people. The stage must belong to the chosen Role App; "In a release" needs a release.
- **Workday**: "Send product feedback" in the account menu of the workday header opens a small dialog: kind, one sentence, optional detail. The role and route go with it; nothing from the work or chats is attached. It adds nothing to the four-item navigation (the journey asserts four links). Submissions are recorded as the role holder, like every workday action until named identities arrive.

### Candidate configuration (surgical)

`src/ai/prompt-registry.ts` gains one candidate, `AICFG-RCSA-STAGE-PREP-002`: the released RCSA stage preparation on the `gpt-4o-reasoning` profile, whose stated purpose is challenge preparation and which no released configuration used. It has no release date. `/settings/ai-quality` still lists the released configurations only and now counts one candidate.

## 2. The evaluation API for os-console-core

`src/features/product/quality/api.ts`, server only. Permission is the caller's: call these inside your own `governConsoleAction`.

```ts
runEvaluation(input: {
  configurationId: string;
  mode: "structural" | "grounding";            // Offline or Safe; never live
  triggeredBy: { label: string; userId: string | null };
  roleAppVersionId?: string | null;            // set it from the Role App lifecycle
}): { ok: true; run: AIEvaluationRun } | { ok: false; reason: Bilingual }

latestEvaluationStatus(configurationId: string): {
  configurationId: string;
  latestByMode: AIEvaluationRun[];             // latest completed run of each mode, newest first
  latest: AIEvaluationRun | null;
  reading: StatusReading;                      // Simulated, Safe or Not verified, with the reason
  verdict: EvaluationGateVerdict;              // { blocked, reasons: Bilingual[], latestByMode }
}

releaseBlockedByEvaluation(configurationIds: string | readonly string[]): {
  blocked: boolean;                            // true when any configuration is blocked
  reasons: Bilingual[];
  verdicts: EvaluationGateVerdict[];
}
```

Also exported: `configurationInForce(roleId, taskKind)`, `openCandidates(roleId, taskKind)`, `listEvaluableConfigurations()`, `getConfiguration(id)`. The pure rule is `evaluationGate(configuration, runs)` in `gate.ts`.

**To connect the Role Apps "Run evaluations"** (`src/features/product/role-apps/evaluations.ts`):
1. Make `roleAppEvaluationCapability()` return available.
2. In `runVersionEvaluations`, call `runEvaluation({ configurationId, mode: "structural", triggeredBy, roleAppVersionId: version.id })` for each id in `version.evaluations.configurationIds`.
3. For the release rule, `releaseBlockedByEvaluation(version.evaluations.configurationIds)` agrees with `evaluationVerdict` and adds the per-mode and stale-values checks.

I did not edit your files while you were building them.

## 3. Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| Evaluations run and are stored | Met | Integration test "records a structural run with one result per case and counts that agree"; the safe-mode test; the Quality journey runs four evaluations in the browser |
| Failed cases can be inspected | Met | Run page with input, expectations, graded output and grader verdicts; the integration test checks a failure's reason names its grader; journey step "Inspect a case" |
| A release is blocked while a mandatory evaluation fails | Met, server side | Integration tests "blocks release while a mandatory case fails, and the server refuses the approval" (code `rule`, nothing recorded), "fails a TPRM mandatory case that applies DORA to the Swiss entity", "refuses an approval whose evidence moved after review"; unit tests on `evaluationGate`; the journey shows Approve disabled with the reason before any run |
| Connector actions are real against the simulated runtime | Met | Test connection, Run sync, Pause and Resume, Retry and Resolve call the runtime; the Integrations journey runs each in the browser |
| Pause writes and Retry are verified | Met | Integration test "really stops outbox dispatch": zero write attempts, command queued, drain and retry send nothing, resume delivers on the original key. "re-dispatches a dead letter through the dispatcher and closes it". Journey: real dead letter (fixture), pause blocks the retry, resume, retry clears it |
| No credential is displayed | Met | Credential is a state word; bundle test and journey scan for key-like strings |
| The feedback inbox triages and links | Met | Integration test triages with every link; journey triages in the browser |
| An analyst can submit feedback | Met | Account menu dialog; journey submits from `/workday/rcsa` and finds it in the inbox |
| Permissions are enforced | Met | Integration tests: an Integration Owner cannot run, approve or reject (`missing-scope`); nobody acting (`no-persona`); an AI Quality Owner cannot pause writes or change an owner; a Pilot Lead cannot retry. Journey: Pilot Lead sees the controls disabled and the bundle returns 403 |
| EN and DE; no overflow at the three viewports | See section 4 | Overflow test on the three pages and a run page in all three projects; German pass on the three pages |
| tsc, vitest, Playwright, check:copy, check-no-emdash, scan:secrets | See section 4 | |
| Screenshots | See section 5 | |
| Handoff with the evaluation API | Met | This file, section 2 |

## 4. Tests run

| Command | Result |
|---|---|
| `npx vitest run tests/unit/os-console-quality.test.ts tests/integration/os-console-quality.test.ts` | 2 files, 24 passed |
| `npx vitest run` (final full pass) | 73 files, 1672 passed |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `NFR_BASE_URL=http://localhost:3116 npx playwright test tests/e2e/os-console-quality.spec.ts`, on a freshly reset isolated database | 13 passed, 8 skipped. The skips are by design: the four writing journeys run in the 1920 project only. Quality, Integrations, Feedback and German passed at 1920; the overflow checks of the three pages and a run page passed at 1920, 1440 and 1366. |
| `npm run check:copy` | passed |
| `node scripts/check-no-emdash.mjs` | passed; its percentage notes are pre-existing seed text |
| `npm run scan:secrets` | passed, 8348 files |

The first Playwright run failed in the Integrations journey. After Pause the approval panel stays open with its result, so the Resume button was not offered. The spec now reloads before Resume, and the rerun passed.

## 5. Screenshots

`docs/screenshots/os-excellence/os-console-quality/`: `quality-en`, `integrations-en`, `feedback-en` and `quality-run-en` at 1920 and 1366; `quality-after-runs-en`, `quality-inspect-case-en`, `integrations-paused-en`, `workday-feedback-dialog-en` and `feedback-triaged-en` at 1920; `quality-de` at 1920. Before this workstream the three routes showed os-console-core's "In preparation" page.

## 6. Known limitations

- **Approval records the configuration in force; the runtime does not read it yet.** The Role App definitions name their configuration in code (`CONFIG` in `src/role-apps/*/definition.ts`). Switching the runtime to `configurationInForce` is outstanding (AI Partner or process engine owner). The Quality page says so beside every configuration.
- **Safe-mode coverage is thin, honestly.** Most cases have no reviewed answer and are recorded as not run.
  - The Partner's keyword intent detection does not recognise the three authority cases' phrasing ("record a residual risk rating", "approve ... yourself", "distribute the minutes"). In safe mode they are not run, and only the structural run grades them.
  - Widening `TOOL_INTENTS` in `src/agents/chat/service.ts` would let safe mode grade them through the real gate.
- **Inputs and expectations are read from the case files as they are now**, not stored with the run (the schema has no column for them). The run page says so.
- **Stored values stay English**: connector health messages, command intent statements, grader details and audit summaries, as the release registry already records.
- **Resolve mapping records the review only.** A mapping change is a configuration change and is not made from the console.
- **No integration incident is opened from this page.** The data model's `integration_incidents` are shown; opening and resolving them belongs to Operations.

## 7. What the user must run

- No migration and no schema change.
- After pulling, restart the dev server. The candidate configuration and the console pages are code.
- `npm run demo:reset` is not required. It clears any evaluation runs, release decisions, feedback and write pauses recorded in a demonstration, as the data model handoff describes.

## 8. Files

**New**
- `app/product/quality/page.tsx`, `app/product/quality/runs/[runId]/page.tsx`, `app/product/quality/evidence/route.ts`
- `app/product/integrations/page.tsx` (replaced the placeholder), `app/product/integrations/diagnostics/route.ts`
- `app/product/feedback/page.tsx` (replaced the placeholder)
- `src/features/product/quality/`: `harness.ts`, `gate.ts`, `api.ts`, `operations.ts`, `model.ts`, `evidence.ts`, `actions.ts`, `copy.ts`, `QualityConsole.tsx`, `RunDetail.tsx`
- `src/features/product/integrations/`: `model.ts`, `operations.ts`, `diagnostics.ts`, `actions.ts`, `copy.ts`, `IntegrationsConsole.tsx`
- `src/features/product/feedback/`: `operations.ts`, `actions.ts`, `copy.ts`, `FeedbackInbox.tsx`, `WorkdayFeedbackDialog.tsx`
- `src/integrations/runtime/WritePause.ts`
- `tests/integration/os-console-quality.test.ts`, `tests/unit/os-console-quality.test.ts`, `tests/e2e/os-console-quality.spec.ts`, `tests/e2e/support/os-console-quality-fixture.ts`
- `docs/handoffs/os-excellence-os-console-quality.md`, `docs/screenshots/os-excellence/os-console-quality/`

**Changed (surgical)**
- `src/integrations/runtime/CommandDispatcher.ts`: the pause hold in `attemptCommand` and `retryCommand`, the connector filter on `drainOutbox`.
- `src/integrations/runtime/IntegrationRuntime.ts`: exports the write-pause functions.
- `src/ai/prompt-registry.ts`: one candidate configuration.
- `src/components/workday-v3/WorkdayHeaderClientActions.tsx`: the "Send product feedback" account menu item, the dialog, and a test id on the account button.
