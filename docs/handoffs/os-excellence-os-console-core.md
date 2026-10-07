# OS Product Excellence: os-console-core (Wave 4)

One Product Owner Console at `/product`: the shell and navigation, the eight product-owner personas and a server-side permission map, Overview, Role App lifecycle with an enablement the process pages obey, Role App performance, Experience analytics, Releases with a runnable gate, and an Operations summary.

Plan references: 6.1, 7, 7.1, 7.2, 7.3, 7.4, 7.9, 8.3, 9.1, 9.2 and Wave 4. Isolated stack: port 3115, database `<scratchpad>\os-console-core.db` (migrated through 0008, seeded), dist dir `.next-os-console-core`. Nothing was written to `data/nfr-workos.db`; no write action was used on port 3000. No schema change.

## 1. What changed

### Console shell (built first)

- `app/product/layout.tsx`: the administrator frame (`AdminFrame`, context `product`) with the console rail: the nine primary sections of plan 7 (Overview, Role Apps, Experience, Quality, Value, Integrations, Releases, Pilot, Operations), Feedback under "Product discovery", and the existing pages as deep links (Settings, Operations console, Audit integrity). Every page carries the acting persona strip.
- `src/features/product/shell/`: `nav.ts` (sections, owners, plan sections), `ConsoleNav.tsx` (client, `aria-current`), `InPreparation.tsx` (honest placeholder: Unavailable badge, plan section, the existing page that covers part of it; no figures), `copy.ts`, `styles.ts`.
- Placeholders were created for `quality`, `integrations`, `feedback`, `pilot`, `value`; the parallel workstreams have since replaced Quality, Integrations, Pilot (and more). Whatever is still a placeholder says "In preparation".
- Surgical edits to os-release-truth's frame: `AdminFrame` gained context `product` and an optional `rail` prop (default rail unchanged); `AdminRailLinks` gained a "Product owner console" link, so `/settings` and `/ops` reach the console.

### Personas and permissions (plan 6.1)

`src/features/product/permissions.ts` (pure, client safe). See section 3 for the API.

- Eight personas, each with the plan's responsibilities (`owns`), a synthetic demonstration user id and a set of console scopes.
- 31 console scopes, distinct from the workday scopes in `authority.ts` (a test asserts no persona holds a workday scope).
- `CONSOLE_ACTIONS`: every console action of plan 7.2, 7.5, 7.6, 7.7, 7.8, 7.9 and operations, each with exactly one scope and a `material` flag.
- The separation of duties falls out of the map: a Role App Owner prepares a candidate and cannot approve it; the Platform Product Owner approves releases and pilot releases and cannot deploy; the Operations Owner deploys and may disable an app to contain an incident but cannot enable one; a Tenant Administrator enables and disables; a Pilot Lead assigns cohorts and records the exit decision.
- Identity: the acting persona is chosen through the demonstration persona mechanism. `src/identity/local-demo.ts` (surgical) now includes the eight personas, signed in with `localDemoProvider.signIn(personaId)`; the session carries the persona's scopes as `authorityScopes`. The strip labels it "Demonstration persona" and explains there is no identity provider. Server checks read a persona's scopes from code (not the cookie), and any other session's console scopes from its `authorityScopes` (none today), which is the Wave 5 seam. Persona switching is allowed only where role switching is (demonstration mode) and is audited.

### The governed path

`src/features/product/governance.ts`: `governConsoleAction` runs every console write through permission, then (material actions) a payload-bound approval, then the action's own rule, then the write and its audit records in one transaction. Refusals at any step write a `blocked` audit event with the code.

