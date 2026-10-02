# Interactive Workday V2

## The AI Operations Partner

This document explains what changed in the interactive layer of NFR WorkOS, why
each change was made, and where the code for it lives. It is written for an
engineer or designer picking the work up, not for a client audience.

The product framing it serves is:

> A configurable non-financial risk system of engagement with governed
> integration into the bank's existing systems of record.

The experience statement it is built against is:

> I can see what needs my attention now, what the AI is handling, what changed
> while I was away, and what only I can decide.

---

## 1. What was wrong, measured

The V1 interactive layer was technically strong and inherited too much of the
presentation system. That is not a stylistic complaint, it is measurable.
Agent A captured 57 baseline screenshots at three viewports before any change
and the numbers below come from those, with the geometry recomputed
independently.

### 1.1 Permanent chrome against central work area

| Viewport | V1 centre | V2 centre | Change |
|---|---|---|---|
| 1920x1080 | 1316x940, 59.7 percent | 1526x982, 72.3 percent | plus 12.6 points |
| 1440x900 | 836x760, 49.0 percent | 1046x802, 64.7 percent | plus 15.7 points |
| 1366x768 | 762x628, 45.6 percent | 1260x670, 80.5 percent | plus 34.9 points |

At 1366x768, the size most likely to be in front of a client on a meeting room
projector, the V1 work object had less than half the screen. The permanent
chrome was a 56px top bar, an 84px timeline, a 232px left rail and a 372px
intelligence rail, and none of it could be put away. The baseline screenshots
also show the left rail label clipped mid-word at that width.

### 1.2 Typography

V1 interactive routes used Space Grotesk for headings, Inter for body and
JetBrains Mono for labels, metadata, identifiers, measurements and controls,
on a scale whose `--text-2xl` was 36px. A route opened with a 36px heading and
a narrative lede paragraph, so a user read what the screen was before they
could use it. Uppercase mono labels tracked at 0.09em were applied to
navigation and section titles, which reads as output from a tool rather than as
an application.

### 1.3 Other findings carried into the work

- Navigation used single ASCII characters: `# @ ~ = ! * + ? &`. They carried no
  meaning a user could learn.
- The assistant route placed the chat input below four substantial panels, so
  reaching a conversation required scrolling past the mode table, the autonomy
  state, the withheld actions and the available actions.
- The intelligence rail rendered eight tab chips at identical visual weight
  although their counts differed by more than tenfold.
- The timeline supported scrubbing and nothing else. No play, no unread state,
  no catch-up, no automatic pause.

The full before picture is `docs/handoffs/workday-v2-current-audit.md`, with
screenshots in `docs/screenshots/workday-v1/`.

---

## 2. Scope, and what was deliberately not touched

Changed: the eight interactive workday routes, the shell, the scoped visual
system, the live event model, the AI Partner, the focus queue, the role
workspace integration, the loading and generation choreography, the product
configuration layer and the integration runtime.

Not changed: `/story`, `/control-room`, `/trust`, `/value`, `/roadmap`, the
presentation design system in `src/styles/presentation.css`, the scenario, the
authority model, the evidence model and the seeded non-financial risk content.

Three modules were treated as frozen because they are the security boundary or
the thing the security boundary depends on:

- `src/server/security/authority.ts`, the deterministic gate
- `src/server/config/load-openai-config.ts`, the only module that can resolve a
  key
- `src/server/logging/redact.ts`, the redaction layer

---

## 3. The scoped visual system

### 3.1 Why scoping rather than replacing

A presenter-led deck and a working application want different typography,
different density and different colour discipline. A deck is read from eight
metres by an audience that is not operating it; an application is read from
sixty centimetres by someone who has it open for seven hours. Those are not
reconcilable by compromise, and V1 compromised by inheriting the deck.

So the application has its own scope. Everything lives under `.workday-v2`:

- `src/styles/workday-v2-tokens.css`, the tokens
- `src/styles/workday-v2.css`, the component styles

