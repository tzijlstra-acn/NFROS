# V3.3 Current State Audit

Generated: 2026-10-02
Branch: main
Commit: f17bbfe feat: V3.2 -- two flagship roles, role apps, process pages

---

## Routes inventory

All routes live under `app/workday/`. The `[role]` dynamic segment accepts any
of the six role identifiers. Routes are grouped by segment.

**Root**
- `app/workday/page.tsx`  --  workday entry, role selector

**Role home (flagship V3 frame)**
- `app/workday/[role]/page.tsx`  --  dispatcher: v1 / v2 / v3
- `app/workday/[role]/layout.tsx`
- `app/workday/[role]/loading.tsx`
- `app/workday/[role]/error.tsx`
- `app/workday/[role]/v1.tsx`
- `app/workday/[role]/v2.tsx`
- `app/workday/[role]/v3.tsx`

**Decisions**
- `app/workday/[role]/decisions/page.tsx`  --  dispatcher
- `app/workday/[role]/decisions/v1.tsx`
- `app/workday/[role]/decisions/v2.tsx`
- `app/workday/[role]/decisions/v3.tsx`

**Processes (role app landing)**
- `app/workday/[role]/processes/page.tsx`  --  dispatcher
- `app/workday/[role]/processes/v1.tsx`
- `app/workday/[role]/processes/v2.tsx`
- `app/workday/[role]/processes/v3.tsx`

**RCSA Cycle process**
- `app/workday/[role]/processes/rcsa-cycle/page.tsx`  --  dispatcher
- `app/workday/[role]/processes/rcsa-cycle/v1.tsx`
- `app/workday/[role]/processes/rcsa-cycle/v2.tsx`
- `app/workday/[role]/processes/rcsa-cycle/v3.tsx`

**Third-Party Onboarding process**
- `app/workday/[role]/processes/third-party-onboarding/page.tsx`  --  dispatcher
- `app/workday/[role]/processes/third-party-onboarding/v1.tsx`
- `app/workday/[role]/processes/third-party-onboarding/v2.tsx`
- `app/workday/[role]/processes/third-party-onboarding/v3.tsx`

**Redirected surfaces (pages exist; flagship roles redirect before render)**
- `app/workday/[role]/calendar/page.tsx`  --  dispatcher (v1/v2/v3 all present)
- `app/workday/[role]/meetings/page.tsx`  --  dispatcher (v1/v2/v3 all present)
- `app/workday/[role]/mail/page.tsx`  --  dispatcher (v1/v2/v3 all present)
- `app/workday/[role]/collaboration/page.tsx`  --  dispatcher (v1/v2/v3 all present)
- `app/workday/[role]/workbench/page.tsx`  --  dispatcher (v1/v2/v3 all present)

**Assistant (redirected; page exists)**
- `app/workday/[role]/assistant/page.tsx`  --  dispatcher
- `app/workday/[role]/assistant/chat-panel.tsx`
- `app/workday/[role]/assistant/v1.tsx`
- `app/workday/[role]/assistant/v2.tsx`
- `app/workday/[role]/assistant/v3.tsx`

---

## Redirects

Source: `next.config.ts`. Applied only to the two flagship roles (rcsa, tprm).
All are `permanent: false` (HTTP 307).

| Source | Destination |
|---|---|
| `/workday/rcsa/workbench` | `/workday/rcsa/processes` |
| `/workday/rcsa/meetings` | `/workday/rcsa/processes` |
| `/workday/rcsa/mail` | `/workday/rcsa` |
| `/workday/rcsa/calendar` | `/workday/rcsa` |
| `/workday/rcsa/collaboration` | `/workday/rcsa/processes` |
| `/workday/rcsa/assistant` | `/workday/rcsa?partner=open` |
| `/workday/tprm/workbench` | `/workday/tprm/processes` |
| `/workday/tprm/meetings` | `/workday/tprm/processes` |
| `/workday/tprm/mail` | `/workday/tprm` |
| `/workday/tprm/calendar` | `/workday/tprm` |
| `/workday/tprm/collaboration` | `/workday/tprm/processes` |
| `/workday/tprm/assistant` | `/workday/tprm?partner=open` |

