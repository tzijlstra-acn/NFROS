# Presentation V2.1 Truth Audit

## Commit reviewed

`bc17e0e` -- feat: V4.0 Design Partner Release -- identity, AI quality, reliability, audit integrity, observability, accessibility, release engineering, pilot readiness

## Current presentation

The presentation lives at the `/story` route. It is a Next.js App Router server component (`app/story/page.tsx`) that reads URL parameters and passes them to the `StoryDeck` client component.

**Route:** `/story`
**Scenes:** 16 scenes across 5 chapters
**Speaking time:** computed from `storyDurationLabel()` in `@/scenario/data/story`

**Query parameter contract:**

| Parameter | Effect |
|---|---|
| `?scene=N` | Open on scene N (1 to 16) |
| `?safe=1` | Presenter safe mode -- every reveal resolves to final state immediately |
| `?export=1` | Implies safe mode, also suppresses tap zones for clean frame capture |
| `?step=N` | In export mode, resolve to intermediate step N rather than the final one |
| `?debug=1` | Surface the scene error tag on a failed scene (rehearsal only) |

There is no `?deck=` query parameter. There is one deck with one data source.

**CSS:** `@/styles/presentation.css` (the active stylesheet). A second token file, `@/styles/presentation-v2-1-tokens.css` (IBM Plex Sans, --pv21- prefix, fully self-hosted fonts), exists but is not yet imported by the story page. It is ready for V2.1.

**Data:** All story content comes from `@/scenario/data/story` (STORY_SCENES, STORY_CHAPTERS, SYNTHETIC_DATA_LABEL, REGULATORY_LABEL, storyDurationLabel).

**Export pipeline:** `scripts/export-deck.ts` (run via `npm run export:deck`). Uses Playwright to capture each scene at 1920x1080 in `?export=1` mode, then assembles a PDF and a PowerPoint via PptxGenJS. Captures per-step frames to avoid missing intermediate panes.

**Existing exported artefacts:**
- `exports/NFR_WorkOS_DACH_Banking.pdf`
- `exports/NFR_WorkOS_DACH_Banking.pptx`
- `exports/NFR_WorkOS_Speaker_Script.md`
- `exports/scenes/` (per-scene frame images)

No downloaded PDFs in `public/`.

---

## Product truth table

