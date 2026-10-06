# Changelog

All notable changes to NFROS are recorded here.

Format based on Keep a Changelog (keepachangelog.com). Product releases use
semantic versions and are listed newest first. The workday interface and the
Risk Audience Presentation are named components with their own V labels, and
each is listed under the product release that ships it. The release registry
in `src/product/release`, the version in package.json and the top entry here
are held together by `tests/unit/product-release.test.ts`.

## [4.1.0] - 2026-10-05

Product truth and release coherence. Release candidate: the release is in
progress as Wave 0 of the OS Product Excellence programme, and the other Wave 0
workstreams add their entries under this heading.

Components: Workday interface V3.3, Risk Audience Presentation V2.4.

### Added

- Release registry in `src/product/release`: the product identity (NFROS),
  the product release, the workday interface and the presentation as named
  components read from `CURRENT_WORKDAY_UI` and `DECK_VERSION`, role release
  states read from `role-release.ts`, installed and preview Role Apps read from
  the Role App registry, and a typed list of known limitations with status.
- Status vocabulary in `src/product/status`: Empty, Unavailable, Simulated,
  Safe, Offline, Live, Verified and Not verified, each with an English and a
  German label, a tone and a one line meaning, and one `StatusBadge` built on
  the V3.3 `wd-chip`.
- Status sources, computed on each request: AI mode and provider
  verification, audit chain and audit trail coverage, the recorded evaluation
  run, pilot readiness, component health, the job queue and connector status
  counts.
- Release panel on the settings index and on the operations console.
- An Operations section in the administrator rail, linking the operations
  console and the audit integrity page.
- `tests/unit/product-release.test.ts` and `tests/unit/product-status.test.ts`.
- `scripts/sync-release-readme.ts`, which writes the README release section
  from the registry.
- Global search and the command palette in the V3.3 shell (Search and
  Control K): the role's work and the registers of its legal entity, grouped
  by object type, each result opening on the surface where it is worked on,
  with the eight commands of plan section 4.12 and recent and pinned objects
  kept in the browser. Read model in `src/features/search`.
- Updates in the V3.3 shell: material events from the OS event backbone in
  six categories, under a notification budget of five, with what the budget
  holds back behind a disclosure. Read model in `src/features/updates`.
- The release gate on every workday route (`src/workday/role-gate.ts`,
  applied in the middleware and the page dispatcher): Planned roles redirect
  to the role selector with a note, Demo roles show their release page in the
  current interface under any `?ui=`.

### Changed

- Header counts read their destinations: the Decisions badge counts the open
  decisions the queue lists at the current moment, the AI Partner control
  states how many suggestions need the person, and the Updates count is the
  number of updates the panel raises. The Home rail item carries no count.
