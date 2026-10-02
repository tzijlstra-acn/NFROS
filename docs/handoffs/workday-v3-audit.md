# Workday V3.1 audit: `?ui=current` against `?ui=v3.1`

Auditor: Agent A, current-state auditor. Role: observation only, no source changed.
Date: 2026-10-01. Server: `http://localhost:3000`, dev mode, `force-dynamic` routes.
Playwright 1.63.0, Chromium. Measurement viewport for all numbers: 1366x768.

Scope note on versions: `?ui=current` is an alias that resolves to `v2`
(`src/workday/contracts.ts:49`). `DEFAULT_WORKDAY_UI` is also `v2`
(`src/workday/contracts.ts:40`). That default matters for defect D1 below.

Nothing in this document is a compliance statement. Where regulation is named:
DORA and EBA guidance apply to the German and Austrian EU entities, and FINMA
applies to the Swiss entity. No claim of compliance is made or implied.

---

## 1. Screenshot inventory

72 route captures plus one defect-evidence capture, all at `fullPage: false` so
the first viewport is what is shown.

| Directory | Files | Contents |
|---|---|---|
| `docs/screenshots/workday-current/` | 36 | 6 role homes x 3 widths (18), plus `decisions`, `my-work`, `workbench` for `rcsa` and `tprm` x 3 widths (18) |
| `docs/screenshots/workday-v3/` | 37 | the same 36, plus `rcsa-home-cookienav-1366.png` as the reproduction for D1 |

Widths captured: 1920x1080, 1440x900, 1366x768. Naming: `<role>-<segment>-<width>.png`,
with `home` as the segment name for the role landing route.

The 12 `my-work` captures (6 per directory) are captures of a 404. That is the
finding, not a capture failure. See D2 and D3.

---

## 2. Measurements, per role and per version, at 1366x768

Main region selector: `main.app-main` for `current`, `main.wd-main` for `v3.1`.
Counts are restricted to elements that are visible and that intersect the first
viewport. Heuristics are stated under the tables so the numbers can be rechecked.

### 2.1 `?ui=current` (v2)

| Role | Words in main | Border lines | Coloured chips | Largest font | Main region % of viewport | Canvas background | Interactive (total / distinct) |
|---|---|---|---|---|---|---|---|
| `rcsa` | 163 | 5 | 8 | 20px | 87.2% (670px) | `rgb(11, 13, 16)` | 42 / 42 |
| `tprm` | 170 | 5 | 9 | 20px | 87.2% (670px) | `rgb(11, 13, 16)` | 42 / 42 |
| `control-assurance` | 165 | 5 | 8 | 20px | 87.2% (670px) | `rgb(11, 13, 16)` | 42 / 42 |
| `incident-resilience` | 185 | 5 | 8 | 20px | 87.2% (670px) | `rgb(11, 13, 16)` | 42 / 42 |
| `regulatory-change` | 168 | 5 | 7 | 20px | 87.2% (670px) | `rgb(11, 13, 16)` | 42 / 42 |
| `nfr-governance` | 152 | 5 | 8 | 20px | 87.2% (670px) | `rgb(11, 13, 16)` | 42 / 42 |
| **mean** | **167.2** | **5.0** | **8.0** | **20px** | **87.2%** | dark graphite | **42 / 42** |

### 2.2 `?ui=v3.1`

| Role | Words in main | Border lines | Coloured chips | Largest font | Main region % of viewport | Canvas background | Interactive (total / distinct) |
|---|---|---|---|---|---|---|---|
| `rcsa` | 141 | 14 | 1 | 20px | 88.5% (680px) | `rgb(245, 246, 248)` | 25 / 24 |
| `tprm` | 128 | 14 | 1 | 20px | 88.5% (680px) | `rgb(245, 246, 248)` | 25 / 24 |
| `control-assurance` | 128 | 14 | 1 | 20px | 88.5% (680px) | `rgb(245, 246, 248)` | 25 / 24 |
| `incident-resilience` | 137 | 14 | 1 | 20px | 88.5% (680px) | `rgb(245, 246, 248)` | 25 / 24 |
| `regulatory-change` | 150 | 14 | 1 | 20px | 88.5% (680px) | `rgb(245, 246, 248)` | 25 / 24 |
| `nfr-governance` | 143 | 14 | 1 | 20px | 88.5% (680px) | `rgb(245, 246, 248)` | 25 / 24 |
| **mean** | **137.8** | **14.0** | **1.0** | **20px** | **88.5%** | light grey | **25 / 24** |

