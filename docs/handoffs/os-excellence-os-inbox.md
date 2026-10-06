# OS Excellence: os-inbox handoff (plan section 4.8)

One unified inbox that turns communication into governed work, with lineage in both directions. Synthetic institution and data.

## What changed

- **Six sources, labelled honestly.** Mail, collaboration, GRC queue, monitoring event, service-management update and supplier submission (`modules/inbox/sources.ts`).
  - The seeded rows carry five transport channels. A supplier submission is derived: a message from an external person in the scenario's register, about a supplier, service, subcontractor, arrangement or evidence document. The transport stays beside it ("Supplier submission, by Mail").
  - Every source is labelled Simulated: in the facts, in the queue summary ("Sources simulated") and in the freshness footer ("No connector delivered it"). No connector delivers inbox rows in this release; the Microsoft 365 and GRC connectors are simulated projections of the same seeded rows.
- **AI classification through the AI layer, never without its rationale** (`triage.ts`, `triage-schema.ts`).
  - The same branch the process engine runs for a stage preparation. Safe mode serves the proposal captured with the message before the day (`proposed_triage`, `triage_rationale`, `triage_confidence`). Offline mode composes one from the message's own facts with ten ordered rules, each naming the fact it rests on. Live is not connected for the inbox and is served as safe, and the note says so. No model is called.
  - Every candidate passes one Zod schema plus a content validator: one of the six classifications, a rationale present, every cited identifier held by the message context, and the copy rules (no em or en dash, no double hyphen, no umlaut in German, no internal technology terms). A captured proposal that fails falls through to the offline composition, which says so. When nothing passes, the message shows "Not classified" and says why; it never shows a classification without a reason.
  - The detail shows the classification, the confidence (or "Confidence not estimated" offline), the mode (Safe, Offline, Unavailable) and its note. The queue chip carries the rationale as its title.
  - The person's classification is shown beside the AI's proposal, never in place of it, with who recorded it, when and, for a change, the reason.
- **Eight facts and one primary action for every message.** Source, sender, subject, linked object, proposed classification, rationale, response deadline (warning, danger once passed) and one primary action, in the role's words where the action is the one the classification implies.
- **Nine governed operations** (`operations.ts`, `tools.ts`): Confirm triage, Change triage, Create action, Link as evidence, Add to process, Delegate, Draft reply, Send simulated reply, Dismiss.
  - Each runs server action, operation, `runGoverned`, gate, handler, audit, in the Work Hub's pattern. Every form states what the AI prepared, what the person decides, what will change and what approval is required.
  - **Message to action** uses the existing governed `createAction` tool with `sourceMessageId`, then `linkInboxMessage`. Raising an action is material: an explicit confirmation and a reason are required, and an unconfirmed request writes nothing and records no approval. The owner must be an internal person, the kind one the role configures, and the due date on or after the scenario day. A message about an open action on the desk can be linked to it instead, which appends an entry to that action's history.
  - **Message to evidence** files one document per message, `EVD-<message id>`, `source_type` "correspondence", with `source_message_id` set, the message's provenance (a person's statement, or telemetry for system channels) and a retrieval chunk, so evidence search finds it. It is filed against the objects the message or the role's running processes concern, and against nothing else.
  - **Message to process** attaches the message to an open stage of the role's own running process through the backbone (a `work-arrived` event on that run and stage), then brings the stage up to date through the process engine's public API: `routeRoleRefusal` before anything is written, `buildStageContext` and `syncStage` after. No engine table is written. The stage workspace's "Recent events" lists the message. A stage that does not cover the message's object is still offered, with a warning naming the object.
  - **Delegate** sends a simulated internal message to an internal colleague. The colleague the rationale names (for example P-010 on the A2 indexation notice) is suggested first, never pre-chosen silently.
  - **Draft reply** is a DRAFT tool that writes nothing. It is composed from the message and from what has actually been done with it, and validated. **Send simulated reply** records a simulated collaboration message to the sender. Nothing leaves the machine. Drafting is reachable at a lower autonomy level than sending, so the two carry separate gate verdicts.
  - **Dismiss** records the message as noise with the person's reason (none needed when the AI proposed noise).
