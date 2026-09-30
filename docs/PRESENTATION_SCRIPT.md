# PRESENTATION SCRIPT
## NFR WorkOS: Live the NFR Day
### Thirty minutes, sixteen scenes, five chapters

**Synthetic institution and data. Illustrative regulatory context, not legal advice.**

| Field | Value |
|---|---|
| Document ID | `DOC-PRESENTATION-SCRIPT` |
| Version | 1.0 |
| Status | Baseline |
| Date | 30.09.2026 |
| Owner | Executive Story Director |
| Audience | CRO and COO leadership, Head of NFR, Operational Risk, TPRM and Outsourcing, Operational Resilience and BCM, Technology and Cyber Risk, Compliance and Regulatory Change, Control Assurance, Internal Audit, CIO and CTO, AI governance and model risk |
| Market | Mid-sized and large banks in Germany, Austria and Switzerland |
| Total speaking time | 1,800 seconds, 30 minutes exactly |
| Scene data | `src/scenario/data/story.ts`, `STORY_SCENES` |
| Storyboard | `docs/STORYBOARD.md` |

---

## 0. How to present this

Four rules govern delivery. They matter more than any individual line below.

1. **Begin with the employee experience.** Technology is not named until scene 4. The word "agent" is not used until scene 15. The audience has to want the day before they are told how it is built.
2. **Be specific or be silent.** Every claim in this script names an object: `CTL-PAY-014`, `TP-0042`, `MSN-2026-0147`, `ITOL-0004-03`. A generic sentence in this script is a defect. If you cannot name the object, cut the sentence.
3. **State the limitation out loud.** Every inference in the product carries the reason it could be wrong. Read those reasons aloud. They are not caveats to be minimised; they are the reason a risk audience believes the rest.
4. **Do not oversell.** No time savings are asserted. No compliance claim is made. No external benchmark is used. Every number is labelled as measured in this simulation, illustrative, or client input required.

### Time budget

| Chapter | Scenes | Budget |
|---|---|---|
| I. Two mornings | 1 to 3 | 5 min 25 s |
| II. Work, lane by lane | 4 to 5 | 3 min 20 s |
| III. One professional day | 6 to 11 | 11 min 0 s |
| IV. One event, six questions | 12 to 14 | 6 min 25 s |
| V. Authority and adoption | 15 to 16 | 3 min 50 s |
| **Total** | **16** | **30 min 0 s** |

### Standing answers

Three questions arrive in almost every room. Prepared answers, to be given once and briefly.

- **"Is this real?"** It is a running prototype on a synthetic institution, Arcadia Banking Group, for one fixed day, Tuesday 06.10.2026. The data is seeded and reproducible. It is not deployed at a bank.
- **"How much does it save?"** We do not assert a saving. We do not know how long your people take, and asserting it would be an invented figure. What we can show is that the morning reconstruction produces no professional artefact, and that the decisions arrive earlier and better briefed.
- **"Is it compliant?"** The product makes no compliance claim about anything. It states what an obligation appears to require, what evidence exists, and what is missing. Every regulatory reference carries the label "Illustrative regulatory context, not legal advice." at the point of display.

---

# CHAPTER I. TWO MORNINGS

Scenes 1 to 3. Five minutes twenty-five seconds. The chapter has one job: recognition, then relief. If the audience does not recognise scene 2, nothing after it lands.

---

## Scene 1. Live the NFR day.

**Time budget:** 45 seconds.

**Subtitle on screen:** What changes when AI operates the work around the risk professional.

**On screen.** A dark field. Eight signal fragments drift at different depths, each with a small source chip: 61 unread messages; override rate 3.84 per 10,000; four exceptions and two unable to conclude; 67 days overdue; reviewer capacity 75.0%; 198 of 214 questionnaire responses; appendix v4.2 against register v6.1; workshop at 10:30. Over four seconds they converge into a single calm object at centre: one decision, with an owner, a question, and a stated unknown. Lower left, persistent: "Synthetic institution and data." Lower right: the date line.

**Presenter says.**

> This is one working day inside a bank. Tuesday, the sixth of October, 2026. Arcadia Banking Group: Frankfurt, Vienna, Zurich, sixteen thousand people, and a corporate payments business that moves about two and a half million instructions a month.
>
> Arcadia is not real. Everything you are about to see is synthetic data for one fixed day, and it is reproducible, which matters because I am going to quote numbers at you and you are entitled to ask where they come from.
>
> Six people work this day. A third-party risk manager, an operational risk partner, a control assurance specialist, a resilience lead, a regulatory change manager, and the portfolio lead who has to put all of it in front of a committee.
>
> At two minutes past two in the afternoon, something happens. But the interesting part of this day is not the event. It is the morning.

**Key message.** This is a working day you can step into, not a capability list you have to imagine.

**Transition.** The converged object dissolves back into its fragments. The clock appears and reads 07:42. Say nothing over the transition.

**Likely questions.**

| Question | Answer |
|---|---|
| Is this a product you have built, or a concept? | A running prototype on a synthetic institution, for one day, reproducible. It is not deployed at a client. |
| Why a synthetic bank rather than our own data? | Because a synthetic institution lets us build the uncomfortable facts in on purpose: an overdue action, a supplier notification that is wrong, an impact tolerance that cannot answer its own question. Your data comes in phase one, and we will get to that. |

---

## Scene 2. The day begins by reconstructing the work.

**Time budget:** 140 seconds.

**Subtitle on screen:** 07:42 in Frankfurt. Eight surfaces, none of which tells anyone what today is about.

**On screen.** Eight cards in a deliberately uneven grid, each with a source chip naming the system it came from. No card connects to any other. Below the grid, a strip of the eight systems actually opened. Bottom right, the elapsed figure, labelled as measured in this simulation.

**Presenter says.**

