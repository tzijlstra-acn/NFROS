# OS Excellence: os-workhub handoff (Wave 1 foundation)

Plan sections 4.4 (Work Hub), 4.5 (Agenda) and 4.7 (Actions), with Meetings (4.6) and Inbox (4.8) moved into the new shell with their behaviour kept. Synthetic institution and data.

## What changed

- **The route is thin.** `app/workday/[role]/work/v3.tsx` went from 1455 lines to 59. It resolves the role, shows the preview page for demo and planned roles, checks the scenario is seeded, and renders what `buildWorkHub` assembled.
- **A shared capability shell** with master and detail:
  - the queue, saved views and filters on the left;
  - the selected item on the right: next action, context, evidence, related work, history and audit;
  - below 1180px of viewport the detail opens as a drawer over the queue.
- **Four modules on one interface** (`src/features/work/modules/index.ts`): Agenda, Meetings, Actions, Inbox. Each has a pure read model with its own unit tests.
- **Per-role configuration** for Operational Risk and TPRM (`src/features/work/roles/`): meeting types, agenda labels, action kinds, inbox classifications, related object types and professional actions. Role copy is not in the shared renderer, and a test enforces this.
- **Selection is URL state**: `?view=actions&item=MSN-2026-0188`. Every tab link carries `item`, so the selection persists across tabs. An item selected from another tab still shows in the detail, with "Selected in Actions, Open in Actions".
- **The context drawer and the AI Partner follow the selection.** See "Context binding" below. The drawer no longer says "Nothing selected" once an item has been selected.
- **Every static fallback is gone**: events, meetings, the archive, actions, messages and the context line. Empty data shows an empty state that says so. The context line is now counted from the same rows the tabs show.
- **Agenda**:
  - Day and Week views;
  - conflicts computed from the times;
  - preparation recorded and pack state read from each document now;
  - the linked process and stage, the linked object, and the work due that depends on the meeting;
  - the next action;
  - Record as held, which changes the downstream work;
  - two AI proposals, which change nothing.
- **Actions**:
  - views: Needs me, Waiting on others, Overdue, Completed;
  - a full detail;
  - nine governed operations;
  - append-only history;
  - AI checks for vague wording and duplicates, a proposed completion condition, and a drafted reminder.
- **Meetings and Inbox** keep their behaviour in the new shell. The Meetings archive now also reads the `meeting_minutes` records. The Inbox now shows the classification rationale, the confidence, the response deadline, the links to the linked decision, action and duplicate, and a "Simulated" source label.

## Structure and line counts

| Area | Files (lines) |
|---|---|
| Route | `app/workday/[role]/work/v3.tsx` (59), `app/workday/[role]/work/actions.ts` (164, server actions) |
| Shell, `src/features/work/` | `hub.ts` (141, WorkHub assembler), `hub-data.ts` (108, shared loader and gate verdicts), `model.ts` (396, types and pure helpers), `url.ts` (154, URL state), `selection.ts` (119, SelectionState and AI mapping), `related.ts` (142, RelatedWork), `freshness.ts` (78, SourceFreshness), `governance.ts` (284, approvals and tool runs), `shared.ts` (136), `copy.ts` (161) |
| Role configuration | `roles/types.ts` (96), `roles/operational-risk.ts` (189), `roles/third-party-risk.ts` (188), `roles/index.ts` (26) |
| Modules | `modules/index.ts` (104, the module interface), `modules/meeting-facts.ts` (143, shared by Agenda and Meetings); `actions/` read-model 770, policy 348, operations 380, tools 477, copy 256, load 45; `agenda/` read-model 698, operations 82, copy 128, load 21; `meetings/` read-model 411, copy 54, load 18; `inbox/` read-model 314, copy 56, load 16 |
| Presentational, `src/components/work/` | `WorkHub` 48, `WorkTabs` 29, `QueuePane` 175, `DetailPane` 110, `ModuleDetail` 29, `ActionDetailView` 171, `ActionOperations` 451 (client), `AgendaDetailView` 140, `RecordHeldForm` 96 (client), `MeetingDetailView` 130, `InboxDetailView` 54, `RelatedWork` 58 (client), `SourceFreshness` 16, `primitives` 143, `ContextBinding` 21 (client), `context-store` 107 (client), `BoundContextPanel` 81 (client), `ClearSelection` 31 (client) |
| Repository (new file) | `src/db/repositories/work-hub.ts` (487, reads only) |
| Styles | `src/styles/workday-v3-work.css` (650), imported from `globals.css` |

