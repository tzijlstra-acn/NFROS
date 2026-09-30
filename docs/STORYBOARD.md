# STORYBOARD
## NFR WorkOS: Live the NFR Day
### Sixteen scenes, the emotional arc, and the visual construction of each

**Synthetic institution and data. Illustrative regulatory context, not legal advice.**

| Field | Value |
|---|---|
| Document ID | `DOC-STORYBOARD` |
| Version | 1.0 |
| Status | Baseline |
| Date | 30.09.2026 |
| Owner | Executive Story Director |
| Consumers | Presentation engineering, scene authors, visual design |
| Scene data | `src/scenario/data/story.ts`, `STORY_SCENES` |
| Spoken script | `docs/PRESENTATION_SCRIPT.md` |
| Design tokens | `src/styles/tokens.css` |

---

## 0. Inherited constraints, restated as build rules

These are carried from `docs/handoffs/source-visual-findings.md` and are not negotiable in this presentation.

| Constraint | Rule |
|---|---|
| Scene geometry | `100dvh` section, `.inner` at `max-width: 1100px`, `.scene-screen` as a three-row grid `auto / minmax(0, 1fr) / auto`, `min-height: 0` at every level, `contain: layout paint size` on the stage. Header and footer rows height-capped so they cannot steal stage space. |
| Stage budgets | `compact` 16:5.2 at up to 920px, `standard` 16:6.5 at up to 1080px, `wide` 16:7.2 at up to 1180px. A scene knows its drawing space without measuring. |
| Motion budget | No scene timeline exceeds 12,000 ms. Above 7,000 ms is a warning and needs a stated reason. Scenes here run 2,600 to 9,200 ms. |
| Reduced motion | Two layers. CSS neutralises transitions; the scene director calls `finish()` so the scene shows its end state rather than nothing. Every scene below states its `finish()` end state. |
| No blank stage | `renderError`, then `renderStatic`, then the fallback SVG. A scene that fails shows its final composition, statically. |
| No false affordance | No `cursor: pointer` on a non-interactive visual. An element that looks clickable and is not invites a failed click in front of an audience. |
| Copy limits | Titles at most 10 words, subtitles at most 22 words, no absolute language. One recorded exception: scene 4's title is 11 words and is fixed by the story brief. |
| Number labelling | Every quantity renders with its basis: measured in this simulation, illustrative, or client input required. |
| Mandatory labels | "Synthetic institution and data." on every Arcadia surface. "Illustrative regulatory context, not legal advice." at the point of display on every regulatory reference. |
| Jurisdiction rule | No visual crosses the EU lane and the Swiss lane. In an aggregate view, EU-derived measures render as not applicable for the Swiss entity, not blank and not zero. |

### Colour semantics used throughout

From `src/styles/tokens.css`. Hue carries meaning; it is not decoration.

| Alias | Token | Meaning in this presentation |
|---|---|---|
| `--ai` | accent purple | The work environment itself, and machine activity |
| `--human` | amber | Human judgment required, caution, an open question |
| `--evidence` | green | Evidence present, a completed and released action |
| `--risk` | red | Material risk, breach, blocked |
| `--data` | cyan | Telemetry, indicator and control context |
| `--gap` | pink | Divergence, absence, the thing the contract does not see |

One discipline: amber means a human is required. It is the single most repeated colour signal in the deck and it should appear in every chapter, because it is the visual form of the argument.

---

## 1. The emotional arc across sixteen scenes

The arc is deliberately not a rising line. It rises, drops into discomfort, and settles into control. An audience that is only ever impressed does not buy anything.

| Scene | Intended audience state | Where their attention should be |
|---|---|---|
| 1 | Curiosity, mild scepticism, permission granted | The centre of the frame, on the converging object. Nothing else exists. |
| 2 | **Recognition, then discomfort.** "This is my Tuesday." | Scanning the eight cards freely. Let them scan; do not direct. |
| 3 | **Relief.** The first emotional turn of the deck. | The three cards, then deliberately down to the "what is not known" block. |
| 4 | Reassurance, and the beginning of trust | Lane 4, the unfilled one. The eye should rest there. |
| 5 | Professional self-recognition. "There is a version of this for me." | Their own role's lens. Expect them to find it unprompted. |
| 6 | Practical interest. "That is how my Tuesday would start." | The three decision rows, then the dimmed systems along the bottom. |
| 7 | **Respect.** The first moment the product looks like it understands the job. | The divergence badges on two nodes, then the asserted-against-observed overlay. |
| 8 | Quiet comprehension. A breath between two dense scenes. | The morph itself. One object, changing meaning. |
| 9 | Engagement with method | The movement trail crossing the appetite line. |
| 10 | Investment in the argument | The contested question at centre, between two position columns. |
| 11 | **Trust, and the emotional peak of the first half.** | The bracket joining two nodes, and the "declined to do" panel. |
| 12 | **Alarm, controlled.** Tension, not spectacle. | The time spine, moving downward with the arrivals. |
| 13 | Sober respect. Each function sees its own competence and its own blind spot. | Their own panel first, then the unresolved conflict. |
| 14 | **Executive clarity.** The CRO and COO decide here whether this matters. | The seven-node chain, then the two dashed links, then the deadline strip. |
| 15 | Control, and relief of a different kind. "We could govern this." | The six bands, then the refused-by-design list. |
| 16 | **Resolve.** A single decidable ask. | The read-only marker over phases one and two, then the ask. |

Three rules about the arc.

