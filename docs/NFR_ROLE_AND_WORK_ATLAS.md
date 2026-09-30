# NFR ROLE AND WORK ATLAS
## NFR WorkOS: Live the NFR Day
### What each NFR function actually does, and which parts of it are common

**Synthetic institution and data. Illustrative regulatory context, not legal advice.**

| Field | Value |
|---|---|
| Document ID | DOC-ROLE-WORK-ATLAS |
| Version | 1.0 |
| Status | Baseline. Authoritative for role scope and lane assignment. |
| Date | 30.09.2026 |
| Depends on | `DOC-SCENARIO-BIBLE` version 1.0. All facts, names and identifiers come from there. |
| Consumers | Engineering (agent scoping, permissions, retrieval corpora), presentation design (hero visualisations), narration |

---

## 0. How to read this document

Sections 1 and 2 define the five work lanes and the ownership principle. Sections 3 to 8 give one complete profile per role. Section 9 is the cross-role matrix. Sections 10 to 13 specify the shared lanes in enough detail to build once and reuse six times. Section 14 justifies, in practitioner terms, why lanes 3 and 4 cannot be built once.

The organising claim of this document: **three of the five lanes are shared infrastructure and two are not.** If that claim holds, NFR WorkOS is one product with six configurations rather than six products. If it does not hold, the product is six products and it will not be economic to build. Section 14 tests the claim rather than asserting it, including the places where it is only partly true.

---

## 1. The five work lanes

| Lane | Full name | Simple label | One-line definition |
|---|---|---|---|
| Lane 1 | Personal Work Orchestration | **Organise** | Turning an unstructured day into a sequenced, owned, deadline-aware set of work |
| Lane 2 | Evidence and Risk Intelligence | **Understand** | Getting the facts, proving where they came from, and noticing what they mean together |
| Lane 3 | Core Risk Practice | **Assess** | The function-specific professional work that the role exists to perform |
| Lane 4 | Human Judgment and Challenge | **Decide** | Materiality, interpretation, challenge, negotiation, acceptance, escalation, accountability |
| Lane 5 | Controlled Execution and Assurance | **Execute** | Writing the outcome into the systems of record with an audit trail, and assuring the follow-through |

### 1.1 Lane 1 Organise

Inbox triage, priorities, calendar, meeting preparation, reminders, routing, follow-up, status coordination, routine drafting.

| In lane 1 | Not in lane 1 |
|---|---|
| Ranking the day's work against deadlines and dependencies | Deciding what a deadline means for risk |
| Preparing a meeting pack from known objects | Forming the professional position that the pack argues |
| Chasing an unanswered request and escalating the chase | Deciding whether the non-response is itself a finding |
| Drafting a status note, a holding reply, a calendar invitation | Drafting a committee decision paper |
| Routing an item to the right owner in the right entity | Deciding the item is material enough to route upward |

Lane 1 is where the largest volume of time goes and the smallest amount of professional judgment sits. That combination is exactly why it is the strongest candidate for automation and the weakest candidate for differentiation.

### 1.2 Lane 2 Understand

Data retrieval, document collection, evidence classification, monitoring, reconciliation, provenance, contradiction detection, process intelligence, trend analysis, policy and regulatory retrieval.

| In lane 2 | Not in lane 2 |
|---|---|
| Retrieving the binding version of a contract appendix | Deciding whether the divergence is material |
| Running the override audit log query and reconciling the counts | Deciding whether 96 unreviewed releases breach a tolerance |
| Detecting that two stakeholder statements contradict each other | Deciding which statement to act on |
| Noticing that `OVR-C` grew 539% and `OVR-D` 124% | Concluding what that means about the team |
| Retrieving the applicable framework references per entity | Interpreting what an obligation requires of Arcadia |
| Marking a fact as `VF`, `SS` or `TI` with the reason the inference could be wrong | Accepting the inference as a basis for action |

Lane 2 is where the product earns credibility. If provenance is weak, everything downstream is worthless. The lane's hardest output is not retrieval, it is **contradiction detection with attribution**, because that is the thing a practitioner cannot do at scale and cannot afford to get wrong.

### 1.3 Lane 3 Assess

Function-specific professional work. Detailed per role in sections 3 to 8. This is the lane where a Third-Party Risk Manager and a Control Assurance Specialist do genuinely different jobs with different method, different output artefacts and different standards of sufficiency.

### 1.4 Lane 4 Decide

Materiality / Wesentlichkeit, interpretation, professional challenge, stakeholder conversations, negotiation, residual risk, Risk Acceptance / Risikoakzeptanz, severity, escalation, accountability.

Lane 4 has one hard property: **it produces no automated actions.** The system may retrieve on demand, show what is known and what is not, model consequences of options, and record the decision afterwards. It does not propose the decision as a default, it does not pre-select, and it does not draft the rationale before the human has formed one. Anything else converts a judgment into a rubber stamp, and a rubber-stamped materiality assessment is worse than no assessment because it carries a signature.

### 1.5 Lane 5 Execute

Approved GRC updates, action creation, notifications, versioning, audit trail, monitoring activation, committee updates, evidence retention, follow-up assurance.

Lane 5 is the lane most banks get wrong in the opposite direction from lane 1: it is heavily manual, high-volume, low-judgment, and yet it is where the audit trail is created, so it is treated as too sensitive to automate. The resolution is not to leave it manual. It is to make every write carry the five mandatory attributes from `DOC-SCENARIO-BIBLE` section 3.2 (system of record, entity partition, record identifier, accountable human, evidence reference) and to reject any write that cannot.

---

## 2. The ownership principle

| Lane | Label | Status | Build once? | Why |
|---|---|---|---|---|
| 1 | Organise | **Shared infrastructure** | Yes, fully | The work objects differ; the orchestration logic does not. A deadline, a dependency, an owner and a chase are the same mechanics for all six roles |
| 2 | Understand | **Shared infrastructure with per-role corpora and taxonomies** | Yes, the engine. No, the corpora | Retrieval, provenance, reconciliation, contradiction detection and trend analysis are one engine. What is retrieved, from where, and under which classification taxonomy is role-specific |
| 3 | Assess | **Function-specific** | No | Different method, different output artefact, different standard of sufficiency. See section 14.1 |
| 4 | Decide | **Function-specific, and deliberately unautomated** | No | Different decision rights, different authority basis, different consequence of being wrong. See section 14.2 |
| 5 | Execute | **Shared infrastructure with per-role target modules and approval routes** | Yes, the engine. No, the routes | A controlled write is a controlled write. The target module, the approval authority and the retention rule are role-specific |

Stated as a ratio for planning: roughly 70% of the engineering effort sits in lanes 1, 2 and 5 and is built once. Roughly 30% sits in lanes 3 and 4 and is built six times, most of it as configuration of method rather than new code. That ratio is a design target for this product, not an observed measurement.

---

## 3. Role: Third-Party Risk Manager

| Field | Value |
|---|---|
| Role slug | `tprm` |
| Scenario person | `P-002` Stefan Brunner |
| Entity | `ARC-DE`, group mandate |
| Location | Frankfurt |
| German function label | Drittparteienrisikomanagement (TPRM) |
| Line | 2LoD |
| Reports to | `P-001` Dr. Katharina Vogt |

### 3.1 Professional mandate

Stefan is accountable for the group's independent view of risk arising from third parties, subprocessors and fourth parties: whether each arrangement is correctly classified, whether the contractual protections match the classification, whether the supplier's actual behaviour matches its contractual and questionnaire assertions, and whether the group could survive the arrangement failing or ending.

He does not own the commercial relationship (that is `P-010` Lukas Wiesinger) and he does not own the service (that is `P-007` Andreas Kellner). His mandate is to hold an independent, evidenced position and to be able to defend it to a committee, an internal auditor and a supervisor. His single hardest structural problem is that almost every fact he needs is held by the party he is assessing.

### 3.2 Primary domain objects

| Object | Scenario instances |
|---|---|
| Third party | `TP-0042` Novalink Payment Services GmbH, Tier 1 |
| Subprocessor / Unterauftragnehmer | `TP-0042.1` Helvetia CloudWorks, `TP-0042.2` Rheinstack, `TP-0042.3` Polaris Telemetrix, `TP-0042.4` Meridian Operations Support |
| Fourth party / Viertpartei | `TP-0042.3-F1` Aurora Object Storage |
| Service | `SVC-0042-01` to `SVC-0042-05`, each with its own classification per entity |
| Contract and appendices | `CTR-2023-0117` and `A1` to `A7` |
| Assessment | `TPRM-Q-2026`, 214 questions, 198 responses, 26 of 41 artefacts accepted |
| Supplier evidence | `EVD-2026-40118`, `EVD-2026-40233` and 31 others |
| Classification | Material outsourcing / wesentliche Auslagerung per EU entity; significant outsourcing per `ARC-CH` |
| Concentration and substitutability | Sole-provider position across validation, repair tooling and Swiss clearing |
| Exit arrangement | `CTR-2023-0117-A6`, untested, `MSN-2026-0177` not started |
| Third-party risk | `RSK-0184`, Medium-High, conditional Risikoakzeptanz |
| Indicator | `KRI-TPR-002` at 94.6%, Red |

### 3.3 Morning priorities in this scenario, as at 07:45 on 06.10.2026

Ranked, with the reason each ranks where it does.

1. **The reassessment is 25 days from its target date with four unresolved resilience questions and eight missing artefacts.** `TPRM-Q-2026-R04`, `-R07`, `-R11`, `-R19`. These are not administrative gaps. `-R11` means the exit plan for a Tier 1 sole provider relies on a capability Arcadia does not hold, which means the plan is unexecutable as written.
2. **`RSK-0184` carries a conditional Risikoakzeptanz expiring 31.12.2026, conditioned on completing the reassessment and performing an exit test.** The exit test (`MSN-2026-0177`) is not started. The acceptance is therefore already operating on an unmet condition and Stefan is the person who knows it.
3. **The appendix divergence.** `CTR-2023-0117-A3` v4.2 lists three subprocessors; the supplier's current register lists four. `TP-0042.4` Meridian in Pune holds read access to payment metadata and there is no notice on record. Fourth parties are not addressed at all. `MSN-2026-0191` is 40% complete with a 13.11.2026 date.
4. **`KRI-TPR-002` is Red at 94.6%** and the shortfall is concentrated in exactly the records where subcontracting chains are incomplete, which is the same problem as item 3 counted differently.
5. **A committee paper for `AG-CMT-NFR-2026-10-04` is due 08.10.2026 at 12:00** and is not drafted.
6. **Two things sitting in the vault that nobody has escalated.** `EVD-2026-40118`, received 22.05.2026, shows an RTO of 3 hours 40 minutes against a contracted 2 hours. It has been unescalated for 137 days. And NOVA-GATE's September availability was 99.62% against a contracted 99.7%, which is a service-level miss the supplier has not reported and which Arcadia can only find by calculating it.

Item 6 is the one that a human working through an inbox never reaches, and it is the item that most changes the professional picture. A supplier with an unreported RTO gap, an unreported SLA miss, five fallback activations in one month and an unnotified subprocessor is not a supplier with four separate issues. It is a supplier whose disclosure discipline has degraded.

### 3.4 Lane 3: core risk practice for this role

The function-specific professional work. Six methods, each with its own output artefact and standard of sufficiency.

| Method | What it produces | Standard of sufficiency |
|---|---|---|
| **Classification** of each service per entity, against the applicable framework | A per-service, per-entity classification with a documented basis | The basis must survive a supervisor asking "why is `SVC-0042-03` not classified as supporting a critical or important function, given that a format library failure stops bulk files?" |
| **Contractual sufficiency assessment**: does the contract contain the protections the classification requires | A clause-by-clause coverage map with gaps named | Gaps must be stated as either a drafting gap, a breach, or a dispute. Conflating the three is the most common professional error in this role |
| **Evidence adequacy assessment**: is what the supplier gave sufficient to answer the question asked | Per-artefact accept, reject, or accept-with-limitation, with the limitation stated | A two-page penetration test summary whose scope statement does not confirm the override APIs were in scope is not evidence that the override APIs are secure. It is evidence that Arcadia cannot tell |
| **Assertion testing**: does observed supplier behaviour match what the supplier asserted | A list of assertion-versus-observation pairs with the delta | The 2-hour RTO assertion versus the 3 hour 40 minute tested outcome is one pair. The "we notify within 30 minutes with six fields" assertion versus a 34-minute lag and one field is another |
| **Concentration, substitutability and exit assessment** | A dependency map with a substitution path, a lead time and a tested-or-untested flag on each path | An exit plan that assumes a capability the bank does not hold is not an exit plan. Substitutability asserted without a test is an opinion |
| **Chain assessment**: subprocessors and fourth parties, jurisdiction, data access, notice status | A chain register per service with notice status and data-access scope per node | A fourth party holding payment metadata for 24 months must appear even though the appendix does not require it to be notified, because the risk does not care what the appendix says |

