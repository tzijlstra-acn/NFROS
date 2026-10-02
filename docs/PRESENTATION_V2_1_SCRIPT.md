> **Archive:** This is the V2.1 speaker script. For the current version, see `docs/PRESENTATION_V2_2_SCRIPT.md`. V2.2 corrects punctuation, stage counts, and copy voice throughout.

# NFROS Presentation V2.1 -- Presenter Script

## Preamble

### Meeting format

This is a 30-minute focused session structured as follows:

- 19-21 minutes: Core deck (13 slides at 45-120 seconds each)
- 9-11 minutes: Open discussion, questions, appendix navigation

The core deck is self-contained. Do not try to cover every appendix slide in the room. Use the appendix as a reference you navigate to in response to specific questions.

### How to open appendix slides in response to questions

When a question calls for more detail, press `A` to open the agenda overlay and orient the audience to where you are. Press `D` to access the download menu if they want the full deck. To jump directly to the appendix, press the "Open appendix" button on the end-of-core prompt (after slide 13), or press `C` to return to slide 1 and restart the core story. Appendix slides are labelled A1 through A23.

### Common objections and responses

These are drawn from the nine core questions in the service model data. Use these responses verbatim or adapt as needed.

**"Is this replacing our GRC system?"**
No. NFR OS sits above existing GRC systems as an orchestration layer. It connects to what you already have and organises the work for the professional -- it does not replace the data store or the system of record. In the pilot phase, it may run alongside existing systems without any integration required.

**"What does the AI actually do?"**
The AI aggregates data from multiple sources, drafts narrative outputs for professional review, flags anomalies and rating changes, and links evidence to the relevant workflow stage. It does not make risk decisions -- every rating, approval, and escalation remains with the professional. The AI does the groundwork; the professional does the judgment.

**"Where does our data go?"**
For the pilot, data stays in a client-controlled deployment. NFR OS is deployed in the client's infrastructure or a dedicated tenant -- not a shared multi-client environment. AI model calls use the Anthropic API; data sent to the model is governed by the Anthropic API terms and can be configured to exclude personally identifiable information.

**"How long before we see value?"**
The pilot is designed to produce measurable outcomes by week ten -- at least one complete RCSA cycle with verified cycle time and evidence quality data. Most pilot cohort members report reduced coordination overhead within the first two weeks of active use.

**"Can it connect to our internal systems?"**
Integration is possible but requires custom connector development. Live connections to core banking, GRC platforms, or data warehouses are not pre-built -- they are scoped and built per client as part of the mobilisation engagement. The pilot typically uses demonstration connectors with anonymised or synthetic data to avoid integration dependency on the critical path.

**"What happens if the AI makes an error?"**
The professional reviews all AI-generated content before it progresses in the workflow. A draft risk narrative cannot be submitted to committee without an authorised professional approving it. The system is designed so that AI errors are caught at the review stage, not discovered after the fact.

**"Does this meet our regulatory requirements?"**
NFR OS is designed to support the documentation, evidence, and audit trail expectations common across major NFR regulatory frameworks. We do not claim regulatory compliance -- that determination requires your legal and compliance teams to review the specific requirements against the platform design. Illustrative regulatory context, not legal advice.

**"How many people need to be involved in the pilot?"**
The pilot cohort is deliberately small: three to five OR professionals in one business unit. A pilot sponsor at director or CRO level is required for decision-making. An IT liaison is needed for deployment support. Total client involvement is typically six to ten people for the ten-week pilot.

**"What is the commitment after the pilot?"**
The pilot ends with a decision point -- not an automatic commitment to scale. The outcome report at week ten gives the client the evidence to decide: expand the scope, adjust the approach, or stop. There is no lock-in after the pilot.

---

## Slide 1: NFR work built around people

**Purpose:** Set the emotional register and introduce the three design principles that govern everything shown in the deck.