1. **The emotional peak of the first half is scene 11, not scene 12.** The event is louder; the rating is the point. If scene 12 feels bigger than scene 11 in delivery, the deck has failed.
2. **Discomfort is load-bearing in scenes 2 and 12.** Scene 2 has to be recognised as the audience's own morning. Scene 12 has to land the fact that the finding existed 41 days earlier. Neither should be softened.
3. **Scene 8 and scene 5 are breathing scenes.** They are short on purpose. Density without relief stops being persuasive after about twelve minutes.

---

## 2. Scene by scene

Each entry gives: purpose, visual construction, motion and why the motion explains something, interaction, scenario data, key message, and the transition mechanic into the next scene.

---

### Scene 1. Live the NFR day.
`convergence-hero` | 45 s | Chapter I

**Purpose.** Grant permission to watch a working day rather than a product tour. Establish the synthetic institution once so nobody spends the next ten minutes wondering.

**Visual construction.** Full-bleed dark field at `--bg`. Eight signal fragments as small monospaced chips at three depths, each with a muted source line beneath it. They sit off-centre, unevenly, at low opacity. At centre, initially absent, the converged object: a single card at `--surface-2` with a fine `--border-2` edge, carrying a decision question, an owner chip, an authority basis line, and one amber line holding the stated unknown. Title and subtitle sit in the header row; the date line and the synthetic data label sit in the footer row.

**Motion, and what it explains.** One 3,400 ms timeline. Fragments fade in staggered over 900 ms, then travel on eased paths toward centre over 1,600 ms, losing their source lines as they arrive. The converged card scales from 0.94 and fades in over the last 600 ms. The motion is the thesis in one gesture: the same facts, gathered, become one decision. Nothing pulses, nothing loops except a single slow 2,200 ms opacity breath on the amber unknown line, which is the one thing that should not feel resolved.

**`finish()` end state.** Fragments at rest in their converged positions at 30% opacity, card fully rendered, no breathing.

**Interaction.** None. This is a spoken scene.

**Scenario data.** `CoverContent.fragments`, eight items drawn from `DOC-SCENARIO-BIBLE` section 14. `converged` is Katharina Vogt's 07:45 question, with the two inferred links declared.

**Key message.** This is a working day you can step into, not a capability list you have to imagine.

**Transition out.** Reverse the convergence over 700 ms, leaving the fragments scattered, then hard-cut a clock reading 07:42 into the header. The reversal is the point: the day has not been fixed yet.

**Attention.** Centre frame, on one object.

---

### Scene 2. The day begins by reconstructing the work.
`signal-clutter-board` | 140 s | Chapter I

**Purpose.** Recognition. The audience has to see their own Tuesday before they will accept an alternative to it.

**Visual construction.** Eight cards in a four by two grid that is deliberately not aligned: varied card heights, small rotational offsets under one degree, inconsistent internal density. Each card carries a `kind` glyph, a label, a source chip in `--font-mono` at `--text-xs`, a detail line, and, where present, a metric with its basis label. The person carrying the item sits in the card footer at `--text-4`. Crucially, **no card touches another and no line connects any two cards.** Beneath the grid, a single capped strip lists the eight systems opened. Bottom right, the elapsed figure at `--text-lg` with its basis label.

The visual grammar of the whole scene is absence: the absence of connection is the content.

**Motion, and what it explains.** One 4,800 ms timeline. Cards reveal in an intentionally non-sequential order with a 260 ms stagger, so the eye cannot predict where the next one lands. That irregularity is the design: a predictable reveal reads as organised, and this morning is not organised. At 3,600 ms the hidden connection strip fades in beneath, and four of the eight cards take a 1 px `--risk` edge, which is the first and only moment of order in the scene. No connecting lines are drawn. Drawing them here would give away scene 3 and, worse, would imply the bank's systems already do it.

**`finish()` end state.** All eight cards revealed, four carrying the risk edge, hidden connection strip visible.

**Interaction.** Optional presenter affordance only: pressing a number key 1 to 8 raises one card and dims the rest, for use if the room asks about a specific signal. No cursor affordance is shown, so the visual does not look clickable.

**Scenario data.** `SignalClutterContent`. The eight signals are the eight `kind` values required by the story brief, each bound to a named person and a real object: 61 unread messages, the six-way 10:30 collision, `MSN-2026-0147` at 67 days, the duplicate `TPRM-Q-2026-R04` question, the four red indicators, the 08.10.2026 papers deadline with three of five items undrafted, the 10:30 RCSA workshop, and the 731-row override extract carrying the OVR-C growth.

**Key message.** The first hour of an NFR day is spent assembling a picture, and the assembly produces no professional output.

**Transition out.** The clock in the header ticks 07:42 to 07:45. Over 900 ms the eight cards translate inward and collapse to 0 opacity and 0.9 scale, with three cards from scene 3 scaling up through them. The collapse is a physical gesture of resolution and it is the one moment in the deck where motion should feel satisfying.

**Attention.** Free scanning of the grid. Do not direct it. Then down to the hidden connection strip on the presenter's cue.

---

### Scene 3. The future starts with decisions, not notifications.
`decision-card-collapse` | 140 s | Chapter I

**Purpose.** The first emotional turn. Relief, immediately followed by the credibility move: the unknowns are displayed as prominently as the knowns.

**Visual construction.** Three cards in a single row at `--surface-1`, generous internal spacing, each with four zones: the question at `--text-md`; a "what is known" list with a `--evidence` rule on the left; a "what is not known" list with an `--human` rule on the left; and a footer carrying the owner, the authority basis, reversibility and the destination record. The two lists are given **equal visual weight**. Along the lower edge, the eight signals from scene 2 persist as small provenance chips, so the audience can see that nothing new arrived. Top of frame, a read-only badge in `--data`.