## Module interface (for the Meetings and Inbox workstreams)

Every module implements `WorkModule<TExtras, TDetail extends DetailBase>` from `src/features/work/modules/index.ts`:

```ts
interface WorkModule<TExtras, TDetail extends DetailBase> {
  tab: WorkTab;                                   // "agenda" | "meetings" | "actions" | "inbox"
  toolNames: readonly string[];                   // registry tools the module runs; the hub asks the gate once each
  loadExtras(shared: WorkSharedData, query: WorkQuery): TExtras;              // server only, reads
  buildQueue(shared: WorkSharedData, extras: TExtras, query: WorkQuery): ModuleQueueView;   // pure
  resolve(itemId: string, shared: WorkSharedData, extras: TExtras, query: WorkQuery): TDetail | null; // pure
  tabCount(shared: WorkSharedData, extras: TExtras): number;                  // pure
}
```

- `WorkSharedData` (`src/features/work/shared.ts`) is loaded once per request. It contains:
  - the role and its holder;
  - the scenario date and moment, the language and the autonomy level;
  - the role configuration;
  - people, object labels and process scopes;
  - decisions, calendar, meetings, actions, minutes and messages;
  - `gate`: the authority gate's verdict per tool, for this role at this autonomy level.
- `ModuleQueueView` (`model.ts`) is what the left pane renders: saved views, filters, the object filter, groups of `QueueRowView`, an empty state, proposals and a counted summary.
- `DetailBase` (`model.ts`) is what the shell renders for any item: title, status, facts, context, evidence, related links, activity, audit, freshness, and `ai` (the partner selection and a note). The module's own detail extends it, and the module's own component renders the extension (`src/components/work/ModuleDetail.tsx` picks the component by `detail.kind`).
- `toBoundContext(roleId, detail)` is the only function that builds what the drawer and the AI Partner read.

### Meetings (section 4.6 builds on this)

- **Read model**: `src/features/work/modules/meetings/read-model.ts`.
  - `MeetingsExtras { packEvidence, audit }`.
  - `buildMeetingsView` has two views: Upcoming, and Minutes archive. The archive holds concluded meetings plus `meeting_minutes` rows.
  - `resolveMeetingDetail` resolves a meeting id, or a minutes id (`variant: "minutes"`).
  - `MeetingDetail` adds the type label, when, participants, objective, `pack: PackState`, questions, outcome, `minutes`, `process`, `dependents` and `agendaEntryHref`.
- **Shared facts**: `src/features/work/modules/meeting-facts.ts`, with `meetingPack`, `meetingProcess`, `dependentActions` and `meetingDecisions`. Use these, so Agenda and Meetings cannot disagree.
- **To add the lifecycle** (before, during and after; minutes edit and confirm):
  1. Extend `MeetingDetail`, and render the extension in `MeetingDetailView.tsx`.
  2. Add operations beside `modules/agenda/operations.ts`, following the same `runGovernedChain` pattern.
  3. Register any new tool in `TOOL_REGISTRY` and in `modules/actions/tools.ts` (or a sibling `tools.ts`).
  4. Add the tool names to `MEETINGS_MODULE.toolNames` and to `hubToolNames()` in `hub-data.ts`.
  5. Add server actions in `app/workday/[role]/work/actions.ts`, and call `revalidateWorkday(roleId, "minutes")`.
  - The shell does not change.
  - Actions created from confirmed minutes should be listed in `meeting_minutes.action_ids`: that is how the Actions detail derives "Source meeting" today.
