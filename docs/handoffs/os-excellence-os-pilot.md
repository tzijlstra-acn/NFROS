# Handoff: os-pilot (Wave 4, section 7.7; Wave 5 pilot readiness; section 12)

The design-partner pilot workspace at `/product/pilot` and the Value view at `/product/value`, inside the Product Owner Console shell built by os-console-core. Synthetic institution and data throughout.

Isolated stack: port 3117, database `<scratchpad>\os-pilot.db` (migrated through 0008, seeded), dist dir `.next-os-pilot`. Nothing was written to `data/nfr-workos.db`; nothing was clicked on port 3000. No schema change.

## 1. What changed

### Pilot workspace (`app/product/pilot/**`, logic in `src/features/product/pilot/**`)

Route files are one line each; pages are `views/PilotPages.tsx`.

| Page | What it does |
|---|---|
| `/product/pilot` | Where the pilot stands, **pilot readiness read from the actual controls**, evidence pack download |
| `/product/pilot/setup` | Start conditions and Start pilot; cohort (add or remove an account, **material**, payload-bound approval); edit setup: business area EN/DE, window, legal entities with regulatory context, roles, processes (Role Apps), source systems, authority, support contacts; audit history |
| `/product/pilot/baseline` | The six measures: the design partner's baseline (entered or imported, never computed) beside "this environment, measured from synthetic data"; success criterion; import (`measure, value, period` lines, all or nothing) |
| `/product/pilot/weekly` | Week selector; adoption and completion per role (never per person), experience recorder aggregates, value readings beside baseline, issues, risks, decisions required (raise, resolve), product feedback on the pilot's roles and apps, AI quality evidence |
| `/product/pilot/exit` | Two-step governed exit decision (draft, then approval bound to the change fingerprint) and the decisions taken |
| `/product/pilot/evidence-pack` | `GET` route: JSON download, built server side |

Modules:

