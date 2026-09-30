# Source Repository Audit

Foundation document for NFR WorkOS. Produced by inspecting two existing repositories read only and recording what each contributes to the rebuild.

Detailed findings live in two companion documents:

- `docs/handoffs/source-visual-findings.md` (visual design DNA, from NFRPitch)
- `docs/handoffs/source-domain-findings.md` (NFR domain language and structures, from RealAIInfrastructure)

This document is the index, the reuse decision list, and the attestation.

---

## Correction to the original brief

**The pitch source repository is named `NFRPitch`, not `30minsAIChat`.** The original brief assumed the latter. The actual path inspected is:

    C:\Users\thomas.zijlstra\Code Projects Accenture\NFRPitch

No directory named `30minsAIChat` was involved in this audit. Any downstream task, script, path constant, or document that refers to `30minsAIChat` as the pitch source is wrong and should be corrected to `NFRPitch`.

Two further corrections to assumptions in the brief:

1. `NFRPitch` is **not** a single-file HTML pitch. `pitch.html` is 124,616 bytes but only 739 lines: it is markup only. All styling lives in five external stylesheets under `assets/css/` (the largest, `pitch.css`, is 83,914 bytes on its own) and all behaviour lives in 25 JavaScript modules plus 12 scene modules under `assets/js/`. Fonts, icons, d3, motion, and elkjs are self-hosted under `assets/vendor/`. Treating it as one file would miss where the design system actually is.
2. `RealAIInfrastructure` contains **two** products in one tree. The NFR platform is the relevant one. An OpenAI-compatible inference gateway with Prometheus, Grafana, OpenTelemetry, and Helm charts occupies a large share of the repository and of its documentation, and is out of scope.

---

## Attestation

- **Neither source repository was modified.** No file inside `NFRPitch` or `RealAIInfrastructure` was created, edited, moved, renamed, or deleted. Every operation was a read: directory listings, `wc`, `head`, `sed -n`, `grep`, `cat`, and JSON key inspection. No git command that alters state was run in either repository. All writes from this task went to `nfr-workos` only, specifically the three documents listed at the top of this file.
- **No secret value was read or copied.** `RealAIInfrastructure/.env` was never opened. `RealAIInfrastructure/.env.example` was never opened. No search for secret-shaped strings was performed. No git history was inspected for secrets. The only permitted statement, already confirmed in the task brief, is that a variable **named** `OPENAI_API_KEY` exists in `RealAIInfrastructure/.env`. No value of that or any other variable appears in this document or in either handoff document. `README.md` in that repository shows environment variables with placeholder values in its quick-start section; those placeholders were not transcribed.
- **No em dash (U+2014) was written** in this document or in either handoff document. Commas, colons, semicolons, parentheses, and separate sentences are used instead. Note that both source repositories use em dashes extensively in their own comments and documentation; where source text is quoted here, the em dash has been replaced with a colon or a comma and the quotation is marked as paraphrased in wording only, never in substance.

---

## Files inspected

### NFRPitch (read only, visual source)

| Path | Repo | What it gave us |
|---|---|---|
| `pitch.html` | NFRPitch | Section data-attribute contract (`data-slide`, `data-route`, `data-scene`, `data-chapter-id`, `data-nav-title`, `data-density`, `data-size`, `data-scene-container`, `data-scene-fallback`); the three-part screen structure (`screen-hdr`, `scene-stage`, `scene-footer`); the inline `window.NFR_BUILD` identity (`v26`, commit `68f790f`); the `?v=` cache-buster convention; the 21 ordered script tags that reveal module load order |
| `index.html` | NFRPitch | The `sessionStorage.pitch_auth` access gate pattern (noted as presentation hygiene, explicitly not an auth model) |
| `assets/css/pitch.css` | NFRPitch | All colour token values for both themes; the semantic alias layer (`--ai`, `--human`, `--evidence`, `--risk`, `--data`, `--gap`, `--ai-ink`, `--human-ink`, `--control-ink`); typography sizes, weights, and letter spacing; the reduced-motion block at lines 480 to 486; all four keyframes; the two custom easing curves; the card and panel recipe; the status badge tint / text / border triple; radius and spacing values; section geometry and responsive height breakpoints |
| `assets/css/scenes.css` | NFRPitch | The `.scene-screen` three-row grid geometry contract; `--screen-gap: clamp(8px, 1.1vh, 14px)`; stage `data-size` aspect-ratio budgets (16/5.2, 16/6.5, 16/7.2); the `contain: layout paint size` isolation; the 48px footer cap; the documented (and unmet) V14 typography scale comment |
| `assets/css/print.css` | NFRPitch | Print as a first-class deliverable: warm paper palette (`#FDFAF7` on `#1A1612`), 10pt, chrome hidden, `page-break-before: always` per section |
| `assets/css/connectors.css` | NFRPitch | Confirmed existence of a dedicated SVG connector styling layer (`.ce-path`) separate from component CSS |
| `assets/css/knowledge-graph.css` | NFRPitch | Confirmed a separate graph view styling layer |
| `assets/vendor/fonts/fonts.css` | NFRPitch | The three-family split (Space Grotesk, Inter, JetBrains Mono), available weights (400, 600, 700 for Space Grotesk), `font-display: swap`, per-script subsetting, all self-hosted |
| `assets/js/navigation.js` | NFRPitch | The full keyboard map; touch swipe threshold (52px); the derived-position `IntersectionObserver` model (0.5 for slides, 0.12 for reveals); core-only counter and progress math; `history.replaceState` for the hash; lazy per-section render; the agenda drawer construction; the `handoffToken` and candidate-token continuity mechanisms; the stubbed route-mode feature |
| `assets/js/story/scene-director.js` | NFRPitch | The V26 scene lifecycle contract; the never-blank failure chain (`renderError`, `renderStatic`, `[data-scene-fallback]`); the `document.fonts.ready` gate; the debounced shared `ResizeObserver`; `visibilitychange` pause and resume; the `aria-live` accessible summary injection; `createTimeline` with `play`, `pause`, `seek`, `finish`; the `window.sceneUtils` helper set; startup registry validation and the direct-hash fallback; the documented `resume()` limitation |
| `assets/js/edge-rail.js` | NFRPitch | The deliberate-hover navigation rail: 140ms dwell, 350ms close, 312px panel, `P` to pin, pin gated to 1536px and wider, overlay never pushes content |
| `assets/js/state.js` | NFRPitch | The client state shape (`route`, `archetype`, `lens`, `pressures`, `selectedCapabilityIds`, `maturity`, `targetMaturity`, `criteriaWeights`, `proofCandidateId`, `openDecisions`, `evidenceNotes`, `sessionNotes`) and the six named scoring criteria |
| `assets/data/story-manifest.json` | NFRPitch | Manifest version 26; the seven chapter ids and labels; all twelve screens with `order`, `chapterId`, `title`, `subtitle`, `closingLine`, `scene`, `durationMs` (6500 to 11000), `autoplay`, `handoffToken`, and `evidenceLabel` |
| `scripts/audit-story.js` | NFRPitch | The editorial gates: 12 core screens maximum, 10-word title limit, 22-word subtitle limit, weak-framing article detection, and the printed per-screen table |
| `scripts/audit-icons.js` | NFRPitch | The icon manifest allowlist model and the unused-entry report |
| `scripts/audit-motion.js` | NFRPitch | Scene lifecycle completeness, `createTimeline` requirement, `destroy()` cleanup requirement, untracked `setTimeout` leak detection, the `cursor:pointer` ban with its stated reason, and the 12s hero / 7s standard duration budget |
| `scripts/audit-offline.js` | NFRPitch | The complete external-dependency check surface: script src, link href, img src, CSS `url()`, `@import`, `fetch()`, XHR `open()`, dynamic `import()`, with localhost whitelisted |
| `scripts/check-emdash.py` | NFRPitch | The U+2014 gate: file glob set and exclusion list, exits 1 with every offending path listed |
| `scripts/lint-copy.py` | NFRPitch | The claims-discipline gate: the 15-term banned absolute-language list, exclamation-in-string detection, and the `lint-ok` inline suppression convention. Also two bugs to avoid porting (`if hits or True:` dead guard, unimplemented `REVIEW` severity split) |
| `scripts/validate-data.js` | NFRPitch | Referential integrity checks; the `technologyPatternId` vocabulary (`rules-workflow`, `rpa-orchestration`, `analytics-ml`, `genai-copilots`, `agents`); the `sharingStatus` vocabulary (`live`, `team`, `to-confirm`, `illustrative`, `nda`); the tri-state `evidenceFlags` model (`concept`, `prototype`, `asset`, `demo` each `true`, `false`, or `null`); the source-number completeness proof technique |
| `scripts/audit-all.js` | NFRPitch | The stated P0 fail list; the six-check master runner; the named font-size floor table; the strip-media-queries-before-auditing technique |
| `tests/layout.spec.js` | NFRPitch | The six-viewport matrix; the `100dvh` section-height assertion; horizontal overflow detection with 2px tolerance; the `display: grid` geometry assertion; the two-sided stage height bound (250 to 320px); the hard-coded-hex ban in core markup; the static fallback presence and correctness checks; the reduced-motion final-state check; keyboard navigation tests; the `assertInsideSafeFrame` helper. Also the weaknesses to avoid: source-string assertions, fixed `waitForTimeout`, version-prefixed naming, duplicate tests |
| `playwright.config.js` | NFRPitch | Six project definitions, `timeout: 30000`, `retries: 0`, the `webServer` block with `reuseExistingServer` |
| `package.json` | NFRPitch | The full script surface and the one-dev-dependency discipline (`@playwright/test` only) |
| `V23_BASELINE.md` | NFRPitch | The defect ledger by priority: the P0 resize and font-ready failures and their fixes; the P1 footer-row height theft and its fix; the P2 sub-floor font sizes; the P4 viewport coverage gap and its fix; the confirmed zero external runtime requests; the layer-by-layer geometry contract statement |
| `AUDIT_BASELINE.md` | NFRPitch | Confirmed the existence of a prior structured audit practice in this repository lineage |

