# NFROS Presentation V2.1 -- QA Guide

---

## 1. Pre-meeting checklist

Run through this list before every client session.

### Route verification
- [ ] Dev server running on port 3000 (`npm run dev`)
- [ ] `/story?deck=v2.1` loads slide 1 without error in the browser
- [ ] `/story?deck=v2.1&slide=5` loads slide 5 directly
- [ ] `/story?deck=v2.1&export=1` loads in export mode (no download button visible)
- [ ] `/story` (no deck param) loads the original v1 deck unchanged
- [ ] `/story?deck=current` loads the original v1 deck (explicit alias check)

### Keyboard navigation
- [ ] ArrowRight advances from slide 1 to slide 2
- [ ] ArrowLeft goes back from slide 2 to slide 1
- [ ] Space bar advances a slide
- [ ] Home key returns to slide 1 from any slide
- [ ] End key goes to slide 13 from any position in core
- [ ] After slide 13, ArrowRight shows the end-of-core prompt (not auto-advance)
- [ ] Escape closes the end-of-core prompt
- [ ] A key toggles the agenda overlay
- [ ] C key closes appendix and returns to core slide 1
- [ ] F key requests fullscreen (browser will prompt on first use)
- [ ] P key toggles the speaker notes panel
- [ ] D key toggles the download menu (not visible in export mode)
- [ ] ? key toggles the help overlay

### Download verification
- [ ] Download menu opens with D key
- [ ] "Core and Appendix" PDF link renders with a download attribute
- [ ] "Core only" PDF link renders with a download attribute
- [ ] PDF links point to `/downloads/NFROS_Risk_Audience_Core_and_Appendix.pdf` and `/downloads/NFROS_Risk_Audience_Core.pdf`
- [ ] PDF files exist in `public/downloads/` (check before first client use)
- [ ] Clicking a PDF link in the browser does not produce a 404

### Speaker notes
- [ ] Pressing P on slide 1 shows the notes panel
- [ ] Notes content is visible and not truncated
- [ ] Pressing P again closes the notes panel
- [ ] Notes panel does not block slide content

---

## 2. Core comprehension test

Ask these questions internally before a client session. The deck should support a clear answer to each.

1. What is the single problem NFR OS is solving? (fragmented NFR work -- coordination overhead displacing senior judgment)
2. What are the three design principles? (work finds you, judgment stays with you, progress is visible)
3. Name two things the AI does in the workflow. (any two of: aggregate data, generate drafts, flag anomalies, link evidence)
4. Name two things the AI does NOT do. (assess risk ratings, challenge assessments, approve outputs, escalate)
5. How many stages does the RCSA Cycle Assistant have? (six: Scope, Assess, Draft, Review, Challenge, Submit)
6. What are the two launch role operating systems? (OR Partner OS and TPRM Manager OS)
7. What is the subscription metric? (active role seats -- number of professionals actively using NFR OS per month)
8. How long is the proposed pilot? (ten weeks)
9. How many professionals are in the pilot cohort? (three to five)
10. What is the decision available to the client at week ten? (expand, adjust, or stop -- no automatic commitment to scale)

All ten should be answerable from the core deck without opening the appendix.

---

## 3. Text density check

Use these limits as a red flag test. Any slide exceeding the limits has too much text.

| Slide element | Maximum word count |
|--------------|-------------------|
| Slide title | 10 words |
| Subtitle | 15 words |
| Body copy paragraph | 40 words |
| Single bullet point | 15 words |
| All bullets combined on one slide | 60 words |
| Callout or emphasis line | 8 words |

Check every core slide against these limits before first use. If a slide exceeds limits, review the layout in `SlideRenderer.tsx` to ensure text is not overflowing the 1920x1080 canvas.

---

## 4. Visual consistency checks

Verify these properties hold across all 13 core slides.

### Typography
- [ ] All body text renders in IBM Plex Sans (sans-serif fallback should never appear)
- [ ] Code and labels where applicable render in IBM Plex Mono
- [ ] No bold text in body copy except where explicitly marked as emphasis

### Colour and theme
- [ ] No dark-background slides in the core deck (all slides use the light theme)
- [ ] Accent colour (`--pv21-color-accent`) is consistent across all callouts and highlights
- [ ] Section labels in the top-left are in secondary colour, not primary
- [ ] No slides use red or orange except where a specific status label requires it

### Layout
- [ ] Slide canvas is 1920 x 1080 px (check `pv21-slide` class dimensions in the CSS)
- [ ] Slide scales correctly in the browser letterbox at 1280x800 and 1920x1080 viewports
- [ ] Section label appears top-left on all slides that have a `section` field
- [ ] Slide number counter appears bottom-right on all slides
- [ ] Footer text ("NFR Operating System") appears on slide 1 and wherever `footer` is set