### 2.3 Deltas, v3.1 against current

| Measure | current | v3.1 | Delta | Reading |
|---|---|---|---|---|
| Words in main, first viewport | 167.2 | 137.8 | **-17.6%** | v3.1 better |
| Visible border or divider lines | 5.0 | 14.0 | **+180%** | v3.1 **worse** |
| Coloured chips or badges | 8.0 | 1.0 | **-87.5%** | v3.1 better |
| Largest font in first viewport | 20px | 20px | **0** | no change, see D7 |
| Main region share of viewport height | 87.2% | 88.5% | +1.3pp | no material change |
| Interactive elements, first viewport | 42 | 25 | **-40.5%** | v3.1 better |
| Distinct interactive elements | 42 | 24 | -42.9% | v3.1 better |
| Filled high-contrast elements in main | several | **exactly 1** | | v3.1 better, see section 5 |

Counting heuristics, so these can be reproduced:

- **Words**: text nodes inside the main region whose own range box has non-zero
  height and intersects `0..768`, whose parent is not `display:none`,
  `visibility:hidden` or `opacity < 0.05`. Split on whitespace.
- **Border lines**: counted per side. For each visible element intersecting the
  first viewport, each of the four sides counts once if width is at least
  `0.5px`, style is not `none` or `hidden`, and the colour alpha is above `0.03`.
  An `<hr>` counts as one. Scope is the main region, so chrome is excluded from
  both versions equally.
- **Chips**: visible leaf-ish element, height 13 to 34px, width at most 270px,
  text length 1 to 30 characters, border radius at least 3px, and either a
  background with alpha above `0.06` that differs from the canvas, or a visible
  ring. A wrapper whose text equals its child's text is skipped so a chip is not
  double counted.
- **Largest font**: maximum computed `font-size` over visible elements that own a
  direct text node of more than one character.
- **Main region share**: `(min(bottom, 768) - max(top, 0)) / 768`.
- **Canvas background**: first ancestor of the main region with background alpha
  above `0.5`.
- **Interactive**: `a[href]`, `button`, `input`, `select`, `textarea`, `summary`,
  `[role=button|link|tab|menuitem|checkbox|switch]`, and `[tabindex]` other than
  `-1`, visible and intersecting the first viewport. "Distinct" de-duplicates on
  tag plus `href` plus accessible text.

### 2.4 Served HTML document size

Measured with `curl`, bytes of the server-rendered document.

| Route | `?ui=v1` | `?ui=current` | `?ui=v3.1` | v3.1 against current |
|---|---|---|---|---|
| `/workday/rcsa` | 172,999 | 372,294 | **61,789** | **-83.4%** |
| `/workday/rcsa/decisions` | 234,854 | 325,636 | **341,257** | **+4.8%** |

The role home is the one route with a real V3 implementation and it is 83.4%
smaller. `decisions` is 4.8% **larger** under `?ui=v3.1` than under `?ui=current`,
because the fallback ships the V3.1 frame and the entire V2 page in one document.
That single pair of numbers is the clearest quantification of defect D4.

---

## 3. Fallback-route inventory

Checked by listing `v3.tsx` files under `app/workday/` and reading
`src/workday/dispatch.tsx:35-57`.

`v3.tsx` files that exist: exactly one, `app/workday/[role]/v3.tsx`.

