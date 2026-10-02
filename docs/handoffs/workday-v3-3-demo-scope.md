# WorkOS V3.3 - Demo Scope Handoff

## Summary

This handoff documents the role release status changes made in V3.3. The vocabulary
shifts from "flagship/preview" to "available/demo/planned" to better reflect what each
tier means to a client audience.

## Files changed

### src/product/release/role-release.ts

Changed:
- `RoleReleaseStatus` type: `"flagship" | "preview" | "hidden"` to `"available" | "demo" | "planned" | "hidden"`
- rcsa: `"flagship"` to `"available"`
- tprm: `"flagship"` to `"available"`
- control-assurance: `"preview"` to `"demo"`
- incident-resilience: `"preview"` to `"demo"`
- regulatory-change: `"preview"` to `"planned"`
- nfr-governance: `"preview"` to `"planned"`

No other fields changed. The `getRoleRelease()` function and all `defaultRoute` values
are unchanged. `defaultRoute` remains set even for planned roles because the URL is
still valid (it routes to PreviewRolePage); the PlannedRow in the selector simply
does not render a link to it.

### src/components/workday-v3/RoleSelector.tsx

Changed:
- Filter variables renamed: `flagship`/`preview` to `available`/`demo`/`planned`
- Section label "Available now" stays; "Preview roles" replaced by two sections:
  "Demo" and "Planned"
- `PreviewRow` renamed to `DemoRow`; badge text changed from "Preview" to "Demo";
  link text changed from "View preview" to "View demo"
- Added `PlannedRow` component: same layout as `DemoRow` but no link, reduced
  opacity (0.6), and name text uses `var(--wd-text-muted)` to read as inactive.
  Badge shows "Planned".

### app/workday/[role]/v3.tsx

Changed the gate condition from:
```tsx
if (releaseInfo && releaseInfo.status === "preview") {
```
to:
```tsx
if (releaseInfo && (releaseInfo.status === "demo" || releaseInfo.status === "planned")) {
```

Both demo and planned roles now redirect to `PreviewRolePage`. The layout chrome
remains consistent.

### src/components/workday-v3/PreviewRolePage.tsx

Changed:
- The hardcoded "Preview role" label is now computed:
  ```tsx
  const statusLabel =
    role.status === "demo"
      ? "Demo role"
      : role.status === "planned"
        ? "Planned role"
        : "Preview role";
  ```
- Button text: "Choose a flagship role" changed to "Choose an available role"
- File and function doc comment updated to reflect demo/planned vocabulary

### app/settings/role-apps/page.tsx

Changed descriptive text only (not TypeScript types or switch cases, which operate
on the separate `RoleAppStatus` type from `src/role-apps/contracts.ts`):
- Lede: "Two flagship apps" to "Two available apps"; "preview or concept" to
  "demo or concept"
- `Field` label: "Preview or concept" to "Demo or concept"
- Field `note`: "Preview apps are visible..." to "Demo apps are visible..."

### src/role-apps/registry.ts

Changed comment-level language only. The `status: "preview"` field values on the
registry app definitions are left as "preview" because `RoleAppStatus` in
`src/role-apps/contracts.ts` still uses "preview" as its vocabulary for role-app
lifecycle state. That is a separate type from `RoleReleaseStatus`. Changing the
registry statuses would require updating `contracts.ts` and all switch statements
in the settings page, which is out of scope for this release.

## Issues found

None. TypeScript types are consistent: all references to `"flagship"` and
`"preview"` as `RoleReleaseStatus` values have been removed. Remaining uses of
`"preview"` in the codebase belong to `RoleAppStatus` (a different type) and to
code comments.

## Remaining uses of "flagship" in codebase (all in comments)

- `src/components/workday-v3/WorkdayNavigation.tsx` lines 6-7: internal code
  comment describing the nav rail scope. User-facing string: none.
- `app/workday/[role]/processes/v3.tsx` lines 4 and 128: internal code comments.
  User-facing string: none.

These do not need to change for the V3.3 release.