Preview roles (control-assurance, incident-resilience, regulatory-change,
nfr-governance) are not in the redirect list. Their sub-routes without a v3.tsx
fall back to V2 by the segment downgrade in the dispatch logic.

---

## Navigation

**WorkdayNavigation.tsx** (`src/components/workday-v3/WorkdayNavigation.tsx`)

Three primary items only:

| Key | Icon | Segment | Count prop |
|---|---|---|---|
| Home | IconHome | `` (role root) | `counts.myWork` |
| Processes | IconSitemap | `/processes` | none |
| Decisions | IconGavel | `/decisions` | `counts.decisions` |

Plus a collapse/expand toggle at the foot of the rail. No Trust, Settings or
other items in the primary rail.

**V3_NATIVE_SEGMENTS** (`src/workday/contracts.ts` line 50):

```
["", "decisions", "processes"]
```

- Empty string `""` covers the role home (`/workday/rcsa`).
- `"decisions"` covers `/workday/rcsa/decisions`.
- `"processes"` covers `/workday/rcsa/processes` and every sub-route beneath it
  (the dispatch logic checks `pathname.startsWith`).
- `"work"` does NOT exist in V3_NATIVE_SEGMENTS.
- `"mail"`, `"calendar"`, `"meetings"`, `"collaboration"`, `"workbench"`,
  `"assistant"` are all absent. Routes to those segments that reach the page
  component are downgraded to V2 by the dispatch layer.

**DEFAULT_WORKDAY_UI**: `"v3.1"` (contracts.ts line 77).

---

## Role release states

Source: `src/product/release/role-release.ts`

| Role ID | Status | Release label |
|---|---|---|
| rcsa | flagship | Operational Risk Partner |
| tprm | flagship | Third-Party Risk Manager |
| control-assurance | preview | Control Assurance Specialist |
| incident-resilience | preview | Incident and Resilience Lead |
| regulatory-change | preview | Regulatory Change Manager |
| nfr-governance | preview | NFR Portfolio Lead |

Flagship roles have `defaultRoute` set. Preview roles have `primaryProcesses: []`
(empty). No role has status `hidden`.

---

## Database tables

Full table list across all six schema files. 55 tables total.

**core.ts**
- `legal_entities`
- `users`
- `roles`
- `scenario_runs`
- `timeline_events`
- `timeline_role_moments`
- `audit_events`  --  audit log, append only

**work.ts**
- `inbox_messages`  --  mail and collaboration channel messages per role
- `calendar_events`  --  calendar entries per role
- `meetings`  --  meeting simulations per role
- `meeting_messages`  --  turns in a meeting simulation (NOT `meeting_minutes`)
- `collaboration_messages`  --  simulated outbound collaboration messages
- `evidence_documents`  --  synthetic evidence corpus
- `evidence_chunks`  --  retrieval chunks with cached embeddings

**decisions.ts**
- `issues`
- `actions`
- `decisions`
- `decision_options`
- `approvals`
- `execution_receipt_lines`
- `committee_items`
- `monitoring_activations`
- `agent_sessions`
- `agent_messages`
- `agent_runs`
- `tool_calls`
- `cached_ai_outputs`
- `background_actions`
- `portfolio_themes`

**domain.ts**
- `suppliers`
- `subprocessors`
- `services`
- `service_dependencies`
- `impact_tolerances`
- `contracts`
- `contract_obligations`
- `processes`
- `risks`
- `controls`
- `kris`
- `kri_readings`

**practice.ts**
- `assessments`
- `assessment_lines`
- `control_tests`
- `test_cases`
- `incidents`
- `incident_events`
- `recovery_options`
- `regulatory_publications`
- `obligations`
- `policies`

**live.ts**
- `workday_live_events`
- `workday_live_event_reads`
- `ai_suggestions`
- `ai_activity_entries`
- `chat_threads`
- `chat_turns`
- `live_player_state`