A background reveal panel sits collapsed at the bottom right and expands on presenter cue.

**Motion, and what it explains.** One 3,200 ms timeline. The three cards settle from the collapse of scene 2. The known list reveals first, at a 120 ms stagger. Then, after a deliberate 700 ms pause, the not-known list reveals. That pause is the most important piece of timing in the deck: it stops the scene reading as a confidence display and makes the limitation feel like part of the product rather than a disclaimer. The read-only badge fades in last.

The background reveal expands on demand over 400 ms: three counts and a drill-down list, with the awaiting-release count rendered beside the completed count and not after it.

**`finish()` end state.** All three cards fully revealed with both lists, read-only badge visible, reveal panel collapsed.

**Interaction.** Presenter-triggered expansion of the background reveal. Nothing else.

**Scenario data.** `DecisionCardCollapseContent`, Marlene Aigner at `M01`. Cards: the three-explanations-or-one-investigation choice resolving to `DEC-2026-0771` at 09:58; the `RSK-0211` residual question with the 9 against 12 consequence split; and the loss-history interpretation with the detection caveat. `backgroundReveal` is the `M01` `rcsa` row: 7 organise, 16 understand, 0 execute, 23 total, 7 artefacts, 0 external, 0 awaiting release, 1 draft.

**Key message.** The morning brief ranks decisions, states what is not known, and writes nothing until a person decides.

**Transition out.** The middle card rotates slightly and separates into five horizontal strata, which become the five lanes of scene 4. The card is literally taken apart into the kinds of work that made it.

**Attention.** The three questions first. Then, on cue, down to the amber block. The presenter should physically point at the amber block.

---

### Scene 4. Not every part of NFR work changes in the same way.
`work-lane-ladder` | 125 s | Chapter II

**Purpose.** Remove the fear that judgment is being automated, by being more precise about it than the audience expects.

**Visual construction.** Five horizontal lanes stacked bottom to top in lane order, each a full-width bar at `--surface-1` with a left-hand number and label block. Each lane divides into three columns: today's cost, what changes, what stays human. Lanes 1, 2 and 5 carry an `--ai` fill that sweeps from the left to the width of their common share, with the percentage and its "Illustrative" basis label at the fill edge. Lane 3 carries a short `--ai` fill and a long `--human` region. **Lane 4 carries no fill at all**, only an `--human` edge and the judgment rule as a full-width sentence.

Below the ladder, one line: the organising claim, stated so it can be argued with.

**Motion, and what it explains.** One 5,600 ms timeline. Lanes reveal bottom to top at a 420 ms stagger, each fill sweeping over 520 ms with `--ease-out`. When the timeline reaches lane 4, **nothing sweeps.** The absence of the expected animation is the argument, and it is the single best piece of motion design in the deck because the audience feels the gap before they read the sentence. Lane 5 then sweeps normally, which makes lane 4's stillness retrospectively deliberate rather than broken.

**`finish()` end state.** All five lanes revealed with their fills at final width, lane 4 unfilled with its edge and sentence visible.

**Interaction.** None.

**Scenario data.** `WorkLaneLadderContent`, from `DOC-ROLE-WORK-ATLAS` sections 1, 2 and 9.6. Each lane carries one worked example from 06.10.2026, so no lane is an abstraction: Jakob's blocking conclusion, the appendix reconciliation, Stefan's two gap reclassifications, Sibylle's 15:07 decision with 38 minutes of runway, and the eight Massnahmen from five roles as one object type.

**Key message.** Organise, Understand and Execute are built once. Assess and Decide stay with the professional, and Decide stays unautomated on purpose.

**Transition out.** The Assess lane splits vertically into six coloured strands over 800 ms. The strands travel upward and resolve into the six lens positions of scene 5.

**Attention.** Bottom to top with the reveal, then resting on lane 4. The eye should return to lane 4 twice.

---

### Scene 5. One work environment. Multiple professional lenses.
`lens-switcher` | 75 s | Chapter II

**Purpose.** Let each specialist in the room find themselves. Short, because its job is recognition and not explanation.

**Visual construction.** A persistent outer frame representing the environment: a top bar, a left rail with the six lens positions, a right provenance rail, and a bottom audit strip. All four persist unchanged for the whole scene. The centre stage carries the active lens: role label with its German pairing, person, entity, unit of analysis, primary object, hero visual name, and the different question set in a larger weight as a quotation. Left of the stage, a fixed panel lists what is shared across all lenses. Right, a fixed panel lists what changes with the lens.

**Motion, and what it explains.** One 6,400 ms timeline cycling through all six lenses at roughly 1,000 ms each, with a 220 ms cross-fade on the centre stage only. **The frame does not move.** That is the entire visual argument: six genuinely different centres inside one unchanging environment. Each lens change also re-renders a small schematic of that role's hero geometry, and the six schematics are structurally different shapes rather than recolours of one shape.

**`finish()` end state.** The `tprm` lens active, both side panels fully revealed, frame in place.

**Interaction.** Presenter-driven lens selection by key 1 to 6, so a question about a specific function can be answered by switching to it.

**Scenario data.** `LensSwitcherContent`, from `DOC-ROLE-WORK-ATLAS` section 15. Six roles with their units of analysis, primary objects, hero visualisations and different questions.

**Key message.** Each function keeps its own unit of analysis and hero view, while the evidence layer and the audit trail stay shared.

**Transition out.** The lens rail settles on `tprm` and the centre stage populates with the 08:10 decision queue. No frame change, which is the first proof of the claim just made.