- **Already in place for the lifecycle**: `recordMeetingHeld` (tool and operation). It records the outcome, marks the agenda entry held, and writes a follow-up entry to each dependent action. Minutes confirmation can call it, or replace it.

### Inbox (section 4.8 builds on this)

- **Read model**: `src/features/work/modules/inbox/read-model.ts`.
  - `InboxExtras { evidence }`.
  - `buildInboxView` has three views: Needs triage (unconfirmed and not noise), Handled (`confirmed_triage` set), and All. Filters are by classification.
  - `resolveInboxDetail` returns `InboxDetail`, which adds the channel, from, received, body, `classification { label, tone, confirmed, rationale, confidence }`, `primaryAction` (the role's words), `respondBy` and `duplicateOf`.
- **The role vocabulary** for classifications and primary actions is in `roles/*.ts` under `inboxClassifications`.
- **To add conversion** (confirm or change triage, create action, link as evidence, add to process, delegate, draft reply, send simulated reply, dismiss):
  1. Add an `InboxOperations` client component beside `ActionOperations.tsx`, and render it from `InboxDetailView.tsx`.
  2. Add operations that use `runGoverned`.
  3. Add tools to the registry where none exist. `requestEvidenceDocument`, `sendSimulatedCollaborationMessage` and `createAction` already exist.
  4. On conversion, write `inbox_messages.confirmed_triage`, `linked_action_id` and `linked_decision_id`. The Handled view, the lineage links and the Actions "Source message" link read those today.
  - The shell does not change.

## Governance

- **New registry tools** (additive block in `src/server/security/authority.ts`). Handlers are in `src/features/work/modules/actions/tools.ts`.
  - `draftActionReminder` (DRAFT): writes nothing.
  - `addActionUpdate` (POLICY_BOUND_AUTONOMOUS): append only.
  - `reassignAction`, `changeActionDueDate`, `completeAction`, `reopenAction` and `recordMeetingHeld` (all APPROVAL_REQUIRED, material).
  - The new tools are not in `TOOL_SCHEMAS`, so the model is never offered them.
- **Existing tools reused**:
  - `requestEvidenceDocument`, for Request evidence;
  - `sendSimulatedCollaborationMessage`, for Send reminder;
  - `addCommitteeAgendaItem`, for Escalate.
- **Path**: every operation goes server action, then operation, then `runGoverned` (`src/features/work/governance.ts`), then `evaluateAuthority`, then `executeTool`.
  - When the gate needs an approval, one is recorded in the name of the role's holder, bound to the payload fingerprint. The runtime consumes it.
  - A refusal still goes through `executeTool`, so the blocked attempt is audited.
- **Why not `grantApproval`.** Work approvals are not decisions, so `decision_id` is null rather than misattributed. The approver and the acting role are both the holder of the route's role, which avoids the `approval-role-mismatch` defect recorded in `decide.ts`.
- **Rules enforced in the operation and again in the handler**:
  - evidence is required to close where the role configures it, and the evidence must exist;
  - a material closure, due date change, reassignment, reopen or escalation needs explicit confirmation;
  - accountability can be transferred, never removed;
  - a due date cannot be set before the scenario day;
  - a meeting cannot be recorded as held before it starts;
  - an action not on the role's desk cannot be changed from that role.
- **AI may / may not.**
  - AI drafts reminders, flags vague wording and duplicates, and proposes a measurable completion condition.
  - All of these are labelled as proposals, and none of them writes anything until a person acts.
  - The AI cannot close, move or reassign: those tools are APPROVAL_REQUIRED, and the gate refuses an `agent:` approver.
- **Freshness.** Every write calls `revalidateWorkday(roleId, "action" | "meeting")` from `src/workday/revalidate.ts` (the `os-home-truth` helper).
- **Events.** Every executed change is published as `action-updated` or `meeting-completed` on the OS event backbone (`publishOsEvent`), linked to the audit row the runtime wrote. A failed publish is logged and does not undo the governed change.

## Context binding (drawer and AI Partner)

- **The store.** The frame renders the drawer and the dock as siblings of the page, so a page context cannot reach them. `src/components/work/context-store.ts` is a small external store, kept in session storage, that:
  - the hub publishes into (`ContextBinding`);
  - the drawer and the dock host read.
- **When it changes.** Navigating away does not clear it, which is what "never says Nothing selected after an item was selected" needs. Only Clear selection clears it. It is filtered by role.
- **Two surgical edits to shared V3 shell files:**
  - `src/components/workday-v3/WorkdayPanels.tsx`: when a context is bound, the drawer body renders `BoundContextPanel` (Evidence, Details, Activity, Audit for the item). Otherwise the existing empty state shows.
  - `src/components/workday-v3/WorkdayPartnerDock.tsx`: the V3 host bridge now passes the bound selection to the `selection` parameter `/api/workday/partner` already parses. It re-reads the payload when the selection changes, and swaps it in place, so `PartnerClient` is not remounted and the conversation survives. The dock itself (`AIPartnerDock`, `PartnerClient`, `AIChatPanel`) was not edited.
- **How items map to the partner's selection types.** An action binds as `action`. A meeting, agenda entry or message binds to the object it is about (a control, supplier, assessment and so on), labelled with the item's title. When it is about nothing the partner can read (a focus block, an indicator), the partner keeps the role context and the pane says so.

## Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| Work Hub route below 300 lines | Met | `v3.tsx` is 59 lines |
| Each tab independently testable, a unit test per module read model | Met | `tests/unit/work-actions.test.ts` (22), `work-agenda.test.ts` (18), `work-meetings-inbox.test.ts` (10), `work-shell.test.ts` (23) |
| Role copy not embedded in the shared renderer | Met | `work-shell.test.ts`: 11 role phrases and scenario identifiers absent from every shell and module file outside `roles/` |
| Selection persists across tabs (URL state) | Met | Integration "keeps the selected action across a tab change"; Playwright "keeps the selection across tabs" at all three viewports |
| AI Partner context follows selection | Met | Playwright asserts the partner request carries `selection=supplier:TP-0042` for the selected supplier challenge |
| Context drawer never says Nothing selected after a selection | Met | Playwright opens all four drawer tabs and asserts no "Nothing selected"; drawer stays bound after leaving the hub (session storage check). Screenshot `after-en-drawer-tprm-agenda-*.png` |
| Agenda events from the database or an honest empty state | Met | Unit "shows an explicit empty state"; Playwright asserts every row is `CAL-2026-NNNN` and the old static title is gone |
| Preparation status is current | Met | Pack state is read from each document's status and staleness at request time (unit "reads the pack's documents"); the recorded status is shown separately, so T10's contradiction is gone |
| Process and object links work | Met | Playwright follows the process link (HTTP < 400) and the object link (lands on `object=CTL-PAY-014`) |
| Conflicts visible | Met | Unit tests for symmetric detection; rows flagged; detail lists the overlap. Screenshot `after-en-rcsa-work-item-CAL-2026-0009-*.png` |
| Process deadline depending on a meeting | Met | "Work due that depends on this meeting" lists the open actions on the meeting's subject, earliest due first, with the linkage rule stated |
| Completed meeting changes downstream work | Met | Integration "records the outcome, marks the agenda entry held and writes a follow-up to each dependent action"; next action becomes "Follow up the dependent actions (5)" |
| AI behaviours are proposals through the authority patterns | Met | Prepare carries the gate's verdict on `prepareChallengeQuestions`; Reserve focus time is a labelled proposal ("Calendar booking is not connected in this release") with no button |
| No static action fallback | Met | Unit and integration: every row is a seeded action of the role |
| Updates append only | Met | Integration "adds entries without changing earlier ones"; no handler updates or deletes `action_updates` |
| Completion requires evidence where configured | Met | Integration: refused without evidence and with a non-existent reference; Playwright: refused, then closed with `EVD-2026-41810` |
| Material closure requires human confirmation | Met | Integration: unconfirmed material closure leaves the action open and records no approval; Playwright: submit disabled until the confirmation is ticked |
| Overdue and blocked actions surface on Home | Partly | The data is on the rows Home reads (`actions.status`, `action_updates`) and every write revalidates Home. Blocked is derived from the history (`status_after = "blocked"`), and Home (owned by `os-home-truth`) does not read it yet. `classifyAction` in `modules/actions/policy.ts` is the function to use |
| EN and DE | Met | Every string is bilingual and ASCII. Screenshots `after-de-*.png`. The remaining English in DE views is seed data (`users.job_title`, supplier contact labels) |
| No overflow at the three viewports | Met | Playwright `noHorizontalOverflow` at 1920x1080, 1440x900 and 1366x768; capture script reports no document or main overflow |
| tsc, vitest, Playwright, check:copy, scan:secrets | Met | See Tests |

## Audit rows in this scope (`docs/handoffs/os-excellence-audit.md`)

| Row | Status | What changed |
|---|---|---|
| T05 (critical) | Fixed | The drawer reflects the Work Hub selection through the bound context. This needed the minimal shared edit to `WorkdayPanels.tsx` noted above. On Home and Decisions, the drawer shows the last Work selection rather than the empty state; Home's and Decisions' own items are not bound, because those surfaces are other workstreams' |
| T08 | Fixed | All `RCSA_/TPRM_STATIC_*` sets are removed; an unseeded database renders `NotSeeded`; demo and planned roles get the preview page |
| T09 | Fixed | The context line is counted from the rows |
| T10 | Fixed | One preparation model: the recorded status and the pack state, labelled separately, from `meeting-facts.ts` in both tabs |
| T11 | Fixed | The archive reads `meeting_minutes` |
| T12 | Fixed | "AI preparing" is gone; `in-progress` reads "Preparation started" in a neutral tone |
| T13 | Fixed | The proposed classification is shown with its rationale and confidence, and `confirmed_triage` is respected |
| T27 | Fixed | Inbox sources are labelled "Simulated" in the queue summary and in each message's source line |
| J07 | Fixed | Selection, master and detail, URL state, and binding to the partner. Route at 59 lines |
| J08 | Fixed | Every row selects its item; detail links land on the named item (`item=`), process stage or object |
| J09 | Fixed | Conflicts shown, Day and Week views, linked process and object, no "Join" on focus blocks. The workshop's process stage itself is still locked until the process engine reaches it; that is `os-process-engine`'s |
| J11 | Fixed | Detail plus nine operations. Needs me and Waiting on others no longer overlap: a supplier-delivered action is in Waiting only |
| J12 | Partly | Rationale, linked action and decision, and the duplicate are now rendered. Conversion is the next workstream's (interface above) |
| J25 | Fixed | The dock fetches with the bound selection |
| R08 (Work) | Fixed | Demo and planned roles get the preview page on Work |
| U04 (Work) | Fixed | Dates are DD.MM.YYYY, times HH:MM; no raw ISO or "Z" in Work |

## Schema gaps found (no schema was changed)

1. `actions` has no completion condition. Today it is stored as an append-only `CC` entry in `action_updates`, and the latest one a person recorded wins. Proposed: `actions.completion_condition`, `completion_condition_by`, `completion_condition_at`.
2. `action_updates` has no entry kind. Today the kind is carried in the identifier prefix (`AUP-CMP-...`, `AUP-BLK-...`; see `ENTRY_KINDS`). Proposed: `action_updates.entry_kind`.
3. `actions` has no blocker field. Today blocked is derived from the latest entry's `status_after = "blocked"`. Proposed: `actions.blocked_reason` and `blocked_since`, or a `blocked` status value that every reader agrees on (Home's `OPEN_ACTION_STATUSES` does not include one).
4. `actions` has no source meeting. Today it is derived from `meeting_minutes.action_ids`. Proposed: `actions.source_meeting_id`.
5. `actions` has no source process run or stage. Today the detail shows the related process, found through scope membership of `related_object_id`, and its current stage. Proposed: `actions.source_process_run_id`, `actions.source_stage_id`.
6. `approvals` can only point at a decision. Work approvals are stored with `decision_id` null, and the subject is in the approval's audit detail. Proposed: `approvals.subject_kind`, `approvals.subject_id`.
7. `meetings` and `calendar_events` have no link to a process deadline. The dependency is derived from `meetings.subject_id` against `actions.related_object_id`. Proposed: `meetings.process_run_id` and `meetings.stage_id`, and `meetings.held_by_user_id` for the outcome's author.
8. There is no calendar write. Reserve focus time therefore stays a proposal with no action.
9. Not a database gap, but a contract one: `WorkdaySelection` and the chat route's schema have no `meeting`, `event` or `message` type. The partner is bound to the item's subject instead.