**product.ts**
- `brand_profiles`
- `terminology_profiles`
- `entitlement_profiles`
- `deployment_profiles`
- `organisation_profiles`
- `function_packs`
- `active_product_config`
- `product_config_changes`

**integration.ts**
- `connector_packs`
- `connector_instances`
- `source_mappings`
- `external_references`
- `integration_events`
- `integration_commands`
- `external_execution_receipts`
- `connector_sync_state`
- `dead_letter_entries`
- `source_requirements`

**V3.3-required tables that are MISSING (do not exist in any schema file)**

| Table name | Status |
|---|---|
| `role_app_runs` | MISSING  --  runs are TypeScript exported constants |
| `role_app_stage_runs` | MISSING |
| `role_app_stage_tasks` | MISSING |
| `role_app_artifacts` | MISSING |
| `role_app_events` | MISSING |
| `ai_routines` | MISSING |
| `meeting_minutes` | MISSING  --  meeting transcripts live in `meeting_messages` |
| `action_updates` | MISSING |

**Coverage of requested data types in existing tables**

| Data type | Table | Notes |
|---|---|---|
| Inbox / mail messages | `inbox_messages` | channel field: "mail", "collaboration", "grc-queue", "alert" |
| Calendar events | `calendar_events` | per role |
| Meetings | `meetings` | per role, kind field |
| Meeting transcripts | `meeting_messages` | turn-by-turn, not a free-form minutes blob |
| Collaboration messages | `collaboration_messages` | simulated outbound only |
| Actions | `actions` | remediation, evidence-request, etc. |
| Decisions | `decisions` | per role, with options |
| Audit events | `audit_events` | append-only, every mutation |
| Evidence documents | `evidence_documents` | full corpus |

---

## Process runtime state

Source: `src/role-apps/rcsa/definition.ts`, `src/role-apps/tprm/definition.ts`

**How runs are currently stored**: as exported TypeScript constants, not in any
database table. There is no `role_app_runs` table.

`RCSA_PAYMENTS_Q4_RUN` is a `RoleAppRun` object hardcoded at the bottom of the
RCSA definition file. `currentStageId` is the literal string `"evidence-refresh"`.

`TPRM_VERIDIAN_ONBOARDING_RUN` is a `RoleAppRun` object hardcoded at the bottom
of the TPRM definition file. `currentStageId` is the literal string
`"evidence-review"`.

Both constants are imported directly by the process page components (`v3.tsx`)
and by the process stage detail renderer. Neither is read from the database.

**Consequence for V3.3**: advancing a stage, recording a completed run, or
persisting any human stage decision requires the `role_app_runs` table (and its
related tables) to be created and the page components refactored to read from and
write to the database rather than from a hardcoded constant.

---

## V2 surfaces available for reuse

Source: `src/components/workday-v2/`

**Shell and frame**
- `AppShellV2.tsx`  --  full V2 shell with rail, top bar and section grid
- `ShellFrame.tsx`  --  outer frame wrapper
- `ShellContext.tsx`  --  shared state context
- `TopBarV2.tsx`  --  48px top bar with scenario controls
- `NavigationRail.tsx`  --  collapsible left rail with all original nav items
- `WorkdayV2Route.tsx`  --  route wrapper / entry point for V2 pages
- `SelectionProvider.tsx`  --  selection context for centre workspace
- `LiveDaySlot.tsx`  --  live day player timeline control
- `ContextDrawer.tsx`  --  right context/evidence drawer
- `PartnerSlot.tsx`, `PartnerClient.tsx`  --  AI partner panel
- `DemoMenu.tsx`, `primitives.tsx`, `interactive.tsx`, `viewed-moment.ts`  --  utilities

