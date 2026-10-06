# OS Excellence: os-meetings handoff (Wave 1, meetings and minutes)

Plan sections 4.6 (Meetings and minutes), 4.7 (the Actions columns it needs) and 8.1 (the event backbone). Audit rows J10, T11 and T20. Synthetic institution and data.

Two parts:

1. **Migration 0005, work-object lineage.** It closes the Work Hub's seven reported schema gaps and adds the lineage the next workstreams need.
2. **The meeting lifecycle.** Before, during and after the meeting, built as the Meetings module on the Work Hub's `WorkModule` interface. The shell is unchanged.

## 1. Migration 0005: the column list

File: `src/db/migrations/0005_work_lineage.sql`, with snapshot `meta/0005_snapshot.json` and journal entry `0005_work_lineage`.

It was generated with `drizzle-kit generate --name work_lineage`. The columns are additive, so drizzle-kit needed no TTY. The data backfill statements were then appended in the 0004 style. A second `drizzle-kit generate` reports "No schema changes, nothing to migrate".

| Table | Columns added | Meaning |
|---|---|---|
| `actions` | `completion_condition`, `completion_condition_by`, `completion_condition_at` | The agreed completion condition, who agreed it and when. The agreeing `CC` entry is still appended to the history. |
| `actions` | `blocked_reason`, `blocked_since` | The structured blocked state. A `BLK` entry sets it and an `UNB` entry clears it, in the same transaction. `status` is untouched, so every reader of the status words is unaffected. |
| `actions` | `source_meeting_id`, `source_minutes_id` | The meeting the action was raised in, and its confirmed minutes. |
| `actions` | `source_process_run_id`, `source_stage_id`, `source_stage_run_id` | The process run and stage the action was raised from. `source_stage_id` is kept as well as the stage run, because a stage that is not open yet has no stage run. |
| `actions` | `source_message_id` | The inbox message the action was converted from. This is for os-inbox. |
| `actions` | indexes `actions_source_meeting_idx`, `actions_source_process_idx` | |
| `action_updates` | `kind` (NOT NULL, default `UPD`) | The entry kind, typed by `ACTION_UPDATE_KINDS` in the schema. A unit test keeps it equal to the policy's `ENTRY_KINDS`. `CRT` (raised) is new. |
| `approvals` | `target_kind`, `target_id`, index `appr_target_idx` | What the approval is about (a decision, an action, minutes, a stage run). `decision_id` is kept for decisions. |
| `meetings` | `held_by_user_id`, `held_at` | Who recorded the meeting as held, and when on the scenario clock. |
| `meetings` | `process_run_id`, `stage_id`, index `meet_process_idx` | The process run and stage whose deadline depends on the meeting. |
| `evidence_documents` | `source_minutes_id`, `source_message_id`, index `evdoc_minutes_idx` | The lineage of confirmed minutes and converted messages filed as evidence. |
| `meeting_minutes` | `draft`, `version`, `content_digest`, `prepared_mode`, `edited_by_user_id`, `edited_at` | The structured, versioned working draft. The confirmation approval binds to its version and digest. |
| `meeting_minutes` | `evidence_document_id`, `distribution_user_ids`, `distribution_message_id`, `confirmation_approval_id` | The record the confirmation writes. |

**Backfill**, from the derived values the Work Hub used until now:

- **`action_updates.kind`** comes from the identifier prefix (`AUP-CMP-...` becomes `CMP`). An unknown shape reads as `UPD`.
- **`actions.blocked_reason` and `blocked_since`** are set for an open action whose latest entry is `status_after = blocked`. The note is the latest `BLK` entry's.
- **`actions.completion_condition`, `_by` and `_at`** come from the latest human `CC` entry.
- **`actions.source_minutes_id` and `source_meeting_id`** come from `meeting_minutes.action_ids`, the rule the Actions detail used. The meeting is only set when it exists.
- **`actions.source_process_run_id`, `source_stage_id` and `source_stage_run_id`** come from that meeting's process link.
- **`approvals.target_*`**, in order of precedence:
  - `decision` / `decision_id`, when the decision exists;
  - the subject recorded in the approval's audit detail, for Work approvals;
  - `stage-run` / the `approval-granted` event's correlation id, for process approvals.
