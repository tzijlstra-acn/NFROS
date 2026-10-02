# V4 Current Product Audit

Generated: 2026-10-02
Branch: main
Head commit: 78e65aa feat: V3.3 -- Role OS with Work Hub, process runtime, AI routines

---

## 1. Branch and commit

```
Branch:  main
HEAD:    78e65aa  feat: V3.3 -- Role OS with Work Hub, process runtime, AI routines
         4524d49  feat: V3.3 -- AI partner pulse on Home, AI routines sub-view on Processes
         f17bbfe  feat: V3.2 -- two flagship roles, role apps, process pages
         808e626  feat: V3.1 light theme -- role home, decisions, full navigation coverage
         8a97860  fix: keep the workday left rail readable at the narrowest projected size
```

Note: the most recent five commits span V3.1 through V3.3. There is no V4 commit.

---

## 2. Current UI version

File: `src/workday/contracts.ts`

```ts
export const WORKDAY_UI_VERSIONS = ["v1", "v2", "v3.1"] as const;
export const DEFAULT_WORKDAY_UI: WorkdayUiVersion = "v3.1";
export const CURRENT_WORKDAY_UI: WorkdayUiVersion = "v3.1";
```

`DEFAULT_WORKDAY_UI` is `"v3.1"`. The version enum has three values: v1, v2, v3.1.

The commit history labels the most recent work as V3.3, but the version constant has not been updated to reflect this. The V3.3 label in commit messages refers to features added on top of the v3.1 shell (Role OS, Work Hub, process runtime, AI routines, partner pulse) without bumping the constant. There is no `"v3.3"` in `WORKDAY_UI_VERSIONS`.

---

## 3. DB schema version

Schema files in `src/db/schema/`:

| File | Exported from index.ts |
|---|---|
| core.ts | yes |
| domain.ts | yes |
| practice.ts | yes |
| work.ts | yes |
| decisions.ts | yes |
| product.ts | yes |
| integration.ts | yes |
| live.ts | yes |
| role-app-runtime.ts | yes |
| background-jobs.ts | **no** |
| audit-chain.ts | **no** |

Total: 11 schema files. 9 are exported from `index.ts`. 2 are defined but not yet wired into the main schema export.

Migration files in `src/db/migrations/`:
- `0000_concerned_unus.sql`
- `0001_long_apocalypse.sql`
- `0002_bouncy_moon_knight.sql`

Three migrations exist. The README states "40 tables" in the architecture diagram; this audit cannot verify the exact table count without reading every schema file in full.

---

## 4. What V4 infrastructure is missing

### ABSENT -- needs build

| Item | Path | Status |
|---|---|---|
| Identity directory | `src/identity/` | ABSENT |
| General health route | `app/api/health/route.ts` | ABSENT -- only `/api/health/ai/` exists |
| Ops route | `app/ops/` | ABSENT |
| Setup route | `app/setup/` | ABSENT |
| Settings: audit integrity | `app/settings/audit-integrity/` | ABSENT |
| Settings: AI quality | `app/settings/ai-quality/` | ABSENT |
| Settings: pilot | `app/settings/pilot/` | ABSENT |
| CI workflows | `.github/workflows/` | ABSENT |
| Changelog | `CHANGELOG.md` | ABSENT |
| Background jobs runtime wiring | `index.ts` export | ABSENT -- schema file exists, not exported |
| Audit hash chain runtime wiring | `index.ts` export | ABSENT -- schema file exists, not exported |
| Evaluation corpus files | standalone JSON fixtures | ABSENT -- evaluations are inline in test files |

### EXISTS but partially wired

**`background_jobs` table** (`src/db/schema/background-jobs.ts`): The schema is defined with full fields (id, runId, idempotencyKey, jobKind, status, priority, scheduledAt, leaseOwner, leaseExpiresAt, attemptCount, maxAttempts, lastErrorCode, relatedRoleId, relatedProcessRunId, relatedObjectKind, relatedObjectId, payload, resultSummary, createdAt, updatedAt, completedAt) and a companion `backgroundJobAttempts` table. Neither is exported from `src/db/schema/index.ts`. No worker implementation was found.

**`audit_chain_records` table** (`src/db/schema/audit-chain.ts`): A full SHA-256 hash chain schema is defined (id, runId, sequence, chainScope, auditEventId, eventKind, canonicalPayload, previousHash, eventHash, hashAlgorithm, createdAt). Not exported from `index.ts`. The `npm run audit:verify-chain` command referenced in the file's header comment does not appear in `package.json`.

---

## 5. What is present

### UI routes

All workday routes have v1, v2, and v3 implementations:

