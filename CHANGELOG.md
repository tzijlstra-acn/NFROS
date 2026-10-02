# Changelog

All notable changes to NFR WorkOS are recorded here.

Format based on Keep a Changelog (keepachangelog.com).

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