- Approval: the form shows what will change and posts the fingerprint of that change (`fingerprintPayload` from the authority gate, prefixed `console:`). The server recomputes the change from current state; a different fingerprint is refused ("the record changed after you reviewed it"), so an approval cannot be replayed onto a changed record. The rationale must be stated (12 characters minimum) and confirmed as the person's own.
- Audit: the approval is its own `audit_events` row (category `approval`, with fingerprint, rationale, scopes); the change is a `mutation` row naming it in `approval_id`; the product history row (`role_app_lifecycle_events.approval_id`, `product_release_events.approval_id`) names it too. The workday `approvals` table is not used: it is keyed by a workday role and read by the analyst's rail.
- `src/features/product/forms/ConsoleActionForm.tsx` (client) is the one form shape: disabled with the holder named when the persona lacks the scope, a single button for routine actions, and for material actions an approval panel (what will change, fingerprint, rationale, confirmation). `forms/gate.ts` computes its props.

### Overview (plan 7.1)

`src/features/product/overview/` and `app/product/page.tsx`. Ten figures from real sources: current release (registry, and the console's deployed record), Available roles, installed Role Apps and how many are enabled, active users stated as demonstration personas ("no named users in this build"), active process runs, decisions waiting (open, presented by now, Available roles), process failures (failed jobs, failed preparations, blocked runs), AI quality (mode, harness, model output in the status vocabulary), connector health by status, pilot status with unmeasured baselines. Four questions answered by rules over the same readings, three items each and "View all": what changed (this version's CHANGELOG bullets and the count of console records), what needs attention, what is blocked, what is performing well (only what a check or a record shows). One material alert at the top when there is one.

### Role App lifecycle and enablement (plan 7.2)

`src/features/product/role-apps/` and `app/product/role-apps/page.tsx`.

