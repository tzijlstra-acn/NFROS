# Source Domain Findings: RealAIInfrastructure

Read only archaeology of `C:\Users\thomas.zijlstra\Code Projects Accenture\RealAIInfrastructure`.
Nothing in that repository was modified. No `.env` or `.env.local` file was opened, and no secret value was read, printed, or recorded.

## What this repository actually is

Two products in one tree, per its own `README.md`:

1. **NFR Pipeline Dashboard**: a Non-Financial Risk management platform for European banking. FastAPI backend, LangGraph agents, a NetworkX knowledge graph, ServiceNow integration, and a plain HTML and JS single-page frontend.
2. **Inference Gateway**: an OpenAI-compatible proxy with Prometheus metrics, OpenTelemetry tracing, retries, and Kubernetes manifests. When `GATEWAY_URL` is set, every agent LLM call routes through it.

Only the first is relevant to NFR WorkOS. The gateway is infrastructure that a Next.js rebuild does not need in this form.

Stated architecture from `README.md`:

    Browser -> NFR Dashboard SPA (frontend/index.html)
                    -> Backend API (backend/main.py, FastAPI)
                    -> LangGraph agents (backend/agents/)
                    -> Inference Gateway (gateway/, port 8080, optional)
                    -> OpenAI API, with metrics to Prometheus and Grafana

Scale: `backend/main.py` is 1,456 lines with 78 route handlers. `backend/agents/orchestrator.py` is 1,280 lines. 36 agent modules. 23 JSON data files. The frontend is 5,941 lines of vanilla JS across 8 files.

---

## 1. NFR agent inventory

The authoritative list is `NFR_AGENTS_REGISTRY` at `backend/main.py:375`. Eighteen agents, all marked `live: True`, each with `id`, `name`, `group`, `dept`, `live`, `data_source`, `icon` (an emoji), and `description`.

### Group: Core NFR

| id | Name | Dept | Data source | Responsibility (quoted) |
|---|---|---|---|---|
| `tprm` | TPRM Vendor Onboarding | procurement | ServiceNow CMDB | "Vendor risk tiering, questionnaire gap analysis, and onboarding recommendation using live CMDB assets from ServiceNow." |
| `rcsa` | RCSA Self-Assessment | nfr | ICS Processes + ServiceNow | "Inherent risk identification, control effectiveness rating, and residual risk narrative for any ICS process." |
| `issue` | Issue and Incident Management | nfr | ServiceNow Incidents | "Triage, 5-Why root cause analysis, impact assessment, and SMART action plan for any ServiceNow incident." |
| `kri` | KRI / KCI Monitoring | nfr | ServiceNow (all tables) | "Calculates live KRI values from ServiceNow metrics, flags threshold breaches, and drafts board KRI commentary." |

### Group: Compliance

| id | Name | Dept | Data source | Responsibility (quoted) |
|---|---|---|---|---|
| `reg_scan` | Regulatory Horizon Scan | compliance | EUR-Lex API | "Maps live EUR-Lex regulations (DORA, GDPR, EU AI Act) to the control framework and identifies compliance gaps." |
| `policy` | Policy and Standards Q&A | compliance | Internal policy docs | "Everyday policy lookups across internal standards and regulatory requirements." |
| `fincrime` | Financial Crime / AML | compliance | Alert queue | "Alert triage, network/typology context, and drafted SAR narratives for suspicious activity." |
| `regch` | Regulatory Change Tracking | compliance | Regulatory feeds | "Monitor, interpret, and map new rules to controls, including EU AI Act classification for credit and insurance products." |

### Group: Reporting

| id | Name | Dept | Data source | Responsibility (quoted) |
|---|---|---|---|---|
| `icaap` | ICAAP / ILAAP | capital | Capital models | "Quarterly internal capital and liquidity adequacy assessment with stress scenario analysis." |
| `corep` | Prudential Reporting | capital | COREP/FINREP data | "Data quality checks, cross-validations and narrative for COREP/FINREP submissions." |
| `mrm` | Model Risk Management | modelrisk | Model inventory | "Model validation status, drift detection, and automated validation summary drafting." |

### Group: Specialist

| id | Name | Dept | Data source | Responsibility (quoted) |
|---|---|---|---|---|
| `audit` | Internal Audit Planning | audit | Audit universe | "Risk-based audit universe prioritisation, planning and fieldwork assistance." |
| `credit` | Credit Risk Assessment | credit | Credit portfolio | "Counterparty risk summaries, covenant tracking, and draft credit approval memoranda." |
| `esg` | ESG / Climate Risk | esg | ESG data providers | "Portfolio climate scenario analysis, transition/physical risk scoring, and SFDR/CSRD disclosure support." |
| `contract` | Contract and Spend Risk | procurement | Contract database | "Contract clause risk analysis and spend-concentration exposure across the vendor book." |

### Group: Resilience

| id | Name | Dept | Data source | Responsibility (quoted) |
|---|---|---|---|---|
| `opres` | Operational Resilience (DORA) | nfr | IBS mapping + CMDB | "DORA-aligned ICT incident management, important business services mapping, and impact tolerance testing." |
| `cyber` | Cyber and IT Risk Register | infosec | IT risk register | "IT/cyber risk register maintenance, control mapping, and threat exposure scoring." |
| `dpia` | Data Privacy / DPIA | privacy | Processing inventory | "Processing activity inventory and Data Protection Impact Assessment support." |

### The separate seven-agent document pipeline

A distinct, numbered chain lives alongside the eighteen and is orchestrated by `backend/agents/pipeline.py`. Stage list, quoted from `STAGES`:

    extraction, entity_linking, classification, risk_scoring,
    regulation_mapping, doc_relationship, nfr_writer

| Module | Self-described role |
|---|---|
| `extraction.py` | "Agent 1: Extraction and Normalisation. Converts a raw ServiceNow record into a structured NFR risk event." |
| `entity_linking.py` | "Agent 2: Entity Linking." Links to employees, assets, controls in the knowledge graph. |
| `classification.py` | "Agent 3: NFR Domain Classification." |
| `risk_scoring.py` | "Agent 4: Risk Scoring." |
| `regulation.py` | "Agent 5: Regulation Mapping." |
| `doc_relationship.py` | "Agent 6: Document Relationship Agent." |
| `nfr_writer.py` | "Agent 7: NFR Field Writer." |