**Sections (data-connected, directly reusable)**
- `sections/MailSection.tsx`  --  triaged inbox rendering
- `sections/CollaborationSection.tsx`  --  collaboration messages
- `sections/CalendarSection.tsx`  --  calendar entry rendering
- `sections/MeetingsSection.tsx`  --  meeting simulation rendering
- `sections/DecisionsSection.tsx`  --  decision queue rendering
- `sections/AssistantSection.tsx`  --  AI partner chat panel section

**Role workspaces**
- `role-workspaces/RcsaWorkspace.tsx`
- `role-workspaces/TprmWorkspace.tsx`
- `role-workspaces/ControlAssuranceWorkspace.tsx`
- `role-workspaces/IncidentResilienceWorkspace.tsx`
- `role-workspaces/RegulatoryChangeWorkspace.tsx`
- `role-workspaces/NfrGovernanceWorkspace.tsx`
- `role-workspaces/labels.ts`, `role-workspaces/index.ts`

`FocusWorkspace.tsx` and `RoleWorkObject.tsx` are also present.

The mail, calendar, meetings and collaboration sections connect to real seeded
data via `getInbox`, `getCalendar`, `getMeetings` and `getCollaborationMessages`
in `src/db/repositories/workday.ts`. They can be adapted into V3 light-theme
panels without a new data layer.

---

## Repository functions available

Source: `src/db/repositories/workday.ts`

All functions are read-only queries. Mutations are in the scenario engine.

**Institution**
- `getEntities`, `getEntity`
- `getRoles`, `getRole`
- `getUsers`, `getUser`, `getUserNameMap`

**Personal work layer**
- `getInbox(roleId, atMoment)`  --  moment-filtered, priority ordered
- `getCalendar(roleId)`  --  calendar events for a role
- `getMeetings(roleId)`, `getMeeting(meetingId)`, `getMeetingMessages(meetingId)`
- `getCollaborationMessages(roleId)`

**Decisions and execution**
- `getDecisions(roleId, atMoment)`, `getDecision(decisionId)`
- `getAllDecisions(atMoment)`, `getDecisionThread(sharedThreadId)`
- `getExecutionReceipt(decisionId)`

**Evidence**
- `getEvidenceDocument(documentId)`, `getEvidenceDocuments(ids)`
- `getAllEvidenceDocuments(atMoment)`, `getMissingEvidence`, `getStaleEvidence`
- `getApplicablePolicies(roleId)`, `getPolicy(policyId)`

**Third-party domain**
- `getSuppliers`, `getSupplier(supplierId)`
- `getSubprocessors(supplierId)`, `getAllSubprocessors`
- `getServices`, `getService(serviceId)`
- `getServiceDependencies`, `getImpactTolerances`
- `toleranceAppliesToEntity`, `getImpactTolerancesForEntity(entityId)`
- `getContracts(supplierId)`, `getContractObligations(contractIds)`
- `getSupplierExposure(supplierId)`  --  composite: supplier + services + subprocessors + contracts + obligations + dependencies

**Risk and control domain**
- `getProcesses`, `getProcess(processId)`
- `getRisks`, `getRisk(riskId)`
- `getControls`, `getControl(controlId)`
- `getKris`, `getKriReadings(kriId)`, `getBreachedKris`
- `getRiskControlGraph({ processId?, riskId? })`  --  nodes and edges

**Assessments**
- `getAssessments({ subjectId?, kind? })`, `getAssessment(assessmentId)`
- `getAssessmentLines(assessmentId)`, `compareAssessments(subjectId)`

**Control testing**
- `getControlTests`, `getControlTest(testId)`
- `getTestCases(testId)`, `getPopulationSummary(testId)`

**Incidents and resilience**
- `getIncidents`, `getIncident(incidentId)`, `getSharedEventIncident`
- `getIncidentTimeline(incidentId, atMoment)`, `getRecoveryOptions(incidentId)`

**Regulatory change**
- `getRegulatoryPublications`, `getRegulatoryPublication(publicationId)`
- `getObligations(publicationId?)`, `getUnownedObligationGaps`