### 3.5 Decisions that must remain human-owned

| Decision | Why it cannot be automated |
|---|---|
| Whether the appendix divergence is a breach, a drafting gap or a commercial dispute | The same facts support all three characterisations. The choice determines whether the next step is a legal notice, a variation request or a conversation, and it commits Arcadia's negotiating position. Getting it wrong is expensive in both directions: an unjustified breach notice damages a Tier 1 relationship; an unasserted breach forfeits a right |
| Whether an evidence artefact is sufficient | Sufficiency is a judgment about what the artefact would need to show to answer the question, which requires knowing what question the assessor is actually trying to answer. A system can identify that a scope statement is silent. It cannot decide whether silence is acceptable |
| Whether the concentration position is tolerable | This is a risk appetite judgment about a structural dependency with a 12 to 18 month substitution horizon and a 12-month notice period. It is a statement about what Arcadia is willing to live with, not a calculation |
| What to say to the supplier, when, and in what tone | Negotiation. The relationship has 23 months to run on its initial term and a 12-month notice period, which means Arcadia cannot walk away and Novalink knows it. Sequencing and tone are professional instruments |
| Whether to recommend that a conditional Risikoakzeptanz be withdrawn because its condition is unmet | Withdrawing an acceptance places a Medium-High risk outside appetite with no cover, which forces an executive decision. Recommending it is a judgment about whether the condition's purpose has been defeated, not whether a checkbox is ticked |

### 3.6 Hero visualisation: Supplier Dependency and Chain Graph

| Aspect | Specification |
|---|---|
| **Form** | Concentric force-directed graph. `TP-0042` Novalink at the centre. |
| **Ring 1, inward** | The three Arcadia entities, `ARC-DE`, `ARC-AT`, `ARC-CH`, connected to the centre by one edge per service. Five services means up to five edges per entity |
| **Edge encoding** | Edge thickness = annual spend attributable. Edge style: solid for a classified critical or important dependency, dashed for a non-critical one. Edge colour = evidence freshness of the assurance covering that service: current, ageing, stale, absent |
| **Ring 2, outward** | The four subprocessors, each connected to the services they support. Node label carries the jurisdiction |
| **Ring 3, outward** | Fourth parties. `TP-0042.3-F1` Aurora sits here, visually thinner and further out, which is the point: it is real, it holds payment metadata for 24 months, and the contract does not see it |
| **Node badge, the key affordance** | Each subprocessor and fourth-party node carries a two-state badge: **in the binding appendix** versus **in the supplier's current register**. Divergence renders as a split node with the two states side by side. `TP-0042.4` Meridian shows as present-in-register, absent-from-appendix. `TP-0042.2` Rheinstack shows as present-in-both with a region mismatch |
| **Overlay: data access** | A toggle that shades every node with access to payment data, including metadata. Turning it on puts Pune and Dublin in scope and makes the third-country and cross-border question visible in one action |
| **Overlay: assertion versus observation** | A toggle that replaces evidence-freshness colouring with assertion deltas: 2 hours RTO asserted against 3 hours 40 minutes observed; 99.7% availability contracted against 99.62% actual; 30-minute notification contracted against 34-minute lag |
| **During the 14:05 event** | The graph animates the failure path rather than re-rendering. The `TP-0042.2` Frankfurt region node goes to a failed state at 13:31. The Amsterdam region node, which is drawn as a divergence badge and not as a contracted node, lights up as the node carrying the traffic. `TP-0042.3` Polaris shows detection-degraded from 13:31 to 14:57. The visual argument makes itself: the node that saved the service is not in the contract, and the node that should have detected the failure was inside it |
| **What it must never do** | Aggregate the three entities into one column, or apply an EU framework label to the `ARC-CH` edges |

### 3.7 The 14:05 event through this lens

**What Stefan sees.** Not an incident. A supplier assertion failing in real time, with four of his open reassessment questions turning from paperwork into evidence inside two hours.

- `ARR-…-01` at 14:05 is a contractual notification failure before it is an incident: five of six mandatory fields under `CTR-2023-0117-A5` clause 5.3 are missing, and the one substantive claim it makes ("no customer impact") is contradicted within two minutes by `ARR-…-02`.
- `ARR-…-08` at 14:55 is the moment the appendix divergence stops being a documentation matter. The supplier names the Amsterdam region as the thing keeping the service alive. That region is not in the binding appendix. Arcadia's resilience depended, at 13:44, on a node it had not contractually acknowledged.
- `ARR-…-12` at 15:38 is the answer to a question he had not thought to ask: a supplier's standard configuration template silently removed a client control gate during a release, and Arcadia's own change approval let it through.
- `ARR-…-14` at 15:51 is the most serious finding of his day and it has nothing to do with the database. Novalink's ability to detect its own incidents depends on a single subprocessor in Brno whose monitoring was pinned to the failed region. That is a single point of failure in the supplier's detection capability, which means every notification commitment in `CTR-2023-0117-A5` rests on one node that has now demonstrably failed.

**The different question this role asks.** Every other role asks a version of "what happened and what do we do". Stefan asks: **"Was the thing that saved us even in the contract, and was the thing that failed supposed to be able to fail?"**

Stated more precisely, his three questions at 16:30 are:

1. Which of today's facts are assurance failures rather than service failures? (Answer: the notification gap, the unreported change window, the detection single point of failure, the release-note non-disclosure.)
2. Which contractual right does Arcadia have that it has not exercised, and which right does it not have that today shows it needs? (Has and has not exercised: `A4` clause 2.1 configuration extracts, which produced the day's decisive evidence in under four hours and had never been used before. Does not have: any fourth-party provision, and any subprocessor change-window notification that binds below Novalink.)
3. Does this change the concentration position, or does it only change the evidence for a position he already held? (Honest answer: the latter. He rated this Tier 1, sole-provider, untested-exit before today. Today he can evidence it.)

---

## 4. Role: Operational Risk Partner

| Field | Value |
|---|---|
| Role slug | `rcsa` |
| Scenario person | `P-003` Marlene Aigner |
| Entity | `ARC-DE` |
| Location | Frankfurt, with standing presence in Munich |
| Coverage | Operational Risk, Payments and Transaction Banking |
| Line | 2LoD |
| Reports to | `P-001` Dr. Katharina Vogt |

### 4.1 Professional mandate

Marlene is the second-line business partner for payments. She owns the framework for how risk is identified, assessed and rated in her coverage area, she facilitates the RCSA, and she holds an independent position on residual risk and on whether the business is operating inside appetite. She does not own the risks; `P-007` does. She owns the quality and independence of the assessment of them.

The defining tension of this role: she must be close enough to the business to be credible and independent enough to disagree with it in writing. On 06.10.2026 she has to do both before lunch.

### 4.2 Primary domain objects

| Object | Scenario instances |
|---|---|
| Risk | `RSK-0211` Erroneous or unauthorised payment release; `RSK-0184` and nine others in scope |
| RCSA | `RCSA-ARC-DE-PAYOPS-2026-Q4`, workshop 06.10.2026 10:30 |
| Process | `PRC-0041` Payment repair and manual override |
| Control environment | `CTL-PAY-014` preventive; `CTL-PAY-021` and `CTL-PAY-029` claimed as compensating |
| Indicator | `KRI-PAY-007` Red 3.84; `KRI-PAY-003` Red 2.70%; `KRI-PAY-011` Red 75.0% |
| Appetite | Payment execution risks: residual 10 or above is outside appetite |
| Risk Acceptance / Risikoakzeptanz | `RSK-0184` conditional acceptance dated 19.01.2026 |
| Remediation Action / Massnahme | `MSN-2026-0147` overdue 67 days; `MSN-2026-0166` overdue 6 days |
| Loss and near-miss data | Zero recorded losses on `RSK-0211` in 24 months, which is the 1LoD's strongest argument and her weakest counter |
| Decision record | `DEC-2026-0771`, `DEC-2026-0772` |

### 4.3 Morning priorities in this scenario, as at 07:45 on 06.10.2026

1. **The workshop is in 2 hours 45 minutes and the central rating is contested.** Her pre-read proposes Medium-High (12 of 25, outside appetite). The 1LoD position is Medium (9 of 25, within appetite). The gap is not numerical; it is the difference between "monitor" and "the accountable executive must commit to dates or sign a Risikoakzeptanz".
2. **`KRI-PAY-007` breached Red for the first time in 14 months** and the escalation rule requires a written 1LoD explanation by 12.10.2026 plus a committee item.
3. **The component analysis nobody has done.** `OVR-C` rose from 31 to 198 (more than sixfold), `OVR-D` from 94 to 211 (+124%), while `OVR-A`, `OVR-B` and `OVR-E` are broadly flat. Two pressure indicators moved and three error indicators did not. That is a different diagnosis from "overrides went up".
4. **Three Red indicators sit with three different owners and are one issue.** Route unavailability drove `OVR-C`; cut-off pressure drove `OVR-D`; reviewer capacity is at 75%. A team is releasing more payments under more time pressure with fewer reviewers, and the control that governs the releases is contested.
5. **A structural decision she must take before 10:30**: request three separate 1LoD explanations for three Red indicators, or request one causal investigation. The first is procedurally correct and analytically useless. She takes the second at 09:58 as `DEC-2026-0771`.
6. **Ten other risks in the RCSA that must not be crowded out** by the one contested rating. A workshop that spends 90 minutes on `RSK-0211` and nods through ten others has produced a worse assessment, not a better one.

### 4.4 Lane 3: core risk practice for this role

| Method | What it produces | Standard of sufficiency |
|---|---|---|
| **Risk identification and articulation** | A risk statement with a cause, an event and an effect, at a level that can actually be assessed | "Payment risk" cannot be assessed. "Erroneous or unauthorised payment release" can. The test is whether a control can be mapped to it and an indicator can move with it |
| **Inherent and residual assessment** | Impact and likelihood scores with the reasoning for the delta between inherent and residual stated explicitly | The residual score must be derivable from the inherent score and the control environment rating. A residual score that does not move when a control rating moves is not an assessment, it is a number |
| **Control environment rating** | A judgment on whether the controls mapped to the risk, taken together, reduce it, and by how much | Requires distinguishing preventive from detective, and per-occurrence from sampled. `CTL-PAY-021` at a 10% next-day sample cannot substitute for a preventive per-occurrence gate, and saying so is the core professional act |
| **Appetite positioning** | A statement of whether residual risk is inside or outside appetite, and what consequence follows | The consequence must be named: monitoring, a remediation plan with dates, or a Risikoakzeptanz with an approver. "Outside appetite" with no named consequence is decoration |
| **Indicator design and interpretation** | Indicators that move before the risk materialises, read by component rather than by headline | `KRI-PAY-007` read as a headline says volume rose. Read by component it says route availability collapsed and cut-off pressure doubled. Same data, different finding |
| **Workshop facilitation and challenge** | An assessment the business owns, with any 2LoD dissent recorded rather than absorbed | The output is not agreement. It is either agreement or a documented, specific disagreement with both positions stated. A workshop that produces agreement by dilution has failed |
| **Loss and near-miss integration** | The evidential weight properly assigned to the absence of losses | Zero losses over 24 months on a risk whose only preventive control is Partially Effective is evidence about detection, not about likelihood. This is the single most contested inferential step in the role |

### 4.5 Decisions that must remain human-owned

| Decision | Why it cannot be automated |
|---|---|
| The residual risk rating | It is a professional opinion about a future that has not happened, formed from incomplete control evidence and contested loss data. A system that proposes 12 of 25 is proposing the outcome of a negotiation before the negotiation has occurred |
| The control environment rating | It requires weighing a Partially Effective preventive control against two compensating controls that mitigate different things (value, not authorisation). The weighing is the judgment |
| Whether to record a formal 2LoD dissent | Dissent has a cost: it escalates, it strains the relationship with `P-007` and `P-008`, and it commits her to defending a position at committee. Choosing to pay that cost is a professional decision about whether the issue is worth the capital |
| What "no losses in 24 months" means | This is an inference about whether the absence of evidence is evidence of absence. It is exactly the kind of reasoning that must be visibly human, because a system's answer would carry unearned authority |
| Whether to accept the 1LoD compensating control argument | Requires deciding whether a detective 10% next-day sample can substitute for a preventive per-occurrence gate. The answer is no, but it is an argued no, and the argument matters more than the conclusion |
| How to run the workshop | Whether to open with the contested risk or close with it, whether to let `P-008` state her position first, whether to bring the component analysis into the room or hold it. Facilitation is a professional instrument |

### 4.6 Hero visualisation: Risk and Control Heat Grid with residual movement trail

| Aspect | Specification |
|---|---|
| **Form** | A 5 by 5 impact-by-likelihood grid, the standard practitioner object, made useful by three additions |
| **Addition 1: the appetite boundary** | A drawn line across the grid at residual score 10 for payment execution risks. Not a colour band. A line, with the policy sentence attached to it. It makes "outside appetite" a position on a picture rather than a word in a paragraph |
| **Addition 2: the movement trail** | Each risk renders as a node at its current residual position with a trail showing its prior two assessments. `RSK-0211` shows Q3 at 6, the 1LoD Q4 proposal at 9, and the 2LoD Q4 proposal at 12. Three positions, one trail, crossing the appetite line between the second and third |
| **Addition 3: the driver on the segment** | Each trail segment carries its driver, not a label but the object: the 6-to-9 segment carries "`KRI-PAY-011` reviewer capacity 75%"; the 9-to-12 segment carries "`TST-2026-0318` control environment Partially Effective". Clicking a segment opens the evidence |
| **Dual-position rendering, the key affordance** | Where 1LoD and 2LoD disagree, the risk renders as **two nodes joined by a bracket**, each labelled with its owner and its reasoning, with the appetite line running between them. This is the honest picture of 06.10.2026 at 12:00 and the product must be able to draw it. Most GRC tools cannot, which is why disagreements get resolved by dilution |
| **Inherent-to-residual vector** | A faint arrow from the inherent position (12) to the residual position, per risk. For `RSK-0211` the 1LoD arrow is long (12 to 9 via a control environment rated Effective) and the 2LoD arrow is zero-length (12 to 12). The vector length *is* the claimed control effectiveness, drawn |
| **During the 14:05 event** | The grid does not jump. At 16:19, when `ARR-…-17` confirms one erroneous release, the `RSK-0211` node gains a **materialisation marker**: the risk is no longer only assessed, it has occurred once, with a value and a recall reference. The marker is deliberately small. One confirmed error in a 21% sample does not justify a dramatic re-rating, and the visualisation must not overstate it |
| **What it must never do** | Collapse the two positions into an average, or auto-move the node when new evidence arrives. Evidence changes the argument; a human changes the rating |

### 4.7 The 14:05 event through this lens

**What Marlene sees.** The risk she spent the morning arguing about, doing exactly what she said it would do, four hours later, with the mechanism she had not identified.

Her morning position was that `RSK-0211` residual is 12 of 25 because `CTL-PAY-014` is the only preventive control and it is Partially Effective. She was right about the conclusion and wrong about the reason. She believed the control was weakened by capacity and discipline (75% reviewer FTE, three human deviations). She did not know that the control switches itself off when the fallback route is active. That mechanism makes her rating more correct and her reasoning less correct, and a good practitioner says so.

Second and more uncomfortable: the morning's component analysis, `OVR-C` up more than sixfold because the primary route failed five times in September, was itself the leading indicator of this event. Every September fallback activation was a rehearsal for 06.10.2026, and each one silently waived the control for its duration, 22 times in total. She had the signal. She read it as a capacity story.

**The different question this role asks.** Others ask what happened. Marlene asks: **"Is this a new risk, or is this the risk I already have finally showing its likelihood, and was my assessment wrong in a way that matters?"**

Her honest answer at 16:30 has four parts.

1. Not a new risk. `RSK-0211` as written covers this exactly.
2. Not a new likelihood either, strictly. The mechanism has existed since 11.11.2024 and fired 22 times before today. The likelihood was always higher than assessed; Arcadia just had not observed it.
3. Her rating of 12 stands, but the reasoning in her pre-read needs rewriting before the paper goes to committee. Defending a correct number with a wrong argument is how 2LoD loses credibility.
4. The appetite consequence has changed character. This morning, "outside appetite" meant `P-007` must commit to dates or sign a Risikoakzeptanz. After 16:19, with one confirmed erroneous release, a Risikoakzeptanz on this risk is not realistically signable. The option set narrowed, and it narrowed because of a fact, not because of an argument.

---

## 5. Role: Control Assurance Specialist

| Field | Value |
|---|---|
| Role slug | `control-assurance` |
| Scenario person | `P-004` Jakob Steinbacher |
| Entity | `ARC-AT`, seconded to group |
| Location | Vienna |
| Function | Group Control Assurance, Internal Control System / Internes Kontrollsystem (IKS) testing |
| Line | 2LoD |
| Reports to | `P-001` Dr. Katharina Vogt |

### 5.1 Professional mandate

Jakob forms and defends an independent conclusion on whether controls in the Internal Control System / Internes Kontrollsystem (IKS) are designed appropriately and operating as designed. His output is a conclusion with a defined population, a defined method, evidence, and a stated limitation. He does not fix controls and he does not own risks. He states, with method, what is true about a control, and he is the person whose work is re-performed by Internal Audit and by external audit.

The defining discipline of this role: **the difference between "the control failed" and "I could not determine whether the control operated" is not a technicality.** Two of his six flagged items on `TST-2026-0318` are the second kind, and how he handles them is the professional measure of the role.

### 5.2 Primary domain objects

| Object | Scenario instances |
|---|---|
| Control | `CTL-PAY-014`, key control in the IKS; `CTL-PAY-021`, `CTL-PAY-029` as claimed compensating controls |
| Control description | Version 4.1, dated 14.01.2025, states "without exception" |
| Test | `TST-2026-0318`, population 1,204, sample 60, tolerable deviation 5% |
| Test attributes | Five: existence, independence, sequence, evidence, reason-code consistency |
| Exception / Feststellung | `EXC-TST-2026-0318-01` to `-04` |
| Unable to conclude | `UTC-TST-2026-0318-01` and `-02` |
| Root cause classification | Design versus operating, per deviation |
| System dependency | `SYS-0014` RepairDesk; rule `RD-RULE-0031` |
| Evidence | `EVD-2026-41905` to `-41908`, `EVD-2026-41924` |
| Conclusion | Control Effectiveness / Kontrollwirksamkeit: Partially Effective |
| Counter-position | `P-008`'s Fully Effective / Voll wirksam, recorded 29.09.2026 |
| Massnahme | `MSN-2026-0203`, not started; `MSN-2026-0214`, `MSN-2026-0220` raised today |

### 5.3 Morning priorities in this scenario, as at 07:45 on 06.10.2026

1. **The control owner still disagrees with his conclusion, in writing, and the RCSA workshop is at 10:30.** `P-008`'s Fully Effective position was recorded 29.09.2026. `P-003` cannot settle a control environment rating while the control rating itself is contested. His disagreement is blocking someone else's work.
2. **`UTC-TST-2026-0318-01` is the item that should worry him most and has the lowest profile.** The reviewer identity is a Novalink service account, `svc_repairbatch`; the human identity was held in a 30-day log that had expired before the question was asked. That is a permanent, unrecoverable audit trail defect in a key control in the IKS, and it affects a bulk approval screen used routinely rather than exceptionally.
3. **`UTC-TST-2026-0318-02`**, Novalink has committed to restore the moved evidence object by 10.10.2026. Two business days of float.
4. **The item he is least comfortable with is his own.** He recorded the root cause of `EXC-TST-2026-0318-04` as "system configuration", raised `MSN-2026-0203` as a low-priority documentation action, and moved on. He had the rule in his hands on 24.09.2026 and did not pull the thread. No one has noticed yet. He has.
5. **The Q4 test plan has 14 other controls** and the payments dispute is consuming his week.
6. **`AG-CMT-NFR-2026-10-03`**, a joint paper with `P-003`, due 08.10.2026 at 12:00, arguing a conclusion the control owner disputes.

Priority 4 is the one the product should surface and most tools never would, because it requires reading a root-cause field as a claim rather than as metadata.

### 5.4 Lane 3: core risk practice for this role

| Method | What it produces | Standard of sufficiency |
|---|---|---|
| **Population definition** | A defined, complete, reconcilable population with its source and completeness basis | 1,204 overrides must reconcile to the system of record. A population that cannot be reconciled invalidates every conclusion drawn from it, whatever the sample showed |
| **Design effectiveness assessment** | A conclusion on whether the control, as designed, would prevent or detect the risk if it operated perfectly | This is the method that finds `RD-RULE-0031`, and it is the method that failed on 24.09.2026. Design testing means comparing the documented control to the implemented control, including the configuration, not reading the description and agreeing with it |
| **Sampling and attribute testing** | A sample with a method, a size, a tolerable deviation rate, and an attribute set that maps to the control objective | A 60-item random sample from 1,204 is defensible. The same sample not stratified by value or by override reason code is a known limitation and must be stated, not discovered later by someone else |
| **Deviation and non-conclusion classification** | Each flagged item classified as a deviation with a type, or as unable to conclude with the reason | Collapsing "unable to conclude" into either "pass" or "fail" is the single most damaging shortcut in this role. Treating the two unresolvable items as passes gives 6.67%; as failures gives 10.00%; honestly reported, the answer is that the true rate is unknown and bounded |
| **Root cause classification** | Design or operating, with the accountable owner of the cause, per deviation | This is where the value is and where the failure was. "System configuration" is a category, not a cause. The cause is a supplier template applied in a release that Arcadia approved without control review |
| **Conclusion and limitation statement** | A conclusion, with what it does and does not cover | The conclusion covered 01.06.2026 to 31.08.2026. `RD-RULE-0031` had fired 22 times before that period began, invisible to the test because the population was time-bounded rather than condition-bounded. Saying so is the limitation |
| **Re-performance and follow-up** | Whether a remediated control now operates, tested independently | `MSN-2026-0147` has been open 67 days past its revised date and the failure it prevents occurred 17 days before that date. Follow-up assurance is not chasing a percentage; it is testing whether the risk is still live |

### 5.5 Decisions that must remain human-owned

| Decision | Why it cannot be automated |
|---|---|
| The control effectiveness conclusion | It is an opinion supported by method, and it must be defensible under re-performance by a third line and an external auditor. Delegating it removes the thing that makes it worth anything, which is that a named professional will defend it |
| Design deficiency versus operating deficiency | This distinction determines who owns the fix, whether the control can be relied upon in the interim, and whether the 1LoD's position is reasonable. `P-008` is right that the 96 event cases are a design matter and wrong to extend that to `EXC-…-01` to `-03`. Drawing that line precisely is the professional act of 06.10.2026 |
| Whether a deviation is isolated or systemic | One self-review in a 60-item sample could be an individual lapse or a systemic access-design failure. The answer depends on whether `MSN-2026-0147` exists, and it does, which makes it systemic and known. That reasoning cannot be automated because it requires knowing the history of the remediation |
| How to handle an item that cannot be concluded | Whether to report it as a limitation, escalate it as an audit trail defect, or extend the sample. For `UTC-…-01` the evidence is permanently gone, which makes it a finding about the system rather than about the period |
| Whether to reopen his own prior conclusion | At 15:38 Jakob learns that his 24.09.2026 root-cause classification was inadequate. Whether to say so in writing, before the committee paper, is a professional integrity decision. The product can surface the link; only he can decide to write it down |
| Whether the population was right | The test was time-bounded. `RD-RULE-0031` is condition-bounded. Deciding to re-run with a condition-bounded population (`MSN-2026-0220`, all 118 firings since 11.11.2024) is a method judgment |

### 5.6 Hero visualisation: Control Evidence Chain and Test Population Waterfall

| Aspect | Specification |
|---|---|
| **Form** | A left-to-right waterfall from population to conclusion, with a design-versus-operating split panel beneath it |
| **Stage 1, population** | 1,204 overrides, with the source system, the extraction date and the reconciliation status shown as a property of the bar, not a footnote. A population that does not reconcile renders with a hatched edge |
| **Stage 2, sample** | 60 items, with the method (attribute sampling, random, seeded), the tolerable deviation rate (5%) and the expected rate (0%) attached. The *unsampled* 1,144 remain visible as a ghosted band, because the thing a test does not look at is a property of the test |
| **Stage 3, attribute grid** | 60 rows by 5 attribute columns (existence, independence, sequence, evidence, reason-code consistency). 300 cells. 296 pass, 4 fail, and 2 rows carry a distinct third state |
| **The third state, the key affordance** | "Unable to conclude" renders as its own visual state, neither pass nor fail. Two rows in this state. Hovering shows why, and shows the two resulting deviation rates side by side: 6.67% treating them as passes, 10.00% treating them as failures, with the tolerable rate at 5% drawn across both. The honest reading is that the rate is somewhere in a range and the range straddles the threshold |
| **Stage 4, root cause split** | A horizontal split bar: design deficiencies left, operating deficiencies right, shared-accountability items rendered as straddling the divide with a supplier badge. On 06.10.2026 at 07:45 this bar shows 1 design, 3 operating, 2 undetermined. At 16:41 it shows 1 design plus 96 event cases as design, 3 operating, 1 design at the supplier, 1 operating at the supplier |
| **Stage 5, evidence chain** | For any selected row, the full chain: the override record, the rule evaluation trace, the evidence object (or its absence), the reviewer identity (or the service account), and the retrieval timestamp. Broken links in the chain render as breaks, not as blanks. `UTC-…-02`'s moved object renders as a visible break with a date |
| **During the 14:05 event** | A second population appears beside the first: 138 overrides created between 14:12:41 and 14:26:00, of which 96 with `secondaryReviewRequired = false`. It is drawn as a **100% examination**, not a sample, which is visually the opposite shape of the first waterfall and makes the point that the event permits what the test could not afford. At 16:19 the 20-of-96 validation sample appears as a third, narrow waterfall with 19 pass and 1 fail, and its own stated limitation (unstratified, 21%) |
| **What it must never do** | Show a single deviation rate. Show "unable to conclude" as a pass. Hide the unsampled remainder |

### 5.7 The 14:05 event through this lens

**What Jakob sees.** His own test, re-running itself at 100% coverage in front of him, and answering a question he had closed.

`ARR-…-05` at 14:34 is `EXC-TST-2026-0318-04` again, 96 times, with a value. `ARR-…-12` at 15:38 gives him the root cause he had labelled "system configuration" on 24.09.2026: a Novalink standard template, applied in release 8.3 on 11.11.2024, through an Arcadia change approval (`CHG-2024-5512`) that no control owner reviewed, against a control description that says "without exception" and has not been updated since 14.01.2025.

Three professional consequences land on him at once.

1. **His conclusion was right and under-argued.** Partially Effective was correct. But his design testing had not compared the documented control to the implemented configuration, which is the whole point of design testing. He read the description and tested the operation.
2. **His population was the wrong shape.** He bounded it by time (01.06.2026 to 31.08.2026). The rule is bounded by condition (`fallbackRouteMode = ACTIVE`). A condition-bounded population would have caught all 22 prior firings and the story would have been visible in September. This becomes `MSN-2026-0220`.
3. **`P-008` is partly right and he has to say so publicly.** Her team did not bypass anything. For the 96 cases and for `EXC-…-04`, the deficiency is design, shared with the supplier. For `EXC-…-01`, `-02` and `-03` it is operating and it is hers. Conceding the first while holding the second is the outcome recorded at 16:41 in `DEC-2026-0783`, and it is a better outcome than winning.

**The different question this role asks.** Others ask what happened. Jakob asks: **"Did my test have the coverage to have found this, and if not, what else does my method not see?"**

That question generalises beyond the day, which is why it is the most valuable one anyone asks on 06.10.2026. If a time-bounded population misses a condition-bounded control waiver here, the same blind spot exists in every other control in the IKS whose enforcement is conditional on a system state. That is a testable hypothesis about the whole control inventory, and it came out of one incident.

---

## 6. Role: Incident and Resilience Lead

| Field | Value |
|---|---|
| Role slug | `incident-resilience` |
| Scenario person | `P-005` Nadia Lehmann |
| Entity | `ARC-CH`, with a group mandate for operational resilience |
| Location | Zurich |
| Function | Group Operational Resilience and Business Continuity Management / Betriebskontinuitaetsmanagement (BCM) |
| Line | 2LoD, with incident management authority during an event |
| Reports to | `P-001` Dr. Katharina Vogt |

### 6.1 Professional mandate

Nadia is accountable for the group's ability to remain within its impact tolerances for important business services when things fail, and for the management of incidents when they do. She owns the definition and testing of impact tolerances, the identification of the dependencies that support each important business service, the severity and escalation framework, and the incident record. During an event she holds incident management authority, which is the only lane-4 authority in this document that is exercised under time pressure by design.

Her structural problem: she operates one framework across three entities under two different regulatory contexts, and she sits in the entity that has the least fallback capability and the tightest cut-off.

### 6.2 Primary domain objects

| Object | Scenario instances |
|---|---|
| Important business service | `IBS-0004` Corporate Payments |
| Impact tolerance / Toleranzschwelle | `ITOL-0004-01` 4 hours EU; `ITOL-0004-02` 0.5% of value group; `ITOL-0004-03` 2 hours and a 16:00 cut-off, `ARC-CH`; `ITOL-0004-04` zero control-gate failures |
| Dependency map | `SYS-0011` to `SYS-0017`, `TP-0042` and its chain, people and premises |
| Fallback arrangement | `RB-PAY-007` EU route substitution; `RB-PAY-011` `ARC-CH` manual correspondent submission, 45-minute lead time |
| Incident | `INC-2026-0412`, `S3` at 14:29, `S2` at 14:52, `S1` at 15:14 |
| Severity framework | `S1` to `S4` |
| Classification assessment | `DEC-2026-0774` for `ARC-DE` and `ARC-AT`; `DEC-2026-0775` for `ARC-CH`. Two frameworks, two records |
| Indicator | `KRI-RES-005` at 78%, Red |
| Scenario testing | Last `IBS-0004` severe-but-plausible test 18.11.2025; no test of the fallback path itself |
| Massnahme | `MSN-2026-0177` exit test not started; `MSN-2026-0219` raised today |

### 6.3 Morning priorities in this scenario, as at 07:45 on 06.10.2026

1. **`KRI-RES-005` says 78% of important business services have tested fallback arrangements**, and `IBS-0004` is one of the untested ones. Arcadia has a documented fallback (`RB-PAY-007`) that has been *used* five times in September and *tested* never. Use is not a test, because use produces no controlled observation.
2. **`ARC-CH` has no fallback for `SVC-0042-05` and no DR evidence for the RepairDesk Swiss instance.** `TPRM-Q-2026-R04` is open, `MSN-2026-0188` is 25% complete, and the Swiss instance sits at `TP-0042.1` Helvetia CloudWorks. Her own entity has the weakest position and she knows it at 07:45.
3. **`AG-CMT-NFR-2026-10-08` is an impact tolerance review** and she has not yet read `ITOL-0004-03` as a definition problem. She reads it as a threshold. She discovers the two-measure defect at 16:04, and the product should not pretend she knew earlier.
4. **`RB-PAY-007` section 4 asserts "the control environment is unchanged during fallback operation".** She has never tested that assertion against the control inventory. Nobody has. It is wrong, and it is wrong in writing, which makes it a finding rather than an omission.
5. **Five fallback activations in September totalling 8 hours 40 minutes, against one activation of 1 hour in August.** This is a resilience signal that reached her as a payments operations statistic and not as a dependency-degradation warning. Nobody escalated it.
6. **`MSN-2026-0177`, the exit test for RepairDesk, is not started** and it is a condition of the `RSK-0184` Risikoakzeptanz. Her framework's credibility depends on conditions of acceptances being met, and this one is not.

### 6.4 Lane 3: core risk practice for this role

| Method | What it produces | Standard of sufficiency |
|---|---|---|
| **Important business service identification and mapping** | A service definition with its end-to-end dependency chain: systems, third parties, subprocessors, people, premises, data | The map must reach the node that actually fails. A map that stops at `TP-0042` would never have shown that a Brno monitoring subprocessor could delay a notification by 34 minutes |
| **Impact tolerance setting** | A tolerance with a metric, a threshold, a measurement method and a single stated precedence where more than one measure exists | This is the method that failed. `ITOL-0004-03` has two measures and no precedence, which means the entity cannot answer its own question on 06.10.2026. A tolerance that cannot be evaluated is not a tolerance |
| **Scenario testing, severe but plausible** | A tested statement of whether the service stays within tolerance under a defined scenario, with the fallback path exercised under observation | Five real activations produced no measured recovery time, no observed control effect and no validated lead time. Use without observation yields no assurance |
| **Fallback and substitution design** | A documented path with an activation authority, a lead time, and an explicit statement of what changes when it is active | `RB-PAY-007` fails this standard on the third element and asserts the opposite. `RB-PAY-011`'s 45-minute lead time is the one number in the day that proves accurate under pressure |
| **Severity assessment and escalation** | A severity with criteria applied to observed facts, and the escalation it triggers | The `S1` at 15:14 is triggered by two independent criteria (tolerance proximity and a zero-tolerance condition with candidate breaches), and both must be recorded, because if one is later disproved the escalation still stands on the other |
| **Incident management** | A single factual record, per entity where consequences differ, with fact classes preserved | One incident, three entities, two regulatory contexts, two classification records. Merging them would be simpler and would be wrong |
| **Per-entity classification and reporting assessment** | A documented assessment per entity against its own framework, with its conclusion and its provisional status | Illustrative regulatory context, not legal advice. `DEC-2026-0774` and `DEC-2026-0775` are separate records with separate criteria and separate conclusions, and neither is final |
| **Lessons and tolerance feedback** | Changes to tolerances, maps, runbooks and tests derived from the event | The most valuable output of 06.10.2026 is `MSN-2026-0219`, a tolerance definition fix, which came from noticing an ambiguity rather than from managing an incident |

### 6.5 Decisions that must remain human-owned

| Decision | Why it cannot be automated |
|---|---|
| Severity, and when to upgrade it | Severity sets who is woken, which authorities are notified and what the bank commits to. At 15:14 the `S1` rests on a tolerance proximity that depends on an unresolved definition. A human can escalate on an unresolved definition and say so; a rule engine either fires or does not |
| Whether a tolerance has been breached | On 06.10.2026 this is genuinely unanswerable, and saying "we cannot yet answer this, here is why, here is who decides" is the correct professional output. A system that returned "not breached" (measure 1) or "breached" (measure 2) would be asserting a precedence that no one has set |
| Whether to invoke a fallback that cannot be reversed | `DEC-2026-0776` at 15:07: submit CHF 18.7m manually through a correspondent, accepting manual-process risk, with 38 minutes of tolerance left and a 45-minute lead time, before the cause is known and before the supplier's recovery estimate can be tested. Once submitted it cannot be unwound. This is the sharpest lane-4 decision in the product |
| Whether the event is reportable, per entity | Two frameworks, two thresholds, two conclusions, both provisional. Illustrative regulatory context, not legal advice. A single automated answer would either apply one framework to all three entities, which is wrong, or hide the judgment, which is worse |
| Whether five uses of a fallback constitute a test | A method judgment with a governance consequence: if use counts as a test, `KRI-RES-005` improves and nothing is learned |
| What to tell the CRO and the COO, and when | `P-013` and `P-014` are notified at 15:14 with facts that are 40% stakeholder statements. Deciding what to state, what to attribute and what to withhold as unverified is stakeholder judgment under time pressure |

### 6.6 Hero visualisation: Impact Tolerance Runway

| Aspect | Specification |
|---|---|
| **Form** | A horizontal time axis, one lane per entity per important business service, running from disruption start to the day's hard deadlines. Time is the primary dimension, which is the correct primary dimension for resilience and almost never the one GRC tools use |
| **Per-lane anatomy** | Left edge: confirmed disruption start. A consumed-tolerance bar growing rightward. A tolerance limit marker. A separate, independent cut-off marker. The gap between the tolerance marker and the cut-off marker is the **runway**, and it is the number that matters |
| **The `ARC-CH` lane at 15:09** | Disruption start 13:47. Consumed 1 hour 22 minutes. Tolerance limit at 15:47. Cut-off at 16:00. Runway 38 minutes. Below the lane, the fallback option renders as a **block of its own length**: `RB-PAY-011`, 45 minutes. The block is longer than the runway. The visualisation states the decision without a word of text: you cannot wait and then act, so you must act now or accept the slip |
| **Fallback options as blocks with lead times** | Every option is drawn at its true duration, positioned where it would have to start. Options that no longer fit render greyed and anchored to the past. The `ARC-DE` lane shows `RB-PAY-007` as a short block already consumed at 14:12 |
| **Two-measure rendering, the key affordance** | Where a tolerance has more than one measure, the lane shows **two markers with an explicit "no precedence set" annotation between them**. The `ARC-CH` lane at 16:04 shows measure 1 satisfied (15:58, two minutes inside the 16:00 cut-off) and measure 2 exceeded (2 hours 11 minutes against 2 hours), with the open question badged and owned by `P-005`, routed to `AG-CMT-NFR-2026-10-08`. This is the document's single most important visual requirement, because most tools would pick one measure and be quietly wrong |
| **Dependency chain strip** | A thin band beneath each lane showing the dependency chain with the failing node marked and the failure time stamped: `TP-0042.2` Frankfurt at 13:31, Amsterdam takes over 13:44, `TP-0042.3` detection blind 13:31 to 14:57, supplier notifies 14:05, Arcadia detects 14:07. The 34-minute detection gap is drawn as a gap, which is the only way anyone will see it |
| **Per-entity regulatory badge** | Each lane carries its own framework badge. The `ARC-CH` lane never shows an EU framework badge. In a group aggregate view, EU-derived fields render as not applicable for `ARC-CH` rather than blank |
| **What it must never do** | Aggregate the three entities into one tolerance line; pick one measure when two exist; draw a fallback option without its lead time |

### 6.7 The 14:05 event through this lens

**What Nadia sees.** Time, running out, in three lanes at different speeds, with the tightest lane being her own entity and the one with no fallback.

For `ARC-DE` and `ARC-AT` the picture is uncomfortable but wide: a 4-hour tolerance, a fallback already invoked at 14:12, restoration at 16:08, well inside. For `ARC-CH` the picture is a 2-hour tolerance, a 16:00 cut-off, no fallback route, a 45-minute manual option, and at 15:09 a 38-minute runway. She has to decide before she knows anything.

Three things land on her that the other roles do not feel.

1. **The fallback she relies on for the EU entities is the thing that created the control failure.** `RB-PAY-007` section 4 says the control environment is unchanged during fallback operation. It is not. Activating her own resilience arrangement switched off a key preventive control in the IKS for 3 hours 56 minutes. Her runbook made a control assertion it had no basis to make.
2. **Her tolerance cannot answer her own question.** At 16:04 she has two measures giving opposite answers with no precedence. She has to report to `P-013` and `P-014`, and to the committee, that `ARC-CH` cannot state whether it breached its own impact tolerance. That is a harder sentence to write than either answer would have been.
3. **The dependency map was too shallow.** It reached `TP-0042`. The 34-minute detection lag came from `TP-0042.3` in Brno, two levels down, pinned to a failed endpoint by a static connection string. Every notification commitment in her incident framework rested on a node her map did not contain.

**The different question this role asks.** Others ask what happened, who is accountable, or what it obliges. Nadia asks: **"How much time do I have, per entity, and does the arrangement I am relying on still hold while I use it?"**

The second half of that question is the one the day answers unexpectedly. She expected to test whether the fallback worked. It did: payments cleared, `ARC-DE` stayed well inside tolerance, `ARC-CH` made the cut-off with two minutes to spare. What she did not expect is that using the fallback degraded the control environment, that her runbook said otherwise in writing, and that her tolerance definition could not adjudicate its own outcome. The fallback held. The framework around it did not.

---

## 7. Role: Regulatory Change Manager

| Field | Value |
|---|---|
| Role slug | `regulatory-change` |
| Scenario person | `P-006` Tobias Reinhardt |
| Entity | `ARC-DE`, group mandate |
| Location | Frankfurt |
| Function | Group Compliance, Regulatory Change |
| Line | 2LoD |
| Reports to | Group Chief Compliance Officer, with a dotted line to `P-001` |

### 7.1 Professional mandate

Tobias is accountable for identifying regulatory developments relevant to the group, interpreting what they require, mapping requirements to internal policies, processes, controls and evidence, and tracking implementation to a defensible state. His output is traceability: for any obligation, which internal artefact discharges it, in which entity, with what evidence, and where the gaps are.

He is also the only role in this document whose primary professional duty includes **preventing a category error**: the group operating model encourages a single group view, and a single group view is wrong for `ARC-CH`. He is the person who must keep two regulatory lanes separate inside one organisation that would prefer one lane.

Illustrative regulatory context, not legal advice.

### 7.2 Primary domain objects

| Object | Scenario instances |
|---|---|
| Regulatory change item | `REG-2026-0031`, `REG-2026-0088`, `REG-2026-0104`, `REG-2026-0117` |
| Obligation | Decomposed requirements under each `REG`, identified as `OBL-<REG>-<nnn>` |
| Jurisdiction lane | EU lane for `ARC-DE` and `ARC-AT`; Swiss lane for `ARC-CH`. Never merged |
| Internal policy | Group NFR Framework, Group Third-Party Risk Policy, Group Operational Resilience Policy, each with a local adoption record per entity and a local deviation register |
| Traceability mapping | Obligation to policy clause to process to control to evidence |
| Register of information | `REG-2026-0031`, 94.6% of Tier 1 records complete, subcontracting chains incomplete |
| Outsourcing inventory | `REG-2026-0088`, `ARC-CH` significant outsourcings, data access by subcontractors abroad |
| Internal standard under consultation | `REG-2026-0104` impact tolerance definition and testing, consultation to 23.10.2026 |
| Classification standard | `REG-2026-0117` incident classification and reporting thresholds, separate per lane |
| Classification question | `SVC-0042-03` rated as not supporting a critical or important function |

### 7.3 Morning priorities in this scenario, as at 07:45 on 06.10.2026

1. **`REG-2026-0031` is at 94.6% Tier 1 completeness and the missing 5.4% is not random.** The incomplete records are the subcontracting chains, which is precisely where `TP-0042.4` Meridian in Pune and `TP-0042.3-F1` Aurora in Dublin sit. A completeness percentage that conceals a structural gap is worse than a lower percentage that reveals one.
2. **`REG-2026-0088` has a newly opened question**: a subprocessor in a third country with read access to payment metadata, at a significant outsourcing for `ARC-CH`, with no notice on record. This is a data-access and inventory question under the Swiss lane, and it is separate from and additional to the EU subcontracting question about the same supplier. Illustrative regulatory context, not legal advice.
3. **`REG-2026-0104`, the internal impact tolerance standard, is in consultation to 23.10.2026** and the draft does not require a stated precedence where a tolerance has more than one measure. He has not noticed. At 16:04 `ARR-…-15` makes the omission concrete, and the consultation window is still open, which is the luckiest timing in the scenario and the cheapest fix available to anyone that day.
4. **`AG-CMT-NFR-2026-10-06` and `-07` are both his**, both noting items, both due 08.10.2026 at 12:00. Noting items are where jurisdictional errors get through, because nobody reads them closely.
5. **`SVC-0042-03` is classified as not supporting a critical or important function.** Format library maintenance. If it failed, `PT-06` bulk files stop. He and `P-002` arrive at this question from opposite directions, which is a good sign about both.
6. **The standing duty.** Every group aggregate view, every dashboard, every committee paper must not imply that the EU framework covers `ARC-CH`. This is not a task with a due date. It is a continuous editorial discipline, and it is the reason his role exists in a three-entity, two-jurisdiction group.

### 7.4 Lane 3: core risk practice for this role

| Method | What it produces | Standard of sufficiency |
|---|---|---|
| **Horizon scanning and applicability determination** | A per-item, per-entity applicability decision with a reason | The reason must be stated per entity. "Applies to the group" is not an applicability determination in a group with a Swiss entity |
| **Obligation decomposition** | A regulatory text broken into discrete, testable obligations with identifiers | An obligation that cannot be mapped to a single accountable artefact has not been decomposed far enough |
| **Traceability mapping** | Obligation to policy clause to process to control to evidence, per entity | The chain must be complete end to end. A mapping that stops at a policy clause proves only that Arcadia wrote something down |
| **Gap analysis** | Named gaps: unmapped obligations, mapped-but-unevidenced obligations, and evidenced-but-stale obligations | Three distinct states. Reporting them as one number, "94.6% complete", hides which of the three is driving the shortfall |
| **Dual-lane maintenance** | Two parallel obligation sets with a shared internal artefact layer and explicitly separate applicability | Where one internal control discharges obligations in both lanes, the control appears once and the obligations appear twice, with no implication that one framework's satisfaction satisfies the other |
| **Interpretation** | A written internal interpretation of what an obligation requires of Arcadia, with its basis and its uncertainty | Never a compliance claim. The output is "this appears to require X, we do Y, here is the difference", labelled illustrative regulatory context, not legal advice |
| **Implementation tracking and attestation support** | Evidence that an obligation is discharged, at a standard that survives being asked | An attestation that rests on a policy existing rather than on a control operating is the most common failure mode in this method |
| **Internal standard drafting** | Internal standards that make obligations operable | `REG-2026-0104` is in consultation and its current draft would permit `ITOL-0004-03` to exist. A standard that permits an unevaluable tolerance is not yet finished |

### 7.5 Decisions that must remain human-owned

| Decision | Why it cannot be automated |
|---|---|
| Applicability per entity | The consequence of getting this wrong is a category error with supervisory implications in either direction: applying an EU framework to the Swiss entity, or failing to apply a Swiss requirement because a group view absorbed it. This must be a named human judgment, per entity, on the record |
| Interpretation of an obligation | Interpretation is professional opinion informed by supervisory context, peer practice and legal advice. The product must present the text, the internal position and the uncertainty, and must never generate the interpretation. Illustrative regulatory context, not legal advice |
| Whether a mapping is sufficient to be defensible | Sufficiency is a judgment about what an examiner would accept, which depends on context the system does not hold |
| Whether the event changes a position already stated externally | If Arcadia has described its payment control environment in any supervisory context, and a key control was waived by configuration for 3 hours 56 minutes, deciding whether that changes a stated position is a judgment with consequences. It requires legal input and it is never a system output |
| Whether a classification should change | Reclassifying `SVC-0042-03` as supporting a critical or important function pulls in register, contractual and testing obligations and has cost. It is a judgment about substance over current label |
| What to put in a noting item | Noting items carry no decision, which is exactly why what goes in them is a judgment. A jurisdictional error in a noting item is how a group quietly adopts a wrong position |

### 7.6 Hero visualisation: Obligation-to-Control Traceability Map, dual lane

| Aspect | Specification |
|---|---|
| **Form** | A five-column Sankey-style flow: Obligation, Internal policy clause, Process, Control, Evidence. Read left to right |
| **The structural device** | **Two lanes, stacked and visibly separated by a hard rule.** Upper lane: EU obligations for `ARC-DE` and `ARC-AT`. Lower lane: Swiss obligations for `ARC-CH`. The separator is not decorative; it is the product's guarantee that no flow crosses it. An obligation in the upper lane can never terminate at an `ARC-CH` evidence node |
| **Shared middle, split ends** | Where one internal control serves both lanes, the control node is drawn once in a shared middle band with two distinct inbound flows and two distinct outbound evidence requirements. `CTL-PAY-014` is exactly this: one control, obligations in both lanes, and evidence that must satisfy each separately. The shared node makes the efficiency visible; the split flows prevent the category error |
| **Flow-end states** | Four terminal states, each visually distinct: **mapped and evidenced** (flow reaches evidence), **mapped and unevidenced** (flow stops at control), **mapped and stale** (flow reaches evidence, evidence is out of date, with its age shown), **unmapped** (obligation with no outbound flow, rendered as a stub). `REG-2026-0031`'s 94.6% decomposes into these four states, which is the whole value of the view |
| **Regulatory label discipline** | Every obligation node carries "Illustrative regulatory context, not legal advice." at the node, not in a page footer. Every node also carries its entity scope. No node is scopeless |
| **Coverage counter, honest version** | Instead of one percentage, a four-part counter: evidenced, unevidenced, stale, unmapped. Where 94.6% is shown, the shortfall is broken down beside it and the subcontracting-chain concentration is visible |
| **During the 14:05 event** | The map does not change shape. Individual nodes change state, and that is the point. The evidence node under `CTL-PAY-014` in both lanes moves from evidenced to contested at 15:38. The `REG-2026-0088` data-access obligation moves from unmapped to mapped-and-unevidenced at 14:55 when the Meridian question becomes live. The `REG-2026-0104` draft standard gains an open comment at 16:04. The view's contribution to the day is not drama; it is that four obligation states changed and someone can see which |
| **What it must never do** | Draw a flow across the lane separator. Show a single coverage percentage. Render a regulatory node without its entity scope and its label |

### 7.7 The 14:05 event through this lens

**What Tobias sees.** Not an incident and not a control failure. A set of obligation states changing, in two jurisdictions, at different times, with different consequences, and one internal standard still open for comment.

- At 14:55, `ARR-…-08` turns a registry completeness gap into a live operational fact: the resilience of a critical service depended on a node not in the binding appendix, and a subprocessor in a third country with payment metadata access is not in the register at all. In the EU lane this is a subcontracting and register-of-information question. In the Swiss lane it is an inventory and data-access question. Same supplier, same day, two separate obligations, two separate assessments. Illustrative regulatory context, not legal advice.
- At 15:14 to 15:52, two classification assessments run against two different frameworks and produce two provisional conclusions, `DEC-2026-0774` and `DEC-2026-0775`. His contribution is to ensure they stay two records. The pressure at severity `S1` is always toward one answer.
- At 15:38, a key control in the Internal Control System / Internes Kontrollsystem (IKS) is shown to have been waived by supplier configuration since 11.11.2024. Whichever internal or external statements describe Arcadia's payment control environment now need checking against that fact. That is a question for Group Legal and the Chief Compliance Officer, not for him alone, and the correct output at 16:30 is a precisely framed question, not an answer.
- At 16:04, `ARR-…-15` shows that an impact tolerance with two measures and no precedence cannot be evaluated. `REG-2026-0104` is in consultation until 23.10.2026 and does not require a precedence. He can fix the standard before it is issued. One comment, 17 days of window, and a defect that would otherwise have been designed into every tolerance in the group.

**The different question this role asks.** Others ask what happened, how bad it is, or who owns it. Tobias asks: **"Which obligations did today touch, in which jurisdiction, and does anything we have already stated need to change?"**

The second half is the hard part and the reason the role is senior. Incidents are events; obligations are continuous. An event that is closed operationally can leave a stated position wrong, and a wrong stated position does not resolve itself. The most valuable thing he does on 06.10.2026 is a single comment on a draft internal standard, filed at 16:47, which nobody will notice and which prevents an unevaluable tolerance from becoming the group norm.

---

## 8. Role: NFR Portfolio Lead

| Field | Value |
|---|---|
| Role slug | `nfr-governance` |
| Scenario person | `P-001` Dr. Katharina Vogt |
| Entity | `ARC-DE`, group mandate |
| Location | Frankfurt |
| Function | Group Non-Financial Risk |
| Line | 2LoD, with committee secretary mandate |
| Reports to | `P-013` Claudia Renner, Group Chief Risk Officer |

### 8.1 Professional mandate

Katharina owns the group's aggregate non-financial risk position and the governance machinery that turns it into decisions: the framework, the committee, the reporting, and the discipline that every open issue has an owner, a date and a destination. The other five roles report to her. She is accountable for the thing none of them can produce alone, which is a single coherent view of whether the group's non-financial risk position is understood, inside appetite, and being acted on.

Her distinguishing constraint is that she owns almost no risks and can compel almost nothing. Her instruments are the agenda, the paper, the record and the question. That makes her role look soft and makes it, in practice, the role where the day's work either becomes a decision or evaporates.

### 8.2 Primary domain objects

| Object | Scenario instances |
|---|---|
| Framework | Group NFR Framework, with local adoption per entity |
| Aggregate position | All risks, controls, indicators, Massnahmen and acceptances across three entities |
| Committee | `CMT-NFR-2026-10`, 13.10.2026, papers due 08.10.2026 12:00, four decision items becoming five |
| Agenda item | `AG-CMT-NFR-2026-10-01` to `-10` |
| Divergence | The `CTL-PAY-014` 1LoD and 2LoD disagreement; the `RSK-0211` rating gap |
| Appetite | Group appetite statements and each entity's position against them |
| Risk Acceptance / Risikoakzeptanz | `RSK-0184` conditional acceptance with an unmet condition, expiring 31.12.2026 |
| Massnahme portfolio | 7 overdue group-wide; `MSN-2026-0147` at 67 days crossing the 60-day escalation rule |
| Indicator portfolio | `KRI-GOV-001` at 7, Amber; four Red indicators across four owners |
| Decision record | `DEC-2026-0781`, and the register of all decisions taken on 06.10.2026 |
| Reporting cycle | Monthly dashboard, quarterly committee pack, annual framework review |

### 8.3 Morning priorities in this scenario, as at 07:45 on 06.10.2026

1. **Papers are due 08.10.2026 at 12:00. Three of five decision items are undrafted.** Late papers are tabled for information only and cannot carry a decision. This is a hard constraint, and it is the constraint that shapes her whole day.
2. **`MSN-2026-0147` crossed 60 days overdue on 29.09.2026**, which triggers the escalation rule: report to committee with a named accountable executive and a recommendation to re-baseline with a root cause or escalate to the entity board. The recommendation is hers to make, and it concerns `P-007`, who is a peer of her own direct stakeholders.
3. **An unresolved 1LoD and 2LoD divergence on a key control in the IKS.** Her choice: push for resolution before the paper, or table the divergence as a divergence. Tabling it is more honest and makes the committee do work. Resolving it first is tidier and risks the resolution being dilution. She does not have to choose at 07:45, and by 16:41 the parties resolve it themselves.
4. **Four Red indicators sitting with four different owners that are one issue.** `KRI-PAY-007`, `KRI-PAY-003`, `KRI-PAY-011`, `KRI-TPR-002`. Presented as four rows in a dashboard, which is how her current reporting does present them, they look like four problems in four functions. They are one causal chain.
5. **`RSK-0184` is held under a conditional Risikoakzeptanz whose condition, an exit test, is not met and not planned.** An acceptance operating on an unmet condition is a governance failure of her own machinery, not of the risk owner's.
6. **`KRI-GOV-001` at 7 overdue Massnahmen, Amber**, trending toward the Red threshold of 9, and two of the seven are on `IBS-0004`.

### 8.4 Lane 3: core risk practice for this role

| Method | What it produces | Standard of sufficiency |
|---|---|---|
| **Aggregation with causal integrity** | A group position in which related items are presented as related | Four Red indicators with one cause presented as four rows is an aggregation failure, not a formatting preference. The test: could a committee member reading the pack reconstruct the causal chain? |
| **Divergence management** | Every open 1LoD and 2LoD disagreement visible, with both positions stated in their owners' terms | Divergences resolved by dilution are the most expensive thing a governance function can permit, because they destroy the value of the second line while appearing to produce consensus |
| **Appetite aggregation and breach management** | A per-entity, per-category position against appetite, with the consequence named for each breach | "Outside appetite" with no named consequence, no owner and no date is a reporting line, not a governance act |
| **Risk acceptance lifecycle governance** | Every Risikoakzeptanz with its approver, expiry, conditions and the current status of each condition | `RSK-0184` fails this: the condition is unmet, the acceptance is live, and nothing in the machinery flagged it. Conditions must be tracked like Massnahmen or they are decoration |
| **Massnahme portfolio management** | Overdue actions with age, cause of delay, and the escalation the age triggers | The professional distinction is between an action delayed by dependency (`MSN-2026-0147`, blocked on a UAT environment freeze) and an action delayed by neglect (`MSN-2026-0203`, not started). Both are overdue; only one is a discipline problem |
| **Committee and decision design** | Papers that ask one answerable question, with the facts stated by class and the option set complete | A paper that presents an event without asking a decision wastes the only 150 minutes per quarter when the group's executives are in one room |
| **Decision record integrity** | Every decision with its maker, authority basis, facts relied on, reversibility and review trigger | Provisional decisions must be recorded as provisional with their reassessment trigger. `DEC-2026-0774` and `-0775` are both provisional and both must say so |
| **Framework feedback** | Changes to the framework derived from what the period revealed | `ITOL-0004-04` had a zero tolerance and no monitoring capable of detecting a breach of it. That is a framework defect, and finding it is her work, not the resilience lead's |

### 8.5 Decisions that must remain human-owned

| Decision | Why it cannot be automated |
|---|---|
| What goes on the agenda, and as what type | Agenda design is the exercise of the role's only real power. Whether `INC-2026-0412` is a noting item or a decision item determines whether anything happens. Choosing "decision" commits her to framing a question the committee can actually answer by 13.10.2026 |
| Whether to escalate an overdue Massnahme to an entity board | This is a judgment about a peer's performance with a real relationship cost, and about whether the delay is dependency or neglect. `MSN-2026-0147` is genuinely blocked by an infrastructure freeze, which makes re-baselining defensible and makes not saying so indefensible |
| How to present a divergence | Both positions in their owners' words, with neither editorialised. The temptation to lead the committee toward the 2LoD position is strong and professionally wrong |
| What the group's aggregate position actually is | Aggregation is interpretation. Deciding that four Red indicators are one issue is a judgment with reporting consequences, and it is the single most valuable judgment in the role |
| Whether a decision can be taken on the facts that will exist at the deadline | `DEC-2026-0781`: papers close 08.10.2026 at 12:00, the supplier's report arrives 13.10.2026 in the morning. Deciding to proceed, and structuring the paper so the late report cannot invalidate the decision, is a governance design judgment |
| Whether to withdraw or re-condition a live Risk Acceptance | Withdrawing `RSK-0184`'s acceptance leaves a Medium-High risk uncovered and forces an executive decision under time pressure. Leaving it in place preserves an acceptance whose condition has been defeated. Neither is safe and one must be chosen |

### 8.6 Hero visualisation: Group NFR Position Board

| Aspect | Specification |
|---|---|
| **Form** | A single board, three entity columns by important-business-service rows, with a fixed set of position markers per cell. Designed to be readable in 90 seconds by a Chief Operating Officer, which is the actual design constraint |
| **Cell contents** | Per entity per service: appetite position, open divergences, Red indicators, overdue Massnahmen, live Risk Acceptances with condition status, and decisions awaiting an owner. Six markers, always in the same positions, so absence is as readable as presence |
| **Every marker carries a name and a date** | No marker renders without an accountable human and a date. A marker without both is itself an exception state and renders as such. This is the board's central discipline: the most common governance failure is an issue that is visible and unowned |
| **The divergence marker** | Renders as a two-headed marker with both ratings and both owners. `CTL-PAY-014` on 06.10.2026 shows "Fully Effective, `P-008`, 1LoD" against "Partially Effective, `P-004`, 2LoD", with the 29.09.2026 date on the first. At 16:41 it collapses to a single agreed marker with the design and operating split stated, and the board keeps the history |
| **The causal-chain overlay, the key affordance** | A toggle that redraws related markers as a connected chain rather than as independent cells. Turning it on for 06.10.2026 draws one chain: NOVA-GATE availability, to `OVR-C` growth, to `KRI-PAY-007`, to reviewer capacity at 75%, to `CTL-PAY-014` Partially Effective, to `MSN-2026-0147` at 67 days, to `RSK-0211` outside appetite. Four Red markers in four cells become one line with one root. This is the product's thesis rendered as a single interaction, and it is the one visual that should exist at 07:45, before anything happens |
| **The acceptance condition tracker** | Each live Risikoakzeptanz renders with its conditions as separate satisfied or unsatisfied states, plus its expiry. `RSK-0184` shows reassessment in progress and exit test not started, with a 31.12.2026 expiry. An acceptance with an unsatisfied condition renders in the same visual weight as an appetite breach, because that is what it is |
| **Committee readiness strip** | A strip along the board showing each agenda item with its drafting state against the 08.10.2026 12:00 deadline, and, for each decision item, whether the facts it depends on will exist by then. `AG-…-10` shows a dependency on a supplier report due 13.10.2026, flagged as a fact that will not exist at the deadline |
| **Per-entity framework discipline** | The `ARC-CH` column never carries an EU framework label. Where a group total is shown, the `ARC-CH` contribution to any EU-derived measure renders as not applicable, never as blank or zero |
| **During the 14:05 event** | The board gains one row. It does not restructure. Markers change state and the causal-chain overlay extends: the chain that existed at 07:45 gains `INC-2026-0412`, 96 candidate `ITOL-0004-04` breaches, and one confirmed erroneous release. The visual argument is that the event is the chain's continuation, not a new object, and the board should have been able to say so at 07:45 |
| **What it must never do** | Show a marker without an owner and a date; average a divergence; total an EU-derived measure across all three entities |

### 8.7 The 14:05 event through this lens

**What Katharina sees.** A governance problem, not an operational one. Specifically, a decision deadline colliding with a fact arrival schedule.

Her constraints at 16:30 are exact. Papers close 08.10.2026 at 12:00. The supplier's root-cause report is due 13.10.2026, the morning of the meeting. She has one day and a bit to write a decision paper on an event whose supplier account will arrive after her deadline and before her meeting. Late papers cannot carry a decision. So she must either ask for a decision on incomplete facts, or ask for nothing and lose a quarter.

`DEC-2026-0781` is her answer and it is a piece of craft: write the paper on verified facts as at 08.10.2026, state explicitly which facts are `VF`, which are `SS` and which are `TI`, ask for a decision that the supplier's report cannot invalidate whatever it says, and add `AG-CMT-NFR-2026-10-10`. Concretely, that means the committee is not asked "what caused this" (the supplier's report will answer that) but "does the group accept that a supplier-configurable rule can waive a key control in the Internal Control System / Internes Kontrollsystem (IKS) without an Arcadia control-owner review, and what change does it require". That question is answerable on 08.10.2026 facts and stays answerable whatever arrives on 13.10.2026.