This is a linear enrichment pipeline over one record, streamed over a WebSocket (`/ws/pipeline`) with `{"stage": ..., "status": "running" | "done", "data": {...}}` events. It is conceptually distinct from the eighteen domain agents and is the more reusable of the two patterns: normalise, link, classify, score, map to obligations, relate, write back.

### Supporting non-domain modules

`base.py` (shared LLM client, gpt-4o-mini primary with gpt-4o fallback, plus an `N8nChatModel` LangChain wrapper for an n8n webhook proxy), `graph.py` (agent factory: ReAct agents, StateGraph helpers, sequential step builder with `StepDef` and `build_step_graph`), `tools.py` (LangChain tool definitions for ServiceNow read and write plus knowledge graph queries), `mcp_client.py` (connects to an n8n MCP server and exposes its tools as LangChain tools), `orchestrator.py`, `workflows.py`, `resolver.py` ("evaluates action items and writes resolutions back to ServiceNow"), `outcome_tracker.py` ("tracks outcomes of write-back actions 24h after execution"), `ics_chat.py`, `ai_risk.py`.

`ai_risk.py` contains a notable self-referential idea: "Combine 18 NFR agents + traditional ML models into unified inventory." The platform treats its own agents as model-risk inventory items. That is a strong concept for NFR WorkOS: an AI system operating in a regulated risk function must appear in its own model inventory.

---

## 2. Agent workflow shapes

Two patterns, both worth understanding before rebuilding.

### Pattern A: explicit LangGraph StateGraph

`backend/agents/rcsa.py` is the clearest example. Three nodes in a fixed chain, each with its own system prompt and a `TypedDict` state:

    class _RCSAState(TypedDict):
        process_str: str
        incidents_str: str
        inherent_risks: dict
        control_assessment: dict
        residual_risk: dict

    graph.add_node("inherent_risks", ...)
    graph.add_node("control_assessment", ...)
    graph.add_node("residual_risk", ...)
    graph.set_entry_point("inherent_risks")
    graph.add_edge("inherent_risks", "control_assessment")
    graph.add_edge("control_assessment", "residual_risk")
    graph.add_edge("residual_risk", END)

Each node accumulates its output into state, and each downstream prompt receives the upstream JSON verbatim. There is no branching and no looping anywhere in any agent. Every graph is a straight line of 1 to 4 nodes. LangGraph is being used as a sequential prompt chain, not as a graph.

The return envelope is consistent: `{"agent": "<id>", "process": {...}, "<node1>": {...}, "<node2>": {...}, ...}`.

### Pattern B: step-definition builder

`tprm.py`, `op_resilience.py`, `reg_change.py`, `corep.py` and others use `from .graph import StepDef, build_step_graph`, which is a declarative shorthand over the same linear chain.

### The prompt contract

Every domain agent declares module-level system prompts with a consistent four-part structure that is the single most portable asset in this repository:

1. A named professional persona with jurisdictional grounding. Real examples:
   - "You are an Operational Risk Manager at a European bank applying the Basel III/CRR2 operational risk framework and EBA internal governance guidelines."
   - "You are an Internal Controls specialist at a European bank applying the Three Lines of Defence model and COSO internal control framework."
   - "You are a Chief Risk Officer advisor at a European bank."
   - "You are a Third-Party Risk Management (TPRM) specialist at a European bank regulated by the ECB and subject to DORA, GDPR, and EBA outsourcing guidelines."
   - "You are a TPRM risk tiering analyst at a European bank applying the EBA Guidelines on Outsourcing Arrangements and DORA ICT third-party provider risk framework."
   - "You are an Operational Resilience Officer at a European bank assessing Important Business Services (IBS) against DORA requirements."
   - "You are a root cause analysis specialist applying the 5-Why methodology."
   - "You are a CRO-level risk officer drafting a KRI board report section."
2. A one-line task statement.
3. A literal JSON schema, inline in the prompt, with pipe-delimited enums (`"critical|high|medium|low"`) and example values.
4. An explicit output instruction: `Return ONLY valid JSON (no markdown fences, no extra text)`.

Prompts also constrain prose length precisely: `"Exactly two sentences summarising the inherent risk profile."`, `"Exactly three sentences suitable for board or audit committee reporting."`, `"concise 8-word title"`, `"two sentences"`, `"one sentence"`. That discipline is why the outputs fit into fixed-height UI cards.

### The human in the loop model

`backend/agents/orchestrator.py` defines the run and step model:

    StepKind  = Literal['fetch', 'working', 'analyze', 'decision', 'hitl', 'action', 'complete', 'error']
    RunStatus = Literal['running', 'waiting_human', 'completed', 'failed', 'cancelled']

    @dataclass
    class AgentStep:
        id: str                    # 8-char uuid fragment
        kind: StepKind
        label: str
        detail: str
        ts: str                    # ISO datetime
        requires_human: bool = False
        human_prompt: str = ''
        options: list = field(default_factory=list)   # strings the user can pick
        decision: Optional[str] = None                # filled when human decides
        writeback: Optional[dict] = None              # if kind == 'action': {type, payload, result}

    @dataclass
    class AgentRun:
        id: str                    # 12-char uuid fragment
        agent_id: str
        agent_name: str
        triggered_by: str          # 'manual' | 'auto'
        status: RunStatus
        steps: list                # list[AgentStep]
        started_at: str
        ended_at: Optional[str] = None
        result_summary: str = ''
        writebacks_done: list = field(default_factory=list)

This is the most directly reusable structure in the entire repository. Every run is an ordered, typed, timestamped step trail. A step can pause the run (`requires_human=True` plus `human_prompt` plus `options`), and a step can perform an external write (`writeback` capturing type, payload, and result). `submit_decision(run_id, step_id, decision)` sets `step.decision` and flips status back to `running`, and it refuses a second decision on an already-decided step.

