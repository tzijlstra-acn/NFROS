# NFR WorkOS V3.3 -- Process Runtime Database Layer

Agent D handoff. Describes the persisted process runtime database layer
delivered in this release.

---

## What was built

Five new database tables, a repository module, a seed file, seed integration
into the existing seed runner, and updates to the three process pages that now
read live state from the database instead of static constants.

---

## Phase 1: Schema additions

**File:** `src/db/schema/role-app-runtime.ts`

Eight new SQLite tables, each carrying `run_id` following the project-wide
convention so that `demo:reset` can clear them.

| Table | Purpose |
|---|---|
| `role_app_runs` | One row per active process run. Tracks the current stage, status and mode. |
| `role_app_stage_runs` | One row per stage that has been entered within a run. Status drives the stage stepper. |
| `role_app_stage_tasks` | Individual tasks within a stage (AI jobs, human inputs, approvals). |
| `role_app_artifacts` | Artifacts produced by a stage: evidence packs, preparation docs, minutes drafts. |
| `role_app_events` | Append-only audit trail. One row per state transition. |
| `ai_routines` | Scheduled and event-driven AI routines per role. |
| `meeting_minutes` | Structured minutes linked to the meetings table. |
| `action_updates` | Append-only progress notes on actions. |

All boolean columns use `integer("...", { mode: "boolean" })` matching the
project convention. All JSON columns use `text("...", { mode: "json" }).$type<...>()`
matching the project convention.

---

## Phase 2: Schema exports

**File:** `src/db/schema/index.ts`

Added `export * from "./role-app-runtime";` to the barrel file.

The tables are automatically included in the Drizzle schema object used by
`src/db/client.ts` via the star-import of `./schema`.

---

## Phase 3: Repository layer

**File:** `src/db/repositories/role-app-runtime.ts`

All functions are synchronous (better-sqlite3). Uses the same Drizzle ORM
patterns as `src/db/repositories/workday.ts` (`.get()`, `.all()`, `.run()`).

### Exported types

Derived from Drizzle `$inferSelect` and `$inferInsert`:

- `PersistedRoleAppRun`, `NewRun`
- `RoleAppStageRun`, `NewStageRun`
- `RoleAppStageTask`, `NewStageTask`
- `RoleAppArtifact`, `NewArtifact`
- `RoleAppEvent`, `NewEvent`
- `AIRoutine`, `NewAIRoutine`
- `MeetingMinutes`, `NewMeetingMinutes`
- `ActionUpdate`, `NewActionUpdate`

### Functions

**Role-app runs**

- `getActiveRun(roleId, roleAppId, runId?)` -- returns the most-recently-started run for the given role and app, or `undefined` if none exists.
- `getRun(id, runId?)`
- `createRun(run)`
- `updateRunStage(id, currentStageId, status)`
- `completeRun(id)`
- `blockRun(id, reason)`

**Stage runs**

- `getStageRun(roleAppRunId, stageId, runId?)`
- `getStageRuns(roleAppRunId, runId?)` -- ordered by `openedAt` ascending.
- `createStageRun(stageRun)`
- `advanceStageRun(id, status)`
- `completeStageRun(id, userId)`

**Artifacts**

- `createArtifact(artifact)`
- `getArtifacts(roleAppRunId, stageId?, runId?)`

**Events**

- `recordEvent(event)`
- `getEvents(roleAppRunId, runId?)`

**AI routines**

- `getRoutines(roleId, runId?)`
- `getActiveRoutines(roleId, runId?)`
- `pauseRoutine(id)`
- `resumeRoutine(id)`
- `recordRoutineRun(id, runAt)`

**Meeting minutes**

- `getMeetingMinutes(meetingId, runId?)`
- `getMinutesArchive(roleId, runId?)`
- `createMeetingMinutes(minutes)`
- `confirmMeetingMinutes(id, userId)`
- `updateMinutesStatus(id, status)`

**Action updates**

- `getActionUpdates(actionId, runId?)`
- `appendActionUpdate(update)`

**Evidence helper**

- `getEvidenceDocumentsForSubject(subjectId, runId?)` -- fetches all evidence documents for the run and filters in JS by `relatedObjectIds.includes(subjectId)`. Used by the TPRM page to read evidence from the database. SQLite has no efficient native JSON-contains operator via the Drizzle ORM; the evidence corpus is small enough for JS filtering.