**Issues, actions, committee, monitoring**
- `getIssues`
- `getActions({ roleId?, status? })`, `getOverdueActions`
- `getCommitteeItems`, `getMonitoringActivations`, `getPortfolioThemes`

**Background work**
- `getBackgroundWork(roleId, atMoment)`  --  counts and action rows

Additional repository files exist for other concerns:
- `src/db/repositories/rail.ts`  --  navigation rail data
- `src/db/repositories/shell.ts`  --  shell data
- `src/db/repositories/focus.ts`  --  focus queue
- `src/db/repositories/partner.ts`  --  AI partner
- `src/db/repositories/header.ts`  --  header counts
- `src/db/repositories/workspace.ts`  --  workspace data
- `src/db/repositories/observability.ts`  --  control room / agent observability

---

## Seed data

Source: `src/db/seed/run.ts`, `src/db/seed/tprm-onboarding.ts`

The seed writes everything in one deterministic transaction (same code path as
`demo:reset`). Tables seeded include the full set listed in `RUN_SCOPED_TABLES`
in run.ts.

**Confirmed seeded content**

| Data | Source module |
|---|---|
| Legal entities (Arcadia Bank AG / Oesterreich / Schweiz) | `scenario/data/institution` |
| Users (6 role holders + first line + externals) | `scenario/data/institution` |
| Roles (6) | `scenario/data/institution` |
| Scenario run (run-001, 06.10.2026) | inline in run.ts |
| Timeline events (10 moments) | `scenario/data/timeline-moments` |
| Timeline role moments (6 roles × 10 moments) | `scenario/data/timeline-moments` |
| Suppliers, subprocessors, services, service dependencies | `scenario/data/third-party` |
| TPRM onboarding supplier: TP-0099 (Veridian Document Systems GmbH) | `src/db/seed/tprm-onboarding.ts` |
| TPRM onboarding services, contracts, contract obligations | `src/db/seed/tprm-onboarding.ts` |
| TPRM onboarding evidence documents (7 items EVD-OB-0099-01..07) | `src/db/seed/tprm-onboarding.ts` |
| Risks, controls, processes, KRIs, KRI readings | `scenario/data/risk` |
| Assessments, assessment lines, control tests, test cases | `scenario/data/assurance` |
| Incidents, incident events, recovery options | `scenario/data/event` |
| Evidence documents (main corpus + generated) | `scenario/data/evidence`, `evidence-generated` |
| Inbox messages (per role, with reveal moments) | `scenario/data/work` |
| Calendar events (per role) | `scenario/data/work` |
| Meetings, meeting messages | `scenario/data/work` |
| Collaboration messages | `scenario/data/work` |
| Decisions, decision options, actions, issues | `scenario/data/decisions` |
| Background actions | `scenario/data/decisions` |
| Regulatory publications, obligations, policies | (included in scenario data) |
| Cached AI outputs (seeded suggestions) | `agents/suggestions/seed` |
| Live events (projected from above) | `scenario/live-event-seed` |
| Product configuration, connector instances | `product/seed`, `integrations/seed` |
| Audit events (20 pre-existing) | `scenario/data/decisions` |

No approval rows and no execution receipt lines are written by the seed.
`npm run verify:seed` asserts this.

---

## Hardcoded evidence

**Yes. Evidence is hardcoded.**

File: `app/workday/[role]/processes/third-party-onboarding/v3.tsx`, lines 48–88.

A `EVIDENCE_ITEMS` array is defined as a TypeScript constant in the component
file. It is not read from the database. It renders regardless of which role
visits the route (the route itself is guarded by a role check, but the array is
a module-level constant).

Contents:

| ID | Label | Status |
|---|---|---|
| EVD-OB-0099-01 | Vendor Information Questionnaire | accepted |
| EVD-OB-0099-02 | IT Security Assessment | accepted-with-condition |
| EVD-OB-0099-03 | Privacy Impact Assessment | accepted |
| EVD-OB-0099-04 | SOC 2 Type II Report 2025 | accepted |
| EVD-OB-0099-05 | Penetration Test Report (full) | missing |
| EVD-OB-0099-06 | Business Continuity Plan and Test Report | missing |
| EVD-OB-0099-07 | Legal Review Status Note | pending |

