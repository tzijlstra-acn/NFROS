# NFROS OS Product Excellence Audit and Improvement Plan

## Two flagship Role Operating Systems, designed for the professional user and the product owner

### Scope

This plan focuses on:

```text
Operational Risk Partner OS
Third-Party Risk Manager OS
```

It does not add another flagship role.

It does not add another installed Role App.

It improves the depth, coherence, usability, governability, measurability and commercial credibility of the existing product.

The central recommendation is:

> Stop expanding the surface area. Turn the two flagship roles into complete, dependable working environments, then give the product owner the controls required to configure, measure, improve and operate them.

---

# 1. Executive assessment

NFROS has moved well beyond a visual prototype.

The repository already contains a credible foundation:

- two flagship role experiences;
- a simple four-item analyst navigation;
- a persistent AI Partner;
- Agenda, Meetings, Actions and Inbox;
- stage-based Role Apps;
- decisions and approvals;
- an authority gate;
- an integration runtime;
- receipts and audit;
- role release states;
- product configuration;
- AI quality concepts;
- pilot readiness and operations surfaces.

The strongest product decision remains the decision to focus on only two roles.

The current gap is not a lack of screens.

The current gap is the difference between:

```text
A convincing demonstration of a Role Operating System
```

and:

```text
A Role Operating System that feels complete, truthful, configurable and operable enough for a design-partner pilot
```

The next release should therefore concentrate on five outcomes:

1. **The user always sees real work.**  
   No fallback counts, static routine summaries or route-local process narratives should masquerade as live product state.

2. **The process genuinely runs end to end.**  
   A stage advances because its sources, tasks, decisions, approvals, tools and artifacts are complete, not because the user clicked Continue.

3. **Each flagship role feels professionally complete.**  
   The shared shell remains simple, while the portfolio, work objects, language, decisions and process methods become deeply role-specific.

4. **The product owner can manage the product.**  
   Role Apps, quality, adoption, value, integrations, releases, configurations and pilot cohorts need a coherent control plane.

5. **The product tells the truth about itself.**  
   Versions, status, readiness, connector modes, AI quality and limitations must come from one product-status model.

---

# 2. Audit basis

The plan is based on the current `main` branch and the following product areas:

```text
app/page.tsx
app/workday/page.tsx
app/workday/[role]/v3.tsx
app/workday/[role]/work/v3.tsx
app/workday/[role]/processes/v3.tsx
app/workday/[role]/processes/rcsa-cycle/v3.tsx
app/workday/[role]/processes/third-party-onboarding/v3.tsx
app/workday/[role]/decisions/v3.tsx

src/components/workday-v3/
src/components/ai-partner/
src/role-apps/
src/db/repositories/role-app-runtime.ts

app/settings/role-apps/
app/settings/integrations/
app/settings/organisation/
app/settings/branding/
app/settings/ai-quality/
app/settings/audit-integrity/
app/settings/pilot/
app/ops/

README.md
CHANGELOG.md
package.json
```

This is a source-level audit of the current public repository.

A browser-level audit should still be completed locally before implementation, including all target viewports and both English and German.

---

# 3. What is already strong

## 3.1 The product has a clear thesis

The strongest existing product principle is:

```text
Do not make the user operate the AI.
Make the AI operate the work around the user.
```

This is the right foundation.

The product should continue to start with professional work, not a chat prompt.

## 3.2 The analyst navigation is appropriately small

The current flagship navigation is:

```text
Home
Work
Processes
Decisions
```

This is sufficient.

Calendar, Meetings, Actions and Inbox belong inside Work.

AI Partner, Search and Updates belong in the shell.

Do not expand the primary navigation.

## 3.3 The role-release model is honest

The Available, Demo and Planned distinction is commercially useful.

It allows the product to communicate ambition without pretending that all roles are complete.

Keep:

```text
Available
Operational Risk Partner
Third-Party Risk Manager

Demo
Control Assurance
Incident and Resilience

Planned
Regulatory Change
NFR Governance
```

## 3.4 The authority model is a real differentiator

The product separates:

```text
Read
Draft
Propose
Approval required
Policy-bound autonomous
Prohibited
```

This should remain central to the product.

It is one of the strongest reasons to position NFROS as an operating system rather than a generic copilot.

## 3.5 The AI Partner architecture is thoughtful

The current AI Partner:

- survives collapse and route movement;
- supports Suggestions, Activity and Chat;
- preserves a draft;
- accepts contextual prompts;
- handles progressive generation;
- exposes receipts;
- avoids pulling the user away from Chat when a new suggestion arrives.

This is strong interaction design.

The next step is to ensure that its context and outputs are driven by real product state everywhere.

## 3.6 The product-owner foundations exist

The repository already includes:

- organisation configuration;
- branding;
- role-app registry;
- connector modes;
- outbox and retry;
- AI configuration registry;
- audit integrity;
- pilot readiness;
- health and operations.

The product owner is not starting from zero.

The current problem is that these capabilities feel like separate technical pages rather than one coherent product-management experience.

---

# 4. User-experience audit

# 4.1 Entry and orientation

## Current experience

The entry page still serves two audiences at once:

```text
Client or executive entering the product
Developer or presenter checking runtime configuration
```

The proposition sits beside:

- AI mode;
- API-key state;
- verification state;
- configuration source;
- database state;
- mode selector;
- setup instructions;
- reset control.

