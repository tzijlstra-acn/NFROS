# Handoff: Presentation V2.2 Product Captures

Capture infrastructure for NFROS Presentation V2.2, slide 5 (the Work Hub /
split layout slide that replaces the V2.1 simulated placeholder).

## What was built

| Deliverable | Path |
|-------------|------|
| Capture script | `scripts/capture-presentation-assets.ts` |
| Verify script | `scripts/verify-presentation-assets.ts` |
| Asset directory | `public/presentation-assets/v2.2/` |
| Directory README | `public/presentation-assets/v2.2/README.md` |
| Package scripts | `npm run capture:presentation-assets`, `npm run verify:presentation-assets` |
| Handoff doc | this file |

## Capture targets

| Asset ID | URL | Region attribute | Description |
|----------|-----|-----------------|-------------|
| rcsa-work-hub | `/workday/rcsa/work` | `rcsa-work-hub` | RCSA Work Hub agenda view |
| rcsa-stage-1 | `/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh` | `rcsa-stage-workspace` | RCSA stage workspace (evidence-refresh stage) |
| tprm-work-hub | `/workday/tprm/work` | `tprm-work-hub` | TPRM Work Hub agenda view |
| role-home-rcsa | `/workday/rcsa` | `role-home` | RCSA Role Home (Now/Next/Done) |

All URLs are prefixed with `?presentationCapture=1` during capture.

## How to run

1. Start the dev server:

   ```
   npm run dev
   ```

   For the richest data state (seeded scenario):

   ```
   npm run demo:live
   ```

2. In a second terminal:

   ```
   npm run capture:presentation-assets
   ```

3. Verify:

   ```
   npm run verify:presentation-assets
   ```

## Authentication requirement

The capture script navigates pages without active session credentials. Pages
powered by static/synthetic data (the work hub, role home, and stage workspace
all fall back to static data when the DB is not seeded) will render correctly.

For the full scenario-seeded data state, run `npm run demo:live` which sets
`NFR_DEMO_MODE=live` before starting the server.

If a page redirects to a login screen the script captures the login page, emits
a warning, and continues. It does not fail the whole run.

The demo identity persona is `rcsa-analyst` (Thomas Zijlstra).

## Output directory and manifest format

Output: `public/presentation-assets/v2.2/`

The manifest at `manifest.json` has the shape:

```json
{
  "version": "v2.2",
  "capturedAt": "<ISO 8601 timestamp>",
  "capturedFrom": "http://localhost:3000",
  "assets": [
    {
      "id": "rcsa-work-hub",
      "file": "rcsa-work-hub.png",
      "sha256": "<hex>",
      "description": "RCSA Work Hub -- agenda view on first login",
      "capturedFrom": "http://localhost:3000/workday/rcsa/work?presentationCapture=1",
      "region": "rcsa-work-hub"
    }
  ]
}
```

## Placeholder status

No real captures are present. The directory exists; `manifest.json` is not
present until the first capture run. Run `npm run capture:presentation-assets`
against a live server to generate all assets.

## data-presentation-region markers

Markers are added unconditionally as harmless data attributes. They do not
affect layout, styling, or behaviour.

| Marker value | File |
|---|---|
| `rcsa-work-hub` (dynamic by role) | `app/workday/[role]/work/v3.tsx` -- outer `<div className="wd-main-inner">` |
| `tprm-work-hub` (dynamic by role) | same file -- value is `tprm-work-hub` when `roleId === "tprm"` |
| `rcsa-stage-workspace` | `src/components/workday-v3/StageWorkspace.tsx` -- outer `<div>` of the component |
| `role-home` | `src/components/workday-v3/RoleHome.tsx` -- outer `<div className="wd-main-inner">` |

The work hub file uses a ternary so both role values are emitted from one
attribute expression:

```tsx
data-presentation-region={roleId === "rcsa" ? "rcsa-work-hub" : "tprm-work-hub"}
```

## Wiring into slide 5

The PresentationV22 stub at `src/presentation-v2-2/components/PresentationV22.tsx`
contains a comment indicating where to wire the captures:

```tsx
// Product capture: /public/presentation-assets/v2.2/rcsa-work-hub.png
// Replace simulated SplitLayout content when capture is available
```

When real captures exist, the slide 5 split layout panel should be replaced
with an `<img>` pointing at the captured asset rather than the simulated
component tree from V2.1.

## Slide 5 context

Slide 5 (`slide-05`) in `src/presentation-v2-1/data/core-story.ts` uses the
`split` layout, title "The day begins with what needs you", and speaker notes
that call out "Reference product screenshot: Work Hub view". The `rcsa-work-hub`
capture is the primary asset for this slide.