### RealAIInfrastructure (read only, NFR domain source)

| Path | Repo | What it gave us |
|---|---|---|
| `README.md` | RealAIInfrastructure | The two-product structure; the stated architecture chain; the feature list; the "30+ agents" claim that the code does not support (actual: 18 in the registry) |
| `backend/main.py` (1,456 lines) | RealAIInfrastructure | `NFR_AGENTS_REGISTRY` at line 375: all 18 agents with `id`, `name`, `group`, `dept`, `live`, `data_source`, `icon`, `description`; all 78 route definitions; the agent-orchestration API shape worth keeping; the 18 duplicated per-agent endpoints to avoid; the `{"ok": false}` with HTTP 200 anti-pattern |
| `backend/agents/orchestrator.py` (1,280 lines) | RealAIInfrastructure | `AgentStep` and `AgentRun` dataclasses in full; `StepKind` and `RunStatus` literal unions; the human-in-the-loop pause and decide mechanism; the four write-back action types; `schedule_outcome_check` 24-hour follow-up; `_enrich_context_with_prior_findings`; the in-memory store with `MAX_RUNS = 200` and its SQLite mirror; per-agent scheduling config |
| `backend/agents/rcsa.py` | RealAIInfrastructure | The canonical three-node assessment chain (inherent, controls, residual) in full; three complete system prompts with their personas, frameworks, and JSON schemas; the `_RCSAState` TypedDict; the `risk_appetite_breach` comparison; sentence-count output constraints |
| `backend/agents/tprm.py` | RealAIInfrastructure | The four-node vendor onboarding chain; the risk tier vocabulary (`tier-1`, `tier-2`, `tier-3`); due diligence level enum; `fourth_party_exposure`; `dora_ict_tpp` flag; `exit_strategy_complexity`; the six mandatory questionnaire sections with `complete` / `partial` / `missing` status plus `gaps` plus `recommended_clauses` |
| `backend/agents/op_resilience.py` | RealAIInfrastructure | The DORA resilience model: IBS assessment against impact tolerance, `rto_assessment` and `rpo_assessment` as `within_tolerance` / `exceeds_tolerance` / `not_tested`, article-level gap mapping with `dora_article` and `article_title` and `regulatory_deadline`, and a phased remediation roadmap with cost and owner |
| `backend/agents/issue_mgmt.py` | RealAIInfrastructure | The unified issue vocabulary (`incident`, `problem`, `near_miss`, `audit_finding`, `control_failure`); `dora_classification` enum; `gdpr_breach` flag; the 5-Why `why_chain` structure; `control_failure`, `systemic_weakness`, `recurrence_risk` |
| `backend/agents/kri_monitor.py` | RealAIInfrastructure | The KRI schema: dual thresholds (`threshold_amber`, `threshold_red`), RAG `status`, `trend`, `breach` flag, mandatory `rationale`; and the separation of numeric breach from `breach_narratives` with `management_response`, `escalation_required`, `next_review_date` |
| `backend/agents/reg_change.py` | RealAIInfrastructure | Regulatory change model: `urgency`, `estimated_effort_days`, `readiness_gap_pct`, `overall_readiness`; `dependency_groups` with `recommended_sequence` and `shared_resources`; `critical_path`; `resource_conflicts`; `immediate_priorities` with owner, deadline, and P1 priority; `quarterly_milestones` |
| `backend/agents/pipeline.py` | RealAIInfrastructure | The seven-stage document enrichment chain and its `STAGES` list; the `{stage, status, data}` WebSocket progress protocol |
| `backend/agents/extraction.py` | RealAIInfrastructure | Agent 1's normalisation schema: `record_id`, `record_type`, `title`, `description`, `priority`, `impact_areas`, `keywords`, `entities_mentioned` (systems, regulations, people_roles), `raw_category` |
| `backend/agents/workflows.py` | RealAIInfrastructure | The per-agent step emission pattern (`fetch`, `working`, `analyze`); the `asyncio.sleep(0.05)` UI-pacing anti-pattern; the COREP workflow as a worked example |
| `backend/agents/base.py` | RealAIInfrastructure | The model strategy (gpt-4o-mini primary, gpt-4o fallback); `run_agent_json`; the `N8nChatModel` LangChain wrapper (obsolete for the rebuild) |
| `backend/agents/__init__.py`, all 36 agent module headers | RealAIInfrastructure | The complete self-described role of every agent, including the numbered pipeline agents 1 through 7 and the support modules (`graph.py` with `StepDef` and `build_step_graph`, `tools.py`, `resolver.py`, `outcome_tracker.py`, `ai_risk.py` with its agents-as-model-inventory idea) |
| `backend/graph/knowledge_graph.py` (479 lines) | RealAIInfrastructure | The 16 node types with their exact colour values; `recommendation` and `resolution` as first-class nodes; `_PROCESS_DOMAIN` process-to-domain mapping; the snapshot format; graph stats via `Counter` on `_type`; the missing edge-vocabulary constant |
| `backend/apis/ics.py` | RealAIInfrastructure | The six hard-coded ICS processes with `name`, `area`, `control_domains`, `owner_id`, `sub_processes`, `rcsa_cycle_days`, `last_rcsa`, `snow_keywords`, `snow_categories`; the documented live-over-baseline source priority rule with `source` tagging |
| `backend/data/nfr_taxonomy.json` | RealAIInfrastructure | The nine NFR domains with ids, names, colours, subdomains, `key_regulations`, and `risk_appetite` (`zero`, `low`, `medium`); `severity_levels` |
| `backend/data/fake/controls.json` (64) | RealAIInfrastructure | The control entity: `type` (preventive, detective, corrective), `status` (effective, needs_improvement, developing), 11 `domain` values, `framework_refs` at article granularity, `mitigates_risks`, `linked_assets`, `last_tested`, `effectiveness_score`, and embedded `test_questions` |
| `backend/data/fake/risks.json` (18) | RealAIInfrastructure | The risk entity with the `iL` / `iI` / `rL` / `rI` inherent-to-residual spine, banded ratings, `trend`, `process_id` link, `regulation_refs`, `exec_summary`; and the abbreviated field naming to fix |
| `backend/data/important_business_services.json` (9) | RealAIInfrastructure | The resilience entity: `rto_minutes`, `rpo_minutes`, `ilf_breached`, `test_date`, `test_result`, `dependencies`, `third_parties`, `disruption_scenarios`, `dora_art_mapping` |
| `backend/data/model_inventory.json` (14) | RealAIInfrastructure | Separate `owner` and `validator` (independent validation), `tier`, `materiality`, `validation_status`, `next_validation_due`, `approval_status`, `risk_type` |
| `backend/data/cyber_risks.json` (16) | RealAIInfrastructure | Threat modelling extension to the risk spine: `threat_actor`, `attack_vector`, `vulnerability`, `residual_score`; and the field-name divergence from `risks.json` |
| `backend/data/dpia_register.json` (15) | RealAIInfrastructure | The GDPR Article 30 plus DPIA shape: `legal_basis`, `data_categories`, `data_subjects`, `volumes_records`, `retention_years`, `third_country_transfer`, `processors`, `dpia_required`, `dpia_status`, `dpo_approved` |
| `backend/data/contracts.json` (18) | RealAIInfrastructure | Third-party commercial risk: `concentration_pct`, `auto_renewal`, `days_to_expiry`, `critical_service`, `sla_compliance_pct`, `risk_rating` |
| `backend/data/fake/vendors.json` (15) | RealAIInfrastructure | Vendor entity: `criticality`, `risk_rating`, `country`, `contract_value_eur`, `data_shared`, `certifications` |
| `backend/data/fake/assets.json` (15) | RealAIInfrastructure | Asset entity: `criticality`, `data_classification`, `environment`, `vendor_id` link, `vulnerabilities` |
| `backend/data/audit_universe.json` (16) | RealAIInfrastructure | Risk-based audit planning triple: `inherent_risk`, `days_since_audit`, `issues_outstanding`, plus `last_audit_opinion`, `control_environment`, `regulatory_focus` |
| `backend/data/regulatory_calendar.json` (14) | RealAIInfrastructure | Obligation entity: `regulation`, `full_name`, `effective_date`, `impact_area`, `change_type`, `status`, `readiness_pct`, `owner`, `action_required` |
| `backend/data/policies.json` (15) and `backend/data/fake/policies.json` (15) | RealAIInfrastructure | Two incompatible shapes for the same policy entity: evidence of the duplicate-model problem |
| `backend/data/aml_alerts.json` (12), `capital_data.json`, `corep_data.json`, `credit_portfolio.json`, `esg_data.json`, `fake/employees.json` (33), `fake/documents.json` (32), `graph_snapshot.json`, `automation_log.json` | RealAIInfrastructure | Supporting entity shapes; the employee `risk_owner` flag and `access_level`; the document `process_ids` and `regulation_refs` cross-links; the graph persistence format |
| `data/processed/*.json` (10 files) | RealAIInfrastructure | Every file is a failure stub: `{"title": "...", "doc_type": "other", "purpose": "Extraction failed", "error": "llm_unavailable"}`. Evidence that the document intelligence feature is unproven, and a worked example of the silent-degradation failure mode that the pitch repository's never-blank rule prevents |
| `frontend/css/style.css` | RealAIInfrastructure | A third, divergent palette: `--purple: #A100FF`, `--bg: #0d001f`, `--ink: #160029`, translucent `--surface: rgba(255,255,255,.045)`, `--border: rgba(161,0,255,.18)`, base `font-size: 13.5px`, `--r: 8px`, `--r-lg: 14px`. Same brand purple and same three font families as NFRPitch, but different background, surface model, and radius scale |
| `frontend/js/agents-hub.js` (2,103 lines) | RealAIInfrastructure | The agent hub UI model: per-agent cards with progress fill and status ring, a mini step trail, SSE run streaming via `_startStreamForRun`, an auto-run toggle with schedule, and `statusClass(agentId)` derived from the latest run |
| `frontend/js/` (app, auth, automation, graph-viz, ics-app, monitoring, ws-client; 5,941 lines total) | RealAIInfrastructure | Confirmed the scale and structure of the vanilla-JS SPA being replaced; the D3 graph visualisation and WebSocket client patterns |
| `docs/repository-audit.md` | RealAIInfrastructure | The prior audit practice, and evidence of documentation drift: it documents only the inference gateway and never mentions the NFR platform, the agents, or the knowledge graph |
| `docs/adr/001` to `004`, `docs/slos.md`, `docs/threat-model.md`, `docs/runbooks/`, `docs/postmortems/` | RealAIInfrastructure | All four ADRs concern the gateway (mock backend, OpenAI-compatible API, observability stack, GPU not required). No ADR records any NFR domain decision. A gap the rebuild should not repeat |
| `SECURITY.md`, `.gitignore`, `pyproject.toml`, `requirements.txt`, `Makefile`, `CHANGELOG.md` | RealAIInfrastructure | Security posture statements (non-root UID 1001, read-only root filesystem, dropped capabilities, `pip-audit` in CI, no secrets committed); dependency set; environment files correctly ignored |