The dispatcher takes V3 as an optional third argument
(`src/workday/dispatch.tsx:38`) and falls back when it is absent
(`src/workday/dispatch.tsx:54`, `if (version === "v3.1" && V3)`).

| Route | Dispatcher call | `v3.tsx` present | Under `?ui=v3.1` renders | Role combinations |
|---|---|---|---|---|
| `/workday/[role]` | `app/workday/[role]/page.tsx:21`, `createWorkdayPage(V1, V2, V3)` | yes | **V3.1** | 6 native |
| `/workday/[role]/decisions` | `app/workday/[role]/decisions/page.tsx:20`, `createWorkdayPage(V1, V2)` | no | V2 in a V3.1 frame | 6 fall back |
| `/workday/[role]/workbench` | `app/workday/[role]/workbench/page.tsx:20` | no | V2 in a V3.1 frame | 6 fall back |
| `/workday/[role]/meetings` | `app/workday/[role]/meetings/page.tsx:20` | no | V2 in a V3.1 frame | 6 fall back |
| `/workday/[role]/mail` | `app/workday/[role]/mail/page.tsx:20` | no | V2 in a V3.1 frame | 6 fall back |
| `/workday/[role]/calendar` | `app/workday/[role]/calendar/page.tsx:20` | no | V2 in a V3.1 frame | 6 fall back |
| `/workday/[role]/collaboration` | `app/workday/[role]/collaboration/page.tsx:20` | no | V2 in a V3.1 frame | 6 fall back |
| `/workday/[role]/assistant` | `app/workday/[role]/assistant/page.tsx:20` | no | V2 in a V3.1 frame | 6 fall back |
| `/workday/[role]/my-work` | **no route at all** | no | **404** | 6 broken |

Totals: **1 of 9 navigable routes has a V3.1 implementation.** 7 routes fall back,
which is **42 of 54 role and route combinations**. 1 route, `my-work`, does not
exist, which is a further 6 combinations. Native V3.1 coverage is 6 of 54, or
**11.1%**.

Roles are not a factor. All six roles behave identically on every route, so the
fallback is purely per route.

---

## 4. Header verification matrix

Procedure: 120 page loads. For each, assert that `header.wd-header` exists and
that its `innerText` is non-empty. Two cookie conditions:

- **no-cookie**: cookies cleared, then navigate to the URL carrying `?ui=v3.1`.
- **with-cookie**: visit `/workday/rcsa?ui=v3.1` once so middleware sets
  `nfr-workday-ui=v3.1` (`middleware.ts:68-75`), then navigate to the URL with
  **no query string**, which is what every in-app link does.

Coverage: all 6 role homes, plus all 7 segments for `rcsa` and `tprm`, at all
three widths, under both cookie conditions.

| Route | Loads | Header present and non-empty | HTTP | Two `<main>` landmarks |
|---|---|---|---|---|
| role home, 6 roles | 36 | **36 / 36** | 200 | 18 (all `with-cookie`, see D1) |
| `/decisions` | 12 | **12 / 12** | 200 | 10 |
| `/workbench` | 12 | **12 / 12** | 200 | 12 |
| `/meetings` | 12 | **12 / 12** | 200 | 12 |
| `/mail` | 12 | **12 / 12** | 200 | 12 |
| `/calendar` | 12 | **12 / 12** | 200 | 12 |
| `/collaboration` | 12 | **12 / 12** | 200 | 12 |
| `/my-work` | 12 | **0 / 12** | **404** | 0, there is no frame at all |
| **Total** | **120** | **108 / 120** | | **88** |

By condition: no-cookie 54 of 60, with-cookie 54 of 60. By width: 36 of 40 at
each of 1920, 1440 and 1366. The failures are identical in every cell: the 12
`my-work` loads, which return 404 and render zero `<header>` and zero `<main>`.

Where the header was found, it was 48px tall and carried 54 to 67 characters of
text in every single case, so "present" here also means "non-empty and laid out".