**Key sentence:** Risk professionals spend too much time finding work -- NFR OS changes that by delivering the right work to the right role at the right moment.

**Spoken script:**
I want you to imagine a morning where you don't open five different systems before you know what needs your attention today. Instead, a single workspace greets you with the cases, reviews, and decisions that actually require your judgment -- nothing more, nothing less. That is the ambition behind NFR OS.

This is not a new compliance tool. It is an operating layer that organises non-financial risk work around the role rather than around the database. The three lines on screen -- work finds you, judgment stays with you, progress is visible -- are the design principles we hold ourselves to throughout this conversation.

Work finds you means the system aggregates your portfolio and surfaces the right task at the right moment. Judgment stays with you means no material decision is delegated to the machine -- every rating, every approval, every escalation is a human act. Progress is visible means that anyone who needs to know the status of a cycle can see it without asking.

Everything I am going to show you either demonstrates or directly supports one of those three promises. Let me take you through what that looks like in practice.

**Limitation to acknowledge:** None on this slide. This is framing only.

**Transition:** Before I show you the product, I want to make sure we agree on the problem it is solving.

**Likely questions:**
- What do you mean by "operating system" for risk?
- How is this different from our existing GRC platform?

**Appendix reference:** A1 (product scope and release status), A8 (platform architecture)

---

## Slide 2: Five things we will cover

**Purpose:** Orient the audience to the session structure and signal that today is focused, not exhaustive.

**Key sentence:** This is a 30-minute session -- the agenda is front-loaded with context so the product makes sense when we get to it.

**Spoken script:**
Five topics. Roughly thirty minutes of focused content, then we open the room.

I am deliberately starting with the problem before showing the product. The product only makes sense once we have agreed on the frustration it solves, and in my experience, jumping straight to a demo before that agreement is in place leads to a conversation about features rather than a conversation about fit.

The five items are: the problem -- fragmented NFR work; the product -- an operating system for risk roles; the daily experience -- what it actually looks like to use it; the service model -- how we deliver and sustain it; and the next step, which is a specific and narrow pilot proposal.

I will keep each section brief. There is detailed appendix material available for any topic you want to go deeper on, and I will point to the relevant appendix slides as we go. We will not try to cover everything today -- the goal is to reach a clear view on whether the pilot makes sense, and everything else serves that question.

If you have seen an earlier version of this deck, I am happy to acknowledge upfront what has changed. Ask me at the end.

**Limitation to acknowledge:** None on this slide.

**Transition:** Let me start with the problem, because I think you will recognise it.

**Likely questions:**
- How long is the deck?
- Can we skip ahead to the commercial model?

**Appendix reference:** None specific -- the agenda slide maps to sections throughout.

---

## Slide 3: NFR work starts fragmented

**Purpose:** Establish the problem clearly and get the audience to confirm it against their own experience before showing any product.

**Key sentence:** Risk teams switch between case management, spreadsheets, and document stores to complete one review cycle -- context is lost at every handoff, and senior time goes to coordination rather than judgment.

**Spoken script:**
Before any product, I want to name the structural issue clearly. Risk professionals in OR, TPRM, and control assurance functions face the same problem: the work exists across multiple systems that were never designed to talk to each other.

An Operational Risk Partner completing one RCSA cycle may need to open a GRC tool to find the cycle scope, pull a spreadsheet to track the review calendar, chase evidence over email from control owners, and then manually update a status tracker before the committee meeting. That is four or five context switches for a single workflow.

The cost is not just time, though time is real -- we typically see four to six systems touched per cycle. The deeper cost is that when senior professionals spend their day on coordination tasks, the quality of risk judgment suffers. A risk partner who is spending forty percent of their cycle on chasing evidence is not spending it on assessing whether the risk narrative actually reflects what the business is doing.

We see four compounding problems: manual status chasing consuming senior hours, evidence scattered across email and SharePoint, no unified view of role workload, and no clear handoff point between stages.

I want to check before I go further: does this match what you see in your own teams?