This is useful for debugging.

It weakens the product entrance.

## User impact

A new risk professional should not have to understand:

- AI mode;
- model configuration;
- source repository;
- seed state;
- reset behavior.

The first screen should answer:

```text
What is this?
Which role should I enter?
What can I do here?
```

## Recommendation

Create a product-quality landing page.

### Hero

```text
Run NFR work from one governed environment
```

Supporting line:

```text
NFROS prepares the work, runs complete risk processes and keeps material decisions with people
```

Actions:

```text
Explore the product
View the presentation
Enter design-partner workspace
```

### Product proof

Show current, real previews of:

```text
Operational Risk Partner OS
Third-Party Risk Manager OS
```

### Trust strip

Show only:

```text
Evidence-linked
Human-approved
Audit-ready
Synthetic demonstration
```

Move runtime state to:

```text
/ops
/control-room
/settings
```

## Acceptance criteria

- No API state in the primary landing experience.
- No reset control in the primary landing experience.
- No setup command in the primary landing experience.
- The two flagship roles are visible within one viewport.
- The presentation and product feel like one family.
- The page is understandable in five seconds.

---

# 4.2 Role selection

## Current experience

The role selector is clean and honest.

It is mostly a static catalogue of release definitions.

Available roles have:

- title;
- summary;
- process labels;
- Open workday.

## User impact

It explains what the role is, but not why the user should enter now.

The experience does not yet show:

- current work;
- active process;
- next meeting;
- current risk signal;
- latest AI preparation.

## Recommendation

Keep the selector simple, but add one live professional signal for each Available role.

Example:

### Operational Risk Partner

```text
Current focus
Manual override control rating

Active process
RCSA Cycle Assistant, Stage 6 of 8

Next meeting
Challenge workshop at 10:30
```

### Third-Party Risk Manager

```text
Current focus
Veridian evidence sufficiency

Active process
Third-Party Onboarding, Stage 4 of 8

Next meeting
Supplier challenge call at 14:00
```

Use actual repository data.

Do not use fallback copy.

## Acceptance criteria

- Available roles show one current signal.
- Demo roles remain clearly labelled Demo.
- Planned roles remain non-interactive.
- Role status comes from one release registry.
- No product claim is hard-coded in the selector.

---

# 4.3 Home

## Current experience

The Now, Next, Done mental model is strong.

The page also includes:

- Your day;
- next meeting;
- open actions;
- inbox requiring attention;
- Partner Pulse.

The current code still contains:

- static fallback counts;
- static fallback events;
- static action lists;
- hard-coded role-specific Partner Pulse summaries.

## User impact

A professional may see work that does not exist in the database.

This damages trust.

The problem is especially serious in a product whose proposition is that it understands the user's real work.

## Recommendation

Make Home entirely state-driven.

### Now

One item requiring human input.

It must answer:

```text
What changed?
Why does it matter?
What must I do?
By when?
```

### Next

Up to three items, ordered by:

```text
Materiality
Deadline
Dependency
Readiness
```

### Your day

Use only actual counts and events.

When there are no actions:

```text
No open actions
```

Do not show a seeded fallback list.

### Partner update

Build the update from actual routine runs.

Example structure:

```text
Prepared the 10:30 workshop
Followed up two evidence requests
Converted one message into an action
```

Each statement must link to the created work or activity.

### Done

Collapse completed work.

Show a count and category summary.

Example:

```text
Done today 7
5 handled automatically
2 completed by you
```

## Acceptance criteria

- No static fallback count.
- No static fallback action.
- No hard-coded Partner Pulse.
- Every Partner Pulse statement has lineage.
- Empty states are honest and useful.
- Home updates immediately after a meeting, decision, process stage or action.

---

# 4.4 Work Hub

## Current experience

The Work Hub has the right four tabs:

```text
Agenda
Meetings
Actions
Inbox
```

The implementation is very large and contains:

- tab logic;
- labels;
- filtering;
- static data;
- repository mapping;
- item rendering;
- detail rendering;
- styles;
- role-specific content.

## User impact

The surface can become inconsistent as role-specific behavior grows.

It is difficult to add professional depth without adding more conditional logic.

## Recommendation

Refactor Work into a shared capability shell plus role-specific configuration.

### Shared capability shell

```text
WorkHub
WorkTabs
MasterDetail
SelectionState
ContextBinding
SourceFreshness
RelatedWork
```

### Shared modules

```text
Agenda
Meetings
Actions
Inbox
```

### Role configuration

Operational Risk:

```text
meeting types
agenda labels
action kinds
inbox classifications
related object types
professional actions
```

TPRM:

```text
meeting types
agenda labels
action kinds
inbox classifications
related object types
professional actions
```

## Master-detail experience

Left:

```text
queue
filters
saved view
```

Right:

```text
selected item
context
evidence
related process
actions
activity
```

At smaller widths, open the detail as a drawer or route.

## Cross-object linking

Every selected item should expose:

```text
Related process
Related decision
Related meeting
Related action
Source message
Evidence
Audit
```

## Acceptance criteria

- Work Hub main route is below 300 lines.
- Each tab is independently testable.
- Role-specific copy is not embedded in the shared renderer.
- Selection persists when switching tabs.
- AI Partner context updates with selection.
- Context drawer never says Nothing selected after an item was selected.

