# Presentation V2.2 Truth Audit

This table records the state of each tracked feature at V2.1 and V2.2, with the source of truth for each claim. Use this as the authoritative reference when a question arises about what changed and where to verify it.

Synthetic institution and data. Illustrative regulatory context, not legal advice.

---

## Feature audit table

| Feature | V2.1 state | V2.2 state | Source of truth |
|---|---|---|---|
| Default route | /story loaded the original V1 deck | /story loads V2.2 by default | app/story/page.tsx route handler and deck resolution logic |
| Route aliases | /story?deck=v2.1 loaded V2.1; no current alias defined | /story, /story?deck=current, and /story?deck=v2.2 all resolve to V2.2 | app/story/page.tsx deck resolution switch |
| Double-hyphen punctuation | Present in core-story.ts and slide data files; 210 violations counted at V2.1 audit | Zero violations in src/presentation-v2-2/data/ files; verified by npm run check:user-copy | src/presentation-v2-2/data/core-story.ts and npm run check:user-copy output |
| Em dash | Present in some V2.1 slide copy | Zero em dash characters in V2.2 data files | src/presentation-v2-2/data/core-story.ts; npm run check:user-copy |
| RCSA stage count | Six stages stated in V2.1 slide 7 (Scope, Assess, Draft, Review, Challenge, Submit) | Eight stages: Scope and Trigger, Evidence Refresh, Risk and Control Change, First-line Input, Challenge Workshop, Rating and Appetite, Actions and Approval, Monitoring and Reassessment | src/role-apps/rcsa/definition.ts and src/presentation-v2-2/data/core-story.ts slide 7 processRows |
| TPRM stage count | Six stages stated in V2.1 slide 7 (Screen, Onboard, Assess, Monitor, Escalate, Exit) | Eight stages: Request and Intake, Classification and Criticality, Tailored Due Diligence, Evidence Review, Specialist Reviews, Contract and Conditions, Decision and Onboarding, Handover to Monitoring | src/role-apps/tprm/definition.ts and src/presentation-v2-2/data/core-story.ts slide 7 processRows |
| Slide data structure | String-parsed slide arrays in core-story.ts; no typed interfaces enforced at the data layer | Fully typed: CoreSlide22 interface enforces structure; Outcome, ServiceLayer, RolloutStep, RoleColumn, ProcessRow types eliminate string parsing | src/presentation-v2-2/data/types.ts and src/presentation-v2-2/data/core-story.ts imports |
| appendixRefs | Present on some slides; no typed contract enforced | Typed as AppendixReference[] on every CoreSlide22; required fields: appendixId, label, reason | src/presentation-v2-2/data/types.ts AppendixReference interface |
| Motion library | No motion system in V2.1 | Motion v13.4.6 integrated; tokens, variants, RevealSequence, MotionPath, SharedSlideTransition components added | src/presentation-v2-2/motion/ directory and package.json dependencies |
| Font | IBM Plex Sans declared via --pv21- token system; self-hosted font files present | IBM Plex Sans retained; token namespace changed to --pv22-; font loading unchanged | src/presentation-v2-2/styles/tokens.css and public/fonts/ |
| Brand mode | No Accenture brand token system; generic colour palette | Accenture brand applied: #A100FF purple, 0px border radius, --pv22-* CSS custom property system; npm run check:accenture-brand verifies compliance | src/presentation-v2-2/styles/tokens.css and scripts/check-accenture-brand.ts |
| Speaker notes format | Structured in PRESENTATION_V2_1_SCRIPT.md with Spoken script, Limitation, Transition, Likely questions, Appendix reference sections | Updated in PRESENTATION_V2_2_SCRIPT.md: Layout, Section, Presenting time, 150-200 word notes body, Key emphasis bullet, Transition line per slide | docs/PRESENTATION_V2_2_SCRIPT.md |
| Export script | scripts/export-deck.ts; captured scenes from V2.1 route; no data-presentation-slides attribute read | Updated to read data-presentation-slides DOM attribute from V2.2 route; output filename includes v2.2 version identifier | scripts/export-presentation.ts (V2.2 version) |
| Copy checker | Not present in V2.1 | npm run check:user-copy: scans src/presentation-v2-2/ for double-hyphen punctuation, em dash, umlaut characters, and compliance claim patterns | scripts/check-user-copy.ts |
| Brand preflight | Not present in V2.1 | npm run check:accenture-brand: validates --pv22-* token values, #A100FF purple, 0px radius, IBM Plex Sans font declaration, no --pv21-* references in V2.2 components | scripts/check-accenture-brand.ts |

---

## Verification commands

To verify the current state against this audit table, run:

```
npm run check:user-copy
npm run check:accenture-brand
npm run verify:presentation-assets
```

All three commands should exit with code 0 and report zero violations before any client session.

---