- **Three places, each message in exactly one** (`lineage.ts`): Needs me, Converted to work, Handled, plus All.
  - Lineage is read from the objects the message became: `linked_action_id` and `actions.source_message_id`; `linked_decision_id`; `evidence_documents.source_message_id`; the backbone event on the stage; the simulated delegation or reply that points at the message.
  - Needs me has a second, quiet group, "Proposed as noise". The AI never clears a message by itself; a person dismisses it.
- **Lineage both ways.**
  - The message shows "What it became", with links, who and when.
  - The action shows "Where it came from: Source message", and its history starts "Raised from inbox message IMSG-...".
  - Every evidence list in the Work Hub and the drawer appends "filed from message IMSG-..." to a document filed from a message (shared `evidenceRef`).
- **After conversion** the message leaves Needs me and appears in Converted to work; the destination updates (an action exists with its CRT entry, a document is filed, the stage lists the message); Home updates through `revalidateWorkday(roleId, "inbox")`; and one event is published on the backbone, linked to its audit row.
- **Search.** Handled and converted messages stay searchable through the shell's palette. `readInboxSearchEntries` (`modules/inbox/search.ts`) is the clean read; the shell's index takes it as a new kind, `message`. A message opens in the inbox view that holds it, and is found by its subject in both languages, its sender, its source, its linked object and the identifiers of what it became.
- **No static inbox data remains.** The last fixed sentence ("Proposal only. The classification is not changed from this view.") is gone with the read only view.

## Files

| Area | Files |
|---|---|
| Inbox module (owned) | `src/features/work/modules/inbox/`: `read-model.ts` (rewritten), `copy.ts` (rewritten), `load.ts` (rewritten), new `sources.ts`, `triage-schema.ts`, `triage.ts`, `reply.ts`, `lineage.ts`, `tools.ts`, `operations.ts`, `search.ts`, `tool-names.ts` |
| Components (owned) | `src/components/work/InboxDetailView.tsx` (rewritten), new `src/components/work/InboxOperations.tsx` (client) |
| Repository (owned) | new `src/db/repositories/inbox.ts` (reads only) |
| Server actions | new `app/workday/[role]/work/inbox-actions.ts` (thin; kept apart from `actions.ts` so the meetings workstream and this one did not edit one file) |
| Tests | new `tests/unit/work-inbox.test.ts`, `tests/integration/work-inbox-operations.test.ts`, `tests/e2e/os-inbox.spec.ts` |

### Shared files edited surgically

- `src/server/security/authority.ts`: one commented block of seven tools after the meeting lifecycle tools. `draftInboxReply` is DRAFT; the other six are POLICY_BOUND_AUTONOMOUS, routine and reversible. None is in `TOOL_SCHEMAS`, so the model is never offered them. Raising an action stays on the existing material `createAction`.
- `src/features/work/governance.ts`: imports the inbox handlers; the inbox tools join `NOT_PUBLISHED_HERE` (their handlers publish their own event inside their transaction); an optional `publish?: boolean` on `GovernedContext` (default true), so the `createAction` step of a conversion is not published a second time: the link step publishes the one account, with the action as subject and the message as correlation.
- `src/features/work/modules/index.ts`: `INBOX_MODULE.toolNames` and `tabCount` with extras.
- `src/features/work/hub-data.ts`: the inbox tools in `hubToolNames()`.
- `src/features/work/hub.ts`: `countInbox(shared, extras.inbox)`.
- `src/features/work/url.ts`: `INBOX_VIEWS` gains `converted`; `needs-triage` keeps its parameter value for kept links.
- `src/features/work/freshness.ts`: `evidenceRef` reads an optional `sourceMessageId` and says where the document came from.
- `src/features/work/modules/actions/read-model.ts` and `src/components/work/ActionDetailView.tsx`: `sources.message` from `actions.source_message_id`, shown under "Where it came from" and in Related work.
- `src/components/work/ModuleDetail.tsx`: passes `roleId` to the inbox detail.
- `src/features/work/roles/third-party-risk.ts`: the missing `regulatory-change` object label (the linked object read "regulatory-change: REG-2026-0031").
- `src/features/search/types.ts`, `copy.ts`, `read.ts`: the `message` kind, its two labels, its place in each role's order, and one guarded read of `readInboxSearchEntries`.
- `tests/unit/support/work-fixtures.ts`: the default triage rationale is a sentence (the old "Because." fails the new validator, correctly), and `openGate()` includes the inbox tools.
- `tests/unit/work-meetings-inbox.test.ts`: the inbox block asserts the new places (a linked message is Converted to work, proposed noise is its own group).