---

# 4.5 Agenda

## Current experience

Agenda supports preparation states and role-specific events.

When the database contains no events, static role-specific events are shown.

## User impact

The user cannot distinguish real work from fallback content.

The agenda also lacks stronger working-day behavior such as:

- conflict management;
- preparation dependency;
- process deadline;
- focus-time protection;
- completed meeting outcome.

## Recommendation

Remove static fallback events.

Add:

```text
Day
Week
```

Each event shows:

- time;
- title;
- preparation state;
- linked process;
- linked object;
- conflict;
- required preparation;
- next action.

Add AI behaviors:

- prepare the next meeting;
- reserve focus time;
- identify missing evidence;
- identify scheduling conflicts;
- show when a process deadline depends on the meeting;
- update status after the meeting.

## Acceptance criteria

- Every event comes from the database or an explicit empty state.
- Meeting preparation status is current.
- Process and object links work.
- Conflict state is visible.
- A completed meeting changes its downstream work.

---

# 4.6 Meetings and minutes

## Current experience

The data model and repository support meetings and meeting minutes.

The Work Hub shows upcoming meetings and an archive.

The product does not yet provide a complete, polished meeting workspace across both roles.

## User impact

Meetings are central to NFR work.

A Role Operating System that cannot prepare, support and conclude a meeting still leaves a large part of the professional day outside the product.

## Recommendation

Build a complete meeting lifecycle.

### Before the meeting

Show:

- purpose;
- participants;
- process stage;
- open decisions;
- evidence pack;
- contradictions;
- AI-prepared questions;
- actions due before the meeting;
- expected outcomes.

### During the meeting

Support:

- transcript or seeded conversation;
- statement capture;
- evidence retrieval;
- contradiction flags;
- decision capture;
- action capture;
- owner and date;
- unresolved item.

### After the meeting

Generate structured minutes:

```text
Facts
Decisions
Actions
Owners
Due dates
Unresolved questions
Evidence references
```

The user must confirm:

- decisions;
- actions;
- owners;
- due dates;
- distribution.

After confirmation:

- minutes become evidence;
- actions are created;
- process stage updates;
- related decisions update;
- Home updates;
- audit records the action.

## Role-specific examples

Operational Risk:

```text
RCSA challenge workshop
First-line validation
Remediation review
Committee preparation
```

TPRM:

```text
Supplier challenge call
Specialist review huddle
Contract review
Approval forum
```

## Acceptance criteria

- One complete meeting journey per role.
- Minutes are editable before confirmation.
- Confirmed minutes create structured records.
- Confirmed minutes create an evidence document.
- Actions retain meeting lineage.
- Distribution is simulated and auditable.
- Search finds confirmed minutes.

---

# 4.7 Actions

## Current experience

The product has action records and action updates.

The Work Hub still falls back to static actions when the database is empty.

## User impact

Actions are the bridge between risk decisions and risk reduction.

A static fallback weakens the product exactly where accountability should be strongest.

## Recommendation

Remove static action fallbacks.

Use views:

```text
Needs me
Waiting on others
Overdue
Completed
```

Action detail should contain:

- clear completion condition;
- accountable owner;
- due date;
- source decision;
- source meeting;
- source process stage;
- evidence;
- progress history;
- blocker;
- latest follow-up.

Support:

```text
Assign
Change date
Request evidence
Add update
Draft reminder
Send reminder
Complete with evidence
Reopen
Escalate
```

AI may:

- identify vague wording;
- propose measurable completion criteria;
- identify duplicate actions;
- draft reminders;
- summarize responses;
- recommend escalation.

AI may not:

- close a material action;
- accept inadequate remediation;
- remove accountability;
- change a material due date without approval.

## Acceptance criteria

- No static action fallback.
- Updates are append-only.
- Completion requires evidence when configured.
- Material closure requires human confirmation.
- Process completion can depend on action state.
- Overdue and blocked actions affect Home and process state.

---

# 4.8 Inbox

## Current experience

The product conceptually combines communication sources.

The Work Hub contains inbox functionality.

The experience needs stronger conversion from communication to governed work.

## Recommendation

Use one unified inbox.

Sources:

```text
Mail
Collaboration
GRC queue
Monitoring event
Service-management update
Supplier submission
```

AI classification:

```text
Decision
Action
Evidence
Information
Delegate
Noise
```

For every item, show:

- source;
- sender;
- subject;
- linked object;
- proposed classification;
- classification rationale;
- response deadline;
- one primary action.

Support:

```text
Confirm triage
Change triage
Create action
Link as evidence
Add to process
Delegate
Draft reply
Send simulated reply
Dismiss
```

After conversion:

- remove from Needs me;
- show in Converted to work;
- preserve source lineage;
- update the destination object;
- update Home.

## Acceptance criteria

- Classification is editable.
- Classification has a rationale.
- Message-to-action works.
- Message-to-evidence works.
- Message-to-process works.
- Lineage is visible.
- Handled messages remain searchable.

---

# 4.9 Processes

## Current experience

The repository has persisted Role App runs, stage runs, tasks, artifacts and events.

The process pages still contain:

- inline AI preparation copy;
- static artifact fallbacks;
- route-local stage rules;
- direct stage-completion forms;
- stage advancement without universal completion validation.

## User impact

