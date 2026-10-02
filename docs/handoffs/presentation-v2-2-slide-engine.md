# Presentation V2.2 -- Slide Engine Handoff

## Overview

This document describes the V2.2 presentation engine: how navigation state is
managed, how the URL scheme works, how appendix links connect to core slides,
and which layouts are fully implemented versus basic fallback.

---

## URL scheme

The V2.2 presentation uses a query-parameter URL scheme so every slide state
is bookmarkable and shareable.

| URL | Effect |
|-----|--------|
| `/story` | V2.2 core slide 1 (default deck is current = v2.2) |
| `/story?deck=v2.2` | V2.2 core slide 1 (explicit) |
| `/story?deck=current` | V2.2 core slide 1 (alias) |
| `/story?deck=v2.2&core=5` | V2.2 core slide 5 (1-based) |
| `/story?deck=v2.2&appendix=app-08` | Appendix slide app-08 |
| `/story?deck=v2.2&appendix=app-08&from=slide-05` | Appendix slide app-08, return target = core slide 5 |
| `/story?deck=v2.1` | V2.1 deck (unchanged) |

### Parameter reference

| Param | Format | Example | Notes |
|-------|--------|---------|-------|
| `deck` | string | `v2.2`, `current`, `v2.1` | Selects the deck version |
| `core` | integer, 1-based | `5` | Core slide number |
| `appendix` | `app-NN` | `app-08` | Appendix slide ID |
| `from` | `slide-NN` | `slide-05` | Core slide ID to return to after appendix |

Backward compat: the old `slide=N` param still works as an alias for `core=N` so
existing export scripts do not break.

---

## useSlideNavigation hook

**Location:** `src/presentation-v2-2/hooks/useSlideNavigation.ts`

### Signature

```typescript
useSlideNavigation(
  totalCoreSlides: number,
  appendixIds: string[],       // ordered array of all appendix IDs
  initialCoreSlide?: number,   // 1-based, from server-parsed URL
  initialAppendixId?: string | null,
  initialFrom?: string | null, // "slide-05" format
): Navigation
```

### How it works

1. Initial state is derived from props (which come from server-side URL parsing
   in `app/story/page.tsx` -- no client-side `useSearchParams` needed).
2. State is kept in React `useState`.
3. A `useEffect` watches the URL-relevant state fields (mode, coreIndex,
   appendixId, returnToCore) and calls `router.replace` with the new URL after
   every navigation. The first render is skipped to avoid a redundant replace
   when the URL already matches the initial state.
4. All navigation functions (`goToCore`, `goToAppendix`, `returnToOrigin`,
   `goBack`, `goForward`, `goToFirst`, `goToLast`) update React state only;
   the URL sync happens in the effect.

### Direction tracking

The `direction` field in `SlideState` controls the slide transition animation:
- `+1` = forward (slide enters from the right)
- `-1` = backward (slide enters from the left)

Direction is not reflected in the URL (it is ephemeral).

---

## AppendixRefBar -- wiring to core slides

**Location:** `src/presentation-v2-2/components/AppendixRefBar.tsx`

Each `CoreSlide22` has an `appendixRefs: AppendixReference[]` field. When a
core slide has refs, the `AppendixRefBar` renders a bar of chips at the bottom
of the slide (above the footer, at `bottom: 64px`).

Clicking a chip calls:
```typescript
goToAppendix(ref.appendixId, currentCoreIndex)
```

This sets:
- `state.mode = "appendix"`
- `state.appendixId = ref.appendixId`
- `state.returnToCore = currentCoreIndex` (0-based)

The URL becomes `/story?deck=v2.2&appendix=app-08&from=slide-05`.

---

## C key -- return to origin

The C key has two behaviours depending on the current mode:

| Mode | C key effect |
|------|-------------|
| Core | Toggles the agenda overlay (same register as A key) |
| Appendix | Returns to `state.returnToCore` core slide via `returnToOrigin()` |