Also inspected in the target repository for context only (`nfr-workos`, writable): `package.json`, `src/styles/tokens.css`, and the file list under `src/`. The existing `src/styles/tokens.css` has already ported the NFRPitch dark palette and formalised the semantic colour contract, which confirms the intended lineage.

---

## Borrowed concepts

Conceptual reuse only. No code is copied from either source repository. Each item below is an idea, a contract, or a vocabulary to re-express natively in TypeScript, React, and Next.js.

### From NFRPitch (visual and quality)

| # | Concept | Why |
|---|---|---|
| B1 | The four-layer scene geometry contract: `100dvh` section, centred `.inner`, `grid-template-rows: auto minmax(0, 1fr) auto`, `min-height: 0` at every level, `contain: layout paint size` on the stage | This is what makes a fixed-viewport visual screen reliable. `minmax(0, 1fr)` plus `min-height: 0` is the specific mechanism that stops content from forcing a section taller than the viewport |
| B2 | The semantic colour alias layer: `--ai`, `--human`, `--evidence`, `--risk`, `--data`, `--gap`, `--ai-ink`, `--human-ink`, `--control-ink` | Colour carries meaning rather than decoration. Already adopted in `src/styles/tokens.css` |
| B3 | The tint / text / border triple for every state surface: roughly 10 percent fill, full-strength text, 25 to 30 percent border | The single most repeated recipe in the source and the basis of every badge, chip, and selected state |
| B4 | The three-family typographic split: Space Grotesk display, Inter body, JetBrains Mono for every label and metric, with negative tracking on display and wide positive tracking on uppercase mono | Mono for labels and numbers is what makes a risk interface read as instrumentation rather than marketing |
| B5 | Stage `data-size` with declared aspect-ratio budgets (`compact` 16/5.2, `standard` 16/6.5, `wide` 16/7.2) | A visual knows its drawing space before it measures anything |
| B6 | Never blank on failure: static pre-rendered fallback, then `renderError`, then `renderStatic`, then reveal the fallback | A visual that fails in front of a client must degrade to a correct static picture, not an empty box |
| B7 | The `document.fonts.ready` gate before any text measurement | Fixes the cold-load clipping class of bug outright |
| B8 | One shared debounced `ResizeObserver` (120ms) that pauses, resizes, and resumes | The prior absence of this was a recorded P0 defect |
| B9 | Pause on `visibilitychange`, resume on return, respecting an explicit user pause | No animation burns CPU in a background tab |
| B10 | Two-layer reduced-motion handling: CSS neutralises transitions and hides the canvas, and the JS timeline jumps to its final state via `finish()` | The accessible path must show the end state, never nothing |
| B11 | Derived navigation position via `IntersectionObserver` (0.5 for screens, 0.12 for one-shot reveals), with `history.replaceState` for the hash | Position is computed from the DOM, so it cannot drift out of sync, and the back button is not polluted |
| B12 | Core-versus-reference routing so reference screens do not inflate the counter, the progress bar, or the audit limits | Lets a deck carry appendix material without diluting the narrative |
| B13 | The presenter affordance set: agenda drawer on `G`, hover-dwell edge rail with `P` to pin, replay on `R`, pause on Space | Keyboard-first operation in front of an audience |
| B14 | `closingLine` per screen plus `handoffToken` naming the visual object that carries into the next screen | Continuity is designed, not incidental |
| B15 | The editorial gates: 12 screens maximum, 10-word titles, 22-word subtitles, no titles beginning with a definite article | Encodes narrative discipline as a build gate |
| B16 | The copy linter: no em dash, no exclamation marks in strings, a banned absolute-language list, `lint-ok` as an explicit reviewable suppression | Claims discipline for a regulated audience |
| B17 | The six-viewport test matrix, especially `1024x768` and `1280x720` | Meeting-room projectors and screen shares are where presentation layouts break |
| B18 | Assert the geometry contract with a computed-style test (`display === 'grid'`, section height within 2px of `innerHeight`, no horizontal overflow, footer height capped) | Structural rules that a visual review would miss |
| B19 | The two-sided bound (a stage must be at least 250px and at most 320px) | Catches collapse as well as overflow |
| B20 | Ban hard-coded hex in markup, enforced by test | Forces token usage |
| B21 | The closed vocabularies and tri-state evidence model from `validate-data.js`: `sharingStatus` (`live`, `team`, `to-confirm`, `illustrative`, `nda`) and `evidenceFlags` where each of `concept` / `prototype` / `asset` / `demo` is `true`, `false`, or `null` | The tri-state distinguishes "we have it", "we do not", and "we have not assessed it": exactly the distinction an evidence model needs |
| B22 | Icon curation via an explicit manifest, mapping a sanctioned icon to each meaning | `@tabler/icons-react` catches typos; the manifest still governs which icon means what |
| B23 | One `audit:all` command with its P0 fail list stated in the file header | Rules must be discoverable where they are enforced |
| B24 | The `cursor:pointer` ban inside non-interactive visuals | A diagram element that looks clickable but is not invites a failed click in front of an audience |
| B25 | Print as a first-class stylesheet with real page breaks and a warm paper palette | The deck will be printed and emailed |
| B26 | A single coherent build identity stamped everywhere and verified by test | Prevents mixed-version asset loads |
| B27 | Static skeleton paints before async data resolves, asserted at a 100ms budget | No empty frame while a fetch is in flight |
| B28 | Per-instance colour injection via one CSS variable (`var(--block-color, var(--accent))`) so a component and all its children recolour from one value | Simple theming for category-coloured cards |
| B29 | Interaction feedback by border and tint only, never by size, with a single 2px hover lift | Layout never reflows on hover, which matters inside a fixed-height stage |

