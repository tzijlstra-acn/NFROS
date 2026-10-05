# Presentation V2.4: product proof captures

Real screenshots of the running NFROS Role Operating System, captured for the V2.4 presentation. Every image is a region of the current V3.3 light interface on the approved seeded day. Nothing is mocked, redrawn or composited.

## One registry drives everything

`src/presentation-v2-4/product-proof/asset-registry.ts` (`ASSET_REGISTRY_V24`) is the single source for each asset: route, capture region, file name, frame label, expected text, forbidden text, core or appendix use, alt text, setup interactions, sub-regions and, where relevant, the reason it cannot be captured. The capture script, file names, the `ProductCapture` renderer, the verify script and the asset table below all read it.

| File | Role |
| :- | :- |
| `src/presentation-v2-4/product-proof/types.ts` | Registry and manifest types |
| `src/presentation-v2-4/product-proof/asset-registry.ts` | `ASSET_REGISTRY_V24`, `getAssetV24(id)`, `CORE_ASSET_IDS`, `APPENDIX_ASSET_IDS`, `assetSrcV24(id)` |
| `src/presentation-v2-4/product-proof/manifest.ts` | Client-safe typed manifest: `PRODUCT_MANIFEST_V24`, `getCaptureV24(id)`, `getSubRegionV24(id, name)`, `getSubRegionNamesV24(id)`, `notCapturedReasonV24(id)` |
| `src/presentation-v2-4/product-proof/manifest-schema.ts` | `parseManifestV24(raw)`, a strict validator |
| `src/presentation-v2-4/product-proof/manifest-node.ts` | `readManifestV24(root)` for scripts (Node only) |
| `src/presentation-v2-4/product-proof/png-stats.ts` | Dependency-free PNG reader for blank, placeholder and theme checks (Node only) |
| `src/presentation-v2-4/product-proof/docs-table.ts` | Renders the asset table in this document |
| `src/presentation-v2-4/product-proof/ProductCapture.tsx` | Renders a capture inside a product frame |
| `scripts/capture-presentation-assets-v2-4.ts` | Capture (`npm run presentation:capture-v2-4`) |
| `scripts/verify-presentation-assets-v2-4.ts` | Verify (`npm run verify:presentation-assets-v2-4`) |
| `public/presentation-assets/v2.4-final/` | PNGs and `manifest.json` |

## Running it

1. Start the app (`npm run dev`, port 3000). No login is needed; AI runs in safe mode.
2. If the demo database has drifted, restore the approved seeded day deliberately with `npm run demo:reset`. The capture never resets anything itself; it fails instead.
3. `npm run presentation:capture-v2-4`. To recapture a subset: `npx tsx scripts/capture-presentation-assets-v2-4.ts --only=or-home,tprm-home`.
4. `npm run verify:presentation-assets-v2-4`.

A failed run writes nothing: PNGs are staged in a temporary folder and copied into `public/presentation-assets/v2.4-final/` only when every asset passes.

## Capture settings

- Viewport 1920 x 1080, device scale factor 2, light colour scheme, reduced motion, locale en-GB, timezone Europe/Berlin.
- Cookie `nfr-wd-theme=light`. Every workday route carries `?ui=v3.3` explicitly. The cookie `nfr-wd-demo` is never set.
- A fresh browser context per asset. Waits for `networkidle`, `document.fonts.ready`, a visible region with `data-presentation-ready="true"`, no `[aria-busy="true"]`, and React hydration of every element it clicks.
- Only the region element is captured (`locator.screenshot`), with animations disabled. There is no full-page fallback.
- When a region is taller than its scroll container, only the viewport height grows (width stays 1920, so layout is unchanged). This applies to `tprm-onboarding-stage` (viewport 1920 x 1118). The manifest records the viewport per asset.

## The run fails when

- the page is a login page (URL pattern or a password field), or returns HTTP 400 or above;
- the Next.js error overlay or a build or runtime error is on screen;
- the page shows `Play the day`, `This workspace could not load`, `The scenario has not been seeded` or `Unhandled Runtime Error`;
- there is no `.workday-v3` root, `data-wd-theme` is not `light`, the `nfr-workday-ui` cookie is not `v3.3`, `nfr-wd-demo` is set, or the bottom bar label `Synthetic institution and data` is missing;
- the region is missing, never becomes ready, or appears more than once;
- a skeleton (`[aria-busy="true"]`) is still visible after 20 seconds;
- any expected text is missing (this is how drift from the seeded day is detected) or any forbidden text is present. Forbidden in every region: demo and developer controls, error and login copy, `Zijlstra`, `accenture.com`, `undefined`, `NaN`, `[object Object]`, placeholder copy, a double hyphen used as a separator between spaces, and the phrase `now ago`;
- the image is under 30 KB, blank (luminance standard deviation under 6), placeholder-like (under 24 distinct colours) or dark (mean luminance under 150 for V3 routes);
- a declared sub-region is missing, invisible or outside the captured region;
- a setup step would click a write action (`Confirm and execute`, `Submit`, `Approve`, `Send`, `Record the decision`, `Dismiss`, `Snooze`).

