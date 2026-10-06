# Handoff: os-tprm-stages, Third-Party Onboarding on the process engine

All eight Third-Party Onboarding stages are executable on the engine (plan section 5.2, with sections 4.9, 9 and 13). Each stage has a full contract, a schema-validated AI preparation from database sources (safe and offline; live is never called), a human task and decision with nothing preselected, governed changes through the authority gate (GRC writes through the outbox with receipts), a stage record, and completion criteria that refuse to pass until met.

Plan references: sections 1, 4.9, 5.2, 9, 13. Audit rows: the TPRM rows and J15 in `docs/handoffs/os-excellence-audit.md`. Builds on `docs/handoffs/os-excellence-os-process-engine.md` (Stage 4 is its reference stage).

Synthetic institution and data. Illustrative regulatory context, not legal advice.

## 1. What changed

### The second onboarding file

The seeded Veridian file (TP-0099, `RUN-TPRM-VERIDIAN-2026`) is at Stage 4 with Stages 1 to 3 completed before the day, so on its own it cannot show Stages 1 to 3 running. `src/db/seed/tprm-onboarding-stages.ts` adds a second file that starts at Stage 1:

- TP-0104 Elbmarsch Dokumentenservice GmbH, request PRQ-2026-0104 (the group correspondence provider replacing TP-0071 for IBS-0009), run `RUN-TPRM-ELBMARSCH-2026`, service SVC-OB-0104-01, draft contract CTR-OB-2026-0104 with five clauses, evidence EVD-OB-0104-01 to -14 (procurement request, questionnaire, certificates, assurance report, a stale BCM test, a payment questionnaire the Stage 3 scope removes, four specialist reviews with one Legal sign-off pending and one Compliance opinion for ARC-CH).
- Two specialist huddles (`MTG-TPRM-OB-0104-HUDDLE`, `MTG-TPRM-OB-0099-HUDDLE`) linked to their run and Stage 5 through the 0005 meeting columns, each with draft minutes.
- Stage 1 is opened through the engine's own `openStage` with the safe mode cache of its preparation, the same way the engine seeds the other current stages.

### The default file and the run switcher (coordinator item 2)

- Without `?run=` the onboarding page opens the engine's active run, the most recently started one. Veridian started on 15.09.2026, Elbmarsch on 08.09.2026 (first intake, returned, resubmitted on 05.10.2026), so the page, Home, the Processes card, the landing page and the role selector all name Veridian, Stage 4 of 8. Working on, or completing, the Elbmarsch file does not move the default, because the rule reads `started_at`, not activity.
- The os-meetings handoff says the page opens Elbmarsch. That was true of an earlier seed of this module. Every isolated database seeded since (os-meetings, os-decisions, os-inbox, os-rcsa-stages, checked read-only) has Veridian first.
- The onboarding pipeline above the stage map is the run switcher. It names the file on screen ("Showing Veridian Document Systems GmbH. Select another supplier to open its file.", German: "Angezeigt: ..."), marks its row `aria-current`, and links every other file with `?run=<processRunId>` in the address. Stage links keep the run (`?run=...&stage=...`).
- `buildProcessPageView` takes `runParam`; a run of another app or role, or an unknown id, falls back to the default rather than showing it.
- I did not change the engine's selection rule. RCSA relies on "newest started run is active" for the reassessment it starts at Stage 8, so a TPRM-specific override would need its own rule in the engine. The test below holds the rule for TPRM.

### Stage-run approvals (coordinator item 1)

My stage code never calls `executeTool`. Every governed change goes through the engine (`approveAndExecuteTools`, `submitStageCompletion`), so `stageToolContextFor` and the `stage-run` targets apply without changes on my side. After the change, a browser journey on my stack recorded 23 approvals, all `target_kind = 'stage-run'`, approved by P-002 under `tprm`.

### Files