- **`meetings.held_by_user_id` and `held_at`** are set for concluded meetings. They come from the role holder and the `recordMeetingHeld` audit moment, falling back to `concluded_at`.
- **`meetings.process_run_id` and `stage_id`** use the Work Hub's own rule (`deriveMeetingProcessLink`, `meeting-facts.ts`):
  - the run is a running process of the role whose scope holds the meeting's subject (assessment, its process, its line risks and controls, the process's KRIs; or the supplier, its contracts and subprocessors);
  - the stage is the one the role's configuration says that kind of meeting serves.
- **Confirmed minutes** with no evidence document are filed as `EVD-<minutesId>` (`source_type meeting-minutes`, with lineage and one retrieval chunk), and `evidence_document_id` is set.

**The seed** (`npm run demo:reset` on a fresh database) builds the same day. `seedMeetingRecords` runs before the process engine captures its digests, and `seedMeetingSafeOutputs` runs last.

- The two held meetings the seeded minutes record are written (T20):
  - `MTG-RCSA-PAYOPS-Q4-2026-SCOPE` (scope confirmation, 01.10.2026, RCSA scope-trigger stage);
  - `MTG-TPRM-VERIDIAN-TRIAGE-2026` (evidence triage, 01.10.2026, TPRM evidence-review stage).
- The recorded links and the action lineage are written by the same rule (`MSN-2026-0197` traces to the scope meeting and stage run `STAGERUN-RCSA-1`).
- The confirmed RCSA minutes are filed as evidence.
- The TPRM triage draft is structured.
- The validated safe-mode outputs are captured.

**Tested**:

- **0004 to 0005 upgrade**: `tests/integration/migration-0005.test.ts`. It migrates a temporary database with 0000 to 0004 only, writes legacy rows covering every backfill rule, applies 0005, checks each backfill, and checks that a second migrate is a no-op. Also done by hand on a copy of my seeded 0004 database.
- **Fresh migrate, seed and reseed**: on `<scratchpad>\os-meetings.db`.
- **The integrity script**: `scripts/test-migration.ts` now checks the 0005 columns; 18 passed.
- **`verify:seed`**: now checks that minutes are referentially intact (T20); all passed.

## 2. The meeting lifecycle

### Architecture

```text
src/features/work/modules/meetings/
  read-model.ts   MeetingsExtras.lifecycle, MeetingDetail.lifecycle; archive folds a meeting's own minutes into its row;
                  the status chip follows the scenario clock (In progress, Ended, not yet recorded)
  lifecycle.ts    pure: clock and phase, turns heard, the before / during / after view, readiness, what confirmation changes
  load.ts         reads the selected meeting's record, evidence, contradictions, minutes, distribution, and the stage
                  through the process engine's public API (buildStageContext)
  ai-schema.ts    Zod schemas and content validators: meeting-preparation-v1 (bilingual framing), meeting-minutes-draft-v1
  ai.ts           the mode branch: safe serves the seed-captured, digest-checked, validated output; offline composes;
                  live is not connected for meetings and is served as safe, and says so
  compose.ts      pure offline composers (preparation, minutes draft), the capture merge, the record text
  operations.ts   captureMeetingItem, prepareMinutes, saveMinutes, confirmMinutes (with stage sync and distribution)
  tools.ts        handlers: captureMeetingItem, prepareMeetingMinutes, editMeetingMinutes, confirmMeetingMinutes,
                  distributeMeetingMinutes
  tool-names.ts   the tool list for the gate evaluation and the governance exclusion
  copy.ts         bilingual copy (ASCII German)
src/db/repositories/meetings.ts   reads: transcript, minutes, getConfirmedMinutesForStage, getMinutesForDecision,
                                  recorded contradictions, cached outputs, distribution message
src/components/work/  MeetingLifecycle (server), MeetingPhases, MeetingTranscript, MinutesPanel (client islands);
                      MeetingDetailView renders the lifecycle
src/db/seed/meeting-lifecycle.ts  held meetings (T20), recorded links, structured draft, minutes as evidence, safe outputs
src/styles/workday-v3-meetings.css
```