> Seven forty-two. Nobody has done anything wrong yet today, and nobody has done anything useful either.
>
> Stefan Brunner runs third-party risk. He opens his mail to sixty-one unread messages. Seven of them relate to Novalink, the payments supplier. Which seven, he finds out by opening them.
>
> Marlene Aigner covers operational risk for payments. Her key risk indicator report arrived yesterday morning as a thirty-four page PDF, with three red rows on page eleven. Underneath one of those rows sits the actual finding of the day, and it is only visible if she builds a pivot table by hand from a spreadsheet of seven hundred and thirty-one override records that Payment Operations emailed her last Thursday. She has a workshop at half past ten. On a normal morning, she does not build the pivot table.
>
> Jakob Steinbacher tests controls. He is due at a control owner challenge meeting at ten thirty, and as an observer at Marlene's workshop from a quarter past eleven. Nothing on his screen tells him that his own open conclusion is what is blocking her workshop.
>
> Nadia Lehmann runs resilience from Zurich. She is about to send Stefan an email asking whether a supplier disaster recovery question has been escalated. The answer already exists, in a tracker she cannot see.
>
> Katharina Vogt owns the portfolio. Her dashboard shows four red indicators, in four rows, owned by four people. Committee papers close on Thursday at noon and three of five decision items are undrafted. One remediation action is overdue and the dashboard does not tell her by how much, so she calculates it herself. Sixty-seven days.
>
> Now, here is the part that should make you uncomfortable. Items two, three, four and ten on this board are not four problems. Override volume rose because the primary clearing route failed five times in September. Reviewer capacity is at seventy-five per cent. The control that governs overrides has four exceptions and two items nobody could conclude on. And the remediation action that would have prevented one of those exceptions is sixty-seven days late.
>
> That is one problem with four symptoms, and it points at a specific rule in a specific supplier system that nobody has looked at. Nothing on any of these eight screens says so. And I want to be fair to the bank here: every one of these systems is correct on its own terms. The connection is nobody's system of record, so it is nobody's output.

**Key message.** The first hour of an NFR day is spent assembling a picture, and the assembly produces no professional output.

**Transition.** The clock ticks to 07:45. The eight cards collapse inward. Three remain.

**Likely questions.**

| Question | Answer |
|---|---|
| Is this not just poor tooling discipline? | Partly, and we do not excuse it. But the GRC platform correctly holds the indicator, the mail client correctly holds the request, the contract repository correctly holds the appendix. None of them is wrong. The causal connection belongs to no system, so it belongs to no one. |
| How much of that first hour is genuinely wasted? | We do not claim a time saving because we cannot measure what your people take. What we can say is that the reconstruction produces no assessment, no conclusion and no decision. It is orchestration work priced as professional time. |
| Our people would say the pivot table is where the insight is. | They are right, and that is the point. That finding exists only because someone had spare capacity. Insight that depends on spare capacity is not a control. |

---

## Scene 3. The future starts with decisions, not notifications.

**Time budget:** 140 seconds.

**Subtitle on screen:** 07:45. The same eight surfaces, resolved into three decisions that carry an owner and a deadline.

**On screen.** Three decision cards, centred. Each has a question, a "what is known" block, a "what is not known" block, an owner chip, and a destination. The eight source signals persist along the lower edge as small provenance chips. A read-only badge sits at the top of the frame.

**Presenter says.**

> Seven forty-five. Same person, same data, three minutes later. Nothing has been added to the world.
>
> This is Marlene's morning. Three decisions.
>
> The first one. Three red indicators: does she request three separate first-line explanations, which is procedurally correct, or one causal investigation, which is analytically useful and procedurally unusual? Here is what the brief knows. The override indicator is at three point eight four against a red threshold of three point five, the first red in fourteen months. It decomposes by reason code: route substitution up five hundred and thirty-nine per cent, cut-off driven release up one hundred and twenty-four per cent, and the other three components close to flat. The route substitution growth lines up with five clearing route failures totalling eight hours forty minutes in September, against one hour in August.
>
> And here is what the brief says it does not know, which is the part I want you to read with me. The override records carry no field linking them to a specific route failure. So the attribution is temporal, not recorded. One hundred and eighty-one of one hundred and ninety-eight route substitution overrides fall inside those windows. Seventeen do not. And those seventeen are exactly the fact that would weaken her argument.
>
> The second decision is the residual rating on the payment release risk, and the gap between the two positions is not a numerical quibble. Nine means monitor. Twelve means the accountable executive commits to dates or signs a Risikoakzeptanz. Her workshop is at half past ten.
>
> The third is whether a clean loss register over twenty-four months is evidence about likelihood. The brief points out that the detective control on this risk reconciles value, not authorisation, so a correctly valued payment sent to the wrong beneficiary would pass it. A clean register with unproven detection is silence, not evidence. The brief says that and then stops. It does not choose.
>
> One more thing, and it is the most important line in this scene. The morning brief writes nothing. Not one field in the system of record. A brief that updates the record before the human has read it has inverted the accountability.
>
> Behind this screen, twenty-three actions ran before she arrived. Seven organising, sixteen retrieving and reconciling. Seven evidence artefacts touched. Zero awaiting release, because nothing was written. One draft prepared and not yet accepted. Every one of those twenty-three is a row you can open, with its inputs, its outputs and its duration. A number without a list is a claim.

**Key message.** The morning brief ranks decisions, states what is not known, and writes nothing until a person decides.

**Transition.** One card is pulled apart into the five kinds of work that produced it.

**Likely questions.**

| Question | Answer |
|---|---|
| How do you decide what counts as a decision worth surfacing? | Deterministically, and the ranking is inspectable. Hard deadline, dependency chain, proximity to an escalation rule, which entity is accountable, and whether the item blocks another person. The brief shows why an item ranks where it does, so the ranking can be argued with. |
| What stops the brief being confidently wrong? | Provenance on every claim, so a wrong claim is traceable. And every inference carries the specific reason it could be wrong: here, the seventeen overrides outside the windows. |
| Three cards for a whole morning seems few. | Three is what this role has at 07:45 in this scenario, not a design target. The rest of the work is ranked below and one click away. The claim is about sequence, not volume. |

---

# CHAPTER II. WORK, LANE BY LANE

Scenes 4 to 5. Three minutes twenty seconds. This chapter stops the audience worrying that you are automating judgment. Do not rush it and do not soften it.

---

## Scene 4. Not every part of NFR work changes in the same way.

**Time budget:** 125 seconds.

**Subtitle on screen:** Five lanes of work. Three are shared infrastructure, two are professional practice, and one produces no automated action.

**On screen.** Five horizontal lanes stacked as a ladder. Each lane fills from the left in one of two tones: shared infrastructure, or professional practice. Lane 4 stays deliberately unfilled. Each lane carries its common-share figure with an "illustrative" basis label.

**Presenter says.**