The process looks complete but does not yet behave like a reliable process engine.

A client will quickly notice when Stage 5 is a description and not executable work.

## Recommendation

Create one process orchestrator for both installed apps.

```text
ProcessOrchestrator
StageContextBuilder
SourceLoader
AIStagePreparation
HumanTaskService
DecisionGate
ApprovalGate
ToolExecution
ArtifactService
CompletionValidator
StageTransition
ProcessEventPublisher
```

## Stage contract

Every stage defines:

```text
Entry criteria
Required sources
Helpful sources
AI jobs
Human tasks
Decision kinds
Approval requirements
Tools
Artifacts
Completion criteria
Next stage
Blocking conditions
```

## Stage lifecycle

1. Validate entry criteria.
2. Load required sources.
3. Show source status.
4. Start AI preparation.
5. Validate structured output.
6. Create human tasks.
7. Create proposed actions.
8. Wait for human input.
9. Request approval where needed.
10. Execute governed tools.
11. Store artifacts.
12. Verify completion criteria.
13. Complete stage.
14. Open next stage.
15. Update Home, Work, Decisions, Activity and Audit.

## Acceptance criteria

- Route files do not define business rules.
- No inline AI preparation string is the live source of truth.
- No static artifact is used when a seeded run exists.
- Clicking Continue does not bypass criteria.
- Completion is transactional.
- External commands use the outbox.
- Refresh and restart preserve state.
- Duplicate submission is idempotent.

---

# 4.10 Decisions

## Current experience

The decision page is structurally clean.

It builds a queue from the existing repositories and authority verdict.

## Improvement opportunity

The decision experience should more explicitly connect:

```text
Why this decision exists
What changed
What evidence supports each option
What conflicts
What process is waiting
What will change after approval
```

## Recommendation

Use a five-part decision workspace.

### 1. Question

One professional question.

### 2. Context

- trigger;
- process stage;
- affected object;
- deadline;
- current position.

### 3. Evidence

- strongest supporting evidence;
- strongest opposing evidence;
- conflict state;
- stale source;
- uncertainty.

### 4. Options

- option;
- implication;
- affected systems;
- approval requirement.

### 5. Confirm and execute

- selected option;
- rationale;
- rationale ownership;
- exact payload;
- targets;
- approval;
- receipt.

## Acceptance criteria

- No option is preselected.
- Human rationale is mandatory.
- Exact target systems are visible.
- Decision links back to process and meeting.
- Approval binds to exact payload.
- Receipt shows successful and failed consequences separately.

---

# 4.11 AI Partner

## Current experience

The AI Partner is one of the strongest parts of the product.

The main improvement is not another tab.

It is deeper role and work continuity.

## Recommendation

### Persistent context

Retain:

- role;
- legal entity;
- selected object;
- active process;
- stage;
- current meeting;
- open action;
- inbox item;
- decision;
- source freshness;
- prior human decisions;
- user edits.

Store durable context outside the chat transcript.

### Typed outputs

Render:

```text
Answer
Evidence
Uncertainty
Recommendation
Proposed action
Approval request
Execution receipt
Blocked action
Follow-up question
```

### Suggestion lifecycle

Add explicit states:

```text
New
Reviewed
Accepted
Modified
Rejected
Executed
Expired
```

Record user disposition.

Use it in product quality and pilot analytics.

### Proactive behavior

Notify only when:

- human input is required;
- a material change occurred;
- a process is blocked;
- a deadline is approaching;
- execution failed;
- a routine created meaningful work.

Do not notify for every background check.

### Feedback

Allow:

```text
Useful
Not useful
Wrong source
Wrong interpretation
Missing context
Too verbose
```

Feedback links to:

- suggestion;
- prompt version;
- model profile;
- sources;
- role;
- task kind.

## Acceptance criteria

- Chat survives navigation.
- Selection updates context.
- User disposition is stored.
- Feedback is structured.
- No material action bypasses authority.
- Proactive updates stay within a notification budget.

---

# 4.12 Search and command

## Recommendation

Provide global search:

```text
Search work, records, evidence, meetings and actions
```

Search across:

- risks;
- controls;
- assessments;
- suppliers;
- services;
- contracts;
- evidence;
- meetings;
- minutes;
- actions;
- decisions;
- process runs.

Command palette actions:

```text
Open current work
Open next meeting
Find supplier
Find control
Open current process
Review decisions
Ask AI
Open evidence
```

## Acceptance criteria

- Results are grouped by professional object type.
- Search uses the current role and legal-entity scope.
- Search result opens in the correct product surface.
- Recent and pinned objects are supported.
- Keyboard navigation works.

---

# 5. Role-specific depth

# 5.1 Operational Risk Partner OS

## Portfolio

Add a role-native portfolio view inside Home or Processes.

Show:

- assessments due;
- event-driven reassessments;
- outside-appetite risks;
- control-effectiveness conflicts;
- evidence completeness;
- actions overdue;
- next committee;
- recent material change.

## RCSA Cycle Assistant

Make all eight stages executable.

### Stage 1: Scope and trigger

AI prepares:

- prior scope comparison;
- process changes;
- trigger summary;
- owners and participants.

Human decides:

- scope;
- trigger;
- off-cycle requirement.

### Stage 2: Evidence refresh

AI prepares:

- KRI;
- incidents;
- losses;
- control tests;
- actions;
- prior assessment;
- process telemetry;
- evidence gaps.

Human decides:

- evidence sufficiency;
- investigation;
- waiver or escalation.

### Stage 3: Risk and control change

AI prepares:

- prior-cycle comparison;
- conflict analysis;
- change candidates;
- challenge questions.

Human decides:

- relevance;
- materiality;
- causal interpretation.

### Stage 4: First-line input

AI prepares:

- targeted questions;
- response comparison;
- unsupported assertions;
- open disagreements.

Human decides:

- factual correction;
- judgment challenge;
- workshop escalation.

### Stage 5: Challenge workshop

AI prepares:

- agenda;
- evidence pack;
- contradictions;
- action capture;
- minutes draft.

Human decides:

- challenge conclusion;
- actions;
- unresolved issues;
- confirmed minutes.

### Stage 6: Rating and appetite

AI prepares:

- deterministic risk-matrix consequences;
- alternative positions;
- rationale draft;
- governance effect.

Human decides:

- control effectiveness;
- likelihood;
- impact;
- residual risk;
- appetite position.

### Stage 7: Actions and approval

AI prepares:

- measurable wording;
- duplicates;
- ownership;
- due dates;
- target-system changes.

Human decides:

- action sufficiency;
- owner;
- date;
- approval.

### Stage 8: Monitoring and reassessment

AI prepares:

- monitoring routines;
- event links;
- committee delta;
- reassessment proposal.

Human decides:

- material change;
- off-cycle reassessment;
- escalation.

## Acceptance criteria

- All eight stages are executable.
- Every stage creates a tangible output.
- Every material judgment is explicit.
- Event-driven reassessment can start a new run.
- Completion updates the portfolio and Home.

---

# 5.2 Third-Party Risk Manager OS

## Portfolio

Add:

- onboarding pipeline;
- due reviews;
- critical suppliers;
- missing evidence;
- open conditions;
- monitoring signals;
- fourth-party exposure;
- concentration themes;
- upcoming approval forums.

## Third-Party Onboarding

Make all eight stages executable.

### Stage 1: Request and intake

AI prepares:

- request summary;
- owner;
- service;
- data categories;
- legal entities;
- duplicate supplier check.

Human decides:

- proceed;
- correct business context.

### Stage 2: Classification and criticality

AI prepares:

- outsourcing classification;
- ICT classification;
- criticality;
- important-service dependency;
- rationale.

Human decides:

- classification;
- materiality;
- criticality;
- review depth.

### Stage 3: Tailored due diligence

AI prepares:

- reusable evidence;
- tailored request;
- removed irrelevant questions;
- missing evidence;
- requirement rationale.

Human decides:

- request scope;
- additional questions;
- blockers.

### Stage 4: Evidence review

AI prepares:

- ingestion;
- extraction;
- comparison;
- stale evidence;
- contradictions;
- requirement mapping;
- gap statements.

Human decides:

- sufficiency;
- materiality;
- documentation versus control weakness.

### Stage 5: Specialist reviews

AI prepares:

- routing;
- consolidation;
- disagreement;
- due dates.

Human decides:

- challenge;
- conflict resolution;
- escalation.

### Stage 6: Contract and conditions

AI prepares:

- clause comparison;
- missing rights;
- subprocessor requirements;
- conditions;
- negotiation points.

Human decides:

- sufficiency;
- trade-off;
- residual exposure.

### Stage 7: Decision and onboarding

AI prepares:

- options;
- evidence;
- uncertainty;
- rationale;
- target-system list.

Human decides:

- approve;
- conditionally approve;
- reject;
- escalate.

### Stage 8: Monitoring handoff

AI prepares:

- conditions;
- monitoring;
- reassessment;
- communications;
- register update.

Human decides:

- intensity;
- owner;
- remaining conditions.

## Acceptance criteria

- All eight stages are executable.
- Supplier meetings and specialist reviews are integrated.
- Evidence comes from the database.
- Conditions create actions.
- Approval creates supplier, service and monitoring records.
- Completion updates the portfolio and Home.

---

# 6. Product-owner experience audit

# 6.1 Product-owner persona model

Do not treat all administrators as one person.

Define:

```text
Platform Product Owner
Function Pack Owner
Role App Owner
Tenant Administrator
AI Quality Owner
Integration Owner
Operations Owner
Pilot Lead
```

Each has different responsibilities and permissions.

## Platform Product Owner

Owns:

- product release;
- common capabilities;
- shared roadmap;
- product health;
- commercial packaging.

## Function Pack Owner

Owns:

- domain language;
- professional method;
- role experience;
- evaluation scope;
- function roadmap.

## Role App Owner

Owns:

- process stages;
- source requirements;
- decisions;
- tools;
- outputs;
- adoption;
- stage performance.

## Tenant Administrator

Owns:

- organisation;
- legal entities;
- users;
- entitlements;
- branding;
- terminology.

## AI Quality Owner

Owns:

- model profiles;
- prompts;
- evaluation;
- source completeness;
- failures;
- release gates.

## Integration Owner

Owns:

- connector health;
- mappings;
- credentials;
- retries;
- failures;
- source freshness.

## Operations Owner

Owns:

- health;
- worker;
- incidents;
- support;
- backup;
- release.

## Pilot Lead

Owns:

- cohort;
- baseline;
- adoption;
- feedback;
- value measures;
- go or stop decision.

---

# 6.2 Current product-owner gaps

## Role App management is read-only

The current Role App settings page shows:

- app definitions;
- status;
- maturity;
- version;
- route;
- stages;
- connectors;
- human decisions.

The installed-app toggle is explicitly non-functional.

The product owner cannot:

- enable or disable an app;
- stage a release;
- compare versions;
- assign a cohort;
- review dependencies;
- inspect usage;
- inspect stage performance;
- review feedback;
- retire an app.

## AI quality is descriptive

The current AI Quality page shows:

- configurations;
- model profiles;
- evaluation suite labels;
- source-completeness labels.

The evaluation status is static text.

The product owner cannot:

- run an evaluation;
- inspect failures;
- compare candidate and released configuration;
- approve a release;
- roll back;
- see user modification and rejection.

## Pilot readiness is narrow

The current pilot page focuses on:

- readiness checks;
- pilot accounts;
- regulatory scope;
- evidence pack.

It does not yet manage:

- pilot cohort;
- baseline;
- goals;
- success criteria;
- issues;
- feedback;
- weekly adoption;
- pilot outcomes;
- go or stop decision.

## Operations is technical but isolated

The current operations console exposes health.

It does not yet connect operational incidents to:

- affected role;
- affected process;
- affected users;
- failed work;
- recovery;
- product status;
- release decision.

---

# 7. Product Owner Console

Create a coherent control plane.

Suggested route:

```text
/product
```

or:

```text
/settings/product
```

Primary navigation:

```text
Overview
Role Apps
Experience
Quality
Value
Integrations
Releases
Pilot
Operations
```

Do not scatter the product owner across unrelated technical pages.

Existing settings remain available as deep links.

---

# 7.1 Product overview

Show:

```text
Current release
Available roles
Installed Role Apps
Active users
Active process runs
Decisions waiting
Process failures
AI quality status
Connector health
Pilot status
```

Use real data.

Provide:

```text
What changed since the previous release?
What needs attention?
What is blocked?
What is performing well?
```

---

# 7.2 Role App lifecycle

Use lifecycle states:

```text
Draft
Candidate
Pilot
Installed
Available
Demo
Planned
Retired
```

A Role App release contains:

- version;
- process definition;
- source requirements;
- tools;
- authority;
- evaluations;
- connector dependencies;
- migration;
- release notes;
- support state.

Product-owner actions:

```text
Create candidate version
Compare versions
Run evaluations
Assign pilot cohort
Approve release
Enable
Disable
Roll back
Retire
```

Do not allow arbitrary code upload.

All app changes remain code-reviewed or controlled configuration.

---

# 7.3 Role App performance

For each installed app, show:

```text
Runs started
Runs completed
Median cycle time
Waiting time by stage
Human task time
Source delay
Decision delay
Approval delay
Failure rate
Resume rate
AI suggestion acceptance
AI suggestion modification
AI suggestion rejection
User feedback
```

Do not rank employees.

Use aggregate process measures.

---

# 7.4 Experience analytics

Show:

```text
Time to first meaningful action
Now item opened
Evidence opened
Meeting preparation reviewed
Minutes confirmed
Message converted to work
Action completed
Decision completed
Process stage completed
```

Allow filters:

```text
Role
Legal entity
Process
Cohort
Week
Mode
```

No keystroke tracking.

No employee productivity score.

---

# 7.5 AI quality management

Provide:

```text
Released configuration
Candidate configuration
Evaluation coverage
Grounding failures
Citation failures
Required-source failures
Authority refusals
German-language results
Latency
Cost
User rejection
User modification
```

Product-owner actions:

```text
Run evaluation
Inspect failed case
Compare output
Approve candidate
Reject candidate
Roll back
Export evidence
```

A configuration cannot release while mandatory evaluation fails.

---

# 7.6 Integration management

Show:

```text
Connector status
Last sync
Source freshness
Event subscription
Write state
Queued commands
Failed commands
Dead letters
Mapping issues
Credential status
```

Product-owner actions:

```text
Test connection
Run sync
Pause writes
Retry command
Resolve mapping
Download diagnostic bundle
```

Do not display a credential.

---

# 7.7 Pilot management

Create a complete design-partner workspace.

## Setup

- business area;
- legal entities;
- users;
- roles;
- processes;
- source systems;
- authority;
- measures;
- support contacts.

## Baseline

- current preparation time;
- cycle time;
- handoffs;
- systems opened;
- overdue actions;
- evidence completeness.

## Weekly view

- adoption;
- completion;
- issues;
- user feedback;
- quality;
- value;
- risks;
- decisions required.

## Exit decision

```text
Scale
Extend pilot
Pause
Stop
```

Include:

- evidence;
- unresolved conditions;
- control findings;
- commercial implication;
- next-wave recommendation.

---

# 7.8 Feedback and product discovery

Add structured feedback.

User feedback types:

```text
Wrong source
Missing context
Incorrect interpretation
Unhelpful suggestion
Workflow friction
Feature request
Data issue
Performance issue
```

Product owner can:

- triage;
- link to feature;
- link to Role App;
- link to stage;
- assign owner;
- set severity;
- track release.

Create a feedback inbox.

Do not rely on free-form chat transcripts as product research.