**Verdict on the brief's first non-negotiable requirement.** On every route that
returns 200, the header is present, non-empty and 48px tall, at all three widths,
in both cookie conditions. That holds for 108 of 108 successful loads, which is a
real pass. Two qualifications:

1. The header requirement **fails on `/my-work`**, the only route a reader can
   reach from the V3.1 navigation rail that has no page. The 404 bypasses the
   workday layout, so no header exists.
2. On 88 of 120 loads the header requirement is met **twice over**, because a
   second header from the V2 shell is also in the document and paints on top.
   The requirement is "renders reliably", and two headers is not a reliable
   render. See D1 and D4.

One incidental observation that supports the design: 2 of the 12 `/decisions`
loads were captured mid-stream, with `header.wd-header` already painted and the
main region still showing the `loading.tsx` skeleton. That is exactly the
behaviour `app/workday/[role]/layout.tsx:16-24` and `loading.tsx` were written to
produce, and it was observed working. Those are also the 2 of 12 `/decisions`
loads that show one `<main>` rather than two.

---

## 5. Five-second comprehension exercise

This is an analytical reading of the rendered first viewport. It is not a user
study and no claim is made about real analysts.

### 5.1 What is identifiable without scrolling, on all six v3.1 role homes

The structure is identical across the six roles, so it is described once. Only
the role name, the work item and the reason lines differ.

1. A breadcrumb, two items, 11 to 12px, for example `Operational risk / Arcadia Bank AG`.
2. The page title, which is the **role name**, H1 at 20px weight 600.
3. One context line of counts, for example `4 need your judgment, 4 prepared for review, 5 handled without you.`
4. One bordered card with a coloured left edge, containing: a 12px eyebrow naming
   the object kind (`Decision`), an H2 at 18px carrying the subject of the work,
   a reason paragraph at 15px, a relative timestamp (`4h ago`), one filled purple
   primary button (`Record the decision`), and one outlined secondary (`Evidence`).
5. A tinted strip labelled `AI prepared` with one line of what was prepared and a
   `Review preparation` link.
6. A `Next` section, H2 at 16px weight 500, with a `View all` link and three rows.
   Each row has a title, a distinct reason line, and a time on the right.
7. Two collapsed disclosures side by side at y 684 to 712: `Watching` with a count
   and `Handled automatically` with a count. Both are inside the viewport at all
   three widths, 16px clear of the updates bar at 1366x768.
8. A bottom bar: an updates count on the left, `Synthetic institution and data` on the right.

So a reader can identify, without scrolling: which role they are in, how much
needs them today, exactly one thing to do now with its reason and its button,
what is queued next with three distinguishable items, and that some work was
handled for them. That is a genuinely legible screen and it is a clear
improvement on the current version's 42 interactive elements and 8 chips.

### 5.2 The element with the strongest visual treatment

**Unambiguous, and it is the right element.** On all six role homes there is
**exactly one** filled element in the main region with a dark, high-contrast
background: the primary button `Record the decision`, `rgb(91, 79, 242)`,
184x36px, at y 324. Nothing else in the main region competes on fill.

Measured by fill, nothing competes. Measured by **type size**, two elements do
compete, and the competition is lost by the wrong one. See D7.

### 5.3 What a reader cannot identify

- Nothing on screen says the top card is **Now**. The word is absent from all
  six role homes.
- Nothing on screen says **Done**. The third section reads `Handled automatically`.
- The largest text on the page is the role title, which never changes and carries
  no information a reader who just clicked into their own workspace needs.

---

## 6. Ranked defect list

Severity order. Each entry has a reproduction and the file and line it concerns.
No fix has been applied to any of these.

### D1. Critical. Cookie-driven navigation renders V2 inside the V3.1 frame

