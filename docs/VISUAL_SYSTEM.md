# Visual System

NFR WorkOS, technical documentation for the bank's technology, security and audit functions.

Synthetic institution and data. **Illustrative regulatory context, not legal advice.**

This document records the design tokens with their actual values, the semantic colour contract, the
provenance styling contract, the six hero visualisations and what each encodes, the accessibility
rules that are actually implemented, and what was inherited from the NFR pitch design system versus
what was rebuilt. Section 11 records the limitations.

Primary sources:

| Concern | File |
|---|---|
| Design tokens, both themes | `src/styles/tokens.css`, 208 lines |
| Base, primitives, utilities | `src/styles/globals.css`, 769 lines |
| Presentation deck stylesheet | `src/styles/presentation.css`, 2,845 lines |
| Provenance and evidence primitives | `src/components/evidence/primitives.tsx` |
| Figure basis labels | `src/components/evidence/figures.tsx` |
| Hero visualisations | `src/components/visualisations/*.tsx`, 5,790 lines across six files |
| Application shell | `src/components/shell/*.tsx` |
| Bilingual labels and provenance glyphs | `src/i18n/labels.ts` |
| Font loading | `app/layout.tsx` |
| Inherited system, read only archaeology | `docs/handoffs/source-visual-findings.md`, 716 lines |

---

## 1. Themes

The dark theme is primary and is declared on `:root` (`src/styles/tokens.css:60`) with
`color-scheme: dark`. A light theme exists as an override on `[data-theme="light"]` (`:193`) and is
documented in the file as optional, with the dark theme remaining the presentation default.

This inverts the inherited pitch arrangement, where light was the `:root` default and dark was the
override applied by `:root[data-theme="dark"]`. The shipped default was dark in both cases; the
rebuild made the default the base declaration rather than an override, so a missing attribute yields
the intended theme.

---

## 2. The full token set, with actual values

### 2.1 Surfaces

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#0e0f14` | `#f4f5f8` |
| `--surface-0` | `#13151c` | `#ffffff` |
| `--surface-1` | `#191c25` | `#fbfbfd` |
| `--surface-2` | `#202431` | `#f1f2f6` |
| `--surface-3` | `#2a2e3d` | `#e6e8ee` |
| `--surface-raised` | `#31364a` | `#ffffff` |

Six steps, and the comment at `src/styles/tokens.css:166` states the design consequence: depth comes
from layered surfaces and fine borders, not glow.

### 2.2 Text

| Token | Dark | Light | Use |
|---|---|---|---|
| `--text-1` | `#f7f7fa` | `#14161c` | Headings, emphasised values |
| `--text-2` | `#d4d8e2` | `#33384a` | Body default, set on `body` |
| `--text-3` | `#b3bac8` | `#4e546a` | Secondary prose, `.dim`, `.lede` |
| `--text-4` | `#8d94a5` | `#6b7286` | Mono labels, metadata, `.muted`, `.meta` |
| `--text-disabled` | `#6a7182` | `#9aa0b0` | Disabled control text only |

### 2.3 Borders

| Token | Dark | Light |
|---|---|---|
| `--border-1` | `#343949` | `#d9dce4` |
| `--border-2` | `#4a5064` | `#c2c6d2` |
| `--border-strong` | `#5c6480` | `#a7adbd` |

### 2.4 Accents and semantic hues

| Token | Dark | Light | Meaning |
|---|---|---|---|
| `--accent` | `#b44cff` | `#8a1fd8` | The product, navigation, AI activity |
| `--accent-strong` | `#a100ff` | `#7500c4` | Primary button fill, selection background |
| `--accent-dim` | `#7b2fb5` | `#b06de0` | Recessive accent |
| `--pink` | `#f0758a` | `#c9425c` | Current selection, emphasis, gap |
| `--cyan` | `#55c7e8` | `#1a7f9e` | Data, control context, telemetry |
| `--green` | `#58c994` | `#1f8355` | Evidence, completed action |
| `--amber` | `#f3b34c` | `#9a6c12` | Human judgment required, caution, uncertainty |
| `--red` | `#e2707a` | `#b03a45` | Material risk, breach, blocked action |

### 2.5 The tint, text and border triple

Every state carrying surface in the product is built from three values derived from one hue: a low
alpha fill, the hue at full strength for text, and a mid alpha border. This is the single most
repeated colour recipe, and it is inherited directly from the pitch system.

| Token family | Dark alpha | Light alpha |
|---|---|---|
| `--accent-tint`, `--pink-tint`, `--cyan-tint`, `--green-tint`, `--amber-tint`, `--red-tint` | 12% | 9%, except amber at 11% |
| `--accent-edge`, `--cyan-edge`, `--green-edge`, `--amber-edge`, `--red-edge` | 38% | 34%, except amber at 38% |

Declared as `rgb(R G B / N%)` space separated syntax (`src/styles/tokens.css:93`). Note that
`--pink-edge` does not exist: components needing a pink border use `--pink` at full strength, as
`.chip[data-tone="pink"]` does (`src/styles/globals.css:278`). Amber carries a slightly higher alpha
in the light theme in both families, which compensates for amber's high luminance on a light surface.

### 2.6 Semantic aliases

`src/styles/tokens.css:113`. Six aliases, with the comment that components reference these rather
than raw hues so the meaning of a colour is declared at the point of use.

```
--ai:       var(--accent)
--human:    var(--amber)
--evidence: var(--green)
--risk:     var(--red)
--data:     var(--cyan)
--gap:      var(--pink)
```

### 2.7 Typography

Three font roles, three families, declared as tokens at `src/styles/tokens.css:120`.

| Role | Token | Family | Applied to |
|---|---|---|---|
| Display | `--font-display` | Space Grotesk | `h1` to `h6`, `.display`, `.panel-title` |
| Body | `--font-body` | Inter | `body`, and therefore everything not overridden |
| Mono | `--font-mono` | JetBrains Mono | `.mono`, `.label`, `.meta`, `.chip`, `.provenance`, `.field-label`, table headers, numeric table cells, `code`, `kbd`, `pre` |

**Delivery: self hosted variable fonts, declared with plain `@font-face`.** Three files in
`public/fonts/` (`space-grotesk.woff2` 22 KB, `inter.woff2` 48 KB, `jetbrains-mono.woff2` 31 KB,
102 KB in total) are declared at the top of `src/styles/tokens.css:19` with `font-display: swap` and
a variable weight range per family: Space Grotesk 300 to 700, Inter 100 to 900, JetBrains Mono 100 to
800. One file per family serves every weight the design uses.

The framework's Google Font loader is deliberately **not** used. Two reasons are stated at
`src/styles/tokens.css:6` and repeated in `app/layout.tsx:5`:

1. the application must render with its intended typography in offline mode, which rules out a
   runtime request to a content delivery network
2. the loader resolves fonts at build time, which makes a build depend on network access and on a
   bundler internal that the comment records as having "proved fragile here". A committed woff2 and
   eleven lines of CSS have no such dependency

This makes offline mode genuinely offline for typography as well as for model calls, which is
consistent with the retrieval and demo mode design described in `docs/AI_ARCHITECTURE.md` sections 7
and 10. It also matches the inherited pitch system, which self hosted its fonts for the same reason
and made zero external runtime requests.

