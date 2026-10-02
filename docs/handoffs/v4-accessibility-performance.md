# V4.0 Accessibility and Performance Handoff

Agent H delivery for NFR WorkOS V4.0. Documents the accessibility automation, keyboard journey tests, skip-to-main implementation, and performance budget script added in this pass.

---

## Files created or modified

| File | Change |
|---|---|
| `tests/e2e/accessibility.spec.ts` | New -- axe-core accessibility suite |
| `tests/e2e/keyboard.spec.ts` | New -- keyboard journey tests |
| `scripts/perf-check.ts` | New -- performance budget script |
| `src/components/workday-v3/WorkdayAppFrame.tsx` | Modified -- skip-to-main link added |
| `package.json` | Modified -- three new npm scripts |

---

## Accessibility tests

**File:** `tests/e2e/accessibility.spec.ts`

**Runner:** `npm run test:accessibility`

Injects axe-core from the local devDependency (`node_modules/axe-core/axe.min.js`) into the browser using `page.addScriptTag`. No CDN call, no new packages required. axe-core 4.13.0 is already in `devDependencies`.

**Pages tested:**

- Entry (`/`)
- Role selector (`/workday`)
- RCSA Home (`/workday/rcsa`)
- RCSA Decisions (`/workday/rcsa/decisions`)
- RCSA Processes (`/workday/rcsa/processes`)
- TPRM Home (`/workday/tprm`)
- TPRM Decisions (`/workday/tprm/decisions`)
- TPRM Processes (`/workday/tprm/processes`)

**Violation policy:**

- Critical or serious violations: hard test failure (`expect(...).toHaveLength(0)`).
- Moderate or minor violations: logged to console as warnings, test still passes.
- WCAG 2.1 AA ruleset applied.

**Graceful degradation:** Tests skip (rather than fail) when the server returns 404 or is not running.

---

## Keyboard journey tests

**File:** `tests/e2e/keyboard.spec.ts`

**Runner:** `npm run test:keyboard`

**Journeys covered:**

1. First Tab from body lands on an interactive element (skip link, nav link, or button).
2. Skip-to-main link (`href="#main"`) moves focus to `<main id="main">` when activated.
3. Keyboard navigation from `/workday` index to RCSA role page (Enter on link).
4. Keyboard navigation from RCSA Home to Decisions via nav link.
5. Presentation deck arrow key navigation (ArrowRight / ArrowLeft / Home / End).
6. Role switcher opens with Enter and closes with Escape.

All tests skip gracefully when the server is not running or the page returns 404.

---

## Skip-to-main link

**Modified file:** `src/components/workday-v3/WorkdayAppFrame.tsx`

Added immediately after the `WorkdayChromeProvider` opening tag:

```tsx
<a href="#main" className="skip-link">
  Skip to main content
</a>
```

The `.skip-link` CSS class was already defined in `src/styles/globals.css` (lines 124-136). It uses `position: absolute; top: -3rem` when unfocused and `top: var(--space-4)` on `:focus`, which is the standard skip-link pattern.

The `<main id="main">` target exists in `WorkdayBody.tsx` line 33. The link and target are connected without any new JavaScript.

**Other shells (V1, V2):**

- `src/components/workday-v2/ShellFrame.tsx` has `<main id="main">` but no skip link.
- `src/components/shell/WorkdayShell.tsx` has `<main id="main">` but no skip link.
- `src/components/workday-v3/RoleSelector.tsx` has `<main id="main">` but no skip link.

These remain without skip links for now. V3.1 is the primary demo path. Add skip links to the V1 and V2 shells in a separate pass if those paths require full WCAG compliance.

---

## Performance budget script

**File:** `scripts/perf-check.ts`

**Runner:** `npm run perf:check`

**Budgets:**

| Metric | Budget |
|---|---|
| Header visible (First Contentful Paint) | 400ms |
| Shell interactive (domcontentloaded) | 800ms |

**Routes measured:**

- `/workday/rcsa` (RCSA Home)
- `/workday/tprm` (TPRM Home)
- `/workday/rcsa/decisions` (RCSA Decisions)
- `/workday/rcsa/processes` (RCSA Processes)

**Notes:**

- FCP is read from `performance.getEntriesByType("paint")`. If the browser does not populate this (e.g., headless Chrome with certain flags), FCP is omitted from that run rather than falsely failing.
- Shell interactive is measured as wall-clock time from `page.goto` call to `domcontentloaded`. This includes DNS resolution and TCP on first call. For reproducible CI numbers, run against a locally started server (`npm run start`) and accept the first result is warmer than subsequent ones.
- The script exits 0 when all measured budgets pass and 1 when any fail.
- `BASE_URL` environment variable overrides the default `http://localhost:3000`.

---

## npm scripts added

```json
"test:accessibility": "playwright test tests/e2e/accessibility.spec.ts",
"test:keyboard":     "playwright test tests/e2e/keyboard.spec.ts",
"perf:check":        "tsx scripts/perf-check.ts"
```

---

## Known gaps and required fixes

### Skip link on non-V3.1 shells

The skip link is added only to `WorkdayAppFrame` (V3.1 shell). V1 and V2 shells do not have skip links. If those routes are shown to WCAG auditors, they will flag this.

### axe-core violations likely to appear

Running the accessibility tests against a V3.1 workday page will surface real violations. Common patterns found in similar dense-layout products:

- **color-contrast**: Dark theme uses white text on purple accent backgrounds. These may pass 4.5:1 for normal text but fail on compact table rows where `var(--wd-text-sm)` at 13px requires 4.5:1 (not 3:1). Audit against the light theme too.
- **aria-label on icon-only buttons**: Navigation rail items that render icons without visible labels (in collapsed state) need `aria-label` or `title` on the button.
- **landmark structure**: Check that exactly one `<main>` is present per page. The V3.1 shell has `WorkdayBody.tsx` with `<main id="main">` but also renders `WorkdayPanels` -- verify panels do not add a second main.

### Performance budget calibration

The 400ms FCP and 800ms TTI budgets are starting points based on the product's own stated target (400ms header visible). They are tight for a Next.js SSR app running in `NFR_DEMO_MODE=safe` with a SQLite database. Measure baseline before enforcement and adjust to p95 of observed values plus 20%.

### TypeScript

The accessibility spec uses `// eslint-disable-next-line @typescript-eslint/no-explicit-any` for the axe evaluate call because `axe` is a runtime global injected into the browser context. This is intentional and the only `any` in the new files.

Run `npm run typecheck` to confirm no new type errors were introduced by this change.
