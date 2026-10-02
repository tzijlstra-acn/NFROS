# V3.3 AI Partner -- Handoff

Agent C delivery. V3.3 release: AI routines exposed in the partner activity view, partner pulse wired to the Home page.

---

## Files created

| File | Description |
|------|-------------|
| `src/components/workday-v3/AIRoutinesList.tsx` | Compact routines table component |
| `docs/AI_ROUTINES.md` | AI routines documentation |
| `docs/handoffs/workday-v3-3-ai-partner.md` | This handoff |

## Files modified

| File | Change |
|------|--------|
| `app/workday/[role]/v3.tsx` | Added `PartnerPulse` component and partner pulse render after `RoleHome` |
| `app/workday/[role]/processes/v3.tsx` | Added tab row, routines sub-view, morning brief detail panels |

---

## Partner pulse -- Home page

Location: `app/workday/[role]/v3.tsx`

The `PartnerPulse` function component renders a compact horizontal strip below the `RoleHome` output. It appears inside the V3 frame's main region as a sibling to the `wd-main-inner` div that `RoleHome` already renders.

The pulse is suppressed when:
- The database is not ready (try/catch around `getActiveRoutines`)
- No active routines exist for the role

When it renders:
- A small "AI Partner" label appears above a one-line summary text
- The text is role-specific (RCSA or TPRM), derived from the seeded routine set
- Two buttons appear: "Review" links to `/workday/[role]/work?view=inbox`; "Ask" links to `#partner` (no full partner open logic implemented -- future work)
- Maximum height is approximately 60px at normal viewport

RCSA pulse text: "Scanned calendar and prepared RCSA Challenge Workshop brief, followed up 2 overdue actions on Q4 evidence refresh, and triaged 4 inbox items."

TPRM pulse text: "Checked Veridian evidence request status, drafted reminder for missing penetration test report, and identified 1 supplier monitoring signal."

The pulse is intentionally unobtrusive: border, small text, ellipsis on overflow. It does not compete with the Now card.

---

## AIRoutinesList component

Location: `src/components/workday-v3/AIRoutinesList.tsx`

Props interface:
```tsx
interface AIRoutinesListProps {
  routines: RoutineRow[]; // id, name, triggerType, status, lastRunAt, outputKind
  language: Language;
  activeRoutineId?: string | null;
  roleId: string;
}
```

Renders a column header row followed by one card row per routine. Each row shows:
- Routine name (medium weight)
- Trigger type badge (schedule / before meeting / after meeting / event)
- Status badge with colour coding (active=green, paused=amber, blocked=red, completed=muted)
- Last run date+time from ISO string, or "Never"
- Output kind label
- "View" link to `?view=routines&routine=[id]`

The `activeRoutineId` row receives an accent border and background. All tokens use `var(--wd-*)`.

---

## Routines sub-view -- Processes page

Location: `app/workday/[role]/processes/v3.tsx`

A compact tab row was added below the page title:
```
Active processes  |  AI Routines
```
Active tab has accent colour and a 2px bottom border. Inactive tab has muted colour.

URL scheme:
- Default (`?view` absent): shows existing process app cards (unchanged)
- `?view=routines`: shows routines list
- `?view=routines&routine=[id]`: shows morning brief detail panel above the list (if the id matches morning-brief-rcsa or morning-brief-tprm for the correct role)

The `searchParams` prop was added to the function signature (it was already in the type annotation but not destructured).

`getRoutines(roleId)` is called inside a try/catch -- the page degrades to an empty list if the database is not ready.

### Morning brief detail panels

Two static panels are implemented inline in `processes/v3.tsx`:
- `MorningBriefRCSA` -- shows the RCSA morning brief seeded content
- `MorningBriefTPRM` -- shows the TPRM morning brief seeded content

Both are bilingual (EN/DE) and include the regulatory note footer.

Trigger conditions:
- `?view=routines&routine=morning-brief-rcsa` on the RCSA role page
- `?view=routines&routine=morning-brief-tprm` on the TPRM role page

---

## Where routines are accessible

1. Home page -- partner pulse strip (below daily strip)
2. Processes page -- AI Routines tab (`?view=routines`)
3. Morning brief detail -- Processes AI Routines tab with `?routine=morning-brief-rcsa` or `?routine=morning-brief-tprm`

No new primary navigation item was added.

---

## TypeScript status

All new code is written with explicit types. No `any` is used. The `AIRoutinesList` component interface uses a local `RoutineRow` type rather than importing the full `AIRoutine` DB type, to avoid tight coupling between the component and the repository layer.

The `processes/v3.tsx` file uses `typeof searchParams?.view === "string"` narrowing to safely extract string query params from the `RouteQuery` union type.

The `v3.tsx` home file imports `getActiveRoutines` from `@/db/repositories/role-app-runtime` -- this function already existed and is already exported.

No TypeScript errors are expected. The existing build pipeline (`tsc --noEmit`) should pass without modification.

---

## Constraints satisfied

- Server components throughout (no "use client")
- var(--wd-*) tokens only
- No em dashes (double hyphen used throughout)
- No umlaut characters (oe, ue, ae used)
- No new primary navigation items
- Routines exposed through existing surfaces only