## Governance

- **Path.** Server action, operation, `runGoverned`, `evaluateAuthority`, `executeTool`, handler. At the default autonomy level (act with approval) each routine step records a payload bound approval in the role holder's name, targeted at the message (`approvals.target_kind = 'inbox-message'`), consumed once.
- **Refusals are audited.** An operation the message itself rules out (already converted, no open stage, no reply address) is refused before the gate, in the pane's words. An operation the gate rules out goes to the gate, which writes the blocked attempt. The integration test asserts the blocked audit row at the Prepare level.
- **Facts the gate cannot see, checked in the handler:** the message is in the acting role's inbox and has arrived by the clock; an action linked as raised names the message as its source; an existing action is open and on the desk; a decision is open and in front of the role; evidence is filed once and only against objects the message or the role's processes concern; a stage is the role's own and open; a delegate is internal; a reply has a person to go to.
- **AI may and may not.** The AI proposes a classification and drafts a reply. It does not convert, file, delegate, dismiss or send: every one of those is the person's step, and the interface says so under the operations.
- **Events.** One per change, published in the handler's transaction under an idempotency key built from the message (`inbox-triage:<id>:<n>`, `inbox-converted:<id>:<kind>:<target>`, `inbox-reply:<id>:<message>`), correlated to the message, and linked to the audit row the runtime wrote. The payload carries identifiers, classifications and the person's own reason, never the message text. Types: `tool-executed` for a triage and a reply; `work-arrived` for a conversion (subject: the action, the evidence document, the decision, or the message with the process run and stage); `action-updated` for a link to an existing action. Updates and Home do not raise items from these types, so nothing becomes noise there.

## Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| Classification is editable | Met | Change triage with a reason (required when it departs from the proposal). Integration "needs a reason for a classification other than the proposal"; Playwright "dismisses proposed noise and changes a classification with a reason" |
| Classification has a rationale | Met | Validator refuses a missing or empty rationale; a failed proposal falls through to offline composition or shows "Not classified" with the reason. Unit "never shows a classification without its rationale"; the validator and AI layer tests |
| Message-to-action works | Met | Integration "raises the action with the message as its source, links both ways, and publishes one account of it"; Playwright TPRM and RCSA journeys |
| Message-to-evidence works | Met | Integration "files one document with the message as its source, indexed for retrieval, and refuses a second"; Playwright |
| Message-to-process works | Met | Integration "attaches to the role's own open stage through the backbone, once, without writing the engine's own records" and the refusals; Playwright follows the stage link and finds the message in the stage's events. Screenshot `after-en-tprm-stage-shows-message-1920x1080.png` |
| Lineage is visible | Met | Message: "What it became". Action: "Where it came from: Source message" and the CRT history entry. Evidence: "filed from message ...". Screenshots `after-en-tprm-converted-to-action-*`, `after-en-tprm-action-source-message-*` |
| Handled messages remain searchable | Met | `message` kind in the palette's index. Integration "keeps handled and converted messages searchable"; Playwright reads `/api/workday/search` after the journey |
| Leaves Needs me, appears in Converted to work | Met | Integration and Playwright assert both views |
| Home updates | Met | `revalidateWorkday(roleId, "inbox")` on every write; Home's inbox count follows (integration asserts `needsAttention` drops by one; Playwright compares the Home cell before and after) |
| Event on the backbone | Met | Integration asserts one event per change, its type, subject, correlation and audit link |
| Six sources, Simulated | Met | Unit "labels the six source kinds, and every source as simulated"; Playwright "Supplier submission, by Mail, Simulated" |
| AI layer, safe and offline, schema validated | Met | Unit tests for safe, live served as safe, fall back, offline, unavailable |
| No static inbox data | Met | No fixed message, count or sentence remains in the module or components |
| EN and DE | Met | Every string bilingual and ASCII. Screenshots `after-de-*`. Seeded rationales were written in English only; German shows them with "Mit der Nachricht auf Englisch erfasst." The offline composition is bilingual |
| No overflow at the three viewports | Met | Playwright layout tests at 1920x1080, 1440x900 and 1366x768, EN and DE, with a message and a form open |
| tsc, vitest, Playwright, check:copy, check-no-emdash, scan:secrets | Met | See Tests |

