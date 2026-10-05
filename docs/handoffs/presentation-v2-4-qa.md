# Presentation V2.4 QA handoff

Automated quality checks for the V2.4 deck, the results of the first full run, and what each owner needs to fix. How the checks work is in `docs/PRESENTATION_V2_4_QA_GUIDE.md`.

## Files

| File | Covers |
| --- | --- |
| `tests/e2e/presentation-v2-4-accessibility.spec.ts` | axe-core on cover, core 3, core 9, closing, first appendix slide, appendix index, help overlay |
| `tests/e2e/presentation-v2-4-brand.spec.ts` | Dashes and arrow markers, synthetic data label, light or brand purple background; core 1 to 14 and every appendix entry in the manifest |
| `tests/e2e/presentation-v2-4-typography.spec.ts` | 12 px minimum in slide pixels, one title size on standard slides, no clipped text |
| `tests/e2e/presentation-v2-4-exhibits.spec.ts` | Exhibit renders, stays inside its frame, no overlapping text, no console or page errors; live and export mode |
| `tests/e2e/presentation-v2-4-motion.spec.ts` | Reveal within 4 s, final state at once in export and reduced motion, `R` replay, `M` pause and resume |
| `tests/e2e/presentation-v2-4-product-proof.spec.ts` | Real captures from `/presentation-assets/v2.4-final/` on slides 6, 7, 8 and 10 |

Every detector was checked against injected faults (overflowing label, box outside the frame, colliding text, 11 px text, text cut by an `overflow: hidden` box) before the run.

## Results

`npx playwright test` with the six specs on `desktop-1920`, and the accessibility, brand and typography specs on `desktop-1366`. `npx tsc --noEmit -p tsconfig.json` passes. The first run was taken while other owners were still landing changes; the second run is the current state.

| Spec | 1920, first run | 1920, current | 1366, first run | 1366, current |
| --- | --- | --- | --- | --- |
| accessibility | 7 of 7 | 7 of 7 | 7 of 7 | 7 of 7 |
| brand | 14 of 15 | 15 of 15 | 15 of 15 | 15 of 15 |
| typography | 15 of 15 | 15 of 15 | 15 of 15 | 15 of 15 |
| exhibits | 28 of 28 | 28 of 28 | not required | not required |
| motion | 41 of 44 | 42 of 44 | not required | not required |
| product-proof | 3 of 4 | 4 of 4 | not required | not required |

The first 1920 run also included `presentation-v2-4-navigation.spec.ts` (navigation owner): 23 of 23 pass.

Fixed by their owners between the runs: the ">" console marker on slide 5 (now a square), the slide 10 reveal (now 3.3 s), and the product captures on slides 6, 7, 8 and 10. Product proof now also asserts the capture contract: at least one `[data-product-capture]` figure and none marked `data-capture-missing="true"`.

## Open failures and owners

| Spec | Slide | Cause | Owner |
| --- | --- | --- | --- |
| motion | 5 | The console panel ("$ nfros trace WI-2041", "GRC raises a control exception") mounts only at about 4.2 s after the slide and fades in until about 4.8 s; the slide keeps changing until about 6.8 s. Bring the first pass inside 3.8 s, or, if this is a later demo phase, mark its subtree with `data-pv24-loop`. | Slide 5 exhibit (`EngagementLayerExhibit.tsx`) |
| motion | 11 | Reveal ends at about 5.2 s: four connector lines (end 4.45 to 4.69 s) and the measurement rail "Measured, Baseline, Pilot, Scale decision" (end 5.05 to 5.25 s). | Slide 11 exhibit (`ValueTreeExhibit.tsx`) |

## Reveal times

Measured on the live deck at 1920 x 1080: time from slide mount to the last change in opacity, position, size, transform, clip path or stroke drawing of any element that then stays still for at least 3 s. Intentional loops (particles, pulses) are excluded. Repeat runs agreed within 0.1 s. "Before" is the first measurement; "now" is after other owners' changes. QA changed no timing.

| Slide | Exhibit | Before | Now | Note |
| --- | --- | --- | --- | --- |
| 1 | Cover | 2.7 s | 2.6 s | QA timing scope, within budget, not edited |
| 2 | Story path | 2.0 s | 2.0 s | QA timing scope, within budget, not edited |
| 3 | Fragmentation Sankey | 3.25 s | 3.3 s | QA timing scope, within budget, not edited |
| 4 | Friction causal chain | 1.9 s | 1.9 s | QA timing scope, within budget, not edited |
| 5 | Engagement layer | 8.0 s | 6.8 s | Over budget, see open failures |
| 6 | Workday product | 1.9 s | 3.5 s | Within budget after the capture redesign |
| 7 | Role architecture | 2.6 s | 2.3 s | |
| 8 | Role App swimlane | 3.75 s | 2.8 s | |
| 9 | Authority matrix | 3.5 s | 3.5 s | QA timing scope, within budget, not edited |
| 10 | Evidence thread | 5.6 s | 3.3 s | Fixed by its owner |
| 11 | Value tree | 5.2 s | 5.2 s | Over budget, see open failures |
| 12 | Service factory | 3.3 s | 3.3 s | Lead owned; measured only |
| 13 | Design partner path | 1.6 s | 1.6 s | Lead owned; measured only |
| 14 | Closing | 1.9 s | 1.9 s | QA timing scope, within budget, not edited |

All six exhibits in the QA timing scope already finish within 3.8 s, so no delay or duration was changed. `ServiceFactoryExhibit.tsx` and `DesignPartnerPathExhibit.tsx` were not edited.

## Accessibility findings

No serious or critical violations on any of the seven targets at either viewport.

| Kind | Rule | Where | Owner |
| --- | --- | --- | --- |
| Moderate | `skip-link` | All seven targets: the layout's "Skip to main content" link points at `#main`, which the V2.4 route does not render | Navigation (wrap the deck in `<main id="main">`) |
| Moderate | `region` | All seven targets: the skip link sits outside any landmark; same fix | Navigation |
| Needs review | `aria-prohibited-attr` | `aria-label` on generic elements: the cover, closing and authority matrix exhibit roots, and the `.pv24-slide-number` span. Screen readers ignore it there; add a role or use visually hidden text. | Exhibit owners; navigation for the footer |
| Needs review | `color-contrast` | 9 to 13 nodes per slide over gradients or layered backgrounds that axe cannot measure | Manual check |

## Notes for other owners

- Mark intentional loops built from finite animations with `data-pv24-loop`; true infinite animations need nothing.
- Run Playwright with `--output=<own folder>` while other runs are active; a shared `test-results/` is cleared by each new run and breaks the others.
