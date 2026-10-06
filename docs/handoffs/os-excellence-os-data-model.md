# OS Product Excellence: os-data-model (migrations 0006, 0007 and 0008)

The schema the AI Partner (Wave 3), Product Owner Console (Wave 4) and design-partner readiness (Wave 5) workstreams need, with typed repositories, an honest seed and tested migrations, so those workstreams can build in parallel without touching the schema. It also includes the small needs other workstreams reported: `decisions.due_at`, inbox conversion attribution, decisions per process run (os-rcsa-stages), and the stored inbox lineage and process stage inputs (os-inbox).

Plan references: sections 4.11, 6, 7.1 to 7.9, 8.3, 8.4, 8.5, 10 (Waves 3 to 5) and 12. Synthetic institution and data. No UI was built.

## 1. Why there are three migrations, not one

The brief asked for one migration, 0006. Two further sets of needs arrived from the coordinator after 0006 was written:

- **0007**, `decisions.process_run_id` and `process_stage_id`, from os-rcsa-stages;
- **0008**, the stored inbox lineage and `process_stage_inputs`, from os-inbox.

By then other workstreams' isolated databases had already applied 0006: `os-inbox.db`, `os-rcsa-stages.db` and `os-tprm-stages.db`. `os-tprm-stages.db` had also applied 0007 before 0008 was needed. Drizzle's migrator never re-runs an applied migration. Adding columns to an applied migration would leave those databases without them. Every read of the table would then fail there, because the Drizzle select names every column, and no migration could repair it. So each later addition is its own migration.

All three were generated with `drizzle-kit generate --name ...` non-interactively, because every change is additive (no drop, so no rename prompt). The data backfills were then appended in the 0004 and 0005 style. A further `drizzle-kit generate` reports "No schema changes, nothing to migrate".

One correction to 0006 after another workstream had applied it: the inbox backfill statement in 0006 was narrowed to action and decision events, after real os-inbox data showed evidence and process events under the same key prefix. The correction touches backfill only, no schema, and 0008 recomputes those columns under the widened definition anyway. Any isolated database that ran the earlier 0006 is therefore made right by 0008.

## 2. The tables

Scope: **run** means the table carries `run_id` and `demo:reset` clears it with the scenario. **product** means it holds no `run_id`: `seedProductState` clears and rewrites it on every seed, as `seedProductConfiguration` already does for the product configuration (plan 8.3: product state is not domain state).

### Wave 3: AI Partner (0006, `src/db/schema/ai-partner.ts`)

| Table | Scope | Serves | Repository |
|---|---|---|---|
| `ai_routine_runs` | run | Home Partner update and dock activity: one routine run with routine, role, trigger, start and completion, status, outcome, a bilingual statement, AI mode, configuration, job and `routine-completed` event. Unique idempotency key: "no duplicate request". | `ai-routine-runs.ts` |
| `ai_routine_run_outputs` | run | Routine lineage: the objects a run created or updated (kind, id), and the reverse lookup "which run prepared this?". | `ai-routine-runs.ts` |
| `ai_suggestion_dispositions` | run | Suggestion lifecycle history: who, when, from, to, the modification, the reason and what it led to. Unique sequence per suggestion. Read by the dock, Role App performance (7.3) and AI quality (7.5). | `suggestion-dispositions.ts` |
| `ai_feedback` | run | Structured feedback (Useful, Not useful, Wrong source, Wrong interpretation, Missing context, Too verbose) on a suggestion, chat turn, stage preparation or routine run. Holds the configuration, prompt version, model profile, sources, role, task kind and stage, and a link to the product feedback item it was forwarded to. Once per person, output and kind. | `ai-feedback.ts` |
| `partner_contexts` | run | The Partner's durable context outside the transcript: role, legal entity, selected object, process run and stage, meeting, action, inbox item, decision, chat thread, source freshness, prior human decisions and user edits (references only). One row per person and role, versioned. | `partner-context.ts` |
| `notifications` | run | The notification budget's ledger: what was raised or held back, when, from which source, read and settled. One per role and thing (the Updates item key). An arrival's read mark stays in os-shell's `workday_live_event_reads` and is joined, not copied. | `notifications.ts` |

### Wave 4: Product Owner Console (0006, `src/db/schema/product-console.ts`)