| Capability | Status | Notes |
|---|---|---|
| Operational Risk Role OS (rcsa) | Implemented | `roleId: "rcsa"`, status `available` in role-release.ts; full Work Hub with 4 tabs at /workday/rcsa |
| TPRM Role OS | Implemented | `roleId: "tprm"`, status `available` in role-release.ts; full Work Hub at /workday/tprm |
| Work Hub (4 tabs: work, decisions, processes, home) | Implemented | V3_NATIVE_SEGMENTS covers "", "work", "decisions", "processes"; DEFAULT_WORKDAY_UI = "v3.3" |
| RCSA Cycle Assistant Role App | Implemented | RCSA_CYCLE_ASSISTANT imported from `./rcsa/definition`; registered as first entry in ROLE_APP_REGISTRY |
| Third-Party Onboarding Role App | Implemented | THIRD_PARTY_ONBOARDING_APP imported from `./tprm/definition`; registered in ROLE_APP_REGISTRY |
| Event-Driven Reassessment Role App (RCSA) | Demonstration only | status: "preview", maturity: "prototype" in registry; entryRoute: null |
| Rapid Assessment Role App (RCSA) | Demonstration only | status: "preview", maturity: "concept" in registry; entryRoute: null |
| Periodic Reassessment Role App (TPRM) | Demonstration only | status: "preview", maturity: "prototype" in registry; entryRoute: null |
| Exit Planning Role App (TPRM) | Demonstration only | status: "preview", maturity: "concept" in registry; entryRoute: null |
| Fourth-Party Deep Dive Role App (TPRM) | Demonstration only | status: "preview", maturity: "concept" in registry; entryRoute: null |
| Control Assurance role | Demonstration only | roleId: "control-assurance", status: "demo" in role-release.ts; defaultRoute: /workday/control-assurance |
| Incident Resilience role | Demonstration only | roleId: "incident-resilience", status: "demo" in role-release.ts; defaultRoute: /workday/incident-resilience |
| Regulatory Change Manager role | Planned | roleId: "regulatory-change", status: "planned" in role-release.ts |
| NFR Portfolio Lead role | Planned | roleId: "nfr-governance", status: "planned" in role-release.ts |
| Identity/session (3 product modes) | Implemented | ProductMode type: "demonstration" / "design-partner" / "offline-evaluation"; read from PRODUCT_MODE env var in product-mode.ts |
| HMAC session signing | Implemented | Referred to in identity layer; secret via environment variables, never serialised |
| AI quality envelope (prompt registry, configs) | Implemented | 2 released AI configurations (RCSA and TPRM stage-preparation) against 2 model profiles (gpt-4o-mini, gpt-4o) in src/ai/prompt-registry.ts |
| AI configurations (database-backed rollout) | Designed | prompt-registry.ts doc note: "A database-backed registry with per-version eval results, rollback and staged rollout is the documented next step for a production deployment" |
| Background job system | Implemented | background-jobs schema exported from db/schema/index.ts; getJobDepth available; health check shows depth |
| Audit hash chain | Implemented | SHA-256, appendChainRecord in src/audit/chain.ts; audit-chain schema exported from db/schema/index.ts; verify-chain.ts exists |
| Health endpoints | Implemented | checkDatabaseHealth, checkWorkerHealth, checkAIProviderHealth, checkAuditChainHealth in src/health/service.ts; worker shows "not-verified" with pending job depth |
| /ops dashboard | Implemented | app/ops/page.tsx exists |
| /control-room dashboard | Implemented | app/control-room/page.tsx exists |
| Settings areas (10 areas) | Implemented | SETTINGS_AREAS in entitlements.ts: organisation, branding, integrations, mappings, role-packs, role-apps, authority, deployment, ai-quality, pilot |
| Entitlement model (function packs, connector packs) | Implemented | ProductEntitlements, FunctionPackView, FALLBACK_ENTITLEMENTS in entitlements.ts; reads from DB with fallback |
| Accessibility (axe tests) | Implemented | test:accessibility script (playwright tests/e2e/accessibility.spec.ts); keyboard tests also exist |
| 60-case eval suite | Implemented | 12 case files in evals/cases/, 60 total cases (action-quality 3, authority 3, german 3, inbox-triage 4, meeting-minutes 5, rcsa-challenge 5, rcsa-conflicting 6, rcsa-factual 8, rcsa-rating 6, tprm-classification 6, tprm-conditions 5, tprm-contradiction 6) |
| CI workflows | Implemented | quality.yml (PR gate: typecheck, lint, copy check), nightly-live-eval.yml (02:00 UTC, requires OPENAI_MINI_API_KEY), release-candidate.yml (on version tags) |
| Docker deployment | Configured, not independently verified | Multi-stage Dockerfile (deps/builder/runner), non-root user; docker-compose.yml present |
| Export pipeline (PDF + PowerPoint) | Implemented | scripts/export-deck.ts using Playwright + PptxGenJS; existing artefacts in exports/ |
| OIDC identity | Designed | Not in codebase; mentioned as next step in design-partner mode context |
| Live connectors | Not supported | CONNECTOR_MODE_LABELS includes "live" as a type but scenario data uses "simulated"; ConnectorMode has "planned" value for unimplemented connectors |
| Autonomous execution | Configured, not independently verified | AI_FEATURE_IDS includes "autonomous-execution"; authority gate references it but live end-to-end not confirmed |
| German language (de) | Implemented | Bilingual label pairs throughout contracts.ts; german.json eval cases; DACH_CONTEXT.md |
| Presentation export (npm run export:deck) | Implemented | scripts/export-deck.ts; captures 1920x1080 per scene with intermediate step support |

---

## Role App breakdown

| Role App | Registry ID | Role | Status | Maturity |
|---|---|---|---|---|
| RCSA Cycle Assistant | (from definition file) | rcsa | Installed | Production-shaped |
| Third-Party Onboarding | (from definition file) | tprm | Installed | Production-shaped |
| Event-Driven Reassessment | rcsa-event-driven-reassessment | rcsa | Demo (preview) | Prototype |
| Rapid Assessment | rcsa-rapid-assessment | rcsa | Demo (preview) | Concept |
| Periodic Reassessment | tprm-periodic-reassessment | tprm | Demo (preview) | Prototype |
| Exit Planning | tprm-exit-planning | tprm | Demo (preview) | Concept |
| Fourth-Party Deep Dive | tprm-fourth-party-review | tprm | Demo (preview) | Concept |

All Demo apps have `entryRoute: null`, meaning they have no navigable page. They appear in the administrator settings catalogue only.