| Route segment | v3.tsx present | actions.ts present |
|---|---|---|
| `[role]/` (home) | yes | n/a |
| `[role]/work` | yes | n/a |
| `[role]/processes` | yes | n/a |
| `[role]/decisions` | yes | n/a |
| `[role]/processes/rcsa-cycle` | yes | yes |
| `[role]/processes/third-party-onboarding` | yes | yes |
| `[role]/assistant` | yes | n/a |
| `[role]/calendar` | yes | n/a |
| `[role]/meetings` | yes | n/a |
| `[role]/mail` | yes | n/a |
| `[role]/collaboration` | yes | n/a |
| `[role]/workbench` | yes | n/a |

Calendar, meetings, mail, collaboration, workbench, and assistant pages exist but are redirected away from in the flagship roles per `next.config.ts`.

### Daily strip and partner pulse

Both components are present in `app/workday/[role]/v3.tsx`. `DailyStrip` is defined at line 62; `PartnerPulse` is defined at line 199. Both are rendered in the page layout.

### Navigation items

`src/components/workday-v3/WorkdayNavigation.tsx` declares four primary items:
1. Home (segment `""`)
2. Work (segment `/work`)
3. Processes (segment `/processes`)
4. Decisions (segment `/decisions`)

Trust and Settings have been moved out of the primary rail as of V3.2.

### API routes

```
app/api/agent/route.ts
app/api/health/ai/route.ts
app/api/integrations/webhook/[connector]/route.ts
app/api/realtime/session/route.ts
app/api/workday/chat/route.ts
app/api/workday/chat/thread/route.ts
app/api/workday/events/route.ts
app/api/workday/partner/route.ts
app/api/workday/suggestion/route.ts
```

Total: 9 routes. No general `/api/health/` route exists; only `/api/health/ai/`.

### Settings routes present

`app/settings/` subdirectories:
- authority
- branding
- deployment
- integrations
- mappings
- organisation
- role-apps
- role-packs

### Role status

| Role | Route | Status |
|---|---|---|
| Third-Party Risk Manager | `/workday/tprm` | Flagship -- full process pages, role-native home, role apps |
| Operational Risk Partner | `/workday/rcsa` | Flagship -- full process pages, role-native home, role apps |
| Control Assurance Specialist | `/workday/control-assurance` | Preview |
| Incident and Resilience Lead | `/workday/incident-resilience` | Preview |
| Regulatory Change Manager | `/workday/regulatory-change` | Preview |
| NFR Portfolio Lead | `/workday/nfr-governance` | Preview |

### Middleware

`middleware.ts` exists. It resolves the UI version from the `?ui=` query parameter, the `nfr-workday-ui` cookie, and the `NFR_WORKDAY_UI` environment variable. It forwards the resolved version as an `x-nfr-workday-ui` request header and sets it as a response cookie. It does not rewrite or redirect URLs.

### Infrastructure files

| File | Present |
|---|---|
| `Dockerfile` | yes |
| `eslint.config.mjs` | yes |
| `middleware.ts` | yes |

### AI capabilities

Per `src/workday/contracts.ts` and the commit history, the following are implemented:

- AI generation state machine: idle, queued, retrieving, reconciling, analysing, drafting, validating, ready, blocked, error
- AI partner states: monitoring, checking-evidence, preparing, ready, needs-you, executing, completed, paused, offline
- Suggestion schema: headline, changeSummary, whyItMatters, checksCompleted, actionsCompleted, recommendedAction, alternatives, evidenceIds, confidence, uncertainty, decisionRequired
- Focus queue: four sections (needs-you, prepared, handled, watching) with deduplication
- Execution receipts: per-line status (acknowledged, local, partial, queued, failed, dead-letter)
- Source attribution: connector mode, freshness, conflict, deep link
- Stream event types: scenario.event.arrived, scenario.time.changed, agent.run.started, agent.stage.changed, agent.tool.completed, agent.suggestion.ready, agent.suggestion.failed, approval.required, mutation.completed, integration.command.changed, data.load.changed, stream.heartbeat

---

## 6. Test inventory

Test suites found:

**Unit** (`tests/unit/`):
- authority.test.ts
- domain.test.ts
- evaluations.test.ts
- secrets.test.ts
- loading-states.test.ts
- ai-partner.test.ts
- product.test.ts
- integration-runtime.test.ts
- suggestions.test.ts
- focus-queue.test.ts

**Integration** (`tests/integration/`):
- scenario.test.ts
- continuity.test.ts
- mutations.test.ts
- integration-flows.test.ts
- ai-partner-flows.test.ts
- focus-queue-flows.test.ts

**E2E** (`tests/e2e/`):
- journeys.spec.ts
- visual.spec.ts
- security.spec.ts

