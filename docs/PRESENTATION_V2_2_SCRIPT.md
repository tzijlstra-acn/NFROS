# NFROS Presentation V2.2: Presenter Script

## Preamble

### Session format

This is a 30-minute focused session structured as follows:

- 19 to 21 minutes: Core deck (13 slides at 30 to 120 seconds each)
- 9 to 11 minutes: Open discussion, questions, appendix navigation

The core deck is self-contained. Do not attempt to cover every appendix slide in the room. Use the appendix as a reference you navigate to in response to specific questions.

### How to open appendix slides

When a question calls for more detail, press `A` to open the agenda overlay and orient the audience. Press `D` to access the download menu. To jump to the appendix, use the "Open appendix" button on the end-of-core prompt after slide 13, or press `C` to return to slide 1 and restart the core story. Appendix slides are labelled A1 through A23.

### V2.2 corrections to be aware of

V2.2 corrects two facts that were wrong in V2.1 materials:

1. Both RCSA and TPRM processes are eight-stage, not six-stage. If asked directly, confirm eight stages for each.
2. Punctuation and copy voice have been updated throughout. The product features and commercial model are unchanged.

### Common objections and responses

**"Is this replacing our GRC system?"**
No. NFR OS sits above existing GRC systems as an orchestration layer. It connects to what you already have and organises the work for the professional. It does not replace the data store or system of record. In the pilot phase, it may run alongside existing systems without any integration required.

**"What does the AI actually do?"**
The AI aggregates data from multiple sources, drafts narrative outputs for professional review, flags anomalies and rating changes, and links evidence to the relevant workflow stage. It does not make risk decisions. Every rating, approval, and escalation remains with the professional. The AI does the groundwork; the professional does the judgment.

**"Where does our data go?"**
For the pilot, data stays in a client-controlled deployment. NFR OS is deployed in the client's infrastructure or a dedicated tenant, not a shared multi-client environment. AI model calls use the Anthropic API; data sent to the model is governed by the Anthropic API terms and can be configured to exclude personally identifiable information.

**"How long before we see value?"**
The pilot is designed to produce measurable outcomes by the end of the active cycle window: at least one complete RCSA cycle with verified cycle time and evidence quality data. Most pilot cohort members report reduced coordination overhead within the first two weeks of active use.

**"Can it connect to our internal systems?"**
Integration is possible but requires custom connector development. Live connections to core banking, GRC platforms, or data warehouses are not pre-built. They are scoped and built per client as part of the mobilisation engagement. The pilot typically uses demonstration connectors with anonymised or synthetic data to avoid integration dependency on the critical path.

**"What happens if the AI makes an error?"**
The professional reviews all AI-generated content before it progresses in the workflow. A draft risk narrative cannot be submitted to committee without an authorised professional approving it. The system is designed so that AI errors are caught at the review stage, not discovered after the fact.

**"Does this meet our regulatory requirements?"**
NFR OS is designed to support the documentation, evidence, and audit trail expectations common across major NFR regulatory frameworks. We do not claim regulatory compliance. That determination requires your legal and compliance teams to review specific requirements against the platform design. Illustrative regulatory context, not legal advice.

**"How many people need to be involved in the pilot?"**
The pilot cohort is deliberately small: three to five OR professionals in one business unit. A pilot sponsor at director or CRO level is required for decision-making. An IT liaison is needed for deployment support. Total client involvement is typically six to ten people for the pilot period.

**"What is the commitment after the pilot?"**
The pilot ends with a decision point, not an automatic commitment to scale. The outcome report gives the client the evidence to decide: expand the scope, adjust the approach, or stop. There is no lock-in after the pilot.

---

## Slide 1: NFR work built around you

**Layout:** hero
**Section:** Imagine
**Presenting time:** 1 minute

---

Open by asking the audience to picture a morning where they do not open five systems to find out what needs their attention today. A single workspace greets the professional with the cases, reviews, and decisions that actually require their judgment. That is the ambition behind NFR OS: not a new compliance tool, but an operating layer that organises non-financial risk work around the role rather than around the database.

The three lines on screen are the design principles this product holds itself to. The right work finds you. Evidence is already prepared. Every material decision remains yours. These are not aspirations to be built toward one day. They are the organising logic behind every feature shown in this session.

