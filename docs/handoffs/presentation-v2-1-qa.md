# Presentation V2.1 -- Comprehensive QA Checklist

This is the reference checklist. The standalone QA guide at `docs/PRESENTATION_V2_1_QA_GUIDE.md` contains the same material with additional context. Use this file for rapid reference during prep.

---

## Route and routing

- [ ] `/story?deck=v2.1` loads slide 1 of the V2.1 deck
- [ ] `/story?deck=v2.1&slide=5` loads slide 5
- [ ] `/story?deck=v2.1&export=1` loads in export mode (no download button)
- [ ] `/story` loads the original v1 deck (unchanged default)
- [ ] `/story?deck=current` loads the original v1 deck (explicit alias)
- [ ] `/story?deck=v1` loads the original v1 deck
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] ESLint passes on the story page: `npm run lint`

---

## Navigation keys (verify all 12)

- [ ] ArrowRight -- advance
- [ ] ArrowLeft -- back
- [ ] ArrowDown -- advance
- [ ] ArrowUp -- back
- [ ] Space -- advance
- [ ] Home -- first slide
- [ ] End -- last slide
- [ ] A -- agenda overlay
- [ ] C -- return to core slide 1
- [ ] F -- fullscreen toggle
- [ ] P -- speaker notes panel
- [ ] M -- motion pause/resume
- [ ] D -- download menu
- [ ] ? -- help overlay
- [ ] Escape -- close overlay

---

## Slide content (13 core slides)

| Slide | Title check | Layout renders | Speaker notes present |
|-------|------------|---------------|----------------------|
| 1 | NFR work built around people | hero | yes |
| 2 | Five things we will cover | list | yes |
| 3 | NFR work starts fragmented | three-layer | yes |
| 4 | An operating system for NFR work | three-layer | yes |
| 5 | The day begins with what needs you | split | yes |
| 6 | Built around the role | two-column | yes |
| 7 | End-to-end work becomes a Role App | two-column | yes |
| 8 | AI operates work; humans own judgment | two-column | yes |
| 9 | Better prepared risk work | flow | yes |
| 10 | Control is built into the workflow | flow | yes |
| 11 | A service that grows by Role App | three-layer | yes |
| 12 | Start narrow. Prove it. Scale. | flow | yes |
| 13 | Proposed next step | next-step | yes |

---

## Appendix slides (23 slides)

- [ ] After end-of-core prompt, "Open appendix" navigates to A1
- [ ] A1 through A23 all render without layout errors
- [ ] Slide counter shows "A1 / A23" format in appendix
- [ ] C key returns from appendix to core slide 1
- [ ] ArrowRight navigates forward through appendix
- [ ] ArrowLeft navigates backward through appendix

---

## Downloads

- [ ] `public/downloads/NFROS_Risk_Audience_Core.pdf` exists and opens
- [ ] `public/downloads/NFROS_Risk_Audience_Core_and_Appendix.pdf` exists and opens
- [ ] Core PDF has 13 slides
- [ ] Full PDF has 36 slides
- [ ] Download attribute is present on both PDF links in DownloadMenu
- [ ] Download button is hidden in export mode (`?export=1`)
- [ ] Download menu is hidden in export mode

---

## Visual consistency (spot-check 5 slides)

- [ ] IBM Plex Sans renders (not system serif fallback)
- [ ] No dark-background slides in core
- [ ] Section label appears top-left
- [ ] Slide number appears bottom-right
- [ ] Accent colour is consistent

---

## Product truth (no overstatement)

- [ ] OR Partner OS described as "Implemented (running locally)" -- not "production-ready"
- [ ] Control Assurance OS described as "Demonstration only" -- not "Implemented"
- [ ] Live bank connectors described as "Not supported" -- not "available"
- [ ] OIDC/SSO described as "Designed, not implemented" -- not "available"
- [ ] Security/pen test described as "Planned, not executed" -- not "completed"
- [ ] Regulatory alignment phrased as "Illustrative regulatory context, not legal advice"

---

## Commercial guardrails (verbal check)

- [ ] No specific prices quoted
- [ ] No regulatory compliance claimed
- [ ] No production deployment claimed for client environment
- [ ] No security clearance claimed
- [ ] AI authority boundary explicitly described as a product decision, not a model capability

---

## TypeScript

Run before every client-facing session:

```
npm run typecheck
```

Expected: zero errors. If errors appear in `app/story/page.tsx` after the V2.1 integration, check that:
1. `PresentationV21` is exported as a named export from `@/presentation-v2-1/components/PresentationV21`
2. `PresentationV21Props` has `initialSlide?: number` and `exportMode?: boolean`
3. The `deckVersion` branch returns a valid React element (not void)