### No dark slides in core
- [ ] Verify background colour is `--pv21-color-surface` (light) on every core slide, not dark.

---

## 5. Product truth checks

These are the status labels that must be accurate before any client session. Cross-reference against appendix A1 (product scope and release status) and A22 (current limitations).

| Feature | Correct status label | Do not say |
|---------|---------------------|-----------|
| OR Partner OS | Implemented (running locally) | Production-ready, deployed |
| TPRM Manager OS | Implemented (running locally) | Production-ready, deployed |
| RCSA Cycle Assistant | Implemented (running locally) | Production-ready |
| TPRM Onboarding | Implemented (running locally) | Production-ready |
| Control Assurance OS | Demonstration only | Implemented, available |
| Incident and Resilience OS | Demonstration only | Implemented, available |
| Regulatory Change OS | Planned | Under development, coming soon |
| NFR Governance OS | Planned | Under development, coming soon |
| Live bank connectors | Not supported | Available, can be configured |
| OIDC / SSO | Designed, not implemented | Implemented, available |
| Evaluation harness (live calls) | Configured, not independently verified | Verified, tested |
| Production cloud deployment | Configured, not independently verified | Deployed, live |
| Security / penetration test | Planned, not executed | Completed, cleared |
| Load testing | Planned, not executed | Completed |

If a client asks about any item in the "Do not say" column, use only the correct status label.

---

## 6. Commercial guardrails

Nine things not to say in or around the deck.

1. **Do not quote specific prices.** The commercial model describes structure only. Pricing is subject to commercial negotiation. Leave specific rates for a separate commercial conversation.
2. **Do not claim regulatory compliance.** Say: "NFR OS is designed to support the documentation, evidence, and audit trail expectations common across major NFR frameworks." Add: "Illustrative regulatory context, not legal advice." Do not say: "NFR OS is compliant with MaRisk / FINMA / EBA guidelines."
3. **Do not claim production deployment.** The platform runs locally and is configured for deployment. It has not been verified in a client cloud environment. Do not say "deployed" or "live" without qualifying "in a client environment."
4. **Do not claim a security clearance.** The penetration test has not been executed. Do not say "security-reviewed" or "penetration-tested."
5. **Do not claim the AI boundary will stay fixed as models improve.** The correct framing is that improved models do not automatically expand the AI's authority -- that requires a deliberate product decision. Do not promise or suggest autonomous AI actions in future.
6. **Do not overstate demo apps as implemented.** Event-Driven Reassessment, Rapid Assessment, Challenge Workshop Assistant, and TPRM demo apps are demonstration only. Do not describe them as ready for pilot deployment.
7. **Do not promise specific pilot outcomes.** Cycle time improvement, evidence quality improvement, and user adoption targets are design-level outcomes. Do not guarantee specific percentages without baseline data from the client's own environment.
8. **Do not commit to a specific expansion timeline without scoping.** Steps two and three of the rollout are directional. Timelines require scoping per client. Do not quote "12 months to full programme" as a fixed timeline.
9. **Do not use live client data in a demo without a signed data agreement.** The pilot uses demonstration connectors with synthetic or anonymised data. Live client data requires a formal data handling agreement before it is used in the platform.

---

## 7. Download checks

### File existence
- [ ] `public/downloads/NFROS_Risk_Audience_Core_and_Appendix.pdf` exists
- [ ] `public/downloads/NFROS_Risk_Audience_Core.pdf` exists
- [ ] Both files open correctly in a PDF viewer
- [ ] File sizes are non-trivially small (a 2 KB file is likely corrupt or placeholder)

### Content type
- [ ] Both PDF links in the download menu use the `download` attribute
- [ ] The `href` paths start with `/downloads/` (relative to the Next.js `public/` directory)
- [ ] Navigating directly to the PDF URL in the browser does not produce a 404 or a Next.js error page

### Freshness
- [ ] PDF file dates are within 30 days of the current date (stale exports should be flagged)
- [ ] Core-only PDF contains exactly 13 slides
- [ ] Full PDF contains exactly 36 slides (13 core + 23 appendix)
- [ ] Speaker notes are present in the PDF if the export pipeline includes them

### Stale export protection
If a PDF was generated from an earlier version of the slide data, the filename alone does not indicate staleness. Before a client session, open the PDF and verify that slide titles match the current `CORE_SLIDES` array in `src/presentation-v2-1/data/core-story.ts`. If they do not match, regenerate the export.

To regenerate: run `npm run export:deck` with the appropriate parameters (see `scripts/export-deck.ts` for the command interface) or generate the PDFs manually from a browser print-to-PDF of the `/story?deck=v2.1&export=1` route at 1920x1080 resolution.

---