`_enrich_context_with_prior_findings(agent_id, context)` and `_format_prior_context` give an agent access to earlier runs' findings, so runs compound rather than restart.

Write-back action types, from `_exec_writeback`:

    add_work_note, create_change_request, create_incident, send_alert

Each write-back schedules a follow-up check via `schedule_outcome_check(run_id, step_id, action_type, sys_id)`, and `outcome_tracker.py` re-inspects the target 24 hours later. Closing the loop on whether an agent's action actually helped is an unusual and valuable idea.

The store is in-memory (`_runs: dict[str, AgentRun]`) capped at `MAX_RUNS = 200` with `_trim_runs()`, mirrored to SQLite (`backend/db.py`, `data/runs.db`) and reloaded by `load_from_db()`. Per-agent scheduling lives in `_agent_config: {agent_id: {"schedule": "daily", "auto": True}}` with `start_scheduler()`.

---

## 3. Domain objects and data models

Twenty-three JSON files under `backend/data/`, of which `backend/data/fake/` holds the synthetic organisation. Field names below are exact.

### Risk

`backend/data/fake/risks.json`, 18 records:

    id, process_id, title, cat, inherent, iL, iI, residual, rL, rI,
    trend, owner, isNew, regulation_refs, exec_summary

Example: `R-101`, process `P-01`, "Critical Third-Party Concentration Risk", cat `Third-Party Risk`, inherent `Critical` (iL 4, iI 5), residual `High` (rL 3, rI 4), trend `increasing`, `regulation_refs: ["DORA-Art.28", "MaRisk-AT9"]`, exec summary "DataServ GmbH accounts for >30% of ICT outsourcing volume; single-supplier concentration breaches DORA concentration limits."

The `iL` / `iI` / `rL` / `rI` pairing (inherent likelihood, inherent impact, residual likelihood, residual impact) on a 1 to 5 scale with a derived banded rating is the canonical operational risk data shape and should be carried forward with clearer names.

Observed `cat` values: `Compliance`, `Compliance & Privacy`, `Financial`, `Fraud`, `Information Security`, `Liquidity`, `Market Risk`, `Operational`, `Regulatory`, `Third-Party Risk`.

### Control

`backend/data/fake/controls.json`, 64 records:

    id, name, domain, type, status, owner_id, linked_assets,
    mitigates_risks, framework_refs, last_tested,
    effectiveness_score, test_questions

Example `CTL001` "Multi-Factor Authentication", domain `Information Security`, type `preventive`, status `effective`, `linked_assets: ["AST007","AST009"]`, `mitigates_risks: ["R-501","R-502"]`, `framework_refs: ["DORA-Art.9","GDPR-Art.32","ISO27001-A.9.4"]`, `last_tested: "2025-11-01"`, `effectiveness_score: 92`, and three `test_questions`:

    "Is MFA enforced for all remote access and privileged accounts?"
    "Are MFA exceptions documented and approved?"
    "Is MFA tested after each system update?"

Closed vocabularies:
- `type`: `preventive`, `detective`, `corrective`
- `status`: `effective`, `needs_improvement`, `developing`
- `domain` (11 values): `Compliance`, `Credit Risk`, `Data Privacy`, `ESG & Climate Risk`, `Finance & Reporting`, `IT Operations`, `Information Security`, `Internal Audit`, `Model Risk`, `Operational Risk`, `Procurement & TPRM`

`test_questions` embedded on the control record is the seed of control testing: a control carries its own test script. Combined with `last_tested` and `effectiveness_score` (0 to 100 integer), this is a workable control testing model, though it lacks a test result record (see the gaps section).

### NFR taxonomy

`backend/data/nfr_taxonomy.json`. Two top-level keys: `domains` and `severity_levels`. Each domain has `id`, `name`, `color`, `subdomains`, `key_regulations`, `risk_appetite`.

| Domain id | Name | Risk appetite | Subdomains | Key regulations |
|---|---|---|---|---|
| `NFR-OPR` | Operational Risk | low | ICT Risk, Process Risk, People Risk, Business Continuity, Third-Party Risk | DORA, MaRisk-AT7, BCBS-239 |
| `NFR-CMP` | Compliance | zero | AML/CFT, Sanctions, Market Conduct, Consumer Protection, Regulatory Reporting | AMLD6, MiFID2, MaRisk-AT8, CRR |
| `NFR-AUD` | Internal Audit | low | IT Audit, Financial Audit, Operational Audit, Compliance Audit | IIA-Standards, EBA-ICT-Audit |
| `NFR-ISC` | Information Security | low | Cyber Risk, Access Management, Data Security, Vulnerability Management, Incident Response | DORA, GDPR-Art32, ISO27001, NIS2 |
| `NFR-TPR` | Procurement and TPRM | medium | Vendor Due Diligence, Contract Risk, Concentration Risk, Subcontractor Risk | DORA-Art28, MaRisk-AT9, EBA-Outsourcing |
| `NFR-DPR` | Data Privacy | zero | GDPR Compliance, Data Subject Rights, Cross-Border Transfers, Consent Management, DPIA | GDPR, BDSG, ePrivacy |
| `NFR-CAP` | Capital and Regulatory Reporting | low | COREP, FINREP, Pillar-2, ICAAP, ILAAP, Leverage Ratio | CRR, CRD5, EBA-ITS |
| `NFR-MDL` | Model Risk | low | Model Validation, Model Inventory, Model Performance Monitoring, AI Model Governance | EBA-MRM, EU-AI-Act, SR11-7, MaRisk-BTO |
| `NFR-CRD` | Credit Risk | (not low) | PD/LGD/EAD Estimation, Concentration Risk, Counterparty Credit Risk, Loan Portfolio Quality | |

The `risk_appetite` enum (`zero`, `low`, `medium`) attached at domain level is a good modelling choice: appetite is a property of the domain, and a residual rating is compared against it. `rcsa.py` uses exactly that comparison via `"risk_appetite_breach": false`.

