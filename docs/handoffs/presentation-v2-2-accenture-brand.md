# Presentation V2.2: Accenture Brand Handoff

## Brand asset discovery

Scanned `public/brand/`, `public/fonts/`, and `ACCENTURE_BRAND_ASSET_DIR` (not set).

| Asset | Status |
|---|---|
| Accenture logo (accenture-logo-full.svg / accenture-logo.svg) | **Missing** |
| Greater Than symbol (accenture-greater-than.svg / greater-than.svg) | **Missing** |
| Graphik-Regular.woff2 / .otf | **Missing** |
| Graphik-Semibold.woff2 / .otf | **Missing** |

Fonts present in `public/fonts/`: Geist Sans, Geist Mono, IBM Plex Sans, IBM Plex Mono, Inter, JetBrains Mono, Space Grotesk.
None of these are Accenture licensed fonts. Graphik is not bundled.

To provide licensed assets, set `ACCENTURE_BRAND_ASSET_DIR` in `.env.local` pointing to a directory containing the approved files.

## Font in use

**Arial (fallback)**: Graphik is not available. The CSS token `--pv22-font-family` defaults to `Arial, sans-serif`. When `ACCENTURE_BRAND_ASSET_DIR` is set and Graphik files are present, `src/presentation-v2-2/brand/config.ts` will switch `FONT_IN_USE` to `"Graphik"` automatically.

## Brand mode

**Development only**: neither the Accenture logo nor the Greater Than symbol is available. This means exports are for internal development review only and must not be distributed externally.

When both `accenture-logo-full.svg` (or `accenture-logo.svg`) and `accenture-greater-than.svg` (or `greater-than.svg`) are present in `ACCENTURE_BRAND_ASSET_DIR`, the mode will automatically upgrade to **Brand preflight passed**.

## Colour palette applied

`src/presentation-v2-2/styles/brand-tokens.css` installs the full Accenture colour system:

| Token | Value | Purpose |
|---|---|---|
| `--pv22-brand-purple` | `#A100FF` | Core accent: principal brand colour |
| `--pv22-brand-purple-dark` | `#7500C0` | Human layer, interactive states |
| `--pv22-brand-purple-darkest` | `#460073` | Deep brand contrast |
| `--pv22-brand-purple-light` | `#C2A3FF` | Tints, secondary accent |
| `--pv22-brand-purple-lightest` | `#E6DCFF` | Fills, hover states |
| `--pv22-canvas` | `#F5F6F8` | Slide background |
| `--pv22-text` | `#172033` | Primary copy |
| `--pv22-text-secondary` | `#475467` | Supporting text |
| `--pv22-radius` | `0px` | Angular geometry (Accenture default) |
| `--pv22-radius-product` | `4px` | Permitted only for product screenshot frames |

Aqua (`#00BAFF`) is prohibited and absent.

## Manual sign-off requirements

See `docs/PRESENTATION_V2_2_BRAND_SIGN_OFF.md` for the full checklist. Key human gates:

- Confirm the cover slide uses the official Accenture logo (not a fabricated SVG)
- Confirm the Greater Than symbol appears on interior slides and is used correctly (not as an arrow)
- Confirm no AI-generated photorealistic people appear
- Confirm no co-branding unless written client permission is in hand
- Confirm all superlative claims are cited

## How to run the brand preflight

```bash
npm run check:accenture-brand
# or
npm run test:presentation-brand
```

The script scans `src/presentation-v2-2/` CSS for circles and aqua, scans data files for prohibited copy, and reports pass/warn/fail. Exit code 0 = no errors; 1 = blocking errors.

To run with brand assets:

```bash
ACCENTURE_BRAND_ASSET_DIR=/path/to/approved/assets npm run check:accenture-brand
```

## Files created

- `src/presentation-v2-2/brand/config.ts`: brand mode resolution, asset paths, colour constants
- `src/presentation-v2-2/styles/brand-tokens.css`: CSS custom properties for the full Accenture colour system
- `scripts/check-accenture-brand.ts`: brand preflight runner
- `docs/PRESENTATION_V2_2_BRAND_SIGN_OFF.md`: human sign-off checklist
