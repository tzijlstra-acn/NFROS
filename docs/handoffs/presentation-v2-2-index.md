# Presentation V2.2: Handoff Index

This is the first document a new team member should read before working on the V2.2 presentation. It lists all V2.2 handoff documents with a one-line description of each and links to the source of truth for each domain.

If you are joining the project mid-stream, start here, then open the truth audit to understand what changed from V2.1, then read the speaker script to understand what the deck is saying and why.

---

## Architecture

Documents covering the slide engine, motion system, route handling, and navigation.

| Document | Description |
|---|---|
| `docs/handoffs/presentation-v2-2-current-audit.md` | Snapshot of the V2.2 codebase state: components implemented, token system, route resolution, slide data shape. |
| `docs/handoffs/presentation-v2-2-motion.md` | Motion system design: tokens, variants, RevealSequence and MotionPath components, SharedSlideTransition, motion v13.4.6 integration. |
| `docs/PRODUCT_ARCHITECTURE.md` | Overall NFR OS platform architecture that the presentation represents; the three-layer model (role, workflow, AI) explained at the system level. |
| `docs/ROLE_APP_ARCHITECTURE.md` | Role App structure and registry; how RCSA Cycle Assistant and Third-Party Onboarding are defined as typed, eight-stage workflows. |

---

## Content

Documents covering the slide copy, data files, and presenter script.

| Document | Description |
|---|---|
| `docs/PRESENTATION_V2_2_SCRIPT.md` | V2.2 presenter script: 13 slides with layout, section, presenting time, 150-200 word speaker notes, key emphasis, and transition per slide. Read this before presenting. |
| `docs/handoffs/presentation-v2-2-copy.md` | Copy rules for V2.2: no double-hyphen punctuation, no em dash, no umlaut characters, Accenture voice guidelines, regulatory disclaimer placement. |
| `src/presentation-v2-2/data/core-story.ts` | Source of truth for all 13 slide titles, subtitles, speaker notes, appendix references, and structured content (processRows, roleColumns, outcomes, serviceLayers, rolloutSteps). |
| `src/presentation-v2-2/data/types.ts` | TypeScript interfaces: CoreSlide22, Outcome, ServiceLayer, RolloutStep, RoleColumn, ProcessRow, AppendixReference. These enforce the shape of all slide data. |

---

## Brand

Documents covering Accenture brand configuration and the sign-off checklist.

| Document | Description |
|---|---|
| `docs/handoffs/presentation-v2-2-accenture-brand.md` | Accenture brand application guide: --pv22-* token system, #A100FF purple, 0px border radius, IBM Plex Sans font, sharp-corner layout rules. |
| `docs/PRESENTATION_V2_2_BRAND_SIGN_OFF.md` | Brand sign-off checklist: items that must be verified before the presentation is distributed to a client. |
| `src/presentation-v2-2/styles/tokens.css` | CSS custom properties source of truth: all --pv22-* tokens with their Accenture brand values. |

---

## Ops

Documents covering product asset capture, export pipeline, and QA procedures.

| Document | Description |
|---|---|
| `docs/PRESENTATION_V2_2_QA_GUIDE.md` | Pre-session QA checklist: eight pre-flight items, route verification matrix, keyboard shortcut reference, export verification steps, copy and brand compliance checks, appendix navigation tests, accessibility walkthrough, and known limitations. |
| `docs/handoffs/presentation-v2-2-product-captures.md` | Product capture infrastructure: data-presentation-region markers, how to run npm run capture:presentation-assets, how to verify with npm run verify:presentation-assets, expected asset list. |
| `scripts/export-presentation.ts` | Export script entry point for V2.2. Reads data-presentation-slides DOM attribute, captures at 1920x1080, outputs PDF and PPTX to exports/ with v2.2 version identifier. |
| `scripts/check-user-copy.ts` | Copy compliance checker: run with npm run check:user-copy. |
| `scripts/check-accenture-brand.ts` | Brand preflight checker: run with npm run check:accenture-brand. |

---

## Change record

Documents recording what changed in V2.2 and what was verified.

| Document | Description |
|---|---|
| `docs/handoffs/presentation-v2-2-truth-audit.md` | Feature-by-feature comparison of V2.1 state versus V2.2 state with the source of truth file for each claim. Start here when a fact is disputed. |
| `CHANGELOG.md` | Project-level changelog: V2.2.0 entry lists all changes including route fix, punctuation corrections, stage count corrections, brand tokens, motion system, appendix navigation, and new npm scripts. |
| `docs/PRESENTATION_V2_1_SCRIPT.md` | Archived V2.1 presenter script. Retained for reference. An archive notice at the top of the file points to the V2.2 script. Do not use V2.1 script content in client sessions. |

---

## Quick orientation for new team members

1. Read this index (you are here).
2. Open `docs/handoffs/presentation-v2-2-truth-audit.md` to understand what V2.2 corrects from V2.1.
3. Open `docs/PRESENTATION_V2_2_SCRIPT.md` to understand the 13-slide narrative and what each slide says.
4. Run `npm run check:user-copy` and `npm run check:accenture-brand` to verify the codebase is in a clean state.
5. Open `/story?deck=v2.2` in the browser and step through all 13 slides using keyboard navigation.
6. Read `docs/PRESENTATION_V2_2_QA_GUIDE.md` in full before any client session.

---