**Reproduction.** Fresh browser profile, 1366x768.
1. `GET http://localhost:3000/workday/rcsa?ui=v3.1`. V3.1 renders correctly: 1 `<header>` (`wd-header`), 1 `<main>` (`wd-main`), `.workday-v3` present, `.workday-v2` absent.
2. `GET http://localhost:3000/workday/rcsa` with **no query string**. `document.cookie` is `nfr-workday-ui=v3.1`.
3. Observed: 4 `<header>` elements (`wd-header`, `app-topbar`, `app-workspace-head` twice) and 2 `<main>` elements (`wd-main`, `app-main`). Both `.workday-v3` and `.workday-v2` are in the document. The V2 dark interface paints over the V3.1 frame and the reader sees no trace of V3.1.

Evidence: `docs/screenshots/workday-v3/rcsa-home-cookienav-1366.png`.
Incidence: **18 of 18** `with-cookie` home loads, all 6 roles, all 3 widths. **0 of 18** `no-cookie` loads.

**Files and lines.**
- `src/workday/dispatch.tsx:42` calls `resolveUiVersion(query)`, which reads the query string only (`src/workday/ui-version.ts:51`). It never reads the middleware request header.
- `app/workday/[role]/layout.tsx:56` reads `x-nfr-workday-ui`, which middleware set from the cookie.
- The two therefore disagree whenever the version came from the cookie rather than the query. The page resolves to `DEFAULT_WORKDAY_UI`, which is `v2` (`src/workday/contracts.ts:40`), while the layout resolves to `v3.1`.
- `src/workday/ui-version.ts:66`, `resolveUiVersionFrom`, is the function written specifically to prevent this. Its own doc comment at `src/workday/ui-version.ts:56-65` predicts the exact symptom: "the symptom would be a V3.1 frame around a V2 page or the reverse". **It has zero callers** anywhere in `src/`, `app/` or `tests/`.

**Why it matters.** `middleware.ts:63-75` sets the response cookie precisely so that "a subsequent navigation that drops the parameter stays on the version the reviewer chose", and `middleware.ts:26-28` warns that "without it, clicking any link inside V3.1 would fall back to the default". The cookie is set correctly and the mechanism still fails, because the page half of the pair ignores it. Every link in the V3.1 navigation rail drops the reader into V2.

### D2. High. `/workday/<role>/my-work` returns 404 and the V3.1 rail links to it

**Reproduction.** `curl -o /dev/null -w "%{http_code}" "http://localhost:3000/workday/rcsa/my-work?ui=v3.1"` returns `404`. Incidence: 12 of 12 loads, 2 roles x 3 widths x 2 cookie conditions. Evidence: `docs/screenshots/workday-v3/rcsa-my-work-1366.png`.

**Files and lines.** `src/components/workday-v3/WorkdayNavigation.tsx:72` declares the item:

    { key: "myWork", icon: IconInbox, segment: "/my-work", count: (c) => c.myWork },

It is the **second of five primary items**, it carries a live count badge (4 for
`rcsa`), and no directory `app/workday/[role]/my-work/` exists. The complete route
list under `app/workday/[role]/` is `assistant`, `calendar`, `collaboration`,
`decisions`, `mail`, `meetings`, `workbench`, and nothing else.

**This is a V3.1-introduced regression.** The string `my-work` appears nowhere in
`app/` or `src/` outside `WorkdayNavigation.tsx`, so the V2 navigation does not
offer it. V3.1 added a labelled, counted, visually prominent link to a route that
has never existed.

Compounded by D3: the 404 it reaches is visually blank, so the reader gets no
explanation of what happened.

### D3. High. The 404 page is unreadable at 1.07:1 contrast and loses the header

**Reproduction.** Load `/workday/rcsa/my-work?ui=v3.1`. Measured: text colour
`rgb(247, 247, 250)` on background `rgb(255, 255, 255)`, contrast ratio
**1.07:1**, for both the `404` glyph at 24px and `This page could not be found.`
at 14px. WCAG 2.1 AA asks 4.5:1 for body text and 3:1 for large text, so this
misses by roughly a factor of four. The page also contains **0 `<header>` and
0 `<main>`**.