### The journey

**Before the meeting.** The panes are labelled with the mode that prepared them (Safe or Offline) and its note.

- **Purpose and participants.** External participants are marked.
- **Process stage.** The link, the state (Open, Not open yet, or Completed) and a plain note, or "No running process depends on this meeting".
- **Open decisions** on the subject that are visible at this moment.
- **Expected outcomes.** One per open decision, the stage's human criteria, and minutes with every action owned and dated.
- **The evidence pack**, with what needs attention.
- **Contradictions on record.** These are the `contradiction-identified` background work on the subject, on objects the meeting names, or citing the pack.
- **AI-prepared questions**, each with the pack documents it rests on.
- **Actions due before the meeting.**

**During the meeting.**

- The conversation appears as far as the scenario clock has reached, and the record says how many later statements exist.
- Each statement is labelled Statement, Verified fact, Record or AI inference. The AI's turns read "AI Partner".
- A contradiction flag shows its note and document.
- Evidence retrieval lists the documents the statement rests on, with a summary.
- Any statement can be captured as one of these, into a versioned draft through the gate:
  - a fact;
  - a decision, linked to a visible decision, with an outcome;
  - an action, new with an owner, date, kind and completion condition, or a follow-up of an existing action;
  - an unresolved item.

**After the meeting.**

- **Draft the minutes.** In safe mode this serves the captured draft when every turn has been heard and it validates against what the role can see now. Otherwise the draft is composed offline from the turns heard. The person's captures are kept first, and the AI item for the same turn is dropped.
- **The draft is editable** before confirmation: summary, facts, decisions (link and outcome), actions (owner, date, kind, condition, or a follow-up note), unresolved, evidence and distribution.
- **Origins are kept.** An AI item the person left untouched stays "AI draft". An item they changed becomes "Captured by you".
- **Readiness** lists what is missing, for example an action with no due date.
- **Confirmation** states what will change, and that the approval binds to this version. It asks for the decisions, the actions with owners and dates, and the distribution to be confirmed separately, plus a reason of the person's own.

**Confirmation** is one governed, transactional, idempotent operation, `confirmMeetingMinutes` (APPROVAL_REQUIRED, material). The approval is bound to the minutes id, the version, the digest, the distribution and the action ids, and its target is `minutes`.

In one SQLite transaction it:

- files the minutes as evidence `EVD-<minutesId>`, with lineage to the meeting, minutes, subject, decisions, actions and process run, retrieval chunks indexed, and revealed at the current moment;
- raises the new actions as `MSN-<suffix>-Ann`, with `source_meeting_id`, `source_minutes_id`, `source_process_run_id`, `source_stage_id` and `source_stage_run_id`, the agreed completion condition, and a `CRT` history entry;
- adds an `MTG` follow-up to each existing action named, and, if the meeting was not yet held, to the rest of the work on its subject;
- records the meeting as held (`held_by_user_id`, `held_at` on the scenario clock) and marks the agenda entry;
- writes the minutes record (status, facts, decisions, action ids, evidence, confirmer);
- publishes the backbone events, each under a key derived from the minutes:
  - `meeting-completed`, with the process run and stage;
  - `source-changed`, for a process-linked meeting;
  - `action-updated`, per raised and followed-up action;
  - `decision-requested`, per linked open decision.

After the commit:

- the audit row is linked to the events (`linkOsEventAudit`);
- the process stage is brought up to date through the engine's public API (`buildStageContext`, then `syncStage` when the stage is open). The receipt says which of open, not open yet or completed applied;
- the simulated distribution follows as its own governed tool (`distributeMeetingMinutes`). It writes a `collaboration_messages` row with `simulated_only = 1` to exactly the confirmed recipients, and marks the minutes `distributed`;
- the server action calls `revalidateWorkday(roleId, "minutes")`.

**Idempotent and transactional.** A repeated confirmation writes nothing and says so. Every identifier is derived from the minutes id, so a write that somehow got past the status check would fail on its primary keys. Any failure rolls everything back.