**Limitation to acknowledge:** None on this slide. This is a problem statement, not a product claim.

**Transition:** What NFR OS does is attack all four of these problems in a single architecture.

**Likely questions:**
- Do you have data on how many systems our teams use?
- How do you measure the coordination cost?

**Appendix reference:** A22 (current limitations -- for balance), A10 (data model, which addresses the fragmentation at the data layer)

---

## Slide 4: An operating system for NFR work

**Purpose:** Introduce the three-layer architecture in plain terms and position NFR OS as an orchestration layer, not a replacement.

**Key sentence:** NFR OS sits above existing systems, organises work by role, routes tasks through structured workflows, and surfaces AI assistance at the moment of need -- without replacing the professional or the underlying system of record.

**Spoken script:**
The response to fragmentation is an orchestration layer -- a platform that sits above your existing systems and organises work by role, by process, and by moment.

NFR OS has three layers working together. The role layer means the system knows who you are -- not just your login, but your function, your portfolio, and your active cycles. When you open the work hub, you see your work, not everyone's work.

The workflow layer means that work follows a defined structure. Each process -- RCSA, TPRM onboarding, control testing -- is packaged as a role app with defined stages, defined inputs, and a clear handoff point. The professional moves through stages; the system captures the record.

The AI layer sits inside the workflow. It does not drive; it assists. It drafts, it summarises, it flags anomalies -- but every substantive decision remains with the professional. The AI is an assistant, not an authority.

This is an important positioning point: NFR OS is not asking you to rip out your existing GRC tooling in the short term. It is an orchestration layer above it. We connect to what the client already has. That positioning is what makes the product low-disruption from day one and high-value from week one.

**Limitation to acknowledge:** Live GRC system connectors require custom build -- demonstration connectors only at this stage. See appendix A19 for integration options.

**Transition:** Let me show you what this looks like for someone who uses it every day.

**Likely questions:**
- Which GRC systems can you connect to today?
- Does the AI layer require cloud access to Anthropic?

**Appendix reference:** A6 (AI capability layer), A8 (platform architecture), A19 (integration options)

---

## Slide 5: The day begins with what needs you

**Purpose:** Make the abstract architecture concrete by walking through what a typical morning looks like for an OR Partner using NFR OS.

**Key sentence:** On login, the work hub presents active cycles, pending decisions, and flagged items relevant to this role today -- no searching, no status chasing, context already present when a case is opened.

**Spoken script:**
Let me make this concrete. An Operational Risk Partner starts their day. They open a single URL. The work hub shows them their portfolio in one view: which RCSA cycles are active, which are waiting on their decision, which have AI-drafted content ready for their review, and which items have been escalated or are overdue.

They do not need to check a spreadsheet, open the GRC tool, and then cross-reference an email chain. The system has done that aggregation for them overnight. The professional opens their most pressing case and the context is already there: previous assessments, relevant risk data, the AI-drafted narrative ready for review, and a clear next action.

Four types of items appear in the work hub: active cycles with their stage and owner visible, items awaiting this professional's decision, AI-drafted outputs ready for review and approval, and escalations or overdue flags that need attention.

This is the daily experience we are building toward. The components shown here -- the work hub, the queue, the case view -- are implemented and running. The screenshots are illustrative of the current product state, not a projected future.

Judgment stays with the professional throughout. The work hub reduces the administrative overhead that surrounds that judgment.

**Limitation to acknowledge:** The screenshot is illustrative of local product state. Not independently verified in a client environment.

**Transition:** The work hub works the way it does because the product is designed around two specific roles. Let me explain that design choice.

**Likely questions:**
- Can we see the actual work hub in a demo?
- How does the AI know what to surface to each person?

**Appendix reference:** A1 (product scope), A9 (identity and access model)

---

## Slide 6: Built around the role

**Purpose:** Explain the role-first design philosophy and why two distinct operating systems are more valuable than one generic risk module.