> Now the mechanics, and this is where I want to be precise, because "AI for risk management" usually means something vague and occasionally means something alarming.
>
> Non-financial risk work splits into five lanes.
>
> Lane one, Organise. Turning an unstructured day into a sequenced, owned, deadline-aware set of work. Triage, priorities, dependencies, chasing, routing, meeting packs. This is the largest share of the day and the smallest share of the judgment, which is exactly why it is the strongest candidate for automation and the weakest candidate for differentiation. Jakob finding out at quarter to eight that his open conclusion blocks Marlene's workshop is lane one. No system he uses today can tell him that.
>
> Lane two, Understand. Getting the facts, proving where they came from, and noticing what they mean together. Retrieval with provenance, reconciling two sources of one fact, decomposing a headline movement into components, and the hard one: detecting that two statements about the same object cannot both be true, attributing each, and not resolving it. Today, comparing a contract appendix against a supplier register takes Stefan sixty to ninety minutes on two monitors with a notepad.
>
> Lane three, Assess. The function-specific professional work the role exists to do. This is where a third-party risk manager and a control assurance specialist genuinely do different jobs, with different method, different output and different standards of sufficiency. What changes here is that the professional opens onto a formed picture instead of a search box, and receives a prepared draft with the conclusion cell left empty.
>
> Lane four, Decide. Materiality, interpretation, challenge, negotiation, acceptance, escalation, accountability. Lane four has one hard property and I will say it as plainly as I can: it produces no automated actions. The system retrieves on demand, shows what is known and what is not, and models what each option would change. It does not rank the options, it does not pre-select, and it does not draft the rationale before a person has formed one. A rubber-stamped materiality assessment is worse than no assessment, because it carries a signature.
>
> Lane five, Execute. Writing the outcome into the system of record with an audit trail. High volume, low judgment, and because it is where the audit trail is created, most banks treat it as too sensitive to touch and leave it manual. That is the wrong resolution. The right one is that every write carries five things or it is rejected.
>
> Three of these five are built once. Two are not. If that claim holds, this is one work environment with six configurations. If it does not hold, it is six products and it is not economic to build. The percentages on screen are design targets for planning. They are not measurements.

**Key message.** Organise, Understand and Execute are built once. Assess and Decide stay with the professional, and Decide stays unautomated on purpose.

**Transition.** The Assess lane splits into six strands, one per role.

**Likely questions.**

| Question | Answer |
|---|---|
| Why is Decide unautomated rather than assisted with a recommendation? | Because a recommended residual rating that a person signs is a rubber stamp carrying a signature. That is the single output that would make a second line indefensible in front of an auditor. |
| Where do the percentages come from? | They are design targets for planning this product, labelled illustrative. Not measurements, not external studies. If Assess turns out to be forty per cent common rather than twenty, the plan changes. |
| If Assess is function-specific, are you building six products? | That is the real risk and we test it rather than assert it. The common part of Assess is the object model, the evidence layer, and one structure for a professional conclusion: conclusion, method, evidence, limitation. If that does not hold, this is six products. |

---

## Scene 5. One work environment. Multiple professional lenses.

**Time budget:** 75 seconds.

**Subtitle on screen:** Six roles, one shared object model. The lens changes the question, the method and the visual, not the environment.

**On screen.** A single framed environment with a six-position lens selector. Switching the lens re-renders the central stage while the frame, the provenance rail and the audit strip stay fixed. Each lens shows its unit of analysis and its "different question".

**Presenter says.**

> One environment, six lenses. What stays fixed is the object model, the evidence layer with its provenance, the classification of every fact, and the audit trail. What changes with the lens is the unit of analysis, and therefore what counts as a complete answer.
>
> Third-party risk: the unit is an arrangement. Operational risk: a risk. Control assurance: a control in a period. Resilience: a service under disruption. Regulatory change: an obligation. Portfolio: the portfolio itself.
>
> Six genuinely different pictures, not one dashboard with a filter. A concentric supplier chain graph. A five by five grid with a movement trail. A test population waterfall. A tolerance runway where time is the primary axis, which is the correct primary axis for resilience and almost the last one GRC tools use. A two-lane obligation map. A position board built to be readable in ninety seconds by a chief operating officer.
>
> And each of them asks a question the other five do not ask. Stefan asks whether the thing that saved us was even in the contract. Nadia asks how much time she has and whether the arrangement she is relying on holds while she uses it. Jakob asks whether his test had the coverage to have found something. Those are not variations of one question. They are the reason the lens exists.

**Key message.** Each function keeps its own unit of analysis and hero view, while the evidence layer and the audit trail stay shared.

**Transition.** The lens settles on third-party risk and the environment loads the 08:10 queue.

**Likely questions.**

| Question | Answer |
|---|---|
| Is this one product or six? | One environment with six configurations, on the claim that Organise, Understand and Execute are shared. If the shared share comes out materially lower in build, the honest answer changes and so does the plan. |
| Our functions sit in different reporting lines and countries. | So do these. Three group mandate, one seconded from the Austrian entity, one in Zurich with a group remit, one reporting to the Chief Compliance Officer. The environment holds entity partitioning because the accountability is genuinely local and local sign-off cannot be absorbed by a group function. |

---

# CHAPTER III. ONE PROFESSIONAL DAY

Scenes 6 to 11. Eleven minutes. This is the chapter the audience should want. Slow down in scene 11.

---

## Scene 6. The TPRM manager opens three decisions, not five systems.

**Time budget:** 115 seconds.

**Subtitle on screen:** 08:10. Contract, questionnaire tracker, evidence vault, register and mailbox arrive as three decisions with deadlines.

**On screen.** A three-row decision queue with deadline, dependency and blocking chips. Along the lower edge, five dimmed provenance tiles: the systems he does not open.

**Presenter says.**

> Ten past eight. Stefan opens three decisions. Let me name the five things he does not open. The contract repository, through the document management system search. A questionnaire tracker spreadsheet, version fourteen, last edited by him at twenty to seven on Friday evening. The evidence vault, artefact by artefact. The supplier client portal. And the shared supplier mailbox, message by message.
>
> Decision one. The binding subprocessor appendix and the supplier's current register do not agree. Reconciled row by row: one subprocessor in Pune absent from the appendix entirely, one hosting region in Amsterdam not listed, two nodes matching, and fourth parties not addressed by the appendix as drafted. The limitation is stated: no notice for the Pune subprocessor exists in the contract repository, and that is evidence of absence in Arcadia's records, not proof that no notice was given. The search covered the repository and two shared mailboxes. It did not cover individual mailboxes.
>
> Decision two is the one I find most recognisable. A supplier disaster recovery test report has been sitting in the evidence vault for one hundred and thirty-seven days. It covers two hosting regions and not the Swiss one. Contracted recovery time objective, two hours. Tested outcome, three hours forty. No explanation, no remediation plan, no notification. Nobody was negligent. The artefact was filed and after filing it had no owner.
>
> Decision three. Reassessment deadline in twenty-five days, or the appendix divergence, which has no deadline at all. He chooses the divergence, on the reasoning that the reassessment can close on time carrying an open item, and the divergence cannot be resolved without a contractual route that takes weeks.
>
> Notice what has and has not changed. He still reads the clause. What he no longer does is reconstruct the picture from five surfaces before he can use it.

**Key message.** The work environment replaces the assembly, not the assessment.

**Transition.** He opens the first decision and the supplier exposure graph draws itself around the Novalink node.

**Likely questions.**

