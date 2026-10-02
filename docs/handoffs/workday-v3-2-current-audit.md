# NFR WorkOS  --  V3.2 Current Codebase Audit

Agent A read-only audit. No code changes. Factual state of `main` as of audit date.

---

## 1. Route inventory under `app/workday/`

### Entry route

| Route | File | Current component | Notes |
|---|---|---|---|
| `/workday` | `app/workday/page.tsx` | `<RoleSelector />` | 17-line thin wrapper; no DB access; static release data only |

`app/workday/page.tsx` (current, 17 lines):
```tsx
import { RoleSelector } from "@/components/workday-v3/RoleSelector";
export const dynamic = "force-dynamic";
export default function WorkdayIndexPage() {
  return <RoleSelector />;
}
```

### Role sub-routes (`app/workday/[role]/`)

All sub-routes dispatch through `createWorkdayPage(V1, V2, V3)` in their `page.tsx`. V1 and V2 variants exist for all segments. V3 variants exist for all segments in `V3_NATIVE_SEGMENTS`.

| Route segment | V3 component | Status |
|---|---|---|
| `""` (role home) | `RoleHome` (flagship) / `PreviewRolePage` (preview) | Fully implemented for flagship; redirect-style stub for preview |
| `decisions` | `DecisionQueue` (via `features/decisions/DecisionQueue`) | Fully implemented |
| `workbench` | `SectionStub` | Stub  --  renders title, description, "More coming soon" |
| `meetings` | `SectionStub` | Stub |
| `mail` | `SectionStub` | Stub |
| `calendar` | `SectionStub` | Stub |
| `collaboration` | `SectionStub` | Stub |
| `assistant` | `SectionStub` | Stub  --  route exists, no navigation link points to it |

#### Layout behaviour

`app/workday/[role]/layout.tsx` reads `x-nfr-workday-ui` request header (set by `middleware.ts` from the `?ui=` query). If the resolved version is `v3.1`, the layout wraps children in `<WorkdayAppFrame>`. For `v1` or `v2`, layout passes children through unchanged so the V2 shell can render its own frame.

#### Preview-role gate in `v3.tsx`

`app/workday/[role]/v3.tsx` calls `getRoleRelease(roleId)` before any DB or scenario queries. If `releaseInfo.status !== "flagship"`, it returns `<PreviewRolePage role={releaseInfo} />` inside the V3 frame. Flagship roles (currently `rcsa` and `tprm`) proceed to `<RoleHome>`.

---

## 2. Default UI version

Source file: `src/workday/contracts.ts`

```ts
// line 82
export const DEFAULT_WORKDAY_UI: WorkdayUiVersion = "v3.1";

// line 91
export const CURRENT_WORKDAY_UI: WorkdayUiVersion = "v3.1";
```

`?ui=current`, `?ui=v3`, `?ui=latest` all resolve to `"v3.1"` via `UI_ALIASES` (lines 94–99).

`V3_NATIVE_SEGMENTS` (lines 50–59) lists all eight segments that have V3.1 implementations. The full list as declared:

```ts
export const V3_NATIVE_SEGMENTS: readonly string[] = [
  "",
  "decisions",
  "workbench",
  "meetings",
  "mail",
  "calendar",
  "collaboration",
  "assistant",
];
```

All eight segments match the V3 file inventory above.

---

## 3. CSS custom property audit  --  `var(--wd-*)` tokens

### Declared tokens in `src/styles/workday-v3-tokens.css`

Scope: `.workday-v3` (light), `.workday-v3[data-wd-theme="dark"]` (dark override).

**Typography**
`--wd-font`, `--wd-font-mono`, `--wd-weight-normal`, `--wd-weight-medium`, `--wd-weight-strong`, `--wd-text-xs`, `--wd-text-sm`, `--wd-text-base`, `--wd-text-md`, `--wd-text-lg`, `--wd-text-xl`, `--wd-text-2xl`, `--wd-text-3xl`, `--wd-leading-tight`, `--wd-leading-snug`, `--wd-leading-normal`

**Surfaces**
`--wd-canvas`, `--wd-surface`, `--wd-surface-subtle`, `--wd-surface-hover`, `--wd-surface-selected`, `--wd-border`, `--wd-border-strong`

**Text colours**
`--wd-text`, `--wd-text-secondary`, `--wd-text-muted`, `--wd-text-disabled`

