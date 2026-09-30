# Source Visual Findings: NFRPitch

Read only archaeology of `C:\Users\thomas.zijlstra\Code Projects Accenture\NFRPitch`.
Nothing in that repository was modified. All values below are quoted from the source files.

Repository shape (not a single file, despite the brief):

| Path | Size | Role |
|---|---|---|
| `pitch.html` | 124,616 bytes, 739 lines | Slide markup only. All CSS and JS are external under `assets/`. |
| `index.html` | 11,137 bytes, 224 lines | Access-code gate. Sets `sessionStorage.pitch_auth = '1'`, then redirects to `pitch.html`. |
| `assets/css/pitch.css` | 83,914 bytes | Theme tokens, base, nav, sections, reveals, every component class. |
| `assets/css/scenes.css` | 11,814 bytes | Scene geometry contract, stage sizing, footer. |
| `assets/css/connectors.css` | 3,737 bytes | SVG connector path styling. |
| `assets/css/knowledge-graph.css` | 2,454 bytes | Graph view styling. |
| `assets/css/print.css` | 2,465 bytes | Warm paper print stylesheet, linked with `media="print"`. |
| `assets/js/` | 25 files plus 12 scene modules | Store, selectors, components, visuals, navigation, edge rail, scene director. |
| `assets/vendor/` | d3, d3-sankey, motion, elkjs, tabler-icons, self-hosted fonts | Zero external runtime requests. |

The build identity is injected inline at `pitch.html:9`:

    window.NFR_BUILD = { release: 'v26', commit: '68f790f', builtAt: '2026-09-23T00:00:00Z' };

Every local asset carries `?v=68f790f`. A layout test enforces that all `?v=` strings in `pitch.html` use one SHA.

---

## 1. Colour tokens

Source: `assets/css/pitch.css` lines 1 to 40. Two themes are declared as a light default plus a dark override on `:root[data-theme="dark"]`. The dark theme is the shipped default (a test asserts `html` has `data-theme=dark`).

### Light theme (`:root`, `:root[data-theme="light"]`)

| Token | Value |
|---|---|
| `--bg` | `#FCFBF9` |
| `--surface-1` | `#FFFFFF` |
| `--surface-2` | `#F5F3F1` |
| `--surface-3` | `#EEEAE7` |
| `--text-1` | `#15181C` |
| `--text-2` | `#4C535A` |
| `--text-3` | `#70777F` |
| `--border-1` | `#E1E4E8` |
| `--border-2` | `#C8CDD2` |
| `--nav-bg` | `rgba(252,251,249,.92)` |
| `--shadow-1` | `0 8px 28px rgba(21,24,28,.08)` |
| `--shadow-2` | `0 2px 8px rgba(21,24,28,.06)` |
| `--accent` | `#A100FF` (Accenture purple) |
| `--accent-strong` | `#7500C0` |
| `--accent-soft` | `rgba(161,0,255,.07)` |
| `--pink` | `#FF50C8` |
| `--cyan` | `#0E7490` |
| `--green` | `#0F8A62` |
| `--amber` | `#B46A00` |
| `--canvas-op` | `.024` |

### Dark theme (`:root[data-theme="dark"]`), the shipped default

| Token | Value |
|---|---|
| `--bg` | `#0E0F14` |
| `--surface-0` | `#13151C` |
| `--surface-1` | `#191C25` |
| `--surface-2` | `#202431` |
| `--surface-3` | `#2A2E3D` |
| `--text-1` | `#F7F7FA` |
| `--text-2` | `#D4D8E2` |
| `--text-3` | `#B3BAC8` |
| `--border-1` | `#343949` |
| `--border-2` | `#4A5064` |
| `--nav-bg` | `rgba(14,15,20,.92)` |
| `--shadow-1` | `0 12px 34px rgba(0,0,0,.32)` |
| `--shadow-2` | `0 2px 8px rgba(0,0,0,.22)` |
| `--accent` | `#B44CFF` |
| `--accent-strong` | `#A100FF` |
| `--accent-soft` | `rgba(180,76,255,.12)` |
| `--pink` | `#F0758A` |
| `--cyan` | `#55C7E8` |
| `--green` | `#58C994` |
| `--amber` | `#F3B34C` |
| `--canvas-op` | `.07` |

Note: the two palettes are not simple inversions. Dark mode lightens the accent to `#B44CFF` and demotes `#A100FF` to `--accent-strong`, and it softens the semantic hues (pink goes from `#FF50C8` to `#F0758A`, green from `#0F8A62` to `#58C994`). That is deliberate: full-saturation brand purple on a near-black background is too aggressive for extended reading.

### Semantic alias layer

The dark theme adds a meaning-carrying alias set that is the single most reusable idea in the file:

    --data: #55C7E8;   --human: #F3B34C;   --evidence: #58C994;
    --risk: #F0758A;   --ai: var(--accent);  --gap: var(--pink);

and a second alias layer present in both themes:

    --ai-ink: var(--accent);       /* AI activity */
    --human-ink: var(--green);     /* human action */
    --control-ink: var(--cyan);    /* control context */
    --accent-ink / --accent-fill
    --page-bg / --surface / --surface-raised
    --text-primary / --text-secondary / --text-muted
    --border-default / --border-strong

Legacy short aliases also exist and should NOT be carried forward: `--canvas`, `--s1`, `--s2`, `--tp`, `--ts`, `--tm`, `--brand`, `--brandMid`, `--border`. They are duplicates kept for backward compatibility with older markup.

### Branded dark screens

