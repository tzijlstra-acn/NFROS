# NFROS Presentation V2.2: QA Guide

---

## 1. Pre-presentation checklist

Run through all eight items before every client session.

- [ ] **Server running.** `npm run dev` is active and the terminal shows no build errors. Port 3000 is confirmed available.
- [ ] **Browser state clean.** Open a fresh browser tab or profile with no cached routes from a previous session. Incognito mode is acceptable.
- [ ] **Deck version verified.** Navigate to `/story?deck=v2.2` and confirm slide 1 loads with the title "NFR work built around you" and the V2.2 layout (Accenture purple accent, 0px radius, IBM Plex Sans).
- [ ] **Keyboard shortcuts tested.** Press ArrowRight to advance one slide, ArrowLeft to go back, and `P` to open speaker notes. Confirm all three work before the session starts.
- [ ] **Export mode checked.** Open `/story?deck=v2.2&export=1` and confirm the download button (`D` key overlay) is not visible in export mode.
- [ ] **Speaker notes visible.** Press `P` on slide 1 and confirm the notes panel opens, shows content, and does not obscure slide content.
- [ ] **Brand assets present.** Confirm the Accenture purple (`#A100FF`) accent appears on slide 1 and that no fallback sans-serif font is rendering in place of IBM Plex Sans.
- [ ] **Regulatory disclaimers present.** Open slides 9 and 10 and confirm the phrase "Illustrative regulatory context, not legal advice" is present in the speaker notes panel for those slides.

---

## 2. Route verification matrix

Test each route before first client use. Mark pass or fail in the final column.

| URL | Expected deck | Expected slide | Pass / Fail |
|---|---|---|---|
| `/story` | V2.2 (default as of V2.2 release) | Slide 1 | |
| `/story?deck=v2.2` | V2.2 | Slide 1 | |
| `/story?deck=current` | V2.2 | Slide 1 | |
| `/story?deck=v2.1` | V2.1 | Slide 1 | |
| `/story?deck=v2.2&slide=7` | V2.2 | Slide 7 (Role Apps) | |
| `/story?deck=v2.2&slide=13` | V2.2 | Slide 13 (Next Step) | |
| `/story?deck=v2.2&export=1` | V2.2 export mode | Slide 1, no download overlay | |
| `/story?deck=v2.2&slide=5&export=1` | V2.2 export mode | Slide 5 | |
| `/story` (no params, post-release) | V2.2 | Slide 1 | |
| `/story?deck=v1` | Original V1 deck | Slide 1 | |

Expected result for all rows: page loads without a Next.js error boundary. Any 404 or white screen is a failure.

---

## 3. Keyboard shortcut reference

Test each shortcut before a client session. The shortcut column lists the exact key or key combination.

| Key | Action | Notes |
|---|---|---|
| ArrowRight | Advance one slide | Wraps to end-of-core prompt after slide 13 |
| ArrowLeft | Go back one slide | No action on slide 1 |
| Space | Advance one slide | Same as ArrowRight |
| Home | Jump to slide 1 | Works from any position in core |
| End | Jump to slide 13 | Works from any position in core |
| P | Toggle speaker notes panel | Panel opens to the right of the slide canvas |
| A | Toggle agenda overlay | Shows all 13 slide titles with section labels |
| C | Return to core slide 1 | Closes appendix navigation and resets to slide 1 |
| D | Toggle download menu | Not visible in export mode |
| F | Request fullscreen | Browser will prompt on first use per session |
| Escape | Close active overlay | Closes agenda, end-of-core prompt, or download menu |
| ? | Toggle help overlay | Lists all keyboard shortcuts |

---

## 4. Export verification

### PDF export

1. Run `npm run export:presentation` from the project root.
2. Confirm the script reads the `data-presentation-slides` DOM attribute from the rendered page (V2.2 export reads this attribute; earlier scripts did not).
3. Confirm the output PDF is written to `exports/` with a filename that includes `v2.2` in the name.
4. Open the PDF and verify:
   - Slide count: exactly 13 slides in the core export.
   - Slide 1 title: "NFR work built around you".
   - Slide 7 subtitle: "RCSA and TPRM as eight-stage structured workflows" (not six-stage).
   - Slide 13 is present and ends with the emphasis line "A decision, not a commitment to scale".
5. Check that brand colours are rendering correctly in the PDF (Accenture purple accent, light background, no dark-mode slides in core).

### PPTX export

1. Confirm the PPTX file is also written to `exports/` alongside the PDF.
2. Open in PowerPoint or Keynote and verify slide count matches the PDF (13 core slides).
3. Check that slide titles and subtitles are present as text elements (not flattened into images).

### Metadata check

- Verify the export filename includes the version identifier `v2.2`.
- Verify the creation date in the file metadata is within 24 hours of the export run.
- If a stale export exists from a previous run, delete or rename it before distributing.

---

## 5. Copy compliance

### Running the checker

```
npm run check:user-copy
```

