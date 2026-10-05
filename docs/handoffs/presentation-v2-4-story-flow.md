# Presentation V2.4 story flow handoff

## What changed

- Play order: Trust moved before Value. Trust is now `slide-10` and Value `slide-11`; slide ids always follow the play order (asserted in `tests/unit/presentation-v2-4-copy.test.ts`).
- The core is thirteen slides (`CORE_SLIDES_V24`). The Q&A close is `CLOSING_SLIDE_V24` and plays after slide 13; `PRESENTATION_SLIDES_V24` is the full play order.
- Every speaker note now ends with a transition sentence that voices the next slide's question. The full chain is in `docs/PRESENTATION_V2_4_FLIP_MAP.md`.
- Supporting insights were added where the exhibit does not already state the conclusion (8 of 13 core slides). They are optional `insight` strings on the slide data, at most 30 words, never repeating the title or subtitle (asserted by test).

## Insights used

| Slide | Insight |
| --- | --- |
| 1 | The objective is not more AI activity. It is more professional capacity applied to material risk. |
| 3 | Each system may be fit for purpose. The manual burden sits between them. |
| 7 | Reuse lowers the platform cost. Role-specific design protects the professional method. |
| 8 | The process remembers where work stopped and resumes with the same evidence, decisions, and authority. |
| 9 | A stronger model does not receive broader authority unless the bank explicitly changes the policy. |
| 10 | The audit trail is created by the workflow, not reconstructed after the event. |
| 11 | The pilot succeeds only if the working process improves and the control environment remains intact. |
| 13 | The first commitment is a bounded design-partner case, not a full platform rollout. |

## Insights deliberately not used

| Slide | Reason |
| --- | --- |
| 2 | The agenda is its own summary |
| 4 | The stage cards already state waiting, variation, handoffs and reconstruction |
| 5 | The subtitle already says the systems of record stay; the exhibit shows them "plugged in, unchanged" |
| 6 | The Now, Next and Done focus is the message of the exhibit itself |
| 12 | The exhibit's "Built once, then reused" panel already states it |

## Where insights render

Standard slides show the insight in a compact takeaway box at the bottom right of the slide, outside the exhibit stage, so the exhibit keeps its size. The cover shows it under the subtitle.