## Tests run

- `npx tsc --noEmit -p tsconfig.json`: clean, after removing my `.next-os-workhub` build directory and its `tsconfig.json` entries. While the build directory existed, its generated route validator disagreed with another workstream's new `/ops` layout.
- `npx vitest run tests/unit/work-actions.test.ts tests/unit/work-agenda.test.ts tests/unit/work-meetings-inbox.test.ts tests/unit/work-shell.test.ts`: 4 files, 73 tests passed.
- `npx vitest run tests/integration/work-hub-operations.test.ts`: 18 tests passed against a temporary database.
- Playwright `tests/e2e/work-hub.spec.ts` on port 3105 (`NFR_BASE_URL=http://localhost:3105`, `--output` in the scratchpad), at 1920, 1440 and 1366:
  - Agenda journeys: 12 of 12 passed.
  - Actions journeys: 10 passed and 2 skipped by design, because the closure runs once on a fresh seed and the later viewports find it already closed.
- `npm run check:copy`: passed.
- `node scripts/check-no-emdash.mjs`: no findings in my files. Two errors remain in `os-home-truth`'s `home-read-model` tests.
- `npm run scan:secrets`: passed.

## Screenshots

All in `docs/screenshots/os-excellence/os-workhub/`:

- **Before**: `before-*` (1920 and 1366).
- **After, English**: `after-en-*`:
  - agenda day with a conflicted workshop;
  - week view;
  - TPRM action detail;
  - RCSA action selected from another tab;
  - meeting detail;
  - minutes record;
  - inbox message;
  - drawer bound to a selected agenda entry.