These IDs (EVD-OB-0099-01 through 07) do correspond to records seeded by
`tprm-onboarding.ts`, so the IDs are real. However, the status values are
hardcoded in the component rather than being read from the `evidence_documents`
table's `status` field. Any database mutation that changes an evidence item's
status is not reflected in the V3 process page.

---

## Documentation defects

**README.md  --  TPRM process URL is wrong**

README line 187 states:
> **Third-Party Onboarding** (`tprm-third-party-onboarding`) at
> `/workday/tprm/process/tprm-third-party-onboarding`

The actual route path, derived from the file system, is:
`/workday/tprm/processes/third-party-onboarding`

Two errors: `process` (singular) vs `processes` (plural), and the sub-path is
`third-party-onboarding` not `tprm-third-party-onboarding`.

**README.md  --  No stale V3.1 claim**

The README correctly identifies V3.1/V3.2 as the current default. It does not
claim V3.1 as an earlier default while V3.2 is live. No stale version claim found.

**README.md  --  Does not claim four interactive roles**

The README correctly states "2 flagship roles" and "4 preview roles". It does
not overstate parity.

**README.md  --  Route documentation for deprecated surfaces**

The README does not list calendar, meetings, mail, collaboration or workbench as
accessible routes from the role home. The redirects are mentioned in the
`next.config.ts` comments but not in the user-facing documentation. This is
acceptable but worth noting for any documentation update that describes what
routes exist vs what is accessible.

---

## Test coverage

**Unit tests** (`tests/unit/`)
- `authority.test.ts`  --  authority gate, adversarial: material mutations without valid approval
- `domain.test.ts`  --  domain calculators (risk matrix, impact tolerance)
- `evaluations.test.ts`  --  evaluation suite (14 structural evaluations)
- `secrets.test.ts`  --  secret scanner over source and browser bundle
- `loading-states.test.ts`  --  loading state machine transitions
- `ai-partner.test.ts`  --  AI partner state, suggestion schema
- `product.test.ts`  --  product configuration layer
- `integration-runtime.test.ts`  --  integration runtime and connector simulation
- `suggestions.test.ts`  --  suggestion schema validation (Zod)
- `focus-queue.test.ts`  --  focus queue deduplication and ordering

**Integration tests** (`tests/integration/`)
- `scenario.test.ts`  --  seed, state propagation and scenario engine
- `continuity.test.ts`  --  role switch continuity, shared event visibility
- `mutations.test.ts`  --  decision → approval → execution → receipt path
- `integration-flows.test.ts`  --  inbound and outbound integration event flows
- `ai-partner-flows.test.ts`  --  AI partner suggestion generation flows
- `focus-queue-flows.test.ts`  --  focus queue population from events and decisions

**E2E tests** (`tests/e2e/`)
- `journeys.spec.ts`  --  presenter journeys: entry, role home, decisions, shared event, role switch
- `security.spec.ts`  --  security assertions: no secrets in browser, no pre-decided options
- `visual.spec.ts`  --  screenshot matrix at 1366px and 1440px, overflow and text size assertions

**Screenshot artefacts**: `tests/e2e/__screenshots__/` contains captured screenshots from previous
runs at 1366px and 1440px across all 16 presentation scenes, workday role pages and report pages.
These are not test files.

**No tests for**: V3 process page rendering, role app run advancement, stage task completion,
evidence status read from database, V3 calendar / meetings / mail / collaboration pages.

---

## Reuse recommendations

The following V2 components can be lifted into V3 light-theme panels with
minimal adaptation (data layer is the same; only presentation token and layout
changes are needed):

1. **`MailSection.tsx`**  --  connects to `getInbox`; uses seeded `inbox_messages`. Adaptable
   to a V3 panel with the light palette tokens replacing the V2 graphite ones.