| Table | Scope | Serves | Repository |
|---|---|---|---|
| `role_app_versions` | product | Role Apps view (7.2): a version's lifecycle state (Draft, Candidate, Pilot, Installed, Available, Demo, Planned, Retired), whether it is current (one per app, partial unique index), the process definition digest, stage list and implemented stages, source requirements, tools, authority, evaluations, connector dependencies, migration tag, release notes (EN, DE) and support state. Definitions stay in code; this holds release state. | `role-app-release.ts` |
| `role_app_lifecycle_events` | product | Role App history: registered, state changed, enabled, disabled, cohort assigned, rolled back, with actor, reason, approval and evaluation. | `role-app-release.ts` |
| `role_app_enablements` | product | Enable and Disable per tenant and per cohort, optionally pinned to a version (how a candidate reaches a pilot cohort). Wave 4 exit criterion: an installed app can be enabled and disabled. | `role-app-release.ts` |
| `product_cohorts` | product | Who a release or pilot applies to (identity user ids, roles, legal entities). Also the Cohort filter in 7.4. Membership is an entitlement, never a measure. | `role-app-release.ts` |
| `ai_evaluation_runs` | product | AI quality (7.5): Run evaluation, coverage, released against candidate. Records the configuration's identifying values at run time, the counts and `mandatory_failed` (no release while it is above zero). | `ai-evaluations.ts` |
| `ai_evaluation_case_results` | product | Inspect failed case and Compare output: per case status, grader results, reason, latency, cost and redacted output. | `ai-evaluations.ts` |
| `ai_configuration_releases` | product | Approve candidate, Reject candidate, Roll back: the decision, the evaluation run it rests on, what it supersedes, and the rollback recorded on the approval it reverses. | `ai-evaluations.ts` |
| `product_feedback` | product | The feedback inbox (7.8): the eight kinds, the person's statement, context, triage (status, severity, owner) and links to feature, Role App, stage and release. Can be forwarded from `ai_feedback`. | `product-feedback.ts` |
| `pilot_programmes` | product | Pilot Setup (7.7): business area, legal entities, cohort (users), roles, Role Apps (processes), source systems, authority and support contacts. | `pilot.ts` |
| `pilot_measures` | product | Baseline and measures (7.7): definition, method, source, target (success criterion) and the baseline with an explicit status. "Not measured" is never stored as zero. | `pilot.ts` |
| `pilot_measure_readings` | product | Weekly view: one reading per measure and week, with status, and no value unless measured. | `pilot.ts` |
| `pilot_issues` | product | Weekly view issues, risks and decisions required. | `pilot.ts` |
| `pilot_exit_decisions` | product | Exit decision (Scale, Extend pilot, Pause, Stop) with evidence, unresolved conditions, control findings, commercial implication as the person states it, and next-wave recommendation. | `pilot.ts` |
| `product_release_events` | product | Releases view (7.9): what happened to a release (candidate declared, gate run recorded, evidence pack generated, pilot release approved, deployed, rollout updated, rolled back), with the evidence pack reference, rollout status and rollback plan. Only the version is stored; the identity stays in `src/product/release/`. | `release-management.ts` |
| `release_gate_runs` | product | Run release gate: the results per gate and mandatory counts computed from them. | `release-management.ts` |
| `integration_incidents` | run | Integrations and Operations: an outage's impact (roles, process runs, affected people as a count only), failed commands, dead letters, recovery and the release it bears on. Connector health and dead letters do not record an incident's life (plan 6.2). | `integration-operations.ts` |
| `data_quality_issues` | run | Mapping issues and Resolve mapping (7.6), the data-quality workflow (plan 11). Detection already exists (rejected events, conflicted references); the review and resolution, linked to the mapping change, did not. | `integration-operations.ts` |
| `experience_events` | run | Experience analytics (7.4), for the four interactions the backbone does not record: workday opened (the start of time to first meaningful action), Now item opened, evidence opened, meeting preparation reviewed. No user column at all; aggregates only. | `experience-events.ts` |

The other seven 7.4 measures are read from `os_events`: minutes confirmed, message converted, action completed, decision completed, stage completed. Message converted also has `inbox_messages.conversion_kind` and `converted_at`.

### Wave 5: personalisation (0006, `src/db/schema/personalisation.ts`)