**Key sentence:** NFR OS launches with two role operating systems -- OR Partner OS and TPRM Manager OS -- each calibrated to that role's actual daily work, not adapted from a generic risk module.

**Spoken script:**
Most risk platforms are built around a data model -- risks, controls, events -- and the user adapts to the system. NFR OS inverts this. The starting point is the role and what that person actually does in a working week.

The Operational Risk Partner OS is calibrated to the rhythm of an RCSA cycle, a risk committee calendar, and an event review queue. Every component of the work hub -- the queue ordering, the AI assistance, the escalation thresholds -- is designed around that professional's actual workflow.

The TPRM Manager OS is calibrated to a third-party lifecycle: onboarding a new supplier, running a periodic assessment, monitoring continuously, managing exit. Different rhythm, different data, different AI assistance needs.

The two columns on screen show those distinct workspaces side by side. This matters because it justifies the architecture: we are not building one tool for all risk people and hoping it fits. We are building role-specific operating environments that share a common platform.

Judgment and professional skill remain central in both environments. The OS structures the context in which that judgment is applied -- it does not dilute or shortcut it.

Additional roles are on the roadmap. The platform is designed to add roles incrementally as an app delivery, not a platform rebuild. Control Assurance and Incident and Resilience are next in the sequence.

**Limitation to acknowledge:** Control Assurance OS and Incident and Resilience OS are demonstration only at this stage -- role shells exist but workflow apps are not yet built.

**Transition:** The work inside each role OS is structured as a Role App. Let me show you what that means in practice.

**Likely questions:**
- Can you add our specific role structure?
- What does the roadmap for additional roles look like?

**Appendix reference:** A2 (role app catalogue), A1 (product scope and release status)

---

## Slide 7: End-to-end work becomes a Role App

**Purpose:** Walk through the six-stage workflow structure for both RCSA and TPRM, emphasising AI assistance at each stage and human decision at every gate.

**Key sentence:** Each major process is packaged as a Role App -- a six-stage workflow with defined inputs, AI assistance at each stage, and evidence captured throughout -- the professional moves through stages, the system captures the record.

**Spoken script:**
The Role App is the core unit of the product. Each Role App packages one major end-to-end process as a six-stage structured workflow. The professional works through the stages; the system builds the record as a by-product of that work.

For the RCSA Cycle Assistant: Scope, Assess, Draft, Review, Challenge, Submit. At every stage, AI assistance is available. At the scope stage, it can pull in prior cycle context. At the assess stage, it can flag where a proposed rating differs from the previous cycle. At the draft stage, it generates a risk narrative from structured inputs, ready for the professional to review and approve. Stages four and five -- review and challenge -- are human-driven approval and second-line challenge steps. Stage six, submit, requires an authorised professional to sign off the final pack for committee.

The TPRM onboarding workflow mirrors the structure: Screen, Onboard, Assess, Monitor, Escalate, Exit. Six stages, AI assistance at the assessment stage, human decision at every gate.

The important message here is that these are not checklists. They are structured workflows where the AI does the groundwork and the professional applies judgment at every stage gate. That combination is what produces both faster and better-quality output.

**Limitation to acknowledge:** None -- both RCSA and TPRM onboarding Role Apps are implemented and tested locally.

**Transition:** I want to be precise about where AI stops and human judgment starts. That boundary is worth being explicit about.

**Likely questions:**
- Can we customise the stages for our internal process?
- What AI model is being used?

**Appendix reference:** A3 (RCSA six-stage detail), A4 (TPRM onboarding six-stage detail), A7 (AI layer -- model and infrastructure)

---

## Slide 8: AI operates work; humans own judgment

**Purpose:** Address the most important trust question directly -- where the AI stops and the professional starts -- and be explicit that improved AI models do not automatically expand the AI's authority.

