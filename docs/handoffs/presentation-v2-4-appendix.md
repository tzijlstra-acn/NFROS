# Presentation V2.4 appendix consolidation

Owner of `src/presentation-v2-4/data/appendix.ts` (`APPENDIX_SLIDES_V24`). This handoff records the final appendix, where each fact comes from, what was merged or removed, the claims corrected against the code, and the recommended `appendixRefs` for the thirteen core slides.

Synthetic institution and data. Illustrative regulatory context, not legal advice.

## Result

22 appendix slides in five index groups. Every slide has an action title, an evidence subtitle, a `group`, a `status` with an honest level and note, one primary visual, at least one `evidenceBasis` entry and two to five sentences of speaker notes.

Status levels used: `implemented` runs locally on synthetic data; `partial` some of it runs and the rest is labelled; `demo` seeded or shell only; `planned` design or proposal only; `reference` context material.

| Id | Group | Status | Visual | Title |
| --- | --- | --- | --- | --- |
| app-01 | Product | partial | status-table | Two role operating systems run today, while four roles remain demo or planned |
| app-23 | Product | partial | capability-map | The shared Role OS core already handles daily work and decisions, with gaps labelled |
| app-02 | Product | partial | status-table | The Role App library holds seven apps, and two of them can be started today |
| app-06 | Product | partial | product-proof (`ai-partner`) | The AI Partner prepares and proposes, while every action it requests passes the gate |
| app-10 | Product | demo | text-columns | AI routines are defined to read and draft for each role, but nothing schedules them yet |
| app-03 | Processes | partial | process-matrix | RCSA runs as eight stages, each closed by a recorded human decision |
| app-04 | Processes | partial | process-matrix | Third-party onboarding defines eight gated stages, with the demo case at evidence review |
| app-24 | Controls | partial | text-columns | Provenance and freshness labels keep fact, approved record and model inference apart |
| app-09 | Controls | implemented | authority-matrix | Six authority classes and three independent checks decide what may execute |
| app-25 | Controls | partial | status-table | Role scopes are enforced today, while bank identity and segregation of duties are not |
| app-26 | Controls | partial | status-table | The audit trail is append only and backups verify locally, but operations remain partial |
| app-29 | Controls | reference | text-columns | The product keeps the EU and Swiss regulatory lanes apart by design |
| app-08 | Technology | implemented | architecture-layers | The platform stacks five layers so the model never touches the database directly |
| app-27 | Technology | partial | integration-flow | The integration contract is built and proved, but every connector is still simulated |
| app-20 | Technology | partial | status-table | One of four deployment profiles runs today; three are defined with open work |
| app-11 | Technology | partial | status-table | Structural evaluations pass, while live AI quality is not yet measured |
| app-13 | Service and rollout | planned | service-stack | Each service tier carries a defined scope and cadence, from platform to managed operations |
| app-28 | Service and rollout | planned | text-columns | The App Factory is a proposed delivery path built on a definition that already exists |
| app-14 | Service and rollout | planned | text-columns | Commercial packaging separates one-time setup from recurring service |
| app-15 | Service and rollout | planned | text-columns | The design-partner scope starts with two roles and keeps autonomous execution off |
| app-16 | Service and rollout | planned | measurement-framework | Five pilot metrics are measured against the bank's own baseline, not benchmarks |
| app-22 | Service and rollout | reference | limitations-landscape | Known limitations set the boundary for any design-partner engagement |

## Topic coverage

| Required topic | Slide |
| --- | --- |
| Product scope | app-01 |
| Role OS capability map | app-23 |
| Role App Library | app-02 |
| AI Partner and routines | app-06, app-10 |
| RCSA process | app-03 |
| Third-Party Onboarding | app-04 |
| Evidence and provenance | app-24 |
| Authority and approval | app-09 |
| Identity and entitlements | app-25 |
| Audit, operations and recovery | app-26 |
| AI quality and evaluations | app-11 |
| Platform architecture | app-08 |
| Integration architecture | app-27 |
| Deployment profiles | app-20 (also carries AI data handling) |
| Service model | app-13 |
| App Factory | app-28 |
| Commercial packaging | app-14 |
| Design-partner scope | app-15 (also carries the stakeholder split) |
| Pilot metrics | app-16 |
| Current limitations and DACH context | app-22, app-29 |