**Decisions.** A decision's judgment stays with its owner on Decisions; minutes never record or reclassify a decision. "Updates the related decisions" means:

- the minutes record the discussion and its outcome (`meeting_minutes.decision_ids`);
- the evidence document names the decision in `related_object_ids`;
- a `decision-requested` event tells the Decisions surface the decision was discussed, and where the record is.

`getMinutesForDecision` is the read for os-decisions.

**Per role:**

- **Operational Risk: the RCSA challenge workshop, `MTG-2026-0005`.** Prepare at 07:45, capture at 11:45 (22 of 23 turns heard), draft in safe mode at 13:30, edit, confirm.
  - Two actions are raised: the tenant configuration (Stefan Brunner, 07.10.2026) and the comment text (Andreas Kellner, 13.10.2026).
  - `MSN-2026-0166` is followed up.
  - DEC-2026-0772 is recorded as not agreed and stays open.
  - The stage, Challenge Workshop, is not open yet. The receipt says so, and the confirmed minutes are its workshop record when it opens (`getConfirmedMinutesForStage`).
- **Third-Party Risk: the supplier challenge call, `MTG-2026-0002`, Novalink.** Draft at 11:45 (all 27 turns heard), confirm.
  - Three actions are raised, delivered by "Novalink client service, M. Falk", with Stefan Brunner accountable. One goes to Dr. Anja Weiss for the legal opinion.
  - `MSN-2026-0188`, `0184` and `0191` are followed up.
  - No running process covers TP-0042, and the before pane says so.
- **TPRM, process-linked: the Veridian triage minutes.** Confirming the seeded draft raises the two chase actions with `source_stage_run_id = STAGERUN-TPRM-4`. The meeting record lands on the open Evidence Review stage's timeline, and the stage is synced through the engine.

## 3. Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| One complete meeting journey per role | Met | Playwright `tests/e2e/os-meetings.spec.ts`. RCSA: before, during, capture, draft, edit, confirm, follow the raised action. TPRM: the supplier challenge, then the triage minutes. Integration "is one governed transaction ...", "confirms the TPRM supplier challenge ...", "updates an open process stage ... for TPRM". |
| Minutes editable before confirmation | Met | Integration "saves a person's edits as a new version, marks them as the person's, and refuses a stale version". Playwright edits the summary and sees version 3. A confirmed record is refused for edits (`writeDraft`, `saveMinutes`). |
| Confirmed minutes create structured records | Met | `meeting_minutes` facts, decisions, action ids, evidence and confirmer; raised actions; follow-up entries; meeting held; events. Integration asserts each. |
| Confirmed minutes create an evidence document | Met | `EVD-MIN-2026-0005`, with `source_minutes_id`, lineage and an FTS match. Playwright sees "Filed as evidence EVD-MIN-2026-0005". |
| Actions retain meeting lineage | Met | `source_meeting_id`, `source_minutes_id` and the process stage on raised actions. The Actions detail shows "Source meeting" and the stage (integration and Playwright). |
| Distribution simulated and auditable | Met | A `collaboration_messages` row with `simulated_only = 1` to the confirmed list, and a `distributeMeetingMinutes` mutation audit row. The UI says "Distributed as a simulated message to ... Nothing left this machine." |
| Search finds confirmed minutes | Met | os-shell's search lists the minutes (`getMinutesForRole`) and the evidence document. Integration `readSearchPayload` and Playwright `GET /api/workday/search?role=rcsa`. The search result opens the meeting with its minutes. |
| Confirmation is governed, transactional, idempotent, through the gate | Met | One approval bound to version, digest, distribution and action ids, with target `minutes`, consumed. Integration "is idempotent"; "writes nothing when any part of the confirmation fails" (pre-existing PK); refused at `recommend` autonomy (blocked audit row); refused for another role. |
| Process stage updated through the engine's public API only | Met | `buildStageContext` / `syncStage` from `src/features/process/orchestrator.ts`. No process table is written by the Meetings module; the stage hears about the meeting through `meeting-completed` and `source-changed`. |
| Events on the backbone | Met | `meeting-completed`, `source-changed`, `action-updated` and `decision-requested`, once each and audit-linked (integration). |
| AI preparation schema-validated, safe and offline only | Met | `ai-schema.ts` validators. Safe output is captured at seed and refused if invalid; digest-checked at read. Offline composition is validated the same way. Unit tests cover the em dash, umlauts, unknown documents, turns, owners and decisions. |
| Seeded minutes resolve (T20) | Met | Integration "resolves every reference the seeded minutes make"; `verify:seed` "References that must resolve" all 0. |
| 0005 tested from 0004 and fresh | Met | `tests/integration/migration-0005.test.ts` (7 passed); fresh migrate, seed and reseed on my database; `scripts/test-migration.ts` 18 passed; drizzle-kit reports no remaining diff. |
| Work Hub reads the real columns | Met | The completion condition, blocker, entry kind, source meeting, source process stage, meeting process link and held-by are read from the columns (`policy.ts`, `actions/read-model.ts`, `actions/tools.ts`, `meeting-facts.ts`). A row with no recorded value is still read by the earlier rule, so nothing is lost on a database the backfill has not seen. |
| Work Hub tests still pass | Met | `work-actions`, `work-agenda`, `work-meetings-inbox`, `work-shell` unit tests and `work-hub-operations` integration test all pass. Fixtures gained the new columns. |
| Approval targets bound by the gate | Met | `approval-target-mismatch` in `authority.ts`. `tests/unit/approval-target.test.ts` (7 passed). Work approvals and `grantApproval` set the target. |
| EN and DE | Met | Every string is bilingual and ASCII. Playwright checks "Danach", "Zweck" and "Protokoll", and asserts that no umlaut renders. Screenshots `after-de-*`. Seed text (objective, transcript, pack summary) stays English, as in the rest of the Work Hub. |
| No overflow at the three viewports | Met | Playwright "keeps every phase inside the viewport" passed at 1920, 1440 and 1366 for both journey meetings and all three phases. |
| tsc clean | Met | `npx tsc --noEmit -p tsconfig.json` reported no errors at the final run. |

