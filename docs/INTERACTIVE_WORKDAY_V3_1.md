# Interactive Workday V3.1

Written for: a product or engineering reader deciding whether V3.1 is ready to
become the default, and what it would cost to finish.

Calm, light, role native. V3.1 supersedes V2 on visual density, the light
against dark default, permanent rails, text volume, card usage, default AI
visibility, timeline prominence and page hierarchy. It does NOT supersede the
domain model, the scenario, the authority gate, the approval model, the audit
trail, the productisation architecture, the integration runtime, the connector
model, the white label configuration, the function packs, the live, safe and
offline modes, or the presentation route. All of those are shared, unchanged,
with V2.

Everything below is measured against the running application rather than
asserted. Where V3.1 is worse than the current interface, it says so.

## How to see it

Three interfaces are served from the same routes, reading the same database,
the same scenario run and the same authority gate.

| URL | Renders |
|---|---|
| `/workday/rcsa?ui=v3.1` | V3.1, light |
| `/workday/rcsa?ui=current` | V2, graphite. `current` is an alias, so the word keeps meaning the default as the default moves |
| `/workday/rcsa?ui=v1` | the legacy shell |

The choice is remembered in a cookie for 30 days, so links inside the product
stay on the chosen version. `NFR_WORKDAY_UI` pins a version for a deployment.

The default is still `v2`. See `Readiness` at the end for the reason.

## The mental model: Now, Next, Done

One structure for all six roles, with each role's own objects inside it. A
person who learns one role's home can read any of them.

- **Now.** One item, and it is the only element on the screen with the
  strongest visual treatment. It leads with the SUBJECT, names the action on
  its primary button, and carries one sentence saying why it needs a person.
- **Next.** At most three rows, each readable without opening it.
- **Watching** and **Done.** Both collapsed, side by side on one row, visible
  without scrolling.

### The information budget, measured

At 1366x768 the whole model fits above the fold on every role. The numbers are
the rendered heights of each block in the main region, which has 680px of
visible space once the 48px header and the 40px updates bar are taken out.

| Role | Content height | `Next` rows in fold | `Done` visible |
|---|---|---|---|
| rcsa | 649 | 3 of 3 | yes |
| tprm | 640 | 3 of 3 | yes |
| control-assurance | 640 | 3 of 3 | yes |
| incident-resilience | 640 | 3 of 3 | yes |
| regulatory-change | 675 | 3 of 3 | yes |
| nfr-governance | 649 | 3 of 3 | yes |

Getting there took three rounds of measurement, and the record is useful
because the first two looked finished:

1. First pass, every role overflowed by 171px to 210px. Three roles lost the
   third `Next` row and all six lost `Done` entirely.
2. The section rhythm went from 24px to 16px (40px), the AI block went from a
   141px three line panel to a 68px two line one (77px), queue rows went from
   56px to 48px (30px), and the active card lost 15px of padding. All six then
   showed 3 of 3 `Next` rows.
3. `Done` was still at a top edge of 728px: inside the viewport, but behind
   the updates bar. `Watching` and `Done` now share one row, which costs 29px
   instead of 74px. `Watching` is not in the brief's budget at all, so giving
   it a stacked section of its own was buying it with `Done`'s space.

### Against the current interface

Means across the six roles at 1366x768, first viewport, main region only.

| Measure | current | v3.1 | |
|---|---|---|---|
| Visible words | 167.2 | 137.8 | 17.6% fewer |
| Coloured chips and badges | 8.0 | 1.0 | 87.5% fewer |
| Interactive elements | 42 | 25 | 40.5% fewer |
| Canvas | `rgb(11,13,16)` | `rgb(245,246,248)` | |
| Role home document | 372,294 bytes | 61,789 bytes | 83.4% smaller |
| Visible divider lines | 5.0 | 14.0 | **180% MORE** |

The divider count is the one measure where V3.1 is worse, and it is a real
cost of the approach rather than an oversight: V2 separates things with filled
cards and chips, V3.1 separates them with rules. 14 rules is more lines of ink
than 5 cards, even though it is less visual noise by every other measure. It
is recorded here rather than explained away.

## Role native, in practice

The structure is fixed. The vocabulary is not.

The active item's lead-in is the SUBJECT of the decision and its identifier,
read from `decisions.related_object_kind` and `related_object_id`. Rendered,
that gives a control tester `Test case OVR-DE-20260714-0112`, a resilience
lead `Impact tolerance ITOL-0004-03`, a third party manager `Supplier
TP-0042`, an operational risk partner `Indicator KRI-PAY-007`, and a
regulatory change manager `Subprocessor TP-0042.4`.

