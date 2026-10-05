# NFROS Presentation V2.4 exports

The V2.4 export pipeline turns the running deck into a core PDF, a full PDF with working internal links, a PowerPoint file with speaker notes and slide links, and a speaker notes document. Everything is read from the deck DOM, so the exports cannot drift from what the room sees.

## Commands

```
npm run export:presentation-v2-4          # internal review export, publishes after verification
npm run verify:presentation-exports       # re-verify exports/ and public/downloads/
```

The app must already be running (`npm run dev`, default `http://localhost:3000`; override with `NFR_BASE_URL`). The exporter never starts or stops it.

Flags for the exporter:

| Flag | Effect |
| --- | --- |
| `--client-facing` | Fails unless `ACCENTURE_BRAND_ASSET_DIR` holds the approved logo, the Greater Than symbol and Graphik Regular and Semibold, `scripts/check-accenture-brand.ts` passes, the product proof verifier exists and passes, and no slide shows a "Capture pending" placeholder. |
| `--draft` | Allows the data module fallback when the deck manifest is absent and downgrades capture integrity problems to warnings. Drafts are verified but never published. |

The verifier takes `--exports-only` to skip the `public/downloads/` checks (the exporter uses it before publishing).

## Outputs

| File | Content |
| --- | --- |
| `exports/NFROS_Risk_Audience_V24_Core.pdf` | Core slides 1 to 13 plus the closing slide. Appendix chips are visible but not linked; the PDF subject and the export metadata state that appendix references resolve in the full deck. |
| `exports/NFROS_Risk_Audience_V24_Core_and_Appendix.pdf` | Core, closing, appendix index and appendix slides, with GoTo links. |
| `exports/NFROS_Risk_Audience_V24_Core_and_Appendix.pptx` | One full-bleed 16:9 image per slide, speaker notes on every slide, transparent link shapes with internal slide hyperlinks. |
| `exports/NFROS_Risk_Audience_V24_Speaker_Notes.md` | Every slide in order with number, section, title, notes and its links. |
| `exports/NFROS_Risk_Audience_V24_Export_Metadata.json` | Deck version, commit, timestamp, brand mode, gate results, slide and link counts, file hashes and the per-slide link map. |
| `exports/NFROS_Risk_Audience_V24_Export_Hash.txt` | SHA-256 of the four deliverables and the metadata file. |
| `exports/slides-v2-4/NN-key.png` | Individual slide captures, 3840 x 2160. |
| `docs/screenshots/presentation-v2-4-final/montage-core.png`, `montage-appendix.png` | Labelled contact sheets of the core and closing slides, and of the index and appendix slides. |

After verification passes, the four deliverables, the metadata and the hash file are copied to `public/downloads/`.

## How it works

1. **Gates.** The brand preflight always runs and its result is recorded. Brand mode is "Development only" unless the brand assets are configured and the preflight passes. The product proof gate runs `scripts/verify-presentation-assets-v2-4.ts` when it exists and fails the export if it fails; when it is absent the metadata records `not-run`.
2. **Discovery.** The exporter opens `/story?deck=v2.4&core=1&export=1&safe=1` and reads `script[data-presentation-slides]`. The order must be core 1 to 13, closing, appendix index, appendix slides. Without the manifest a release export fails; a draft falls back to the V2.4 data modules.
3. **Capture.** Each manifest URL is opened with `deck=v2.4`, `export=1` and `safe=1` set explicitly. The exporter waits for `.pv24-slide[data-slide-ready="true"]`, `document.fonts.ready` and every image to decode, then screenshots the slide rectangle at 1920 x 1080 with device scale 2. PNGs are kept for the archive and montages; JPEG at quality 92 is used inside the PDF and PPTX to keep file sizes reasonable.
4. **Integrity.** A release export fails if a slide never signals ready, renders at the wrong scale, does not show its manifest title, is pixel identical to another slide (the wrong URL symptom), has empty notes, has a measured chip that was not linked, lacks a return control, returns to a core slide that does not cite it, or is missing from the index.
5. **Links.** Every visible `[data-link-target]` element is measured relative to `.pv24-slide`, divided by the slide scale and clipped to overflow-clipping ancestors. Targets resolve against the manifest: `appendix:app-XX` to that appendix slide, `core:N` to core slide N (14 is the closing slide), `appendix-index` to the index. Navigation controls are written last so they sit on top if areas overlap. PDF rectangles use 0.75 pt per slide pixel on a 1440 x 810 pt page; PPTX shapes use the 13.333 x 7.5 inch layout with a fully transparent fill so the whole area is clickable.
6. **Self-describing links.** Each PDF annotation carries `NM = "link <target>"` and each PPTX shape is named the same way, so the verifier can check every destination against the manifest independently of the exporter.

Link kinds counted in the metadata: `appendix-chip` (core to appendix), `return` (appendix to its origin core slide), `index-entry` (index to appendix), `index-link` (any slide to the index), `core-link` (other links to core slides), `appendix-cross` (appendix to appendix).

## Verification

`scripts/verify-presentation-exports-v2-4.ts` exits non-zero on any failure. It checks that:

- all files exist and are non-trivial, and the metadata names deck version v2.4, a full commit hash and a brand mode;
- the recorded manifest follows the deck order and the slide counts agree;
- the metadata and hash file SHA-256 values match every file;
- the core PDF has 14 pages, no links to pages it does not contain and the appendix note; the full PDF has one page per manifest slide;
- every PDF link is a GoTo to a valid page, lands on the slide its target names, sits on a measured DOM anchor, and the counts per kind match the metadata;
- every cited appendix slide returns to a core slide that cites it, and every appendix slide is linked from the index;
- the PPTX opens as a ZIP, has the right slide count, an image and notes on every slide, and every `ppaction://hlinksldjump` relationship in `ppt/slides/_rels/*.rels` targets an existing, correct slide;
- the notes document lists every slide in order with section, title and notes;
- no secret token patterns, `.env` values, local absolute paths or em and en dashes appear in metadata, notes, PPTX slide and notes XML, or PDF metadata and text streams;
- when the app is reachable, the exported order and titles still match the live deck;
- in full mode, the export came from the DOM manifest in release mode and the published copies match.

## Known limits

- Slides are images; the PDFs have no selectable text layer.
- The PPTX slide master generated by pptxgenjs defines an en dash bullet glyph for a level two list style. It is library boilerplate, not deck copy, so the dash check covers slides, notes and document properties only.
- The full PDF and the PPTX are about 23 MB each at device scale 2.
- The metadata records the HEAD commit and `workingTreeDirty`; export from a clean tree for a traceable release.