### From RealAIInfrastructure (domain)

| # | Concept | Why |
|---|---|---|
| B30 | The `AgentRun` and `AgentStep` model: a typed, ordered, timestamped step trail with `StepKind` (`fetch`, `working`, `analyze`, `decision`, `hitl`, `action`, `complete`, `error`) and `RunStatus` (`running`, `waiting_human`, `completed`, `failed`, `cancelled`) | The spine of an accountable agent product. Every run is auditable by construction |
| B31 | Human-in-the-loop as a step property: `requires_human`, `human_prompt`, `options`, `decision`, with a guard against deciding twice | "Human accountability at every material decision" needs a data structure, and this is it |
| B32 | `writeback` on a step capturing `{type, payload, result}`, with `add_work_note`, `create_change_request`, `create_incident`, `send_alert` as the action types | Records what the agent actually did to the outside world, not just what it concluded |
| B33 | Scheduled outcome checking 24 hours after a write-back | Measures whether the action helped. Rare and valuable |
| B34 | Prior-findings enrichment so a new run sees earlier findings for the same agent | Makes the system an operating environment rather than a set of one-shot tools |
| B35 | The agent-orchestration API shape: run, list, get, SSE stream, decide, cancel, pending-HITL, outcomes, config | The right API for an agent product. Rebuild as one parameterised route, not 18 |
| B36 | The prompt contract: named professional persona plus named framework and jurisdiction, one-line task, explicit output schema, and exact prose length constraints | The framework grounding ("applying the Three Lines of Defence model and COSO internal control framework") is what makes output credible to a risk audience. Length constraints are what make it fit the UI |
| B37 | The inherent to control to residual assessment chain as three discrete, separately inspectable steps, each receiving the previous step's output verbatim | The correct decomposition of an RCSA, and it makes the reasoning auditable |
| B38 | The likelihood and impact pair on a 1 to 5 scale, at both inherent and residual levels, producing a banded rating | The canonical operational risk data shape |
| B39 | `risk_appetite` as a domain-level enum (`zero`, `low`, `medium`) with an explicit `risk_appetite_breach` comparison against residual rating | Appetite is a property of the domain, and breach is a derived fact |
| B40 | The nine-domain NFR taxonomy with named subdomains and `key_regulations` per domain | The product's primary navigation and the classification target |
| B41 | Article-level regulatory mapping (`DORA-Art.28`, `GDPR-Art.32`, `ISO27001-A.9.4`) rather than regulation-level | Article granularity is what makes gap analysis actionable |
| B42 | The knowledge graph node type set (incident, problem, change, employee, asset, vendor, control, policy, regulation, NFR domain, risk, service, contract, process) with `recommendation` and `resolution` as first-class nodes | Agent output becomes a linked, traceable entity in the same graph as its evidence |
| B43 | The seven-stage enrichment pipeline: extract, link entities, classify, score risk, map regulation, relate documents, write field, with a `{stage, status, data}` progress stream | A reusable pattern for turning any inbound record into a structured risk event |
| B44 | Control `test_questions` embedded on the control record, alongside `last_tested` and `effectiveness_score` | A control carries its own test script. The seed of real control testing |
| B45 | The unified issue vocabulary: `incident`, `problem`, `near_miss`, `audit_finding`, `control_failure` under one triage flow | They share a lifecycle even though they originate differently |
| B46 | The 5-Why `why_chain` plus `control_failure`, `systemic_weakness`, `recurrence_risk` | Structured root cause analysis, not free prose |
| B47 | `dora_classification` (`major_ict_incident`, `ict_incident`, `non_ict`, `not_applicable`) and a `gdpr_breach` flag on every issue | Regulatory notification obligations are determined at triage, not later |
| B48 | The KRI model: dual thresholds (amber and red), RAG status, trend, a `breach` boolean, a mandatory `rationale`, and separately a narrative explanation with a `management_response` | Separates the number from the explanation of the number |
| B49 | The Important Business Service model: `rto_minutes`, `rpo_minutes`, declared versus tested impact tolerance, `ilf_breached`, `disruption_scenarios`, `third_parties`, `dora_art_mapping` | The DORA and Bank of England operational resilience model, correctly shaped |
| B50 | The TPRM tiering model: `tier-1` to `tier-3` driving `due_diligence_level` (`enhanced`, `standard`, `simplified`), plus `fourth_party_exposure`, `concentration_risk`, `exit_strategy_complexity`, `dora_ict_tpp` | Proportionate due diligence, which is what the EBA outsourcing guidelines require |
| B51 | The six mandatory TPRM questionnaire sections (`information_security`, `business_continuity`, `data_protection`, `sub_processor_mgmt`, `financial_stability`, `incident_notification`) each with `complete` / `partial` / `missing` plus `gaps` plus `recommended_clauses` | A gap is not just a missing answer: it names the evidence required and the contract clause that would close it |
| B52 | Regulatory change with `readiness_pct` and `readiness_gap_pct` as first-class fields, plus dependency groups with `recommended_sequence`, a `critical_path`, and `resource_conflicts` | More sophisticated than a date-ordered obligation list |
| B53 | Independent validation encoded as separate `owner` and `validator` fields, with `tier` plus `materiality` driving validation intensity | The model risk governance requirement, expressed in the schema |
| B54 | Risk-based audit planning from `inherent_risk` plus `days_since_audit` plus `issues_outstanding`, perturbed by incident volume | Audit priority derived from evidence, not from a calendar |
| B55 | Third-party concentration analysis from `concentration_pct`, `auto_renewal`, and `days_to_expiry` | The fields that make DORA Article 28 concentration and exit risk computable |
| B56 | Live-source-over-baseline data merging, with every record tagged by `source` | The right pattern for a product with both demo and live modes. This repository already has `NFR_DEMO_MODE` |
| B57 | The department and group information architecture: `dept` (nfr, compliance, capital, modelrisk, audit, credit, esg, infosec, privacy, procurement) and `group` (Core NFR, Compliance, Reporting, Specialist, Resilience) | A workable structure for "specialist intelligence per function" |
| B58 | Agents appear in the model inventory: the platform treats its own agents as model-risk items | An AI system operating inside a regulated risk function must be governed by the same framework it operates |
| B59 | Live regulatory and risk source clients as a concept: EUR-Lex with CELEX identifiers, ECB and EBA and ESMA for supervisory context, OpenSanctions, NVD, MITRE ATT&CK for risk signal | Rebuild the clients, keep the source list |
| B60 | Domain vocabularies as closed enums throughout: control type and status, effectiveness ratings, severity, criticality, data classification, risk tier, RAG status | Every enum in the source becomes a Zod enum and a database constraint |