| Question | Answer |
|---|---|
| Does this replace our GRC platform? | No. The GRC platform stays the system of record, and every write goes into it with an entity partition, a record identifier, an accountable human and an evidence reference. |
| He still has to read the contract. What actually changed? | He reads the clause, not the repository. The reconciliation is done and evidenced per row, so his time goes on the question that needs him: is the Amsterdam region a material change requiring notice, or a drafting gap. |
| What if the reconciliation is wrong? | Then it is wrong visibly. Every row carries both source versions and their dates. In this scenario he overrode two of the gap classifications, and both overrides are recorded against his name. An assessment you cannot override is not an assessment. |

---

## Scene 7. AI prepares the risk position. The professional challenges the supplier.

**Time budget:** 130 seconds.

**Subtitle on screen:** 10:30, monthly supplier governance review. He arrives with four asks and dates, not four questions in a spreadsheet.

**On screen.** Concentric chain graph. Novalink at centre, the three entities inward, four subprocessors outward, one fourth party furthest out and visually thinner. Two overlays: appendix against register, and asserted against observed.

**Presenter says.**

> Half past ten. The supplier governance review. Today, this meeting goes like this: the supplier arrives with a deck, presents green service levels, Stefan raises three of his four open questions, gets two deferrals and one "we will come back to you", forgets the fourth, and the supplier writes the minutes.
>
> Here is what he walks in with instead.
>
> The chain, three levels deep. Novalink at the centre, Tier 1, six point eight five million euro a year, sole provider for payment validation, payment repair tooling and Swiss clearing connectivity. That concentration is the single most important structural fact about this relationship.
>
> Then the badge that makes this scene. Every node carries two states: in the binding appendix, and in the supplier's current register. Two nodes diverge. A service desk provider in Pune, with read access to payment metadata including beneficiary names, present in the register and absent from the appendix, onboarded in May with no notice on record. And a hosting provider listed with one region where it now runs two. Furthest out, thinner, a fourth party in Dublin holding payment reference metadata for twenty-four months, which the appendix does not see at all because it obliges notice of subprocessor changes and is silent on their subcontractors. That is a drafting gap, not a breach, and the professional judgment is precisely to record it as one.
>
> Now flip the overlay from evidence freshness to asserted against observed. Recovery objective: two hours asserted, three hours forty observed. Availability: ninety-nine point seven contracted, ninety-nine point six two calculated by Arcadia.
>
> And here I have to be scrupulous, because the supplier's deck this morning says ninety-nine point seven four. The zero point one two difference is fully explained by the treatment of one maintenance overrun of two hours five minutes on the eleventh of September. Novalink treats the whole window as planned. Arcadia treats the overrun as unplanned. The appendix does not define it. Neither figure is wrong under the contract as drafted.
>
> So what does Stefan do with that? He does not contest the number. He raises it as a definitional gap and asks for the overrun treatment to be agreed in writing by the twentieth of October. That converts an argument nobody can win into a contract variation nobody can refuse.
>
> The system sequenced his four asks so the two the supplier can concede cheaply come first. It did not think of that reframing. That reframing is the value of the hour and it is exactly the part we do not automate.

**Key message.** Preparation is machine work. Challenge is professional work, and the meeting produces commitments rather than discussion.

**Transition.** The graph holds its node positions while labels morph from suppliers into processes, risks and controls.

**Likely questions.**

| Question | Answer |
|---|---|
| Where does the supplier data come from in practice? | Here, from the seeded synthetic contract set, questionnaire responses and supplier register. In a deployment, from your contract repository, your questionnaire platform and the supplier portal, and the reconciliation is only as good as the versions you can retrieve. That is the integration cost and we do not minimise it. |
| A fourth party the contract does not cover. Is that a breach? | No, and the distinction matters. The appendix obliges notice of subprocessor changes and is silent on their subcontractors. A drafting gap, and it goes to a contract variation rather than to a breach notice. |
| Could the system have drafted his negotiating position? | It drafted the sequence. It did not decide to reframe a dispute as a definition. |

---

## Scene 8. Switch the role. Keep the environment.

**Time budget:** 70 seconds.

**Subtitle on screen:** The supplier exposure graph reshapes into the process, risk and control graph. Same objects, different professional question.

**On screen.** One continuous morph. Node positions are preserved while labels, edges and the legend cross-fade from the supplier chain into the process, risk and control graph. A small audit chip records the role switch.

**Presenter says.**

> Same environment. Different professional.
>
> Watch the supplier node. It does not disappear. The payment repair workbench was a service under a contract thirty seconds ago. Now it is the system dependency of the only preventive control on an operational risk. Same object, two directions.
>
> What travels across the switch: the evidence objects with their versions and dates, the classification of every fact, the scenario clock, and the open disagreement on the control with both positions still attributed to their owners.
>
> What changes: the authority. Marlene can rate a risk. Stefan cannot. Stefan can change supplier criticality. Marlene cannot. And the role switch itself is written to the audit trail, with the acting user, the previous role, the new role and the time. A change of lens that leaves no trace would be a control weakness.

**Key message.** The role switch changes the lens and the authority, and it keeps the evidence, the provenance and the audit trail.

**Transition.** The control node pulses once and the operational risk workbench opens.

**Likely questions.**

| Question | Answer |
|---|---|
| Can one person hold several roles? | The acting role is explicit and the authority scopes follow it, and switching is a recorded action. Whether one person should hold two of these mandates is your operating model question. |
| Does the second role see everything the first one saw? | The same objects where its permissions reach, with the provenance travelling with them. It does not inherit the first role's authority. A retrieval crossing roles is counted once and appears in the second role's ledger as a reuse. |

---

## Scene 9. The RCSA starts with what changed.

**Time budget:** 115 seconds.

**Subtitle on screen:** Eleven risks in scope. Ten are unchanged and say so. One moved, and the workbench opens on the movement.

**On screen.** Left, a delta list: ten collapsed unchanged rows, one expanded. Right, the five by five grid with a three-point movement trail crossing the appetite line, each segment carrying its driver as an openable object.

**Presenter says.**