Two further things land on her, and both are about her own machinery rather than about payments.

1. **`ITOL-0004-04` had a zero tolerance and no monitoring capable of detecting a breach.** The 96 candidate breaches were found by an ad hoc query at 14:34, not by a control. A zero-tolerance statement with no detection is a framework defect, and it is hers.
2. **The divergence resolved without her.** At 16:41 `P-008` and `P-004` signed one sharper conclusion, and the resolution was better than either of the options she was weighing at 07:45. The governance lesson is that her job was to keep the divergence visible and unresolved until the facts arrived, not to resolve it. Holding a disagreement open for nine hours was the correct governance act, and it looks like inaction.

**The different question this role asks.** The other five ask questions about the world. Katharina asks: **"What decision does this group actually need, who can take it, and can it be taken on the facts that will exist at the deadline?"**

That is the question that converts a day of professional work into an institutional outcome, and it is the only question in this document whose subject is the organisation rather than the risk.

---

## 9. Cross-role matrix: what is common, what is function-specific

Read this as the build specification. "Common" means one implementation serves all six roles. "Configured" means one implementation with role-specific configuration. "Specific" means six implementations.

### 9.1 Lane 1 Organise

| Capability | Status | Common element | Role-specific element |
|---|---|---|---|
| Inbox triage and classification | **Common** | Ingest, deduplicate, classify by object type, link to the domain object, rank by deadline and dependency | The object types that exist in each role's world, drawn from the same shared object model |
| Priority sequencing | **Common** | Deadline arithmetic, dependency resolution, conflict detection, capacity awareness | Nothing. A deadline is a deadline |
| Calendar and meeting preparation | **Configured** | Meeting detection, attendee resolution, pack assembly from linked objects, pre-read distribution | Which pack template: an RCSA workshop pack and a supplier governance pack contain different sections in a different order |
| Reminders and chasing | **Common** | Open-request tracking, non-response detection, escalation ladder by age | The escalation ladder's steps and thresholds |
| Routing | **Configured** | Owner resolution across entity, function and line; handoff record | The routing table |
| Follow-up and status coordination | **Common** | Who owes what to whom by when, across all six roles, in one structure | Nothing |
| Routine drafting | **Configured** | Draft generation from linked objects with provenance on every claim | Templates, register of language, salutation conventions per counterparty type |
| **Assessment** | **Fully common infrastructure.** Roughly 85% common code, 15% configuration. | | |

