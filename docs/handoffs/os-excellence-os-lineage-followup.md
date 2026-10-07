# OS Excellence: os-lineage-followup handoff

Small, precise follow-ups to the data-model workstream (migrations 0007 and 0008): the Inbox, Home, Meetings and Actions now write and read the stored lineage, the process engine reads stage inputs, an RCSA reassessment run gets decisions of its own, and the recorded residual writes its appetite position by the matrix rule. No schema change. Synthetic institution and data.

## What changed

### 1. Inbox: stored lineage, written and read (`src/features/work/modules/inbox/`)

Writes (`tools.ts`), each in the handler's own transaction beside the change and its backbone event:

- **Conversions** through `recordInboxConversion` everywhere one happens: action and decision links (`linkInboxMessage`), evidence (`fileInboxMessageAsEvidence`, also `linked_evidence_document_id`), process (`addInboxMessageToProcess`), delegation (`delegateInboxMessage`, also `delegated_to_user_id`) and noise dismissal (`recordInboxTriage`). The old `convertedNow` derivation is gone.
- **Triage** through `recordTriageConfirmation` (classification, who, when, reason) in `recordInboxTriage`.
- **Implicit classification** by a conversion now writes the triage attribution the first time it sets the classification (`confirmByConversion`); a classification the person recorded is never replaced.
- **Taking a dismissal back**: classifying a dismissed message as anything else clears the stored `dismissed` conversion, so it returns to Needs me (the repository rule has no "undismiss"; the handler states it).
- **`collaboration_messages.kind`**: `delegation` and `reply`. The duplicate-delegation check tests `kind`.
- **Add to process** calls `addStageInput` in the same transaction with `osEventId`; the operation links the audit row afterwards with `linkStageInputRecords`. The duplicate check reads the stage inputs instead of the event key.

Reads (`lineage.ts`, `read-model.ts`, `load.ts`, `src/db/repositories/inbox.ts`):

- **Place** is the stored conversion: Converted to work when `conversion_kind` is a work kind, Handled dismissed when it is `dismissed`. Filed as information and replied stay derived; they are not conversion kinds.
- **Process conversions** are the stage inputs the message is (`getStageInputsFor`, the batched form of `findStageInputsForSource`, and `findStageInputsForSource` in the reply draft). The scan of `process` events is gone.
- **Delegations and replies** are read by `kind`; the delegate is `delegated_to_user_id`.
- **Attribution**: the stored `converted_by_user_id` applies to the first fact of the stored kind, whatever the kind (not only action and decision). The event's scenario moment is still preferred for "when", because the stored time is the machine clock.
- **"Your classification"** reads `triage_confirmed_by_user_id`, `triage_confirmed_at` and `triage_reason`. The unattributed sentence now reads "Recorded on the message, with no record of who recorded it." (EN, DE).

### 2. Home reads `conversion_kind` (`src/features/home/assemble.ts`, `read.ts`, `copy.ts`)

- `needsAttention` (was line 207): a message converted to work of any kind no longer needs attention.
- `conversionStatements` (was line 496): counts every work kind and names the actor from `converted_by_user_id`: "You converted 2 messages into work" for the role holder, "Jonas Keller converted 1 message into work" for one other person, the plain sentence when unknown or mixed (EN and DE). This closes the phrasing the Home handoff noted as missing.

### 3. Message `kind` set by every named writer

- Meetings `distributeMeetingMinutes`: `minutes-distribution`.
- Actions follow-up (`actions/operations.ts`): `follow-up`, passed to `sendSimulatedCollaborationMessage`, which now accepts an optional `kind` from `COLLABORATION_MESSAGE_KINDS` (anything else is `message`).
- `requestFactualValidation`: `validation-request`.

### 4. The process engine reads stage inputs (`src/features/process/`)

- `StageContext.inputs` (`types.ts`), read in `buildStageContext` through `listStageInputs`, with the title and sender of the record each input names (message, minutes or document).
- `StageView.inputs` (`view.ts`) and a small "Attached to this stage" list in `StageWorkspace.tsx`, under the sources, shown only when something is attached (EN, DE).

### 5. RCSA decisions per run