Owned, new:
- `src/role-apps/tprm/stages/shared.ts`, `sources.ts`, `request-intake.ts`, `classification.ts`, `tailored-due-diligence.ts`, `specialist-reviews.ts`, `contract-conditions.ts`, `decision-onboarding.ts`, `monitoring-handover.ts`; `index.ts` imports them all.
- `src/role-apps/tprm/pipeline.ts` (the pipeline and run switcher read model).
- `src/features/process/tprm/OnboardingPipeline.tsx` (server component, rendered through the page's header slot).
- `src/db/seed/tprm-onboarding-stages.ts`.
- `tests/unit/tprm-onboarding-stages.test.ts`, `tests/integration/tprm-onboarding-stages.test.ts`, `tests/e2e/os-tprm-stages.spec.ts`.

Owned, edited:
- `src/role-apps/tprm/definition.ts`: all eight contracts, every stage `implemented`. Stage 4's contract is unchanged except one helpful source (`tprm.stage-meetings`).
- `src/role-apps/tprm/stages/evidence-review.ts`: documents removed at Stage 3 drop out of the review; a stale document is a material gap with an accept-with-condition proposal; supplier meetings linked to Stage 4 are read as findings, with their unresolved items as minor gaps; condition actions carry process lineage.

Minimal edits outside my folders (re-read first):
- `src/features/process/view.ts`: `runParam` on `buildProcessPageView` (the selected run, falling back to the active one) and `basePath` carrying `?run=`.
- `src/features/process/ProcessRunPage.tsx`: `runParam` and an optional `renderHeader(processRunId, language)` slot.
- `src/components/workday-v3/ProcessMap.tsx`: stage links append `&stage=` when the base path already has a query.
- `app/workday/[role]/processes/third-party-onboarding/v3.tsx`: reads `run`, renders the pipeline in the header slot.
- `src/db/seed/run.ts`: one import and one call of `seedTprmOnboardingStages` after `seedProcessRuntime`.
- `src/integrations/connectors/simulated/grc.ts`: write capabilities `grc.supplier` and `grc.service` with their receipt statements, so the approval can write the supplier and service records through the outbox.
- Engine tests: `tests/unit/process-engine.test.ts` (implemented stages are a superset; a synthetic stage stands in for "not executable"), `tests/integration/process-engine.test.ts` (cache count at least 3, exact check kept for Stage 4), `tests/e2e/os-process-engine.spec.ts` (after Stage 4, Stage 5 is executable).
- `tsconfig.json`: the two include lines Next added for `.next-os-tprm-stages` are removed again. Other workstreams' lines are left alone.

Not touched: `src/role-apps/rcsa/**`, presentation folders, anything outside the repository. No migration, no schema change.

## 2. The eight stages

Every preparation is validated against the engine's `StagePreparationOutput` schema: evidence ids must come from loaded sources, contradictions cite two or more, no dashes as punctuation, no umlauts in German, no internal terms. Regulatory references are framed by entity through `regulatoryContext` and `withRegulatoryNote` in `shared.ts`: DORA and the EBA guidelines for ARC-DE and ARC-AT only, FINMA for ARC-CH only, "the EU framework is not the one applied to ARC-CH", and every reference carries "Illustrative regulatory context, not legal advice." (German: "Nur illustrativer regulatorischer Kontext, keine Rechtsberatung.").

| # | Stage | AI prepares (from) | The person records | Decision (advance / hold) | Governed changes | Stage record |
|---|---|---|---|---|---|---|
| 1 | Request and Intake | request summary, owner, service, data categories, legal entities, duplicate check (procurement request, third-party register, arrangement profile) | `intake-review`: confirm or correct each fact, business context, duplicate verdict | `intake-proceed`: proceed / return | `register-candidate`: candidate record to the GRC register (outbox `grc.supplier`) | `tprm.intake-record` |
| 2 | Classification and Criticality | outsourcing or ICT classification, criticality, important-service dependency, rationale, regulatory framing per entity | `classification-judgment`: classification, materiality, criticality, review depth | `classification`: four options; must match the recorded judgments | `record-criticality` (local `setSupplierCriticality`) | `tprm.classification-memo` |
| 3 | Tailored Due Diligence | reusable evidence, tailored request, questions removed as irrelevant, missing evidence, rationale | `request-scope`: reuse / request / remove per part, additional questions, blocker | `questionnaire-dispatch`: approve and dispatch / revise | `record-request` (local `createAction`), `dispatch-request` (outbox `grc.action`) | `tprm.evidence-request-list` |
| 4 | Evidence Review | the reference stage, plus Stage 3 withdrawals, staleness and Stage 4 supplier meetings | `evidence-dispositions` | `stage-gate` | `record-conditions`, `register-conditions` | Stage 4 evidence review record |
| 5 | Specialist Reviews | routing, consolidated conditions, the disagreement (approved for all three entities vs processed in Switzerland), pending sign-offs with due dates, the huddle | `specialist-conditions`: agree / challenge per condition, resolve the conflict, carry or chase a pending review, how the huddle counts | `specialist-escalation`: agree / escalate | `escalate-condition` (local `addCommitteeAgendaItem`) on escalate | `tprm.specialist-opinions` |
| 6 | Contract and Conditions | clause comparison, missing rights, subprocessor requirements, conditions, negotiation points | `contract-review`: reflected / negotiate / track / waive per item | `contract-sufficiency`: sufficient / documented trade-off / renegotiate | `record-contract-conditions` (local `createAction`, kind remediation, with lineage), `register-contract-conditions` (outbox `grc.action`) | `tprm.contract-record` |
| 7 | Decision and Onboarding | options, evidence, uncertainty, rationale, target-system list | the decision itself (material) | `onboarding-approval`: approve / approve with conditions / reject / escalate (hold) | approve or conditional: `record-onboarding-assessment`, `register-supplier` (outbox `grc.supplier`), `register-service` (outbox `grc.service`), `start-monitoring`; escalate: `escalate-onboarding`; reject: `notify-rejection` | `tprm.approval-record` |
| 8 | Handover to Monitoring | conditions carried, monitoring, reassessment date, communications, register update | `handover-plan`: owner, first check, reassessment, each remaining condition | `monitoring-intensity`: quarterly / semi-annual / close (close only after a rejection) | `activate-monitoring-plan`, `update-register` (outbox `grc.supplier`), `send-handover-note`; on close `send-closure-note` | `tprm.monitoring-plan` |

Rules the stages enforce, each with a test: no proceed at Stage 1 before the review or on a recorded duplicate; no classification that contradicts the recorded judgments; an unconditional approval is refused while conditions are open; escalation holds the file and puts an item on the committee agenda; draft huddle minutes are refused as a record until confirmed through the os-meetings lifecycle (`confirmMinutes`), then accepted; the first monitoring check must fall within the chosen intensity (92 days for quarterly, 183 for semi-annual).

Meetings: Stage 4 reads supplier meetings linked to it (`processRunId` and `stageId` from 0005), or unlinked meetings on the supplier whose kind the Work Hub maps to the stage. Stage 5 reads the huddle the same way. Confirmed minutes are recognised with `isConfirmedMinutes` from `src/features/work/modules/meetings/lifecycle.ts`.

Actions: condition actions are created by `createAction` through the authority gate, with `source_process_run_id`, `source_stage_id` and `source_stage_run_id` set from the stage (0005 lineage).

Portfolio and Home: the pipeline is the portfolio's onboarding view, counted from rows (stage, open condition actions, monitoring). Completion publishes the engine's events and revalidates the workday, so Home, the Processes card and the pipeline move with the work.

## 3. Acceptance

| Criterion | Status | Evidence |
|---|---|---|
| All eight stages executable | Met | Unit "Stage %i is implemented, with every key it names registered" (8); integration "makes every stage executable"; engine unit "implements all eight Third-Party Onboarding stages" |
| Full journey in safe and in offline mode, with a restart in the middle | Met | Browser on port 3111, fresh seed each time: safe mode, Stages 1 to 4, server restarted, Stages 5 to 8: passed. Offline mode, same split: passed. Integration: offline journey, safe journey, restart through `closeDb` mid-journey |
| Evidence from the database | Met | Every source loader reads rows (suppliers, services, contracts and obligations, evidence documents, meetings and minutes, actions, monitoring); the validator refuses evidence ids not loaded |
| Supplier meetings and specialist reviews integrated | Met | Integration "reads the supplier meeting linked to Stage 4 and the huddle linked to Stage 5", "refuses to rely on draft minutes", "accepts the huddle record once the minutes are confirmed through the meeting lifecycle" |
| Conditions create actions | Met | After the browser journey: 3 actions with `source_process_run_id = RUN-TPRM-ELBMARSCH-2026` (Stages 3, 4, 6); integration "creates the condition actions with their process lineage" |
| Approval creates supplier, service and monitoring records | Met | After the browser journey: TP-0104 `active`; 7 GRC commands (`grc.supplier` x3, `grc.action` x3, `grc.service` x1) all acknowledged, each with a receipt; monitoring activations: onboarding (monthly) and the plan (semi-annual) |
| Payload-bound approval by the role holder | Met | 23 approvals, all `stage-run`, P-002 under `tprm`; every stage completion approved |
| No stage completes without its criteria | Met | Browser: Continue disabled with reasons at every stage until the criteria pass; integration "no stage completes without its criteria" (5 tests) |
| Completion updates the portfolio and Home | Met | Pipeline row "Completed", 3 open conditions, semi-annual after the journey; Home screenshot after the journey; 131 events on the run |
| Default file is Veridian on every surface, with a run switcher | Met | Integration "opens the Veridian file by default on every surface, offers Elbmarsch through the run switcher, and keeps the default while Elbmarsch moves"; Playwright "opens the Veridian file by default and switches files with ?run=" (safe and offline); after the full Elbmarsch journey the page, `/` and `/workday` still say Veridian, Stage 4 of 8 |
| Bilingual, ASCII German | Met | German captures of Stage 5, Stage 2 and the default page; validator refuses umlauts in `.de` |
| Regulatory framing | Met | Unit "the regulatory framing" (4 tests); integration "frames DORA and the EBA guidelines for the EU entities only, FINMA for ARC-CH only" |

## 4. Tests

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean (exit 0) |
| `npx vitest run tests/unit/tprm-onboarding-stages.test.ts` | 37 passed |
| `npx vitest run tests/unit/process-engine.test.ts` | passed (with the file above: 83 passed across the two) |
| `npx vitest run tests/integration/tprm-onboarding-stages.test.ts` | 20 passed (after 0006 and the stage-run approval change) |
| `npm run test:integration` | 24 of 25 files, 497 tests passed. `mutations.test.ts` hit its 30 second hook timeout while four other workstreams were running suites on the same machine; rerun with my two files afterwards: 3 files, 70 passed. The previous full run had my file time out the same way; it now sets its own timeouts |
| `npx vitest run tests/unit` | 35 of 36 files, 1004 passed. `integration-runtime.test.ts` fails its `beforeAll` at the 30 second hook limit, also when run alone; see below |
| `npx playwright test tests/e2e/os-tprm-stages.spec.ts --project=desktop-1920` on 3111 | 3 passed, safe mode (restart between the halves); 3 passed, offline mode (restart between the halves) |
| `npx playwright test tests/e2e/os-process-engine.spec.ts --project=desktop-1920` on 3111 | 2 passed |
| `npm run check:copy` | passed |
| `node scripts/check-no-emdash.mjs` | passed (the percentage notes it lists are in other files) |
| `npm run scan:secrets` | passed |

`integration-runtime.test.ts` (not mine) is the known cross-workstream issue the os-meetings and os-inbox handoffs also record: its `beforeAll` cold-imports the seed graph, which includes the process engine and every stage implementation (the eight TPRM stages among them), and that takes longer than 30 seconds on this machine. It needs a longer hook timeout from its owner; I did not edit it.

## 5. Screenshots

`docs/screenshots/os-excellence/os-tprm-stages/`, each in scrolled segments at 1920x1080 and 1366x768, safe mode, from the final journey on a fresh seed:

- `default-veridian-run-switcher-*`: the default page, Veridian at Stage 4, the switcher naming it.
- `stage1-request-intake-*`, `stage2-classification-*`, `stage3-tailored-due-diligence-*`, `stage4-evidence-review-*`, `stage5-specialist-reviews-*`, `stage6-contract-conditions-*`, `stage7-decision-onboarding-*`, `stage8-handover-monitoring-*`: each stage as the person opens it, preparation completed, Continue disabled with its reasons.
- `completed-file-*`: the Elbmarsch file after Stage 8, the pipeline row completed.
- `home-after-journey-*`: Home after the journey.
- German: `de-stage5-specialist-reviews-*` (open), `de-stage2-classification-*` (completed), `de-default-veridian-run-switcher-*`.
- Before: `docs/screenshots/os-excellence/os-process-engine/next-tprm-stage5-not-executable-1920-1.png` (Stage 5 not executable).

No horizontal overflow at either size (asserted in the capture).

## 6. Known limitations

- **The safe mode cache is keyed per stage, not per run** (`stage-preparation:<processId>:<stageId>`). Only Elbmarsch Stage 1 has a seeded cache; later stages in safe mode are composed from the loaded sources and say so.
- **Some engine copy is English in German**: the engine's fallback notes, and each stage's "Your responsibility" and outcome text, which the contract type carries in English only.
- **Stage decisions are not rows in the decisions table.** Stage 7's approval is a stage decision with governed tools, not `recordDecisionAndExecute`: the seeded-decision binding is per stage, not per run, so it cannot carry two suppliers. The Decisions queue lists the open stage decision of the default run (Veridian) and links to it; the Elbmarsch file's stage decisions are taken in its stage workspace.
- **One consolidated action per stage tool**, not one per condition.
- **The GRC simulator is in memory**, so its external ids restart with the server. Receipts and commands are in the database and survive.
- **Veridian Stages 1 to 3** were completed before the engine existed and show no preparation of their own.
- **German seed text**: evidence bodies and meeting text stay English, as elsewhere in the Work Hub.

## 7. Coordination notes

- **os-process-engine**: the generic edits are `runParam` and `renderHeader` on `ProcessRunPage`/`buildProcessPageView`, and the `&stage=` join in `ProcessMap`. They are optional and inert for RCSA.
- **os-decisions**: no integration through `decide.ts` (see the limitation above). I re-read it after the J20 fix; nothing in my stages depends on it.
- **os-meetings**: please update the line in your handoff that says the TPRM page opens Elbmarsch; it opens Veridian (section 1).
- **Schema needs**: none.

## 8. What the user must run

With the dev server on port 3000 stopped:

```
npm run db:migrate
npm run demo:reset
```

`db:migrate` applies 0005 to 0007 from the other workstreams; this workstream adds no migration. `demo:reset` seeds the Elbmarsch file and the huddles. Then start the server again. The Veridian file stays the default; the Elbmarsch file opens from the onboarding pipeline or at `/workday/tprm/processes/third-party-onboarding?run=RUN-TPRM-ELBMARSCH-2026`.

To rerun the browser journey on an isolated stack (it writes):

```
NFR_BASE_URL=http://localhost:<port> npx playwright test tests/e2e/os-tprm-stages.spec.ts --project=desktop-1920 -g "by default|Stages 1 to 4"
(restart the server)
NFR_BASE_URL=http://localhost:<port> npx playwright test tests/e2e/os-tprm-stages.spec.ts --project=desktop-1920 -g "Stages 5 to 8"
```

Nothing is committed.