This script scans all V2.2 data files (TypeScript source under `src/presentation-v2-2/`) for:
- Double-hyphen sequences used as punctuation (`--` where not a code comment or CSS variable name).
- Em dash character (U+2014).
- Umlaut characters (ae, oe, ue as multi-byte characters).
- Fabricated savings or compliance claims.

### Expected output

A passing run produces:

```
User copy check: PASS
Files scanned: [N]
Violations found: 0
```

### Handling failures

If the check reports violations, the output lists the file path, line number, and the offending string. Fix each violation before any client session. The V2.2 data files in `src/presentation-v2-2/data/` were clean at release. Violations introduced after release must be corrected before distributing.

---

## 6. Brand compliance

### Running the checker

```
npm run check:accenture-brand
```

This script checks:
- CSS custom properties under the `--pv22-*` namespace are defined and resolve to Accenture brand values.
- The primary purple token resolves to `#A100FF`.
- Border radius tokens resolve to `0px` (sharp corners, per Accenture brand).
- IBM Plex Sans is the declared font family for body text.
- No V2.1 token names (`--pv21-*`) are referenced in V2.2 component files.

### Expected output

A passing run produces:

```
Accenture brand check: PASS
Token violations: 0
Font violations: 0
Radius violations: 0
```

### Development mode note

In Next.js development mode (`npm run dev`), brand asset hot-reloading may cause a brief flash of unstyled content on first load. This is expected in dev mode only. Verify brand rendering in a production build (`npm run build && npm run start`) before any client session.

---

## 7. Appendix navigation

### Testing core-to-appendix links

1. Advance to the end of slide 13. The end-of-core prompt appears.
2. Click "Open appendix" or press the relevant key. Confirm the appendix opens at slide A1.
3. Navigate to appendix slide A3 (RCSA Cycle Assistant: eight-stage detail). Confirm the slide loads and the title references eight stages.
4. Navigate to appendix slide A4 (Third-Party Onboarding: eight-stage detail). Confirm the same.
5. From appendix A3, press `C`. Confirm the view returns to core slide 1.

### URL state

- Confirm that navigating to an appendix slide updates the URL to include an appendix slide identifier.
- Confirm that copying and pasting that URL into a new tab loads the correct appendix slide.
- Confirm that pressing the browser back button from an appendix slide returns to the last core slide visited, not slide 1.

### Return-to-origin

- Press `C` from any appendix slide. Confirm the deck returns to core slide 1.
- Press `C` from core slide 7. Confirm no navigation occurs (C key only acts as a return trigger from within appendix navigation).

---

## 8. Accessibility

### Keyboard-only navigation walkthrough

Complete this walkthrough without using a mouse or trackpad.

1. Load `/story?deck=v2.2` using the keyboard only.
2. Press Tab to verify focus is placed on the first interactive element (expected: slide canvas or skip-to-main-content link).
3. Press the skip-to-main-content link if it appears, and confirm focus moves to the slide area.
4. Press ArrowRight to advance through all 13 slides, one at a time. Confirm each slide advances without requiring a mouse click.
5. On slide 7, press `P` and confirm the speaker notes panel opens and the notes text is readable without a screen reader.
6. Press `A` to open the agenda overlay. Tab through the agenda items and confirm each item is focusable.
7. Press Escape to close the agenda overlay and confirm focus returns to the slide area.
8. Advance to slide 13, then press ArrowRight one more time. Confirm the end-of-core prompt appears and is keyboard-accessible.
9. Press Escape to dismiss the end-of-core prompt.

A full accessibility test using the axe integration is run as part of the Playwright test suite (`npm run test:presentation`). Review the axe report for any violations introduced since the last passing run.

---

## 9. Known limitations

These are accurate as of V2.2 release. Do not present the platform as having resolved these without verifying against the current codebase.

**Brand in Development mode.** The Accenture brand token system (`--pv22-*` CSS custom properties) is fully implemented in production builds. In `npm run dev`, hot-module replacement may cause a brief flash of unstyled content on the first load of a V2.2 slide. This resolves after the first render cycle. Verify brand rendering in a production build before any client session.

**Real product captures not yet generated.** The V2.2 slide data references screenshot assets (for example, `or-partner-workhub.png` and `rcsa-cycle-stage-2.png`) that are expected to be generated by the `npm run capture:presentation-assets` script. If those assets have not been captured, slides that reference them will render a placeholder. Run `npm run verify:presentation-assets` to confirm which assets are present before a client session.

**Appendix routes map to V2.1 appendix content.** V2.2 corrects the core 13-slide deck. Appendix slides A3 and A4, which describe the RCSA and TPRM stage counts, may still reference six stages in some versions. Verify appendix content matches the eight-stage counts before using them in a client session.

**Multi-tenant isolation not tested.** The audit log and workflow data are implemented for single-tenant use. Multi-tenant isolation has not been independently verified. Single-tenant deployment is recommended for the pilot.

**Security and penetration test not yet executed.** The platform has not undergone an independent penetration test. Do not describe the platform as security-cleared or penetration-tested.

---