---

## Phase 4: Seed data

**File:** `src/db/seed/role-app-runtime.ts`

### Role-app runs seeded

| ID | Role | App | Subject | Current stage | Status |
|---|---|---|---|---|---|
| `RUN-RCSA-PAYOPS-Q4-2026` | rcsa | rcsa-cycle-assistant | RCSA-ARC-DE-PAYOPS-2026-Q4 | evidence-refresh | in-progress |
| `RUN-TPRM-VERIDIAN-2026` | tprm | tprm-third-party-onboarding | TP-0099 | evidence-review | in-progress |

### Stage runs seeded

| ID | Run | Stage | Status |
|---|---|---|---|
| `STAGERUN-RCSA-1` | RUN-RCSA-PAYOPS-Q4-2026 | scope-trigger | completed |
| `STAGERUN-RCSA-2` | RUN-RCSA-PAYOPS-Q4-2026 | evidence-refresh | waiting-for-input |
| `STAGERUN-TPRM-1` | RUN-TPRM-VERIDIAN-2026 | request-and-intake | completed |
| `STAGERUN-TPRM-2` | RUN-TPRM-VERIDIAN-2026 | classification-and-criticality | completed |
| `STAGERUN-TPRM-3` | RUN-TPRM-VERIDIAN-2026 | tailored-due-diligence | completed |
| `STAGERUN-TPRM-4` | RUN-TPRM-VERIDIAN-2026 | evidence-review | waiting-for-input |

### AI routines seeded (9 total)

RCSA (5): `morning-brief-rcsa`, `calendar-scan-rcsa`, `pre-meeting-prep-rcsa`,
`kri-control-watch`, `evidence-freshness-rcsa`. All status: active.

TPRM (4): `morning-brief-tprm`, `pre-meeting-prep-tprm`,
`supplier-monitoring-watch`, `evidence-request-followup`. All status: active.

### Meeting minutes seeded (2 total)

- `MINUTES-RCSA-SCOPE-WORKSHOP-2026` -- RCSA scope confirmation, status: confirmed.
- `MINUTES-TPRM-EVIDENCE-TRIAGE-2026` -- TPRM evidence triage, status: draft.

### Seed integration

**File:** `src/db/seed/run.ts`

- Added imports for the four ORM table objects needed by `insertAll`.
- Added imports for the seed data arrays from the new seed file.
- Added the new tables to `RUN_SCOPED_TABLES` at the front (most dependent first):
  `role_app_stage_tasks`, `role_app_stage_runs`, `role_app_artifacts`,
  `role_app_events`, `role_app_runs`, `action_updates`, `ai_routines`,
  `meeting_minutes`.
- Added four `insertAll` calls inside the `writeEverything` transaction, after
  `timelineRoleMoments` and before the integration projection.

---

## Phase 5: Process pages updated

### `app/workday/[role]/processes/v3.tsx`

- Added `getActiveRun` import from `@/db/repositories/role-app-runtime`.
- RCSA block: calls `getActiveRun("rcsa", "rcsa-cycle-assistant")` inside a
  try/catch. If a DB row exists it is used; otherwise the static constant
  `RCSA_PAYMENTS_Q4_RUN` is the fallback.
- TPRM block: same pattern with `getActiveRun("tprm", "tprm-third-party-onboarding")`
  and `TPRM_VERIDIAN_ONBOARDING_RUN` as fallback.
- Both blocks only need `currentStageId` from the run object for the landing
  page status line, so the shape difference between DB and static is not a concern.

### `app/workday/[role]/processes/rcsa-cycle/v3.tsx`

- Removed the local `getCompletedStageIds` helper (no longer needed).
- Added imports: `getActiveRun`, `getStageRuns` from `@/db/repositories/role-app-runtime`; `RoleAppRun` from `@/role-apps/contracts`.
- Reads the active run via `getActiveRun("rcsa", "rcsa-cycle-assistant")` and
  maps the DB row to the `RoleAppRun` interface (casting `roleId` and `status`).
  Falls back to the static constant if the DB row is absent.
- Completed stage IDs are now derived from `getStageRuns(dbRun.id)` filtered
  by `status === "completed"`. The sequence-based inference is only used as a
  fallback when no DB run exists.
- The component passes the mapped `RoleAppRun` to `ProcessStageDetail` (which
  accepts but does not use the `run` prop in its render).