---

## Must rebuild

Nothing below can be ported. Each item must be built natively for NFR WorkOS.

### Platform and framework

| # | Item | Note |
|---|---|---|
| R1 | The entire Python backend as Next.js route handlers and server actions | FastAPI, uvicorn, `asyncio.to_thread` have no equivalent to port |
| R2 | The agent runtime | Every LangGraph `StateGraph` in the source is a straight line of 1 to 4 nodes with no branching or looping. Rebuild as sequential async steps or with `@openai/agents`, already a dependency |
| R3 | Every `TypedDict` state class as a Zod schema with an inferred type | Gains runtime validation and generates the structured-output contract |
| R4 | Every prompt-embedded JSON schema string as a Zod schema plus structured outputs | Removes `Return ONLY valid JSON` and all fence-stripping. Keep the persona, the framework grounding, and the length constraints from B36 |
| R5 | Run and step persistence with the database as the source of truth | The source keeps runs in memory (capped at 200, trimmed) and mirrors to SQLite. Runs are the audit trail of a regulated process. Use Drizzle plus SQLite, already dependencies |
| R6 | One parameterised agent-run route replacing the 18 hand-written per-agent endpoints | Plus a typed agent registry as the single source of agent identity |
| R7 | A typed error contract with real HTTP status codes | Replaces `{"ok": false, "error": str(e)}` returned with HTTP 200 from broad exception handlers |
| R8 | The entire frontend | 5,941 lines of vanilla JS across 8 files becomes React 19 and Next.js 16 |
| R9 | All visual scenes | Twelve scene modules of imperative SVG DOM building become React components. Keep the lifecycle contract (B6 to B10), rebuild the implementation |
| R10 | `createTimeline` with real pause and resume | The source documents that `resume()` restarts from zero because there is no per-step checkpointing. Fix this: track elapsed time and reschedule remaining steps |
| R11 | The knowledge graph | NetworkX becomes an in-database graph or `@xyflow/react` plus `elkjs`, both already dependencies. Declare a closed edge-relationship vocabulary, which the source lacks |
| R12 | The external-source integration layer | Sixteen Python API clients become typed fetch modules. Keep the source list (B59) |
| R13 | An adapter interface for external systems of record | The source hard-codes ServiceNow into its tools, its graph builder, and its write-back layer. Keep the four write-back action types as an interface, not a vendor binding |
| R14 | The build identity and audit tooling | `bump-build.ps1` is obsolete under Next.js asset hashing. `audit:all` must be rebuilt as `scripts/audit-all.mjs`, already declared in `package.json` |
| R15 | The test suite | Rebuild by concern (geometry, tokens, navigation, motion, domain, API contract) rather than as one 1,966-line append-only file. Use `waitForFunction` and explicit state signals instead of fixed timeouts. Never assert against source-file strings |