- `rules.ts` (pure): setup (Available roles and installed Role Apps only, autonomy at most Act with approval, autonomous execution always off, window order, contacts without credentials), cohort, baseline (measured needs value and period; unavailable needs a reason), import parsing, readings (Monday weeks), issues, start conditions, exit decision (commercial implication refused if it states an amount or percentage, evidence required, Extend needs a later end, only on a started pilot).
- `actions.ts` ("use server"): every write goes through os-console-core's `governConsoleAction` with the `CONSOLE_ACTIONS` ids (`pilot.edit-setup`, `pilot.manage-cohort`, `pilot.record-baseline`, `pilot.set-target`, `pilot.record-reading`, `pilot.raise-issue`, `pilot.update-issue`, `pilot.record-exit-decision`). Permission, approval, rule, write and audit run in one transaction; refusals are audited.
- `changes.ts`: the cohort and exit-decision changes and fingerprints, built identically at review and at submission. The exit change includes the pilot state it was decided against, so a decision reviewed against one state is refused against another.
- `workspace.ts`, `weekly.ts`, `exit-draft.ts`: read models. The exit draft gathers evidence (pack digest, readiness, readings, issues), unresolved conditions (open issues, controls not verified) and control findings; it proposes no outcome or text.
- `synthetic-measures.ts`: cycle time (completed runs with a `process-completed` event), overdue actions (the Work Hub's `classifyAction`), evidence completeness (required sources readable at the open stage). Preparation time and systems opened: not applicable (never tracked). Handoffs: not computed.
- `readiness.ts`, `readiness-rules.ts`, `enforcement.ts`: see section 2.
- `evidence-pack.ts`, `evidence-download.ts`: the pack and its serving.
- `access.ts`: Pilot Lead every page with actions; Platform Product Owner overview, weekly, exit and evidence pack, read only; anyone else nothing, with the reason.

### Value (`app/product/value`, `src/features/product/value/**`)

All 35 measures of plan section 12, each Measured (with source), Not measured, or Not applicable here, with a status badge (Verified or Not verified for control checks; Simulated for figures from synthetic activity; Empty where the source holds nothing).

### Surgical edits outside my files

- `app/settings/pilot/page.tsx`: a notice linking to the pilot workspace; the "Download in the interface" field links to the workspace instead of reading Unavailable. Copy entries added. The checks themselves are unchanged.
- `src/product/release/product-release.ts`: two known limitations made true again (ids kept): `pilot-readiness-narrow` now "The pilot cohort holds local accounts only"; `evidence-exports-command-line` now "Audit chain verification runs from the command line" (and names the backup script defect). README release block regenerated with `npx tsx scripts/sync-release-readme.ts` (2 lines).

## 2. Measures: computed, unmeasured, not applicable

**Readiness controls** (computed on each request; the 5 other product checks are `runReadinessChecks`, the same function `/settings/pilot` uses):

| Control | Reading today | Source |
|---|---|---|
| Analysts cannot switch role | Not verified: demonstration mode, and `actionSwitchRole` checks neither session nor mode | `enforcement.ts`, pinned by a test that reads `app/actions.ts` |
| Analysts cannot reset | Not verified: same, `actionResetScenario` | same |
| Identity binds approvals | Not verified: approvals carry the seeded role holder | `approvals`, `roles`; writers pinned by test |
| Integration status | Simulated: 17 connectors, 5 simulated, 1 sandbox ready, 11 unavailable or planned | `connector_instances` |
| Backup and restore | Not verified: no backup on this machine | `backups/` manifest re-hashed, restored into a scratch file, integrity check, migrations compared, restore target compared |
| Support bundle | Not verified: none generated | `support-bundles/` manifest, files present, credential-shape scan |
| Audit chain intact | Verified | `verifyChain` |
| Audit trail coverage | Not verified (5 of N chained) | `audit_events` |

**Value**: control measures computed from real records (material action approved by a person, payload-bound approval, required-source enforcement, blocked-action rate, receipt completeness, audit-chain verification, no duplicate external mutation, recovery). After the e2e journey, the first two read Verified (the exit decision's console approval). User and product-owner measures are measured where the product records them (Simulated or Empty); not measured: time to first meaningful action (no workday-opened events), process waiting time, pilot objective progress, release quality; not applicable: meeting preparation time, support volume. **All six commercial measures: Not measured, never synthesised.**

## 3. Backup and restore verification

- `scripts/backup.ts` was run unmodified (`create`, `verify`, `restore`) against a copy of `os-pilot.db`, with its working directory set to `<scratchpad>\os-pilot-backup-root` so `data/nfr-workos.db` resolved there. Create and verify passed; a row inserted after the backup was gone after restore; the restored file matched the manifest hash; `PRAGMA integrity_check` ok; 9 migrations. The readiness check pointed at that root read **Verified**. The shared database was not touched.
- **Defect 1 (not fixed, not my file):** `backup.ts` hard-codes `data/nfr-workos.db` and ignores `NFR_DB_PATH`. With `NFR_DB_PATH` set, `backup:restore` overwrites the default database. The readiness check reports this case as Not verified.
- **Defect 2 (not fixed):** `backup.ts` copies the main file with `copyFileSync`. With WAL and a running server it misses committed transactions (demonstrated on a scratch file: 1 row live, 0 in the copy), and `restore` leaves a stale `-wal` beside the restored file. Recommendation: better-sqlite3 `db.backup()`, remove `-wal`/`-shm` on restore, honour `resolveDbPath()`.

## 4. Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| Pilot cohort and baseline can be managed | Met | Setup, cohort (material) and baseline actions; e2e saves setup, enters one baseline, imports five, starts the pilot |
| Weekly view is sourced | Met | Every section names its source and status; per role only |
| Exit decision governed and auditable | Met | `pilot.record-exit-decision` material: e2e shows a figure refused, an unconfirmed approval refused, then recorded with approval `AUD-...`; audit approval and mutation rows |
| Readiness reads actual controls | Met | Section 2; pins in `tests/unit/pilot-readiness.test.ts` |
| Evidence pack without secrets | Met | Server built, credential-shape check before serving, download audited; e2e asserts 200, attachment, decision, 6 baselines, 8 controls, limitations, no key or secret pattern |
| Value measures honest | Met | Section 2; e2e asserts commercial not measured, control measures verified |
| EN and DE, no overflow at three viewports | Met | e2e layout test at 1920, 1440, 1366 over all six pages; German baseline and overview at 1366 |
| tsc, vitest, Playwright, check:copy, check-no-emdash, scan:secrets | Met | section 5 |
| Screenshots | Met | section 6 |

## 5. Tests run

| Command | Result |
|---|---|
| `npx vitest run tests/unit/pilot-readiness.test.ts tests/unit/pilot-rules.test.ts` | 2 files, 32 passed |
| `npx playwright test tests/e2e/os-pilot.spec.ts` (NFR_BASE_URL 3117, NFR_DB_PATH os-pilot.db) | 4 passed, 2 skipped by design (the write journey runs in 1920 only) |
| Final pass: `npx vitest run` pilot-readiness, pilot-rules, product-release, product-status, product-state-seed | 5 files, 115 passed |
| `npx tsc --noEmit -p tsconfig.json` (final) | exit 0, 0 errors |
| `npm run check:copy` | passed |
| `node scripts/check-no-emdash.mjs` | nothing in my files; its percentage warnings are pre-existing seed text |
| `npm run scan:secrets` | passed (8369 files) |

## 6. Screenshots

`docs/screenshots/os-excellence/os-pilot/`: `overview-before-1920x1080`, `setup-1920x1080`, `baseline-1920x1080`, `exit-approval-1920x1080`, `exit-recorded-1920x1080`, `value-1920x1080`, `weekly-{1920x1080,1440x900,1366x768}`, `overview-1366x768`, `baseline-de-1366x768`, `overview-de-1366x768`. Baseline figures in them are test input, labelled "Test entry" in their period and source.

## 7. Known limitations and needs

- **Schema need:** `pilot_measures.baseline_note` (why a baseline is unavailable, or the import source). Today the reason is in the audit summary, shown in the measure history.
- **For os-console-core:** `ConsoleActionForm` uses `<form action>`, and React resets uncontrolled fields when the action settles, so a refused submission loses what the person typed. The exit decision form avoids this with `onSubmit` and a transition.
- Starting the pilot uses `pilot.edit-setup`; there is no separate `pilot.start` action in `CONSOLE_ACTIONS`.
- The cohort can hold only `PILOT_USERS` accounts (no identity provider).
- Audit summaries are stored in English (an existing known limitation).
- Handoffs are not computed; time-based measures use the product's records only, never a person's time.
- `scripts/evidence-pack.ts` (the CLI pack) still carries the old Pass, Warn and Error checks and "Arcadia Savings Bank"; the workspace download replaces it in the interface. It is not my file and was not changed.

## 8. What the user must run

Nothing for this workstream: no migration and no seed change. The shared database needs the data-model migrations already listed by os-data-model (`npm run db:migrate`, then `npm run demo:reset`) for the pilot tables to exist.