**Key sentence:** AI handles data aggregation, draft generation, anomaly flagging, and evidence linking -- the professional handles risk assessment, challenge, approval, and escalation -- and this boundary is enforced by the workflow architecture, not by policy alone.

**Spoken script:**
Let me be direct about the question that every risk audience has at this point: where does the AI stop and the professional start?

The AI does four things. It aggregates data from multiple sources into the case context. It generates first drafts of narrative outputs -- risk assessments, committee summaries, due diligence reports -- for the professional to review. It flags anomalies: a rating that has shifted materially from the prior cycle, a control gap that has widened, an escalation threshold that has been crossed. And it links evidence documents to the relevant workflow stage. Those four things -- aggregate, draft, flag, link -- are the AI's domain.

The professional does four things that the system cannot and will not do. They assess whether a risk rating is right given context the AI cannot see. They challenge an assessment where their judgment differs from the draft. They approve -- formally, with their name on it -- every output that progresses to the next stage. They decide whether to escalate. Assess, challenge, approve, escalate -- that is the professional's domain.

This boundary is not an aspiration. It is built into the workflow architecture. The system cannot submit an RCSA to committee; only an authorised professional can trigger that action. Material judgment remains with the professional -- explicitly, structurally, and verifiably.

One more point that matters: improved AI models in future do not automatically expand the AI's authority in this system. Expanded authority requires a deliberate redesign of the workflow boundaries. The boundary is a product decision, not a model capability decision.

**Limitation to acknowledge:** The evaluation harness that monitors AI output quality is configured but not independently verified in a production environment. See appendix A11.

**Transition:** That architecture produces measurable improvements in the quality of the risk work it supports. Let me walk through four outcomes we expect.

**Likely questions:**
- What stops someone from rubber-stamping the AI's draft?
- Can the AI boundary be adjusted for our risk appetite?
- What happens as the AI models improve -- does the boundary shift automatically?

**Appendix reference:** A6 (AI capability layer -- what AI does), A11 (evaluation and quality assurance), A22 (current limitations)

---

## Slide 9: Better prepared risk work

**Purpose:** Shift from product features to business outcomes, framing the value in terms risk leaders track.

**Key sentence:** Structured AI-assisted workflows produce measurable improvements across four dimensions: cycle time, evidence quality, output consistency, and audit readiness.

**Spoken script:**
Let me move from what the product does to what it produces. Risk leaders track four outcomes: speed, quality, consistency, and audit readiness. NFR OS is designed to improve all four.

Cycle times fall because the professional spends less time on coordination and more time on assessment. The work hub eliminates the morning triage across five systems. The AI drafts reduce the time spent writing from scratch. The structured workflow eliminates the manual status chasing between stages. That is coordination overhead removed at multiple points in the cycle.

Evidence quality improves because the workflow captures it at source. When a professional completes a stage, they attach or confirm the evidence at that moment -- not after the fact, when memory is incomplete and documents are harder to locate. Evidence that is captured in context is more complete and more accurate.

Output consistency improves because the AI drafts to a defined template. Every risk narrative, every committee summary, every assessment output follows the same structure. The professional reviews and edits rather than writing from scratch. The baseline quality is higher and more consistent across the portfolio.

Audit readiness improves as a by-product. Every decision, every draft reviewed, every approval is timestamped and linked to the relevant workflow stage. The audit record is not a separate documentation task -- it is a natural output of the work itself. Illustrative regulatory context, not legal advice: this approach is consistent with structured evidence and documentation expectations across major NFR frameworks.

**Limitation to acknowledge:** These are design-level outcomes. Pilot data will verify them. Do not cite specific percentage improvements without baseline data from the client's own environment.

**Transition:** Control is one of those four outcomes, and it deserves its own slide because it addresses a question your second line will ask.

**Likely questions:**
- Do you have data from existing deployments?
- How do you measure evidence quality improvement?

**Appendix reference:** A16 (pilot success metrics -- where we will verify these outcomes), A11 (evaluation and QA)

---