The mono role is doing more work than a typical monospace assignment. Every label, every badge, every
object identifier and every numeric column is mono, which is what gives the interface its instrument
register: prose is Inter, and anything that is a reference, a code or a measurement is JetBrains
Mono. `ObjectId` (`src/components/evidence/primitives.tsx:126`) is the component that enforces it for
object references, and its docstring says it is used for every object reference in the interface.

### 2.8 Type scale

`src/styles/tokens.css:125`, declared in rem with the pixel equivalent in a comment. The stated rule:
nothing below 12px is used for content.

| Token | rem | px | Use |
|---|---|---|---|
| `--text-xs` | 0.75 | 12 | Mono labels and metadata only |
| `--text-sm` | 0.8125 | 13 | Dense body, table cells, buttons |
| `--text-base` | 0.9375 | 15 | Body default |
| `--text-md` | 1.0625 | 17 | `h4`, `.lede` |
| `--text-lg` | 1.3125 | 21 | `h3` |
| `--text-xl` | 1.75 | 28 | `h2` |
| `--text-2xl` | 2.25 | 36 | `h1` |
| `--text-3xl` | 3 | 48 | Presentation only |
| `--text-4xl` | 4 | 64 | Presentation only |

Headings map to the scale in `src/styles/globals.css:43`: `h1` 36px, `h2` 28px, `h3` 21px, `h4` 17px,
`h5` 15px, `h6` 13px.

### 2.9 Leading and tracking

| Token | Value | Use |
|---|---|---|
| `--leading-tight` | 1.15 | Headings |
| `--leading-snug` | 1.3 | |
| `--leading-normal` | 1.55 | Body default |
| `--leading-relaxed` | 1.7 | `.lede` |
| `--tracking-tight` | -0.02em | Display type |
| `--tracking-normal` | 0 | |
| `--tracking-wide` | 0.04em | `.meta`, chips, segmented options |
| `--tracking-label` | 0.09em | Uppercase mono labels, table headers |

The tracking convention is the strongest typographic signature carried from the pitch system:
negative tracking on display type, wide positive tracking on uppercase mono labels. The pitch used a
range of -0.02em to -0.03em on display and 0.07em to 0.18em on labels, scaling the label tracking up
as the size went down. The rebuild reduced that to two fixed values, which loses the size dependent
scaling and gains one rule.

### 2.10 Spacing

Four pixel base, `src/styles/tokens.css:146`. Eleven steps, not a continuous scale:

| Token | rem | px |
|---|---|---|
| `--space-1` | 0.25 | 4 |
| `--space-2` | 0.5 | 8 |
| `--space-3` | 0.75 | 12 |
| `--space-4` | 1 | 16 |
| `--space-5` | 1.25 | 20 |
| `--space-6` | 1.5 | 24 |
| `--space-8` | 2 | 32 |
| `--space-10` | 2.5 | 40 |
| `--space-12` | 3 | 48 |
| `--space-16` | 4 | 64 |
| `--space-20` | 5 | 80 |

Consumed through utility classes rather than inline values: `.stack-1` to `.stack-8` for column gaps,
`.row-2` to `.row-6` for row gaps (`src/styles/globals.css:471`).

### 2.11 Radii

`src/styles/tokens.css:159`, with the comment "Restrained: this is an enterprise working
environment."

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 3px | Chips, provenance badges, focus ring, segmented options |
| `--radius-md` | 6px | Buttons, inputs, selects, small panels |
| `--radius-lg` | 10px | Panels, cards, table wrapper |
| `--radius-xl` | 14px | Dialogs only |
| `--radius-pill` | 999px | Confidence track, scrollbar thumb, pills |

The largest square radius in the product is 14px, and it is used on exactly one component.

### 2.12 Elevation

`src/styles/tokens.css:166`. Four steps, pure black at increasing alpha and blur. No coloured
shadows, no glow.

| Token | Dark | Light |
|---|---|---|
| `--shadow-1` | `0 1px 2px rgb(0 0 0 / 30%)` | `0 1px 2px rgb(20 22 28 / 8%)` |
| `--shadow-2` | `0 2px 8px rgb(0 0 0 / 34%)` | `0 2px 8px rgb(20 22 28 / 10%)` |
| `--shadow-3` | `0 8px 28px rgb(0 0 0 / 42%)` | `0 8px 28px rgb(20 22 28 / 12%)` |
| `--shadow-4` | `0 20px 60px rgb(0 0 0 / 52%)` | `0 20px 60px rgb(20 22 28 / 16%)` |

`--shadow-4` is used on the dialog and the drawer. `--shadow-1` to `--shadow-3` are declared and
sparingly used; the ordinary card and panel carry a 1px border and no shadow at all.

### 2.13 Motion

`src/styles/tokens.css:172`, with the comment "Presenter led: purposeful, never decorative."

| Token | Value |
|---|---|
| `--ease-out` | `cubic-bezier(0.22, 0.85, 0.28, 1)` |
| `--ease-in-out` | `cubic-bezier(0.55, 0.06, 0.32, 0.96)` |
| `--ease-spatial` | `cubic-bezier(0.34, 1.12, 0.36, 1)` |
| `--duration-instant` | 90ms |
| `--duration-fast` | 170ms |
| `--duration-base` | 280ms |
| `--duration-slow` | 520ms |
| `--duration-scene` | 900ms |

`--ease-spatial` overshoots slightly (the third control point exceeds 1), so it is the only curve in
the set that is not monotonic. It is reserved for spatial movement.

### 2.14 Layout metrics

`src/styles/tokens.css:182`. The shell geometry is tokenised so a breakpoint changes one value rather
than a rule.

| Token | 1920 and above | 1440 and below | 1366 and below |
|---|---|---|---|
| `--topbar-height` | 56px | 56px | 56px |
| `--timeline-height` | 84px | 84px | 84px |
| `--left-rail-width` | 232px | 208px | 64px |
| `--left-rail-collapsed` | 64px | 64px | 64px |
| `--right-rail-width` | 372px | 336px | 312px |
| `--text-base` | 0.9375rem | 0.9375rem | 0.875rem |

At 1366px the left rail collapses to its icon width and the body size drops to 14px, which is the
projector case. Below 900px the three and four column grids become two columns; below 640px all grids
become one column (`src/styles/globals.css:763`).

`--focus-ring` is `0 0 0 2px var(--bg), 0 0 0 4px var(--accent)`: a two ring box shadow that punches
a background coloured gap before the accent ring, so the ring reads against any surface.

---

## 3. The semantic colour contract

Declared as a contract in the token file header (`src/styles/tokens.css:51`) and applied consistently.
A hue in this product carries meaning; it is never decoration.

| Hue | Alias | Meaning | Where it appears |
|---|---|---|---|
| **Accent, purple** | `--ai` | The product itself, navigation, AI activity | `a` links, `.btn-primary`, `.segmented-option[aria-pressed="true"]`, `.activity-bar` sweep, `.provenance[data-kind="model-inference"]`, `::selection`, the focus ring, the ambient gradient |
| **Pink** | `--gap` | Current selection and emphasis | `.card-interactive[aria-pressed="true"]` and `[data-selected="true"]` border and background, `.chip[data-tone="pink"]`, the no-review-evidence hatch pattern in `PopulationField` |
| **Cyan** | `--data` | Data, control context, telemetry | `.provenance[data-kind="approved-record"]`, `.provenance[data-kind="telemetry"]`, `.confidence-fill` default, resolved contradiction tone, the second ambient gradient stop |
| **Green** | `--evidence` | Evidence and completed action | `.provenance[data-kind="verified-fact"]`, a current `EvidenceChip`, the `measured` figure basis, `.confidence-fill[data-band="high"]` |
| **Amber** | `--human` | Human judgment required, caution, uncertainty | `.btn-decide`, `.provenance[data-kind="stakeholder-statement"]`, stale evidence, the material uncertainty heading, "no source cited", the `client-input` figure basis, `.confidence-fill[data-band="medium"]` |
| **Red** | `--risk` | Material risk, breach, blocked action | `.btn-danger`, `.provenance[data-kind="conflicting-evidence"]`, a requested or missing `EvidenceChip`, unresolved contradiction, `.event-pulse`, `.confidence-fill[data-band="low"]`, `.scene-error-tag` |