- **New `src/role-apps/rcsa/stages/run-decisions.ts`**: completion hooks on Stages 1, 2, 3, 4 and 6 present a later run's own decision for the stage that opens next, inside the completion transaction:
  - `copyDecisionForRun` when the template's consequences concern nothing the Q4 assessment owns (DEC-2026-0771: an indicator and the process);
  - `createDecisionForRun` with the consequences pointed at the run's assessment (and its line for the same risk) where they name the Q4 assessment or a Q4 line, so a judgment on the reassessment never versions or rates the Q4 record;
  - announced as `decision-requested` with an audit row (`presentRunDecision`); a decision that cannot be presented rolls the completion back.
  - Ids are `DEC-<run without RUN->-S<sequence>`, references are the template's (`RCSA-D1` to `D5`), options `<id>-O01` and so on, open, nothing chosen, `process_run_id` and `process_stage_id` set.
- **Engine binding** (`src/features/process/context.ts`, `bindRunDecisions`): a seeded-decision binding whose decision belongs to another run binds this run's own decision for the stage (same reference, `getDecisionsForStage`). Until it exists the decision is pending with nothing to choose (`view.ts`: no record form), so a stage never completes on another run's judgment.
- **Removed**: the `rcsa.cycle-decisions` entry check (`stages/checks.ts` deleted), its criterion on Stages 2, 3, 4, 5 and 7, `cycleDecisionsApply`, `CYCLE_ASSESSMENT_ID` and `CYCLE_DECISION_IDS`.
- **Stage modules read their bound decision**, not the seeded id: `boundDecisionId` in payloads and stage records (Stages 2, 3, 4, 5, 7); options are read by position (`chosenPosition`), which a copy keeps, instead of the `-O2` suffix (Stages 2, 4, 6).
- **`rcsa.cycle-decisions` source** now lists the run's own decisions (`listDecisionsForProcessRun`) with their stage and the chosen option's position; Stage 6 finds the workshop conclusion by stage and Stage 7 finds duplicates against the run's decisions.
- **Decisions surface link** (`src/scenario/engine/decision-links.ts`, surgical): `findDecisionProcessBinding` reads the decision's stored run and stage first, so a run's own decision links to its stage, and the Q4 decisions stay linked to the Q4 run after the reassessment becomes the active run.

### 6. Appetite position written deterministically (`src/agents/tools/mutations.ts`)

`proposeAndRecordResidualRisk` computes `appetite_position` with `appetitePositionFor(ratingFor(l, i), APPETITE_CEILING)`, the same rule the RCSA matrix (`src/role-apps/rcsa/matrix.ts`) applies, in the same governed write as the residual. It is never read from the payload, so no model can set it.

## Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| Every inbox path writes and reads stored lineage; derived duplicates gone | Met | Integration `work-inbox-operations` asserts conversion kind, attribution, evidence document, delegate, stage input with event and audit link, dismissal and its withdrawal; unit `work-inbox` asserts place by stored kind, stage inputs, kind over channel name, stored triage attribution. `convertedNow`, the process-event scan, channel-name tests and the event-key duplicate check are removed. |
| Home reads `conversion_kind` | Met | Unit `home-read-model` (every work kind, "You" and named actor, EN and DE); integration `home-read-model` ("You converted 1 message into work"). |
| Message `kind` set everywhere | Met | Integration: `delegation`, `reply` (inbox), `minutes-distribution` (meeting-lifecycle), `follow-up` (work-hub-operations), `validation-request` (rcsa-stages Stage 2). |
| Stages show inbox inputs | Met in integration; browser check not run | Integration: `buildStageContext(...).inputs` and `buildStageView(...).inputs` list IMSG-2026-0023. Playwright `os-inbox` now asserts the "Attached to this stage" list on the TPRM and RCSA stages, but was not run (see Tests run). |
| A reassessment run passes Stage 2 with its own decision | Met in integration; browser journey not completed | Integration `rcsa-stages` (safe and offline): own decision open and bound, Stage 2 completes on it, the evidence pack names it, Stage 3 gets its own. The Playwright journey is updated but could not finish (see Tests run). |
| The Q4 run keeps its seeded decisions | Met | Integration asserts DEC-2026-0771's status, chosen option, run and stage are identical before and after the reassessment's Stages 1 and 2. |
| Appetite position written deterministically | Met | Integration `rcsa-stages`: a stale `within` is set on the key risk's lines before Stage 6; after the governed residual write the key line reads `high`, `outside`. |
| Affected suites pass; tsc; check:copy, check-no-emdash, scan:secrets | See Tests | |