### Audit rows in scope (`docs/handoffs/os-excellence-audit.md`)

| Row | Status | What changed |
|---|---|---|
| J10 (critical) | Fixed | A complete journey per role (prepare, capture, edit, confirm). Confirmed minutes create actions and evidence with lineage. The seeded TPRM draft can be found and confirmed. |
| T11 | Fixed (Work Hub), extended | The archive reads `meeting_minutes`. A meeting's own minutes are shown on the meeting row and open the lifecycle. Only orphaned minutes stand alone. |
| T20 | Fixed | The held meetings, actions and evidence the seeded minutes cite exist. The "Anna Weber" summary was already corrected by os-process-engine. `verify:seed` checks referential integrity. |
| T10 | Kept fixed | One preparation model from `meeting-facts.ts`. The lifecycle adds the mode label. |
| Work Hub schema gaps 1 to 7 | Closed | Completion condition, entry kind, blocker, source meeting, source process run and stage, approval target, and meeting process link and held-by are all columns now. Gap 8 (calendar write) and gap 9 (partner selection types) are outside this scope. |

## 4. Tests run

| Command | Result |
|---|---|
| `npx vitest run tests/unit/work-meetings-lifecycle.test.ts tests/unit/approval-target.test.ts` | 31 passed |
| `npx vitest run tests/unit/work-actions.test.ts tests/unit/work-agenda.test.ts tests/unit/work-meetings-inbox.test.ts tests/unit/work-shell.test.ts tests/unit/home-read-model.test.ts tests/unit/authority.test.ts` | all passed |
| `npx vitest run tests/unit` (full) | 34 of 35 files passed, 970 tests passed. The one failing suite is `integration-runtime.test.ts`, whose `beforeAll` times out at the 30 s hook limit (see Known limitations). |
| `npx vitest run tests/integration/meeting-lifecycle.test.ts` | 18 passed |
| `npx vitest run tests/integration/migration-0005.test.ts` | 7 passed |
| `npx vitest run tests/integration/work-hub-operations.test.ts` | 18 passed |
| `npx vitest run tests/integration` (full) | 19 of 21 files passed, 434 tests passed, including `decision-workspace`, `decision-queue-v3`, `meeting-lifecycle`, `migration-0005` and `work-hub-operations`. `tprm-onboarding-stages` (another workstream, in progress) timed out in its `beforeAll`. One `os-shell` test failed during the 27-minute run while other workstreams were editing; the whole `os-shell` file then passed on its own (15 of 15). |
| `NFR_BASE_URL=http://localhost:3109 NFR_DB_PATH=<scratchpad>\os-meetings.db npx playwright test tests/e2e/os-meetings.spec.ts --project=desktop-1920 --output=<scratchpad>\pw-os-meetings` | 5 passed |
| Same, `--project=desktop-1440 --project=desktop-1366` | 2 passed (layout); 8 skipped by design, because the write journeys run once, in the 1920 project |
| `npm run check:copy` | passed |
| `npx tsc --noEmit -p tsconfig.json` | no errors |
| `node scripts/check-no-emdash.mjs` | no finding in my files. The only findings at the final run were two placeholders in another workstream's in-progress handoff (`os-excellence-os-rcsa-stages.md`). |
| `npm run scan:secrets` | passed |
| `npx tsx scripts/test-migration.ts` (my database) | 18 passed |
| `npx tsx scripts/verify-seed-depth.ts` (my database) | every check passed, including the four new referential checks |
| `drizzle-kit generate` after 0005 | "No schema changes, nothing to migrate" |