Three consequences worth stating, because they are the parts a reviewer would otherwise get wrong:

- **Amber means a person must decide, not "warning".** The decision button is amber
  (`src/styles/globals.css:341`, comment "Human judgment is amber by contract"). So is a stakeholder
  statement, because an unverified assertion is a thing requiring judgment rather than a thing that
  is wrong. Amber is the colour of the product's central claim.
- **Purple means the machine, and it is used for model inference.** A model's own reasoning is
  rendered in the product's own accent, which makes machine authored content visually identifiable as
  such rather than as a lesser kind of fact.
- **Green means established, not "good".** A green evidence chip means the document is current and
  retrievable, not that its contents are favourable.

### 3.1 The tone vocabulary

`Tone` (`src/components/evidence/primitives.tsx:15`) is a closed union of seven values: `accent`,
`cyan`, `green`, `amber`, `red`, `pink`, `neutral`. It is applied through a `data-tone` attribute,
and three families of CSS rule respond to it:

- `.chip[data-tone="..."]` sets the tint, edge and text colour triple
  (`src/styles/globals.css:273`)
- `.card-edge[data-tone="..."]` sets a 3px left border colour, with a `neutral` value of
  `--border-2` (`src/styles/globals.css:246`)
- `Chip` and `EvidenceChip` prefix a glyph per tone

The `card-edge` pattern is the main mechanism by which a list of records carries state: the row's
semantic position is a coloured left edge, which is readable while scanning and does not tint the
content.

---

## 4. The provenance styling contract

This is the visual expression of the product's central honesty claim, and the components carrying it
are deliberately small and reused rather than reimplemented
(`src/components/evidence/primitives.tsx:4`).

| Provenance kind | Colour token | Glyph | English label | German label |
|---|---|---|---|---|
| `verified-fact` | `--green` | `=` | Verified fact | Gesicherte Tatsache |
| `approved-record` | `--cyan` | `*` | Approved record | Genehmigter Eintrag |
| `stakeholder-statement` | `--amber` | `?` | Stakeholder statement | Aussage eines Beteiligten |
| `model-inference` | `--accent` | `~` | Model inference | Modellschlussfolgerung |
| `conflicting-evidence` | `--red` | `!` | Conflicting evidence | Widerspruechlicher Nachweis |
| `telemetry` | `--cyan` | `+` | Telemetry | Telemetrie |

Styling at `src/styles/globals.css:552`, with the comment "Fact, statement and inference never share a
style." Glyphs at `src/i18n/labels.ts:154`, with the comment "Accessibility requires that the fact
versus inference distinction never depends on colour alone." Labels at `src/i18n/labels.ts:141`.

### 4.1 The non colour cues that accompany every colour

Colour is never the sole carrier of meaning anywhere in the product. The inventory:

| Signal | Colour | Non colour cue, and where |
|---|---|---|
| Provenance kind | Six hues | A leading ASCII glyph, plus the full text label, plus a `title` attribute. When `showLabel` is false the label moves into `.sr-only` rather than disappearing (`primitives.tsx:35`) |
| Chip tone | Six hues | `TONE_GLYPHS` (`primitives.tsx:92`): `~` accent, `+` cyan, `=` green, `!` amber, `x` red, `*` pink, `-` neutral |
| Evidence status | Green, amber, red | The literal words `stale`, `requested` or `missing` rendered as text next to the identifier (`primitives.tsx:203`), plus the tone glyph |
| Stale evidence in a list | Amber left edge | A full chip reading "Older than the policy freshness requirement" (`primitives.tsx:293`) |
| Confidence band | Green, amber, red | A numeric `NN / 100` plus the band word in parentheses, plus `role="meter"` with `aria-valuenow` and an `aria-label` naming the band (`primitives.tsx:71`) |
| Contradiction resolution | Cyan resolved, red unresolved | A chip carrying the resolution state as words, the literal string "unresolved" when it is (`primitives.tsx:427`) |
| Material uncertainty | Amber heading | A separate section headed "Material to this decision (N)" against "Noted, not material (N)". The docstring states why: a list that mixes them lets a reader skim past the one that should stop them (`primitives.tsx:318`) |
| Figure basis | Green, cyan, amber | One of three verbatim label strings: "measured in this simulation", "illustrative", "client input required". `basis` and `derivation` are **required props**, so a figure cannot be rendered without stating what kind of number it is (`figures.tsx:6`) |
| Synthetic data | Dashed border | The text "Synthetic institution and data" plus a `&#9633;` glyph, in a dashed bordered chip (`globals.css:524`, `primitives.tsx:140`) |
| Regulatory context | None | A top rule and the text "Illustrative regulatory context, not legal advice." rendered by a component so it cannot be forgotten (`globals.css:539`, `primitives.tsx:155`) |
| Selection | Pink | `aria-pressed="true"` or `data-selected="true"`, which is what the CSS selector keys on, so the accessible state and the visual state cannot diverge (`globals.css:239`) |
| Grounding category | Six hues | Separate arrays rendered as separate sections in a fixed order, each headed by its own labelled provenance badge, with model inference last (`primitives.tsx:506`) |
| Missing citation | Amber | The literal text "no source cited" (`primitives.tsx:555`) |

`GroundingBlock` (`primitives.tsx:521`) orders the sections `verifiedFacts`, `approvedRecords`,
`stakeholderStatements`, `conflictingEvidence`, `modelInference`. The docstring states the reason:
a reader skimming from the top encounters what is established before what is reasoned, which is the
order in which a risk professional wants it.

---

## 5. The six hero visualisations

One per role, assigned by the `heroVisual` and `heroVisualLabel` fields on each role record in
`src/scenario/data/institution.ts`. Each file's header states one or two design decisions and the
reasoning, and each states a rule about what it must not do.

| Role | Component | Label | Lines |
|---|---|---|---|
| `tprm` | `SupplierConstellation` | Supplier and fourth-party exposure constellation | 988 |
| `rcsa` | `RiskControlGraph` | Living process, risk and control graph | 1,265 |
| `control-assurance` | `PopulationField` | Interactive full-population control test field | 915 |
| `incident-resilience` | `ServiceDependencyMap` | Service dependency map with a live event pulse | 848 |
| `regulatory-change` | `ObligationLineage` | Source to obligation to control lineage | 1,057 |
| `nfr-governance` | `PortfolioThread` | One event, six professional lenses, one decision thread | 732 |

### 5.1 `SupplierConstellation`

**Encodes:** one supplier at the centre, the services it delivers on the first ring, declared
subprocessors on the second, fourth parties on the outer ring. Overlaid on the same picture: the
contractual obligation evidence position, single points of failure, and the reach of the 14:05 event.

