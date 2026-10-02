# Presentation V2.1 -- Visual System

## Token names

All visual properties are defined as CSS custom properties with the `--pv21-` prefix. The token file is `src/styles/presentation-v2-1-tokens.css`. The main stylesheet is `src/styles/presentation-v2-1.css`, which imports the token file.

### Colour tokens

| Token | Role |
|-------|------|
| `--pv21-color-text` | Primary body text |
| `--pv21-color-secondary` | Secondary text, labels, muted headings |
| `--pv21-color-accent` | Accent colour for highlights, callouts, buttons |
| `--pv21-color-border` | Borders, dividers |
| `--pv21-color-surface` | Slide background (light) |
| `--pv21-color-muted-bg` | Muted backgrounds for code, tags |
| `--pv21-color-success` | Status: Implemented |
| `--pv21-color-warning` | Status: Demo / Demonstration only |
| `--pv21-color-danger` | Status: Not supported / critical limitation |

### Typography tokens

| Token | Role |
|-------|------|
| `--pv21-font-sans` | IBM Plex Sans -- all body text and headings |
| `--pv21-font-mono` | IBM Plex Mono -- labels, keyboard shortcuts, code |
| `--pv21-text-xs` | Extra-small text (labels, slide number) |
| `--pv21-text-sm` | Small text (bullet points, notes) |
| `--pv21-text-base` | Base body text |
| `--pv21-text-lg` | Large text (slide body copy) |
| `--pv21-text-xl` | Extra-large (subheadings) |
| `--pv21-text-2xl` | Section headings |
| `--pv21-text-3xl` | Slide titles |
| `--pv21-text-4xl` | Hero titles (slide 1 only) |

### Spacing tokens

| Token | Value (approximate) |
|-------|-------------------|
| `--pv21-space-1` | 4px |
| `--pv21-space-2` | 8px |
| `--pv21-space-3` | 12px |
| `--pv21-space-4` | 16px |
| `--pv21-space-5` | 20px |
| `--pv21-space-6` | 24px |
| `--pv21-space-8` | 32px |
| `--pv21-space-10` | 40px |
| `--pv21-space-12` | 48px |

### Border radius tokens

| Token | Role |
|-------|------|
| `--pv21-radius-sm` | Small elements (tags, kbd) |
| `--pv21-radius-md` | Buttons, cards |
| `--pv21-radius-lg` | Large panels |

## Layout classes

The slide canvas is always `1920 x 1080 px`. The `pv21-slide` class sets these dimensions. The letterbox wrapper scales the canvas to fit the viewport.

### Available slide layouts

Each layout is a value of the `layout` field on a `CoreSlide`. The `SlideRenderer` component selects the appropriate layout class.

| Layout value | Class | Use |
|-------------|-------|-----|
| `hero` | `pv21-layout-hero` | Opening slide; large title, subtitle, emphasis list |
| `split` | `pv21-layout-split` | Two-area layout: left narrative, right visual or list |
| `three-layer` | `pv21-layout-three-layer` | Three stacked content areas; good for architecture slides |
| `two-column` | `pv21-layout-two-column` | Side-by-side columns of equal weight |
| `flow` | `pv21-layout-flow` | Horizontal or vertical flow of numbered steps |
| `list` | `pv21-layout-list` | Single-column bulleted list (agenda slide) |
| `next-step` | `pv21-layout-next-step` | Call-to-action layout with emphasis line and bullets |

## How to add a new slide layout

1. Add the new layout value to the `layout` type union in `src/presentation-v2-1/data/core-story.ts`:
   ```typescript
   layout: "hero" | "split" | "three-layer" | "two-column" | "flow" | "list" | "next-step" | "your-new-layout";
   ```

2. Add a new CSS class in `src/styles/presentation-v2-1.css`:
   ```css
   .pv21-layout-your-new-layout {
     /* 1920x1080 canvas; position content within it */
     display: grid;
     /* ... */
   }
   ```

3. Add a case to the `SlideRenderer` component in `src/presentation-v2-1/components/SlideRenderer.tsx`:
   ```tsx
   case "your-new-layout":
     return <YourNewLayoutComponent slide={slide} />;
   ```

4. Create the layout component in `src/presentation-v2-1/components/` -- name it after the layout.

5. Verify the new layout at both 1280x800 and 1920x1080 viewport sizes.

## Class naming conventions

All classes in the V2.1 deck use the `pv21-` prefix. Do not use unprefixed classes or Tailwind utilities inside the deck components. The reason: the presentation canvas is an isolated 1920x1080 scope; global or utility classes from the application layer will conflict with the letterbox scaling.

| Prefix | Scope |
|--------|-------|
| `pv21-deck` | Root wrapper |
| `pv21-slide` | The 1920x1080 canvas |
| `pv21-layout-*` | Per-layout content area |
| `pv21-section-label` | Top-left section identifier |
| `pv21-slide-number` | Bottom-right counter |
| `pv21-footer` | Footer text line |
| `pv21-notes-panel` | Speaker notes sidebar |
| `pv21-agenda-overlay` | Agenda modal |
| `pv21-help-overlay` | Keyboard help modal |
| `pv21-end-prompt` | End-of-core decision prompt |
| `pv21-download-btn` | Download trigger button |
| `pv21-export-mode` | Applied to root when `exportMode=true` |
| `pv21-motion-paused` | Applied when M key pauses motion |