---

# 7.9 Release management

Provide one release view.

Show:

- current release;
- candidate release;
- database migration;
- app versions;
- prompt versions;
- model profiles;
- connector changes;
- known limitations;
- rollout status;
- rollback plan.

Actions:

```text
Run release gate
Generate evidence pack
Approve pilot release
Deploy
Roll back
```

Do not allow release while mandatory gates fail.

---

# 8. Technical architecture improvements

# 8.1 Shared event model

Use one event backbone for:

```text
Work arrived
Source changed
AI preparation started
AI preparation completed
Human task created
Decision requested
Approval requested
Tool executed
External command acknowledged
Stage completed
Process completed
Routine completed
Meeting completed
Action updated
```

This drives:

- Home;
- Work;
- Process;
- AI Partner;
- Activity;
- Audit;
- Product analytics.

Do not create separate accounts of the same event.

---

# 8.2 Durable work

Use durable jobs for:

- AI preparation;
- meeting preparation;
- minutes generation;
- evidence refresh;
- action follow-up;
- inbox triage;
- connector sync;
- outbound command;
- process resume.

The user must see:

```text
Queued
Running
Waiting for source
Waiting for approval
Retrying
Completed
Failed
```

No permanent spinner.

---

# 8.3 Product state and configuration

Separate:

```text
Domain state
Product configuration
Process definition
Process runtime
AI configuration
Release state
Analytics
```

Do not mix product configuration with domain audit.

---

# 8.4 Suggested data additions

Consider:

```text
product_releases
feature_flags
role_app_versions
role_app_entitlements
role_app_cohorts
role_app_metrics
user_preferences
saved_views
watchlists
notifications
product_feedback
feedback_links
pilot_programs
pilot_baselines
pilot_metrics
pilot_decisions
ai_feedback
ai_evaluation_runs
integration_incidents
data_quality_issues
release_evidence
```

Use only tables required by the implemented experience.

Do not create empty architecture for future marketing claims.

---

# 8.5 Personalisation

Support limited, safe personalisation:

```text
Saved view
Pinned object
Watchlist
Default Work tab
Notification preference
Language
Theme
```

Do not allow personalisation to hide mandatory work or controls.

---

# 9. Product design principles

## 9.1 Quiet by default

Show:

- one priority;
- one next action;
- one material alert.

Move everything else behind:

- View all;
- Details;
- Activity;
- Evidence.

## 9.2 Truth before theatre

Never use:

- fallback counts;
- fake activity;
- static live summaries;
- simulated status without a label.

Use:

```text
Empty
Unavailable
Simulated
Safe
Offline
Live
Verified
Not verified
```

## 9.3 Role native before platform native

Use professional language.

Operational Risk users should see:

- assessments;
- risks;
- controls;
- indicators;
- challenge;
- rating;
- appetite.

TPRM users should see:

- supplier;
- service;
- arrangement;
- evidence;
- specialist review;
- conditions;
- monitoring.

Do not expose product architecture in daily work.

## 9.4 Action first

Default order:

```text
Action
Reason
Essential facts
Evidence
History
Technical detail
```

## 9.5 Human authority is visible

Every material action should state:

```text
What AI prepared
What the person decides
What will change
What approval is required
```

## 9.6 Weekend language

Use plain professional language.

Avoid internal technology terminology in analyst-facing copy.

The product should feel intelligent without asking the user to understand the intelligence architecture.

---

# 10. Delivery roadmap

The roadmap is sequenced by dependency.

It is not a fixed calendar commitment.

# Wave 0: Product truth and release coherence

## Outcome

One product identity and no misleading state.

## Scope

- release registry;
- align package, changelog, routes and docs;
- remove fake counts;
- remove hard-coded Partner Pulse;
- remove static Work fallbacks;
- update status terminology;
- create honest empty states;
- align landing and role selector.

## Exit criteria

- product versions agree;
- no fallback work appears;
- all statuses are sourced;
- README matches the product;
- landing page is client quality.

---

# Wave 1: Daily Role OS completion

## Outcome

Both roles support a complete working day.

## Scope

- refactor Work Hub;
- complete Agenda;
- complete meetings;
- complete minutes;
- complete actions;
- complete inbox;
- global search;
- contextual evidence;
- role-specific portfolios.

## Exit criteria

- complete RCSA day journey;
- complete TPRM day journey;
- message-to-work;
- meeting-to-minutes;
- action follow-up;
- Home updates without refresh.

---

# Wave 2: End-to-end process engine

## Outcome

Both installed Role Apps run end to end.

## Scope

- process orchestrator;
- stage contracts;
- source loading;
- AI preparation;
- human tasks;
- decisions;
- approvals;
- tool execution;
- artifacts;
- completion criteria;
- transition;
- recovery.

## Exit criteria

- all eight RCSA stages execute;
- all eight TPRM stages execute;
- no direct bypass;
- resume after refresh;
- resume after restart;
- idempotent resubmission;
- live, safe and offline complete.

---

# Wave 3: AI Partner excellence

## Outcome

The AI Partner acts as a trusted operating partner.

## Scope

- real routines;
- persistent context;
- typed outputs;
- suggestion lifecycle;
- feedback;
- notification budget;
- proactive meeting preparation;
- action follow-up;
- inbox triage;
- event monitoring.

## Exit criteria

