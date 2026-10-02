# V3.2 Role Selector and Release Status Model

## What changed

### New: release status model
`src/product/release/role-release.ts` introduces `RoleReleaseDefinition` with a `status` field
(`flagship | preview | hidden`). All six roles are seeded:

- **rcsa** and **tprm** are `flagship` (fully interactive, available now).
- **control-assurance**, **incident-resilience**, **regulatory-change**, **nfr-governance** are
  `preview` (route exists, shows explanation page).

The definitions are static (no database dependency), so the role selector works before and after
the scenario is seeded.

### New: light-theme role selector
`src/components/workday-v3/RoleSelector.tsx` replaces the old dark role-selection page.

Layout:
- Light canvas (`--wd-canvas`) with IBM Plex Sans.
- Compact header: "NFR WorkOS" wordmark + "Synthetic institution and data" label.
- "Available now" section: flagship roles as bordered cards with title, purpose, primary
  processes, and an "Open workday" button.
- "Preview roles" section: preview roles as a compact list with a "Preview" badge and
  a "View preview" link. No "Open workday" button on preview entries.
- No navigation rail (no role has been selected yet).

### Rebuilt: app/workday/page.tsx
Now a two-line wrapper that renders `<RoleSelector />`. All DB calls removed from this file.

### New: PreviewRolePage
`src/components/workday-v3/PreviewRolePage.tsx` is shown when a preview-role URL is accessed
directly. It names the role, explains it is not part of the current two-role release, lists the
flagship roles, and offers two actions: "Choose a flagship role" (`/workday`) and
"View presentation" (`/story`).

### Updated: app/workday/[role]/v3.tsx
The V3 role home now checks the release model before rendering. For preview roles it returns
`<PreviewRolePage />` instead of the full workday experience. The V3 frame (header, chrome) still
wraps the page, so the layout is consistent.

### Updated: app/page.tsx
The "Six professional lenses" panel has been removed from the right column. The entry page now
carries only the runtime status panel and the demonstration mode selector on the right, alongside
the existing proposition and action buttons on the left. The two primary actions ("Open the
presentation", "Enter the interactive workday") were already present and are unchanged.

## CSS tokens used

All values come from the V3 token scope (`--wd-*`) declared in
`src/styles/workday-v3-tokens.css`. The components are scoped under `.workday-v3` on the root
element, so the tokens resolve without any additional imports.

Key tokens:
- `--wd-canvas` -- light page background (`#f5f6f8`)
- `--wd-surface` -- card and header background
- `--wd-border` -- card borders and row dividers
- `--wd-text`, `--wd-text-secondary`, `--wd-text-muted` -- copy hierarchy
- `--wd-accent` -- primary button fill
- `--wd-surface-hover` -- Preview badge background
- `--wd-radius-lg`, `--wd-radius-sm` -- border radii
- `--wd-weight-strong` (600), `--wd-weight-medium` (500) -- typography weights

Note: `--wd-text-muted` is used for quiet labels. `--wd-text-tertiary` does not exist in this
scope and is never referenced.

## Preview pattern

A preview role URL (`/workday/control-assurance`, etc.) is handled at the V3 route level.
The layout still wraps it (providing the header and chrome). The `v3.tsx` component checks
`getRoleRelease(roleId).status === "preview"` and returns `PreviewRolePage` before any database
or scenario queries run. This means preview pages are fast, DB-independent, and honest about
what is and is not interactive in the current release.