## Read-only behaviour

- `decision-approval` clicks Next, selects an option and types a rationale. All of that is client state in `DecisionQueue`. `Confirm and execute` is never clicked and the rationale checkbox is left unticked, so the button shows disabled.
- Opening the AI Partner dock is a normal product action with one side effect: its automatic suggestion check appends two rows to `ai_activity_entries` for the role (`Loaded 0 evidence document(s)` and `Reconciled the evidence set against 0 open decision(s)`). No decision, approval, suggestion or receipt changes. `ai-partner` opens the dock once per run, so each full capture run adds two such rows for `rcsa`. They are not visible in any captured asset. Blocking that request would make the dock show an error or a stuck state, which would not be a truthful capture.
- Because of that side effect the dock Activity tab is not deterministic (it lists the newest 60 rows, which shift with every dock open), so it is not in the registry.

## Synthetic data label

The capture asserts that the bottom bar label `Synthetic institution and data` is on every workday page. The label is inside the captured image only for the Work Hub views (`meeting-preparation`, `actions`, `inbox-conversion`) and `role-app-library`, where the page repeats it inline (sub-region `synthetic-label`). The role homes, stage workspaces, evidence status, decision queue and AI Partner dock regions exclude the bottom bar, so slides that show them should carry the synthetic data caption themselves.

## Manifest

`public/presentation-assets/v2.4-final/manifest.json`:

```json
{
  "version": "v2.4-final",
  "capturedAt": "ISO timestamp",
  "commit": "short git sha",
  "worktreeDirty": true,
  "baseUrl": "http://localhost:3000",
  "assets": {
    "or-home": {
      "file": "or-home.png",
      "width": 1760,
      "height": 1628,
      "deviceScaleFactor": 2,
      "sha256": "hex",
      "route": "/workday/rcsa?ui=v3.3",
      "region": "role-home",
      "bytes": 154710,
      "viewport": { "width": 1920, "height": 1080 },
      "background": "#f5f6f8",
      "subRegions": { "now": { "x": 48, "y": 160, "width": 1664, "height": 466 } }
    }
  },
  "notCaptured": { "execution-receipt": "reason" }
}
```

Sub-region boxes are in image pixels (CSS pixels times the device scale factor), relative to the captured region's top-left corner. `background` is the product canvas colour sampled from the image border.

## ProductCapture

```tsx
import { ProductCapture } from "@/presentation-v2-4/product-proof/ProductCapture";

<ProductCapture
  assetId="or-home"
  width={720}
  maxHeight={600}
  frame="browser"
  focus={[
    { region: "now", label: "Needs you now" },
    { region: "ai-partner", label: "AI Partner" },
    { region: "meetings-actions", label: "Meetings and actions" },
    { region: "done", label: "Done" },
  ]}
/>
```