## Slide 10: Control is built into the workflow

**Purpose:** Address the control and governance dimension for second-line and audit audiences, showing that structured workflows produce better control outcomes than ad hoc processes.

**Key sentence:** Every workflow stage produces a structured output linked to evidence -- the audit trail is a by-product of doing the work, not a separate documentation task.

**Spoken script:**
Your second line and your audit function will have one central question: does NFR OS create a control gap, or does it close one? I want to answer that directly.

The current fragmented model -- spreadsheets, email, GRC tools that do not talk to each other -- creates an audit problem. Reconstructing a complete audit record for one RCSA cycle means chasing multiple people for documents that were created in different systems at different times, with no single version of the decision chain. That is a control gap inherent to ad hoc processes.

In NFR OS, evidence is captured at the point of work. When a professional completes a workflow stage, they attach or confirm the relevant evidence and the system timestamps that linkage. When an approver signs off, that approval is recorded against the specific output, not against the cycle in aggregate. When a threshold is breached and an escalation is triggered, the system logs it with the timestamp and the triggering data.

The four control properties on screen -- evidence at each stage, review and approval as workflow steps, escalation triggers built into thresholds, full history without reconstruction -- are not design aspirations. They are structural properties of the workflow architecture.

The audit record is a natural output of the workflow, not an additional reporting burden. Structured workflows are inherently better controlled than ad hoc processes. That is the control message for this slide. Illustrative regulatory context, not legal advice: this design approach is consistent with expectations under major operational risk and third-party risk frameworks.

**Limitation to acknowledge:** The audit log is implemented locally. Multi-tenant isolation has not been tested -- single-tenant deployment is recommended for the pilot. See appendix A20.

**Transition:** That architecture is delivered as a service. Let me explain the service model, because it shapes how we grow with a client over time.

**Likely questions:**
- Can our audit team access the audit trail directly?
- How does this interact with our existing second-line challenge process?

**Appendix reference:** A10 (data model -- evidence entities), A20 (security and data handling), A9 (identity and access)

---

## Slide 11: A service that grows by Role App

**Purpose:** Introduce the four-tier service model and explain why the managed service structure is the right commercial architecture for this product.

**Key sentence:** NFR OS is delivered as a managed service with four tiers -- platform, function packs, role apps, and managed operations -- designed to start narrow and grow with the client's appetite for AI-assisted risk work.

**Spoken script:**
NFR OS is not a software license. It is a managed service. I want to be precise about what that means and why it matters.

The platform tier is fixed. It covers infrastructure, identity, AI model access, security patching, and backup -- everything that all role apps run on. The client does not carry the burden of keeping the platform current; we handle that as part of the service.

The function packs are modular. The Operational Risk Pack, the TPRM Pack, and the planned Control Assurance Pack can be enabled independently. A client starting with OR does not pay for TPRM until they are ready to enable it.

The role apps are the growth engine. Each new role app -- RCSA Cycle Assistant, TPRM Onboarding, and the apps on the roadmap -- is a discrete build engagement that slots into the running platform. Adding a new role app does not disrupt what is already running.

Managed operations means ongoing monitoring, model performance reviews, new app releases, and user adoption support on a recurring basis. The client buys a service level, not a point-in-time delivery.

This service model is important because it allows the commercial relationship to start narrow -- with one pilot on one process -- and expand as the client builds confidence in the outcomes. The next slide covers that expansion logic.

**Limitation to acknowledge:** Managed operations at full scale is a design -- the service has not yet been delivered to a client at programme scale.

**Transition:** The rollout logic follows a deliberate sequence: start narrow, prove the case, scale with evidence.

**Likely questions:**
- What does the managed service include specifically?
- Is there a minimum contract term?

**Appendix reference:** A13 (service model component detail), A14 (commercial packaging)

---

## Slide 12: Start narrow. Prove it. Scale.

**Purpose:** Present the rollout logic as a deliberate risk management choice and give the audience a clear picture of what each of the three steps involves.