**Attention.** On the lens rail during the cycle, then on whichever lens the audience's own role occupies.

---

### Scene 6. The TPRM manager opens three decisions, not five systems.
`decision-queue` | 115 s | Chapter III

**Purpose.** Convert the abstract claim of chapter II into a recognisable specialist morning.

**Visual construction.** Three stacked decision rows inside the same environment frame. Each row: a headline, a prepared position paragraph, a limitation paragraph with an `--human` left rule, a deadline chip, and where present a blocked-by or blocking chip in `--gap`. Evidence references render as small monospaced chips along the row foot. Along the lower edge of the stage, five dimmed tiles name the systems not opened, each at 40% opacity with a strike rule.

The today comparison sits in the footer as a single sentence in `--text-4`.

**Motion, and what it explains.** One 4,200 ms timeline. The three rows reveal at a 380 ms stagger. Then the five system tiles fade in at 40% and, one by one at 180 ms intervals, take a strike rule. The striking is the only moment of visual satisfaction in the scene, and it is earned by naming systems the audience uses daily. The blocking chip on row two draws a short `--gap` connector toward the edge of frame, indicating a dependency on a person not in this view.

**`finish()` end state.** Three rows revealed, five tiles struck, footer sentence visible.

**Interaction.** None. The row bodies are fully rendered; no expansion affordance is shown, to avoid a false click.

**Scenario data.** `DecisionQueueContent`, `M02` `tprm`. Decisions: the four-row appendix divergence; the 137-day unescalated DR report with the 2 hours against 3 hours 40 recovery gap; and the priority choice between a 25-day reassessment deadline and a divergence with no deadline. `backgroundReveal` is the `M02` `tprm` row: 17, 8, 2, total 27, 8 artefacts, 3 external, 1 awaiting release.

**Key message.** The work environment replaces the assembly, not the assessment.

**Transition out.** Row one expands to fill the stage and its evidence chips become nodes, which arrange themselves into the concentric chain graph of scene 7.

**Attention.** Row by row with the reveal, then down to the struck system tiles.

---

### Scene 7. AI prepares the risk position. The professional challenges the supplier.
`supplier-exposure-graph` | 130 s | Chapter III

**Purpose.** Earn professional respect. This is the first scene where the product looks like it understands the job rather than the workflow.

**Visual construction.** A concentric force-directed graph. `TP-0042` at centre. Ring one inward: the three entities, one edge per service, edge thickness by attributable spend, edge style solid for a classified critical dependency and dashed otherwise. Ring two outward: the four subprocessors, each node labelled with its jurisdiction. Ring three, furthest out and rendered visibly thinner: the fourth party.

The key affordance is the **node badge**: every subprocessor and fourth-party node carries a two-state badge, in the binding appendix against in the supplier's current register. A divergence renders as a split node with the two states side by side in `--gap`. Two nodes are split.

Right of the graph, the challenge sequence as four numbered asks with their dates. Below, the human choice in one sentence.

**Motion, and what it explains.** One 9,200 ms timeline, the longest in the deck and the only one over 7,000 ms. Justification: it carries three distinct arguments and splitting it would break the concentric layout across two scenes.

Phase one, 0 to 2,800 ms: the graph draws outward from the centre, ring by ring, with edges animating by stroke-dashoffset. Drawing outward rather than inward is the point: dependency depth is discovered, not designed.
Phase two, 2,800 to 5,200 ms: the badges resolve. The two divergent nodes split with a 340 ms spatial ease, and the fourth party thins further. The split is a physical gesture for a contractual fact.
Phase three, 5,200 to 7,400 ms: the overlay changes from evidence freshness to assertion delta. Edge colours cross-fade and five delta pairs slide in beside their nodes. The graph does not re-render; only the encoding changes, which is what makes the two views comparable.
Phase four, 7,400 to 9,200 ms: the four asks reveal at a 400 ms stagger in negotiation order.

**`finish()` end state.** Graph fully drawn, badges resolved, assertion overlay active, four asks visible.

**Interaction.** Two presenter toggles: the data-access overlay, which shades every node with access to payment data and puts Pune and Dublin in scope in one action; and the assertion overlay. Both are presenter-only keys with no cursor affordance.

**Scenario data.** `SupplierExposureGraphContent`, from `DOC-SCENARIO-BIBLE` sections 7.1 to 7.3 and `DOC-ROLE-WORK-ATLAS` 3.6. Six nodes across three rings. Five assertion deltas including the 99.62% against 99.74% availability reconciliation with the maintenance overrun explanation. Four asks sequenced so the two cheap concessions come first.

**Key message.** Preparation is machine work. Challenge is professional work, and the meeting produces commitments rather than discussion.

**Transition out.** The graph holds every node position while labels, edges and legend cross-fade over 1,100 ms from the supplier chain into the process, risk and control graph. Positional continuity is what makes scene 8 legible in seventy seconds.

**Attention.** Centre outward during the draw. Then on the two split nodes. Then on the two numbers in the availability delta.

---

### Scene 8. Switch the role. Keep the environment.
`role-morph-transition` | 70 s | Chapter III

**Purpose.** A breathing scene that carries one structural idea: the environment is constant and the authority is not.

**Visual construction.** The morph itself occupies the stage. Left of it, a "retained" column with five items each carrying an `--evidence` marker. Right, a "changed" column with five items each carrying an `--ai` marker. Below the stage, the shared object stated in one sentence, naming the repair workbench as a service to one role and a control dependency to the other. Bottom right, a small audit chip recording the role switch with acting user, previous role, new role and scenario time.