- **After, German**: `after-de-*`, including the drawer bound to an action.

## Known limitations

- Blocked actions are not yet counted on Home (see the acceptance table). The function and the data are in place.
- The partner reads a meeting, entry or message through its subject (gap 9).
- Reserve focus time cannot be booked (gap 8).
- The Actions journey writes, so it needs a freshly seeded isolated stack to run all of its steps.
- **Duplicate detection.** It is deterministic and conservative: the same object and kind with some shared wording, or strongly similar titles. It is labelled "Possible duplicates".
- **Assigning to a person.** The list is the internal users. External contacts stay in `owner_label`, as delivered-by.

## What the user must run

- No migration and no reseed: no schema or seed file was changed.
- If the dev server on port 3000 was running while these files arrived, restart it once. The runtime registers tool handlers once per process, so a hot reload can keep an earlier registry. If an operation says "This operation is not registered with the authority gate", a restart is the fix.

## Shared files touched (surgical, additive)

- `src/server/security/authority.ts`: one commented block of seven tools after the stage completion tools.
- `src/components/workday-v3/WorkdayPanels.tsx`: drawer body conditional and two imports.
- `src/components/workday-v3/WorkdayPartnerDock.tsx`: the selection parameter and re-read on change.
- `src/styles/globals.css`: one `@import` line.