**Semantic colours**
`--wd-accent`, `--wd-accent-soft`, `--wd-accent-border`, `--wd-info`, `--wd-info-soft`, `--wd-success`, `--wd-success-soft`, `--wd-warning`, `--wd-warning-soft`, `--wd-danger`, `--wd-danger-soft`

**Elevation**
`--wd-shadow-sm`, `--wd-shadow-md`, `--wd-shadow-lg`

**Geometry / spacing / motion**
`--wd-header-h`, `--wd-nav-w`, `--wd-nav-w-expanded`, `--wd-drawer-w`, `--wd-dock-w`, `--wd-updates-h`, `--wd-1` through `--wd-10` (1, 2, 3, 4, 5, 6, 8, 10  --  note: `--wd-7` and `--wd-9` are not declared), `--wd-radius-sm`, `--wd-radius`, `--wd-radius-lg`, `--wd-radius-pill`, `--wd-row-h`, `--wd-row-h-compact`, `--wd-t-fast`, `--wd-t-base`, `--wd-t-drawer`, `--wd-ease`

### Token `--wd-text-tertiary`

**Status: not declared, not referenced.**

Grep across the entire repository for `--wd-text-tertiary` returns one result: line 64 of `docs/handoffs/workday-v3-2-role-selector.md`, which is the prior handoff document stating the token does not exist. No component or CSS file references it in a `var()` call.

### Other undeclared token references

No `var(--wd-*)` reference in `src/components/workday-v3/` or `src/styles/workday-v3.css` resolves to an undeclared token. Every token name found in the grep output (`--wd-1` through `--wd-10`, `--wd-text-*`, `--wd-surface-*`, `--wd-border-*`, `--wd-accent-*`, etc.) is declared in `workday-v3-tokens.css` within the `.workday-v3` scope.

The one token declared locally (not in the tokens file) is `--wd-shell-overflow: hidden` at `src/styles/workday-v3.css:54`, inside the `.workday-v3` block. This is a local override variable, not a design token, and is used only by `WorkdayAppFrame`.

---

## 4. `app/workday/page.tsx`  --  current CSS classes

The current `app/workday/page.tsx` is 17 lines. It contains no JSX markup of its own and applies no CSS classes. The entire visible interface is delegated to `<RoleSelector />`.

`src/components/workday-v3/RoleSelector.tsx` applies:
- `className="workday-v3"` on the root `<div>` (line 28)  --  this is the scope activator for all V3 tokens
- All other styling is done with inline `style` props using `var(--wd-*)` tokens

The following classes that appeared in the OLD `app/workday/page.tsx` are **not present** in the current file or in `RoleSelector.tsx`:
- `display`  --  not used
- `lede`  --  not used
- `panel`  --  not used
- `chip`  --  not used
- `panel-head`  --  not used
- `panel-body`  --  not used

These classes belong to the global presentation scope (`globals.css` / `tokens.css`). RoleSelector uses only V3 tokens and inline styles.

---

## 5. `app/page.tsx`  --  root entry, role listing

The current `app/page.tsx` does **not** list all 6 roles. The "Six professional lenses" panel and the `roles.map(...)` block have been removed in the V3.2 update.

**What the current `app/page.tsx` renders (right column):**
1. Runtime status panel (`panel` / `panel-head` / `panel-body`)  --  always shown
2. Demonstration mode panel  --  always shown
3. Setup required panel  --  shown only when `!seeded`

No role cards, no `getRoles()` call, no `getUser()` or `getEntity()` call.

**Footer navigation in `app/page.tsx`** (lines 229–248):
- `/story`  --  Presentation
- `/workday`  --  Workday (→ `RoleSelector`)
- `/control-room`  --  Control room
- `/trust`  --  Trust
- `/value`  --  Value
- `/roadmap`  --  Roadmap

The root entry page is aware of six footer links but renders none of the six professional roles.

---

## 6. Navigation links in `src/components/workday-v3/WorkdayNavigation.tsx`

### Primary items (always visible, 4 items)

| Label key | Segment | Resolved href | Real page or stub |
|---|---|---|---|
| `home` | `""` | `/workday/<role>` | Real  --  `RoleHome` (flagship) or `PreviewRolePage` (preview) |
| `decisions` | `"/decisions"` | `/workday/<role>/decisions` | Real  --  `DecisionQueue` |
| `workbench` | `"/workbench"` | `/workday/<role>/workbench` | Stub  --  `SectionStub` |
| `meetings` | `"/meetings"` | `/workday/<role>/meetings` | Stub  --  `SectionStub` |

