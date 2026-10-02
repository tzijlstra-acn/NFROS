# V3.3 TPRM Third-Party Onboarding -- Agent F Handoff

Synthetic institution and data. All figures are scenario figures.

---

## Files created / modified

### Created

- `app/workday/[role]/processes/third-party-onboarding/actions.ts`
  Server action module (Next.js "use server"). Exports `submitStageDecision`.

### Modified

- `app/workday/[role]/processes/third-party-onboarding/v3.tsx`
  Major revision from V3.2 (static stage descriptions + evidence table) to V3.3
  (operational three-region workspace with stage-advance action).

---

## Stage progression design

The page reads `run.currentStageId` from the DB (via `getActiveRun`). The seeded
demo state is: Veridian Document Systems GmbH (TP-0099) at stage 4 (evidence-review),
stages 1-3 completed.

Stage status for the selected stage (from the ?stage= query param):

| condition                              | status label  | action shown                     |
|----------------------------------------|---------------|----------------------------------|
| stageId in completedStageIds           | Completed     | "Stage completed" box (green)    |
| stageId === run.currentStageId         | In Progress   | Decision form (stage 4 only)     |
| neither                                | Locked        | "Stage locked" notice (muted)    |

`completedStageIds` is sourced from `getStageRuns(dbRun.id)` filtered by status
"completed". Static sequence-based fallback when no DB run exists.

The action form only appears when:
- selected stage is "evidence-review" AND
- it is the current stage (in-progress) AND
- a DB run exists AND
- a stage run row for that stage is present (currentStageRunId is non-null)

---

## Evidence sourcing (DB vs static)

Evidence items are read from the database via `getEvidenceDocumentsForSubject("TP-0099")`.
The function fetches all `evidence_documents` rows for the scenario run, then filters
to those whose `relatedObjectIds` array contains "TP-0099".

Display status is derived from the DB row's `status` field:
- "requested" or "missing" => Missing -- requested (red)
- "draft" => Pending (neutral)
- "current" with "WITH CONDITION" or "APPROVED WITH" in summary => Accepted with condition (amber)
- "current" otherwise => Accepted (green)

No evidence items are hardcoded.

---

## Server action wiring

`submitStageDecision` (actions.ts):

1. Reads hidden form fields: stageRunId, runId, currentStageId, roleId.
2. Calls `completeStageRun(stageRunId, null)` -- marks the stage run row as completed.
3. Calls `recordEvent` with eventKind "stage-completed", actorKind "human".
4. If a next stage exists in the process definition:
   - Calls `updateRunStage(runId, nextStage.id, "in-progress")`.
   - Calls `recordEvent` with eventKind "stage-entered", actorKind "system".
   - Redirects to `?stage=<nextStageId>`.
5. If no next stage: redirects to the process base path.

`DEFAULT_RUN_ID` is included in all event rows (required by the schema's runId column).
The `payload` field is passed as a plain object (Drizzle handles JSON serialisation via
`{ mode: "json" }` on the column).

---

## Layout regions

### Region 1: ProcessMap
Unchanged from V3.2. Stage stepper with click-to-navigate links.

### Region 2: Stage workspace
For every selected stage:
- Stage name (h2) + StageBadge (Completed / In Progress / Locked)
- AI preparation box (--wd-accent-soft background, "AI prepared" label)
  Content is offline-seeded text per stage (AI_PREP_CONTENT map in v3.tsx).
- Your responsibility (human task text from process definition)
- Evidence section (stage 4 only) -- DB-sourced, 7 items as seeded
- Artifacts section (from getArtifacts, empty in seed state)
- Stage action:
  - Completed stages: green "Stage completed" notice
  - Stage 4 in-progress: textarea + hidden fields + submit button (calls submitStageDecision)
  - Locked stages: muted "Stage locked -- complete Stage 4 first" notice

### Region 3: Event log
Last three events from `getEvents(run.id)`. Shown only when at least one event exists.
Initially empty (no events seeded). Populated after the first form submission.

---

## TypeScript status

`npx tsc --noEmit` exits 0 with no errors or warnings.

Key type decisions:
- `actorId: undefined` (not null) in event inserts -- Drizzle insert type treats missing
  optional nullable columns as undefined.
- `payload: undefined` for the stage-entered event (no payload needed).
- `React.CSSProperties` used without explicit React import -- consistent with existing
  pattern in this project (tsc resolves it via the JSX transform configuration).

---

## Remaining limitations

1. No stage run row is created for stage 5 (specialist-reviews) when advancing.
   The run's currentStageId is updated but no stageRun row is inserted. Stage 5
   will show as "in-progress" (current) without a stageRunId for future forms.
   Acceptable for V3.3 scope where only stage 4 has an action form.

2. AI preparation content for stages 5-8 is fixed as "Stage locked" text even if
   those stages become current after advancing. The text was authored for the initial
   demo state (stage 4 in-progress).

3. The event log is empty in the initial seed state. It populates after the first
   form submission. A future seed step could pre-populate run-started and
   stage-entered events for stages 1-3.

4. The textarea pre-fill ("Proceed with available evidence...") is a static default.
   In a live mode this would be generated by the AI partner based on the evidence
   state at decision time.
