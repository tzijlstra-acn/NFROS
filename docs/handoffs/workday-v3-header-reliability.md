# The workday header: why it failed, and what now holds it up

Written for: an engineer who has to maintain or extend the V3.1 workday frame.

The brief named this non-negotiable: the header must render on every route,
every refresh, every screen size and every loading state. This records what
was actually wrong, because the symptom and the cause looked unrelated, and
because two separate defects produced the same complaint.

## Defect one: the header was inside the thing it was waiting for

### Symptom

The header failed to appear during normal use. Intermittently, and more often
on a cold route.

### What it was not

It was not hydration. There was no mismatch warning, and the header was
missing from the delivered HTML, not just from the hydrated tree.

### Cause

There was no `layout.tsx`, no `loading.tsx` and no `error.tsx` under
`app/workday/[role]/`. The header was built inside the page's own server
component, so the document's first byte waited for everything the page
needed, and a failure anywhere in the page took the header with it.

Measured on this machine, the header needs 312ms of data and was waiting
1,224ms. 913ms of that, 75 percent, was structural:

| Builder | Cost |
|---|---|
| `buildRoleWorkspace` | 382ms |
| `buildNowDetail` | 170ms |
| `buildIntelligenceRail` | 134ms |
| `buildFocusQueueView` | 125ms |
| `buildCommandIndex` | 68ms |

### Fix

A route layout is the only thing in the App Router that is rendered once, kept
across navigation between its child routes, and streamed independently of
them. Four files:

- `app/workday/[role]/layout.tsx` renders the frame. The header is no longer
  in the page's subtree.
- `app/workday/[role]/loading.tsx` replaces the MAIN REGION only, so the
  header stays on screen while the page loads.
- `app/workday/[role]/error.tsx` keeps the header, the rail and the bottom bar
  when the page throws, and offers a retry.
- `src/db/repositories/header.ts` builds the header model from a handful of
  lookups and two counts. It never throws: every query is wrapped, and a role
  that does not resolve yields a degraded header rather than an error. It
  cannot reach evidence retrieval, a connector, an AI call or a workspace
  view, because it does not import them.

After the fix the header leads the content by 60ms to 123ms, and the V3.1 role
home is a 61KB document against V2's 372KB.

### Two things that are easy to get wrong here

`loading.tsx` is styled with inline translucent greys rather than the V3
tokens. That is deliberate. A loading file is chosen by the router and cannot
know which interface version was requested, so this boundary wraps the page
segment for EVERY version. A skeleton built from `--wd-surface-hover` resolves
to nothing inside the V1 and V2 shells, which do not carry the `.workday-v3`
scope, and a light fill flashes white against their dark chrome. A translucent
grey sits correctly on any background.

There is exactly ONE `WorkdayChromeProvider`, wrapping everything. Two would
give the header and the body separate state, so the AI trigger in the header
could not open the dock in the body. That reads like a wiring mistake and is
actually a tree mistake.

## Defect two: the layout and the page disagreed about the version

This was the worse of the two, and it was invisible to anyone testing with
`?ui=v3.1` in the address bar.

### Symptom

Load any workday route once with `?ui=v3.1`, then navigate with no query
string, as a bookmark or an in-application link does. The document came back
with **four `header` elements and two `main` elements**, and the V2 dark
interface painted over the V3 one. Reproduced on 18 of 18 role home loads with
the preference cookie set, and 0 of 18 without it.

### Cause

A layout does not receive `searchParams`, by design: it is not re-rendered
when only the query changes. So `middleware.ts` resolves `?ui=` and passes the
answer down as a REQUEST header, which the layout reads in the same request.

The layout read that header. The page dispatcher, `src/workday/dispatch.tsx`,
called `resolveUiVersion(query)`, which reads the query string only. With the
preference in the cookie and nothing in the query, the layout resolved V3.1
and built the V3 frame, while the page resolved the default and rendered the
complete V2 shell inside it.

`resolveUiVersionFrom` in `src/workday/ui-version.ts` had been written for
exactly this and had **zero callers**. Its own comment described the symptom
before it happened.

### Fix

`dispatch.tsx` now reads the same request header the layout reads, falling
back to the query so a test can render a page without the middleware.

## Defect three: a V3 frame around a V2 page on un-migrated routes

Related, and found by the same audit.

The migration is per route. Only the role home has a `v3.tsx`, so every other
route fell back to V2 by design. But the layout applied the V3 frame whenever
the VERSION resolved to V3.1, without regard to whether the route could
honour it. Measured on `/workday/rcsa/decisions`: three `header` elements, two
`main` elements, and both `.workday-v2` and `.workday-v3` in one document.

### Fix

`V3_NATIVE_SEGMENTS` in `src/workday/contracts.ts` declares which route
segments have a V3.1 implementation. `middleware.ts` downgrades the resolved
version to `v2` for a route that is not on the list, so the layout and the
page receive the same answer and cannot disagree. One frame, one header, and
the fallback is an honest V2 page rather than a hybrid.

The response cookie still records what the reviewer ASKED for, not the
downgrade. Otherwise visiting one un-migrated route would silently and
permanently downgrade someone who had chosen V3.1.

**When you add a `v3.tsx` for a route, add its segment to
`V3_NATIVE_SEGMENTS` in the same change.** The two cannot drift if they move
together, and forgetting it means your new V3 page is unreachable.

## Verification

Reproduced against the development server after the fixes:

| Case | Before | After |
|---|---|---|
| `?ui=v3.1` role home | 1 header, 1 main | 1 header, 1 main, 61KB |
| No query, v3.1 cookie | 4 headers, 2 mains, V2 painted over | 1 header, 1 main, V3 only |
| Fallback route, v3.1 cookie | V3 frame plus V2 shell | V2 only, no hybrid |
| Rail destinations | one 404 with a count badge | six destinations, all 200 |

An earlier audit of 120 loads, six role homes plus seven segments for two
roles, at three widths, with and without the cookie, found 108 of 120 carried
a non-empty 48px `header.wd-header`. All 12 failures were a single cause:
the rail linked to `/workday/<role>/my-work`, which has never existed. That
item has been removed. Two of twelve `/decisions` loads were captured
mid-stream with the header painted and the main region still showing the
skeleton, which is direct evidence that the streaming fix works.

## What is still open

- `/workday/<role>/workbench` and `/decisions` render two and three `header`
  elements respectively. These are V2-internal and pre-date this work; the
  V3 hybrid is gone from both. Worth fixing as an accessibility matter, not as
  a V3.1 regression.
- The framework 404 was unstyled white with body text at `--text-1`, which is
  near white because the root carries a dark theme, measuring 1.07:1. There is
  now an `app/not-found.tsx` that states its own colours rather than
  inheriting any, and carries a `main` landmark.
