# V4 Observability Handoff

Agent G -- NFR WorkOS V4.0

## What was built

### Files created

| File | Purpose |
|------|---------|
| `src/health/service.ts` | Health service: component checks and summary aggregation |
| `src/health/metrics.ts` | In-memory counters and latency histograms |
| `app/api/health/live/route.ts` | GET /api/health/live -- liveness probe |
| `app/api/health/ready/route.ts` | GET /api/health/ready -- readiness probe (checks DB) |
| `app/api/health/details/route.ts` | GET /api/health/details -- full component breakdown |
| `app/ops/page.tsx` | /ops administrator operations console |
| `scripts/support-bundle.ts` | Support bundle creator script |
| `tests/unit/health.test.ts` | Unit tests for health service and metrics |
| `docs/handoffs/v4-observability.md` | This document |

### package.json changes

Added: `"support:bundle": "tsx scripts/support-bundle.ts"`

---

## API routes

### GET /api/health/live
- Always returns 200 while the process is running.
- No database I/O. Safe for frequent load-balancer polling.
- Response: `{ status: "alive", timestamp: "..." }`

### GET /api/health/ready
- Returns 200 when the database is migrated and seeded (`isDatabaseReady()` from `@/db/client`).
- Returns 503 when the database is unavailable.
- Response: `{ status: "ready" | "not-ready", database: ComponentStatus, timestamp: "..." }`

### GET /api/health/details
- Returns the full component health breakdown with latency and detail fields.
- Intended for administrator use. Response carries a `_note` field stating it must be protected in production.
- NEVER returns: secrets, API keys, prompts, raw evidence, user messages.
- Currently open in demonstration mode. Wire to administrator session check before production deployment.

---

## Health service: src/health/service.ts

### Component checks

| Check | What it does | Fallback if missing |
|-------|-------------|-------------------|
| `checkDatabaseHealth` | Calls `isDatabaseReady()` from `@/db/client`; measures latency | Returns `unavailable` |
| `checkWorkerHealth` | Dynamic-imports `getJobDepth` from `@/db/repositories/background-jobs` | Returns `not-configured` -- expected until Agent E delivers the repository |
| `checkAIProviderHealth` | Reads `OPENAI_MINI_API_KEY` and `OPENAI_API_KEY` from environment | Always returns without throwing |
| `checkAuditChainHealth` | Dynamic-imports `verifyChain` and `CHAIN_SCOPE` from `@/audit/verify-chain` | Returns `not-configured` -- expected if audit chain module is not yet present |

### Status values

- `healthy` -- component is responding correctly
- `degraded` -- component is responding but with errors
- `unavailable` -- component cannot be reached
- `not-configured` -- module or dependency is absent; expected in some deployment stages
- `not-verified` -- dependency is configured but no live check was performed (key present; worker not polled)

### Overall status roll-up

- Any `unavailable` component rolls up to `unavailable`.
- Any `degraded` component (with no `unavailable`) rolls up to `degraded`.
- All other states roll up to `healthy`.

---

## Metrics: src/health/metrics.ts

Simple in-memory counters and latency histograms. State resets on process restart.

For production observability, configure `OTLP_ENDPOINT` and replace the in-memory store with an OTLP exporter.

### API

- `incrementCounter(name, by?)` -- increments a named counter
- `recordLatency(name, ms)` -- records a latency sample (capped at 100 per name)
- `getMetrics()` -- returns all counters and p50/p95/count for all latency series

### Named constants

`METRIC_NAMES` exports: `AI_REQUEST`, `AI_FAILURE`, `AI_FALLBACK`, `PROCESS_STAGE_COMPLETE`, `DECISION_COMPLETE`, `JOB_DEPTH`, `JOB_FAILURE`.

---

## /ops administrator console: app/ops/page.tsx

Server component. Reads from the health service directly. No client-side JavaScript for the data display.

### Sections shown

1. System health -- all four components with status badges and detail
2. Job queue -- pending job count (gracefully degraded if background-jobs repository absent)
3. Failed jobs (last 5) -- from `getFailedJobs(5)` if the repository exposes it
4. AI provider -- status and key presence note
5. Audit chain -- verification status and record count
6. Release -- version 4.0.0, schema note (91+ tables)

### Admin warning

The page displays: "Administrator access required in production. This page is open in demonstration mode."

### Footer

"Synthetic institution and data. No real individuals, organisations or regulatory decisions are represented."

### Styling

Uses inline styles with `var(--wd-*)` design tokens and the `.workday-v2` scope class. No dark theme. No em dashes.

---

## Support bundle script: scripts/support-bundle.ts

Run with: `npm run support:bundle`

Creates a timestamped directory under `support-bundles/bundle-{timestamp}/`.

### Contents

| File | Contents |
|------|---------|
| `health.json` | Output of `getHealthSummary(true)` |
| `release.json` | Version, name, node version, platform, schema version |
| `EXCLUSIONS.md` | Explicit list of what was NOT included |
| `manifest.json` | Bundle ID, timestamp, file list, `sanitized: true` |

### What is excluded (documented in the bundle itself)

- API keys and tokens
- Session secrets
- Database contents
- Evidence document text
- Meeting transcripts
- Personal data
- AI prompts
- Message bodies

---

## TypeScript status

All files are written with strict TypeScript. The dynamic imports in the health service use try/catch so that missing modules (`@/db/repositories/background-jobs`, `@/audit/verify-chain`) do not produce TypeScript errors at compile time.

The support bundle script imports from `../src/health/service.js` using a relative path (tsx resolves `.js` to `.ts`) to avoid requiring `tsconfig-paths` in the script runner.

---

## What is implemented vs. designed-only

| Item | Status |
|------|--------|
| Health service core | Implemented |
| /api/health/live | Implemented |
| /api/health/ready | Implemented |
| /api/health/details | Implemented -- needs auth guard for production |
| In-memory metrics | Implemented |
| /ops console | Implemented |
| Support bundle script | Implemented |
| Unit tests | Implemented (17 test cases) |
| Worker health check | Designed -- returns `not-configured` until Agent E delivers background-jobs repository |
| Audit chain health check | Designed -- returns `not-configured` until audit/verify-chain module is present |
| OTLP export | Designed-only -- configure `OTLP_ENDPOINT` and add exporter when moving to production |
| /ops authentication | Designed-only -- protect with administrator session before production |

---

## Dependencies on other agents

- **Agent E** -- `src/db/repositories/background-jobs.ts` -- must export `getJobDepth(): number` and optionally `getFailedJobs(limit: number)`. The health service and /ops page both catch the import gracefully if it is absent.
- **Audit chain module** -- `src/audit/verify-chain.ts` -- must export `verifyChain(scope)` returning `{ status: string; totalRecords: number; verifiedThrough: string }` and `CHAIN_SCOPE`. Caught gracefully if absent.