## 5. Screenshots

All are in `docs/screenshots/os-excellence/os-meetings/`.

- **Before**: `before-*`. These are the Meetings tab as os-workhub left it: the orphaned RCSA minutes with no meeting, evidence or related work, and the TPRM meeting detail. EN at 1920 and 1366, DE at 1920.
- **After, English, RCSA**:
  - `after-en-rcsa-before`, `-before-questions` (prepared in safe mode, stage not open yet);
  - `-during-capture`, `-during-flag`;
  - `-after-draft`;
  - `-confirm`;
  - `-confirmed`;
  - `-raised-action` (source meeting and stage on the action);
  - at 1366: `-after`, `-during`.
- **After, English, TPRM**:
  - `after-en-tprm-during`, `-draft` (follow-ups and supplier deliverers), `-confirmed`;
  - `-triage-confirmed` (receipt: stage brought up to date);
  - at 1366: `-before`.
- **After, German**: `after-de-rcsa-before`, `after-de-rcsa-after`, `after-de-tprm-during`.

## 6. Known limitations

- **Process engine approvals have no target yet.** `src/features/process/approvals.ts` (os-process-engine's file, not edited) still writes `decision_id` with a task id and no target. The migration backfills existing ones as `stage-run`. The gate binds by the fingerprint alone when either side names no target, so nothing breaks. Request to os-process-engine: set `targetKind: "stage-run"` and `targetId` to the stage run in `grantStageApproval`.
- **RCSA Stage 5 is not executable.** The workshop's confirmed minutes are its workshop record through `getConfirmedMinutesForStage(processRunId, "challenge-workshop")`, and the backbone carries `source-changed` for the stage. The `rcsa.workshop-record` source loader and the `rcsa.minutes-confirmation` form belong to the RCSA stages workstream.
- **The TPRM process page opens the newest run.** That is now the Elbmarsch file seeded by the TPRM stages workstream. The Veridian stage timeline that receives the triage minutes is asserted in the integration test rather than on the page.
- **Live drafting is not connected for meetings.** A live configuration is served as safe and says so. Durable jobs are not used for meeting preparation or minutes drafting, because both are bounded and synchronous in safe and offline mode; a live model would need the job pattern.
- **The scenario clock.** In V3 it moves through the presenter day controls. The Playwright journeys move it directly in the isolated database, and refuse to run against port 3000 or the repository's database.
- **Seed text stays English in German** (objective, pack summary, transcript and the TPRM triage draft), as elsewhere in the Work Hub. The safe-mode RCSA and TPRM drafts are authored in both languages.
- **Ungoverned writers remain unused.** `createMeetingMinutes`, `confirmMeetingMinutes` and `updateMinutesStatus` in `src/db/repositories/role-app-runtime.ts` are ungoverned writers with no callers. The governed path is the Meetings module. I recommend the file's owner removes them.
- **`integration-runtime.test.ts`** (not mine) fails its `beforeAll` at the 30 s hook limit. Its cold dynamic import of the seed graph takes about 58 s for the process engine and stage implementations alone; the Work Hub and the meeting seed add about 3.5 s. It needs a longer hook timeout from its owner.
- **Inbox conversion.** `createAction` in `src/agents/tools/mutations.ts` now accepts `sourceMeetingId`, `sourceMinutesId`, `sourceProcessRunId`, `sourceStageId`, `sourceStageRunId` and `sourceMessageId`. os-inbox should pass `sourceMessageId`. The process engine's stage tools can pass their stage lineage the same way.
- **Schema.** No schema beyond 0005 was added, as the coordinator asked. 0006 belongs to the data-model workstream.

## 7. What the user must run

Against the shared database, with the dev server on port 3000 stopped:

```text
npm run db:migrate
npm run demo:reset
```

Then start the dev server again. Both steps are needed:

- **The migrate.** The code reads the 0005 columns, so the Work Hub, the Actions detail and every approval write fail on a database without them.
- **The reset.** It rebuilds the seeded day with the held meetings that resolve T20, the recorded links, the minutes evidence and the safe-mode outputs. The migration's backfill alone makes an existing database consistent, but it does not write the seed-only content.

A restart is also needed because the tool runtime registers handlers once per process.

## 8. Files changed

**Mine (new):**

- `src/db/migrations/0005_work_lineage.sql`, `meta/0005_snapshot.json`, `meta/_journal.json` (entry)
- `src/db/repositories/meetings.ts`
- `src/db/seed/meeting-lifecycle.ts`
- `src/features/work/modules/meetings/{ai-schema,ai,compose,lifecycle,operations,tools,tool-names}.ts`
- `src/components/work/{MeetingLifecycle,MeetingPhases,MeetingTranscript,MinutesPanel}.tsx`
- `src/styles/workday-v3-meetings.css`
- `tests/unit/{work-meetings-lifecycle,approval-target}.test.ts`
- `tests/integration/{meeting-lifecycle,migration-0005}.test.ts`
- `tests/e2e/os-meetings.spec.ts`

**Mine (changed):**

- the schema: `src/db/schema/{decisions,role-app-runtime,work}.ts`
- `src/features/work/modules/meetings/{read-model,load,copy}.ts`
- `src/components/work/MeetingDetailView.tsx`
- the seeded minutes in `src/db/seed/role-app-runtime.ts` (minutes section only)

**Surgical edits to others' files:**

| File | Change |
|---|---|
| `src/server/security/authority.ts` | five lifecycle tools; `ApprovalTarget`; optional `target` on the approval and the request; `approval-target-mismatch` |
| `src/agents/tools/runtime.ts` | `ToolContext.target`; approval target mapped; target passed to the gate |
| `src/agents/tools/mutations.ts` | `createAction` lineage fields |
| `src/scenario/engine/decide.ts` | `grantApproval` sets `target_kind decision` and `target_id` |
| `src/features/work/governance.ts` | approvals record their target; context carries it; the meeting tools are excluded from the generic publish |
| `src/features/work/modules/actions/{policy,tools,read-model,copy}.ts` | the 0005 columns |
| `src/features/work/modules/meeting-facts.ts` | recorded process link; `deriveMeetingProcessLink`; dependents include `source_meeting_id` |
| `src/features/work/modules/index.ts`, `hub-data.ts` | meeting tool names |
| `src/features/work/roles/operational-risk.ts` | the `scope-confirmation` meeting type |
| `app/workday/[role]/work/actions.ts` | four thin server actions |
| `src/db/seed/run.ts` | the two seed calls |
| `src/styles/globals.css` | one `@import` |
| `scripts/test-migration.ts` | the 0005 column checks |
| `scripts/verify-seed-depth.ts` | the referential checks |
| `tests/unit/support/work-fixtures.ts` | the new columns, and the meeting tools in `openGate` |