Note: `NFR-CRD` (Credit Risk) and `NFR-CAP` (Capital) are financial risk, not non-financial risk. The taxonomy mixes the two. NFR WorkOS should decide deliberately whether to include them.

### Process (the ICS cockpit)

`backend/apis/ics.py` holds a hard-coded `PROCESS_CONFIG` of six processes, `P-01` to `P-06`:

| id | Name | Area | Control domains | RCSA cycle |
|---|---|---|---|---|
| `P-01` | Third-Party Service Onboarding | Operations and Sourcing | Procurement and TPRM, Operational Risk | 90 days |
| `P-02` | Payment Processing | Payments | Compliance | 90 days |
| `P-03` | Customer Data Management | Data and Privacy | Data Privacy | 180 days |
| `P-04` | Financial Reporting | Finance | Finance and Reporting, Model Risk, Credit Risk | |
| `P-05` | (IT and Security) | IT and Security | | |
| `P-06` | (Treasury) | Treasury | | |

Per-process fields: `name`, `area`, `control_domains`, `owner_id`, `sub_processes`, `rcsa_cycle_days`, `last_rcsa`, `snow_keywords`, `snow_categories`.

Example sub-processes: `P-01` has `["Vendor Onboarding", "Sub-Processor Management", "Vendor Offboarding"]`, `P-02` has `["SEPA Credit Transfer", "SEPA Instant", "AML Screening"]`, `P-03` has `["Data Collection", "DSAR Handling", "Data Retention & Deletion"]`.

`rcsa_cycle_days` plus `last_rcsa` gives an assessment-due calculation, and the process is the unit of RCSA. `snow_keywords` and `snow_categories` are a keyword-matching heuristic for pulling relevant ServiceNow incidents to a process. The module docstring states the merge rule: live ServiceNow incidents and problems tagged `source='snow'` take priority over static baseline risks tagged `source='baseline'`.

### Vendor and third-party

`backend/data/fake/vendors.json`, 15 records:

    id, name, type, category, country, contract_value_eur,
    risk_rating, criticality, owner_id, data_shared, certifications

`backend/data/contracts.json`, 18 records:

    id, vendor, category, value_eur_m, start_date, end_date, days_to_expiry,
    auto_renewal, risk_rating, concentration_pct, critical_service,
    sla_compliance_pct, issues_open, last_review_date

`concentration_pct`, `auto_renewal`, and `days_to_expiry` are the right fields for concentration and exit-risk analysis under DORA Article 28.

### Asset

`backend/data/fake/assets.json`, 15 records:

    id, name, type, category, criticality, owner_id, vendor_id,
    environment, data_classification, last_audit, vulnerabilities

### Important Business Service (operational resilience)

`backend/data/important_business_services.json`, 9 records:

    id, service_name, criticality, rto_minutes, rpo_minutes, ilf_breached,
    test_date, test_result, dependencies, third_parties,
    disruption_scenarios, dora_art_mapping

`ilf_breached` is impact tolerance (impact limit framework) breach. `rto_minutes` and `rpo_minutes` plus tested-versus-declared tolerance is exactly the DORA and Bank of England operational resilience model. `dora_art_mapping` links the service to specific articles.

### Incident

Incidents are not a local file: they come live from ServiceNow via `backend/servicenow/client.py`, with record types `incident`, `problem`, and `change`. `issue_mgmt.py` defines the issue vocabulary:

    "issue_type": "incident|problem|near_miss|audit_finding|control_failure"
    "severity": "critical|high|medium|low"
    "impact_areas": ["operational","financial","regulatory","reputational"]
    "dora_classification": "major_ict_incident|ict_incident|non_ict|not_applicable"
    "gdpr_breach": false
    "immediate_containment_needed": false

Root cause node output:

    root_cause, contributing_factors, control_failure, systemic_weakness,
    why_chain (["Why 1: ...", "Why 2: ...", "Why 3: ..."]),
    recurrence_risk ("high|medium|low"), similar_incidents_expected

The five issue types (`incident`, `problem`, `near_miss`, `audit_finding`, `control_failure`) unified under one triage flow is a good modelling decision: they share a lifecycle even though they originate differently.

### KRI

`kri_monitor.py` schema:

    kri_id, name, value, unit, threshold_amber, threshold_red,
    status ("green|amber|red"), trend ("increasing|stable|decreasing"),
    breach (bool), rationale

Plus `overall_kri_posture`, `breaches_count`, `kri_commentary`, and a second node producing `breach_narratives` (with `breach_explanation` and `management_response`), `management_summary` ("three sentences suitable for board risk committee"), `recommended_actions`, `escalation_required`, `next_review_date`.

Two thresholds (amber and red) plus RAG status plus trend plus a mandatory `rationale` string per KRI is the correct minimum model. The distinction between a numeric breach and a narrative explanation of that breach is the reusable part.

### Regulatory change

`backend/data/regulatory_calendar.json`, 14 records:

    id, regulation, full_name, effective_date, impact_area, change_type,
    description, status, readiness_pct, owner, action_required

`reg_change.py` adds:

    impact_assessment[]: id, regulation, urgency ("critical|high|medium|low"),
      impact_areas_affected, estimated_effort_days, readiness_gap_pct,
      key_actions, impact_commentary
    overall_readiness ("on_track|at_risk|critical"), critical_count
    dependency_groups[]: group_name, regulations, rationale,
      recommended_sequence, shared_resources
    critical_path[], resource_conflicts[]
    immediate_priorities[]: regulation, action, owner, deadline, priority ("P1")
    quarterly_milestones[]: quarter, deliverables

`readiness_pct` and `readiness_gap_pct` as a first-class field on a regulatory obligation, plus explicit dependency sequencing and resource conflict detection across changes, is more sophisticated than most regulatory change registers.

### Policy

`backend/data/policies.json` (15) and `backend/data/fake/policies.json` (15), two overlapping shapes:

    policies.json:      id, name, category, version, owner_dept, last_reviewed,
                        next_review, status, scope, key_requirements, related_regs
    fake/policies.json:  id, name, domain, version, owner_id, status,
                        review_date, applies_to, linked_controls

Two files modelling the same entity with different field names is an inconsistency, not a design. See the gaps section.