**The load bearing encoding:** the appendix versus submission discrepancy is **geometry, not a
badge**. A divergent node is drawn as a genuinely split shape, left half for the binding contract
appendix and right half for the supplier's current register, with the absent half rendered as a
dashed hatch rather than a fill. The header states the intent: "A half-missing node reads as wrong
from across a room, which is the reaction the finding deserves, and it stays legible without colour
because the cue is geometry."

**Screenshot survival:** every divergent node carries a leader line to a named callout, so the
finding survives a screenshot with no hover state.

`DeclarationSource` is a closed union of `contract-appendix`, `supplier-submission` and `both`, so
divergence is a data state rather than a rendering decision.

### 5.2 `RiskControlGraph`

**Encodes:** a layered left to right read of the control environment. Processes expose risks,
controls mitigate them, indicators indicate them. `GraphEdgeKind` is a closed union of `exposes`,
`mitigates` and `indicates`, and every edge is labelled by kind, because, as the header says,
"connected is not a relationship".

**The load bearing encoding:** first line and second line disagreement is drawn, not footnoted. A
divergent control is rendered as **two stacked assessment bands inside one node**, each with its own
segmented effectiveness meter and its own named owner, emitting **two `mitigates` edges to the same
risk at different stroke widths**. The width of a `mitigates` edge *is* the claimed reduction, so a
fork of one thick edge and one thin edge into the same risk is the argument, drawn. On the risk card
the two residual positions sit on one appetite scale joined by a bracket.

**The rule:** "Nothing is averaged. Averaging a divergence is how disagreements get resolved by
dilution, and this component exists to make that impossible."

It imports `CONTROL_EFFECTIVENESS_LABELS` from `src/domain/nfr/calculators.ts`, so the effectiveness
band names in the visual are the same constants the calculator uses.

### 5.3 `PopulationField`

**Encodes:** every case in the control test population, not a sample of it. One small cell per case,
grouped so the distribution is readable, every cell clickable down to the individual transaction.

**The load bearing encoding:** the four things a tester needs to see are encoded at **four different
positions on the cell** rather than as four colours:

| Position on the cell | Signal |
|---|---|
| Centre glyph | Outcome: conforming, anomaly or exception |
| Bottom edge bar | Missing secondary review evidence |
| Outer ring | Sample membership |
| Top left corner notch | Fallback route case |

The header states the consequence precisely: a reader can answer "which cases the test did not look
at" and "which cases have no review evidence" independently, in the same glance, **in greyscale**.
Colour repeats each of those signals but never carries one alone.

**A second decision:** the unsampled remainder is drawn at full strength, not dimmed, "because the
thing a test did not look at is a property of the test."

`exceptionClassification` is null until a human classifies the exception, and unclassified cases are
counted as such rather than defaulted.

### 5.4 `ServiceDependencyMap`

**Encodes:** the layered dependency chain behind each important business service, the edges the 14:05
event actually travels along, and impact tolerance consumption per board approved tolerance.
`DependencyKind` is a closed union of `service`, `system`, `supplier`, `subprocessor`.

**Load bearing encoding one:** the pulse is a claim, not decoration. Only nodes and edges carrying
`affectedByEvent` animate, so the animation itself is the propagation path. "If the data says nothing
is affected, nothing moves."

**Load bearing encoding two:** tolerance pressure is a **horizontal bar with an independent threshold
marker, never a radial gauge**, and the track extends past the threshold so a breach visibly
overshoots the marker rather than pinning at a full circle. Where a tolerance has more than one
measure, **every measure gets its own bar and an explicit "no precedence set" annotation sits between
them, because picking one measure would be quietly wrong.** That annotation is the visual form of the
`ITOL-0004-03` defect described in `docs/DACH_CONTEXT.md` section 6.4.

**Jurisdiction discipline in the props:** `entityLabel` is annotated "Entity scope. Never blurred
across jurisdictions", and `frameworkLabel` is annotated "Per-entity framework badge. A Swiss lane
never carries an EU label." Illustrative regulatory context, not legal advice.

### 5.5 `ObligationLineage`

**Encodes:** a left to right flow from a regulatory publication, to the paragraph it comes from, to
the candidate obligation, to the internal policy, process or control that carries it, and finally to
the evidence that proves it.

**Load bearing encoding one:** the terminal state is carried by the **geometry of the flow**, not by a
colour on a node. `LineageTerminalState` is a closed union of `evidenced`, `stale`, `unevidenced`,
`unmapped`, and each has a distinct ending:

- an evidenced obligation's ribbon reaches the evidence marker
- an unevidenced one stops short with a blunt dashed cap, because the flow genuinely stops at the
  control
- an unowned obligation gets **no outbound ribbon at all** and terminates in a visible dead end
  immediately after the obligation node

The header states why: "The dead end is the finding this role exists to produce, so it is drawn as an
ending rather than as an absence." Those are the five `isUnownedGap` rows.

**Load bearing encoding two:** the EU and Swiss lanes are separated by a **hard rule and no ribbon
ever crosses it**. `LineageLane` is `"eu" | "ch"`. Where one internal control serves obligations in
both lanes, the control is drawn **once inside each lane** and badged as shared, with the evidence
requirement stated separately per lane. The header states the reasoning: "Drawing it once in a shared
band would require a flow across the separator, which would blur the two jurisdictions, and that is
the one thing this view must never do."

This is the jurisdiction separation described in `docs/DACH_CONTEXT.md` section 3, expressed as a
drawing constraint. The component holds the mandatory regulatory label as a module constant at
`ObligationLineage.tsx:94` and renders it both in the visible frame and in the screen reader
description.

### 5.6 `PortfolioThread`

**Encodes:** a single matter in the centre with the six NFR functions arranged beside it. Each lens
carries that function's **own professional question** about the same facts, its current position, its
confidence and the decision identifiers it owns.

**The load bearing encoding:** the consolidation argument is drawn **twice, in two registers**,
because it is the argument the role exists to make.

- Above: the six lenses converge on one matter, and **the width of each lead line is the number of
  decisions that function contributes**, so a reader can see who is actually carrying the matter.
- Below: a separate collapse diagram puts today's duplicate reports on the left, funnels them through
  a single bracket, and lands them on one thread of ordered decisions.

The header states why it is drawn rather than asserted: "Six documents becoming one line is a claim
about work removed, and it is made geometrically rather than asserted in a sentence."

**The rule:** "Nothing about the lenses is averaged. Six positions stay six positions." The
`producesSeparateReportToday` and `reportNameToday` props exist so the duplicate reporting claim names
the actual reports rather than counting abstractly.

### 5.7 What the six have in common

Every one of them:

- is a client component rendering hand built SVG. No charting library is used; `d3` is a dependency
  and the visualisations compute their own layouts
- imports `Chip` and `ObjectId` from `src/components/evidence/primitives.tsx`, so identifiers and
  state badges are the same components used everywhere else
- references CSS custom properties for every colour, so both themes work without a per component
  palette
- carries a closed TypeScript union for each categorical dimension rather than a string
- refuses to average, dilute or resolve a disagreement. Five of the six headers say so explicitly

---

## 6. Accessibility rules actually implemented

### 6.1 Focus

`:focus-visible` (`src/styles/globals.css:76`) applies `--focus-ring` globally, with the comment
"Visible focus everywhere. Never removed, only restyled." The outline is set to `none` and replaced by
the two ring box shadow, so the ring is visible on every surface. There is no `outline: none` without
a replacement anywhere in the stylesheets.

