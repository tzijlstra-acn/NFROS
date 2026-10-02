# V2.3 Typography Handoff

Canonical type scale for the NFROS presentation V2.3 deck.
All sizes target a 1920x1080 internal canvas; viewport scale factors apply at delivery.

---

## Scale Table

| Token | CSS variable | Size | Line height | @1920x1080 | @1440x900 (75%) | @1366x768 (71%) | Min required | Status |
|---|---|---|---|---|---|---|---|---|
| display | `--pv23-t-display` | 88px | 0.98 | 88px | 66px | 62px | 48px | PASS |
| core-title | `--pv23-t-core-title` | 64px | 1.04 | 64px | 48px | 45px | 32px | PASS |
| core-subtitle | `--pv23-t-core-subtitle` | 34px | 1.22 | 34px | 26px | 24px | 18px | PASS |
| statement | `--pv23-t-statement` | 42px | 1.16 | 42px | 32px | 30px | 24px | PASS |
| core-body | `--pv23-t-core-body` | 26px | 1.36 | 26px | 20px | 18px | 15px | PASS |
| core-label | `--pv23-t-core-label` | 20px | 1.25 | 20px | 15px | 14px | 13px | PASS |
| core-meta | `--pv23-t-core-meta` | 18px | 1.25 | 18px | 14px | 13px | 12px | PASS |
| appendix-title | `--pv23-t-appendix-title` | 48px | 1.08 | 48px | 36px | 34px | 24px | PASS |
| appendix-sub | `--pv23-t-appendix-sub` | 28px | 1.25 | 28px | 21px | 20px | 16px | PASS |
| appendix-body | `--pv23-t-appendix-body` | 22px | 1.35 | 22px | 17px | 16px | 13px | PASS |
| appendix-table | `--pv23-t-appendix-table` | 18px | 1.30 | 18px | 14px | 13px | 11px | PASS |
| footnote | `--pv23-t-footnote` | 16px | 1.30 | 16px | 12px | 11px | 10px | PASS |
| ref-control | `--pv23-t-ref-control` | 16px | 1.20 | 16px | 12px | 11px | 10px | PASS |

All 13 tokens pass the minimum-readable threshold at 1366x768 (71% scale).

---

## Pass / Fail at 1366x768

| Token | Effective size | Required minimum | Result |
|---|---|---|---|
| core-title | 45px | 32px | PASS |
| core-body | 18px | 15px | PASS |
| core-label | 14px | 13px | PASS |
| appendix-body | 16px | 13px | PASS |
| footnote | 11px | 10px | PASS |

---

## Semantic Components

All 12 semantic components live in `src/presentation-v2-3/typography/index.tsx`.
They consume CSS custom properties; no component contains an inline px font-size.

| Component | Default tag | Token | Font family | Weight | Use in deck |
|---|---|---|---|---|---|
| `PresentationDisplay` | h1 | display | heading | bold | Full-screen hero callout only |
| `PresentationTitle` | h2 | core-title | heading | bold | Slide primary heading |
| `PresentationSubtitle` | h3 | core-subtitle | heading | regular | Slide secondary heading / lead |
| `PresentationStatement` | p | statement | heading | bold | Single-line emphasis statement |
| `PresentationBody` | p | core-body | body | regular | Bullet text, paragraph copy |
| `PresentationLabel` | span | core-label | heading | semibold | Section labels, data labels |
| `PresentationMeta` | span | core-meta | body | regular | Speaker notes, metadata |
| `AppendixTitle` | h2 | appendix-title | heading | bold | Appendix slide heading |
| `AppendixSubtitle` | h3 | appendix-sub | heading | regular | Appendix section heading |
| `AppendixBody` | p | appendix-body | body | regular | Appendix body copy |
| `AppendixTableText` | span | appendix-table | body | regular | Table cells, matrix entries |
| `PresentationFootnote` | small | footnote | body | regular | Footnotes, slide counter, meta chrome |
| `PresentationRefControl` | span | ref-control | body | semibold | Appendix ref chips, nav labels |

Note: `PresentationRefControl` is the 13th exported symbol but uses the same `footnote` px size (16px).
The table above lists all 12 distinct components.

---

## No Inline Font-Size Rule

Every font-size decision in V2.3 must be expressed via a semantic token variable.

Permitted:
```css
font-size: var(--pv23-t-core-body);
```

Not permitted:
```css
font-size: 26px;         /* hardcoded */
font-size: 1.625rem;     /* unitless conversion */
```

TypeScript cannot enforce this rule automatically because CSS-in-JS inline styles
accept arbitrary string values. Enforcement relies on:

1. Code review: any PR touching V2.3 slide renderers must have a reviewer check that
   no `fontSize:` inline style contains a numeric string or `px`/`rem`/`em` literal.
2. The semantic components in `src/presentation-v2-3/typography/index.tsx` are the
   primary rendering path. Using them instead of raw HTML elements is the main guard.
3. A future ESLint rule (`no-restricted-syntax` on `fontSize:` with regex for `/\d+px/`)
   can automate the check; this is not yet configured.

---

## Font Families

| Variable | Value | Used for |
|---|---|---|
| `--pv23-font-heading` | Arial, sans-serif (Graphik override) | Titles, labels, emphasis |
| `--pv23-font-body` | Arial, sans-serif (Graphik override) | Body, meta, footnotes, ref chips |
| `--pv23-font-mono` | IBM Plex Mono, monospace | Section labels, counters, code |

Override both heading and body in a `@font-face` block when Graphik is available.

---

## Related Files

- `src/presentation-v2-3/styles/typography-tokens.css` -- all 13 CSS custom properties
- `src/presentation-v2-3/styles/brand-tokens.css` -- imports typography-tokens; adds colour, spacing, motion
- `src/presentation-v2-3/styles/presentation-v2-3.css` -- layout classes using token vars
- `src/presentation-v2-3/typography/index.tsx` -- 12 semantic React components