### 9.2 Lane 2 Understand

| Capability | Status | Common element | Role-specific element |
|---|---|---|---|
| Retrieval | **Configured** | Query planning, connector layer, permission enforcement, result ranking, citation | **The corpora.** `tprm` reads contracts, questionnaires, supplier evidence. `control-assurance` reads control descriptions, test papers, audit logs. `regulatory-change` reads regulatory texts and policies. Different sources, same engine |
| Provenance | **Common** | Source, creation date, retrieval date, version, hash, retrieval path, immutability | Nothing. Provenance is provenance. This is the most important common capability in the product |
| Evidence classification | **Configured** | The `VF`, `SS`, `TI` scheme, reclassification history, attribution, uncertainty statement | **The sufficiency taxonomy.** What makes an artefact sufficient differs by role: a penetration test scope statement for `tprm`; a reviewer identity and timestamp for `control-assurance`; an obligation-to-clause mapping for `regulatory-change` |
| Monitoring | **Configured** | Threshold evaluation, trend detection, state-change notification | The signal set and the thresholds |
| Reconciliation | **Common** | Compare two sources of the same fact, quantify and localise the difference | The source pairs |
| Contradiction detection | **Common** | Detect that two statements about the same object cannot both be true; attribute each; do not resolve | Nothing. This is the highest-value common capability and the hardest to build |
| Trend and component analysis | **Common** | Decompose a headline movement into components and rank contributors | The decomposition dimensions |
| Process intelligence | **Configured** | Derive actual process behaviour from event logs and compare to documented process | The process and the documented baseline |
| Policy and regulatory retrieval | **Configured** | Same retrieval engine with jurisdiction-lane enforcement and mandatory labelling | The lane and the corpus. This is the one place where role-specific configuration is a **control**, not a preference: the lane separator must be enforced, not styled |
| **Assessment** | **Common engine, role-specific corpora and taxonomies.** Roughly 70% common code, 30% configuration. | | |