This took three attempts and the sequence is worth keeping, because each fix
was a smaller version of the same mistake:

1. The lead-in was `humanAction`. That field is an action CLASS shared by
   every item of its kind, so the card read `Record the decision` directly
   above a primary button reading `Record the decision`, and all three `Next`
   rows read it too. Four different judgments looked like one thing repeated
   five times.
2. The lead-in became `objectType`. For a decision that string is always
   `decision`, so all six professions were shown the word `Decision` and told
   nothing.
3. The lead-in became the related object. The database had held it all along,
   and the queue was already reading it to suppress an item from `Watching`
   when the user is being asked to decide about the same subject, then
   discarding it before it reached the interface.

`docs/ROLE_WORKFLOWS.md` carries the full per-role design: the native objects
with their tables and columns, the queue column names in English and German,
what a decision means for each profession, and what does not belong on each
home page.

## The visual system

`src/styles/workday-v3-tokens.css` and `workday-v3.css`, scoped to
`.workday-v3`. CSS custom properties only, no Tailwind, no component
framework.

- IBM Plex Sans, self hosted, Latin1 subsets at 400, 500 and 600, plus Plex
  Mono 400. 82KB total, SIL OFL 1.1, recorded in `THIRD_PARTY_NOTICES.md`.
- Light by default. The theme is read server side from a cookie, so the first
  response already carries the right one: reading it after mount would paint
  light and repaint dark on every navigation.
- The type ceiling is 20px, and 20px is reserved for the active work item.

### The type hierarchy was inverted, and the fix is worth stating

The page title was 20px semibold and the active work item was 18px, so the
strongest element on the screen was a STATIC LABEL and the one thing that
needed a person was second. Worse, the title said what the header already
said: a breadcrumb reading `Operational risk / Arcadia Bank AG` sat directly
under a header reading `Operational Risk Partner` and `Arcadia Bank AG`
verbatim, so a first week analyst was given the entity twice and their own job
title twice before reaching anything actionable.

The breadcrumb is gone, the page title is `Today` at 16px, and the work item
is 20px. There is one largest thing and it is the work.

### The token bridge

The device that makes the reuse real, and the reason V3.1 is a presentation
layer rather than a second product.

Reused components are written against the `--app-*` and presentation token
vocabularies. Rather than rewriting them, those names are remapped to V3
values inside the `.workday-v3` scope only. The whole AI Partner dock, with
its streaming, its citation handling and its rule that `Approve` navigates to
the decision flow instead of executing in place, renders correctly in the
light theme without a line changed inside it.

Two things about this were learned the hard way and are recorded in the CSS:

- **Remapping a custom property is not enough on its own.** `--font-body` is
  remapped to Plex inside the scope, but `body` in `globals.css` resolved
  `var(--font-body)` AT THE BODY, where it is still Inter, and a descendant
  declaring no family of its own inherits the resolved value rather than
  re-resolving the variable. The scope has to declare `font-family` itself.
- **The base belongs on the scope, not the frame.** It was on `.wd-frame`, and
  the overlay panels are siblings of the frame rather than children, because
  an overlay inside an `overflow: hidden` grid row cannot escape it. Measured
  inside the open dock before the fix: text at `rgb(212,216,226)`, the dark
  theme's light grey, on a white panel, in Inter.
- **Shadows are not bridged through.** The V2 shadows are black at 40 to 56
  percent, which is correct on graphite and a smear on a light canvas.

## The AI Partner

Collapsed by default. The header carries one trigger, labelled with its
pending count, and that is the whole of the AI presence on the default screen
apart from one inline line on the active item.

It is the SAME dock V2 uses. It already had exactly the three tabs the brief
asks for, suggestions, activity and chat, and it opens on **chat**, because
someone opening the partner to ask a question should land in the
conversation.

Three things are V3.1 specific:

- **The data arrives on open, not on page load.** `GET /api/workday/partner`
  serves what `buildPartnerData` reads, which is the same function the V2
  server slot calls. This is most of the difference between a 61KB role home
  and a 372KB one. The endpoint is read only; every action still goes through
  the existing server actions and the authority gate.