Risk professionals spend too much time on assembly: pulling together context from mail, documents, GRC systems, and data platforms before any judgment can begin. NFR OS changes that by doing the assembly for them. Keep this slide brief and personal. The product will demonstrate the promises; this opening simply names them.

Pause for a breath and let the framing land before moving on. This slide sets the emotional register for everything that follows.

**Key emphasis:** The product organises risk work around the professional, not the database.

**Transition:** Before showing the product, let us agree on the problem it is solving.

---

## Slide 2: Five things we will cover

**Layout:** list
**Section:** Agenda
**Presenting time:** 1 minute

---

Walk through the five agenda items at a deliberate pace. Signal that this is a focused session: roughly thirty minutes of content, followed by open discussion and appendix navigation. Let the audience know that detailed appendix material is available for any topic where they want to go deeper, and that the goal today is not to cover everything but to reach a shared view on whether the pilot makes sense.

The agenda is deliberately structured to lead with context before showing the product. The problem section comes before the product section because the product only lands once the audience has already agreed on the frustration it addresses. Jumping straight to a demonstration before that agreement is in place tends to produce a conversation about features rather than a conversation about fit.

Check whether any members of the audience have seen a previous version of this deck. If so, acknowledge what has changed in V2.2 and offer to cover the differences at the end of the session. The main corrections are: stage counts (now accurately shown as eight for each process) and punctuation throughout. The product and commercial model are unchanged from V2.1.

**Key emphasis:** Problem before product. Context before demonstration.

**Transition:** Starting with the problem, because most people in this room will recognise it immediately.

---

## Slide 3: NFR work starts fragmented

**Layout:** split
**Section:** Problem
**Presenting time:** 1.5 minutes

---

Set up the problem space clearly before showing anything about the product. Risk professionals across operational risk, TPRM, and control assurance face the same structural issue: the work exists across multiple systems that were never designed to talk to each other. An Operational Risk Partner completing one RCSA cycle may open a GRC tool to find the cycle scope, pull a spreadsheet to track the review calendar, chase evidence over email from control owners, and then manually update a status tracker before the committee meeting. Four or five context switches for a single workflow.

The six nodes on screen represent where work actually lives: mail, meetings, documents, GRC platforms, data systems, and action trackers. Before any risk judgment can begin, someone must assemble these inputs. That assembly task consumes senior professional time that should be spent on assessment.

The cost is not just time. When senior professionals spend their day on coordination tasks, the quality of risk judgment suffers. A risk partner spending a significant portion of their cycle chasing evidence is not spending it on assessing whether the risk narrative actually reflects what the business is doing.

Pause after naming the four compounding problems and ask whether this matches what the audience sees in their own teams. Let them respond before advancing.

Synthetic institution and data.

**Key emphasis:** The first task is often assembly, not risk judgment.

**Transition:** What NFR OS does is attack this assembly problem at its root, across all sources simultaneously.

---

## Slide 4: An operating system for NFR work

**Layout:** three-layer
**Section:** Product
**Presenting time:** 1.5 minutes

---

Introduce the three-layer architecture in plain terms. The role layer means the system knows who you are: not just your login, but your function, your portfolio, and your active cycles. When you open the work hub, you see your work, not everyone's combined queue sorted by date.

The workflow layer means that work follows a defined structure. Each process, whether RCSA Cycle Assistant or Third-Party Onboarding, is packaged as a Role App with defined stages, defined inputs, and a clear handoff point. The professional moves through stages; the system captures the record as a by-product of doing the work.

The AI layer sits inside the workflow. It does not drive; it assists. It drafts, summarises, and flags anomalies, but every substantive decision remains with the professional. The AI is an assistant, not an authority.

The most important positioning point on this slide: NFR OS does not replace existing GRC tooling in the short term. It is an orchestration layer above existing systems. We connect to what the client already has. That makes the product low-disruption from day one and high-value from week one.

Live GRC system connectors require custom build. Demonstration connectors are used in the pilot. See appendix A19 for integration options.

**Key emphasis:** Orchestration above existing systems, not a rip-and-replace.