### 9.3 Lane 3 Assess

| Capability | Status |
|---|---|
| Classification and contractual sufficiency (`tprm`) | **Specific** |
| Residual risk and control environment assessment (`rcsa`) | **Specific** |
| Population, sampling, deviation and root-cause method (`control-assurance`) | **Specific** |
| Tolerance setting, scenario testing, severity method (`incident-resilience`) | **Specific** |
| Obligation decomposition and traceability (`regulatory-change`) | **Specific** |
| Aggregation, divergence and committee design (`nfr-governance`) | **Specific** |
| **Common elements that do exist across lane 3** | Four only: (a) the shared domain object model, so all six work on the same risks, controls, suppliers and incidents; (b) the evidence and provenance layer from lane 2; (c) a common structure for "a professional conclusion", being conclusion plus method plus evidence plus limitation; (d) a common working surface, the workbench, with role-specific content |
| **Assessment** | **Function-specific.** Roughly 20% common (the object model and the conclusion structure), 80% role-specific method. |

### 9.4 Lane 4 Decide

| Capability | Status |
|---|---|
| Materiality / Wesentlichkeit judgment | **Specific and unautomated** |
| Interpretation | **Specific and unautomated** |
| Professional challenge | **Specific and unautomated** |
| Stakeholder conversation and negotiation | **Specific and unautomated** |
| Residual risk and Risk Acceptance / Risikoakzeptanz | **Specific and unautomated** |
| Severity and escalation | **Specific and unautomated** |
| **Common elements that do exist across lane 4** | Three only, and all three are support rather than decision: (a) a decision record structure, being decision, maker, authority basis, facts relied on with classes, options considered, reversibility, review trigger; (b) on-demand retrieval into the decision moment; (c) a consequence model that shows what each option would change, without ranking the options |
| **Assessment** | **Function-specific and deliberately unautomated.** The common part is the record, not the reasoning. |