### Audit rows in this scope (`docs/handoffs/os-excellence-audit.md`)

| Row | Status | What changed |
|---|---|---|
| J12 (high): the inbox is display only | Fixed | Triage editable with a rationale; nine governed operations; `linked_action_id` and `linked_decision_id` written and rendered; message to action, evidence and process with lineage; Review no longer reloads the tab |
| T13 (medium): seeded triage presented as AI output with no rationale | Fixed | The proposal is served through the AI layer, validated, labelled with its mode (Safe, prepared before the day), shown with its rationale and confidence; the person's classification is shown beside it |
| T27 (medium): no "Simulated" label against the integration state | Fixed | Every source labelled Simulated in the facts, the summary and the footer |
| T03 (high, Home): inbox tile fell back to a fixed number | Unchanged here, already fixed by `os-home-truth`; the tile now drops as messages are converted (asserted) |
| U04 (Inbox): raw ISO timestamps | Fixed earlier by `os-workhub`; every new date here is DD.MM.YYYY and every time HH:MM |

## Schema needs (no schema was changed by this workstream)

The message row holds the triage and the action or decision link. Everything else is derived from the objects the message became and from the backbone.

While this work was running, the data-model workstream's migration 0006 added `inbox_messages.converted_by_user_id` and `converted_at`, defined as the first link to an action or a decision, and backfilled from this module's `inbox-converted:<message>:` events. `linkInboxMessage` now writes both, once, in the same transaction as the link, and the lineage reads them when no event can be read. My isolated database took 0006 (`migrate`, then `seed`) and every test below ran against it.

Remaining requests for the next migration:

1. `inbox_messages.conversion_kind`, and a decision whether `converted_*` should also cover evidence, process and delegation conversions. This module's Converted to work includes all five; the 0006 columns are written for action and decision links only, as the column's own definition says.
2. `inbox_messages.triage_confirmed_by_user_id`, `triage_confirmed_at`, `triage_reason`. Today: the `tool-executed` triage events (`payload.from`, `to`, `reason`); the detail says "Recorded on the message" when no event exists.
3. `inbox_messages.linked_evidence_document_id`. Today: `evidence_documents.source_message_id`.
4. `inbox_messages.linked_process_run_id` and `linked_stage_id`, or better, an engine-owned stage input table (`role_app_stage_inputs`: stage run, source kind, source id, attached by, attached at). Today: the `work-arrived` event on the run and stage. Stage sources and completion criteria cannot read an inbox input until the engine has one.
5. `inbox_messages.delegated_to_user_id`. Today: the simulated collaboration message in channel "Inbox delegation".
6. `collaboration_messages.kind` (delegation, reply, reminder, distribution). Today: the channel name convention ("Inbox delegation", "Inbox reply").
7. Optional: `inbox_messages.proposal_mode` and `proposed_at`, if a live or re-run classification should be stored rather than recomposed.

## Tests run