`PopulationField` draws its own focus and selection rings in SVG, with the comment
"CSS focus styling does not paint here" (`PopulationField.tsx:426`). This is correct: a box shadow
does not render on an SVG child, so the component compensates rather than losing the indicator.

### 6.2 Keyboard

| Pattern | Where | Behaviour |
|---|---|---|
| Skip link | `.skip-link` (`globals.css:119`) | Positioned off screen at `top: -3rem`, moves to `top: var(--space-4)` on focus |
| Roving tabindex with arrow keys | `PopulationField.tsx:241` | `ArrowRight`, `ArrowLeft`, `ArrowDown` (by `perRow`), `ArrowUp`, `Home`, `End`. `preventDefault` on a handled key. `tabIndex` is 0 on the active cell and -1 on the rest (`:407`), so a population of hundreds of cells is one tab stop |
| Enter and Space activation | `PopulationField.tsx:419` | Both keys activate a cell, with `preventDefault` |
| Escape closes a dialog | `controls.tsx:568` | On the backdrop, paired with a click-outside check comparing `target` to `currentTarget` |
| Focusable SVG nodes | All six visualisations | `tabIndex={0}` plus `role="button"` plus a descriptive `aria-label` on each interactive node |
| Tab list | `IntelligenceRail.tsx` | `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, `aria-labelledby`, and `tabIndex` on the panel |
| Segmented controls | `controls.tsx`, `ModeSelector.tsx` | `role="group"`, `role="menu"`, `role="menuitemradio"`, `aria-checked`, `aria-pressed`, `aria-haspopup`, `aria-expanded` |
| Current page | `WorkdayShell.tsx`, `ReportShell.tsx`, `controls.tsx` | `aria-current` |

### 6.3 Reduced motion

Two layers, which is the pattern the source findings prescribe.

**Layer one, CSS.** `@media (prefers-reduced-motion: reduce)` (`globals.css:134`) collapses
`animation-duration` and `transition-duration` to 0.001ms, forces
`animation-iteration-count: 1` and sets `scroll-behavior: auto`, on every element and both
pseudo elements.

**Layer two, an in product override.** `[data-motion="paused"]` (`globals.css:145`) sets
`animation-play-state: paused` and collapses transitions, so a presenter can stop motion without
changing an operating system setting.

**In the presentation deck**, `presentation.css:2726` onwards adds a third trigger and a JavaScript
half. `[data-safe="true"]` collapses every duration and delay to 1ms so the final state paints on the
first frame, "which is what the PDF and PowerPoint export depends on". The file header states the
pairing: "CSS collapses transition and animation durations; JS jumps the reveal step counter to its
final value. Both fire for `prefers-reduced-motion`, for `[data-motion="paused"]`, and for presenter
safe mode (`?safe=1`) and export mode (`?export=1`)."

The one looping element in the deck, `.story-breath`, is suppressed entirely in safe mode with the
stated reason that "a breathing element photographs at an arbitrary opacity, which is not
deterministic."

**In the visualisations**, two of the six carry their own `prefers-reduced-motion` block:
`ServiceDependencyMap.tsx:215` replaces the pulse with a static scaled emphasis at 0.9 opacity and
the marching dash with a static dash array; `SupplierConstellation.tsx` does the equivalent for its
ping. The other four have no animation at all, so the global rule is sufficient for them.

### 6.4 Chart text alternatives

Every one of the six visualisations provides both:

1. **A summary label on the drawing.** `role="img"` plus a computed `aria-label` on the root `<svg>`.
2. **A full structured description.** A `.sr-only` block containing headed lists that describe the
   content in text. `RiskControlGraph.tsx:757` renders "Graph content, described" with `<h5>`
   subheadings for Processes, Risks and Controls and a list item per node naming the code, the label
   and the relationship counts. `PopulationField.tsx:744` renders "Population, described" with the
   case totals by outcome. `ObligationLineage.tsx:891` renders "Lineage, described", including the
   mandatory regulatory label, iterated per lane so the EU and Swiss separation is present in the text
   alternative too.

`.sr-only` (`globals.css:107`) uses the `clip-path: inset(50%)` technique with a 1px box and negative
margin, which keeps the content in the accessibility tree and out of the visual layout.

### 6.5 Semantic state on the element, not only in the paint

The CSS selectors key on the accessible attribute rather than on a presentational class:

```css
.card-interactive[aria-pressed="true"],
.card-interactive[data-selected="true"] { border-color: var(--pink); ... }