### DPIA register

`backend/data/dpia_register.json`, 15 records:

    id, activity_name, purpose, legal_basis, data_categories, data_subjects,
    volumes_records, retention_years, third_country_transfer, processors,
    dpia_required, dpia_status, dpia_date, risks_identified, dpo_approved

This is a GDPR Article 30 record of processing activities plus DPIA status in one table. `legal_basis`, `third_country_transfer`, and `dpo_approved` are the fields that matter for compliance.

### Model inventory

`backend/data/model_inventory.json`, 14 records:

    id, name, type, tier, business_use, owner, validator,
    last_validation_date, next_validation_due, validation_status,
    materiality, issues_open, approval_status, model_type_detail, risk_type

Separate `owner` and `validator` fields encode the independent validation requirement (SR 11-7 and EBA MRM). `tier` plus `materiality` drives validation intensity.

### Cyber risk register

`backend/data/cyber_risks.json`, 16 records:

    id, risk_name, category, threat_actor, attack_vector, vulnerability,
    inherent_likelihood, inherent_impact, controls,
    residual_likelihood, residual_impact, residual_score,
    status, owner, review_date

Same inherent-to-residual spine as the general risk register, extended with threat modelling fields (`threat_actor`, `attack_vector`, `vulnerability`) that map to MITRE ATT&CK, for which there is a client at `backend/apis/mitre_attack.py`.

### Audit universe

`backend/data/audit_universe.json`, 16 records:

    id, entity_name, category, inherent_risk, last_audit_date,
    last_audit_opinion, next_planned_date, days_since_audit,
    control_environment, issues_outstanding, regulatory_focus

`days_since_audit` plus `inherent_risk` plus `issues_outstanding` is the risk-based audit planning triple. `audit_plan.py` layers `incident_adjustments` on top, so incident volume perturbs audit priority.

### Other data files

`aml_alerts.json` (12: `id`, `customer_id`, `customer_name`, `alert_type`, `amount_eur`, `currency`, `transaction_date`, `country`, `risk_score`, `status`, `flags`, `assigned_analyst`), `capital_data.json` (CET1, tier1, total capital, leverage, LCR, NSFR, ICAAP buffer, Pillar 2 requirement, management buffer, RWA), `corep_data.json` (`period`, `reporting_entity`, `regulator`, `templates`, `ratios`, `breaches`, `near_breaches`, `deadlines`), `credit_portfolio.json` (NPL ratio, coverage ratio, stage 2 and 3 percentages, provisions, cost of risk in bps, segments, sector concentrations, top exposures), `esg_data.json` (scope 1, 2, 3 tonnes plus E, S, G component scores), `employees.json` (33: `id`, `name`, `department`, `role`, `email`, `location`, `access_level`, `risk_owner`), `documents.json` (32: `id`, `title`, `category`, `source`, `status`, `version`, `owner`, `last_updated`, `format`, `description`, `process_ids`, `regulation_refs`), `automation_log.json`, `graph_snapshot.json`.

---

## 4. The knowledge graph

`backend/graph/knowledge_graph.py`, 479 lines, a NetworkX `DiGraph` with a thread lock, persisted to `backend/data/graph_snapshot.json` as `{saved_at, nodes[{id, _type, color, label}], edges[{src, dst, rel}]}`. README claims 230-plus nodes, auto-enriched from ServiceNow every 5 minutes.

Sixteen node types, with the colour map quoted from `NODE_COLORS`:

| Node type | Colour |
|---|---|
| `incident` | `#ef4444` |
| `problem` | `#f97316` |
| `change` | `#f59e0b` |
| `employee` | `#3b82f6` |
| `asset` | `#8b5cf6` |
| `vendor` | `#ec4899` |
| `control` | `#22c55e` |
| `policy` | `#14b8a6` |
| `regulation` | `#6366f1` |
| `nfr_domain` | `#7c3aed` |
| `risk` | `#dc2626` |
| `service` | `#06b6d4` |
| `contract` | `#f59e0b` |
| `recommendation` | `#A100FF` |
| `resolution` | `#10b981` |
| `process` | `#0ea5e9` |

The node-type list is the domain's entity model, stated more honestly than any schema file: incident, problem, change, employee, asset, vendor, control, policy, regulation, NFR domain, risk, service, contract, recommendation, resolution, process.

`recommendation` and `resolution` as first-class graph nodes is the notable idea: the agent's output becomes a linked entity in the same graph as the evidence it drew on, so a recommendation is traceable to the incident, control, and regulation that produced it.

`_PROCESS_DOMAIN` maps process to NFR domain: `P-01 -> NFR-TPR`, `P-02 -> NFR-OPR`, `P-03 -> NFR-DPR`, `P-04 -> NFR-CAP`, `P-05 -> NFR-ISC`, `P-06 -> NFR-CAP`.

Graph API: `/api/graph`, `/api/graph/rebuild`, `/api/graph/node/{node_id}`, `/api/graph/stats` (returns `by_type` counts via `Counter`).

Weakness: edge relationship labels are built ad hoc as string literals scattered through the build methods rather than declared as a closed vocabulary. There is no `EDGE_RELS` constant to match `NODE_COLORS`. The rebuild should declare both.

---

## 5. API surface

78 routes in `backend/main.py`. Grouped by concern.

### Agent orchestration (the reusable shape)

    POST /api/agents/{agent_id}/run            start a run, returns {run_id}
    GET  /api/agents/runs                      list runs, newest first
    GET  /api/agents/runs/{run_id}             one run with its step trail
    GET  /api/agents/runs/{run_id}/stream      SSE step stream
    POST /api/agents/runs/{run_id}/decide      submit a human decision
    POST /api/agents/runs/{run_id}/cancel      cancel a running agent
    GET  /api/agents/pending-hitl              all runs waiting on a human
    GET  /api/agents/outcomes                  24h write-back outcome checks
    POST /api/agents/{agent_id}/config         set schedule and auto flag
    GET  /api/agents/config
    GET  /api/nfr-agents                       registry with {total, live, planned} summary