**Transition:** Let us make this architecture concrete by walking through what a typical morning looks like for someone using it every day.

---

## Slide 5: The day begins with what needs you

**Layout:** split
**Section:** Daily
**Presenting time:** 1.5 minutes

---

Walk through what a typical morning looks like for an Operational Risk Partner using NFR OS. They open a single URL. The work hub shows them their portfolio in one view: which RCSA cycles are active, which are waiting on their decision, which have AI-drafted content ready for review, and which items have been escalated or flagged as overdue.

They do not check a spreadsheet first, then open the GRC tool, then cross-reference an email chain. The system has done that aggregation for them. When they click into their most pressing case, the context follows: previous assessments, relevant risk data, the AI assistant's draft output, and a clear next action.

The four item types on screen reflect how the work hub is structured: active cycles with stage and owner visible, items awaiting this professional's decision, AI-drafted outputs ready for review and approval, and escalations or overdue flags that need attention. These are not future capabilities. They are implemented and running in the current product.

Note that the screenshot referenced on this slide is illustrative of the current local product state, not a verified client environment capture. Judgment stays with the professional throughout. The work hub reduces the administrative overhead that surrounds that judgment.

Synthetic institution and data.

**Key emphasis:** A single login that replaces five system checks.

**Transition:** The work hub is designed around two specific roles. Understanding that design choice explains why the product works the way it does.

---

## Slide 6: Built around the role

**Layout:** two-column
**Section:** Roles
**Presenting time:** 1.5 minutes

---

Explain the role-first design philosophy. Most risk platforms are built around a data model: risks, controls, events. The user adapts to the system. NFR OS inverts this. The starting point is the role and what that person actually does in a working week.

The Operational Risk Partner OS is calibrated to the rhythm of an RCSA cycle, a risk committee calendar, and an event review queue. The daily focus is RCSA cycles, committee preparation, and event review. The installed app is the RCSA Cycle Assistant. Human judgment this role owns includes risk ratings, challenge decisions, and committee submissions.

The TPRM Manager OS is calibrated to a third-party lifecycle: onboarding a new supplier, periodic assessment, continuous monitoring, exit. Different rhythm, different data, different AI assistance needs. The installed app is Third-Party Onboarding. Human judgment this role owns includes classification decisions, evidence adequacy calls, and approval decisions.

The two columns on screen show those distinct workspaces side by side. This justifies the architecture: we are not building one generic risk tool and hoping it fits every professional. We are building role-specific operating environments that share a common platform. Judgment and professional skill remain central in both. Additional roles are on the roadmap and designed to be added incrementally as app deliveries, not platform rebuilds.

**Key emphasis:** Two distinct role operating systems, not one generic risk module.

**Transition:** The work inside each role OS is structured as a Role App. Let me show you what that means for a real process.

---

## Slide 7: End-to-end work becomes a Role App

**Layout:** process-rows
**Section:** RoleApps
**Presenting time:** 2 minutes

---

Walk through both process rows on screen. The RCSA Cycle Assistant takes a risk professional through eight stages: Scope and Trigger, Evidence Refresh, Risk and Control Change, First-line Input, Challenge Workshop, Rating and Appetite, Actions and Approval, and Monitoring and Reassessment. At every stage, AI assistance is available. It can pull in prior assessment data, draft a risk narrative, flag where a proposed rating differs from the previous cycle, or prepare a challenge workshop agenda. But the professional reviews and approves at each stage. The system does not advance without a human decision.

The Third-Party Onboarding process works the same way: eight stages from initial Request and Intake through Classification and Criticality, Tailored Due Diligence, Evidence Review, Specialist Reviews, Contract and Conditions, Decision and Onboarding, and finally Handover to Monitoring. At each stage, the Role App knows what data is needed, what analysis is relevant, and what the output should look like.

These are not checklists. They are structured workflows where the AI does the groundwork and the professional applies judgment at every stage gate. A note on the record: V2.1 materials described both processes as six-stage. The correct count is eight stages for each process, as defined in the product's role app definitions.

**Key emphasis:** Eight stages each, AI assistance at every stage, human decision at every gate.