**Motion, and what it explains.** One 2,600 ms timeline, the shortest working scene in the deck. A single continuous morph: node positions hold, labels cross-fade, edge semantics change, the legend swaps. The retained column reveals during the morph; the changed column reveals after it completes. That ordering is the argument, in sequence: first you see what survives, then you see what moved.

**`finish()` end state.** Morph at its end state with the process, risk and control graph rendered, both columns revealed, audit chip visible.

**Interaction.** None.

**Scenario data.** `RoleMorphTransitionContent`. From `tprm` to `rcsa`. Retained: evidence objects with versions, fact classifications, the audit trail including the switch, the scenario clock, and the open control divergence with both positions attributed. Changed: unit of analysis, authority scopes, corpus, hero geometry, sufficiency standard.

**Key message.** The role switch changes the lens and the authority, and it keeps the evidence, the provenance and the audit trail.

**Transition out.** The control node pulses once over 400 ms and the stage resolves into the operational risk workbench.

**Attention.** The morph, then the retained column. The presenter should say very little here.

---

### Scene 9. The RCSA starts with what changed.
`change-since-last-cycle` | 115 s | Chapter III

**Purpose.** Show that a cycle starts at the delta, and that a movement is only meaningful with its driver attached.

**Visual construction.** Two-panel split. Left, the delta list: ten collapsed rows at 12 px height in `--surface-0` each reading "no material change" with its check named, and one expanded row occupying the remaining height with five change entries. Each change entry carries subject, previous state, current state, driver, evidence reference, and a fact-class chip. The one telemetry inference entry carries an amber inference-limit block.

Right, the five by five grid. Impact on the vertical, likelihood on the horizontal. A drawn appetite line across the grid at residual score 10, **as a line with the policy sentence attached to it, not a colour band.** The risk renders as three nodes joined by a trail: 6, then 9, then 12. Each trail segment carries its driver as a labelled object rather than a caption. A faint inherent-to-residual vector runs from position 12 to each residual position, so the vector length is the claimed control effectiveness, drawn.

**Motion, and what it explains.** One 6,800 ms timeline. The ten unchanged rows reveal fast, in 900 ms total, which visually costs them almost nothing and is exactly right. The expanded row then reveals its five entries at a 320 ms stagger. On the right, the trail draws 6 to 9 to 12 over 1,800 ms, and **the drawing pauses for 260 ms as it crosses the appetite line.** That pause is the only editorial motion in the deck and it is justified: crossing the line is the whole consequence of the cycle. The inherent-to-residual vectors fade in last, the 1LoD vector long and the 2LoD vector zero-length.

**`finish()` end state.** All rows revealed, trail fully drawn to 12, appetite line and vectors visible.

**Interaction.** Presenter can open any trail segment's driver object.

**Scenario data.** `ChangeSinceLastCycleContent`, from `DOC-SCENARIO-BIBLE` section 10.1 and `DOC-ROLE-WORK-ATLAS` 4.6. Five changes: control environment, residual position, override composition with the 181-of-198 inference limit, reviewer capacity, and the 67-day overdue remediation. `unchangedCount` at 10 of 11, labelled measured in this simulation.

**Key message.** A quarterly assessment should begin at the delta, with the driver of each movement attached as an object rather than a label.

**Transition out.** The grid recedes to a corner and the workshop table assembles at centre with the four established facts already laid on it.

**Attention.** Briefly left, to register that ten rows cost nothing. Then right, on the trail crossing the line.

---

### Scene 10. The meeting is for judgment, not evidence exchange.
`workshop-table` | 115 s | Chapter III

**Purpose.** Show what agreed facts buy: a real disagreement instead of a reconciliation.

**Visual construction.** A table plane in perspective, subtle, no more than eight degrees. Four fact cards lie flat on it in `--evidence` tint, each with its evidence reference and fact-class chip. At the head of the table, the contested question in the largest type in the scene. Rising from either side of the question, two position columns: holder, line of defence, position, and reasoning as a bulleted list. The columns are **the same height and the same visual weight**, which is a deliberate refusal to signal a winner.

Beneath the table, one `--human` band carrying the system's own statement that it cannot resolve the question. In the footer, the today comparison in one sentence.

**Motion, and what it explains.** One 5,400 ms timeline. The four fact cards land flat on the table in 1,400 ms total, with a short settle. Flat is the semantic: settled, no longer in play. Then the two position columns rise simultaneously from the table plane over 900 ms. Rising simultaneously, at identical speed and height, is the argument. A staggered rise would imply precedence. Finally the amber band fades in beneath.

**`finish()` end state.** Four cards flat, both columns risen to equal height, amber band visible.

**Interaction.** None.

**Scenario data.** `WorkshopTableContent`, `M05` `rcsa`. Four established facts: population 1,204, sample 60, the 54 / 4 / 2 split, the two deviation rates against the 5% tolerable rate, and the three control characterisations. The contested question is the sufficiency question. Both positions are given in full from `DOC-SCENARIO-BIBLE` section 10.1.

**Key message.** When the facts are agreed in advance, ninety minutes buys a real disagreement instead of twenty-five minutes of reconciliation.

**Transition out.** The two columns compress into two nodes and travel onto the risk grid, where a bracket draws between them.

**Attention.** The four flat cards first, then locked on the contested question at the head of the table.

---

### Scene 11. The human owns the rating.
`dual-position-matrix` | 115 s | Chapter III

**Purpose.** The emotional and ethical peak of the first half. Everything before it is preparation for this scene, and everything after it depends on the audience believing it.

