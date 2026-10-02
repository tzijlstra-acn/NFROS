# V3.3 RCSA Cycle Assistant -- Process Pages Handoff

Agent E delivery. Date: 2026-10-02.

## Summary

Transformed the RCSA Cycle Assistant process page from a static stage description display into a working process workspace. Every stage now shows AI preparation output, a human task, artifacts, and a stage-level status badge. The current stage (evidence-refresh) has a submit form that advances the run to the next stage via a server action.

---

## Files created

### `src/components/workday-v3/StageWorkspace.tsx`

New server component. Exports:
- `StageWorkspace` -- the main component
- `StageStatusKind` -- type alias for stage status union
- `StageArtifact` -- artifact shape `{ label: string; content: string }`
- `StageEvent` -- event shape `{ eventKind: string; at: string; actorKind: string }`

Props:
```ts
interface StageWorkspaceProps {
  stage: RoleProcessStage;
  stageStatus: StageStatusKind;
  aiPreparation: string;
  humanTask: string;
  artifacts: StageArtifact[];
  recentEvents: StageEvent[];
  actionForm?: React.ReactNode;
  language: Language;
}
```

Renders:
1. Stage name + status badge (coloured by status)
2. "AI prepared" section (blue-tinted box) -- hidden when locked
3. "Your task" section (highlighted border when active) -- hidden when completed or locked
4. Artifacts list (if any) -- hidden when locked
5. Action slot (`actionForm` prop) -- hidden when locked
6. Recent events (collapsible `<details>` at bottom, always rendered)

### `app/workday/[role]/processes/rcsa-cycle/actions.ts`

Server action module (`"use server"`). Exports:
- `submitStageDecision(formData: FormData)` -- completes the current stage run, opens the next stage run, updates the run pointer, records audit events, and redirects to the next stage workspace.

Stage run creation logic: checks whether a stage run row already exists for the next stage (using `getStageRun`). If it does, calls `advanceStageRun` to set its status to `"in-progress"`. If it does not (the common case for stages 3-8), calls `createStageRun` to insert a new row.

---

## Files modified

### `app/workday/[role]/processes/rcsa-cycle/v3.tsx`

Complete rewrite. Key changes from V3.2:

- Removed `ProcessStageDetail` import and usage.
- Added imports: `StageWorkspace`, `getArtifacts`, `getEvents`, `submitStageDecision`.
- Added `STAGE_CONTENT` map: offline AI preparation text and human task per stage (8 entries). These are the static "prepared" texts used in demo mode.
- Added `STATIC_ARTIFACTS` map: fallback artifact display per stage (2 entries: scope-trigger and evidence-refresh).
- Added `resolveStageStatus()` helper: maps stage run DB status to `StageStatusKind`.
- Stage status computation:
  - If no stage run row exists for the selected stage: `"locked"`
  - `"waiting-for-input"` | `"waiting-for-decision"` -> `"waiting-for-input"`
  - `"in-progress"` | `"ai-preparing"` | `"ready-for-review"` -> `"in-progress"`
  - `"ready"` -> `"ready"`
  - `"completed"` -> `"completed"`
- Artifact loading: reads `getArtifacts(runId, stageId)` from DB; falls back to `STATIC_ARTIFACTS` if empty.
- Events loading: reads `getEvents(runId)`, takes last 3 (reversed), maps to `StageEvent[]`.
- Action form: rendered only when `isCurrentStage && (status === "waiting-for-input" || "in-progress") && stageRunId exists`. Hidden fields: `stageRunId`, `runId`, `currentStageId`, `roleId`, `decision`. Textarea: `note`.
- `ProcessMap` kept unchanged.
- Decisions section kept from V3.2 (below workspace).

### `app/workday/[role]/processes/v3.tsx`

Targeted addition only:

- Added `getStageRuns` to the import from `@/db/repositories/role-app-runtime`.
- In the RCSA card block: after reading `dbRun`, also calls `getStageRuns(dbRun.id)` to find the current stage's run row. Appends a status suffix to the stage line:
  - `"waiting-for-input"` -> `" -- Waiting for input"`
  - `"in-progress"` -> `" -- In progress"`

No changes to the TPRM card or the routines sub-view.

---

## Stage progression flow

```
User loads /workday/rcsa/processes/rcsa-cycle
  -> DB: getActiveRun returns RUN-RCSA-PAYOPS-Q4-2026 (currentStageId = "evidence-refresh")
  -> DB: getStageRuns returns two rows (scope-trigger: completed, evidence-refresh: waiting-for-input)
  -> StageWorkspace renders with stageStatus = "waiting-for-input"
  -> Action form shown with stageRunId = "STAGERUN-RCSA-2"

User types a note and clicks "Submit evidence decision"
  -> POST to submitStageDecision (server action)
  -> completeStageRun("STAGERUN-RCSA-2", null)
  -> recordEvent: stage-completed, human actor
  -> getStageRun("RUN-RCSA-PAYOPS-Q4-2026", "risk-control-change") -> undefined
  -> createStageRun: new row for risk-control-change, status = "in-progress"
  -> updateRunStage("RUN-RCSA-PAYOPS-Q4-2026", "risk-control-change", "in-progress")
  -> recordEvent: stage-entered, system actor
  -> redirect to /workday/rcsa/processes/rcsa-cycle?stage=risk-control-change

User lands on Stage 3 workspace
  -> DB: currentStageId = "risk-control-change", new stage run exists with status "in-progress"
  -> StageWorkspace renders Stage 3 as "in-progress" with its AI prep text
  -> No action form yet (stageStatus in-progress but this stage has no decision task seeded)
```

---

## Server action wiring

The form in the page component uses `action={submitStageDecision}`. Next.js 14 app router supports this pattern: importing a `"use server"` function from a sibling file and passing it directly to a form action in a server component.

No client-side JavaScript is needed. The form is a plain HTML POST. The `redirect()` call in the server action triggers a 307 response that the browser follows to the next stage URL.

---

## TypeScript status

All types are derived from the schema (`$inferSelect` / `$inferInsert`) or from the existing contracts. Key guard: `selectedStageRun?.id ?? ""` prevents passing `undefined` to the hidden input when no stage run exists (the form is not shown in that case, but the guard makes the compiler happy).

The `StageStatusKind` union (`"completed" | "in-progress" | "waiting-for-input" | "locked" | "ready"`) is a simplified subset of the full DB status enum. `resolveStageStatus()` converts between them.

---

## Remaining limitations

1. **Stages 3-8 action forms not seeded.** The server action advances the run pointer correctly, but stages 3-8 do not have action forms defined. Adding them requires extending `STAGE_CONTENT` and wiring a form per stage.

2. **AI preparation content is static offline text.** In a live deployment, the AI would populate the preparation text into `role_app_artifacts` rows. The current page reads DB artifacts first and falls back to `STAGE_CONTENT` text -- so the DB path is ready, but only stages 1 and 2 have static fallback content.

3. **Events table starts empty.** The seed does not include role_app_events rows. Events appear only after the user submits a stage decision. The collapsible "Recent events" section renders "No events recorded yet" on first load.

4. **No duplicate event guard.** If the server action is submitted twice (double POST), two events are recorded. The stage run is idempotent (second `completeStageRun` call has no observable effect since the status is already "completed"), but a second `createStageRun` would fail with a duplicate ID if the timestamp-based ID collides. In production, a database unique constraint on (roleAppRunId, stageId) prevents this.

5. **ProcessStageDetail still used on TPRM page.** This handoff is scoped to RCSA only. The TPRM process page continues to use `ProcessStageDetail`. StageWorkspace can be adopted there in a follow-on release.