- **The shell context is bridged, not re-provided.** The dock reads the V2
  shell context for one thing that matters outside itself: opening a citation
  in the host's context drawer. With no provider `useShell` returns an inert
  shape, so a cited source would compile and silently do nothing. The bridge
  forwards `openDrawer` into the V3 chrome and maps V2's six drawer tabs onto
  V3's four.
- **The posture table is gone from the dock.** The autonomy level and the AI
  mode are moved to Trust, which is the page whose job is to answer what the
  system is allowed to do. Verified present there: all six authority classes
  and the autonomy levels. It is a `showPosture` flag defaulting to true, so
  V2 is untouched.

Two bugs found by opening it and looking, both recorded in the component:

- `reactStrictMode` invokes an effect twice and runs the cleanup in between. A
  `useRef` guard that recorded having STARTED the fetch meant the first pass
  started it, the cleanup aborted it, and the second pass saw the ref set and
  returned. The dock sat on `Opening the partner` forever against a route
  handler answering correctly in 425ms. The guard is now the payload itself.
- Returning `null` when no panel is open unmounted the dock on every close,
  discarding the conversation and the event subscription. It now renders
  nothing until first opened and hides itself after that, so a reader who
  never asks for it still pays nothing.

## Correctness findings that were not cosmetic

Three defects found during this work changed meaning rather than appearance.

**A regulatory assertion rendered with its disclosure stripped.** Truncating
the active item's reason to one sentence removed a trailing
`Illustrative regulatory context, not legal advice.` from the seeded text,
leaving the regulatory claim on display with nothing limiting it. Verified in
the delivered HTML at the time: `current` carried the note once on the
regulatory change role, `v3.1` carried it zero times. Qualifiers are now split
off upstream and rendered as their own line, so they cannot be lost to a
character count. The brief requires every regulatory reference to carry the
note.

**A date was mistaken for a sentence end.** The truncation helpers searched
for `[.,;:]` without checking it was a boundary, so the `tprm` AI line read
`Read the disaster recovery test report of 22`, cutting inside `22.05.2026`.
A boundary is now punctuation followed by whitespace or the end of the string,
which covers dates, identifiers such as `CTR-2023-0117-A3` and decimal figures
without naming any of them as special cases.

**The navigation rail linked to a route that has never existed.** `My work`
pointed at `/workday/<role>/my-work` and carried a live count badge, so the
most prominent unvisited item in the rail was a 404 on all six roles. It
accounted for all 12 header failures in a 120 load audit. The rail now has
four primary items and all six of its destinations return 200. Four rather
than the brief's five, because a rail that lies about where it can take you is
worse than a short rail.

The rail's expand control was also inert: the width and label visibility are
keyed on `data-nav` on `.wd-body`, and nothing was setting that attribute, so
clicking expand changed the chevron and nothing else. The rail is now expanded
by DEFAULT, which is a deliberate reversal: seven unlabelled glyphs ask the
reader to already know what the product calls things, which is exactly the
training the default screen must not require.

## Readiness

**V3.1 should not be the default yet.**

The role home is the better screen by almost every measure, and the two
non-negotiable requirements now hold on it. But it is **one route of eight**.
Only the role home and the decisions route have a V3 implementation; the
remaining six fall back to V2 by design, which is honest but means most of the
surface is unchanged.

What the criterion for flipping the default should be:

1. V3 implementations for `workbench`, `meetings` and `assistant`, which are
   where an analyst spends the rest of the day.
2. The copy deletion pass in `docs/COPY_REDUCTION.md` applied. It proposes a
   30 percent reduction, 1,014 visible words to 707 across the six screens,
   and three of its findings are correctness issues rather than style.
3. A manual screenshot review across all three widths, which the brief makes a
   precondition and which no test replaces. Looking at rendered screens found
   five defects in this work that no measurement caught.

`V3_NATIVE_SEGMENTS` in `src/workday/contracts.ts` is the switch. Add a
segment there in the same change that adds its `v3.tsx`, or the new page will
be unreachable.

## Verification run

- `npx tsc --noEmit` clean across the repository.
- 698 tests passing in 19 files, unit and integration.
- The copy gate reports zero em dash and zero umlaut characters in authored
  display copy. All German uses the ASCII transliterations `ae oe ue ss`.
- `Synthetic institution and data` renders on all six role homes.
- No fabricated client savings anywhere, and no string asserting that DORA
  applies directly to the Swiss entity. DORA and EBA guidance are scoped to
  the German and Austrian EU entities; FINMA to the Swiss entity.