**Transition:** The boundary between AI assistance and human judgment is worth being explicit about. That is the next slide.

---

## Slide 8: AI operates work; humans own judgment

**Layout:** two-column
**Section:** HumanAI
**Presenting time:** 1.5 minutes

---

Address the question every risk audience has at this point: where does the AI stop and the professional start? Be direct.

The AI does four things. It aggregates data from multiple sources into the case context. It generates first drafts of narrative outputs such as risk assessments, committee summaries, and due diligence reports, ready for professional review. It flags anomalies: a rating that has shifted materially from the prior cycle, a control gap that has widened, an escalation threshold that has been crossed. And it links evidence documents to the relevant workflow stage. Aggregate, draft, flag, link: that is the AI's domain.

The professional does four things the system cannot and will not do. They assess whether a risk rating is right given context the AI cannot see. They challenge assessments where their judgment differs from the draft. They approve, formally and with their name attached, every output that progresses to the next stage. They decide whether to escalate. Assess, challenge, approve, escalate: that is the professional's domain.

This division is not aspirational. It is built into the workflow architecture. An RCSA cycle cannot be submitted to committee without an authorised professional triggering that action. Improved AI models in future do not automatically expand the AI's authority in this system. Expanded authority requires a deliberate redesign of the workflow boundaries.

**Key emphasis:** The AI boundary is a product decision, not a model capability decision.

**Transition:** That architecture produces measurable improvements in the quality of the risk work it supports. Four outcomes worth naming clearly.

---

## Slide 9: Better prepared risk work

**Layout:** outcome-grid
**Section:** Improvement
**Presenting time:** 1.5 minutes

---

Move from product features to outcomes. Risk leaders track four things: speed, quality, consistency, and audit readiness. NFR OS is designed to improve all four.

Cycle times fall because the professional spends less time on coordination and more time on assessment. The work hub eliminates the morning triage across multiple systems. AI drafts reduce time spent writing from scratch. The structured workflow eliminates manual status chasing between stages. That is coordination overhead removed at multiple points in the cycle.

Evidence quality improves because the workflow captures it at source. When a professional completes a stage, they attach or confirm the relevant evidence at that moment, not afterward when memory is incomplete and documents are harder to locate. Evidence captured in context is more complete and more accurate than evidence reconstructed.

Output consistency improves because the AI drafts to a defined template. Every risk narrative, every committee summary, every assessment follows the same structure. The professional reviews and edits rather than writing from scratch each time.

Audit readiness improves as a by-product of doing the work. Every decision, every draft reviewed, and every approval is timestamped and linked to the relevant workflow stage. The audit record is not a separate documentation task. These are design-level outcomes. The pilot verifies them against the client's own data.

Illustrative regulatory context, not legal advice.

**Key emphasis:** Audit readiness is a by-product of doing the work, not an extra task.

**Transition:** One of those four outcomes, control, deserves its own slide because it addresses a specific question your second line will raise.

---

## Slide 10: Control is built into the workflow

**Layout:** flow
**Section:** Control
**Presenting time:** 1.5 minutes

---

Address the control and governance dimension directly. Your second line and your audit function will want to know: does NFR OS create a control gap, or does it close one? The answer is that structured workflows are inherently better controlled than ad hoc processes.

The current fragmented model creates an audit problem. Reconstructing a complete audit record for one RCSA cycle means chasing multiple people for documents created in different systems at different times, with no single version of the decision chain. That gap is inherent to how work is done today, not introduced by NFR OS.

In NFR OS, evidence is captured at the point of work. When a professional completes a workflow stage, they attach or confirm the relevant evidence and the system timestamps that linkage. When an approver signs off, that approval is recorded against the specific output. When a threshold is breached and an escalation is triggered, the system logs it with the timestamp and the triggering data.

The four properties on screen are structural properties of the workflow architecture, not design aspirations. The audit record is a natural output of doing the work. Single-tenant deployment is recommended for the pilot pending multi-tenant isolation testing.

Illustrative regulatory context, not legal advice: this design approach is consistent with evidence and documentation expectations across major operational risk and third-party risk frameworks.

**Key emphasis:** Evidence captured at the point of work, not reconstructed afterward.