.segmented-option[aria-pressed="true"],
.segmented-option[aria-selected="true"] { background: var(--accent-tint); ... }
```

A selected element cannot look selected without being announced as selected, because the same
attribute drives both.

### 6.6 Meters

`ConfidenceMeter` (`primitives.tsx:50`) uses `role="meter"` with `aria-valuenow`, `aria-valuemin`,
`aria-valuemax` and an `aria-label` reading `"<label>: NN out of 100, <band>"`. A null confidence
renders the words "not applicable" rather than an empty or zero bar. The value is clamped to `[0, 1]`
before rendering. `ServiceDependencyMap.tsx:794` uses the same `role="meter"` pattern for tolerance
consumption.

### 6.7 Contrast, measured

Computed from the actual token values against the WCAG 2.x relative luminance formula, dark theme,
tinted backgrounds composited at their declared alpha over `--surface-1`:

| Pair | Ratio | AA normal text, 4.5:1 | AA large text and UI, 3:1 |
|---|---|---|---|
| `--text-1` on `--bg` | 17.90 | pass | pass |
| `--text-2` on `--bg` | 13.42 | pass | pass |
| `--text-3` on `--bg` | 9.82 | pass | pass |
| `--text-4` on `--bg` | 6.30 | pass | pass |
| `--text-4` on `--surface-1` | 5.60 | pass | pass |
| `--text-4` on `--surface-2` | 5.09 | pass | pass |
| `--amber` on `--amber-tint` over `--surface-1` | 7.26 | pass | pass |
| `--cyan` on `--cyan-tint` over `--surface-1` | 6.85 | pass | pass |
| `--green` on `--green-tint` over `--surface-1` | 6.58 | pass | pass |
| `--pink` on `--pink-tint` over `--surface-1` | 5.16 | pass | pass |
| `--red` on `--red-tint` over `--surface-1` | 4.72 | pass | pass |
| white on `--accent-strong`, `.btn-primary` | 5.30 | pass | pass |
| `--accent` on `--bg` | 4.94 | pass | pass |
| **`--accent` on `--accent-tint` over `--surface-1`** | **3.85** | **fail** | pass |
| `--text-disabled` on `--surface-1` | 3.48 | fail | pass |
| `--border-2` on `--surface-1` | 2.13 | not text | fail as a sole boundary |
| `--border-1` on `--surface-1` | 1.48 | not text | fail as a sole boundary |

Four observations:

- **Text contrast is comfortable throughout.** The four text steps clear AA on every surface, and the
  lowest, `--text-4` at 12px, still reaches 5.09:1 on the second surface step.
- **The accent chip fails AA for normal text at 3.85:1.** `.chip[data-tone="accent"]` renders 12px
  mono text, which is normal sized under WCAG, so the accent tint recipe is the one measurable
  accessibility defect in the palette. It clears the 3:1 threshold for user interface components. This
  is recorded in section 11.
- **`--text-disabled` at 3.48:1 is below AA.** Disabled control text is exempt from the WCAG contrast
  requirement, so this is defensible, but it is worth knowing that the disabled state relies on that
  exemption and on the additional `opacity: 0.45` applied by `.btn:disabled`.
- **Borders are intentionally quiet.** `--border-1` at 1.48:1 is a texture, not a boundary indicator.
  Every component that needs to communicate a boundary also changes background or carries a 3px
  coloured edge, so no state is conveyed by a 1px border alone.

### 6.8 Other implemented rules

- `text-wrap: balance` on headings, `text-wrap: pretty` on paragraphs (`globals.css:40`, `:50`)
- `.lede` capped at `68ch`, a readable measure
- `-webkit-text-size-adjust: 100%` on `html`, so a mobile browser does not rescale type
- `.btn` minimum height 34px, `.btn-lg` 44px, `.btn-sm` 28px. The large variant meets the 44px target
  guidance; the default and small variants do not
- `svg { display: block }` globally, which removes the inline baseline gap
- A 14px hard type floor in the presentation deck, enforced structurally by redeclaring `--text-xs` to
  `0.875rem` on `.story-deck` (`presentation.css:74`, comment "14px. The floor. Never reduced at any
  breakpoint"), so every reused utility class picks up the deck scale rather than the product scale
- Scrollbars styled for both the standards (`scrollbar-width`, `scrollbar-color`) and the WebKit
  pseudo element syntax, so the thumb is visible in both engines

---

## 7. The 70/30 ratio: credible enterprise to frontier interaction

The design intent is that most of the surface reads as a credible enterprise working environment
that a bank's risk function would recognise, and a minority of it is frontier interaction that a
bank has not seen before. The brief expresses that as a 70 to 30 split.

**Both figures are illustrative, not measured.** The split is a stated design principle from the
product brief. It is not a token, not a counted quantity, and no automated check enforces it. What
follows is how the code expresses the intent, and the reader should treat the ratio as a direction
rather than as a property of the build.

### 7.1 The credible enterprise 70

Measurable properties of the implementation that put it in enterprise register:

| Property | Evidence |
|---|---|
| Restrained radii | Maximum square radius 14px, used on one component. Cards and panels at 10px, controls at 6px, chips at 3px |
| Depth from layers, not glow | Six surface steps and 1px borders. Shadows are pure black alpha with no colour. `--shadow-4` is used twice, on the dialog and the drawer |
| A conventional dense layout | Fixed shell: 56px top bar, 84px timeline, 232px left rail, 372px right rail. Sticky table headers, mono numeric columns right aligned, `.table` at 13px |
| Sober type | Body 15px, headings topping out at 36px in the product. No clamp based fluid type in `tokens.css` or `globals.css`, so sizes are predictable |
| Short, purposeful motion | Micro interactions at 170ms. Card, button and input transitions animate only `background`, `border-color`, `color` and `transform`, never `all` |
| Very few loops | Four keyframes in `globals.css` and three across the six visualisations. Two of the seven loop |
| A quiet ambient layer | One fixed `z-index: -1` pseudo layer with two radial gradients at **7% and 5% alpha** (`globals.css:609`), commented "Extremely subtle, never a glowing blob" |

### 7.2 The frontier interaction 30

The six hero visualisations, and specifically the encodings a conventional enterprise product would
not attempt:

- a split node shape with a dashed hatch half, so a contractual discrepancy reads as a broken object
- two assessment bands in one node emitting two edges of different stroke width to one risk, so a
  first line and second line disagreement is a visible fork
- four independent signals at four positions on a single small cell, legible in greyscale
- a propagation animation whose extent is exactly the data, so the animation is the claim
- a tolerance bar whose track extends past its threshold marker, with an explicit "no precedence set"
  annotation between two measures
- a flow whose terminal geometry encodes its terminal state, including a drawn dead end for an
  unowned obligation
- lead line widths carrying decision counts, and a second collapse diagram making the same argument
  in a different register

### 7.3 The explicit list of avoided effects

Verified as absent from `src/styles/tokens.css`, `src/styles/globals.css`,
`src/styles/presentation.css` and every component under `src/components/`:

| Effect | Count in the codebase |
|---|---|
| `backdrop-filter`, glassmorphism | 0 |
| `filter: blur(...)` | 0 |
| `drop-shadow(...)` | 0 |
| `text-shadow` | 0 |
| Coloured or neon glow shadows | 0. All four elevation tokens are pure black or near black alpha |
| `cursor: pointer` inside a non interactive visual | 0. Carried forward from the source findings as an explicit ban |
| `!important` on a branded background | 0. The inherited system used it on two gradient classes; the ambient layer here is a plain fixed layer |

Also deliberately not built, each with a stated reason in the code:

- **No radial gauge.** `ServiceDependencyMap` uses a horizontal bar with an independent threshold
  marker, "never a radial gauge", because a full circle hides an overshoot.
- **No radial confidence dial.** `.confidence` is "A bar, not a radial gauge" (`globals.css:571`).
- **No decorative pulse.** `.event-pulse` (`globals.css:723`) is annotated "Used only for the 14:05
  event, never decoratively."
- **No averaging.** Five of the six visualisation headers state that positions are not averaged.
- **No em dash and no en dash.** Enforced by `scripts/check-no-emdash.mjs`, wired into
  `npm run lint`, and stripped at runtime by the output guardrail.
- **No blank on failure.** `presentation.css:2516` implements the inherited chain: `renderError`, then
  `renderStatic`, then a static fallback drawing. "A scene that throws still shows its title, its key
  message, its stage note and a static frame, so the presenter keeps talking and the audience sees a
  composed slide rather than a white box."
- **No scrolling in the deck.** Where content exceeds its stage, the stage scales it down, because
  "a shrunk diagram reads, a scrollbar on a projector does not."

---

## 8. The presentation stylesheet

`src/styles/presentation.css`, 2,845 lines, owns the cinematic deck at `/story`. The header states the
scoping rule: it is presentation only, nothing in it is used by the workday surfaces and nothing in
the workday surfaces is redefined globally.

### 8.1 The four layer scene geometry contract

Carried verbatim in concept from `docs/handoffs/source-visual-findings.md`:

| Layer | Selector | Properties |
|---|---|---|
| 1 | `section.story-scene` | `block-size: 100dvh`, `min-height: 0`, `overflow: clip` |
| 2 | `.story-inner` | Centred measure, no height of its own |
| 3 | `.scene-screen` | `grid-template-rows: auto minmax(0, 1fr) auto` |
| 4 | `.scene-stage` | `height: 100%`, `contain: layout paint size` |

The header explains the mechanism: the middle grid row is `minmax(0, 1fr)` and every level carries
`min-height: 0`, and that pair is what stops an SVG or a long list from pushing a scene taller than
the viewport. The header and footer rows are height capped (`--story-hdr-max: 132px`,
`--story-foot-max: 46px`) so they cannot steal stage space, which the header records as the regression
the source repository logged as a P2 defect and then fixed.

### 8.2 Deck scoped tokens

`.story-deck` (`presentation.css:72`) redeclares the type scale at projection sizes and adds nine deck
specific tokens:

| Token | Value |
|---|---|
| `--story-bar-h` | 46px |
| `--story-foot-h` | 54px |
| `--story-pad-x` | 46px, 36px at 1600px and below |
| `--story-measure` | 1420px, 1320px at 1600px and below |
| `--story-notes-w` | 0px, 400px when `[data-notes="open"]` |
| `--story-hdr-max` | 132px |
| `--story-foot-max` | 46px |
| `--story-reveal` | 420ms |
| `--story-draw` | 720ms |
| `--screen-gap` | `clamp(8px, 1.1vh, 14px)` |

Deck type scale: 14px, 15px, 16px, 18px, 22px, 28px, 38px, 50px. Note that every step is larger than
the product scale, and `--text-xs` moves from 12px to 14px, which is the type floor.

The notes panel opens by widening a grid column rather than overlaying, with the comment
"The notes panel sits beside it, never over the stage."

### 8.3 Reveals are states, not animations

`presentation.css:799`:

> Every reveal is a state, not an animation. The component sets `data-shown="true|false"` from the
> scene's reveal step counter, and CSS transitions between the two states. That makes every scene seek
> safe: any step can be jumped to directly and the result is identical.

Five reveal variants (`.rv`, `.rv-flat`, `.rv-left`, `.rv-travel`, `.rv-draw`) with a per element
`--rv-delay`. The travel distances are small: 10px vertical, 22px horizontal.

This is the property that makes the deck exportable. Because state rather than elapsed time
determines what is painted, a screenshot taken at any moment in safe mode is identical, which is what
the PDF and PowerPoint export depends on.

### 8.4 Responsive at three projected sizes

Explicit rules for 1920x1080 (the reference, no overrides), 1440x900 and 1366x768
(`presentation.css:2581`). The 14px type floor is held at all three; only the display steps shrink,
and `--story-measure` and `--story-pad-x` tighten. Sixteen named scenes each carry their own layout
rules.

### 8.5 Print as a first class path

`presentation.css:2786`, headed "Print. A first class path, not an afterthought." The rules hide the
chapter bar, control bar, progress indicator, click zones and help backdrop; release
`block-size: auto` and `overflow: visible` on the deck and each scene; set `padding: 18pt 24pt` and
`page-break-after: always` with the modern `break-after: page`; release `contain` and
`container-type` on the stage; neutralise the fit transform; and force every reveal to
`opacity: 1`. A scene therefore prints as a composed page rather than as a cropped viewport.

Point sized padding rather than pixels is the correct choice for a print context.

---

## 9. Shell composition

`src/components/shell/`. Five components, 1,723 lines.

| Component | Role |
|---|---|
| `WorkdayShell.tsx` | The working day frame: top bar, timeline, left rail, content, right rail |
| `ReportShell.tsx` | The frame for the accountability surfaces |
| `IntelligenceRail.tsx` | The right rail, seven tabs: Evidence, Why this matters, Uncertainty, Applicable policy, Human approvals, AI activity, Audit trail |
| `controls.tsx` | Autonomy selector, language selector, background work dialog, mode controls |
| `ModeSelector.tsx` | The three demo modes |

The seven rail tabs are the product's accountability surface, and their labels are in
`RAIL_TABS` (`src/i18n/labels.ts:80`) in both languages. Their ordering is a claim: evidence first,
then why it matters, then what is not known, then the governing policy, then who approved what, then
what the machine did, then the full trail.

---

## 10. Inherited versus rebuilt

`docs/handoffs/source-visual-findings.md` is read only archaeology of the NFR pitch repository, a
124 KB single page deck with 84 KB of CSS. Its section 8 lists ten things to carry forward and an
explicit "do not carry" list. What actually happened:

### 10.1 Carried forward, largely unchanged

| Element | Detail |
|---|---|
| The dark palette hues | `#55C7E8` cyan, `#F3B34C` amber, `#58C994` green, `#F0758A` pink and `#A100FF` accent-strong are the same values |
| The semantic alias layer | `--ai`, `--human`, `--evidence`, `--risk`, `--data`, `--gap`. The source findings note this was "the single most reusable idea in the file" and that `tokens.css` had already ported it |
| The tint, text and border triple recipe | Low alpha fill, full strength text, mid alpha border. The source called it "the single most repeated colour recipe in the file" |
| The three font roles | Space Grotesk display, Inter body, JetBrains Mono for every label, tag, counter and badge |
| The letter spacing signature | Negative tracking on display type, wide positive tracking on uppercase mono labels |
| The two layer reduced motion pattern | CSS neutralises durations, JavaScript jumps the timeline to its end state. The source called this "the right pattern" |
| The scene geometry contract | `100dvh` section, `minmax(0, 1fr)` middle row, `min-height: 0` at every level, `contain` on the stage, height capped header and footer. Item 1 on the carry forward list |
| Never blank on failure | `renderError`, then `renderStatic`, then a static fallback drawing. Item 3 |
| The copy linter and em dash gate | `scripts/check-no-emdash.mjs` implements it with additional mojibake, placeholder and unsupported percentage rules |
| One `audit:all` command | `npm run audit:all`, `scripts/audit-all.mjs` |
| The `cursor: pointer` ban in non interactive visuals | Item 9. Zero occurrences |
| Print as a first class stylesheet | Item 10. Implemented as a `@media print` block in `presentation.css` |

