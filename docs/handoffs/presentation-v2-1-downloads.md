# Presentation V2.1 -- Downloads

## Download routes

The download menu (accessible via the D key or the Download button) links to two files served from the Next.js `public/` directory.

| Label | Path | Expected slides |
|-------|------|----------------|
| Core and Appendix | `/downloads/NFROS_Risk_Audience_Core_and_Appendix.pdf` | 36 (13 core + 23 appendix) |
| Core only | `/downloads/NFROS_Risk_Audience_Core.pdf` | 13 |

These files must exist at `public/downloads/NFROS_Risk_Audience_Core_and_Appendix.pdf` and `public/downloads/NFROS_Risk_Audience_Core.pdf` before a client session. Next.js serves `public/` files as static assets -- no API route is needed.

The download menu is in `src/presentation-v2-1/components/DownloadMenu.tsx`. The `href` values in that component must match the paths above. If the filenames change, update `DownloadMenu.tsx` to match.

## How to regenerate PDFs

There are two approaches.

### Approach 1: Export pipeline (preferred)

Run:
```
npm run export:deck
```

The export pipeline in `scripts/export-deck.ts` captures the presentation at `/story?deck=v2.1&export=1` and generates slide images. Check the script for the exact arguments to produce a PDF output versus a PNG sequence.

Note: the V2.1 export route was added as part of this integration. Verify that `export-deck.ts` has been updated to support the `?deck=v2.1` route before relying on this approach.

### Approach 2: Browser print-to-PDF (manual fallback)

1. Open `/story?deck=v2.1&export=1` in Chrome or Edge at a 1920x1080 viewport.
2. Use the browser's print function with "Save as PDF" and set page size to 1920x1080 or Widescreen (16:9).
3. Walk through all slides using the arrow keys, taking one PDF page per slide.
4. Assemble the pages into a single PDF using a tool like PDFtk or Adobe Acrobat.

This approach is manual and error-prone. Use the export pipeline unless it is unavailable.

## Stale export protection

A PDF that was generated from an earlier version of the slide data is stale. The filename alone does not indicate freshness. Before each client session:

1. Open `public/downloads/NFROS_Risk_Audience_Core.pdf`.
2. Check that the title of slide 1 is "NFR work built around people" and the title of slide 13 is "Proposed next step."
3. Check that the slide count is 13 for the core PDF and 36 for the full PDF.
4. If any title does not match the current `CORE_SLIDES` or `APPENDIX_SLIDES` arrays, regenerate.

The source of truth for slide content is:
- `src/presentation-v2-1/data/core-story.ts` (CORE_SLIDES)
- `src/presentation-v2-1/data/appendix.ts` (APPENDIX_SLIDES)

## Export mode behaviour

When `exportMode=true` is passed to `PresentationV21`, the component:
- Hides the download button
- Hides the download menu
- Applies the `pv21-export-mode` class to the root wrapper

The `?export=1` URL parameter sets `exportMode=true` through the server component in `app/story/page.tsx`. Export mode is designed for the capture pipeline -- it ensures that no UI chrome (buttons, menus) appears in captured frames.

## Content type note

Next.js serves `public/` files with the content type inferred from the file extension. PDF files receive `application/pdf`. The `download` attribute on the link element is set in `DownloadMenu.tsx` to prompt a file save rather than an in-browser open. If a browser opens the PDF inline instead of downloading, verify that the `download` attribute is present on the `<a>` element.