| Command | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | clean (exit 0) at the final run. Mid-session runs showed errors only in other workstreams' half-written build directories and in-progress files (`release-management.ts`, `data-model-repositories.test.ts`); none in this workstream's files |
| `npx vitest run tests/unit/work-inbox.test.ts` | 32 passed (validator, AI layer, sources, lineage, read model, search entries, reply draft) |
| `npx vitest run` on the inbox unit and integration files with `work-meetings-inbox`, `work-shell`, `work-actions`, `os-shell-search`, `authority` | 7 files, 155 passed |
| `npx vitest run tests/integration/work-inbox-operations.test.ts` | 18 passed, against a temporary database |
| `npx vitest run tests/integration/meeting-lifecycle.test.ts work-hub-operations.test.ts migration-0006.test.ts live-day-flows.test.ts` | 4 files, 76 passed (the governance edit is shared with the meeting lifecycle) |
| `npx vitest run tests/integration/os-shell.test.ts home-read-model.test.ts` with `work-hub-operations` | 3 files, 58 passed (search now has thirteen kinds; Home's inbox count) |
| `npx vitest run tests/unit` | 36 files, 1004 passed and 12 failed, all 12 in `integration-runtime.test.ts` from one `beforeAll` hook timeout (30 s) while the machine was loaded; rerun alone: 37 of 37 passed |
| Playwright `tests/e2e/os-inbox.spec.ts` on http://localhost:3112 (`NFR_BASE_URL`, `NFR_DB_PATH` at the isolated database, `--output` in the scratchpad) | 13 passed, 14 skipped by design (the write journeys run once, in the 1920 project; the layout tests run in all three) |
| `npm run check:copy` | passed |
| `node scripts/check-no-emdash.mjs` | passed (no finding in this workstream's files; an earlier run failed only on placeholders in another workstream's in-progress handoff) |
| `npm run scan:secrets` | passed |

The isolated stack: `<scratchpad>\os-inbox.db`, migrated to 0006 and seeded; `next dev -p 3112` with `NFR_DIST_DIR=.next-os-inbox` and `NFR_DEMO_MODE=safe`. The server was stopped and `.next-os-inbox` removed afterwards, with its two `tsconfig.json` include lines.

## Screenshots

`docs/screenshots/os-excellence/os-inbox/`:

- **Before** (the read-only inbox as `os-workhub` left it, copied from its captures): `before-en-tprm-inbox-IMSG-2026-0001-{1920x1080,1366x768}.png`, `before-de-rcsa-inbox-IMSG-2026-0021-{1920x1080,1366x768}.png`.
- **After, English**: `after-en-tprm-needs-me`, `after-en-tprm-converted-to-action` (also 1366x768), `after-en-tprm-action-source-message`, `after-en-tprm-linked-as-evidence`, `after-en-tprm-added-to-process`, `after-en-tprm-stage-shows-message`, `after-en-rcsa-added-to-process`, `after-en-rcsa-converted-to-work` (1920x1080), and `after-en-{tprm,rcsa}-message-form` at all three viewports.
- **After, German**: `after-de-{tprm,rcsa}-message-form` at all three viewports, `after-de-tprm-converted-evidence-reply-1920x1080`, `after-de-rcsa-added-to-process-1366x768`.

Every capture reported no document, main or detail overflow.

## Known limitations

- **Triage attribution lives on the backbone**, not the row (schema need 2). A triage recorded with no readable event shows "Who recorded it is not held on the message itself." Conversion attribution for an action or decision link is also on the row since 0006.
- **A stage does not read its inbox inputs.** The attachment is a backbone event on the run and stage, listed in the stage's Recent events. The engine has no stage input command; schema need 4 is the request to the process engine owner.
- **Live classification is not connected.** Safe serves the captured proposals; offline composes. The offline composer is conservative and does not estimate a confidence.
- **Seeded rationales are English only.** German shows them with a note.
- **One action per message.** A second action from the same message is refused; the lineage is one to one with `linked_action_id`.
- **Receipt lines are English**, as every Work Hub receipt is.
- **Supplier submission** is derived from the sender's record and what the message is about; there is no supplier portal channel in the seed.
- The integration and Playwright write journeys need a freshly seeded isolated stack (the spec reseeds its own database).

## What the user must run

- This workstream changed no schema and no seed file.
- The inbox reads and writes `inbox_messages.converted_by_user_id` and `converted_at`, which the data-model workstream's migration 0006 adds; every inbox read fails on a database without it (the shared Drizzle schema selects the columns). With the dev server on port 3000 stopped: `npm run db:migrate`, then `npm run demo:reset`, as that workstream's handoff will say.
- Restart the dev server on port 3000 once, so the runtime registers the seven new tool handlers (a hot reload can keep an earlier registry; "This operation is not registered with the authority gate" means a restart is due).