### Domain model gaps: entities that do not exist in either source

| # | Item | Note |
|---|---|---|
| R16 | **Control test result** | The largest gap. Controls carry `test_questions`, `last_tested`, and `effectiveness_score`, but there is no record of an individual test execution: tester, date, question tested, evidence attached, conclusion, and exception raised. Control testing is a core NFR workflow and it has no data model in the source |
| R17 | **Issue and action tracker** | Agents produce `management_actions`, `recommended_actions`, `key_actions`, and `immediate_priorities` as free-text string arrays inside JSON blobs. `issues_open` and `issues_outstanding` are integer counts, not references. There is no action record with an owner, a due date, a status, an evidence link, and a reference back to the finding that raised it. An NFR work operating system needs this as a first-class entity |
| R18 | **Assessment record** | `rcsa_cycle_days` and `last_rcsa` are fields on a hard-coded process config. There is no assessment entity with a period, a status, a preparer, a reviewer, an approver, and a sign-off date. The RCSA agent's output is returned but never persisted as an assessment |
| R19 | **One unified risk taxonomy** | Three competing category systems exist with no mapping: risk `cat` (10 values, including both `Compliance` and `Compliance & Privacy`, and both `Operational` and `Regulatory`), control `domain` (11 different values), and the NFR taxonomy (9 domains). Define one taxonomy, map everything to it, and enforce it as an enum |
| R20 | **One unified risk entity** | `fake/risks.json` uses `cat`, `inherent`, `iL`, `iI`, `residual`, `rL`, `rI`; `cyber_risks.json` uses `category`, `inherent_likelihood`, `inherent_impact`, `residual_likelihood`, `residual_impact`, `residual_score`. Same concept, incompatible schemas. Unify on the long names, with cyber-specific fields as an extension |
| R21 | **One unified policy entity** | `backend/data/policies.json` and `backend/data/fake/policies.json` model the same thing with disjoint field sets |
| R22 | **Process definitions in data** | The six ICS processes are hard-coded in `backend/apis/ics.py`, including client-specific `snow_keywords` strings. Processes belong in the database, and keyword matching is not an entity-linking strategy |
| R23 | **Document intelligence** | All ten files in `data/processed/` are failure stubs (`"error": "llm_unavailable"`). The feature described in the README has no working output. Rebuild from scratch, and treat the README claim as unverified |
| R24 | **An explicit product boundary on financial risk** | The taxonomy and the agent registry both include credit risk and capital reporting, which are financial risk, not non-financial risk. Decide deliberately whether NFR WorkOS includes them, and record the decision |
| R25 | **A proper icon system** | The 18 emoji in the agent registry become Tabler icons with a curated meaning manifest |
| R26 | **A deck export path** | `export:deck` and `pptxgenjs` are declared in `package.json`. NFRPitch's print stylesheet is the closest prior art, but the export itself is new work |
| R27 | **ADRs for domain decisions** | All four ADRs in the source concern the inference gateway. Not one records an NFR domain decision. Record the taxonomy choice, the risk scale, the appetite model, the assessment lifecycle, and the human-accountability boundary |

---

## Inconsistencies and obsolete patterns found

### NFRPitch