## Merged, removed and repurposed

| Before | After |
| --- | --- |
| app-02 and app-05 listed the same invented Demo apps | Merged into app-02, rebuilt from `src/role-apps/registry.ts` (7 apps). app-05 removed |
| app-01, app-02 and app-22 overlapped on scope | app-01 is role and platform scope, app-02 is the app catalogue, app-22 is limitations only |
| app-06 described four generic AI capability groups | Repurposed as the AI Partner product proof with its real boundaries |
| app-07 repeated app-11 on evaluation and app-20 on data handling | Removed. Model modes moved to app-08, data handling to app-20 |
| app-09 repeated the core slide 9 matrix | Kept with enforcement detail only: six classes, tool counts, approval conditions |
| app-13 overlapped core slide 12 | Kept as tier scope and cadence detail; factory moved to the new app-28 |
| app-15 nearly repeated core slide 13 | Repurposed as design-partner scope boundaries (in scope, bank, Accenture, out of scope) |
| app-17 stakeholder map | Removed; its content is the "Bank provides" and "Accenture provides" columns of app-15 |
| Missing topics | New: app-23, app-24, app-25, app-26, app-27, app-28, app-29 |

## Claims corrected against the code

| Earlier claim | Repository fact |
| --- | --- |
| Demo apps "Control Assurance Review", "Event and Incident Manager", "Committee Preparation", "Regulatory Horizon Monitor" | Not in the code. The registry holds 2 installed and 5 preview apps, none of the preview apps has a route |
| RCSA "AI drafting at each stage"; onboarding "installed and tested" | RCSA AI text is seeded for stages 1 and 2 only; onboarding has a form at stage 4 and later stages are locked |
| Process cells "Rating recorded in GRC", "Actions created in action tracker" | Stage completion writes process events to the local database and does not call the authority gate; consequences run through the decision flow against local SQLite; the GRC connector is simulated |
| Eight AI routines including "Rating drift flag", "Committee summary" | Nine seeded routines (5 RCSA, 4 TPRM), read or draft only, no scheduler; worker handlers are stubs |
| "No persistent storage of LLM inputs or outputs", "No model training on client data", "Output reviewed before display", "Drift detection" | Chat turns and agent messages are stored in local SQLite; no training statement exists in the code or docs; no review rate or drift tracking exists |
| Deployment profiles cloud, hybrid, on-premise | Four profiles: restricted local prototype (implemented), dedicated managed, customer-managed private and bank private cloud (defined only) |
| Earlier decks: Claude model, PostgreSQL | OpenAI in live mode with safe and offline modes; SQLite with Drizzle |
| "English-language only" | English with about 90 German interface strings |
| Pilot targets such as 20 percent cycle time reduction | Removed. Metrics carry definitions and baselines only; no outcome is claimed |
| Identity "role-based access control implemented, admin panel" | Signed sessions and guards exist with 26 unit tests but are not wired to routes; authorisation is the role scope model in the authority gate; segregation of duties is not enforced |

## Sources by slide