| Prop | Meaning |
| :- | :- |
| `assetId` | A registry id |
| `width` | Outer width of the frame on the slide stage, in px |
| `maxHeight` | Optional cap on the outer height in px; the capture is clipped from the bottom |
| `crop` | Optional sub-region name; the frame shows only that box (plus the asset's frame padding of real neighbouring pixels) |
| `frame` | `browser` (default): thin border plus a 28 px title bar with three square dots and the label. `plain`: thin border only |
| `focus` | Optional list of `{ region, label }`: a 2 px accent outline 4 px outside the sub-region box, with a label chip above it (inside when there is no room) |
| `label` | Title bar text; defaults to the registry `frameLabel` |

The component is static (no hooks, no animation, no `"use client"`), uses a plain `<img>` with intrinsic `width` and `height`, square corners and the `--pv24-*` tokens. Exhibits animate it themselves. `measureProductCapture({ assetId, width, maxHeight, crop, frame })` returns the outer size for layout. Regions with no padding of their own (`rcsa-process-stage`, `tprm-onboarding-stage`, `evidence-review`) get 24 CSS px of canvas-coloured frame padding from the registry `framePadding`. When an asset has no capture, the component renders a dashed "Product capture not available" box with the reason (`data-capture-missing="true"`) rather than an empty or fake image. Unknown focus regions are listed in `data-focus-missing`.

## Region markers added to the product

Attribute-only additions; no layout, styling, behaviour or copy changed.

| File | Line | Attributes |
| :- | :- | :- |
| `src/components/workday-v3/RoleHome.tsx` | 158 | `data-presentation-ready="true"` beside the existing `role-home` |
| `src/components/workday-v3/StageWorkspace.tsx` | 178 | `data-presentation-ready="true"` beside the existing `rcsa-stage-workspace` |
| `src/components/workday-v3/WorkdayPartnerDock.tsx` | 213 to 214 | `data-presentation-region="ai-partner-dock"`, ready once the partner payload has loaded |
| `app/workday/[role]/decisions/v3.tsx` | 52 to 53 | `data-presentation-region="decision-queue"`, ready when the queue has rows |
| `app/workday/[role]/processes/v3.tsx` | 530 to 531 | `data-presentation-region="role-app-library"`, ready |
| `app/workday/[role]/processes/third-party-onboarding/v3.tsx` | 450 to 451 | `data-presentation-region="tprm-stage-workspace"`, ready |
| `app/workday/[role]/processes/third-party-onboarding/v3.tsx` | 550 to 551 | `data-presentation-region="tprm-evidence-status"`, ready when evidence items exist |
| `app/workday/[role]/work/v3.tsx` | 1394 | `data-presentation-ready="true"` beside the existing work hub region |

## Assets

<!-- product-proof-assets:start -->
Generated by the capture script from the registry and manifest (captured 2026-10-04T22:27:08.633Z, commit 6c2cf46, dirty worktree).

| Asset | Use | Route | Region | Image px (2x) | Sub-regions |
| :- | :- | :- | :- | :- | :- |
| `or-home` | core | `/workday/rcsa?ui=v3.3` | `role-home` | 1760 x 1628 | `now`, `ai-partner`, `next`, `meetings-actions`, `watching`, `done` |
| `tprm-home` | core | `/workday/tprm?ui=v3.3` | `role-home` | 1760 x 1586 | `now`, `ai-partner`, `next`, `meetings-actions`, `watching`, `done` |
| `rcsa-process-stage` | core | `/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh&ui=v3.3` | `rcsa-stage-workspace` | 1664 x 1410 | `heading`, `ai-prepared`, `your-task`, `artifacts`, `action-form`, `recent-events` |
| `tprm-onboarding-stage` | core | `/workday/tprm/processes/third-party-onboarding?stage=evidence-review&ui=v3.3` | `tprm-stage-workspace` | 1664 x 1996 (viewport 1920 x 1118) | `heading`, `ai-prepared`, `responsibility`, `evidence-status`, `decision-form` |
| `evidence-review` | core | `/workday/tprm/processes/third-party-onboarding?stage=evidence-review&ui=v3.3` | `tprm-evidence-status` | 1664 x 894 | `summary`, `list`, `condition-item`, `missing-penetration-test`, `missing-bcm-plan` |
| `decision-approval` | core | `/workday/rcsa/decisions?ui=v3.3` | `decision-queue` | 1760 x 1232 | `queue`, `active-decision`, `steps`, `authority`, `approver`, `choice`, `confirm`, `confirm-action` |
| `meeting-preparation` | appendix | `/workday/rcsa/work?view=meetings&ui=v3.3` | `rcsa-work-hub` | 1760 x 1148 | `tabs`, `synthetic-label`, `upcoming`, `workshop`, `minutes-archive` |
| `actions` | appendix | `/workday/rcsa/work?view=actions&filter=needs-me&ui=v3.3` | `rcsa-work-hub` | 1760 x 1342 | `tabs`, `synthetic-label`, `filters`, `list`, `first-action` |
| `inbox-conversion` | appendix | `/workday/rcsa/work?view=inbox&ui=v3.3` | `rcsa-work-hub` | 1760 x 1092 | `tabs`, `synthetic-label`, `list`, `first-item` |
| `ai-partner` | appendix | `/workday/rcsa?ui=v3.3` | `ai-partner-dock` | 720 x 2064 | `header`, `status`, `tabs`, `suggestion` |
| `role-app-library` | appendix | `/workday/rcsa/processes?ui=v3.3` | `role-app-library` | 1760 x 578 | `tabs`, `processes`, `synthetic-label` |

Setup interactions (client state only, never a database write):

- `decision-approval`: Click Next to move from Understand to Compare; Select the recommended option, One causal investigation covering all three indicators; Click Next to move to Explain; Type a rationale in the reasoning field (client state only); Click Next to reach Confirm; Confirm and execute is never clicked.
- `ai-partner`: Open the AI Partner dock from the header button whose name starts with AI Partner; Select the Suggestions tab; Scroll the dock body to the top.

Not captured:

- `execution-receipt`: The approved seeded day has no executed decisions: execution_receipt_lines is empty and the AI Partner Activity tab renders no AIExecutionReceipt for rcsa or tprm. A receipt only exists after Confirm and execute, which writes to the database and is outside a read-only capture.
- `meeting-minutes`: The Minutes archive is empty in the approved seeded day (it reads No minutes in the archive), so there are no minutes to show. The meetings view itself is captured as meeting-preparation.
- `operations-status`: The /ops console renders outside the V3.3 shell in dark V2 styling, and at 1920x1080 its System health, Job queue and Failed jobs sections draw over each other, so it is not a truthful current light UI screen.
<!-- product-proof-assets:end -->

## Observations from the captured screens

- Meeting times in the Work Hub render as raw ISO timestamps (for example `2026-10-06T09:30:00.000Z`). That is the product as it stands.
- The dock suggestion card shows `Prepared answer now`, the product's own relative time label.
- `Marlene Aigner`, `Andreas Kellner` and `Arcadia Bank AG` are synthetic personas from `src/scenario/data`.