| # | Finding | Severity |
|---|---|---|
| I1 | `--nav-h: 58px` is declared as a token but `.nav { height: 56px }` and `scroll-margin-top: 56px` are used everywhere. The token is not the source of truth | Medium |
| I2 | Three conflicting footer height values: the test is named `scene-footer max-height 44px`, its assertion allows `> 46`, and `scenes.css` sets `max-height: 48px` | Medium |
| I3 | The documented V14 typography scale in `scenes.css` (core titles 42 to 58px, subtitles 20 to 26px) is not met by the shipped CSS (`.slide-h` caps at 46px, `.slide-sub` is 17px), and `audit-all.js` enforces a third, lower floor (`.slide-sub` minimum 17px). `V23_BASELINE.md` records a fourth number, an 11.5px reference-note floor, as three open P2 defects. Four competing standards | High |
| I4 | Duplicate token layers: `--canvas`, `--s1`, `--s2`, `--tp`, `--ts`, `--tm`, `--brand`, `--brandMid`, `--border` are legacy aliases of the primary tokens, kept for backward compatibility | Medium |
| I5 | `.branded-dark` and `.branded-dark-alt` hard-code hex gradients and use `!important` on background and on every text colour inside, while a test bans hard-coded hex in core markup. The rule is enforced in markup but not in CSS | Medium |
| I6 | Route mode (`executive`, `working`, `technology`) is a visible UI feature with no implementation. `setupRouteMode()` contains only a hard-coded index array and a comment; `setRouteMode()` is commented "Visual-only for now" | Medium |
| I7 | `resume()` in `createTimeline` calls `play()`, restarting from zero. Documented in the code and in `V23_BASELINE.md` as a known simplification | High |
| I8 | Two parallel chapter and screen definitions: `story-manifest.json` (version 26) and an inline `_storyManifest` hard-coded inside `getManifestEntry()` in `navigation.js`, with a comment claiming it "matches story-manifest.json". Two sources that can drift | High |
| I9 | `assets/data/story.json` is version 12 while `story-manifest.json` is version 26. `V23_BASELINE.md` explicitly labels `story.json` as "stale, unused" but it is still in the repository | Low |
| I10 | Three separate viewport arrays in one test file (`VIEWPORTS`, `V15_VIEWPORTS`, `GEOMETRY_VIEWPORTS`) plus ad-hoc `setViewportSize` calls, with overlapping coverage | Medium |
| I11 | Duplicate tests: `no horizontal overflow on core slides` and `no horizontal overflow on core screens` assert the same thing in the same describe block, one via `baseURL` and one via a hard-coded absolute URL | Low |
| I12 | Roughly 130 tests in one 1,966-line file, named by version wave (`V13:` through `V25:`). The suite reads as an append-only changelog | High |
| I13 | Many tests fetch a source file and regex it: `cover-flow.js contains cinematic cold open (10500ms beat + viewBox 1200 560)`, `pressure-convergence.js bottleneck box starts at y=95`, `scale-architecture final zoom is 0.9 not 0.7`, `dual-engine viewBox height is 560`, `regulation-process.js viewBox width is 1240`. These lock in arbitrary implementation numbers and break on any legitimate refactor | High |
| I14 | Pervasive fixed `waitForTimeout` (100, 400, 500, 800, 1200 ms) instead of `waitForFunction` or state signals. The main flakiness source | High |
| I15 | Two bugs in `lint-copy.py`: `if hits or True:` at line 47 is a dead guard around the file walk, and `REVIEW = {'will', 'must', 'never', 'always'}` is defined but never used, so the intended warn-versus-fail severity split was never implemented | Medium |
| I16 | `audit-motion.js` estimates total animation duration by taking the maximum `delay:` integer literal in the file. Any computed or variable delay is invisible to the check | Medium |
| I17 | `validate-data.js` uses `vm.runInNewContext` with a hand-maintained mock global scope to evaluate two source files. Fragile and obsolete under TypeScript | Medium |
| I18 | Hard-coded expected counts as test assertions: exactly 28 solutions, 7 clusters, 8 blocks, 47 capabilities, 31 or 50 icons, 9 context-graph nodes. Legitimate content edits fail the build | Medium |
| I19 | The access gate is `sessionStorage.getItem('pitch_auth') !== '1'` checked client side, with the access code in `index.html`. Presentation hygiene presented as access control | High if reused as auth |
| I20 | No visual regression snapshots, no midpoint animation captures, and no post-resize stability test, despite resize being the historically broken path. Recorded in `V23_BASELINE.md` as an open P4 item | Medium |
| I21 | `V23_BASELINE.md` lists P1, P2, and P3 defects (lower-half screen visual sameness across screens 07 to 10, the Task Route generic decision tree, the Proof Loop circular methodology, the Unit Economics explanatory cards, the Reference Room static placeholder with `display: none` headings) with no record of whether V24 to V26 closed them | Medium |
| I22 | The spacing scale is not systematic: 2, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 24, 28, 36, 44, 48, 56 pixels, with odd values (5, 7) in nav and chip contexts. Neither a 4-point nor an 8-point grid | Medium |
| I23 | Nine distinct border radius values in use (2, 4, 7, 8, 10, 11, 12, 16, 50 percent) against two declared tokens (`--radius`, `--radiusL`) | Medium |
| I24 | `.hero-h1` and `.branded-dark` text colours are hard-coded `#fff` and `rgba(255,255,255,.55)` rather than tokens, so they do not respond to theme | Low |

### RealAIInfrastructure