Two full-bleed gradient treatments used for cover and closing screens:

    .branded-dark     { background: radial-gradient(130% 140% at 65% -10%, #52088F 0%, #08081A 58%) !important; }
    .branded-dark-alt { background: radial-gradient(130% 140% at 35% 110%, #3D0066 0%, #08081A 55%) !important; }
    .grad             { background: linear-gradient(100deg, #C77BFF 10%, #FF50C8 90%); background-clip: text; color: transparent; }
    .btn-primary      { background: linear-gradient(135deg, #3D0066, #A100FF); box-shadow: 0 8px 32px rgba(161,0,255,.32); }

Note the gradients hard-code hex values and use `!important`. A test bans hard-coded hex in core section inner HTML but these class definitions in CSS are exempt. Carry the gradient idea, not the `!important`.

### Status badge colour system

    .status-live         background rgba(15,138,98,.1)   color var(--green)  border 1px solid rgba(15,138,98,.3)
    .status-team         background var(--accent-soft)   color var(--accent) border 1px solid rgba(161,0,255,.25)
    .status-illustrative background var(--surface-2)     color var(--text-3) border 1px solid var(--border-1)
    .status-nda          background rgba(180,106,0,.08)  color var(--amber)  border 1px solid rgba(180,106,0,.22)

All four are `font-family: 'JetBrains Mono'`, `font-size: 11.5px`, `letter-spacing: .08em`, `padding: 2px 7px`, `border-radius: 4px`, `font-weight: 600`. The tint / text / border triple pattern (10 percent fill, full-strength text, 25 to 30 percent border) is the single most repeated colour recipe in the file and should be the basis of every badge, chip, and state surface in the rebuild.

---

## 2. Typography

Three self-hosted families, no external font requests. Declared in `assets/vendor/fonts/fonts.css` with `font-display: swap` and per-subset woff2 files (latin, latin-ext, cyrillic-ext, vietnamese).

| Role | Family | Applied by |
|---|---|---|
| Display | `'Space Grotesk', sans-serif` | `h1, h2, h3, h4, .sg` |
| Body | `'Inter', system-ui, sans-serif` | `body` |
| Mono | `'JetBrains Mono', monospace` | `.mono` and every label, tag, counter, badge |

Space Grotesk ships weights 400, 600, 700 only. Inter and JetBrains Mono are also subset per script.

`body` sets `-webkit-font-smoothing: antialiased` and `transition: background .3s, color .3s` for theme switching.

### Real size and weight values

| Selector | Size | Weight | Letter spacing | Line height |
|---|---|---|---|---|
| `.hero-h1` | `clamp(48px, 7.5vw, 90px)` | 700 | `-.03em` | 1.0 |
| `.slide-h` | `clamp(28px, 3.8vw, 46px)` | 700 | `-.02em` | 1.1 |
| `.slide-h` at `max-height: 720px` | `clamp(22px, 3vw, 36px)` | | | |
| `.hero-sub` | `19px` | | | 1.65 |
| `.slide-sub` | `17px` (14px under 720px height) | | | 1.6, `max-width: 680px` |
| `.sec-tag` (chapter tag) | `10px` mono | | `.18em`, uppercase | |
| `.chapter-label` | `8px` mono | | `.1em`, uppercase | |
| `.counter` | `11px` mono | | | |
| `.nav-brand` | `13px` Space Grotesk | 600 | | |
| `.nav-ch-btn` | `9px` mono | | `.07em` | |
| `.status-badge` | `11.5px` mono | 600 | `.08em` | |
| `.scene-footer-evidence` | `11px` mono | | `.09em`, uppercase | |
| Dense grid labels (`.ail-col-lbl`) | `8.5px` mono | 700 | `.07em`, uppercase | |
| Dense grid values (`.ail-col-val`) | `10.5px` Inter | | | 1.35 |

The letter-spacing convention is the strongest typographic signature: negative tracking on display type (`-.02em` to `-.03em`), wide positive tracking on uppercase mono labels (`.07em` to `.18em`, scaling up as size goes down).

### Documented typography scale

`assets/css/scenes.css` lines 3 to 11 carries the intended V14 minimums as a comment. This is the design intent, worth honouring:

    Core titles:   42-58px
    Subtitles:     20-26px
    Scene titles:  20-28px
    Scene labels:  14-18px
    Support text:  14px min
    Dense grids:   12px ok for supporting cell text in a labelled table

The shipped CSS does not meet its own stated intent: `.slide-h` tops out at 46px against a stated 42 to 58, and `.slide-sub` is 17px against a stated 20 to 26. `scripts/audit-all.js` enforces a lower, pragmatic floor instead: `.slide-sub` minimum 17px, `.scene-insight` minimum 14px, and 8px for a named allowlist of micro labels (`.arch-rail-label`, `.sgt-gate-lbl`, `.etag`). `V23_BASELINE.md` separately records three P2 defects for text below its 11.5px reference-note floor. Resolve this conflict explicitly in the rebuild rather than inheriting it.

---

## 3. Scene and slide system

### Structure

Every screen is a `<section>` with a fixed data-attribute contract. Real example from `pitch.html:79`:

    <section id="cover" data-slide data-route="core" data-scene="cover-flow"
             data-chapter-id="introduction" data-chapter-title="INTRODUCTION"
             data-nav-title="AI changes how risk work gets done">
      <div class="inner scene-screen">
        <div class="screen-hdr">
          <div class="sec-tag">INTRODUCTION</div>
          <h2 class="slide-h">AI changes risk work.</h2>
          <p class="slide-sub">From signal to judgement to evidence.</p>
        </div>
        <div class="scene-stage" data-size="wide" data-scene-container>
          <svg data-scene-fallback viewBox="0 0 1120 280" preserveAspectRatio="xMidYMid meet" aria-hidden="true"> ... </svg>
        </div>
        <div class="scene-footer">
          <div class="scene-footer-insight">Start with the work. Then choose the technology.</div>
        </div>
      </div>
    </section>

Attribute contract:

| Attribute | Purpose |
|---|---|
| `data-slide` | Marks the element as a navigable screen. The selector `section[data-slide]` is the single source of the slide list. |
| `data-route` | `core` or `reference`. Only `core` screens count toward the counter, the progress bar, and the audit limits. |
| `data-scene` | Scene id, looked up in the scene registry. |
| `data-chapter-id`, `data-chapter-title` | Chapter grouping, drives nav tabs and the chapter label. |
| `data-nav-title` | Label in the agenda drawer and edge rail. |
| `data-density="long"` | Opt out of the 100dvh fixed-height contract: `height: auto`, `overflow: visible`, scroll-snap off. |
| `data-size` on `.scene-stage` | `compact`, `standard`, `wide`, `hero`. Controls the aspect-ratio budget. |
| `data-scene-container` | The mount point the scene factory receives. |
| `data-scene-fallback` | A pre-rendered static SVG revealed if the scene fails. Never blank. |

### The twelve core screens

Chapters come from `assets/data/story-manifest.json` (version 26):

    introduction, why-now, what-ai-is, where-it-applies, how-to-prove, how-to-scale, what-next

| # | Section id | Scene | Chapter | durationMs |
|---|---|---|---|---|
| 00 | `cover` | `cover-flow` | INTRODUCTION | 6500 |
| 01 | `pressure-rising` | `pressure-convergence` | WHY NOW | 7000 |
| 02 | `ai-stack` | `ai-stack-build` | WHAT AI IS | 8000 |
| 03 | `task-route` | `task-route` | WHAT AI IS | 10000 |
| 04 | `regulation-process` | `regulation-process` | WHERE IT APPLIES | 11000 |
| 05 | `transformation-implications` | `transformation-system` | WHERE IT APPLIES | |
| 06 | `work-role-shift` | `work-role-shift` | WHERE IT APPLIES | |
| 07 | `proof-loop` | `proof-loop` | HOW TO PROVE | |
| 08 | `scale-architecture` | `scale-architecture` | HOW TO SCALE | |
| 09 | `unit-economics` | `unit-economics` | HOW TO SCALE | |
| 10 | `dual-engine` | `dual-engine` | HOW TO SCALE | |
| 11 | `next-move` | `next-move` | WHAT NEXT | |

Per-screen manifest fields: `id`, `order`, `chapterId`, `title`, `subtitle`, `closingLine`, `scene`, `durationMs`, `autoplay`, `handoffToken`, and optionally `evidenceLabel`.

`closingLine` is the takeaway rendered in `.scene-footer-insight`. `handoffToken` names the visual object that carries continuity into the next screen (for example `signal-to-decision-line`, `pressure-signal`, `task-route-token`). Both are good ideas worth keeping.

### Navigation

Scrolling is the primary mechanism, not a slide deck engine:

    html { scroll-snap-type: y proximity; scroll-behavior: smooth; }
    section[data-slide] { scroll-snap-align: start; scroll-margin-top: 56px; }
    @media (max-width: 768px), (max-height: 680px) { html { scroll-snap-type: none; } }

Position is derived, not stored: an `IntersectionObserver` at `threshold: 0.5` over `section[data-slide]` fires `updateNav(idx)`. All programmatic movement is `sections[i].scrollIntoView({ behavior: 'smooth' })`.

Keyboard map (`assets/js/navigation.js`, global `keydown`, skipped when the target is `INPUT` or `TEXTAREA`):

| Key | Action |
|---|---|
| Right arrow, Down arrow | Next screen |
| Left arrow, Up arrow | Previous screen |
| `G` | Open the agenda drawer |
| `Escape` | Close agenda and drawer |
| `R` | `SceneDirector.replay()` |
| Space | `SceneDirector.togglePause()`, and swaps the button icon between `ti-player-play` and `ti-player-pause` |
| `P` | Pin the edge rail (handled in `edge-rail.js`) |

Touch: `touchstart` records `clientX`, `touchend` compares; a horizontal delta over 52 pixels advances or retreats. Both listeners are `{ passive: true }`.

### Counter, progress, chapters

`updateNav(idx)` recomputes everything from the DOM on each intersection:

- Counter text is `(coreIdx + 1) + ' / ' + coreTotal`, computed only over `data-route="core"` sections, so reference screens do not inflate the denominator. Reference screens show the literal string `Ref`.
- Progress fill width is `((coreIdx / (coreTotal - 1)) * 100) + '%'`, forced to `100%` on reference screens.
- `#chapterLabel` is set from `sec.dataset.chapterTitle`.
- Chapter tab active state toggles on `data-chid` match.
- The URL hash is updated with `history.replaceState(null, null, '#' + sec.id)`, so it never pollutes browser history.
- The left edge rail is highlighted via `window.edgeRailHighlight(sec.id)`.
- Sections render lazily: a `rendered` Set guards `renderSection(sec)` so each screen builds once.

Progress bar geometry: `position: fixed; top: 56px; height: 3px; background: var(--border-1)` with `.progress-fill { background: var(--accent); transition: width .3s ease; }`.

### Presenter affordances

There is no classic presenter-notes pane. Presenter support is delivered four other ways:

1. Agenda drawer (`G`), built from the DOM chapter map. Three tabs: story (chapter and slide links with active dots plus a `data-method-label` per chapter), questions (eleven labelled quick jumps such as `WHY NOW? Pressure is rising on both sides.` mapped to section ids), and route mode.
2. Left edge rail (`assets/js/edge-rail.js`): opens on a deliberate 140 ms hover dwell, closes after 350 ms, panel width 312 pixels, pinnable with `P` but only at viewports 1536 pixels and wider. It overlays content and never pushes the page.
3. Scene transport: `R` replays, Space pauses and resumes, and there is a visible `#scenePauseBtn`.
4. `closingLine` per screen plus `copyTakeaway()`, which assembles a `NFR AI Executive Conversation: Session Summary` from seven takeaway fields into the clipboard.

Route mode (`executive`, `working`, `technology`) exists as UI but `setupRouteMode()` is a stub with a hard-coded index array and `setRouteMode()` is explicitly commented as visual only. Treat it as an unfinished idea.

### Access gate

`pitch.html:8` runs before anything else:

    if (sessionStorage.getItem('pitch_auth') !== '1') { location.replace('index.html'); }

`index.html` renders an access-code input and sets the flag. This is presentation hygiene, not security. Do not reuse it as an auth model.

---

## 4. Animation and motion

### Scene lifecycle contract

`assets/js/story/scene-director.js` (387 lines) is an IIFE exposing `register`, `enter`, `cancel`, `replay`, `togglePause`, `finish`, `hasScene`, `getState`.

The V26 scene instance contract, from the file header:

    mount (= the factory call itself), play, pause, resume, seek, finish,
    resize, destroy, renderStatic, renderError, getAccessibleSummary

All are optional except `play`, `finish`, and `destroy`. The director calls only what exists. States: `loading`, `ready`, `playing`, `paused`, `complete`, `error`.

Six behaviours in the director are worth carrying forward verbatim in concept:

1. Never blank on failure. On init or play error it calls `renderError`, else `renderStatic`, then reveals the `[data-scene-fallback]` SVG. A `?debug=1` query string adds a visible `scene-error: <id>` label.
2. Font gate. Playback waits on `document.fonts.ready` before the first `requestAnimationFrame`, because SVG scenes measure text width. `V23_BASELINE.md` records the absence of this guard as a P0 defect that this version fixed.
3. Resize handling. A single shared `ResizeObserver` with a 120 ms debounce pauses the scene and calls `instance.resize({ width, height })`. Also recorded as a prior P0 defect.
4. Tab visibility. `visibilitychange` pauses when hidden and resumes when visible, unless the user explicitly paused. No animation burns CPU in a background tab.
5. Accessible summary. `getAccessibleSummary()` output is injected into a `.scene-accessible-summary` div with `aria-live="polite"`.
6. Startup validation. On `DOMContentLoaded` it checks all twelve required scene ids are registered, warns to console, and in development dashes a pink border on the unregistered stage. Plus a direct-hash fallback: if the page loads with `#section-id` and the IntersectionObserver does not fire, it force-enters the scene after 200 ms.

### The timeline primitive

`createTimeline(steps)` where `steps` is `[{ delay: ms, run: fn }]`. Behaviours:

- `play()` resets, records `_startedAt`, and pushes one `setTimeout` per step into a tracked `timers` array.
- `pause()` clears all timers.
- `seek(progress)` where progress is 0 to 1: pauses, then synchronously runs every step whose `delay <= progress * totalDuration`. Total duration is taken as the last step's delay.
- `finish()` resets then runs every step synchronously. This is the reduced-motion and error path.
- `renderStatic(bounds)` and `renderError()` both default to `finish()`.

Known limitation, documented in the code and in `V23_BASELINE.md`: `resume()` just calls `play()` again. There is no per-step checkpointing, so resuming restarts from zero. Fix this in the rebuild.

### Helpers exposed on `window.sceneUtils`

    fadeIn(el, delayMs, durationMs)       // opacity 0, transition 'opacity Nms ease Dms', double rAF, opacity 1
    revealSequence(els, startDelay, stagger, duration)
    svgEl(tag, attrs), svgText(content, x, y, cls)
    animatePath(pathEl, duration, easing)  // strokeDasharray = getTotalLength, animate strokeDashoffset to 0
    createTimeline(steps)

`fadeIn` defaults to 400 ms. `animatePath` defaults to 600 ms. The double `requestAnimationFrame` before flipping the property is the standard trick to guarantee the transition fires.

### CSS motion

Reveal classes, all `.5s ease` except scale:

    .reveal        opacity 0 -> 1, translateY(22px) -> 0,   transition .5s ease
    .reveal-left   translateX(-26px) -> 0,                  transition .5s ease
    .reveal-right  translateX(26px) -> 0,                   transition .5s ease
    .reveal-scale  scale(.94) -> 1,                         transition .45s ease

Triggered by a second `IntersectionObserver` at `threshold: 0.12` which adds `.visible` then unobserves, so reveals fire once and never replay.

Keyframes, the complete set:

    @keyframes bob           { 0%,100% { translateY(0) } 50% { translateY(7px) } }
    @keyframes drawLine      { from { scaleX(0) } to { scaleX(1) } }
    @keyframes flowPulse     { 0%,100% { opacity:.4 } 50% { opacity:.9 } }
    @keyframes blockAssemble { from { opacity:0; scale(.9) } to { opacity:1; scale(1) } }

Applied durations: `.scroll-hint { animation: bob 2.2s ease-in-out infinite }`, `.dp-arr { animation: flowPulse 2.2s ease-in-out infinite }`, `.conv-arrow-col { animation: flowPulse 2s ease-in-out infinite }`.

Easing. Only two custom curves appear in the entire 84 KB stylesheet:

    cubic-bezier(.22, 1, .36, 1)   three uses  (easeOutQuint)
    cubic-bezier(.16, 1, .3, 1)    one use     (easeOutExpo)

Everything else is plain `ease`. Micro-interactions are short and consistent: `.15s` for hover colour and background, `.2s` for border colour, `.3s` for progress width and theme swap, `.35s` for the accordion flex expansion (`.ail-band { transition: flex .35s ease }`), `.6s` for bar fills, `.8s` for background canvas opacity.

### Reduced motion

`assets/css/pitch.css` lines 480 to 486:

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .01ms !important;
        scroll-behavior: auto !important;
      }
      .reveal, .reveal-left, .reveal-right, .reveal-scale { opacity: 1 !important; transform: none !important; }
      #bgCanvas { display: none !important; }
      svg * { transition: none !important; animation: none !important; }
    }

In JS, the director reads `matchMedia('(prefers-reduced-motion: reduce)').matches` into `_reduced`, passes it as the third argument to every scene factory, and subscribes to the `change` event so a mid-session preference change is honoured. A Playwright test asserts that under reduced motion the scene shows its final state with no empty stages.

The two layers together are the right pattern: CSS neutralises transitions, and the JS layer jumps the timeline to its end state rather than showing nothing.

### Motion budget

`scripts/audit-motion.js` enforces a duration ceiling by scanning `delay:` literals in scene code: over 12000 ms fails (hero limit), over 7000 ms warns (standard limit). Manifest `durationMs` values in practice run 6500 to 11000 ms.

---

## 5. Layout conventions

### Spacing and safe frame

Named safe-area tokens from `:root`:

    --nav-h: 58px;  --safe-top: 18px;  --safe-right: 34px;  --safe-bottom: 20px;  --safe-left: 34px;

Note the inconsistency: `--nav-h` is `58px` but `.nav { height: 56px }` and `scroll-margin-top: 56px`. The token is not the source of truth. Fix this in the rebuild by using one value everywhere.

Section padding and responsive steps:

    section[data-slide] { padding: 56px 48px 0; }
    @media (max-height: 820px) { section[data-slide] { padding-top: 68px; } }
    @media (max-height: 720px) { section[data-slide] { padding-top: 62px; } }

The observable spacing scale, in descending frequency of use: 2, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 24, 28, 36, 44, 48, 56 pixels. Gaps cluster at 4 (dense grid cells), 8 to 10 (chips and inline items), 12 to 16 (cards in a column), and 16 to 28 (major blocks). It is not a strict 4-point or 8-point grid: odd values (5, 7) appear in tight nav and chip contexts. The rebuild should regularise this to a documented scale.

### Border radius

Tokens: `--radius: 10px`, `--radiusL: 16px`, identical in both themes.

Observed usage forms a clear size ladder:

| Radius | Applied to |
|---|---|
| `2px` | Progress and bar fills (`.ail-col-bar`, `.ail-ready-bar`) |
| `4px` | Badges, micro chips, checkbox squares, markers |
| `7px` | Nav chapter buttons, matrix cells |
| `8px` | Icon buttons, small cards, foundation strips, panel items |
| `10px` | Default surface radius (`--radius`), bands, cards, decision nodes |
| `11px` | Transformation blocks, capability panels |
| `12px` | Buttons and convergence force cards |
| `16px` | Large emphasis panels (`--radiusL`, `.conv-result`) |
| `50%` | Dots |

### Card and panel pattern

The dominant surface recipe, repeated across dozens of classes:

    background: var(--surface-1);
    border: 1px solid var(--border-1);
    border-radius: 10px to 12px;
    padding: 12px 10px to 16px 18px;
    box-shadow: var(--shadow-2);
    transition: border-color .2s, background .2s;

Hover and active states never change size. They change border colour toward the accent and swap the background to the accent tint:

    .ail-band:hover     { border-color: rgba(161,0,255,.4); outline: none; }
    .ail-band.active    { flex: 2.8; background: var(--accent-soft); border-color: rgba(161,0,255,.4); }
    .trsys-block:hover  { border-color: var(--block-color, var(--accent)); background: rgba(161,0,255,.04); transform: translateY(-2px); }
    .mat-cell.mat-current { background: var(--accent-soft); border-color: rgba(161,0,255,.4); }
    .mat-cell.mat-target  { background: rgba(15,138,98,.08); border-color: rgba(15,138,98,.3); }

Two-pixel lift on hover (`translateY(-2px)`) is the only transform used for interaction feedback. Selection is signalled by tint plus border, never by size.

A useful per-instance colour override pattern: `.trsys-block` reads `var(--block-color, var(--accent))` and `.ail-col` reads `var(--bc, var(--border-1))`. The component sets one inline variable and everything inside it recolours.

### Grid usage

    .inner            { max-width: 1100px; margin: 0 auto; width: 100%; position: relative; z-index: 1; }
    .app-2col-grid    { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                        @media (max-width: 768px) { grid-template-columns: 1fr; }
    .conv-grid        { grid-template-columns: 1fr 120px 1fr; gap: 16px; align-items: center; }
    .ail-landscape-grid { grid-template-columns: repeat(5, 1fr); gap: 10px; flex: 1; }
    .mat-header / .mat-row { grid-template-columns: 200px repeat(5, 1fr); gap: 4px; }

The `1fr <fixed> 1fr` convergence pattern (two inputs, a narrow connector column, one output) and the `<label-width> repeat(n, 1fr)` matrix pattern are both reusable.

### The scene geometry contract

This is the most valuable structural idea in the repository. Four nested layers, each with one job:

| Layer | Contract |
|---|---|
| `section[data-slide]` | `height: 100dvh`, `min-height: 0`, flex column, `padding: 56px 48px 0`, `overflow: clip`, `scroll-snap-align: start` |
| `.inner` | `max-width: 1100px`, centred, no height set |
| `.scene-screen` | `flex: 1`, `display: grid`, `grid-template-rows: auto minmax(0, 1fr) auto`, `gap: var(--screen-gap)`, `padding-block: 14px 16px`, `padding-inline: 24px`, `min-height: 0`, `overflow: hidden`, `contain: layout` |
| `.scene-stage` | `height: 100%`, `width: 100%`, `min-height: 0`, `overflow: clip`, `contain: layout paint size` |

    --screen-gap: clamp(8px, 1.1vh, 14px);
    @media (max-height: 800px) { .scene-screen { --screen-gap: 9px; padding-block: 10px 12px; } .scene-footer { font-size: 14px; } }

The three grid rows are header, stage, footer. `minmax(0, 1fr)` on the middle row plus `min-height: 0` at every level is what stops SVG content from forcing the section taller than the viewport. `contain: layout paint size` on the stage isolates scene rendering.

Stage aspect-ratio budgets, so a scene knows its drawing space without measuring:

    [data-size="compact"]  > .scene-root { width: min(920px, 100%);  aspect-ratio: 16 / 5.2; }
    [data-size="standard"] > .scene-root { width: min(1080px, 100%); aspect-ratio: 16 / 6.5; }
    [data-size="wide"]     > .scene-root { width: min(1180px, 100%); aspect-ratio: 16 / 7.2; }

Header meta row and footer, both height-capped so they cannot steal stage space:

    .screen-hdr-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; min-height: 0; flex-shrink: 0; }
    .scene-footer   { display: flex; align-items: center; gap: 10px; max-height: 48px; overflow: clip; flex-shrink: 0; }

`V23_BASELINE.md` records why the cap exists: three separate footer rows (obligation thread, evidence badge, scene insight) used to stack and steal height on viewports of 800 pixels and below. The fix was to merge them into one capped row. Do not regress this.

### Print

`assets/css/print.css` is a separate `@media print` stylesheet linked with `media="print"`. It switches to warm paper (`#FDFAF7` on `#1A1612`), 10pt, hides all navigation chrome and canvases and buttons, and converts `section[data-slide]` to `display: block` with `page-break-before: always` and `padding: 24pt 36pt`. A print path is a first-class deliverable, not an afterthought.

---

## 6. Quality tooling in `scripts/`

Seven checks plus a master runner, wired into `package.json`.

    "audit:story"   node scripts/audit-story.js
    "audit:icons"   node scripts/audit-icons.js
    "audit:motion"  node scripts/audit-motion.js
    "audit:offline" node scripts/audit-offline.js
    "audit:claims"  python scripts/lint-copy.py
    "audit:all"     node scripts/audit-all.js
    "lint-copy"     python scripts/lint-copy.py
    "check-emdash"  python scripts/check-emdash.py
    "test:layout"   playwright test tests/layout.spec.js
    "serve"         python -m http.server 8080
    "build"         pwsh -File scripts/bump-build.ps1

### `audit-story.js` (4,304 bytes)

Parses `pitch.html` with regex, splits sections into `core` and `reference` by `data-route`, extracts each `h2` and `.slide-sub`, and strips tags and entities before counting words.

Fails (exit 1) on:
- more than 12 core screens
- any core `h2` over 10 words
- any core subtitle over 22 words

Warns on:
- core `h2` at 9 or 10 words (approaching limit)
- core subtitle at 19 to 22 words
- reference subtitle over 22 words
- any core `h2` starting with `the `, `a `, `an `, `this `, `these `, `those ` (flagged as weak framing)

Then prints a table of every core screen with id, h2 word count, sub word count, and pass or fail.

Carry forward: the hard 12-screen ceiling, the 10-word title and 22-word subtitle limits, the weak-framing article check, and the printed table. These are editorial discipline encoded as a build gate, and they are why the pitch reads cleanly. A section title that starts with a definite article is almost always describing content rather than making a claim.

### `audit-icons.js` (3,265 bytes)

Loads `assets/data/icon-manifest.json` (50 or more entries per a layout test, 31 at v16), collects every `ti-*` class from `pitch.html` and from all twelve scene JS files, and fails if any used class is absent from the manifest. Also reports unused manifest entries as P3 warnings.

Carry forward: an explicit icon allowlist. Without it, a typo in an icon name renders an invisible empty box that no visual test catches. `V23_BASELINE.md` records exactly that failure mode as a P2 defect for the icon font. The rebuild uses `@tabler/icons-react`, where a typo is a TypeScript error, so the manifest becomes a curation tool (which icons are sanctioned for which meaning) rather than a correctness check. Keep it for that.

### `audit-motion.js` (3,994 bytes)

Per scene file in `assets/js/story/scenes/`, checks:
- all six lifecycle methods present: `play`, `pause`, `resume`, `reset`, `finish`, `destroy`
- `createTimeline` is used
- `destroy()` clears `container.innerHTML`
- no `cursor:pointer` anywhere, with the reason stated in the code: controls must not look clickable
- untracked `setTimeout` calls, counted as total minus (`_timers.push(setTimeout(` plus `= setTimeout(`). Five or more untracked is P1, fewer is P2. This is a timer-leak check.
- maximum `delay:` literal as a duration proxy: over 12000 ms fails, over 7000 ms warns

Carry forward: the lifecycle completeness check, the timer-tracking requirement, the cleanup-on-destroy requirement, and the duration ceiling. The `cursor:pointer` ban is a real design rule: in a presentation, an animated diagram element that looks clickable but is not invites a failed click in front of an audience.

### `audit-offline.js` (3,415 bytes)

Walks `pitch.html`, `index.html`, every JS file under `assets/js/` excluding `vendor`, and every CSS file under `assets/css/`. Fails on any external URL, with `localhost`, `127.0.0.1`, and `0.0.0.0` whitelisted, in:

    <script src>, <link href>, <img src>, CSS url(), @import,
    fetch('http...'), XMLHttpRequest.open with an absolute URL, dynamic import('http...')

Carry forward: for a presentation asset, offline integrity is a hard requirement. Conference wifi fails. `V23_BASELINE.md` confirms the result: zero external runtime requests, with d3, motion, elkjs, tabler icons, and all fonts self-hosted under `assets/vendor/`. A Next.js app has different constraints, but any exported deck path must still pass this check.

### `check-emdash.py` (815 bytes)

Globs `**/*.{html,css,js,json,md,txt}`, excludes `.git`, `node_modules`, `assets/vendor`, and fails if U+2014 appears in any file. Prints every offending path.

Carry forward as is. It is eight lines of real logic and it holds a house style rule that is otherwise impossible to enforce by review.

### `lint-copy.py` (2,250 bytes)

The V8 copy linter. Globs `**/*.{html,js}`, excludes `.git`, `node_modules`, `assets/vendor`, `assets/team`, `scripts/`. Three checks:

1. Em dash on any line.
2. Exclamation mark inside a quoted string, skipping comment lines (`//`, `<!--`, `/*`).
3. Banned terms, matched word-boundary inside quoted strings or between `>` and `<`:

       must, will, always, never, guarantee, guaranteed,
       best, highest, lowest, fastest, revolutionary,
       game-changing, conquer, world-class, disruptive

   with an inline escape hatch: any line containing `lint-ok` is skipped.

Prints the first 40 hits as `path:line [kind] context` and exits 1.

Carry forward: this is the claims-discipline gate. For a regulated-industry product, absolute language (`guarantee`, `always`, `never`, `world-class`) is a commercial and compliance liability. The `lint-ok` suppression comment is the right design: it makes an exception explicit and reviewable rather than silently allowed.

Two bugs to fix if porting: the `if hits or True:` guard at line 47 is dead code, and `will` and `must` appear in both `BANNED` and an unused `REVIEW` set, so the intended warn-versus-fail severity split was never implemented.

### `validate-data.js` (4,962 bytes)

Uses Node's `vm.runInNewContext` to evaluate `assets/js/solutions.js` and `assets/js/content.js` in a mocked global scope (it stubs `CLIENT_STATE`, `getCapabilityById`, and the expected data globals), then asserts referential integrity:

- `SOLUTIONS` is an array of exactly 28 entries
- `sourceNumber` is unique and covers 1 to 28 with no gaps (a completeness proof against the source deck)
- every solution has a `portfolioClusterId` that exists in `PORTFOLIO_CLUSTERS`
- `technologyPatternId` is one of `rules-workflow`, `rpa-orchestration`, `analytics-ml`, `genai-copilots`, `agents`, or warns if null
- `sharingStatus` is one of `live`, `team`, `to-confirm`, `illustrative`, `nda`
- `evidenceFlags` exists and each of `concept`, `prototype`, `asset`, `demo` is exactly `true`, `false`, or `null`
- expected counts: 7 portfolio clusters, 8 transformation blocks, 47 risk capabilities (warnings, not failures)

Carry forward: the two closed vocabularies and the tri-state evidence flag model are directly reusable in the product. `sharingStatus` encodes what may be shown to whom, and the `true` / `false` / `null` tri-state distinguishes "we have this", "we do not have this", and "we have not assessed this", which is exactly the distinction an evidence model needs. The `vm.runInNewContext` technique itself is obsolete: in TypeScript this becomes a Zod schema plus a typed fixture, checked at build time.

### `audit-all.js` (9,131 bytes)

Master runner with its own banner-formatted sections. Its header states the P0 fail conditions verbatim:

    - em dash character in repository
    - external runtime dependency
    - core icon missing from manifest
    - core screen title over 10 words
    - essential text below 14px in core route CSS selectors
    - scene missing lifecycle method (play/pause/resume/reset/finish/destroy)
    - cursor:pointer in scene (controls must not look clickable)

Six checks run in order: em dash, offline, icon manifest, title word count, font-size floor, scene lifecycle. The font-size check strips `@media` blocks before matching so it tests primary rules only, and asserts against a named table:

    .arch-rail-label  min 8px
    .sgt-gate-lbl     min 8px
    .etag             min 8px
    .slide-sub        min 17px
    .scene-insight    min 14px

Carry forward: one command that gates everything, a stated P0 list in the file header so the rules are discoverable, and the strip-media-queries-first technique for auditing base CSS.

### `bump-build.ps1` (2,616 bytes)

PowerShell build stamper. Rewrites `window.NFR_BUILD` and every `?v=` cache-buster to one commit SHA. Has a `--DryRun` mode (`npm run build:dry`). A layout test verifies all `?v=` strings in `pitch.html` use a single SHA.

Carry forward the principle: one build identity, stamped everywhere, verified by test. Next.js handles asset hashing natively, so the script itself is obsolete, but the test that asserts a single coherent build identity is not.

---

## 7. `tests/layout.spec.js`

1,966 lines, 130-plus Playwright tests, accumulated in labelled version waves (V12 through V25). Prerequisite: `python -m http.server 8080` from the repo root. Auth is bypassed with `page.addInitScript(() => sessionStorage.setItem('pitch_auth', '1'))` before every navigation.

### Viewports

Three separate viewport arrays plus ad-hoc `setViewportSize` calls.

`VIEWPORTS`, the main matrix, used for a parameterised `test.describe` block (six tests each, so 36 tests):

| Name | Width | Height | Why it matters |
|---|---|---|---|
| `1440x900` | 1440 | 900 | MacBook Pro 14 and 16 inch default |
| `1366x768` | 1366 | 768 | Most common corporate laptop |
| `1024x768` | 1024 | 768 | Older projector and small tablet landscape |
| `390x844` | 390 | 844 | iPhone 14 portrait |
| `1280x720` | 1280 | 720 | 720p projector and screen share |
| `1920x1080` | 1920 | 1080 | 1080p display and conference room screen |

`V15_VIEWPORTS`: `1920x1080`, `1280x720`.
`GEOMETRY_VIEWPORTS`: `1366x768`, `1440x900`, `1920x1080`.

`playwright.config.js` declares six projects covering the same set plus `devices['Desktop Chrome']` and `devices['iPhone 14']`, `timeout: 30000`, `retries: 0`, `headless: true`, `baseURL: 'http://localhost:8080'`, and a `webServer` block that starts `python -m http.server 8080` with `reuseExistingServer: true`.

This matrix is the right one and should be carried forward as is. The critical inclusion is `1024x768` and `1280x720`: client meeting rooms and screen-share sessions, where most presentation layouts break. `V23_BASELINE.md` records the prior state as a P4 defect (only 1280x720 and 390x844 were covered) and the expansion to six viewports as the fix.

### The six per-viewport tests

1. `no console errors on load`. Subscribes to `console` and `pageerror`, waits 1200 ms, asserts zero errors. Runs at all six viewports.
2. `no horizontal overflow on core slides`. `getOverlapReport()` evaluates in-page, comparing `slide.scrollWidth > slide.clientWidth + 2` for every `section[data-slide]`, and filters to `data-route="core"`. A 2 pixel tolerance absorbs sub-pixel rounding.
3. `core slides are attached to DOM`. Asserts the first six ids of `CORE_SLIDES` are attached.
4. `no horizontal overflow on core screens`. A near-duplicate of test 2 using an absolute URL rather than `baseURL`. Redundant, one of them should go.
5. `core section height is 100dvh`. Asserts `Math.abs(s.offsetHeight - window.innerHeight) <= 2` for every `section[data-route="core"]`. This is the single most valuable test in the file: it catches any content that pushes a screen taller than the viewport.
6. `scene-footer max-height 44px on core screens`. Asserts no `.scene-footer` has `offsetHeight > 46`. Note the mismatch: the test name says 44px, the assertion allows 46px, and `scenes.css` sets `max-height: 48px`. Pick one number in the rebuild.

### Other structural rules worth carrying forward

| Test | Rule |
|---|---|
| `V13: exactly 12 core screens` | Screen count is asserted, not just linted |
| `V13: no hard-coded hex colors in core section inner HTML` | Evaluates `.inner` innerHTML and matches `/(?:color\|background):\s*#[0-9A-Fa-f]{3,6}/g`, asserting zero hits. Forces token usage in markup. |
| `no em-dash characters in pitch.html` plus per-file variants for `knowledge-graph.js`, `icon-registry.js`, `cover-flow.js`, `work-role-shift.js`, `scene-director.js` | Belt and braces over the Python check |
| `V13: html element has data-theme=dark` | Default theme is asserted |
| `V13: core screens have data-scene attributes` | Asserts exactly 12 |
| `V17: all required scenes are registered` | Registry completeness at runtime, not just at parse |
| `V18: all 12 core scene containers have static fallback SVG` | Every stage has a `[data-scene-fallback]` |
| `V18: static fallback SVGs have correct viewBox and preserveAspectRatio` | Fallbacks are correct, not just present |
| `V17: reduced-motion shows final state (no empty stages)` | The accessibility path actually renders content |
| `V15: right arrow key advances to next screen` | Keyboard navigation is tested |
| `G key opens edge panel` | Keyboard shortcut is tested |
| `scene-screen uses grid layout` | Asserts `getComputedStyle(el).display === 'grid'`, so the geometry contract cannot silently regress |
| `cover scene-stage height <= 320px` and `>= 250px` | A two-sided bound, not just a ceiling. Catches collapse as well as overflow. |
| `cover SVG viewBox is fixed 1120 x 280` | Exact viewBox assertion |
| `transformation-system has visible content immediately` | Waits only 100 ms and asserts an SVG exists, so a static skeleton must paint before any async fetch resolves |
| `store is initialised with correct defaults` | State shape is asserted |
| `V24: all pitch.html local asset ?v= strings use one SHA` | Build coherence |
| `V19: audit:all passes` | The audit suite is itself a test |
| `assertInsideSafeFrame(page, selector)` helper | Iterates `[data-visual-object]` descendants and asserts each rect is inside the container rect with 2 pixel tolerance, reporting offenders with coordinates |

### Weaknesses in the test file

- Roughly 130 tests in one 1,966-line file with names prefixed by version wave (`V13:`, `V15:`, `V16:`, `V17:`, `V18:`, `V19:`, `V21:`, `V23:`, `V24:`, `V25:`). It reads as an append-only changelog, not a suite. Split by concern in the rebuild.
- Heavy reliance on fixed `waitForTimeout` values (100, 400, 500, 800, 1200 ms) instead of `waitForFunction` or explicit state signals. This is the main flakiness source.
- Many assertions test implementation strings rather than behaviour: `cover-flow.js contains cinematic cold open (10500ms beat + viewBox 1200 560)`, `pressure-convergence.js bottleneck box starts at y=95`, `scale-architecture final zoom is 0.9 not 0.7`, `dual-engine viewBox height is 560`, `regulation-process.js viewBox width is 1240`. These fetch the source file and regex it. They lock in arbitrary numbers and break on any legitimate refactor. Do not reproduce this pattern.
- Duplicate tests (`no horizontal overflow on core slides` and `no horizontal overflow on core screens` assert the same thing) and hard-coded absolute URLs mixed with `baseURL`.
- No visual regression snapshots and, per `V23_BASELINE.md`, no midpoint animation captures and no post-resize stability tests. The resize path is the one that historically broke.

---

## 8. What to carry into NFR WorkOS

Highest value, in order:

1. The scene geometry contract: `100dvh` section, `minmax(0, 1fr)` three-row grid, `min-height: 0` at every level, `contain` on the stage, height-capped header and footer rows. Assert it with a computed-style test.
2. The semantic colour alias layer (`--ai`, `--human`, `--evidence`, `--risk`, `--data`, `--gap`) plus the tint / text / border triple recipe for every state surface. Note that `src/styles/tokens.css` in this repository has already ported the dark palette and formalised the semantic contract; that is the right lineage.
3. Never blank on failure: static fallback, font-ready gate, `finish()` as the reduced-motion and error path, `renderError` then `renderStatic` then fallback SVG.
4. The story audit limits: 12 screens, 10-word titles, 22-word subtitles, no weak-framing articles.
5. The copy linter: no em dash, no exclamation marks in strings, banned absolute-language list, `lint-ok` suppression.
6. The six-viewport matrix, especially `1024x768` and `1280x720`.
7. The closed vocabularies and tri-state evidence flags from `validate-data.js`.
8. One `audit:all` command with its P0 list stated in the file header.
9. The `cursor:pointer` ban in non-interactive visuals.
10. Print as a first-class stylesheet, not an afterthought.

Explicitly do not carry: the `sessionStorage` access gate as security, the legacy short token aliases, `!important` on branded backgrounds, the stubbed route-mode feature, `resume()` restarting from zero, the append-only version-prefixed test naming, source-string assertions in tests, fixed `waitForTimeout` values, and the unresolved conflict between the documented typography scale and the enforced font-size floor.
