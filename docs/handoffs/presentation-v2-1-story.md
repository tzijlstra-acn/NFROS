# Presentation V2.1 -- Story Architecture

## Why this sequence

The 13-slide core deck follows a deliberate narrative logic: problem before product, product before outcomes, outcomes before service, service before ask. Each section earns the right to the next.

**The sequence:**

1. **Hero (slide 1)** -- establish emotional register and the three design principles. The audience needs a frame before receiving information.
2. **Agenda (slide 2)** -- orient and signal that today is focused and bounded. Reduce anxiety about being oversold.
3. **Problem (slide 3)** -- agree on the frustration before showing the solution. If the audience does not recognise the problem, the product answer has no leverage. Pause here and ask whether the problem matches their experience.
4. **Product architecture (slide 4)** -- introduce the three-layer model (role, workflow, AI) at the highest level. This is the "what" before the "how."
5. **Daily experience (slide 5)** -- make the abstract architecture concrete through the morning work hub view. The audience now has one vivid picture to anchor the rest.
6. **Role design (slide 6)** -- explain why role-first is better than data-model-first. This justifies the architecture choice and signals that the product is built from the job, not adapted from a generic module.
7. **Role Apps (slide 7)** -- the six-stage workflow structure. This is the core product mechanism. It follows role design because it is the "what happens inside the role OS."
8. **Human/AI boundary (slide 8)** -- the most important trust slide. It comes after the product description and before the outcomes because the audience needs to understand the boundary before they can evaluate the outcomes.
9. **Outcomes (slide 9)** -- four measurable improvements: speed, evidence quality, consistency, audit readiness. Positioned after the boundary slide so the audience understands what produces the outcomes.
10. **Control (slide 10)** -- the second-line and audit message. Follows outcomes to address the "but what about governance?" question before it is asked aloud.
11. **Service model (slide 11)** -- four-tier managed service. The commercial architecture follows the product and outcomes because it only makes sense once the audience understands what they are buying.
12. **Rollout (slide 12)** -- three-step sequence: pilot, prove, scale. Follows service to show how the commercial relationship grows.
13. **Next step (slide 13)** -- a bounded, specific ask. The final slide closes the loop with a decision, not a summary.

## How each slide serves the narrative

| Slide | Narrative role | What it must accomplish |
|-------|---------------|------------------------|
| 1 | Open | Create aspiration and orient to the three principles |
| 2 | Orient | Reduce cognitive load, signal focused not exhaustive |
| 3 | Problem | Produce recognition and agreement before product |
| 4 | Architecture | Establish three-layer model as a durable mental model |
| 5 | Concrete | Give one vivid daily-use picture to anchor all subsequent slides |
| 6 | Role-first | Justify design philosophy, introduce the two launch roles |
| 7 | Mechanism | Show the six-stage workflow as the core unit of value |
| 8 | Trust | Establish the AI/human boundary explicitly and structurally |
| 9 | Outcomes | Shift from features to value in terms leaders track |
| 10 | Control | Address second-line and audit concerns proactively |
| 11 | Commercial | Show how the service scales without disrupting what runs |
| 12 | Sequence | Present rollout as risk management, not commercial convenience |
| 13 | Ask | Close with a bounded, specific, low-commitment proposal |

## Transition logic

Each slide ends with a transition line in the presenter script that bridges to the next. The transition logic is:

- Slides 1-2: register to structure
- Slides 2-3: structure to problem
- Slides 3-4: problem to architecture (the "here is the response" turn)
- Slides 4-5: abstract to concrete
- Slides 5-6: concrete back to design principle
- Slides 6-7: role design to role app mechanism
- Slides 7-8: mechanism to boundary (the trust turn)
- Slides 8-9: boundary to outcomes
- Slides 9-10: outcomes to control (proactive governance turn)
- Slides 10-11: product to service
- Slides 11-12: service to rollout
- Slides 12-13: rollout to ask

## Section labels and agenda overlay

Each core slide carries a `section` field that maps to a position in the agenda overlay (accessible via the A key). The section labels in use:

| Section | Slides |
|---------|--------|
| Imagine | 1 |
| Agenda | 2 |
| Problem | 3 |
| Product | 4-5 |
| Roles | 6 |
| RoleApps | 7 |
| HumanAI | 8 |
| Improvement | 9 |
| Control | 10 |
| Service | 11 |
| Rollout | 12 |
| NextStep | 13 |

The `agendaSection` field on each slide drives the active highlight in the AgendaSlide component.