> Quarter to nine. The quarterly self assessment. Eleven risks in scope. Ten materially unchanged, and the workbench says so rather than making her check. That is what a cycle actually looks like, and unchanged here is computed against each risk's own drivers, not assumed. If a driver moved and the position did not, the row is flagged rather than collapsed.
>
> One risk moved: erroneous or unauthorised payment release.
>
> Look at the trail. Third quarter, signed in July: residual six, medium-low, within appetite. Fourth quarter, first line position: nine, medium, still within appetite. Fourth quarter, second line proposal: twelve, medium-high, outside appetite. And the appetite line is drawn at ten, running between the second position and the third.
>
> Each segment carries its driver as an object you can open. Six to nine carries reviewer capacity at seventy-five per cent, with the vacant position identifier and the leaving date. Nine to twelve carries the control test conclusion.
>
> And the component finding, the one that needed a hand-built pivot table an hour ago: route substitution overrides went from thirty-one in August to one hundred and ninety-eight in September. Cut-off driven releases from ninety-four to two hundred and eleven. Those are not error indicators. They are pressure indicators. More payments released against a cut-off, with incomplete data, by fewer reviewers. That is the morning's real finding and it precedes the afternoon by six hours.
>
> The limitation travels with it. One hundred and eighty-one of one hundred and ninety-eight inside the windows. Seventeen outside.
>
> And then the thing I would ask you to look at hardest. The prepared worksheet carries the inherent scores forward, and every residual cell is empty. A worksheet that arrives with a residual score in it has taken the assessment away from the assessor.

**Key message.** A quarterly assessment should begin at the delta, with the driver of each movement attached as an object rather than a label.

**Transition.** The workbench closes and the workshop table assembles with the established facts already on it.

**Likely questions.**

| Question | Answer |
|---|---|
| How do you know ten risks are unchanged rather than unexamined? | Unchanged is computed, not assumed, and the check is listed per risk. A moved driver with a static position is flagged. |
| Is the movement trail not a prettier heat map? | The difference is the driver on the segment and the bracket on the disagreement. Where two lines disagree, this draws two nodes joined by a bracket with the appetite line between them. Most tools cannot draw that, which is why disagreements get resolved by dilution. |
| Who owns the delta if the system produced it? | The facilitator. She accepted the structure and she carries the reasoning into the room. In this scenario she also finds out later that her rating was right and her reasoning was incomplete, and we show that rather than hide it. |

---

## Scene 10. The meeting is for judgment, not evidence exchange.

**Time budget:** 115 seconds.

**Subtitle on screen:** 10:30 workshop. The four established facts are on the table before anyone speaks, so the argument starts where it matters.

**On screen.** A table with four fact cards laid flat and agreed, and two position columns rising either side of one contested question.

**Presenter says.**

> Half past ten. Nine people, ninety minutes, Munich and video.
>
> Today, this workshop spends its first twenty-five minutes establishing what the control test found, because the control owner and the process owner have read the report differently. It reaches the contested risk at twenty past eleven with forty minutes left and a room that has already decided. Then it nods through the other ten risks in the last quarter of an hour.
>
> Here, four facts are on the table before anyone speaks. Population: one thousand two hundred and four overrides across three entities. Sample: sixty, statistical attribute sampling. Result: fifty-four clean, four exceptions, and two on which the tester could not conclude. Two deviation rates follow, six point six seven per cent counting exceptions alone, ten per cent treating the unconcludable items as deviations, against a tolerable rate of five. And the control characterisations: one preventive control, partially effective; one detective control operating next business day on a ten per cent sample; one control reconciling value rather than authorisation.
>
> So the argument in this room is one question. Can two detective compensating controls substitute for one preventive control rated partially effective?
>
> Both positions are strong and I want to give the first line its best form, because presenting it weakly would be dishonest and also unpersuasive. Her team followed the documented process in every case. None of the four exceptions caused a loss. All four payments were later confirmed correct by the clients. Two compensating controls do operate. The vacancy is being recruited.
>
> Second line: the only preventive control here is partially effective, a detective control cannot prevent a release, a ten per cent next-day sample covers ninety per cent of nothing, a value reconciliation would pass a correctly valued payment sent to the wrong beneficiary, the vacancy has no start date, and two of six flagged items cannot be concluded at all, so the true deviation rate is unknown rather than six point six seven.
>
> And the system's own statement, which it puts on screen: it has characterised the three controls and it cannot resolve the question, because the question is about sufficiency. Both positions are internally consistent.
>
> One structural detail worth stealing. The contested risk is third on the agenda, not first, so the room arrives at it with momentum instead of spending ninety minutes there.

**Key message.** When the facts are agreed in advance, ninety minutes buys a real disagreement instead of twenty-five minutes of reconciliation.

**Transition.** The two columns resolve into two nodes on the risk grid, joined by a bracket.

**Likely questions.**

| Question | Answer |
|---|---|
| What if the first line disputes one of your established facts? | Then it is not established, and it moves into the contested column with both positions attributed. In this scenario the control owner made three assertions in the morning and two of the three were confirmed correct, which is shown rather than smoothed over. |
| Does the system write the minutes? | It records the discussion with both positions attributed and the facilitator releases it. The bigger change is that the ten uncontested positions are recorded as the workshop passes them, so the closing minutes are free. |
| Is this not just better pre-reading? | Better pre-reading nobody has read changes nothing. Here the facts are in the room as objects with evidence attached, so a participant who did not read the pre-read still starts from the same picture. |

---

## Scene 11. The human owns the rating.

**Time budget:** 115 seconds.

**Subtitle on screen:** 11:58. No agreed rating, a recorded dissent, and an escalation with both positions stated in their owners terms.

**On screen.** The five by five grid. Two nodes joined by a bracket. The appetite line drawn between them with the policy sentence attached. A faint inherent-to-residual vector per position. Two itemised panels: what the system prepared, and what the system declined to do.

**Presenter says.**

> Two minutes to twelve. This is the scene that earns the right to everything else, so let me slow down.
>
> The grid does not move when evidence arrives. Evidence changes the argument. A human changes the rating.
>
> Here is what the system prepared. Three positions side by side. The appetite boundary drawn at ten, with the policy sentence attached to the line rather than buried in a paragraph. Each trail segment carrying its driver. The three controls characterised. The loss history retrieved with the detection caveat attached to it. A worksheet with every residual cell empty. And a dissent record structure holding both positions with no adjudication.
>
> And here is what it declined to do. It did not propose a score. It did not highlight one position as more likely. It did not average nine and twelve, and it did not present a range as though a range were a position. It did not draft her rationale. It did not move the node when new evidence arrived during the day. And it did not resolve the sufficiency question, which is the judgment her role exists to make.
>
> At two minutes to twelve she records a formal dissent. No agreed rating. Both positions stated in their owners' terms, escalated to the group committee. That choice costs her a resolved workshop and buys the committee a real decision.
>
> Now the honest coda, because this is where most demonstrations would stop. At twenty-three minutes to five that afternoon, the two of them sign one sharper conclusion together: partially effective, with a design deficiency shared with the supplier and an operating deficiency covering three human deviations. The residual moves to medium-high by agreement, not by escalation. That record supersedes the one from noon, and the product shows it as a supersession with history, not as a correction.
>
> And the reason that outcome is better than either of them winning: the control owner was right about her team and wrong about the system. The assurance specialist reached the right conclusion and had missed the root cause four weeks earlier. Neither of them lost. The disagreement resolved into precision.