| Table | Scope | Serves | Repository |
|---|---|---|---|
| `user_preferences` | run | Language, theme, default Work tab (one of the Work Hub's tabs) and notification preference (`standard` or `quiet`). Null means "follow the product". | `personalisation.ts` |
| `saved_views` | run | A named filter on Work, Processes or Decisions, one default per surface. | `personalisation.ts` |
| `user_object_lists` | run | Pinned and recent objects for the command palette (os-shell's server option for its local storage), and the watchlist. Kind and id only. | `personalisation.ts` |

Personalisation never hides mandatory work or controls. `quiet` can hold back only `routine-created-work` (`QUIETABLE_NOTIFICATION_CATEGORIES`). Every other category is in `MANDATORY_NOTIFICATION_CATEGORIES`, and a unit test keeps the two lists a partition of the categories, so a new category is mandatory by default. A saved view narrows a list; it never applies to Now, the Decisions open count, header counts or Updates.

### 0008: process stage inputs (`src/db/schema/process-inputs.ts`)

| Table | Scope | Serves | Repository |
|---|---|---|---|
| `process_stage_inputs` | run | A record attached to a stage as input: an inbox message, confirmed minutes or a document. Holds the run, stage, stage run, who, when, note, backbone event and audit row. One per stage and source. Until 0008, "Add to process" announced the message to the stage and stored nothing the stage could read. | `process-stage-inputs.ts` |

### Columns added to existing tables

| Table | Columns | Migration | Meaning |
|---|---|---|---|
| `decisions` | `due_at` | 0006 | By when the judgment is needed, as the decision's own text states it. Read by `deadlineFor` (Decisions) and the Home Now card. |
| `decisions` | `process_run_id`, `process_stage_id`, index `dec_process_idx` | 0007 | The process run and stage a decision belongs to, so a second run can have judgments of its own. |
| `ai_suggestions` | `disposition` (NOT NULL, default `new`), `disposition_at`, `disposition_by_user_id` | 0006 | The current lifecycle disposition (New, Reviewed, Accepted, Modified, Rejected, Executed, Expired). Kept apart from `status`, which is the preparation pipeline. |
| `inbox_messages` | `converted_by_user_id`, `converted_at` | 0006 | Who turned the message into what, and when. Definition widened in 0008. |
| `inbox_messages` | `conversion_kind` | 0008 | action, decision, evidence, process, delegated or dismissed. The first conversion to work is kept; a dismissal only while there is none; work replaces a dismissal. |
| `inbox_messages` | `triage_confirmed_by_user_id`, `triage_confirmed_at`, `triage_reason` | 0008 | Who confirmed the standing classification, when and why. |
| `inbox_messages` | `linked_evidence_document_id`, `delegated_to_user_id` | 0008 | The evidence document the message became, and the colleague it was delegated to. |
| `collaboration_messages` | `kind` (NOT NULL, default `message`) | 0008 | message, delegation, reply, minutes-distribution, validation-request, follow-up. The channel name stays the label. |

## 3. The seed

`src/db/seed/product-state.ts` (`seedProductState`, called from `seedScenario` beside the product configuration):

- **One current version per Role App in `ROLE_APP_REGISTRY`**: seven rows.
  - The two installed apps are Installed (support `maintained`).
  - The five preview apps are Demo (prototype) or Planned (concept). This follows the registry's own words, "demo or concept status".
  - Every manifest field is derived from the definitions at seed time: the digest, stages, implemented stages (8 of 8 for both installed apps in this build), sources, tools, authority, evaluation suites and connectors. Nothing is typed by hand.
  - A unit test holds the rows equal to the registry and to `INSTALLED_ROLE_APPS` and `PREVIEW_ROLE_APPS`.
- **One `registered` history entry per version**, actor `seed`.
- **Tenant enablement** of the two installed apps for `org-arcadia-banking-group`.
- **One design-partner pilot, `PILOT-DP-2026-01`, in setup.**
  - It covers Arcadia Bank AG (ARC-DE), the two Available roles and the two installed apps.
  - Its source systems are the connector instances those apps' stages actually use, derived: `CI-DMS-SIM`, `CI-GRC-SIM`, `CI-PI-SIM`.
  - Its authority is the restricted "two function pilot, no autonomous execution" profile, at most `act-with-approval`.
  - Its support contacts come from the brand profiles. No window is agreed.
  - Its cohort `COHORT-DP-2026-01` holds the two pilot accounts from `src/identity/pilot-config.ts`.
- **The plan's six baseline measures** (preparation time, cycle time, handoffs, systems opened, overdue actions, evidence completeness), each `not-measured`, with no value and no target. "Systems opened" is recorded by the pilot lead, never tracked.
- **Decision due times**, `decisions.due_at`, only where the decision's own text names the time:

  | Decision | Due | Basis in its own record |
  |---|---|---|
  | DEC-2026-0745 | 06.10.2026 10:30 | The workshop sequencing is needed when the workshop opens (MTG-2026-0005 at 10:30). |
  | DEC-2026-0772 | 06.10.2026 12:00 | "The workshop closes in fifteen minutes", asked at 11:45. |
  | DEC-2026-0782 | 08.10.2026 12:00 | "Before the committee paper"; the papers close 08.10.2026 at 12:00. |

  Every other decision stays null; no time is invented.
- **Decision links** (0007): `src/db/seed/decision-process-links.ts` links the five decisions the RCSA stage contract binds to `RUN-RCSA-PAYOPS-Q4-2026`, derived from the contracts:

  | Decision | Stage |
  |---|---|
  | DEC-2026-0771 | evidence-refresh |
  | DEC-2026-0744 | risk-control-change |
  | DEC-2026-0745 | first-line-input |
  | DEC-2026-0772 | challenge-workshop |
  | DEC-2026-0782 | actions-approval |

  No TPRM stage binds a seeded decision; TPRM stage decisions live on the stage, so there is nothing to link.

Deliberately **not** seeded: feedback, evaluation runs, release approvals, gate runs, release events, readings, issues, exit decisions, routine runs, dispositions, notifications, contexts, analytics, preferences, incidents, data quality issues and stage inputs. Every suggestion is `new`. Empty tables give honest empty states.

**`demo:reset`** restores all of it: the run tables are in `RUN_SCOPED_TABLES`, and the product tables are cleared and rewritten by `seedProductState`. This follows the existing product configuration precedent.

## 4. The repository API

All in `src/db/repositories/`. All are synchronous (better-sqlite3), take caller-supplied ids like the rest of the product, and default `runId` to the active scenario run. Feature rules (who may do what, which transition is allowed) stay with the feature workstreams. A repository keeps only the record's own guarantees: once-only keys, atomic writes, merges, and counts derived from the rows they summarise.

**`ai-routine-runs.ts`**
- `startRoutineRun(run) -> { run, created }`: once per idempotency key.
- `updateRoutineRun(id, patch)`
- `recordRoutineRunOutputs(routineRunId, outputs) -> written`: an output already recorded is kept.
- `completeRoutineRun(id, { status, outcome, summary, summaryDe, completedAt, osEventId?, errorRedacted? }, outputs?)`: the run and its outputs in one transaction.
- Reads: `getRoutineRun`, `findRoutineRunByKey`, `listRoutineRuns({ roleId?, routineId?, statuses?, startedFrom?, limit? })` (newest first), `getRoutineRunOutputs`, `getOutputsForRoutineRuns(ids) -> Map`, `findRoutineRunsForObject(kind, id)`.

**`suggestion-dispositions.ts`**
- `recordSuggestionDisposition({ id, suggestionId, to, actorKind, actorUserId, at, atMoment, modification?, reason?, resultKind?, resultId? })`. Writes the history row and the suggestion's columns in one transaction. Returns `unknown-suggestion`, or `unchanged` for a repeat of the current disposition with no modification.
- `getSuggestionDispositionHistory(suggestionId)`
- `countSuggestionDispositions({ roleId?, createdFrom? })`: every disposition present.

**`ai-feedback.ts`**
- `recordAIFeedback(row) -> { feedback, created }`: once per person, output and kind.
- `removeAIFeedback(id, userId)`: only the person's own.
- `getAIFeedbackForTarget(kind, id)`
- `listAIFeedback({ roleId?, kinds?, configurationId?, forwarded?, limit? })`
- `linkAIFeedbackToProductFeedback(id, productFeedbackId)`
- `countAIFeedbackByKind({ roleId?, configurationId? })`

**`partner-context.ts`**
- `getPartnerContext(userId, roleId)`
- `savePartnerContext({ userId, roleId, fields, updatedAt, updatedAtMoment })`: merges (omitted keeps, null clears), raises `version`.
- `clearPartnerContext(userId, roleId)`

**`notifications.ts`**
- `recordNotification(row) -> { notification, created }`: once per role and dedupe key.
- `findNotification(roleId, dedupeKey)`
- `listNotifications({ roleId, raisedFrom?, budgetOutcome?, openOnly? }) -> NotificationView[]`: `readAt` and `read` resolved from `workday_live_event_reads` for arrivals.
- `markNotificationRead(id, userId, at)`: refused for an arrival, whose mark is os-shell's.
- `settleNotification(id, at, eventId)`: once.
- `countRaisedByCategory(roleId, raisedFrom)`

**`role-app-release.ts`**
- Versions: `getRoleAppVersion`, `listRoleAppVersions(roleAppId?)`, `getCurrentRoleAppVersion(roleAppId)`, `listCurrentRoleAppVersions()`.
- `createRoleAppVersion(version, actor)`: never current; writes a `registered` entry.
- `changeRoleAppVersionState(versionId, { toState, makeCurrent?, releasedAt?, kind? }, actor)`: the current version moves atomically, with a `state-changed` or `rolled-back` entry.
- History: `appendRoleAppLifecycleEvent(event) -> id` (the id is the app's next history position), `listRoleAppLifecycleEvents(roleAppId?)`.
- Enablement: `getRoleAppEnablement(appId, scopeKind, scopeId)`, `listRoleAppEnablements(appId?)`.
- `setRoleAppEnablement({ roleAppId, scopeKind, scopeId, enabled, versionId? }, actor) -> changed`: with an `enabled`, `disabled` or `cohort-assigned` entry; a repeat writes nothing.
- Cohorts: `getCohort`, `listCohorts`, `listCohortsForUser(userId)`, `saveCohort(row)`.
- `ReleaseActor = { actorKind, actorUserId, actorLabel, at, reason?, approvalId?, evaluationRunId? }`

**`ai-evaluations.ts`**
- Runs: `createEvaluationRun`, `updateEvaluationRun`, `getEvaluationRun`, `listEvaluationRuns({ configurationId?, roleId?, taskKind?, statuses?, limit? })`, `getLatestCompletedEvaluationRun(configurationId)`.
- `recordEvaluationCaseResults(runId, results)`: a re-graded case replaces its row.
- `completeEvaluationRun(id, { status, completedAt, errorRedacted?, resultsPath? })`: counts and `mandatoryFailed` recomputed from the stored cases.
- Cases: `getEvaluationCaseResults(runId, status?)` (failed first), `getCaseResultsAcrossRuns(caseId, runIds)`.
- Releases: `recordConfigurationRelease(row)`, `recordConfigurationRollback(releaseId, { at, byLabel, reason, restoredConfigurationId })` (once, approvals only), `listConfigurationReleases({ roleId?, taskKind? })`, `getApprovedConfigurationInForce(roleId, taskKind)` (undefined means the code registry's released entry is in force).

**`product-feedback.ts`**
- `submitProductFeedback(row)`, `getProductFeedback(id)`
- `triageProductFeedback(id, triage)`: only triage fields.
- `listProductFeedback({ statuses?, kinds?, severities?, roleAppId?, stageId?, releaseVersion?, limit? })`
- `countProductFeedbackByStatus()`

**`pilot.ts`**
- Programmes: `getPilotProgramme`, `listPilotProgrammes`, `createPilotProgramme`, `updatePilotProgramme(id, patch & { updatedAt })`.
- Measures: `listPilotMeasures(pilotId)`, `getPilotMeasure`, `savePilotMeasure(row)` (keeps the baseline).
- `recordPilotBaseline(measureId, { status: "measured", value, period, ... } | { status: "not-measured" | "unavailable", ... })`: a non-measured status clears the value.
- `setPilotMeasureTarget(measureId, target | null)`
- Readings: `recordPilotMeasureReading(row)` (one per measure and week, no value unless measured), `listPilotMeasureReadings(pilotId, { measureId?, fromWeek?, toWeek? })`.
- Issues: `raisePilotIssue`, `updatePilotIssue`, `listPilotIssues(pilotId, { kind?, status? })`.
- Exit decisions: `recordPilotExitDecision`, `listPilotExitDecisions`, `getLatestPilotExitDecision`.

**`release-management.ts`**
- `recordReleaseEvent(row)`, `listReleaseEvents(version?)`
- `getDeployedRelease() -> { releaseVersion, deployedAt, rolloutStatus } | null`: null when nothing has been deployed.
- Gate runs: `startReleaseGateRun(row)`, `completeReleaseGateRun(id, { status, results, completedAt, summary? })` (mandatory counts from the results; a mandatory gate not run counts as failed), `getReleaseGateRun`, `listReleaseGateRuns(version?)`, `getLatestReleaseGateRun(version)`.

**`integration-operations.ts`**
- Incidents: `openIntegrationIncident`, `getIntegrationIncident`, `updateIntegrationIncident`, `listIntegrationIncidents({ statuses?, connectorInstanceId? })`.
- Data quality: `recordDataQualityIssue`, `getDataQualityIssue`, `updateDataQualityIssue`, `listDataQualityIssues({ statuses?, kinds?, connectorInstanceId? })`.

**`experience-events.ts`**
- `recordExperienceEvent(row) -> { created }`: once per idempotency key.
- `aggregateExperienceEvents(filter, groupBy)`: filters on kinds, role, legal entity, process, cohort, mode, from and to; groups by kind, roleId, legalEntityId, processId, cohortId, mode or week (the Monday). There is no per-person read.

**`personalisation.ts`**
- `getUserPreferences(userId)`, `saveUserPreferences(userId, patch, updatedAt)`: merge; null returns to the default.
- `listSavedViews(userId, roleId, surface?)`, `saveSavedView(row)` (by name; a new default clears the old), `deleteSavedView(id, userId)`.
- `listObjectList({ userId, roleId, list })`, `addToObjectList(entry)` (touches an existing entry), `removeFromObjectList(key)`, `trimObjectList(key, keep)`.

**`process-decisions.ts`** (0007)
- `createDecisionForRun({ decision, options, processRunId, processStageId })`. Writes an open decision and its options through the same insert shape the seed uses. Refused for an unknown run, another role's run, fewer than two options, a repeated option id, or an id that already belongs to another run or stage. A repeat returns the existing decision.
- `copyDecisionForRun(templateId, { id, reference, processRunId, processStageId, presentedAtMoment?, relatedObjectKind?, relatedObjectId?, dueAt? })`. Copies the question, evidence, uncertainty and options with consequences; never the recorded state. Option ids are `<id>-O01` and so on.
- `listDecisionsForProcessRun(runId)`, `getDecisionsForStage(runId, stageId)`

The caller's governed path still publishes `decision-requested` and writes the audit row.

**`process-stage-inputs.ts`** (0008)
- `addStageInput({ processRunId, stageId, stageRunId?, sourceKind, sourceId, addedByUserId, addedAt, addedAtMoment, note?, osEventId?, auditEventId? }) -> { input, created }`: once per stage and source.
- `linkStageInputRecords(id, { osEventId?, auditEventId? })`: once each.
- `listStageInputs(processRunId, stageId?)`, `findStageInputsForSource(kind, id)`

**`inbox-conversion.ts`** (0008)
- `conversionPatch(current, { kind, byUserId, at })`: pure; the rule.
- `recordInboxConversion(messageId, conversion) -> { changed } | undefined`
- `recordTriageConfirmation(messageId, { classification, byUserId, at, reason })`: the classification and its attribution in one write.

## 5. Backfill rules

**0006**
- `decisions.due_at`: the three decisions above, matched on id and reference in `run-001`.
- `inbox_messages.converted_*`: from the first `inbox-converted:<message>:action:` or `:decision:` event. Superseded by 0008's wider rule.
- `ai_suggestions.disposition`: `new` (column default), with no history.

**0007**
- The five Q4 decisions are linked to `RUN-RCSA-PAYOPS-Q4-2026`, only where that run exists. A test holds this fixed list equal to the links the seed derives from the contracts.

**0008**, from the Inbox's own derivation (`inbox/lineage.ts`, `inbox/tools.ts`), in this order:
1. `collaboration_messages.kind` from the channel each writer uses: "Inbox delegation" and "Inbox reply" (on an inbox message), "Meeting minutes", "Factual validation", "Action follow-up". Anything else is `message`.
2. `linked_evidence_document_id`: the first evidence document with `source_message_id` set to the message.
3. `delegated_to_user_id`: the first recipient of the message's first delegation.
4. `conversion_kind`, `converted_by_user_id` and `converted_at`:
   - from the first `inbox-converted:<message>:<kind>:` event of a work kind (by sequence);
   - else the kind alone, from a link that no event records;
   - else `dismissed` while `confirmed_triage` is noise, attributed to the latest noise triage event if there is one.
5. Triage attribution:
   - from the latest `inbox-triage:<message>:` event whose `to` is the standing classification;
   - else from the first conversion to work, which is what confirmed it.
6. `process_stage_inputs`: one row per inbox `process` event, with stage run, actor, time, event id and audit id.

Verified on a copy of the finished os-inbox database, which holds real conversions of every kind. The stored values reproduce the Inbox's derived lineage for all ten touched messages, and both "Add to process" events became stage inputs with their audit links.

## 6. For the feature workstreams

**AI Partner (Wave 3)**
- Publish `routine-completed` after `completeRoutineRun`, store its id on the run, and put `createdCount` in the payload. os-shell's Updates already reads that key.
- Write dispositions only through `recordSuggestionDisposition`.
- `persistSuggestion` in `src/agents/suggestions/generate.ts` deletes and reinserts a suggestion row by id. That resets `disposition` to `new` on regeneration. Carry the disposition across, or do not reuse the id; the history table keeps what happened either way.

**Product Owner Console (Wave 4)**
- The installed app's lifecycle state is its current version's state.
- Make enable, disable, approve and roll back governed actions (payload-bound approval where material), and pass `approvalId` in `ReleaseActor`.
- "No release while mandatory evaluation fails" reads `ai_evaluation_runs.mandatory_failed`; "no release while mandatory gates fail" reads `release_gate_runs.mandatory_failed`.

**os-decisions**
- `deadlineFor` in `src/features/decisions/queue.ts` and the Home Now card can now read `decisions.due_at` first and fall back to the inbox rule.

**os-rcsa-stages**
- A reassessment run can call `copyDecisionForRun("DEC-2026-0771", { id, reference, processRunId, processStageId: "evidence-refresh" })` when the stage opens, inside its governed path. It can then bind by `getDecisionsForStage(runId, stageId)` instead of the seeded id. The entry check `rcsa.cycle-decisions` can then let the run past Stage 2.

**os-inbox: the code paths that should switch from derived values to stored ones**

In `src/features/work/modules/inbox/tools.ts`:
1. `convertedNow` (used by `linkInboxMessage` for action and decision): replace with `recordInboxConversion` and the right kind.
2. Call `recordInboxConversion` from:
   - `fileInboxMessageAsEvidence` (`evidence`, and set `linkedEvidenceDocumentId`);
   - `addInboxMessageToProcess` (`process`);
   - `delegateInboxMessage` (`delegated`, and set `delegatedToUserId`);
   - `recordInboxTriage` when the classification is `noise` (`dismissed`).
3. `recordInboxTriage`: write the classification with `recordTriageConfirmation` (by, at, reason).
4. The handlers that confirm the classification implicitly (`confirmedTriage: row.confirmedTriage ?? "action"` and the evidence, process and delegate equivalents) should write the triage attribution when they set it for the first time.
5. `delegateInboxMessage` and `sendInboxReply`: insert the collaboration message with `kind: "delegation"` or `kind: "reply"`. The duplicate-delegation check (`channelName === DELEGATION_CHANNEL`) should test `kind`.
6. `addInboxMessageToProcess`: call `addStageInput` in the same transaction, with `osEventId` set to the published event. `linkStageInputRecords` can add the audit id after `executeTool` writes it. The process engine should then read `listStageInputs` as a stage source through its public API (process engine owner).

In `src/features/work/modules/inbox/lineage.ts` (`deriveLineage`):
7. Delegations and replies: test `sent.kind` instead of `channelName`; take the delegate from `delegatedToUserId`.
8. Process conversions: read `findStageInputsForSource("message", id)` instead of scanning `process` events.
9. Place and closure: Converted is `conversionKind` in `INBOX_WORK_CONVERSION_KINDS`; Handled dismissed is `conversionKind === "dismissed"`. "Filed as information" and "replied" stay derived; they are not conversion kinds.
10. `rowBy` and `rowAt`: apply to every conversion kind, not only action and decision.

Elsewhere:
11. `src/features/home/assemble.ts` lines 207 and 496 test `linkedActionId || linkedDecisionId`. These should read `conversionKind` (work kinds) and can name the actor from `convertedByUserId`. The Home handoff noted that phrasing as missing.
12. Other collaboration writers, until they set `kind`, record `message` on new rows (existing rows were backfilled):
    - Meetings `distributeMeetingMinutes` (`meetings/tools.ts`, should be `minutes-distribution`);
    - Actions follow-up (`actions/operations.ts`, `follow-up`);
    - `requestFactualValidation` (`src/agents/tools/mutations.ts`, `validation-request`).

**Flag, not fixed:** `proposeAndRecordResidualRisk` in `src/agents/tools/mutations.ts` writes the residual likelihood, impact, rating and commentary but not `assessment_lines.appetite_position`. After Stage 6 a line can carry a stale appetite position. This is a tool fix, not a schema change. It needs the appetite rule, so it is not trivial, and the handler belongs to the decisions domain.

## 7. Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| One migration, 0006, tested | Met, with 0007 and 0008 added | `tests/integration/migration-0006.test.ts` (6 tests) migrates 0000 to 0005, writes legacy rows for each rule, applies the rest and checks every backfill, the indexes and a no-op second migrate. 0007 and 0008 each have their own test (section 9). Why they are separate is in section 1. |
| Tested from 0005 with seeded data, fresh migrate, seed and reset | Met | A copy of the seeded `os-meetings.db` (0005) was migrated, failed the product-state checks as expected before reset, then passed `scripts/test-migration.ts` 24 of 24 after `demo:reset`; `verify:seed` passed. `<scratchpad>\os-data-model.db`: fresh migrate, `db:seed`, `demo:reset` and `test-migration` all passed, before and after 0007. A copy of `os-inbox.db` (0006, real conversions) was upgraded through 0008 and inspected (section 5). |
| Every table has a docblock naming the screen or behaviour it serves | Met | Each `sqliteTable` in `ai-partner.ts`, `product-console.ts`, `personalisation.ts` and `process-inputs.ts`, and each added column in `decisions.ts`, `live.ts` and `work.ts`. |
| Repositories have tests | Met | `tests/integration/data-model-repositories.test.ts` covers all 16 repositories; `tests/unit/inbox-conversion.test.ts` covers the conversion rule. |
| The seed is honest | Met | `tests/unit/product-state-seed.test.ts` (registry equality, unmeasured baselines, ASCII copy) and `tests/integration/data-model-seed.test.ts` (empty tables, three due times, five links, no inbox lineage, reset restores everything). |
| drizzle-kit reports no remaining difference | Met | "No schema changes, nothing to migrate" after 0006, 0007 and 0008. |
| `npm run test:integration` and the unit suite pass | Met | Integration 27 files, 526 passed; unit 38 files, 1032 passed, both with long timeouts on a loaded machine (section 9). |
| tsc clean | Met | `npx tsc --noEmit -p tsconfig.json` exits 0. |
| check:copy and scan:secrets pass | Met | `npm run check:copy` passed. `node scripts/check-no-emdash.mjs` passed (its percentage warnings are pre-existing seed text). `npm run scan:secrets` passed (8166 files). |
| Database docs updated if present | Not applicable | There is no `docs/DATA_MODEL.md` or equivalent. This handoff is the table reference. |

## 8. Screenshots

None. This workstream built no UI, so there is nothing to capture.

## 9. Tests run

| Command | Result |
|---|---|
| `npx vitest run tests/integration/migration-0005.test.ts tests/integration/migration-0006.test.ts tests/integration/migration-0007.test.ts` | 3 files, 17 passed |
| `npx vitest run tests/integration/migration-0008.test.ts` | 5 passed |
| `npx vitest run tests/integration/migration-0006.test.ts tests/integration/data-model-repositories.test.ts` (final, every repository including 0007 and 0008) | 2 files, 36 passed |
| `npx vitest run tests/integration/data-model-seed.test.ts tests/unit/product-state-seed.test.ts` | 19 passed |
| `npx vitest run tests/unit/work-inbox.test.ts tests/unit/inbox-conversion.test.ts tests/unit/product-state-seed.test.ts` | 3 files, 48 passed |
| All nine data-model and inbox files together, before the fix below | 107 tests, 105 passed, 2 failed in `migration-0006.test.ts`. That test applied every migration in the repository, so 0008's wider conversion rule overwrote the 0006-only expectations. It now applies 0000 to 0006 only and passes. |
| `npx vitest run tests/unit --hookTimeout=600000 --testTimeout=600000` (full unit suite) | 38 files, 1032 passed |
| `npx vitest run tests/integration --hookTimeout=900000 --testTimeout=900000` (the `test:integration` suite) | 27 files, 526 passed, 851 s. Long timeouts were used because several other workstreams' servers and suites were running on the machine. Vitest logged one "timeout terminating forks worker" for `work-hub-operations.test.ts` after its tests had passed; that is the worker's shutdown, not a test failure. |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `drizzle-kit generate` after each migration | no schema changes |
| `npx tsx scripts/test-migration.ts` on the upgraded 0005 copy after reset | 24 passed, 0 failed (at 0007) |
| `npx tsx scripts/verify-seed-depth.ts` on the same database | every check passed |
| `npx tsx scripts/test-migration.ts` on `os-data-model.db` at 0008 after `demo:reset` | 25 passed, 0 failed |
| `npm run check:copy`, `node scripts/check-no-emdash.mjs`, `npm run scan:secrets` | passed |

## 10. Known limitations

- **`demo:reset` clears product-owner records.** Evaluation runs, gate runs, release events, feedback and pilot readings are cleared by a reset, as the product configuration already is.
  - A pilot installation must not run `demo:reset`; Wave 5 makes reset unavailable to analysts.
  - If evaluation and gate evidence should survive a demonstration reset, remove `aiEvaluationRuns`, `aiEvaluationCaseResults` and `releaseGateRuns` from `PRODUCT_STATE_TABLES` in `src/db/seed/product-state.ts`. That is a one-line decision for the release owner.
- **The manifest describes the build that seeded it.** The seeded release state is derived when the seed runs. When a stage workstream implements a further stage, the next seed records it; an existing database keeps its versions until reset.
- **The seeded due times are the RCSA ones.** Decisions of the Demo and Planned roles are not dated, even where their text names a time, because those roles are gated and no surface reads them.
- **Other workstreams' isolated databases at 0006 or 0007 need `npm run db:migrate`.** Until then, every read of `decisions`, `inbox_messages`, `collaboration_messages` and `ai_suggestions` fails there, because the schema now names the new columns. `os-tprm-stages.db` is at 0007 and needs 0008; `os-inbox.db` and `os-rcsa-stages.db` are at 0006.
- **New collaboration rows default to `message`** until their writers set `kind` (section 6, item 12).
- **No repository writes inbox columns 2 to 4 for the handlers.** os-inbox sets `linkedEvidenceDocumentId` and `delegatedToUserId` in its own `updateMessage`. Only the conversion and triage rules have writers here, because they are rules.
- **The full suites ran on a heavily loaded machine.** The machine ran several workstreams' servers and suites at once; long timeouts were used (section 9).

## 11. What the user must run

Against the shared database, with the dev server on port 3000 stopped:

```text
npm run db:migrate
npm run demo:reset
```

Then start the dev server again.

- **The migrate** applies 0006, 0007 and 0008. The code reads the new columns of `decisions`, `inbox_messages`, `collaboration_messages` and `ai_suggestions`, so every page that reads them fails until it runs: Home, Work, Decisions, Updates and the Partner dock.
- **The reset** writes the product state: the Role App versions and enablement, the pilot in setup and its measures. The migration's backfills make an existing database consistent, but only the seed writes product state.

Isolated databases of other workstreams need the same `db:migrate` (section 10).

## 12. Files

**New**
- Schema:
  - `src/db/schema/ai-partner.ts`, `product-console.ts`, `personalisation.ts`, `process-inputs.ts`
- Migrations:
  - `src/db/migrations/0006_data_model.sql`, `0007_decision_process_run.sql`, `0008_inbox_lineage_and_stage_inputs.sql`
  - `meta/0006_snapshot.json`, `0007_snapshot.json`, `0008_snapshot.json`, and the journal entries
- Seeds:
  - `src/db/seed/product-state.ts`, `src/db/seed/decision-process-links.ts`
- Repositories (`src/db/repositories/`):
  - `ai-routine-runs.ts`, `suggestion-dispositions.ts`, `ai-feedback.ts`, `partner-context.ts`, `notifications.ts`
  - `role-app-release.ts`, `ai-evaluations.ts`, `product-feedback.ts`, `pilot.ts`, `release-management.ts`, `integration-operations.ts`, `experience-events.ts`
  - `personalisation.ts`, `process-decisions.ts`, `process-stage-inputs.ts`, `inbox-conversion.ts`
- Tests:
  - `tests/integration/migration-0006.test.ts`, `migration-0007.test.ts`, `migration-0008.test.ts`
  - `tests/integration/data-model-repositories.test.ts`, `data-model-seed.test.ts`
  - `tests/unit/product-state-seed.test.ts`, `tests/unit/inbox-conversion.test.ts`
- `docs/handoffs/os-excellence-os-data-model.md`

**Changed (surgical)**
- `src/db/schema/index.ts`: four export lines.
- `src/db/schema/decisions.ts`: `due_at`, `process_run_id`, `process_stage_id` and the index.
- `src/db/schema/live.ts`: `SUGGESTION_DISPOSITIONS` and the three disposition columns.
- `src/db/schema/work.ts`: the inbox columns, `INBOX_CONVERSION_KINDS`, `collaboration_messages.kind` and `COLLABORATION_MESSAGE_KINDS`.
- `src/db/seed/run.ts`: the new run-scoped tables in `RUN_SCOPED_TABLES`, `seedProductState`, `seedDecisionProcessLinks`.
- `src/scenario/data/decisions.ts`: `dueAt` on DEC-2026-0745, 0772 and 0782, each with its basis.
- `scripts/test-migration.ts`: the 0006 to 0008 tables and columns, the product-state checks, and one console message that used a double hyphen as punctuation.
- `tests/unit/support/work-fixtures.ts`: the new inbox columns in `inboxRow`.
- `tests/unit/work-inbox.test.ts`: `kind` on the outbound fixture.

Nothing was written to `data/nfr-workos.db` and nothing was clicked on port 3000. No dev server was started. Scratch databases: `<scratchpad>\os-data-model.db`, `os-data-model-upgrade.db` (from the seeded 0005 `os-meetings.db`) and `os-data-model-inbox.db` (from `os-inbox.db`). The source databases were only read and copied.