| Slide | Primary sources |
| --- | --- |
| app-01 | `src/product/release/role-release.ts`, `src/role-apps/registry.ts`, `src/components/workday-v3/PreviewRolePage.tsx` |
| app-23 | `app/workday/[role]/work/v3.tsx`, `docs/handoffs/workday-v3-3-role-os.md`, `docs/handoffs/presentation-v2-4-completion-audit.md` (evidence drawer state) |
| app-02 | `src/role-apps/registry.ts`, `src/role-apps/rcsa/definition.ts`, `src/role-apps/tprm/definition.ts` |
| app-06 | `src/agents/suggestions/validate.ts` (13 rule codes), `src/server/security/authority.ts`, `src/server/config/demo-mode.ts`, `README.md` modes |
| app-10 | `docs/AI_ROUTINES.md`, `src/db/seed/role-app-runtime.ts`, `scripts/worker.ts` |
| app-03 | `src/role-apps/rcsa/definition.ts`, `docs/RCSA_PROCESS_APP.md`, `app/workday/[role]/processes/rcsa-cycle/v3.tsx` and `actions.ts` |
| app-04 | `src/role-apps/tprm/definition.ts`, `docs/TPRM_ONBOARDING_APP.md`, `app/workday/[role]/processes/third-party-onboarding/v3.tsx` |
| app-24 | `src/db/schema/core.ts` (provenance kinds), `docs/INTEGRATION_FABRIC.md` section 7, `docs/EVALUATION_REPORT.md` |
| app-09 | `docs/SECURITY_AND_AUTHORITY.md` sections 2 to 7, `src/server/security/authority.ts`, `tests/unit/authority.test.ts` |
| app-25 | `src/identity/*`, `docs/handoffs/v4-identity-access.md`, `src/product/entitlements/entitlements.ts` |
| app-26 | `src/server/security/audit.ts`, `src/audit/*`, `docs/handoffs/v4-audit-integrity.md`, `v4-reliability.md`, `v4-observability.md` |
| app-29 | `docs/DACH_CONTEXT.md`, `src/product/organisation/profile.ts`, `src/i18n/labels.ts` |
| app-08 | `README.md` architecture, `docs/AI_ARCHITECTURE.md`, `docs/PRODUCT_ARCHITECTURE.md` |
| app-27 | `docs/INTEGRATION_FABRIC.md`, `docs/CONNECTOR_CONTRACT.md`, `docs/PRODUCTIZATION_GAPS.md` |
| app-20 | `docs/DEPLOYMENT_PROFILES.md`, `src/product/seed.ts`, `tests/unit/product.test.ts` |
| app-11 | `docs/EVALUATION_REPORT.md`, `docs/handoffs/v4-evaluations.md`, `src/agents/evaluations/suite.ts` |
| app-13, app-14 | `src/presentation-v2-2/data/service-model.ts` (proposal), `docs/PRODUCT_ARCHITECTURE.md`, `docs/WHITE_LABEL_AND_PACKAGING.md` |
| app-28 | `src/role-apps/contracts.ts`, `src/presentation-v2-2/data/role-app-library.ts` (proposal), `docs/ROLE_APP_ARCHITECTURE.md` |
| app-15 | `docs/handoffs/v4-pilot-readiness.md`, `docs/WHITE_LABEL_AND_PACKAGING.md` section 6.4 |
| app-16 | Proposal; control metric from `src/server/security/audit.ts` (`getAuditCompleteness`) |
| app-22 | `docs/PRODUCTIZATION_GAPS.md`, `README.md` limitations, `docs/AI_ARCHITECTURE.md` section 14, V4 handoffs |

## Regulatory discipline

Slides that mention a regulator, regulation or compliance (app-04, app-11, app-15, app-22, app-29) carry "Illustrative regulatory context, not legal advice" as an evidence label, and app-22 and app-29 also carry it in the subtitle. DORA and EBA appear only against ARC-DE and ARC-AT. ARC-CH is FINMA supervised, and app-29 states that DORA does not apply to it.

## Recommended appendixRefs for the core slides

For the core-story owner to apply. Every id below exists in the new appendix.