### 9.5 Lane 5 Execute

| Capability | Status | Common element | Role-specific element |
|---|---|---|---|
| GRC write | **Configured** | Transaction envelope enforcing the five mandatory attributes; validation; rollback; rejection of incomplete writes | The target module and the field mapping |
| Action creation (Massnahme) | **Common** | One structure: title, owner, due date, source, dependency, evidence requirement, escalation rule | Nothing. `MSN-2026-0214` through `-0221` came from five different roles and are one object type |
| Notification | **Configured** | Recipient resolution, channel selection, delivery record | The escalation map |
| Versioning | **Common** | Immutable version history with author, timestamp, prior-version pointer | Nothing |
| Audit trail | **Common** | Append-only record of every write, with the human who authorised it | Nothing. This is the most important common capability in lane 5 |
| Monitoring activation | **Configured** | Register a new signal with thresholds and an owner | The signal definition |
| Committee update | **Configured** | Agenda item creation, paper linking, deadline enforcement, decision recording | Paper templates and quorum rules |
| Evidence retention | **Common** | Retention class assignment, immutability, expiry warning | Retention classes by evidence type |
| Follow-up assurance | **Common** | Verify that a committed action actually occurred, and escalate when it did not | The verification method per action type |
| **Assessment** | **Common engine, role-specific targets and routes.** Roughly 75% common code, 25% configuration. | | |

### 9.6 Summary

| Lane | Label | Common code | Role-specific | Build verdict |
|---|---|---|---|---|
| 1 | Organise | ~85% | ~15% configuration | Build once |
| 2 | Understand | ~70% | ~30% corpora and taxonomies | Build the engine once, configure six corpora |
| 3 | Assess | ~20% | ~80% method | Build six times, mostly as method configuration on a shared object model |
| 4 | Decide | Record structure only | Reasoning, entirely | Build the record and the retrieval, never the reasoning |
| 5 | Execute | ~75% | ~25% targets and routes | Build once, configure six routing tables |

Percentages are design targets for planning, not measurements.

---

## 10. Lane 1 shared specification: Organise

Built once, serving all six roles.

| Component | Requirement |
|---|---|
| **Work item model** | One structure across all roles: source, arrival time, object links, deadline, dependency, owner, entity, state, age. An item with no object link is an exception state and renders as one |
| **Ingest** | Email, GRC notification, supplier portal, calendar, indicator publication, incident feed, committee tracker. Every ingested item links to a domain object or is flagged as unlinked |
| **Priority function** | Deterministic and inspectable. Inputs: hard deadline, dependency chain depth, escalation rule proximity, entity accountability, and whether the item blocks another person. The ranking always shows why an item ranks where it does |
| **Dependency resolution** | A work item can block or be blocked. `P-004`'s unresolved control conclusion blocks `P-003`'s control environment rating, which blocks the RCSA sign-off. The product must show this, because a person cannot see that their own open item is blocking someone else's deadline |
| **Deadline arithmetic** | Business days per entity, including local holidays. Committee papers due 08.10.2026 at 12:00 is a hard cut-off with a stated consequence, not a soft target |
| **Chase and non-response** | Every outbound request is tracked. Non-response is a state with an age and an escalation ladder. `EVD-2026-41205`, a UAT scheduling request unanswered since 22.09.2026, is a 14-day non-response that no inbox surfaces |
| **Meeting preparation** | Detect the meeting, resolve attendees, assemble the pack from linked objects, distribute the pre-read, capture actions. Templates are role-specific; the mechanism is not |
| **Routine drafting** | Holding replies, status notes, chase messages, calendar invitations, minutes. Every factual claim in a draft carries its object reference. A draft that asserts a fact without a reference is rejected before it reaches the human |
| **Hard boundary** | Lane 1 never decides materiality, never sets a rating, never sends anything externally without human release, and never drafts a professional position |

---

## 11. Lane 2 shared specification: Understand

Built once as an engine, configured six times.

| Component | Requirement |
|---|---|
| **Query planning** | Decompose a professional question into retrievals across corpora, with the plan visible before execution |
| **Connector layer** | `SYS-0011` to `SYS-0017`, `SYS-0031`, `SYS-0032`, supplier portals, contract repository, regulatory corpus. Read scopes enforced per role and per entity partition |
| **Provenance record** | Mandatory on every retrieved item: source system, object identifier, version, creation date, retrieval date, hash, retrieval path, immutability status. Creation and retrieval dates are always both shown, because "we have had this since May" and "we obtained this today" are different findings |
| **Fact classification** | Exactly one of `VF`, `SS`, `TI` on every asserted fact. `SS` carries the named person and the statement time. `TI` carries the measurement, the inference, and the specific reason the inference could be wrong. Reclassification is recorded with its time, never overwritten |
| **Contradiction detection** | Detect that two statements about the same object are incompatible. Attribute both. Do not resolve. Register the conflict with an owner and a resolution state. Conflicts A, A2, B, C and D from `DOC-SCENARIO-BIBLE` section 15.3 are the acceptance tests for this component |
| **Reconciliation** | Compare the same fact from two sources and quantify the difference. Appendix A3 against the supplier register. Contracted RTO against tested RTO. Contracted availability against calculated availability |
| **Trend and component decomposition** | Decompose any headline movement into components, rank contributors, and surface components that move against the headline. `KRI-PAY-007` decomposing into `OVR-C` at +539% and `OVR-D` at +124% against three flat components is the acceptance test |
| **Process intelligence** | Derive actual behaviour from event logs and compare it to the documented process. `RD-RULE-0031`'s firing history is derived behaviour; the `CTL-PAY-014` description is the documented process; the gap between them is the finding |
| **Regulatory retrieval with lane enforcement** | Two-lane corpus. Enforced, not styled: no EU-lane obligation can be returned against an `ARC-CH` object. Every returned reference carries "Illustrative regulatory context, not legal advice." No output states or implies compliance |
| **Uncertainty disclosure** | Every output states what it does not know, and where an absence of data could change the conclusion. Silence about limitations is a defect, not brevity |
| **Hard boundary** | Lane 2 never concludes. It produces facts, classes, contradictions, decompositions and limitations. Sufficiency, materiality and interpretation are lanes 3 and 4 |

---

## 12. Lane 5 shared specification: Execute

Built once as an engine, configured six times.