### 10.2 Rebuilt or reassigned

| Change | From | To | Why it matters |
|---|---|---|---|
| **Three semantic meanings reassigned** | `--human-ink: var(--green)`; `--risk: #F0758A`, the pink hue; `--control-ink: var(--cyan)` | `--human: var(--amber)`; `--risk: var(--red)` at `#e2707a`; `--gap: var(--pink)` at `#f0758a`; `--data: var(--cyan)` | This is the single most consequential change. The pitch used green for human action; WorkOS uses amber, so green is freed for evidence and amber becomes the colour of required human judgment. The pink hue moved off risk onto selection and gap, and a distinct red was introduced for material risk. The result is a six hue contract where each hue has exactly one meaning, which the pitch's overlapping alias sets did not have |
| Theme default direction | Light on `:root`, dark on `:root[data-theme="dark"]` | Dark on `:root`, light on `[data-theme="light"]` | A missing attribute now yields the intended theme rather than the unintended one |
| Type scale units | `clamp()` in px, for example `.slide-h` at `clamp(28px, 3.8vw, 46px)` | Nine rem tokens with px comments, no fluid type in the product scale | The source findings record an unresolved conflict between the documented scale (42 to 58px titles) and the enforced floor (46px cap), and instruct "Resolve this conflict explicitly in the rebuild rather than inheriting it". The rebuild resolved it by declaring one fixed scale and letting the deck redeclare it |
| Type floor | A pragmatic 8px allowlist for named micro labels, with three logged P2 defects below an 11.5px reference | 12px product floor, 14px deck floor, enforced structurally by redeclaring `--text-xs` on `.story-deck` | The floor is now a token override rather than a lint allowlist |
| Alpha values in the triple | 10% fill, 25 to 30% border | 12% fill, 38% border in dark; 9 to 11% and 34 to 38% in light | Slightly stronger, and declared per theme |
| Easing | Two custom curves in 84 KB, everything else plain `ease` | Three named easing tokens and five duration tokens, referenced by name | Motion is now a token set rather than an ad hoc value per rule |
| Legacy short aliases | `--canvas`, `--s1`, `--s2`, `--tp`, `--ts`, `--tm`, `--brand`, `--brandMid`, `--border` | Not carried | On the explicit do-not-carry list. Zero occurrences |
| Branded gradient screens | `radial-gradient(...) !important` with hard coded hex, plus a text clip gradient | One `.ambient` fixed layer at 5 to 7% alpha, no `!important` | The source instruction was "Carry the gradient idea, not the `!important`" |
| The access gate | `index.html` setting `sessionStorage.pitch_auth = '1'` | Not carried | On the do-not-carry list, described there as "the `sessionStorage` access gate as security" |
| Fonts | Self hosted woff2, per subset files per family (latin, latin-ext, cyrillic-ext, vietnamese), `font-display: swap`, zero external runtime requests | Self hosted woff2, one **variable** file per family covering the whole weight range, plain `@font-face` in `tokens.css`, `font-display: swap`, zero external runtime requests | The principle was carried, the packaging was simplified. Three files and 102 KB replace a per subset set, at the cost of shipping glyph coverage the product does not use. The rebuild first went through `next/font/google` and then moved back, and the code records why: a build should not depend on network access or on a bundler internal |
| Structure | One 124 KB HTML file with external CSS and JS, 25 JS files plus 12 scene modules | A Next.js application with a workday shell, plus a separate deck at `/story` | The deck is now one surface of a product rather than the product |
| Status badges | Four fixed classes: `.status-live`, `.status-team`, `.status-illustrative`, `.status-nda` | A generic `.chip[data-tone]` with seven tones plus a glyph, and a separate `.provenance[data-kind]` with six kinds | The badge system became two typed vocabularies keyed on data attributes instead of four hand written classes |
| Reveals | `IntersectionObserver` at `threshold: 0.12` adding `.visible` then unobserving | `data-shown` driven by a reveal step counter, with CSS transitioning between states | Seek safety. The pitch's reveals fired once on scroll and could not be replayed or jumped to; the rebuild's can, which is what makes the export deterministic |

