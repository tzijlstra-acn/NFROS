# Presentation V2.2 Export: Internal Hyperlinks

## What was added

The V2.2 PDF and PPTX exports now include internal navigation hyperlinks:

- **Core slides** that have appendix refs get clickable transparent regions over each chip in the AppendixRefBar. Clicking a chip jumps to the corresponding appendix slide.
- **Appendix slides** get a clickable region over the return button. Clicking it returns to slide 1 (first core slide). For PPTX, this is always slide 1; for PDF, the same.

## Libraries used

| Format | Library | Status |
|--------|---------|--------|
| PDF annotations | `pdf-lib` ^1.17.1 | Added to `dependencies` in `package.json`; NOT yet installed. Run `npm install`. |
| PPTX hyperlinks | `pptxgenjs` 4.0.1 | Already installed (devDependencies). Hyperlinks use `hyperlink: { slide: N }`. |

## Files changed

| File | Change |
|------|--------|
| `package.json` | Added `"pdf-lib": "^1.17.1"` to dependencies |
| `src/presentation-v2-2/export/pdf-links.ts` | New file: PDF annotation logic |
| `scripts/export-presentation-v2-2.ts` | Imports + calls annotations + PPTX link shapes |

## PDF annotation coordinates (1920x1080 canvas)

All coordinates are in **pixels from the top-left corner** of the slide canvas at 1920x1080. PDF annotations are converted to PDF page units at save time by scaling against the actual page dimensions.

### AppendixRefBar chips (core slides)

| Property | Value | Source |
|----------|-------|--------|
| Bar bottom (from slide bottom) | 64 px | `.pv22-ref-bar { bottom: var(--pv22-space-16) }` = 64px |
| Bar left | 48 px | `.pv22-ref-bar { left: var(--pv22-space-12) }` = 48px |
| Bar height | 40 px | `.pv22-ref-bar { height: 40px }` |
| Bar top (from slide top) | 976 px | 1080 - 64 - 40 |
| Label section width | 87 px | "MORE DETAIL" at 11px mono uppercase ~75px + 12px gap |
| First chip left | 135 px | 48 + 87 |
| Chip width | 140 px | Estimated; auto-sized chips vary by label length |
| Chip gap | 12 px | `--pv22-space-3` = 12px |
| Click region height | 40 px | Full bar height (generous target) |

### Return button (appendix slides)

The return button in `.pv22-appendix-footer` is **right-aligned** (`justify-content: flex-end`). The annotation covers the right side of the footer.

| Property | Value | Source |
|----------|-------|--------|
| Button width | 120 px | Estimated |
| Button height | 32 px | 8px padding top + 13px text + 8px padding bottom |
| Right edge | 1872 px | 1920 - 48 (right padding) |
| Button left | 1752 px | 1920 - 48 - 120 |
| Button top | 1040 px | Approximate; footer sits at bottom of 1080px slide |

## PPTX hyperlink geometry (13.333 x 7.5 inches)

All pixels are converted using: `inches = pixels * (13.333 / 1920)` = `pixels * 0.006944`

Key converted values:
- Bar top: 976 px → 6.778 in
- First chip left: 135 px → 0.938 in
- Chip width: 140 px → 0.972 in
- Chip height: 40 px → 0.278 in
- Return button left: 1752 px → 12.167 in
- Return button top: 1040 px → 7.222 in (near bottom of 7.5in slide)

PPTX slide numbers are 1-based: core slides = 1 to N; appendix slides = N+1 to M.

## How to verify in Adobe Acrobat

1. Open the exported PDF in Adobe Acrobat.
2. Go to **Edit PDF** (or use the Hand tool).
3. Click on a chip area at the bottom of a core slide. The PDF should jump to the corresponding appendix slide.
4. On an appendix slide, click the return button area (top-right of the footer). The PDF should jump to slide 1.
5. To inspect annotation regions: **Tools > Edit PDF > Link > Add/Edit Web or Document Link** -- existing annotations will appear as blue rectangles.

## Known limitations

1. **Chip width is estimated.** The `.pv22-ref-chip` element has auto width based on its label text. A chip with a short label ("AI layer: model") may be narrower than 140px; a chip with a long label ("Platform architecture overview") may be wider. The 140px annotation covers an approximate region -- it will not perfectly align with every chip. Consider measuring actual chip widths during a real capture and adjusting `CHIP_W_PX`.

2. **Chip X does not account for all label variation.** The "More detail" label width is estimated at 87px. If the font renders differently (Graphik vs Arial fallback), this offset will shift slightly.

3. **Return button position assumes a consistent footer height.** The footer height depends on content; the 1040px Y estimate may need adjustment if the actual footer renders higher or lower.

4. **pdf-lib is not yet installed.** Until `npm install` is run after the `package.json` change, the annotation step will log a warning and skip annotations. The PDF will still export correctly without annotations.

5. **Image-based PDF limitation.** Since the PDF pages are screenshots (images), all links are annotation overlays, not native interactive elements. The PDF viewer must support PDF link annotations (Adobe Acrobat, most modern viewers do; some lightweight viewers may not).

6. **PPTX return button always links to slide 1.** We do not track which core slide originally opened each appendix slide, so the return link always goes to the deck cover. To link back to the specific originating core slide, the appendix render URL would need to encode the source slide index.

## Dependency status

```
pdf-lib: ^1.17.1
  Status: added to package.json dependencies; NOT YET INSTALLED
  Action: run `npm install` to install
  Impact: without it, PDF annotations are skipped (warning logged); PDF export still completes
```

```
pptxgenjs: 4.0.1
  Status: already installed (devDependencies)
  Impact: PPTX hyperlinks are active as of this change
```