| Core slide | appendixId | Label | Reason |
| --- | --- | --- | --- |
| slide-01 cover | none | | Structural slide |
| slide-02 agenda | none | | Structural slide; the agenda points to chapters, not detail |
| slide-03 fragmentation | app-01 | Product scope and release status | Shows what the product covers today against the problem |
| slide-03 | app-27 | Integration architecture | How sources reach one layer without a second record |
| slide-04 burden between systems | app-23 | Shared core capability map | Which friction points the shared core handles today |
| slide-04 | app-10 | AI routines and their status | The background preparation layer and what runs today |
| slide-05 engagement layer | app-08 | Platform architecture | The layers behind the engagement layer |
| slide-05 | app-27 | Integration architecture | Inbound and outbound pipelines and their control points |
| slide-05 | app-20 | Deployment profiles | Which profile runs today and what the others need |
| slide-06 workday | app-23 | Shared core capability map | Status of each workday capability shown on the slide |
| slide-06 | app-06 | AI Partner | What the AI Partner does and where it stops |
| slide-06 | app-10 | AI routines and their status | Routines are seeded today, not scheduled |
| slide-07 shared core per role | app-01 | Product scope and release status | Which roles are available, demo or planned |
| slide-07 | app-23 | Shared core capability map | The common services each role reuses |
| slide-08 Role Apps | app-03 | RCSA Cycle Assistant stages | Stage by stage AI, human and recorded outcome |
| slide-08 | app-04 | Third-Party Onboarding stages | Stage by stage detail and the demo case position |
| slide-08 | app-02 | Role App library | All seven apps and which can be started today |
| slide-09 authority line | app-09 | Authority classes and approval checks | The enforcement behind the authority line |
| slide-09 | app-25 | Identity and entitlements | What is enforced today and what needs bank identity |
| slide-10 trust and evidence | app-24 | Evidence and provenance | How sources, freshness and inference are labelled |
| slide-10 | app-26 | Audit, operations and recovery | Audit trail, hash chain and recovery as built |
| slide-10 | app-29 | EU and Swiss jurisdiction lanes | Why the footer carries the regulatory disclaimer |
| slide-11 value case | app-16 | Pilot metrics and baselines | How each value branch is measured in the pilot |
| slide-11 | app-11 | AI quality and evaluations | What quality evidence exists and what does not |
| slide-12 service model | app-13 | Service tiers and cadence | Scope and cadence of each tier |
| slide-12 | app-28 | App Factory | How new Role Apps would be delivered |
| slide-12 | app-14 | Commercial packaging | One-time and recurring elements |
| slide-13 design-partner start | app-15 | Design-partner scope | What is in and out of the first engagement |
| slide-13 | app-16 | Pilot metrics and baselines | The scorecard agreed before the pilot |
| slide-13 | app-22 | Current limitations | The boundary any engagement starts from |

Current core references to removed ids that must change: slide-05 to app-07, slide-08 to app-05, slide-13 to app-17. Until they change, the test "every appendix reference resolves to an appendix slide" fails on those three.

## Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit -p tsconfig.json` | No errors |
| `npx vitest run tests/unit/presentation-v2-4-copy.test.ts` | 37 of 38 pass. All appendix tests pass, including group and status. The one failure is the core reference test, caused by the three dangling core references above |
| `npx tsx scripts/check-presentation-headlines.ts` | 0 errors. 1 warning, on core slide-01 (sentence case flagged because of the acronym NFR). No appendix warnings |

## Notes for the renderer and core owners

- The two process matrices have 8 stages by 3 tracks, with cell keys `Stage_Track` and tracks `AI prepares`, `Human decides`, `Recorded outcome`. Cells are 55 characters or fewer.
- app-06 is the only product-proof slide and uses asset id `ai-partner`.
- Capability-map status strings are `Implemented`, `Partial`, `Demo`, `Simulated` and `Not built`.
- The repository contains a `Dockerfile` and `docker-compose.yml`, although README says "No Docker". The appendix says only that a container build file exists and that no cloud deployment has been run.
- Product facts that differ from older docs, for the next audit: the evidence drawer in the current interface shows an empty state; the audit hash chain covers only the five seeded events; `requireSession`, `requireRole` and `requireAdministrator` have no callers outside tests; the outbound integration dispatcher is only exercised by `scripts/prove-integration.ts`.
