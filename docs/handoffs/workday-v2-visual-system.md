# Workday V2 Visual System Handoff

Agent B: Loading and Progressive Population Layer.
This document covers the full visual system so other workstreams can compose against it without reading the token files directly.

---

## Typography Scale

All values are from `src/styles/workday-v2-tokens.css`. The ceiling is 24px. No working screen heading exceeds 20px.

| Token | Value | Used for |
|---|---|---|
| `--app-text-2xs` | 11px | Counts inside chips only |
| `--app-text-xs` | 12px | Metadata, secondary detail, activity timestamps |
| `--app-text-sm` | 13px | Dense rows, compact controls, rail labels |
| `--app-text-base` | 14px | Default interface text, button labels |
| `--app-text-md` | 15px | Primary row text, partner response text |
| `--app-text-lg` | 16px | Section heading (.app-section-title) |
| `--app-text-xl` | 18px | Work object title (.app-object-title) |
| `--app-text-2xl` | 20px | Primary focus title, workspace heading (.app-title) |
| `--app-text-3xl` | 24px | Rare: empty state and hero only (.app-hero-title) |

Leading values:
- `--app-leading-tight`: 1.2 (headings)
- `--app-leading-snug`: 1.35 (dense text blocks)
- `--app-leading-normal`: 1.5 (body copy)

Tracking values:
- `--app-tracking-tight`: -0.011em (headings above 16px)
- `--app-tracking-normal`: 0 (body)
- `--app-tracking-label`: 0.01em (rail section labels)

Font families:
- `--font-ui`: Geist Sans, Segoe UI, system-ui, sans-serif
- `--font-data`: Geist Mono, Cascadia Mono, ui-monospace, monospace

Data text (monospaced) is reserved for: time, identifiers, indicator values, percentages, counts, timestamps and audit references. Explanatory prose is never monospaced.

---

## Graphite Palette

The ground is graphite neutral. Colour is reserved for meaning, not decoration.

### Surfaces

| Token | Value | Role |
|---|---|---|
| `--app-bg` | `#0b0d10` | Page background |
| `--app-shell` | `#0f1216` | Top bar, rail, partner pane |
| `--app-surface` | `#14181e` | Cards, notices, source chips |
| `--app-surface-raised` | `#1a1f27` | Raised cards, menus, buttons |
| `--app-surface-hover` | `#202630` | Hover state for interactive rows |
| `--app-surface-active` | `#262d39` | Active/selected state |

### Borders

| Token | Value |
|---|---|
| `--app-border` | `rgb(255 255 255 / 7%)` |
| `--app-border-strong` | `rgb(255 255 255 / 12%)` |
| `--app-border-loud` | `rgb(255 255 255 / 20%)` |

### Text Hierarchy

| Token | Value | Role |
|---|---|---|
| `--app-text` | `#f4f6f8` | Primary text |
| `--app-text-secondary` | `#b7bec9` | Supporting text |
| `--app-text-muted` | `#7f8998` | Labels, rail items, muted metadata |
| `--app-text-faint` | `#5f6875` | Timestamps, dividers, disabled |

### Semantic Colours

These are for borders, dots, bars and icon strokes. Use the text variants for any text to meet WCAG AA (4.5:1 on tint backgrounds).

| State | Base | Text Variant | Tint | Edge |
|---|---|---|---|---|
| AI / purple | `#8b82ff` | `#afa8ff` | `rgb(139 130 255 / 10%)` | `rgb(139 130 255 / 34%)` |
| Info / blue | `#56b7db` | `#8ed3ee` | `rgb(86 183 219 / 10%)` | `rgb(86 183 219 / 34%)` |
| Success / green | `#4fc28b` | `#80d9ae` | `rgb(79 194 139 / 10%)` | `rgb(79 194 139 / 34%)` |
| Warning / amber | `#e8b65c` | `#f3cd8a` | `rgb(232 182 92 / 10%)` | `rgb(232 182 92 / 34%)` |
| Danger / red | `#ec6b78` | `#f59aa3` | `rgb(236 107 120 / 10%)` | `rgb(236 107 120 / 34%)` |

Text variant rule: the base hues fail WCAG AA (4.5:1) as small text on their own tint. The `*-text` variants above are the only values permitted for coloured text in the interface. Use base hues only for non-text elements (dots, borders, icon strokes, track fills).

Selection uses neutral tokens, not a colour: `--app-selected-bg` = `--app-surface-active`, `--app-selected-edge` = `--app-border-loud`. Pink is deliberately absent from this scope.

---

## Geometry Tokens

