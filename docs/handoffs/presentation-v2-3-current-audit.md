# Presentation V2.3 -- Current State Audit

## Branch and commit at start of V2.3 work

Branch: `main`
Commit: `fb0f866cfe6772357fb30dc885a828419f8eb3f8`

## V2.2 defects confirmed (pre-audit D1-D7)

From `docs/handoffs/presentation-v2-2-current-audit.md`:

| # | Location | Defect |
|---|----------|--------|
| D1 | `app/story/page.tsx:73` | Default deck was `"v1"` (old 16-scene StoryDeck). |
| D2 | `app/story/page.tsx:42-46` | Metadata description referenced V1 era content. |
| D3 | `package.json:33` | `export:presentation` ran the V2.1 export script; no `export:presentation-v2-1` alias existed. |
| D4 | `src/presentation-v2-1/components/PresentationV21.tsx` | Did not emit a `data-presentation-slides` DOM attribute. |
| D5 | `src/presentation-v2-2/` | Directory did not exist (now resolved in V2.2). |
| D6 | `scripts/export-presentation-v2-2.ts` | Did not exist (now resolved in V2.2). |
| D7 | `tests/e2e/presentation-routes.spec.ts` | Route matrix untested. |

Additional V2.2 defect found during V2.3 audit:

| # | Location | Defect |
|---|----------|--------|
| D8 | `src/presentation-v2-2/components/PresentationV22.tsx` | Did not emit `data-presentation-slides` DOM attribute, making the V2.2 export script non-functional. The script required the attribute but the component never rendered it. |

## V2.3 fixes in this PR

### Route updated (v2.3 is new default)

`app/story/page.tsx` updated:
- `/story`, `?deck=current`, `?deck=v2.3` all route to `PresentationV23`
- `?deck=v2.2` still accessible for comparison
- `?deck=v2.1` still accessible
- Metadata description updated to reference V2.3

### PresentationV23 shell created

`src/presentation-v2-3/components/PresentationV23.tsx` created.
Proxies to `PresentationV22` for slide content while V2.3-specific renderers
are built in parallel by Wave 2 agents. Accepts the same props interface as
`PresentationV22Props` (`initialCoreSlide`, `initialAppendixId`, `initialFrom`,
`exportMode`).

### data-presentation-slides hotfix applied to PresentationV22 (fixes D8)

`src/presentation-v2-2/components/PresentationV22.tsx` updated:
- `slideManifest` computed from `CORE_SLIDES_V22` and `APPENDIX_SLIDES`
- `data-presentation-slides={JSON.stringify(slideManifest)}` added to the
  outermost container div
- `pv22-presentation-shell` added to the outermost container class list
- This unblocks both the V2.2 and V2.3 export scripts immediately

### V2.3 export script with URL API

`scripts/export-presentation-v2-3.ts` created:
- Uses `buildUrl(base, params)` via the URL API throughout (no string concatenation)
- Pre-flight asset check: verifies four required V2.3 assets exist in
  `public/presentation-assets/v2.3/` before starting Playwright
- Outputs to `exports/` and `public/downloads/` with V23 version labels
- `package.json` `export:presentation` now points to this script
- `export:presentation-v2-2` alias added for the previous script

### TypeScript status

`npx tsc --noEmit` exits 0 after:
- Fixing `keyof JSX.IntrinsicElements` to `keyof React.JSX.IntrinsicElements`
  in `src/presentation-v2-3/typography/index.tsx` (pre-existing file, JSX
  global namespace not available in react-jsx transform mode)
- Casting `Tag` as `string` for `React.createElement` compatibility

## Pending (Wave 2 agents)

- Core slide renderers: 13 dedicated V2.3 visual renderers (no generic fallback)
- Typography: semantic type components are defined; wire-up to slide renderers pending (Wave 1 Agent B)
- Assets: V2.3 asset registry and placeholder assets pending (Wave 1 Agent A)
- `public/presentation-assets/v2.3/` does not exist yet; export script will
  block until assets are committed