### 10.3 What is genuinely new

Nothing in the source repository corresponds to:

- the six hero visualisations and their encodings. The source had a knowledge graph view and
  d3-sankey diagrams; the geometric encoding of divergence, terminal state, four-position cells and
  lane separation is new
- the provenance styling contract, the six kind vocabulary and the glyph set
- the figure basis contract with `basis` and `derivation` as required props
- the `RegulatoryNote` and `SyntheticLabel` components as mandatory disclosures
- the bilingual label layer
- the `card-edge` left border state pattern
- the `role="meter"` confidence and tolerance components

---

## 11. Limitations

1. **The accent chip fails WCAG AA for normal text.** `--accent` on `--accent-tint` composited over
   `--surface-1` measures **3.85:1**, against the 4.5:1 requirement for text at 12px.
   `.chip[data-tone="accent"]` and `.segmented-option[aria-pressed="true"]` both render 12px mono text
   in that combination, and the accent tone is used for AI activity, which is a frequently rendered
   state. It clears the 3:1 user interface component threshold, so the boundary is visible, but the
   text inside it is not compliant. This is the one measurable accessibility defect in the palette and
   it is fixable by raising the accent lightness or dropping the tint alpha.

2. **No automated accessibility check runs.** `axe-core` 4.13.0 is a `devDependency` and
   `tests/e2e/` is an empty directory. `npm run test:visual` points at
   `tests/e2e/visual.spec.ts`, which does not exist. Every contrast figure in section 6.7 was computed
   by hand for this document, not by a test, and nothing prevents a future token change from
   regressing it. There is no keyboard traversal test, no screen reader snapshot and no
   `prefers-reduced-motion` assertion. The source findings recommended a six viewport matrix with
   computed style assertions; none of it is implemented.

3. **The 70/30 ratio is not measured.** No token, comment, lint rule or test expresses it. Section 7
   reconstructs the intent from the implementation. A reviewer should treat the split as a design
   direction, not as a property of the build.

4. **Two glyph vocabularies overlap inconsistently.** `PROVENANCE_GLYPHS`
   (`src/i18n/labels.ts:154`) and `TONE_GLYPHS` (`primitives.tsx:92`) assign different meanings to the
   same characters. `!` is `conflicting-evidence` in the provenance set and the `amber` tone in the
   chip set. `*` is `approved-record` in one and the `pink` tone in the other. A reader who learns one
   vocabulary will misread the other. Only `=` (verified fact / green) and `+` (telemetry / cyan) agree
   across both.

5. **`--pink-edge` does not exist.** The five other hues have a matching `-edge` token;
   pink does not, so `.chip[data-tone="pink"]` uses `--pink` at full strength as its border. The result
   is visually heavier than the other tones and breaks the otherwise complete triple.

6. **Button touch targets are below guidance in two of three sizes.** `.btn` is 34px minimum height
   and `.btn-sm` is 28px, against the commonly cited 44px target. Only `.btn-lg` meets it. For a
   desktop enterprise product driven by mouse and keyboard this is defensible; on a touch screen it is
   not.

7. **`--shadow-1`, `--shadow-2` and `--shadow-3` are nearly unused.** Four elevation steps are
   declared and the ordinary card and panel use none of them, relying on surface and border instead.
   `--shadow-4` is used on the dialog and drawer. Three quarters of the elevation scale is dead
   weight.

8. **The `--duration-instant` and `--ease-spatial` tokens are declared and rarely referenced.**
   The declared motion vocabulary is larger than the motion actually used.

9. **The product surfaces have no print stylesheet.** `presentation.css` implements a first class
   print path for the deck; `globals.css` has no `@media print` block at all, so a decision brief, an
   audit trail or an evidence document prints with full chrome, dark backgrounds and fixed rails. The
   source findings listed print as item 10 to carry forward, and it was carried into the deck only.

10. **Light theme contrast is unverified.** Section 6.7 measures the dark theme, which is the
    presentation default. The light theme's fifteen token overrides have not been measured, and amber
    on a light surface is the pairing most likely to be marginal.

11. **Four of the six visualisations have no reduced motion block of their own.** That is correct
    today, because they contain no animation, but it is a property of their current content rather
    than a guarantee. Adding a transition to `ObligationLineage` or `PortfolioThread` would not be
    caught by anything.

12. **Focus management in the dialog is incomplete.** `controls.tsx:568` handles `Escape` and a
    click outside, and the dialog carries `role="dialog"` and `aria-modal`. There is no focus trap, no
    initial focus assignment and no focus restoration to the trigger on close.

13. **`src/components/channels/` and `src/components/meetings/` are empty directories.** The
    presentation layer is implemented: `src/components/presentation/` holds 5,459 lines across ten
    files (`StoryDeck.tsx`, `SceneView.tsx`, `parts.tsx`, `Grid5.tsx`, `hero-adapters.ts` and five
    chapter files) matching the sixteen scenes the stylesheet declares. The channel and meeting
    surfaces that the tool layer and the role player agent presuppose have no components.

14. **The hero visualisation text floor is a reasoned estimate, not an enforced value.**
    `presentation.css:42` states the exception honestly: text inside a reused hero visualisation is
    SVG text in `viewBox` units, so its rendered size depends on how wide the drawing is painted. Hero
    scenes run lean chrome and a hero stage so that at the 1920x1080 reference size the 11 unit labels
    land at or above 14px. Below the reference size the composition scales down proportionally, so the
    floor is not held at 1440x900 or 1366x768. The file says so rather than claiming otherwise, which
    is the right disclosure, but the consequence is that the 14px floor is a reference size guarantee
    and not an absolute one.