This set is the right API for an agent product: start, observe as a stream, intervene, cancel, and see what the action actually achieved. Carry the shape.

### Per-agent invocation (the anti-pattern)

    POST /api/nfr-agents/issue/run
    POST /api/nfr-agents/issue/run-problem
    POST /api/nfr-agents/kri/run
    POST /api/nfr-agents/tprm/run
    GET  /api/nfr-agents/tprm/assets
    POST /api/nfr-agents/rcsa/run
    POST /api/nfr-agents/reg-scan/run
    POST /api/nfr-agents/policy/run
    POST /api/nfr-agents/fincrime/run
    POST /api/nfr-agents/regch/run
    POST /api/nfr-agents/icaap/run
    POST /api/nfr-agents/corep/run
    POST /api/nfr-agents/mrm/run
    POST /api/nfr-agents/audit/run
    POST /api/nfr-agents/credit/run
    POST /api/nfr-agents/esg/run
    POST /api/nfr-agents/contract/run
    POST /api/nfr-agents/opres/run
    POST /api/nfr-agents/cyber/run
    POST /api/nfr-agents/dpia/run

Eighteen hand-written near-identical endpoints, plus a nineteenth variant. This duplicates `POST /api/agents/{agent_id}/run`. Note also the naming inconsistency: registry ids use underscores (`reg_scan`) while routes use hyphens (`reg-scan`). Do not reproduce this.

### Domain data

    GET  /api/servicenow/records | /incidents | /incident/{sys_id}
    GET  /api/regulations | /api/regulations/{celex}
    GET  /api/ecb/risk-context
    GET  /api/graph | /api/graph/node/{id} | /api/graph/stats
    POST /api/graph/rebuild
    GET  /api/nfr/results
    WS   /ws/pipeline
    GET  /api/ics/processes | /api/ics/processes/{pid}
    POST /api/ics/assess/{pid}/start
    GET  /api/ics/documents
    POST /api/agent/chat
    POST /api/overview/briefing
    GET  /api/ai-risk/summary
    GET  /api/datasources | /{source_id}
    POST /api/datasources/{source_id}/refresh
    GET  /api/doc-pipeline/sources | /processed/{filename}
    POST /api/doc-pipeline/ingest

### Automation

    POST /api/automation/enrich | /submit-recommendation | /resolve | /dismiss
    GET  /api/automation/status | /feed | /pending | /stream

The `submit-recommendation` then `resolve` or `dismiss` triple is a clean approval workflow.

### Response envelope

Almost every handler returns `{"ok": true, ...}` or `{"ok": false, "error": str(e)}` from a broad `except Exception`. Errors are 200 responses with an `ok: false` body. HTTP status codes are not used for domain errors. Do not carry this.

### Auth and operations

    POST /api/auth/login | /logout
    GET  /api/auth/me
    GET  /api/users | POST /api/users | DELETE /api/users/{user_id}
    GET  /healthz | /readyz
    GET  /api/monitoring/gateway/health | /metrics | /models
    POST /api/monitoring/gateway/test
    GET  /api/monitoring/agent-runs
    POST /api/monitoring/tests/run-all

---

## 6. NFR terminology actually used

Direct extraction from prompts, field names, and data. This is the product vocabulary.

**Risk**: inherent risk, residual risk, inherent likelihood, inherent impact, residual likelihood, residual impact, risk rating (`critical`, `high`, `medium`, `low`), risk appetite (`zero`, `low`, `medium`), risk appetite breach, risk category, risk owner, risk trend (`increasing`, `stable`, `decreasing`), risk score, risk register, top risk theme, risk taxonomy, NFR domain, subdomain, materiality.

**Control**: control effectiveness (`effective`, `partially_effective`, `ineffective`), overall effectiveness (`strong`, `adequate`, `needs_improvement`, `inadequate`), control type (`preventive`, `detective`, `corrective`), control status (`effective`, `needs_improvement`, `developing`), control design gap, control operating gap, control failure, control environment, effectiveness score, test recommendation, test question, last tested, framework reference, Three Lines of Defence, COSO.

**Assessment**: RCSA (Risk and Control Self-Assessment), RCSA cycle days, last RCSA, RCSA narrative, assessment commentary, board-ready narrative, audit committee reporting, management actions, DPIA, ICAAP, ILAAP, stress scenario, impact tolerance testing, due diligence level (`enhanced`, `standard`, `simplified`).

**Incident and resilience**: incident, problem, change, near miss, audit finding, control failure, severity, triage, triage rationale, containment, root cause, 5-Why, why chain, contributing factors, systemic weakness, recurrence risk, Important Business Service (IBS), RTO, RPO, impact tolerance, ILF breach, disruption scenario, DORA classification (`major_ict_incident`, `ict_incident`, `non_ict`, `not_applicable`), ICT incident, remediation roadmap, remediation complexity, work note, escalation.

**Third party**: vendor, supplier, third party, fourth party exposure, sub-processor, subcontractor risk, concentration risk, exit strategy complexity, risk tier (`tier-1`, `tier-2`, `tier-3`), DORA ICT TPP, vendor profile, service type, data classification (`public`, `internal`, `confidential`, `restricted`), criticality (`critical`, `important`, `standard`, `low`), questionnaire section status (`complete`, `partial`, `missing`), recommended clauses, critical missing items, SLA compliance, auto-renewal, days to expiry.

The six mandatory TPRM questionnaire sections, quoted from `tprm.py`: `information_security`, `business_continuity`, `data_protection`, `sub_processor_mgmt`, `financial_stability`, `incident_notification`.

**Obligation and regulation**: regulation, obligation, regulatory change, regulatory calendar, effective date, regulatory deadline, urgency, readiness percentage, readiness gap, impact area, change type, critical path, dependency group, resource conflict, quarterly milestone, immediate priority, article mapping, CELEX identifier, compliance gap, fully compliant article, legal basis.

