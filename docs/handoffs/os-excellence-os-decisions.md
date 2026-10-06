# OS Product Excellence: os-decisions

J20 (critical) and J21 (high) fixed, J22 and J23 closed, and the decision page evolved from the four step Understand, Compare, Explain, Confirm stepper into the five-part decision workspace of plan section 4.10: Question, Context, Evidence, Options, Confirm and execute.

Plan references: section 4.10, 9.2, 9.5, 13.6 to 13.8. Audit rows: J20, J21, J22, J23 (and T22, T26 in part, see section 6).

No schema change and no migration. Everything new is derived from tables that already exist (see section 7).

## 1. J20: root cause and fix

### Root cause

Two places resolved "who acts" differently:

- `recordDecisionAndExecute` executed every consequence as `decision.roleId` (the decision's owner, for example `tprm`);
- `grantApproval` granted every approval as `state.activeRoleId`, the scenario's active role.

The V3.3 shell never switches the active role, because the role is the route (`/workday/tprm/...`). The seeded day starts as `rcsa`, so a Third-Party Risk Manager recording DEC-2026-0741 got three approvals granted by P-003 Marlene Aigner under role `rcsa`. The authority gate correctly refused every consequence with `approval-role-mismatch`.

The engine had already written the decision as `decided` before executing anything. The panel then showed a receipt whose only line was the pseudo line "Decision rationale recorded against DEC-2026-0741", counted as "1 change(s) executed", and `router.refresh()` unmounted it within seconds. Reproduced on the isolated stack before the fix: `before-j20-tprm-after-confirm-1440x900.png`, `before-j20-tprm-after-refresh-1440x900.png`.

### Fix (`src/scenario/engine/decide.ts`)

1. **One acting role.** A decision is executed as the role that owns it, and every approval is granted by that role's holder: `grantApproval` takes an optional `roleId`, and the engine always passes `decision.roleId`. The holder is read from the `roles` table (`roleHolderUserId`), the same place the workspace reads the approver's name, with the old constant map as fallback. A standalone `grantApproval` without a role keeps the active role (the trust page and the tool tests rely on it).
2. **Cross-role refusal.** Callers state who they act as (`actingRoleId`): the Decisions route sends the route role, the process engine sends the run's role. A different role is refused with `role-mismatch` before anything is written.
3. **Plan before writing.** `planDecisionOption` maps every declared consequence to its tool, exact payload and gate fingerprint, and asks the gate about each with a prospective approval that has every property of the real one. The engine re-plans at confirm time and refuses, writing nothing, when the decision is already recorded (`already-recorded`, J22), the fingerprints the person approved differ from the plan (`payload-changed`), or the gate would refuse any change, including a consequence kind with no tool (`consequence-refused`). A decision is no longer put on the record with changes that were never going to run.
4. **Outcome stated separately.** After executing, the engine writes one outcome record (audit action `recordDecisionOutcome`, category `system`) listing every consequence as executed, blocked, failed or not attempted, with its reason, approval and receipt lines. `ok` is true only when everything executed; `recorded` says whether the decision row was written. `receiptStatements` holds real receipt lines only; the pseudo line is gone.
5. **Event backbone.** The engine publishes `decision-recorded:<decisionId>` (the key the process engine already uses for seeded decisions), with the process run and stage when an installed stage contract binds the decision, linked to the `recordDecision` audit row.

A change that fails for a reason the plan cannot see (a handler error, a vanished target) still leaves the decision recorded, because the judgment was made; the failure is on the outcome record and in the receipt, never only in a log line.

### Process engine (surgical)

`src/features/process/decisions.ts`, `recordSeededDecision`: the guard that refused a seeded decision while the shell acted as another role was a workaround for this defect and is removed. The call now passes `actingRoleId: context.roleId`, and the refusal branch tests `!result.recorded` (it tested "no receipt statements", which only worked while the pseudo line existed). Its test in `tests/integration/process-engine.test.ts` ("refuses a seeded decision while the shell acts as another role") is rewritten to the new truth: recorded, approvals by P-003 under `rcsa`, every change executed. Verified in the browser: the process engine's own `tests/e2e/os-process-engine.spec.ts` passes on port 3107 with the scenario's active role set to `tprm`, and RCSA Stage 2 records DEC-2026-0771 inline under P-003.

## 2. J21: the receipt persists

- The receipt is rendered from the database on every render: executed changes from `execution_receipt_lines`, the changes that did not execute from the outcome record (`getDecisionOutcome` in the new `src/db/repositories/decisions.ts`).
- A decision recorded before the outcome record existed (for example the J20 record already in the shared database) is read from its approvals and the tool calls that consumed or failed to consume them, so it renders honestly as "3 refused by the authority gate".
- Counts are real lines only: the queue row's `receiptCount` is the number of `execution_receipt_lines` rows, and "Executed" lists one entry per executed change, each backed by at least one real line with its audit event.
- The receipt stays in the panel where the person pressed Confirm and execute, after `router.refresh()`, after a reload (the address carries `#DEC-...`), and can be reopened from "Recorded today", whose rows are now buttons.
- A partial result never carries a success mark: the outcome line is a warning with both counts ("3 of 4 changes executed, 1 did not execute").

## 3. The five-part workspace

`src/features/decisions/` (model, copy, queue, actions, DecisionQueue, DecisionStages, DecisionReceipt) and `src/styles/workday-v3-decisions.css`. Same V3.3 look, same queue and single active panel, same information budget: at 1366x768 the forward control or the confirm action is on screen in every part, measured in every capture.

| Part | What it shows | Source |
|---|---|---|
| 1 Question | The professional question; judgment kind and reference; the four facts of plan 9.5: what the AI prepared, what you decide, what will change, what approval is required | `decisions.question`, the plan of every option |
| 2 Context | Why it exists (trigger) and when it arrived; the process stage waiting on it, linked, with its state; the meeting on the same subject, linked to the Work Hub; the affected object; the deadline with its basis; the current position on record | Stage contract binding (`src/scenario/engine/decision-links.ts`), `meetings`, `inbox_messages.requires_response_by`, the object's register |
| 3 Evidence | Strongest supporting and opposing document (title, source system, date, provenance, summary); conflict state with counts; stale sources with the staleness note; missing or unresolved citations; stated uncertainty; what the AI prepared, labelled; all cited evidence on demand | `evidence_documents` |
| 4 Options | Each option's implication, the registers it writes, how many approvals by whom, and a warning when the gate would refuse a change. Nothing is pre-selected; Next stays disabled until a choice | The engine's plan |
| 5 Confirm and execute | Your choice; your rationale (empty, minimum 20 characters, enforced on the server); rationale ownership ("I confirm this rationale is mine", recorded as the named holder's); every change with its register, exact target and exact payload, each approved separately; the approver and autonomy level; one action; the reason Confirm is disabled | The engine's plan, the roles table |

After confirming, the same panel shows the receipt: outcome line, Executed and Not executed side by side, the rationale and its owner, the approvals and their approver, and the links back to the process stage and the meeting.

Other changes:

- **Server action** `src/features/decisions/actions.ts` (`actionConfirmDecision`): states the route role, enforces the rationale minimum server side, sends the approved fingerprints, revalidates the role's workday, answers in the reader's language. `app/actions.ts` is untouched and still serves V1 and V2.
- **Deep links select (J23).** `/decisions#DEC-...` selects the named decision, open or recorded, on arrival and on hash change, and brings the panel into view. Home, Updates and the AI Partner already link this way.
- **Stage decisions in the queue.** The process engine exposes stage decisions cleanly through `buildStageContext` (read only), so the queue lists open stage decisions under "Waiting in a process stage", for example the TPRM Stage 4 gate, with the process and stage, whether the stage can take it now, and a link to the stage. They are recorded in the stage, where the evidence dispositions they depend on are recorded. The context line counts them separately ("3 open, 1 in a process stage, 0 recorded today"); the header badge (os-shell) counts the open queue rows only, which is what `os-shell.test.ts` asserts.
- **German.** Every new string is bilingual, ASCII German. The receipt composes German lines from German labels and the created record's identifier instead of showing the handlers' English sentences. Seeded decision prose (question, context, evidence summaries, option implications, payload text) has no German form in the seed; German readers are told so on the Question part and the prose is marked `lang="en"`.
- `docs/SECURITY_AND_AUTHORITY.md` section 7.2 and limitations 4 and 5 updated surgically to match the engine.

## 4. Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| J20 fixed: executed as the owning role, approved by its holder | Met | `decision-workspace.test.ts` "records a TPRM decision while the scenario's active role is still rcsa" (3 approvals by P-002 under `tprm`, 3 executed, 0 blocked) and the RCSA mirror; Playwright "tprm: recording executes every change under the Third-Party Risk Manager's own approval (J20)"; DB after the browser run: approvals P-002 `tprm`, tool calls all `executed` |
| Never `decided` with failed consequences unshown; successes and failures separate | Met | Pre-flight refusals write nothing (`writes()` fingerprint unchanged, 7 tests); partial failure test: recorded, 2 executed, 1 failed, outcome record present, workspace shows both lists in EN and DE after a rebuild; `partial-tprm-7-receipt-after-reload-1366x768.png` |
| Integration tests for both roles, cross-role refusal, partial failure | Met | `tests/integration/decision-workspace.test.ts` (21 tests), `decisions.test.ts` attribution block rewritten (2 tests) |
| Stage workspace works after the fix | Met | Guard removed surgically; `process-engine.test.ts` 30 passed; `os-process-engine.spec.ts` 2 passed on port 3107 with active role `tprm` |
| J21: receipt persists, read from `execution_receipt_lines`, counts only real lines | Met | J21 tests per role; legacy record test; Playwright reloads and still sees "3 of 3 changes executed"; `after-*-7-receipt-after-reload-*.png` |
| No option is preselected | Met | Playwright asserts `aria-checked="true"` count 0 on arrival at Options and Next disabled, both roles, all three viewports; Confirm shows "Choose an option to continue" without a choice. The earlier capture with a choice filled in came from the presentation capture script, which clicks the recommended option itself (`asset-registry.ts`, setup step "Select the recommended option"); the product never preselected |
| Human rationale mandatory | Met | Empty textarea, nothing pre-written; 20 character minimum client and server ("enforces the rationale minimum on the server"); ownership confirmation; engine refuses empty |
| Exact target systems visible | Met | Every change shows register and target id; the exact payload states "This workspace, local record. No external system is written."; options list their registers |
| Decision links back to process and meeting | Met | Context part and receipt; DEC-2026-0771 links to RCSA Stage 2 and MTG-2026-0006; TPRM decisions state honestly that no running process waits on them and link their supplier meeting; Playwright follows the receipt's stage link and the stage shows the decision |
| Approval binds to exact payload | Met | One approval per change, each ticked separately; fingerprints sent and compared by the engine (`payload-changed` refusal when one is missing or the seed moved); approval rows carry exactly the approved fingerprints |
| Receipt shows successful and failed consequences separately | Met | Executed and Not executed columns with counts, reasons and outcome labels |
| Stage decisions in the queue | Met (listed, recorded in the stage) | TPRM Stage 4 gate under "Waiting in a process stage" with a link; test "lists the TPRM Stage 4 gate" |
| EN and DE | Met | `after-de-*` captures; copy tests (both languages, ASCII German, no em or en dash, built models EN and DE) |
| No overflow at 1920x1080, 1440x900, 1366x768 | Met | Playwright asserts main, document and panel `scrollWidth <= clientWidth` on every part at all three; capture script measured every screenshot |
| tsc clean | Met for all source | See section 5 |
| vitest including `npm run test:integration` | See section 5 | |
| Playwright journey per role on my port | Met | `tests/e2e/os-decisions.spec.ts`: 8 passed, 4 skipped by design (writing journeys run once) |
| check:copy, check-no-emdash, scan:secrets | Met | Section 5 |

## 5. Tests run

| Command | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | clean (exit 0) at the final run. Earlier in the day another workstream's generated `.next-os-shell` types briefly stopped tsc with a syntax error; a scratch config over `src`, `app`, `scripts` and `tests` only was used meanwhile and is also clean |
| `npx vitest run tests/integration/decision-workspace.test.ts tests/integration/decision-queue-v3.test.ts tests/integration/decisions.test.ts` | 3 files, 87 passed |
| `npx vitest run tests/integration/process-engine.test.ts` | 30 passed (first attempt timed out in `beforeAll` under machine load; passed with `--hookTimeout=180000`) |
| `npx vitest run tests/integration` (full suite, the `test:integration` script) | 18 files, 421 passed. Run with `--hookTimeout=180000 --testTimeout=180000` because the machine was running several other workstreams' servers and suites; with the default 30 s hook timeout, `process-engine.test.ts` timed out once in `beforeAll` before any test ran |
| `npx vitest run tests/unit` | 33 files: 923 passed, 1 failed in `tests/unit/work-meetings-lifecycle.test.ts` (an action title from minutes, "clause 2.1" against "clause 2"), which belongs to os-meetings' work in progress and does not touch decisions |
| `npx playwright test os-decisions.spec.ts` on http://localhost:3107 | 8 passed, 4 skipped (writing journeys only in the 1920 project). A final rerun after three display-only changes (refused changes shown with a warning instead of "runs within policy", the reason Confirm is disabled for a refused option, a taller change list on tall screens) and the German receipt and title wording was cut short when the isolated dev server reached its two hour background limit; those changes were exercised afterwards by the scripted journeys that produced the `refused-*`, `partial-*` and `after-de-tprm-*` captures, which record a decision through the same UI |
| `npx playwright test os-process-engine.spec.ts --project=desktop-1920` on 3107, active role `tprm` | 2 passed (the first attempt failed once on TPRM Stage 4 during a cold compile; the rerun on a fresh seed passed both) |
| `npm run check:copy` | passed |
| `node scripts/check-no-emdash.mjs` | passed; no finding in my files (the warnings listed are pre-existing seed percentages) |
| `npm run scan:secrets` | passed |

Playwright used a scratch config without the `webServer` block, because the repository config starts `npm run start` on port 3000 when its health URL is slow.

## 6. Screenshots

`docs/screenshots/os-excellence/os-decisions/`:

- Before: `before-{rcsa,tprm}-{1920x1080,1366x768}.png` (the four step stepper), `before-j20-tprm-after-confirm-1440x900.png` (approvals refused, pseudo line counted), `before-j20-tprm-after-refresh-1440x900.png` (receipt gone).
- After, both roles at 1920x1080 and 1366x768: `after-<role>-1-question`, `-2-context`, `-3-evidence`, `-4-options`, `-5-confirm-empty`, `-5-confirm-ready` (exact change open), `-6-receipt`, `-7-receipt-after-reload`.
- German: `after-de-tprm-*-1366x768.png` (all parts and the receipt), `after-de-rcsa-*-1920x1080.png` (all parts).
- `partial-tprm-{6,7}-receipt*-1366x768.png`: a change that failed while executing, shown under Not executed after a reload.
- `refused-tprm-{4-options,5-confirm-ready}-1366x768.png`: an option the gate would refuse; Confirm disabled with the reason.
- `after-landing-tprm-1440x900.png`: the queue with the Stage 4 gate.

## 7. Schema

No schema change, no migration. What the workspace needs is derived:

- the outcome of a decision: the `recordDecisionOutcome` audit row's `detail` (append only), with approvals and tool calls as the fallback for older records;
- the deadline: the earliest `inbox_messages.requires_response_by` on the decision's subject, shown with the message as its basis, or "No deadline is recorded for this subject";
- the process stage: the installed stage contract's seeded-decision binding and the active run;
- the meeting: same role, same subject, or at least two shared cited documents.

Optional, for the coordinator to route into a later migration (not required for anything here):

| Table | Column | Type | Purpose | Code that would read it |
|---|---|---|---|---|
| `decisions` | `due_at` | `text` (ISO timestamp), nullable | A deadline recorded on the decision itself, instead of the one derived from the inbox | `deadlineFor` in `src/features/decisions/queue.ts` |

## 8. Known limitations

- Seeded decision prose is English only, so German pages show the question, the trigger, evidence titles and summaries, option implications and payload text in English (labelled, and marked `lang="en"`). Translating the seed is a data task.
- Stage decisions (TPRM Stage 4 gate) are listed and linked, but recorded in the stage workspace, not in the Decisions panel. Recording them here would duplicate the stage's own form and its evidence dispositions.
- The V1 and V2 decision flows (`app/actions.ts`, `DecisionFlow.tsx`) still send one confirmation for all changes; they benefit from the engine fixes (owning role, pre-flight, outcome record, no pseudo line) but not from per-change approval.
- The released deck's capture registry (`src/presentation-v2-4/product-proof/asset-registry.ts`) expects the four step labels and the `.wd-dq-authority` block. The released assets are unaffected; re-running that capture would fail its expected text (the process engine handoff notes the same for its stages).
- A recorded decision's handler statements are English; German receipt lines are composed from German labels. `execution_receipt_lines.statement_de` stays empty.
- The authority gate's own refusal sentences are shown verbatim in English; in German they are translated by denial code.
- Header badge semantics belong to os-shell; it counts open queue rows, not stage decisions.
- Migration 0005 (os-meetings) adds `approvals.target_kind` and `target_id`. `grantApproval` does not set them yet; once the gate compares targets, the decision engine is the natural place to set `target_kind = 'decision'` and `target_id = decisionId`. Coordinate with os-meetings rather than setting them ahead of the gate rule.

Isolated stack: port 3107 on `<scratchpad>\os-decisions.db` (migrated to 0004, then 0005 when os-meetings added it, and reseeded before every writing run). The dev server has stopped, `.next-os-decisions` is removed, and the two `include` lines Next added to `tsconfig.json` for it are removed. Nothing was written to `data/nfr-workos.db`, and nothing was clicked on port 3000.

## 9. What the user must run

Nothing for this workstream: no migration and no seed change. The shared database still holds the J20 record for DEC-2026-0741 from the audit run; the new receipt reads it from its approvals and tool calls and shows the three refused changes. `npm run demo:reset` (with the dev server stopped, as the process engine and os-meetings handoffs require for 0004 and 0005) reopens it.

## 10. Files

Owned, changed or added:

- `src/scenario/engine/decide.ts` (acting role, plan, refusals, outcome record, backbone event)
- `src/scenario/engine/decision-links.ts` (new: stage binding of a decision)
- `src/db/repositories/decisions.ts` (new: outcome and subject reads)
- `src/features/decisions/model.ts`, `copy.ts`, `queue.ts`, `DecisionQueue.tsx`, `DecisionStages.tsx` (rewritten), `actions.ts`, `DecisionReceipt.tsx` (new)
- `src/styles/workday-v3-decisions.css`
- `app/workday/[role]/decisions/v3.tsx` (docblock only)
- `tests/integration/decision-workspace.test.ts` (new), `tests/integration/decision-queue-v3.test.ts` (rewritten for five parts), `tests/integration/decisions.test.ts` (attribution block)
- `tests/e2e/os-decisions.spec.ts` (new)

Other workstreams' files, edited surgically:

- `src/features/process/decisions.ts` (os-process-engine): guard removed, `actingRoleId`, `!result.recorded`
- `tests/integration/process-engine.test.ts` (os-process-engine): one test rewritten to the new behaviour
- `docs/SECURITY_AND_AUTHORITY.md`: section 7.2, limitations 4 and 5