| # | Finding | Severity |
|---|---|---|
| I25 | Four naming conventions for the same eighteen agents: registry id (`reg_scan`, `regch`, `opres`, `mrm`, `kri`, `issue`), route path (`reg-scan`, `regch`, `opres`), module filename (`reg_scan.py`, `reg_change.py`, `op_resilience.py`, `model_risk.py`, `kri_monitor.py`, `issue_mgmt.py`), and display name. No single source of identity | High |
| I26 | Eighteen hand-written `/api/nfr-agents/{name}/run` endpoints duplicating the generic `/api/agents/{agent_id}/run`, plus a nineteenth variant (`/api/nfr-agents/issue/run-problem`) | High |
| I27 | `{"ok": false, "error": str(e)}` returned with HTTP 200 from a broad `except Exception` in nearly every one of 78 routes. Leaks internal exception text and defeats client error handling | High |
| I28 | The in-memory dict is the primary run store (`MAX_RUNS = 200`, `_trim_runs()`), with SQLite as a mirror. Runs are the audit trail of a regulated process | High |
| I29 | Two policy files with disjoint schemas for the same entity: `policies.json` (`category`, `owner_dept`, `last_reviewed`, `next_review`, `scope`, `key_requirements`, `related_regs`) and `fake/policies.json` (`domain`, `owner_id`, `review_date`, `applies_to`, `linked_controls`) | High |
| I30 | Two risk registers with incompatible field names for the same inherent-to-residual concept: `fake/risks.json` (`cat`, `iL`, `iI`, `rL`, `rI`) and `cyber_risks.json` (`category`, `inherent_likelihood`, `inherent_impact`, `residual_likelihood`, `residual_impact`) | High |
| I31 | Three competing category vocabularies with no mapping table: risk `cat` (10 values), control `domain` (11 values), NFR taxonomy `domains` (9 values). Risk `cat` itself overlaps internally (`Compliance` and `Compliance & Privacy`, `Operational` and `Regulatory`) | High |
| I32 | Abbreviated field names (`cat`, `iL`, `iI`, `rL`, `rI`, `isNew`) mixed with snake_case elsewhere in the same file set | Medium |
| I33 | The NFR taxonomy includes `NFR-CRD` (Credit Risk) and `NFR-CAP` (Capital and Regulatory Reporting), and the agent registry includes `credit`, `icaap`, and `corep`. These are financial risk, not non-financial risk, in a system named for NFR | High |
| I34 | Every one of the ten files in `data/processed/` is a failure stub: `{"doc_type": "other", "purpose": "Extraction failed", "error": "llm_unavailable"}`, including the RCSA register, the TPRM policy, and the DORA compliance framework. The document intelligence feature has no working output, and the failure mode is a silently persisted error stub with no retry and no visible degraded state | High |
| I35 | `README.md` claims "30+ LangGraph agents" twice. The registry contains 18. `ai_risk.py` says "18 NFR agents". The file count of 36 includes 7 pipeline agents and roughly 11 non-agent support modules | Medium |
| I36 | `docs/repository-audit.md` documents only the inference gateway's components and API. It does not mention the NFR dashboard, the 18 agents, or the knowledge graph, which are the larger half of the repository | Medium |
| I37 | All four ADRs concern the gateway (mock backend, OpenAI-compatible API, observability stack, GPU not required). No ADR records any NFR domain decision. `docs/slos.md`, `docs/threat-model.md`, and all three runbooks are likewise gateway-scoped | Medium |
| I38 | LangGraph `StateGraph` used for straight-line chains of 1 to 4 nodes. No branching, no conditional edges, no loops anywhere in any agent. A graph framework expressing `a -> b -> c` | Medium |
| I39 | JSON schemas embedded as prompt strings with `Return ONLY valid JSON (no markdown fences)` and downstream fence stripping, instead of structured outputs | Medium |
| I40 | `asyncio.sleep(0.05)` inserted between workflow steps purely so the SSE stream feels granular in the UI. Server-side sleeps for client-side pacing | Medium |
| I41 | `PROCESS_CONFIG` hard-coded in `backend/apis/ics.py`, including client-specific `snow_keywords` strings (`webex`, `salesforce`, `sfa`, `crm`). Domain data in application code, and keyword matching as an entity-linking strategy | High |
| I42 | ServiceNow hard-coded into `tools.py`, `servicenow/client.py`, `servicenow/write_client.py`, and the graph builder. One vendor's table model baked into the core | High |
| I43 | Emoji as the icon system: all 18 registry entries carry an emoji. Renders inconsistently across platforms and carries no semantic colour. The pitch repository solved this properly with a Tabler manifest | Medium |
| I44 | `NODE_COLORS` declares 16 node types as a closed vocabulary, but edge relationship labels are ad-hoc string literals scattered through the graph build methods. No matching `EDGE_RELS` constant | Medium |
| I45 | `change` and `contract` node types share colour `#f59e0b`, with only a code comment distinguishing them ("amber (darker than change)") and no actual difference in the value | Low |
| I46 | Duplicated agent invocation logic: `backend/agents/workflows.py` reimplements per-agent step emission for agents that already have LangGraph definitions in their own modules. Two code paths to the same result | Medium |
| I47 | No test result, action, or assessment entity anywhere, despite control testing, issue management, and RCSA all being headline features. Findings live as free-text string arrays inside JSON blobs | High |
| I48 | An `n8n` dependency chain (`N8nChatModel` in `base.py`, `mcp_client.py`, `apis/n8n_client.py`, `n8n_llm_proxy_workflow.json`) for LLM proxying and alerting, alongside the inference gateway that does the same job. Two competing proxy layers | Medium |

### Across both repositories

| # | Finding | Severity |
|---|---|---|
| I49 | **Three divergent palettes for one brand.** All three share `#A100FF` as the brand purple and the same three font families, but: NFRPitch light uses `--bg: #FCFBF9`; NFRPitch dark uses `--bg: #0E0F14` with opaque layered surfaces (`#13151C`, `#191C25`, `#202431`, `#2A2E3D`) and `--border-1: #343949`; RealAIInfrastructure's frontend uses `--bg: #0d001f` (a purple-tinted near-black) with translucent surfaces (`rgba(255,255,255,.045)`) and a purple-tinted border (`rgba(161,0,255,.18)`). The radius scales also diverge (10 and 16 versus 8 and 14), as does base font size (unset versus 13.5px). NFR WorkOS must pick one, and `src/styles/tokens.css` has correctly picked the NFRPitch dark palette | High |
| I50 | **Semantic colour conflict.** NFRPitch dark defines `--green: #58C994`, `--cyan: #55C7E8`, `--amber: #F3B34C`, `--pink: #F0758A`. RealAIInfrastructure's knowledge graph uses a Tailwind-derived set (`#22c55e` control, `#06b6d4` service, `#f59e0b` change, `#ec4899` vendor) and its frontend a third set (`#10b981`, `#06b6d4`, `#f59e0b`, `#ef4444`). The same concept (a control, a risk, an incident) has three different colours across the two repositories. Resolve to one semantic mapping | High |
| I51 | **Em dashes are pervasive in both sources.** Every Python docstring, most README prose, and many JS comments use U+2014. NFRPitch has a dedicated guard against it (`check-emdash.py`, plus per-file Playwright assertions) but only for `.html`, `.css`, `.js`, `.json`, `.md`, `.txt` with `assets/vendor` excluded. RealAIInfrastructure has no such guard at all. Any text lifted from either source must be rewritten before it enters this repository | High |
| I52 | **Neither repository has a single source of truth for the NFR taxonomy.** NFRPitch has 47 risk capabilities, 7 portfolio clusters, 8 transformation blocks, and 28 solutions. RealAIInfrastructure has 9 NFR domains, 11 control domains, and 10 risk categories. There is no mapping between the two vocabularies. This is the most important single decision for NFR WorkOS to make first | High |
| I53 | **Both repositories accumulate rather than refactor.** NFRPitch carries version-prefixed CSS comments (V12 through V26), legacy token aliases, a stale `story.json`, and version-prefixed test waves. RealAIInfrastructure carries duplicate data files, two proxy layers, two agent invocation paths, and gateway-only documentation for a two-product repository. Both have working quality gates and a clear defect ledger; neither has a deprecation practice | Medium |

---

## Recommended first decisions

Derived from the findings above, in the order they block other work.

1. **Fix the taxonomy** (I31, I52, R19, R24). One NFR domain list, one risk category enum, one control domain enum, with an explicit mapping from both sources. Everything else depends on this. Record it as an ADR.
2. **Fix the semantic colour mapping** (I49, I50, B2, B3). One value per concept: AI, human, evidence, control, data, risk, gap. `src/styles/tokens.css` already has the palette; the concept mapping needs to be authoritative and enforced.
3. **Port the run and step model** (B30 to B34, R5). Zod schemas plus Drizzle tables, database as the source of truth. This is the spine everything else hangs on.
4. **Create the three missing entities** (R16, R17, R18). Control test result, issue and action, assessment record. Without them the product is a set of report generators rather than a work operating system.
5. **Establish the geometry contract and its tests** (B1, B5, B18, B19, R9). Get the layout guarantees in place before building screens on top of them.
6. **Stand up `audit:all`** (B15, B16, B23, B24, R14). The em dash gate, the copy linter, the story limits, and the motion budget, as one command, with the P0 list stated in the file header. `package.json` already declares `check:copy`, `scan:secrets`, and `audit:all`.
7. **Decide the financial risk boundary** (I33, R24) and record it, before the agent registry is built.