**Key message.** The system prepares the position and records the outcome. It does not move the node, and a disagreement is allowed to stay a disagreement.

**Transition.** The bracket holds. The clock jumps to 14:05 and a supplier notification lands in the corner of the frame.

**Likely questions.**

| Question | Answer |
|---|---|
| Would it not be more useful if it recommended a rating? | More useful in the moment and less defensible afterwards. That is the one output that would make your second line indefensible in front of an auditor. |
| How do you prevent quiet dilution of a disagreement? | By making the disagreement a first-class object: two nodes, one bracket, both owners, both dates, no average. The product cannot collapse it, so the only resolution is a sharper agreed statement. |
| What does the audit trail record here? | Decision identifier, maker, authority basis, facts relied on with their classifications, options considered without a ranking, reversibility, and the review trigger. The noon dissent stays in history with a pointer to the record that supersedes it. |

---

# CHAPTER IV. ONE EVENT, SIX QUESTIONS

Scenes 12 to 14. Six minutes twenty-five seconds. Keep the pace controlled. The event is not the climax; scene 14 is.

---

## Scene 12. One event reaches every NFR function.

**Time budget:** 135 seconds.

**Subtitle on screen:** 14:05. A supplier notification says no customer impact. Two minutes later Arcadia telemetry disagrees.

**On screen.** A vertical time spine from 13:31 to 16:30. Arrivals dock left and right, each with a classification chip: verified fact, stakeholder statement, telemetry inference. Three entity lanes run beneath as consumed-tolerance bars.

**Presenter says.**

> Five past two. A supplier notification arrives, and I will read it to you exactly.
>
> "Degraded performance affecting clearing submission in the DACH region. Investigation ongoing. Severity P3. No customer impact identified at this time."
>
> Two minutes later, Arcadia's own monitoring disagrees. Submission acknowledgement latency has gone from a seven-day median of one point four seconds to forty-two seconds, starting at twenty-two minutes to two. Two thousand three hundred and seventeen instructions are waiting for acknowledgement. And note how that arrival is labelled: telemetry inference, not fact, because the latency is measured at the Arcadia edge and a firewall change on Arcadia's side would look identical.
>
> The technical start was half past one. The supplier notified at five past two. Arcadia detected at seven past. That is a thirty-four minute detection gap, and we will come back to why.
>
> At twelve minutes past two, the acting duty manager invokes the runbook and switches clearing to Arcadia's own direct link. That decision is correct, inside her authority, and it is the right call. The direct link performs no payment data validation, so payments that the gateway would have enriched now arrive broken and enter the repair queue. Queue depth goes from sixty-one items to four hundred and ninety-four in fourteen minutes.
>
> And now the rule.
>
> There is one configuration line in the supplier's repair workbench. Where the override reason is route substitution, and fallback mode is active, and the value is under two hundred and fifty thousand euro, it sets independent secondary review to not required, with a waiver code reading "business continuity throughput". It entered Arcadia's tenant in a supplier release on the eleventh of November 2024, applied from a standard configuration template. Arcadia's change approval went through on release notes that mentioned continuity throughput improvements and did not mention a control waiver. The control description says review applies to all overrides without exception, and it has not been updated since January 2025.
>
> In fourteen minutes, one hundred and thirty-eight route substitution overrides. Ninety-six of them with no review required and no reviewer. Nine million four hundred and twenty thousand eight hundred and eighty euro. Every single one individually below the threshold.
>
> And the part that should genuinely trouble a risk committee. This rule already appeared in the September control test, as exactly one exception, with the root cause recorded as "system configuration", closed with a low-priority documentation action that had not been started. The finding existed forty-one days earlier. The rule had already fired twenty-two times.

**Key message.** Facts arrive late, incomplete and in conflict, and the decisions cannot wait for them.

**Transition.** The spine stays fixed and the frame splits into six panels.

**Likely questions.**

| Question | Answer |
|---|---|
| Is the supplier the villain? | No, and that is the uncomfortable part. The notification was wrong and late. But the rule sat in Arcadia's tenant, entered through an Arcadia change approval, against a control description twenty months out of date, and the same finding was closed as a curiosity six weeks earlier. The hardest question of the day is about Arcadia's own follow-up discipline. |
| Would your system have caught this beforehand? | It surfaced the pieces at 07:45: the component growth, the capacity, the control conclusion, the overdue action, and a runbook assertion that contradicts the control inventory. It had not read the supplier's tenant configuration, because that needed a formal request under the audit and access clause, which a human made at 15:38. It would have made the question obvious and it would not have had the answer. |
| Ninety-six payments without four-eyes. Is that a regulatory breach? | We do not make that call and the product does not either. It states that the internal tolerance is zero for releases with an unsatisfied mandatory gate, that there are ninety-six candidate breaches against it, and that the assessment is owned by named people with a committee destination. Illustrative regulatory context, not legal advice. |

---

## Scene 13. Same event. Different professional question.

**Time budget:** 135 seconds.

**Subtitle on screen:** Six functions read the same arrivals. Each one asks a question the other five do not ask.

**On screen.** Six panels around the fixed event spine. Selecting one expands its question, its first arrival and its output, while the other five stay legible as context.

**Presenter says.**

> Same eighteen arrivals. Six professionals. Six different questions.
>
> Third-party risk reads the five past two notification as a contractual notice failure before it is an incident: five of six mandatory fields missing. By half past four he has four assurance failures rather than service failures, and the most serious one has nothing to do with the database. The supplier's ability to detect its own incidents depends on one monitoring provider in Brno whose monitoring was pinned to the failed region until five to three. Every notification commitment in that contract rests on one node that has now demonstrably failed.
>
> Operational risk sees her own risk doing exactly what she said it would do, four hours later, by a mechanism she had not identified. Her rating of twelve stands. Her reasoning does not. She thought the control was weakened by capacity and discipline. She did not know it switches itself off when the fallback route is active. And the September component analysis she read as a capacity story was in fact the leading indicator. Every September activation was a rehearsal, and each one waived the control for its duration.
>
> Control assurance watches his own test re-run itself at full coverage. His conclusion was right and under-argued, because his design testing compared the description to the operation rather than to the implemented configuration. Worse, his population was bounded by time and the rule is bounded by condition. A condition-bounded population would have caught all twenty-two prior firings in September. That is a testable hypothesis about every control in the internal control system whose enforcement depends on a system state, and it came out of one incident.
>
> Resilience sees time running out in three lanes at different speeds, and the tightest lane is her own entity, which has no fallback route. At nine minutes past three the Swiss queue has been building for eighty-two minutes, the tolerance limit is at a quarter to four, the same-day cut-off is at four, and the only option takes forty-five minutes to prepare. Runway thirty-eight minutes. The option is longer than the runway. So she cannot wait and then act. The decision goes at seven minutes past three, thirty-one minutes before anyone knows the root cause.
>
> Regulatory change sees four obligation states changing in two separate jurisdictional lanes at different times. For the German and Austrian entities, this is a subcontracting and register question. For the Swiss entity, an inventory and data access question under its own framework. Same supplier, same day, two separate obligations, two separate assessments, and his job is to keep them two records when the pressure at severity one runs toward one answer. Illustrative regulatory context, not legal advice.
>
> Three of the day's conflicts resolve, on evidence, at a stated time. One does not. The Swiss tranche cleared at two minutes to four, two minutes inside the cut-off. Measure one: satisfied. Measure two: two hours eleven minutes against a two hour limit. Exceeded. The tolerance record sets no precedence between them, so the entity cannot state whether it breached its own tolerance.
>
> That is the most valuable finding of the day and it is worth more than the incident. And it stays open, with a named owner and a committee destination, because a working day that resolves every question is not a credible working day.