Note: The brief called for five primary items. A fifth item (`My work` → `/workday/<role>/my-work`) was removed because the route does not exist. This is documented in a code comment at line 66–76 of `WorkdayNavigation.tsx`.

### Secondary items (behind "More" button, 3 items)

| Label key | Segment | Resolved href | Real page or stub |
|---|---|---|---|
| `mail` | `"/mail"` | `/workday/<role>/mail` | Stub  --  `SectionStub` |
| `calendar` | `"/calendar"` | `/workday/<role>/calendar` | Stub  --  `SectionStub` |
| `collaboration` | `"/collaboration"` | `/workday/<role>/collaboration` | Stub  --  `SectionStub` |

### Foot items (always visible, below `wd-nav-spacer`)

| Label key | Hard-coded href | Destination |
|---|---|---|
| `trust` | `/trust` | `app/trust/page.tsx`  --  V2-style dark shell (`ReportShell`) |
| `settings` | `/settings/organisation` | `app/settings/layout.tsx`  --  explicitly scoped `.workday-v2` |
| Collapse/Expand | n/a | Client-side `chrome.toggleNav()`  --  no route |

### Missing navigation items

- **Assistant** (`/workday/<role>/assistant`): route and V3 SectionStub exist but there is no navigation link pointing to it. The assistant section is unreachable from the V3.1 navigation rail.
- **Control Room**: not linked from `WorkdayNavigation`. Accessible only from the root `app/page.tsx` footer.

---

## 7. Routes using `.workday-v2` classes in `app/` and `src/components/workday-v3/`

### In `app/` (direct class application or V2 import chain)

| File | Line | Usage |
|---|---|---|
| `app/settings/layout.tsx` | 47 | `className="workday-v2"` on root `<div>`  --  entire settings shell in V2 dark scope |
| `app/workday/[role]/v2.tsx` | 24–26 | Imports `WorkdayV2Route`, `FocusWorkspace`, `RoleWorkObject` from `workday-v2/` |
| `app/workday/[role]/decisions/v2.tsx` | 11–12 | Imports `WorkdayV2Route`, `DecisionsSection` from `workday-v2/` |
| `app/workday/[role]/workbench/v2.tsx` | 31–34 | Imports `WorkdayV2Route`, `RoleWorkObject`, `SourceRow` from `workday-v2/` |
| `app/workday/[role]/meetings/v2.tsx` | 11–12 | Imports `WorkdayV2Route`, `MeetingsSection` from `workday-v2/` |
| `app/workday/[role]/mail/v2.tsx` | 11–12 | Imports `WorkdayV2Route`, `MailSection` from `workday-v2/` |
| `app/workday/[role]/calendar/v2.tsx` | 11–12 | Imports `WorkdayV2Route`, `CalendarSection` from `workday-v2/` |
| `app/workday/[role]/collaboration/v2.tsx` | 11–12 | Imports `WorkdayV2Route`, `CollaborationSection` from `workday-v2/` |
| `app/workday/[role]/assistant/v2.tsx` | 11–12 | Imports `WorkdayV2Route`, `AssistantSection` from `workday-v2/` |
| `app/settings/authority/page.tsx` | 46 | Imports primitives from `workday-v2/primitives` |
| `app/settings/deployment/page.tsx` | 25 | Imports primitives from `workday-v2/primitives` |
| `app/settings/integrations/page.tsx` | 43 | Imports primitives from `workday-v2/primitives` |
| `app/settings/mappings/page.tsx` | 34 | Imports primitives from `workday-v2/primitives` |
| `app/settings/branding/page.tsx` | 18 | Imports primitives from `workday-v2/primitives` |
| `app/settings/page.tsx` | 13 | Imports primitives from `workday-v2/primitives` |
| `app/settings/organisation/page.tsx` | 22 | Imports primitives from `workday-v2/primitives` |
| `app/settings/role-packs/page.tsx` | 31 | Imports primitives from `workday-v2/primitives` |

### In `src/components/workday-v3/`

No file in `src/components/workday-v3/` applies `className="workday-v2"` directly.

| File | Line | Usage |
|---|---|---|
| `WorkdayPartnerDock.tsx` | 36 | Imports `PartnerClient` from `@/components/workday-v2/PartnerClient` |
| `WorkdayPartnerDock.tsx` | 41 | Imports from `@/components/workday-v2/ShellContext` |

