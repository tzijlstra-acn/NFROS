# Presentation V2.3: Asset Infrastructure Handoff

## Asset Registry

**Location:** `src/presentation-v2-3/product-proof/asset-registry.ts`

This is the **single source of truth** for all V2.3 presentation assets. It defines:
- Asset IDs (`PresentationAssetId` union type)
- Product routes to navigate to for capture
- `data-presentation-region` attribute value to screenshot
- Canonical PNG filename in `public/presentation-assets/v2.3/`
- Dimensions (all 1920x1080)
- `expectedText` / `forbiddenText` for login detection
- `requiredForCore` / `requiredForAppendix` flags
- Accessible alt text
- Human-readable description

**Never define asset filenames anywhere else.** The `ProductProofFrame` component, capture script, and verify script all read from this registry.

## Placeholder vs. Real Asset Mode

### Placeholder mode
Run `npm run generate:placeholder-assets` to create grey 1920x1080 PNG files for every registry asset. These are valid PNGs but contain no product content. The manifest will have `placeholder: true` on each entry.

`ProductProofFrame` shows a branded fallback UI (not an error) when the image 404s in development: showing the asset description and a prompt to run the refresh script.

### Real capture mode
Run `npm run presentation:refresh-assets` (requires the app running at `http://localhost:3000` or `NFR_CAPTURE_BASE` env var). This runs the Playwright capture script, which:
1. Navigates to each asset's route
2. Waits for `[data-presentation-region="<region>"][data-presentation-ready="true"]`
3. Screenshots the region element
4. Validates file size (> 10 KB)
5. Writes `manifest.json` with SHA-256 hashes and `placeholder: false`

## Running `presentation:refresh-assets`

```bash
# Start the app first (demo-safe mode recommended)
npm run demo:safe

# In a second terminal, capture all assets
npm run presentation:refresh-assets

# Verify the captures
npm run verify:presentation-assets:v2-3
```

To target a non-default server:
```bash
NFR_CAPTURE_BASE=http://localhost:3001 npm run presentation:refresh-assets
```

## Strict Failure Behaviors

The V2.3 capture script exits immediately (non-zero) on any of these conditions:

| Condition | Behavior |
|---|---|
| Page redirects to a login URL | Fatal: stops the entire run |
| `data-presentation-region` not found on page | Fatal: stops the entire run |
| File size < 10 KB after capture | Fatal: stops the entire run |
| Region element disappears after wait | Fatal: stops the entire run |

These are intentional: silent partial captures were the root cause of V2.2 bugs where login-screen PNGs were written as OK.

## `data-presentation-ready` Attribute

Each product page that is a capture target must signal when its content is stable and ready to screenshot.

**Pattern:**

```tsx
// In the product page/component, once async data is loaded:
<div
  data-presentation-region="role-home"
  data-presentation-ready={isReady ? "true" : undefined}
>
  {/* content */}
</div>
```

**Where it needs to be set (pending implementation):**

| Asset ID | Route | Region | Status |
|---|---|---|---|
| `rcsa-home` | `/workday/rcsa` | `role-home` | Needs `data-presentation-region` + `data-presentation-ready` |
| `tprm-home` | `/workday/tprm` | `role-home` | Needs `data-presentation-region` + `data-presentation-ready` |
| `ai-partner` | `/workday/rcsa/work` | `rcsa-work-hub` | Needs both attributes |
| `rcsa-process-stage` | `/workday/rcsa/processes/rcsa-cycle` | `rcsa-stage-workspace` | Needs both attributes |
| `tprm-process-stage` | `/workday/tprm/work` | `tprm-work-hub` | Needs both attributes |
| `decision-approval` | `/workday/rcsa/work` | `rcsa-work-hub` | Needs both attributes |
| `execution-receipt` | `/workday/rcsa/work` | `rcsa-work-hub` | Needs both attributes |
| `evidence-drawer` | `/workday/rcsa/work` | `rcsa-work-hub` | Needs both attributes |
| `role-app-catalogue` | `/workday/rcsa` | `role-home` | Needs both attributes |
| `operations-health` | `/ops` | `ops-dashboard` | `data-presentation-region` added; `data-presentation-ready` needed |

The capture script will warn (but not fail) if the region exists but `data-presentation-ready="true"` is not set within 30 seconds, and will capture anyway. This allows incremental rollout.

## Verify Script Checks

`npm run verify:presentation-assets:v2-3` checks:

1. Asset directory exists
2. `manifest.json` exists and parses
3. No `placeholder: true` entries (real captures only)
4. No `warning` fields in manifest entries
5. All required-for-core assets are present on disk
6. Each asset: file exists, size > 10 KB, valid PNG signature (first 8 bytes)
7. SHA-256 in manifest matches file on disk

Exit 0 only if ALL checks pass.

## File Locations

| File | Purpose |
|---|---|
| `src/presentation-v2-3/product-proof/asset-registry.ts` | Single source of truth |
| `src/presentation-v2-3/product-proof/ProductProofFrame.tsx` | Smart image component |
| `scripts/generate-placeholder-assets.ts` | Creates placeholder PNGs |
| `scripts/capture-presentation-assets-v2-3.ts` | Playwright real capture |
| `scripts/verify-presentation-assets-v2-3.ts` | Strict verification |
| `public/presentation-assets/v2.3/` | Output directory |
| `public/presentation-assets/v2.3/manifest.json` | Capture manifest |
