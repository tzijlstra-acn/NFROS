# Presentation V2.4 export handoff

## What was built

- `scripts/export-presentation-v2-4.ts`: gates, DOM manifest discovery, capture, link measurement, PDF, PPTX, notes, metadata, hashes, montages, verification and publishing.
- `scripts/verify-presentation-exports-v2-4.ts`: independent verification of exports/ and public/downloads/.
- `src/presentation-v2-4/export/`: manifest parsing and validation, link resolution, pdf-lib builder and inspector, PPTX inspector with a small ZIP reader, brand asset resolution, safety scanning, montage rendering, and the draft-only data fallback.
- Usage and design: `docs/PRESENTATION_V2_4_EXPORTS.md`.

No deck components, data, exhibits, app routes or package.json entries were changed.

## Last release run (2026-10-04)

- Manifest source: deck DOM (`script[data-presentation-slides]`); every slide signalled `data-slide-ready`.
- 37 slides: 13 core, 1 closing, 1 appendix index, 22 appendix.
- Core PDF 14 pages, no link annotations, 28 appendix references left unlinked by design.
- Full PDF 37 pages and PPTX 37 slides, 95 links each: 28 appendix chips, 22 returns, 22 index entries, 22 index links, 1 core link (index back to the agenda).
- Every cited appendix slide returns to a core slide that cites it; every appendix slide is linked from the index.
- Product proof gate: `scripts/verify-presentation-assets-v2-4.ts` ran and passed; no "Capture pending" placeholders.
- Verifier: 41 of 41 checks without failure, including the live deck cross-check.
- Brand mode: Development only (brand asset directory not configured; brand preflight passed).
- Published to `public/downloads/`.

## Old bugs avoided

| V2.3 bug | V2.4 behaviour |
| --- | --- |
| Appendix captured with the wrong URL | URLs come from the manifest; each capture must show its title and differ from every other capture |
| Empty speaker notes | Notes come from the manifest and the export fails on any empty note |
| Hard-coded link positions | Rectangles are measured from `[data-link-target]` in each capture |
| Return always to page 1 | Returns follow `core:N` from the DOM and must land on a citing core slide |

## Pending

- Brand: client-facing exports need `ACCENTURE_BRAND_ASSET_DIR` with the approved logo, Greater Than symbol and Graphik. Until then only internal review exports are possible (`--client-facing` fails as intended).
- Traceability: the last run recorded HEAD `6c2cf46` with uncommitted deck changes from parallel work (`workingTreeDirty: true`). Re-export after those changes are committed.
- The deck manifest is rendered on the client in some states; when the server HTML lacks it, the verifier's live cross-check reports SKIP rather than PASS.