Named regulations and frameworks appearing across the repository: DORA (with articles 5, 9, 11, 17, 28 cited explicitly), GDPR (articles 30, 32), EU AI Act, CRR, CRR2, CRD5, CRR3, FRTB, COREP, FINREP, Basel III, BCBS-239, MaRisk (AT7, AT8, AT9, BTO), EBA Outsourcing Guidelines, EBA MRM, EBA ICT Audit, EBA ITS, AMLD6, MiFID II, SR 11-7, ISO 27001, NIS2, BDSG, ePrivacy, SFDR, CSRD, IIA Standards, Pillar 2, COSO, Three Lines of Defence, MITRE ATT&CK, IIA.

**Governance**: risk owner, control owner, model owner, model validator, DPO approval, process owner, CRO, CTO, board risk committee, audit committee, human in the loop, approval status, escalation required, next review date, three lines of defence, department.

**Live external sources** with clients under `backend/apis/`: EUR-Lex (SPARQL), ECB, ECB Supervision, EBA, ESMA, BIS, FRED, Companies House, OpenCorporates, OpenSanctions, NVD, MITRE ATT&CK, GDPR tracker, Open-Meteo, ICS, n8n.

---

## 7. Reusable conceptually

Ranked by value to a TypeScript and Next.js rebuild.

1. **`AgentRun` and `AgentStep`**. The typed, ordered, timestamped step trail with `StepKind` and `RunStatus` literals, `requires_human` plus `human_prompt` plus `options` for pausing, and `writeback` capturing type, payload, and result. Port this almost directly to Zod schemas plus Drizzle tables. It is the spine of an accountable agent product.
2. **The persona plus schema plus length-constraint prompt contract**. Named role, named framework, literal JSON schema with pipe enums, explicit "Return ONLY valid JSON", and exact sentence counts. In TypeScript this becomes a Zod schema generating the JSON contract plus structured output, so the schema stops being a string in a prompt.
3. **The inherent to control to residual chain**. `rcsa.py`'s three nodes are the correct decomposition of an RCSA, and each node's output feeds the next verbatim so the reasoning is auditable. The 1 to 5 likelihood and impact pair plus a banded rating plus an explicit `risk_appetite_breach` comparison is the right model.
4. **The NFR taxonomy with `risk_appetite` at domain level**. Nine domains, named subdomains, `key_regulations` per domain, appetite as an enum. Drop or explicitly justify `NFR-CRD` and `NFR-CAP`.
5. **The knowledge graph node type set**, with `recommendation` and `resolution` as first-class nodes so agent output is traceable to its evidence. Declare a closed edge vocabulary this time.
6. **The seven-stage document pipeline** as a reusable enrichment pattern: extract, link entities, classify, score risk, map to obligations, relate documents, write field. The stage-event stream (`{stage, status, data}`) is a good progress protocol.
7. **Control `test_questions` on the control record**, plus `last_tested` and `effectiveness_score`. The seed of a real control testing capability.
8. **Write-back with 24-hour outcome checking** (`outcome_tracker.py`, `schedule_outcome_check`). Measuring whether an agent action actually resolved anything is rare and valuable.
9. **`_enrich_context_with_prior_findings`**. Runs compound: a new run sees earlier findings for the same agent. This is what makes the system feel like an operating environment rather than a set of one-shot tools.
10. **Live regulatory source clients as a concept**: EUR-Lex for obligation text with CELEX identifiers, ECB and EBA for supervisory context, OpenSanctions and NVD and MITRE for risk signal. Rebuild the clients, keep the source list.
11. **Domain vocabularies as closed enums**: control type and status, issue type, DORA classification, risk tier, due diligence level, data classification, questionnaire section status, KRI RAG status.
12. **The six named ICS processes and their sub-processes** as demo content. `rcsa_cycle_days` plus `last_rcsa` gives a credible assessment-due calculation.
13. **DORA article-level mapping** on Important Business Services and control `framework_refs`. Article-level granularity, not regulation-level, is what makes gap analysis meaningful.
14. **The agents-as-model-inventory idea** from `ai_risk.py`. An AI system in a regulated risk function should appear in its own model inventory.
15. **Dual-mode data sourcing** from `ics.py`: live source records take priority over static baseline records, and each is tagged with its `source`. This is the right pattern for a demo-safe versus live-data product, and this repository already has `NFR_DEMO_MODE` handling in `src/server/config/demo-mode.ts`.
16. **Role personas as a product surface**: the `dept` field on each agent (`nfr`, `compliance`, `capital`, `modelrisk`, `audit`, `credit`, `esg`, `infosec`, `privacy`, `procurement`) and the `group` field (`Core NFR`, `Compliance`, `Reporting`, `Specialist`, `Resilience`). That is a workable information architecture for "specialist intelligence per function".

---

## 8. Obsolete or a poor fit for a TypeScript and Next.js rebuild

**Direct technology replacement, no conceptual loss**

- LangGraph `StateGraph`. Every graph in this repository is a straight line of 1 to 4 nodes with no branching and no loops. That is a sequential async function, or at most the `@openai/agents` SDK already in this repository's dependencies. Importing a graph framework to express `a -> b -> c` is overhead.
- `TypedDict` state classes. Become Zod schemas and inferred types, with the benefit that the schema then also produces the structured output contract.
- Prompt-embedded JSON schemas as strings. Replace with Zod plus structured outputs so the contract is checked rather than requested.
- `run_agent_json` with `Return ONLY valid JSON (no markdown fences)` and downstream fence-stripping. Obsolete once structured outputs are used.
- FastAPI, uvicorn, `asyncio.to_thread`. Become Next.js route handlers and server actions.
- The `N8nChatModel` LangChain wrapper and `mcp_client.py` n8n MCP bridge. n8n is not part of the target architecture.
- The inference gateway, Prometheus, Grafana, OpenTelemetry, Helm charts, Dockerfiles, `deploy/`, `benchmarks/`, `charts/`. Real engineering, wrong layer for this product.

**Patterns to actively avoid**