| Token | Value | Used for |
|---|---|---|
| `--app-topbar-h` | 48px | Fixed top bar height |
| `--app-rail-w` | 58px | Collapsed navigation rail |
| `--app-rail-w-expanded` | 208px | Expanded rail |
| `--app-partner-w` | 336px | AI Partner pane (1440px+) |
| `--app-partner-w-collapsed` | 48px | Partner presence rail |
| `--app-liveday-h` | 50px | Live day bar |
| `--app-drawer-w` | 420px | Evidence/detail drawer |
| `--app-row-h` | 36px | Standard list row height |
| `--app-row-h-lg` | 48px | Large list row height |

Spacing uses a 4px base:
`--app-1` = 4px, `--app-2` = 8px, `--app-3` = 12px, `--app-4` = 16px, `--app-5` = 20px, `--app-6` = 24px, `--app-8` = 32px, `--app-10` = 40px, `--app-12` = 48px.

Radii: tighter than the presentation system.
- `--app-radius-sm`: 4px
- `--app-radius`: 6px
- `--app-radius-lg`: 10px
- `--app-radius-pill`: 999px

Elevation (used only where something floats):
- `--app-shadow-1`: 0 1px 2px `rgb(0 0 0 / 40%)`
- `--app-shadow-2`: 0 4px 16px `rgb(0 0 0 / 44%)`
- `--app-shadow-3`: 0 16px 48px `rgb(0 0 0 / 56%)`

Breakpoints:
- At max-width 1439px: partner pane narrows to 300px, drawer to 380px.
- At max-width 1366px: partner collapses to 48px presence rail, drawer to 360px.

---

## Motion Durations

Each token is named for what it explains.

| Token | Value | Explains |
|---|---|---|
| `--app-t-control` | 120ms | Button hover/active transitions |
| `--app-t-hover` | 180ms | Row and rail item hover transitions |
| `--app-t-drawer` | 240ms | Drawer open/close |
| `--app-t-suggestion` | 320ms | Suggestion card and heads-up entry |
| `--app-t-object` | 450ms | Work object population, changed edge |
| `--app-t-propagate` | 700ms | Catch-up attention pulse (fires once) |

Easing:
- `--app-ease`: `cubic-bezier(0.22, 0.85, 0.28, 1)` - standard deceleration
- `--app-ease-spatial`: `cubic-bezier(0.34, 1.06, 0.36, 1)` - slight overshoot for pulse rings

Reduced-motion contract: `@media (prefers-reduced-motion: reduce)` sets all animation-duration to 0.01ms and animation-iteration-count to 1 on all elements inside `.workday-v2`. Transitions are also set to 0.01ms. What is never removed: stage text, loading labels, readiness information and error messages.

---

## Card versus Row Rule

A row (`.app-item`) is the default for everything repeating. A card (`.app-card`) is permitted for exactly four cases:
1. A primary decision awaiting human judgment.
2. A new AI suggestion.
3. An execution receipt.
4. A critical event (severity: critical).

Any fifth use requires a documented reason. The rule exists because the previous layer put everything in a bordered panel, producing visual equality with no hierarchy. Rows separated by hairlines let a card stand out.

Card accent edges (`data-accent` attribute) express semantic state. One 2px left edge rather than a tinted fill.

---

## Chip Rule

Chips (`.app-chip`) are permitted for:
- Status values (open, completed, deferred)
- Source type
- Severity
- Authority class
- Numeric counts (`app-chip-count`)

Chips are not permitted for clause-length text. A chip containing a sentence is a badge pretending to be prose.

Chip height is fixed at 20px. Tone variants use the semantic edge colours at 34% opacity (the `*-edge` tokens).

---

## Button Hierarchy

Four levels, used in descending priority per focus area:

1. `app-btn app-btn-primary` - AI purple fill. One per focus area. Used for the main recommended action.
2. `app-btn app-btn-decide` - Amber tint, amber edge. Amber semantics are preserved but the button is not filled amber, because a filled amber control at every decision point reads as a warning about the interface.
3. `app-btn app-btn-secondary` - Transparent fill, strong border. Secondary actions.
4. `app-btn app-btn-quiet` - No border, muted text. Tertiary actions, disclosures.

Sizes: default 30px, `app-btn-lg` 34px, `app-btn-sm` 26px.

Icon-only buttons use `.app-icon-btn` at 28px square.

---

## Loading and Progressive Population Contract

### Skeleton System

All skeletons use `.app-skeleton` (defined in workday-v2.css), which carries a neutral shimmer via a `::after` pseudo-element. In reduced motion, the shimmer is replaced by a static `rgb(255 255 255 / 3%)` fill.

Skeleton rows use `.app-skeleton-row`. Both are in primitives.tsx as `Skeleton` and `SkeletonRows`.