**Files and lines.**
- There is no `app/not-found.tsx` anywhere in the repository, so the Next.js built-in 404 is used. It paints its own white background.
- `src/styles/globals.css:39-41` sets `h1, h2, h3, h4, h5, h6 { color: var(--text-1); }`.
- `src/styles/tokens.css:72` defines `--text-1: #f7f7fa`, inside a `:root` block that declares `color-scheme: dark` at `src/styles/tokens.css:61`.
- The dark-only token set therefore leaks into a framework page that assumes a light background.

This is the single case where the brief's "header renders on every route"
requirement genuinely fails, and it is reachable in one click from the V3.1 rail.

### D4. High. 7 of 8 routes fall back to V2 and duplicate the page landmarks

**Reproduction.** `GET http://localhost:3000/workday/rcsa/decisions?ui=v3.1`.
Observed: 3 `<header>` (`wd-header`, `app-topbar`, `app-workspace-head`) and
2 `<main>` (`wd-main`, `app-main`), with `.workday-v2` and `.workday-v3` both
present. Evidence: `docs/screenshots/workday-v3/rcsa-decisions-1366.png`, which
shows the V2 dark interface in full with no visible trace of the V3.1 light
theme. Incidence: 70 of 72 fallback-route loads showed two `<main>` landmarks;
the other 2 were captured mid-stream during the loading skeleton.

**Files and lines.**
- `src/workday/dispatch.tsx:54`, `if (version === "v3.1" && V3) return <V3 ... />;`, then line 55 falls through to V2.
- Only `app/workday/[role]/page.tsx:21` passes a third argument. The other seven dispatchers pass two: `decisions/page.tsx:20`, `workbench/page.tsx:20`, `meetings/page.tsx:20`, `mail/page.tsx:20`, `calendar/page.tsx:20`, `collaboration/page.tsx:20`, `assistant/page.tsx:20`.
- `app/workday/[role]/layout.tsx:58-63` states the contract that is being broken: "Only V3.1 gets this frame. V1 and V2 render their own shells inside their pages, so wrapping them here would produce two headers." The layout gates on the version, not on whether the page actually has a V3 implementation, so a V3.1 request for a fallback route produces exactly the two headers the comment rules out.

**Measured cost.** `/workday/rcsa/decisions` is 341,257 bytes under `?ui=v3.1`
against 325,636 under `?ui=current`, so asking for the lighter interface returns
a **4.8% heavier** document. Two `<main>` landmarks in one document is also an
ARIA landmark violation, and the `skip-link` can only target one of them.

The comment at `src/workday/dispatch.tsx:49-51` defends the fallback as letting
"the eight routes be migrated one at a time without any of them being unreachable
in between". The intent is sound. The implementation is incomplete, because the
layout was not taught the same per-route condition.

### D5. Medium. The `Now / Next / Done` model is only one third labelled

**Reproduction.** On all six v3.1 role homes at 1366x768, regular-expression the
main region's `innerText` for the standalone words `Now`, `Next` and `Done`.
Result on all six: `Now` absent, `Next` present, `Done` absent.

**Files and lines.**
- `src/components/workday-v3/RoleHome.tsx:29` defines `COPY.now` as `"Needs you now"`. Its **only** use is as an `aria-label` at `src/components/workday-v3/RoleHome.tsx:133`. No sighted reader ever sees it. The visible eyebrow is the object kind, `"Decision"`, at 12px.
- `src/components/workday-v3/RoleHome.tsx:31` defines `COPY.done` as `"Done today"`. It has **zero usages**. The disclosure renders `COPY.handled`, `"Handled automatically"`, at `src/components/workday-v3/RoleHome.tsx:305`.
- `src/components/workday-v3/RoleHome.tsx:2` states the design as "The role home. Now, Next, Done."

A sighted first-week analyst sees an unlabelled card, then `Next`, then `Watching`
and `Handled automatically`. Three of those four labels are not the vocabulary the
design is named for, and the most important one is invisible to anyone not using a
screen reader. The structure is there; the naming is not.