- **Eighteen hand-written per-agent endpoints** (`/api/nfr-agents/{name}/run`) duplicating the generic `/api/agents/{agent_id}/run`. One parameterised route plus a typed registry.
- **Identifier inconsistency**: `reg_scan` in the registry versus `reg-scan` in the route, `issue` versus `issue_mgmt`, `mrm` versus `model_risk.py`, `opres` versus `op_resilience.py`, `regch` versus `reg_change.py`, `kri` versus `kri_monitor.py`. Four different naming conventions for the same eighteen things. Define one id per agent and derive everything from it.
- **`{"ok": false, "error": str(e)}` with HTTP 200** from broad `except Exception` handlers, in nearly every route. Leaks internal messages to the client and defeats client-side error handling. Use status codes and a typed error shape.
- **In-memory run store as the primary** (`_runs` dict, `MAX_RUNS = 200`, `_trim_runs()`), with SQLite as a mirror. Runs are the audit trail of a regulated process. The database must be the source of truth.
- **Emoji as the icon system**. Every registry entry carries an emoji (`🔗`, `📋`, `⚡`, `📊`, `📜`, `📖`, `🚨`, `🏦`, `📑`, `🧮`, `🔍`, `💳`, `🌱`, `🛡️`, `🔐`, `🔏`, `📡`, `📝`). Emoji render inconsistently across platforms and carry no semantic colour. Note that the visual source repository solved this properly with a Tabler icon manifest, and this repository already depends on `@tabler/icons-react`.
- **Hard-coded `PROCESS_CONFIG`** in `backend/apis/ics.py`, including `snow_keywords` keyword lists with client-specific strings (`webex`, `salesforce`, `sfa`, `crm`). Process definitions belong in data, and a keyword heuristic is not a linking strategy.
- **Fixed sleeps for UI pacing**: `await asyncio.sleep(0.05)` between workflow steps in `workflows.py` to make the SSE stream feel granular. Pace on the client.
- **`ServiceNow` as a hard dependency** in `tools.py`, `servicenow/client.py`, `servicenow/write_client.py`. Keep the write-back concept (work note, change request, incident, alert) behind an adapter interface. Do not bake one vendor's table model into the core.

**Data model problems to fix, not port**

- **Duplicate policy entity**: `backend/data/policies.json` uses `category`, `owner_dept`, `last_reviewed`, `next_review`, `scope`, `key_requirements`, `related_regs`, while `backend/data/fake/policies.json` uses `domain`, `owner_id`, `review_date`, `applies_to`, `linked_controls`. Two shapes for one entity.
- **Split risk registers**: `fake/risks.json` uses `cat`, `inherent`, `iL`, `iI`, `residual`, `rL`, `rI`, while `cyber_risks.json` uses `category`, `inherent_likelihood`, `inherent_impact`, `residual_likelihood`, `residual_impact`, `residual_score`. Same concept, incompatible fields. Unify on the long names.
- **Abbreviated field names** (`cat`, `iL`, `iI`, `rL`, `rI`, `isNew`) mixed with snake_case elsewhere. One convention.
- **Overlapping category vocabularies**: risk `cat` has 10 values including both `Compliance` and `Compliance & Privacy`, and both `Operational` and `Regulatory`; control `domain` has a different 11 values; the NFR taxonomy has a third set of 9 domains. Three competing category systems with no mapping table. Define one taxonomy and map everything to it.
- **Mixed financial and non-financial risk** in the NFR taxonomy (`NFR-CRD` Credit Risk, `NFR-CAP` Capital and Regulatory Reporting) and in the agent registry (`credit`, `icaap`, `corep`). Decide the product boundary.
- **No test result entity**. Controls carry `test_questions`, `last_tested`, and `effectiveness_score`, but there is no record of an individual test execution: who tested, when, against which question, with what evidence, and what the conclusion was. Control testing needs its own entity. This is the single largest domain gap.
- **No issue or action entity**. Agents produce `management_actions`, `recommended_actions`, `key_actions`, and `immediate_priorities` as free-text string arrays inside a JSON blob. There is no action record with an owner, a due date, a status, and a link back to the finding that raised it. `issues_open` and `issues_outstanding` are integer counts, not references. An NFR work operating system needs a first-class issue and action tracker.
- **No assessment entity**. `rcsa_cycle_days` and `last_rcsa` are fields on the process config, but there is no assessment record with a period, a status, a preparer, a reviewer, and an approval. The RCSA agent produces a result object that is not persisted as an assessment.
- **Hard-coded expected counts** in the seeder and validators. Brittle.
- **`data/processed/` is entirely failed output**. All ten files are `{"title": "<filename>.xlsx", "doc_type": "other", "purpose": "Extraction failed", "error": "llm_unavailable"}`, including `AcmeBank_RCSA_Register_2025.json`, `AcmeBank_TPRM_Policy_v1.5.json`, and `AcmeBank_DORA_Compliance_Framework_v1.0.json`. The document intelligence pipeline described in the README has no working output in the repository. Treat the feature as unproven, and note that the failure mode (persist an error stub with no retry and no visible degraded state) is exactly what the visual source repository's "never blank" rule exists to prevent.

**Documentation drift**

- `README.md` claims "30+ LangGraph agents" and the feature list repeats "30+ domain-specific agents". The actual registry is 18, plus 7 pipeline agents and roughly 11 support modules, which totals 36 files but not 36 agents. `ai_risk.py` says "18 NFR agents". Use the real number.
- `docs/repository-audit.md` documents only the inference gateway component inventory and API surface. It does not mention the NFR dashboard, the agents, or the knowledge graph at all, despite those being the larger half of the repository. The existing audit document covers the wrong product.
- `docs/adr/` has four decision records (mock backend, OpenAI-compatible API, observability stack, GPU not required), all about the gateway. No ADR exists for any NFR domain decision.

---

## 9. Security note

The task brief already confirmed that a variable named `OPENAI_API_KEY` exists in `RealAIInfrastructure/.env`. That file was not opened during this review, no search for secret-shaped strings was run, and no git history was inspected. No secret value appears anywhere in this document or in the audit document.

The repository's own `SECURITY.md` and `docs/repository-audit.md` state "No secrets committed to repository" and list a non-root container user, a read-only root filesystem, dropped capabilities, and `pip-audit` dependency scanning in CI. `.gitignore` covers the environment files.