`returnToOrigin()` sets:
- `state.mode = "core"`
- `state.coreIndex = returnToCore ?? 0`
- `state.appendixId = null`
- `state.returnToCore = null`
- `state.direction = -1` (animated backward)

If `returnToCore` was not set (appendix opened without a from-slide), the
presenter returns to core slide 1.

---

## Layout rendering status

### CoreSlideV22 (src/presentation-v2-2/components/CoreSlideV22.tsx)

| Layout | Status | Notes |
|--------|--------|-------|
| `hero` | Full | heroLines rendered with MotionPath stagger |
| `list` | Full | agendaItems rendered with RevealSequence |
| `next-step` | Full | nextStepBullets + nextStepOutcome box |
| `split` | Basic fallback | title + subtitle + bullets + emphasis |
| `three-layer` | Basic fallback | title + subtitle + emphasis |
| `two-column` | Basic fallback | title + subtitle |
| `flow` | Basic fallback | title + subtitle + bullets |
| `outcome-grid` | Basic fallback | title + subtitle |
| `service-stack` | Basic fallback | title + subtitle |
| `process-rows` | Basic fallback | title + subtitle |
| `rollout-steps` | Basic fallback | title + subtitle |

The basic fallback renders title, optional subtitle, any bullets, and any
emphasis lines from the slide data. Every slide shows SOMETHING -- no blank
slides. The default case in the switch is intentional (not a TypeScript error);
new layouts added to the union will fall through to the fallback until
specialised.

### AppendixSlideV22 (src/presentation-v2-2/components/AppendixSlideV22.tsx)

All 8 content kinds are fully implemented:

| Kind | Renderer |
|------|---------|
| `status-table` | HTML table with status chips |
| `capability-map` | Grouped item lists with coloured headings |
| `service-stack` | Tier cards with cadence and include lists |
| `text-columns` | Side-by-side column lists |
| `process-flow` | Step cards with name and output |
| `matrix` | HTML table with label column and data columns |
| `three-column` | Three side-by-side column lists |
| `simple-list` | Grouped item lists with optional status chips |

The content switch is exhaustive (TypeScript `never` check on the default case).

---

## Component tree

```
app/story/page.tsx (server)
  -- reads: deck, core, appendix, from params
  -- renders: <PresentationV22 initialCoreSlide={N} initialAppendixId={...} initialFrom={...} />

PresentationV22 (client)
  -- useSlideNavigation hook (state + URL sync)
  -- keyboard event listener
  -- SharedSlideTransition (animated slide container)
    -- CoreSlideV22 (when mode === "core")
      -- HeroContent / ListContent / NextStepContent / BasicFallback
      -- AppendixRefBar (chips for appendixRefs)
    -- AppendixSlideV22 (when mode === "appendix")
      -- renderContent (dispatches on content.kind)
  -- AgendaOverlayV22 (A or C in core mode)
  -- Help overlay (? key)
  -- End-of-core prompt (after slide 13)
  -- DownloadMenuV22 (D key)
```

---

## Files created in this session

| File | Description |
|------|-------------|
| `src/presentation-v2-2/hooks/useSlideNavigation.ts` | URL-synced navigation hook |
| `src/presentation-v2-2/styles/presentation-v2-2.css` | Full V2.2 stylesheet (--pv22-* tokens) |
| `src/presentation-v2-2/components/AppendixRefBar.tsx` | Chip bar for appendix links |
| `src/presentation-v2-2/components/AppendixSlideV22.tsx` | Appendix slide renderer |
| `src/presentation-v2-2/components/CoreSlideV22.tsx` | Core slide dispatcher |
| `src/presentation-v2-2/components/PresentationV22.tsx` | Full engine (replaces stub) |
| `scripts/test-presentation.ts` | Smoke test script |
| `docs/handoffs/presentation-v2-2-slide-engine.md` | This document |

| File | Change |
|------|--------|
| `app/story/page.tsx` | Updated V2.2 branch to read core/appendix/from params |
| `package.json` | Added test:presentation and test:presentation-links scripts |