Nothing in either file is declared on `:root`, so `/story` is unaffected by
anything in them. That is also what allows both interfaces to be served from
the same routes for comparison.

### 3.2 The token bridge

The repository contains a large amount of good domain work the interactive
layer must keep: the evidence citation list, the uncertainty panel, the
contradiction card, the decision flow, and six role visualisations running to
several thousand lines between them. All of it references the presentation
token names.

Rather than rewrite those components, the bridge block in
`workday-v2-tokens.css` remaps the old token names to the new values inside the
workday scope. A component written against `--surface-1` and `--text-2` renders
in graphite and Geist without being touched, and the same component on `/story`
is unaffected.

Two of those remappings enforce acceptance criteria structurally rather than by
review:

- **The type scale is capped.** `--text-2xl` was 36px and is 20px here;
  `--text-3xl` and `--text-4xl` collapse to 24px. A reused component that asks
  for display type cannot produce a deck-sized heading on a working screen.
  This is a stronger guarantee than auditing each call site.
- **Pink is removed.** It was the presentation selection colour. In an
  application it competes with the danger tone at a glance, so it maps onto the
  AI accent and selection becomes a neutral raise plus one active edge.

### 3.3 Typography

Geist Sans and Geist Mono, self-hosted from the official `geist` package into
`public/fonts/`, declared with plain `@font-face`. No runtime request to a font
service, because the application must render with its intended typography in
offline mode and the build must not depend on network access. Licensing is
recorded in `public/fonts/THIRD_PARTY_NOTICES.md`; both are SIL OFL 1.1, the
same licence as the three presentation families.

The application scale:

| Token | Size | Used for |
|---|---|---|
| `--app-text-2xs` | 11px | counts inside chips only |
| `--app-text-xs` | 12px | metadata, secondary detail |
| `--app-text-sm` | 13px | dense rows, compact controls |
| `--app-text-base` | 14px | default interface text |
| `--app-text-md` | 15px | primary row text, assistant response |
| `--app-text-lg` | 16px | section heading |
| `--app-text-xl` | 18px | work object title |
| `--app-text-2xl` | 20px | primary focus title |
| `--app-text-3xl` | 24px | rare hero or empty state only |

Geist Mono is reserved for time, identifiers, indicator values, percentages,
counts, timestamps and audit references. Explanatory prose is never monospaced.
The presentation `.label` class, an uppercase tracked mono label, is normalised
to sentence case at the metadata size inside the workday scope.

### 3.4 Colour

A graphite-neutral base with colour reserved for meaning: AI activity,
information, completed work, human judgment, material risk and current focus.
Default surfaces are neutral, cards are not tinted by default, and there are no
decorative gradients and no full-screen ambient wash.

Each semantic hue has a separate text variant. The base hues are calibrated for
borders, dots, bars and icon strokes, and several of them fail the WCAG AA
4.5:1 threshold as small text on their own tint. That matters because these
colours carry the AI state and the human judgment state, and a reader must be
able to tell those apart. The `--app-*-text` variants are the only values
permitted for text.

The full reference, including the geometry and motion tokens and every
component API, is `docs/handoffs/workday-v2-visual-system.md`.

---