- The V3.3 muted and disabled text tokens reach WCAG AA on every surface
  (muted #7b8494 to #5a6372, disabled #a0a8b5 to #636c7c; dark disabled
  #6a7382 to #8d96a5 and dark muted #8d96a5 to #9aa3b2), and the filled
  accent takes its text colour from a token.
- The runtime key statement on the control room and the health endpoint is
  chosen from what is known, and no longer says a usable key was resolved
  when none was.

- package.json version from 1.0.0 to 4.1.0.
- The operations console reads its version and release from the registry
  instead of literals, uses the administrator frame, and no longer lays its
  sections over each other.
- The settings area and the operations console use the V3.3 light tokens and
  follow the scenario language for navigation, status labels and the screens
  rewritten in this release.
- AI quality reads the recorded evaluation run instead of a fixed sentence. A
  structural run is Simulated for the harness and Not verified for model
  output, however many cases pass.
- Audit integrity shows audit trail coverage beside the chain status. In this
  build only the seeded audit events are chained, and the page now says so.
- Pilot readiness: the audit chain check verifies the chain rather than the
  presence of its table, coverage is a check of its own, the institution and
  the regulatory scope come from the organisation profile, and the evidence
  pack no longer links to a route that does not exist.
- Role apps: the Enabled chip, which had no control behind it, is replaced by
  an Unavailable enablement control.
- Integrations: each connector mode group carries its product status.
- Deployment: the profile version is labelled as such, and the statement of
  what the prototype runs no longer says there is no backup.
- Brand profiles and the brand fallback take the product name from the
  registry, so the shell names the product NFROS.
- The backup, release package, support bundle and SBOM scripts read the
  version from the registry.
- README rewritten to match the product.
- CHANGELOG: presentation releases moved to their own section, product
  releases ordered newest first, and double hyphen punctuation removed from
  the headings.

### Not changed

- Database schema.
- Role release states: Available (Operational Risk Partner, Third-Party Risk
  Manager), Demo (Control Assurance, Incident and Resilience), Planned
  (Regulatory Change, NFR Governance).
- Installed Role Apps: RCSA Cycle Assistant and Third-Party Onboarding.
- Authority gate, approvals, receipts and the audit write path.
- Risk Audience Presentation V2.4 and its exports.
- Synthetic institution and data.

## [4.0.0] - 2026-10-02

Design Partner Release.

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
- Legacy redirects: calendar to work?view=agenda, meetings to meetings, mail to inbox

### Not changed

- No new flagship roles added
- No new installed process apps added
- Visual system unchanged (light V3 design preserved)
- Presentation routes unchanged
- Synthetic institution and data

## [3.3.0] - 2026-10-02

Workday interface V3.3.

- Work Hub with 4 tabs (Agenda, Meetings, Actions, Inbox)
- Role selector: Available/Demo/Planned labels
- 8 new DB runtime tables
- RCSA and TPRM stage workspaces with server actions
- AI routines display

## [3.2.0] - 2026-10-02

- Two flagship roles: RCSA Operational Risk Partner, TPRM Third-Party Risk Manager
- ProcessMap and ProcessStageDetail components
- Role app registry

## [3.1.0] - 2026-10-02

- Light V3.1 theme replacing dark analyst pages
- Home, Processes, Decisions navigation

---

## Presentation releases

The Risk Audience Presentation carries its own V labels, which are not
product versions. Two of these entries were previously filed as product
versions 2.3.0 and 2.2.0, above 4.0.0; they are kept here unchanged in
substance under their presentation labels.

### Presentation V2.4, shipped with product 4.1.0

The current deck. A thirteen-slide core (cover, agenda, eleven content
slides), a Q&A close and a reference appendix of twenty topics, with real
product proof on slides 6, 7, 8 and 10. `/story` opens V2.4. The full release
record is `docs/PRESENTATION_V2_4_COMPLETION.md`.

### Presentation V2.3: Visual Excellence

Route: /story now opens V2.3 (was V2.2); V2.2 accessible at ?deck=v2.2
Export: data-presentation-slides attribute added (fixes broken export)
Export URLs: URL API used throughout (no more string concatenation)
Typography: semantic type components (PresentationTitle, PresentationBody, etc.), enlarged scale
Visual: 13 dedicated slide renderers (no more generic fallback)
Assets: V2.3 asset registry (one source of truth), placeholder assets committed
Capture: strict fail-fast behavior (auth failure stops run, region failure stops run)

### Presentation V2.2: Accenture Brand Aligned

#### Added

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

#### Changed

- 210 double-hyphen punctuation violations removed: V2.2 data files clean
- RCSA stage count corrected to 8 (was incorrectly shown as 6 in V2.1 materials)
- TPRM stage count corrected to 8 (was incorrectly shown as 6 in V2.1 materials)
- Accenture brand tokens applied: CSS --pv22-* system, #A100FF purple, 0px radius
- Copy voice updated throughout: no em dash, no double-hyphen punctuation, no umlaut characters

#### Not changed

- Product features and commercial model unchanged from V2.1
- Appendix slide count unchanged (A1 through A23)
- Synthetic institution and data label retained on all data references