The `DataSkeleton` component (src/components/loading/DataSkeleton.tsx) provides named variants that reserve the real dimensions of each UI region:

| Variant | Default rows | Row height | Notes |
|---|---|---|---|
| `focus-queue` | 4 | 48px large | Leading indicator, reason, AI status chip |
| `inbox` | 5 | 36px | Narrower trailing (time, not chip) |
| `calendar` | 4 | 52px | Time label on left |
| `work-object` | N/A | Header + grid + body | Reserves 20px title exactly |
| `evidence` | 4 | 36px | 52px wide trailing chip for identifiers |
| `live-events` | 4 | 48px large | Severity, type chip, summary |
| `ai-activity` | 5 | 24px | Three-column grid matching .app-activity-row |
| `decisions` | 2 | Card form | Reserves 30px button row |
| `execution-receipts` | 3 | 36px | 58px trailing chip for status |

All skeleton content is `aria-hidden="true"`. Readiness is communicated through `aria-busy` on the container and a text status elsewhere.

### DataSkeleton Props

```typescript
DataSkeleton({
  variant: SkeletonVariant;
  rows?: number; // override default row count
})
```

### LoadingStageList

`src/components/loading/LoadingStageList.tsx` - client component.

Wraps StageList from primitives with the six data-source stages. Expandable source detail via Disclosure.

```typescript
LoadingStageList({
  activeIndex: number;     // 0-indexed into DATA_SOURCE_STAGE_LABELS, -1 = none active
  sources?: SourceAttribution[];
  language?: Language;
})
```

The six stage labels (in order): "Loading current assessment", "Refreshing control evidence", "Checking process telemetry", "Retrieving open actions", "Reconciling source records", "Preparing the risk view".

### AIGenerationCard

`src/components/loading/AIGenerationCard.tsx` - client component.

```typescript
AIGenerationCard({
  state: AIGenerationState;                   // from contracts
  completedStages: AIGenerationState[];       // from agent.stage.changed events
  recordCount: number;                        // real count, 0 before known
  missingRequiredSources?: string[];          // names of outstanding required sources
  language?: Language;
})
```

Constrained mode activates when `missingRequiredSources.length > 0`. The card names the outstanding source, halts progress and does not imply a recommendation is imminent. The stage list continues to show all stages so the user can see where the work is held.

The card uses `Announcer` from interactive.tsx for polite screen reader announcements. Stage labels change when the state changes; the same label is not re-announced on re-render.

### ProgressiveContent

`src/components/loading/ProgressiveContent.tsx` - server safe.

Enforces the population order: structure, identity, facts, source counts, AI status, AI interpretation, recommendation, actions, evidence detail.

```typescript
ContentStage = {
  id: string;
  skeleton: ReactNode;
  content: ReactNode;
  ready: boolean;
  blocks?: boolean;   // default true: not-ready blocks all later stages
}

ProgressiveContent({
  stages: ContentStage[];
  language?: Language;
  label?: string;     // aria-label for the container
})
```

Pure helper exported for tests:
```typescript
resolveStageVisibility(
  stages: ReadonlyArray<{ ready: boolean; blocks?: boolean }>
): boolean[]
```

Primary-action guarantee: each stage slot reserves space from the first render (skeleton or content). Because all stages render as skeletons at initial paint, button positions are established before any content arrives and do not shift.

### ConnectionState

`src/components/loading/ConnectionState.tsx` - server safe (callback props).

```typescript
ConnectionState({
  sourceSystem: string;
  mandatory: boolean;
  lastUpdated: string | null;
  queuedActionCount?: number;
  onRetry?: () => void;
  language?: Language;
})
```

For mandatory sources: shows constrained-view notice, read-only-fallback notice and stale-data warning. For optional sources: shows a warning-tone notice and retry button.

### StaleDataNotice

`src/components/loading/StaleDataNotice.tsx` - server safe.

```typescript
StaleDataNotice({
  lastUpdated: string | null;
  acknowledged?: boolean;   // true: compact inline indicator shown
  onContinue?: () => void;
  language?: Language;
})
```

When `acknowledged` is false: shows warning notice, timestamp and continue button. When `acknowledged` is true: shows compact stale label matching FRESHNESS_LABELS.stale.

### InlineLoadingRow / InlineLoadingRows

`src/components/loading/InlineLoadingRow.tsx` - server safe.

```typescript
InlineLoadingRow({
  large?: boolean;    // true: 48px height, false: 36px
  language?: Language;
})

InlineLoadingRows({
  count?: number;     // default 2
  large?: boolean;
  language?: Language;
})
```

Both are `aria-hidden`. `InlineLoadingRows` adds a polite status for standalone use.