## 4. The shell

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Compact top bar, 48px                                                    │
├──────┬────────────────────────────────────────────────┬──────────────────┤
│ Icon │                                                │ AI Partner       │
│ rail │             Focus workspace                    │ Suggestions      │
│ 58px │                                                │ Activity         │
│      │                                                │ Chat             │
│      │                                                │ 336px            │
├──────┴────────────────────────────────────────────────┴──────────────────┤
│ Live day bar, 50px, with the synthetic data disclosure                   │
└──────────────────────────────────────────────────────────────────────────┘
```

| File | Responsibility |
|---|---|
| `src/components/workday-v2/AppShellV2.tsx` | Server. Reads the scenario, resolves branding, assembles the chrome. |
| `src/components/workday-v2/ShellFrame.tsx` | Client. Grid, the three partner renderings, mounts the drawer and the palette. |
| `src/components/workday-v2/ShellContext.tsx` | Client. Rail expansion, partner open state, drawer tab, palette state. |
| `src/components/workday-v2/TopBarV2.tsx` | Client. Brand, role, context, command trigger, live status, demo and account menus. |
| `src/components/workday-v2/NavigationRail.tsx` | Client. Tabler icons, active edge, counts, collapse. |
| `src/components/workday-v2/FocusWorkspace.tsx` | Server. Now, Next, Handled, Watching, then the work object. |
| `src/components/workday-v2/ContextDrawer.tsx` | Client. The former intelligence rail, as a drawer plus compact triggers. |
| `src/components/workday-v2/DemoMenu.tsx` | Client. Today versus future, mode, language, jump, surfaces, reset. |
| `src/components/command/CommandPalette.tsx` | Client. Control K, the object index and the command set. |
| `src/components/workday-v2/WorkdayV2Route.tsx` | Server. The common assembly every route shares. |

### 4.1 Why the shell is fixed to the viewport

`position: fixed; inset: 0`, carried forward from V1 for a reason worth
keeping. A viewport-sized grid with `overflow: hidden` still leaves the
document scrollable programmatically, and `window.scrollTo` genuinely carried
the top bar and the permanent synthetic data disclosure off screen. Taking the
shell out of flow removes the in-flow content that could overflow. Content is
reached through the inner scrollers.

### 4.2 Why opening the partner does not remount the workspace

The centre is a stable child of `ShellFrame` and the slots are React nodes
rendered on the server and passed in. Toggling the partner changes a grid
template and nothing else. An earlier arrangement that rendered the centre
inside a conditional branch remounted a role visualisation worth several
thousand lines every time the dock opened, which was visible as a flash.

### 4.3 What the top bar refuses

It carries the product mark, the role and entity, the current work object, the
command trigger, live status, and the account and settings menu. Everything
else moved. The autonomy state moved to the AI Partner header, where it is
contextually relevant to the thing it governs. Language, mode, the Today versus
future toggle, reset and the presentation links moved into the demo menu.

The V1 structural guard is retained because its failure mode was silent:
`overflow: hidden` on the bar, `min-width: 0` on the flexible children, and one
group that yields space by truncating. An earlier version set a min-content
width wider than the viewport, laid the shell out at roughly 2068px and carried
controls off stage with no scrollbar to reveal them.

### 4.4 Branding

No logo is hardcoded. `BrandView` is resolved from the product configuration
and passed in, and the three modes are client, Accenture and co-branded. The
configured artwork is deliberately abstract and wordmark free, because shipping
real institution or consultancy artwork into a repository holding a synthetic
institution would misuse the trademark and imply an endorsement that does not
exist. The mark therefore carries recognition and the name carries identity,
and both are rendered.

---

## 5. The AI Partner

The partner is a presence, not a destination. It is mounted once per route by
`WorkdayV2Route`, so it is present on all eight workday routes, and it has
three tabs: Suggestions, Activity, Chat. The third tab is labelled Chat rather
than Ask, because the main conversational capability must not be hidden behind
a smaller word.

- Components: `src/components/ai-partner/`, documented in
  `docs/handoffs/workday-v2-ai-partner.md`
- Server generation, chat and the routes: `src/agents/suggestions/`,
  `src/agents/chat/`, `app/api/workday/`, documented in
  `docs/handoffs/workday-v2-ai-generation.md`
- The wiring between them: `src/components/workday-v2/PartnerClient.tsx` and
  `PartnerSlot.tsx`

### 5.1 The dock executes nothing

Every action is a callback and the dock fetches nothing. That is the right
shape, because the thing on the other end of Approve has to be the authority
gate and not a component. `PartnerClient.tsx` is the only file where the dock
meets the rest of the application.

Approve is not a shortcut. It routes to the decision flow, where the rationale
and the confirmation that the rationale is the accountable person's own are
captured, and where the gate refuses without them. A one-click Approve on a
suggestion card would bypass the single most important control in the product.

### 5.2 Motion requires two conditions

The sheen and the live dot are the only permitted motion, and both require a
real running flag AND a state in which this surface is the one doing the work.
An interface that pulses while nothing is happening is lying about work, and it
is the easiest lie for an AI product to tell.

### 5.3 Checks and actions are never merged

A suggestion renders `checksCompleted` and `actionsCompleted` as two distinct
lists. What was examined is not what was changed, and blurring them would be
the central dishonesty this product exists to avoid. `recommendedAction` is a
third thing again: what is proposed, not what happened.

---

## 6. The live day

- Components and hooks: `src/components/live-day/`, `src/hooks/`
- Event model and player: `src/scenario/engine/live-events.ts`,
  `live-player.ts`
- Channel: `app/api/workday/events/route.ts`
- Documented in `docs/handoffs/workday-v2-live-day.md`

The event table `workday_live_events` is a **projection, not a second
scenario**. Every row is derived from content that already exists, and the
`derivedFrom` and `derivedFromId` columns record which: the ten timeline
moments and their per-role detail, seeded background actions, inbox messages,
meetings, open decisions, and inbound integration events. The product's whole
claim is that one institution and one day are shared across six functions, and
a parallel event source would quietly break it.

Read state is per role, keyed `(eventId, roleId)`. The same 14:05 event is
unread for the third-party risk lead and for the resilience lead independently,
which is what makes a count mean something after a role switch.

Live time and viewed time are separate columns. The scenario run holds live
time; `live_player_state.viewedMoment` holds what the user is looking at. That
is what lets the interface say "Viewing 10:30, live at 14:05" truthfully, and
why scrubbing backwards never rewinds the day or un-records a decision. Time is
a view; decisions are facts.

The player pauses itself at a moment carrying a material human decision rather
than rolling past it. Keyboard: Space, Left, Right, C, L, all guarded by
`isTypingTarget` so a presenter typing into the chat composer does not pause
the day with every word.

---

## 7. Loading and generation choreography

The application must look like it is connecting, loading, reconciling,
checking, generating, validating and completing. The purpose is not artificial
delay; it is that a screen which appears fully populated the instant it opens
tells the user nothing about where its content came from.

- Components: `src/components/loading/`
- Hooks: `src/hooks/useProgressiveData.ts`, `useAIGenerationState.ts`
- State contracts: `DataLoadState` and `AIGenerationState` in
  `src/workday/contracts.ts`

Rules that are enforced rather than encouraged:

1. The shell renders before workday data. The workday never opens to a blank
   centre canvas.
2. A suggestion is published only after structured validation succeeds, and the
   `validatedAt` column is filtered in the read model, so an unvalidated row
   cannot reach the interface even if something upstream wrote one.
3. Live, presenter-safe and offline use the same visible state machine. Only
   the origin of the payload differs.
4. A minimum transition of about 300ms exists only to prevent a flash when
   cached content resolves immediately. A live request is never slowed to
   lengthen an animation.
5. A required source that is unavailable produces a constrained view that names
   the missing source and does not present a high-confidence recommendation.
6. Reduced motion replaces shimmer with a neutral fill and keeps every piece of
   readiness information in text.

Explicitly not built, because the brief prohibits them: a large centre spinner,
fake terminal output, random code characters, a pulsing orb, constant glow, a
typewriter effect on every label, long artificial delays.

---

## 8. Product configuration and integration

These are the two layers that make the experience a product rather than one
bank's application.

| Area | Code | Document |
|---|---|---|
| Organisation, brand, terminology, entitlements, deployment | `src/product/` | `docs/PRODUCT_ARCHITECTURE.md`, `docs/WHITE_LABEL_AND_PACKAGING.md`, `docs/DEPLOYMENT_PROFILES.md` |
| Connectors, runtime, outbox, receipts, retries | `src/integrations/` | `docs/INTEGRATION_FABRIC.md`, `docs/CONNECTOR_CONTRACT.md` |
| Honest gaps | | `docs/PRODUCTIZATION_GAPS.md` |
| Administrator surfaces | `app/settings/` | |

Three guarantees are structural rather than conventional:

1. **Source identity survives normalisation.** `external_references` keeps the
   connector, the external type and identifier, the external version and the
   source timestamp for every object read from outside, so a record that came
   from the GRC platform can always be opened there again.
2. **Nothing external is reported done before the target says so.** A receipt
   row is written from an acknowledgement. A receipt line cannot exist for a
   change the target never confirmed, which mirrors the guarantee the local
   mutation layer already makes.
3. **Retry cannot duplicate.** `idempotency_key` is unique, so a replay of the
   same approved command finds the existing row rather than creating a second
   external object.

Every external command passes the same deterministic authority gate as a local
action. There is no separate path for integration actions.

---

## 9. The version flag and migration

Both versions are served from the same routes, read the same database, the same
scenario run, the same repositories, the same server actions and the same
authority gate. Only presentation differs, which is what makes a side-by-side
comparison meaningful.

```text
?ui=v1      the previous interface
?ui=v2      the new interface
NFR_WORKDAY_UI=v1|v2   pins a version for a deployment
```

V2 is the default. Resolution order is query, then environment, then default:
`src/workday/ui-version.ts`, with the dispatcher factory in
`src/workday/dispatch.tsx`. Each route is `page.tsx` choosing between `v1.tsx`
and `v2.tsx`.

V1 is a fallback for the transition, not a supported variant. There is
deliberately no third implementation and no per-user persistence, because the
brief is explicit that two permanent business implementations must not be
maintained.

---

## 10. Shared contracts

`src/workday/contracts.ts` is the seam between the parts of the experience that
were built independently. It holds types, label maps and pure functions only:
no database access, no React, no server imports, so it is importable from a
client component, a server component, a route handler and a test without
pulling a runtime behind it.

What crosses that seam: `DataLoadState`, `AIGenerationState`, `AIPartnerState`,
`WorkdayLiveEvent`, `WorkdayStreamEvent`, `aiSuggestionSchema`,
`AISuggestionView`, `AIActivityEntryView`, `SourceAttribution`,
`ExecutionReceiptLineView`, `FocusItemView`, `WorkdayContext`,
`WorkdaySelection`, `CanonicalType`, and the helpers `pick`, `momentAge`,
`dedupeFocusItems`, `partnerStateFromGeneration`, `resolveWorkdayUi`.

---

## 11. Copy rules

The no-em-dash rule is unchanged and is enforced by `npm run check:copy`, which
scans source, documentation, seeded data, translations and exports.

Application copy is short and app-like: "Needs you", "Handled automatically",
"Checking evidence", "Suggestion ready", "Review 3 new", "Jump to live", "Open
evidence", "Ask why", "Waiting for approval", "Executed", "Blocked by policy".

The interface does not explain itself on itself. Technical explanation lives in
documentation, Trust and the Control Room.

German is ASCII transliteration throughout, matching the existing corpus, which
contains no umlaut characters.

Two disclosures are permanent and are not configurable away:

- "Synthetic institution and data", in the live day bar. It is there rather than
  in the top bar because the top bar is the one place in the shell where every
  control competes for width, and therefore the one place it could be pushed
  out of view.
- "Illustrative regulatory context, not legal advice", attached to every
  regulatory reference through the `RegulatoryNote` primitive, so the wording
  cannot drift from screen to screen.

Jurisdiction is handled per entity, not per group. DORA and the EBA guidance
reach the German and Austrian entities; the Swiss entity is supervised by FINMA
and is not in scope for DORA. Flattening that into one list for the group would
produce exactly the misstatement the product is required to avoid.