### D6. Medium. The calm theme draws 2.8 times more lines than the dense one

**Reproduction.** Per the section 2 counting rules, at 1366x768: `current` renders
5 visible border sides in the main region's first viewport, `v3.1` renders 14.
Identical on all six roles, so it is structural rather than content dependent.

V3.1 wins on words, chips and controls, and then spends the quiet it bought on
ruled lines. The `Next` list rows and the disclosure row account for most of the
increase. For a brief whose word is "calm", a 180% increase in visible rules is a
measurable move in the wrong direction, and it is the one headline number where
v3.1 is plainly worse than current.

### D7. Medium. The type hierarchy is inverted and nearly flat

**Reproduction.** At 1366x768, enumerate visible elements in the v3.1 main region
that own a direct text node, sorted by computed font size.

| Rank | Element | Text | Size | Weight |
|---|---|---|---|---|
| 1 | `H1.wd-page-title` | the role name, for example `Operational Risk Partner` | **20px** | 600 |
| 2 | `H2.wd-now-action` | the actual work item | **18px** | 600 |
| 3 | `H2.wd-section-label` | `Next` | 16px | 500 |

**Files and lines.** `src/components/workday-v3/RoleHome.tsx:127` renders
`<h1 className="wd-page-title">{pageTitle}</h1>`, and the H2 for the active item
is at `src/components/workday-v3/RoleHome.tsx:164`.

Two problems, both measured:

1. **Inverted.** The largest, heaviest text on the screen is a static role label
   that is identical on every visit and tells a reader nothing they did not
   already know. The thing that needs a decision today is second. By contrast,
   the largest text in `current` is `This needs you now`, which at least orients.
2. **Flat.** 2px and zero weight difference separate rank 1 from rank 2. At a
   glance they read as siblings, which is why section 5.2 has to distinguish
   "strongest fill" from "largest type": by fill the answer is unambiguous, by
   type size two elements compete.

V3.1 also did not raise the type ceiling at all. Maximum font size is **20px in
both versions**. A light, calm, spacious theme that keeps the dense theme's
largest size has given up its main lever for showing a first-week analyst where
to look.

### D8. Low. One role renders two identical `Next` reason lines

**Reproduction.** `/workday/control-assurance?ui=v3.1`, read the three
`.wd-item-sub` values. Observed: `an escalation is waiting on your authority`,
`an escalation is waiting on your authority`, `the assurance conclusion is yours
to sign`. Rows 1 and 2 are indistinguishable below the title.

**File and line.** `src/components/workday-v3/RoleHome.tsx:250`,
`{item.reason || item.humanAction}`. The code comment at
`src/components/workday-v3/RoleHome.tsx:243-248` describes having fixed precisely
this class of problem by using the reason rather than the action class. The fix
works for 5 of 6 roles; in `control-assurance` two different items carry the same
reason string, so the data reintroduces the symptom the code guards against. A
data issue rather than a rendering issue, which is why it is ranked low.

### D9. Low. The v3.1 main region still overflows at the smallest target width

**Reproduction.** `/workday/rcsa?ui=v3.1` at 1366x768: `main.wd-main` has
`scrollHeight` 704 against `clientHeight` 680, a 24px overflow. At 1440x900 and
1920x1080 there is no overflow (812 of 812, and 992 of 992).

The disclosure row itself is fine: it sits at y 684 to 712 at all three widths,
clear of the updates bar at y 728, which confirms the claim made in the comment at
`src/components/workday-v3/RoleHome.tsx:274-280` that `Done` lands near 683px and
stays visible. The residual 24px means the single-screen layout is not quite
single-screen at the smallest supported width.

---

## 7. Where v3.1 is better, stated plainly

So the ledger is honest, these are real and measured:

- **Document weight on the native route: 61,789 bytes against 372,294, an 83.4% reduction.** The largest single improvement anywhere in this audit.
- **40.5% fewer interactive elements in the first viewport**, 25 against 42.
- **87.5% fewer coloured chips**, 1 against 8.
- **17.6% fewer words in the main region**, 137.8 against 167.2.
- **Exactly one filled high-contrast element per role home**, and it is the correct one: the primary action. In `current`, `Now`, `Approval required`, `Ready for review`, `Proposal` and `Read` all compete for notice simultaneously.
- **`Next` row subtitles are distinct reasons** rather than a repeated action class, in 5 of 6 roles. This was a deliberate fix, documented at `RoleHome.tsx:243-248`, and it worked.
- **The `Now` card leads with the subject, not the verb.** The eyebrow is the object kind at 12px and the H2 carries what distinguishes this item. The fix described at `RoleHome.tsx:136-155` is present in the rendered output.
- **The header streams before the page.** Observed directly: 2 of 12 `/decisions` loads were captured with the header painted and the main region still showing the skeleton. The layout plus `loading.tsx` plus `error.tsx` structure does what it was built to do.
- **The header is present and non-empty on 108 of 108 loads that returned 200**, across 6 roles, 8 routes, 3 widths and both cookie conditions.

---

## 8. Conclusion: is v3.1 yet better than current for a first-week analyst?

**Not yet, and the reason is coverage rather than design.**

The V3.1 role home is the better screen. On the one route where it actually
renders, it carries 17.6% fewer words, 40.5% fewer controls and 87.5% fewer
chips, and it points at a single unambiguous action with the only filled button on
the page. A first-week analyst landing on `/workday/rcsa?ui=v3.1` with a clean
cookie jar is better served than the same analyst on `?ui=current`. That much the
measurements support.

But that is 6 of 54 role and route combinations, **11.1%** of the surface. The
other 89% is where a first-week analyst would actually spend the day, and there
the experience is worse than simply using `current`:

1. **The second item in the navigation rail is a 404** (D2) that renders as a
   blank white screen at 1.07:1 contrast (D3). An analyst working down the
   navigation in reading order hits it as their first click.
2. **Every other navigation item returns V2 wearing a V3.1 frame** (D4), so the
   theme, the density and the vocabulary change under the reader on every
   navigation, and the document is heavier than asking for `current` outright.
3. **The cookie that is supposed to make V3.1 sticky does not reach the page**
   (D1), so even the one good route reverts to V2 the moment a reader arrives
   without `?ui=` in the URL. In practice a first-week analyst, who would reach
   the workspace through a bookmark or an in-app link rather than by typing a
   query parameter, would mostly **never see V3.1 at all**.

D1 is the one to fix first, and it is small: `src/workday/dispatch.tsx:42` should
call `resolveUiVersionFrom` with the `x-nfr-workday-ui` header. That function
already exists at `src/workday/ui-version.ts:66`, is documented for exactly this
failure, and is currently dead code. Until it is called, the V3.1 interface is
reachable only by hand-editing the address bar, and no amount of work on the
remaining seven routes will change that.

On the brief's two non-negotiables:

- **Header renders reliably on every route, refresh, screen size and loading
  state.** A qualified pass. 108 of 108 successful loads carry a non-empty 48px
  header at all three widths in both cookie conditions, and it demonstrably
  streams ahead of the page, which was the original defect this structure was
  built to fix. It fails on `/my-work`, and on 88 of 120 loads a second competing
  header is also present, which is not what "reliably" should mean.
- **The default screen is understandable by a first-week analyst without
  training.** A near pass on the role home, held back by naming rather than
  layout. The screen reads well and has one obvious action, but the word `Now`
  never appears, the word `Done` never appears (D5), and the largest text on the
  page is the role title rather than the work (D7). A reader can tell what to do;
  they cannot tell that they are looking at the `Now / Next / Done` model the
  interface is organised around.

Recommended order of work, on the evidence above: D1, then D2 with D3, then D4,
then D5 and D7 together as one typography and copy pass, then D6.