2. **`CalendarSection.tsx`**  --  connects to `getCalendar`; uses seeded `calendar_events`.
   Straight lift: no new repository functions needed.

3. **`MeetingsSection.tsx`**  --  connects to `getMeetings` / `getMeetingMessages`; uses seeded
   `meetings` and `meeting_messages`. Can drive a V3 meeting preparation panel.

4. **`CollaborationSection.tsx`**  --  connects to `getCollaborationMessages`; uses seeded rows.

5. **`DecisionsSection.tsx`**  --  already feeding into the V3 decisions page via the V3 dispatcher.
   The V2 section can be compared against the V3 decisions page for feature parity during V3.3.

6. **`NavigationRail.tsx`** (V2)  --  carries the full original nav with all six segments. Not
   suitable for V3 (which has three items), but useful as reference for any count-badge logic
   that needs to be ported to `WorkdayNavigation.tsx`.

7. **Role workspaces**  --  `RcsaWorkspace.tsx` and `TprmWorkspace.tsx` contain the data-connected
   domain workspace panels (risk/control graph, supplier constellation). These are V2-styled but
   the data bindings are real. Equivalent V3 workspace surfaces would start from these.

---

## Missing for V3.3

Gap list: what needs to be built or fixed before a V3.3 release.

**1. role_app_runs table and related tables**
- Tables `role_app_runs`, `role_app_stage_runs`, `role_app_stage_tasks`,
  `role_app_artifacts`, `role_app_events` do not exist.
- Currently runs are exported TypeScript constants with a hardcoded `currentStageId`.
- V3.3 requires: schema migration, seed updates, read repository functions, and
  updated process page components to read from and write to the database.

**2. Stage advancement for RCSA Cycle and TPRM Onboarding**
- The process page components import `RCSA_PAYMENTS_Q4_RUN` and
  `TPRM_VERIDIAN_ONBOARDING_RUN` as static objects.
- No server action advances the stage or records a completed stage.
- The decision gate at end of each stage is not wired to any mutation.

**3. Evidence status reads from database in V3 process page**
- `EVIDENCE_ITEMS` in `third-party-onboarding/v3.tsx` is a hardcoded array.
- The `evidence_documents` table has real rows (EVD-OB-0099-01..07) with a
  `status` field, but the component does not read them.
- V3.3 requires: replace the hardcoded array with a `getEvidenceDocuments` call
  and map `evidenceDocuments.status` to the component's status values.

**4. meeting_minutes table absent**
- Meeting transcripts are in `meeting_messages` (turn-by-turn simulation).
- If V3.3 requires a structured meeting-minutes record separate from the
  turn-by-turn transcript, the table does not exist.

**5. action_updates table absent**
- No table tracks update history for an action row. If V3.3 requires an
  activity log per action (who updated what, when), it must be created.

**6. ai_routines table absent**
- No scheduled AI routine table exists. If V3.3 requires AI routines that run
  on a cadence and record their outputs, the table must be created.

**7. V3 nav segments for calendar / meetings / mail / collaboration**
- `V3_NATIVE_SEGMENTS` does not include `"mail"`, `"calendar"`, `"meetings"`,
  `"collaboration"` or `"work"`.
- If V3.3 adds any of these as primary V3 surfaces (rather than keeping them
  as redirected V2 fallbacks), each must be added to `V3_NATIVE_SEGMENTS` in
  the same commit that adds its `v3.tsx` implementation.
- The page.tsx dispatchers for all five surfaces already exist; only the V3
  component and the segment registration are missing.

**8. TPRM process URL in README**
- README line 187 has the wrong path (`/workday/tprm/process/tprm-third-party-onboarding`).
- Correct path: `/workday/tprm/processes/third-party-onboarding`.

**9. No tests for V3 process pages**
- No unit, integration or E2E tests cover the RCSA Cycle or Third-Party
  Onboarding V3 process pages, stage rendering, or evidence status display.
- Any V3.3 process page work should add at minimum a journey test in
  `tests/e2e/journeys.spec.ts`.