- States read from the 0006 tables (Draft, Candidate, Pilot, Installed, Available, Demo, Planned, Retired), with counts and a one-line meaning each.
- Actions, each a `propose*` (payload, fingerprint, plain-language lines, blocking reason) plus a governed function:
  - Create candidate version: records the manifest of the reviewed definition in this build (`buildRoleAppManifest`, the seed's own derivation), the latest migration tag and EN/DE release notes. No code upload; refused for catalogue entries and while a candidate is open.
  - Compare versions: field by field from the manifests, permission-checked and recorded as a console read.
  - Run evaluations: calls the quality workstream's `runEvaluation` (`src/features/product/quality/api.ts`, grounding mode) once per AI configuration of the version, recorded with `role_app_version_id`.
  - Assign pilot cohort (material): pins the candidate to the cohort and moves it to Pilot; says that the demonstration workday follows the tenant setting.
  - Approve release (material): refused unless every configuration has a completed evaluation for this version with no mandatory failure; the candidate becomes current Installed, the previous version Retired (superseded). States that this is release state only, not code.
  - Enable, Disable (material): the tenant enablement.
  - Roll back (material): restores the previous released version (or a retired current one).
  - Retire (material): current version Retired and every enablement disabled; runs kept.
- Additive repository function `setRoleAppVersionSupportState` in `src/db/repositories/role-app-release.ts` (surgical).

### Enable and Disable take effect

`src/role-apps/enablement.ts`: `readRoleAppAvailability(roleAppId)` is the single check (installed in code, current version not Retired, tenant enablement not disabled; no record means "runs as released" and says so; a database without the release tables never takes the process pages down). Called surgically from:

- `app/workday/[role]/processes/rcsa-cycle/v3.tsx` and `third-party-onboarding/v3.tsx`: the page is wrapped in `RoleAppGate`, which renders `DisabledRoleApp` (Unavailable badge, who disabled it and when, the reason given, what still works) instead of the process page;
- `app/workday/[role]/processes/v3.tsx`: a disabled app's card says so and has no Open button;
- `src/features/process/actions.ts`: every stage action and the resume action refuse a run of a disabled app (`processRunUnavailableReason`), so a crafted post cannot work it;
- `src/features/process/runs.ts`: the run factory refuses to start a run of a disabled app.

### Role App performance (plan 7.3)

`role-apps/performance.ts`: runs started and completed, median cycle time, waiting time by stage (completed median and open-for median), human task time, source delay, decision delay, approval delay (each paired on the backbone's own idempotency keys), preparation failure rate, resume rate, AI suggestion acceptance, modification and rejection (0006 dispositions, by role), and feedback counts (AI and product feedback). Four figures shown, the rest behind "All measures". Aggregates only; nothing groups by a person; unmeasured values say "Not measured" with the reason.

### Experience analytics (plan 7.4)

`src/features/product/experience/` and `app/product/experience/page.tsx`. Nine measures with their sources, a GET filter form (role, legal entity, process, cohort, week, mode), and for each measure the filters its source cannot apply. Time to first meaningful action is the median per role and day (first workday opened to the first human backbone action after it).

- Recording point added: `ExperienceBeacon` (client, renders nothing) and the server action `record.ts`, placed surgically in `app/workday/[role]/v3.tsx`: one `workday-opened` row per Home visit, no user id, idempotent per visit.
- Not recorded yet, and stated on the page: Now item opened, evidence opened, meeting preparation reviewed. The beacon is ready for the owners of those surfaces (`<ExperienceBeacon kind="evidence-opened" roleId=... subjectKind="document" subjectId=... />`).

### Releases (plan 7.9)

`src/features/product/releases/` and `app/product/releases/page.tsx`.

- Shows this build's release and candidate (registry), the deployed record and rollout status (Simulated), the rollback plan derived from the records, the gate, the evidence pack, and on demand the migrations (journal against `__drizzle_migrations`), Role App versions in force, prompt versions and model profiles, connector state, known limitations (registry) and the release history.
- Run release gate: real checks, run now. In process: migrations applied, versions agree (registry, package.json, CHANGELOG), release states match the code (no installed Role App the code does not install), audit chain intact, no mandatory evaluation failing. As child processes, keeping only the exit code: `scripts/check-no-emdash.mjs`, `scripts/check-user-copy.ts`, `scripts/scan-secrets.mjs`. Type check and tests are listed as Not run and not mandatory, with the reason. Because the secret scan takes minutes on a full working tree, the governed action starts the run and the checks complete after the response (`after`); the page follows the stored run (`GateRunFollow`, bounded) until it completes. A run that never completed is shown as interrupted and never counts as a pass.
- Generate evidence pack: runs `scripts/release-package.ts` and writes `release/console-evidence/evidence-<version>-<time>.json` referencing its manifest (sha256), with the latest gate run, readiness checks, migrations, versions in force and known limitations; records path and digest.
- Approve pilot release (material): refused unless the latest gate run passed and an evidence pack was generated after it. Deploy (material, Operations Owner): Simulated, recorded, changes no system; refused unless approved on the latest gate run. Roll back (material): Simulated, recorded.

### Operations

`src/features/product/operations/OperationsSummary.tsx`: the same status sources `/ops` reads (system health, job queue), plus open integration incidents and Role Apps not runnable, and a link to `/ops`. `/ops` itself was not edited.

## 2. Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| One coherent control plane | Met | `/product` shell with the nine sections, Feedback and deep links; Playwright "the console shell lists every section, and each one answers" |
| Installed app enabled and disabled, effect verified on the process pages | Met | Integration "needs a payload bound approval, then really disables the app"; Playwright journey disables TPRM Onboarding, sees `role-app-disabled` on the run page and a disabled landing card, enables it, sees the process page again |
| Candidate app can be evaluated | Met | Run evaluations calls the quality service; integration "runs the candidate's evaluations through the quality service" |
| Release gate visible and runnable | Met | Releases page; Playwright gate journey; a real run on 3115 recorded per-check pass and fail |
| Value measured without employee ranking | Met | Performance and experience read aggregates only; no source groups by user; `experience_events` has no user column |
| Every console action permission-checked, audited, gated where material | Met | `governConsoleAction`; unit tests for the map and the approval; integration tests for no-persona, missing-scope, approval-missing, payload-mismatch and the approval and mutation audit rows |
| EN and DE; no overflow at the three viewports | Met | All copy bilingual (ASCII German); screenshots; `main.scrollWidth == clientWidth` at 1920, 1440 and 1366 |
| tsc, vitest, Playwright, check:copy, check-no-emdash, scan:secrets | See section 4 | |
| Screenshots | Met | `docs/screenshots/os-excellence/os-console-core/` |
| Handoff with the permissions API and shell conventions | Met | Sections 3 and 5 |

Product rules held: no flagship role, no installed Role App added (the gate checks it); role release states unchanged; authority gate, approvals and audit unchanged; no schema change.

## 3. The permissions API (for the other console workstreams)

`@/features/product/permissions` (pure, client safe):

- `PRODUCT_PERSONA_IDS`, `PRODUCT_PERSONAS[id]` (`label`, `owns`, `demoUserId`, `scopes`), `ProductPersonaId`, `isProductPersonaId`, `personaForUserId`.
- `CONSOLE_SCOPES`, `ConsoleScope`, `scopesForPersona`, `personaHoldsScope`, `personasWithScope`.
- `CONSOLE_ACTIONS[actionId]` (`area`, `label`, `scope`, `material`, `planSection`), `ConsoleActionId`, `consoleActionsFor(area)`.
- `checkConsolePermission(scopes | null, actionId)` and `personaCan(personaId | null, actionId)`: `{ allowed: true } | { allowed: false, code: "no-persona" | "missing-scope", reason: { en, de } }`.

Your actions are already named, for example `quality.run-evaluation`, `quality.approve-candidate` (material), `integration.pause-writes` (material), `integration.resolve-mapping` (material), `pilot.manage-cohort` (material), `pilot.record-exit-decision` (material), `feedback.triage`, `feedback.assign-owner`. Add a new one to `CONSOLE_ACTIONS` rather than inventing a scope check.

`@/features/product/governance` (server only):

- `governConsoleAction({ actionId, target: { kind, id }, payload, approval?, summary, rule?, prepare?, execute, success })` returns `{ ok: true, value, message, auditEventId, approvalId } | { ok: false, code, reason, auditEventId }`. `payload` is the change recomputed on the server; for a material action `approval` must carry the fingerprint the person reviewed. `execute(context, prepared)` is synchronous and runs in the transaction with the audit rows; `context` gives `actor` (`personaId`, `userId`, `label`), `approvalId`, `at`, `rationale`.
- `fingerprintConsoleChange(actionId, payload)`, `authorizeConsoleAction(actionId, target)` (permission only, for a read), `recordConsoleRead`, `readApprovalFields(formData)`, `toFormState(result, language)`, `ConsoleFormState`.
- `@/features/product/persona/acting`: `readActingConsoleIdentity()`, `actingLabel(identity)`.
- `@/features/product/forms/ConsoleActionForm` (client) and `@/features/product/forms/gate` (`formGate(scopes, actionId, language, ruleBlock?)`).

## 4. Tests run

| Command | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | exit 0 (whole project, final run) |
| `npx vitest run tests/unit/product-console.test.ts` | 23 passed |
| `npx vitest run tests/integration/product-console.test.ts` | 9 passed |
| Related suites (unit 6 files, 153 passed; integration process-engine 30 passed (with --hookTimeout=300000: under the shared machine load its beforeAll exceeded the default 30 s once), data-model-repositories and product-console passed_CMD) | unit 6 files, 153 passed; integration process-engine 30 passed (with --hookTimeout=300000: under the shared machine load its beforeAll exceeded the default 30 s once), data-model-repositories and product-console passed |
| `NFR_BASE_URL=http://localhost:3115 npx playwright test tests/e2e/os-console-core.spec.ts --project=desktop-1920` | 5 passed (9.1 min): shell and every section answers; disable and enable TPRM Onboarding with the effect on the run page and the landing; a persona without authority cannot disable; release gate runs and shows per-check status (the run passed 8 of 8 mandatory checks); experience filters |
| `npm run check:copy` | passed |
| `node scripts/check-no-emdash.mjs` | passed (pre-existing percentage warnings in seed text only) |
| `npm run scan:secrets` | passed |

## 5. Shell conventions for the other console pages

- A page under `app/product/<section>/page.tsx` is thin: `readAdminLanguage()` from `@/product/status/sources`, then a feature component. The layout supplies the frame, the rail and the acting persona strip; do not add another frame.
- Start the page with `SettingsHead` (eyebrow `CONSOLE_COPY.eyebrow`), group content in `SettingsSection`, rows with `Item`/`List`, statuses with `StatusBadge` (vocabulary only). Wrap long secondary text (`consoleWrapStyle`); a row subtitle is one line.
- Quiet by default: a few key figures first, detail behind `<details>`.
- Every write: a server action that calls `governConsoleAction` with an action id from `CONSOLE_ACTIONS`, rendered with `ConsoleActionForm` and `formGate`. Material actions pass `approval={{ lines, fingerprint }}` from a `propose*` function that the action function recomputes.
- An unmeasured value is "Not measured" with the reason, never zero; an unreadable source is Unavailable; Simulated where it is.
- Nav: sections live in `src/features/product/shell/nav.ts`; ask os-console-core (or edit surgically) to add one.

## 6. Screenshots

`docs/screenshots/os-excellence/os-console-core/`: overview, role-apps, releases, experience at 1920 and 1366 in English; overview and releases at 1920 in German; the disable approval, the disabled process page and the disabled landing card at 1440 (from the disable journey). No horizontal overflow in any capture (main scrollWidth equals clientWidth).

## 7. Known limitations

- The acting persona is a demonstration persona, not a person. Wave 5 binds a named identity to a persona or gives the session console scopes directly; the checks read scopes and do not change.
- Cohort enablement pins a version for signed-in cohort members; the demonstration workday acts as the role holder and follows the tenant enablement. The console says so.
- Role App approve and roll back change release state and enablement, not the code that runs; the approval says so. A candidate records the manifest of the definition in this build.
- Deploy and release Roll back are Simulated (no deployment target here) and labelled.
- The release gate does not run the type check or the test suites (listed as Not run, not mandatory). The secret scan takes several minutes on a full working tree, so a gate run completes minutes after it starts; a run interrupted by a server stop is shown as interrupted.
- Experience analytics: only "workday opened" has a recording point. Now item opened, evidence opened and meeting preparation reviewed are Not recorded until their owners add the beacon. The backbone carries no legal entity, cohort or mode, so those filters apply to `experience_events` only, and the page says which measures a filter cannot narrow.
- AI suggestion lifecycle is per role (suggestions are not tied to a Role App); each Available role has one installed app.
- Stored values stay English: CHANGELOG bullets on the Overview and gate check details.
- `demo:reset` clears console records (product state), as the data-model handoff notes.

## 7a. Schema needs (not changed)

- An experience session key (anonymous, per visit) on `experience_events` would let time to first meaningful action be paired per visit instead of per role and day.
- A `role_app_id` on `ai_suggestions` would let suggestion acceptance be shown per Role App rather than per role.

## 8. What the user must run

Nothing new from this workstream: no migration and no seed change. The console needs migrations 0006 to 0008 and a reset on the shared database, which the data-model handoff already lists (`npm run db:migrate`, `npm run demo:reset`, with the dev server on port 3000 stopped). Evidence packs are written to `release/console-evidence/` (ignored by git).

## 9. Files

New: `app/product/layout.tsx`, `app/product/page.tsx`, `app/product/{role-apps,experience,releases,operations}/page.tsx`, placeholders created then replaced by their owners where built; `src/features/product/{permissions.ts,governance.ts}`, `src/features/product/{shell,persona,forms,overview,role-apps,experience,releases,operations}/**`; `src/role-apps/enablement.ts`; `tests/unit/product-console.test.ts`, `tests/integration/product-console.test.ts`, `tests/e2e/os-console-core.spec.ts`.

Changed (surgical): `app/settings/_components/AdminFrame.tsx`, `app/settings/_components/AdminRailLinks.tsx`, `src/identity/local-demo.ts`, `src/db/repositories/role-app-release.ts` (one additive function), `app/workday/[role]/processes/v3.tsx`, `app/workday/[role]/processes/rcsa-cycle/v3.tsx`, `app/workday/[role]/processes/third-party-onboarding/v3.tsx`, `app/workday/[role]/v3.tsx`, `src/features/process/actions.ts`, `src/features/process/runs.ts`.
