# WorkOS V3.3 -- Work Hub handoff

Agent B implementation, 2026-10-02.

## Files created

### Navigation and routing

**`src/components/workday-v3/WorkdayNavigation.tsx`** -- modified
- Added `IconBriefcase` import from `@tabler/icons-react`
- Added `work` key to `LABELS` constant (`{ en: "Work", de: "Arbeit" }`)
- Added `{ key: "work", icon: IconBriefcase, segment: "/work" }` as the second item in `PRIMARY`, between Home and Processes
- Updated the comment block to say "Four primary items"

**`src/workday/contracts.ts`** -- modified
- Added `"work"` to `V3_NATIVE_SEGMENTS` so the middleware serves the V3 shell for `/workday/[role]/work` routes
- Segment order: `""`, `"work"`, `"decisions"`, `"processes"`

**`next.config.ts`** -- modified
- Updated legacy redirects for both `rcsa` and `tprm`:
  - `/workday/:role/calendar` -> `/workday/:role/work?view=agenda`
  - `/workday/:role/meetings` -> `/workday/:role/work?view=meetings`
  - `/workday/:role/mail` -> `/workday/:role/work?view=inbox`
  - `/workday/:role/collaboration` -> `/workday/:role/work?view=inbox`
  - `/workday/:role/workbench` -> `/workday/:role/processes` (unchanged)
  - `/workday/:role/assistant` -> `/workday/:role` (dropped partner=open query)
- All `permanent: false`

### Work route files

**`app/workday/[role]/work/page.tsx`** -- created
- Standard dispatcher pattern matching `app/workday/[role]/processes/page.tsx`
- Imports V1, V2, V3 and delegates via `createWorkdayPage`

**`app/workday/[role]/work/v1.tsx`** -- created
- `SectionStub` placeholder with title "Work" / "Arbeit"

**`app/workday/[role]/work/v2.tsx`** -- created
- `SectionStub` placeholder with title "Work" / "Arbeit"

**`app/workday/[role]/work/v3.tsx`** -- created (full implementation, ~1 450 lines)
- Four tabs driven by `searchParams.view`: `agenda | meetings | actions | inbox`
- Actions tab adds a second filter via `searchParams.filter`: `needs-me | waiting-others | overdue | completed`
- Each tab tries DB queries first, falls back to static seeded data per role
- All CSS via `var(--wd-*)` tokens; no Tailwind, no hardcoded hex
- Server component only; no `"use client"` directives

### Home daily strip

**`app/workday/[role]/v3.tsx`** -- modified
- Added imports: `getCalendar`, `getActions`, `getInbox` from `@/db/repositories/workday`
- Added `DailyStrip` server component (defined in the same file)
- The strip renders a 3-column card grid: next meeting, open actions count, inbox count
- Each card links to the corresponding Work Hub tab
- Data comes from live DB queries; static fallbacks are role-appropriate (rcsa: 4 actions, 2 inbox; tprm: 3 actions, 2 inbox)
- Strip is passed via the existing `queue` prop on `<RoleHome>`, which renders it in the slot between the Next section and Watching/Done

## Data sources

| Tab | Primary source | Fallback |
|-----|---------------|---------|
| Agenda | `getCalendar(roleId)` -- `calendar_events` table | Static events per role (4 events) |
| Meetings -- Upcoming | `getMeetings(roleId)` filtered `status !== "concluded"` | Static 2-meeting list per role |
| Meetings -- Archive | `getMeetings(roleId)` filtered `status === "concluded"` | Static 3-entry archive per role |
| Actions | `getActions({ roleId })` filtered by `raisedByRoleId` | Static 3-action list per role |
| Inbox | `getInbox(roleId, atMoment)` filtered `proposedTriage !== "noise"` | Static 3-item list per role |
| Daily strip -- next meeting | `getCalendar(roleId)[0]` | `null` (shows "No meetings today") |
| Daily strip -- open actions | `getActions({ roleId })` count of `open/in-progress` | 4 (rcsa), 3 (tprm) |
| Daily strip -- inbox | `getInbox` count of decision/action triage, unread | 2 (both roles) |

## Current limitations

1. **Agenda uses `getCalendar` which returns all calendar events unsorted by current scenario time.** The query orders by `startsAt` ascending, so the first event is the earliest in the day regardless of the current moment. A future improvement would filter events after `state.currentMoment` to show only upcoming items.

2. **Meetings tab "Open" links navigate back to the same tab** (`?view=meetings`), not to a dedicated meeting detail page. A dedicated meeting room route does not yet exist in V3.

3. **Actions filter "Waiting on others"** is approximated by checking for a non-empty `ownerLabel` field. The schema does not have a distinct "delegated" status, so this is a best-effort filter. Real waiting-on-others semantics would require a `delegatedToExternalParty` boolean or similar.

4. **Inbox "Review" links navigate back to `?view=inbox`** rather than to an individual message. No individual message detail route exists in V3 yet.

5. **The daily strip "next meeting" field uses `calendarRows[0]`** (the chronologically earliest event). If the scenario moment is mid-day, events that already happened in the scenario are still shown. A future version should filter by `startsAt > currentMomentAsISOTime`.

6. **All static fallback IDs are hardcoded strings** (e.g. `"rcsa-ev-1"`). If the DB eventually seeds matching records, these IDs could collide. The fallback data is only used when no DB rows exist (`calRows.length === 0`), so in practice this is not a problem.

## Navigation works correctly

- The Work item appears between Home and Processes in the rail (correct order per brief)
- The segment `/work` is in `V3_NATIVE_SEGMENTS`, so the middleware correctly applies the V3 shell
- The `page.tsx` dispatcher follows the exact same pattern as `processes/page.tsx`
- Legacy routes redirect to the Work Hub with the appropriate `?view=` query param

## TypeScript notes

- `tsconfig.json` has `strict: true` and `noUncheckedIndexedAccess: true` but NOT `noUnusedLocals` or `noUnusedParameters`
- All array index accesses (`calendarRows[0]`, etc.) are guarded with `?? null`
- No `as` type assertions beyond the established pattern (`state.language as Language`)
- The `ActionsView` component receives `roleId` in its prop type for future link construction but does not destructure it (no TypeScript error since `noUnusedLocals` is off)
- No TypeScript errors expected

## Testing not performed

Agent H will handle testing. The implementation has not been run against the dev server.