### `app/workday/[role]/processes/third-party-onboarding/v3.tsx`

- Added imports: `getActiveRun`, `getEvidenceDocumentsForSubject`, `getStageRuns`
  from `@/db/repositories/role-app-runtime`; `RoleAppRun` from `@/role-apps/contracts`.
- Removed the static `EVIDENCE_ITEMS` array constant.
- Added `EvidenceDisplayStatus` type and `deriveEvidenceStatus(doc)` helper that
  maps database document status to the display status:
  - `"requested"` or `"missing"` -- `"missing"`
  - `"draft"` -- `"pending"`
  - `"current"` with `"WITH CONDITION"` or `"APPROVED WITH"` in summary -- `"accepted-with-condition"`
  - `"current"` otherwise -- `"accepted"`
- Reads the active run from the database with the same pattern as the RCSA page.
- Completed stages come from `getStageRuns(dbRun.id)` filtered by status, with
  sequence-based fallback.
- Evidence items are loaded via `getEvidenceDocumentsForSubject(run.subjectId)`
  inside a try/catch. The documents already exist in the `evidence_documents`
  table (seeded by `tprmOnboardingEvidenceDocuments` in `src/db/seed/tprm-onboarding.ts`).
  Each document is mapped to the display shape with its title as the label and
  its derived status.

---

## Evidence: how TPRM evidence is now read from the database

The TPRM onboarding evidence documents are seeded by the existing
`tprmOnboardingEvidenceDocuments` array in `src/db/seed/tprm-onboarding.ts`.
Each document carries `relatedObjectIds: ["TP-0099", ...]`.

`getEvidenceDocumentsForSubject("TP-0099")` fetches all evidence documents for
the scenario run and filters those whose `relatedObjectIds` array includes the
supplier ID. This returns the seven documents (EVD-OB-0099-01 through
EVD-OB-0099-07) in date order.

The `deriveEvidenceStatus` helper maps the document's `status` column and
`summary` text to the four-value display status. This is correct for the
seeded data:
- EVD-OB-0099-01: status `"current"`, no condition in summary -- `"accepted"`
- EVD-OB-0099-02: status `"current"`, summary contains `"APPROVED WITH ONE CONDITION"` -- `"accepted-with-condition"`
- EVD-OB-0099-03: status `"current"`, summary contains `"APPROVED"` (not "WITH CONDITION") -- `"accepted"`
- EVD-OB-0099-04: status `"current"`, no condition -- `"accepted"`
- EVD-OB-0099-05: status `"requested"` -- `"missing"`
- EVD-OB-0099-06: status `"requested"` -- `"missing"`
- EVD-OB-0099-07: status `"draft"` -- `"pending"`

This matches the previous static display exactly.

---

## TypeScript status

`tsc --noEmit` reports exactly three pre-existing errors, all in
`app/workday/[role]/work/v3.tsx` (lines 143-145, `noUncheckedIndexedAccess`).
None of the files created or modified in this release introduce any new errors.

The em-dash check (`check:copy`) passes cleanly for all new files.

---

## Issues and limitations

1. **No migration generated.** The new tables are added to the Drizzle schema
   but no migration file was generated (`drizzle-kit generate` was not run).
   The project uses a code-first seed approach: `db:migrate` runs the existing
   migrations and then `db:seed` creates all rows. For the new tables to exist
   in the database, the migration must be generated and run. Run:
   ```
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

2. **`roleAppStageTasks`, `roleAppArtifacts`, `roleAppEvents`, `actionUpdates`
   are not seeded.** These tables exist in the schema and repository but no
   seed data was defined for them. They start empty and are populated at
   runtime by the scenario engine when it is wired to the role-app runtime.

3. **Evidence derivation is heuristic.** The `deriveEvidenceStatus` helper
   checks the `summary` text for known phrase patterns. If a document's summary
   is reworded, the mapping could silently change. A future iteration should
   store the evidence review outcome as a dedicated `roleAppStageTasks` row
   with the status encoded explicitly.

4. **`meeting_minutes.meetingId` is not a foreign key.** The schema does not
   declare a formal SQLite foreign key constraint to the `meetings` table.
   SQLite foreign keys are enforced only when `foreign_keys = ON` is set (which
   it is), but Drizzle does not generate the constraint automatically from the
   column name. A future migration can add the constraint if needed.
