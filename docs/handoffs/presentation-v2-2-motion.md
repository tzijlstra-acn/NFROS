# Presentation V2.2 Motion Infrastructure Handoff

## Motion library

Package: `motion` v13.4.6 (the modern successor to framer-motion).
Import path used throughout: `"motion/react"`.
Do NOT use `"framer-motion"`: that package is not installed.

## Files created

All files live under `src/presentation-v2-2/motion/`:

| File | Purpose |
|------|---------|
| `tokens.ts` | Duration, easing, stagger, and offset constants. Single source of truth for all motion values. |
| `variants.ts` | Framer-style `Variants` objects for slides, containers, items, hero lines, data cells, and progress bars. |
| `RevealSequence.tsx` | Container component: wraps N children and staggers their reveal top-to-bottom. |
| `SharedSlideTransition.tsx` | Slide-transition wrapper: animates exit-left / enter-right between slide keys via `AnimatePresence`. |
| `MotionPath.tsx` | Single-element wrapper: applies a named variant (`item`, `hero-line`, `data`, `bar`) to one element. |
| `index.ts` | Barrel export for all of the above. |

## Usage guide

### Slide transitions

Wrap the root of the presentation in `SharedSlideTransition`. Pass the active slide key and direction (+1 forward, -1 backward):

```tsx
import { SharedSlideTransition } from "@/presentation-v2-2/motion";

<SharedSlideTransition slideKey={currentSlide} direction={direction} exportMode={exportMode}>
  <MySlideContent />
</SharedSlideTransition>
```

When the `slideKey` changes, the outgoing slide animates out to the left and the incoming slide enters from the right (or the reverse for backward navigation).

### Sequential element reveals

Use `RevealSequence` inside a slide layout to stagger an array of children:

```tsx
import { RevealSequence } from "@/presentation-v2-2/motion";

<RevealSequence exportMode={exportMode}>
  <BulletRow text="First point" />
  <BulletRow text="Second point" />
  <BulletRow text="Third point" />
</RevealSequence>
```

Each child receives the `itemRevealVariants` (fade + 16 px vertical lift), staggered 80 ms apart.

### Individual elements

Use `MotionPath` for a single element that needs a named motion treatment:

```tsx
import { MotionPath } from "@/presentation-v2-2/motion";

// Hero title line (pass index for per-line stagger delay)
<MotionPath variant="hero-line" index={0} exportMode={exportMode}>
  <h1>The NFR Operating System</h1>
</MotionPath>

// Data cell (fade only, no vertical movement)
<MotionPath variant="data" exportMode={exportMode}>
  <span>94%</span>
</MotionPath>

// Standard list item
<MotionPath variant="item" exportMode={exportMode}>
  <p>Bullet text</p>
</MotionPath>
```

### Direct variants (advanced)

All variants are exported from the barrel for use with `motion.div` directly:

```tsx
import { motion } from "motion/react";
import { barRevealVariants } from "@/presentation-v2-2/motion";

<motion.div variants={barRevealVariants} initial="hidden" animate="visible" />
```

## Reduced motion

Every component calls `useReducedMotion()` from `"motion/react"`. When the OS/browser `prefers-reduced-motion: reduce` media query is active, all animated wrappers render as plain `<div>` elements with no transitions. No opt-in required from the slide author: it is automatic.

`REDUCED_MOTION_VARIANTS` is exported from `tokens.ts` for use in edge cases where you must use `motion.div` directly and need a compliant fallback.

## Export mode

Pass `exportMode={true}` to any motion component to skip all animations. This applies to:
- `SharedSlideTransition`: renders children unwrapped (no `AnimatePresence`)
- `RevealSequence`: renders a plain `<div>` with children
- `MotionPath`: renders a plain `<div>`

The `export:presentation` script sets `exportMode` to ensure static screenshots and PDF exports capture fully-visible content.

## Duration budget

| Transition type | Budget |
|----------------|--------|
| Standard slide transition | 250 ms (x) + 150 ms (opacity) |
| Complex layout | 400 ms max |
| Element stagger per child | 80 ms |
| Hero line stagger | 120 ms |

No spring physics on text blocks or data tables. Easing curves are cubic-bezier only.

## V2.2 wiring status

`PresentationV22.tsx` holds `slideKey` and `direction` state and wraps with `SharedSlideTransition`. The inner `PresentationV21` still controls its own slide state; the outer direction/key wiring will be connected when the full V2.2 slide engine replaces the V2.1 proxy.