| Component | Requirement |
|---|---|
| **The five mandatory attributes** | Every write names the system of record, the entity partition, the record identifier, the accountable human and the evidence reference. A write missing any of the five is rejected at the envelope, not warned about downstream |
| **Human release** | No write executes without an explicit human release action by a person with the authority for that record type in that entity. Batch release is permitted; blind batch release is not, so every item in a batch is individually visible before release |
| **Transaction envelope** | Atomic, validated, reversible where the target system permits, with an explicit irreversibility warning where it does not. `DEC-2026-0776` is irreversible and must be marked so before release |
| **Massnahme creation** | One object type across all roles: title, accountable owner, delegate, due date, source object, dependency, evidence requirement, escalation rule. `MSN-2026-0214` to `-0221` came from five roles into one structure |
| **Notification** | Resolve recipients from the escalation map, select the channel by severity, record delivery. Severity `S1` fans out to `P-013` and `P-014` and both deliveries are recorded |
| **Versioning** | Immutable version history on every object, with author, timestamp and prior-version pointer. Superseded objects keep their identifier and gain a pointer |
| **Audit trail** | Append-only, covering every read of restricted evidence and every write, with the authorising human. This is what makes the product usable in a regulated second line at all |
| **Monitoring activation** | Register a new signal with its definition, threshold, owner and review date. The day's most important lane-5 output is a signal that can detect an `ITOL-0004-04` breach, because on 06.10.2026 no such signal existed |
| **Committee update** | Create or amend an agenda item, link papers, enforce the deadline and its consequence, record the decision with its authority basis and reversibility. `AG-CMT-NFR-2026-10-10` created at 16:20 is the acceptance test |
| **Evidence retention** | Assign a retention class, enforce immutability, warn before expiry. `UTC-TST-2026-0318-01` is the counterexample the product exists to prevent: a 30-day log expired before anyone asked the question |
| **Follow-up assurance** | Verify that a committed action occurred, independently of the owner's status report. `MSN-2026-0147` at 60% for 67 days is a status claim; a UAT that has not been scheduled is the fact |
| **Hard boundary** | Lane 5 never releases itself, never writes without an accountable human, and never sends anything to a third party without explicit human release |

---

## 13. Handoff map for 06.10.2026

The six roles are not six parallel days. They are one day with dependencies, and the product must make those dependencies visible to the person who is blocking someone else.

| Time | From | To | Handoff | Consequence if it does not happen |
|---|---|---|---|---|
| 08:45 | `control-assurance` `P-004` | `rcsa` `P-003` | The `TST-2026-0318` conclusion and the 1LoD counter-position, in a form usable in a workshop | `P-003` cannot settle the control environment rating and the 10:30 workshop cannot reach a residual rating |
| 09:30 | `rcsa` `P-003` | `control-assurance` `P-004` | The `KRI-PAY-007` component analysis showing `OVR-C` at +539% | `P-004` does not learn that fallback activation is frequent, and does not connect `EXC-…-04` to a pattern |
| 09:30 | `tprm` `P-002` | `incident-resilience` `P-005` | `TPRM-Q-2026-R04`: no DR evidence for the Swiss RepairDesk instance | `P-005` enters the day without knowing her own entity's dependency is unevidenced |
| 10:30 to 12:00 | `rcsa` `P-003` | `nfr-governance` `P-001` | The unresolved `RSK-0211` rating and a recorded 2LoD dissent, `DEC-2026-0772` | `P-001` cannot frame `AG-…-03` and the divergence disappears into a consensus nobody holds |
| 13:30 | `tprm` `P-002` | `regulatory-change` `P-006` | The Meridian and Amsterdam divergence, with data-access scope | `P-006` does not open the Swiss data-access question and `REG-2026-0088` stays incomplete |
| 14:34 | `incident-resilience` `P-005` | `control-assurance` `P-004` | The 96 overrides with `secondaryReviewRequired = false` | The event is managed as a service outage and the control failure is found days later, if at all |
| 15:23 | `tprm` `P-002` | all | `EVD-2026-41901`: Appendix A3 v4.2 is the binding version | Every role reasons from the supplier's register instead of the contract, and the divergence is invisible |
| 15:38 | `tprm` `P-002` | `control-assurance` `P-004` and `rcsa` `P-003` | `EVD-2026-41905`: the rule definition, obtained under `CTR-2023-0117-A4` clause 2.1 | Conflict A stays open, `P-008` and `P-004` remain in unresolvable disagreement, and the committee receives a dispute instead of a finding |
| 15:47 to 15:52 | `incident-resilience` `P-005` and `P-015` | `regulatory-change` `P-006` | Two classification assessments against two frameworks | One merged assessment, applying one framework to three entities. The single worst outcome available on 06.10.2026 |
| 16:04 | `incident-resilience` `P-005` | `regulatory-change` `P-006` | The `ITOL-0004-03` two-measure ambiguity | `REG-2026-0104` is issued on 23.10.2026 permitting unevaluable tolerances across the group |
| 16:19 | `control-assurance` `P-004` | `rcsa` `P-003` and `nfr-governance` `P-001` | One confirmed erroneous release, EUR 38,400 | The 1LoD "no loss occurred" argument survives into the committee paper unchallenged |
| 16:30 to 16:41 | all | `nfr-governance` `P-001` | Verified facts, open conflicts, decisions and new Massnahmen | No decision paper by 08.10.2026 at 12:00, and a quarter is lost |

The 14:34 handoff is the one that does not exist in most institutions, and it is the clearest argument for a shared platform. The person managing the incident and the person who knows what the audit log means are in different functions, in different cities, looking at different tools.

---

## 14. Why lanes 3 and 4 cannot be shared

Section 2 asserted it. This section tests it.

### 14.1 Lane 3: three tests

**Test 1: is the method the same?** No, and the differences are structural rather than terminological.

| Role | Unit of analysis | Method core | Standard of sufficiency |
|---|---|---|---|
| `tprm` | An arrangement | Compare classification, contract, assertion and observation | Would a supervisor accept the basis for this classification? |
| `rcsa` | A risk | Score inherent, rate the control environment, derive residual, position against appetite | Is the residual derivable from the inherent and the control rating? |
| `control-assurance` | A control in a period | Define population, sample, test attributes, classify deviations and root causes | Would an independent re-performance reach the same conclusion? |
| `incident-resilience` | A service under disruption | Map dependencies, set tolerances, test scenarios, measure elapsed time against limits | Has the fallback path been exercised under observation? |
| `regulatory-change` | An obligation | Determine applicability per entity, decompose, map, identify gaps | Is the chain complete from obligation to operating evidence? |
| `nfr-governance` | The portfolio | Aggregate with causal integrity, manage divergence, design the decision | Could a committee member reconstruct the causal chain from the pack? |

Six different units of analysis. A sampling method has no meaning for an obligation. A tolerance has no meaning for a contract clause. These are not variations of one method.

**Test 2: is the output artefact the same?** No. A classification decision, a residual rating, a test conclusion with a limitation, a tolerance statement with a measured outcome, a traceability map with gap states, and a committee paper are six different artefacts with six different audiences and six different failure modes.

**Test 3: would a practitioner in one role accept a conclusion produced by another's method?** This is the decisive test, and the answer is no. Jakob would not accept a control conclusion reached without a defined population, because it could not be re-performed. Marlene would not accept a residual rating that did not derive from a control environment rating, because it could not be defended at a workshop. Tobias would not accept an applicability determination stated at group level, because it is a category error. Nadia would not accept a tolerance statement without a measurement method, because it could not be evaluated, which is exactly what `ITOL-0004-03` demonstrates.

**Conclusion.** Lane 3 is function-specific. What is shared is the object model underneath it, the evidence layer feeding it, and the structure of "a professional conclusion" coming out of it: conclusion, method, evidence, limitation. That is real and worth building. It is not the method.

### 14.2 Lane 4: why it is both function-specific and deliberately unautomated

**Why function-specific.** Decision rights differ, authority bases differ, and the consequence of being wrong differs in kind.

| Role | Hardest lane-4 decision on 06.10.2026 | Authority basis | Consequence of being wrong |
|---|---|---|---|
| `tprm` | Breach, drafting gap or commercial dispute | Third-Party Risk Policy | A damaged Tier 1 relationship, or a forfeited contractual right |
| `rcsa` | Residual rating and whether to record dissent | Operational Risk Policy, RCSA dissent clause | A risk carried outside appetite with no cover, or a business alienated from its second line |
| `control-assurance` | Design versus operating, and whether to reopen his own conclusion | Control Assurance mandate | A conclusion that fails re-performance by Internal Audit |
| `incident-resilience` | Invoke an irreversible manual submission with 38 minutes of runway | Local resilience authority | CHF 18.7m missing a value date, or a manual-process error at scale |
| `regulatory-change` | Whether a stated position now needs to change | Compliance mandate, with Legal | A position on the record that the facts no longer support |
| `nfr-governance` | Whether a decision can be taken on the facts that will exist at the deadline | Committee secretary mandate | A lost quarter, or a decision the supplier's report invalidates |

**Why deliberately unautomated.** Four reasons, in order of force.

1. **Accountability requires authorship.** A materiality judgment carries a name. If a system proposes it and a human accepts it, the human has signed something they did not reason. Under challenge from a third line or a supervisor, "the system suggested it" is not a defence and everyone in the room knows it.
2. **Pre-selection is not neutral.** A default is a recommendation whatever the interface calls it. Showing Medium-High pre-selected on `RSK-0211` at 10:30 would have shaped a workshop that needed to be genuinely contested. The 1LoD position would have looked like dissent from the system rather than a professional position, which is precisely backwards.
3. **The reasoning is the product of the profession.** Marlene's judgment about what "no losses in 24 months" means is the thing she is paid for. Automating it does not accelerate her, it replaces her with something that cannot defend itself, on the one question where defence is the entire value.
4. **These decisions are contested by design.** `RSK-0211`'s rating has two legitimate answers held by two competent professionals. A system with one answer would be wrong half the time and confident always. The 16:41 resolution was better than either starting position and it required both to be held and argued.

**What the product does provide in lane 4**, and it is substantial:

- Everything known, classified, attributed and timestamped, with contradictions visible and unresolved.
- Everything not known, stated explicitly, including what would change the answer.
- The option set, complete, with what each option would change and who would have to act.
- Instant retrieval into the decision moment, so the decision is not made from memory.
- A decision record afterwards, capturing maker, authority basis, facts relied on with their classes, options considered, reversibility and review trigger.

The difference between that and automation is the difference between a fully briefed professional and a signature on someone else's conclusion. That distinction is the product's credibility with this audience, and it is not negotiable.

### 14.3 The residual risk in this design

Stated plainly, because a design document that claims no downside is not credible.

If lanes 1, 2 and 5 are automated well and lanes 3 and 4 are not, the risk is that lane 3 becomes the bottleneck and users experience the product as fast everywhere except where they work. Three mitigations, in order of importance.

1. **Lane 3 gets the best surface, not the leftover one.** The workbench is where a professional spends their judgment, so it is where the design effort goes. Lanes 1 and 2 are correct and quiet; lane 3 is where the product is good.
2. **Lane 2 must reach all the way into lane 3.** The value is not that evidence is retrieved, it is that it is retrieved already reconciled, already contradicted, already decomposed, so that lane 3 starts from a formed picture instead of a pile.
3. **Lane 5 must remove the entire administrative tail.** The reason practitioners do not have time to think is not that assessment is slow. It is that writing up, notifying, versioning, filing and chasing consume the afternoon. Removing that is what creates the time for lanes 3 and 4 to be done properly, which is the actual promise of the product.

---

## 15. Summary table: six roles, one page

| | `tprm` | `rcsa` | `control-assurance` | `incident-resilience` | `regulatory-change` | `nfr-governance` |
|---|---|---|---|---|---|---|
| **Person** | `P-002` Brunner | `P-003` Aigner | `P-004` Steinbacher | `P-005` Lehmann | `P-006` Reinhardt | `P-001` Vogt |
| **Unit of analysis** | An arrangement | A risk | A control in a period | A service under disruption | An obligation | The portfolio |
| **Primary object** | `TP-0042` | `RSK-0211` | `CTL-PAY-014` | `IBS-0004`, `ITOL-0004-03` | `REG-2026-0031`, `-0088` | `CMT-NFR-2026-10` |
| **Lane 3 core** | Classification, contractual sufficiency, assertion testing, chain and exit assessment | Assessment, control environment rating, appetite positioning, facilitation and challenge | Population, sampling, deviation and root-cause classification, conclusion with limitation | Dependency mapping, tolerance setting, scenario testing, severity, per-entity classification | Applicability, decomposition, traceability, gap analysis, dual-lane discipline | Aggregation with causal integrity, divergence management, acceptance lifecycle, decision design |
| **Hardest lane 4 call** | Breach, gap or dispute | Residual rating and whether to dissent | Design versus operating, and reopening his own conclusion | An irreversible fallback with 38 minutes of runway | Whether a stated position must change | Whether a decision can be taken on deadline-available facts |
| **Hero visualisation** | Supplier Dependency and Chain Graph | Risk and Control Heat Grid with movement trail | Control Evidence Chain and Population Waterfall | Impact Tolerance Runway | Obligation-to-Control Traceability Map, dual lane | Group NFR Position Board |
| **The different question** | Was the thing that saved us even in the contract? | Is this a new risk, or my risk finally showing its likelihood? | Did my test have the coverage to have found this? | How much time do I have, and does my fallback hold while I use it? | Which obligations did today touch, and does anything we stated need to change? | What decision does this group need, and can it be taken by Thursday noon? |

---

**Synthetic institution and data. Illustrative regulatory context, not legal advice.**

*End of `DOC-ROLE-WORK-ATLAS` version 1.0.*