## Tests run

All on temporary databases or the isolated stack (`<scratchpad>\os-lineage-followup.db`, migrated through 0008 and seeded; port 3118). Long timeouts, because several workstreams' servers and suites loaded the machine.

| Command | Result |
|---|---|
| `vitest tests/unit/work-inbox.test.ts work-meetings-inbox home-read-model rcsa-stages` | 4 files, 99 passed |
| `vitest tests/unit/process-engine.test.ts inbox-conversion` (with the first run of the above) | passed |
| `vitest tests/integration/work-inbox-operations.test.ts home-read-model.test.ts` | 2 files, 43 passed |
| `vitest tests/integration/rcsa-stages.test.ts` | 9 passed (safe and offline journeys, the reassessment through Stage 2 and into Stage 3) |
| `vitest tests/integration/meeting-lifecycle work-hub-operations process-engine decision-workspace decisions decision-queue-v3 data-model-repositories home-freshness tprm-onboarding-stages` | 9 files, 210 passed (only vitest worker shutdown warnings) |
| `npx tsc --noEmit -p tsconfig.json` | No error in this workstream's files. The remaining errors are in other workstreams' in-progress files: `src/agents/suggestions/generate.ts` (earlier run) and `src/features/routines/tools.ts` (final run). |
| `npm run check:copy`, `node scripts/check-no-emdash.mjs` | passed (percentage warnings are pre-existing seed text) |
| `npm run scan:secrets` | passed (8298 files) |
| Playwright `os-rcsa-stages.spec.ts -g "Stages"` on 3118 | Not completed. The first run hit a timing race in the spec's `decide` helper (it matched the option label before the server action finished); the helper now waits for the recorded state. The second run was broken by a build error in another workstream's in-progress `src/features/partner/context.ts` ("Expected ',', got ':'" at 99:147), which stopped every page of the dev server, and then by the server's two-hour limit. The spec is updated to complete the reassessment's Stage 2 on its own decision; the integration test proves the same path. |
| Playwright `os-inbox.spec.ts` | Not run, for the same reason. The spec now asserts the "Attached to this stage" list on both stages and the stored `kind` and `conversion_kind`; `NFR_SHOTS_DIR` lets a run write its captures elsewhere than os-inbox's folder. |

## Screenshots

`docs/screenshots/os-excellence/os-lineage-followup/`: `before-stage2-reassessment-stops-{1920,1366}-{1..4}.png`, the reassessment's Stage 2 refusing with the Q4-cycle reason (copied from os-rcsa-stages). No after captures: the browser journeys could not complete (see Tests run). Re-run them on a quiet machine with `NFR_CAPTURE_DIR` and `NFR_SHOTS_DIR` set to this folder to capture `stage2-reassessment-own-decision`, `stage2-reassessment-completed` and `after-en-{tprm,rcsa}-stage-inputs`.

## Known limitations

- **A failed link after a raised action.** If `createAction` succeeds and `linkInboxMessage` fails, the action names the message as its source but the message records no conversion, so it stays in Needs me (the operation already reports the failure). Before, the place was derived from the action.
- **The reassessment's later decisions read as the Q4 ones.** The copied question, options and notes are the Q4 cycle's text; only their targets are pointed at the reassessment. Where a consequence names a Q4 line, it is pointed at the line the run's scope reads, which for an off-cycle assessment with no lines of its own is its baseline's, as Stage 6 already does.
- **Binding by reference.** A run's own decision is bound by the template's reference within its run and stage. The two Stage 2 decisions therefore both show `RCSA-D1` on Decisions, with different identifiers.
- **Stored times.** `converted_at` and `triage_confirmed_at` are machine time; the inbox prefers the event's scenario moment where one exists.

## What the user must run

- No schema change and no migration from this workstream (0007 and 0008 are the data-model workstream's).
- The code reads 0008's columns and table: if the shared database has not had them, with the server on port 3000 stopped: `npm run db:migrate`, then `npm run demo:reset`, and restart the server (the tool runtime registers handlers once per process, and the RCSA completion hooks are new).