**Key sentence:** The rollout follows three steps -- pilot on one role and one process, prove outcomes and add one role app, scale to programme -- so that each expansion decision is based on the client's own evidence, not projections.

**Spoken script:**
The rollout is a deliberate risk management choice, not just a commercial convenience. Starting narrow means the client takes a small, defined bet: one role, one process, eight to twelve weeks. They see the product working in their environment with their data before committing to broader rollout.

Step one is the pilot: OR Partner OS, RCSA Cycle Assistant, a cohort of three to five professionals in one business unit, ten weeks. The pilot produces a verified outcome report at week ten -- cycle time data, evidence quality data, user adoption numbers, AI utilisation. That report is the evidence base for the step two decision.

Step two adds one additional role app based on what the pilot revealed. Where is the pain greatest? Where is the process most mature? Where did the user adoption data suggest the strongest fit? The second app is selected based on the client's own pilot evidence, not our recommendation alone. The cohort expands by three to five more users. The commercial model for programme is agreed at this point.

Step three is programme: full function packs in production, managed operations fully active, quarterly new app releases, and NFR OS as the default operating environment for enrolled risk functions.

This sequencing reduces client risk. It allows us to learn and improve the product against real client processes. And it creates a natural expansion path where every commitment is based on verified outcomes.

**Limitation to acknowledge:** Steps two and three have not been delivered with a client yet. Step one is the proposed starting point.

**Transition:** The pilot is what I am proposing today. Let me be specific about what it involves.

**Likely questions:**
- What does the outcome report actually contain?
- What happens if the pilot does not meet the success criteria?

**Appendix reference:** A15 (pilot design -- detailed specification), A16 (pilot success metrics), A17 (stakeholder map for pilot)

---

## Slide 13: Proposed next step

**Purpose:** Close with a clear, bounded, and non-intimidating ask -- a ten-week pilot on a specific and narrow scope -- and leave the audience with a framing that positions this as a smart first decision rather than a large commitment.

**Key sentence:** We are proposing a defined pilot -- OR Partner OS with the RCSA Cycle Assistant, ten weeks, three to five professionals -- and the only commitment today is to decide whether this pilot is the right first step.

**Spoken script:**
I want to close with a clear and bounded ask. We are not asking for a programme commitment today. We are asking whether the audience is willing to run a ten-week pilot on a narrow and defined scope.

The scope is: OR Partner OS only, RCSA Cycle Assistant only, one business unit or risk domain, three to five OR professionals in the cohort. That is the smallest meaningful unit of value we can deliver -- small enough to manage the change impact, large enough to generate credible data.

The timeline is ten weeks: weeks zero and one are environment setup and user onboarding, weeks two through eight are an active RCSA cycle using NFR OS, weeks nine and ten are outcome measurement and the report. At week ten, the client has a verified outcome report and a clear decision: expand, adjust, or stop.

The emphasis line on screen -- "a decision, not a commitment to scale" -- is the framing I want you to leave with. The pilot is a structured way to find out whether NFR OS delivers value in your specific environment. If it does, the expansion case is made by your own data. If it does not, the cost of finding that out is bounded to ten weeks on one process with a small cohort.

The next decision is not whether to automate NFR. It is which working day and process we should prove first.

My question to close: who in this room should be involved in scoping the pilot, and who needs to be the sponsor?

**Limitation to acknowledge:** The pilot requires pre-pilot mobilisation steps including load testing and a security review before going live with client data. These are scoped into the mobilisation engagement.

**Transition:** Discussion and questions -- I am ready to navigate to any appendix slide or go deeper on any topic raised.

**Likely questions:**
- What does the pilot cost?
- Can we start with TPRM instead of OR?
- What do we need to do to get started?

**Appendix reference:** A15 (pilot design), A16 (success metrics), A17 (stakeholder map), A18 (change management approach), A22 (current limitations)

---