**Visual construction.** The five by five grid at full stage width. Two nodes, at 9 and at 12, joined by a bracket, each labelled with its holder and its date. The appetite line runs between them with its policy sentence attached. Below the grid, two panels side by side and of equal size: "prepared" with six `--ai` items, and "declined" with five `--human` items. The equal sizing is the composition's whole claim.

In the footer, the outcome block: the 11:58 decision identifier, its statement, its signatories, and the supersession note pointing to the 16:41 record.

**Motion, and what it explains.** One 4,600 ms timeline. The two nodes arrive from scene 10 and settle. The bracket draws between them over 500 ms. The appetite line draws across last, **passing between the two nodes**, which is the image the audience should leave with. The prepared panel reveals at a 140 ms stagger. Then a 900 ms pause with nothing moving at all, which is the longest still moment in the deck, and then the declined panel reveals. The pause is doing the rhetorical work: it separates what the system did from what the system refused to do, and the silence makes the refusal deliberate.

Nothing in this scene moves when new evidence is mentioned. The node does not shift. That is a build rule, not a stylistic choice.

**`finish()` end state.** Both nodes, bracket, appetite line and both panels fully rendered, outcome block visible.

**Interaction.** Presenter can reveal the 16:41 supersession as an overlay that adds a third node without removing the first two. History is added, not replaced.

**Scenario data.** `DualPositionMatrixContent`, from `DOC-SCENARIO-BIBLE` sections 10.1, 15.4 and arrival 18. Three positions, appetite boundary at 10 with its policy sentence, `DEC-2026-0772` at 11:58 and the `DEC-2026-0783` supersession at 16:41.

**Key message.** The system prepares the position and records the outcome. It does not move the node, and a disagreement is allowed to stay a disagreement.

**Transition out.** The bracket holds on screen while the clock in the header jumps to 14:05 and a supplier notification card slides into the top right corner. The bracket remaining visible during the jump is intentional: the afternoon arrives while the morning's disagreement is still open.

**Attention.** The bracket, then the declined panel. The presenter should pause before reading the declined panel.

---

### Scene 12. One event reaches every NFR function.
`event-fan-out` | 135 s | Chapter IV

**Purpose.** Tension, controlled. Establish that facts arrive late, incomplete and in conflict, and that the finding is a repeat rather than a surprise.

**Visual construction.** A vertical time spine at centre, from 13:31 to 16:30, with the hours marked. Arrivals dock alternately left and right as compact cards, each carrying its time, its fact-class chip (`VF` in `--evidence`, `SS` in `--human`, `TI` in `--data`), its source, and its content. Telemetry inference cards carry a mandatory second block: the specific reason the inference could be wrong. One card carries a reclassification marker showing `TI` to `VF` at 15:38 **with both states visible**, because the history is not overwritten.

Beneath the spine, three entity lanes as horizontal consumed-tolerance bars: two EU lanes with a four-hour limit and one Swiss lane with a two-hour limit, a separate cut-off marker, and a fallback option block drawn at its true 45-minute length, positioned where it would have to start. The Swiss fallback block is visibly longer than the runway.

Each entity lane carries its own framework badge. The Swiss lane carries only its own framework and the mandatory label, and no EU framework badge appears on it in any state.

**Motion, and what it explains.** One 8,800 ms timeline. Arrivals dock in chronological order with variable intervals **proportional to their real time gaps**, so 14:41 to 14:48 feels fast and 15:09 to 15:38 feels slow. That proportionality is the scene's honesty: the audience experiences the waiting. The consumed-tolerance bars grow continuously underneath rather than in steps. At 15:38 the reclassification marker animates as a 300 ms state addition beside the original state, not a replacement. At the end, the rule statement and the repeat statement fade in beneath, in that order.

**`finish()` end state.** All arrivals docked, tolerance bars at final length, reclassification shown with both states, rule and repeat statements visible.

**Interaction.** Presenter can scrub the spine to any arrival. Scrubbing runs every step up to that point synchronously, so the scene is seek-safe.

**Scenario data.** `EventFanOutContent`, from `DOC-SCENARIO-BIBLE` section 15. Thirteen of the eighteen arrivals are carried here; five are held for scene 13 to avoid duplicating content across two scenes. The 34-minute detection gap, the severity path S3 to S2 to S1, the first notification verbatim with its five missing mandatory fields, the rule statement, and the 41-day repeat statement.

**Key message.** Facts arrive late, incomplete and in conflict, and the decisions cannot wait for them.

**Transition out.** The spine stays exactly where it is and the frame divides into six panels around it. The spine's persistence is the structural claim of scene 13: one event, six readings.

**Attention.** Downward with the spine. At the end, on the repeat statement.

---

### Scene 13. Same event. Different professional question.
`six-lens-grid` | 135 s | Chapter IV

**Purpose.** Show six competent professionals reading the same facts differently, each finding something uncomfortable about their own method.

**Visual construction.** The time spine from scene 12 persists, reduced, at centre. Six panels arrange around it, three left and three right, each carrying: role, person, the first arrival this role reads, the question in a larger weight, the output, the owned record, and an `--human` block holding that role's own uncomfortable finding. The uncomfortable finding block is present in all six panels and is the same size in each, so none of the six is presented as the hero.

Beneath the grid, two blocks: three resolved conflicts in `--evidence`, each with its resolving evidence and time; and one unresolved conflict in `--human`, larger, with its owner, its destination and the reason it stays open.

**Motion, and what it explains.** One 7,600 ms timeline. Panels reveal in role order at a 620 ms stagger, each drawing a thin connector to the specific arrival on the spine it reads first. Six connectors to six different points on one spine is the argument, drawn. The resolved conflicts then reveal quickly, at a 200 ms stagger. The unresolved conflict reveals last and **slowly**, over 900 ms, and then holds with a 2,400 ms amber breath. It is the only looping motion in the scene and it marks the one thing that does not close.