The dock mounts a V2 component inside the V3 frame. The V3 tokens file at `src/styles/workday-v3-tokens.css` (the `--app-*` bridge block) maps V2's `--app-*` token vocabulary onto V3 values to make this composition work.

---

## 8. Dark routes reachable from V3.1 navigation

The two foot-rail links both lead outside the V3.1 light scope.

### `/trust` (Trust link)

File: `app/trust/page.tsx`
Imports `ReportShell` from `@/components/shell/ReportShell`. `ReportShell` is not part of the V3 component set; it uses the presentation/V2 visual style (dark shell, graphite palette). Navigating from the V3 light workday to Trust produces a complete visual register change.

### `/settings/organisation` (Settings link)

File: `app/settings/layout.tsx` line 47
```tsx
<div
  className="workday-v2"
  style={{ gridTemplateRows: "var(--app-topbar-h) minmax(0, 1fr)" }}
>
```
The entire settings shell is scoped under `.workday-v2` explicitly. All settings sub-pages import primitives from `@/components/workday-v2/primitives`. The shell is the graphite dark theme.

### Control Room (not linked from WorkdayNavigation)

File: `app/control-room/page.tsx`
Uses `ReportShell` (same as Trust). Accessible only from the root `app/page.tsx` footer link at `/control-room`.

---

## 9. `src/components/workday-v3/SectionStub.tsx`  --  token usage

Full token inventory (all references in the file):

| Token | Lines | Declared in tokens.css |
|---|---|---|
| `var(--wd-6)` | 25, 38 | Yes  --  `--wd-6: 24px` |
| `var(--wd-2)` | 29 | Yes  --  `--wd-2: 8px` |
| `var(--wd-text-sm)` | 30, 39 | Yes  --  `--wd-text-sm: 13px` |
| `var(--wd-text-secondary)` | 31 | Yes  --  `--wd-text-secondary: #475467` |
| `var(--wd-text-muted)` | 40, 50 | Yes  --  `--wd-text-muted: #7b8494` |
| `var(--wd-8)` | 48 | Yes  --  `--wd-8: 32px` |

CSS class used: `wd-page-title` (line 27). This is declared in `src/styles/workday-v3.css` at lines 483–490.

**No undefined token usage in `SectionStub.tsx`.** All six `var(--wd-*)` references resolve to tokens declared in `workday-v3-tokens.css`.

---

## 10. Release model (`src/product/release/role-release.ts`)

Six roles defined. Two `flagship`, four `preview`. No `hidden` entries currently.

| roleId | status | releaseLabel |
|---|---|---|
| `rcsa` | flagship | Operational Risk Partner |
| `tprm` | flagship | Third-Party Risk Manager |
| `control-assurance` | preview | Control Assurance Specialist |
| `incident-resilience` | preview | Incident and Resilience Lead |
| `regulatory-change` | preview | Regulatory Change Manager |
| `nfr-governance` | preview | NFR Portfolio Lead |

The `getRoleRelease(roleId)` function returns `undefined` for any ID not in this list. `app/workday/[role]/v3.tsx` treats `undefined` as non-flagship and falls through to the full workday render  --  this means an unknown role that passes the `ROLE_IDS` check in the layout would see `RoleHome` rather than `PreviewRolePage`. This is a latent edge case, not a current defect (all six ROLE_IDS are covered by the release definitions).

---

## Summary of open items

| Item | Location | Severity |
|---|---|---|
| Assistant route has no navigation entry | `WorkdayNavigation.tsx` PRIMARY and SECONDARY arrays | Medium  --  route is registered and indexed but unreachable without direct URL |
| Trust and Settings destinations are V2 dark | Foot rail links in `WorkdayNavigation.tsx` | Cosmetic  --  deliberate but unresolved theme discontinuity |
| `--wd-text-tertiary`  --  not declared, not referenced | N/A | None  --  token does not exist and is not needed |
| Four preview roles show `PreviewRolePage` in V3 frame | `app/workday/[role]/v3.tsx:57-59` | By design  --  V3.2 release intentionally restricts full experience to rcsa and tprm |
| `app/page.tsx` right column does not list roles | `app/page.tsx` | By design  --  V3.2 change; roles now available at `/workday` via RoleSelector |
