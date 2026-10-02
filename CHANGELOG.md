# Changelog

All notable changes to NFR WorkOS are recorded here.

Format based on Keep a Changelog (keepachangelog.com).

## [2.3.0] - V2.3 Presentation: Visual Excellence

Route: /story now opens V2.3 (was V2.2); V2.2 accessible at ?deck=v2.2
Export: data-presentation-slides attribute added (fixes broken export)
Export URLs: URL API used throughout (no more string concatenation)
Typography: semantic type components (PresentationTitle, PresentationBody, etc.), enlarged scale
Visual: 13 dedicated slide renderers (no more generic fallback)
Assets: V2.3 asset registry (one source of truth), placeholder assets committed
Capture: strict fail-fast behavior (auth failure stops run, region failure stops run)

---

## [2.2.0] - V2.2 Presentation: Accenture Brand Aligned

### Added

- Route default fixed: was /story loading V1; now loads V2.2 by default
- Route aliases: /story, /story?deck=current, and /story?deck=v2.2 all open V2.2
- Typed data structures (no string parsing): CoreSlide22, Outcome, ServiceLayer, RolloutStep, RoleColumn, ProcessRow
- Motion system added: tokens, variants, RevealSequence, MotionPath, SharedSlideTransition (motion v13.4.6)
- Appendix navigation: core-to-appendix links, URL state, return-to-origin (C key)
- Product capture infrastructure: data-presentation-region markers, capture script, verify script
- Brand preflight check: npm run check:accenture-brand
- User copy checker: npm run check:user-copy
- Export script updated to V2.2 (reads data-presentation-slides DOM attribute)
- New npm scripts: capture:presentation-assets, verify:presentation-assets, check:user-copy, check:accenture-brand, test:presentation, export:presentation
- Speaker script: docs/PRESENTATION_V2_2_SCRIPT.md
- QA guide: docs/PRESENTATION_V2_2_QA_GUIDE.md
- Truth audit handoff: docs/handoffs/presentation-v2-2-truth-audit.md
- Handoff index: docs/handoffs/presentation-v2-2-index.md

### Changed

- 210 double-hyphen punctuation violations removed: V2.2 data files clean
- RCSA stage count corrected to 8 (was incorrectly shown as 6 in V2.1 materials)
- TPRM stage count corrected to 8 (was incorrectly shown as 6 in V2.1 materials)
- Accenture brand tokens applied: CSS --pv22-* system, #A100FF purple, 0px radius
- Copy voice updated throughout: no em dash, no double-hyphen punctuation, no umlaut characters

### Not changed

- Product features and commercial model unchanged from V2.1
- Appendix slide count unchanged (A1 through A23)
- Synthetic institution and data label retained on all data references

---

## [4.0.0] -- 2026-10-02

### Added

- Identity abstraction: local-demo and local-pilot session modes
- Product mode: demonstration, design-partner, offline-evaluation
- AI quality contract: typed response envelope, prompt registry, citation contract
- AI offline response envelopes for RCSA and TPRM flagship processes
- Evaluation suite: 60+ evaluation cases, structural graders, golden scenarios
- Durable background job system: background_jobs and background_job_attempts tables
- Background job worker (npm run worker, npm run dev:all)
- Audit hash chain: tamper-evident chain over audit events
- Chain verification: npm run audit:verify-chain
- /settings/audit-integrity administrator page
- Health endpoints: /api/health/live, /api/health/ready, /api/health/details
- /ops operational console (administrator)
- Support bundle: npm run support:bundle
- Accessibility tests: Playwright axe integration
- Keyboard journey tests
- Skip-to-main-content link in workday layout
- Performance budget script: npm run perf:check
- Dockerfile (multi-stage, non-root)
- docker-compose.yml
- GitHub Actions workflows: quality, release-candidate, nightly-live-eval
- SBOM generation: npm run sbom
- License report: npm run licenses
- Release package: npm run release:package
- Backup and restore: npm run backup:create, backup:verify, backup:restore
- Migration test: npm run test:migration

### Changed

- Role statuses: Available/Demo/Planned (was flagship/preview)
- Navigation: Home | Work | Processes | Decisions (4 items, was 3)
- Work Hub: /workday/[role]/work with Agenda/Meetings/Actions/Inbox tabs
- Process pages: stage workspaces with AI preparation text and server actions
- Legacy redirects: calendar->work?view=agenda, meetings->meetings, mail->inbox

### Not changed

- No new flagship roles added
- No new installed process apps added
- Visual system unchanged (light V3 design preserved)
- Presentation routes unchanged
- Synthetic institution and data

## [3.3.0] -- 2026-10-02

- Work Hub with 4 tabs (Agenda, Meetings, Actions, Inbox)
- Role selector: Available/Demo/Planned labels
- 8 new DB runtime tables
- RCSA and TPRM stage workspaces with server actions
- AI routines display

## [3.2.0] -- 2026-10-02

- Two flagship roles: RCSA Operational Risk Partner, TPRM Third-Party Risk Manager
- ProcessMap and ProcessStageDetail components
- Role app registry

## [3.1.0] -- 2026-10-02

- Light V3.1 theme replacing dark analyst pages
- Home, Processes, Decisions navigation
