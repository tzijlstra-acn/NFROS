# Handoff: Presentation V2.4 product proof

Status: done, not committed. Full reference: `docs/PRESENTATION_V2_4_PRODUCT_PROOF.md`.

## What exists

- Registry, manifest types, typed manifest loaders and the `ProductCapture` renderer in `src/presentation-v2-4/product-proof/`.
- `scripts/capture-presentation-assets-v2-4.ts` (`npm run presentation:capture-v2-4`) and `scripts/verify-presentation-assets-v2-4.ts` (`npm run verify:presentation-assets-v2-4`).
- Eleven real captures plus `manifest.json` in `public/presentation-assets/v2.4-final/`, all light theme, V3.3, 2x.
- Attribute-only region markers in seven product files (listed in the reference doc).

## Core assets (all captured, verify passes)

`or-home`, `tprm-home`, `rcsa-process-stage`, `tprm-onboarding-stage`, `evidence-review`, `decision-approval`.

Appendix: `meeting-preparation`, `actions`, `inbox-conversion`, `ai-partner`, `role-app-library`.

## Not captured, and why

- `execution-receipt`: no executed decision exists in the approved seeded day (`execution_receipt_lines` is empty), so the dock Activity tab renders no receipt. Producing one needs `Confirm and execute`, which writes to the database. This decision is with the user. The slide that names a receipt has no truthful capture today; `ProductCapture` shows an explicit "not available" box for it.
- `meeting-minutes`: the minutes archive is empty in the seeded day.
- `operations-status`: `/ops` renders dark V2 styling with overlapping sections at 1920 x 1080.
- The dock Activity tab is excluded from the registry: it is not deterministic, because each dock open appends two activity rows and the tab lists only the newest 60.

## Things the next person should know

- The capture is read-only apart from one product side effect: opening the AI Partner dock (for `ai-partner`) appends two rows to `ai_activity_entries` for `rcsa`. During this work the demo was reset once, then 22 such rows were added by exploration and capture runs (rcsa sequence 68 to 89). Nothing else changed: no decisions, approvals, suggestions or receipts.
- Drift is detected, not repaired. If a run fails on expected text, decide whether the product changed (update the registry) or the data drifted (`npm run demo:reset`, deliberately).
- Product copy changes alter the PNGs. Recapture and verify after any copy change on these screens; the capture rejects a spaced double hyphen separator and `now ago` in any region.
- Region and sub-region boxes come from the live DOM, so layout changes move them automatically on the next capture.
- `npx tsc --noEmit` is clean for these files. ESLint cannot parse TypeScript in this repo (no parser configured), which predates this work.