Test commands from `package.json`:
- `npm run test:unit` -- vitest run tests/unit
- `npm run test:integration` -- vitest run tests/integration
- `npm run test:e2e` -- playwright test tests/e2e
- `npm run eval` -- tsx scripts/evaluate.ts (14 structural evaluations; grounded probes require live mode)
- `npm run verify:seed` -- seed depth and pre-decided state checks

The previous V3.3 audit (docs/handoffs/workday-v3-3-current-audit.md) was generated at commit f17bbfe (V3.2), not at the V3.3 HEAD. Its test count figure should be treated as V3.2 baseline. The task instruction notes the V3.3 passing count as 723 vitest tests.

No automated grounding evaluation corpus exists as standalone fixture files. Evaluations are implemented inline in `tests/unit/evaluations.test.ts` and `scripts/evaluate.ts`.

---

## 7. Open limitations

Stated plainly. Taken from README section "Limitations", code inspection, and the schema gap analysis above.

1. **No automated grounding evaluation against live output.** Authority and refusal behaviour is tested. Automated hallucination detection against live model responses is not implemented. README flags this as the largest gap against the original brief.

2. **`npm run lint` is not a real ESLint lint.** It runs typecheck, `check:copy`, and `scan:secrets`. `eslint.config.mjs` exists but ESLint is not installed as a dependency and is not wired into any script.

3. **No real session security.** There is no authentication layer. Any browser session can reach any role. The prototype relies on the authority gate (a pure function) rather than session identity for mutation control.

4. **No durable jobs runtime.** The `background_jobs` and `background_job_attempts` tables are schema-defined but not exported from `index.ts`. No worker process or polling loop was found. The `npm run audit:verify-chain` command referenced in `audit-chain.ts` is not in `package.json`.

5. **No audit hash chain at runtime.** The `audit_chain_records` schema exists but is not wired into the schema index or into the audit service.

6. **No health endpoint beyond `/api/health/ai/`.** The README lists `/api/health/ai` in the route table; no general `/api/health/` route exists for liveness or readiness probing.

7. **No CI/CD pipeline.** `.github/workflows/` is absent. There is no automated test or build gate on push.

8. **No cloud deployment.** README states this was optional and was not attempted.

9. **Depth uneven by role by design.** Two of the six roles (rcsa, tprm) are flagship with full process pages. Four are preview. The interface labels each role's depth, but the backend data and tooling are also uneven.

10. **AI prep text is static in safe mode.** Presenter safe mode serves cached known-good outputs. Free questions in safe mode trigger live AI. Offline mode serves seeded responses. There is no real-time grounding in safe or offline mode.

11. **Voice is best-effort.** Voice degrades to a typed fallback when a realtime model or live mode is unavailable. The typed path is the tested path.

12. **Two scenario figures unreconciled.** Per README sections 4.2 and 4.3 in `docs/ASSUMPTIONS.md`, two figures could not be fully reconciled with the coded risk methodology and with each other.

---

## 8. Stale or imprecise README claims

| Claim | Status |
|---|---|
| "V3.1 is the current default" (Quick start section) | Technically accurate per contracts.ts, but misleading: the codebase has shipped V3.3 features. The version constant itself was not incremented. |
| "40 tables, one scenario run" (Architecture diagram) | Unverified. The schema has 11 files; 9 are in the index. Without reading every table definition in full, the count cannot be confirmed. |
| Route table includes `/api/health/ai` | Correct. |
| Route table does not include `/api/health/` | Correct -- it does not exist. |
| `/settings/integrations` and `/settings/organisation` and `/settings/role-apps` listed | All three exist. |
| No mention of `/settings/authority`, `/settings/branding`, `/settings/deployment`, `/settings/mappings`, `/settings/role-packs` | These routes exist but are not listed in the README quick start table. |
| `npm run audit:verify-chain` referenced in audit-chain.ts | This script does not exist in `package.json`. |

---

## 9. Summary for V4 planning

The codebase is a working V3.3 product with the following V4 building blocks partially in place:

- Background jobs schema: defined, not wired.
- Audit hash chain schema: defined, not wired.
- Dockerfile: present.

The following V4 building blocks are absent and require net-new work:

- `src/identity/` -- session identity and role resolution
- `/api/health/` -- general health and readiness endpoint
- `/app/ops/` -- operational control surface
- `/app/setup/` -- guided first-run configuration
- `/settings/audit-integrity` -- chain verification UI
- `/settings/ai-quality` -- evaluation result surface
- `/settings/pilot` -- pilot configuration and entitlement controls
- `.github/workflows/` -- CI/CD automation
- `CHANGELOG.md` -- version history
- Background jobs worker runtime
- Audit chain write path and verification script (`npm run audit:verify-chain`)
- Evaluation corpus as standalone fixture files