**`finish()` end state.** All six panels revealed with their connectors, resolved conflicts listed, unresolved conflict revealed and static.

**Interaction.** Presenter can expand any panel to full stage, which is the affordance used when a specific function in the room asks about itself.

**Scenario data.** `SixLensGridContent`, from `DOC-ROLE-WORK-ATLAS` sections 3.7 to 8.7 and `DOC-SCENARIO-BIBLE` 15.3. Six lenses with their questions and outputs, three resolved conflicts with resolving evidence and times, and Conflict D as the unresolved one with a named owner and a committee destination.

**Key message.** Shared facts, separate professional judgments, and each function carries its own uncomfortable finding.

**Transition out.** The six panels converge inward into a single thread, which unrolls horizontally into the seven-node chain of scene 14.

**Attention.** Initially on their own function's panel. Then, on the presenter's cue, on the unresolved conflict.

---

### Scene 14. Leadership sees one decision thread, not six reports.
`portfolio-decision-thread` | 115 s | Chapter IV

**Purpose.** The executive decision point. The CRO and COO conclude here whether this matters at an institutional level.

**Visual construction.** Seven nodes across the stage horizontally, connected by six links. Four links render solid in `--evidence`. Two render dashed in `--human`, each with a short attached note naming the evidence that would confirm it. Each node carries its label and its object reference.

Beneath the chain, a committee readiness strip: the papers deadline as a hard vertical rule, the committee date as a second rule, and a fact-arrival marker for the supplier report sitting **between them**, which is the whole problem stated geometrically. Below that, the decision block with the reframed committee question in the largest type in the scene.

Bottom left, a small panel with the three framework defects owned at this level, including the zero-tolerance condition with no detection.

**Motion, and what it explains.** One 5,800 ms timeline. The chain draws left to right at 620 ms per link. The two inferred links draw **at the same speed but as dashed strokes**, so they are visibly weaker without being visually dismissed. Then the readiness strip slides up from beneath and the fact-arrival marker lands last, after the papers deadline rule, which is the moment the constraint becomes visible rather than described. The committee question fades in last, alone.

**`finish()` end state.** Chain fully drawn with four solid and two dashed links, readiness strip with all three markers, committee question visible.

**Interaction.** Presenter toggle that hides the two inferred links, leaving a four-link chain. Used to answer the question "what if the chair rejects the inferences", and the answer is visible rather than argued: the question still stands.

**Scenario data.** `PortfolioDecisionThreadContent`, from `DOC-ROLE-WORK-ATLAS` 8.6 and 8.7 and `DOC-SCENARIO-BIBLE` 15.4. Seven nodes, four evidenced links and two inferred with their confirming evidence named, the 08.10.2026 / 13.10.2026 constraint, and `DEC-2026-0781` with the reframed question.

**Key message.** A committee can act on one causal thread with its inferences marked. It has not acted on four red rows in four quarters.

**Transition out.** The whole thread condenses into a single question chip, which rises and becomes the top band of the authority ladder.

**Attention.** Left to right with the draw. Then the two dashed links. Then the fact-arrival marker sitting after the deadline.

---

### Scene 15. Autonomy is earned action by action.
`authority-ladder` | 115 s | Chapter V

**Purpose.** Answer the governance question directly, with a mechanism rather than a reassurance.

**Visual construction.** Six bands stacked bottom to top: Assist, Prepare, Recommend, Act with approval, Act within policy, and then Hand back to human rendered differently, as a vertical rail running down the left edge across all five, because it is available from every position rather than above them.

Each band carries: label with its German pairing, what it permits, what it withholds, the authority classes it reaches as small chips, and one worked example from 06.10.2026. Right of the ladder, two fixed panels: the invariants, and the actions refused by design. Bottom, the five mandatory write attributes as five chips in a row.

**Motion, and what it explains.** One 6,200 ms timeline. Bands reveal bottom to top at a 520 ms stagger. As each band reveals, its reachable authority-class chips light in `--ai` and the classes above it dim to `--text-disabled`. The dimming is the mechanism made visible: reach is bounded, and the boundary moves with the level. The hand-back rail draws last, downward across all five bands in 600 ms, which is the visual statement that it is available everywhere. The refused-by-design panel reveals with each of its six items taking a `--risk` strike.

**`finish()` end state.** All six bands revealed with the highest level's chips lit, hand-back rail drawn, both panels revealed, write attribute chips visible.

**Interaction.** Presenter selects any band by key 1 to 6; the chip lighting and dimming re-render for that level. This is the affordance for answering "and what if we only allowed the first two".

**Scenario data.** `AuthorityLadderContent`, from `src/server/security/authority.ts`. Five autonomy levels with their reachable authority classes, plus hand back to human as the sixth position. Seven invariants including payload-fingerprint binding and single-use approval. Six refusals. Five mandatory write attributes.

**Key message.** The permission boundary is a deterministic gate outside the model, so an instruction in a document cannot talk its way past it.

**Transition out.** The ladder tips forward through the horizontal over 800 ms and becomes the six-phase progression of scene 16.

**Attention.** Bottom to top with the reveal. Then on the refused-by-design panel, which is where the audience's remaining anxiety sits.

---

### Scene 16. Prove one working day. Then scale the work environment.
`phase-roadmap` | 115 s | Chapter V

**Purpose.** Convert thirty minutes of comprehension into one decidable ask.