**Key message.** Shared facts, separate professional judgments, and each function carries its own uncomfortable finding.

**Transition.** The six panels converge into a single thread.

**Likely questions.**

| Question | Answer |
|---|---|
| Six panels looks like six silos with better graphics. | They share one fact base with one classification scheme, so a statement cannot be a fact in one panel and an assertion in another. What is separate is the judgment, because the decision rights are separate. Merging the judgments is the failure mode, not the goal. |
| Why show the tolerance question unresolved rather than answering it? | Because it genuinely is unresolved. Answering it means choosing which measure governs, which is a committee decision on tolerance definition precedence. |
| Are you saying our framework has the same defect? | We have no basis to say that. What we would say is that a tolerance with more than one measure and no stated precedence is worth looking for, and it is far cheaper to find before an event than during one. |

---

## Scene 14. Leadership sees one decision thread, not six reports.

**Time budget:** 115 seconds.

**Subtitle on screen:** 16:30. Four red indicators and one event resolve into one chain with one root and one answerable question.

**On screen.** A seven-node horizontal chain, four links solid and two dashed. A committee readiness strip beneath, with a fact-arrival marker sitting after the papers deadline.

**Presenter says.**

> Half past four. This is where the day becomes an institutional outcome or does not.
>
> One chain. Supplier gateway availability deteriorated through September. Route substitution overrides grew more than sixfold. The override indicator breached red for the first time in fourteen months. Reviewer capacity sits at seventy-five per cent. The only preventive control on the risk is partially effective. The remediation that would have prevented one exception is sixty-seven days overdue. The risk sits outside appetite, and this afternoon it materialised once, for thirty-eight thousand four hundred euro, recalled.
>
> Seven nodes, six links, and two of those six links are dashed on the slide the committee sees. One: no field links an override to a specific route failure. Two: no recorded evidence connects the reviewer vacancy to any specific deviation. Presenting this chain as established would be more persuasive and less defensible, so the product marks the inferences and states what evidence would confirm them.
>
> Now the constraint, which is the real content of this scene. Committee papers close Thursday at noon. The supplier's root cause report is due the following Tuesday, the morning of the meeting. A late paper is tabled for information and cannot carry a decision. So she can ask for a decision on incomplete facts, or ask for nothing and lose a quarter.
>
> What she does instead is a piece of craft. She writes the paper on the facts verified as at Thursday noon, states which are verified, which are stakeholder statements and which are telemetry inferences, and then changes the question. The committee is not asked what caused this, because the supplier's report will answer that. It is asked: does the group accept that a supplier-configurable rule can waive a key control in the Internes Kontrollsystem without an Arcadia control owner review, and what change does that require?
>
> That question is answerable on Thursday's facts and stays answerable whatever arrives on Tuesday.
>
> Two last things, both about her own machinery rather than about payments. The internal tolerance that says no payment is released with an unsatisfied control gate has a tolerance of zero and no monitoring capable of detecting a breach. The ninety-six candidate breaches were found by an ad hoc query at twenty-six minutes to three, not by a control. That is a framework defect and it is hers.
>
> And the divergence resolved without her, better than either option she was weighing that morning. Holding a disagreement open for nine hours was the correct governance act, and it looks exactly like inaction.

**Key message.** A committee can act on one causal thread with its inferences marked. It has not acted on four red rows in four quarters.

**Transition.** The thread condenses into a single question chip, which rises into the authority ladder.

**Likely questions.**

| Question | Answer |
|---|---|
| Is the causal chain an AI conclusion we would have to defend? | It is a hypothesis with six links, four evidenced and two inferred, labelled that way on the committee slide. What the chair accepts is the question it frames, not the chain as fact. If the chair rejects the inferred links, the question still stands. |
| Would our committee not ask for the supplier report first? | It might, and that costs a quarter. The point of the reframing is that whether a supplier-configurable rule may waive a key control does not depend on the root cause of one database failure. Separating those two is the governance work. |
| How is this different from a good pack by a good secretary? | The chain, the readiness state per agenda item and the fact-arrival dependency are computed rather than remembered, including the flag that one decision item depends on a fact that will not exist at the deadline. A good secretary knows that. A good secretary on leave does not hand it over. |

---

# CHAPTER V. AUTHORITY AND ADOPTION

Scenes 15 to 16. Three minutes fifty seconds. Answer the two questions the day has provoked, then make one ask and stop.

---

## Scene 15. Autonomy is earned action by action.

**Time budget:** 115 seconds.

**Subtitle on screen:** Six positions, from retrieval to policy-bound action, with a hand back that is available at every one of them.

**On screen.** Six stacked authority bands. Selecting a band lights the authority classes it reaches and dims the rest. The hand-back band renders as a rail running across all five others.

**Presenter says.**