- no hard-coded AI summary;
- routine lineage visible;
- user disposition stored;
- feedback reaches product owner;
- no duplicate request;
- authority always enforced.

---

# Wave 4: Product Owner Console

## Outcome

The product can be managed, measured and improved.

## Scope

- overview;
- Role App lifecycle;
- app performance;
- AI quality;
- integration health;
- experience analytics;
- pilot management;
- feedback;
- release management.

## Exit criteria

- product owner sees one coherent control plane;
- installed app can be enabled and disabled;
- candidate app can be evaluated;
- pilot cohort can be managed;
- release gate is visible;
- product value is measured without employee ranking.

---

# Wave 5: Design-partner readiness

## Outcome

The product is credible for a controlled bank pilot.

## Scope

- named users;
- entitlements;
- legal-entity scope;
- one verified inbound integration;
- one verified outbound integration;
- secret-store abstraction;
- backup and restore;
- support and operations;
- pilot evidence pack;
- known limitations.

## Exit criteria

- analyst cannot role switch;
- analyst cannot reset;
- identity binds approvals;
- integration status is honest;
- support bundle works;
- pilot readiness reads actual controls;
- go or stop decision can be supported.

---

# 11. Priority matrix

# Must complete before client pilot

```text
Release truth
Client-quality landing page
Real Home state
Modular Work Hub
Meeting lifecycle
Action lifecycle
Inbox conversion
All eight RCSA stages
All eight TPRM stages
Stage completion validation
Live, safe and offline parity
Real routine output
Product Owner overview
AI quality evidence
Pilot cohort and baseline
Identity and entitlements
One verified read integration
One verified write integration
Backup and recovery
```

# Should complete for a strong design-partner proposition

```text
Role-specific portfolio views
Saved views and watchlists
Structured user feedback
Role App performance analytics
Candidate and released app versions
Release rollback view
Data-quality issue workflow
Product analytics
Search and command palette
```

# Later, after the two roles prove value

```text
Additional installed Role Apps
Additional flagship roles
Advanced no-code process configuration
Cross-tenant benchmarking
Full marketplace mechanics
Broad connector catalogue
Mobile-specific application
```

---

# 12. Success measures

# User success

```text
Time to first meaningful action
Meeting preparation time
Minutes confirmation time
Inbox items converted to work
Action cycle time
Evidence opened before decision
Process waiting time
Decision completion time
User correction of AI output
User rejection of AI output
```

# Product-owner success

```text
Role App adoption
Run completion
Stage bottleneck
Failure rate
Source-delay rate
Evaluation pass rate
Connector health
Support volume
Pilot objective progress
Release quality
Feedback closure
```

# Control success

```text
Material action approved by a person
Payload-bound approval
Required-source enforcement
Blocked-action rate
Receipt completeness
Audit-chain verification
No duplicate external mutation
Recovery from failure
```

# Commercial success

```text
Two-role pilot conversion
Role App expansion interest
Implementation effort by app
Reuse of common platform services
Managed-service adoption
Client willingness to baseline value
```

Do not calculate a commercial outcome from synthetic data.

---

# 13. Final product acceptance criteria

The product is ready for a design-partner pilot only when:

1. The two flagship roles are complete and honest.
2. No fake count or static live summary remains.
3. Home, Work, Processes and Decisions stay simple.
4. Meetings, minutes, actions and inbox work end to end.
5. Both eight-stage processes complete in live, safe and offline modes.
6. Every material judgment remains human.
7. Every material execution uses approval.
8. Every consequence has a receipt.
9. Process state survives refresh and restart.
10. AI Partner context survives navigation.
11. AI feedback is captured.
12. Product owner can see adoption, quality, value and operations.
13. Role App lifecycle is visible and governed.
14. Connector state is truthful.
15. One inbound and one outbound reference integration are verified where credentials exist.
16. Design-partner identity and entitlements work.
17. Backup and restore work.
18. Accessibility passes.
19. Performance passes.
20. Security and secret scans pass.
21. Documentation matches the product.
22. Known limitations are explicit.
23. No extra flagship role was added.
24. No extra installed Role App was added.
25. The product remains understandable to a first-week analyst.

---

# 14. Recommended implementation operating model

Use separate accountable workstreams.

```text
Product and experience
Shared work capabilities
Operational Risk
Third-Party Risk
Process runtime
AI Partner and quality
Integrations
Product Owner Console
Identity and pilot
Quality and release
```

Each workstream produces:

- implementation;
- tests;
- screenshots;
- handoff;
- known limitations;
- acceptance evidence.

The main integration owner must review every handoff before release.

---

# 15. Final recommendation

The next release should not be described as:

```text
More NFROS features
```

It should be described as:

```text
Completion of the two flagship Role Operating Systems and the product-management layer required to operate them
```

The product is most persuasive when it can demonstrate all of the following in one coherent journey:

1. A real work item arrives.
2. The AI prepares the evidence.
3. The professional performs the judgment.
4. The action is approved.
5. The process continues.
6. The meeting, action, inbox and process stay connected.
7. The external change is acknowledged.
8. The audit trail is complete.
9. The product owner can measure and improve the experience.
10. The bank can decide to scale or stop based on evidence.

That is the remaining value in the product.

Do not add more roles until these ten statements are demonstrably true for both flagship Role Operating Systems.