**Visual construction.** Six phases left to right as connected blocks, each with a number, a name, an outcome, a proof point in `--evidence`, a prerequisite, lane badges, and a risk line in `--human`. A read-only marker spans phases one and two as a single bracket above them, labelled to say that neither writes anything.

Duration chips render on every phase with the value "Scoped with you" and the basis label "Client input required". No phase shows a number, because we do not have one.

The scene then resolves: the six phases recede and the converged decision object from scene 1 returns at centre, carrying the single ask. Beneath it, the four things not claimed.

**Motion, and what it explains.** One 6,000 ms timeline. Phases reveal left to right at a 480 ms stagger. The read-only bracket draws over phases one and two early, at 1,400 ms, because removing the largest objection early is worth more than saving it. At 4,600 ms the phases fade to 25% and the cover object returns, scaling from 0.94 over 600 ms. The return is the only repeated image in the deck, and repeating it closes the loop: the same object that opened as a promise now closes as a request.

**`finish()` end state.** Six phases visible at 25%, cover object returned at full opacity with the ask and the not-claimed list.

**Interaction.** None. The deck ends with a static frame held on screen.

**Scenario data.** `PhaseRoadmapContent`. Six phases with outcomes, proof points, prerequisites and risks. `proofDefinition` names the five things a client brings to a one-day proof. `notClaimed` names four things the presenter refuses to assert.

**Key message.** Start by running one day on your own control, supplier and indicator set, and judge the idea on what it produces.

**Transition out.** None. Hold and stop talking. The last thing on screen is a question with an owner and a stated unknown, which is what the product produces.

**Attention.** Left to right, then on the read-only bracket, then on the ask.

---

## 3. Motion budget audit

| Scene | Timeline | Status |
|---|---|---|
| 1 | 3,400 ms | Pass |
| 2 | 4,800 ms | Pass |
| 3 | 3,200 ms | Pass |
| 4 | 5,600 ms | Pass |
| 5 | 6,400 ms | Pass |
| 6 | 4,200 ms | Pass |
| 7 | 9,200 ms | Over the 7,000 ms standard limit, under the 12,000 ms ceiling. Justified above: three arguments in one concentric layout. |
| 8 | 2,600 ms | Pass |
| 9 | 6,800 ms | Pass |
| 10 | 5,400 ms | Pass |
| 11 | 4,600 ms | Pass |
| 12 | 8,800 ms | Over the standard limit, under the ceiling. Justified: arrival intervals are proportional to real time gaps, which is the scene's honesty. |
| 13 | 7,600 ms | Marginally over the standard limit. Justified: six panels at a legible stagger. |
| 14 | 5,800 ms | Pass |
| 15 | 6,200 ms | Pass |
| 16 | 6,000 ms | Pass |

Looping animations, complete list. Only three exist and each carries meaning.

| Scene | Element | Loop | Why |
|---|---|---|---|
| 1 | The stated unknown line | 2,200 ms opacity breath | The one thing that should not feel resolved |
| 13 | The unresolved conflict block | 2,400 ms amber breath | The one question the day does not close |
| 12 | None | | The event scene has no loop on purpose. Tension comes from interval, not from pulsing. |

---

## 4. What each visual must refuse to do

Carried from the hero visualisation specifications in `DOC-ROLE-WORK-ATLAS`. These are assertions, testable in review.

| Scene | Refusal |
|---|---|
| 2 | Draw a connecting line between any two cards. The absence of connection is the content. |
| 3 | Show a recommended option, a pre-selection or a default on any card. |
| 4 | Animate a fill on lane 4. |
| 5 | Render six recolours of one geometry. The six hero schematics are structurally different. |
| 7 | Aggregate the three entities into one column, or apply an EU framework label to the Swiss edges. |
| 9 | Auto-move a node when evidence arrives, or collapse two positions into an average. |
| 10 | Stagger the rise of the two position columns, or render them at different heights. |
| 11 | Move the node. Average the positions. Present a range as a position. |
| 12 | Show one tolerance line for three entities. Pick one measure where two exist. Draw a fallback option without its lead time. Show an EU framework badge on the Swiss lane. |
| 13 | Present one of the six panels as the correct reading, or omit any panel's own uncomfortable finding. |
| 14 | Render the inferred links as solid, or hide them to make the chain stronger. |
| 15 | Render an authority class as reachable at a level that cannot reach it. |
| 16 | Show a duration number on any phase. |

---

## 5. Where the deck can fail

Honest failure modes, so they can be watched for in rehearsal.

1. **Scene 2 reads as a complaint about the bank.** Mitigation: the presenter says explicitly that each system is correct on its own terms. Without that line, a risk audience becomes defensive and stops listening.
2. **Scene 12 overpowers scene 11.** The event has more visual energy than the rating. If the room remembers the incident and not the empty residual cell, the deck has sold drama instead of discipline. Mitigation: deliver scene 12 flatter than it wants to be delivered.
3. **The background reveal in scene 3 reads as a vanity metric.** Mitigation: the awaiting-release count sits beside the completed count, the list is available in every case, and the number is not presented as time saved.
4. **Chapter III runs long.** It is eleven minutes of the thirty and it is the chapter a presenter most wants to expand. Scenes 8 and 5 are the designated compression points, not scene 11.
5. **The jurisdiction rule gets broken in questions, not on slides.** The slides enforce it. A verbal answer about the group does not. Mitigation: appendix B of the script, and the rehearsed habit of splitting any group-wide regulatory answer into two lanes before answering.

---

**Synthetic institution and data. Illustrative regulatory context, not legal advice.**

*End of `DOC-STORYBOARD` version 1.0.*