> You have watched a day. Now the question you have been holding: what is this thing actually allowed to do?
>
> Six positions.
>
> Assist: retrieve evidence and answer questions, with provenance on every claim. Retrieving the binding appendix version with its date and its retrieval path is Assist.
>
> Prepare: draft records and challenge questions. The residual worksheet with the empty cells is Prepare.
>
> Recommend: propose a position with the evidence on both sides and the uncertainty stated. No pre-selection, no ranking.
>
> Act with approval: prepare a change, pause, and execute only after a named person approves that exact payload. Creating the action to check all ninety-six overrides by noon the next day is this level.
>
> Act within policy: execute low risk, reversible, routine actions. A simulated factual validation request to the repair team. And note the constraint that holds even here: raising the level does not make a material change free. A material change is gated at every level.
>
> And the sixth position, which is available from all five others: hand back to the human. Stop, state what is known and what is not, and return the decision with the record structure prepared and blank.
>
> Now the mechanism, because this is what an auditor will ask about. The gate is not a prompt. It is a registry. A tool that is not in the registry cannot be called, which is why the registry and not the prompt is the security boundary. Three conditions hold together before any change executes: the level reaches the authority class, the acting role holds every required scope, and where the class demands it, a valid, unconsumed approval exists that is bound to a fingerprint of that exact payload. Approval for a small change does not transfer to a larger one.
>
> And four things are refused by design, so that the refusal is explicit and testable rather than assumed. Sending mail outside the environment. Contacting a supervisory authority: the product records a recommendation and notifies nobody. Editing the audit trail, which is append-only. And an agent approving its own proposal, because approval requires a named person.
>
> Every write names five things or it is rejected: the system of record, the entity partition, the record identifier, the accountable human, and the evidence reference. Not logged as a warning. Rejected.

**Key message.** The permission boundary is a deterministic gate outside the model, so an instruction in a document cannot talk its way past it.

**Transition.** The ladder tips forward into six phases.

**Likely questions.**

| Question | Answer |
|---|---|
| Who sets the autonomy level? | In this prototype it is a visible control with a stated effect, so you can see the difference. In a deployment it is a governance setting owned by the function that owns the control environment, and the level change is itself an audited event. |
| What stops prompt injection from a supplier document? | The gate does not read free text. It evaluates the tool name, the authority class, the role scopes and the approval, all structured values. A sentence inside a supplier PDF can ask for anything; it cannot add a tool to the registry or grant an approval. |
| Where would a bank realistically start? | At the first two positions, which is phase two of the roadmap. Retrieval and preparation, no writes at all. Everything above is earned by evidence from the level below, function by function. |

---

## Scene 16. Prove one working day. Then scale the work environment.

**Time budget:** 115 seconds.

**Subtitle on screen:** Six phases. The first two write nothing, and each phase is proved by an artefact rather than by a status report.

**On screen.** Six phases left to right, each with a lane badge and a proof-point chip. A read-only marker spans phases one and two. Then a return to the converged decision object from the cover, carrying the single ask.

**Presenter says.**

> Six phases, and I will keep each to two sentences.
>
> One, role and work discovery. The five lanes mapped against your roles, your entities and your systems of record. The proof is a written work inventory: which activities sit in which lane, which objects they touch, and which decisions are reserved to a person.
>
> Two, a read-only personal work layer. The morning brief and the evidence layer, for one function, on one real working day, writing nothing anywhere. The proof is a ranked decision brief a practitioner recognises, and because it writes nothing, a wrong brief costs credibility and not a record.
>
> Three, specialist evidence production. The workbench opens onto a formed picture with the conclusion cell empty. The proof is a prepared draft the professional accepts, edits or rejects, with every override recorded against their name and an override rate you can look at.
>
> Four, approval-gated execution. Writes into the systems of record, each carrying the five attributes, each released by a named person against a specific payload. The proof is an audit trail an internal auditor can follow from a decision back to its evidence without asking anyone a question.
>
> Five, process redesign, and this is the phase most programmes skip. Change the work, not only the tooling. Test populations bounded by condition rather than by period. Runbooks that state their control effects instead of asserting the control environment is unchanged. Impact tolerances with a stated precedence. The proof is at least one framework defect found and fixed before an event rather than during one.
>
> Six, the scaled operating model. Six functions across your entities, with the authority model as a governed object.
>
> Durations are not on this slide. We have no basis to assert them and we are not going to.
>
> So the ask is one thing. Run one working day. Your own control with a live disagreement between the lines. Your own Tier 1 supplier with an appendix you suspect is out of date. Your own indicator that breached and was explained rather than investigated. Your own overdue action for a reason nobody has written down. And one event from your own history, replayed as arrivals with their classifications.
>
> Then judge this on what that day produces.
>
> Three things I am not claiming. No time saving, because we do not know how long your people take. No compliance claim, about anything. And not that judgment gets better. The claim is that judgment arrives earlier, better briefed, and with its limitations stated.

**Key message.** Start by running one day on your own control, supplier and indicator set, and judge the idea on what it produces.

**Transition.** End. Hold the converged object on screen and stop talking.

**Likely questions.**

| Question | Answer |
|---|---|
| How long does phase one take? | We do not know and we would rather say so. It depends on how many functions and entities you run and how much of your work inventory exists already. It is a scoping conversation, not a number on a slide. |
| What would make you tell us not to do this? | Three things. If your evidence is not retrievable with a version and a date, the Understand lane has nothing to stand on. If your systems of record cannot accept an attributed write, the Execute lane cannot close the loop. And if your functions do not agree on the object model, the shared lanes are not shared and this becomes six products. |
| What does phase two deliver if it writes nothing? | The morning brief and the evidence layer for one function on one real day. Read-only, cheap to govern, and it tells you whether the ranking and the provenance are good enough to trust. If they are not, you stop there having spent very little. |
| Why one day rather than a pilot function? | A day is the unit a professional recognises and a quarter is not. One day end to end, with an event in the middle, tests the ranking, the evidence, the handoffs and the write path at once. A function pilot without a day tests the tooling and not the work. |

---

## Appendix A. Words to avoid on stage

The left-hand column below is the only place in this document where the banned phrases appear. They are quoted here so a presenter can recognise them, and a copy gate should treat this table as an explicit exception in the same way the source design system treats a `lint-ok` marker.

| Do not say | Say instead |
|---|---|
| The system decides / recommends the rating | The system prepares the position. The human decides. |
| It never misses anything | It states what it has not checked, and what would change the answer. |
| Fully automated | Prepared and released, with the release owned by a named person. |
| We guarantee | We can evidence, for this scenario, that ... |
| Industry benchmark | This is a scenario figure for a synthetic institution. |
| This makes you compliant | This states what the obligation appears to require, what evidence exists, and what is missing. Illustrative regulatory context, not legal advice. |
| DORA applies across the group | The EU framework applies to the German and Austrian entities. The Swiss entity is assessed under its own framework. Illustrative regulatory context, not legal advice. |
| It saves X hours | We do not assert a saving. Here is what the morning produces instead. |

## Appendix B. The one factual trap

The Swiss entity is supervised under its own framework. The EU digital operational resilience framework does not apply to it, and no slide, sentence or answer may state or imply that it does. In a group aggregate view, EU-derived measures show as not applicable for the Swiss entity rather than blank or zero. If asked a group-wide regulatory question, split the answer into the two lanes before answering it.

---

**Synthetic institution and data. Illustrative regulatory context, not legal advice.**

*End of `DOC-PRESENTATION-SCRIPT` version 1.0.*