**Transition:** That architecture is delivered as a service. The service model shapes how we grow with a client over time.

---

## Slide 11: A service that grows by Role App

**Layout:** service-stack
**Section:** Service
**Presenting time:** 1.5 minutes

---

Introduce the service model clearly before discussing rollout. NFR OS is not a software licence. It is a managed service, and that distinction matters for how the commercial model scales and what the client is actually buying.

The platform tier is fixed: identity, infrastructure, AI model access, security patching, backup. Everything that all role apps run on. The client does not carry the burden of keeping the platform current; that is covered as part of the service.

The function packs are modular. The Operational Risk Pack, the TPRM Pack, and the planned Control Assurance Pack can be enabled independently. A client starting with OR does not pay for TPRM until they are ready to enable it.

The role apps are the growth engine. Each new role app, whether RCSA Cycle Assistant, Third-Party Onboarding, or future apps on the roadmap, is a discrete build that slots into the running platform. Adding a new role app does not disrupt what is already in production.

Managed operations means ongoing monitoring, model performance reviews, new app releases, and user adoption support on a recurring basis. The client buys a service level, not a point-in-time delivery. Note that managed operations at full programme scale is a design; the service has not yet been delivered to a client at programme scale.

**Key emphasis:** A managed service that starts with one pilot process and grows per Role App added.

**Transition:** The rollout logic follows a deliberate sequence: start narrow, prove the case, scale with evidence.

---

## Slide 12: Start narrow. Prove it. Scale.

**Layout:** rollout-steps
**Section:** Rollout
**Presenting time:** 2 minutes

---

Present the rollout as a deliberate risk management choice, not just a commercial arrangement. Starting narrow means the client takes a small, defined bet: one role, one process, a bounded timeline. They see the product working in their environment with their data before committing to broader rollout.

Step one is the pilot. Deploy the platform to the client environment, onboard a cohort of OR professionals, run one full RCSA cycle using the RCSA Cycle Assistant, and collect outcome data throughout. The exit proof at the end of the pilot is one complete RCSA cycle with verified cycle time and evidence quality data.

Step two adds one additional role app based on what the pilot revealed. Where is the pain greatest? Where did user adoption data suggest the strongest fit? The second app is selected based on the client's own pilot evidence, not our recommendation alone. The cohort expands. The commercial structure for the programme phase is agreed at this point.

Step three is programme: full function packs in production, managed operations fully active, quarterly new app releases, and NFR OS as the default operating environment for all enrolled risk functions.

This sequencing reduces client risk, allows us to learn and improve the product against real processes, and creates a natural expansion path where every commitment is based on verified outcomes. Steps two and three have not yet been delivered with a client. Step one is the proposed starting point.

**Key emphasis:** Every expansion decision is based on the client's own evidence, not projections.

**Transition:** The pilot is what we are proposing today. Let me be specific about what it involves.

---

## Slide 13: Proposed next step

**Layout:** next-step
**Section:** NextStep
**Presenting time:** 1.5 minutes

---

Close with a clear and bounded ask. We are not proposing a programme commitment today. We are proposing a pilot on a narrow and defined scope: OR Partner OS with the RCSA Cycle Assistant only, a cohort of three to five OR professionals in one business unit.

The RCSA Cycle Assistant is the right starting point. It is the most complete role app in the product, it runs against a process every client already has, and it produces measurable outputs that make the outcome report credible. The cohort size is small enough to manage the change impact and large enough to generate meaningful data.

At the end of the pilot, the client has a verified outcome report and a clear decision: expand the scope, adjust the approach, or stop. That decision point is the key message. We are offering a structured way to find out whether NFR OS delivers value in their specific environment. If it does, the expansion case is made by their own data, not our projections.

The emphasis line on screen captures the framing to leave with: a decision, not a commitment to scale.

The next decision is not whether to automate NFR. It is which working day we prove first.

End by asking who in the room should be involved in scoping the pilot and who needs to be the sponsor. This is a closing question, not a close. Let them answer.

**Key emphasis:** A decision point at the end of the pilot, not an automatic commitment to scale.

**Transition:** Open discussion and questions. Ready to navigate to any appendix slide or go deeper on any topic raised.

---