---

## Hooks

### useProgressiveData

`src/hooks/useProgressiveData.ts` - client only.

```typescript
useProgressiveData(
  subscribe?: SubscribeToLoadEvents
): {
  regions: ProgressiveDataMap;
  dispatchRegion: (action: ProgressiveDataAction) => void;
  resetRegion: (region: string) => void;
  clearAll: () => void;
}

type SubscribeToLoadEvents = (
  handler: (event: { region: string; state: DataLoadState; detail: string }) => void
) => () => void;  // returns unsubscribe

type ProgressiveDataMap = Record<string, { state: DataLoadState; detail: string }>;
```

The subscribe function typically wraps the stream channel's `data.load.changed` events. When undefined, the hook runs with no subscriptions (useful when the caller dispatches directly via `dispatchRegion`).

Minimum-transition rule: if a region goes from loading/connecting to ready/partial in under 300ms, the state update is held for the remainder. This prevents a visual flash when cached data resolves instantly. The rule is bypassed in prefers-reduced-motion mode.

Cancel behaviour: all pending timers are cancelled on unmount. Navigation to a new route without re-triggering subscribe cleans up safely.

Exported pure functions for testing:
- `progressiveDataReducer(state, action)` - pure reducer
- `shouldApplyMinTransition(startMs, resolveMs, reducedMotion, minMs?)` - timing decision
- `MIN_LOADING_MS = 300`

### useAIGenerationState

`src/hooks/useAIGenerationState.ts` - client only.

```typescript
useAIGenerationState(
  subscribe?: SubscribeToStageEvents
): {
  machine: AIGenMachineState;
  isPublishable: boolean;
  retry: () => void;
  supersede: () => void;
}

type SubscribeToStageEvents = (
  handler: (event: { state: AIGenerationState; completedStages: AIGenerationState[] }) => void
) => () => void;

type AIGenMachineState = {
  current: AIGenerationState;
  completedStages: AIGenerationState[];
  error: string | null;
  retryable: boolean;
  superseded: boolean;
}
```

The default subscription listens for `agent.stage.changed` CustomEvents on `window`. Pass a custom subscribe function to route a different event channel (tests use this).

`isPublishable` is always false before the validating stage completes. It becomes false again when the machine is superseded.

Supersede behaviour: after `supersede()` is called, stage changes from slow in-flight requests are ignored. The stuck-running flag cannot remain because the superseded instance no longer accepts state. `retry()` un-supersedes and resets to queued.

Cancel behaviour: the event subscription is removed and the machine is superseded on unmount.

Exported pure functions for testing:
- `aiGenReducer(state, action)` - pure reducer
- `isPublishableFromMachine(machine)` - publishability check
- `initialAIGenState` - the initial machine state

---

## CSS Classes Needed but Not in Stylesheet

No new CSS classes were added to the stylesheet. All components use existing classes from workday-v2.css and layout utilities from workday-v2.css.

Inline styles are used in two places where a class does not precisely fit:

1. `CalendarSkeleton` in DataSkeleton.tsx: calendar slot rows at 52px height with a flex row. No `.app-calendar-slot` class exists. The inline style uses `var(--app-3)` and `var(--app-2)` tokens.

2. `DecisionsSkeleton` in DataSkeleton.tsx: the card-like shell uses inline styles rather than `.app-card` because a skeleton card must not carry the exact same visual treatment as a real card (the real card has a left accent edge from `data-accent`; the skeleton uses `border-left: 2px solid var(--app-border-strong)` as a neutral placeholder).

3. `WorkObjectSkeleton` in DataSkeleton.tsx: the three-column properties grid uses `display: grid` inline because `.app-grid-3` is defined with a `gap: var(--app-3)` that works for content but the skeleton needs the same. This is fine to use `.app-grid-3` directly; using the inline style instead avoids importing a className from CSS that may not be available in all rendering contexts.

If any of these inline styles need to become classes, the fold-in is:
- `.app-calendar-slot`: flex row, gap var(--app-3), min-height 52px, padding var(--app-2) var(--app-3)
- `.app-skeleton-card`: card skeleton shell with neutral border-left

---

## Forbidden Patterns (from the brief)

Do not build any of these in the loading layer:
- A large circular spinner in the middle of the screen
- Fake terminal output or random code characters
- A pulsing AI orb
- Constant glow effects
- A typewriter effect on every label
- Long artificial delays (the 300ms minimum is the only deliberate delay and it only fires on cache hits)

The one permitted moving indicator is the `.app-sheen` shimmer on skeleton blocks and the `.app-dot[data-live="true"]` pulse on connecting source rows. Both are disabled in reduced-motion mode.
